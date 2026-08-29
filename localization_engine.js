const fs = require('fs');
const path = require('path');
const os = require('os');
const child_process = require('child_process');
const crypto = require('crypto');

const DICTS_FOLDER = 'dicts';
const BRAND_TITLE_ALIASES = {
    english: 'english',
    en: 'english',
    default: 'english',
    hidden: 'hidden',
    hide: 'hidden',
    none: 'hidden',
    translated: 'translated',
    chinese: 'translated',
    cn: 'translated',
    zh: 'translated'
};

function getOptionValue(name, defaultValue) {
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
        if (args[i] === name) {
            return args[i + 1] || defaultValue;
        }
        if (args[i].startsWith(name + '=')) {
            return args[i].slice(name.length + 1);
        }
    }
    return defaultValue;
}

const BRAND_TITLE_MODE = BRAND_TITLE_ALIASES[String(getOptionValue('--brand-title', 'english')).toLowerCase()] || 'english';

const SIGNATURE_START = "/* --- ANTIGRAVITY CHINESE LOCALIZATION START --- */";
const SIGNATURE_END = "/* --- ANTIGRAVITY CHINESE LOCALIZATION END --- */";

function normalizeText(text) {
    if (!text) return "";
    return text.replace(/\s+/g, ' ')
               .trim()
               .replace(/’/g, "'")
               .replace(/‘/g, "'")
               .replace(/“/g, '"')
               .replace(/”/g, '"');
}

function loadDictionary() {
    const totalMap = Object.create(null);
    const dictsDir = path.join(__dirname, DICTS_FOLDER);
    if (fs.existsSync(dictsDir)) {
        const files = fs.readdirSync(dictsDir);
        for (const file of files) {
            if (file.endsWith('.json')) {
                try {
                    const filePath = path.join(dictsDir, file);
                    const fileContent = fs.readFileSync(filePath, 'utf-8');
                    const data = JSON.parse(fileContent);
                    for (const [k, v] of Object.entries(data)) {
                        if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
                        const normK = normalizeText(k);
                        if (normK && normK !== '__proto__' && normK !== 'constructor' && normK !== 'prototype') totalMap[normK] = v;
                    }
                } catch (e) {
                    console.error(`[警告] 字典文件解析失败，已跳过该文件: ${file} (${e.message})`);
                }
            }
        }
    }
    if (BRAND_TITLE_MODE === 'english') {
        delete totalMap[normalizeText('Antigravity')];
    } else if (BRAND_TITLE_MODE === 'hidden') {
        totalMap[normalizeText('Antigravity')] = '';
    } else if (BRAND_TITLE_MODE === 'translated') {
        // 中文品牌模式：字典中 Antigravity 为防误译 identity 键，此处覆盖为中文品牌名，否则该模式与英文模式无差别
        totalMap[normalizeText('Antigravity')] = '反重力';
    }
    return totalMap;
}

