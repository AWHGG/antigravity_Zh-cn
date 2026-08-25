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
  const res=await evalFn(`(() => {
    const el=[...document.querySelectorAll('span')].find(s=> s.textContent.trim()==='No conversations yet');
    if(!el) return {found:false};
    let cur=el;
    const chain=[];
    for(let i=0;i<10&&cur;i++){
      chain.push({tag:cur.tagName, cls:(cur.className||'').toString().slice(0,120), translate:cur.getAttribute('translate')||'', notranslate: cur.classList.contains('notranslate'), hasBlocked: false});
      cur=cur.parentElement;
    }
    // Check each ancestor for hasBlockingFeatures via engine logic
    const BLOCKED_TAGS=new Set(['SCRIPT','STYLE','CODE','PRE','INPUT','TEXTAREA','SVG','CANVAS','SYMBOL','PATH','KBD','SAMP','VAR','TEMPLATE','MATH','AUDIO','VIDEO','SOURCE','TRACK']);
    const patts=['monaco','editor','view-line','view-lines','lines-content','glyph-margin','margin-view-overlays','decorationsOverviewRuler','cm-editor','cm-content','cm-line','cm-scroller','ace_editor','ace_line','theia-editor','syntax-','token','hljs','prism','shiki','font-mono','diff-editor','monaco-diff-editor','diff-review','diff-review-line','diffOverview','original-in-monaco-diff-editor','modified-in-monaco-diff-editor','inline-deleted-margin-view-zone','dirty-diff','char-delete','char-insert','line-delete','line-insert','terminal','xterm','xterm-screen','xterm-rows','xterm-viewport','xterm-selection','pty-output','console-output','debug-console','output-view','shell-session','command-output','terminal-output','repl','terminal-instance','terminal-wrapper','suggest-widget','parameter-hints','inline-completions','ghost-text','quick-fix-widget','monaco-hover','hover-row','quick-input-list','thought','thinking','reasoning','chain-of-thought','cot','cot-content','thought-bubble','thought-process','thought-content','thinking-process','reasoning-content','step-detail','step-details','step-body','step-content','step-description','agent-step','trajectory','turn-content','conversation-turn','chat-turn','conversation-timeline','agent-trajectory','step-panel','subagent-turn','collapsible-thought','thought-box','thought-toggle','ant-thought','agy-thought','ai-thought','agent-thought','stream-thought','chat-message','message-content','user-message','assistant-message','chat-scrollable','message-bubble','message-row','stream-output','model-response','model-output','prose','markdown-body','markdown-content','artifact-content','artifact-body','artifact-diff','artifact-code','file-content','snippet','raw-text','transcript-item','katex','katex-display','katex-html','tool-call','tool-args','tool-result','command-line','step-command','call-args','step-output'];
    const re=new RegExp(patts.join('|'));
    function hasBlocking(el){
      if(!el || el.nodeType!==1) return false;
      const tag=el.tagName?el.tagName.toUpperCase():'';
      if(BLOCKED_TAGS.has(tag)) return true;
      if(el.getAttribute('translate')==='no') return true;
      if(el.classList.contains('notranslate')) return true;
      const cls=(typeof el.className==='string'?el.className:(el.getAttribute('class')||''));
      if(cls && re.test(cls.toLowerCase())) return true;
      return false;
    }
    let cur2=el;
    const detailed=[];
    for(let i=0;i<10&&cur2;i++){
      detailed.push({tag:cur2.tagName, cls:(cur2.className||'').toString().slice(0,80), hasBlocking:hasBlocking(cur2), translate:cur2.getAttribute('translate')||''});
      cur2=cur2.parentElement;
    }
    return {found:true, chain, detailed, text:el.textContent};
  })()`);
  console.log(JSON.stringify(res,null,2));
  socket.close(); process.exit(0);
});
