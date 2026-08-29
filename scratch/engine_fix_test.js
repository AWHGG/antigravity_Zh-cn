// 引擎回归测试：模板转义扫描 + 语法 + jsdom 真实 DOM 行为 + 主进程 core 行为 + asar/清理/状态检测/品牌模式
// 运行：node scratch/engine_fix_test.js  （依赖 devDependencies: jsdom）
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'localization_engine.js'), 'utf8');
const DICTS_ABS = path.join(ROOT, 'dicts').replace(/\\/g, '\\\\');

// 追加式导出：在源码尾部扩展 module.exports，不依赖 main() 的调用形态（正则重写曾因
// main() 改为 if(require.main) 包裹而整体失效，教训：测试挂钩必须与源码形态解耦）
function buildMod(extraExports, brandMode) {
  let mod = SRC
    .replace("const DICTS_FOLDER = 'dicts';", "const DICTS_FOLDER = '" + DICTS_ABS + "';")
    .replace("path.join(__dirname, DICTS_FOLDER)", "DICTS_FOLDER");
  if (brandMode) {
    mod = mod.replace(
      "const BRAND_TITLE_MODE = BRAND_TITLE_ALIASES[String(getOptionValue('--brand-title', 'english')).toLowerCase()] || 'english';",
      "const BRAND_TITLE_MODE = '" + brandMode + "';"
    );
  }
  return mod + '\nmodule.exports = Object.assign(module.exports, { ' + extraExports + ' });\n';
}
const MOD_PATH = path.join(__dirname, '_engine_mod.js');
fs.writeFileSync(MOD_PATH, buildMod('generateJs, generateI18nCoreJs, loadDictionary, cleanJsContent, cleanMainJsContent, cleanMenuJsContent, cleanTrayJsContent, isHanhuaAsar, isValidAsar, normalizeText, detectHanhuaState, resolveMainEntry, hashFile'));

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

const eng = require(MOD_PATH);
const js = eng.generateJs();
const core = eng.generateI18nCoreJs();

