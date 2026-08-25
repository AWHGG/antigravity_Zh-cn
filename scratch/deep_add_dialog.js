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
  // 打开设置 -> 通用
  await evalFn(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='设置'); if(b) b.click(); return 1; })()`);
  await new Promise(r=>setTimeout(r,1000));
  await evalFn(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='通用'); if(b) b.click(); return 1; })()`);
  await new Promise(r=>setTimeout(r,1200));
  // 点击第一个 打开 (文件读写)
  await evalFn(`(() => { const btns=[...document.querySelectorAll('button')].filter(b=> (b.innerText||'').trim()==='打开' && b.offsetParent); if(btns[0]) btns[0].click(); return btns.length; })()`);
  await new Promise(r=>setTimeout(r,1500));
  let body=await evalFn('document.body.innerText.slice(0,4000)');
  console.log('after first 打开',body.slice(0,2000).replace(/\n/g,' | '));
  // 枚举 添加 按钮
  const adds=await evalFn(`(() => {
    const btns=[...document.querySelectorAll('button')].map(b=> (b.innerText||'').trim()).filter(t=>t);
    return btns.slice(0,50);
  })()`);
  console.log('buttons in file access detail',JSON.stringify(adds,null,2));
  // 点击 添加
  const clicked=await evalFn(`(() => {
    const btn=[...document.querySelectorAll('button')].find(b=> (b.innerText||'').trim()==='添加' && b.offsetParent);
    if(!btn) return 'not found 添加';
    btn.click(); return 'clicked 添加';
  })()`);
  console.log(clicked);
  await new Promise(r=>setTimeout(r,1500));
  body=await evalFn('document.body.innerText.slice(0,6000)');
  console.log('after 添加 dialog',body.slice(0,4000).replace(/\n/g,' | '));
  // 扫描 dialog 漏译
  const scan=await evalFn(`(() => {
    // 查找所有可见的 dialog/modal 内的文本
    const dialogs=[...document.querySelectorAll('[role=dialog], [data-state=open], .dialog, [class*=modal]')];
    const out=[];
    const seen=new Set();
    function collect(root){
      const walker=document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n;
      while(n=walker.nextNode()){
        const t=n.nodeValue.trim();
        if(t && /[a-zA-Z]/.test(t) && t.length<250 && !seen.has(t)){seen.add(t); out.push(t.slice(0,200));}
      }
    }
    if(dialogs.length){
      dialogs.forEach(d=> collect(d));
    } else {
      // fallback: 扫描整个 body 但过滤已在字典的
      const all=document.body.innerText.split('\\n').map(s=>s.trim()).filter(s=> s && /[a-zA-Z]/.test(s));
      return all.slice(0,80);
    }
    return out.slice(0,80);
  })()`);
  console.log('dialog scan',JSON.stringify(scan,null,2));
  // 检查是否有英文 placeholder
  const placeholders=await evalFn(`(() => {
    const inputs=[...document.querySelectorAll('input[placeholder]')];
    return inputs.map(i=> i.placeholder).slice(0,20);
  })()`);
  console.log('placeholders',JSON.stringify(placeholders,null,2));
  socket.close(); process.exit(0);
});
