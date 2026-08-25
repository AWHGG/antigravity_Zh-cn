// 字典结构校验：跨文件冲突、空值、同键多文件（即使译文一致也违反"单键单文件"约定）
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'dicts');
const norm = s => String(s).replace(/\s+/g, ' ').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').trim();
const byKey = {}, emptyVals = [], files = [];
for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json'))) {
  files.push(f);
  const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  for (const [k, v] of Object.entries(data)) {
    const nk = norm(k).toLowerCase();
    if (v === '' || v === ' ') emptyVals.push({ f, k, v });
    if (!byKey[nk]) byKey[nk] = { file: f, vals: new Set([v]) };
    else { byKey[nk].vals.add(v); byKey[nk].files = (byKey[nk].files || [byKey[nk].file]).concat(f); }
  }
}
const conflicts = Object.entries(byKey).filter(([, o]) => o.vals.size > 1);
const multiFile = Object.entries(byKey).filter(([, o]) => o.files && o.files.length > 1);
let bad = 0;
console.log('files:', files.join(', '));
console.log('total keys:', Object.keys(byKey).length);
console.log('empty/whitespace translations:', emptyVals.length);
if (emptyVals.length) bad += emptyVals.length;
emptyVals.slice(0, 10).forEach(e => console.log('  ', e.f, JSON.stringify(e.k), '->', JSON.stringify(e.v)));
console.log('cross-file conflicts:', conflicts.length);
if (conflicts.length) bad += conflicts.length;
conflicts.slice(0, 10).forEach(([k, o]) => console.log('  ', JSON.stringify(k), [...o.vals], 'in', o.files.join(',')));
console.log('same-key-in-multiple-files:', multiFile.length);
if (multiFile.length) bad += multiFile.length;
multiFile.forEach(([k, o]) => console.log('  ', JSON.stringify(k), 'in', o.files.join(' & ')));
if (bad) process.exit(1);
