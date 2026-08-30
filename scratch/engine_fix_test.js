// 引擎回归测试：模板转义扫描 + 语法 + jsdom 真实 DOM 行为 + 主进程 core 行为 + asar/清理/状态检测/品牌模式
// 运行：node scratch/engine_fix_test.js  （依赖 devDependencies: jsdom）
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'localization_engine.js'), 'utf8');
const DICTS_ABS = path.join(ROOT, 'dicts').replace(/\\/g, '\\\\');
const SRCDIR_ABS = path.join(ROOT, 'src').replace(/\\/g, '\\\\');

// 追加式导出：在源码尾部扩展 module.exports，不依赖 main() 的调用形态（正则重写曾因
// main() 改为 if(require.main) 包裹而整体失效，教训：测试挂钩必须与源码形态解耦）
function buildMod(extraExports, brandMode) {
  let mod = SRC
    .replace("const DICTS_FOLDER = 'dicts';", "const DICTS_FOLDER = '" + DICTS_ABS + "';")
    .replace("path.join(__dirname, DICTS_FOLDER)", "DICTS_FOLDER")
    .replace("path.join(__dirname, 'src')", "'" + SRCDIR_ABS + "'");
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

// ---------- 0. 独立源文件结构完整性 ----------
console.log('\n[0] 独立源文件结构完整性');
// 注入代码已从模板字面量迁移为独立源文件（正规 JS，天然无模板转义受损问题）。
// 此处校验签名标记与占位符完整性，防止源文件被误改导致生成产物缺损。
const SRC_DIR = path.join(ROOT, 'src');
const rendererSrc = fs.readFileSync(path.join(SRC_DIR, 'renderer_engine.src.js'), 'utf8');
const coreSrc = fs.readFileSync(path.join(SRC_DIR, 'main_core.src.js'), 'utf8');
const kernelSrc = fs.readFileSync(path.join(SRC_DIR, 'translate_kernel.src.js'), 'utf8');
check('渲染层源文件含起止签名标记', rendererSrc.includes('ANTIGRAVITY CHINESE LOCALIZATION START') && rendererSrc.includes('ANTIGRAVITY CHINESE LOCALIZATION END'));
check('渲染层源文件恰含一个内核注入标记且无字典占位符', (rendererSrc.match(/\/\/ __AG_KERNEL__/g) || []).length === 1 && !rendererSrc.includes('DICT_PLACEHOLDER'));
check('主进程源文件恰含一个内核注入标记与一个渲染层注入码占位符', (coreSrc.match(/\/\/ __AG_KERNEL__/g) || []).length === 1 && (coreSrc.match(/RENDERER_CODE_PLACEHOLDER/g) || []).length === 1 && !coreSrc.includes('DICT_PLACEHOLDER'));
check('内核源文件恰含一个字典占位符与一个版本占位符', (kernelSrc.match(/DICT_PLACEHOLDER/g) || []).length === 1 && (kernelSrc.match(/__AG_I18N_VERSION__/g) || []).length === 1);
check('源文件中不存在退格符（\\b 误写回归）', !rendererSrc.includes(String.fromCharCode(8)) && !coreSrc.includes(String.fromCharCode(8)) && !kernelSrc.includes(String.fromCharCode(8)));
check('生成代码中 \b 不是退格符（动作白名单）', !js.includes(String.fromCharCode(8)));
check('生成代码已注入引擎版本号', js.includes('window.__AG_I18N_VERSION__') && !js.includes('__AG_I18N_VERSION__\''));

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
async function runEngine(html, engineJs) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
  const doc = dom.window.document;
  if (doc.readyState === 'loading') {
    await new Promise(r => doc.addEventListener('DOMContentLoaded', () => setTimeout(r, 0), { once: true }));
  }
  dom.window.eval(engineJs || js);
  return dom;
}

