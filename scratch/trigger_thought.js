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
  const evalFn=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true}); if(r.exceptionDetails) console.log(JSON.stringify(r.exceptionDetails).slice(0,600)); return r.result&&r.result.value;};
  // 找到输入框
  const inputInfo=await evalFn(`(() => {
    const inputs=[...document.querySelectorAll('textarea, input, [contenteditable=true], div[role=textbox]')];
    return inputs.map(el=> ({tag:el.tagName, placeholder:el.placeholder||el.getAttribute('placeholder')||'', text:(el.textContent||'').slice(0,50), cls:(el.className||'').toString().slice(0,80), id:el.id||''})).slice(0,20);
  })()`);
  console.log('inputs',JSON.stringify(inputInfo,null,2));
  // 尝试找到聊天输入
  const found=await evalFn(`(() => {
    const el=document.querySelector('textarea');
    if(el) return {found:true, tag:el.tagName, placeholder:el.placeholder};
    const ce=document.querySelector('[contenteditable=true]');
    if(ce) return {found:true, tag:ce.tagName, cls:ce.className};
    return {found:false};
  })()`);
  console.log('found',found);
  socket.close(); process.exit(0);
});
