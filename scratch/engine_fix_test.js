// 引擎修复验证测试：语法 + 注入代码行为（含 Shadow DOM 翻译）+ asar 头解析 + 清理函数
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'localization_engine.js'), 'utf8');
// 把 DICTS_FOLDER 指向真实字典目录（模块在 scratch/ 下加载，__dirname 会错）
const DICTS_ABS = path.join(ROOT, 'dicts').replace(/\\/g, '\\\\');
const MOD_SRC = SRC
  .replace("const DICTS_FOLDER = 'dicts';", "const DICTS_FOLDER = '" + DICTS_ABS + "';")
  .replace("path.join(__dirname, DICTS_FOLDER)", "DICTS_FOLDER")
  .replace(/\nmain\(\);\s*$/, '\nmodule.exports = { generateJs, generateI18nCoreJs, loadDictionary, cleanJsContent, cleanMainJsContent, cleanMenuJsContent, cleanTrayJsContent, isHanhuaAsar, isValidAsar, normalizeText, detectHanhuaState, hashFile };\n');
const MOD_PATH = path.join(__dirname, '_engine_mod.js');
fs.writeFileSync(MOD_PATH, MOD_SRC);

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

const eng = require(MOD_PATH);

// ---------- 1. 生成代码语法 ----------
console.log('\n[1] 生成代码语法检查');
let js = eng.generateJs();
let jsOk = true;
try { new Function(js); } catch (e) { jsOk = false; console.log('  JS 语法错误: ' + e.message); }
check('generateJs 输出为合法 JS', jsOk);
check('输出不再含 REPLACEMENT_ENTRIES_PLACEHOLDER 占位符', !js.includes('REPLACEMENT_ENTRIES_PLACEHOLDER'));
check('输出含 DICT_PLACEHOLDER 已替换', js.includes('new Map(Object.entries('));

let core = eng.generateI18nCoreJs();
let coreOk = true;
try { new Function(core); } catch (e) { coreOk = false; console.log('  core 语法错误: ' + e.message); }
check('generateI18nCoreJs 输出为合法 JS', coreOk);
check('core 含注入代码常量', core.includes('RENDERER_INJECTION_CODE'));
check('core 不再含 REPLACEMENT_ENTRIES_PLACEHOLDER', !core.includes('REPLACEMENT_ENTRIES_PLACEHOLDER'));

// 体积对比：确认死代码移除生效（entriesJson 约为字典体积的两倍）
const dictJsonSize = JSON.stringify(eng.loadDictionary(), null, 4).length;
console.log('  (字典 JSON 约 ' + (dictJsonSize / 1024).toFixed(1) + ' KB，注入 JS ' + (js.length / 1024).toFixed(1) + ' KB)');

// ---------- 2. 注入代码在模拟浏览器环境中的行为 ----------
console.log('\n[2] 注入代码行为（mock DOM）');
class MockNode {
  constructor(type) { this.nodeType = type; this.childNodes = []; this.parentNode = null; this.parentElement = null; }
}
class MockText extends MockNode {
  constructor(v) { super(3); this.nodeValue = v; }
}
class MockElement extends MockNode {
  constructor(tag) {
    super(1);
    this.tagName = tag.toUpperCase();
    this.attributes = {};
    this.classList = { contains: () => false, add: () => {} };
    this.style = { setProperty: () => {} };
    this.shadowRoot = null;
    this.isContentEditable = false;
    this.host = null;
    this.dataset = {};
  }
  getAttribute(n) { return (n in this.attributes) ? this.attributes[n] : null; }
  setAttribute(n, v) { this.attributes[n] = v; }
  hasAttribute(n) { return n in this.attributes; }
  get textContent() {
    let s = '';
    for (const c of this.childNodes) {
      s += c.nodeType === 3 ? (c.nodeValue || '') : (c.textContent || '');
    }
    return s;
  }
  appendChild(c) { c.parentNode = this; c.parentElement = this; this.childNodes.push(c); return c; }
}
class MockShadowRoot extends MockNode {
  constructor(host) { super(11); this.host = host; }
  appendChild(c) { c.parentNode = this; this.childNodes.push(c); return c; }
}
MockElement.prototype.attachShadow = function () { const sr = new MockShadowRoot(this); this.shadowRoot = sr; return sr; };

