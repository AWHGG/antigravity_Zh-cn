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
  const consoleMessages=[];
  socket.onmessage=e=>{
    const m=JSON.parse(e.data);
    if(m.method==='Console.messageAdded'){
      console.log('CONSOLE:', JSON.stringify(m.params.message,null,2));
      consoleMessages.push(m.params.message);
    }
    if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result);pending.delete(m.id);}
  };
  const send=(method,params)=>new Promise(res=>{
    const nid=++id;
    pending.set(nid,res);
    socket.send(JSON.stringify({id:nid,method,params}));
  });
  const evalFn=async e=>{
    const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});
    return r.result&&r.result.value;
  };
  await send('Console.enable',{});
  await send('Runtime.enable',{});
  console.log('console enabled');
  // 等待引擎初始化
  await new Promise(r=>setTimeout(r,500));
  // 清空之前的 console
  consoleMessages.length=0;
  // 插入测试节点到虚拟化容器
  const res=await evalFn(`(() => {
    const container=document.querySelector('div.relative.w-full.h-full.overflow-y-auto');
    if(!container) return 'no container';
    const d=document.createElement('div');
    d.textContent='No conversations yet';
    d.id='__debug_test__';
    container.appendChild(d);
    return 'appended';
  })()`);
  console.log('append result',res);
  await new Promise(r=>setTimeout(r,1000));
  const after=await evalFn(`document.getElementById('__debug_test__') ? document.getElementById('__debug_test__').textContent : null`);
  console.log('after text',JSON.stringify(after));
  console.log('consoleMessages count',consoleMessages.length);
  consoleMessages.forEach(m=> console.log('msg text',m.text));
  // 清理
  await evalFn(`(() => { const d=document.getElementById('__debug_test__'); if(d) d.remove(); return 1; })()`);
  // 也测试 body 直接插入
  consoleMessages.length=0;
  await evalFn(`(() => {
    const d=document.createElement('div');
    d.textContent='No conversations yet';
    d.id='__debug_body__';
    d.style.position='fixed'; d.style.left='-9999px';
    document.body.appendChild(d);
    return 'appended body';
  })()`);
  await new Promise(r=>setTimeout(r,800));
  const afterBody=await evalFn(`document.getElementById('__debug_body__').textContent`);
  console.log('after body',JSON.stringify(afterBody));
  console.log('consoleMessages2',consoleMessages.length);
  consoleMessages.forEach(m=> console.log('msg2',m.text));
  await evalFn(`(() => { const d=document.getElementById('__debug_body__'); if(d) d.remove(); return 1; })()`);
  socket.close(); process.exit(0);
});
