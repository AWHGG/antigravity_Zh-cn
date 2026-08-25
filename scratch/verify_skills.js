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
  // 点击 个性化定制
  const clicked=await evalFn(`(() => {
    const btns=[...document.querySelectorAll('button')];
    const t=btns.find(b=> (b.innerText||b.textContent||'').trim()==='个性化定制');
    if(!t) return 'not found';
    t.click(); return 'clicked';
  })()`);
  console.log('click 个性化定制',clicked);
  await new Promise(r=>setTimeout(r,2000));
  const body=await evalFn('document.body.innerText.slice(0,5000)');
  console.log(body.slice(0,3000));
  const checks=[
    "Comprehensive guide and reference for the Antigravity Customization System",
    "Provides a comprehensive guide, quick reference",
    "Search tool for modern web development best practices",
    "Antigravity 定制系统的综合指南",
    "为 Google Antigravity (AGY) 提供全面的指南",
    "现代 Web 开发最佳实践的搜索工具"
  ];
  for(const c of checks){
    const found=await evalFn(`document.body.innerText.includes(${JSON.stringify(c)})`);
    console.log(JSON.stringify(c.slice(0,50)), found ? 'FOUND' : 'NOT FOUND');
  }
  socket.close(); process.exit(0);
});