const body = new MockElement('body');
const docEl = new MockElement('html');
const document = { body, documentElement: docEl, readyState: 'complete', addEventListener: () => {} };
const window = { addEventListener: () => {}, setTimeout: () => {} };
const Node = { TEXT_NODE: 3, ELEMENT_NODE: 1, DOCUMENT_FRAGMENT_NODE: 11 };
const Element = MockElement;
class MutationObserver { constructor(cb) { this.cb = cb; } observe() {} disconnect() {} }
const sandbox = { window, document, Node, Element, MutationObserver, console, setTimeout, WeakMap, Map, Set, Object, Array, String, RegExp, JSON, Math };
sandbox.window.window = sandbox.window;

// 普通文本 + shadow DOM 静态文本
const plainText = new MockText('Open');
body.appendChild(plainText);
const host = new MockElement('my-widget');
body.appendChild(host);
host.attachShadow();
const shadowText = new MockText('Settings');
host.shadowRoot.appendChild(shadowText);
// 禁区内的英文不应翻译
const codeZone = new MockElement('div');
codeZone.setAttribute('class', 'monaco-editor');
const codeText = new MockText('Open');
codeZone.appendChild(codeText);
body.appendChild(codeZone);

vm.runInNewContext(js, sandbox);

check('普通文本 Open → 打开', plainText.nodeValue === '打开', '实际: ' + JSON.stringify(plainText.nodeValue));
check('Shadow DOM 静态文本 Settings → 设置', shadowText.nodeValue === '设置', '实际: ' + JSON.stringify(shadowText.nodeValue));
check('禁区(monaco-editor)内文本不翻译', codeText.nodeValue === 'Open', '实际: ' + JSON.stringify(codeText.nodeValue));
check('引擎初始化后写入 DOM 防重标志', docEl.dataset.agHanhua === '1', '实际: ' + JSON.stringify(docEl.dataset.agHanhua));

// 跨 world 双引擎防重：模拟 preload world 已启动引擎（dataset 标志已写），主 world 引擎应直接退出
const lateText = new MockText('Save');
body.appendChild(lateText);
const sandbox2 = { ...sandbox, window: { addEventListener: () => {}, setTimeout: () => {} } };
vm.runInNewContext(js, sandbox2);
check('第二引擎检测到 DOM 标志后退出（新增文本不翻译）', lateText.nodeValue === 'Save', '实际: ' + JSON.stringify(lateText.nodeValue));

// 深层嵌套禁区（E3 修复验证）：文本与禁区容器之间隔 39 层普通 div，
// 禁区容器在回溯第 40 层 —— 旧 35 层限制会漏判误译，新 128 层应正确熔断
const docEl2 = new MockElement('html');
const body2 = new MockElement('body');
const document2 = { body: body2, documentElement: docEl2, readyState: 'complete', addEventListener: () => {} };
const sandbox3 = { window: { addEventListener: () => {}, setTimeout: () => {} }, document: document2, Node, Element: MockElement, MutationObserver, console, setTimeout, WeakMap, Map, Set, Object, Array, String, RegExp, JSON, Math };
const deepLeaf = new MockText('Save');
const deepInner = new MockElement('div');
deepInner.appendChild(deepLeaf);
let chain = deepInner;
for (let i = 0; i < 39; i++) { const d = new MockElement('div'); d.appendChild(chain); chain = d; }
const blockedContainer = new MockElement('div');
blockedContainer.setAttribute('class', 'monaco-editor');
blockedContainer.appendChild(chain);
body2.appendChild(blockedContainer);
vm.runInNewContext(js, sandbox3);
check('40 层深嵌套禁区不误译（回溯深度足够）', deepLeaf.nodeValue === 'Save', '实际: ' + JSON.stringify(deepLeaf.nodeValue));

