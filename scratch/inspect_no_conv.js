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
  const evalFn=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true}); if(r.exceptionDetails) console.log(JSON.stringify(r.exceptionDetails).slice(0,600)); return r.result&&r.result.value;};
  // 查找 No conversations yet 元素
  const info=await evalFn(`(() => {
    const all=[...document.querySelectorAll('*')];
    const el=all.find(e=> (e.textContent||'').trim()==='No conversations yet');
    if(!el) {
      // 模糊查找
      const el2=all.find(e=> (e.textContent||'').includes('No conversations yet'));
      if(!el2) return {found:false};
      const inner=el2.innerHTML.slice(0,500);
      return {found:'fuzzy', tag:el2.tagName, cls:(el2.className||'').toString().slice(0,100), text:(el2.textContent||'').slice(0,100), html:inner, parent: el2.parentElement? {tag:el2.parentElement.tagName, cls:(el2.parentElement.className||'').toString().slice(0,100)} : null};
    }
    // 精确找到后，回溯
    let cur=el;
    const chain=[];
    for(let i=0;i<6&&cur;i++){
      chain.push({tag:cur.tagName, cls:(cur.className||'').toString().slice(0,100), id:cur.id||'', role:cur.getAttribute?cur.getAttribute('role')||'':'', translate:cur.getAttribute?cur.getAttribute('translate')||'':''});
      cur=cur.parentElement;
    }
    // 检查是否有文本节点直接包含
    const walker=document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    const texts=[];
    while(n=walker.nextNode()){
      const t=n.nodeValue.trim();
      if(t) texts.push({nodeValue:t.slice(0,80), parentTag:n.parentElement? n.parentElement.tagName:'', parentCls:(n.parentElement&&n.parentElement.className||'').toString().slice(0,80)});
    }
    return {found:true, tag:el.tagName, cls:(el.className||'').toString().slice(0,100), text:(el.textContent||'').slice(0,100), chain, texts: texts.slice(0,5), html:el.outerHTML.slice(0,600)};
  })()`);
  console.log(JSON.stringify(info,null,2));
  // 检查引擎的判断：isInBlockedZone, hasBlockingFeatures, map
  const engineCheck=await evalFn(`(() => {
    // 模拟引擎的 hasBlockingFeatures 检查
    const BLOCKED_TAGS=new Set(['SCRIPT','STYLE','CODE','PRE','INPUT','TEXTAREA','SVG','CANVAS','SYMBOL','PATH','KBD','SAMP','VAR','TEMPLATE','MATH','AUDIO','VIDEO','SOURCE','TRACK']);
    const patts=['monaco','editor','view-line','view-lines','lines-content','glyph-margin','margin-view-overlays','decorationsOverviewRuler','cm-editor','cm-content','cm-line','cm-scroller','ace_editor','ace_line','theia-editor','syntax-','token','hljs','prism','shiki','font-mono','diff-editor','monaco-diff-editor','diff-review','diff-review-line','diffOverview','original-in-monaco-diff-editor','modified-in-monaco-diff-editor','inline-deleted-margin-view-zone','dirty-diff','char-delete','char-insert','line-delete','line-insert','terminal','xterm','xterm-screen','xterm-rows','xterm-viewport','xterm-selection','pty-output','console-output','debug-console','output-view','shell-session','command-output','terminal-output','repl','terminal-instance','terminal-wrapper','suggest-widget','parameter-hints','inline-completions','ghost-text','quick-fix-widget','monaco-hover','hover-row','quick-input-list','thought','thinking','reasoning','chain-of-thought','cot','cot-content','thought-bubble','thought-process','thought-content','thinking-process','reasoning-content','step-detail','step-details','step-body','step-content','step-description','agent-step','trajectory','turn-content','conversation-turn','chat-turn','conversation-timeline','agent-trajectory','step-panel','subagent-turn','collapsible-thought','thought-box','thought-toggle','ant-thought','agy-thought','ai-thought','agent-thought','stream-thought','chat-message','message-content','user-message','assistant-message','chat-scrollable','message-bubble','message-row','stream-output','model-response','model-output','prose','markdown-body','markdown-content','artifact-content','artifact-body','artifact-diff','artifact-code','file-content','snippet','raw-text','transcript-item','katex','katex-display','katex-html','tool-call','tool-args','tool-result','command-line','step-command','call-args','step-output'];
    const re=new RegExp(patts.join('|'));
    function hasBlockingFeatures(el){
      if(!el || el.nodeType!==1) return false;
      const tag=el.tagName?el.tagName.toUpperCase():'';
      if(BLOCKED_TAGS.has(tag)) return true;
      if(el.getAttribute('contenteditable')==='true' || el.isContentEditable) return true;
      if(el.getAttribute('translate')==='no') return true;
      const role=el.getAttribute('role');
      if(role && ['code','textbox','log','terminal'].includes(role.toLowerCase())) return true;
      if(role && role.toLowerCase()==='article'){
        const aria=el.getAttribute('aria-label')||'';
        if(/agent|assistant|response/i.test(aria)) return true;
      }
      for(const a of ['data-lang','data-language','data-code','data-mode','data-is-code','data-thought','data-thinking','data-turn-role','data-message-author','data-is-streaming','data-tool-name','data-terminal-id','data-lexical-editor','data-slate-editor']){
        if(el.hasAttribute(a)) return true;
      }
      const tid=el.getAttribute('data-testid')||'';
      if(tid){
        const t=tid.toLowerCase();
        if(t.includes('thought')||t.includes('thinking')||t.includes('chat')||t.includes('message')) return true;
      }
      const cls=(typeof el.className==='string'?el.className:(el.getAttribute('class')||''));
      if(cls){
        const c=cls.toLowerCase();
        if(c.includes('notranslate')) return true;
        if(re.test(c)) return true;
      }
      return false;
    }
    function isInBlockedZone(node){
      let curr=node.nodeType===3?node.parentElement:node;
      let d=0;
      while(curr && d<128){
        if(hasBlockingFeatures(curr)) return {blocked:true, at:curr.tagName, cls:(curr.className||'').toString().slice(0,80)};
        curr=curr.parentElement || (curr.parentNode&&curr.parentNode.host);
        d++;
      }
      return {blocked:false};
    }
    const el=[...document.querySelectorAll('*')].find(e=> (e.textContent||'').trim()==='No conversations yet');
    if(!el) return {error:'not found exact'};
    // 找到其内部的文本节点
    const walker=document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while(n=walker.nextNode()){
      const t=n.nodeValue.trim();
      if(t==='No conversations yet'){
        const parent=n.parentElement;
        const blocked=isInBlockedZone(n);
        const hasFeat=parent? hasBlockingFeatures(parent):false;
        return {text:t, parentTag:parent?parent.tagName:'', parentCls:(parent&&parent.className||'').toString().slice(0,80), hasBlockingFeatures:hasFeat, isInBlockedZone:blocked, norm: t.replace(/\\s+/g,' ').trim()};
      }
    }
    return {error:'text node not found'};
  })()`);
  console.log('engineCheck',JSON.stringify(engineCheck,null,2));
  // 检查字典
  const dictCheck=await evalFn(`(() => {
    // 尝试访问引擎的 map（如果暴露）
    // 直接检查页面中是否有 __AG_DUMP_MISSING__ 包含它
    const dump=typeof window.__AG_DUMP_MISSING__==='function' ? window.__AG_DUMP_MISSING__() : [];
    return {dumpHas: dump.includes('No conversations yet'), dumpLen: dump.length, sample: dump.slice(0,10)};
  })()`);
  console.log('dictCheck',JSON.stringify(dictCheck,null,2));
  socket.close(); process.exit(0);
});
