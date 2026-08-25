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
  // 关闭设置
  await evalFn(`history.pushState(null,'','https://127.0.0.1:49840/'); window.dispatchEvent(new PopStateEvent('popstate'));`);
  await new Promise(r=>setTimeout(r,1500));
  let url=await evalFn('location.href');
  console.log('after close url',url);
  await evalFn(`window.location.href='https://127.0.0.1:49840/';`);
  await new Promise(r=>setTimeout(r,1500));
  url=await evalFn('location.href');
  console.log('after reload url',url);
  // 等待加载
  await new Promise(r=>setTimeout(r,2000));
  let body=await evalFn('document.body.innerText.slice(0,3000)');
  console.log('body after close',body.slice(0,2000).replace(/\n/g,' | '));
  // 枚举所有按钮
  const btns=await evalFn(`(() => {
    const els=[...document.querySelectorAll('button, a')];
    return els.map(e=> (e.innerText||e.textContent||'').trim()).filter(t=>t.length>0 && t.length<30).slice(0,100);
  })()`);
  console.log('buttons',JSON.stringify(btns,null,2));
  // 尝试点击 项目列表
  const clickRes=await evalFn(`(() => {
    const els=[...document.querySelectorAll('button')];
    const t=els.find(e=> (e.innerText||'').trim()==='项目列表');
    if(!t) return 'not found 项目列表';
    t.click(); return 'clicked 项目列表';
  })()`);
  console.log(clickRes);
  await new Promise(r=>setTimeout(r,2000));
  body=await evalFn('document.body.innerText.slice(0,4000)');
  console.log('after click 项目列表',body.slice(0,3000).replace(/\n/g,' | '));
  // 扫描当前 DOM 非禁区
  const scan=await evalFn(`(() => {
    const out={blocked:[],untranslated:[]};
    const seen=new Set();
    const BLOCKED_TAGS=new Set(['SCRIPT','STYLE','CODE','PRE','INPUT','TEXTAREA','SVG','CANVAS','KBD','SAMP','VAR','TEMPLATE','MATH','AUDIO','VIDEO']);
    const blockedRe=/monaco|editor|font-mono|view-line|terminal|xterm|thought|thinking|reasoning|chat-message|message-content|markdown|prose|artifact|snippet|tool-call|notranslate|token|diff-/i;
    function isBlocked(el){
      const cls=typeof el.className==='string'?el.className:(el.getAttribute?el.getAttribute('class')||'':'');
      const role=el.getAttribute?el.getAttribute('role')||'':'';
      return BLOCKED_TAGS.has(el.tagName) || blockedRe.test(cls) || /^(code|textbox|log|terminal)$/i.test(role) || (el.getAttribute&&el.getAttribute('translate')==='no');
    }
    function walk(el,inherited){
      const b=inherited || isBlocked(el);
      if(el.shadowRoot) for(const c of el.shadowRoot.children||[]) walk(c,b);
      if(!el.children||!el.children.length){
        const t=(el.textContent||'').trim();
        if(t && /[a-zA-Z]/.test(t) && t.length<250 && !seen.has(t)){seen.add(t); (b?out.blocked:out.untranslated).push(t.slice(0,150));}
        return;
      }
      for(const c of el.children) walk(c,b);
    }
    walk(document.body||document.documentElement,false);
    return out;
  })()`);
  console.log('scan untranslated',JSON.stringify(scan.untranslated.slice(0,80),null,2));
  socket.close(); process.exit(0);
});
