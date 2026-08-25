const http=require('http');
function findPort(cb){
  http.get({host:'127.0.0.1',port:9222,path:'/json/list',timeout:2000},res=>{
    let d='';res.on('data',c=>d+=c);res.on('end',()=>cb(null,JSON.parse(d)));
  }).on('error',cb);
}
findPort(async (err,list)=>{
  const page=list.find(t=>t.type==='page' && t.url.includes('127.0.0.1:') && !t.url.startsWith('data:')) || list.find(t=>t.url.includes('127.0.0.1:'));
  const socket=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r=>socket.onopen=r);
  let id=0,pending=new Map();
  socket.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result);pending.delete(m.id);}};
  const send=(m,p)=>new Promise(res=>{const nid=++id;pending.set(nid,res);socket.send(JSON.stringify({id:nid,method:m,params:p}));});
  const evalFn=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true}); return r.result&&r.result.value;};
  // 点击 应用设置
  const clicked=await evalFn(`(() => {
    const btns=[...document.querySelectorAll('button')];
    const t=btns.find(b=> (b.innerText||b.textContent||'').trim()==='应用设置');
    if(!t) return 'not found';
    t.click(); return 'clicked';
  })()`);
  console.log('click 应用设置',clicked);
  await new Promise(r=>setTimeout(r,2000));
  const body=await evalFn('document.body.innerText.slice(0,4000)');
  console.log(body.slice(0,2500));
  // 检查关键翻译是否命中
  const checks=['应用','管理 Antigravity 应用设置。','远程控制','启用远程控制','通过其他设备远程协作本地智能体。','行内快捷操作'];
  for(const c of checks){
    const found=await evalFn(`document.body.innerText.includes(${JSON.stringify(c)})`);
    console.log(JSON.stringify(c), found ? '✓ 存在' : '✗ 缺失');
  }
  // 检查英文是否仍残留
  const enChecks=['Application','Manage Antigravity app settings.','Remote Control','Enable Remote Control','Work with local agents'];
  for(const c of enChecks){
    const found=await evalFn(`document.body.innerText.includes(${JSON.stringify(c)})`);
    console.log('EN '+JSON.stringify(c), found ? '✗ 仍漏译!' : '✓ 已翻译');
  }
  socket.close(); process.exit(0);
});