function generateJs() {
    const fullDict = loadDictionary();
    
    const dictJson = JSON.stringify(fullDict);

    const jsSource = `${SIGNATURE_START}
(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const rootEl = document.documentElement;
    if (!rootEl) return;

    // 原子级单实例互斥锁：跨 preload 与 main world 共享底层 DOM 属性，第 1 行立即原子落锁，
    // 彻底杜绝两个 JS World 同时各跑一套 MutationObserver 导致的双重观察者冲突
    try {
        if (rootEl.hasAttribute('data-ag-i18n-active') || (rootEl.dataset && rootEl.dataset.agHanhua === '1')) return;
        rootEl.setAttribute('data-ag-i18n-active', '1');
        if (rootEl.dataset) rootEl.dataset.agHanhua = '1';
    } catch(e) {}

    if (window.__AG_HANHUA_INSTALLED__) return;
    if (window.__AG_OBSERVER__) {
        try { window.__AG_OBSERVER__.disconnect(); } catch (e) {}
    }
    window.__AG_HANHUA_INSTALLED__ = true;

    // 注入防中文字符异常折行全局 CSS 护盾（:has 降级：拆分两条规则，旧版 Chromium 忽略未知选择器不影响基础防护）
    try {
        if (!document.getElementById('ag-chinese-layout-guard')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'ag-chinese-layout-guard';
            styleEl.textContent = [
                '/* 搜索框与模型选择器微调 */',
                '.bg-secondary.cursor-pointer { white-space: nowrap !important; word-break: keep-all !important; flex-shrink: 0 !important; }',
                'button[data-testid="model-selector-trigger"] span.opacity-70 { margin-left: 0.25rem !important; }'
            ].join('\\n');
            (document.head || document.documentElement).appendChild(styleEl);
        }
    } catch (e) {}

    // V12.0 终极隔离版：基于容器回溯的物理隔离引擎
    // 逻辑：不再仅仅检查当前标签，而是向上回溯父级，识别“代码/编辑器”禁区
    const map = new Map(Object.entries(DICT_PLACEHOLDER));
    const lowerMap = new Map();
    for (const [k, v] of map.entries()) lowerMap.set(k.toLowerCase(), v);
    
    const translatedValues = new WeakMap();
    let isMutating = false;

    // =========================================================================
    // 🛡️ 工业级全维度安全隔离防护网 (Fortified Security & Data Isolation Mesh)
    // =========================================================================
    
    // 1. 绝对禁止标签 (标签级物理熔断: 脚本/样式/代码/媒体/内嵌框架/输入框)
    const BLOCKED_TAGS = new Set([
        'SCRIPT', 'STYLE', 'CODE', 'PRE', 'INPUT', 'TEXTAREA', 'SVG', 'CANVAS', 
        'SYMBOL', 'PATH', 'KBD', 'SAMP', 'VAR', 'TEMPLATE', 'MATH', 'AUDIO', 'VIDEO', 
        'SOURCE', 'TRACK', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT'
    ]);

    // 2. 🛡️ AI 正文、思考链与流式打字专属大容器选择器（精准锁定 AI 正文输出，绝不连坐外部步骤与操作控件）
    const AI_STREAM_PROSE_SELECTOR = [
        '.animate-markdown',
        '.md-divider-spacing',
        '.prose',
        '.markdown-body',
        '[data-testid*="message-body"]',
        '[data-testid="message-content"]',
        '[data-testid="chat-message-content"]',
        '[data-thought]',
        '[data-thinking]',
        '[data-cot]',
        '[data-role="thought"]',
        '.thought-body',
        '.thought-content',
        '.thinking-process',
        '.reasoning-content',
        '.stream-thought',
        '.cot-content',
        '.collapsible-thought-content',
        '[data-is-streaming]',
        '[data-streaming]',
        '[data-is-generating]',
        '[class*="streaming"]',
        '[class*="typing"]'
    ].join(', ');

    // 3. 禁区选择器（文本判定与元素属性判定共用）：代码/终端/公式/用户输入/历史会话标题等物理熔断区
    //    svg/math 整树熔断：图标文本、公式符号绝无翻译价值，且堵住 svg <text> 深层文本漏判
    const FORBIDDEN_SUBTREE_SELECTOR = '.monaco-editor, .monaco-diff-editor, .view-lines, [data-mode-id], [class*="editor-"], .cm-editor, .ace_editor, pre, code, kbd, samp, var, .xterm, .terminal, [class*="terminal-"], input, textarea, [contenteditable="true"], .katex, [translate="no"], .notranslate, [class*="tab-label"], [class*="editor-tab"], .tabs-container [role="tab"], [class*="artifact-tab"], [class*="artifact-card"], [class*="artifact-badge"], [class*="artifact-header"], [class*="artifact-title"], [data-testid*="artifact-"], [class*="user-input-step"], [data-turn-role="user"], [data-message-author="user"], a[href*="/c/"] [class*="truncate"], [data-testid*="conversation-item"] [class*="truncate"], [class*="tool-call-details"], [data-testid*="tool-call-content"], svg, math';

    // 未命中采集：收集“非禁区但未翻译”的英文文本，便于迭代补全字典（内存 Set 去重，零 I/O 开销）
    const missedTexts = new Set();
    const MISSED_TEXTS_MAX = 5000;

    function norm(s) {
        if (!s) return '';
        return s.replace(/\\s+/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').trim();
    }

    function unitToCn(unit) {
        if (!unit) return '';
        const u = unit.toLowerCase();
        if (u === 's') return '秒';
        if (u === 'm') return '分钟';
        if (u === 'h') return '小时';
        if (u === 'd') return '天';
        if (u === 'w') return '周';
        if (u === 'mo') return '月';
        if (u === 'yr') return '年';
        return unit;
    }

    function translateCountItem(itemStr) {
        if (!itemStr) return '';
        const m = itemStr.trim().match(/^([\\d,.]+)\\s+([a-zA-Z\\s]+)$/);
        if (!m) return itemStr;
        const num = m[1];
        const unit = m[2].trim().toLowerCase();
        if (/^files?$/.test(unit)) return num + ' 个文件';
        if (/^folders?$/.test(unit)) return num + ' 个文件夹';
        if (/^search(es)?$/.test(unit)) return num + ' 次搜索';
        if (/^pages?$/.test(unit)) return num + ' 个页面';
        if (/^urls?$/.test(unit)) return num + ' 个网址';
        if (/^domains?$/.test(unit)) return num + ' 个域名';
        if (/^actions?$/.test(unit)) return num + ' 个操作';
        if (/^tools?$/.test(unit)) return num + ' 个工具';
        if (/^subagents?$/.test(unit)) return num + ' 个子智能体';
        if (/^tasks?$/.test(unit)) return num + ' 个任务';
        if (/^commands?$/.test(unit)) return num + ' 个命令';
        if (/^plugins?$/.test(unit)) return num + ' 个插件';
        if (/^skills?$/.test(unit)) return num + ' 个技能';
        if (/^rules?$/.test(unit)) return num + ' 条规则';
        if (/^active\\s+conversations?$/.test(unit)) return num + ' 个活跃会话';
        if (/^conversations?$/.test(unit)) return num + ' 个会话';
        if (/^image\\s+attachments?$/.test(unit)) return num + ' 个图片附件';
        return itemStr;
    }

    function translateCountList(listStr) {
        if (!listStr) return '';
        return listStr.split(',').map(s => translateCountItem(s.trim())).join('、');
    }

    function translateTaskTarget(target) {
        if (!target) return '';
        const normT = norm(target);
        if (map.has(normT)) return map.get(normT);
        const lowerT = normT.toLowerCase();
        if (lowerMap.has(lowerT)) return lowerMap.get(lowerT);
        if (/^Run command$/i.test(normT)) return '运行命令';
        if (/^Running command$/i.test(normT)) return '正在运行命令';
        if (/^Command execution$/i.test(normT)) return '执行命令';
        if (/^Task log$/i.test(normT)) return '任务日志';
        if (/^command finished$/i.test(normT)) return '命令完成';
        if (/^task finished$/i.test(normT)) return '任务完成';
        const taskMatch = normT.match(/^task-(\\d+|[a-zA-Z0-9_-]+)$/i);
        if (taskMatch) return '任务 ' + taskMatch[1];
        return target;
    }

    function translateWithShortcut(val) {
        if (!val) return null;
        const match = val.match(/^(.+?)\\s*\\((Ctrl|Cmd|Alt|Shift|⌘|⌥|⇧|⌃)\\+?([^)]*)\\)$/i);
        if (match) {
            const prefix = match[1].trim();
            const normPref = norm(prefix);
            const lowerPref = normPref.toLowerCase();
            let transPref = null;
            if (map.has(normPref)) {
                transPref = map.get(normPref);
            } else if (lowerMap.has(lowerPref)) {
                transPref = lowerMap.get(lowerPref);
            }
            if (transPref) {
                return transPref + " (" + match[2] + (match[3] ? "+" + match[3] : "") + ")";
            }
        }
        const countMatch = val.match(/^(.+?)\\s*\\(([0-9]+)\\)$/);
        if (countMatch) {
            const prefix = countMatch[1].trim();
            const normPref = norm(prefix);
            const lowerPref = normPref.toLowerCase();
            let transPref = null;
            if (map.has(normPref)) {
                transPref = map.get(normPref);
            } else if (lowerMap.has(lowerPref)) {
                transPref = lowerMap.get(lowerPref);
            }
            if (transPref) {
                return transPref + " (" + countMatch[2] + ")";
            }
        }
        // 单字母缩写后缀：如 "Medium (M)" / "Low (L)" / "High (H)" —— 枚举选项常带快捷键字母，
        // 整串匹配不到字典，这里翻译前缀并保留缩写（前缀未命中则不翻译，避免误伤）
        const letterMatch = val.match(/^(.+?)\\s*\\(([A-Za-z]{1,2})\\)$/);
        if (letterMatch) {
            const prefix = letterMatch[1].trim();
            const normPref = norm(prefix);
            const lowerPref = normPref.toLowerCase();
            let transPref = null;
            if (map.has(normPref)) {
                transPref = map.get(normPref);
            } else if (lowerMap.has(lowerPref)) {
                transPref = lowerMap.get(lowerPref);
            }
            if (transPref) {
                return transPref + " (" + letterMatch[2] + ")";
            }
        }
        const symbolMatch = val.match(/^([+•*>\-])\\s+(.+)$/);
        if (symbolMatch) {
            const sym = symbolMatch[1];
            const content = symbolMatch[2].trim();
            const normContent = norm(content);
            const lowerContent = normContent.toLowerCase();
            let transContent = null;
            if (map.has(normContent)) {
                transContent = map.get(normContent);
            } else if (lowerMap.has(lowerContent)) {
                transContent = lowerMap.get(lowerContent);
            }
            if (transContent) {
                return sym + " " + transContent;
            }
        }
        return null;
    }

    // 🛡️ 唯一单管道语义路由：纯扁平平行分支，严格 0 嵌套，逻辑直通到底
    function shouldTranslateTextNode(node) {
        if (!node || node.nodeType !== Node.TEXT_NODE) return false;
        const raw = (node.nodeValue || '').trim();
        if (!raw) return false;

        const el = node.parentElement;
        if (!el || typeof el.closest !== 'function') return false;

        // 分支 0：禁区标签直查（与观察器入队口径对齐：body 内联 style、svg/math 深层文本等边缘不再漏判）
        const tag = el.tagName ? String(el.tagName).toUpperCase() : '';
        if (BLOCKED_TAGS.has(tag)) return false;

        // 分支 1：绝对代码、终端、公式、用户输入与历史会话标题禁区 -> 100% 物理熔断
        // （严禁翻译代码行、终端输出、用户自身提问气泡、自定义会话标题、代码文件标签名、Artifact 交付件标题）
        if (el.closest(FORBIDDEN_SUBTREE_SELECTOR)) {
            return false;
        }

        // 分支 2：🛡️ AI 正文、思考链推导与流式打字专属大容器 -> 100% 绝对物理熔断！
        // 核心保障：绝对高于后续所有交互控件直通规则，绝不允许任何打字半成品与 Markdown 文本被机械翻译！
        if (el.closest(AI_STREAM_PROSE_SELECTOR)) {
            return false;
        }

        // 分支 3：全交互控件、步骤条、导航栏、弹窗模态框、下拉菜单、提示气泡、表单开关与标签 -> 100% 优先直通放行
        if (el.closest('summary, button, a, [role="button"], [role="menuitem"], [role="option"], [role="switch"], [role="checkbox"], [role="radio"], [role="treeitem"], [role="tooltip"], [role="dialog"], [role="alertdialog"], [aria-expanded], [class*="step-header"], [class*="step-title"], [class*="accordion-trigger"], [class*="collapse-header"], nav, aside, header, footer, [class*="sidebar"], [class*="navigation"], [class*="nav-"], [class*="menu"], [class*="dropdown"], [class*="popover"], [class*="select"], [class*="modal"], [class*="dialog"], [class*="drawer"], [class*="toast"], [class*="tooltip"], [class*="badge"], [class*="tag"], [class*="pill"], [class*="switch"], [class*="toggle"], [class*="tree-item"], [class*="context-menu"], [role="menubar"], [role="menu"], [role="listbox"], label')) {
            return true;
        }

        // 分支 4：常规 UI（侧边栏、设置面板、系统菜单、弹窗对话框） -> 100% 默认放行
        return true;
    }

    function translateAttrValue(v) {
        if (!v) return null;
        const t = norm(v);
        const shortcutTrans = translateWithShortcut(t);
        if (shortcutTrans) return shortcutTrans;
        if (map.has(t)) return map.get(t);
        const tLower = t.toLowerCase();
        if (lowerMap.has(tLower)) return lowerMap.get(tLower);

        // 动态属性正则匹配
        if (/^(Rules|Skills):\\s*([\\d,]+)\\s*tokens$/i.test(t)) {
            return t.replace(/^(Rules|Skills):\\s*([\\d,]+)\\s*tokens$/i, (m, type, num) => {
                const typeCn = type.toLowerCase() === 'rules' ? '规则' : '技能';
                return typeCn + '：' + num + ' tokens';
            });
        }
        if (/^Plugin:\\s*(.+)$/i.test(t)) {
            return t.replace(/^Plugin:\\s*(.+)$/i, '插件：$1');
        }
        if (/^Toggle\\s+(.+)$/i.test(t)) {
            return t.replace(/^Toggle\\s+(.+)$/i, '切换 $1');
        }
        if (/^Load older messages, showing (\\d+) of (\\d+)$/i.test(t)) {
            return t.replace(/^Load older messages, showing (\\d+) of (\\d+)$/i, '加载更早的消息，当前显示 $1 / $2');
        }
        if (/^\\+(\\d+)\\s+more\\s+lines?$/i.test(t)) {
            return t.replace(/^\\+(\\d+)\\s+more\\s+lines?$/i, '+$1 行');
        }
        if (/^Showing\\s+(\\d+)\\s+lines?$/i.test(t)) {
            return t.replace(/^Showing\\s+(\\d+)\\s+lines?$/i, '显示 $1 行');
        }
        if (/^Enter\\s+(.+?)\\s+name\\.\\.\\.$/i.test(t)) {
            return t.replace(/^Enter\\s+(.+?)\\s+name\\.\\.\\.$/i, (m, name) => {
                const nameCn = name === 'scheduled task' ? '计划任务' : (name === 'automation' ? '自动化' : name);
                return '输入' + nameCn + '名称...';
            });
        }
        if (/^Enter a prompt for the agent to run\\.\\.\\.$/i.test(t)) {
            return '输入供智能体执行的提示词...';
        }
        if (/^([\\d,.]+\\s+[a-zA-Z\\s]+)(?:,\\s*[\\d,.]+\\s+[a-zA-Z\\s]+)*$/i.test(t)) {
            const trans = translateCountList(t);
            if (trans !== t) return trans;
        }
        return null;
    }

    function translateElementAttrs(node) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
        for (const attr of ['placeholder', 'title', 'aria-label']) {
            const v = node.getAttribute(attr);
            if (v) {
                const trans = translateAttrValue(v);
                if (trans && trans !== v) node.setAttribute(attr, trans);
            }
        }
    }

    function translateTextNode(node) {
        try {
            if (!shouldTranslateTextNode(node)) return;
            let originalVal = node.nodeValue;
            if (!originalVal || originalVal.trim().length < 1) return;
            if (translatedValues.get(node) === originalVal) return;

            if (originalVal.toLowerCase().includes('pack.info')) {
                const parent = node.parentElement;
                if (parent && parent.getAttribute('translate') !== 'no') {
                    parent.setAttribute('translate', 'no');
                }
                return;
            }

            const valNorm = norm(originalVal);

            // 🛡️ 物理保护 1：文件路径、代码文件名、网址URL、UUID/Hash与命令行
            if (/^(https?:\\/\\/|[a-zA-Z]:[\\\\/]|[\\\\/][a-zA-Z0-9_.-]|\\.[\\\\/]|\\.\\.[\\\\/])/.test(valNorm)) return;
            if (/^[a-zA-Z0-9_\\-.]+\\.(js|ts|jsx|tsx|json|py|go|rs|cpp|c|h|hpp|java|kt|dart|html|css|scss|md|mdx|yaml|yml|toml|xml|sql|sh|bat|ps1|asar|exe|dll|zip|tar|gz|png|jpg|svg|ico)$/i.test(valNorm)) return;
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valNorm)) return;

            // 🛡️ 物理保护 2：纯代码行/函数调用特征（放行动作步骤标题，如 Ran node ...）
            if (!/^(Ran|Running|Explored|Analyzed|Searched|Edited|Thought for|Worked for|Checked|Killed|Starting|Started)\\b/i.test(valNorm)) {
                if (/[a-zA-Z0-9_$]+\\.[a-zA-Z0-9_$]+\\(/.test(valNorm) || /^[a-zA-Z0-9_$]+\\(.*\\)$/.test(valNorm)) return;
            }

            let newVal = originalVal;
            const valLower = valNorm.toLowerCase();
            
            // 1. 精确匹配（含大小写自动纠正与快捷键检测）
            const shortcutTrans = translateWithShortcut(valNorm);
            if (shortcutTrans) {
                    newVal = shortcutTrans;
                } else if (map.has(valNorm)) {
                    newVal = map.get(valNorm);
                } else if (lowerMap.has(valLower)) {
                    newVal = lowerMap.get(valLower);
                                } else if (/^Refreshes in (.+?)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Refreshes in (.+?)$/i, (match, timeStr) => {
                        let tTrans = timeStr.trim()
                            .replace(/(\\d+)\\s*days?/gi, '$1 天')
                            .replace(/(\\d+)\\s*hours?/gi, '$1 小时')
                            .replace(/(\\d+)\\s*minutes?/gi, '$1 分钟')
                            .replace(/(\\d+)\\s*seconds?/gi, '$1 秒')
                            .replace(/,\\s*/g, ' ')
                            .replace(/\\s+/g, ' ');
                        return tTrans + "后刷新";
                    });
                } else if (/^You have used some of your (.+?) limit, it will fully refresh in (.+?)\\.?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^You have used some of your (.+?) limit, it will fully refresh in (.+?)\\.?$/i, (match, limitType, timeStr) => {
                        let lType = limitType.trim().toLowerCase();
                        let lTrans = limitType.trim();
                        if (lType === 'weekly') lTrans = '每周';
                        else if (lType === 'daily') lTrans = '每日';
                        else if (lType === 'monthly') lTrans = '每月';
                        else if (lType.includes('5-hour') || lType.includes('5 hour')) lTrans = '5 小时';
                        else {
                            lTrans = lType.replace(/(\\d+)-hour/g, '$1 小时').replace(/(\\d+)\\s*hours?/g, '$1 小时');
                        }
                        
                        let tTrans = timeStr.trim()
                            .replace(/(\\d+)\\s*days?/gi, '$1 天')
                            .replace(/(\\d+)\\s*hours?/gi, '$1 小时')
                            .replace(/(\\d+)\\s*minutes?/gi, '$1 分钟')
                            .replace(/(\\d+)\\s*seconds?/gi, '$1 秒')
                            .replace(/,\\s*/g, ' ')
                            .replace(/\\s+/g, ' ');
                            
                        let prefix = "您已使用了部分";
                        if (lTrans === "每周" || lTrans === "每日" || lTrans === "每月") {
                            prefix += lTrans;
                        } else {
                            prefix += " " + lTrans;
                        }
                        return prefix + "限制，将在 " + tTrans + "后完全刷新。";
                    });
                } else if (/^您已使用了部分.+?(刷新|限制)/i.test(valNorm)) {
                    let temp = valNorm;
                    temp = temp.replace(/(\\d+)\\s*days?/gi, '$1 天');
                    temp = temp.replace(/(\\d+)\\s*hours?/gi, '$1 小时');
                    temp = temp.replace(/(\\d+)\\s*minutes?/gi, '$1 分钟');
                    temp = temp.replace(/(\\d+)\\s*seconds?/gi, '$1 秒');
                    temp = temp.replace(/部分\\s+每周/g, '部分每周');
                    temp = temp.replace(/部分\\s+每日/g, '部分每日');
                    temp = temp.replace(/部分\\s+每月/g, '部分每月');
                    newVal = temp;
                } else if (/^Learn more about (.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Learn more about (.+)$/i, (match, p) => {
                        // 优先查字典（单一数据源：preset 译文与字典保持一致）；
                        // 字典未命中时再按已知 preset 规则兜底（inherit 类为子串匹配，字典整键无法覆盖）
                        const pNorm = norm(p);
                        const pLower = pNorm.toLowerCase();
                        let trans = null;
                        if (map.has(pNorm)) trans = map.get(pNorm);
                        else if (lowerMap.has(pLower)) trans = lowerMap.get(pLower);
                        if (trans) return "了解更多关于 " + trans;
                        let translatedPreset = p;
                        if (pLower.includes('inherit general')) translatedPreset = "继承通用设置 (Inherit General)";
                        else if (pLower.includes('inherit project')) translatedPreset = "继承项目设置 (Inherit Project)";
                        else if (pLower.includes('inherit global')) translatedPreset = "继承全局设置 (Inherit Global)";
                        return "了解更多关于 " + translatedPreset;
                    });
                } else if (valNorm.includes('了解更多关于') && /inherit\\s+general/i.test(valNorm)) {
                    newVal = valNorm.replace(/inherit\\s+general/gi, '继承通用设置 (Inherit General)');
                } else if (/^Inherits your (.+?) settings(.*)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Inherits your (.+?) settings(.*)$/i, (match, cat, rest) => {
                        let cLower = cat.toLowerCase().trim();
                        let catTrans = cat;
                        if (cLower === 'general') catTrans = '通用';
                        else if (cLower === 'project') catTrans = '项目';
                        else if (cLower === 'global') catTrans = '全局';
                        let restTrans = rest ? rest.trim() : '';
                        if (restTrans.includes('effective in this project') || restTrans.includes('在此项目中生效')) {
                            restTrans = ' (在此项目中生效)。';
                        } else if (/^when working in this project\\.?$/i.test(restTrans)) {
                            restTrans = '（在此项目中工作时）';
                        } else if (restTrans) {
                            restTrans = ' ' + restTrans;
                        }
                        return "继承您的" + catTrans + "设置" + restTrans;
                    });
                } else if (/^(\\d+)% of the customization budget is available\\.?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(\\d+)% of the customization budget is available\\.?$/i, (match, num) => {
                        return num + "% 的定制预算可用。";
                    });
                } else if (/^Send feedback as (.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Send feedback as (.+)$/i, (match, addr) => {
                        return "以 " + addr + " 身份发送反馈";
                    });
                } else if (/^Your Plan:\\s*(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Your Plan:\\s*(.+)$/i, (match, plan) => {
                        return "您的计划：" + plan;
                    });
                } else if (/^Yes, and always allow '(.+)' in this project$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Yes, and always allow '(.+)' in this project$/i, (match, cmd) => {
                        return "是，且在此项目中始终允许运行 '" + cmd + "'";
                    });
                } else if (/^Yes, and always allow '(.+)'$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Yes, and always allow '(.+)'$/i, (match, cmd) => {
                        return "是，且始终允许运行 '" + cmd + "'";
                    });
                } else if (/^(\\d+) tools? enabled$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(\\d+) tools? enabled$/i, (match, num) => {
                        return num + " 个工具已启用";
                    });
                } else if (/^Show (\\d+) more(\\.\\.\\.|…)?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Show (\\d+) more(\\.\\.\\.|…)?$/i, (match, num) => {
                        return "显示另外 " + num + " 个...";
                    });
                } else if (/^Show (\\d+) breakdowns?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Show (\\d+) breakdowns?$/i, (match, num) => {
                        return "显示 " + num + " 个细目";
                    });
                } else if (/^Hide (\\d+) breakdowns?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Hide (\\d+) breakdowns?$/i, (match, num) => {
                        return "隐藏 " + num + " 个细目";
                    });
                } else if (/^Show all (\\d+) breakdowns?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Show all (\\d+) breakdowns?$/i, (match, num) => {
                        return "显示全部 " + num + " 个细目";
                    });
                } else if (/^Hide all (\\d+) breakdowns?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Hide all (\\d+) breakdowns?$/i, (match, num) => {
                        return "隐藏全部 " + num + " 个细目";
                    });
                } else if (/^(Rules|Skills):\\s*([\\d,]+)\\s*tokens$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(Rules|Skills):\\s*([\\d,]+)\\s*tokens$/i, (m, type, num) => {
                        const t = type.toLowerCase() === 'rules' ? '规则' : '技能';
                        return t + '：' + num + ' tokens';
                    });
                } else if (/^Media \\((Today|Yesterday)\\s+(\\d{1,2}:\\d{2})\\s*(AM|PM)?\\)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Media \\((Today|Yesterday)\\s+(\\d{1,2}:\\d{2})\\s*(AM|PM)?\\)$/i, (m, day, time, ap) => {
                        const d = day.toLowerCase() === 'today' ? '今天' : '昨天';
                        return '媒体 (' + d + ' ' + time + (ap ? ' ' + ap : '') + ')';
                    });
                } else if (/^Select model, current: (.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Select model, current: (.+)$/i, (m, model) => {
                        return '选择模型，当前：' + model;
                    });
                } else if (/^Refresh (MCP servers|quota and credits data)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Refresh (MCP servers|quota and credits data)$/i, (m, t) => {
                        if (t.toLowerCase() === 'mcp servers') return '刷新 MCP 服务器';
                        return '刷新配额与额度数据';
                    });
                } else if (/^Show Remote Control QR code$/i.test(valNorm)) {
                    newVal = '显示远程控制二维码';
                } else if (/^Remote Control link$/i.test(valNorm)) {
                    newVal = '远程控制链接';
                } else if (/^Skills providing tailored instructions for happy path (.+?) development workflows\\.?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Skills providing tailored instructions for happy path (.+?) development workflows\\.?$/i, (match, lang) => {
                        let translatedLang = lang;
                        if (lang.toLowerCase() === 'dart and flutter') translatedLang = "Dart 和 Flutter";
                        return "提供为 " + translatedLang + " 的顺畅 (Happy Path) 开发流程量身定制的技能指令。";
                    });
                } else if (/^Worked for (\\d+)(s|m|h|d|w|mo|yr)?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Worked for (\\d+)(s|m|h|d|w|mo|yr)?$/i, (match, num, unit) => {
                        return "已工作 " + num + " " + unitToCn(unit);
                    });
                } else if (/^Working for (\\d+)(s|m|h|d|w|mo|yr)?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Working for (\\d+)(s|m|h|d|w|mo|yr)?$/i, (match, num, unit) => {
                        return "已工作 " + num + " " + unitToCn(unit);
                    });
                } else if (/^Thinking \\(?(\\d+)(s|m|h|d|w|mo|yr)?\\)?(\\.{1,3}|…)?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Thinking \\(?(\\d+)(s|m|h|d|w|mo|yr)?\\)?(\\.{1,3}|…)?$/i, (match, num, unit, dots) => {
                        return "思考中 (" + num + " " + unitToCn(unit) + ")" + (dots || "…");
                    });
                } else if (/^Waiting for (.+?)(\\.{1,3}|…)?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Waiting for (.+?)(\\.{1,3}|…)?$/i, (match, target, dots) => {
                        let t = target.trim().toLowerCase();
                        let trans = target;
                        if (t === 'input') trans = "输入";
                        else if (t === 'user') trans = "用户";
                        else if (t === 'tool' || t === 'tools') trans = "工具";
                        else if (t === 'agent' || t === 'agents') trans = "智能体";
                        return "等待 " + trans + " 中...";
                    });
                } else if (/^Thinking for (\\d+)(s|m|h|d|w|mo|yr)?(\\.{0,3}|…)?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Thinking for (\\d+)(s|m|h|d|w|mo|yr)?(\\.{0,3}|…)?$/i, (match, num, unit, dots) => {
                        return "已思考 " + num + " " + unitToCn(unit) + (dots || "");
                    });
                } else if (/^Running for (\\d+)(s|m|h|d|w|mo|yr)?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Running for (\\d+)(s|m|h|d|w|mo|yr)?$/i, (match, num, unit) => {
                        return "已运行 " + num + " " + unitToCn(unit);
                    });
                } else if (/^Executing for (\\d+)(s|m|h|d|w|mo|yr)?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Executing for (\\d+)(s|m|h|d|w|mo|yr)?$/i, (match, num, unit) => {
                        return "已执行 " + num + " " + unitToCn(unit);
                    });
                } else if (/^Thought for (\\d+)(s|m|h)?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Thought for (\\d+)(s|m|h)?$/i, (match, num, unit) => {
                        return "思考了 " + num + " " + unitToCn(unit);
                    });
                } else if (/^Timed (\\d+)\\s+seconds?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Timed (\\d+)\\s+seconds?$/i, (match, num) => {
                        return "计时 " + num + " 秒";
                    });
                } else if (/^Explored(?:\\s+(.+))?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Explored(?:\\s+(.+))?$/i, (match, body) => {
                        if (!body) return "已探索";
                        let isWorking = / Working\\.\\.\\.$/i.test(body);
                        let cleanBody = body.replace(/ Working\\.\\.\\.$/i, '');
                        let translatedBody = translateCountList(cleanBody);
                        return (isWorking ? "正在探索 " : "已探索 ") + translatedBody + (isWorking ? "..." : "");
                    });
                } else if (/^Analyzed(?:\\s+(.+))?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Analyzed(?:\\s+(.+))?$/i, (match, prefix) => {
                        if (!prefix) return "已分析";
                        let isWorking = / Working\\.\\.\\.$/i.test(prefix);
                        let cleanPrefix = prefix.replace(/ Working\\.\\.\\.$/i, '');
                        let trans = translateCountList(cleanPrefix);
                        return (isWorking ? "正在分析 " : "已分析 ") + trans + (isWorking ? "..." : "");
                    });
                } else if (/^Edited(?:\\s+(.+))?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Edited(?:\\s+(.+))?$/i, (match, prefix) => {
                        if (!prefix) return "已编辑";
                        let isWorking = / Working\\.\\.\\.$/i.test(prefix);
                        let cleanPrefix = prefix.replace(/ Working\\.\\.\\.$/i, '');
                        let trans = translateCountList(cleanPrefix);
                        return (isWorking ? "正在编辑 " : "已编辑 ") + trans + (isWorking ? "..." : "");
                    });
                } else if (/^(?:Ran|Running)\\s+(\\d+)\\s+commands?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(Ran|Running)\\s+(\\d+)\\s+commands?$/i, (m, verb, num) => {
                        return (verb.toLowerCase() === 'running' ? "正在运行 " : "已运行 ") + num + " 条命令";
                    });
                } else if (/^Ran\\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Ran\\s+(.+)$/i, (match, prefix) => {
                        let isWorking = / Working\\.\\.\\.$/i.test(prefix);
                        let cleanPrefix = prefix.replace(/ Working\\.\\.\\.$/i, '');
                        let trans = translateCountList(cleanPrefix);
                        return (isWorking ? "正在执行 " : "已执行 ") + trans + (isWorking ? " 正在处理..." : "");
                    });
                } else if (/^Searched\\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Searched\\s+(.+)$/i, (match, body) => {
                        let res = body.replace(/(\\d+)\\s+results?/i, '$1 个结果').replace(/(\\d+)\\s+result/i, '$1 个结果');
                        return "已搜索 " + res;
                    });
                } else if (/^Searching\\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Searching\\s+(.+)$/i, "正在搜索 $1");
                } else if (/^Checked task\\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Checked task\\s+(.+)$/i, (match, target) => {
                        return "已检查任务 " + translateTaskTarget(target);
                    });
                } else if (/^Checking task\\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Checking task\\s+(.+)$/i, (match, target) => {
                        return "正在检查任务 " + translateTaskTarget(target);
                    });
                } else if (/^Killed task\\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Killed task\\s+(.+)$/i, (match, target) => {
                        return "已终止任务 " + translateTaskTarget(target);
                    });
                } else if (/^Killing task\\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Killing task\\s+(.+)$/i, (match, target) => {
                        return "正在终止任务 " + translateTaskTarget(target);
                    });
                } else if (/^Started task\\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Started task\\s+(.+)$/i, (match, target) => {
                        return "已启动任务 " + translateTaskTarget(target);
                    });
                } else if (/^Starting task\\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Starting task\\s+(.+)$/i, (match, target) => {
                        return "正在启动任务 " + translateTaskTarget(target);
                    });
                } else if (/^Paused task\\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Paused task\\s+(.+)$/i, (match, target) => {
                        return "已暂停任务 " + translateTaskTarget(target);
                    });
                } else if (/^Pausing task\\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Pausing task\\s+(.+)$/i, (match, target) => {
                        return "正在暂停任务 " + translateTaskTarget(target);
                    });
                } else if (/^Resumed task\\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Resumed task\\s+(.+)$/i, (match, target) => {
                        return "已恢复任务 " + translateTaskTarget(target);
                    });
                } else if (/^Resuming task\\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Resuming task\\s+(.+)$/i, (match, target) => {
                        return "正在恢复任务 " + translateTaskTarget(target);
                    });
                } else if (/^Created task\\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Created task\\s+(.+)$/i, (match, target) => {
                        return "已创建任务 " + translateTaskTarget(target);
                    });
                } else if (/^Creating task\\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Creating task\\s+(.+)$/i, (match, target) => {
                        return "正在创建任务 " + translateTaskTarget(target);
                    });
                } else if (/^Created(?:\\s+(.+))?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Created(?:\\s+(.+))?$/i, (match, body) => {
                        if (!body) return "已创建";
                        let isWorking = / Working\\.\\.\\.$/i.test(body);
                        let cleanBody = body.replace(/ Working\\.\\.\\.$/i, '');
                        let trans = translateCountList(cleanBody);
                        return (isWorking ? "正在创建 " : "已创建 ") + trans + (isWorking ? "..." : "");
                    });
                } else if (/^Deleted(?:\\s+(.+))?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Deleted(?:\\s+(.+))?$/i, (match, body) => {
                        if (!body) return "已删除";
                        let isWorking = / Working\\.\\.\\.$/i.test(body);
                        let cleanBody = body.replace(/ Working\\.\\.\\.$/i, '');
                        let trans = translateCountList(cleanBody);
                        return (isWorking ? "正在删除 " : "已删除 ") + trans + (isWorking ? "..." : "");
                    });
                } else if (/^Sent input to task\\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Sent input to task\\s+(.+)$/i, (match, target) => {
                        return "已向任务发送输入 " + translateTaskTarget(target);
                    });
                } else if (/^Sending input to task\\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Sending input to task\\s+(.+)$/i, (match, target) => {
                        return "正在向任务发送输入 " + translateTaskTarget(target);
                    });
                } else if (/^Checked (.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Checked (.+)$/i, (match, prefix) => {
                        let isWorking = / Working\\.\\.\\.$/i.test(prefix);
                        let cleanPrefix = prefix.replace(/ Working\\.\\.\\.$/i, '');
                        let trans = translateCountList(cleanPrefix);
                        return (isWorking ? "正在检查 " : "已检查 ") + trans + (isWorking ? "..." : "");
                    });
                } else if (/^Checking (.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Checking (.+)$/i, (match, prefix) => {
                        let trans = translateCountList(prefix);
                        return "正在检查 " + trans;
                    });
                } else if (/^Killed (.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Killed (.+)$/i, (match, prefix) => {
                        let isWorking = / Working\\.\\.\\.$/i.test(prefix);
                        let cleanPrefix = prefix.replace(/ Working\\.\\.\\.$/i, '');
                        let trans = translateCountList(cleanPrefix);
                        return (isWorking ? "正在终止 " : "已终止 ") + trans + (isWorking ? "..." : "");
                    });
                } else if (/^Killing (.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Killing (.+)$/i, (match, prefix) => {
                        let trans = translateCountList(prefix);
                        return "正在终止 " + trans;
                    });
                } else if (/^Run (.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Run (.+)$/i, (match, prefix) => {
                        if (/^command finished$/i.test(prefix)) return "命令执行完成";
                        if (/^task finished$/i.test(prefix)) return "任务执行完成";
                        let trans = translateCountList(prefix);
                        if (trans !== prefix) return "运行 " + trans;
                        let target = translateTaskTarget(prefix);
                        return "运行 " + target;
                    });
                } else if (/^command finished$/i.test(valNorm)) {
                    newVal = "命令已完成";
                } else if (/^task finished$/i.test(valNorm)) {
                    newVal = "任务已完成";
                } else if (/^Load older messages, showing (\\d+) of (\\d+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Load older messages, showing (\\d+) of (\\d+)$/i, '加载更早的消息，当前显示 $1 / $2');
                } else if (/^(\\d+) files? changed(\\s*\\+\\d+\\s*-\\d+)?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(\\d+) files? changed(\\s*\\+\\d+\\s*-\\d+)?$/i, (match, num, diff) => {
                        let diffStr = diff || "";
                        return num + " 个文件已改动" + diffStr;
                    });
                } else if (/^(\\d+)\\s+subagents?\\/tasks?\\s+running$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(\\d+)\\s+subagents?\\/tasks?\\s+running$/i, '$1 个子智能体/任务正在运行');
                } else if (/^(\\d+)\\s+subagents?\\s+running$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(\\d+)\\s+subagents?\\s+running$/i, '$1 个子智能体正在运行');
                } else if (/^(\\d+)\\s+tasks?\\s+running$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(\\d+)\\s+tasks?\\s+running$/i, '$1 个任务正在运行');
                } else if (/^(\\d+\\s+[a-zA-Z\\s]+)(?:,\\s*\\d+\\s+[a-zA-Z\\s]+)*$/i.test(valNorm) && translateCountList(valNorm) !== valNorm) {
                    newVal = translateCountList(valNorm);
                } else if (/^\\+(\\d+)\\s+more\\s+lines?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^\\+(\\d+)\\s+more\\s+lines?$/i, '+$1 行');
                } else if (/^Showing\\s+(\\d+)\\s+lines?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Showing\\s+(\\d+)\\s+lines?$/i, '显示 $1 行');
                } else if (/^Permanently delete (.+?), including (\\d+) active conversations?\\.?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Permanently delete (.+?), including (\\d+) active conversations?\\.?$/i, (match, proj, count) => {
                        return "永久删除 " + proj + "，包含 " + count + " 个活跃会话。";
                    });
                } else if (/^including (\\d+) active conversations?\\.?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^including (\\d+) active conversations?\\.?$/i, "包含 $1 个活跃会话。");
                } else if (/^All changes since (.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^All changes since (.+)$/i, '自 $1 以来的所有更改');
                } else if (/^All\\s+(?:scheduled tasks?|automations?)\\s+run\\s+as\\s+(.+?)\\.?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^All\\s+(?:scheduled tasks?|automations?)\\s+run\\s+as\\s+(.+?)\\.?$/i, '所有计划任务均以 $1 模型运行。');
                } else if (/^A\\s+(?:scheduled task|automation)\\s+with\\s+ID\\s+(.+?)\\s+already\\s+exists\\.?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^A\\s+(?:scheduled task|automation)\\s+with\\s+ID\\s+(.+?)\\s+already\\s+exists\\.?$/i, 'ID 为 $1 的任务已存在。');
                } else if (/^See all \\((\\d+)\\)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^See all \\((\\d+)\\)$/i, (match, num) => {
                        return "显示全部 (" + num + ")";
                    });
                } else if (/^Available AI Credits: (\\d+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Available AI Credits: (\\d+)$/i, (match, num) => {
                        return "可用 AI 额度: " + num;
                    });
                } else if (/^Version\\s+([\\d\\.]+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Version\\s+([\\d\\.]+)$/i, (match, v) => {
                        return "版本 " + v;
                    });
                } else if (/^(\\d+)(s|m|h|d|w|mo|yr)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(\\d+)(s|m|h|d|w|mo|yr)$/i, (match, num, unit) => {
                        const unitLower = unit.toLowerCase();
                        let unitStr = "";
                        if (unitLower === "s") unitStr = "秒前";
                        else if (unitLower === "m") unitStr = "分钟前";
                        else if (unitLower === "h") unitStr = "小时前";
                        else if (unitLower === "d") unitStr = "天前";
                        else if (unitLower === "w") unitStr = "周前";
                        else if (unitLower === "mo") unitStr = "个月前";
                        else if (unitLower === "yr") unitStr = "年前";
                        return num + unitStr;
                    });
                } else if (/^Are you sure you want to delete (the |this )?(project group|project|workspace)?\\s*(.+?)\\??$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Are you sure you want to delete (the |this )?(project group|project|workspace)?\\s*(.+?)\\??$/i, (match, article, type, name) => {
                        let typeStr = "项目";
                        if (type && type.toLowerCase().includes('group')) typeStr = "项目分组";
                        else if (type && type.toLowerCase() === 'workspace') typeStr = "工作区";
                        return "您确定要删除 " + typeStr + " " + name + " 吗？";
                    });
                } else if (/^This will permanently delete (\\d+) active conversations? within it\\.?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^This will permanently delete (\\d+) active conversations? within it\\.?$/i, (match, count) => {
                        return "此操作将永久删除其中的 " + count + " 个活跃会话。";
                    });
                } else if (/^This will permanently delete (.+?) within it\\.?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^This will permanently delete (.+?) within it\\.?$/i, (match, target) => {
                        return "此操作将永久删除其中的 " + target + "。";
                    });
                } else if (/^(.+?): context deadline exceeded$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(.+?): context deadline exceeded$/i, (match, prefix) => {
                        return prefix + ": 请求超时 (context deadline exceeded)";
                    });
                } else if (/^(.+?): i\\/o timeout$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(.+?): i\\/o timeout$/i, (match, prefix) => {
                        return prefix + ": I\\/O 超时 (i\\/o timeout)";
                    });
                } else if (/^Are you sure you want to delete (the |this )?project (.+?)\\??$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Are you sure you want to delete (the |this )?project (.+?)\\??$/i, (match, article, name) => {
                        return "您确定要删除项目 " + name + " 吗？";
                    });
                } else if (/^Updated (.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Updated (.+)$/i, "更新于 $1");
                }

                let leadingWs = originalVal.startsWith(' ') ? ' ' : '';
                let trailingWs = originalVal.endsWith(' ') ? ' ' : '';
                if (!leadingWs && node.parentElement && (node.parentElement.className || '').includes('opacity-70')) {
                    const pBtn = node.parentElement.closest('button[data-testid="model-selector-trigger"]');
                    if (pBtn) leadingWs = ' ';
                }
                const finalVal = leadingWs + newVal + trailingWs;
                if (finalVal !== originalVal) {
                    translatedValues.set(node, finalVal);
                    isMutating = true;
                    try {
                        node.nodeValue = finalVal;
                    } finally {
                        isMutating = false;
                    }
                } else if (/[a-zA-Z]/.test(valNorm)) {
                    if (!/^#L\\d+(-\\d+)?$/i.test(valNorm)) {
                        if (missedTexts.size < MISSED_TEXTS_MAX) missedTexts.add(valNorm);
                    }
                }
        } catch (e) {}
    }

    // 高效子树遍历：使用浏览器原生 C++ TreeWalker，极速非阻塞扫描所有文本节点
    function translateSubtree(root) {
        if (!root) return;
        if (root.nodeType === Node.TEXT_NODE) {
            translateTextNode(root);
            return;
        }
        if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;

        if (root.nodeType === Node.ELEMENT_NODE) {
            if (typeof root.closest === 'function' && root.closest(AI_STREAM_PROSE_SELECTOR)) return;
            translateElementAttrs(root);
            if (root.shadowRoot) {
                const hostCls = (typeof root.className === 'string' ? root.className : '').toLowerCase();
                const hostTag = (root.tagName || '').toUpperCase();
                if (!hostCls.includes('xterm') && !hostCls.includes('terminal') && !hostCls.includes('monaco') && hostTag !== 'CANVAS') {
                    translateSubtree(root.shadowRoot);
                }
            }
        }

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function(n) {
                if (!n || !n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                const p = n.parentElement;
                if (!p) return NodeFilter.FILTER_REJECT;
                const tag = p.tagName ? p.tagName.toUpperCase() : '';
                if (!shouldTranslateTextNode(n)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });

        let curr = walker.nextNode();
        while (curr) {
            translateTextNode(curr);
            curr = walker.nextNode();
        }
    }

    // 暴露未命中采集结果：调用 window.__AG_DUMP_MISSING__() 输出并返回未翻译文案列表
    window.__AG_MISSED_TEXTS__ = missedTexts;
    window.__AG_DUMP_MISSING__ = function() {
        const arr = Array.from(missedTexts).sort();
        console.log('[AG汉化] 未翻译文案 ' + arr.length + ' 条:\\n' + arr.join('\\n'));
        return arr;
    };

    // 时间切片队列：大批量 DOM 变动时拆分为微小批次在空闲帧执行，确保 60fps 零卡顿
    let pendingQueue = [];
    let isFlushScheduled = false;
    function scheduleFlush() {
        if (isFlushScheduled) return;
        isFlushScheduled = true;
        const runFlush = () => {
            isFlushScheduled = false;
            if (isMutating) return;
            const batch = pendingQueue.splice(0, 50);
            for (const item of batch) {
                try {
                    if (item.nodeType === Node.TEXT_NODE) translateTextNode(item);
                    else translateSubtree(item);
                } catch(e) {}
            }
            if (pendingQueue.length > 0) {
                if (typeof requestIdleCallback === 'function') requestIdleCallback(runFlush);
                else setTimeout(runFlush, 16);
            }
        };
        if (typeof queueMicrotask === 'function') queueMicrotask(runFlush);
        else setTimeout(runFlush, 0);
    }

    const observer = new MutationObserver(mutations => {
        if (isMutating) return;
        let count = 0;
        for (const m of mutations) {
            if (m.type === 'childList') {
                for (const n of m.addedNodes) {
                    if (n.nodeType === Node.ELEMENT_NODE) {
                        const tag = n.tagName ? n.tagName.toUpperCase() : '';
                        if (BLOCKED_TAGS.has(tag)) continue;
                        if (typeof n.closest === 'function' && n.closest(AI_STREAM_PROSE_SELECTOR)) continue;
                    } else if (n.nodeType === Node.TEXT_NODE) {
                        if (!shouldTranslateTextNode(n)) continue;
                    }
                    if (pendingQueue.length < 200) {
                        pendingQueue.push(n);
                        count++;
                    }
                }
            } else if (m.type === 'characterData') {
                const target = m.target;
                if (!target || !shouldTranslateTextNode(target)) continue;
                if (pendingQueue.length < 200) {
                    pendingQueue.push(target);
                    count++;
                }
            }
        }
        if (count > 0) {
            if (pendingQueue.length < 6) {
                const immediate = pendingQueue.splice(0, pendingQueue.length);
                for (const item of immediate) {
                    try {
                        if (item.nodeType === Node.TEXT_NODE) translateTextNode(item);
                        else translateSubtree(item);
                    } catch(e){}
                }
            } else {
                scheduleFlush();
            }
        }
    });
    window.__AG_OBSERVER__ = observer;

    const obsOpts = { childList: true, subtree: true, characterData: true };

    const startEngine = () => {
        const target = document.body || document.documentElement;
        if (target) {
            try { observer.observe(target, obsOpts); } catch (e) {}
            try { translateSubtree(target); } catch(e){}
        }
    };

    // 单次优雅初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startEngine, { once: true });
    } else {
        startEngine();
    }

    // 引擎全部初始化完成，写入跨 world 防重标志（供另一 world 的引擎检测后退出）
    if (rootEl && rootEl.dataset) rootEl.dataset.agHanhua = '1';
})();
${SIGNATURE_END}`;

    // 注意：用函数形式替换，避免字典内容中的 $& / $` / $' 等字符被 String.replace 当作特殊替换模式解析
    return jsSource.replace("DICT_PLACEHOLDER", () => dictJson);
}

