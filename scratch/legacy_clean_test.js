// 升级路径清理验证（自包含合成夹具，不依赖外部解包目录）：
// 模拟旧版多点汉化工具在官方代码里留下的补丁结构，验证清理函数正确移除补丁、保留官方代码
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'localization_engine.js'), 'utf8');
const MOD_SRC = SRC.replace(/\nmain\(\);\s*$/, '\nmodule.exports = { cleanJsContent, cleanMainJsContent, cleanMenuJsContent, cleanTrayJsContent, detectHanhuaState };\n');
const MOD_PATH = path.join(__dirname, '_legacy_mod.js');
fs.writeFileSync(MOD_PATH, MOD_SRC);
const eng = require(MOD_PATH);

const TMP = path.join(__dirname, '_legacy_fixture');
fs.mkdirSync(path.join(TMP, 'dist'), { recursive: true });
let pass = 0, fail = 0;
const check = (n, c, d) => { if (c) { pass++; console.log('  PASS ' + n); } else { fail++; console.log('  FAIL ' + n + (d ? ' — ' + d : '')); } };

// ---------- 合成夹具 ----------
const OFFICIAL_PRELOAD = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const updaterAPI = {
    onStateChanged: (callback) => {
        const handler = (_event, state) => { callback(state); };
        electron_1.ipcRenderer.on('updater:state-changed', handler);
        return () => { electron_1.ipcRenderer.removeListener('updater:state-changed', handler); };
    },
    applyUpdate: () => electron_1.ipcRenderer.invoke('updater:apply'),
};
electron_1.contextBridge.exposeInMainWorld('electronUpdater', updaterAPI);
`;
// 旧版注入块（带签名）
const OLD_INJECT_BLOCK = `/* --- ANTIGRAVITY CHINESE LOCALIZATION START --- */
(() => {
    const map = new Map(Object.entries({
    "Open": "打开",
    "Save": "保存"
}));
    // ... 旧版引擎体 ...
    window.__AG_DUMP_MISSING__ = function() { return []; };
})();
/* --- ANTIGRAVITY CHINESE LOCALIZATION END --- */
`;

const OFFICIAL_MENU = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupApplicationMenu = setupApplicationMenu;
const electron_1 = require("electron");
const utils_1 = require("./utils");
function setupApplicationMenu(url) {
    const menu = electron_1.Menu.getApplicationMenu();
    if (!menu) return;
    addItemToSubmenu(menu, 'File', 0, new electron_1.MenuItem({
        label: 'New Window',
        accelerator: 'CmdOrCtrl+Shift+N',
        click: () => { (0, utils_1.createWindow)(url); },
    }));
    hideDevTools(menu);
    electron_1.Menu.setApplicationMenu(menu);
}
function addItemToSubmenu(appMenu, submenuLabel, position, item) {
    const submenuItem = appMenu.items.find((item) => item.label === submenuLabel);
    submenuItem.submenu.items.splice(position, 0, item);
}
`;
// 旧版 menu 补丁：三行头部（分隔线/标题/分隔线）+ 补丁体 + translateMenu(menu.items);
const OLD_MENU_PATCH = `
    // ==========================================
    // Antigravity Native Menu Chinese Translation
    // ==========================================
    const translations = { 'File': '文件', 'Edit': '编辑' };
    function translateMenu(items) {
        for (const item of items) { /* 旧版翻译逻辑 */ }
    }
    translateMenu(menu.items);
    
`;

