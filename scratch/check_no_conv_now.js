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
  const hasEn=await evalFn(`document.body.innerText.includes("No conversations yet")`);
  const hasZh=await evalFn(`document.body.innerText.includes("暂无会话记录")`);
  console.log('hasEn',hasEn);
  console.log('hasZh',hasZh);
  const elText=await evalFn(`(() => {
    const el=[...document.querySelectorAll('span')].find(s=> s.textContent.trim()==='No conversations yet' || s.textContent.trim()==='暂无会话记录');
    return el? el.textContent : null;
  })()`);
  console.log('elText',JSON.stringify(elText));
  socket.close(); process.exit(0);
});
