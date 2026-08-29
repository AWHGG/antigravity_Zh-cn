/* --- ANTIGRAVITY CHINESE LOCALIZATION START --- */
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

    // 排版护盾样式：为按钮、菜单、下拉选择器与气泡添加通用防拆防挤压规则，防止中文在弹性布局中由于宽度受限异常折行
    try {
        if (!document.getElementById('ag-chinese-layout-guard')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'ag-chinese-layout-guard';
            styleEl.textContent = [
                '/* 模型选择器微调 */',
                'button[data-testid="model-selector-trigger"] span.opacity-70 { margin-left: 0.25rem !important; }',
                '/* 全局操作按钮、下拉选择器、模式切换框、气泡与菜单项防中文断字与竖排挤压 */',
                'button, [role="button"], [role="combobox"], [role="menuitem"], [role="tooltip"], [role="tab"], [aria-haspopup="true"], [aria-haspopup="listbox"], [aria-haspopup="menu"], .bg-secondary.cursor-pointer, [class*="cursor-pointer"]:not([class*="card"]):not([class*="item-large"]):not([class*="prose"]):not([class*="message"]) { word-break: keep-all !important; flex-shrink: 0 !important; }',
                'button:not([class*="card"]):not([class*="item-large"]), [role="button"]:not([class*="card"]), [role="combobox"], [aria-haspopup="true"]:not([class*="card"]), .bg-secondary.cursor-pointer { white-space: nowrap !important; min-width: max-content !important; }'
            ].join('\n');
            (document.head || document.documentElement).appendChild(styleEl);
        }
    } catch (e) {}

    // __AG_KERNEL__

    const translatedValues = new WeakMap();
    let isMutating = false;

    // 可翻译的 DOM 元素属性集合（统一规范，保证扫描、增量与拦截三处完全对齐）
    const TRANSLATABLE_ATTRS = ['placeholder', 'title', 'aria-label', 'data-tooltip', 'data-tip', 'data-title', 'data-balloon'];
    const TRANSLATABLE_ATTRS_SET = new Set(TRANSLATABLE_ATTRS);

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
        '[class*="markdown"]',
        '[class*="rich-text"]',
        '[class*="message-body"]',
        '[class*="chat-message"] .prose',
        '[data-role="assistant"] .prose',
        '[data-message-author="assistant"] .prose',
        '[data-message-author="assistant"] .whitespace-pre-wrap',
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
        '[data-is-generating]'
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
        // 用户输入内容容器；<input>/<textarea> 不在此列——其内容由 BLOCKED_TAGS 熔断，列入会迫使开设输入框例外口子
        '[contenteditable="true"]', '[role="textbox"]', '[role="searchbox"]',
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
        // 用户自定义历史会话标题（只保护标题文字，绝不封杀外层 UI）
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

    // 漏译记录助手：文本节点与元素属性共用同一套采集门禁（含英文字母、无中文、非代码特征、非行号锚点）
    function recordMissedText(valNorm) {
        if (!valNorm) return;
        if (!/[a-zA-Z]/.test(valNorm)) return;
        if (/[一-龥]/.test(valNorm)) return;
        if (isCodeLikeText(valNorm)) return;
        if (/^#L\d+(-\d+)?$/i.test(valNorm)) return;
        if (missedTexts.size < MISSED_TEXTS_MAX) missedTexts.add(valNorm);
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

    function translateDocumentTitle(title) {
        if (!title || typeof title !== 'string') return title;
        const valNorm = norm(title);
        if (!valNorm) return title;
        const exact = lookup(valNorm);
        if (exact) return exact;
        // 复合标题分段匹配（例如 "New chat — Antigravity" / "Settings - Antigravity"）
        const compound = translateCompoundTitle(title, part => lookup(part) || translateString(part, null) || part);
        if (compound) return compound;
        return translateString(valNorm, null) || title;
    }

    function translateElementAttrs(node) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
        for (const attr of TRANSLATABLE_ATTRS) {
            const v = node.getAttribute(attr);
            if (v) {
                const trans = translateAttrValue(v);
                if (trans && trans !== v) node.setAttribute(attr, trans);
                else if (!trans) recordMissedText(norm(v));
            }
        }
    }

    // 原生属性 Setter 拦截器：拦截动态属性赋值，即时完成属性汉化
    try {
        if (typeof Element !== 'undefined' && Element.prototype) {
            const origSetAttr = Element.prototype.setAttribute;
            Element.prototype.setAttribute = function(name, value) {
                if (typeof value === 'string' && TRANSLATABLE_ATTRS_SET.has(name)) {
                    const isBlocked = typeof this.closest === 'function' && this.closest(ALL_BLOCKED_SELECTOR);
                    if (!isBlocked) {
                        if (!/[\u4e00-\u9fa5]/.test(value)) {
                            const trans = translateAttrValue(value);
                            if (trans) value = trans;
                        }
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
                        if (typeof val === 'string' && !/[\u4e00-\u9fa5]/.test(val)) {
                            const isBlocked = typeof this.closest === 'function' && this.closest(ALL_BLOCKED_SELECTOR);
                            if (!isBlocked) {
                                const trans = translateAttrValue(val);
                                if (trans) val = trans;
                            }
                        }
                        return origTitleDesc.set.call(this, val);
                    },
                    get: origTitleDesc.get,
                    configurable: true,
                    enumerable: true
                });
            }
        }

        // document.title 拦截器：拦截页面标题动态设置，即时汉化窗口与标签栏标题
        const docProto = (typeof Document !== 'undefined' && Document.prototype) || (typeof HTMLDocument !== 'undefined' && HTMLDocument.prototype);
        if (docProto) {
            const origDocTitleDesc = Object.getOwnPropertyDescriptor(docProto, 'title');
            if (origDocTitleDesc && origDocTitleDesc.set) {
                Object.defineProperty(docProto, 'title', {
                    set: function(val) {
                        if (typeof val === 'string' && !/[\u4e00-\u9fa5]/.test(val)) {
                            const trans = translateDocumentTitle(val);
                            if (trans) val = trans;
                        }
                        return origDocTitleDesc.set.call(this, val);
                    },
                    get: origDocTitleDesc.get,
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

            // 文档窗口标题（<title> 文本）：走复合标题分段翻译（world 无关路径，覆盖框架在主 world 直接改 document.title 的场景）
            const titleParent = node.parentElement;
            if (titleParent && titleParent.tagName === 'TITLE') {
                if (!/[\u4e00-\u9fa5]/.test(originalVal)) {
                    const tTrans = translateDocumentTitle(originalVal);
                    if (tTrans && tTrans !== originalVal) {
                        translatedValues.set(node, tTrans);
                        isMutating = true;
                        try {
                            node.nodeValue = tTrans;
                        } finally {
                            isMutating = false;
                        }
                    }
                }
                // 标题节点不进漏译采集池（品牌词等高频噪声）
                return;
            }

            const valNorm = norm(originalVal);

            // 文本物理特征与代码语法防御（内核统一提供）：保护代码片段、路径与命令行
            if (isCodeLikeText(valNorm)) return;

            const transRes = translateString(valNorm, node);
            const newVal = transRes || originalVal;

            // 空格保真：保留完整首尾空白段（pre-line/pre-wrap 容器内的缩进与列对齐不塌缩）
            const wsLead = originalVal.match(/^\s+/);
            const wsTrail = originalVal.match(/\s+$/);
            let leadingWs = wsLead ? wsLead[0] : '';
            let trailingWs = wsTrail ? wsTrail[0] : '';
            const finalVal = leadingWs + newVal + trailingWs;
            if (finalVal !== originalVal) {
                translatedValues.set(node, finalVal);
                isMutating = true;
                try {
                    node.nodeValue = finalVal;
                } finally {
                    isMutating = false;
                }
            } else if (/[a-zA-Z]/.test(valNorm) && !/[一-龥]/.test(valNorm) && !(transRes && transRes === valNorm)) {
                if (!/^#L\d+(-\d+)?$/i.test(valNorm)) {
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
                    if (typeof n.matches === 'function' && n.matches(ALL_BLOCKED_SELECTOR)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    const tag = n.tagName ? n.tagName.toUpperCase() : '';
                    if (BLOCKED_TAGS.has(tag)) {
                        translateElementAttrs(n);
                        return NodeFilter.FILTER_REJECT;
                    }
                    translateElementAttrs(n);
                    if (n.shadowRoot) {
                        const hostCls = (typeof n.className === 'string' ? n.className : '').toLowerCase();
                        const hostTag = tag;
                        if (!hostCls.includes('xterm') && !hostCls.includes('terminal') && !hostCls.includes('monaco') && hostTag !== 'CANVAS') {
                            translateSubtree(n.shadowRoot);
                        }
                    }
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
    // 暴露引擎版本号：供运行诊断与仓库版本比对
    window.__AG_I18N_VERSION__ = AG_I18N_VERSION;

    window.__AG_MISSED_TEXTS__ = missedTexts;
    window.__AG_DUMP_MISSING__ = function() {
        const arr = Array.from(missedTexts).sort();
        console.log('[AG汉化] 未翻译文案 ' + arr.length + ' 条:\n' + arr.join('\n'));
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

    // 队列溢出单次兜底重扫：突发批量超过队列上限时，对整个可翻译树做一次全量重扫，绝不漏译。
    // 调度策略：requestIdleCallback 可用（真实 Chromium）走空闲周期；否则退化为 queueMicrotask 微任务 —
    // 微任务在 jsdom 与一切环境中确定性执行，避免依赖定时器时序（setTimeout 在部分环境会被吞导致漏译）。
    // WeakMap 缓存去重保证与分片队列并行执行时不会重复翻译。
    let overflowRescanScheduled = false;
    function scheduleOverflowRescan() {
        if (overflowRescanScheduled) return;
        overflowRescanScheduled = true;
        const run = () => {
            overflowRescanScheduled = false;
            try { translateSubtree(document.body || document.documentElement); } catch(e) {}
        };
        if (typeof requestIdleCallback === 'function') requestIdleCallback(run);
        else if (typeof queueMicrotask === 'function') queueMicrotask(run);
        else setTimeout(run, 0);
    }

    const observer = new MutationObserver(mutations => {
        if (isMutating) return;
        let count = 0;
        for (const m of mutations) {
            if (m.type === 'childList') {
                for (const n of m.addedNodes) {
                    if (n.nodeType === Node.ELEMENT_NODE) {
                        if (typeof n.closest === 'function' && n.closest(ALL_BLOCKED_SELECTOR)) continue;
                        const tag = n.tagName ? n.tagName.toUpperCase() : '';
                        if (BLOCKED_TAGS.has(tag)) {
                            translateElementAttrs(n);
                            continue;
                        }
                    } else if (n.nodeType === Node.TEXT_NODE) {
                        if (!shouldTranslateTextNode(n)) continue;
                    }
                    if (pendingQueue.length < 200) {
                        pendingQueue.push(n);
                        count++;
                    } else {
                        // 队列溢出：不静默丢弃，也不逐节点同步扫描；由空闲周期全量重扫兜底
                        scheduleOverflowRescan();
                    }
                }
            } else if (m.type === 'characterData') {
                const target = m.target;
                if (!target || !shouldTranslateTextNode(target)) continue;
                if (pendingQueue.length < 200) {
                    pendingQueue.push(target);
                    count++;
                } else {
                    scheduleOverflowRescan();
                }
            } else if (m.type === 'attributes') {
                const target = m.target;
                if (target && target.nodeType === Node.ELEMENT_NODE) {
                    if (typeof target.closest === 'function' && target.closest(ALL_BLOCKED_SELECTOR)) continue;
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
        attributeFilter: TRANSLATABLE_ATTRS
    };

    const startEngine = () => {
        // 观察/扫描根节点用 documentElement：覆盖 <head> 内 <title> 的 characterData 变更，
        // 使主 world 框架设置 document.title 后也能经 MutationObserver 走 TITLE 分支翻译（world 无关路径）
        const target = document.documentElement || document.body;
        if (target) {
            try { observer.observe(target, obsOpts); } catch (e) {}
            try { translateSubtree(target); } catch(e){}
        }
        try {
            if (document.title) {
                const transTitle = translateDocumentTitle(document.title);
                if (transTitle && transTitle !== document.title) document.title = transTitle;
            }
        } catch (e) {}
    };

    // 单次优雅初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startEngine, { once: true });
    } else {
        startEngine();
    }
})();
/* --- ANTIGRAVITY CHINESE LOCALIZATION END --- */