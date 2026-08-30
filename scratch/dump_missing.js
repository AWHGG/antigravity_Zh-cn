// 设置面板漏译诊断：通过 CDP 连接运行中的 Antigravity，扫描渲染层漏译
// 用法：node scratch/dump_missing.js
// 前置：客户端已运行，且已打开设置面板（尽量展开各分区）
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 用同步 HTTP 探测
const http = require('http');
function probe(port, cb) {
  const req = http.get({ host: '127.0.0.1', port, path: '/json/version', timeout: 800 }, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => cb(null, data));
  });
  req.on('error', e => cb(e));
  req.on('timeout', () => { req.destroy(); cb(new Error('timeout')); });
}

function findTargets(port) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/json/list', timeout: 2000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

const targets = [];
const pids = execSync('tasklist /fi "imagename eq Antigravity.exe" /nh', { encoding: 'utf8' })
  .split(/\r?\n/).map(l => (l.match(/\d+/) || [])[0]).filter(Boolean);
const netstat = execSync('netstat -ano', { encoding: 'utf8' });
const ports = new Set();
for (const line of netstat.split(/\r?\n/)) {
  const m = line.match(/TCP\s+127\.0\.0\.1:(\d+)\s+\S+\s+LISTENING\s+(\d+)/);
  if (m && pids.includes(m[2])) ports.add(Number(m[1]));
}
console.log('Antigravity listening ports:', [...ports].join(', '));

let devtoolsPort = null;
const candidates = [...ports];
let idx = 0;
function tryNext() {
  if (idx >= candidates.length) { console.log('未找到 DevTools 端口'); process.exit(1); }
  const port = candidates[idx++];
  probe(port, (err, body) => {
    if (!err && body && body.includes('"Browser"')) {
      devtoolsPort = port;
      console.log('DevTools port:', port);
      main();
    } else {
      tryNext();
    }
  });
}

// ---------- 2. CDP ----------
let ws = null;
let msgId = 0;
const pending = new Map();
function send(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
function evaluate(expression, contextId) {
  return send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    ...(contextId !== undefined ? { contextId } : {}),
  }).then(r => {
    if (r.exceptionDetails) throw new Error('evaluate exception: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result && r.result.value;
  });
}

async function connect(targetWsUrl) {
  ws = new WebSocket(targetWsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      p.resolve(msg.result || {});
    }
  };
  await send('Runtime.enable');
}

// ---------- 3. 扫描脚本（在页面执行） ----------
const SCAN_JS = `(() => {
  const out = { blocked: [], untranslated: [] };
  const seen = new Set();
  const BLOCKED_TAGS = new Set(['SCRIPT','STYLE','CODE','PRE','INPUT','TEXTAREA','SVG','CANVAS','KBD','SAMP','VAR','TEMPLATE','MATH','AUDIO','VIDEO']);
  const blockedRe = /monaco|editor|view-line|view-lines|lines-content|glyph-margin|cm-editor|cm-line|ace_|theia-editor|syntax-|hljs|prism|shiki|diff-|dirty-diff|terminal|xterm|suggest-widget|parameter-hints|ghost-text|thought|thinking|reasoning|chain-of-thought|trajectory|step-|chat-message|message-content|message-bubble|markdown|prose|artifact|snippet|tool-call|tool-args|tool-result|command-line|katex|notranslate|data-lang|data-language|data-code|data-thought|data-tool-name|token/i;
  function isBlocked(el) {
    const cls = typeof el.className === 'string' ? el.className : (el.getAttribute ? (el.getAttribute('class') || '') : '');
    const role = el.getAttribute ? (el.getAttribute('role') || '') : '';
    return BLOCKED_TAGS.has(el.tagName) || blockedRe.test(cls) || /^(code|textbox|log|terminal)$/i.test(role) ||
      (el.getAttribute && el.getAttribute('translate') === 'no') ||
      (el.classList && el.classList.contains('notranslate'));
  }
  function walk(el, inherited) {
    const b = inherited || isBlocked(el);
    // Shadow DOM 一律不采集：引擎不翻译影子树，其内容不构成漏译（避免产生永不修复的噪声条目）
    let children = el.children;
    if (!children || !children.length) {
      const t = (el.textContent || '').trim();
      if (t && /[a-zA-Z]/.test(t) && t.length <= 300 && !seen.has(t)) {
        seen.add(t);
        (b ? out.blocked : out.untranslated).push({ t: t.slice(0, 200), cls: (typeof el.className === 'string' ? el.className : '').slice(0, 80), tag: el.tagName });
      }
      return;
    }
    for (const c of children) walk(c, b);
  }
  walk(document.body || document.documentElement, false);
  return out;
})()`;

