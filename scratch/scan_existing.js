const fs=require('fs');
const path=require('path');
const ROOT=path.join(__dirname,'..');
const DICT_DIR=path.join(ROOT,'dicts');
const tmp='C:\\Users\\geniu\\AppData\\Local\\Temp\\ag_static_27240_1787446286400';

function loadDict(){
  const map={};
  for(const f of fs.readdirSync(DICT_DIR).filter(x=>x.endsWith('.json'))){
    Object.assign(map, JSON.parse(fs.readFileSync(path.join(DICT_DIR,f),'utf8')));
  }
  return map;
}
const dict=loadDict();
const dictNorm=new Map();
const norm=s=>String(s).replace(/\s+/g,' ').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').trim();
for(const k of Object.keys(dict)) dictNorm.set(norm(k).toLowerCase(), dict[k]);
console.log(`字典总数 ${Object.keys(dict).length}`);

function isProbablyUI(str){
  const s=norm(str);
  if(!s) return false;
  if(s.length<2 || s.length>180) return false;
  if(!/[a-zA-Z]/.test(s)) return false;
  if(/^(https?:\/\/|[a-zA-Z]:[\\/]|[\\/][a-zA-Z0-9_.-]|\.\/|\.\.\/)/.test(s)) return false;
  if(/^[a-zA-Z0-9_\-.]+\.(js|ts|jsx|tsx|json|py|go|rs|cpp|c|h|hpp|java|kt|dart|html|css|scss|md|mdx|yaml|yml|toml|xml|sql|sh|bat|ps1|asar|exe|dll|zip|tar|gz|png|jpg|svg|ico)$/i.test(s)) return false;
  if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return false;
  if(/[a-zA-Z0-9_$]+\.[a-zA-Z0-9_$]+\(/.test(s)) return false;
  if(/^[a-zA-Z0-9_$]+\(.*\)$/.test(s)) return false;
  if(/^[^a-zA-Z]*$/.test(s)) return false;
  if(/^(const|let|var|function|return|import|export|require|module|class|async|await|true|false|null|undefined)$/i.test(s)) return false;
  if(s.includes(' ')) return true;
  if(/^[A-Z][a-z]{1,}$/.test(s) && s.length>=3) return true;
  if(/^[A-Z].*[a-z]$/.test(s) && s.length>=4) return true;
  if(/^(Open|Save|Close|Cancel|Confirm|Delete|Rename|Copy|Paste|Cut|Search|Settings|General|Advanced|Manage|Install|Update|Reload|Restart|Quit|Exit|Help|View|File|Edit|Window|Terminal|Run|Debug|Extensions?|Projects?|Workspaces?|Skills?|Plugins?|Rules?|Agent|Model|Theme|Language|Account|Billing|Notifications?|Telemetry|Keybindings?|Editor|Browser)$/i.test(s)) return true;
  return false;
}

const candidates=new Map();
let scannedFiles=0;
function scanFile(filePath){
  let content;
  try{ content=fs.readFileSync(filePath,'utf8'); }catch(e){return;}
  scannedFiles++;
  if(content.includes('ANTIGRAVITY CHINESE LOCALIZATION') || content.includes('antigravity_i18n_core')){
    // Skip injected translation block? But we filtered Chinese, still want to scan original English before injection.
    // For preload.js, it contains injected block with Chinese - skip those lines containing Chinese
  }
  const re=/["'`](?:[^"'`\\]|\\.){2,180}["'`]/g;
  // Actually we need capturing group; use manual
  const re2=/["'`]([^"'`\\]{2,180})["'`]/g;
  let m;
  while((m=re2.exec(content))){
    const raw=m[1];
    if(/[\u4e00-\u9fff]/.test(raw)) continue;
    // skip entries that are JSON keys of dictionary (already handled)
    if(!isProbablyUI(raw)) continue;
    const n=norm(raw);
    const lower=n.toLowerCase();
    if(n.length<2) continue;
    if(/^[a-z]+[A-Z]/.test(n) && !n.includes(' ')) continue;
    if(/^[a-z0-9_-]+$/.test(n) && !n.includes(' ') && n.length<10) continue;
    if(/^(script|style|code|pre|input|textarea|svg|canvas|monaco|editor)$/i.test(n)) continue;
    // 过滤技术路径
    if(n.includes('/') || n.includes('\\')) continue;
    if(n.startsWith('.') ) continue;
    if(!candidates.has(lower)) candidates.set(lower,{raw:n,count:0,files:new Set()});
    const rec=candidates.get(lower);
    rec.count++;
    rec.files.add(path.relative(tmp,filePath));
  }
  const jsxRe=/>([^<]{2,120})</g;
  while((m=jsxRe.exec(content))){
    const raw=m[1].trim();
    if(!raw || /[\u4e00-\u9fff]/.test(raw)) continue;
    if(!isProbablyUI(raw)) continue;
    const n=norm(raw);
    const lower=n.toLowerCase();
    if(!candidates.has(lower)) candidates.set(lower,{raw:n,count:0,files:new Set()});
    candidates.get(lower).count++;
    candidates.get(lower).files.add(path.relative(tmp,filePath));
  }
}
function walk(dir){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory()){
      if(p.includes('node_modules')) continue;
      walk(p);
    }else if(/\.(js|jsx|ts|tsx|html|json)$/i.test(ent.name)){
      if(/\.test\.js$/.test(ent.name)) continue;
      if(p.endsWith('package.json') && !p.includes('dist')) continue;
      scanFile(p);
    }
  }
}
walk(path.join(tmp,'dist'));
console.log(`扫描文件数 ${scannedFiles}, 候选去重 ${candidates.size}`);

const missing=[];
for(const [lower, rec] of candidates){
  if(dictNorm.has(lower)) continue;
  if(/^[a-z]+[A-Z]/.test(rec.raw) && !rec.raw.includes(' ')) continue;
  if(/^[a-z0-9_-]+$/.test(rec.raw) && !rec.raw.includes(' ')) continue;
  // 过滤纯符号
  // 额外过滤：全小写且无空格的单个单词，可能是代码变量，不算UI漏译
  // 但如果是 Settings, Models 等已覆盖，缺失的可能是短枚举，需要保留
  // 这里保留长度短的UI枚举：方法已在 isProbablyUI 决定，此处不过滤
  missing.push(rec);
}
missing.sort((a,b)=>b.count - a.count || a.raw.localeCompare(b.raw));
console.log(`\n=== 缺字典键 ${missing.length} 条 ===`);
console.log(missing.slice(0,300).map(r=>`${JSON.stringify(r.raw)}  [count:${r.count} file:${[...r.files][0]}]`).join('\n'));
if(missing.length>300) console.log(`... 还有 ${missing.length-300} 条`);

const outPath=path.join(ROOT,'scratch','_static_missing.json');
const outArr=missing.map(r=>({en:r.raw,count:r.count,files:[...r.files].slice(0,3)}));
fs.writeFileSync(outPath, JSON.stringify(outArr,null,2),'utf8');
console.log(`\n完整清单已写入 ${outPath} (${missing.length} 条)`);

// 同时检查 main.js / preload.js 中可提取但未被字典命中的情况，与 engine 内建正则覆盖对比
const builtinPatterns=[
  /^Version\s*([\d\.]*)$/i,
  /^(\d+)\s+running$/i,
  /^(\d+)\s+agents?\s+running$/i,
  /^Worked for (\d+)(s|m|h|d|w|mo|yr)?$/i,
  /^Show (\d+) more/i,
];
let regexCovered=0;
for(const r of missing){
  if(builtinPatterns.some(re=>re.test(r.raw))) regexCovered++;
}
console.log(`其中可被引擎动态正则覆盖约 ${regexCovered} 条`);
