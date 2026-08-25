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
  const evalFn=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true}); if(r.exceptionDetails) console.log(JSON.stringify(r.exceptionDetails).slice(0,800)); return r.result&&r.result.value;};
  // 测试新插入的 No conversations yet 是否会被翻译
  const test1=await evalFn(`(() => {
    const d=document.createElement('div');
    d.textContent='No conversations yet';
    d.style.position='fixed';
    d.style.left='-9999px';
    d.id='__test_no_conv__';
    document.body.appendChild(d);
    return d.textContent;
  })()`);
  console.log('immediately after append',JSON.stringify(test1));
  await new Promise(r=>setTimeout(r,800));
  const after1=await evalFn(`document.getElementById('__test_no_conv__').textContent`);
  console.log('after 800ms',JSON.stringify(after1));
  console.log(after1==='暂无会话记录' ? 'PASS translated' : 'FAIL not translated: '+after1);
  // 检查原来那个 No conversations yet 元素的状态
  const orig=await evalFn(`(() => {
    const el=[...document.querySelectorAll('span')].find(s=> s.textContent.trim()==='No conversations yet');
    if(!el) return null;
    return {text: el.textContent, parentTag: el.parentElement.tagName, parentCls: (el.parentElement.className||'').slice(0,80), foundInMap: false};
  })()`);
  console.log('orig element',JSON.stringify(orig,null,2));
  // 尝试手动触发 translateNode  via 重新插入
  const manual=await evalFn(`(() => {
    const el=[...document.querySelectorAll('span')].find(s=> s.textContent.trim()==='No conversations yet');
    if(!el) return 'not found';
    const clone=el.cloneNode(true);
    el.parentElement.replaceChild(clone, el);
    return 'replaced';
  })()`);
  console.log('manual replace',manual);
  await new Promise(r=>setTimeout(r,800));
  const afterManual=await evalFn(`(() => {
    const el=[...document.querySelectorAll('span')].find(s=> s.textContent.includes('No conversations yet') || s.textContent.includes('暂无会话'));
    return el?el.textContent:null;
  })()`);
  console.log('after manual replace',JSON.stringify(afterManual));
  await evalFn(`(() => { const d=document.getElementById('__test_no_conv__'); if(d) d.remove(); return 1; })()`);
  socket.close(); process.exit(0);
});
