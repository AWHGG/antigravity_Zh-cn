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
  // 点击 外观
  await evalFn(`(() => {
    const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='外观');
    if(b) b.click();
    return 'clicked';
  })()`);
  await new Promise(r=>setTimeout(r,1800));
  const info=await evalFn(`(() => {
    // 查找包含 "// Greet" 的元素并回溯祖先
    const all=[...document.querySelectorAll('*')];
    const target=all.find(e=> (e.textContent||'').includes('// Greet a user by name'));
    if(!target) return 'not found';
    let cur=target;
    const chain=[];
    for(let i=0;i<10 && cur; i++){
      chain.push({
        tag:cur.tagName,
        cls: (cur.className||'').toString().slice(0,120),
        id: cur.id||'',
        role: cur.getAttribute&&cur.getAttribute('role')||'',
        dataTest: cur.getAttribute&&cur.getAttribute('data-testid')||'',
        translate: cur.getAttribute&&cur.getAttribute('translate')||''
      });
      cur=cur.parentElement || (cur.parentNode && cur.parentNode.host);
    }
    return {found: (target.textContent||'').slice(0,120), chain};
  })()`);
  console.log(JSON.stringify(info,null,2));
  // 同时检查技能文档卡片的类
  const skillInfo=await evalFn(`(() => {
    const all=[...document.querySelectorAll('*')];
    const target=all.find(e=> (e.textContent||'').includes('Comprehensive guide and reference for the Antigravity Customization System'));
    if(!target) {
      // 找中文版本
      const t2=all.find(e=> (e.textContent||'').includes('Antigravity 定制系统的综合指南'));
      if(!t2) return 'not found skill';
      let cur=t2;
      const chain=[];
      for(let i=0;i<8 && cur; i++){
        chain.push({tag:cur.tagName, cls:(cur.className||'').toString().slice(0,120)});
        cur=cur.parentElement;
      }
      return {found: t2.textContent.slice(0,120), chain, lang:'zh'};
    }
    let cur=target;
    const chain=[];
    for(let i=0;i<8 && cur; i++){
      chain.push({tag:cur.tagName, cls:(cur.className||'').toString().slice(0,120)});
      cur=cur.parentElement;
    }
    return {found: target.textContent.slice(0,120), chain, lang:'en'};
  })()`);
  console.log('skill',JSON.stringify(skillInfo,null,2));
  socket.close(); process.exit(0);
});
