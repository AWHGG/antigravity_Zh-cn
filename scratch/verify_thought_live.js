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
  // 清理旧测试节点
  await evalFn(`(() => { const old=document.getElementById('__thought_test__'); if(old) old.remove(); return 1; })()`);
  // 注入一个模拟的流式思考片段：一个 div 含长英文，内部有一个独立的 textNode "Analyzing"
  const res1=await evalFn(`(() => {
    const container=document.createElement('div');
    container.id='__thought_test__';
    container.style.position='fixed';
    container.style.left='-9999px';
    // 长段英文，模拟思考正文
    const long="Analyzing the spatial relationships observed in the original label compared to the current output of the image and need to do something very long to exceed forty chars";
    // 碎片化：第一个词单独一个 span
    const span=document.createElement('span');
    span.textContent='Analyzing';
    const rest=document.createTextNode(' the spatial relationships observed in the original label compared to the current output of the image and need to do something very long to exceed forty chars');
    container.appendChild(span);
    container.appendChild(rest);
    document.body.appendChild(container);
    return {spanText: span.textContent, containerText: container.textContent.length, html: container.outerHTML.slice(0,400)};
  })()`);
  console.log('injected initial',JSON.stringify(res1,null,2));
  // 等待引擎处理（MutationObserver 异步）
  await new Promise(r=>setTimeout(r,800));
  const after1=await evalFn(`(() => {
    const span=document.querySelector('#__thought_test__ span');
    return span?span.textContent:null;
  })()`);
  console.log('after engine span text (should remain Analyzing, not translated):',JSON.stringify(after1));
  console.log(after1==='Analyzing' ? 'PASS 思考片段未被误译 ✓' : 'FAIL 被误译为 '+after1);
  // 测试短容器中的相同词应被翻译（UI 枚举）
  const res2=await evalFn(`(() => {
    const div=document.createElement('div');
    div.id='__ui_test__';
    div.style.position='fixed';
    div.style.left='-9999px';
    div.textContent='Analyzing';
    document.body.appendChild(div);
    return div.textContent;
  })()`);
  await new Promise(r=>setTimeout(r,500));
  const after2=await evalFn(`document.getElementById('__ui_test__').textContent`);
  console.log('UI short container after:',JSON.stringify(after2));
  console.log(after2==='正在分析逻辑' ? 'PASS UI 枚举正常翻译 ✓' : 'FAIL UI 未翻译 '+after2);
  // 清理
  await evalFn(`(() => { const a=document.getElementById('__thought_test__'); if(a) a.remove(); const b=document.getElementById('__ui_test__'); if(b) b.remove(); return 1; })()`);
  socket.close(); process.exit(0);
});
