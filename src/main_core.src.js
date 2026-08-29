/**
 * Antigravity Unified i18n Core Interceptor
 * Single-Entry Global Hook for Main Process and All Renderer Windows
 */
const electron = require('electron');

// __AG_KERNEL__

// 主进程翻译入口：完整复用共享内核，再补主进程专属动态句式与复合标题分段
function translateText(text) {
    if (!text || typeof text !== 'string') return text;
    const kernelTrans = translateString(text, null);
    if (kernelTrans) return kernelTrans;
    const n = norm(text);
    if (!n) return text;

    // 主进程专属动态句式（托盘/状态栏智能体运行状态、无版本号 Version 兜底）
    if (/^(\d+)\s+running$/i.test(n)) {
        return n.replace(/^(\d+)\s+running$/i, "$1 个智能体运行中");
    }
    if (/^(\d+)\s+agents?\s+running$/i.test(n)) {
        return n.replace(/^(\d+)\s+agents?\s+running$/i, "$1 个智能体运行中");
    }
    if (n === 'No agents running') {
        return '无运行中的智能体';
    }
    if (/^Version\s*([\d\.]*)$/i.test(n)) {
        return n.replace(/^Version\s*([\d\.]*)$/i, (match, v) => v ? "版本 " + v : "版本");
    }
    // 复合窗口标题分段（如 "New chat — Antigravity" / "Settings - Antigravity"）
    const compound = translateCompoundTitle(text, part => translateText(part));
    if (compound) return compound;
    return text;
}

// 统一菜单与模板翻译函数（消除 translateMenu 与 translateTemplate 结构重复）
function translateMenuItems(items) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
        if (!item) continue;
        let label = item.label || '';
        if (label && typeof label === 'string') {
            let mnemonic = '';
            let cleanLabel = label;
            const m = label.match(/&([a-zA-Z])/);
            if (m) {
                mnemonic = "(&" + m[1] + ")";
                cleanLabel = label.replace('&', '');
            }
            const translated = translateText(cleanLabel);
            if (translated && translated !== cleanLabel) {
                item.label = translated + mnemonic;
            } else {
                const transRaw = translateText(label);
                if (transRaw && transRaw !== label) {
                    item.label = transRaw;
                }
            }
        }
        if (item.submenu) {
            if (Array.isArray(item.submenu.items)) {
                translateMenuItems(item.submenu.items);
            } else if (Array.isArray(item.submenu)) {
                translateMenuItems(item.submenu);
            }
        }
    }
}

const translateMenu = translateMenuItems;
const translateTemplate = translateMenuItems;

function translateDialogOptions(opts) {
    if (!opts || typeof opts !== 'object') return;
    if (opts.title && typeof opts.title === 'string') {
        opts.title = translateText(opts.title);
    }
    if (opts.message && typeof opts.message === 'string') {
        opts.message = translateText(opts.message);
    }
    if (opts.detail && typeof opts.detail === 'string') {
        opts.detail = translateText(opts.detail);
    }
    if (opts.checkboxLabel && typeof opts.checkboxLabel === 'string') {
        opts.checkboxLabel = translateText(opts.checkboxLabel);
    }
    if (opts.nameFieldLabel && typeof opts.nameFieldLabel === 'string') {
        opts.nameFieldLabel = translateText(opts.nameFieldLabel);
    }
    if (opts.buttonLabel && typeof opts.buttonLabel === 'string') {
        opts.buttonLabel = translateText(opts.buttonLabel);
    }
    if (Array.isArray(opts.buttons)) {
        opts.buttons = opts.buttons.map(btn => (typeof btn === 'string' ? translateText(btn) : btn));
    }
}

function safePatch(obj, key, fn) {
    try {
        if (!obj) return;
        const orig = obj[key];
        if (typeof orig !== 'function') return;
        const wrapped = fn(orig);
        try { obj[key] = wrapped; } catch(_) {
            try { Object.defineProperty(obj, key, { value: wrapped, writable: true, configurable: true }); } catch(_2) {}
        }
    } catch(e) {}
}

// -------------------------------------------------------------
// 1. Hook Native Menu APIs (safe patch: 兼容只读属性，防止主进程启动崩溃)
// -------------------------------------------------------------
if (electron.Menu) {
    safePatch(electron.Menu, 'setApplicationMenu', function(origSetAppMenu) {
        return function(menu) {
            if (menu && menu.items) { try { translateMenuItems(menu.items); } catch(e) {} }
            return origSetAppMenu.call(this, menu);
        };
    });
    safePatch(electron.Menu, 'buildFromTemplate', function(origBuildFromTemplate) {
        return function(template) {
            if (Array.isArray(template)) { try { translateMenuItems(template); } catch(e) {} }
            const menu = origBuildFromTemplate.call(this, template);
            if (menu && menu.items) { try { translateMenuItems(menu.items); } catch(e) {} }
            return menu;
        };
    });
    if (electron.Menu.prototype) {
        safePatch(electron.Menu.prototype, 'popup', function(origPopup) {
            return function(options) {
                if (this && this.items) { try { translateMenuItems(this.items); } catch(e) {} }
                return origPopup.call(this, options);
            };
        });
    }
}

