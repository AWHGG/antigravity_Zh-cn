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
  // 测试在虚拟化列表容器内插入新节点
  const res=await evalFn(`(() => {
    const container=document.querySelector('div.relative.w-full.h-full.overflow-y-auto');
    if(!container) return 'no container';
    const d=document.createElement('div');
    d.textContent='No conversations yet';
    d.style.border='1px solid red';
    d.id='__test_virtual__';
    container.appendChild(d);
    return {initial: d.textContent, containerClass: container.className.slice(0,80)};
  })()`);
  console.log('appended',JSON.stringify(res));
  await new Promise(r=>setTimeout(r,800));
  const after=await evalFn(`document.getElementById('__test_virtual__') ? document.getElementById('__test_virtual__').textContent : null`);
  console.log('after 800',JSON.stringify(after));
  console.log(after==='暂无会话记录' ? 'PASS translated' : 'FAIL '+after);
  // 清理
  await evalFn(`(() => { const d=document.getElementById('__test_virtual__'); if(d) d.remove(); return 1; })()`);
  // 再测试在 body 直接插入（之前通过的）
  const res2=await evalFn(`(() => {
    const d=document.createElement('div');
    d.textContent='No conversations yet';
    d.id='__test_body__';
    d.style.position='fixed'; d.style.left='-9999px';
    document.body.appendChild(d);
    return d.textContent;
  })()`);
  await new Promise(r=>setTimeout(r,500));
  const after2=await evalFn(`document.getElementById('__test_body__').textContent`);
  console.log('body direct after',JSON.stringify(after2));
  await evalFn(`(() => { const d=document.getElementById('__test_body__'); if(d) d.remove(); return 1; })()`);
  socket.close(); process.exit(0);
});