function cleanJsContent(content) {
    const regex = new RegExp(escapeRegExp(SIGNATURE_START) + "[\\s\\S]*?" + escapeRegExp(SIGNATURE_END), "g");
    return content.replace(regex, "");
}

function cleanMainJsContent(content) {
    if (!content) return "";
    return content.replace(/require\(['"]\.\/antigravity_i18n_core\.js['"]\);?\r?\n?/g, "");
}

function cleanMenuJsContent(content) {
    if (!content) return "";
    const startMark = "// ==========================================";
    const endMark = "translateMenu(menu.items);";
    const endIdx = content.indexOf(endMark);
    if (endIdx === -1) return content;
    let startIdx = content.lastIndexOf(startMark, endIdx);
    if (startIdx === -1) return content;
    // 安全断言：删除区间不得超过 15,000 字符，且必须包含汉化标识
    const sliceLen = (endIdx + endMark.length) - startIdx;
    if (sliceLen > 15000) return content;
    const patchSlice = content.substring(startIdx, endIdx + endMark.length);
    if (!patchSlice.includes('Menu') && !patchSlice.includes('translateMenu')) return content;

    const curLineStart = content.lastIndexOf('\n', startIdx - 1) + 1;
    const prevLineStart = curLineStart === 0 ? -1 : content.lastIndexOf('\n', curLineStart - 2) + 1;
    if (prevLineStart !== -1) {
        const prevLine = content.substring(prevLineStart, curLineStart - 1);
        if (prevLine.includes('Antigravity Native Menu Chinese Translation')) {
            const prevPrevStart = prevLineStart === 0 ? -1 : content.lastIndexOf('\n', prevLineStart - 2) + 1;
            if (prevPrevStart !== -1) {
                const prevPrevLine = content.substring(prevPrevStart, prevLineStart - 1);
                if (prevPrevLine.includes(startMark)) {
                    startIdx = prevPrevStart;
                }
            }
        }
    }
    return content.substring(0, startIdx) + content.substring(endIdx + endMark.length);
}

function cleanTrayJsContent(content) {
    if (!content) return "";
    const startMark = "/* --- TRAY TRANSLATION START --- */";
    const endMark = "/* --- TRAY TRANSLATION END --- */";
    const startIdx = content.indexOf(startMark);
    const endIdx = content.indexOf(endMark);
    if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
        if ((endIdx + endMark.length - startIdx) <= 15000) {
            return content.substring(0, startIdx) + content.substring(endIdx + endMark.length);
        }
    }
    return content;
}

function generateI18nCoreJs() {
    const fullDict = loadDictionary();
    const dictJson = JSON.stringify(fullDict);
    const rendererJs = generateJs();
    const rendererJsEscaped = JSON.stringify(rendererJs);

    return `/**
 * Antigravity Unified i18n Core Interceptor
 * Single-Entry Global Hook for Main Process and All Renderer Windows
 */
const electron = require('electron');

const DICT = ${dictJson};
const map = new Map(Object.entries(DICT));
const lowerMap = new Map();
for (const [k, v] of map.entries()) lowerMap.set(k.toLowerCase(), v);

function norm(s) {
    if (!s || typeof s !== 'string') return '';
    return s.replace(/\\s+/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').trim();
}

// 动态规则边界约定：主进程仅覆盖静态菜单/托盘/对话框文案与少量高频动态句式；
// 富动态文案（计数、时长、状态机句式等）由渲染层 DOM 引擎（generateJs）权威处理，
// 两处清单无需强行对齐——新增动态文案默认只加渲染层。
function translateText(text) {
    if (!text || typeof text !== 'string') return text;
    const n = norm(text);
    if (!n) return text;
    if (map.has(n)) return map.get(n);
    const lower = n.toLowerCase();
    if (lowerMap.has(lower)) return lowerMap.get(lower);

    // Dynamic patterns
    if (/^Version\\s*([\\d\\.]*)$/i.test(n)) {
        return n.replace(/^Version\\s*([\\d\\.]*)$/i, (match, v) => v ? "版本 " + v : "版本");
    }
    if (/^(\\d+)\\s+running$/i.test(n)) {
        return n.replace(/^(\\d+)\\s+running$/i, "$1 个智能体运行中");
    }
    if (/^(\\d+)\\s+agents?\\s+running$/i.test(n)) {
        return n.replace(/^(\\d+)\\s+agents?\\s+running$/i, "$1 个智能体运行中");
    }
    if (n === 'No agents running') {
        return '无运行中的智能体';
    }
    return text;
}

function translateMenu(items) {
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
            } else if (translateText(label) && translateText(label) !== label) {
                item.label = translateText(label);
            }
        }
        if (item.submenu) {
            if (Array.isArray(item.submenu.items)) {
                translateMenu(item.submenu.items);
            } else if (Array.isArray(item.submenu)) {
                translateMenu(item.submenu);
            }
        }
    }
}

function translateTemplate(template) {
    if (!Array.isArray(template)) return;
    for (const item of template) {
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
            } else if (translateText(label) && translateText(label) !== label) {
                item.label = translateText(label);
            }
        }
        if (item.submenu && Array.isArray(item.submenu)) {
            translateTemplate(item.submenu);
        }
    }
}

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
    if (opts.buttonLabel && typeof opts.buttonLabel === 'string') {
        opts.buttonLabel = translateText(opts.buttonLabel);
    }
    if (Array.isArray(opts.buttons)) {
        opts.buttons = opts.buttons.map(btn => (typeof btn === 'string' ? translateText(btn) : btn));
    }
}

// -------------------------------------------------------------
// 1. Hook Native Menu APIs (safe patch: 兼容只读属性，防止主进程启动崩溃)
// -------------------------------------------------------------
(function(){
    function safePatch(obj, key, fn) {
        try {
            const orig = obj[key];
            if (typeof orig !== 'function') return;
            const wrapped = fn(orig);
            try { obj[key] = wrapped; } catch(_) {
                try { Object.defineProperty(obj, key, { value: wrapped, writable: true, configurable: true }); } catch(_2) {}
            }
        } catch(e) {}
    }
    if (electron.Menu) {
        safePatch(electron.Menu, 'setApplicationMenu', function(origSetAppMenu) {
            return function(menu) {
                if (menu && menu.items) { try { translateMenu(menu.items); } catch(e) {} }
                return origSetAppMenu.call(this, menu);
            };
        });
        safePatch(electron.Menu, 'buildFromTemplate', function(origBuildFromTemplate) {
            return function(template) {
                if (Array.isArray(template)) { try { translateTemplate(template); } catch(e) {} }
                const menu = origBuildFromTemplate.call(this, template);
                if (menu && menu.items) { try { translateMenu(menu.items); } catch(e) {} }
                return menu;
            };
        });
    }
})();

// -------------------------------------------------------------
// 2. Hook System Tray APIs (safe)
// -------------------------------------------------------------
(function(){
    function safeProtoPatch(proto, key, fn) {
        try {
            const orig = proto[key];
            if (typeof orig !== 'function') return;
            const wrapped = fn(orig);
            try { proto[key] = wrapped; } catch(_) {
                try { Object.defineProperty(proto, key, { value: wrapped, writable: true, configurable: true }); } catch(_2) {}
            }
        } catch(e) {}
    }
    if (electron.Tray && electron.Tray.prototype) {
        safeProtoPatch(electron.Tray.prototype, 'setContextMenu', function(origSetContextMenu) {
            return function(menu) {
                if (menu && menu.items) { try { translateMenu(menu.items); } catch(e) {} }
                return origSetContextMenu.call(this, menu);
            };
        });
        safeProtoPatch(electron.Tray.prototype, 'setToolTip', function(origSetToolTip) {
            return function(toolTip) {
                const translated = typeof toolTip === 'string' ? translateText(toolTip) : toolTip;
                return origSetToolTip.call(this, translated);
            };
        });
    }
})();

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
    function safeDialogPatch(key, wrapper) {
        try {
            const orig = electron.dialog[key];
            if (typeof orig !== 'function') return;
            const wrapped = wrapper(orig);
            try { electron.dialog[key] = wrapped; } catch(_) {
                try { Object.defineProperty(electron.dialog, key, { value: wrapped, writable: true, configurable: true }); } catch(_2) {}
            }
        } catch(e) {}
    }
    safeDialogPatch('showMessageBox', function(orig){ return function(...args){ try{translateDialogArgs(args);}catch(e){} return orig.apply(this,args); }; });
    safeDialogPatch('showMessageBoxSync', function(orig){ return function(...args){ try{translateDialogArgs(args);}catch(e){} return orig.apply(this,args); }; });
    safeDialogPatch('showOpenDialog', function(orig){ return function(...args){ try{translateDialogArgs(args);}catch(e){} return orig.apply(this,args); }; });
    safeDialogPatch('showOpenDialogSync', function(orig){ return function(...args){ try{translateDialogArgs(args);}catch(e){} return orig.apply(this,args); }; });
    safeDialogPatch('showErrorBox', function(orig){ return function(title, content){ try{ if(typeof title==='string') title=translateText(title); if(typeof content==='string') content=translateText(content);}catch(e){} return orig.call(this,title,content); }; });
    safeDialogPatch('showSaveDialog', function(orig){ return function(...args){ try{translateDialogArgs(args);}catch(e){} return orig.apply(this,args); }; });
    safeDialogPatch('showSaveDialogSync', function(orig){ return function(...args){ try{translateDialogArgs(args);}catch(e){} return orig.apply(this,args); }; });
})();

// -------------------------------------------------------------
// 3.4 Hook System Notifications (使用 Proxy 代理，完整保留 C++ 原生类结构与 Internal Fields)
// 渲染进程经 IPC 传入的 title/body 是 JS 字符串，DOM 翻译引擎无法覆盖，在这里统一翻译
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
// 官方 updater.js 用 updateActions[menuItem.label] 查表执行动作（macOS 检查更新菜单）。
// 菜单 label 被翻译成中文后查表会落空导致点击无反应，这里把中文键同步到查找表。
// 原英文键保留，官方 enabled 判断（updateActions[step]）不受影响。
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
const RENDERER_INJECTION_CODE = ${rendererJsEscaped};

if (electron.app) {
    electron.app.on('web-contents-created', (_event, webContents) => {
        if (!webContents) return;
        webContents.on('dom-ready', () => {
            try {
                const url = (typeof webContents.getURL === 'function' ? webContents.getURL() : '') || '';
                // 仅对 Antigravity 客户端本地核心窗口注入，跳过 DevTools、外部 Webview / OAuth 登录弹窗
                if (url.startsWith('http://') || url.startsWith('https://')) {
                    if (!url.includes('127.0.0.1') && !url.includes('localhost')) return;
                }
                if (url.startsWith('devtools://') || url.startsWith('chrome-extension://')) return;
                webContents.executeJavaScript(RENDERER_INJECTION_CODE).catch(() => {});
            } catch(e) {}
        });
    });
}
`;
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let wasAppRunning = false;

function checkIfAppIsRunning() {
    try {
        const stdout = child_process.execSync('tasklist /fi "imagename eq Antigravity.exe" /nh', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        return stdout.toLowerCase().includes('antigravity.exe');
    } catch (e) {
        // ignore
    }
    return false;
}

function hashFile(filePath) {
    // 流式计算 SHA-256，避免大文件（数百 MB 的 asar）全量读入内存
    const hash = crypto.createHash('sha256');
    const fd = fs.openSync(filePath, 'r');
    try {
        const buf = Buffer.alloc(64 * 1024);
        let bytesRead;
        while ((bytesRead = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
            hash.update(buf.subarray(0, bytesRead));
        }
    } finally {
        fs.closeSync(fd);
    }
    return hash.digest('hex');
}

function readAsarHeaderSize(asarPath) {
    // asar 头部 pickle 格式：[4B headerSize][4B headerStringSize][header JSON...]
    // 返回 header JSON 的字节长度，非法/损坏时返回 -1
    try {
        const fd = fs.openSync(asarPath, 'r');
        const head = Buffer.alloc(8);
        const read = fs.readSync(fd, head, 0, 8, 0);
        fs.closeSync(fd);
        if (read < 8) return -1;
        const headerSize = head.readUInt32LE(4);
        const fileSize = fs.statSync(asarPath).size;
        if (!headerSize || headerSize > 256 * 1024 * 1024 || (8 + headerSize) > fileSize) return -1;
        return headerSize;
    } catch (e) {
        return -1;
    }
}

function isValidAsar(asarPath) {
    return readAsarHeaderSize(asarPath) > 0;
}

function isHanhuaAsar(asarPath) {
    // 只读 asar 头部（header JSON 在前）检查是否含汉化核心模块文件名，避免完整解包
    const headerSize = readAsarHeaderSize(asarPath);
    if (headerSize <= 0) return false;
    try {
        const fd = fs.openSync(asarPath, 'r');
        const buf = Buffer.alloc(8 + headerSize);
        const bytesRead = fs.readSync(fd, buf, 0, buf.length, 0);
        fs.closeSync(fd);
        return buf.slice(0, bytesRead).includes(Buffer.from('antigravity_i18n_core'));
    } catch (e) {
        return false;
    }
}

function sleepSync(ms) {
    try {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    } catch (e) {
        const start = Date.now();
        while (Date.now() - start < ms) {}
    }
}

function closeAntigravityProcesses() {
    if (!checkIfAppIsRunning()) return;
    console.log("[1] 检测到 Antigravity 客户端正在运行，正在关闭以解除文件锁...");
    try {
        child_process.execSync('taskkill /f /im Antigravity.exe /t >nul 2>nul');
    } catch (e) {
        // ignore
    }
    sleepSync(1500);
}

function detectInstallationDir(manualDir) {
    if (manualDir) {
        if (fs.existsSync(manualDir)) {
            let resolved = path.resolve(manualDir);
            if (fs.statSync(resolved).isFile() && resolved.endsWith('app.asar')) {
                resolved = path.dirname(resolved);
            }
            return resolved;
        } else {
            console.error(`[错误] 手动指定的路径不存在: ${manualDir}`);
            process.exit(1);
        }
    }

    const candidates = [];
    const seenCandidates = new Set();
    const addCandidate = (candidate) => {
        if (!candidate) return;
        const normalized = path.resolve(candidate);
        const key = normalized.toLowerCase();
        if (!seenCandidates.has(key)) {
            candidates.push(normalized);
            seenCandidates.add(key);
        }
    };
    const hasAntigravityResources = (candidate) => {
        return fs.existsSync(path.join(candidate, "resources", "app.asar")) ||
            fs.existsSync(path.join(candidate, "app.asar")) ||
            fs.existsSync(path.join(candidate, "resources", "app", "product.json"));
    };

    addCandidate(process.env.ANTIGRAVITY_INSTALL_DIR);
    addCandidate(process.env.ANTIGRAVITY_HOME);

    const registryRoots = [
        'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
        'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
        'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
    ];
    for (const root of registryRoots) {
        try {
            const output = child_process.execSync(`reg query "${root}" /s /f Antigravity /d`, { encoding: 'utf-8', stdio: 'pipe' });
            for (const line of output.split(/\r?\n/)) {
                const match = line.match(/^\s*(InstallLocation|DisplayIcon)\s+REG_\w+\s+(.+)$/i);
                if (!match) continue;
                let value = match[2].trim().replace(/^"|"$/g, '');
                if (/Antigravity\.exe/i.test(value)) {
                    value = path.dirname(value);
                }
                addCandidate(value);
            }
        } catch (e) {
            // Registry probing is best-effort; fall back to common locations below.
        }
    }

    const driveLetters = ['C', 'D', 'E', 'F'];
    for (const drive of driveLetters) {
        addCandidate(`${drive}:\\Programs\\Antigravity`);
        addCandidate(`${drive}:\\Antigravity`);
    }
    addCandidate("C:\\Program Files\\Antigravity");

    const localAppdata = process.env.LOCALAPPDATA;
    if (localAppdata) {
        addCandidate(path.join(localAppdata, 'Programs', 'antigravity'));
    }

    for (const p of candidates) {
        if (fs.existsSync(p) && hasAntigravityResources(p)) {
            console.log(`[探测] 成功自动识别到 Antigravity 安装目录: ${p}`);
            return path.resolve(p);
        }
    }

    console.error("[错误] 未找到默认安装目录，请使用 --install-dir 手动指定您的安装路径！");
    process.exit(1);
}

function runCommandSync(cmd) {
    try {
        const out = child_process.execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
        return { success: true, stdout: out, stderr: '' };
    } catch (e) {
        return { success: false, stdout: e.stdout || '', stderr: e.stderr || e.message };
    }
}



// ==========================================
// Antigravity 2.0+ 汉化引擎 (单点全局拦截架构)
// ==========================================
// 解析主入口完整路径（自适应：优先读 asar 内 package.json 的 main 字段，官方升级若调整入口路径
// （如 dist/main.js -> app/main.js）安装注入与汉化状态检测依然保持同源一致）
function resolveMainEntry(tempDir) {
    let mainEntry = 'dist/main.js';
    try {
        const pkgPath = path.join(tempDir, 'package.json');
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            if (pkg && typeof pkg.main === 'string' && pkg.main.trim() && pkg.main.trim().toLowerCase().endsWith('.js')) {
                mainEntry = pkg.main.trim().replace(/\\/g, '/');
            }
        }
    } catch (e) {}
    return path.join(tempDir, mainEntry);
}

// 内容级汉化状态检测：基于解包产物判断当前 app.asar 属于哪种状态。
// asar header 只列文件名，旧版多点补丁（menu.js/tray.js/preload.js 内嵌代码）在 header 中不可见，
// 必须读文件内容才能识别，否则升级路径上会把旧版汉化包误判为官方原版并污染官方备份。
function detectHanhuaState(tempDir) {
    try {
        // 单点核心模块写在主入口同目录，检测必须与 resolveMainEntry 同源：
        // 若官方调整入口路径导致这里查不到已存在的 core，汉化包会被误判为 clean，
        // 后续 hash 对比会用汉化包覆盖官方备份 app.asar.bak（最严重的污染场景）
        const corePath = path.join(path.dirname(resolveMainEntry(tempDir)), "antigravity_i18n_core.js");
        if (fs.existsSync(corePath)) return 'new';
        const distDir = path.join(tempDir, "dist");
        const legacyMarkers = [
            { file: 'menu.js', marker: 'Antigravity Native Menu Chinese Translation' },
            { file: 'menu.js', marker: 'translateMenu(menu.items);' },
            { file: 'tray.js', marker: 'TRAY TRANSLATION' },
            { file: 'preload.js', marker: 'ANTIGRAVITY CHINESE LOCALIZATION' }
        ];
        for (const m of legacyMarkers) {
            const p = path.join(distDir, m.file);
            if (fs.existsSync(p) && fs.readFileSync(p, 'utf-8').includes(m.marker)) return 'legacy';
        }
    } catch (e) {}
    return 'clean';
}

function install20(resourcesDir) {
    const asarPath = path.join(resourcesDir, "app.asar");
    const bakPath = path.join(resourcesDir, "app.asar.bak");

    if (!fs.existsSync(asarPath)) {
        console.error(`[错误] 未在资源目录中找到 app.asar: ${resourcesDir}`);
        return false;
    }
    if (!isValidAsar(asarPath)) {
        console.error(`[错误] app.asar 不是有效的 asar 包（可能已损坏）。为避免覆盖官方备份，已中止操作。请重新安装官方 Antigravity 客户端后重试。`);
        return false;
    }

    // 1. 临时提取目录（提前解包：备份决策需要基于解包后的内容级检测）
    // 放在系统临时目录：解包产物数百 MB，避免落在工具目录（桌面）触发同步盘风暴或碎片残留
    const tempDir = path.join(os.tmpdir(), `antigravity_hanhua_asar_${process.pid}`);
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }

    console.log(`[解包] 正在使用 npx 提取 app.asar...`);
    // 优先使用本地已安装的 asar（离线可用），缺失时回退 npx
    let extractRes = null;
    try {
        const localAsar = path.join(__dirname, 'node_modules', '.bin', process.platform === 'win32' ? 'asar.cmd' : 'asar');
        if (fs.existsSync(localAsar)) {
            extractRes = runCommandSync(`"${localAsar}" extract "${asarPath}" "${tempDir}"`);
        }
    } catch(_){}
    if (!extractRes || !extractRes.success) {
        extractRes = runCommandSync(`npx -y @electron/asar extract "${asarPath}" "${tempDir}"`);
    }
    if (!extractRes.success || !fs.existsSync(tempDir)) {
        console.error(`[错误] 解包失败，可能是由于系统未安装 Node.js/npm 或者网络限制。`);
        console.error(`详情: ${extractRes.stderr}\n${extractRes.stdout}`);
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch(_){}
        return false;
    }

    // 2. 内容级汉化状态检测（new=新版单点 / legacy=旧版多点补丁 / clean=官方原版）
    const hanhuaState = detectHanhuaState(tempDir);
    if (hanhuaState === 'new') {
        console.log(`[检测] 当前 app.asar 为汉化版（单点架构），将基于官方备份重新注入...`);
    } else if (hanhuaState === 'legacy') {
        console.log(`[检测] 当前 app.asar 含旧版多点汉化补丁，将清理并升级到单点架构...`);
    } else {
        console.log(`[检测] 当前 app.asar 为官方原版。`);
    }

    // 3. 备份（决策依据解包内容，杜绝用任何汉化包覆盖官方备份；所有 copy 加 EBUSY 容错）
    let _safeCopy = (src, dst, label) => {
        try { fs.copyFileSync(src, dst); return true; } catch (e) {
            console.warn(`[警告] ${label} 失败（${e.code||e.message}），将尝试增量路径: ${e.message}`);
            return false;
        }
    };
    if (!fs.existsSync(bakPath)) {
        if (hanhuaState !== 'clean') {
            console.warn(`[警告] 当前为汉化版但未找到官方备份 app.asar.bak，无法创建可靠的卸载还原依据。`);
            console.warn(`[警告] 继续注入（不创建备份）。如需恢复官方英文，请重新安装官方 Antigravity 客户端。`);
        } else {
            console.log(`[备份] 正在创建官方原始包备份: app.asar.bak ...`);
            if (_safeCopy(asarPath, bakPath, '创建备份')) console.log(`[备份] 备份成功！`);
            else console.warn(`[警告] 备份创建失败，继续注入但卸载还原将不可用。`);
        }
    } else if (hanhuaState !== 'clean') {
        // 当前 app.asar 是汉化版（新版或旧版），还原官方备份并重新提取纯净原版，实现无污染注入
        if (_safeCopy(bakPath, asarPath, '还原官方备份')) {
            console.log(`[还原] 已重置当前 app.asar 为官方原始备份包，正在重新提取官方原版...`);
            fs.rmSync(tempDir, { recursive: true, force: true });
            let reExtract = null;
            try {
                const localAsar = path.join(__dirname, 'node_modules', '.bin', process.platform === 'win32' ? 'asar.cmd' : 'asar');
                if (fs.existsSync(localAsar)) {
                    reExtract = runCommandSync(`"${localAsar}" extract "${bakPath}" "${tempDir}"`);
                }
            } catch(_){}
            if (!reExtract || !reExtract.success) {
                reExtract = runCommandSync(`npx -y @electron/asar extract "${bakPath}" "${tempDir}"`);
            }
            if (reExtract && reExtract.success && fs.existsSync(tempDir)) {
                console.log(`[解包] 官方原版解包完成，已就绪纯净基座！`);
            } else {
                console.warn(`[警告] 官方原版解包未完全成功，将继续当前注入流程。`);
            }
        } else {
            console.log(`[提示] 当前 app.asar 被锁定（可能是客户端正在运行），将使用当前包进行增量注入。`);
        }
    } else {
        // 当前是官方原版：对比 hash 判断是否升级过
        let currentHash, bakHash;
        try { currentHash = hashFile(asarPath); bakHash = hashFile(bakPath); } catch(e) { currentHash = ''; bakHash = 'x'; }
        if (currentHash !== bakHash) {
            // 防呆：更新备份前再次确认当前包完好（hash 不同可能意味着上一轮打包失败留下了损坏的包）
            if (!isValidAsar(asarPath)) {
                console.error(`[错误] 当前 app.asar 不是有效的 asar 包，已中止操作以保护官方备份 app.asar.bak。请重新安装官方客户端后重试。`);
                try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch(_){}
                return false;
            }
            console.log(`[检测] 检测到 Antigravity 已更新，正在更新官方备份 app.asar.bak ...`);
            if (_safeCopy(asarPath, bakPath, '更新备份')) console.log(`[备份] 官方备份已更新！`);
            else console.warn(`[警告] 备份更新失败，继续使用旧备份。`);
        } else {
            console.log(`[检测] app.asar 与官方备份一致，直接进行注入...`);
        }
    }

    // 3. 解析主入口（自适应：与 detectHanhuaState 共用同一解析，保证检测与注入位置永远一致）
    const mainJsPath = resolveMainEntry(tempDir);

    // core 模块写到 main.js 同目录，保证 require('./antigravity_i18n_core.js') 始终相对正确
    const coreJsPath = path.join(path.dirname(mainJsPath), "antigravity_i18n_core.js");
    console.log(`[生成] 正在构建全局单点拦截核心模块 antigravity_i18n_core.js ...`);
    const coreJsContent = generateI18nCoreJs();
    fs.writeFileSync(coreJsPath, coreJsContent, 'utf-8');

    // 4. 注入 main.js (单点全局切入)
    if (!fs.existsSync(mainJsPath)) {
        console.error(`[错误] 解包产物中未找到主入口 ${mainEntry}，官方包结构可能已变化。已中止，避免生成无效的汉化包。`);
        fs.rmSync(tempDir, { recursive: true, force: true });
        return false;
    }
    console.log(`[修改] 正在向 main.js 注入单点全局拦截挂钩...`);
    let mainContent = fs.readFileSync(mainJsPath, 'utf-8');
    mainContent = cleanMainJsContent(mainContent);
    if (mainContent.includes('"use strict";')) {
        mainContent = mainContent.replace('"use strict";', '"use strict";\nrequire(\'./antigravity_i18n_core.js\');');
    } else {
        mainContent = 'require(\'./antigravity_i18n_core.js\');\n' + mainContent;
    }
    fs.writeFileSync(mainJsPath, mainContent, 'utf-8');
    console.log(`[修改] main.js 挂钩注入成功！`);

    // 5. 注入 preload.js (用于主窗口渲染前零闪烁即时汉化)
    const preloadPath = path.join(tempDir, "dist", "preload.js");
    if (fs.existsSync(preloadPath)) {
        console.log(`[修改] 正在向 preload.js 注入渲染层即时汉化引擎...`);
        let content = fs.readFileSync(preloadPath, 'utf-8');
        const cleanedContent = cleanJsContent(content);
        const translationJs = generateJs();
        const newContent = cleanedContent + "\n" + translationJs;
        fs.writeFileSync(preloadPath, newContent, 'utf-8');
        console.log(`[修改] preload.js 注入成功！`);
    } else {
        console.warn(`[警告] 未找到 dist/preload.js，将仅依赖 executeJavaScript 注入（页面渲染初期可能出现英文闪烁）。`);
    }

    // 6. 清理可能遗留的历史多点补丁（确保旧版本升级至单点架构时保持绝对干净）
    const legacyFiles = [
        { path: path.join(tempDir, "dist", "menu.js"), cleaner: cleanMenuJsContent },
        { path: path.join(tempDir, "dist", "tray.js"), cleaner: cleanTrayJsContent }
    ];
    for (const item of legacyFiles) {
        if (fs.existsSync(item.path)) {
            let fileContent = fs.readFileSync(item.path, 'utf-8');
            let cleaned = item.cleaner(fileContent);
            if (cleaned !== fileContent) {
                fs.writeFileSync(item.path, cleaned, 'utf-8');
            }
        }
    }

    // 7. 重新打包（优先本地 asar）
    console.log(`[打包] 正在将修改后的内容打包回 app.asar...`);
    let packRes = null;
    try {
        const localAsar = path.join(__dirname, 'node_modules', '.bin', process.platform === 'win32' ? 'asar.cmd' : 'asar');
        if (fs.existsSync(localAsar)) {
            packRes = runCommandSync(`"${localAsar}" pack "${tempDir}" "${asarPath}"`);
        }
    } catch(_){}
    if (!packRes || !packRes.success) {
        packRes = runCommandSync(`npx -y @electron/asar pack "${tempDir}" "${asarPath}"`);
    }

    if (!packRes.success) {
        console.error(`[错误] 打包失败。`);
        console.error(`详情: ${packRes.stderr}\n${packRes.stdout}`);
        console.error(`[保留] 临时目录未清理（${tempDir}），可手动检查解包产物；app.asar 未变动，官方备份 app.asar.bak 完好。`);
        return false;
    }

    // 打包成功后校验结果，防止写入了损坏的 asar
    if (!isValidAsar(asarPath)) {
        console.error(`[错误] 打包结果校验失败：生成的 app.asar 不是有效的 asar 包。`);
        console.error(`[恢复] 正在从官方备份 app.asar.bak 恢复...`);
        try {
            fs.copyFileSync(bakPath, asarPath);
            console.error(`[恢复] 已从 app.asar.bak 恢复 app.asar，官方备份仍然完好。`);
        } catch (e) {
            console.error(`[恢复] 恢复失败：${e.message}。请手动将 app.asar.bak 复制为 app.asar。`);
        }
        console.error(`[保留] 临时目录未清理（${tempDir}），可手动检查解包产物。`);
        return false;
    }

    // 8. 清理临时文件夹
    fs.rmSync(tempDir, { recursive: true, force: true });

    console.log(`[√] Antigravity 2.0+ 单点全局拦截汉化部署完成！`);
    return true;
}


function restore20(resourcesDir) {
    const asarPath = path.join(resourcesDir, "app.asar");
    const bakPath = path.join(resourcesDir, "app.asar.bak");

    if (!fs.existsSync(bakPath)) {
        console.log("[!] 未找到备份文件 app.asar.bak，可能尚未安装过汉化或备份被删除。");
        if (isHanhuaAsar(asarPath)) {
            console.log("[提示] 检测到当前 app.asar 仍为汉化版，但官方备份已丢失。");
            console.log("[建议] 请重新安装官方 Antigravity 客户端覆盖后重试，或从其他途径恢复官方 app.asar。");
        }
        return false;
    }

    console.log("[还原] 正在用官方备份文件恢复...");
    // 防呆：备份本身损坏时直接中止，绝不能把损坏数据写入当前 app.asar 导致客户端无法启动
    if (!isValidAsar(bakPath)) {
        console.error(`[错误] 备份文件 app.asar.bak 不是有效的 asar 包，已中止还原以避免损坏客户端。`);
        console.error(`[建议] 请重新安装官方 Antigravity 客户端覆盖恢复。`);
        return false;
    }
    try {
        fs.copyFileSync(bakPath, asarPath);
    } catch (e) {
        console.error(`[错误] 恢复失败（文件可能被占用）: ${e.message}`);
        return false;
    }
    try {
        fs.unlinkSync(bakPath);
    } catch (e) {
        console.warn(`[警告] 备份文件删除失败（可稍后手动删除 app.asar.bak）: ${e.message}`);
    }
    console.log("[√] 官方 app.asar 已成功恢复！");
    return true;
}

// ==========================================
// 入口
// ==========================================
// 安装/卸载日志落盘：双击 bat 运行时窗口关闭后控制台日志即丢失，写入文件便于事后排查
function initFileLog() {
    try {
        const LOG_FILE = path.join(__dirname, '_install_log.txt');
        fs.writeFileSync(LOG_FILE, `===== Antigravity 汉化 ${new Date().toLocaleString()} =====\n`, 'utf8');
        const origLog = console.log.bind(console);
        const origErr = console.error.bind(console);
        const origWarn = console.warn && console.warn.bind(console);
        const write = (args) => { try { fs.appendFileSync(LOG_FILE, args.join(' ') + '\n', 'utf8'); } catch (e) {} };
        console.log = (...a) => { origLog(...a); write(a); };
        console.error = (...a) => { origErr(...a); write(a); };
        if (origWarn) console.warn = (...a) => { origWarn(...a); write(a); };
    } catch (e) { /* 日志失败不影响主流程 */ }
}

function main() {
    initFileLog();
    try {
    let huifu = false;
    let manualDir = "";
    let noKill = false;

    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--huifu') {
            huifu = true;
        } else if (args[i] === '--install-dir') {
            manualDir = args[i + 1] || "";
            i++;
        } else if (args[i] === '--no-kill') {
            noKill = true;
        } else if (args[i] === '--brand-title') {
            i++;
        }
    }

    // 1. 探测路径
    const installDir = detectInstallationDir(manualDir);
    
    // 2. 检测客户端是否正在运行，并根据参数决定是否关闭以解除文件锁定
    wasAppRunning = checkIfAppIsRunning();
    if (noKill) {
        console.log("[跳过] 检测到 --no-kill 参数，跳过关闭 Antigravity 运行进程。");
    } else {
        closeAntigravityProcesses();
    }

    // 3. 找到 resources 资源目录
    let resourcesDir = "";
    if (fs.existsSync(path.join(installDir, "resources"))) {
        resourcesDir = path.join(installDir, "resources");
    } else if (installDir.replace(/\\/g, "/").replace(/\/$/, "").toLowerCase().endsWith("/resources")) {
        resourcesDir = installDir;
    } else {
        if (fs.existsSync(path.join(installDir, "app.asar"))) {
            resourcesDir = installDir;
        } else {
            resourcesDir = path.join(installDir, "resources");
        }
    }

    if (!fs.existsSync(resourcesDir)) {
        console.error(`[错误] 无法定位有效的资源(resources)目录: ${resourcesDir}`);
        process.exit(1);
    }

    // 4. 执行汉化或还原
    const asarPath = path.join(resourcesDir, "app.asar");
    if (!fs.existsSync(asarPath)) {
        console.error(`[错误] 未在资源目录中找到核心包 app.asar: ${resourcesDir}`);
        process.exit(1);
    }

    let success = false;
    if (huifu) {
        console.log("====== 正在卸载中文汉化，恢复官方原版 ======");
        success = restore20(resourcesDir);
    } else {
        console.log("====== 正在安装 Antigravity 中文汉化 ======");
        success = install20(resourcesDir);
    }

    // 5. 校验通过且原来客户端在运行，则自动重新启动客户端
    if (success && wasAppRunning) {
        console.log("\n[启动] 检测到安装前反重力客户端处于开启状态，正在重新启动客户端...");
        try {
            const exePath = path.join(installDir, 'Antigravity.exe');
            if (fs.existsSync(exePath)) {
                const child = child_process.spawn(exePath, [], {
                    detached: true,
                    stdio: 'ignore'
                });
                child.unref();
                console.log("[启动] 客户端启动成功！");
            } else {
                console.warn(`[警告] 未找到客户端主程序: ${exePath}`);
            }
        } catch (e) {
            console.warn(`[警告] 客户端启动失败: ${e.message}`);
        }
    }

    if (!success) {
        process.exit(1);
    }
    } catch (e) {
        console.error(`[错误] 发生未预期异常: ${e && e.message ? e.message : e}`);
        if (e && e.stack) console.error(e.stack);
        process.exit(1);
    }
}

// 导出模块方法供测试及外部安全调用，避免任何外部引用副作用
module.exports = {
    generateJs,
    generateI18nCoreJs,
    loadDictionary,
    detectInstallationDir,
    install20,
    restore20,
    main
};

if (require.main === module) {
    main();
}