// Inherits 正则修复（E6 轮发现的中英粘连 bug）：验证 "when working in this project" 后缀正确翻译
const docEl3 = new MockElement('html');
const body3 = new MockElement('body');
const document3 = { body: body3, documentElement: docEl3, readyState: 'complete', addEventListener: () => {} };
const sandbox4 = { window: { addEventListener: () => {}, setTimeout: () => {} }, document: document3, Node, Element: MockElement, MutationObserver, console, setTimeout, WeakMap, Map, Set, Object, Array, String, RegExp, JSON, Math };
const inheritsText = new MockText('Inherits your general settings when working in this project.');
body3.appendChild(inheritsText);
vm.runInNewContext(js, sandbox4);
check('Inherits 后缀 when working in this project 翻译正确', inheritsText.nodeValue === '继承您的通用设置（在此项目中工作时）', '实际: ' + JSON.stringify(inheritsText.nodeValue));

// 枚举带单字母后缀（Medium (M)）：枚举选项快捷键格式翻译
const docEl4 = new MockElement('html');
const body4 = new MockElement('body');
const document4 = { body: body4, documentElement: docEl4, readyState: 'complete', addEventListener: () => {} };
const sandbox5 = { window: { addEventListener: () => {}, setTimeout: () => {} }, document: document4, Node, Element: MockElement, MutationObserver, console, setTimeout, WeakMap, Map, Set, Object, Array, String, RegExp, JSON, Math };
const letterText = new MockText('Medium (M)');
body4.appendChild(letterText);
const lowText = new MockText('Low (L)');
body4.appendChild(lowText);
vm.runInNewContext(js, sandbox5);
check('枚举单字母后缀 Medium (M) → 中 (M)', letterText.nodeValue === '中 (M)', '实际: ' + JSON.stringify(letterText.nodeValue));
check('枚举单字母后缀 Low (L) → 低 (L)', lowText.nodeValue === '低 (L)', '实际: ' + JSON.stringify(lowText.nodeValue));

// 思考链误译防护（E8 修复验证）：
// 1. role="article" + aria-label="Agent response" 容器（Antigravity 智能体输出特征）内的文本不翻译
// 2. 无特征容器中的大段英文正文里的短单词（and/all/now）不翻译（流式输出阶段的防护）
// 3. 短容器中的枚举短词（High/Now）仍正常翻译（设置面板不受影响）
const docEl5 = new MockElement('html');
const body5 = new MockElement('body');
const document5 = { body: body5, documentElement: docEl5, readyState: 'complete', addEventListener: () => {} };
const sandbox6 = { window: { addEventListener: () => {}, setTimeout: () => {} }, document: document5, Node, Element: MockElement, MutationObserver, console, setTimeout, WeakMap, Map, Set, Object, Array, String, RegExp, JSON, Math };
const agentArticle = new MockElement('div');
agentArticle.setAttribute('role', 'article');
agentArticle.setAttribute('aria-label', 'Agent response');
const agentText = new MockText('Analyzing Uneven Distribution in the image layout');
agentArticle.appendChild(agentText);
body5.appendChild(agentArticle);
// 流式阶段：普通 P 容器（无任何禁区特征）内的大段英文 + 短词
const streamPara = new MockElement('p');
const streamText = new MockText('I am now focusing on the user observation about the uneven distribution of the label');
streamPara.appendChild(streamText);
const shortWordInPara = new MockText('Now');
streamPara.appendChild(shortWordInPara);
body5.appendChild(streamPara);
// 短容器枚举：父容器文本很短（设置面板枚举项）
const enumWrap = new MockElement('div');
const enumText = new MockText('Now');
enumWrap.appendChild(enumText);
body5.appendChild(enumWrap);
vm.runInNewContext(js, sandbox6);
check('role=article+Agent response 容器内不翻译', agentText.nodeValue === 'Analyzing Uneven Distribution in the image layout', '实际: ' + JSON.stringify(agentText.nodeValue));
check('大段英文正文中的短词 Now 不翻译', shortWordInPara.nodeValue === 'Now', '实际: ' + JSON.stringify(shortWordInPara.nodeValue));
check('短容器中的枚举词 Now 正常翻译', enumText.nodeValue === '现在', '实际: ' + JSON.stringify(enumText.nodeValue));

