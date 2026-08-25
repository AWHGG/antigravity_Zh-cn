const http=require('http');
const fs=require('fs');
function findPort(cb){
  http.get({host:'127.0.0.1',port:9222,path:'/json/list',timeout:2000},res=>{
    let d='';res.on('data',c=>d+=c);res.on('end',()=>cb(null,JSON.parse(d)));
  }).on('error',cb);
}
findPort(async (err,list)=>{
  if(err) throw err;
  const page=list.find(t=>t.type==='page' && t.url.includes('127.0.0.1:54246'));
  console.log('page',page.url,page.id);
  // Node 24 has global WebSocket
  const socket=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r=>socket.onopen=r);
  let id=0;let pending=new Map();
  socket.onmessage=e=>{
    const m=JSON.parse(e.data);
    if(m.id && pending.has(m.id)){ pending.get(m.id)(m.result); pending.delete(m.id);}
  };
  const send=(method,params)=>new Promise(res=>{const nid=++id;pending.set(nid,res);socket.send(JSON.stringify({id:nid,method,params}));});
  const evalFn=async expr=>{
    const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails) console.log('exception',JSON.stringify(r.exceptionDetails).slice(0,800));
    return r.result && r.result.value;
  };
  // dump outerHTML snippet
  const html=await evalFn('document.documentElement.outerHTML.slice(0,5000)');
  console.log('HTML snippet',html && html.slice(0,3000));
  const bodyText=await evalFn('document.body.innerText.slice(0,3000)');
  console.log('bodyText',bodyText);
  // list candidate clickable texts
  const candidates=await evalFn(`(() => {
    const els=[...document.querySelectorAll('button, [role=button], a, [role=menuitem], [role=tab]')];
    return els.slice(0,80).map(e=>({tag:e.tagName, text:(e.innerText||e.textContent||'').trim().slice(0,80), cls:(e.className||'').toString().slice(0,60), role:e.getAttribute('role')||''}));
  })()`);
  console.log('clickable',JSON.stringify(candidates,null,2));
  // try finding Settings
  const found=await evalFn(`(() => {
    const all=[...document.querySelectorAll('*')];
    const hits=all.filter(e=>{
      const t=(e.innerText||e.textContent||'').trim();
      return t==='Settings' || t==='设置' || t.toLowerCase().includes('settings');
    }).slice(0,20).map(e=>({tag:e.tagName, text:(e.innerText||'').trim().slice(0,100), cls:(e.className||'').toString().slice(0,80)}));
    return hits;
  })()`);
  console.log('settings hits',JSON.stringify(found,null,2));
  // also try to find any English words via scan
  const scan=await evalFn(`(() => {
    const seen=new Set(); const out=[];
    function walk(el){
      if(!el.children || !el.children.length){
        const t=(el.textContent||'').trim();
        if(t && /[a-zA-Z]/.test(t) && t.length<120 && !seen.has(t)){seen.add(t); out.push(t.slice(0,120));}
        return;
      }
      for(const c of el.children) walk(c);
    }
    walk(document.body);
    return out.slice(0,100);
  })()`);
  console.log('scan',scan);
  socket.close();
  process.exit(0);
});