const OFFICIAL_TRAY = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTray = createTray;
exports.updateTrayAgentCount = updateTrayAgentCount;
const electron_1 = require("electron");
let tray = null;
let contextMenu = null;
function createTray(actions) {
    tray = new electron_1.Tray(icon);
    tray.setToolTip(electron_1.app.getName());
    contextMenu = electron_1.Menu.buildFromTemplate(actions);
    tray.setContextMenu(contextMenu);
}
function updateTrayAgentCount(count) {
    if (tray && contextMenu) {
        const countItem = contextMenu.items.find((item) => item.id === 'running-agents');
        if (countItem) {
            countItem.label = count > 0 ? \`\${count} agents running\` : 'No agents running';
            tray.setContextMenu(contextMenu);
        }
    }
}
`;
const OLD_TRAY_PATCH = `    /* --- TRAY TRANSLATION START --- */
    const translations = { 'No agents running': '无运行中的智能体', 'Quit': '退出' };
    for (const item of actions) { if (translations[item.label]) item.label = translations[item.label]; }
    /* --- TRAY TRANSLATION END --- */
`;

const OFFICIAL_MAIN = `"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) { } }) : {});
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const main_1 = __importDefault(require("electron-log/main"));
const menu_1 = require("./menu");
electron_1.app.whenReady().then(async () => {
    (0, menu_1.setupApplicationMenu)(url);
    (0, utils_1.createWindow)(url);
});
`;

// 写入带旧补丁的"汉化版"文件
fs.writeFileSync(path.join(TMP, 'dist', 'preload.js'), OFFICIAL_PRELOAD + OLD_INJECT_BLOCK, 'utf8');
fs.writeFileSync(path.join(TMP, 'dist', 'menu.js'), OFFICIAL_MENU.replace('    electron_1.Menu.setApplicationMenu(menu);', '    electron_1.Menu.setApplicationMenu(menu);' + OLD_MENU_PATCH), 'utf8');
fs.writeFileSync(path.join(TMP, 'dist', 'tray.js'), OFFICIAL_TRAY.replace('    tray = new electron_1.Tray(icon);', OLD_TRAY_PATCH + '    tray = new electron_1.Tray(icon);'), 'utf8');
fs.writeFileSync(path.join(TMP, 'dist', 'main.js'), OFFICIAL_MAIN, 'utf8');

console.log('[A] detectHanhuaState：旧版补丁产物 → legacy');
check('旧版产物识别为 legacy', eng.detectHanhuaState(TMP) === 'legacy');
fs.writeFileSync(path.join(TMP, 'dist', 'antigravity_i18n_core.js'), '// core', 'utf8');
check('含核心文件后识别为 new', eng.detectHanhuaState(TMP) === 'new');
fs.rmSync(path.join(TMP, 'dist', 'antigravity_i18n_core.js'));
// 官方纯版（无补丁）
fs.writeFileSync(path.join(TMP, 'dist', 'menu.js'), OFFICIAL_MENU, 'utf8');
fs.writeFileSync(path.join(TMP, 'dist', 'tray.js'), OFFICIAL_TRAY, 'utf8');
fs.writeFileSync(path.join(TMP, 'dist', 'preload.js'), OFFICIAL_PRELOAD, 'utf8');
check('官方原版识别为 clean', eng.detectHanhuaState(TMP) === 'clean');

console.log('\n[B] preload.js 清理（旧注入块移除、官方保留）');
const preload = OFFICIAL_PRELOAD + OLD_INJECT_BLOCK;
const preloadCleaned = eng.cleanJsContent(preload);
check('签名块被移除', !preloadCleaned.includes('ANTIGRAVITY CHINESE LOCALIZATION'));
check('官方 contextBridge 保留', preloadCleaned.includes("contextBridge.exposeInMainWorld('electronUpdater'"));
check('官方 ipcRenderer 保留', preloadCleaned.includes('ipcRenderer.invoke'));
check('清理后为合法 JS', (() => { try { new Function(preloadCleaned); return true; } catch (e) { return false; } })());
console.log('  (' + (preload.length / 1024).toFixed(1) + ' KB → ' + (preloadCleaned.length / 1024).toFixed(1) + ' KB)');

console.log('\n[C] menu.js 清理（三行头部补丁移除、官方保留）');
const menuPatched = OFFICIAL_MENU.replace('    electron_1.Menu.setApplicationMenu(menu);', '    electron_1.Menu.setApplicationMenu(menu);' + OLD_MENU_PATCH);
const menuCleaned = eng.cleanMenuJsContent(menuPatched);
check('补丁内容被移除', !menuCleaned.includes('Antigravity Native Menu Chinese Translation') && !menuCleaned.includes('translateMenu(menu.items);'));
check('官方 setupApplicationMenu 保留', menuCleaned.includes('function setupApplicationMenu'));
check('官方 addItemToSubmenu 保留', menuCleaned.includes('function addItemToSubmenu'));
check('官方 setApplicationMenu 调用保留', menuCleaned.includes('electron_1.Menu.setApplicationMenu(menu);'));
check('清理后为合法 JS', (() => { try { new Function(menuCleaned); return true; } catch (e) { return false; } })());

console.log('\n[D] tray.js 清理');
const trayPatched = OFFICIAL_TRAY.replace('    tray = new electron_1.Tray(icon);', OLD_TRAY_PATCH + '    tray = new electron_1.Tray(icon);');
const trayCleaned = eng.cleanTrayJsContent(trayPatched);
check('TRAY TRANSLATION 块被移除', !trayCleaned.includes('TRAY TRANSLATION'));
check('官方 createTray 保留', trayCleaned.includes('function createTray'));
check('官方 updateTrayAgentCount 保留', trayCleaned.includes('function updateTrayAgentCount'));
check('清理后为合法 JS', (() => { try { new Function(trayCleaned); return true; } catch (e) { return false; } })());

console.log('\n[E] 官方 main.js 清理应为 no-op');
check('cleanMainJsContent 对官方 main.js 无改动', eng.cleanMainJsContent(OFFICIAL_MAIN) === OFFICIAL_MAIN);

fs.rmSync(TMP, { recursive: true, force: true });
fs.rmSync(MOD_PATH, { force: true });
console.log('\n========== 结果: ' + pass + ' 通过, ' + fail + ' 失败 ==========');
process.exit(fail ? 1 : 0);
