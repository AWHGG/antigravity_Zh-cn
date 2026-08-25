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
  // 打开设置 通用 -> 打开 文件读写 -> 添加
  await evalFn(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='设置'); if(b) b.click(); return 1; })()`);
  await new Promise(r=>setTimeout(r,1000));
  await evalFn(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='通用'); if(b) b.click(); return 1; })()`);
  await new Promise(r=>setTimeout(r,800));
  await evalFn(`(() => { const btns=[...document.querySelectorAll('button')].filter(b=> (b.innerText||'').trim()==='打开' && b.offsetParent); if(btns[0]) btns[0].click(); return btns.length; })()`);
  await new Promise(r=>setTimeout(r,1000));
  await evalFn(`(() => { const btn=[...document.querySelectorAll('button')].find(b=> (b.innerText||'').trim()==='添加' && b.offsetParent); if(btn) btn.click(); return btn?'clicked':'not found'; })()`);
  await new Promise(r=>setTimeout(r,1200));
  // 收集 placeholders
  const ph=await evalFn(`([...document.querySelectorAll('input[placeholder]')].map(e=> e.placeholder))`);
  console.log('placeholders after deep',JSON.stringify(ph,null,2));
  const checks=[
    ["Enter bot name (optional)", "输入机器人名称（可选）"],
    ["Enter avatar URL (optional)", "输入头像 URL（可选）"],
    ["Enter device name...", "输入设备名称..."]
  ];
  for(const [en,zh] of checks){
    const hasEn=ph.includes(en);
    const hasZh=ph.includes(zh);
    console.log(`EN "${en}" -> ${hasEn ? 'LEAK ✗' : 'gone ✓'}`);
    console.log(`ZH "${zh}" -> ${hasZh ? 'FOUND ✓' : 'MISSING ✗'}`);
  }
  // 同时检查二级标题翻译
  const body=await evalFn('document.body.innerText.slice(0,4000)');
  console.log(body.slice(0,2000).replace(/\n/g,' | '));
  socket.close(); process.exit(0);
});