// 2.1 基础翻译 + 三级边界（禁区/流式区/交互控件）
{
  const dom = await runEngine('<main><div id="plain">Open</div><button id="btn">Save</button><div class="artifact-preview"><div class="artifact-code"><div class="monaco-editor" data-mode-id="javascript"><div class="lines-content"><div class="view-line"><span id="artCode">replace</span></div></div><div class="glyph-margin"><button id="artBtn" title="Add inline comment">+</button></div></div></div></div><div class="monaco-editor" data-mode-id="javascript"><div class="lines-content"><div class="view-line"><span id="tokenReplace">replace</span><span id="tokenOpen">open</span></div></div><div class="view-lines"><span id="code">Open</span><button id="editorBtn">Open</button></div><div class="glyph-margin"><button id="glyphBtn" title="Add inline comment">+</button><div id="glyphTip">Add inline comment</div></div></div><div class="prose"><span id="prose">Settings</span><button id="proseBtn">Save</button></div><div translate="no"><span id="tno">Open</span></div><svg><text id="svgtext">Open</text></svg><style id="instyle">.active { color: red }</style><p id="longp">Analyzing the spatial relationships observed in the original label compared to the current output</p><div class="editor-pane"><div id="err1">View could not be opened</div><div id="err2">Artifact not found</div></div><div class="step-item"><div id="tip">Open Diff</div></div></main>');
  // $ 接收 CSS 选择器（'#id'），用 querySelector；此前误用 getElementById(id) 却传 '#id'，导致所有元素查不到
  const $ = sel => dom.window.document.querySelector(sel);
  check('普通文本 Open → 打开', $('#plain').textContent === '打开', JSON.stringify($('#plain').textContent));
  check('button 控件 Save → 保存', $('#btn').textContent === '保存', JSON.stringify($('#btn').textContent));
  check('交付件内部代码 replace 坚决熔断不篡改', $('#artCode').textContent === 'replace', JSON.stringify($('#artCode').textContent));
  check('交付件边距槽加号 title Add inline comment → 添加行内评论', $('#artBtn').getAttribute('title') === '添加行内评论', JSON.stringify($('#artBtn').getAttribute('title')));
  check('代码行 token replace 绝不被篡改为替换', $('#tokenReplace').textContent === 'replace', JSON.stringify($('#tokenReplace').textContent));
  check('代码行 token open 绝不被篡改为打开', $('#tokenOpen').textContent === 'open', JSON.stringify($('#tokenOpen').textContent));
  check('view-lines 代码禁区不翻译', $('#code').textContent === 'Open', JSON.stringify($('#code').textContent));
  check('view-lines 内部 button 绝不开口子', $('#editorBtn').textContent === 'Open', JSON.stringify($('#editorBtn').textContent));
  check('data-mode-id 外壳下边距槽加号 title Add inline comment → 添加行内评论', $('#glyphBtn').getAttribute('title') === '添加行内评论', JSON.stringify($('#glyphBtn').getAttribute('title')));
  check('边距槽加号气泡 Add inline comment → 添加行内评论', $('#glyphTip').textContent === '添加行内评论', JSON.stringify($('#glyphTip').textContent));
  check('AI prose 流式区不翻译', $('#prose').textContent === 'Settings', JSON.stringify($('#prose').textContent));
  check('AI prose 内部 HTML button 绝不开口子', $('#proseBtn').textContent === 'Save', JSON.stringify($('#proseBtn').textContent));
  check('[translate=no] 容器不翻译', $('#tno').textContent === 'Open', JSON.stringify($('#tno').textContent));
  check('SVG <text> 不翻译（标签口齐）', $('#svgtext').textContent === 'Open', JSON.stringify($('#svgtext').textContent));
  check('body 内联 <style> 内容不被篡改', $('#instyle').textContent.includes('.active { color: red }'), JSON.stringify($('#instyle').textContent));
  check('字典未命中的长句保持原样', $('#longp').textContent.includes('Analyzing the spatial'), JSON.stringify($('#longp').textContent));
  check('空状态 View could not be opened → 无法打开视图', $('#err1').textContent === '无法打开视图', JSON.stringify($('#err1').textContent));
  check('空状态 Artifact not found → 未找到交付件', $('#err2').textContent === '未找到交付件', JSON.stringify($('#err2').textContent));
  check('常规UI气泡 Open Diff → 打开差异对比', $('#tip').textContent === '打开差异对比', JSON.stringify($('#tip').textContent));
  // 测试原生 setter 0 毫秒透明拦截
  const dynamicBtn = dom.window.document.createElement('button');
  dynamicBtn.title = 'Add inline comment';
  check('原生 HTMLElement.prototype.title 动态赋值瞬间拦截', dynamicBtn.title === '添加行内评论', JSON.stringify(dynamicBtn.title));
  const dynamicInput = dom.window.document.createElement('input');
  dynamicInput.setAttribute('placeholder', 'Add inline comment');
  check('原生 setAttribute 动态赋值瞬间拦截', dynamicInput.getAttribute('placeholder') === '添加行内评论', JSON.stringify(dynamicInput.getAttribute('placeholder')));
  dom.window.close();
}

