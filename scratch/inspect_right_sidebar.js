const http=require('http');
function findPort(cb){
  http.get({host:'127.0.0.1',port:9222,path:'/json/list',timeout:2000},res=>{
    let d='';res.on('data',c=>d+=c);res.on('end',()=>cb(null,JSON.parse(d)));
  }).on('error',cb);
}
findPort(async (err,list)=>{
  const page=list.find(t=>t.type==='page' && t.url.includes('127.0.0.1:') && !t.url.startsWith('data:'));
  const socket=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r=>socket.onopen=r);
  let id=0,pending=new Map();
  socket.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result);pending.delete(m.id);}};
  const send=(m,p)=>new Promise(res=>{const nid=++id;pending.set(nid,res);socket.send(JSON.stringify({id:nid,method:m,params:p}));});
  const evalFn=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true}); if(r.exceptionDetails) console.log(JSON.stringify(r.exceptionDetails).slice(0,500)); return r.result&&r.result.value;};
  // 尝试定位右侧边栏：通过 --aux-pane-width 或 class 含 aux/sidebar
  const info=await evalFn(`(() => {
    const all=[...document.querySelectorAll('*')];
    const cands=all.filter(e=>{
      const cls=(e.className||'').toString();
      const style=e.getAttribute('style')||'';
      return cls.includes('aux') || cls.includes('sidebar') || cls.includes('panel') || style.includes('aux-pane') || style.includes('sidebar-width');
    }).slice(0,20).map(e=> ({tag:e.tagName, cls:(e.className||'').toString().slice(0,120), text:(e.innerText||'').slice(0,200), html:e.outerHTML.slice(0,400)}));
    return cands;
  })()`);
  console.log('candidates',JSON.stringify(info,null,2));
  // 直接获取右侧区域 innerText：尝试通过计算样式定位在右侧的元素
  const rightText=await evalFn(`(() => {
    // 查找所有可见的、位于右侧 30% 区域的元素
    const vw=window.innerWidth;
    const els=[...document.querySelectorAll('div, aside, section, nav')].filter(e=>{
      const r=e.getBoundingClientRect();
      return r.width>100 && r.height>100 && r.right > vw*0.65 && r.left < vw && e.offsetParent;
    }).slice(0,10);
    return els.map(e=> ({tag:e.tagName, cls:(e.className||'').toString().slice(0,100), rect:{left:Math.round(e.getBoundingClientRect().left), right:Math.round(e.getBoundingClientRect().right), width:Math.round(e.getBoundingClientRect().width)}, text:(e.innerText||'').slice(0,800)}));
  })()`);
  console.log('rightText',JSON.stringify(rightText,null,2));
  // 全量扫描右侧英文：通过 TreeWalker 且过滤左侧已知的项目列表
  const scan=await evalFn(`(() => {
    const seen=new Set(); const out=[];
    function walk(el, depth){
      if(!el.children || !el.children.length){
        const t=(el.textContent||'').trim();
        if(t && /[a-zA-Z]/.test(t) && t.length<200 && !seen.has(t)){
          seen.add(t);
          // 判断是否在右侧：通过 bounding rect
          try{
            const r=el.getBoundingClientRect();
            const isRight=r.left > window.innerWidth*0.6;
            if(isRight) out.push({text:t.slice(0,150), cls:(el.className||'').toString().slice(0,80), tag:el.tagName, left:Math.round(r.left)});
          }catch(e){}
        }
        return;
      }
      for(const c of el.children) walk(c, depth+1);
    }
    walk(document.body,0);
    return out.slice(0,100);
  })()`);
  console.log('right scan',JSON.stringify(scan,null,2));
  // 同时尝试触发右侧边栏的多级菜单：悬停或点击右侧的按钮
  const rightBtns=await evalFn(`(() => {
    const vw=window.innerWidth;
    const btns=[...document.querySelectorAll('button, [role=button], [role=tab]')].filter(b=>{
      const r=b.getBoundingClientRect();
      return r.left > vw*0.6 && b.offsetParent;
    }).map(b=> (b.innerText||b.textContent||'').trim()).filter(Boolean);
    return [...new Set(btns)].slice(0,50);
  })()`);
  console.log('right buttons',JSON.stringify(rightBtns,null,2));
  socket.close(); process.exit(0);
});
