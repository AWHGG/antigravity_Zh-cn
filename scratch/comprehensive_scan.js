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
  const fs=require('fs'),path=require('path');
  const norm=s=>String(s).replace(/\s+/g,' ').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').trim();
  let all={}; for(const f of fs.readdirSync('dicts').filter(x=>x.endsWith('.json'))) Object.assign(all, JSON.parse(fs.readFileSync('dicts/'+f,'utf8')));
  const dictLower=new Set(Object.keys(all).map(k=>norm(k).toLowerCase()));
  const allMissing=new Map();
  const visited=new Set();

  async function scanCurrent(label){
    // 扫描当前 DOM 的文本 + placeholder/title/aria-label
    const texts=await evalFn(`(() => {
      const out=[];
      const seen=new Set();
      const walker=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while(n=walker.nextNode()){
        const t=n.nodeValue.trim();
        if(!t || t.length>300) continue;
        if(!/[a-zA-Z]/.test(t)) continue;
        if(seen.has(t)) continue;
        seen.add(t);
        out.push(t.slice(0,250));
      }
      // 属性
      const attrs=[];
      for(const el of document.querySelectorAll('input, textarea, button, [title], [aria-label], [placeholder]')){
        for(const a of ['placeholder','title','aria-label']){
          const v=el.getAttribute(a);
          if(v && /[a-zA-Z]/.test(v) && v.length<200) attrs.push(v.trim().slice(0,200));
        }
      }
      return {texts: [...new Set(out)], attrs: [...new Set(attrs)]};
    })()`);
    const candidates=[...texts.texts, ...texts.attrs];
    const missing=candidates.filter(t=>{
      const n=norm(t);
      if(n.length<2) return false;
      if(dictLower.has(n.toLowerCase())) return false;
      // 过滤路径/URL/代码
      if(n.startsWith('http') || n.includes(':\\') || n.startsWith('/') || n.match(/\.(js|ts|json|png|jpg)$/i)) return false;
      if(/^[0-9a-f]{8}-/.test(n)) return false;
      if(n.includes('变压器') || n.includes('antigravity_cn_test') || n.includes('coorfo@') || n.includes('D:\\')) return false;
      // 过滤已翻译的中文含英文品牌（假阳性）
      if(/[\u4e00-\u9fff]/.test(n) && n.replace(/[^a-zA-Z]/g,'').length<5) return false;
      // 过滤短码
      if(n.length<3) return false;
      // 过滤纯符号
      if(!/[a-zA-Z]{2,}/.test(n)) return false;
      // 过滤代码片段
      if(n.startsWith('//') || n==='const' || n==='greet' || n.startsWith('`Hello')) return false;
      return true;
    });
    console.log(`\\n[${label}] 候选 ${candidates.length} 缺键 ${missing.length}`);
    missing.slice(0,20).forEach(t=> console.log('  MISSING '+JSON.stringify(t)));
    missing.forEach(m=>{
      const lower=norm(m).toLowerCase();
      if(!allMissing.has(lower)) allMissing.set(lower,{text:m, from:label});
    });
    return missing.length;
  }

  // 1. 主界面（关闭设置）
  await evalFn(`history.pushState(null,'','https://127.0.0.1:56688/');`);
  await new Promise(r=>setTimeout(r,800));
  await scanCurrent('主界面');

  // 2. 打开设置，依次点每个一级
  await evalFn(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='设置'); if(b) b.click(); return 1; })()`);
  await new Promise(r=>setTimeout(r,1000));
  const primaryTabs=['账户','通用','外观','驱动模型','个性化定制','浏览器','应用设置'];
  for(const tab of primaryTabs){
    await evalFn(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='${tab}'); if(b) b.click(); return 1; })()`);
    await new Promise(r=>setTimeout(r,800));
    await scanCurrent('设置->'+tab);
    // 展开该 Tab 内的所有折叠（显示细目、展开等）
    const expands=await evalFn(`(() => {
      const btns=[...document.querySelectorAll('button')].filter(b=>{
        const t=(b.innerText||'').trim();
        return t.includes('显示') && t.includes('细目') || t==='展开' || t==='展开全部' || t.includes('Learn more');
      }).map(b=> (b.innerText||'').trim());
      return [...new Set(btns)];
    })()`);
    for(const exp of expands.slice(0,3)){
      const txt=exp.replace(/"/g,'\\"');
      await evalFn(`(() => {
        const b=[...document.querySelectorAll('button')].find(x=> (x.innerText||'').trim()===\`${txt}\`);
        if(b) b.click();
        return b? 'clicked':'not found';
      })()`);
      await new Promise(r=>setTimeout(r,600));
      await scanCurrent('设置->'+tab+'->'+exp);
      // 收起
      await evalFn(`(() => {
        const b=[...document.querySelectorAll('button')].find(x=> (x.innerText||'').includes('隐藏') && x.innerText.includes('细目'));
        if(b) b.click();
        return 1;
      })()`);
      await new Promise(r=>setTimeout(r,400));
    }
    // 二级 打开
    const hasOpen=await evalFn(`(() => {
      const btns=[...document.querySelectorAll('button')].filter(b=> (b.innerText||'').trim()==='打开' && b.offsetParent);
      if(btns[0]){ btns[0].click(); return true; }
      return false;
    })()`);
    if(hasOpen){
      await new Promise(r=>setTimeout(r,800));
      await scanCurrent('设置->'+tab+'->二级打开');
      // 三级 添加
      const hasAdd=await evalFn(`(() => {
        const btn=[...document.querySelectorAll('button')].find(b=> (b.innerText||'').trim()==='添加' && b.offsetParent);
        if(btn){ btn.click(); return true; }
        return false;
      })()`);
      if(hasAdd){
        await new Promise(r=>setTimeout(r,800));
        await scanCurrent('设置->'+tab+'->三级添加');
        await evalFn(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',keyCode:27,bubbles:true}));`);
        await new Promise(r=>setTimeout(r,400));
      }
      // 返回一级
      await evalFn(`(() => { const b=[...document.querySelectorAll('button')].find(x=> (x.innerText||'').trim()==='${tab}'); if(b) b.click(); return 1; })()`);
      await new Promise(r=>setTimeout(r,400));
    }
  }

  // 3. 右侧边栏（关闭设置后）
  await evalFn(`history.pushState(null,'','https://127.0.0.1:56688/');`);
  await new Promise(r=>setTimeout(r,800));
  const rightHeaders=['子智能体','文件已变更','交付件列表 (Artifacts)','已上传附件','后台任务'];
  for(const h of rightHeaders){
    const txt=h.split(' ')[0];
    await evalFn(`(() => {
      const btns=[...document.querySelectorAll('button')];
      const t=btns.find(b=> (b.innerText||'').includes(\`${txt}\`));
      if(t) t.click();
      return t? 'clicked':'not found';
    })()`);
    await new Promise(r=>setTimeout(r,800));
    await scanCurrent('右侧->'+h);
  }

  // 4. 左侧项目
  await evalFn(`(() => {
    const b=[...document.querySelectorAll('button')].find(x=> (x.innerText||'').trim()==='项目列表');
    if(b) b.click();
    return 1;
  })()`);
  await new Promise(r=>setTimeout(r,800));
  await scanCurrent('左侧项目列表');

  console.log('\\n===== 全量去重总计 '+allMissing.size+' =====');
  for(const [k,v] of allMissing){
    console.log(JSON.stringify(v.text)+' <= '+v.from);
  }
  fs.writeFileSync('scratch/_comprehensive_missing.json', JSON.stringify([...allMissing.values()],null,2),'utf8');
  console.log('written _comprehensive_missing.json');
  // 关闭设置
  await evalFn(`history.pushState(null,'','https://127.0.0.1:56688/');`);
  socket.close(); process.exit(0);
});
