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

function generateJs(preloadedDict) {
    const fullDict = preloadedDict || loadDictionary();
    const dictJson = JSON.stringify(fullDict);

    const jsSource = `${SIGNATURE_START}
(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const rootEl = document.documentElement;
    if (!rootEl) return;

    // 单实例互斥锁：通过在根节点设置标记与全局变量，防止 preload 与 main world 重复初始化双重 MutationObserver
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

    // 排版护盾样式：为按钮、菜单与气泡添加 nowrap/keep-all 规则，防止中文字符由于容器折行计算异常断字
    try {
        if (!document.getElementById('ag-chinese-layout-guard')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'ag-chinese-layout-guard';
            styleEl.textContent = [
                '/* 模型选择器微调 */',
                'button[data-testid="model-selector-trigger"] span.opacity-70 { margin-left: 0.25rem !important; }',
                '/* 全局操作按钮、快捷键浮层、气泡与菜单项防中文断字折行 */',
                'button, [role="button"], [role="menuitem"], [role="tooltip"], [role="tab"] { word-break: keep-all !important; flex-shrink: 0 !important; }',
                'button:not([class*="card"]):not([class*="item-large"]), [role="button"]:not([class*="card"]) { white-space: nowrap !important; }'
            ].join('\\n');
            (document.head || document.documentElement).appendChild(styleEl);
        }
    } catch (e) {}

    const map = new Map(Object.entries(DICT_PLACEHOLDER));
    const lowerMap = new Map();
    for (const [k, v] of map.entries()) lowerMap.set(k.toLowerCase(), v);
    
    const translatedValues = new WeakMap();
    let isMutating = false;

    // 标签级免翻白名单：包含脚本、样式、代码、多媒体、SVG 与表单输入标签，TreeWalker 遇到时整树跳过
    const BLOCKED_TAGS = new Set([
        'SCRIPT', 'STYLE', 'CODE', 'PRE', 'INPUT', 'TEXTAREA', 'SVG', 'CANVAS', 
        'SYMBOL', 'PATH', 'KBD', 'SAMP', 'VAR', 'TEMPLATE', 'MATH', 'AUDIO', 'VIDEO', 
        'SOURCE', 'TRACK', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT'
    ]);

    // AI 流式正文与思维链容器选择器：匹配 Markdown 排版与推导推断容器，保护 AI 生成内容原样输出
    const AI_STREAM_PROSE_SELECTOR = [
        '.animate-markdown',
        '.md-divider-spacing',
        '.prose',
        '.markdown-body',
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
        '[data-is-streaming] .prose',
        '[data-streaming] .prose',
        '[data-is-generating] .prose'
    ].join(', ');

    // 编辑器代码视口、终端字符屏与用户输入选择器：保护代码编辑区与命令行字符流不被篡改
    const FORBIDDEN_SUBTREE_SELECTOR = [
        // Monaco / VS Code / Diff 代码行视口（释放边距槽.margin加号气泡与面包屑）
        '.lines-content', '[class*="lines-content"]', '.view-lines', '[class*="view-lines"]', '.view-line', '[class*="view-line"]',
        '[data-mode-id] .lines-content', '[data-mode-id] .view-lines', '[data-mode-id] .view-line',
        '.monaco-diff-editor .lines-content', '.monaco-editor .lines-content',
        '.decorationsOverviewRuler', '.suggest-widget .monaco-list', '.parameter-hints-widget',
        // CodeMirror 5 & 6 代码容器
        '.cm-content', '[class*="cm-content"]', '.cm-line', '[class*="cm-line"]', '.cm-editor .cm-scroller',
        '.CodeMirror-lines', '.CodeMirror-line', '.CodeMirror-code',
        // Ace Editor 代码容器
        '.ace_content', '.ace_line', '[class*="ace_line"]', '.ace_layer', '.ace_text-layer',
        // 通用 Markdown 与 HTML 语法高亮代码块
        'pre', 'code', 'kbd', 'samp', 'var',
        '.hljs', '.hljs-line', '[class*="hljs-"]', 'code[class*="language-"]', 'pre[class*="language-"]', '[class*="shiki"]',
        '.code-block pre', '.code-block code', '.code-line', '.line-content',
        // 终端字符输出容器（保护字符流输出，释放外层工具栏按钮）
        '.xterm-screen', '.xterm-rows', '.xterm-row', '.xterm-accessibility', '.xterm-accessibility-tree',
        '[class*="terminal-screen"]', '[class*="terminal-rows"]',
        // 用户表单输入控件（保护用户输入文本，释放外层操作按钮）
        'input', 'textarea', '[contenteditable="true"]', '[role="textbox"]', '[role="searchbox"]',
        // 公式、免翻标记、矢量图与模板
        '.katex', '.katex-html', '[translate="no"]', '.notranslate', 'svg', 'math', 'template',
        // 交付件内部正文与代码块
        '[class*="artifact-markdown"] pre', '[class*="artifact-markdown"] code',
        '[class*="artifact-code"] .lines-content', '[class*="artifact-code"] pre', '[class*="artifact-code"] code',
        '[class*="artifact-preview"] .lines-content', '[class*="artifact-preview"] pre', '[class*="artifact-preview"] code',
        '[class*="artifact-content"] pre', '[class*="artifact-content"] code',
        '[class*="artifact-body"] pre', '[class*="artifact-body"] code',
        '[class*="artifact-details"] pre', '[class*="artifact-details"] code',
        // 用户提问段落与原始代码块
        '[class*="user-input-step"] .whitespace-pre-wrap',
        '[data-turn-role="user"] .whitespace-pre-wrap',
        '[data-message-author="user"] .whitespace-pre-wrap',
        '[data-turn-role="user"] pre', '[data-turn-role="user"] code',
        // 用户自定义历史会话标题
        'a[href*="/c/"] [class*="truncate"]',
        '[data-testid*="conversation-item"] [class*="truncate"]',
        // 工具调用内部具体命令执行输出
        '[class*="tool-call-details"] pre', '[class*="tool-call-details"] code',
        '[data-testid*="tool-call-content"] pre', '[data-testid*="tool-call-content"] code',
        '[class*="tool-call-result"]', '[class*="terminal-output"]'
    ].join(', ');

    // 合并禁区与流式选择器：供 TreeWalker 与 MutationObserver 执行单次 matches/closest 判定
    const ALL_BLOCKED_SELECTOR = FORBIDDEN_SUBTREE_SELECTOR + ', ' + AI_STREAM_PROSE_SELECTOR;

    // 漏译采集池：用于记录非禁区未命中字典的英文文本，供 CDP 自动化工具导出
    const missedTexts = new Set();
    const MISSED_TEXTS_MAX = 5000;

    function norm(s) {
        if (!s || typeof s !== 'string') return '';
        return s.replace(/\\s+/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').trim();
    }

    function lookup(s) {
        if (!s) return null;
        const n = norm(s);
        if (!n) return null;
        return map.get(n) || lowerMap.get(n.toLowerCase()) || null;
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
        const items = listStr.split(/,\\s+(?=\\d)/);
        return items.map(s => translateCountItem(s.trim())).join('、');
    }

    function translateTaskTarget(target) {
        if (!target) return '';
        const trans = lookup(target);
        if (trans) return trans;
        const normT = norm(target);
        const taskMatch = normT.match(/^task-([a-zA-Z0-9_-]+)$/i);
        if (taskMatch) return '任务 ' + taskMatch[1];
        return target;
    }

    function translateWithShortcut(val) {
        if (!val) return null;
        const match = val.match(/^(.+?)\\s*\\((Ctrl|Cmd|Alt|Shift|⌘|⌥|⇧|⌃)\\+?([^)]*)\\)$/i);
        if (match) {
            const transPref = lookup(match[1]);
            if (transPref) return transPref + " (" + match[2] + (match[3] ? "+" + match[3] : "") + ")";
        }
        const countMatch = val.match(/^(.+?)\\s*\\(([0-9]+)\\)$/);
        if (countMatch) {
            const transPref = lookup(countMatch[1]);
            if (transPref) return transPref + " (" + countMatch[2] + ")";
        }
        // 单字母缩写后缀：如 "Medium (M)" / "Low (L)" / "High (H)"
        const letterMatch = val.match(/^(.+?)\\s*\\(([A-Za-z]{1,2})\\)$/);
        if (letterMatch) {
            const transPref = lookup(letterMatch[1]);
            if (transPref) return transPref + " (" + letterMatch[2] + ")";
        }
        const symbolMatch = val.match(/^([+•*>\-])\\s+(.+)$/);
        if (symbolMatch) {
            const transContent = lookup(symbolMatch[2]);
            if (transContent) return symbolMatch[1] + " " + transContent;
        }
        return null;
    }

    // Task 状态动作前缀映射表：用于匹配并转换任务状态机动作词
    const TASK_VERB_ACTIONS = {
        'checked': '已检查任务 ',
        'checking': '正在检查任务 ',
        'killed': '已终止任务 ',
        'killing': '正在终止任务 ',
        'started': '已启动任务 ',
        'starting': '正在启动任务 ',
        'paused': '已暂停任务 ',
        'pausing': '正在暂停任务 ',
        'resumed': '已恢复任务 ',
        'resuming': '正在恢复任务 ',
        'created': '已创建任务 ',
        'creating': '正在创建任务 ',
        'sent input to': '已向任务发送输入 ',
        'sending input to': '正在向任务发送输入 '
    };

    // 动态句式翻译器：通过正则与结构提取，匹配带变量、计数、时长或动态状态的 UI 文本
    function translateDynamicText(valNorm, originalVal, node) {
        if (/^Refreshes in (.+?)$/i.test(valNorm)) {
            return valNorm.replace(/^Refreshes in (.+?)$/i, (match, timeStr) => {
                let tTrans = timeStr.trim()
                    .replace(/(\\d+)\\s*days?/gi, '$1 天')
                    .replace(/(\\d+)\\s*hours?/gi, '$1 小时')
                    .replace(/(\\d+)\\s*minutes?/gi, '$1 分钟')
                    .replace(/(\\d+)\\s*seconds?/gi, '$1 秒')
                    .replace(/,\\s*/g, ' ')
                    .replace(/\\s+/g, ' ');
                return tTrans + "后刷新";
            });
        }
        if (/^You have used some of your (.+?) limit, it will fully refresh in (.+?)\\.?$/i.test(valNorm)) {
            return valNorm.replace(/^You have used some of your (.+?) limit, it will fully refresh in (.+?)\\.?$/i, (match, limitType, timeStr) => {
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
                if (lTrans === "每周" || lTrans === "每日" || lTrans === "每月") prefix += lTrans;
                else prefix += " " + lTrans;
                return prefix + "限制，将在 " + tTrans + "后完全刷新。";
            });
        }
        if (/^Learn more about (.+)$/i.test(valNorm)) {
            return valNorm.replace(/^Learn more about (.+)$/i, (match, p) => {
                const trans = lookup(p);
                if (trans) return "了解更多关于 " + trans;
                const pLower = p.toLowerCase();
                let translatedPreset = p;
                if (pLower.includes('inherit general')) translatedPreset = "继承通用设置 (Inherit General)";
                else if (pLower.includes('inherit project')) translatedPreset = "继承项目设置 (Inherit Project)";
                else if (pLower.includes('inherit global')) translatedPreset = "继承全局设置 (Inherit Global)";
                return "了解更多关于 " + translatedPreset;
            });
        }
        if (/^Timed\\s+(\\d+)\\s*(seconds?|minutes?|hours?|s|mins?|hrs?|ms)$/i.test(valNorm)) {
            return valNorm.replace(/^Timed\\s+(\\d+)\\s*(seconds?|minutes?|hours?|s|mins?|hrs?|ms)$/i, (m, num, unit) => {
                let uCn = '秒';
                const uLower = unit.toLowerCase();
                if (uLower.startsWith('m') && !uLower.startsWith('ms')) uCn = '分钟';
                else if (uLower.startsWith('h')) uCn = '小时';
                else if (uLower === 'ms') uCn = '毫秒';
                return '计时 ' + num + ' ' + uCn;
            });
        }
        if (/^Status:\\s*(.+)$/i.test(valNorm)) {
            return valNorm.replace(/^Status:\\s*(.+)$/i, (m, st) => {
                const stNorm = norm(st);
                let stCn = lookup(stNorm) || st;
                const stLower = stNorm.toLowerCase();
                if (stLower === 'fired') stCn = '已触发';
                else if (stLower === 'running') stCn = '运行中';
                else if (stLower === 'completed') stCn = '已完成';
                else if (stLower === 'cancelled') stCn = '已取消';
                else if (stLower === 'failed') stCn = '失败';
                return '状态：' + stCn;
            });
        }
        if (/^The command exited with code\\s+(\\d+)(?:\\.\\s*Output:\\s*(.*))?$/i.test(valNorm)) {
            return valNorm.replace(/^The command exited with code\\s+(\\d+)(?:\\.\\s*Output:\\s*(.*))?$/i, (m, code, out) => {
                if (out !== undefined) return '命令已退出，退出码 ' + code + '。输出：' + out;
                return '命令已退出，退出码 ' + code;
            });
        }
        if (/^(.+?)\\s+finished$/i.test(valNorm)) {
            return valNorm.replace(/^(.+?)\\s+finished$/i, (m, prefix) => {
                const pCn = lookup(prefix) || prefix;
                return pCn + ' 已完成';
            });
        }
        if (/^(?:Commit\\s+)?(\\d+)\\s+file\\s+changes\\s+to(?:\\s+(.*))?$/i.test(valNorm)) {
            return valNorm.replace(/^(?:Commit\\s+)?(\\d+)\\s+file\\s+changes\\s+to(?:\\s+(.*))?$/i, (m, count, branch) => {
                if (branch) return '提交 ' + count + ' 个文件更改至 ' + branch;
                return '提交 ' + count + ' 个文件更改至';
            });
        }
        if (/^file\\s+changes\\s+to(?:\\s+(.*))?$/i.test(valNorm)) {
            return valNorm.replace(/^file\\s+changes\\s+to(?:\\s+(.*))?$/i, (m, branch) => {
                if (branch) return '个文件更改至 ' + branch;
                return '个文件更改至';
            });
        }
        if (valNorm.toLowerCase() === 'to' && node && node.parentElement) {
            const pText = node.parentElement.textContent || '';
            if (/master|main|branch|changes|commit|更改|提交/i.test(pText)) {
                return (originalVal || 'to').replace(/\\bto\\b/i, '至');
            }
        }
        if (/^Inherits your (.+?) settings(.*)$/i.test(valNorm)) {
            return valNorm.replace(/^Inherits your (.+?) settings(.*)$/i, (match, cat, rest) => {
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
        }
        if (/^(\\d+)% of the customization budget is available\\.?$/i.test(valNorm)) {
            return valNorm.replace(/^(\\d+)% of the customization budget is available\\.?$/i, '$1% 的定制预算可用。');
        }
        if (/^Send feedback as (.+)$/i.test(valNorm)) {
            return valNorm.replace(/^Send feedback as (.+)$/i, '以 $1 身份发送反馈');
        }
        if (/^Your Plan:\\s*(.+)$/i.test(valNorm)) {
            return valNorm.replace(/^Your Plan:\\s*(.+)$/i, '您的计划：$1');
        }
        // 合并：Yes, and always allow '...' (含可选 in this project)
        if (/^Yes, and always allow '(.+?)'( in this project)?$/i.test(valNorm)) {
            return valNorm.replace(/^Yes, and always allow '(.+?)'( in this project)?$/i, (match, cmd, inProj) => {
                return "是，且" + (inProj ? "在此项目中始终允许运行 '" : "始终允许运行 '") + cmd + "'";
            });
        }
        if (/^(\\d+) tools? enabled$/i.test(valNorm)) {
            return valNorm.replace(/^(\\d+) tools? enabled$/i, '$1 个工具已启用');
        }
        if (/^Show (\\d+) more(\\.\\.\\.|…)?$/i.test(valNorm)) {
            return valNorm.replace(/^Show (\\d+) more(\\.\\.\\.|…)?$/i, '显示另外 $1 个...');
        }
        // 合并：Show / Hide (all) N breakdowns
        if (/^(Show|Hide)(?:\\s+(all))?\\s+(\\d+)\\s+breakdowns?$/i.test(valNorm)) {
            return valNorm.replace(/^(Show|Hide)(?:\\s+(all))?\\s+(\\d+)\\s+breakdowns?$/i, (match, action, all, num) => {
                const isShow = action.toLowerCase() === 'show';
                return (isShow ? '显示' : '隐藏') + (all ? '全部 ' : ' ') + num + ' 个细目';
            });
        }
        if (/^(Rules|Skills):\\s*([\\d,]+)\\s*tokens$/i.test(valNorm)) {
            return valNorm.replace(/^(Rules|Skills):\\s*([\\d,]+)\\s*tokens$/i, (m, type, num) => {
                const t = type.toLowerCase() === 'rules' ? '规则' : '技能';
                return t + '：' + num + ' tokens';
            });
        }
        if (/^Media \\((Today|Yesterday)\\s+(\\d{1,2}:\\d{2})\\s*(AM|PM)?\\)$/i.test(valNorm)) {
            return valNorm.replace(/^Media \\((Today|Yesterday)\\s+(\\d{1,2}:\\d{2})\\s*(AM|PM)?\\)$/i, (m, day, time, ap) => {
                const d = day.toLowerCase() === 'today' ? '今天' : '昨天';
                return '媒体 (' + d + ' ' + time + (ap ? ' ' + ap : '') + ')';
            });
        }
        if (/^Select model, current: (.+)$/i.test(valNorm)) {
            return valNorm.replace(/^Select model, current: (.+)$/i, '选择模型，当前：$1');
        }
        if (/^Refresh (MCP servers|quota and credits data)$/i.test(valNorm)) {
            return valNorm.replace(/^Refresh (MCP servers|quota and credits data)$/i, (m, t) => {
                if (t.toLowerCase() === 'mcp servers') return '刷新 MCP 服务器';
                return '刷新配额与额度数据';
            });
        }
        if (/^Skills providing tailored instructions for happy path (.+?) development workflows\\.?$/i.test(valNorm)) {
            return valNorm.replace(/^Skills providing tailored instructions for happy path (.+?) development workflows\\.?$/i, (match, lang) => {
                let translatedLang = lang;
                if (lang.toLowerCase() === 'dart and flutter') translatedLang = "Dart 和 Flutter";
                return "提供为 " + translatedLang + " 的顺畅 (Happy Path) 开发流程量身定制的技能指令。";
            });
        }
        if (/^(Worked|Working) for (\\d+)(s|m|h|d|w|mo|yr)?$/i.test(valNorm)) {
            return valNorm.replace(/^(Worked|Working) for (\\d+)(s|m|h|d|w|mo|yr)?$/i, (match, verb, num, unit) => {
                return "已工作 " + num + " " + unitToCn(unit);
            });
        }
        if (/^Thinking \\(?(\\d+)(s|m|h|d|w|mo|yr)?\\)?(\\.{1,3}|…)?$/i.test(valNorm)) {
            return valNorm.replace(/^Thinking \\(?(\\d+)(s|m|h|d|w|mo|yr)?\\)?(\\.{1,3}|…)?$/i, (match, num, unit, dots) => {
                return "思考中 (" + num + " " + unitToCn(unit) + ")" + (dots || "…");
            });
        }
        if (/^Waiting for (.+?)(\\.{1,3}|…)?$/i.test(valNorm)) {
            return valNorm.replace(/^Waiting for (.+?)(\\.{1,3}|…)?$/i, (match, target, dots) => {
                let t = target.trim().toLowerCase();
                let trans = target;
                if (t === 'input') trans = "输入";
                else if (t === 'user') trans = "用户";
                else if (t === 'tool' || t === 'tools') trans = "工具";
                else if (t === 'agent' || t === 'agents') trans = "智能体";
                return "等待 " + trans + " 中...";
            });
        }
        if (/^Thinking for (\\d+)(s|m|h|d|w|mo|yr)?(\\.{0,3}|…)?$/i.test(valNorm)) {
            return valNorm.replace(/^Thinking for (\\d+)(s|m|h|d|w|mo|yr)?(\\.{0,3}|…)?$/i, (match, num, unit, dots) => {
                return "已思考 " + num + " " + unitToCn(unit) + (dots || "");
            });
        }
        if (/^Running for (\\d+)(s|m|h|d|w|mo|yr)?$/i.test(valNorm)) {
            return valNorm.replace(/^Running for (\\d+)(s|m|h|d|w|mo|yr)?$/i, (match, num, unit) => {
                return "已运行 " + num + " " + unitToCn(unit);
            });
        }
        if (/^Executing for (\\d+)(s|m|h|d|w|mo|yr)?$/i.test(valNorm)) {
            return valNorm.replace(/^Executing for (\\d+)(s|m|h|d|w|mo|yr)?$/i, (match, num, unit) => {
                return "已执行 " + num + " " + unitToCn(unit);
            });
        }
        if (/^Thought for (\\d+)(s|m|h)?$/i.test(valNorm)) {
            return valNorm.replace(/^Thought for (\\d+)(s|m|h)?$/i, (match, num, unit) => {
                return "思考了 " + num + " " + unitToCn(unit);
            });
        }
        if (/^(?:Ran|Running)\\s+(\\d+)\\s+commands?$/i.test(valNorm)) {
            return valNorm.replace(/^(Ran|Running)\\s+(\\d+)\\s+commands?$/i, (m, verb, num) => {
                return (verb.toLowerCase() === 'running' ? "正在运行 " : "已运行 ") + num + " 条命令";
            });
        }
        if (/^Ran\\s+(.+)$/i.test(valNorm)) {
            return valNorm.replace(/^Ran\\s+(.+)$/i, (match, prefix) => {
                let isWorking = / Working\\.\\.\\.$/i.test(prefix);
                let cleanPrefix = prefix.replace(/ Working\\.\\.\\.$/i, '');
                let trans = translateCountList(cleanPrefix);
                return (isWorking ? "正在执行 " : "已执行 ") + trans + (isWorking ? " 正在处理..." : "");
            });
        }
        if (/^Searched\\s+(.+)$/i.test(valNorm)) {
            return valNorm.replace(/^Searched\\s+(.+)$/i, (match, body) => {
                let res = body.replace(/(\\d+)\\s+results?/i, '$1 个结果').replace(/(\\d+)\\s+result/i, '$1 个结果');
                return "已搜索 " + res;
            });
        }
        // 任务状态动词：14 个分支统一合并
        const taskVerbMatch = valNorm.match(/^(Checked|Checking|Killed|Killing|Started|Starting|Paused|Pausing|Resumed|Resuming|Created|Creating|Sent input to|Sending input to)\\s+task\\s+(.+)$/i);
        if (taskVerbMatch) {
            const actionKey = taskVerbMatch[1].toLowerCase();
            const prefix = TASK_VERB_ACTIONS[actionKey] || (taskVerbMatch[1] + ' task ');
            return prefix + translateTaskTarget(taskVerbMatch[2]);
        }
        if (/^Checked (.+)$/i.test(valNorm)) {
            return valNorm.replace(/^Checked (.+)$/i, (match, prefix) => {
                let isWorking = / Working\\.\\.\\.$/i.test(prefix);
                let cleanPrefix = prefix.replace(/ Working\\.\\.\\.$/i, '');
                let trans = translateCountList(cleanPrefix);
                return (isWorking ? "正在检查 " : "已检查 ") + trans + (isWorking ? "..." : "");
            });
        }
        if (/^Checking (.+)$/i.test(valNorm)) {
            return valNorm.replace(/^Checking (.+)$/i, (match, prefix) => {
                return "正在检查 " + translateCountList(prefix);
            });
        }
        if (/^Killed (.+)$/i.test(valNorm)) {
            return valNorm.replace(/^Killed (.+)$/i, (match, prefix) => {
                let isWorking = / Working\\.\\.\\.$/i.test(prefix);
                let cleanPrefix = prefix.replace(/ Working\\.\\.\\.$/i, '');
                let trans = translateCountList(cleanPrefix);
                return (isWorking ? "正在终止 " : "已终止 ") + trans + (isWorking ? "..." : "");
            });
        }
        if (/^Killing (.+)$/i.test(valNorm)) {
            return valNorm.replace(/^Killing (.+)$/i, (match, prefix) => {
                return "正在终止 " + translateCountList(prefix);
            });
        }
        if (/^Run (.+)$/i.test(valNorm)) {
            return valNorm.replace(/^Run (.+)$/i, (match, prefix) => {
                if (/^command finished$/i.test(prefix)) return "命令执行完成";
                if (/^task finished$/i.test(prefix)) return "任务执行完成";
                let trans = translateCountList(prefix);
                if (trans !== prefix) return "运行 " + trans;
                return "运行 " + translateTaskTarget(prefix);
            });
        }
        if (/^Load older messages, showing (\\d+) of (\\d+)$/i.test(valNorm)) {
            return valNorm.replace(/^Load older messages, showing (\\d+) of (\\d+)$/i, '加载更早的消息，当前显示 $1 / $2');
        }
        if (/^(\\d+) files? changed(\\s*\\+\\d+\\s*-\\d+)?$/i.test(valNorm)) {
            return valNorm.replace(/^(\\d+) files? changed(\\s*\\+\\d+\\s*-\\d+)?$/i, (match, num, diff) => {
                return num + " 个文件已改动" + (diff || "");
            });
        }
        // 合并：subagents / tasks running
        const subagentsMatch = valNorm.match(/^(\\d+)\\s+(subagents?\\/tasks?|subagents?|tasks?)\\s+running$/i);
        if (subagentsMatch) {
            const num = subagentsMatch[1];
            const targetType = subagentsMatch[2].toLowerCase();
            let typeCn = '个任务';
            if (targetType.startsWith('subagent') && targetType.includes('/')) typeCn = '个子智能体/任务';
            else if (targetType.startsWith('subagent')) typeCn = '个子智能体';
            return num + ' ' + typeCn + '正在运行';
        }
        if (/^([\\d,.]+\\s+[a-zA-Z\\s]+)(?:,\\s*[\\d,.]+\\s+[a-zA-Z\\s]+)*$/i.test(valNorm)) {
            const trans = translateCountList(valNorm);
            if (trans !== valNorm) return trans;
        }
        if (/^\\+(\\d+)\\s+more\\s+lines?$/i.test(valNorm)) {
            return valNorm.replace(/^\\+(\\d+)\\s+more\\s+lines?$/i, '+$1 行');
        }
        if (/^Showing\\s+(\\d+)\\s+lines?$/i.test(valNorm)) {
            return valNorm.replace(/^Showing\\s+(\\d+)\\s+lines?$/i, '显示 $1 行');
        }
        if (/^Permanently delete (.+?), including (\\d+) active conversations?\\.?$/i.test(valNorm)) {
            return valNorm.replace(/^Permanently delete (.+?), including (\\d+) active conversations?\\.?$/i, '永久删除 $1，包含 $2 个活跃会话。');
        }
        if (/^including (\\d+) active conversations?\\.?$/i.test(valNorm)) {
            return valNorm.replace(/^including (\\d+) active conversations?\\.?$/i, "包含 $1 个活跃会话。");
        }
        if (/^All changes since (.+)$/i.test(valNorm)) {
            return valNorm.replace(/^All changes since (.+)$/i, '自 $1 以来的所有更改');
        }
        if (/^All\\s+(?:scheduled tasks?|automations?)\\s+run\\s+as\\s+(.+?)\\.?$/i.test(valNorm)) {
            return valNorm.replace(/^All\\s+(?:scheduled tasks?|automations?)\\s+run\\s+as\\s+(.+?)\\.?$/i, '所有计划任务均以 $1 模型运行。');
        }
        if (/^A\\s+(?:scheduled task|automation)\\s+with\\s+ID\\s+(.+?)\\s+already\\s+exists\\.?$/i.test(valNorm)) {
            return valNorm.replace(/^A\\s+(?:scheduled task|automation)\\s+with\\s+ID\\s+(.+?)\\s+already\\s+exists\\.?$/i, 'ID 为 $1 的任务已存在。');
        }
        if (/^See all \\((\\d+)\\)$/i.test(valNorm)) {
            return valNorm.replace(/^See all \\((\\d+)\\)$/i, '显示全部 ($1)');
        }
        if (/^Available AI Credits: (\\d+)$/i.test(valNorm)) {
            return valNorm.replace(/^Available AI Credits: (\\d+)$/i, '可用 AI 额度: $1');
        }
        if (/^Version\\s+([\\d\\.]+)$/i.test(valNorm)) {
            return valNorm.replace(/^Version\\s+([\\d\\.]+)$/i, '版本 $1');
        }
        if (/^(\\d+)(s|m|h|d|w|mo|yr)$/i.test(valNorm)) {
            return valNorm.replace(/^(\\d+)(s|m|h|d|w|mo|yr)$/i, (match, num, unit) => {
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
        }
        if (/^Are you sure you want to delete (the |this )?(project group|project|workspace)?\\s*(.+?)\\??$/i.test(valNorm)) {
            return valNorm.replace(/^Are you sure you want to delete (the |this )?(project group|project|workspace)?\\s*(.+?)\\??$/i, (match, article, type, name) => {
                let typeStr = "项目";
                if (type && type.toLowerCase().includes('group')) typeStr = "项目分组";
                else if (type && type.toLowerCase() === 'workspace') typeStr = "工作区";
                return "您确定要删除 " + typeStr + " " + name + " 吗？";
            });
        }
        if (/^This will permanently delete (\\d+) active conversations? within it\\.?$/i.test(valNorm)) {
            return valNorm.replace(/^This will permanently delete (\\d+) active conversations? within it\\.?$/i, '此操作将永久删除其中的 $1 个活跃会话。');
        }
        if (/^This will permanently delete (.+?) within it\\.?$/i.test(valNorm)) {
            return valNorm.replace(/^This will permanently delete (.+?) within it\\.?$/i, '此操作将永久删除其中的 $1。');
        }
        if (/^(.+?): context deadline exceeded$/i.test(valNorm)) {
            return valNorm.replace(/^(.+?): context deadline exceeded$/i, '$1: 请求超时 (context deadline exceeded)');
        }
        if (/^(.+?): i\\/o timeout$/i.test(valNorm)) {
            return valNorm.replace(/^(.+?): i\\/o timeout$/i, '$1: I\\/O 超时 (i\\/o timeout)');
        }
        if (/^Updated (.+)$/i.test(valNorm)) {
            return valNorm.replace(/^Updated (.+)$/i, '更新于 $1');
        }
        // 动态属性与控件正则
        if (/^Plugin:\\s*(.+)$/i.test(valNorm)) {
            return valNorm.replace(/^Plugin:\\s*(.+)$/i, '插件：$1');
        }
        if (/^Toggle\\s+(.+)$/i.test(valNorm)) {
            return valNorm.replace(/^Toggle\\s+(.+)$/i, '切换 $1');
        }
        if (/^Enter\\s+(.+?)\\s+name\\.\\.\\.$/i.test(valNorm)) {
            return valNorm.replace(/^Enter\\s+(.+?)\\s+name\\.\\.\\.$/i, (m, name) => {
                const nameCn = name === 'scheduled task' ? '计划任务' : (name === 'automation' ? '自动化' : name);
                return '输入' + nameCn + '名称...';
            });
        }
        if (/^Enter a prompt for the agent to run\\.\\.\\.$/i.test(valNorm)) {
            return '输入供智能体执行的提示词...';
        }
        return null;
    }

    // 通用底层字符串翻译入口（文本节点与元素属性共用）
    function translateString(text, node) {
        if (!text || typeof text !== 'string') return null;
        const valNorm = norm(text);
        if (!valNorm) return null;
        const shortcutTrans = translateWithShortcut(valNorm);
        if (shortcutTrans) return shortcutTrans;
        const exactTrans = lookup(valNorm);
        if (exactTrans) return exactTrans;
        const dynamicTrans = translateDynamicText(valNorm, text, node);
        if (dynamicTrans && dynamicTrans !== valNorm) return dynamicTrans;
        return null;
    }

    // 文本节点前置门禁判断：排除禁区标签与免翻容器
    function shouldTranslateTextNode(node) {
        if (!node || node.nodeType !== Node.TEXT_NODE) return false;
        const raw = (node.nodeValue || '').trim();
        if (!raw) return false;

        const el = node.parentElement;
        if (!el || typeof el.closest !== 'function') return false;

        // 排除黑名单标签
        const tag = el.tagName ? String(el.tagName).toUpperCase() : '';
        if (BLOCKED_TAGS.has(tag)) return false;

        // 排除代码编辑器、终端、AI 流式正文等免翻容器
        if (el.closest(ALL_BLOCKED_SELECTOR)) {
            return false;
        }

        // 常规 UI 元素放行翻译
        return true;
    }

    function translateAttrValue(v) {
        if (!v || typeof v !== 'string') return null;
        return translateString(v, null);
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

    // 原生属性 Setter 拦截器：拦截动态属性赋值，即时完成属性汉化
    try {
        if (typeof Element !== 'undefined' && Element.prototype) {
            const origSetAttr = Element.prototype.setAttribute;
            const INTERCEPT_ATTRS = new Set(['title', 'aria-label', 'placeholder', 'data-tooltip', 'data-tip', 'data-title', 'data-balloon']);
            Element.prototype.setAttribute = function(name, value) {
                if (typeof value === 'string' && INTERCEPT_ATTRS.has(name)) {
                    // 已是中文则直接跳过，避免重复处理
                    if (!/[\\u4e00-\\u9fa5]/.test(value)) {
                        const trans = translateAttrValue(value);
                        if (trans) value = trans;
                    }
                }
                return origSetAttr.call(this, name, value);
            };
        }

        if (typeof HTMLElement !== 'undefined' && HTMLElement.prototype) {
            const origTitleDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'title');
            if (origTitleDesc && origTitleDesc.set) {
                Object.defineProperty(HTMLElement.prototype, 'title', {
                    set: function(val) {
                        if (typeof val === 'string' && !/[\\u4e00-\\u9fa5]/.test(val)) {
                            const trans = translateAttrValue(val);
                            if (trans) val = trans;
                        }
                        return origTitleDesc.set.call(this, val);
                    },
                    get: origTitleDesc.get,
                    configurable: true,
                    enumerable: true
                });
            }
        }
    } catch (e) {}

    function translateTextNode(node, isPreValidated) {
        try {
            if (!isPreValidated && !shouldTranslateTextNode(node)) return;
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

            // 文本物理特征防御：过滤文件路径、代码文件名、网址URL、UUID/Hash与命令行参数
            if (/^(https?:\\/\\/|[a-zA-Z]:[\\\\/]|[\\\\/][a-zA-Z0-9_.-]|\\.[\\\\/]|\\.\\.[\\\\/])/.test(valNorm)) return;
            if (/^[a-zA-Z0-9_\\-.]+\\.(js|ts|jsx|tsx|json|py|go|rs|cpp|c|h|hpp|java|kt|dart|html|css|scss|md|mdx|yaml|yml|toml|xml|sql|sh|bat|ps1|asar|exe|dll|zip|tar|gz|png|jpg|svg|ico)$/i.test(valNorm)) return;
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valNorm)) return;
            if (/^[0-9a-f]{7,40}$/i.test(valNorm)) return;
            if (/^--?[a-zA-Z0-9_\\-]+(=.*)?$/.test(valNorm)) return;

            // 纯代码语法特征过滤：放行动作步骤标题（如 Ran node ...），跳过代码调用特征
            if (!/^(Ran|Running|Explored|Analyzed|Searched|Edited|Thought for|Worked for|Checked|Killed|Starting|Started|Timed|Status|The command exited|Verify|Commit)\\b/i.test(valNorm)) {
                if (/[a-zA-Z0-9_$]+\\.[a-zA-Z0-9_$]+\\(/.test(valNorm) || /^[a-zA-Z0-9_$]+\\(.*\\)$/.test(valNorm)) return;
            }

            const transRes = translateString(valNorm, node);
            const newVal = transRes || originalVal;

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

    // 子树遍历：使用浏览器原生 TreeWalker 扫描文本节点与属性
    function translateSubtree(root) {
        if (!root) return;
        if (root.nodeType === Node.TEXT_NODE) {
            translateTextNode(root);
            return;
        }
        if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;

        if (root.nodeType === Node.ELEMENT_NODE) {
            // 根节点前置门禁：若目标子树位于禁区容器内则直接跳过扫描
            if (typeof root.closest === 'function' && root.closest(ALL_BLOCKED_SELECTOR)) {
                return;
            }
            translateElementAttrs(root);
            if (root.shadowRoot) {
                const hostCls = (typeof root.className === 'string' ? root.className : '').toLowerCase();
                const hostTag = (root.tagName || '').toUpperCase();
                if (!hostCls.includes('xterm') && !hostCls.includes('terminal') && !hostCls.includes('monaco') && hostTag !== 'CANVAS') {
                    translateSubtree(root.shadowRoot);
                }
            }
        }

        // TreeWalker 过滤器：自顶向下遍历，遇到禁区标签或容器直接 REJECT 整树跳过
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
            acceptNode: function(n) {
                if (n.nodeType === Node.ELEMENT_NODE) {
                    const tag = n.tagName ? n.tagName.toUpperCase() : '';
                    if (BLOCKED_TAGS.has(tag)) return NodeFilter.FILTER_REJECT;
                    if (typeof n.matches === 'function' && n.matches(ALL_BLOCKED_SELECTOR)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    translateElementAttrs(n);
                    return NodeFilter.FILTER_SKIP;
                }
                if (n.nodeType === Node.TEXT_NODE) {
                    if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                }
                return NodeFilter.FILTER_SKIP;
            }
        });

        let curr = walker.nextNode();
        while (curr) {
            translateTextNode(curr, true);
            curr = walker.nextNode();
        }
    }

    // 导出未命中采集结果：供 CDP 自动化脚本调用导出
    window.__AG_MISSED_TEXTS__ = missedTexts;
    window.__AG_DUMP_MISSING__ = function() {
        const arr = Array.from(missedTexts).sort();
        console.log('[AG汉化] 未翻译文案 ' + arr.length + ' 条:\\n' + arr.join('\\n'));
        return arr;
    };

    // 变动任务调度队列：大批量 DOM 变动时推入 requestIdleCallback 分片执行
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
                        if (typeof n.closest === 'function' && n.closest(ALL_BLOCKED_SELECTOR)) continue;
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
            } else if (m.type === 'attributes') {
                const target = m.target;
                if (target && target.nodeType === Node.ELEMENT_NODE) {
                    if (typeof target.closest === 'function' && target.closest(ALL_BLOCKED_SELECTOR)) {
                        continue;
                    }
                    translateElementAttrs(target);
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

    const obsOpts = { 
        childList: true, 
        subtree: true, 
        characterData: true,
        attributes: true,
        attributeFilter: ['title', 'aria-label', 'placeholder']
    };

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

function generateI18nCoreJs(preloadedDict) {
    const fullDict = preloadedDict || loadDictionary();
    const dictJson = JSON.stringify(fullDict);
    const rendererJs = generateJs(fullDict);
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

// asar 打包与解包执行器：优先调用本地 node_modules/.bin/asar，缺失时回退 npx @electron/asar
function runAsar(action, src, dst) {
    let res = null;
    try {
        const localAsar = path.join(__dirname, 'node_modules', '.bin', process.platform === 'win32' ? 'asar.cmd' : 'asar');
        if (fs.existsSync(localAsar)) {
            res = runCommandSync(`"${localAsar}" ${action} "${src}" "${dst}"`);
        }
    } catch (_) {}
    if (!res || !res.success) {
        res = runCommandSync(`npx -y @electron/asar ${action} "${src}" "${dst}"`);
    }
    return res;
}

// ==========================================
// Antigravity 2.0+ 汉化引擎 (单点全局拦截架构)
// ==========================================
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

function detectHanhuaState(tempDir) {
    try {
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

    // 1. 临时提取目录
    const tempDir = path.join(os.tmpdir(), `antigravity_hanhua_asar_${process.pid}`);
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }

    console.log(`[解包] 正在使用 asar 提取 app.asar...`);
    const extractRes = runAsar('extract', asarPath, tempDir);
    if (!extractRes || !extractRes.success || !fs.existsSync(tempDir)) {
        console.error(`[错误] 解包失败，可能是由于系统未安装 Node.js/npm 或者网络限制。`);
        console.error(`详情: ${extractRes ? extractRes.stderr : ''}\n${extractRes ? extractRes.stdout : ''}`);
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch(_){}
        return false;
    }

    // 2. 内容级汉化状态检测
    const hanhuaState = detectHanhuaState(tempDir);
    if (hanhuaState === 'new') {
        console.log(`[检测] 当前 app.asar 为汉化版（单点架构），将基于官方备份重新注入...`);
    } else if (hanhuaState === 'legacy') {
        console.log(`[检测] 当前 app.asar 含旧版多点汉化补丁，将清理并升级到单点架构...`);
    } else {
        console.log(`[检测] 当前 app.asar 为官方原版。`);
    }

    // 3. 备份
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
        if (_safeCopy(bakPath, asarPath, '还原官方备份')) {
            console.log(`[还原] 已重置当前 app.asar 为官方原始备份包，正在重新提取官方原版...`);
            fs.rmSync(tempDir, { recursive: true, force: true });
            const reExtract = runAsar('extract', asarPath, tempDir);
            if (reExtract && reExtract.success && fs.existsSync(tempDir)) {
                console.log(`[解包] 官方原版解包完成，已就绪纯净基座！`);
            } else {
                console.warn(`[警告] 官方原版解包未完全成功，将继续当前注入流程。`);
            }
        } else {
            console.log(`[提示] 当前 app.asar 被锁定（可能是客户端正在运行），将使用当前包进行增量注入。`);
        }
    } else {
        let currentHash, bakHash;
        try { currentHash = hashFile(asarPath); bakHash = hashFile(bakPath); } catch(e) { currentHash = ''; bakHash = 'x'; }
        if (currentHash !== bakHash) {
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

    // 4. 解析主入口与生成核心 core
    const mainJsPath = resolveMainEntry(tempDir);
    const coreJsPath = path.join(path.dirname(mainJsPath), "antigravity_i18n_core.js");
    console.log(`[生成] 正在构建全局单点拦截核心模块 antigravity_i18n_core.js ...`);
    const coreJsContent = generateI18nCoreJs();
    fs.writeFileSync(coreJsPath, coreJsContent, 'utf-8');

    // 5. 注入 main.js (单点全局切入)
    if (!fs.existsSync(mainJsPath)) {
        console.error(`[错误] 解包产物中未找到主入口 ${mainJsPath}，官方包结构可能已变化。已中止，避免生成无效的汉化包。`);
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

    // 6. 注入 preload.js (用于主窗口渲染前零闪烁即时汉化)
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

    // 7. 清理可能遗留的历史多点补丁
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

    // 8. 重新打包
    console.log(`[打包] 正在将修改后的内容打包回 app.asar...`);
    const packRes = runAsar('pack', tempDir, asarPath);
    if (!packRes || !packRes.success) {
        console.error(`[错误] 打包失败。`);
        console.error(`详情: ${packRes ? packRes.stderr : ''}\n${packRes ? packRes.stdout : ''}`);
        console.error(`[保留] 临时目录未清理（${tempDir}），可手动检查解包产物；app.asar 未变动，官方备份 app.asar.bak 完好。`);
        return false;
    }

    // 打包成功后校验结果
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

    // 9. 清理临时文件夹
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
        } else if (args[i].startsWith('--install-dir=')) {
            manualDir = args[i].slice('--install-dir='.length);
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
    } else if (fs.existsSync(path.join(installDir, "app.asar"))) {
        resourcesDir = installDir;
    } else {
        resourcesDir = path.join(installDir, "resources");
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
