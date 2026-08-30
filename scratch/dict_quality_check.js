// 字典内容质量检查：同文件大小写变体一致性 + 译文特殊字符 + 原文=译文（防误译键）
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'dicts');
const norm = s => String(s).replace(/\s+/g, ' ').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').trim();

const issues = { sameFileVariant: [], newlineVals: [], identityKeys: [], longVals: [] };
for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json'))) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const seen = new Map(); // normKey.toLowerCase() -> {original, value}
  for (const [k, v] of Object.entries(data)) {
    const nk = norm(k).toLowerCase();
    if (seen.has(nk)) {
      const prev = seen.get(nk);
      if (prev.value !== v) issues.sameFileVariant.push({ f, a: prev.original, b: k, va: prev.value, vb: v });
    } else {
      seen.set(nk, { original: k, value: v });
    }
    if (typeof v === 'string') {
      // 键本身含换行的多行词条（归一化后可正常匹配）属有意排版，只有"键无换行而译文引入换行"才是缺陷
      if (v.includes('\n') && !String(k).includes('\n')) issues.newlineVals.push({ f, k, v });
      if (v === k) issues.identityKeys.push({ f, k });
      if (v.length > 300) issues.longVals.push({ f, k, len: v.length });
    }
  }
}
console.log('== 同文件内归一化重复且译文不一致 ==', issues.sameFileVariant.length);
issues.sameFileVariant.slice(0, 15).forEach(x => console.log(' ', x.f, JSON.stringify(x.a), '=>', JSON.stringify(x.va), ' vs ', JSON.stringify(x.b), '=>', JSON.stringify(x.vb)));
console.log('== 译文含换行符（键无换行而译文引入） ==', issues.newlineVals.length);
issues.newlineVals.slice(0, 10).forEach(x => console.log(' ', x.f, JSON.stringify(x.k), '->', JSON.stringify(x.v.slice(0, 80))));
console.log('== 原文=译文（身份键，防误译用途，非缺陷） ==', issues.identityKeys.length);
issues.identityKeys.slice(0, 15).forEach(x => console.log(' ', x.f, JSON.stringify(x.k)));
console.log('== 超长译文 (>300，提示性检查) ==', issues.longVals.length);
issues.longVals.forEach(x => console.log(' ', x.f, x.len, JSON.stringify(x.k.slice(0, 60))));
// 门禁判定：变体不一致与意外换行计入失败；身份键与超长译文仅提示
const bad = issues.sameFileVariant.length + issues.newlineVals.length;
process.exit(bad ? 1 : 0);
