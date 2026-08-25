const http=require('http');
function findPort(cb){
  http.get({host:'127.0.0.1',port:9222,path:'/json/list',timeout:2000},res=>{
    let d='';res.on('data',c=>d+=c);res.on('end',()=>cb(null,JSON.parse(d)));
  }).on('error',cb);
}
findPort(async (err,list)=>{
  const page=list.find(t=>t.type==='page' && t.url.includes('127.0.0.1:') && !t.url.startsWith('data:'));
  if(!page){console.log('no page'); process.exit(1);}
  const socket=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r=>socket.onopen=r);
  let id=0,pending=new Map();
  socket.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result);pending.delete(m.id);}};
  const send=(m,p)=>new Promise(res=>{const nid=++id;pending.set(nid,res);socket.send(JSON.stringify({id:nid,method:m,params:p}));});
  const evalFn=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true}); return r.result&&r.result.value;};
  // 确保在 应用设置 -> 远程控制可见
  await evalFn(`(() => {
    const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='设置');
    if(b) b.click();
    return 1;
  })()`);
  await new Promise(r=>setTimeout(r,800));
  await evalFn(`(() => {
    const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='应用设置');
    if(b) b.click();
    return 1;
  })()`);
  await new Promise(r=>setTimeout(r,1200));
  // 获取 Remote Control 卡片区域文本
  const info=await evalFn(`(() => {
    const all=[...document.querySelectorAll('*')];
    const hits=all.filter(e=>{
      const t=(e.innerText||'').trim();
      return t.includes('Device Name') || t.includes('Scan the code');
    }).slice(0,5).map(e=>{
      let cur=e;
      const chain=[];
      for(let i=0;i<6&&cur;i++){
        chain.push({tag:cur.tagName, cls:(cur.className||'').toString().slice(0,100)});
        cur=cur.parentElement;
      }
      return {tag:e.tagName, text: (e.innerText||e.textContent||'').trim().slice(0,300), outer: e.outerHTML.slice(0,500), chain};
    });
    return hits;
  })()`);
  console.log(JSON.stringify(info,null,2));
  // 获取所有包含 Device 的文本
  const dump=await evalFn(`(() => {
    const seen=new Set(); const out=[];
    function walk(el){
      if(!el.children||!el.children.length){
        const t=(el.textContent||'').trim();
        if(t && /Device|Scan/.test(t) && !seen.has(t)){seen.add(t); out.push(t);}
        return;
      }
      for(const c of el.children) walk(c);
    }
    walk(document.body);
    return out;
  })()`);
  console.log('dump',JSON.stringify(dump,null,2));
  // 直接获取特定元素的精确文本
  const exact=await evalFn(`(() => {
    const el=[...document.querySelectorAll('*')].find(e=> (e.textContent||'').trim()==='Device Name');
    if(el) return {text: el.textContent, parentText: el.parentElement?el.parentElement.innerText.slice(0,300):''};
    return null;
  })()`);
  console.log('exact Device Name',JSON.stringify(exact,null,2));
  const exact2=await evalFn(`(() => {
    const el=[...document.querySelectorAll('span, div, p')].find(e=> (e.textContent||'').includes('Scan the code'));
    if(el) return {text: el.textContent.trim().slice(0,500), html: el.innerHTML.slice(0,600)};
    return null;
  })()`);
  console.log('exact Scan',JSON.stringify(exact2,null,2));
  socket.close(); process.exit(0);
});
