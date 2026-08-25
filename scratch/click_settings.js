const http=require('http');
function findPort(cb){
  http.get({host:'127.0.0.1',port:9222,path:'/json/list',timeout:2000},res=>{
    let d='';res.on('data',c=>d+=c);res.on('end',()=>cb(null,JSON.parse(d)));
  }).on('error',cb);
}
findPort(async (err,list)=>{
  if(err) throw err;
  const page=list.find(t=>t.type==='page' && t.url.includes('127.0.0.1:') && !t.url.startsWith('data:')) || list.find(t=>t.type==='page' && t.url.includes('127.0.0.1:'));
  if(!page){console.log('no page found',JSON.stringify(list.map(p=>p.url))); process.exit(1);}
  console.log('target',page.url);
  const socket=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r=>socket.onopen=r);
  let id=0,pending=new Map();
  socket.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result);pending.delete(m.id);}};
  const send=(method,params)=>new Promise(res=>{const nid=++id;pending.set(nid,res);socket.send(JSON.stringify({id:nid,method,params}));});
  const evalFn=async expr=>{
    const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails) console.log('ex',JSON.stringify(r.exceptionDetails).slice(0,600));
    return r.result && r.result.value;
  };
  // 查找设置按钮并点击
  const clicked=await evalFn(`(() => {
    const btns=[...document.querySelectorAll('button')];
    const target=btns.find(b=> (b.innerText||b.textContent||'').trim()==='设置');
    if(!target) return 'not found '+btns.length;
    target.click();
    return 'clicked settings btn '+ target.textContent.slice(0,50);
  })()`);
  console.log('click result',clicked);
  // 等待设置面板加载
  await new Promise(r=>setTimeout(r,2500));
  const after=await evalFn('document.body.innerText.slice(0,5000)');
  console.log('after body',after.slice(0,4000));
  // 再次扫描设置页
  const scanResult=await evalFn(`(() => {
    const out={blocked:[],untranslated:[]};
    const seen=new Set();
    const BLOCKED_TAGS=new Set(['SCRIPT','STYLE','CODE','PRE','INPUT','TEXTAREA','SVG','CANVAS','KBD','SAMP','VAR','TEMPLATE','MATH','AUDIO','VIDEO']);
    const blockedRe=/monaco|editor|view-line|terminal|xterm|thought|thinking|reasoning|chat-message|message-content|markdown|prose|artifact|snippet|tool-call|notranslate|token|diff-/i;
    function walk(el,inherited){
      const b=inherited || BLOCKED_TAGS.has(el.tagName) || blockedRe.test(typeof el.className==='string'?el.className:'') || (el.getAttribute&&el.getAttribute('translate')==='no');
      if(el.shadowRoot){ for(const c of el.shadowRoot.children||[]) walk(c,b);}
      if(!el.children||!el.children.length){
        const t=(el.textContent||'').trim();
        if(t && /[a-zA-Z]/.test(t) && t.length<300 && !seen.has(t)){ seen.add(t); (b?out.blocked:out.untranslated).push(t.slice(0,150));}
        return;
      }
      for(const c of el.children) walk(c,b);
    }
    walk(document.body||document.documentElement,false);
    return out;
  })()`);
  console.log('scan untranslated',JSON.stringify(scanResult.untranslated.slice(0,80),null,2));
  console.log('scan blocked sample',JSON.stringify(scanResult.blocked.slice(0,20),null,2));
  socket.close();
  process.exit(0);
});