// 2.2 动态句式与唯一机制边界（动词步骤摘要的引擎整句支路已移除，字典+分片计数是唯一机制）
{
  const cases = [
    // 单节点整句不再由引擎翻译（避免与字典双重机制；官方 UI 实际按节点拆分渲染）
    ['Explored 2 files', 'Explored 2 files'],
    ['Analyzed 3 files', 'Analyzed 3 files'],
    ['Edited 1 file', 'Edited 1 file'],
    ['Created 2 folders', 'Created 2 folders'],
    ['Deleted 1 file', 'Deleted 1 file'],
    ['Searching knowledge', 'Searching knowledge'],
    // 引擎独占的动态支路（字典无法以精确键覆盖的模板形态）
    ['All scheduled tasks run as gemini-3-pro.', '所有计划任务均以 gemini-3-pro 模型运行。'],
    ['A scheduled task with ID t1 already exists.', 'ID 为 t1 的任务已存在。'],
    ['+ Skill', '+ 技能'],
    ['Skill (S)', '技能 (S)'],
    ['Timed 3 seconds', '计时 3 秒'],
    ['Status: Fired', '状态：已触发'],
    ['The command exited with code 0. Output: True', '命令已退出，退出码 0。输出：True'],
    ['Verify app.asar extraction finished', 'Verify app.asar extraction 已完成'],
    ['Stage and commit all changes', '暂存并提交所有更改'],
    ['Push', '推送'],
    ['No remote configured', '未配置远程仓库'],
    ['Include unstaged changes', '包含未暂存的更改'],
    ['Describe your changes, or leave empty to auto-generate', '描述您的更改，或留空以自动生成'],
    ['Commit 8 file changes to master', '提交 8 个文件更改至 master'],
    ['1,000 files, 2 folders', '1,000 个文件、2 个文件夹'],
    // 共享助手回归：时间段换算（translateTimeSpan）
    ['Refreshes in 2 hours 30 minutes', '2 小时 30 分钟后刷新'],
    ['Refreshes in 1 day, 2 hours', '1 天 2 小时后刷新'],
    ['You have used some of your weekly limit, it will fully refresh in 3 hours.', '您已使用了部分每周限制，将在 3 小时后完全刷新。'],
    // 共享助手回归：动词 + 计数列表（verbCountPhrase，含 Working 运行态）
    ['Ran 3 files Working...', '正在执行 3 个文件 正在处理...'],
    ['Checked 2 tasks', '已检查 2 个任务'],
    ['Killed 2 tasks Working...', '正在终止 2 个任务...'],
    // 共享助手回归：相对时间单位（agoUnitCn，紧凑与完整两形态）
    ['5mo', '5个月前'],
    ['2 weeks ago', '2 周前'],
    ['1 minute ago', '1 分钟前'],
  ];
  const html = cases.map((c, i) => '<div id="dyn' + i + '">' + c[0].replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</div>').join('');
  const dom = await runEngine(html);
  cases.forEach((c, i) => {
    const got = dom.window.document.getElementById('dyn' + i).textContent;
    check('动态句式 "' + c[0] + '" → "' + c[1] + '"', got === c[1], '实际: ' + JSON.stringify(got));
  });
  // 唯一机制回归（官方实际渲染形态）：动作词节点走字典、计数节点走分片计数
  const dom2 = await runEngine('<span id="v1">Explored </span><span id="v2">12 files</span>');
  check('拆分节点:动作词走字典', dom2.window.document.getElementById('v1').textContent === '已探索 ', JSON.stringify(dom2.window.document.getElementById('v1').textContent));
  check('拆分节点:计数走分片', dom2.window.document.getElementById('v2').textContent === '12 个文件', JSON.stringify(dom2.window.document.getElementById('v2').textContent));
  // 白名单 \b：仅保证步骤摘要不被误判为代码（整句支路已删，文本原样保留并进入漏译采集）
  const dom3 = await runEngine('<div id="wl">Explored foo.bar()</div>');
  const wl = dom3.window.document.getElementById('wl').textContent;
  check('白名单 \\b：含括号摘要不误判为代码（原样保留）', wl === 'Explored foo.bar()', '实际: ' + JSON.stringify(wl));
  dom.window.close(); dom2.window.close(); dom3.window.close();
}

// 2.3 属性翻译（常规 UI 深层控件属性全覆盖；input placeholder/title 全面汉化；代码禁区深层属性 100% 坚决熔断）
{
  const dom = await runEngine('<div id="attrroot"></div>');
  const doc = dom.window.document;
  const wrap = doc.createElement('div');
  wrap.setAttribute('title', 'Open');
  wrap.innerHTML = '<input id="ip" placeholder="Settings" title="Settings"><button id="btnSettings" title="Settings">S</button><button id="bd" aria-label="Delete">X</button><div class="glyph-margin"><div id="gm" title="Add inline comment">+</div></div><div class="lines-content"><div id="codeAttr" title="Add inline comment">code</div></div>';
  doc.getElementById('attrroot').appendChild(wrap);
  await tick();
  check('子树根 title 翻译', wrap.getAttribute('title') === '打开', JSON.stringify(wrap.getAttribute('title')));
  check('输入框 input 的 placeholder 属性被正确汉化', doc.getElementById('ip').getAttribute('placeholder') === '设置', JSON.stringify(doc.getElementById('ip').getAttribute('placeholder')));
  check('输入框 input 的 title 属性被正确汉化', doc.getElementById('ip').getAttribute('title') === '设置', JSON.stringify(doc.getElementById('ip').getAttribute('title')));
  check('深层常规 UI title 翻译', doc.getElementById('btnSettings').getAttribute('title') === '设置', JSON.stringify(doc.getElementById('btnSettings').getAttribute('title')));
  check('深层常规 UI aria-label 翻译', doc.getElementById('bd').getAttribute('aria-label') === '删除', JSON.stringify(doc.getElementById('bd').getAttribute('aria-label')));
  check('边距槽加号 title Add inline comment 翻译', doc.getElementById('gm').getAttribute('title') === '添加行内评论', JSON.stringify(doc.getElementById('gm').getAttribute('title')));
  check('代码禁区 lines-content 内部属性绝不开口子', doc.getElementById('codeAttr').getAttribute('title') === 'Add inline comment', JSON.stringify(doc.getElementById('codeAttr').getAttribute('title')));
  dom.window.close();
}

// 2.4 Shadow DOM：常规 UI 宿主 shadow 内容递归翻译；终端与代码宿主坚决阻断
{
  const dom = await runEngine('<div id="sh-root"></div>');
  const doc = dom.window.document;
  // 深层常规宿主：递归展开翻译
  const outer = doc.createElement('div');
  const host = doc.createElement('ag-widget');
  host.attachShadow({ mode: 'open' });
  const s = doc.createElement('span');
  s.textContent = 'Settings';
  host.shadowRoot.appendChild(s);
  outer.appendChild(host);
  doc.getElementById('sh-root').appendChild(outer);
  await tick();
  check('深层常规宿主 shadow 内容被递归翻译', s.textContent === '设置', JSON.stringify(s.textContent));

  // 终端与代码宿主 shadow：坚决不穿透
  const xtermHost = doc.createElement('div');
  xtermHost.className = 'xterm-screen';
  xtermHost.attachShadow({ mode: 'open' });
  const xs = doc.createElement('span');
  xs.textContent = 'Settings';
  xtermHost.shadowRoot.appendChild(xs);
  outer.appendChild(xtermHost);
  await tick();
  check('终端代码宿主 shadow 内容坚决不翻译', xs.textContent === 'Settings', JSON.stringify(xs.textContent));

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

// 2.5 批量插入走分片队列（250 节点超过 200 上限通过即时兜底全量翻译，绝不漏译）
{
  const dom = await runEngine('<div id="sw"></div>');
  const cont = dom.window.document.getElementById('sw');
  for (let i = 0; i < 250; i++) {
    const d = dom.window.document.createElement('div');
    d.textContent = 'Open';
    cont.appendChild(d);
  }
  await tick(100);
  const texts = Array.from(cont.children).map(c => c.textContent);
  check('突发批量插入 250 节点（超过 200 队列上限）通过兜底机制全量翻译', texts.every(t => t === '打开'), '未翻译 ' + texts.filter(t => t !== '打开').length + ' 个');
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

// 2.7 深层嵌套禁区：40 层普通 div 在 view-lines 容器内仍坚决熔断
{
  let html = '<div class="monaco-editor"><div class="view-lines">';
  for (let i = 0; i < 40; i++) html += '<div>';
  html += '<span id="deep">Save</span>';
  for (let i = 0; i < 40; i++) html += '</div>';
  html += '</div></div>';
  const dom = await runEngine(html);
  check('40 层深嵌套禁区不误译', dom.window.document.getElementById('deep').textContent === 'Save', JSON.stringify(dom.window.document.getElementById('deep').textContent));
  dom.window.close();
}

// 2.8 删除确认句式（精确区分 project group / workspace / project / 普通 target）
{
  const cases = [
    ['Are you sure you want to delete this project group backend?', '您确定要删除此项目分组 backend 吗？'],
    ['Are you sure you want to delete the project my-app?', '您确定要删除该项目 my-app 吗？'],
    ['Are you sure you want to delete this workspace core?', '您确定要删除此工作区 core 吗？'],
    ['Are you sure you want to delete this rule?', '您确定要删除此 rule 吗？'],
    ['Are you sure you want to delete config.json?', '您确定要删除 config.json 吗？'],
    // 裸类型句式回归：结尾 "?" 不得被吞进名称捕获
    ['Are you sure you want to delete this project?', '您确定要删除此项目吗？'],
    ['Are you sure you want to delete the project?', '您确定要删除该项目吗？'],
    ['Are you sure you want to delete project?', '您确定要删除项目吗？'],
    ['Are you sure you want to delete this workspace?', '确定要删除此工作区吗？']
  ];
  const html = cases.map((c, i) => '<div id="del' + i + '">' + c[0] + '</div>').join('');
  const dom = await runEngine(html);
  cases.forEach((c, i) => {
    const got = dom.window.document.getElementById('del' + i).textContent;
    check('删除确认句式 "' + c[0] + '"', got === c[1], '实际: ' + JSON.stringify(got));
  });
  dom.window.close();
}

// 2.9 AI 长句/段落安全门禁（宽泛正则不得误篡改英文长句段落）
{
  const longProseCases = [
    'Updated the configuration file according to the user instructions and restarted the server.',
    'Ran the deployment script across multiple environments to verify the build output.',
    'Checked all unit tests and integration tests before submitting the pull request for review.',
    'Killed all background processes that were holding onto the database lock unexpectedly.',
    'Run the provided test suite using npm test to confirm that all 100 cases pass without error.',
    // 门禁完整性补充：其余宽泛句式同样不得改写长句
    'Searched the workspace for all references to the deprecated API before making changes.',
    'A comprehensive analysis of the request across all files finished',
    'Checked task 42: verify all tests pass before merging the feature branch.',
    'Status: all systems operational across the entire deployment fleet',
    'Learn more about whether the agent should run tools in your project workspace'
  ];
  const html = longProseCases.map((c, i) => '<p id="lp' + i + '">' + c + '</p>').join('');
  const dom = await runEngine(html);
  longProseCases.forEach((c, i) => {
    const got = dom.window.document.getElementById('lp' + i).textContent;
    check('AI 长句安全门禁防误篡改 #' + i, got === c, '实际: ' + JSON.stringify(got));
  });
  dom.window.close();
}

// 2.10 document.title 拦截与分段翻译
{
  const dom = await runEngine('<html><head><title>Antigravity</title></head><body></body></html>');
  const doc = dom.window.document;
  doc.title = 'New chat — Antigravity';
  check('document.title 复合标题拆分翻译 (New chat — Antigravity)', doc.title === '新会话 — Antigravity', JSON.stringify(doc.title));
  doc.title = 'Settings - Antigravity';
  check('document.title 复合标题拆分翻译 (Settings - Antigravity)', doc.title === '设置 - Antigravity', JSON.stringify(doc.title));
  // 观察器路径：框架绕过 setter 直接改 <title> 文本（主 world 场景），TITLE 节点分支必须兜住
  doc.querySelector('title').textContent = 'Settings - Antigravity';
  await tick();
  check('document.title（<title> 文本变更经 observer 翻译）', doc.title === '设置 - Antigravity', JSON.stringify(doc.title));
  dom.window.close();
}

// 2.11 用户内容整树隔离（用户消息容器与历史会话行）
{
  const dom = await runEngine('<div id="u"><div data-message-author="user"><p id="ua">Build failing</p><button id="ub">Retry</button></div><div data-turn-role="user"><p id="ut">Please fix the bug</p></div><div data-testid="conversation-item"><span id="ci">My Project Alpha</span><span id="ct">2 hours ago</span></div><div id="ok">Save</div></div>');
  const doc = dom.window.document;
  check('用户消息正文不翻译', doc.getElementById('ua').textContent === 'Build failing', JSON.stringify(doc.getElementById('ua').textContent));
  check('用户消息容器内操作按钮正常翻译', doc.getElementById('ub').textContent === '重试', JSON.stringify(doc.getElementById('ub').textContent));
  check('data-turn-role=user 内容不翻译', doc.getElementById('ut').textContent === 'Please fix the bug', JSON.stringify(doc.getElementById('ut').textContent));
  check('会话行用户标题不翻译', doc.getElementById('ci').textContent === 'My Project Alpha', JSON.stringify(doc.getElementById('ci').textContent));
  check('禁区外常规 UI 不受影响', doc.getElementById('ok').textContent === '保存', JSON.stringify(doc.getElementById('ok').textContent));
  dom.window.close();
}

// 2.12 空格保真：首尾多空格不塌缩
{
  const dom = await runEngine('<div id="ws">  Open   </div>');
  check('多空格缩进保真', dom.window.document.getElementById('ws').textContent === '  打开   ', JSON.stringify(dom.window.document.getElementById('ws').textContent));
  dom.window.close();
}

// 2.13 真实 DOM 实证回归：conversation-row-sidebar 行内 truncate 标题隔离（只挡标题，行内时间仍翻译）
{
  const dom = await runEngine('<div data-testid="conversation-list-sidebar"><div data-testid="conversation-row-sidebar"><div><span id="ct" class="truncate">My English Title</span></div><span id="ctime">3 hours ago</span></div></div><div id="ok">Save</div>');
  const d = dom.window.document;
  check('conversation-row-sidebar 内 truncate 标题不翻译', d.getElementById('ct').textContent === 'My English Title', JSON.stringify(d.getElementById('ct').textContent));
  check('行内时间元数据仍翻译', d.getElementById('ctime').textContent === '3 小时前', JSON.stringify(d.getElementById('ctime').textContent));
  check('常规 UI 不受影响', d.getElementById('ok').textContent === '保存', JSON.stringify(d.getElementById('ok').textContent));
  dom.window.close();
}

// 2.14 identity 键（译值=原文）不进漏译采集池
{
  const dom = await runEngine('<div id="id1">Gemini 3.7 Flash</div><div id="id2">Open</div>');
  const d = dom.window.document;
  check('identity 键保持原样', d.getElementById('id1').textContent === 'Gemini 3.7 Flash', JSON.stringify(d.getElementById('id1').textContent));
  await tick();
  const dump = typeof d.defaultView.__AG_DUMP_MISSING__ === 'function' ? d.defaultView.__AG_DUMP_MISSING__() : [];
  check('identity 键不进漏译池', !dump.includes('Gemini 3.7 Flash'), JSON.stringify(dump.slice(0, 5)));
  dom.window.close();
}

// 2.15 属性漏译采集：未命中的英文属性进入漏译池，可翻译属性不视为漏译
{
  const dom = await runEngine('<div id="am"><button id="b1" title="Translate Me Please">X</button><button id="b2" aria-label="Open">Y</button></div>');
  const d = dom.window.document;
  check('可翻译 aria-label 正常汉化', d.getElementById('b2').getAttribute('aria-label') === '打开', JSON.stringify(d.getElementById('b2').getAttribute('aria-label')));
  await tick();
  const dump = typeof d.defaultView.__AG_DUMP_MISSING__ === 'function' ? d.defaultView.__AG_DUMP_MISSING__() : [];
  check('未命中英文 title 属性进漏译池', dump.includes('Translate Me Please'), JSON.stringify(dump.slice(0, 8)));
  check('已命中字典的属性不进漏译池', !dump.includes('Open'), JSON.stringify(dump.slice(0, 8)));
  dom.window.close();
}

// 2.16 禁区零开口：禁区容器内输入框的属性坚决不翻译（静态/动态/属性赋值/新增节点全路径），宿主 UI 输入框不受影响
{
  const html = '<div id="zr">'
    + '<div class="prose"><input id="zin1" placeholder="Settings" title="Delete" aria-label="Add inline comment"></div>'
    + '<div translate="no"><input id="zin2" placeholder="Open"></div>'
    + '<input id="zok" placeholder="Settings">'
    + '</div>';
  const dom = await runEngine(html);
  const d = dom.window.document;
  // 静态扫描：禁区容器内的输入框属性保持英文
  check('禁区(.prose)内输入框 placeholder 不翻译', d.getElementById('zin1').getAttribute('placeholder') === 'Settings', JSON.stringify(d.getElementById('zin1').getAttribute('placeholder')));
  check('禁区(.prose)内输入框 title 不翻译', d.getElementById('zin1').getAttribute('title') === 'Delete', JSON.stringify(d.getElementById('zin1').getAttribute('title')));
  check('禁区(.prose)内输入框 aria-label 不翻译', d.getElementById('zin1').getAttribute('aria-label') === 'Add inline comment', JSON.stringify(d.getElementById('zin1').getAttribute('aria-label')));
  check('translate=no 内输入框 placeholder 不翻译', d.getElementById('zin2').getAttribute('placeholder') === 'Open', JSON.stringify(d.getElementById('zin2').getAttribute('placeholder')));
  check('宿主 UI 输入框 placeholder 照常翻译', d.getElementById('zok').getAttribute('placeholder') === '设置', JSON.stringify(d.getElementById('zok').getAttribute('placeholder')));
  // 动态 setAttribute：禁区内的开口必须封死
  d.getElementById('zin1').setAttribute('placeholder', 'Delete');
  d.getElementById('zin2').setAttribute('placeholder', 'Delete');
  d.getElementById('zok').setAttribute('placeholder', 'Delete');
  check('禁区内输入框动态 placeholder 坚决不翻译', d.getElementById('zin1').getAttribute('placeholder') === 'Delete', JSON.stringify(d.getElementById('zin1').getAttribute('placeholder')));
  check('translate=no 内输入框动态 placeholder 坚决不翻译', d.getElementById('zin2').getAttribute('placeholder') === 'Delete', JSON.stringify(d.getElementById('zin2').getAttribute('placeholder')));
  check('宿主输入框动态 placeholder 照常翻译', d.getElementById('zok').getAttribute('placeholder') === '删除', JSON.stringify(d.getElementById('zok').getAttribute('placeholder')));
  // 属性赋值器（title）路径：禁区内同样不翻译
  d.getElementById('zin1').title = 'Open';
  check('禁区内输入框 title 属性赋值不翻译', d.getElementById('zin1').getAttribute('title') === 'Open', JSON.stringify(d.getElementById('zin1').getAttribute('title')));
  // addedNodes 路径：禁区容器内新增输入框不翻译
  const lateInput = d.createElement('input');
  d.querySelector('.prose').appendChild(lateInput);
  lateInput.setAttribute('placeholder', 'Open');
  await tick();
  check('禁区内新增输入框（addedNodes + setAttribute）不翻译', lateInput.getAttribute('placeholder') === 'Open', JSON.stringify(lateInput.getAttribute('placeholder')));
  dom.window.close();
}

// 2.17 动态句式规则全量回归：逐条覆盖 translateDynamicText 的全部规则族
// （为后续首词分派重构提供 A/B 等价性护栏：重构前后本节输出必须逐字符一致）
console.log('\n[2.17] 动态句式规则全量覆盖');
{
  const cases = [
    // 词锚定规则
    ['Refreshes in 45 minutes', '45 分钟后刷新'],
    ['Learn more about inherit global', '了解更多关于 继承全局设置 (Inherit Global)'],
    ['Learn more about zzqx', '了解更多关于 zzqx'],
    ['Timed 250ms', '计时 250 毫秒'],
    ['Timed 5 mins', '计时 5 分钟'],
    ['Status: Running', '状态：运行中'],
    ['Status: Failed', '状态：失败'],
    ['The command exited with code 1. Output: Error', '命令已退出，退出码 1。输出：Error'],
    ['The command exited with code 127', '命令已退出，退出码 127'],
    ['zzqx finished', 'zzqx 已完成'],
    ['5 file changes to main', '提交 5 个文件更改至 main'],
    ['file changes to main', '个文件更改至 main'],
    ['Inherits your zzqx settings', '继承您的zzqx设置'],
    ['Inherits your general settings', '继承您的通用设置'],
    ['40% of the customization budget is available', '40% 的定制预算可用。'],
    ['Send feedback as zzqx', '以 zzqx 身份发送反馈'],
    ['Your Plan: zzqx', '您的计划：zzqx'],
    ["Yes, and always allow 'npm install' in this project", "是，且在此项目中始终允许运行 'npm install'"],
    ["Yes, and always allow 'npm install'", "是，且始终允许运行 'npm install'"],
    ['7 tools enabled', '7 个工具已启用'],
    ['Show 5 more...', '显示另外 5 个...'],
    ['Show all 3 breakdowns', '显示全部 3 个细目'],
    ['Hide 2 breakdowns', '隐藏 2 个细目'],
    ['Rules: 1,200 tokens', '规则：1,200 tokens'],
    ['Skills: 800 tokens', '技能：800 tokens'],
    ['Media (Yesterday 9:45 PM)', '媒体 (昨天 9:45 PM)'],
    ['Select model, current: zzqx', '选择模型，当前：zzqx'],
    ['Refresh MCP servers', '刷新 MCP 服务器'],
    ['Refresh quota and credits data', '刷新配额与额度数据'],
    ['Skills providing tailored instructions for happy path dart and flutter development workflows.', '提供为 Dart 和 Flutter 的顺畅 (Happy Path) 开发流程量身定制的技能指令。'],
    ['Worked for 5s', '已工作 5 秒'],
    ['Working for 3m', '已工作 3 分钟'],
    ['Thinking (12s)', '思考中 (12 秒)…'],
    ['Waiting for tools...', '等待 工具 中...'],
    ['Thinking for 12s', '已思考 12 秒'],
    ['Running for 5m', '已运行 5 分钟'],
    ['Executing for 2h', '已执行 2 小时'],
    ['Thought for 12s', '思考了 12 秒'],
    ['Ran 3 commands', '已运行 3 条命令'],
    ['Running 3 commands', '正在运行 3 条命令'],
    ['Ran 3 files', '已执行 3 个文件'],
    ['Searched 10 results', '已搜索 10 个结果'],
    ['Searched 5 files, 2 folders', '已搜索 5 个文件、2 个文件夹'],
    ['Starting task deploy', '正在启动任务 deploy'],
    ['Sent input to task run-tests', '已向任务发送输入 run-tests'],
    ['Checked task build-site', '已检查任务 build-site'],
    ['Checking 3 files', '正在检查 3 个文件'],
    ['Killed 2 tasks', '已终止 2 个任务'],
    ['Killing 3 tasks', '正在终止 3 个任务'],
    ['Run command finished', '运行命令 已完成'],
    ['Run task finished', 'Run task 已完成'],
    ['Run 2 searches', '运行 2 次搜索'],
    ['Load older messages, showing 10 of 50', '加载更早的消息，当前显示 10 / 50'],
    ['3 files changed +10 -2', '3 个文件已改动 +10 -2'],
    ['3 files changed', '3 个文件已改动'],
    ['3 subagents running', '3 个子智能体正在运行'],
    ['2 tasks running', '2 个任务正在运行'],
    ['3 subagents/tasks running', '3 个子智能体/任务正在运行'],
    ['+5 more lines', '+5 行'],
    ['Showing 20 lines', '显示 20 行'],
    ['Permanently delete my-group, including 3 active conversations.', '永久删除 my-group，包含 3 个活跃会话。'],
    ['including 3 active conversations.', '包含 3 个活跃会话。'],
    ['All changes since v1.2.3', '自 v1.2.3 以来的所有更改'],
    ['See all (12)', '查看全部 (12)'],
    ['Available AI Credits: 100', '可用 AI 额度: 100'],
    ['Version 9.9.9', '版本 9.9.9'],
    ['2h', '2小时前'],
    ['This will permanently delete 3 active conversations within it.', '此操作将永久删除其中的 3 个活跃会话。'],
    ['Get data: context deadline exceeded', 'Get data: 请求超时 (context deadline exceeded)'],
    ['Fetch api: i/o timeout', 'Fetch api: I/O 超时 (i/o timeout)'],
    ['Updated zzqx', '更新于 zzqx'],
    ['Plugin: my-plugin', '插件：my-plugin'],
    ['Toggle sidebar', '切换侧边栏'],
    ['Enter scheduled task name...', '输入计划任务名称...'],
    ['Enter automation name...', '输入自动化名称...'],
    ['Enter a prompt for the agent to run...', '输入供智能体执行的提示词...'],
    // 通用规则（数字/符号/通配开头）与分派负例
    ['12 files', '12 个文件'],
    ['zzqx qwert asdf', 'zzqx qwert asdf'],
    ['42', '42']
  ];
  const html = cases.map((c, i) => '<div id="dr' + i + '">' + c[0].replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</div>').join('');
  const dom = await runEngine(html);
  cases.forEach((c, i) => {
    const got = dom.window.document.getElementById('dr' + i).textContent;
    check('规则 #' + (i + 1) + ' "' + c[0] + '" → "' + c[1] + '"', got === c[1], '实际: ' + JSON.stringify(got));
  });
  dom.window.close();

  // 'to' 节点按父级上下文翻译（pattern：node.parentElement 依赖分支，父元素自身须含 git 上下文词）
  const domTo = await runEngine('<div id="tohost">Commit 5 file changes <span id="tox">to<b>master</b></span></div>');
  check('独立 to 节点按父级 git 上下文译为 至', domTo.window.document.getElementById('tox').textContent === '至master', JSON.stringify(domTo.window.document.getElementById('tox').textContent));
  domTo.window.close();
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

  fakeElectron.dialog.showMessageBox({
    title: 'Confirm Quit',
    message: 'Are you sure you want to quit?',
    checkboxLabel: 'Do not show again'
  });
  check('对话框 title 翻译', hook.dialogOpts.title === '确认退出', JSON.stringify(hook.dialogOpts.title));
  check('对话框 message 翻译', hook.dialogOpts.message === '您确定要退出吗？', JSON.stringify(hook.dialogOpts.message));
  check('对话框 checkboxLabel 翻译', hook.dialogOpts.checkboxLabel === '不再显示', JSON.stringify(hook.dialogOpts.checkboxLabel));

  fakeElectron.dialog.showErrorBox('Version 1.2.3', '3 running');
  check('core 动态正则 Version', hook.errBox[0] === '版本 1.2.3', JSON.stringify(hook.errBox[0]));
  check('core 动态正则 N running', hook.errBox[1] === '3 个智能体运行中', JSON.stringify(hook.errBox[1]));

  fakeElectron.dialog.showErrorBox('New chat — Antigravity', 'Settings - Antigravity');
  check('core 复合标题分段（全角破折号，经共享内核）', hook.errBox[0] === '新会话 — Antigravity', JSON.stringify(hook.errBox[0]));
  check('core 复合标题分段（半角连字符，经共享内核）', hook.errBox[1] === '设置 - Antigravity', JSON.stringify(hook.errBox[1]));
  check('core 内核版本号已注入', core.includes('AG_I18N_VERSION') && !core.includes("'__AG_I18N_VERSION__'"));

  check('core 含 showErrorBox hook', core.includes('showErrorBox'));
  check('core 含 Menu.prototype.popup hook', core.includes('popup'));
  check('core 含 BrowserWindow.setTitle hook', core.includes("BrowserWindow.prototype, 'setTitle'"));
  check('core 含窗口标题复合分段', core.includes('translateCompoundTitle'));
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
check('english 模式：Antigravity 保持英文原样（identity 键，不进漏译池）', loadDictForBrand('english')['Antigravity'] === 'Antigravity');
check('hidden 模式：Antigravity → 空串', loadDictForBrand('hidden')['Antigravity'] === '');
check('translated 模式：Antigravity → 反重力（选项 3 生效）', loadDictForBrand('translated')['Antigravity'] === '反重力');

// ---------- 7.5 品牌模式运行期回归（hidden 空译值全链路不得被真值判断吞没） ----------
// 历史缺陷：空串译值被 `||` 链与 `if (trans)` 真值判断当作"未命中"吞掉，hidden 模式整体失效
console.log('\n[7.5] 品牌模式运行期（hidden 空译值全链路）');
{
  const hiddenDict = loadDictForBrand('hidden');
  const jsHidden = eng.generateJs(hiddenDict);
  const dom = await runEngine('<div id="hb1">Antigravity</div><div id="hb2">Save</div><input id="hb3" placeholder="Antigravity" title="Open">', jsHidden);
  const d = dom.window.document;
  check('hidden：品牌文本节点译为空串（隐藏生效）', d.getElementById('hb1').textContent === '', JSON.stringify(d.getElementById('hb1').textContent));
  check('hidden：非品牌文本翻译不受影响', d.getElementById('hb2').textContent === '保存', JSON.stringify(d.getElementById('hb2').textContent));
  check('hidden：品牌 placeholder 属性译为空串', d.getElementById('hb3').getAttribute('placeholder') === '', JSON.stringify(d.getElementById('hb3').getAttribute('placeholder')));
  check('hidden：非品牌 title 属性正常翻译', d.getElementById('hb3').getAttribute('title') === '打开', JSON.stringify(d.getElementById('hb3').getAttribute('title')));
  // setAttribute 拦截器路径
  const dynBtn = d.createElement('button');
  dynBtn.setAttribute('title', 'Antigravity');
  check('hidden：setAttribute 拦截器路径品牌译为空串', dynBtn.getAttribute('title') === '', JSON.stringify(dynBtn.getAttribute('title')));
  // 动态新增文本节点（observer 路径）
  const late = d.createElement('div');
  late.textContent = 'Antigravity';
  d.body.appendChild(late);
  await tick();
  check('hidden：动态新增品牌文本节点译为空串', late.textContent === '', JSON.stringify(late.textContent));
  // 漏译池不得被品牌词污染
  const dump = typeof d.defaultView.__AG_DUMP_MISSING__ === 'function' ? d.defaultView.__AG_DUMP_MISSING__() : [];
  check('hidden：品牌词不进漏译采集池', !dump.includes('Antigravity'), JSON.stringify(dump.slice(0, 5)));
  // 复合标题：后段为空译值时不得残留悬挂分隔符
  d.title = 'New chat — Antigravity';
  check('hidden：复合标题空段退化为单段（无悬挂分隔符）', d.title === '新会话', JSON.stringify(d.title));
  dom.window.close();

  // 主进程路径：托盘 tooltip 与菜单标签的品牌隐藏
  const coreHidden = eng.generateI18nCoreJs(hiddenDict);
  const hook2 = { trayTip: null };
  const fakeElectron2 = {
    Menu: {
      setApplicationMenu: function () {},
      buildFromTemplate: function (t) { return { items: t }; }
    },
    Tray: function Tray() {},
    dialog: { showMessageBox: function () {}, showErrorBox: function () {} },
    Notification: null,
    BrowserWindow: function () {},
    app: { on: () => {} }
  };
  fakeElectron2.Tray.prototype.setToolTip = function (t) { hook2.trayTip = t; };
  vm.runInNewContext(coreHidden, {
    require: (m) => { if (m === 'electron') return fakeElectron2; throw new Error('module not found: ' + m); },
    module: { exports: {} },
    console: { log() {}, warn() {}, error() {} },
    Promise, Map, Object, Array, JSON, String, Proxy, Reflect, Error, setTimeout
  });
  const tr2 = new fakeElectron2.Tray();
  tr2.setToolTip('Antigravity');
  check('hidden：主进程托盘 tooltip 品牌译为空串', hook2.trayTip === '', JSON.stringify(hook2.trayTip));
  const tpl2 = fakeElectron2.Menu.buildFromTemplate([{ label: 'Antigravity' }, { label: 'Save' }]);
  check('hidden：菜单品牌标签译为空串（无助记键残留）', tpl2.items[0].label === '', JSON.stringify(tpl2.items[0].label));
  check('hidden：菜单常规标签翻译不受影响', tpl2.items[1].label === '保存', JSON.stringify(tpl2.items[1].label));
}

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
