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
  const evalFn=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true}); if(r.exceptionDetails) console.log(JSON.stringify(r.exceptionDetails).slice(0,500)); return r.result&&r.result.value;};
  // 先打开设置
  await evalFn(`(() => {
    const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='设置');
    if(b) b.click();
    return 1;
  })()`);
  await new Promise(r=>setTimeout(r,1500));
  // 再点击 外观
  await evalFn(`(() => {
    const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='外观');
    if(b) b.click();
    return 1;
  })()`);
  await new Promise(r=>setTimeout(r,1500));
  // 检查 __AG_DUMP_MISSING__ 是否含 greet
  const dump=await evalFn(`typeof window.__AG_DUMP_MISSING__==='function' ? window.__AG_DUMP_MISSING__().slice(0,200) : []`);
  console.log('dump first 30',JSON.stringify(dump.slice(0,30),null,2));
  const hasGreet=dump.some(x=> x.includes('Greet') || x==='greet' || x==='const');
  console.log('hasGreet in dump?',hasGreet);
  // 检查代码预览容器是否被标记 translate=no
  const blockedCheck=await evalFn(`(() => {
    const el=[...document.querySelectorAll('div')].find(d=> d.className.includes('font-mono'));
    if(!el) return 'no font-mono found';
    return {
      cls: el.className.slice(0,150),
      translate: el.getAttribute('translate'),
      notranslate: el.classList.contains('notranslate'),
      inner: el.textContent.slice(0,80)
    };
  })()`);
  console.log('font-mono container',JSON.stringify(blockedCheck,null,2));
  // 检查其子 span 是否在 blocked zone via engine's isInBlockedZone logic模拟
  const isBlocked=await evalFn(`(() => {
    const el=[...document.querySelectorAll('span')].find(s=> s.textContent.trim()==='greet');
    if(!el) return 'no greet span';
    // 手动模拟引擎的 hasBlockingFeatures 回溯
    let cur=el.parentElement;
    let depth=0;
    const blockedRe=/monaco|editor|font-mono|view-line|terminal|xterm|thought|thinking|reasoning|chat-message|message-content|markdown|prose|artifact|snippet|tool-call|notranslate|token|diff-/i;
    const BLOCKED_TAGS=new Set(['SCRIPT','STYLE','CODE','PRE','INPUT','TEXTAREA','SVG','CANVAS','KBD','SAMP','VAR','TEMPLATE','MATH','AUDIO','VIDEO','SOURCE','TRACK']);
    while(cur && depth<128){
      const cls=typeof cur.className==='string'?cur.className:(cur.getAttribute?cur.getAttribute('class')||'':'');
      const tag=cur.tagName?cur.tagName.toUpperCase():'';
      if(BLOCKED_TAGS.has(tag) || blockedRe.test(cls) || cur.getAttribute('translate')==='no' || (cur.classList&&cur.classList.contains('notranslate'))) return {blocked:true, at:cur.tagName, cls:cls.slice(0,80), depth};
      cur=cur.parentElement || (cur.parentNode && cur.parentNode.host);
      depth++;
    }
    return {blocked:false};
  })()`);
  console.log('is greet blocked?',JSON.stringify(isBlocked,null,2));
  socket.close(); process.exit(0);
});