// ---------- 4. 主流程 ----------
async function main() {
  const list = await findTargets(devtoolsPort);
  const pages = list.filter(t => t.type === 'page' && /127\.0\.0\.1:\d+\//.test(t.url));
  console.log('page targets:', pages.length);
  const dict = {};
  const dictDir = path.join(__dirname, '..', 'dicts');
  for (const f of fs.readdirSync(dictDir).filter(x => x.endsWith('.json'))) {
    Object.assign(dict, JSON.parse(fs.readFileSync(path.join(dictDir, f), 'utf8')));
  }
  const norm = s => String(s).replace(/\s+/g, ' ').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').trim();
  const dictLower = new Map();
  for (const k of Object.keys(dict)) dictLower.set(norm(k).toLowerCase(), dict[k]);

  for (const page of pages) {
    console.log('\n========== target: ' + page.url + ' ==========');
    await connect(page.webSocketDebuggerUrl);

    // __AG_DUMP_MISSING__（引擎历史采集）
    let dumpMissing = [];
    try { dumpMissing = await evaluate('typeof window.__AG_DUMP_MISSING__ === "function" ? window.__AG_DUMP_MISSING__() : null') || []; } catch (e) {}
    console.log('__AG_DUMP_MISSING__: ' + dumpMissing.length + ' 条（引擎运行期采集）');
    const dmMissingKey = [], dmEngineMiss = [];
    for (const t of dumpMissing) {
      const lower = norm(t).toLowerCase();
      if (dictLower.has(lower)) dmEngineMiss.push(t);
      else dmMissingKey.push(t);
    }
    console.log('  ── 缺字典键: ' + dmMissingKey.length + ' 条');
    [...new Set(dmMissingKey)].sort().slice(0, 200).forEach(t => console.log('    MISSING ' + JSON.stringify(t)));
    console.log('  ── 字典有键但未命中(疑似bug): ' + dmEngineMiss.length + ' 条');
    [...new Set(dmEngineMiss)].sort().slice(0, 50).forEach(t => console.log('    ENGINE ' + JSON.stringify(t) + ' => ' + JSON.stringify(dictLower.get(norm(t).toLowerCase()))));

    // 全量 DOM 扫描
    const scan = await evaluate(SCAN_JS);
    const missingKey = [], engineMiss = [];
    for (const item of (scan.untranslated || [])) {
      const lower = norm(item.t).toLowerCase();
      if (dictLower.has(lower)) engineMiss.push(item);
      else missingKey.push(item);
    }
    const blockedSettings = (scan.blocked || []).filter(i => /setting|config|preference|option|allow|deny|enable|disable|review|terminal|editor|tab|model|agent|skill|mcp|knowledge|notification|telemetry|shell|workspace|general|advanced|auth|billing|security|extension|keybind|theme|high|low|medium/i.test(i.t + ' ' + i.cls));
    console.log('\n  ── 当前 DOM 非禁区未翻译（缺键）: ' + missingKey.length + ' 条');
    [...new Map(missingKey.map(i => [norm(i.t).toLowerCase(), i])).values()].slice(0, 80).forEach(i => console.log('    [' + i.tag + '] ' + JSON.stringify(i.t)));
    console.log('  ── 当前 DOM 非禁区未翻译（有键未命中）: ' + engineMiss.length + ' 条');
    [...new Map(engineMiss.map(i => [norm(i.t).toLowerCase(), i])).values()].slice(0, 40).forEach(i => console.log('    [' + i.tag + '] ' + JSON.stringify(i.t) + ' => ' + JSON.stringify(dictLower.get(norm(i.t).toLowerCase()))));
    console.log('  ── 被禁区熔断但疑似设置面板文案: ' + blockedSettings.length + ' 条');
    [...new Map(blockedSettings.map(i => [norm(i.t).toLowerCase(), i])).values()].slice(0, 60).forEach(i => console.log('    [' + i.tag + '] ' + JSON.stringify(i.t) + '  cls=' + JSON.stringify(i.cls)));

    ws.close();
    ws = null;
  }
  process.exit(0);
}

tryNext();
