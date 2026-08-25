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
  const evalFn=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true}); if(r.exceptionDetails) console.log('ex',JSON.stringify(r.exceptionDetails).slice(0,500)); return r.result&&r.result.value;};
  // 确保在 外观
  await evalFn(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='外观'); if(b) b.click(); return 1; })()`);
  await new Promise(r=>setTimeout(r,1500));
  const htmlSnippet=await evalFn(`document.documentElement.outerHTML.slice(document.documentElement.outerHTML.indexOf('Greet')-2000, document.documentElement.outerHTML.indexOf('Greet')+2000)`);
  console.log('html snippet around Greet (first 4000 chars):');
  console.log((htmlSnippet||'not found').slice(0,4000));
  // 查找所有包含 greet 的 span/div
  const chainInfo=await evalFn(`(() => {
    const candidates=[...document.querySelectorAll('span, div, code, pre')].filter(e=>{
      const t=(e.textContent||'').trim();
      return t==='greet' || t==='// Greet a user by name';
    }).slice(0,3);
    return candidates.map(el=>{
      let cur=el;
      const chain=[];
      for(let i=0;i<12 && cur; i++){
        chain.push({tag:cur.tagName, cls:(cur.className||'').toString().slice(0,150), id:cur.id||'', attr: cur.getAttribute? (cur.getAttribute('data-testid')||cur.getAttribute('data-test')||'') : ''});
        cur=cur.parentElement || (cur.parentNode && cur.parentNode.host);
      }
      return {text: el.textContent.slice(0,80), chain};
    });
  })()`);
  console.log(JSON.stringify(chainInfo,null,2));
  socket.close(); process.exit(0);
});
