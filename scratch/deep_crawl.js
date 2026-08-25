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
  const evalFn=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true}); if(r.exceptionDetails) console.log('ex',JSON.stringify(r.exceptionDetails).slice(0,800)); return r.result&&r.result.value;};
  const fs=require('fs'),path=require('path');
  const norm=s=>String(s).replace(/\s+/g,' ').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').trim();
  const dict=(()=>{const d={}; for(const f of fs.readdirSync('dicts').filter(x=>x.endsWith('.json'))) Object.assign(d, JSON.parse(fs.readFileSync('dicts/'+f,'utf8'))); return d;})();
  const dictLower=new Set(Object.keys(dict).map(k=>norm(k).toLowerCase()));
  // helper to get current url
  // open settings
  await evalFn(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='设置'); if(b) b.click(); return 1; })()`);
  await new Promise(r=>setTimeout(r,1200));
  const primaryTabs=['通用','外观','驱动模型','个性化定制','浏览器','应用设置','账户'];
  const allMissing=new Map();
  for(const tab of primaryTabs){
    console.log('\\n===== 一级: '+tab+' =====');
    await evalFn(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='${tab}'); if(b) b.click(); return 1; })()`);
    await new Promise(r=>setTimeout(r,1500));
    let body=await evalFn('document.body.innerText.slice(0,3000)');
    console.log('一级body头',body.slice(0,500).replace(/\n/g,' | '));
    // 枚举二级触发器
    const triggers=await evalFn(`(() => {
      const btns=[...document.querySelectorAll('button, a, [role=button]')];
      return btns.map(b=>{
        const t=(b.innerText||b.textContent||'').trim();
        return {text:t, cls:(b.className||'').toString().slice(0,60), visible: !!(b.offsetParent)}
      }).filter(x=> x.text && x.visible && (
        x.text==='打开' || x.text==='编辑' || x.text==='添加' || x.text.includes('细目') || x.text.includes('显示') || x.text==='打开 MCP 配置文件' || x.text==='打开系统设置' || x.text.includes('Learn more') || x.text.includes('了解更多')
      )).slice(0,30);
    })()`);
    console.log('二级触发器',JSON.stringify(triggers,null,2));
    // 对每个触发器进行点击穿透
    for(let i=0;i<Math.min(triggers.length,6);i++){
      const trig=triggers[i];
      console.log('\\n-- 点击二级: '+JSON.stringify(trig.text)+' --');
      const clicked=await evalFn(`(() => {
        const btns=[...document.querySelectorAll('button, a, [role=button]')];
        const t=btns.find(b=> (b.innerText||b.textContent||'').trim()===\`${trig.text}\` && b.offsetParent);
        if(!t) return 'not found';
        // 优先用 click，记录点击前后的 url 变化
        const before=location.href;
        t.click();
        return 'clicked before='+before;
      })()`);
      console.log(clicked);
      await new Promise(r=>setTimeout(r,1500));
      let url=await evalFn('location.href');
      console.log('url after',url);
      body=await evalFn('document.body.innerText.slice(0,5000)');
      console.log('二级body头',body.slice(0,800).replace(/\n/g,' | '));
      // 扫描当前二级页面漏译
      const scan=await evalFn(`(() => {
        const seen=new Set(); const out=[];
        function walk(el){
          if(!el.children||!el.children.length){
            const t=(el.textContent||'').trim();
            if(t&&/[a-zA-Z]/.test(t)&&t.length<300&&!seen.has(t)){seen.add(t); out.push(t.slice(0,200));}
            return;
          }
          for(const c of el.children) walk(c);
        }
        walk(document.body); return out;
      })()`);
      // 过滤字典
      const missing=scan.filter(t=>{
        const n=norm(t);
        if(n.length<2) return false;
        if(/[\\u4e00-\\u9fff]/.test(n) && n.replace(/[^a-zA-Z]/g,'').length<4) return false;
        if(dictLower.has(n.toLowerCase())) return false;
        if(n.includes('tokens)') || n.includes('antigravity_cn_test') || n.includes('变压器')) return false;
        if(!/[a-zA-Z]{2,}/.test(n)) return false;
        // 过滤代码片段
        if(n.startsWith('//') || n==='const' || n==='greet' || n==='string' || n==='return' || n==='`Hello') return false;
        return true;
      });
      console.log('二级缺键',missing.length, JSON.stringify(missing.slice(0,30),null,2));
      missing.forEach(m=>{
        const lower=norm(m).toLowerCase();
        if(!allMissing.has(lower)) allMissing.set(lower,{text:m, from: tab+' -> '+trig.text});
      });
      // 尝试返回一级：按 ESC 或 重新点击一级 tab
      const back=await evalFn(`(() => {
        // 尝试按 Esc
        const ev=new KeyboardEvent('keydown',{key:'Escape',code:'Escape',keyCode:27,bubbles:true});
        document.dispatchEvent(ev);
        return 'esc dispatched';
      })()`);
      await new Promise(r=>setTimeout(r,800));
      // 再点一次一级 tab 确保回到
      await evalFn(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='${tab}'); if(b) b.click(); return 1; })()`);
      await new Promise(r=>setTimeout(r,800));
    }
    // 也扫描一级本身
    const scan1=await evalFn(`(() => {
      const seen=new Set(); const out=[];
      function walk(el){ if(!el.children||!el.children.length){ const t=(el.textContent||'').trim(); if(t&&/[a-zA-Z]/.test(t)&&!seen.has(t)) out.push(t.slice(0,200)); return;} for(const c of el.children) walk(c); }
      walk(document.body); return out;
    })()`);
    const missing1=scan1.filter(t=>{
      const n=norm(t);
      if(dictLower.has(n.toLowerCase())) return false;
      if(n.length<3) return false;
      if(!/[a-zA-Z]{2,}/.test(n)) return false;
      return true;
    });
    // 已在 allMissing 中
  }
  console.log('\\n===== 二级去重总计 '+allMissing.size+' =====');
  for(const [k,v] of allMissing){
    console.log(JSON.stringify(v.text)+'  <= '+v.from);
  }
  fs.writeFileSync('scratch/_deep_missing.json', JSON.stringify([...allMissing.values()],null,2),'utf8');
  console.log('written _deep_missing.json');
  socket.close(); process.exit(0);
});