// 禁区状态词例外（E9 修复验证）：
// article 容器内 BUTTON 控件中的状态词（Explored/Working for 5s）应翻译；P 中的长正文不翻译
const docEl6b = new MockElement('html');
const body6b = new MockElement('body');
const document6b = { body: body6b, documentElement: docEl6b, readyState: 'complete', addEventListener: () => {} };
const sandbox6b = { window: { addEventListener: () => {}, setTimeout: () => {} }, document: document6b, Node, Element: MockElement, MutationObserver, console, setTimeout, WeakMap, Map, Set, Object, Array, String, RegExp, JSON, Math };
const agentBox = new MockElement('div');
agentBox.setAttribute('role', 'article');
agentBox.setAttribute('aria-label', 'Agent response');
const statusBtn = new MockElement('button');
const statusSpan = new MockElement('span');
const statusText = new MockText('Explored');
statusSpan.appendChild(statusText);
statusBtn.appendChild(statusSpan);
agentBox.appendChild(statusBtn);
const statusBtn2 = new MockElement('button');
const statusText2 = new MockText('Working for 5s');
statusBtn2.appendChild(statusText2);
agentBox.appendChild(statusBtn2);
const bodyPara = new MockElement('p');
const bodyText = new MockText('Analyzing the spatial relationships observed in the original label compared to the current output of the image');
bodyPara.appendChild(bodyText);
agentBox.appendChild(bodyPara);
body6b.appendChild(agentBox);
vm.runInNewContext(js, sandbox6b);
check('article 容器内 BUTTON 状态词 Explored → 已深度调研', statusText.nodeValue === '已深度调研', '实际: ' + JSON.stringify(statusText.nodeValue));
check('article 容器内 BUTTON 状态词 Working for 5s → 已工作 5 秒', statusText2.nodeValue === '已工作 5 秒', '实际: ' + JSON.stringify(statusText2.nodeValue));
check('article 容器内 P 长正文不翻译', bodyText.nodeValue === 'Analyzing the spatial relationships observed in the original label compared to the current output of the image', '实际: ' + JSON.stringify(bodyText.nodeValue));

// 执行摘要词例外（E10 修复验证）：
// article 容器被引擎标记 translate=no + notranslate 后，内部的动作摘要词（Ran/Analyzed/Edited）应仍翻译
const docEl7 = new MockElement('html');
const body7 = new MockElement('body');
const document7 = { body: body7, documentElement: docEl7, readyState: 'complete', addEventListener: () => {} };
const sandbox8 = { window: { addEventListener: () => {}, setTimeout: () => {} }, document: document7, Node, Element: MockElement, MutationObserver, console, setTimeout, WeakMap, Map, Set, Object, Array, String, RegExp, JSON, Math };
const agentWrap = new MockElement('div');
agentWrap.setAttribute('role', 'article');
agentWrap.setAttribute('aria-label', 'Agent response');
agentWrap.setAttribute('translate', 'no');
const agentWrapClass = agentWrap; // notranslate class via classList stub（mock classList.add 是 no-op，直接 setAttribute class）
agentWrapClass.setAttribute('class', 'notranslate');
// 步骤摘要：DIV(role=button) > DIV > SPAN
const stepBtn = new MockElement('div');
stepBtn.setAttribute('role', 'button');
const stepInner = new MockElement('div');
const stepSpan = new MockElement('span');
const stepText = new MockText('Ran');
stepSpan.appendChild(stepText);
stepInner.appendChild(stepSpan);
stepBtn.appendChild(stepInner);
agentWrap.appendChild(stepBtn);
const analyzedSpan = new MockElement('span');
const analyzedText = new MockText('Analyzed');
analyzedSpan.appendChild(analyzedText);
agentWrap.appendChild(analyzedSpan);
const editedSpan = new MockElement('span');
const editedText = new MockText('Edited');
editedSpan.appendChild(editedText);
agentWrap.appendChild(editedSpan);
// 思考链长句仍不翻译
const reasoningP = new MockElement('p');
const reasoningText = new MockText('Now I need to analyze the spacing between the Chinese characters and the alphanumeric values in the label to determine the optimal distribution');
reasoningP.appendChild(reasoningText);
agentWrap.appendChild(reasoningP);
// 带前缀的句子不受动作词例外影响（保留英文，不翻译）
const sentenceP = new MockElement('p');
const sentenceText = new MockText('Ran the analysis to verify the alignment consistency');
sentenceP.appendChild(sentenceText);
agentWrap.appendChild(sentenceP);
body7.appendChild(agentWrap);
vm.runInNewContext(js, sandbox8);
check('article+translate=no 内 摘要词 Ran → 已执行命令', stepText.nodeValue === '已执行命令', '实际: ' + JSON.stringify(stepText.nodeValue));
check('article+translate=no 内 摘要词 Analyzed → 已完成分析', analyzedText.nodeValue === '已完成分析', '实际: ' + JSON.stringify(analyzedText.nodeValue));
check('article+translate=no 内 摘要词 Edited → 已修改文件', editedText.nodeValue === '已修改文件', '实际: ' + JSON.stringify(editedText.nodeValue));
check('思考链长句(article 内)仍不翻译', reasoningText.nodeValue === 'Now I need to analyze the spacing between the Chinese characters and the alphanumeric values in the label to determine the optimal distribution', '实际: ' + JSON.stringify(reasoningText.nodeValue));
check('带后缀的动作句子 Ran the analysis... 不翻译', sentenceText.nodeValue === 'Ran the analysis to verify the alignment consistency', '实际: ' + JSON.stringify(sentenceText.nodeValue));

