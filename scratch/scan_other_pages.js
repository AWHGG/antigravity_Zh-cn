const http=require('http');
function findPort(cb){
  http.get({host:'127.0.0.1',port:9222,path:'/json/list',timeout:2000},res=>{
    let d='';res.on('data',c=>d+=c);res.on('end',()=>cb(null,JSON.parse(d)));
  }).on('error',cb);
}
findPort(async (err,list)=>{
  const page=list.find(t=>t.type==='page' && t.url.includes('127.0.0.1:54246'));
  const socket=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r=>socket.onopen=r);
  let id=0,pending=new Map();
  socket.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result);pending.delete(m.id);}};
  const send=(m,p)=>new Promise(res=>{const nid=++id;pending.set(nid,res);socket.send(JSON.stringify({id:nid,method:m,params:p}));});
  const evalFn=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true}); return r.result&&r.result.value;};
  async function clickByText(t){
    return await evalFn(`(() => {
      const btns=[...document.querySelectorAll('button, a')];
      const el=btns.find(b=> (b.innerText||b.textContent||'').trim()===\`${t}\`);
      if(!el) return 'not found '+t;
      el.click(); return 'clicked '+t;
    })()`);
  }
  async function collect(){
    return await evalFn(`(() => {
      const seen=new Set(); const out=[];
      function walk(el){ if(!el.children||!el.children.length){ const t=(el.textContent||'').trim(); if(t&&/[a-zA-Z]/.test(t)&&t.length<200&&!seen.has(t)){seen.add(t); out.push(t.slice(0,150));} return;} for(const c of el.children) walk(c); }
      walk(document.body); return out;
    })()`);
  }
  const pages=['项目列表','会话列表','计划任务','变压器3D模型','antigravity_cn_test'];
  for(const p of pages){
    console.log('\\n=== Click '+p+' ===');
    const res=await clickByText(p);
    console.log(res);
    await new Promise(r=>setTimeout(r,2000));
    const body=await evalFn('document.body.innerText.slice(0,2500)');
    console.log(body.slice(0,1000).replace(/\\n/g,' | '));
    const scan=await collect();
    console.log('scan top 20',scan.slice(0,20));
  }
  socket.close(); process.exit(0);
});