// -------------------------------------------------------------
// 2. Hook System Tray APIs (safe)
// -------------------------------------------------------------
if (electron.Tray && electron.Tray.prototype) {
    safePatch(electron.Tray.prototype, 'setContextMenu', function(origSetContextMenu) {
        return function(menu) {
            if (menu && menu.items) { try { translateMenuItems(menu.items); } catch(e) {} }
            return origSetContextMenu.call(this, menu);
        };
    });
    safePatch(electron.Tray.prototype, 'setToolTip', function(origSetToolTip) {
        return function(toolTip) {
            const translated = typeof toolTip === 'string' ? translateText(toolTip) : toolTip;
            return origSetToolTip.call(this, translated);
        };
    });
}

// -------------------------------------------------------------
// 2.5 Hook BrowserWindow.setTitle（主进程驱动的窗口标题，如 page-title-updated 截断流程）
// -------------------------------------------------------------
if (electron.BrowserWindow && electron.BrowserWindow.prototype) {
    safePatch(electron.BrowserWindow.prototype, 'setTitle', function(origSetTitle) {
        return function(title) {
            if (typeof title === 'string') title = translateText(title);
            return origSetTitle.call(this, title);
        };
    });
}

// -------------------------------------------------------------
// 3. Hook System Dialog APIs (safe)
// -------------------------------------------------------------
(function(){
    if (!electron.dialog) return;
    function findDialogOpts(args) {
        for (let i = args.length - 1; i >= 0; i--) {
            const a = args[i];
            let isWin = false;
            try { isWin = !!(electron.BrowserWindow && a instanceof electron.BrowserWindow); } catch(_){ isWin = false; }
            if (a && typeof a === 'object' && !isWin) return i;
        }
        return -1;
    }
    function translateDialogArgs(args) {
        const idx = findDialogOpts(args);
        if (idx === -1) return;
        const opts = { ...args[idx] };
        translateDialogOptions(opts);
        args[idx] = opts;
    }

    const dialogMethods = ['showMessageBox', 'showMessageBoxSync', 'showOpenDialog', 'showOpenDialogSync', 'showSaveDialog', 'showSaveDialogSync'];
    for (const method of dialogMethods) {
        safePatch(electron.dialog, method, function(orig) {
            return function(...args) {
                try { translateDialogArgs(args); } catch(e) {}
                return orig.apply(this, args);
            };
        });
    }

    safePatch(electron.dialog, 'showErrorBox', function(orig) {
        return function(title, content) {
            try {
                if (typeof title === 'string') title = translateText(title);
                if (typeof content === 'string') content = translateText(content);
            } catch(e) {}
            return orig.call(this, title, content);
        };
    });
})();

// -------------------------------------------------------------
// 3.4 Hook System Notifications (使用 Proxy 代理，完整保留 C++ 原生类结构与 Internal Fields)
// -------------------------------------------------------------
(function(){
    if (!electron.Notification) return;
    try {
        const OrigNotification = electron.Notification;
        const HanhuaNotification = new Proxy(OrigNotification, {
            construct(target, args, newTarget) {
                try {
                    const options = args[0];
                    if (options && typeof options === 'object') {
                        const cloned = { ...options };
                        if (typeof cloned.title === 'string') cloned.title = translateText(cloned.title);
                        if (typeof cloned.body === 'string') cloned.body = translateText(cloned.body);
                        if (typeof cloned.subtitle === 'string') cloned.subtitle = translateText(cloned.subtitle);
                        args[0] = cloned;
                    }
                } catch (e) {}
                return Reflect.construct(target, args, newTarget);
            }
        });
        electron.Notification = HanhuaNotification;
    } catch(e) {}
})();

// -------------------------------------------------------------
// 3.5 同步 updater 菜单 action 查找表
// -------------------------------------------------------------
(function syncUpdaterActions() {
    try {
        const updaterMod = require('./updater');
        if (updaterMod && updaterMod.updateActions && typeof updaterMod.updateActions === 'object') {
            for (const key of Object.keys(updaterMod.updateActions)) {
                const trans = translateText(key);
                if (trans && trans !== key && !(trans in updaterMod.updateActions)) {
                    updaterMod.updateActions[trans] = updaterMod.updateActions[key];
                }
            }
        }
    } catch (e) {}
})();

// -------------------------------------------------------------
// 4. Hook All Renderer Windows & WebContents (Multi-window / Modal Auto-Coverage)
// -------------------------------------------------------------
const RENDERER_INJECTION_CODE = RENDERER_CODE_PLACEHOLDER;

if (electron.app) {
    electron.app.on('web-contents-created', (_event, webContents) => {
        if (!webContents) return;
        webContents.on('dom-ready', () => {
            try {
                const url = (typeof webContents.getURL === 'function' ? webContents.getURL() : '') || '';
                // 仅对 Antigravity 客户端本地核心窗口注入，跳过 DevTools、外部 Webview / OAuth 登录弹窗
                if (url.startsWith('http://') || url.startsWith('https://')) {
                    try {
                        const parsedUrl = new URL(url);
                        if (parsedUrl.hostname !== '127.0.0.1' && parsedUrl.hostname !== 'localhost') return;
                    } catch (_) {
                        return;
                    }
                }
                if (url.startsWith('devtools://') || url.startsWith('chrome-extension://')) return;
                webContents.executeJavaScript(RENDERER_INJECTION_CODE).catch(() => {});
            } catch(e) {}
        });
    });
}