// 单一数据源验证：Learn more about 的 preset 译文来自字典（Turbo Mode → 极速模式 (Turbo Mode)）
const docEl6 = new MockElement('html');
const body6 = new MockElement('body');
const document6 = { body: body6, documentElement: docEl6, readyState: 'complete', addEventListener: () => {} };
const sandbox7 = { window: { addEventListener: () => {}, setTimeout: () => {} }, document: document6, Node, Element: MockElement, MutationObserver, console, setTimeout, WeakMap, Map, Set, Object, Array, String, RegExp, JSON, Math };
const turboText = new MockText('Learn more about Turbo Mode');
body6.appendChild(turboText);
vm.runInNewContext(js, sandbox7);
check('Learn more about Turbo Mode → 了解更多关于 极速模式 (Turbo Mode)（走字典）', turboText.nodeValue === '了解更多关于 极速模式 (Turbo Mode)', '实际: ' + JSON.stringify(turboText.nodeValue));

// core 模板内容检查（冲突修复）
check('core 含 showErrorBox hook', core.includes('showErrorBox'));
check('core 含 updateActions 同步', core.includes('syncUpdaterActions') && core.includes("require('./updater')"));
check('core 含 Notification hook', core.includes('HanhuaNotification') && core.includes('electron.Notification'));
check('渲染引擎 nowrap 注入仅限控件（不再强制 width）', !js.includes("min-width', 'fit-content"));

// ---------- 3. asar 头解析 ----------
console.log('\n[3] asar 头解析');
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

// 小 header + 超大 header 边界
const bigHeader = JSON.stringify({ files: { a: { size: 1, offset: '0' } } });
const badBuf = Buffer.alloc(12);
badBuf.writeUInt32LE(4, 0);
badBuf.writeUInt32LE(999999999, 4);
badBuf.write(bigHeader, 8, 'utf8');
const badFile = path.join(ASAR_DIR, 'bad.asar');
fs.writeFileSync(badFile, badBuf);
check('isValidAsar(header 超限) = false', !eng.isValidAsar(badFile));

// hashFile 流式结果与一次性计算一致
const crypto = require('crypto');
const testHashPath = path.join(ROOT, 'dicts', 'common.json');
const direct = crypto.createHash('sha256').update(fs.readFileSync(testHashPath)).digest('hex');
check('hashFile 流式结果与全量一致', eng.hashFile(testHashPath) === direct);

// ---------- 4. 清理函数 ----------
console.log('\n[4] 清理函数');
const sigBlock = '/* --- ANTIGRAVITY CHINESE LOCALIZATION START --- */\ncode();\n/* --- ANTIGRAVITY CHINESE LOCALIZATION END --- */';
const cleaned = eng.cleanJsContent('a();\n' + sigBlock + '\nb();');
check('cleanJsContent 移除签名块', !cleaned.includes('ANTIGRAVITY CHINESE LOCALIZATION') && cleaned.includes('a();') && cleaned.includes('b();'), JSON.stringify(cleaned));

