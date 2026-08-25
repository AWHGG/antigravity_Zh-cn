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
  const fs=require('fs'),path=require('path');
  const norm=s=>String(s).replace(/\s+/g,' ').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').trim();
  let all={}; for(const f of fs.readdirSync('dicts').filter(x=>x.endsWith('.json'))) Object.assign(all, JSON.parse(fs.readFileSync('dicts/'+f,'utf8')));
  const dictLower=new Set(Object.keys(all).map(k=>norm(k).toLowerCase()));
  // 预先打开设置
  await evalFn(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='设置'); if(b) b.click(); return 1; })()`);
  await new Promise(r=>setTimeout(r,1000));
  const tabs=['通用','外观','驱动模型','个性化定制','浏览器','应用设置','账户'];
  const allPlaceholders=new Map();
  for(const tab of tabs){
    await evalFn(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='${tab}'); if(b) b.click(); return 1; })()`);
    await new Promise(r=>setTimeout(r,800));
    // 收集当前 tab 的所有 placeholder
    const ph=await evalFn(`(() => {
      return [...document.querySelectorAll('input[placeholder], textarea[placeholder]')].map(e=> e.placeholder).filter(Boolean);
    })()`);
    ph.forEach(p=>{
      const n=norm(p);
      if(!dictLower.has(n.toLowerCase()) && /[a-zA-Z]/.test(n) && !allPlaceholders.has(n.toLowerCase())) allPlaceholders.set(n.toLowerCase(), {text:p, from:tab});
    });
    // 尝试点击该 tab 下的第一个 打开 进入二级
    const hasOpened=await evalFn(`(() => {
      const btns=[...document.querySelectorAll('button')].filter(b=> (b.innerText||'').trim()==='打开' && b.offsetParent);
      if(btns[0]){ btns[0].click(); return true; }
      return false;
    })()`);
    if(hasOpened){
      await new Promise(r=>setTimeout(r,1000));
      const ph2=await evalFn(`(() => {
        return [...document.querySelectorAll('input[placeholder], textarea[placeholder]')].map(e=> e.placeholder).filter(Boolean);
      })()`);
      ph2.forEach(p=>{
        const n=norm(p);
        if(!dictLower.has(n.toLowerCase()) && /[a-zA-Z]/.test(n) && !allPlaceholders.has(n.toLowerCase())) allPlaceholders.set(n.toLowerCase(), {text:p, from:tab+' -> 二级'});
      });
      // 尝试点击 添加 进入三级
      const hasAdd=await evalFn(`(() => {
        const btn=[...document.querySelectorAll('button')].find(b=> (b.innerText||'').trim()==='添加' && b.offsetParent);
        if(btn){ btn.click(); return true; }
        return false;
      })()`);
      if(hasAdd){
        await new Promise(r=>setTimeout(r,1000));
        const ph3=await evalFn(`(() => {
          return [...document.querySelectorAll('input[placeholder], textarea[placeholder]')].map(e=> e.placeholder).filter(Boolean);
        })()`);
        ph3.forEach(p=>{
          const n=norm(p);
          if(!dictLower.has(n.toLowerCase()) && /[a-zA-Z]/.test(n) && !allPlaceholders.has(n.toLowerCase())) allPlaceholders.set(n.toLowerCase(), {text:p, from:tab+' -> 三级 添加'});
        });
        // Esc 回退
        await evalFn(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',keyCode:27,bubbles:true}));`);
        await new Promise(r=>setTimeout(r,500));
      }
      // 返回一级
      await evalFn(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='${tab}'); if(b) b.click(); return 1; })()`);
      await new Promise(r=>setTimeout(r,500));
    }
  }
  console.log('=== 所有层级 placeholder 缺键 ===');
  for(const [k,v] of allPlaceholders){
    console.log(JSON.stringify(v.text)+'  <= '+v.from);
  }
  fs.writeFileSync('scratch/_placeholder_missing.json', JSON.stringify([...allPlaceholders.values()],null,2),'utf8');
  console.log('written _placeholder_missing.json total '+allPlaceholders.size);
  socket.close(); process.exit(0);
});
