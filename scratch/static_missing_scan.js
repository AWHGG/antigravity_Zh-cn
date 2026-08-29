const fs=require('fs');
const path=require('path');
const os=require('os');
const {execSync}=require('child_process');

const ROOT=path.join(__dirname,'..');
const DICT_DIR=path.join(ROOT,'dicts');
// 资源目录可传参指定（目录或 app.asar 路径均可），缺省回退本机默认安装位置
const RES_ARG=process.argv[2]||'C:\\Users\\geniu\\AppData\\Local\\Programs\\antigravity\\resources';
const RES_DIR=(()=>{ let p=RES_ARG; if(fs.existsSync(p)&&fs.statSync(p).isFile()&&p.toLowerCase().endsWith('.asar')) p=path.dirname(p); return p; })();
const ASAR_BAK=path.join(RES_DIR,'app.asar.bak');
const ASAR_CUR=path.join(RES_DIR,'app.asar');

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

const tmp=path.join(os.tmpdir(), `ag_static_${process.pid}_${Date.now()}`);
if(fs.existsSync(tmp)) fs.rmSync(tmp,{recursive:true,force:true});
fs.mkdirSync(tmp,{recursive:true});
console.log(`解包 ${ASAR_CUR} -> ${tmp}`);
execSync(`npx --yes @electron/asar extract "${ASAR_CUR}" "${tmp}"`, {stdio:'pipe'});

