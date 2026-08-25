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
    const totalMap = {};
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
                        const normK = normalizeText(k);
                        if (normK) totalMap[normK] = v;
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
    }
    return totalMap;
}

function generateJs() {
    const fullDict = loadDictionary();
    
    const dictJson = JSON.stringify(fullDict);

    const jsSource = `${SIGNATURE_START}
(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (window.__AG_HANHUA_INSTALLED__) return;
    // 跨 world 防双引擎：contextIsolation 下 preload world 与页面主 world 各加载一份本引擎，
    // window 标志互不可见。用共享 DOM 标志让后启动者退出，避免两套 MutationObserver 同时运行。
    // 标志只在引擎完整初始化后写入；若本引擎中途抛错则标志不落，主 world 引擎仍可兜底。
    const rootEl = document.documentElement;
    if (rootEl && rootEl.dataset && rootEl.dataset.agHanhua === '1') return;
    window.__AG_HANHUA_INSTALLED__ = true;

    // V12.0 终极隔离版：基于容器回溯的物理隔离引擎
    // 逻辑：不再仅仅检查当前标签，而是向上回溯父级，识别“代码/编辑器”禁区
    const map = new Map(Object.entries(DICT_PLACEHOLDER));
    const lowerMap = new Map();
    for (const [k, v] of map.entries()) lowerMap.set(k.toLowerCase(), v);
    
    const translatedValues = new WeakMap();

    // =========================================================================
    // 🛡️ 工业级全维度安全隔离防护网 (Fortified Security & Data Isolation Mesh)
    // =========================================================================
    
    // 1. 绝对禁止标签 (标签级物理熔断)
    const BLOCKED_TAGS = new Set([
        'SCRIPT', 'STYLE', 'CODE', 'PRE', 'INPUT', 'TEXTAREA', 'SVG', 'CANVAS', 
        'SYMBOL', 'PATH', 'KBD', 'SAMP', 'VAR', 'TEMPLATE', 'MATH', 'AUDIO', 'VIDEO', 'SOURCE', 'TRACK'
    ]);

    // 2. 深度特征类名与容器标识 (全网 Monaco / Diff / Xterm / CodeMirror / Markdown / AI 思考链 / ToolCalls 覆盖)
    const BLOCKED_CLASS_PATTERNS = [
        // 编辑器与代码高亮核心
        'monaco', 'editor', 'view-line', 'view-lines', 'lines-content', 'glyph-margin', 
        'margin-view-overlays', 'decorationsOverviewRuler', 'cm-editor', 'cm-content', 
        'cm-line', 'cm-scroller', 'ace_editor', 'ace_line', 'theia-editor', 
        'syntax-', 'token', 'hljs', 'prism', 'shiki', 'font-mono',
        
        // 🔀 Git Diff 视图与合并冲突代码区
        'diff-editor', 'monaco-diff-editor', 'diff-review', 'diff-review-line', 'diffOverview', 
        'original-in-monaco-diff-editor', 'modified-in-monaco-diff-editor', 'inline-deleted-margin-view-zone', 
        'dirty-diff', 'char-delete', 'char-insert', 'line-delete', 'line-insert',
        
        // ⌨️ 终端与控制台输出流
        'terminal', 'xterm', 'xterm-screen', 'xterm-rows', 'xterm-viewport', 
        'xterm-selection', 'pty-output', 'console-output', 'debug-console', 
        'output-view', 'shell-session', 'command-output', 'terminal-output', 'repl',
        'terminal-instance', 'terminal-wrapper',
        
        // 👻 代码补全、参数提示与 Ghost Text 建议
        'suggest-widget', 'parameter-hints', 'inline-completions', 'ghost-text', 
        'quick-fix-widget', 'monaco-hover', 'hover-row', 'quick-input-list',
        
        // 🧠 AI 思考链与执行流 (Chain-of-Thought / Reasoning / Thinking / Trajectory / Steps)
        'thought', 'thinking', 'reasoning', 'chain-of-thought', 'cot', 'cot-content',
        'thought-bubble', 'thought-process', 'thought-content', 'thinking-process', 'reasoning-content',
        'step-detail', 'step-details', 'step-body', 'step-content',
        'step-description', 'agent-step', 'trajectory', 'turn-content', 'conversation-turn',
        'chat-turn', 'conversation-timeline', 'agent-trajectory', 'step-panel', 'subagent-turn',
        'collapsible-thought', 'thought-box', 'thought-toggle', 'ant-thought', 'agy-thought', 'ai-thought',
        'agent-thought', 'stream-thought',
        
        // 💬 对话正文、模型输出与交付件
        'chat-message', 'message-content', 'user-message', 'assistant-message', 'chat-scrollable', 
        'message-bubble', 'message-row', 'stream-output', 'model-response', 'model-output', 'prose', 
        'markdown-body', 'markdown-content', 'artifact-content', 'artifact-body', 'artifact-diff', 
        'artifact-code', 'file-content', 'snippet', 'raw-text', 'transcript-item',
        
        // 📐 数学公式与渲染
        'katex', 'katex-display', 'katex-html',
        
        // ⚙️ 工具调用与命令行执行上下文
        'tool-call', 'tool-args', 'tool-result', 'command-line', 'step-command', 'call-args', 'step-output'
    ];

    // 预编译禁区类名正则：把 150+ 次 includes 子串扫描合并为单次正则匹配（hot path）
    const BLOCKED_CLASS_REGEX = new RegExp(BLOCKED_CLASS_PATTERNS.join('|'));

    // 3. 禁区属性与 Role 特征
    const BLOCKED_ATTR_NAMES = [
        'data-lang', 'data-language', 'data-code', 'data-mode', 'data-is-code', 
        'data-thought', 'data-thinking', 'data-turn-role', 'data-message-author', 
        'data-is-streaming', 'data-tool-name', 'data-terminal-id', 'data-lexical-editor', 'data-slate-editor'
    ];
    const BLOCKED_ROLES = new Set(['code', 'textbox', 'log', 'terminal']);

    // 未命中采集：收集“非禁区但未翻译”的英文文本，便于迭代补全字典（内存 Set 去重，零 I/O 开销）
    // 加容量上限：长时间运行（数天不关客户端）时避免 Set 无限增长
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

    // 执行步骤摘要动词整词表：仅在文本恰好等于这些词时视为 UI 摘要（避免翻译思考链中的句子）
    const ACTION_SUMMARY_WORDS = new Set([
        'Ran', 'Run', 'Analyzed', 'Edited', 'Created', 'Deleted', 'Updated', 'Fixed',
        'Installed', 'Downloaded', 'Uploaded', 'Executed', 'Started', 'Stopped', 'Paused',
        'Resumed', 'Read', 'Wrote', 'Moved', 'Copied', 'Renamed', 'Merged', 'Committed',
        'Pushed', 'Pulled', 'Searched', 'Found', 'Generated', 'Built', 'Compiled',
        'Tested', 'Formatted', 'Refactored', 'Opened', 'Closed', 'Removed', 'Verified',
        'Inspected', 'Investigated', 'Examined', 'Explored', 'Thinking',
        'Working', 'Running', 'Waiting', 'Loaded', 'Parsed', 'Converted', 'Resized'
    ]);

    // 常量：隔离回溯上限（现代 React DOM 深层嵌套容易超过 35 层，太小导致禁区漏判→误译）
    const BLOCKED_ZONE_MAX_DEPTH = 128;
    // 常量：禁区 UI 例外文本最大长度、控件祖先向上查找层数
    const UI_STATUS_TEXT_MAX = 50;
    const CONTROL_ANCESTOR_LOOKUP = 4;

    // 元素自身是否具备禁区特征：isInBlockedZone 回溯与 translateNode 容器判定共用同一套规则，
    // 避免两份逻辑各自维护导致漏改（详见 article 特征曾因双份实现而失步）
    function hasBlockingFeatures(el) {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
        const tag = el.tagName ? el.tagName.toUpperCase() : '';
        if (BLOCKED_TAGS.has(tag)) return true;
        if (el.getAttribute('contenteditable') === 'true' || el.isContentEditable) return true;
        if (el.getAttribute('translate') === 'no') return true;
        const role = el.getAttribute('role');
        if (role && BLOCKED_ROLES.has(role.toLowerCase())) return true;
        // Agent 响应容器特征：role="article" + aria-label 含 agent/assistant/response
        if (role && role.toLowerCase() === 'article') {
            const ariaLabel = el.getAttribute('aria-label') || '';
            if (ariaLabel && /agent|assistant|response/i.test(ariaLabel)) return true;
        }
        for (const attr of BLOCKED_ATTR_NAMES) {
            if (el.hasAttribute(attr)) return true;
        }
        const testId = el.getAttribute('data-testid') || '';
        if (testId) {
            const tLower = testId.toLowerCase();
            if (tLower.includes('thought') || tLower.includes('thinking') || tLower.includes('chat') || tLower.includes('message')) return true;
        }
        const className = (typeof el.className === 'string') ? el.className : (el.getAttribute('class') || '');
        if (className) {
            const cLower = className.toLowerCase();
            if (cLower.includes('notranslate')) return true;
            if (BLOCKED_CLASS_REGEX.test(cLower)) return true;
        }
        return false;
    }

    // 禁区例外判断：短 UI 状态词（思考中/运行中/浏览了等）+ 执行步骤摘要词（Ran/Analyzed/Edited 等）
    // Agent 响应容器（role=article）会被标记 translate=no/notranslate，导致内部 UI 文案也进入隔离区；
    // 这些 UI 文案（状态指示器/步骤摘要标题）应继续翻译。
    // 判定 = 短文本 + (动作摘要整词 或 位于控件容器)
    function isBlockedZoneUiText(node) {
        try {
            if (!node || node.nodeType !== Node.TEXT_NODE) return false;
            const raw = (node.nodeValue || '').trim();
            if (!raw || raw.length > UI_STATUS_TEXT_MAX) return false;
            if (!/[a-zA-Z]/.test(raw)) return false;
            // 动作摘要整词：执行步骤标题（Ran/Analyzed/Edited/Created...），精确匹配整个单词，不误伤句子
            if (ACTION_SUMMARY_WORDS.has(raw) || ACTION_SUMMARY_WORDS.has(raw.charAt(0).toUpperCase() + raw.slice(1))) return true;
            let el = node.parentElement;
            for (let i = 0; el && i < CONTROL_ANCESTOR_LOOKUP; i++) {
                const tag = el.tagName ? el.tagName.toUpperCase() : '';
                if (tag === 'BUTTON' || tag === 'A' || tag === 'LABEL' || tag === 'TH') return true;
                const role = (typeof el.getAttribute === 'function' ? el.getAttribute('role') : '') || '';
                if (/^(button|tab|menuitem|menuitemcheckbox|menuitemradio|switch|checkbox|option|listitem|link)$/i.test(role)) return true;
                const cls = (typeof el.className === 'string' ? el.className : '') || '';
                if (/(^|[\s_-])(btn|button|menu[-_]?item|status|indicator|badge|chip|pill|step[-_]?(title|label)|status[-_]?(text|label))([\s_-]|$)/i.test(cls)) return true;
                el = el.parentElement;
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    // 核心隔离判断：纯粹基于容器位置与语义性质（Where & Purpose）回溯检查是否属于生产力数据区
    function isInBlockedZone(node) {
        let curr = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        let depth = 0;
        while (curr && depth < BLOCKED_ZONE_MAX_DEPTH) {
            if (hasBlockingFeatures(curr)) return true;
            curr = curr.parentElement || (curr.parentNode && curr.parentNode.host); // 支持 Shadow DOM 穿透
            depth++;
        }
        return false;
    }

    function translateNode(node) {
        try {
            if (!node) return;

            // ShadowRoot / DocumentFragment：本身无内容，遍历其子节点（否则 shadow DOM 静态内容永不翻译）
            if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                for (const child of node.childNodes) translateNode(child);
                return;
            }
            
            if (node.nodeType === Node.ELEMENT_NODE) {
                const tag = node.tagName ? node.tagName.toUpperCase() : '';
                
                // 1. 全面判定是否属于禁区容器（复用 hasBlockingFeatures，与 isInBlockedZone 同一套规则）
                const isBlocked = hasBlockingFeatures(node);
                
                if (isBlocked) {
                    if (node.getAttribute('translate') !== 'no') {
                        node.setAttribute('translate', 'no');
                    }
                    try {
                        if (!node.classList.contains('notranslate')) {
                            node.classList.add('notranslate');
                        }
                    } catch (e) {}

                    // 对于 INPUT, TEXTAREA 和 SVG，虽然不翻译其子元素或内容，但需要翻译其 placeholder, title, aria-label 等属性
                    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SVG') {
                        if (!isInBlockedZone(node.parentElement)) {
                            for (const attr of ['placeholder', 'title', 'aria-label']) {
                                const v = node.getAttribute(attr);
                                if (v) {
                                    const t = norm(v);
                                    const shortcutTrans = translateWithShortcut(t);
                                    if (shortcutTrans) node.setAttribute(attr, shortcutTrans);
                                    else if (map.has(t)) node.setAttribute(attr, map.get(t));
                                    else if (lowerMap.has(t.toLowerCase())) node.setAttribute(attr, lowerMap.get(t.toLowerCase()));
                                }
                            }
                        }
                    }
                    
                    // 禁区容器不再物理熔断子节点：继续遍历，
                    // 子节点文本安全由文本分支的 isInBlockedZone（回溯祖先）+ 短状态词例外双重把关 ——
                    // 这样禁区（Agent 响应区）内的短 UI 状态词（思考中/运行中/浏览了等）仍可翻译，
                    // 而长正文/代码/聊天内容在文本分支被 isInBlockedZone 拦截，保持不翻译
                }

                // 2. 正常 UI 控件：只有当确实不在禁区时，才翻译其属性
                if (!isInBlockedZone(node)) {
                    for (const attr of ['placeholder', 'title', 'aria-label']) {
                        const v = node.getAttribute(attr);
                        if (v) {
                            const t = norm(v);
                            const shortcutTrans = translateWithShortcut(t);
                            if (shortcutTrans) node.setAttribute(attr, shortcutTrans);
                            else if (map.has(t)) node.setAttribute(attr, map.get(t));
                            else if (lowerMap.has(t.toLowerCase())) node.setAttribute(attr, lowerMap.get(t.toLowerCase()));
                        }
                    }
                }

                if (node.shadowRoot) translateNode(node.shadowRoot);
                for (const child of node.childNodes) translateNode(child);

            } else if (node.nodeType === Node.TEXT_NODE) {
                let originalVal = node.nodeValue;
                if (!originalVal || originalVal.trim().length < 1) return;

                // 核心：如果是 skeleton 骨架占位文本，强制打上不翻译标记，防止自动翻译（例如 Google Translate 网页翻译）将其翻译为“装。资料。包装。资料。”
                if (originalVal.toLowerCase().includes('pack.info')) {
                    const parent = node.parentElement;
                    if (parent) {
                        if (parent.getAttribute('translate') !== 'no') {
                            parent.setAttribute('translate', 'no');
                        }
                        try {
                            if (!parent.classList.contains('notranslate')) {
                                parent.classList.add('notranslate');
                            }
                        } catch (e) {}
                    }
                    return;
                }

                // 核心：纯粹通过容器所在层级与性质（isInBlockedZone）决定是否翻译
                // 禁区例外：短 UI 状态词（思考中/运行中/浏览了等）仍翻译；长文本（思考链正文/代码/聊天）不翻译
                if (isInBlockedZone(node) && !isBlockedZoneUiText(node)) return;

                const valNorm = norm(originalVal);

                // 🛡️ 物理保护 1：文件路径、代码文件名、网址URL、UUID/Hash与命令行
                if (/^(https?:\\/\\/|[a-zA-Z]:[\\/]|[\\/][a-zA-Z0-9_.-]|\\.\\/|\\.\\.\\/)/.test(valNorm)) return;
                if (/^[a-zA-Z0-9_\\-.]+\\.(js|ts|jsx|tsx|json|py|go|rs|cpp|c|h|hpp|java|kt|dart|html|css|scss|md|mdx|yaml|yml|toml|xml|sql|sh|bat|ps1|asar|exe|dll|zip|tar|gz|png|jpg|svg|ico)$/i.test(valNorm)) return;
                if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valNorm)) return;

                // 🛡️ 物理保护 2：代码行/函数调用特征（如 ap.has(), check.regex, process.argv 等）
                if (/[a-zA-Z0-9_$]+\\.[a-zA-Z0-9_$]+\\(/.test(valNorm) || /^[a-zA-Z0-9_$]+\\(.*\\)$/.test(valNorm)) return;

                // 🛡️ 物理保护 3：短单词误译防护（防思考链/正文单词级翻译）
                // 流式输出中的思考链/正文容器可能暂时没有禁区特征（aria-label 等输出完成后才设置），
                // 短单词（≤4 字符，如 and/on/all/now）若所在父容器是大段英文文本，视为正文而非 UI 枚举，跳过翻译。
                // UI 枚举（设置面板的 High/Low 等）通常在短容器内，不受影响。
                if (/^[a-zA-Z]{1,4}$/.test(valNorm)) {
                    const parent = node.parentElement;
                    if (parent) {
                        const pt = (parent.textContent || '').trim();
                        if (pt.length >= 40) {
                            const enCount = (pt.match(/[a-zA-Z]/g) || []).length;
                            if (enCount / Math.max(pt.length, 1) > 0.6) return;
                        }
                    }
                }

                // 🛡️ 物理保护 4：思考链/正文片段误译防护（扩展版，修复流式思考被误译后还原的闪烁）
                // 流式思考中文本常被拆分为多个独立 textNode，每个仅为单个词（如 Analyzing / Exploring），
                // 且父容器尚未打上禁区标记（isInBlockedZone 仍为 false），导致按字典整词误译，输出结束后又被 React 重绘还原为英文，造成闪烁。
                // 策略：若当前节点命中字典（精确或小写），但其父容器为长段英文（≥40 且英文占比>60%），且节点本身为该长文的片段（长度<父内容50%），
                // 则视为正文片段而非独立 UI 标签，跳过翻译；显式 UI 控件（BUTTON/A/LABEL/TH 或 role=button 等）内的短状态词除外（由 isBlockedZoneUiText 另行放行）。
                if ((map.has(valNorm) || lowerMap.has(valNorm.toLowerCase()))) {
                    // 向上查找长段英文祖先（处理 <span>Analyzing</span> 这类被拆分的思考片段，其直接父 span 很短，需看祖父容器）
                    let anc = node.parentElement;
                    let foundLong = null;
                    for (let ai = 0; anc && ai < 2; ai++) {
                        const ptA = (anc.textContent || '').trim();
                        if (ptA.length >= 40) {
                            // 排除聚合型容器（如 body/html/虚拟列表 汇聚了多个独立区块的长文本，其子块多为块级元素，误判为长段正文）
                            try {
                                const tagA = anc.tagName ? anc.tagName.toUpperCase() : '';
                                if (tagA === 'BODY' || tagA === 'HTML') { anc = anc.parentElement; continue; }
                                const testIdA = anc.getAttribute ? (anc.getAttribute('data-testid')||'') : '';
                                if (testIdA && /conversation|sidebar|list/i.test(testIdA)) { anc = anc.parentElement; continue; }
                                const clsA = (typeof anc.className==='string'? anc.className : (anc.getAttribute('class')||'')).toLowerCase();
                                if (clsA.includes('overflow-y-auto') || clsA.includes('overscroll') || clsA.includes('sidebar') || clsA.includes('flex-1')) { anc = anc.parentElement; continue; }
                                const blockKids = anc.childNodes ? [...anc.childNodes].filter(c => c.nodeType === 1 && /^(DIV|P|H[1-6]|SECTION|ARTICLE|UL|OL|TABLE|HEADER|FOOTER|NAV|ASIDE)$/i.test(c.tagName)).length : 0;
                                if (blockKids > 2) { anc = anc.parentElement; continue; }
                            } catch(e) {}
                            const enA = (ptA.match(/[a-zA-Z]/g) || []).length;
                            if (enA / Math.max(ptA.length, 1) > 0.6) { foundLong = ptA; break; }
                        }
                        anc = anc.parentElement;
                    }
                    if (foundLong) {
                        // 若是显式 UI 状态词（isBlockedZoneUiText 判定为应翻译的短状态词/步骤摘要），则不拦截
                        if (isBlockedZoneUiText(node)) {
                            // 允许翻译
                        } else if (valNorm.length < foundLong.length * 0.6 && (foundLong.length - valNorm.length) > 15) {
                            let el = node.parentElement;
                            let isUiControl = false;
                            for (let i = 0; el && i < CONTROL_ANCESTOR_LOOKUP; i++) {
                                const tag = el.tagName ? el.tagName.toUpperCase() : '';
                                if (tag === 'BUTTON' || tag === 'A' || tag === 'LABEL' || tag === 'TH') { isUiControl = true; break; }
                                const role = (typeof el.getAttribute === 'function' ? el.getAttribute('role') : '') || '';
                                if (/^(button|tab|menuitem|menuitemcheckbox|menuitemradio|switch|checkbox|option|listitem|link)$/i.test(role)) { isUiControl = true; break; }
                                const cls = (typeof el.className === 'string' ? el.className : '') || '';
                                if (/(^|[\s_-])(btn|button|menu[-_]?item|status|indicator|badge|chip|pill|step[-_]?(title|label)|status[-_]?(text|label))([\s_-]|$)/i.test(cls)) { isUiControl = true; break; }
                                el = el.parentElement;
                            }
                            if (!isUiControl) return;
                        }
                    }
                }

                if (translatedValues.get(node) === originalVal) return;

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
                        } else if (/^when working in this project\.?$/i.test(restTrans)) {
                            restTrans = '（在此项目中工作时）';
                        } else if (restTrans) {
                            restTrans = ' ' + restTrans;
                        }
                        return "继承您的" + catTrans + "设置" + restTrans;
                    });
                } else if (/^(\d+)% of the customization budget is available\.?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(\d+)% of the customization budget is available\.?$/i, (match, num) => {
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
                } else if (/^(Rules|Skills):\s*([\d,]+)\s*tokens$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(Rules|Skills):\s*([\d,]+)\s*tokens$/i, (m, type, num) => {
                        const t = type.toLowerCase() === 'rules' ? '规则' : '技能';
                        return t + '：' + num + ' tokens';
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
                } else if (/^Explored (\\d+) files?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Explored (\\d+) files?$/i, (match, num) => {
                        return "浏览了 " + num + " 个文件";
                    });
                } else if (/^Analyzed (.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Analyzed (.+)$/i, (match, prefix) => {
                        return "分析了 " + prefix;
                    });
                } else if (/^Edited (.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Edited (.+)$/i, (match, prefix) => {
                        return "编辑了 " + prefix;
                    });
                } else if (/^Ran (.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Ran (.+)$/i, (match, prefix) => {
                        return "运行了 " + prefix;
                    });
                } else if (/^Run (.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Run (.+)$/i, (match, prefix) => {
                        return "运行 " + prefix;
                    });
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
                } else if (/^(\\d+)\\s+(files?|folders?|pages?|urls?|domains?|actions?|tools?|subagents?|tasks?|commands?|image\\s+attachments?|active\\s+conversations?|conversations?|plugins?|skills?|rules?)$/i.test(valNorm)) {
                    let temp = valNorm;
                    temp = temp.replace(/^(\\d+)\\s+active\\s+conversations?$/gi, '$1 个活跃会话');
                    temp = temp.replace(/^(\\d+)\\s+conversations?$/gi, '$1 个会话');
                    temp = temp.replace(/^(\\d+)\\s+files?$/gi, '$1 个文件');
                    temp = temp.replace(/^(\\d+)\\s+folders?$/gi, '$1 个文件夹');
                    temp = temp.replace(/^(\\d+)\\s+pages?$/gi, '$1 个页面');
                    temp = temp.replace(/^(\\d+)\\s+urls?$/gi, '$1 个网址');
                    temp = temp.replace(/^(\\d+)\\s+domains?$/gi, '$1 个域名');
                    temp = temp.replace(/^(\\d+)\\s+actions?$/gi, '$1 个操作');
                    temp = temp.replace(/^(\\d+)\\s+tools?$/gi, '$1 个工具');
                    temp = temp.replace(/^(\\d+)\\s+subagents?$/gi, '$1 个子智能体');
                    temp = temp.replace(/^(\\d+)\\s+tasks?$/gi, '$1 个任务');
                    temp = temp.replace(/^(\\d+)\\s+commands?$/gi, '$1 个命令');
                    temp = temp.replace(/^(\\d+)\\s+plugins?$/gi, '$1 个插件');
                    temp = temp.replace(/^(\\d+)\\s+skills?$/gi, '$1 个技能');
                    temp = temp.replace(/^(\\d+)\\s+rules?$/gi, '$1 条规则');
                    temp = temp.replace(/^(\\d+)\\s+image\\s+attachments?$/gi, '$1 个图片附件');
                    newVal = temp;
                } else if (/^Permanently delete (.+?), including (\\d+) active conversations?\\.?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Permanently delete (.+?), including (\\d+) active conversations?\\.?$/i, (match, proj, count) => {
                        return "永久删除 " + proj + "，包含 " + count + " 个活跃会话。";
                    });
                } else if (/^including (\\d+) active conversations?\\.?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^including (\\d+) active conversations?\\.?$/i, "包含 $1 个活跃会话。");
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
                } else {
                    // 安全整节点匹配：禁止在长段落内部做子串挖空替换，彻底绝缘大模型生成的思考正文
                    if (map.has(valNorm)) {
                        newVal = map.get(valNorm);
                    } else if (lowerMap.has(valLower)) {
                        newVal = lowerMap.get(valLower);
                    }
                }

                if (newVal !== originalVal) {
                    translatedValues.set(node, newVal);
                    node.nodeValue = newVal;
                    if (newVal === "命令" || newVal === "指令" || newVal === "快捷指令" || newVal === "跳过" || newVal === "展开" || newVal === "收起" || newVal === "文件" || newVal === "会话列表" || newVal === "项目列表") {
                        // 仅对按钮/菜单类控件注入 nowrap，防止中文短词被挤压换行；
                        // 不强制 width/min-width（会破坏 flex/grid 布局），也不向上扩散到祖父节点
                        const parent = node.parentElement;
                        if (parent) {
                            try {
                                const tag = parent.tagName ? parent.tagName.toUpperCase() : '';
                                const role = (typeof parent.getAttribute === 'function' ? parent.getAttribute('role') : '') || '';
                                const cls = (typeof parent.className === 'string' ? parent.className : '') || '';
                                const isControl = tag === 'BUTTON' || tag === 'A' ||
                                    /^(button|tab|menuitem|menuitemcheckbox|menuitemradio|listitem)$/i.test(role) ||
                                    /(^|[\s_-])(btn|button|menu[-_]?item)([\s_-]|$)/i.test(cls);
                                if (isControl) {
                                    parent.style.setProperty('white-space', 'nowrap', 'important');
                                    parent.style.setProperty('word-break', 'keep-all', 'important');
                                }
                            } catch (e) {}
                        }
                    }
                } else if (/[a-zA-Z]/.test(valNorm)) {
                    if (missedTexts.size < MISSED_TEXTS_MAX) missedTexts.add(valNorm);
                }
            }
        } catch (e) {}
    }

    // 暴露未命中采集结果：调用 window.__AG_DUMP_MISSING__() 输出并返回未翻译文案列表
    window.__AG_MISSED_TEXTS__ = missedTexts;
    window.__AG_DUMP_MISSING__ = function() {
        const arr = Array.from(missedTexts).sort();
        console.log('[AG汉化] 未翻译文案 ' + arr.length + ' 条:\\n' + arr.join('\\n'));
        return arr;
    };

    const observer = new MutationObserver(mutations => {
        for (const m of mutations) {
            if (m.type === 'childList') {
                for (const n of m.addedNodes) translateNode(n);
            } else if (m.type === 'characterData') {
                const target = m.target;
                if (target && (!isInBlockedZone(target) || isBlockedZoneUiText(target))) {
                    translateNode(target);
                }
            }
        }
    });

    const obsOpts = { childList: true, subtree: true, characterData: true };

    const startEngine = () => {
        const target = document.body || document.documentElement;
        if (target) {
            try {
                observer.observe(target, obsOpts);
                translateNode(target);
            } catch (e) {}
        }
    };

    const origAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function() {
        const sr = origAttachShadow.apply(this, arguments);
        try { observer.observe(sr, obsOpts); } catch(e) {}
        return sr;
    };

    // 强力多阶段触发绑定
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startEngine);
    } else {
        startEngine();
    }
    window.addEventListener('load', startEngine);
    setTimeout(startEngine, 100);
    setTimeout(startEngine, 1500);
    setTimeout(startEngine, 6000);

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
    const startMark = "// ==========================================";
    const endMark = "translateMenu(menu.items);";
    // 从补丁结束标记向前找最近的起始标记，避免官方代码中同风格注释行导致误删
    const endIdx = content.indexOf(endMark);
    if (endIdx === -1) return content;
    let startIdx = content.lastIndexOf(startMark, endIdx);
    if (startIdx === -1) return content;
    // 兼容旧补丁「分隔线 + 标题注释 + 分隔线」的三行头部：
    // startIdx 落在最近分隔线行，若其上一行是标题注释、且再上一行还是分隔线，
    // 则把起点扩展到更早的分隔线行首，避免残留标题注释行
    const curLineStart = content.lastIndexOf('\n', startIdx - 1) + 1;   // startIdx 所在行行首
    const prevLineStart = curLineStart === 0 ? -1 : content.lastIndexOf('\n', curLineStart - 2) + 1;
    if (prevLineStart !== -1) {
        const prevLine = content.substring(prevLineStart, curLineStart - 1); // 上一行内容（不含行尾换行）
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
    const startMark = "/* --- TRAY TRANSLATION START --- */";
    const endMark = "/* --- TRAY TRANSLATION END --- */";
    const startIdx = content.indexOf(startMark);
    const endIdx = content.indexOf(endMark);
    if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
        return content.substring(0, startIdx) + content.substring(endIdx + endMark.length);
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
// 1. Hook Native Menu APIs
// -------------------------------------------------------------
if (electron.Menu) {
    const origSetAppMenu = electron.Menu.setApplicationMenu;
    electron.Menu.setApplicationMenu = function(menu) {
        if (menu && menu.items) {
            try { translateMenu(menu.items); } catch(e) {}
        }
        return origSetAppMenu.call(this, menu);
    };

    const origBuildFromTemplate = electron.Menu.buildFromTemplate;
    electron.Menu.buildFromTemplate = function(template) {
        if (Array.isArray(template)) {
            try { translateTemplate(template); } catch(e) {}
        }
        const menu = origBuildFromTemplate.call(this, template);
        if (menu && menu.items) {
            try { translateMenu(menu.items); } catch(e) {}
        }
        return menu;
    };
}

// -------------------------------------------------------------
// 2. Hook System Tray APIs
// -------------------------------------------------------------
if (electron.Tray && electron.Tray.prototype) {
    const origSetContextMenu = electron.Tray.prototype.setContextMenu;
    electron.Tray.prototype.setContextMenu = function(menu) {
        if (menu && menu.items) {
            try { translateMenu(menu.items); } catch(e) {}
        }
        return origSetContextMenu.call(this, menu);
    };

    const origSetToolTip = electron.Tray.prototype.setToolTip;
    electron.Tray.prototype.setToolTip = function(toolTip) {
        const translated = typeof toolTip === 'string' ? translateText(toolTip) : toolTip;
        return origSetToolTip.call(this, translated);
    };
}

// -------------------------------------------------------------
// 3. Hook System Dialog APIs
// -------------------------------------------------------------
if (electron.dialog) {
    // 定位 options 参数：跳过 BrowserWindow 实例（showMessageBox(win, opts) 形式），
    // 并浅拷贝后翻译，避免直接修改调用方持有的对象
    function findDialogOpts(args) {
        for (let i = args.length - 1; i >= 0; i--) {
            const a = args[i];
            if (a && typeof a === 'object' && !(electron.BrowserWindow && a instanceof electron.BrowserWindow)) {
                return i;
            }
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

    const origShowMessageBox = electron.dialog.showMessageBox;
    electron.dialog.showMessageBox = function(...args) {
        try { translateDialogArgs(args); } catch(e) {}
        return origShowMessageBox.apply(this, args);
    };

    const origShowMessageBoxSync = electron.dialog.showMessageBoxSync;
    electron.dialog.showMessageBoxSync = function(...args) {
        try { translateDialogArgs(args); } catch(e) {}
        return origShowMessageBoxSync.apply(this, args);
    };

    const origShowOpenDialog = electron.dialog.showOpenDialog;
    electron.dialog.showOpenDialog = function(...args) {
        try { translateDialogArgs(args); } catch(e) {}
        return origShowOpenDialog.apply(this, args);
    };

    const origShowOpenDialogSync = electron.dialog.showOpenDialogSync;
    electron.dialog.showOpenDialogSync = function(...args) {
        try { translateDialogArgs(args); } catch(e) {}
        return origShowOpenDialogSync.apply(this, args);
    };

    const origShowErrorBox = electron.dialog.showErrorBox;
    electron.dialog.showErrorBox = function(title, content) {
        try {
            if (typeof title === 'string') title = translateText(title);
            if (typeof content === 'string') content = translateText(content);
        } catch(e) {}
        return origShowErrorBox.call(this, title, content);
    };
}

// -------------------------------------------------------------
// 3.4 Hook System Notifications
// 渲染进程经 IPC 传入的 title/body 是 JS 字符串，DOM 翻译引擎无法覆盖，在这里统一翻译
// -------------------------------------------------------------
if (electron.Notification) {
    const OrigNotification = electron.Notification;
    function HanhuaNotification(options) {
        try {
            if (options && typeof options === 'object') {
                if (typeof options.title === 'string') options.title = translateText(options.title);
                if (typeof options.body === 'string') options.body = translateText(options.body);
                if (typeof options.subtitle === 'string') options.subtitle = translateText(options.subtitle);
            }
        } catch (e) {}
        return new OrigNotification(options);
    }
    HanhuaNotification.prototype = OrigNotification.prototype;
    if (typeof OrigNotification.isSupported === 'function') HanhuaNotification.isSupported = OrigNotification.isSupported;
    electron.Notification = HanhuaNotification;
}

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
                webContents.executeJavaScript(RENDERER_INJECTION_CODE).catch(() => {});
            } catch(e) {}
        });
        webContents.on('did-finish-load', () => {
            try {
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
// 内容级汉化状态检测：基于解包产物判断当前 app.asar 属于哪种状态。
// asar header 只列文件名，旧版多点补丁（menu.js/tray.js/preload.js 内嵌代码）在 header 中不可见，
// 必须读文件内容才能识别，否则升级路径上会把旧版汉化包误判为官方原版并污染官方备份。
function detectHanhuaState(tempDir) {
    const distDir = path.join(tempDir, "dist");
    try {
        if (fs.existsSync(path.join(distDir, "antigravity_i18n_core.js"))) return 'new';
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
    const extractRes = runCommandSync(`npx -y @electron/asar extract "${asarPath}" "${tempDir}"`);
    if (!extractRes.success || !fs.existsSync(tempDir)) {
        console.error(`[错误] 解包失败，可能是由于系统未安装 Node.js/npm 或者网络限制。`);
        console.error(`详情: ${extractRes.stderr}\n${extractRes.stdout}`);
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

    // 3. 备份（决策依据解包内容，杜绝用任何汉化包覆盖官方备份）
    if (!fs.existsSync(bakPath)) {
        if (hanhuaState !== 'clean') {
            console.warn(`[警告] 当前为汉化版但未找到官方备份 app.asar.bak，无法创建可靠的卸载还原依据。`);
            console.warn(`[警告] 继续注入（不创建备份）。如需恢复官方英文，请重新安装官方 Antigravity 客户端。`);
        } else {
            console.log(`[备份] 正在创建官方原始包备份: app.asar.bak ...`);
            fs.copyFileSync(asarPath, bakPath);
            console.log(`[备份] 备份成功！`);
        }
    } else if (hanhuaState !== 'clean') {
        // 当前 app.asar 是汉化版（新版或旧版），还原官方备份后再全新注入
        try {
            fs.copyFileSync(bakPath, asarPath);
            console.log(`[还原] 已重置当前 app.asar 为官方原始备份包，以进行全新注入...`);
        } catch (e) {
            console.log(`[提示] 当前 app.asar 被锁定（可能是客户端正在运行），将使用当前包进行增量注入。`);
        }
    } else {
        // 当前是官方原版：对比 hash 判断是否升级过
        const currentHash = hashFile(asarPath);
        const bakHash = hashFile(bakPath);
        if (currentHash !== bakHash) {
            // 防呆：更新备份前再次确认当前包完好（hash 不同可能意味着上一轮打包失败留下了损坏的包）
            if (!isValidAsar(asarPath)) {
                console.error(`[错误] 当前 app.asar 不是有效的 asar 包，已中止操作以保护官方备份 app.asar.bak。请重新安装官方客户端后重试。`);
                return false;
            }
            console.log(`[检测] 检测到 Antigravity 已更新，正在更新官方备份 app.asar.bak ...`);
            fs.copyFileSync(asarPath, bakPath);
            console.log(`[备份] 官方备份已更新！`);
        } else {
            console.log(`[检测] app.asar 与官方备份一致，直接进行注入...`);
        }
    }

    // 3. 解析主入口（自适应：优先读 asar 内 package.json 的 main 字段，
    //    官方升级若调整入口路径（如 dist/main.js -> app/main.js）安装依然有效）
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
    const mainJsPath = path.join(tempDir, mainEntry);

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

    // 7. 重新打包
    console.log(`[打包] 正在将修改后的内容打包回 app.asar...`);
    const packRes = runCommandSync(`npx -y @electron/asar pack "${tempDir}" "${asarPath}"`);

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
    fs.copyFileSync(bakPath, asarPath);
    try {
        fs.unlinkSync(bakPath);
    } catch (e) {
        console.warn(`[警告] 备份文件删除失败（可稍后手动删除 app.asar.bak）: ${e.message}`);
    }
    console.log("[√] 官方 app.asar 已成功恢复！");
    return true;
}

// ==========================================
// Antigravity 1.0 汉化引擎 (旧版 HTML 注入模式)
// ==========================================
const OLD_TARGET_FILES = [
    path.join("resources", "app", "out", "vs", "code", "electron-browser", "workbench", "workbench-jetski-agent.html"),
    path.join("resources", "app", "out", "vs", "code", "electron-browser", "workbench", "workbench.html")
];

function backupFiles10(installDir) {
    for (const relPath of OLD_TARGET_FILES) {
        const absPath = path.join(installDir, relPath);
        const bakPath = absPath + ".bak";
        if (!fs.existsSync(absPath)) continue;
        if (!fs.existsSync(bakPath)) {
            fs.copyFileSync(absPath, bakPath);
            console.log(`[备份] 已创建旧版 HTML 备份: ${path.basename(absPath)}.bak`);
        } else {
            // 升级检测：当前文件是官方新版（不含汉化注入）且与备份 hash 不同 → 更新备份；
            // 含汉化注入时绝不更新，防止用汉化版覆盖官方备份导致卸载还原出版本混搭的 HTML
            try {
                const content = fs.readFileSync(absPath, 'utf-8');
                if (!content.includes('ag_agent_hanhua.js') && hashFile(absPath) !== hashFile(bakPath)) {
                    fs.copyFileSync(absPath, bakPath);
                    console.log(`[备份] 检测到官方更新，已更新备份: ${path.basename(absPath)}.bak`);
                }
            } catch (e) {
                console.warn(`[警告] 备份升级检测失败（跳过）: ${e.message}`);
            }
        }
    }
}

function injectHtml10(installDir, htmlRelPath) {
    const absPath = path.join(installDir, htmlRelPath);
    if (!fs.existsSync(absPath)) return false;
    
    let content = fs.readFileSync(absPath, 'utf-8');
    
    const injectStr = '<script src="../../../../ag_agent_hanhua.js"></script>';
    content = content.replace(/<script.*ag_agent_hanhua\.js.*><\/script>/g, '');
    
    if (content.includes('</body>')) {
        content = content.replace('</body>', `${injectStr}</body>`);
    } else {
        content += injectStr;
    }
        
    fs.writeFileSync(absPath, content, 'utf-8');
    return true;
}

function updateChecksums10(installDir) {
    const productJsonPath = path.join(installDir, "resources", "app", "product.json");
    if (!fs.existsSync(productJsonPath)) return;
    
    let data;
    try {
        data = JSON.parse(fs.readFileSync(productJsonPath, 'utf-8'));
    } catch (e) {
        console.warn(`[警告] product.json 解析失败，跳过校验值更新: ${e.message}`);
        return;
    }
    if (!data || typeof data !== 'object' || !Array.isArray(data.checksums) && typeof data.checksums !== 'object') {
        console.warn("[警告] product.json 中未找到 checksums 字段，跳过校验值更新。");
        return;
    }
    
    for (const relPath of OLD_TARGET_FILES) {
        const absPath = path.join(installDir, relPath);
        if (fs.existsSync(absPath)) {
            const key = relPath.replace(/\\/g, "/").replace("resources/app/out/", "");
            
            const fileBuffer = fs.readFileSync(absPath);
            const hash = crypto.createHash('sha256').update(fileBuffer).digest();
            data.checksums[key] = hash.toString('base64').replace(/=/g, '');
        }
    }
    
    fs.writeFileSync(productJsonPath, JSON.stringify(data, null, '\t'), 'utf-8');
}

function install10(installDir) {
    console.log("====== 检测到 Antigravity 1.0 架构，正在使用 HTML 注入引擎 ======");
    backupFiles10(installDir);
    
    // 生成单独的 js 汉化文件
    const hanhuaJsPath = path.join(installDir, "resources", "app", "out", "ag_agent_hanhua.js");
    fs.mkdirSync(path.dirname(hanhuaJsPath), { recursive: true });
    
    const jsContent = generateJs();
    fs.writeFileSync(hanhuaJsPath, jsContent, 'utf-8');
        
    let injectedCount = 0;
    for (const html of OLD_TARGET_FILES) {
        if (injectHtml10(installDir, html)) {
            injectedCount++;
            console.log(`[√] 注入成功: ${path.basename(html)}`);
        }
    }
    
    if (injectedCount === 0) {
        console.error(`[错误] 未找到任何可注入的目标 HTML 文件，官方包结构可能已变化，已中止。`);
        return false;
    }
            
    updateChecksums10(installDir);
    console.log("[√] Antigravity 1.0 汉化部署完成！");
    return true;
}

function restore10(installDir) {
    console.log("====== 正在恢复 Antigravity 1.0 官方原版 ======");
    let changed = false;
    for (const relPath of OLD_TARGET_FILES) {
        const absPath = path.join(installDir, relPath);
        const bakPath = absPath + ".bak";
        if (fs.existsSync(bakPath)) {
            fs.copyFileSync(bakPath, absPath);
            fs.unlinkSync(bakPath);
            console.log(`[还原] 已恢复 HTML: ${path.basename(absPath)}`);
            changed = true;
        }
    }
    
    const hanhuaJsPath = path.join(installDir, "resources", "app", "out", "ag_agent_hanhua.js");
    if (fs.existsSync(hanhuaJsPath)) {
        fs.unlinkSync(hanhuaJsPath);
        console.log(`[还原] 已删除汉化脚本`);
        changed = true;
    }
        
    if (changed) {
        updateChecksums10(installDir);
        console.log("[√] 校验值已同步，1.0 软件恢复至原始状态。");
        return true;
    }
    console.log("[!] 未找到 1.0 备份文件，未做任何更改。");
    return false;
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

    // 4. 根据架构执行
    const asarPath = path.join(resourcesDir, "app.asar");
    const isV2 = fs.existsSync(asarPath);
    let success = false;

    if (huifu) {
        console.log("====== 正在卸载中文汉化，恢复官方原版 ======");
        if (isV2) {
            success = restore20(resourcesDir);
        } else {
            success = restore10(installDir);
        }
    } else {
        console.log("====== 正在安装 Antigravity 中文汉化 ======");
        if (isV2) {
            success = install20(resourcesDir);
        } else {
            success = install10(installDir);
        }
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

main();
