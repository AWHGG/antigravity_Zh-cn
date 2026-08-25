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
  const debugCode=`
  (() => {
    const norm = s => String(s).replace(/\\s+/g,' ').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').trim();
    const testTexts=["No conversations yet"];
    const results=[];
    for(const txt of testTexts){
      // Simulate for two locations: inside container vs body
      const container=document.querySelector('div.relative.w-full.h-full.overflow-y-auto');
      const testDiv1=document.createElement('div');
      testDiv1.textContent=txt;
      container.appendChild(testDiv1);
      const node1=testDiv1.firstChild; // text node
      // Check isInBlockedZone, protections
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
        const role=el.getAttribute('role');
        if(role && ['code','textbox','log','terminal'].includes(role.toLowerCase())) return true;
        return false;
      }
      function isInBlockedZone(node){
        let curr=node.nodeType===3?node.parentElement:node;
        let d=0;
        while(curr && d<128){
          if(hasBlocking(curr)) return true;
          curr=curr.parentElement || (curr.parentNode&&curr.parentNode.host);
          d++;
        }
        return false;
      }
      const valNorm=norm(node1.nodeValue);
      const checks={
        isInBlockedZone: isInBlockedZone(node1),
        valNorm,
        isFilePath: /^(https?:\\/\\/|[a-zA-Z]:[\\/]|[\\/][a-zA-Z0-9_.-]|\\.\\/|\\.\\.\\/)/.test(valNorm),
        isCodeFile: /^[a-zA-Z0-9_\\-.]+\\.(js|ts|jsx|tsx|json|py|go|rs|cpp|c|h|hpp|java|kt|dart|html|css|scss|md|mdx|yaml|yml|toml|xml|sql|sh|bat|ps1|asar|exe|dll|zip|tar|gz|png|jpg|svg|ico)$/i.test(valNorm),
        isShortWord: /^[a-zA-Z]{1,4}$/.test(valNorm),
        parentText: node1.parentElement? (node1.parentElement.textContent||'').trim().slice(0,80):'',
        parentLen: node1.parentElement? (node1.parentElement.textContent||'').trim().length:0
      };
      // 清理
      testDiv1.remove();
      // 测试 body 直接
      const testDiv2=document.createElement('div');
      testDiv2.textContent=txt;
      testDiv2.style.position='fixed'; testDiv2.style.left='-9999px';
      document.body.appendChild(testDiv2);
      const node2=testDiv2.firstChild;
      const checks2={
        isInBlockedZone: isInBlockedZone(node2),
        valNorm: norm(node2.nodeValue),
        parentText: node2.parentElement? (node2.parentElement.textContent||'').trim().slice(0,80):'',
        parentLen: node2.parentElement? (node2.parentElement.textContent||'').trim().length:0
      };
      testDiv2.remove();
      return {container: checks, body: checks2};
    }
    return results;
  })()
  `;
  const res=await evalFn(debugCode);
  console.log(JSON.stringify(res,null,2));
  socket.close(); process.exit(0);
});
