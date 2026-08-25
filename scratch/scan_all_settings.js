const http=require('http');
function findPort(cb){
  http.get({host:'127.0.0.1',port:9222,path:'/json/list',timeout:2000},res=>{
    let d='';res.on('data',c=>d+=c);res.on('end',()=>cb(null,JSON.parse(d)));
  }).on('error',cb);
}
findPort(async (err,list)=>{
  if(err) throw err;
  const page=list.find(t=>t.type==='page' && t.url.includes('127.0.0.1:54246'));
  const socket=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r=>socket.onopen=r);
  let id=0,pending=new Map();
  socket.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result);pending.delete(m.id);}};
  const send=(method,params)=>new Promise(res=>{const nid=++id;pending.set(nid,res);socket.send(JSON.stringify({id:nid,method,params}));});
  const evalFn=async expr=>{
    const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});
    return r.result && r.result.value;
  };
  // 枚举所有设置分类Tab
  const tabs=await evalFn(`(() => {
    const els=[...document.querySelectorAll('button, a, [role=tab], [role=menuitem]')];
    return els.map(e=> (e.innerText||e.textContent||'').trim()).filter(t=>t.length>0 && t.length<20).slice(0,100);
  })()`);
  console.log('available tabs sample',JSON.stringify(tabs,null,2));
  // 尝试定位左侧导航的所有按钮文本
  const navItems=await evalFn(`(() => {
    // 左侧导航通常在固定区域，查找包含“设置”标题的容器内的按钮
    const all=[...document.querySelectorAll('button')];
    const nav=all.filter(b=>{
      const t=(b.innerText||'').trim();
      return ['账户','通用','外观','驱动模型','个性化定制','浏览器','应用设置','快捷键','提供反馈建议'].includes(t) || ['Account','General','Appearance','Models','Customizations','Browser','App Settings'].includes(t);
    }).map(b=> (b.innerText||'').trim());
    return [...new Set(nav)];
  })()`);
  console.log('navItems',navItems);
  // 获取所有可能的设置分类英文+中文映射
  const allButtons=await evalFn(`(() => {
    const btns=[...document.querySelectorAll('button')];
    return btns.map(b=> (b.innerText||b.textContent||'').trim()).filter(Boolean).slice(0,200);
  })()`);
  console.log('allButtons top',JSON.stringify(allButtons.slice(0,80),null,2));

  // 函数：点击指定文本的按钮
  async function clickByText(text){
    const res=await evalFn(`(() => {
      const btns=[...document.querySelectorAll('button')];
      const t=btns.find(b=> (b.innerText||b.textContent||'').trim()===\`${text}\`);
      if(!t) return 'not found';
      t.click(); return 'clicked '+t.textContent.slice(0,30);
    })()`);
    return res;
  }
  // 依次点击各设置分区并扫描
  const sections=['账户','通用','外观','驱动模型','个性化定制','浏览器','应用设置','快捷键'];
  const fs=require('fs'),path=require('path');
  const ROOT='C:\\Users\\geniu\\Desktop\\Desktop\\antigravity_cn_test';
  const dictDir=path.join(ROOT,'dicts');
  const dict={}; for(const f of fs.readdirSync(dictDir).filter(x=>x.endsWith('.json'))) Object.assign(dict, JSON.parse(fs.readFileSync(path.join(dictDir,f),'utf8')));
  const norm=s=>String(s).replace(/\s+/g,' ').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').trim();
  const dictLower=new Set(Object.keys(dict).map(k=>norm(k).toLowerCase()));
  const allMissing=new Map();
  for(const sec of sections){
    console.log('\\n=== 点击分区: '+sec+' ===');
    const cr=await clickByText(sec);
    console.log(cr);
    await new Promise(r=>setTimeout(r,1800));
    const url=await evalFn('location.href');
    console.log('url',url);
    const body=await evalFn('document.body.innerText.slice(0,3000)');
    console.log('body snippet',body.slice(0,800).replace(/\\n/g,' | '));
    const scan=await evalFn(`(() => {
      const seen=new Set(); const out=[];
      function walk(el){
        if(!el.children||!el.children.length){
          const t=(el.textContent||'').trim();
          if(t && /[a-zA-Z]/.test(t) && t.length<200 && !seen.has(t)){seen.add(t); out.push(t);}
          return;
        }
        for(const c of el.children) walk(c);
      }
      walk(document.body); return out;
    })()`);
    // 过滤并对比字典
    const missing=scan.filter(t=>{
      const n=norm(t);
      if(n.length<2) return false;
      if(/[\\u4e00-\\u9fff]/.test(n) && n.replace(/[^a-zA-Z]/g,'').length<3) return false; // 已翻译中文含少量英文品牌，跳过
      if(dictLower.has(n.toLowerCase())) return false;
      if(n.includes(' ')===false && /^[a-z]+$/.test(n)) return false;
      if(n.startsWith('http')) return false;
      if(n.includes('tokens)')) return false;
      return /[a-zA-Z]{2,}/.test(n);
    });
    console.log('missing in this section',missing.length);
    missing.slice(0,30).forEach(t=>console.log('  MISSING '+JSON.stringify(t)));
    for(const m of missing){
      const lower=norm(m).toLowerCase();
      if(!allMissing.has(lower)) allMissing.set(lower,m);
    }
  }
  console.log('\\n=== 全分区去重总计 '+allMissing.size+' 条潜在漏译 ===');
  [...allMissing.values()].slice(0,100).forEach(t=>console.log('TOTAL '+JSON.stringify(t)));
  // 保存
  fs.writeFileSync(path.join(ROOT,'scratch','_all_sections_missing.json'), JSON.stringify([...allMissing.values()],null,2),'utf8');
  console.log('已写入 _all_sections_missing.json');
  socket.close();
  process.exit(0);
});