const menuInjected = 'const x = 1;\n// ==========================================\ntranslateMenu(menu.items);\n// ==========================================\nconst y = 2;\n';
const menuCleaned = eng.cleanMenuJsContent(menuInjected);
check('cleanMenuJsContent 移除补丁块', !menuCleaned.includes('translateMenu(menu.items);') && menuCleaned.includes('const x = 1;') && menuCleaned.includes('const y = 2;'), JSON.stringify(menuCleaned));
// 陷阱：官方代码里 endMark 之前有两处同风格注释，应删离 endMark 最近的那对，保留官方代码
const menuTrap = '// ==========================================\nconst a = 1;\n// ==========================================\nconst b = 2;\ntranslateMenu(menu.items);\nconst c = 3;\n';
const menuTrapCleaned = eng.cleanMenuJsContent(menuTrap);
check('cleanMenuJsContent 定位最近起始标记', !menuTrapCleaned.includes('translateMenu(menu.items);') && menuTrapCleaned.includes('const a = 1;') && !menuTrapCleaned.includes('const b = 2;') && menuTrapCleaned.includes('const c = 3;'), JSON.stringify(menuTrapCleaned));

check('cleanMainJsContent 移除 require', eng.cleanMainJsContent("'use strict';\nrequire('./antigravity_i18n_core.js');\napp.run();") === "'use strict';\napp.run();");

// ---------- 5. 字典替换完整性（B2 防护验证） ----------
console.log('\n[5] 字典替换完整性');
const injectedMapMatch = js.match(/new Map\(Object\.entries\((\{[\s\S]*?\})\)\);/);
let mapOk = false;
if (injectedMapMatch) {
  try { const parsed = JSON.parse(injectedMapMatch[1]); mapOk = parsed && typeof parsed === 'object' && Object.keys(parsed).length > 1000; } catch (e) {}
}
check('注入代码中字典 JSON 完整可解析', mapOk);

// ---------- 6. 汉化状态检测（升级路径防备份污染） ----------
console.log('\n[6] detectHanhuaState 内容级检测');
const STATE_DIR = path.join(__dirname, '_state_test');
const mk = (rel, content) => { const p = path.join(STATE_DIR, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); return p; };
fs.mkdirSync(path.join(STATE_DIR, 'dist'), { recursive: true });

// 官方原版
fs.rmSync(STATE_DIR, { recursive: true, force: true });
fs.mkdirSync(path.join(STATE_DIR, 'dist'), { recursive: true });
mk('dist/menu.js', '"use strict";\nconst menu = Menu.getApplicationMenu();');
mk('dist/tray.js', '"use strict";\ntray.setToolTip(app.getName());');
mk('dist/main.js', '"use strict";\napp.whenReady();');
check('官方原版 → clean', eng.detectHanhuaState(STATE_DIR) === 'clean');

// 旧版多点补丁
fs.rmSync(path.join(STATE_DIR, 'dist', 'menu.js'));
mk('dist/menu.js', '// ==========================================\nAntigravity Native Menu Chinese Translation\nconst translations = {};\ntranslateMenu(menu.items);');
check('旧版 menu 补丁 → legacy', eng.detectHanhuaState(STATE_DIR) === 'legacy');

// 旧版 tray 补丁
fs.rmSync(path.join(STATE_DIR, 'dist', 'menu.js'));
mk('dist/tray.js', '/* --- TRAY TRANSLATION START --- */\nconst t = {};\n/* --- TRAY TRANSLATION END --- */');
check('旧版 tray 补丁 → legacy', eng.detectHanhuaState(STATE_DIR) === 'legacy');

// 新版单点
fs.rmSync(path.join(STATE_DIR, 'dist', 'tray.js'));
mk('dist/antigravity_i18n_core.js', '// core');
check('新版单点 → new', eng.detectHanhuaState(STATE_DIR) === 'new');

fs.rmSync(STATE_DIR, { recursive: true, force: true });
fs.rmSync(ASAR_DIR, { recursive: true, force: true });
fs.rmSync(MOD_PATH, { force: true });

console.log('\n========== 结果: ' + pass + ' 通过, ' + fail + ' 失败 ==========');
process.exit(fail ? 1 : 0);
