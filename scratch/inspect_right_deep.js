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
  // 收集右侧所有按钮文本
  const rightBtns=await evalFn(`(() => {
    const vw=window.innerWidth;
    const btns=[...document.querySelectorAll('button, [role=button], [role=tab], a')].filter(b=>{
      const r=b.getBoundingClientRect();
      return r.left > vw*0.55 && b.offsetParent && (b.innerText||'').trim().length>0;
    }).map(b=> ({text:(b.innerText||'').trim().slice(0,80), cls:(b.className||'').toString().slice(0,80)}));
    return [...new Map(btns.map(b=>[b.text,b])).values()];
  })()`);
  console.log('rightBtns',JSON.stringify(rightBtns,null,2));
  // 对每个右侧按钮点击并扫描
  const allMissing=new Map();
  for(const btn of rightBtns.slice(0,10)){
    const txt=btn.text.split('\n')[0].trim(); // 取首行如 "交付件列表 (Artifacts)"
    console.log('\\n=== 点击右侧: '+JSON.stringify(txt)+' ===');
    const clicked=await evalFn(`(() => {
      const vw=window.innerWidth;
      const btns=[...document.querySelectorAll('button, [role=button], [role=tab], a')];
      const t=btns.find(b=>{
        const r=b.getBoundingClientRect();
        return r.left > vw*0.55 && b.offsetParent && (b.innerText||'').trim().startsWith(\`${txt.replace(/`/g,'\\`').replace(/"/g,'\\"')}\`);
      });
      if(!t) return 'not found';
      t.click();
      return 'clicked';
    })()`);
    console.log(clicked);
    await new Promise(r=>setTimeout(r,1200));
    // 扫描右侧区域
    const scan=await evalFn(`(() => {
      const vw=window.innerWidth;
      const seen=new Set(); const out=[];
      const walker=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while(n=walker.nextNode()){
        const t=n.nodeValue.trim();
        if(!t || t.length>200) continue;
        if(!/[a-zA-Z]/.test(t)) continue;
        if(seen.has(t)) continue;
        seen.add(t);
        try{
          const el=n.parentElement;
          if(!el) continue;
          const r=el.getBoundingClientRect();
          const isRight=r.left > vw*0.55;
          if(!isRight) continue;
          // 判断是否在禁区
          const cls=(el.className||'').toString();
          const isBlocked=/monaco|editor|terminal|xterm|thought|markdown|prose|artifact|notranslate/i.test(cls);
          if(isBlocked) continue;
          out.push({text:t.slice(0,120), cls:cls.slice(0,60), tag:el.tagName});
        }catch(e){}
      }
      return out;
    })()`);
    console.log('scan right',JSON.stringify(scan.slice(0,30),null,2));
    // 过滤字典
    const missing=scan.filter(x=>{
      const n=norm(x.text);
      if(dictLower.has(n.toLowerCase())) return false;
      if(n.length<3) return false;
      if(/^[0-9]/.test(n) && n.match(/\d/)) return false; // 数字开头如 "0" 忽略
      return true;
    });
    console.log('missing',JSON.stringify(missing.slice(0,30),null,2));
    missing.forEach(m=>{
      const lower=norm(m.text).toLowerCase();
      if(!allMissing.has(lower)) allMissing.set(lower, {text:m.text, from:'右侧->'+txt});
    });
    // 尝试展开二级：查找右侧区域内的 "显示" "展开" 等
    const secondTriggers=await evalFn(`(() => {
      const vw=window.innerWidth;
      const btns=[...document.querySelectorAll('button')].filter(b=>{
        const r=b.getBoundingClientRect();
        return r.left > vw*0.55 && b.offsetParent;
      }).map(b=> (b.innerText||'').trim()).filter(t=> t && (t.includes('显示') || t.includes('展开') || t==='打开' || t==='更多'));
      return [...new Set(btns)].slice(0,10);
    })()`);
    console.log('secondTriggers',secondTriggers);
  }
  console.log('\\n=== 右侧去重总计 '+allMissing.size+' ===');
  for(const [k,v] of allMissing) console.log(JSON.stringify(v.text)+' <= '+v.from);
  fs.writeFileSync('scratch/_right_missing.json', JSON.stringify([...allMissing.values()],null,2),'utf8');
  socket.close(); process.exit(0);
});