function isProbablyUI(str){
  const s=norm(str);
  if(!s) return false;
  if(s.length<2 || s.length>180) return false;
  if(!/[a-zA-Z]/.test(s)) return false;
  // 过滤路径/URL/代码
  if(/^(https?:\/\/|[a-zA-Z]:[\\/]|[\\/][a-zA-Z0-9_.-]|\.\/|\.\.\/)/.test(s)) return false;
  if(/^[a-zA-Z0-9_\-.]+\.(js|ts|jsx|tsx|json|py|go|rs|cpp|c|h|hpp|java|kt|dart|html|css|scss|md|mdx|yaml|yml|toml|xml|sql|sh|bat|ps1|asar|exe|dll|zip|tar|gz|png|jpg|svg|ico)$/i.test(s)) return false;
  if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return false;
  if(/[a-zA-Z0-9_$]+\.[a-zA-Z0-9_$]+\(/.test(s)) return false;
  if(/^[a-zA-Z0-9_$]+\(.*\)$/.test(s)) return false;
  // 单词太短且无空格的非UI枚举也可能是代码标识，保留但标记
  // 过滤纯符号
  if(/^[^a-zA-Z]*$/.test(s)) return false;
  // 过滤技术标识
  if(/^(const|let|var|function|return|import|export|require|module|class|async|await|true|false|null|undefined)$/i.test(s)) return false;
  // 至少包含一个空格或首字母大写单词，或常见UI词
  // 保留所有含空格的英文短语必是UI
  if(s.includes(' ')) return true;
  // 单词但长度>2且首字母大写（如 Settings, Open）
  if(/^[A-Z][a-z]{1,}$/.test(s) && s.length>=3) return true;
  // 带标点
  if(/^[A-Z].*[a-z]$/.test(s) && s.length>=4) return true;
  // 常见短枚举
  if(/^(Open|Save|Close|Cancel|Confirm|Delete|Rename|Copy|Paste|Cut|Search|Settings|General|Advanced|Manage|Install|Update|Reload|Restart|Quit|Exit|Help|View|File|Edit|Window|Terminal|Run|Debug|Extensions?|Projects?|Workspaces?|Skills?|Plugins?|Rules?)$/i.test(s)) return true;
  return false;
}

// 收集所有引号字符串 + JSX文本 + 模板中的英文
const candidates=new Map(); // normLower -> {raw,count,files}
let scannedFiles=0;
function scanFile(filePath){
  let content;
  try{ content=fs.readFileSync(filePath,'utf8'); }catch(e){return;}
  scannedFiles++;
  // 1. 引号字符串
  const re=/["'`]((?:[^"'`\\]|\\.){2,180})["'`]/g;
  let m;
  while((m=re.exec(content))){
    const raw=m[1];
    // 过滤含中文已翻译的 injected
    if(/[\u4e00-\u9fff]/.test(raw)) continue;
    // 过滤转义后仍含中文
    if(!isProbablyUI(raw)) continue;
    const n=norm(raw);
    const lower=n.toLowerCase();
    if(!n || n.length<2) continue;
    // 过滤已在 blockedTags 等代码常量里的纯技术串
    if(/^(script|style|code|pre|input|textarea|svg|canvas|monaco|editor)$/i.test(n)) continue;
    const key=lower;
    if(!candidates.has(key)) candidates.set(key,{raw:n,count:0,files:new Set()});
    const rec=candidates.get(key);
    rec.count++;
    rec.files.add(path.relative(tmp,filePath));
  }
  // 2. JSX >文本< 形式 (简单捕获)
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
      // 跳过 node_modules 部分大文件以提速？但 UI 主要在 dist
      walk(p);
    }else if(/\.(js|jsx|ts|tsx|html|json)$/i.test(ent.name)){
      // 跳过大体积 node_modules 中非 UI：只扫描 dist + 根 package.json 等
      // 为全面，扫描 dist 全量，node_modules 仅扫描顶层 package.json name?
      if(p.includes('node_modules') && !p.endsWith('package.json')) continue;
      // 跳过测试文件
      if(/\.test\.js$/.test(ent.name)) continue;
      scanFile(p);
    }
  }
}
walk(tmp);
console.log(`扫描文件数 ${scannedFiles}, 候选去重 ${candidates.size}`);

// 分类
const missing=[];
const hasButUntested=[];
const already=[];
for(const [lower, rec] of candidates){
  if(dictNorm.has(lower)){
    already.push(rec);
  }else{
    // 检查是否有大小写变体命中？已通过 lowerMap，所以无命中即缺
    // 但需过滤那些明显是代码片段而非 UI：如 camelCase 含大写中缀
    if(/^[a-z]+[A-Z]/.test(rec.raw) && !rec.raw.includes(' ')) {
      // camelCase 如 hostBridgeServer 跳过
      continue;
    }
    if(/^[a-z0-9_-]+$/.test(rec.raw) && !rec.raw.includes(' ')) continue; // 纯小写标识
    missing.push(rec);
  }
}
missing.sort((a,b)=>b.count - a.count || a.raw.localeCompare(b.raw));

console.log(`\n=== 已有字典覆盖 ${already.length} 条 ===`);
console.log(`=== 缺字典键 ${missing.length} 条 ===`);
console.log(missing.slice(0,200).map(r=>`${JSON.stringify(r.raw)}  [count:${r.count} file:${[...r.files][0]}]`).join('\n'));
if(missing.length>200) console.log(`... 还有 ${missing.length-200} 条未显示`);

// 尝试按页面分组启发
const pageHints=new Map();
for(const r of missing){
  const f=[...r.files][0]||'';
  const page=f.includes('settingsService')?'settings':f.includes('menu')?'menu':f.includes('tray')?'tray':f.includes('wizard')?'wizard':f.includes('main')?'main':f.includes('preload')?'preload':'other';
  if(!pageHints.has(page)) pageHints.set(page,[]);
  pageHints.get(page).push(r);
}
console.log('\n=== 按文件分组Top ===');
for(const [page,arr] of pageHints){
  console.log(`${page}: ${arr.length} 条`);
}

// 输出完整缺失清单到文件
const outPath=path.join(ROOT,'scratch','_static_missing.json');
const outArr=missing.map(r=>({en:r.raw,count:r.count,files:[...r.files].slice(0,3)}));
fs.writeFileSync(outPath, JSON.stringify(outArr,null,2),'utf8');
console.log(`\n完整清单已写入 ${outPath} (${missing.length} 条)`);

// 清理
// fs.rmSync(tmp,{recursive:true,force:true});
console.log(`保留解包目录 ${tmp} 供后续检查`);