(async () => {

// ---------- 0. 模板字符串正则转义扫描 ----------
console.log('\n[0] 模板字符串正则转义扫描');
// 模板字面量会把 \s 吃成 s、\b 吃成退格符，历史上 9 处动态支路因此整批失效。
// 此处直接扫描两个模板区间，出现"单反斜杠 + 正则元字符"即回归。
function extractTemplates(src) {
  const regions = [];
  let i = src.indexOf('const jsSource = `');
  if (i !== -1) { const j = src.indexOf('${SIGNATURE_END}`;', i); if (j !== -1) regions.push(['generateJs', src.slice(i, j)]); }
  i = src.indexOf('return `/**');
  if (i !== -1) {
    // 引擎文件可能是 CRLF 行尾，结束标记用正则容错匹配（\n`;\n}）
    const endRe = /\r?\n`;\s*\r?\n\}/g;
    endRe.lastIndex = i;
    const m = endRe.exec(src);
    if (m) regions.push(['generateI18nCoreJs', src.slice(i, m.index)]);
  }
  return regions;
}
const regions = extractTemplates(SRC);
check('两个模板区间均可定位', regions.length === 2, '实际: ' + regions.map(r => r[0]).join(','));
let escBad = 0;
for (const [name, txt] of regions) {
  const re = /(^|[^\\])\\([sdwbSDBW.])/g;
  let m;
  while ((m = re.exec(txt)) !== null) {
    escBad++;
    const line = txt.slice(0, m.index).split('\n').length;
    console.log('    受损转义 @' + name + ' 区间内第 ' + line + ' 行: ' + JSON.stringify(txt.slice(Math.max(0, m.index - 30), m.index + 12)));
  }
}
check('模板内不存在单反斜杠正则元字符（\\s \\d \\b \\w \\. 等）', escBad === 0, '残留 ' + escBad + ' 处');
check('生成代码中 \b 不是退格符（动作白名单）', !js.includes(String.fromCharCode(8)));

// ---------- 1. 生成代码语法 ----------
console.log('\n[1] 生成代码语法检查');
let jsOk = true;
try { new Function(js); } catch (e) { jsOk = false; console.log('  JS 语法错误: ' + e.message); }
check('generateJs 输出为合法 JS', jsOk);
check('输出不再含 REPLACEMENT_ENTRIES_PLACEHOLDER 占位符', !js.includes('REPLACEMENT_ENTRIES_PLACEHOLDER'));
check('输出含 DICT_PLACEHOLDER 已替换', js.includes('new Map(Object.entries('));
let coreOk = true;
try { new Function(core); } catch (e) { coreOk = false; console.log('  core 语法错误: ' + e.message); }
check('generateI18nCoreJs 输出为合法 JS', coreOk);
check('core 含注入代码常量', core.includes('RENDERER_INJECTION_CODE'));
const dictJsonSize = JSON.stringify(eng.loadDictionary(), null, 4).length;
console.log('  (字典 JSON 约 ' + (dictJsonSize / 1024).toFixed(1) + ' KB，注入 JS ' + (js.length / 1024).toFixed(1) + ' KB)');

// ---------- 2. 渲染层行为（jsdom 真实 DOM） ----------
console.log('\n[2] 渲染层行为（jsdom）');
const tick = (ms = 40) => new Promise(r => setTimeout(r, ms));
// 必须等 DOMContentLoaded 之后再 eval：jsdom 构造完成时 readyState 仍是 'loading'，
// 引擎在 loading 状态只注册监听不执行初始扫描，会导致同步断言全部落空
async function runEngine(html) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
  const doc = dom.window.document;
  if (doc.readyState === 'loading') {
    await new Promise(r => doc.addEventListener('DOMContentLoaded', () => setTimeout(r, 0), { once: true }));
  }
  dom.window.eval(js);
  return dom;
}

// 2.1 基础翻译 + 三级边界（禁区/流式区/交互控件）
{
  const dom = await runEngine('<main><div id="plain">Open</div><button id="btn">Save</button><div class="monaco-editor"><span id="code">Open</span></div><div class="prose"><span id="prose">Settings</span></div><div translate="no"><span id="tno">Open</span></div><svg><text id="svgtext">Open</text></svg><style id="instyle">.active { color: red }</style><p id="longp">Analyzing the spatial relationships observed in the original label compared to the current output</p></main>');
  // $ 接收 CSS 选择器（'#id'），用 querySelector；此前误用 getElementById(id) 却传 '#id'，导致所有元素查不到
  const $ = sel => dom.window.document.querySelector(sel);
  check('普通文本 Open → 打开', $('#plain').textContent === '打开', JSON.stringify($('#plain').textContent));
  check('button 控件 Save → 保存', $('#btn').textContent === '保存', JSON.stringify($('#btn').textContent));
  check('monaco 禁区不翻译', $('#code').textContent === 'Open', JSON.stringify($('#code').textContent));
  check('AI prose 流式区不翻译', $('#prose').textContent === 'Settings', JSON.stringify($('#prose').textContent));
  check('[translate=no] 容器不翻译', $('#tno').textContent === 'Open', JSON.stringify($('#tno').textContent));
  check('SVG <text> 不翻译（标签口径对齐）', $('#svgtext').textContent === 'Open', JSON.stringify($('#svgtext').textContent));
  check('body 内联 <style> 内容不被篡改', $('#instyle').textContent.includes('.active { color: red }'), JSON.stringify($('#instyle').textContent));
  check('字典未命中的长句保持原样', $('#longp').textContent.includes('Analyzing the spatial'), JSON.stringify($('#longp').textContent));
  dom.window.close();
}

// 2.2 动态句式回归（本次修复的失效正则分支，全部走初始全量扫描）
{
  const cases = [
    ['Explored 2 files', '已探索 2 个文件'],
    ['Analyzed 3 files', '已分析 3 个文件'],
    ['Edited 1 file', '已编辑 1 个文件'],
    ['Created 2 folders', '已创建 2 个文件夹'],
    ['Deleted 1 file', '已删除 1 个文件'],
    ['Searching knowledge', '正在搜索 knowledge'],
    ['All scheduled tasks run as gemini-3-pro.', '所有计划任务均以 gemini-3-pro 模型运行。'],
    ['A scheduled task with ID t1 already exists.', 'ID 为 t1 的任务已存在。'],
    ['+ Skill', '+ 技能'],
    ['Skill (S)', '技能 (S)'],
  ];
  const html = cases.map((c, i) => '<div id="dyn' + i + '">' + c[0].replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</div>').join('');
  const dom = await runEngine(html);
  cases.forEach((c, i) => {
    const got = dom.window.document.getElementById('dyn' + i).textContent;
    check('动态句式 "' + c[0] + '" → "' + c[1] + '"', got === c[1], '实际: ' + JSON.stringify(got));
  });
  // 白名单 \b 修复：带函数调用特征的步骤摘要不再被"代码特征过滤"拦截
  const dom2 = await runEngine('<div id="wl">Explored foo.bar()</div>');
  const wl = dom2.window.document.getElementById('wl').textContent;
  check('白名单 \\b 修复：Explored foo.bar() → 已探索 foo.bar()', wl === '已探索 foo.bar()', '实际: ' + JSON.stringify(wl));
  dom.window.close(); dom2.window.close();
}

// 2.3 属性翻译边界（原作者设计：仅插入子树根的 placeholder/title/aria-label 参与翻译，
// 深层元素属性不展开——title/aria-label 常携带数据（路径/名称），不得纳入翻译面）
{
  const dom = await runEngine('<div id="attrroot"></div>');
  const doc = dom.window.document;
  const wrap = doc.createElement('div');
  wrap.setAttribute('title', 'Open');
  wrap.innerHTML = '<input id="ip" placeholder="Settings" title="Settings"><button id="bd" aria-label="Delete">X</button>';
  doc.getElementById('attrroot').appendChild(wrap);
  await tick();
  check('子树根 title 翻译', wrap.getAttribute('title') === '打开', JSON.stringify(wrap.getAttribute('title')));
  check('深层 placeholder 不翻译（属性翻译仅限根）', doc.getElementById('ip').getAttribute('placeholder') === 'Settings', JSON.stringify(doc.getElementById('ip').getAttribute('placeholder')));
  check('深层 title 不翻译', doc.getElementById('ip').getAttribute('title') === 'Settings', JSON.stringify(doc.getElementById('ip').getAttribute('title')));
  check('深层 aria-label 不翻译', doc.getElementById('bd').getAttribute('aria-label') === 'Delete', JSON.stringify(doc.getElementById('bd').getAttribute('aria-label')));
  // input 直插：观察器按 BLOCKED 口径跳过（原作者设计）
  const ip2 = doc.createElement('input');
  ip2.id = 'ip2';
  ip2.placeholder = 'Settings';
  doc.getElementById('attrroot').appendChild(ip2);
  await tick();
  check('input 直插不入队（BLOCKED 口径）', ip2.getAttribute('placeholder') === 'Settings', JSON.stringify(ip2.getAttribute('placeholder')));
  dom.window.close();
}

// 2.4 Shadow DOM：仅当宿主本身是插入子树的根时其 shadowRoot 被覆盖（原作者边界；
// 深层宿主的 shadow 内容不展开，与属性同口径，不扩大翻译面）
{
  const dom = await runEngine('<div id="sh-root"></div>');
  const doc = dom.window.document;
  // 深层宿主：不在覆盖范围
  const outer = doc.createElement('div');
  const host = doc.createElement('ag-widget');
  host.attachShadow({ mode: 'open' });
  const s = doc.createElement('span');
  s.textContent = 'Settings';
  host.shadowRoot.appendChild(s);
  outer.appendChild(host);
  doc.getElementById('sh-root').appendChild(outer);
  await tick();
  check('深层宿主 shadow 内容不翻译（边界）', s.textContent === 'Settings', JSON.stringify(s.textContent));
  // 宿主直插（本身是子树根）：覆盖
  const host2 = doc.createElement('ag-widget2');
  host2.attachShadow({ mode: 'open' });
  const s2 = doc.createElement('span');
  s2.textContent = 'Open';
  host2.shadowRoot.appendChild(s2);
  doc.getElementById('sh-root').appendChild(host2);
  await tick();
  check('宿主直插时 shadowRoot 被翻译', s2.textContent === '打开', JSON.stringify(s2.textContent));
  dom.window.close();
}

// 2.5 批量插入走分片队列（150 节点 < 200 上限全部入队；200 上限为原作者性能护栏，溢出丢弃）
{
  const dom = await runEngine('<div id="sw"></div>');
  const cont = dom.window.document.getElementById('sw');
  for (let i = 0; i < 150; i++) {
    const d = dom.window.document.createElement('div');
    d.textContent = 'Open';
    cont.appendChild(d);
  }
  await tick(80);
  const texts = Array.from(cont.children).map(c => c.textContent);
  check('批量插入 150 节点全部分片翻译', texts.every(t => t === '打开'), '未翻译 ' + texts.filter(t => t !== '打开').length + ' 个');
  dom.window.close();
}

// 2.6 跨 world 互斥：二次求值直接退出，不产生第二套 observer（由存活的第一个引擎继续翻译）
{
  const dom = await runEngine('<div id="m1">Open</div>');
  dom.window.eval(js);
  check('二次求值后防重标志仍为 1', dom.window.document.documentElement.dataset.agHanhua === '1');
  const n = dom.window.document.createElement('div');
  n.textContent = 'Save';
  dom.window.document.body.appendChild(n);
  await tick();
  check('二次求值不产生双引擎，首个引擎继续翻译新节点', n.textContent === '保存', JSON.stringify(n.textContent));
  dom.window.close();
}

// 2.7 深层嵌套禁区：40 层普通 div 回溯到 monaco 容器仍熔断
{
  let html = '<div class="monaco-editor">';
  for (let i = 0; i < 40; i++) html += '<div>';
  html += '<span id="deep">Save</span>';
  for (let i = 0; i < 40; i++) html += '</div>';
  html += '</div>';
  const dom = await runEngine(html);
  check('40 层深嵌套禁区不误译', dom.window.document.getElementById('deep').textContent === 'Save', JSON.stringify(dom.window.document.getElementById('deep').textContent));
  dom.window.close();
}

// ---------- 3. 主进程 core 行为（vm + electron 桩） ----------
console.log('\n[3] 主进程 core 行为（electron 桩）');
{
  const hook = { trayTip: null, dialogOpts: null, errBox: null, appMenu: null };
  const fakeElectron = {
    Menu: {
      setApplicationMenu: function (menu) { hook.appMenu = menu; },
      buildFromTemplate: function (template) { return { items: template.map(t => Object.assign({}, t)) }; }
    },
    Tray: function Tray() {},
    dialog: {
      showMessageBox: function (opts) { hook.dialogOpts = opts; },
      showErrorBox: function (title, content) { hook.errBox = [title, content]; }
    },
    Notification: null,
    BrowserWindow: function () {},
    app: { on: () => {} }
  };
  fakeElectron.Tray.prototype.setToolTip = function (t) { hook.trayTip = t; };
  const sandbox = {
    require: (m) => { if (m === 'electron') return fakeElectron; throw new Error('module not found: ' + m); },
    module: { exports: {} },
    console: { log() {}, warn() {}, error() {} },
    Promise, Map, Object, Array, JSON, String, Proxy, Reflect, Error, setTimeout
  };
  vm.runInNewContext(core, sandbox);

  const tpl = fakeElectron.Menu.buildFromTemplate([
    { label: '&Open', submenu: [{ label: 'Settings' }] },
    { label: 'Quit' }
  ]);
  check('菜单助记键 &Open → 打开(&O)', tpl.items[0].label === '打开(&O)', JSON.stringify(tpl.items[0].label));
  check('菜单子项 Settings → 设置', tpl.items[0].submenu[0].label === '设置', JSON.stringify(tpl.items[0].submenu[0].label));
  check('菜单动态正则 Quit 无需字典也走通（identity 保持）', typeof tpl.items[1].label === 'string');

  const tr = new fakeElectron.Tray();
  tr.setToolTip('Quit');
  check('托盘 tooltip 翻译', hook.trayTip === '退出', JSON.stringify(hook.trayTip));

  fakeElectron.dialog.showMessageBox({ title: 'Confirm Quit', message: 'Are you sure you want to quit?' });
  check('对话框 title 翻译', hook.dialogOpts.title === '确认退出', JSON.stringify(hook.dialogOpts.title));
  check('对话框 message 翻译', hook.dialogOpts.message === '您确定要退出吗？', JSON.stringify(hook.dialogOpts.message));

  fakeElectron.dialog.showErrorBox('Version 1.2.3', '3 running');
  check('core 动态正则 Version', hook.errBox[0] === '版本 1.2.3', JSON.stringify(hook.errBox[0]));
  check('core 动态正则 N running', hook.errBox[1] === '3 个智能体运行中', JSON.stringify(hook.errBox[1]));

  check('core 含 showErrorBox hook', core.includes('showErrorBox'));
  check('core 含 updateActions 同步', core.includes('syncUpdaterActions') && core.includes("require('./updater')"));
  check('core 含 Notification hook', core.includes('HanhuaNotification') && core.includes('electron.Notification'));
  check('渲染引擎 nowrap 注入仅限控件（不再强制 width）', !js.includes("min-width', 'fit-content"));
}

// ---------- 4. asar 头解析 ----------
console.log('\n[4] asar 头解析');
const ASAR_DIR = path.join(__dirname, '_asar_test');
fs.mkdirSync(ASAR_DIR, { recursive: true });
const header = JSON.stringify({ files: { dist: { files: { 'antigravity_i18n_core.js': { size: 10, offset: '0' } } } } });
const asarBuf = Buffer.alloc(8 + header.length);
asarBuf.writeUInt32LE(4, 0);
asarBuf.writeUInt32LE(header.length, 4);
asarBuf.write(header, 8, 'utf8');
const asarFile = path.join(ASAR_DIR, 'test.asar');
fs.writeFileSync(asarFile, asarBuf);
const junkFile = path.join(ASAR_DIR, 'junk.bin');
fs.writeFileSync(junkFile, Buffer.alloc(100, 0x41));

check('isValidAsar(正常 asar) = true', eng.isValidAsar(asarFile));
check('isHanhuaAsar(含核心模块) = true', eng.isHanhuaAsar(asarFile));
check('isValidAsar(垃圾文件) = false', !eng.isValidAsar(junkFile));
check('isHanhuaAsar(垃圾文件) = false', !eng.isHanhuaAsar(junkFile));
check('isValidAsar(不存在) = false', !eng.isValidAsar(path.join(ASAR_DIR, 'nope.asar')));

const bigHeader = JSON.stringify({ files: { a: { size: 1, offset: '0' } } });
const badBuf = Buffer.alloc(12);
badBuf.writeUInt32LE(4, 0);
badBuf.writeUInt32LE(999999999, 4);
badBuf.write(bigHeader, 8, 'utf8');
const badFile = path.join(ASAR_DIR, 'bad.asar');
fs.writeFileSync(badFile, badBuf);
check('isValidAsar(header 超限) = false', !eng.isValidAsar(badFile));

const crypto = require('crypto');
const testHashPath = path.join(ROOT, 'dicts', 'common.json');
const direct = crypto.createHash('sha256').update(fs.readFileSync(testHashPath)).digest('hex');
check('hashFile 流式结果与全量一致', eng.hashFile(testHashPath) === direct);

// ---------- 5. 字典替换完整性 ----------
console.log('\n[5] 字典替换完整性');
const injectedMapMatch = js.match(/new Map\(Object\.entries\((\{[\s\S]*?\})\)\);/);
let mapOk = false;
if (injectedMapMatch) {
  try { const parsed = JSON.parse(injectedMapMatch[1]); mapOk = parsed && typeof parsed === 'object' && Object.keys(parsed).length > 1000; } catch (e) {}
}
check('注入代码中字典 JSON 完整可解析', mapOk);

// ---------- 6. 汉化状态检测（升级路径防备份污染 + 入口同源对齐） ----------
console.log('\n[6] detectHanhuaState 内容级检测');
const STATE_DIR = path.join(__dirname, '_state_test');
const mk = (rel, content) => { const p = path.join(STATE_DIR, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); return p; };
const rmState = () => fs.rmSync(STATE_DIR, { recursive: true, force: true });
rmState();

// 官方原版
mk('dist/menu.js', '"use strict";\nconst menu = Menu.getApplicationMenu();');
mk('dist/tray.js', '"use strict";\ntray.setToolTip(app.getName());');
mk('dist/main.js', '"use strict";\napp.whenReady();');
check('官方原版 → clean', eng.detectHanhuaState(STATE_DIR) === 'clean');
check('resolveMainEntry 默认 dist/main.js', eng.resolveMainEntry(STATE_DIR).replace(/\\/g, '/').endsWith('dist/main.js'));

// 旧版多点补丁
fs.rmSync(path.join(STATE_DIR, 'dist', 'menu.js'));
mk('dist/menu.js', '// ==========================================\nAntigravity Native Menu Chinese Translation\nconst translations = {};\ntranslateMenu(menu.items);');
check('旧版 menu 补丁 → legacy', eng.detectHanhuaState(STATE_DIR) === 'legacy');
fs.rmSync(path.join(STATE_DIR, 'dist', 'menu.js'));
mk('dist/tray.js', '/* --- TRAY TRANSLATION START --- */\nconst t = {};\n/* --- TRAY TRANSLATION END --- */');
check('旧版 tray 补丁 → legacy', eng.detectHanhuaState(STATE_DIR) === 'legacy');
fs.rmSync(path.join(STATE_DIR, 'dist', 'tray.js'));
mk('dist/antigravity_i18n_core.js', '// core');
check('新版单点 → new', eng.detectHanhuaState(STATE_DIR) === 'new');

// 关键回归：非默认入口（package.json.main 指向 app/main.js）时，core 必须仍被识别为 new，
// 否则已汉化包被误判 clean → hash 对比会拿汉化包覆盖官方备份
rmState();
mk('package.json', JSON.stringify({ name: 'app', main: 'app/main.js' }));
mk('app/main.js', '"use strict";');
check('resolveMainEntry 读取 package.json.main', eng.resolveMainEntry(STATE_DIR).replace(/\\/g, '/').endsWith('app/main.js'));
check('非 dist 入口 + 无 core → clean', eng.detectHanhuaState(STATE_DIR) === 'clean');
mk('app/antigravity_i18n_core.js', '// core');
check('非 dist 入口 + core 在入口同目录 → new（防备份污染）', eng.detectHanhuaState(STATE_DIR) === 'new');
rmState();

// ---------- 7. 品牌模式字典 ----------
console.log('\n[7] 品牌模式（--brand-title）');
function loadDictForBrand(mode) {
  const p = path.join(__dirname, '_brand_' + mode + '.js');
  fs.writeFileSync(p, buildMod('loadDictionary', mode));
  const d = require(p).loadDictionary();
  fs.rmSync(p, { force: true });
  return d;
}
check('english 模式：Antigravity 键删除（保持英文原样）', loadDictForBrand('english')['Antigravity'] === undefined);
check('hidden 模式：Antigravity → 空串', loadDictForBrand('hidden')['Antigravity'] === '');
check('translated 模式：Antigravity → 反重力（选项 3 生效）', loadDictForBrand('translated')['Antigravity'] === '反重力');

// ---------- 8. 清理函数 ----------
console.log('\n[8] 清理函数');
const sigBlock = '/* --- ANTIGRAVITY CHINESE LOCALIZATION START --- */\ncode();\n/* --- ANTIGRAVITY CHINESE LOCALIZATION END --- */';
const cleaned = eng.cleanJsContent('a();\n' + sigBlock + '\nb();');
check('cleanJsContent 移除签名块', !cleaned.includes('ANTIGRAVITY CHINESE LOCALIZATION') && cleaned.includes('a();') && cleaned.includes('b();'), JSON.stringify(cleaned));

const menuInjected = 'const x = 1;\n// ==========================================\ntranslateMenu(menu.items);\n// ==========================================\nconst y = 2;\n';
const menuCleaned = eng.cleanMenuJsContent(menuInjected);
check('cleanMenuJsContent 移除补丁块', !menuCleaned.includes('translateMenu(menu.items);') && menuCleaned.includes('const x = 1;') && menuCleaned.includes('const y = 2;'), JSON.stringify(menuCleaned));
const menuTrap = '// ==========================================\nconst a = 1;\n// ==========================================\nconst b = 2;\ntranslateMenu(menu.items);\nconst c = 3;\n';
const menuTrapCleaned = eng.cleanMenuJsContent(menuTrap);
check('cleanMenuJsContent 定位最近起始标记', !menuTrapCleaned.includes('translateMenu(menu.items);') && menuTrapCleaned.includes('const a = 1;') && !menuTrapCleaned.includes('const b = 2;') && menuTrapCleaned.includes('const c = 3;'), JSON.stringify(menuTrapCleaned));
check('cleanMainJsContent 移除 require', eng.cleanMainJsContent("'use strict';\nrequire('./antigravity_i18n_core.js');\napp.run();") === "'use strict';\napp.run();");

fs.rmSync(ASAR_DIR, { recursive: true, force: true });
fs.rmSync(MOD_PATH, { force: true });

console.log('\n========== 结果: ' + pass + ' 通过, ' + fail + ' 失败 ==========');
process.exit(fail ? 1 : 0);

})().catch(e => { console.error('测试套件异常:', e); process.exit(1); });
