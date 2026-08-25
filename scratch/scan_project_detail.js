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
  const evalFn=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true}); return r.result&&r.result.value;};
  // 点击 变压器3D模型
  let res=await evalFn(`(() => {
    const btns=[...document.querySelectorAll('button')];
    const t=btns.find(b=> (b.innerText||'').trim()==='变压器3D模型');
    if(!t) return 'not found';
    t.click(); return 'clicked 变压器3D模型';
  })()`);
  console.log(res);
  await new Promise(r=>setTimeout(r,2000));
  let body=await evalFn('document.body.innerText.slice(0,5000)');
  console.log('after click project',body.slice(0,4000).replace(/\n/g,' | '));
  // 查找该项目内的 tab 或按钮
  let tabs=await evalFn(`(() => {
    return [...document.querySelectorAll('button, a')].map(e=> (e.innerText||'').trim()).filter(t=>t).slice(0,80);
  })()`);
  console.log('tabs',JSON.stringify(tabs,null,2));
  // 尝试点击各个可能的项目内导航
  const targets=['设置','智能体','工作区','会话','MCP','知识','Agent','Workspace'];
  for(const t of targets){
    const found=tabs.includes(t);
    console.log('check',t,found);
  }
  // 扫描
  const scan=await evalFn(`(() => {
    const seen=new Set(); const out=[];
    function walk(el){ if(!el.children||!el.children.length){ const t=(el.textContent||'').trim(); if(t&&/[a-zA-Z]/.test(t)&&!seen.has(t)&&t.length<250) {seen.add(t); out.push(t.slice(0,150));} return;} for(const c of el.children) walk(c); }
    walk(document.body); return out;
  })()`);
  console.log('scan',JSON.stringify(scan.slice(0,80),null,2));
  socket.close(); process.exit(0);
});
