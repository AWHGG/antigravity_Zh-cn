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
  const info=await evalFn(`(() => {
    const c=document.querySelector('div.relative.w-full.h-full.overflow-y-auto');
    if(!c) return null;
    return {
      tag:c.tagName,
      cls:(c.className||'').toString().slice(0,150),
      translate:c.getAttribute('translate')||'',
      notranslate:c.classList.contains('notranslate'),
      hasDataTest:c.getAttribute('data-testid')||'',
      parentCls: c.parentElement?(c.parentElement.className||'').toString().slice(0,100):'',
      parentTranslate: c.parentElement?c.parentElement.getAttribute('translate')||'':'',
      outer: c.outerHTML.slice(0,600)
    };
  })()`);
  console.log(JSON.stringify(info,null,2));
  // 检查该容器内的所有子节点的 translate 状态
  const childInfo=await evalFn(`(() => {
    const c=document.querySelector('div.relative.w-full.h-full.overflow-y-auto');
    if(!c) return null;
    const children=[...c.children].slice(0,5).map(el=> ({
      tag:el.tagName,
      cls:(el.className||'').toString().slice(0,80),
      translate:el.getAttribute('translate')||'',
      notranslate:el.classList.contains('notranslate'),
      text:(el.textContent||'').slice(0,80)
    }));
    return children;
  })()`);
  console.log('children',JSON.stringify(childInfo,null,2));
  socket.close(); process.exit(0);
});
