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
  // 打开设置
  await evalFn(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='设置'); if(b) b.click(); return 1; })()`);
  await new Promise(r=>setTimeout(r,1500));
  await evalFn(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='应用设置'); if(b) b.click(); return 1; })()`);
  await new Promise(r=>setTimeout(r,1500));
  const body=await evalFn('document.body.innerText.slice(0,6000)');
  console.log(body.slice(0,4000));
  const checks=[
    ["Device Name", "设备名称"],
    ["Scan the code to open this device in Remote Control, or", "扫描二维码以在远程控制中打开此设备，或"]
  ];
  for(const [en,zh] of checks){
    const hasEn=await evalFn(`document.body.innerText.includes(${JSON.stringify(en)})`);
    const hasZh=await evalFn(`document.body.innerText.includes(${JSON.stringify(zh)})`);
    console.log(`EN "${en}" -> ${hasEn ? 'LEAK ✗' : 'gone ✓'}`);
    console.log(`ZH "${zh}" -> ${hasZh ? 'FOUND ✓' : 'MISSING ✗'}`);
  }
  // 额外检查整个 Remote Control 卡片
  const card=await evalFn(`(() => {
    const el=[...document.querySelectorAll('*')].find(e=> (e.textContent||'').includes('设备名称') || (e.textContent||'').includes('Device Name'));
    if(!el) return null;
    let cur=el;
    for(let i=0;i<5&&cur;i++){ if(cur.textContent.includes('扫描') || cur.textContent.includes('Scan')) return cur.innerText.slice(0,500); cur=cur.parentElement; }
    return el.parentElement?el.parentElement.innerText.slice(0,500):null;
  })()`);
  console.log('card snippet',JSON.stringify(card,null,2));
  socket.close(); process.exit(0);
});
