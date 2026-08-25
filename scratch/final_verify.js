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
  // 打开设置 通用 etc. to ensure right sidebar and settings are loaded
  await evalFn(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='设置'); if(b) b.click(); return 1; })()`);
  await new Promise(r=>setTimeout(r,1000));
  await evalFn(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='应用设置'); if(b) b.click(); return 1; })()`);
  await new Promise(r=>setTimeout(r,1000));
  const checks=[
    ["Device Name","设备名称", false],
    ["Scan the code to open this device in Remote Control, or","扫描二维码以在远程控制中打开此设备，或", false],
    ["No file changes","暂无文件变更", false],
    ["No background tasks","暂无后台任务", false],
    ["No conversations yet","暂无会话记录", false],
  ];
  console.log("=== 右侧/设置检查 ===");
  for(const [en,zh,shouldBeEn] of checks){
    const hasEn=await evalFn(`document.body.innerText.includes(${JSON.stringify(en)})`);
    const hasZh=await evalFn(`document.body.innerText.includes(${JSON.stringify(zh)})`);
    console.log(`${en} -> EN:${hasEn?'LEAK':'gone'} ZH:${hasZh?'FOUND':'MISSING'} ${(!hasEn&&hasZh)?'PASS':'FAIL'}`);
  }
  // 思考片段：注入长段中的 Analyzing 不应被译
  await evalFn(`(() => {
    const d=document.createElement('div');
    d.id='__final_thought__';
    d.style.position='fixed'; d.style.left='-9999px';
    const long=" the spatial relationships observed in the original label compared to the current output of the image and need to do something very long to exceed forty chars";
    const span=document.createElement('span');
    span.textContent='Analyzing';
    d.appendChild(span);
    d.appendChild(document.createTextNode(long));
    document.body.appendChild(d);
    return 1;
  })()`);
  await new Promise(r=>setTimeout(r,600));
  const thoughtAfter=await evalFn(`document.getElementById('__final_thought__').textContent.includes('Analyzing')`);
  const thoughtZh=await evalFn(`document.getElementById('__final_thought__').textContent.includes('正在分析逻辑')`);
  console.log(`思考片段 Analyzing in long -> EN:${thoughtAfter?'保留':'丢失'} ZH:${thoughtZh?'误译':'正确'} ${thoughtAfter&&!thoughtZh?'PASS':'FAIL'}`);
  await evalFn(`document.getElementById('__final_thought__').remove()`);
  // UI 短容器中的 Analyzing 应被译
  await evalFn(`(() => {
    const d=document.createElement('div');
    d.id='__final_ui__';
    d.style.position='fixed'; d.style.left='-9999px';
    d.textContent='Analyzing';
    document.body.appendChild(d);
    return 1;
  })()`);
  await new Promise(r=>setTimeout(r,500));
  const uiAfter=await evalFn(`document.getElementById('__final_ui__').textContent`);
  console.log(`UI 短容器 Analyzing -> "${uiAfter}" ${uiAfter==='正在分析逻辑'?'PASS':'FAIL'}`);
  await evalFn(`document.getElementById('__final_ui__').remove()`);
  socket.close(); process.exit(0);
});
