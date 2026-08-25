// 主进程文案字典覆盖检查（与引擎一致：精确匹配优先，未命中回退小写映射，并识别引擎内建覆盖）
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'dicts');
const all = {};
for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json'))) {
  Object.assign(all, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}
const norm = s => String(s).replace(/\s+/g, ' ').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').trim();
const lower = new Map();
for (const k of Object.keys(all)) lower.set(norm(k).toLowerCase(), all[k]);

// 引擎 core 内建覆盖的文案（无需字典键）
const BUILTIN = new Set(['No agents running']);

const keys = [
  'Open workspace', 'Open Antigravity', 'Confirm Quit', 'Are you sure you want to quit?',
  'Binary not found', 'Startup failed', 'No agents running', 'Docs', 'Check for Updates',
  'Restart to Update', 'Checking for Updates...', 'Downloading Update...', 'New Window', 'Quit',
  'Cancel', 'There may be agents or background tasks running.',
  'No items found', 'Confirm'
];
let missing = 0;
for (const k of keys) {
  if (BUILTIN.has(k)) { console.log(JSON.stringify(k), '=> [引擎内建覆盖]'); continue; }
  if (k in all) { console.log(JSON.stringify(k), '=>', JSON.stringify(all[k])); continue; }
  const lk = norm(k).toLowerCase();
  if (lower.has(lk)) { console.log(JSON.stringify(k), '=>', JSON.stringify(lower.get(lk)), '(小写变体命中)'); continue; }
  console.log(JSON.stringify(k), '=> (缺失)');
  missing++;
}
console.log(missing ? ('缺失 ' + missing + ' 个') : '全部覆盖 ✓');
process.exit(missing ? 1 : 0);
