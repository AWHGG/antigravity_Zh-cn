// 活体验证：用 CDP 把新版引擎注入当前页面，验证设置面板漏译是否修复
// 用法：node scratch/verify_fix_live.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// 生成新版引擎代码（复用引擎模块）
const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'localization_engine.js'), 'utf8');
const DICTS_ABS = path.join(ROOT, 'dicts').replace(/\\/g, '\\\\');
const MOD_SRC = SRC
  .replace("const DICTS_FOLDER = 'dicts';", "const DICTS_FOLDER = '" + DICTS_ABS + "';")
  .replace("path.join(__dirname, DICTS_FOLDER)", "DICTS_FOLDER")
  .replace(/\nmain\(\);\s*$/, '\nmodule.exports = { generateJs };\n');
const MOD_PATH = path.join(__dirname, '_live_mod.js');
fs.writeFileSync(MOD_PATH, MOD_SRC);
const { generateJs } = require(MOD_PATH);
const NEW_ENGINE_JS = generateJs();
console.log('新引擎代码大小:', (NEW_ENGINE_JS.length / 1024).toFixed(1), 'KB');

// 找 DevTools 端口
const pids = execSync('tasklist /fi "imagename eq Antigravity.exe" /nh', { encoding: 'utf8' })
  .split(/\r?\n/).map(l => (l.match(/\d+/) || [])[0]).filter(Boolean);
const netstat = execSync('netstat -ano', { encoding: 'utf8' });
const ports = [];
for (const line of netstat.split(/\r?\n/)) {
  const m = line.match(/TCP\s+127\.0\.0\.1:(\d+)\s+\S+\s+LISTENING\s+(\d+)/);
  if (m && pids.includes(m[2])) ports.push(Number(m[1]));
}
function probe(port) {
  return new Promise(resolve => {
    const req = http.get({ host: '127.0.0.1', port, path: '/json/list', timeout: 800 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}
(async () => {
  let target = null;
  for (const port of ports) {
    const list = await probe(port);
    if (list && Array.isArray(list)) {
      target = (list.find(t => t.type === 'page' && /127\.0\.0\.1:\d+\//.test(t.url)) || list.find(t => t.type === 'page')) && { ...(list.find(t => t.type === 'page' && /127\.0\.0\.1:\d+\//.test(t.url)) || list.find(t => t.type === 'page')), port };
      if (target) break;
    }
  }
  if (!target) { console.log('未找到页面'); process.exit(1); }
  console.log('target:', target.url);

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let msgId = 0;
  const pending = new Map();
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result || {}); pending.delete(msg.id); }
  };
  const send = (method, params) => new Promise(res => {
    const id = ++msgId;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return r && r.result && r.result.value;
  };

  // 扫描漏译（与 dump_missing.js 相同逻辑，简化：只统计非禁区英文文本 + 与字典比对）
  const dict = {};
  for (const f of fs.readdirSync(path.join(ROOT, 'dicts')).filter(x => x.endsWith('.json'))) {
    Object.assign(dict, JSON.parse(fs.readFileSync(path.join(ROOT, 'dicts', f), 'utf8')));
  }
  const norm = s => String(s).replace(/\s+/g, ' ').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').trim();
  const dictLower = new Map();
  for (const k of Object.keys(dict)) dictLower.set(norm(k).toLowerCase(), dict[k]);

  const SCAN = `(() => {
    const out = [];
    const seen = new Set();
    const BLOCKED_TAGS = new Set(['SCRIPT','STYLE','CODE','PRE','INPUT','TEXTAREA','SVG','CANVAS','KBD','SAMP','VAR','TEMPLATE','MATH']);
    const blockedRe = /monaco|editor|view-line|terminal|xterm|thought|thinking|reasoning|chat-message|message-content|markdown|prose|artifact|snippet|tool-call|notranslate|token|diff-/i;
    function walk(el, inherited) {
      const b = inherited || BLOCKED_TAGS.has(el.tagName) || blockedRe.test(typeof el.className === 'string' ? el.className : '') || (el.getAttribute && el.getAttribute('translate') === 'no');
      if (el.shadowRoot) { for (const c of el.shadowRoot.children || []) walk(c, b); }
      if (!el.children || !el.children.length) {
        const t = (el.textContent || '').trim();
        if (t && /[a-zA-Z]{2,}/.test(t) && t.length < 200 && !b && !seen.has(t)) { seen.add(t); out.push(t); }
        return;
      }
      for (const c of el.children) walk(c, b);
    }
    walk(document.body || document.documentElement, false);
    return out;
  })()`;

  const before = (await evaluate(SCAN)) || [];
  const beforeMissing = before.filter(t => !dictLower.has(norm(t).toLowerCase()));
  console.log('注入新引擎前：非禁区英文文本', before.length, '条，缺键', beforeMissing.length, '条');
  beforeMissing.slice(0, 30).forEach(t => console.log('  ', JSON.stringify(t)));

  // 清掉旧引擎标志，注入新引擎
  await evaluate('try { delete window.__AG_HANHUA_INSTALLED__; } catch(e) {}; try { delete document.documentElement.dataset.agHanhua; } catch(e) {}; true');
  await evaluate(NEW_ENGINE_JS);
  await new Promise(r => setTimeout(r, 1500));

  const after = (await evaluate(SCAN)) || [];
  const afterMissing = after.filter(t => !dictLower.has(norm(t).toLowerCase()));
  console.log('注入新引擎后：非禁区英文文本', after.length, '条，缺键', afterMissing.length, '条');
  afterMissing.slice(0, 30).forEach(t => console.log('  ', JSON.stringify(t)));

  // 验证关键修复项
  for (const probe of ['High', 'Labs', 'Developer', 'CitC Settings', 'Regroup Google3 Chats', 'Loading token usage...', 'Main Agent', 'Select branch']) {
    const found = after.find(t => t === probe);
    console.log('  检查', JSON.stringify(probe), found ? '→ 仍漏译!' : '→ 已翻译 ✓');
  }

  ws.close();
  fs.rmSync(MOD_PATH, { force: true });
  process.exit(0);
})();
