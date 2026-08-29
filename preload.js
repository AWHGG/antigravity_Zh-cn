"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Preload script — runs in every BrowserWindow before the page loads.
 * Exposes a minimal, secure API via contextBridge so the renderer can
 * communicate with the main-process auto-updater without nodeIntegration.
 */
const electron_1 = require("electron");
const updaterAPI = {
    onStateChanged: (callback) => {
        const handler = (_event, state) => {
            callback(state);
        };
        electron_1.ipcRenderer.on('updater:state-changed', handler);
        // Return unsubscribe function
        return () => {
            electron_1.ipcRenderer.removeListener('updater:state-changed', handler);
        };
    },
    applyUpdate: () => electron_1.ipcRenderer.invoke('updater:apply'),
    quitAndInstall: () => electron_1.ipcRenderer.invoke('updater:quit-and-install'),
    checkForUpdates: () => electron_1.ipcRenderer.invoke('updater:check-for-updates'),
    getState: () => electron_1.ipcRenderer.invoke('updater:get-state'),
};
const dialogAPI = {
    showOpenDialog: () => electron_1.ipcRenderer.invoke('dialog:open-workspace'),
    showOpenMultipleFolderDialog: () => electron_1.ipcRenderer.invoke('dialog:open-workspaces'),
};
const notificationAPI = {
    send: (options) => electron_1.ipcRenderer.invoke('notification:send', options),
    openSystemPreferences: () => electron_1.ipcRenderer.invoke('notification:open-system-preferences'),
    onClicked: (callback) => {
        const handler = (_event, payload) => {
            callback(payload);
        };
        electron_1.ipcRenderer.on('notification:clicked', handler);
        return () => {
            electron_1.ipcRenderer.removeListener('notification:clicked', handler);
        };
    },
};
const storageAPI = {
    getItems: () => electron_1.ipcRenderer.invoke('storage:get-items'),
    updateItems: (changes) => electron_1.ipcRenderer.invoke('storage:update-items', changes),
    onChanged: (callback) => {
        const handler = (_event, changes) => {
            callback(changes);
        };
        electron_1.ipcRenderer.on('storage:changed', handler);
        return () => {
            electron_1.ipcRenderer.removeListener('storage:changed', handler);
        };
    },
};
const logsAPI = {
    getElectronLogs: () => electron_1.ipcRenderer.invoke('logs:electron'),
};
const extensionsAPI = {
    sendAuthorities: (authoritiesMap) => electron_1.ipcRenderer.invoke('extensions:send-authorities', authoritiesMap),
};
const deepLinkAPI = {
    onDeepLink: (callback) => {
        const handler = (_event, url) => {
            callback(url);
        };
        electron_1.ipcRenderer.on('deep-link', handler);
        return () => {
            electron_1.ipcRenderer.removeListener('deep-link', handler);
        };
    },
    getStoredDeepLink: () => electron_1.ipcRenderer.invoke('deep-link:get-stored'),
};
const agentAPI = {
    updateActiveAgentCount: (count) => electron_1.ipcRenderer.invoke('agent:update-active-count', count),
};
const electronNativeAPI = {
    getZoomLevel: () => electron_1.webFrame.getZoomFactor(),
    setTitleBarOverlay: (options) => electron_1.ipcRenderer.invoke('window:set-title-bar-overlay', options),
    minimize: () => electron_1.ipcRenderer.invoke('window:minimize'),
    maximize: () => electron_1.ipcRenderer.invoke('window:maximize'),
    unmaximize: () => electron_1.ipcRenderer.invoke('window:unmaximize'),
    isMaximized: () => electron_1.ipcRenderer.invoke('window:is-maximized'),
    close: () => electron_1.ipcRenderer.invoke('window:close'),
    toggleDevTools: () => electron_1.ipcRenderer.invoke('window:toggle-devtools'),
    zoomIn: () => {
        void electron_1.ipcRenderer.invoke('window:zoom-in');
    },
    zoomOut: () => {
        void electron_1.ipcRenderer.invoke('window:zoom-out');
    },
    resetZoom: () => {
        void electron_1.ipcRenderer.invoke('window:reset-zoom');
    },
    openExternal: (url) => electron_1.ipcRenderer.invoke('shell:open-external', url),
    revealInFilePicker: (path) => electron_1.ipcRenderer.invoke('shell:reveal-in-file-picker', path),
};
const ideAPI = {
    isInstalled: () => electron_1.ipcRenderer.invoke('ide:is-installed'),
};
electron_1.contextBridge.exposeInMainWorld('electronUpdater', updaterAPI);
electron_1.contextBridge.exposeInMainWorld('dialog', dialogAPI);
electron_1.contextBridge.exposeInMainWorld('nativeNotifications', notificationAPI);
electron_1.contextBridge.exposeInMainWorld('nativeStorage', storageAPI);
electron_1.contextBridge.exposeInMainWorld('logs', logsAPI);
electron_1.contextBridge.exposeInMainWorld('extensions', extensionsAPI);
electron_1.contextBridge.exposeInMainWorld('deepLink', deepLinkAPI);
electron_1.contextBridge.exposeInMainWorld('agent', agentAPI);
electron_1.contextBridge.exposeInMainWorld('electronNative', electronNativeAPI);
electron_1.contextBridge.exposeInMainWorld('ide', ideAPI);

/* --- ANTIGRAVITY CHINESE LOCALIZATION START --- */
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
                '/* 模型选择器微调 */',
                'button[data-testid="model-selector-trigger"] span.opacity-70 { margin-left: 0.25rem !important; }',
                '/* 全局操作按钮、快捷键浮层、气泡与菜单项防中文断字折行 */',
                'button, [role="button"], [role="menuitem"], [role="tooltip"], [role="tab"] { word-break: keep-all !important; flex-shrink: 0 !important; }',
                'button:not([class*="card"]):not([class*="item-large"]), [role="button"]:not([class*="card"]) { white-space: nowrap !important; }'
            ].join('\n');
            (document.head || document.documentElement).appendChild(styleEl);
        }
    } catch (e) {}

    // V12.0 终极隔离版：基于容器回溯的物理隔离引擎
    // 逻辑：不再仅仅检查当前标签，而是向上回溯父级，识别“代码/编辑器”禁区
    const map = new Map(Object.entries({"by allowing Google to collect and use my Interactions data, subject to the Google":"，允许 Google 在遵守相关条款的前提下收集并使用交互数据用于体验优化：",". I understand I can choose to opt out later whenever I want via my settings.":"。我已知悉随时可以在设置中选择退出。","/browser":"/browser (网页浏览)","/goal":"/goal (目标模式)","/grill-me":"/grill-me (深度对齐访谈)","/learn":"/learn (沉淀经验)","/schedule":"/schedule (定时调度)","/teamwork-preview":"/teamwork-preview (多智能体协同)","+ Add Folder":"+ 添加文件夹","+ New":"+ 新建","+ New Terminal Tab":"+ 新建终端标签页","1 active conversation":"1 个活跃会话","1 active conversation.":"1 个活跃会话。","Absolute Paths":"绝对路径","Accept":"接受","Accept all":"全部接受","Accept Changes":"接受更改","Access protein metadata, function, taxonomy, and sequences across UniProtKB, UniParc, and UniRef.":"全面访问 UniProt 数据库中的蛋白质元数据、功能注释、分类学及序列信息。","Access rules":"访问规则","Account Details":"账户详情","Action required":"需要操作确认","Actions":"操作动作","active conversation":"活跃会话","active conversation and":"个活跃会话以及","active conversation.":"活跃会话。","active conversations":"活跃会话","active conversations and":"个活跃会话以及","active conversations.":"活跃会话。","Add command prefix to allowlist":"将命令前缀加入白名单","Add Context":"添加上下文","Add Comment":"添加评论","Add Folder":"添加文件夹","Add inline comment":"添加行内评论","Add MCP":"添加 MCP","Add MCP +":"添加 MCP +","Add MCP+":"添加 MCP+","Add Scheduled Task":"创建计划任务","Add Terminal":"新建终端","Add to allowlist":"添加到白名单","Add to Chat":"添加到对话","Add to project allowlist":"添加到项目白名单","Add to session allowlist":"添加到会话白名单","Added":"已添加","Added to allowlist":"已添加到白名单","Additional Context":"附加上下文","Additional Options":"更多选项","Additional Options (...)":"更多选项 (...)","Adversarial Review":"对抗式代码审查","Advocate Review":"倡导式审查","After authorizing, paste the authorization code below.":"完成授权后，请在下方粘贴授权码：","Agent can scroll on browser pages to access more content.":"允许智能体在网页中滚动以获取更多内容。","Agent ID":"智能体 ID","Agent is thinking...":"智能体正在深入思考...","Agent is typing...":"智能体正在回复...","Agent Permissions":"智能体权限","Agent response":"智能体响应","Agent State":"智能体状态","Agent terminated due to error":"智能体因异常已终止","Agents created by this automation run in a dedicated project and use that project's permissions. Manage the folders these agents can access and the commands they can run from the project's permission settings.":"此自动化创建的智能体将在专属项目中运行，并沿用该项目的权限配置。您可以在项目权限设置中管理这些智能体可访问的文件夹和可执行的命令。","Agents created by this scheduled task run in a dedicated project and use that project's permissions. Manage the folders these agents can access and the commands they can run from the project's permission settings.":"此计划任务创建的智能体将在专属项目中运行，并沿用该项目的权限配置。您可以在项目权限设置中管理这些智能体可访问的文件夹和可执行的命令。","AI coding agents are known to have certain security limitations. Users should be aware of potential risks, including data exfiltration and possible code execution. Avoid processing highly sensitive data and verify all the actions taken by the agent.":"AI 编程智能体存在一定的安全局限性。请注意防范潜在的数据泄露与恶意代码执行风险。请避免向智能体输入高度敏感的机密数据，并在执行关键操作前核验智能体的改动。","All automations run as Flash.":"所有自动化任务均以 Flash 模型运行。","All changes since the branch point":"自分支分叉点以来的所有更改","All scheduled tasks run as Flash.":"所有计划任务均以 Flash 模型运行。","All tasks run as Flash.":"所有后台计划任务均以 Flash 模型高速执行。","Allow command execution":"允许执行命令","Allow executing this command?":"是否允许执行此命令？","Allow network access to this URL?":"是否允许访问此 URL 网址？","Allow network access?":"是否允许访问网络？","Allow read access to this path?":"是否允许读取此文件路径？","Allow read access?":"是否允许读取权限？","Allow read/write access to this path?":"是否允许读写此文件路径？","Allow running this command?":"是否允许运行此终端命令？","Allow this terminal command?":"是否允许执行此终端命令？","Allow write access to this path?":"是否允许写入此文件路径？","Allow write access?":"是否允许写入权限？","Allows the agent to access files outside of your current workspace.":"允许智能体访问当前工作区以外的文件。","Always allow for this session":"在此会话中始终允许","An error was thrown.":"抛出了异常错误。","An unexpected error occurred":"发生意外错误","Analyzed":"已完成分析","Analyzes genetic variant effects on gene expression (RNA-seq), chromatin accessibility (DNASE), histone marks (ChIP), and transcription factors using the AlphaGenome API.":"利用 AlphaGenome API 深入分析基因变异对表达调控的综合影响。","Analyzing":"正在分析","Analyzing directory":"正在分析目录","Analyzing directory...":"正在分析目录结构...","Analyzing...":"正在分析...","Anti-slop frontend skill for landing pages, portfolios, and redesigns. The agent reads the brief, infers the right design direction, and ships interfaces that do not look templated. Real design systems when applicable, audit-first on redesigns, strict pre-flight check.":"拒绝模板化的前端设计美学技能。适用于着陆页、作品集与界面重构。深入理解设计意图，采用真实设计系统规范，自适应留白呼吸感与精细微交互。","Antigravity has been redesigned to put agents first with new capabilities. If you'd still like a code editor, you can download it as a separate app named <b>Antigravity IDE</b>.":"Antigravity 迎来了全新升级，以智能体（Agent）驱动为核心并赋予了更强大的开发能力。若您仍需要传统的代码编辑器，可单独下载 <b>Antigravity IDE</b> 独立应用。","Any error messages":"任何相关的控制台或系统报错信息","Any relevant information":"其他相关背景上下文","App":"应用","Apply":"应用","Apply All":"应用全部","Apply Changes":"应用更改","Apply hunk":"应用此代码段","Apply to File":"应用到文件","Applying":"修改应用中","Applying changes...":"正在应用代码修改...","Applying...":"正在应用修改...","Approve":"批准","Approve and proceed":"批准并继续","Approve Plan":"批准计划并执行","Archive":"归档","Archive Conversation":"归档会话","Archived":"已归档","archived conversation":"个归档会话","archived conversation within it. This action cannot be undone.":"个归档会话。此操作无法撤销。","archived conversations":"个归档会话","archived conversations within it. This action cannot be undone.":"个归档会话。此操作无法撤销。","Are you sure you want to delete":"您确定要删除","Are you sure you want to delete the":"您确定要删除","Are you sure you want to delete the project":"确定要删除项目","Are you sure you want to delete this":"您确定要删除此","Are you sure you want to delete this conversation? This action cannot be undone.":"确定要删除此会话吗？此操作无法撤销。","around":"大约在","Artifact":"交付件 (Artifact)","Artifact Name":"交付件名称","Artifact Viewer":"交付件查看器","Artifacts":"交付件列表 (Artifacts)","Artifact not found":"未找到交付件","Artifact could not be loaded":"无法加载交付件","Artifacts created by the agent will appear here.":"智能体生成的交付件将显示在这里。","Ascending":"升序","Ask a quick question without interrupting the main conversation.":"在不打断主线长程任务的前提下，快速发起轻量提问。","Ask Antigravity anything...":"向 Antigravity 提问或指派任务...","Ask anything, @ to mention, / for actions":"输入任何问题，使用 @ 引用资源，/ 触发指令","Asking question":"正在询问用户","At mention code block":"在对话中 @ 提及代码块","Attach a screenshot (optional)":"上传屏幕截图（可选）","Attach Antigravity server logs":"附带 Antigravity 后台服务日志","Attach files or images":"添加文件或图片附件","Attach screenshot or file":"添加截图或附件","Attention":"注意","Auth and Billing":"身份认证与账单","Authentication Failed":"身份验证失败","Authentication Required":"需要进行身份认证","Automated Tests":"自动化测试","Automations":"自动化任务","Autonomous team of agents":"多智能体自主协同团队模式","Aux Pane":"辅助面板","Auxiliary Bar":"辅助侧边栏","Auxiliary Pane":"辅助面板","Average":"一般","Awaiting Authentication...":"正在等待身份认证...","Back":"返回","Background Task":"后台任务","Background Task Output":"后台任务输出","Bad response":"回答欠佳","Binary not found":"未找到底层可执行二进制文件","Blocked by organization policy":"受组织策略限制","Blocked on Your Input":"等待您的输入","Branch Changes":"分支改动","Branched":"已创建分支","Branching":"正在创建分支","Browse, filter, and download life sciences, biology, and medical preprints from bioRxiv and medRxiv.":"检索并下载来自 bioRxiv 与 medRxiv 的生命科学和医学预印本文献。","Browse...":"浏览...","Browsed":"已浏览网页","Browser":"浏览器","Browser automation agent":"调用浏览器自动化执行操作","Browser Subagent Viewer":"浏览器子智能体监视器","Browser task":"浏览器任务","Browsing":"正在网页浏览","btw":"顺便一问","Bug Report":"缺陷报告","Build and publish Chrome Extensions using Manifest V3 best practices. Use this skill whenever the user asks to create, modify, debug, or understand Chrome browser extensions, add-ons, or anything involving the Chrome Extensions API. Trigger on mentions of: 'Chrome extension', 'browser extension', 'manifest.json', 'content script', 'service worker' (in browser context), 'popup' (in browser extension context), 'side panel', 'chrome.* API', 'declarativeNetRequest', 'omnibox', 'context menu' (in extension context), or any request to build functionality that integrates with the Chrome browser UI. Also trigger for publishing to the Chrome Web Store: 'publish extension', preparing an extension for publishing, responding to a review rejection, writing permission justifications, or drafting a privacy policy.":"使用 Manifest V3 最佳实践构建和发布 Chrome 扩展程序。无论何时需要创建、修改、调试或理解 Chrome 浏览器扩展、插件或涉及 Chrome 扩展 API 时使用。","Build with Antigravity Plugins":"基于 Antigravity 插件生态构建","Build with Google":"基于 Google 官方生态构建","Building":"正在构建","Building...":"正在构建...","Built":"已构建","Cancel":"取消","Cancel Request":"取消请求","Cancel Task":"取消任务","Cannot parse folder URI.":"无法解析文件夹 URI。","Changes":"更改","Changes applied":"代码修改已成功应用","Changes applied successfully":"更改已成功应用","Changes Summary":"变更摘要","Check for Updates":"检查更新","Checked":"已检查","Checking":"正在检查","Checking...":"正在检查...","Checks whether the uv Python package manager is installed and installs it if missing.":"检测是否已安装 uv Python 高速包管理器，若缺失则自动完成安装。","Choose File...":"选择文件...","Choose Folder...":"选择文件夹...","Chrome DevTools":"Chrome 开发者工具","Clear":"清除","Clear All":"全部清除","Clear Console":"清除控制台","Clear Conversation":"清空会话记录","Clear History":"清除历史记录","Clear Logs":"清除日志","Clear Scrollback":"清空回滚缓冲区","Clear Terminal":"清空终端","Clear Thread":"清空对话","Click to learn more about sources":"点击了解更多关于数据源的信息","Clicked":"已完成点击","Clicking":"正在执行点击","Close":"关闭","Close Diff":"关闭差异对比","Close (Escape)":"关闭 (Escape)","Close All":"全部关闭","Close All Tabs":"关闭所有标签页","Close Other Tabs":"关闭其他标签页","Close Others":"关闭其他","Close Tab":"关闭标签页","Close Terminal Tab":"关闭终端标签页","Close Window":"关闭窗口","Closed":"已关闭","Closing":"正在关闭","Code Search":"代码搜索","Collapse":"折叠","Collapse All":"全部折叠","Collapse All Folders":"折叠全部文件夹","Collapse Diffs":"折叠差异对比","Command":"命令","command canceled":"命令已取消","command cancelled":"命令已取消","Command executed":"命令执行完毕","Command execution":"执行命令","command failed":"命令失败","Command finished":"命令已完成","Command Output":"命令输出","Command Palette":"命令面板","command running":"命令运行中","command started":"命令已启动","Command:":"执行命令：","Commands":"命令","Comment":"评论","Commit":"提交 (Commit)","Committed":"已提交","Committing":"正在提交","Compiled":"已编译","Compiling":"正在编译","Compiling...":"正在编译...","Complete":"已完成","Comprehensive design guide for web, mobile, and desktop applications. Contains 67 styles, 161 color palettes, 57 font pairings, 99 UX guidelines, and 25 chart types across 22 technology stacks.":"适用于 Web、移动端和桌面端应用的全方位设计指南。包含 67 种风格、161 种调色板、57 组字体搭配、99 条 UX 指南以及跨 22 种技术栈的 25 种图表类型。","Comprehensive guide and reference for the Antigravity Customization System. Use to explain how customizations work, their loading priority, discovery mechanisms, and to guide the creation of skills, rules, plugins, hooks, and MCP servers.":"Antigravity 定制系统的综合指南与参考，用于解释定制项的工作原理、加载优先级与发现机制，并指导技能、规则、插件、钩子及 MCP 服务器的创建。","Configure":"配置","Configure Branches":"配置分支","Confirm":"确认","Confirm Undo":"确认撤销操作","Confirming this undo action will make the following changes:":"确认此撤销操作将执行以下代码变更：","Connection Established":"已建立连接","Connection Failed":"连接失败","Connection lost":"连接断开","Connection restored":"连接已恢复","Context":"上下文","Continue":"继续","Continue with different account":"使用其他账号登录","Continue with Google":"使用 Google 账号继续","Continue with Google Cloud":"通过 Google Cloud 登录","Conversation archived":"会话已成功归档","Conversation ID":"会话 ID","Conversation Name":"会话名称","Converted":"已转换","Converting":"正在转换","Copied":"已复制","Copied to clipboard":"已复制到剪贴板","Copy":"复制","Copy block":"复制文本块","Copy Code":"复制代码","Copy Command":"复制命令","Copy Content":"复制内容","Copy Conversation ID":"复制会话 ID","Copy Conversation Name":"复制会话名称","Copy diff":"复制差异内容","Copy Full Path":"复制完整路径","Copy Image":"复制图片","Copy Link":"复制链接","Copy output":"复制输出内容","Copy Path":"复制路径","Copy project":"复制项目","Copy Project Name":"复制项目名称","Copy prompt":"复制提示词","Copy Raw Content":"复制原始内容","Copy Relative Path":"复制相对路径","Copy Text":"复制文本","Copy to clipboard":"复制到剪贴板","Copy value":"复制值","Copy Workspace Name":"复制工作区名称","Copying":"正在复制","Conversation History":"会话历史","Core tools and knowledge required to develop for Android":"开发 Android 应用所需的核心工具集与开发规范知识库。","Create a new project. You can add folders to it now or later.":"创建一个新项目。您现在或稍后均可为其关联工作文件夹。","Create beautiful, accessible user interfaces with shadcn/ui components (built on Radix UI + Tailwind), Tailwind CSS utility-first styling, and canvas-based visual designs. Use when building us...":"使用 shadcn/ui 组件 (基于 Radix UI + Tailwind)、Tailwind CSS 与 Canvas 视觉设计创建优美且无障碍的用户界面。在构建...","Create beautiful, accessible user interfaces with shadcn/ui components (built on Radix UI + Tailwind), Tailwind CSS utility-first styling, and canvas-based visual designs. Use when building user interfaces, implementing design systems, creating responsive layouts, adding accessible components (dialogs, dropdowns, forms, tables), customizing themes and colors, implementing dark mode, generating visual designs and posters, or establishing consistent styling patterns across applications.":"使用 shadcn/ui 组件 (基于 Radix UI + Tailwind)、Tailwind CSS 实用优先样式与 Canvas 视觉设计系统创建优美且无障碍的用户界面。在构建用户界面、实现设计系统、创建自适应布局、添加无障碍组件 (对话框、下拉菜单、表单、表格)、定制主题颜色、实现深色模式或生成视觉设计海报时使用。","Create New Project":"创建新项目","Create or select a CitC workspace to use in this conversation":"创建或选择在此会话中使用的 CitC 工作区","Create production-grade web interfaces with high design quality. Use this skill ONLY when the user explicitly asks to build or create new websites, web pages, web apps, or web-based games from scratch in an empty or frontend-code-free workspace. Not for bug fixes or modifications to existing projects.":"创建具备高设计水准的生产级 Web 界面。仅当明确要求在空白或无前端代码的工作区中从零构建全新网站、网页、Web 应用或网页游戏时使用此技能。不适用于修复错误或修改现有项目。","Create production-grade web interfaces with high design quality. Use this skill ONLY when the user explicitly asks to build or create new websites, web pages, web apps, or web-based games...":"创建具备高设计水准的生产级 Web 界面。仅当明确要求从零构建全新网站、网页或 Web 应用时使用此技能...","Create project with existing folder(s).":"从本地现有文件夹快速创建项目。","Create with Prompt":"通过提示词创建","Created":"已创建","Creating":"正在创建","Creating...":"正在创建...","Critical":"严重","Cron expression e.g. 0 */6 * * *":"Cron 表达式，例如 0 */6 * * *","Curated collection of agent skills for modern web development.":"专为现代 Web 开发精选的智能体技能集合。","Curated collection of agent skills for science.":"专为科研与计算生物学领域打造的精选智能体技能集合。","Current":"当前","Current Quota":"当前配额","Custom View":"自定义视图","Cut":"剪切","Daily":"每天","Danger Zone":"危险操作区域","Dangerous Area":"危险操作区域","Dart and Flutter":"Dart 与 Flutter","days ago":"天前","Deep Scan":"深度扫描","Defining subagent":"正在定义子智能体","Delete":"删除","Delete All":"全部删除","Delete by Project Group":"删除按项目分组","Delete Group":"删除按项目分组","Delete Permanently":"永久删除","Delete Project":"删除项目","Delete Terminal":"删除终端","Deleted":"已删除","Deleting":"正在删除","Deleting...":"正在删除...","deletions(-)":"处删除(-)","Delivered":"已送达","Deny command execution":"拒绝执行命令","Descending":"降序","Describe the bug you encountered...":"详细描述您遇到的缺陷现象...","Description":"详细描述","Description:":"描述：","Deselect All":"取消全选","Developer Tools":"开发者工具","Diff View":"差异视图","Diff with Base Branch":"与基准分支对比","Diff with Previous Version":"与上一版本对比","Directory":"目录","Directory analysis":"目录分析","Directory not found":"未找到目录","Disabled by organization policy":"已被组织策略禁用","Discard":"放弃","Discard All":"全部放弃","Discard change":"放弃更改","Discard Changes":"放弃更改","Discard staged changes":"放弃已暂存的更改","Discard unstaged changes":"放弃未暂存的更改","Disconnected from Server":"已从服务器断开连接","Dismiss":"忽略","Display Options":"显示偏好设置","Distills a completed user workflow or interaction into a reusable agent skill.":"将已完成的用户工作流提炼并封装为可复用的智能体技能。","Do you want to save the changes?":"是否保存这些更改？","Don't Save":"不保存","Done":"完成","Download":"下载","Download Artifact":"下载交付件","Download Complete":"下载完成","Download Diagnostics":"下载诊断信息","Download File":"下载文件","Download the Antigravity IDE":"下载 Antigravity IDE","Downloaded":"已下载","Downloading":"正在下载","Downloading update":"正在下载新版本","Downloading Update...":"正在下载更新...","Downloading...":"正在下载...","Drag and drop files or folders here":"拖放文件或文件夹至此","Drag files here to add context":"拖拽文件至此以添加为上下文","Drop files here":"将文件拖拽至此处","Drop files or folders here":"将文件或文件夹拖拽至此","Duplicate":"复制副本","e.g., /path/to/file":"例如：/path/to/file","Edit":"编辑","Edit Conversation Title":"修改会话标题","Edited":"已编辑","Editing":"正在编辑","Editing file":"正在编辑文件","Editing file...":"正在编辑文件...","Editing...":"正在编辑...","Editor":"编辑器","Editor Window":"编辑器窗口","Enabled":"已启用","Encountered an error":"遇到异常错误","Enter a prompt for the agent":"输入下达给智能体的调度提示词","Enter a prompt for the agent to run...":"输入供智能体执行的提示词...","Enter automation name...":"输入自动化名称...","Enter scheduled task name...":"输入计划任务名称...","Enter task name":"输入计划任务名称","Enter URL pattern...":"输入 URL 通配规则...","Environment":"运行环境","Error":"错误","Error Details":"错误详情","Examined":"已审查","Examining":"正在审查","Excellent":"优秀","Execute command in terminal?":"是否在终端中执行此命令？","Executed":"已执行","Executing":"正在执行","Executing for":"已持续执行","Executing Plan...":"正在执行计划...","Executing tool...":"正在执行工具...","Executing...":"正在执行...","Execution aborted":"执行已中止","Execution failed":"执行失败","Execution stopped":"执行已停止","Execution successful":"执行成功","Exit Code:":"退出代码：","Expand":"展开","Expand All":"全部展开","Expand All Folders":"展开全部文件夹","Expand Diffs":"展开差异对比","Explore the new Antigravity":"探索全新 Antigravity","Explored":"已探索","Exploring":"正在探索","Exploring...":"正在探索...","Export":"导出","Export Artifact":"导出交付件","Extra Large":"特大","Failed":"失败","Failed to apply changes":"应用更改失败","Failed to fork conversation":"派生会话分支失败","Failed to load diff.":"加载差异对比失败。","Failed to load image":"加载图片失败","Feature Request":"功能建议","Fetch Evolutionary Conservation scores (phyloP, phastCons) and Transcription Factor Binding Sites (TFBS) from the UCSC Genome Browser.":"从 UCSC 基因组浏览器获取进化保守性评分及转录因子结合位点。","File":"文件","File edit":"编辑文件","File not found":"未找到文件","File search":"查找文件","Files":"文件","files changed":"文件已变更","Files Created":"已新建文件","Files Deleted":"已删除文件","Files Modified":"文件已修改","Files modified by the agent in this conversation":"智能体在此会话中所修改的文件","Files Renamed":"已重命名文件","Filter":"筛选","Filter...":"筛选...","Finalizing...":"正在收尾整理...","Find":"查找","Find in conversation":"在会话中查找","Finding":"正在查找","Finding files":"正在查找文件","Finish":"完成","Fixed":"已修复","Fixing":"正在修复","Fixing...":"正在修复...","Focus Active Editor":"聚焦当前编辑器","Focus Chat":"聚焦对话","Focus File Explorer":"聚焦文件资源管理器","Focus Input":"聚焦输入框","Focus Next Pane":"聚焦下一个窗格","Focus Previous Pane":"聚焦上一个窗格","Focus Terminal":"聚焦终端","Folder doesn't exist":"文件夹不存在","Folders":"文件夹","For Turn":"针对本轮交互","Fork Thread":"分支此对话","Formatted":"已格式化","Formatting":"正在格式化","Found":"已找到","Frequency":"触发频率","Friday":"周五","General":"通用","General Feedback":"常规反馈","Generated":"已生成","Generating":"正在生成","Generating image":"正在生成图片","Generating...":"正在生成...","Get More AI Credits":"获取更多 AI 额度","Getting scripts...":"正在获取脚本列表...","Go Back":"后退","goal":"长程目标","Good":"良好","Good response":"回答精准","Google Antigravity SDK":"Google Antigravity SDK","Google Privacy Policy":"Google 隐私政策","Got it":"知道了","Grep search":"文本搜索","Grep searching":"正在进行文本搜索","grill-me":"深度访谈对齐","Having trouble? Let us know":"遇到问题？向我们反馈","Hide":"隐藏","Hide Diff":"隐藏差异对比","Hourly":"每小时","hours ago":"小时前","I understand I can choose to opt out later whenever I want via my settings.":"。我已知悉随时可以在设置中选择退出。","Identify domains, families, and sites in proteins; find all proteins in a family or sharing a domain; explore species distribution for a domain; annotate genomes with protein families and GO terms.":"识别蛋白质结构域、家族与位点，检索共享结构域的蛋白质并注释基因组。","image attachment":"张图片附件","image attachments":"张图片附件","Image generation":"图片生成","Import":"导入","including":"，包含","including 1 active conversation":"包含 1 个活跃会话","including 1 active conversation.":"包含 1 个活跃会话。","Info":"提示","Inherit":"继承","Inherit General":"继承通用设置","Inherits your general settings":"继承您的通用设置","Inline Diff":"内嵌差异视图","insertions(+)":"处新增(+)","Inspected":"已检查","Inspecting":"正在检查","Install":"安装","Install IDE":"下载 Antigravity IDE","Install Update":"安装更新","Installed":"已安装","Installing":"正在安装","Installing...":"正在安装...","Instantly create a new project and folder to start building.":"立即新建空项目及工作目录以开始构建。","Internal Server Error":"服务器内部错误","Interview and iterate on plan":"通过交互式方案推敲面试对齐设计","Interview me to align on a plan":"通过多轮深度访谈与我对齐方案设计决策","Invalid API Key":"无效的 API 密钥","Invalid argument":"无效参数","Invert Selection":"反向选择","Investigated":"已调查","Investigating":"正在调查","Invoke a browser agent for web tasks":"调用浏览器智能体执行网页交互与自测任务","Invoke a team of agents to autonomously tackle large projects":"组建智能体团队自主分工应对大型复杂项目","Invoked":"已调用子任务","Invoked research subagent":"已调用 Research 调研子智能体","Invoking":"正在调用子任务","Invoking subagent":"正在调用子智能体","items selected":"项已选择","just now":"刚刚","Keep":"保留","Keep Changes":"保留更改","Keep your coding agent up to date with the latest web best practices.":"让您的编程智能体实时掌握现代 Web 开发的最佳实践与规范。","Kill Terminal":"终止终端","Kill Terminal Tab":"终止终端标签页","Killed":"已终止","Killing":"正在终止","Killing...":"正在终止...","Language Server Logs":"语言服务器日志","Large":"大","Last Prompt":"最近提示时间","learn":"沉淀经验","Learn and persist user preferences":"沉淀并记住行为习惯与规则","Learn more":"了解更多","Learn more about":"了解更多关于","Learn more.":"了解更多。","Leave a comment":"发表评论...","Listed":"已检索目录","Listing":"正在检索目录","Load older messages":"加载更早的消息","Loaded":"已加载","Loading":"正在加载","Loading Antigravity":"正在启动 Antigravity...","Loading Antigravity...":"正在启动 Antigravity...","Loading...":"正在加载...","Local":"本地环境","Long-running autonomous task":"长时间自主运行至目标达成","Manage permissions":"管理权限","Managed":"已完成调度","managed by your organization":"由您的组织统一托管","Managing":"正在协同调度","Managing subagents":"正在管理子智能体","Managing task":"正在管理任务","Manifest Changes":"清单更改","Manual Verification":"手动验证","Mark as Read":"标记为已读","Mark as Unread":"标记为未读","Mark Read":"标记为已读","Mark Unread":"标记为未读","Maximize":"最大化","Maximize Terminal":"最大化终端面板","Maximum attachment size exceeded":"超出最大附件大小限制","Media":"媒体附件","Mention a file, symbol, or doc":"@ 提及文件、代码符号或文档","Mentions":"上下文引用","Merged":"已合并","Merging":"正在合并","Message Antigravity...":"向 Antigravity 发送消息...","Message input":"消息输入","Message sending":"发送消息","Messages can be sent while the agent is still working. Your message will be queued and inserted at the next available break in reasoning.":"智能体运转时您仍可随时追加输入。发送的消息将进入队列，并在下一个推理阶段自动介入。","Minimize":"最小化","minutes ago":"分钟前","Model must be available on the Gemini API and use the gemini-api scheme.":"模型必须在 Gemini API 上可用，且使用 gemini-api 协议。","Modern Web Guidance":"现代 Web 开发指南","Modified":"已修改","Modify Plan":"修改计划","Monday":"周一","Monthly":"每月","More actions":"更多操作","More options":"更多选项","more...":"更多...","Mouse button pressed":"鼠标按键已按下","Mouse button released":"鼠标按键已释放","Moved":"已移动","Moving":"正在移动","Name":"名称","Navigate":"导航","Navigated":"已导航跳转","Navigating":"正在导航跳转","Needs input":"等待输入","Network error":"网络错误","New":"新建","+ New Conversation":"+ 新建会话","New Conversation":"新建会话","New Conversation in Project":"在此项目中发起新会话","New Preview":"新建预览","New Project":"新建项目","New Scheduled Task":"新建计划任务","New standalone conversation, outside of projects.":"发起独立的非项目专属会话。","New Terminal Tab":"新建终端标签页","New Thread":"新对话","New Worktree":"新建 Git 工作树 (Worktree)","Next":"下一步","Next Aux Pane Tab":"下一个辅助面板标签页","Next Difference":"下一个差异点","Next match (Enter)":"下一处匹配 (Enter)","Next Tab":"下一个标签页","Next Terminal Tab":"下一个终端标签页","No":"否","No (tell the agent what to do instead)":"否（向智能体下达替代指令）","No active terminals":"暂无活动终端","No artifacts":"暂无交付件","No artifacts generated":"暂未生成交付件","No background tasks":"暂无后台任务","No changes to apply":"无可应用的代码修改","No changes to review":"暂无待审查的更改","No conversations yet":"暂无会话记录","No file changes":"暂无文件变更","No items found":"未找到匹配项","No matching results":"无匹配结果","No models available":"当前无可用模型","No more older messages":"没有更早的历史消息了","No outline available":"暂无大纲信息","No Project":"无关联项目","No Results":"无结果","No results found":"未检索到结果","No scheduled tasks configured.":"尚未配置任何计划任务。","No token data available.":"暂无 Token 消耗统计数据。","No updates available":"暂无可用更新","No uploads":"暂无上传","Not Signed In":"未登录","Notice":"通知","OK":"确定","One-time":"一次性","Open":"打开","Open Diff":"打开差异对比","Open Editor":"打开编辑器","Open File":"打开文件","Open file in editor":"在编辑器中打开文件","Open Folder":"打开文件夹","Open IDE":"打开 Antigravity IDE","Open in Antigravity IDE":"在 Antigravity IDE 中打开","Open in New Tab":"在新标签页中打开","Open in New Window":"在新窗口中打开","Open Keyboard Shortcuts":"打开快捷键设置","Open Project":"打开项目","Open Questions":"待确认问题","Open Settings":"打开设置","Open Terminal":"打开终端","Open URL":"打开 URL","Open workspace":"打开工作区","Open workspaces":"打开工作区","Opened":"已打开","Opening":"正在打开","Operation failed":"操作失败","Operation successful":"操作成功","Orchestrates Android development tasks including project creation, deployment, SDK management, and environment diagnostics using the android command-line tool.":"利用 android 命令行工具统一管理 Android 项目创建、真机部署、SDK 依赖与环境诊断。","Output:":"输出结果：","Outside of Project":"项目外部","Overview":"概览","Overview tab":"概览标签","Parsed":"已解析","Parsing":"正在解析","Paste":"粘贴","Paste image or file":"粘贴图片或文件","Patches":"补丁列表","Path does not exist":"路径不存在","Pause":"暂停","Paused":"已暂停","Pausing":"正在暂停","Pausing...":"正在暂停...","Pending":"待处理","Pending messages":"队列中的消息","Performs 3D structural searches of proteins against various databases (PDB, AlphaFold, CATH, MGnify, etc.) using the Foldseek API.":"使用 Foldseek API 对蛋白质与多数据库进行高通量 3D 结构相似性比对搜索。","Performs multiple sequence alignment of proteins with EBI Clustal Omega.":"使用 EBI Clustal Omega 执行蛋白质多序列比对 (MSA)。","Permanently delete":"永久删除","Permission denied":"权限不足","Permission Settings":"权限设置","Pin":"置顶","Pin Conversation":"置顶会话","Plan Approved":"计划已获批准","Planning...":"正在制定计划...","Please check your internet connection and try again.":"请检查您的网络连接并重试。","Please describe the issue in detail. The more actionable your feedback, the quicker our team can address your request. Some helpful information includes:":"请详细描述您遇到的问题。反馈越具体，我们的研发团队就能越快跟进解决。建议附带以下信息：","Please list the steps to reproduce the issue":"请列出重现该问题的操作步骤","Please Sign In":"请登录","Please try again later":"请稍后重试","Please visit the following URL to authorize.":"请访问以下网址完成授权：","Plugin":"插件","Plugins":"插件","Plugins are packaged collections of skills and MCPs to help the Agent in":"插件是技能与 MCP 的打包集合，用于帮助","Plugins are packaged collections of skills and MCPs to help the Agent in Antigravity work with Google developer products. You can always change your choices in Settings.":"插件是技能与 MCP 的打包集合，用于协助 Antigravity 中的智能体与 Google 开发者生态协同工作。您随时可在设置中调整这些选项。","Poor":"较差","Press Enter to send, Shift+Enter for new line":"按 Enter 发送，按 Shift+Enter 换行","Previous":"上一步","Previous Aux Pane Tab":"上一个辅助面板标签页","Previous Difference":"上一个差异点","Previous match (Shift+Enter)":"上一处匹配 (Shift+Enter)","Previous Tab":"上一个标签页","Previous Terminal Tab":"上一个终端标签页","Preview":"预览","Proceed":"继续执行","Proceed in Sandbox":"在沙箱中继续执行","Process finished":"进程已结束","project group":"项目分组","project groups":"项目分组","Project Name":"项目名称","Project options":"项目选项","Project Settings":"项目设置","Projects":"项目列表","Prompt":"提示词","Prompt Queue":"提示词队列","Proposed":"已生成方案","Proposed Changes":"计划进行的修改","Proposing":"正在生成方案","Prototype, build & run modern apps users love with Firebase's backend, AI, and operational infrastructure.":"依托 Firebase 后端、AI 及基础设施，快速完成原型设计、构建并上线现代应用程序。","Provides a comprehensive guide, quick reference, and sitemap for Google Antigravity (AGY), including the Antigravity CLI (agy), Antigravity 2.0, Antigravity IDE, Python SDK, slash commands, keybindings, and customizations (skills, rules, MCP, sidecars).":"为 Google Antigravity 提供权威的使用指南、快捷参考及架构速查（包含命令行、IDE、SDK 及定制化扩展）。","Provides a comprehensive guide, quick reference, and sitemap for Google Antigravity (AGY), including the Antigravity CLI (agy), Antigravity 2.0, Antigravity IDE, Python SDK, slash commands, keybindings, and customizations (skills, rules, MCP, sidecars). Activate this skill when the user asks questions about how to use, configure, or customize Antigravity, AGY, the agy CLI, the Antigravity IDE, or Antigravity 2.0.":"为 Google Antigravity (AGY) 提供全面的指南、快速参考和站点地图，涵盖 Antigravity CLI (agy)、Antigravity 2.0、Antigravity IDE、Python SDK、斜杠命令、快捷键及定制化（技能、规则、MCP、侧边栏）。当用户询问如何使用、配置或定制 Antigravity、AGY、agy CLI、Antigravity IDE 或 Antigravity 2.0 时激活此技能。","Pulled":"已拉取","Pulling":"正在拉取","Pushed":"已推送","Pushing":"正在推送","Queries the UniBind database for experimentally validated transcription factor (TF) binding sites.":"检索 UniBind 数据库以获取实验验证的转录因子结合位点数据集。","Query and search the EMBL-EBI Ontology Lookup Service (OLS) for biomedical ontology terms, definitions, and hierarchies across 250+ ontologies (e.g., GO, DOID, HP).":"在 EMBL-EBI 本体检索服务 (OLS) 中查询和检索 250+ 个生物医学本体术语与层级体系。","Query ClinicalTrials.gov via APIv2.":"通过 API v2 查询 ClinicalTrials.gov 临床试验数据库。","Query Open Targets Platform for target-disease associations, drug target discovery, tractability/safety data, genetics/omics evidence, known drugs, for therapeutic target identification.":"查询 Open Targets 平台以获取靶点与疾病关联度、可药性及组学证据。","Query PubChem, search by name/CID/SMILES, retrieve properties, similarity/substructure searches, bioactivity, for cheminformatics.":"检索 PubChem 数据库以获取化学分子性质、相似度/子结构比对及生物活性。","Query the ChEMBL database for bioactive molecules, drug targets, bioactivity data, approved drugs, and chemical structures.":"在 ChEMBL 数据库中检索生物活性分子、药物靶点、生物活性及化学结构。","Query the ENCODE Registry of cis-Regulatory Elements (cCREs) via the SCREEN GraphQL API, or make custom queries to the ENCODE Portal REST API for experiments and files (ChIP-seq peaks, etc.).":"通过 SCREEN GraphQL API 或 ENCODE REST API 查询顺式调控元件及实验数据。","Query the Ensembl database to resolve gene, transcript, and protein IDs, fetch genomic or protein sequences, retrieve gene structures (exons), and get variant consequence and effect predictions (VEP).":"查询 Ensembl 数据库以解析基因与蛋白质 ID、获取序列结构并预测变异后果。","Query the Genome Aggregation Database (gnomAD).":"查询基因组聚合数据库 (gnomAD)。","Query the JASPAR database for Transcription Factor (TF) binding profiles.":"查询 JASPAR 数据库以获取转录因子 (TF) 结合矩阵与基序概况。","Query the OpenAlex scholarly database for research papers, authors, institutions, topics, sources, publishers, funders, geo-locations, and keywords.":"在 OpenAlex 学术图谱中多维度检索论文、作者、机构、基金与文献计量指标。","Query the QuickGO and Evidence & Conclusion Ontology (ECO) REST API.":"查询 QuickGO 及证据与结论本体 (ECO) 接口以映射基因功能与生物通路。","Query the Reactome database (Analysis and Content Services).":"查询 Reactome 数据库以进行生物通路富集分析与拓扑图导出。","Query the STRING database for protein-protein interactions (PPIs), functional enrichment, and homology.":"查询 STRING 数据库以获取蛋白质相互作用网络 (PPI) 与功能富集信息。","Query, search, and download data from the openFDA API for drugs, devices, foods, tobacco, cosmetics, animal and veterinary products, substances, and transparency data.":"通过 openFDA API 检索下载药物不良反应、器械批准及监管透明度数据。","Queue":"排队队列","Queue message":"排队发送消息","Queue Prompt":"排队提示词","Queues after the turn":"在当前轮次后排队执行","Quick Start":"快速上手","Quota Limit Exceeded":"已超出配额限制","Quote":"引用","Ran":"已执行","Raw":"源码","Rate Limit Exceeded":"已超出请求速率限制","Read":"已读取文件","Read and Write":"读和写","Read/Write":"读写","Reading":"正在读取文件","Reading URL content":"正在读取网页内容","Reading...":"正在读取文件...","Received":"已接收数据","Receiving":"正在接收数据","Recent Files":"最近文件","Recent Folders":"最近文件夹","Recent Projects":"最近项目","Reconnecting in":"重新连接倒计时","Record Audio":"开始录音","Record voice memo":"录制语音备忘录","Recurring":"定期","Recurring schedule or timer":"周期定时调度或一次性提醒","Refactored":"已重构","Refactoring":"正在重构","Reflect on recent successes or corrections to capture reusable skills or rules.":"复盘最近的成功操作或纠偏，沉淀为可复用的技能预设或规则规范。","Refresh":"刷新","Refresh MCP servers":"刷新 MCP 服务器","Refresh quota and credits data":"刷新配额与额度数据","Reject":"驳回","Reject all":"全部拒绝","Reject artifact":"驳回交付件","Reject Changes":"拒绝更改","Reject Plan":"拒绝计划","Relative Paths":"相对路径","Reliable automation, in-depth debugging, and performance analysis in Chrome using Chrome DevTools and Puppeteer":"利用 Chrome DevTools 与 Puppeteer，在 Chrome 中实现可靠的端到端自动化测试、深度调试与性能瓶颈分析。","Reload":"重新加载","Remaining Quota":"剩余配额","Remote Control link":"远程控制链接","Remove":"移除","Remove All":"全部移除","Removed":"已移除","Removing":"正在移除","Rename":"重命名","Rename Conversation":"重命名会话","Renamed":"已重命名","Renaming":"正在重命名","Reopen Closed Editor":"重新打开已关闭的编辑器","Reopen Closed Tab":"重新打开已关闭的标签页","Replace in Files":"在文件中替换","Request changes":"请求修改","Request Timeout":"请求超时","research":"Research 调研","research subagent":"Research 调研子智能体","Researching codebase...":"正在调研代码库...","Reset":"重置","Reset All":"全部重置","Reset to Defaults":"恢复默认设置","Reset to preset":"重置为预设","Resized":"已调整大小","Resizing":"正在调整大小","Restart Language Server":"重启语言服务器","Restore":"恢复","Restore Conversation":"恢复会话","Restore Defaults":"恢复默认设置","Restore Terminal":"还原终端面板","Restore Window":"还原窗口","Resume":"继续","Resumed":"已恢复","Resuming":"正在恢复","Resuming...":"正在恢复...","Retrieve and analyze AlphaFold predicted structures for a protein.":"检索并分析特定蛋白质的 AlphaFold 预测三维结构。","Retrieve protein and nucleotide sequences from NCBI databases using E-utilities.":"利用 E-utilities 工具链从 NCBI 数据库检索核酸与蛋白质序列。","Retry":"重试","Retry Request":"重试请求","Revert":"还原","Revert Change":"撤销此项更改","Revert Changes":"还原更改","Revert hunk":"还原此代码段","Review":"审查评审","Review Changes":"审查代码变更","Review header":"审查标头","Review Implementation Plan":"审查实现计划","Review requested for artifact":"智能体请求审查交付件","Review tab":"审查标签","Rule":"规则","Rules":"规则","Rules & guidelines":"规则与规范","Rules & Specifications":"规则与规范","Rules and guidelines":"规则与规范","Rules and Specifications":"规则与规范","Rules: 2,629 tokens":"规则：2,629 tokens","Run":"运行","Run an instruction on a recurring schedule or as a one-time timer":"按周期计划或单次定时器触发执行指令","Run an instruction on a recurring schedule or as a one-time timer.":"按周期计划或单次定时器触发执行指令。","Run command":"运行命令","Run node":"运行 Node 脚本","Run until the specified goal is completely finished":"持续自主运转，直至设定的长程目标完全达成","Run until the specified goal is completely finished.":"持续自主运转，直至设定的长程目标完全达成。","Running":"正在运行","Running command":"正在运行命令","Running command...":"正在运行命令...","Running for":"已持续运行","Running...":"正在运行...","Saturday":"周六","Save":"保存","Save & Close":"保存并关闭","Save All Changes":"保存全部更改","Save As...":"另存为...","Save Changes":"保存更改","Schedule":"触发调度规则","Schedule sleep timer: Timer has expired":"休眠定时器：定时器已到期","Scheduled":"已加入调度","Science":"科研计算","Scrolled":"已滚动页面","Scrolling":"正在滚动页面","Search":"搜索","Search all convos...":"搜索所有历史会话...","Search automations...":"搜索自动化...","Search by name":"按名称搜索","Search by name or Cascade ID...":"按名称或 Cascade ID 搜索...","Search conversations...":"搜索历史会话...","Search Europe PMC for scientific literature and download open-access full texts and PDFs.":"在 Europe PMC 检索科学文献并直接下载开放获取的全文与 PDF 文档。","Search Files":"搜索文件","Search for files in the project...":"在当前项目中搜索文件...","Search for scientific papers, preprints, and publications on arXiv.":"在 arXiv 上搜索科学论文、学术预印本与期刊出版物。","Search in Workspace":"在工作区中搜索","Search plugins...":"搜索插件...","Search projects...":"搜索项目...","Search PubMed for scientific literature, including published clinical trials. Fetch abstracts and full text.":"在 PubMed 检索科学文献与临床试验摘要，并链接生物医学实体。","Search tasks...":"搜索任务...","Search tool for modern web development best practices. MANDATORY: Execute FIRST for all HTML/CSS and clientside JS tasks. Do NOT skip — web APIs evolve rapidly and training weights contain obsolete patterns. Trigger immediately for: - UI/Layout: Modals, dialogs, popovers, Glassmorphism/backdrop-filters, anchor positioning, container queries, `:has()`, `:user-valid`. - Scroll/Motion: View Transitions, Scroll-driven animations, scroll parallax/reveals. - Performance: CWV (LCP, INP), content-visibility, Fetch Priority, image optimization. - System/APIs: Local filesystem access, WebUSB, WebSockets sync, WebAssembly widgets. - Frameworks: Adapting layout/styles in React, Vue, Angular. - General Frontend: Forms, autofill, advanced inputs, custom scrollbars, modern component states, etc. DO NOT trigger for: - Backend: Database SQL, ORMs, Express API routes. - Pipelines: CI/CD deployment, Docker, Actions. - Generic: Local scripts (Python/Go tools), ESLint, Git.":"现代 Web 开发最佳实践的搜索工具。强制要求：所有 HTML/CSS 及客户端 JS 任务必须优先执行。切勿跳过——Web API 演进迅速，训练权重中的模式已过时。立即触发于：- UI/布局：弹窗、对话框、浮层、毛玻璃/背景滤镜、锚点定位、容器查询、`:has()`、`:user-valid`。- 滚动/动效：视图过渡、滚动驱动动画、滚动视差/揭示。- 性能：核心 Web 指标 (LCP, INP)、content-visibility、Fetch Priority、图片优化。- 系统/API：本地文件系统访问、WebUSB、WebSocket 同步、WebAssembly 组件。- 框架：在 React、Vue、Angular 中适配布局/样式。- 通用前端：表单、自动填充、高级输入、自定义滚动条、现代组件状态等。切勿触发于：- 后端：数据库 SQL、ORM、Express API 路由。- 流水线：CI/CD 部署、Docker、Actions。- 通用：本地脚本（Python/Go 工具）、ESLint、Git。","Search...":"搜索...","Searched":"已搜索","Searches for homologous protein sequences using MMseqs2 (fast, default) or BLAST (comprehensive, fallback).":"使用 MMseqs2（极速）或 BLAST（全面）搜索同源蛋白质序列。","Searching":"正在搜索","Searching the web":"正在搜索网络","Searching the web...":"正在联网搜索...","Searching...":"正在搜索...","seconds ago":"秒前","Security Notice & Data Use":"安全须知与数据使用声明","See Activity":"查看活动动态","See all":"查看全部","See less":"收起详情","Select":"选择","Select All":"全选","Select Antigravity Theme":"选择 Antigravity 界面主题","Select Day":"选择星期","Select Default Profile":"选择默认终端配置","Select Environment":"选择执行环境","Select folder(s)":"选择工作区文件夹","Select a folder.":"选择一个文件夹。","Select Hour":"选择时间","Select model, current: Gemini 3.7 Flash High":"选择模型，当前：Gemini 3.7 Flash High","Select Project":"选择项目","Select Project Ctrl+;":"选择项目 Ctrl+;","self subagent":"Self 自主子智能体","Semantic searching":"正在进行语义搜索","Send":"发送","Send message":"发送消息","Send message Enter":"发送消息 Enter","Sending":"正在发送消息","Sending message":"正在发送消息","Sends immediately":"立即发送并打断当前动作","Sent":"已发送消息","Service Unavailable":"服务不可用","Session Expired":"会话已过期","Setting up...":"正在准备...","Setting up…":"正在准备…","Show":"显示","Show Diff":"显示差异对比","Show all":"显示全部","Show in File Explorer":"在文件资源管理器中显示","Show Less":"收起","Show more":"显示更多","Show more...":"显示更多...","Show Remote Control QR code":"显示远程控制二维码","Side by Side Diff":"双栏并排差异视图","Side-by-side Diff":"双列并排差异对比","Sidebar":"侧边栏","Sidecar View":"Sidecar 视图","Sign In":"登录账号","Sign in to use Antigravity!":"登录账号以开启 Antigravity！","Sign In with GitHub":"通过 GitHub 账号登录","Sign In with Google":"通过 Google 账号登录","Sign Out":"退出登录","Skills: 1,789 tokens":"技能：1,789 tokens","Skip":"跳过","Small":"小","Something went wrong":"发生异常错误","Something went wrong!":"发生异常错误！","Sort":"排序","Sort by":"排序依据","Spawned":"已唤起智能体","Spawning":"正在唤起智能体","Split Diff":"分栏差异视图","Stack Trace":"调用栈跟踪","Stage All Changes":"暂存所有更改","Stage Change":"暂存更改","Stage File":"暂存文件","Staged":"已暂存","Staged index changes and working tree changes":"暂存区的索引更改与工作区更改","Standalone Terminals":"独立终端","Started":"已启动","Starting":"正在启动","Starting...":"正在启动...","Startup failed":"服务启动失败","Status: Fired":"状态：已触发","Steer agent":"引导智能体","Steps to reproduce the issue":"重现该问题的详细步骤","Stop":"停止","Stop Execution":"停止执行","Stop Generating":"停止生成","Stop Recording":"结束录音","Stopped":"已停止","Stopping":"正在停止","Stopping...":"正在停止...","subagent":"子智能体","Subagent completed":"子智能体已完成","Subagent definition":"定义子智能体","Subagent failed":"子智能体执行失败","Subagent invocation":"调用子智能体","Subagent management":"子智能体管理","subagents":"子智能体","Submit":"提交","Success":"成功","Success, Continuing...":"认证成功，正在跳转...","Sunday":"周日","System":"跟随系统","Table of contents":"目录","task canceled":"任务已取消","task cancelled":"任务已取消","Task completed":"任务已完成","Task completed successfully":"任务已圆满完成","Task failed":"任务失败","Task finished":"任务已完成","Task in progress...":"任务进行中...","Task Log":"任务日志","Task management":"任务管理","task running":"任务运行中","task started":"任务已启动","teamwork-preview":"多智能体协同","Terminal":"终端","Terminal header":"终端标题","Terminal input":"终端输入","Terminal Output":"终端输出","Terminal tab":"终端标签","Terminals":"终端","Tested":"已测试","Testing":"正在测试","Testing...":"正在测试...","There was an unexpected issue setting up your account.":"配置您的账号时发生了未知异常。","Thinking":"思考中","Thinking for":"已深度思考","Thinking.":"思考中.","Thinking..":"思考中..","Thinking...":"正在深入思考...","This action was blocked by organization policy.":"此操作受组织策略限制已被拦截。","This is a CitC workspace (Fig share)":"这是一个 CitC 工作区 (Fig share)","This undo action will not make any code changes.":"此撤销操作不会产生实际代码改动。","This will permanently delete":"此操作将永久删除其中的","Thought for":"已深度思考","Thought Process":"思维推理过程","Thursday":"周四","to be installed. The browser subagent can be invoked by typing /browser in the conversation input box.":"进行安装。可在对话输入框中输入 /browser 调用浏览器子智能体。","to navigate":"进行导航","to select":"进行选择","To start using the agent, please sign in with your Google account.":"开始使用智能体前，请先登录您的 Google 账号。","today":"今天","Toggle":"切换","Toggle Auxiliary Bar":"切换辅助侧边栏","Toggle Developer Tools":"切换开发者工具","Toggle Editor":"切换编辑器面板","Toggle Environment Selector":"切换环境选择面板","Toggle Fullscreen":"切换全屏模式","Toggle Primary Side Bar":"切换主侧边栏","Toggle Project Selector":"切换项目选择面板","Toggle Secondary Side Bar":"切换辅助侧边栏","Toggle Terminal":"切换终端","tomorrow":"明天","Tool Output":"工具输出","True changes vs the parent workspace":"与父工作区的实际更改","Try Again":"重试","Tuesday":"周二","Type / for commands, @ to mention files or symbols":"输入 / 查看快捷命令，输入 @ 引用文件或符号","Type to search...":"输入关键词搜索...","Type your instructions here...":"在此输入您的指令...","Typeahead menu":"输入联想菜单","Typed":"已输入文本","Typing":"正在输入文本","UI Plugins":"界面插件","Unarchive Conversation":"取消归档","Uncommitted":"未提交","Understand":"明白","Undo":"撤销","Undo Changes":"撤销更改","Undo changes up to this point":"撤销截至此节点的所有代码改动","Unified Diff":"统一差异视图","Uninstall":"卸载","Uninstalled":"已卸载","Uninstalling":"正在卸载","Uninstalling...":"正在卸载...","Unknown edit":"未知修改","Unknown file edit":"未知文件修改","Unpin":"取消置顶","Unpin Conversation":"取消置顶","Unsaved changes":"未保存的更改","Unstage All Changes":"取消暂存所有更改","Unstage Change":"取消暂存","Unstage File":"取消暂存文件","Untitled Conversation":"未命名会话","Untracked":"未跟踪","Up to date":"已是最新","Update":"立即更新","Update and Restart":"更新并重启","Update Available":"发现新版本","Update Available ->":"发现新版本 ->","Update Available →":"发现新版本 →","Updated":"已更新","Updating":"正在更新","Updating...":"正在更新...","Upload":"上传","Upload File":"上传文件","Upload Image":"上传图片","Uploaded":"已上传","Uploading":"正在上传","Uploading...":"正在上传...","Uploads":"已上传附件","URL content read":"读取网页内容","Usage & Billing":"用量与账单","Use Google Cloud project instead":"改用 Google Cloud 项目认证","Use when needing clinical significance, pathogenicity classifications (e.g., Pathogenic, Benign, VUS), clinical evidence rationales, or finding \"hard positive\" benchmark controls for human genomic variants.":"当需要获取人类基因组变异的临床意义、致病性分类（如致病、良性、VUS）、临床证据原理，或寻找“硬阳性”基准对照时使用。","Use when the user wants to design, redesign, shape, critique, audit, polish, clarify, distill, harden, optimize, adapt, animate, colorize, extract, or otherwise improve a frontend interface. Covers websites, landing pages, dashboards, product UI, app shells, components, forms, settings, onboarding, and empty states. Handles UX review, visual hierarchy, information architecture, cognitive load, accessibility, performance, responsive behavior, theming, anti-patterns, typography, fonts, spacing, layout, alignment, color, motion, micro-interactions, UX copy, error states, edge cases, i18n, and reusable design systems or tokens. Also use for bland designs that need to become bolder or more delightful, loud designs that should become quieter, live browser iteration on UI elements, or ambitious visual effects that should feel technically extraordinary. Not for backend-only or non-UI tasks.":"当需要设计、重构、打磨、审查、优化、适配或以其他方式改进前端界面时使用。涵盖网站、着陆页、仪表板、产品 UI、应用外壳、组件、表单、设置页、入门向导和空白状态。处理 UX 审查、视觉层次、信息架构、认知负荷、无障碍访问、性能、响应式行为、主题化、反模式、排版、字体、间距、布局、对齐、色彩、动效、微交互、文案、错误状态与边缘情况。","Use when the user wants to design, redesign, shape, critique, audit, polish, clarify, distill, harden, optimize, adapt, animate, colorize, extract, or otherwise improve a frontend interface. Covers...":"当需要设计、重构、打磨、审查、优化、适配或以其他方式改进前端界面时使用。涵盖...","Use when you want to look up, map, and search for short genetic variants (SNPs, indels) in NCBI's dbSNP database.":"当需要在 NCBI 的 dbSNP 数据库中查找、映射和检索短遗传变异（SNP、插入/缺失变异）时使用。","Use when you want to retrieve quantitative RNA expression data and variant eQTL information from the GTEx (Genotype-Tissue Expression) Project across 54 non-diseased tissue sites.":"当需要从 GTEx 项目中获取跨 54 个非病变组织的定量 RNA 表达及变异 eQTL 数据时使用。","Use when you want to retrieve semi-quantitative protein expression and spatial localisation data from the Human Protein Atlas (HPA).":"当需要从人类蛋白质图谱 (HPA) 获取半定量蛋白质表达与空间定位数据时使用。","Use when you want to search for or download experimentally-determined 3D structures for biomolecules (proteins, nucleic acids, bound ligands).":"当需要搜索或下载实验测定的生物大分子（蛋白质、核酸、配体）3D 结构时使用。","User message":"用户消息","User question":"询问问题","User Review Required":"需用户审批事项","Using the Antigravity Python SDK to build AI agents":"使用 Antigravity Python SDK 构建自定义 AI 智能体。","Using the Google Antigravity Python SDK to build AI agents":"使用 Google Antigravity Python SDK 构建 AI 智能体","Using the Google Antigravity Python SDK to build AI agents.":"使用 Google Antigravity Python SDK 构建 AI 智能体。","Verification Plan":"验证方案","Verified":"已验证","Verifying":"正在验证","Verifying...":"正在验证...","Version":"版本","View Details":"查看详情","View could not be opened":"无法打开视图","View Diff":"查看差异 (Diff)","View Full Transcript":"查看完整执行记录","View Split Diff":"分栏左右对比","View Stacked Diff":"单栏上下对比","Viewed":"已查阅文件","Viewing":"正在查阅文件","Viewing Diff":"查看差异对比","Viewing file...":"正在查看文件...","Visualize, analyze, and render protein and molecular structures using PyMOL.":"使用 PyMOL 对蛋白质与分子结构进行可视化、分析和高清渲染。","Waiting":"等待中","Waiting for":"正在等待","Waiting for approval...":"等待用户审批...","Waiting for input...":"等待用户输入...","Waiting for tool...":"等待工具执行返回...","Waiting for user...":"等待用户确认...","Waiting...":"正在等待...","Warning":"警告","Web search":"网络搜索","Wednesday":"周三","Weekly":"每周","Welcome to":"欢迎使用","Welcome to Antigravity":"欢迎使用 Antigravity","Welcome to the new Antigravity!":"欢迎使用全新 Antigravity！","Work in Google3. Create conversations in new and existing workspaces.":"在 Google3 中工作。在新建或现有工作区中发起会话。","work with Google developer products. You can always change your choices in Settings.":"中的智能体与 Google 开发者生态协同工作。您随时可在设置中调整选择。","Worked for":"已持续工作","Working":"工作中","Working for":"已持续工作","Working.":"工作中.","Working..":"工作中..","Working...":"工作中...","Workspace Name":"工作区名称","Worktrees are a git feature. This folder is shared as is.":"Worktree 是 Git 原生特性。此文件夹按原样共享。","Worktrees are available for Git repositories":"工作树特性仅适用于 Git 仓库","Write":"写入","Writing":"正在写入","Writing...":"正在写入...","Wrote":"已写入","Yes":"是","Yes, allow this time":"是，仅允许本次执行","Yes, and always allow":"是，且始终允许","Yes, and always allow in this project":"是，并在当前项目中始终允许","Yes, I agree to help improve":"是的，我同意协助改进","yesterday":"昨天","You don't have any projects created. Please create a project first.":"您尚未创建任何项目。请先创建一个项目。","You have unsaved changes.":"当前有尚未保存的代码更改。","You're up to date":"已是最新版本","Your Plan":"当前计划","Your Plan:":"当前计划：","Left":"左","Right":"右","Center":"居中","Top":"顶部","Bottom":"底部","Left align":"左对齐","Center align":"居中对齐","Right align":"右对齐","List":"列表","Grid":"网格","Table":"表格","A new version of Antigravity has been downloaded. Restart the app to apply the update.":"Antigravity 新版本已下载完毕。重启应用即可应用更新。","A new version of Antigravity is available. It will be downloaded automatically.":"发现 Antigravity 新版本，将自动在后台下载。","About":"关于","About Antigravity":"关于 Antigravity","Account":"账户","Activity Bar":"活动栏","Add Configuration...":"添加配置...","Add Cursor Above":"在上方添加光标","Add Cursor Below":"在下方添加光标","Add Cursors to Line Ends":"在行尾添加光标","Add Next Occurrence":"添加下一个匹配项","Add Previous Occurrence":"添加上一个匹配项","Agent Manager":"智能体管理器","Agent-driven development":"智能体驱动开发","Antigravity is up to date.":"Antigravity 已是最新版本。","Antigravity notifications are disabled in your system settings. To receive agent notifications, please enable them.":"系统设置中已禁用 Antigravity 通知。若要接收智能体通知，请开启通知权限。","Appearance":"外观","Are you sure you want to quit?":"您确定要退出吗？","Are you sure you want to restart the language server?":"确定要重启语言服务器吗？","Auto Save":"自动保存","Background Tasks":"后台任务","Bring All to Front":"全部置顶","Chat History":"历史会话","Check for Updates...":"检查更新...","Checking for updates...":"正在检查更新...","Clear Recently Opened":"清除最近打开记录","Close Editor":"关闭编辑器","Close Folder":"关闭文件夹","Command Center":"控制中心","Command Palette...":"命令面板...","Configure Default Build Task...":"配置默认生成任务...","Configure Tasks...":"配置任务...","Confirm Quit":"确认退出","Connect to Remote Workspace":"连接到远程工作区","Conversation":"会话","Conversations":"会话列表","Copy conversation markdown":"复制会话 Markdown","Copy Line Down":"向下复制行","Copy Line Up":"向上复制行","Could not restart the language server. Please try again or restart Antigravity.":"无法重启语言服务器。请重试或重启 Antigravity。","Create Project":"创建项目","Debug Console":"调试控制台","Delete Conversation":"删除会话","Disable All Breakpoints":"禁用所有断点","Docs":"文档","Documentation":"文档","Download and Install Update":"下载并安装更新","Duplicate Selection":"重复选区","Editor Layout":"编辑器布局","Emmet: Expand Abbreviation":"Emmet: 展开缩写","Enable All Breakpoints":"启用所有断点","Exit":"退出","Expand Selection":"扩大选区","Explorer":"资源管理器","Extensions":"扩展","Failed to check for updates:":"检查更新失败：","Failed to Restart Language Server":"重启语言服务器失败","Find in Files":"在文件中查找","Forward":"前进","Go":"转到","Go to Bracket":"转到括号","Go to Declaration":"转到声明","Go to Definition":"转到定义","Go to File...":"转到文件...","Go to Implementations":"转到实现","Go to Line/Column...":"转到行/列...","Go to References":"转到引用","Go to Symbol in Editor...":"转到编辑器中的符号...","Go to Symbol in Workspace...":"转到工作区中的符号...","Go to Type Definition":"转到类型定义","Help":"帮助","History":"历史记录","Language Server Restarted":"语言服务器已重启","Last Edit Location":"上次编辑位置","Later":"稍后","License":"许可证","Marketplace":"插件市场","Marketplace Item URL":"插件市场项目 URL","Menu Bar":"菜单栏","Move Line Down":"向下移动行","Move Line Up":"向上移动行","New Breakpoint":"新建断点","New Editor Window":"新建编辑器窗口","New File":"新建文件","New File...":"新建文件...","New Terminal":"新建终端","New Window":"新建窗口","Next Change":"下一处更改","Next Problem":"下一个问题","No chats yet":"暂无聊天记录","No workspaces yet":"暂无工作区","Notifications Disabled":"通知已禁用","Open Antigravity":"打开 Antigravity","Open Command Palette":"打开命令面板","Open Configurations":"打开配置","Open Conversation History":"打开会话历史","Open File...":"打开文件...","Open Folder...":"打开文件夹...","Open Launchpad":"打开启动台","Open Process Explorer":"打开进程资源管理器","Open Project Picker":"打开项目选择器","Open Recent":"打开最近项","Open System Preferences":"打开系统设置","Open System Settings":"打开系统设置","Open View...":"打开视图...","Open Workspace from File...":"从文件打开工作区...","Open Workspace Selector":"打开工作区选择器","Other Conversations":"其他会话","Output":"输出","Panel":"面板","Preferences":"首选项","Previous Change":"上一处更改","Previous Problem":"上一个问题","Primary Side Bar":"主侧边栏","Privacy Statement":"隐私声明","Problems":"问题","Quit":"退出","Quit Antigravity":"退出 Antigravity","Recent":"最近项","Recent actions":"最近操作","Recent Remote Workspaces":"最近的远程工作区","Redo":"重做","Release Notes":"发行说明","Remove All Breakpoints":"移除所有断点","Replace":"替换","Replace Tiled Window":"替换平铺窗口","Report Issue":"报告问题","Report Issue...":"报告问题...","Reset Zoom":"重置缩放","Restart & Update":"重启并更新","Restart Antigravity Language Server":"重启 Antigravity 语言服务器","Restart Debugging":"重启调试","Restart to Update":"重启以更新","Restarting will cancel any ongoing operations.":"重启将取消所有正在进行的操作。","Run and Debug":"运行和调试","Run Build Task...":"运行生成任务...","Run Selected Text":"运行所选文本","Run Task...":"运行任务...","Run Without Debugging":"以非调试模式运行","Save All":"保存全部","Scheduled Tasks":"计划任务","Search conversations (by name or Cascade ID)":"搜索会话（按名称或 Cascade ID）","Secondary Side Bar":"辅助侧边栏","Select a conversation":"选择会话","Select All Occurrences":"选择所有匹配项","Select workspace":"选择工作区","Selection":"选择","Set up your workspace in the Agent Manager.":"在智能体管理器中配置您的工作区。","Settings":"设置","Setup":"初始设置","Show Antigravity":"显示 Antigravity","Shrink Selection":"缩小选区","Source Control":"源代码管理","Split Terminal":"拆分终端","Start Debugging":"启动调试","Status Bar":"状态栏","Step Into":"单步调试","Step Out":"单步跳出","Step Over":"单步跳过","Stop Debugging":"停止调试","Tasks can be done either in your agent manager or in an AI-powered editor.":"任务既可在智能体管理器中流转，也可在 AI 增强的编辑器中完成。","The agent manager is a new window allowing you to manage and create agents across workspaces.":"智能体管理器是一个全新独立窗口，支持您跨工作区创建和集中管理智能体。","The Antigravity language server has been successfully restarted.":"Antigravity 语言服务器已成功重启。","There may be agents or background tasks running.":"可能有智能体或后台任务正在运行。","Tile Window to Left of Screen":"将窗口平铺至屏幕左侧","Tile Window to Right of Screen":"将窗口平铺至屏幕右侧","Toggle Activity Bar":"切换活动栏","Toggle Block Comment":"切换块注释","Toggle Breadcrumbs":"切换面包屑导航","Toggle Breakpoint":"切换断点","Toggle Centered Layout":"切换居中布局","Toggle Full Screen":"切换全屏","Toggle Line Comment":"切换行注释","Toggle Menu Bar":"切换菜单栏","Toggle Minimap":"切换缩略图","Toggle Panel":"切换面板","Toggle Render Whitespace":"切换呈现空白字符","Toggle Sidebar":"切换侧边栏","Toggle Status Bar":"切换状态栏","Toggle Word Wrap":"切换自动换行","Toggle Zen Mode":"切换禅模式","Update Error":"更新出错","Update Ready":"更新已就绪","View":"视图","View License":"查看许可","Welcome":"欢迎","Welcome to the Agent Manager":"欢迎使用智能体管理器","Window":"窗口","workspace":"工作区","Workspace and Chat":"工作区与会话","Workspaces":"工作区列表","Zoom In":"放大","Zoom Out":"缩小","Paste and Match Style":"粘贴并匹配样式","Actual Size":"实际大小","Zoom":"缩放","Save Workspace As...":"另存工作区为...","Active":"已激活","Active Custom Instructions":"生效中的自定义指令","Active Skills":"活跃技能","Active Subagents":"活跃子智能体","Add Skill":"添加技能","Agent":"智能体","Agent Auto-Fix Lints":"智能体自动修复 Lint 错误","Agent Capabilities":"智能体能力","Agent Configuration":"智能体配置","Agent Description":"智能体描述","Agent Details":"智能体详情","Agent Execution Log":"智能体执行日志","Agent Instructions":"智能体指令","Agent Memory":"智能体记忆","Agent Mode":"智能体模式","Agent Name":"智能体名称","Agent Overview":"智能体总览","Agent Persona":"智能体人设","Agent Profile":"智能体画像","Agent Role":"智能体角色","Agent Settings":"智能体设置","Agent Status":"智能体状态","Agent System Persona":"智能体系统角色设定","Agent Trajectory":"智能体执行轨迹","Agents":"智能体列表","Architect Mode":"架构师模式","Ask for Every Tool":"每次调用工具均询问","Auto-activate Skills":"自动激活技能","Auto-run Safe Tools":"自动运行安全工具","Automation":"自动化","Autonomous Agent Mode":"自主智能体模式","Autonomous Mode":"全自动模式","Available Skills":"可用技能","Blocked":"已阻塞","Branch isolated workspace":"创建分支独立工作区","Branch Workspace":"分支独立工作区","Builtin Skills":"内置技能","Canceled":"已取消","Canceling":"正在取消","Cancelled":"已取消","Child Agent":"子智能体","Code Review Mode":"代码审查模式","Completed":"已完成","Create Agent":"创建智能体","Create Skill":"创建技能","Custom Agents":"自定义智能体","Custom Instructions":"自定义指令","Custom Skills":"自定义技能","Define New Subagent":"定义新子智能体","Define Subagent":"定义子智能体","Defined subagent":"已定义子智能体","Delegate Task":"委派任务","Delete Agent":"删除智能体","Delete Skill":"删除技能","Direct Subagents":"直接子智能体","Disable Skill":"禁用技能","Disabled":"已禁用","Edit Skill":"编辑技能","Enable Skill":"启用技能","Errored":"出错","Execution Permission":"执行权限","Extended Thinking":"深度思考","Fast Mode":"极速模式","High Reasoning":"高推理","Human-in-the-Loop Mode":"人工干预/确认模式","Idle":"空闲","Idle Subagent":"空闲子智能体","In Progress":"执行中","Inherit parent workspace":"继承父级工作区","Inherit Workspace":"继承工作区","Installed Skills":"已安装技能","Invoke Subagent":"调用子智能体","Kill All Subagents":"终止所有子智能体","Kill Running Subagent":"终止运行中的子智能体","Kill Subagent":"终止子智能体","Launch Subagent":"启动子智能体","Low Reasoning":"低推理","Manage Subagents":"管理子智能体","Max Iterations":"最大迭代次数","Max Tool Calls":"最大工具调用次数","Maximum Subagent Concurrency":"最大子智能体并发数","Medium Reasoning":"中推理","New Agent":"新建智能体","No active skills":"暂无激活技能","No Custom Agents or Plugins":"暂无自定义智能体或插件","No subagents":"暂无子智能体","Pair Programming Mode":"结对编程模式","Parent Agent":"父智能体","Parent Agent ID":"父智能体 ID","Plan & Execute Mode":"规划与执行模式","Planning Mode":"规划模式","Primary Agent":"主智能体","Queued":"排队中","Reasoning Effort":"推理强度","Reload Skills":"重新加载技能","Require Approval":"需要审批","Require Review for File Overwrite":"覆盖写入文件前需要确认","Require Review for Shell Execution":"执行 Shell 命令前需要确认","Run Agent":"运行智能体","Running Subagent":"正在运行的子智能体","Send Message to Subagent":"向子智能体发送消息","Share underlying repository":"共享底层仓库目录","Share Workspace":"共享工作区目录","Skill":"技能","Skill Configuration":"技能配置","Skill Description":"技能描述","Skill Disabled":"技能已禁用","Skill Enabled":"技能已启用","Skill Examples":"技能示例","Skill Instructions":"技能指令 (SKILL.md)","Skill Name":"技能名称","Skill Parameters":"技能参数","Skill References":"技能参考","Skill Resources":"技能资源","Skill Scripts":"技能脚本","Skills":"技能预设","Skills and Customizations":"技能与个性化定制","Skills Used":"已调用技能","Spawn Subagent":"生成子智能体","Spawn Subagent Task":"生成子智能体任务","Stop Agent":"停止智能体","Subagent Capabilities":"子智能体能力","Subagent Conversation ID":"子智能体会话 ID","Subagent Description":"子智能体描述","Subagent Hierarchy":"子智能体层级架构","Subagent Logs":"子智能体日志","Subagent Manager":"子智能体管理器","Subagent Name":"子智能体名称","Subagent Output":"子智能体输出","Subagent Prompt":"子智能体提示词","Subagent Role":"子智能体角色","Subagent Timeout (seconds)":"子智能体超时时限 (秒)","Subagent Transcript":"子智能体执行记录","Subagent Type":"子智能体类型","System Instructions":"系统指令","Terminate Subagent":"终止子智能体","Terminated":"已终止","Thinking Budget":"思考预算","Unspecified":"未指定","Very High Reasoning":"极高推理","Waiting for dependants":"等待依赖项","Waiting for input":"等待输入","Waiting for message":"等待消息","When enabled, agent is given awareness of lint errors created by its edits and may fix them without explicit user prompting.":"开启后，智能体将能实时感知其代码修改产生的 Lint 错误，并在无需用户明确要求的情况下自动完成修复。","Workspace Mode":"工作区模式","Agent Edits":"智能体修改","Stop Subagent":"终止子智能体","Project Agent":"项目智能体","System Prompt":"系统提示词","Active Rules":"生效中规则","Add Custom MCP Server":"添加自定义 MCP 服务","Add Knowledge Source":"添加知识来源","Add MCP Server":"添加 MCP 服务器","Add MCP Servers":"添加 MCP 服务器","Always Allow Tool":"始终允许此工具","Apply Rule Globally":"全局应用规则","Apply Rule to Current Workspace":"仅在当前工作区应用","Are you sure you want to clear the knowledge base?":"确定要清空知识库吗？","Arguments":"参数","Arguments (space-separated or JSON array)":"参数 (以空格分隔或 JSON 数组)","Auto-generate knowledge":"自动生成知识库","Auto-generated Knowledge":"自动提取的知识","Auto-learn from Conversations":"从对话中自动沉淀经验","Auto-Reconnect on Crash":"异常崩溃时自动重连","Auto-start on launch":"启动时自动连接","Available Tools":"可用工具","Clear All Memories":"清除全部记忆","Clear Index Cache":"清除索引缓存","Clear Knowledge Base":"清空知识库","Cloud Embeddings":"云端语义嵌入","Codebase Indexing":"代码库语义索引","Command / Executable":"执行命令 / 可执行文件路径","Configure MCP Server":"配置 MCP 服务","Connected":"已连接","Connected Successfully":"连接成功","Connecting...":"正在连接...","Connection Error":"连接错误","Connection Timeout":"连接超时","Create Knowledge Item":"创建知识条目","Create Rule":"创建规则","Delete Knowledge Item":"删除知识条目","Delete MCP Server":"删除 MCP 服务器","Delete Rule":"删除规则","Delete Server":"删除服务","Deny Tool Execution":"禁止执行此工具","Disable Server":"禁用服务","Disconnect MCP Server":"断开 MCP 服务","Disconnected":"已断开","Edit Configuration":"编辑配置","Edit Knowledge Item":"编辑知识条目","Edit MCP Server":"编辑 MCP 服务器","Edit Rule":"编辑规则","Embedding Model":"嵌入模型 (Embedding Model)","Enable Server":"启用服务","Enforce Rule":"强制执行规则","Environment Variables":"环境变量","Environment Variables (KEY=VALUE)":"环境变量 (键=值)","Exclude from Indexing":"从索引中排除","Execute Prompt":"执行提示词模板","Exposed Prompts":"公开的提示词模板","Exposed Resources":"公开的资源","Exposed Tools":"公开的工具","Extract Memory":"提取关键记忆","Failed to connect":"连接失败","Fast Semantic Search":"极速语义检索","Forget Conversation":"遗忘当前会话","Full Re-index":"完整重建索引","Full Re-sync":"全量重新同步","Generate knowledge items in the background based on your workspace activity":"根据您的工作区活动，在后台自动提炼生成知识条目","Global Knowledge":"全局知识库","Global Rules":"全局规则","Health Check Interval":"健康检查轮询间隔","Import Documents":"导入文档","Import Markdown Notes":"导入 Markdown 笔记","Incremental Indexing":"增量更新索引","Incremental Sync":"增量同步","Index Progress":"索引进度","Indexed Files":"已索引文件数","Indexing completed":"索引完成","Indexing in progress":"正在建立索引","Indexing paused":"索引已暂停","Indexing Status":"索引状态","Installed MCP Servers":"已安装的 MCP 服务器","Knowledge":"知识库","Knowledge Base":"知识库","Knowledge Base Status":"知识库状态","Knowledge Generation":"知识自动提炼","Knowledge Items":"知识条目","Knowledge Source":"知识来源","Last Synced":"上次同步时间","Loading knowledge items...":"正在加载知识库条目...","Loading MCP servers...":"正在加载 MCP 服务器...","Local Embeddings":"本地嵌入加速","Long-term Memory":"长期记忆","MCP Config JSON":"MCP 配置文件 (JSON)","MCP Configuration":"MCP 配置","MCP Configuration Error:":"MCP 配置错误：","MCP Logs":"MCP 日志","MCP Protocol Version":"MCP 协议版本","MCP Server Args":"启动参数","MCP Server Command":"启动命令","MCP Server Configuration":"MCP 服务配置","MCP Server Environment Variables":"环境变量","MCP Server Name":"MCP 服务器名称","MCP Server Settings":"MCP 服务器设置","MCP Server Type":"服务器类型","MCP Servers":"MCP 服务器","Memory Items":"记忆条目","Memory Retention Policy":"记忆保留策略","Model Context Protocol":"模型上下文协议 (MCP)","Model Context Protocol (MCP)":"模型上下文协议 (MCP)","No knowledge items generated yet.":"尚未生成任何知识条目。","No MCP Servers":"暂无 MCP 服务器","No MCP Servers configured.":"尚未配置 MCP 服务器。","No resources available":"暂无可用资源","Open Config File":"打开配置文件","Ping Server":"Ping 服务","Project Knowledge":"项目知识库","Prompt Arguments":"提示词参数","Prompt Description":"提示词描述","Prompt for Tool Approval":"调用此工具时询问审批","Prompt Name":"提示词名称","Re-index Codebase":"重建代码库索引","Read Resource":"读取资源","Reconnect MCP Server":"重新连接 MCP 服务","Reconnecting...":"正在重新连接...","Registered MCP Prompts":"已注册 MCP 提示词","Registered MCP Resources":"已注册 MCP 资源","Registered MCP Tools":"已注册 MCP 工具","Reload MCP Servers":"重新加载 MCP 服务器","Remove Server":"移除服务","Resource Content":"资源内容","Resource MimeType":"资源 MIME 类型","Resource Name":"资源名称","Resource URI":"资源统一标识符 (URI)","Restart Server":"重启服务","Rule Content":"规则内容","Rule Description":"规则描述","Rule Name":"规则名称","Rule Priority":"规则优先级","Search for MCP servers":"搜索 MCP 服务器","Search for MCP servers to add to your configuration":"搜索并添加 MCP 服务器到您的配置中","Search knowledge items...":"搜索知识条目...","Semantic Search":"语义搜索","Server Error Stream":"服务标准错误流","Server Health":"服务健康状态","Server Name":"服务名称","Server Output Stream":"服务标准输出流","Server-Sent Events (SSE)":"服务器发送事件 (SSE)","Session Memory":"当前会话记忆","Source File":"来源文件","Source URL":"来源网址","SSE Transport":"Server-Sent Events (SSE) 传输","Standard I/O (stdio)":"标准输入输出 (stdio)","Stdio Transport":"标准输入输出 (Stdio) 传输","Sync Knowledge Base":"同步知识库","System Rules":"系统规则","Test Connection":"测试连接","Test MCP Server":"测试 MCP 服务连通性","This will permanently delete all generated knowledge items. This action cannot be undone.":"这将永久删除所有自动生成的知识条目，且此操作无法撤销。","Tool Description":"工具描述","Tool Name":"工具名称","Tool Permissions":"工具权限","Tool Schema":"工具参数模式 (Schema)","Total Files":"文件总数","Transport Type":"传输类型","User Rules":"用户规则","Vector Database Index":"向量数据库索引","Vector Index":"向量索引","View Server Logs":"查看服务日志","Watching for file changes...":"正在监听文件变化...","Working Directory":"工作目录","Workspace Knowledge":"工作区知识库","Workspace Rules":"工作区规则","Search MCP servers by name":"按名称搜索 MCP 服务器","Enable Antigravity to deploy apps to Google Cloud Run.":"允许 Antigravity 将应用直接部署至 Google Cloud Run。","Search and reference over 600,000 real-world app screens, user flows, and UI patterns from Mobbin directly within your AI tools.":"直接在 AI 工具中检索并引用来自 Mobbin 的 600,000+ 真实应用界面、用户流程与 UI 模式。","The GKE remote MCP server provides read write access to your GKE Kubernetes resources. It allows an AI agent to inspect and observe your environment.":"GKE 远程 MCP 服务器提供对 GKE Kubernetes 资源的读写访问，允许 AI 智能体检查与观测集群运行环境。","The Dart and Flutter MCP server exposes Dart (and Flutter) development tool actions to compatible AI-assistant clients.":"Dart 与 Flutter MCP 服务器向 AI 智能体暴露 Dart/Flutter 开发工具链动作能力。","The Genkit Model Context Protocol (MCP) Server gives AI-powered development tools the ability to build, debug and inspect your Genkit app.":"Genkit MCP 服务器赋予 AI 开发工具构建、调试与审查 Genkit 应用的能力。","The gopls Model Context Protocol (MCP) server provides tools for semantic code analysis, live diagnostics, and transformation of your Go codebase.":"gopls MCP 服务器为 Go 代码库提供语义代码分析、实时诊断与代码重构能力。","The Bigtable Admin remote MCP server lets you manage Bigtable resources.":"Bigtable Admin 远程 MCP 服务器允许管理 Bigtable 实例与资源。","Cloud CLI MCP Server provides tools to run gcloud and bq CLIcommands in a remote sandbox environment":"Cloud CLI MCP 服务器提供在远程沙箱环境中执行 gcloud 与 bq 命令的工具链。","The MCP Toolbox for Databases is an open-source MCP server designed to simplify and secure the development of tools for interacting with databases.":"数据库 MCP 工具箱是开源 MCP 服务，旨在简化并保护与数据库交互的工具开发。","The Google Home Developer MCP server allows you to search through Google Home documentation, OpenThread and Matter specifications documentation.":"Google Home 开发者 MCP 服务器支持检索 Google Home 文档、OpenThread 与 Matter 技术规范文档。","Neon MCP Server is an open-source tool that lets you interact with your Neon Postgres databases in natural language.":"Neon MCP 服务器支持通过自然语言与 Neon Serverless Postgres 数据库进行交互。","Interact with Redis key-value stores":"与 Redis 键值数据库进行交互","A Model Context Protocol server for interacting with MongoDB Atlas.":"用于与 MongoDB Atlas 云数据库进行交互的 MCP 服务器。","Official Notion MCP Server that allows interaction with Notion workspaces, pages, databases, and comments via the Notion API.":"Notion 官方 MCP 服务器，允许通过 Notion API 与工作区、页面、数据库和评论进行交互。",". Local permissions have higher priority.":"。本地特定权限具有更高的优先权。","[Dev] GCP Project ID":"[开发者] GCP 项目 ID","% of the customization budget is available.":"% 的定制预算可用。","• Agent Decides - Agent will decide when to ask for review based on task complexity and user preference.":"• 智能体决策 - 智能体根据任务复杂程度及交互偏好，自主决策何时请求审查。","• Always Proceed - Agent never asks for confirmation before executing terminal commands (except those in the Deny list). This provides the Agent with the maximum ability to operate over long periods without intervention, but also has the highest risk of an Agent executing an unsafe terminal command.":"• 始终继续 - 执行终端命令前无需确认（黑名单除外）。赋予智能体最强的持续自运转能力，但执行高危系统命令的风险也最高。","• Always Proceed - Agent never asks for confirmation before executing terminal commands (except those in the Deny list). This provides the Agent with the maximum ability to operate over long periods without intervention, but also has the highest risk of an Agent executing an unsafe terminal command. • Request Review - Agent always asks for confirmation before executing terminal commands (except those in the Allow list). Note: A change to this setting will only apply to new messages sent to Agent. In-progress responses will use the previous setting value.":"• 始终继续 - 执行终端命令前无需确认（黑名单除外）。赋予智能体最强的免干预自运转能力，但高危操作风险也最高。\n• 请求审查 - 只要不在白名单中，执行任何终端命令前均需严格请求确认。\n\n提示：设置变更仅对之后发送的新指令生效，正在运行的任务将保持原有策略。","• Always Proceed - Agent will not stop to ask for permission to run Javascript in the browser. This provides the Agent with maximum autonomy to perform complex actions and validation in the browser, but also has the highest exposure to security exploits.":"• 始终继续 - 智能体在浏览器中运行脚本无需提示确认。提供最高的端到端自动化效率，但安全风险也最高。","• Always Proceeds - Agent never asks for review. This maximizes the autonomy of the Agent, but also has the highest risk of the Agent operating over unsafe or injected Artifact content.":"• 始终继续 - 智能体处理交付件时绝不主动打扰。能最大化自主效率，但也伴随潜在的不安全内容执行风险。","• Asks for Review - Agent always asks for review.":"• 请求审查 - 智能体在处理交付件时，始终严格向您发起审查确认。","• Disabled - Agent will never run Javascript code in the browser.":"• 已禁用 - 智能体绝不在浏览器中运行任何 JavaScript 脚本。","• Request Review - Agent always asks for confirmation before executing terminal commands (except those in the Allow list).":"• 请求审查 - 只要不在白名单中，执行任何终端命令前都会严格征求您的许可。","• Request Review - Agent will always stop to ask for permission to run Javascript code in the browser.":"• 请求审查 - 智能体在浏览器中运行 JavaScript 脚本前，始终会停下来征得您的明确许可。","+ Add":"+ 添加","100.0% of the customization budget is available.":"100.0% 的个性化定制预算额度可用。","A high-risk mode that disables all safety barriers. The agent operates with full system access, auto-executes all terminal commands, and reads or writes to all local files without review prompts.":"禁用所有安全防护的高风险极速模式。智能体拥有完整的系统操作权限，将全自动执行所有终端命令并自由读写本地文件，全程无审批提示。","Absolute path to the Chrome/Chromium executable":"Chrome/Chromium 可执行文件的绝对路径","Accent":"强调色","Actions the agent may always perform without asking.":"智能体无需询问即可直接执行的操作清单（白名单）。","Actions the agent may never perform.":"智能体在任何情况下均严禁执行的操作清单（黑名单）。","Actions the agent must always ask before performing.":"智能体在执行前必须先征得人工批准的操作清单。","Active timers":"运行中的定时器","Actual behavior":"实际行为","Actuation Permissions":"浏览器操作执行权限","Add":"添加","Add an MCP server above":"请在上方添加 MCP 服务器。","Add an MCP server above or add a custom one via the MCP Config.":"请在上方添加 MCP 服务器，或通过 MCP 配置添加自定义服务器。","Add an MCP server above.":"请在上方添加 MCP 服务器。","Add Custom Model":"添加自定义模型","Add Rule":"添加规则","Add to Chat/Quote":"添加到对话/引用","Advanced":"高级设置","Advanced settings":"高级设置","After":"之后","Agent always asks for review.":"智能体在操作前始终会请求人工审查。","Agent asks for permission before executing commands matched by a deny list entry. The deny list follows the same matching rules as the allow list and takes precedence over the allow list.":"命中黑名单规则的命令在执行前必须征得您的同意。黑名单匹配规则与白名单相同，且优先级高于白名单。","Agent auto-executes commands matched by an allow list entry. For Unix shells, an allow list entry matches a command if its space-separated tokens form a prefix of the command's tokens. For PowerShell, the entry tokens may match any contiguous subsequence of the command tokens.":"智能体会自动执行与允许列表条目匹配的命令。对于 Unix shell，如果命令的空格分隔标记形成允许列表条目标记的前缀，则视为匹配。对于 PowerShell，允许列表条目标记可以匹配命令标记中的任何连续子序列。","Agent auto-executes commands matched by an allow list entry. For Unix shells, an allow list entry matches a command if its space-separated tokens form a prefix of the command's tokens. For PowerShell, the entry tokens may match any contiguous subsequence of the command's tokens.":"智能体将全自动执行命中白名单规则的终端命令。在 Unix Shell 下按前缀分词匹配；在 PowerShell 下按连续子序列分词匹配。","Agent Behavior":"智能体行为准则","Agent Behaviors":"智能体行为准则","Agent Decides":"智能体自主决策","Agent Decides - Agent will decide when to ask for review based on task complexity and user preference.":"智能体决策 - 智能体根据任务复杂度与交互意图自主判断何时请求审查。","Agent is given awareness of lint errors created by its edits and may fix them without explicit user prompting.":"智能体将能实时感知其代码修改产生的 Lint 错误，并在无需用户明确要求的情况下自动完成修复。","Agent Non-Workspace File Access":"智能体跨工作区文件访问","Agent settings and permissions for conversations outside of projects.":"针对未归属项目的独立会话，配置专属的智能体参数与操作权限。","agent settings,":"智能体设置，","Agent will always ask for your permission before running terminal commands locally and will always request for a review when making changes.":"智能体在本地运行终端命令以及修改代码前，始终会先征求您的明确许可。","Agent will decide when to ask for review based on task complexity and user preference.":"智能体将根据任务复杂度及用户偏好，自主判断何时请求审查。","Agent will execute tasks directly. Use for simple tasks that can be completed faster":"智能体将直接执行任务，无需额外确认。适用于追求高迭代速度的轻量任务。","AI Credit":"AI 额度","AI Credits":"AI 额度","AI Shortcuts":"AI 快捷指令","All":"全部","All terminal commands require review. The agent can read or write to any file in the machine.":"智能体可自由读写本机所有文件，但执行任何终端命令前均需人工明确批准。","Allow":"允许","Allow Agent to view and edit files outside of the current workspace automatically. Use with caution: this provides the Agent access to additional potentially-relevant information, but also allows the Agent to access credential files, secrets, and other files outside of the workspace that could be targeted in prompt injection attacks or other exploits by malicious actors.":"允许智能体自动查看和编辑当前工作区之外的文件。请谨慎使用：这使智能体能够访问更多可能相关的信息，但也可能让智能体接触到凭证文件、密钥和其他工作区外的文件，这些文件可能被恶意行为者利用进行提示注入攻击或其他形式的利用。","Allow full browser script execution without prompting.":"始终允许在浏览器中执行脚本，无需额外审批。","Allow Globally":"全局允许","Allow List Terminal Commands":"终端命令白名单","Allow Once":"允许本次","Allow Tab to view and edit the files in .gitignore. Use with caution if your .gitignore lists files containing credentials, secrets, or other sensitive information.":"允许 Tab 智能补全读取并编辑 .gitignore 中排除的文件。若被忽略的文件中包含密码凭证或密钥，请谨慎开启此项。","Allow This Conversation":"允许当前会话","Allow/deny agent browser actuation access to specific URLs.":"允许或禁止智能体在特定 URL 网页上执行交互点击与自动化操作。","Allow/deny agent command execution outside the sandbox.":"允许或禁止智能体在沙箱环境外部直接执行终端命令。","Allow/deny agent read access to specific files or directories.":"允许或禁止智能体读取指定的文件或目录。","Allow/deny agent read access to specific URLs or domains.":"允许或禁止智能体访问并读取特定的 URL 或域名。","Allow/deny agent write access to specific files or directories.":"允许或禁止智能体写入或修改指定的文件或目录。","Allow/deny specific terminal commands.":"允许或禁止智能体执行特定的终端命令。","Alphabetical (A-Z)":"字母顺序 (A-Z)","Also includes":"同时包含","Alt+Enter On empty prompt, sends next in queue":"Alt+Enter 在提示词为空时，立即发送队列中的下一条","Alt+Enter Queues after the turn":"Alt+Enter 在当前轮次结束后排队","Always Allow":"始终允许","Always Ask":"每次均询问","Always Deny":"始终拒绝","Always Proceed":"始终继续","Always Proceed - Agent never asks for confirmation before executing terminal commands (except those in the Deny list). This provides the Agent with the maximum ability to operate over long periods without intervention, but also has the highest risk of an Agent executing an unsafe terminal command.":"始终继续 - 执行终端命令前无需手动确认（黑名单中的命令除外）。赋予智能体最强的长程自主运行能力，但执行高风险命令的潜在风险也最高。","Always Proceed - Agent will not stop to ask for permission to run Javascript in the browser.":"始终继续 - 智能体在浏览器中执行 JavaScript 脚本无需人工确认。","Always Proceed - Agent will not stop to ask for permission to run Javascript in the browser. This provides the Agent with maximum autonomy to perform complex actions and validation in the browser, but also has the highest exposure to security exploits.":"始终继续 - 智能体在浏览器中执行 JavaScript 脚本无需人工确认。赋予智能体最高的自动化验证效率，但风险暴露面也最高。","Always Proceeds":"始终继续","Always Proceeds - Agent never asks for review. This maximizes the autonomy of the Agent, but also has the highest risk of the Agent operating over unsafe or injected Artifact content.":"始终继续 - 从不请求人工审查。可最大化智能体的自主执行效率，但在处理不安全或含注入风险的文档时存在风险。","Always run":"始终运行","an MCP server above":"在上方添加 MCP 服务器","and permissions.":"与权限管理。","Antigravity Lab":"Antigravity 实验室","API Base URL":"API 基础网址","API Key":"API 密钥","API Key Header":"API Key 标头","App Settings":"应用基础设置","Application Theme":"应用主题","Artifact Review Policy":"交付件审查策略","Artifacts are created when the agent performs more complex, longer running tasks while in Planning mode.":"在规划模式下执行复杂或耗时较长的长程任务时，智能体将生成持久化的交付件（Artifacts）。","Ask":"询问确认","Ask every time":"每次均询问","Ask first":"先询问","Asks for Review":"请求审查","Asks for Review - Agent always asks for review.":"请求审查 - 智能体在处理交付件时始终会主动请求人工审查确认。","Authenticating...":"正在验证身份...","Authentication Type":"身份验证类型","Auto Check for Updates":"自动检查更新","Auto Execution":"自动执行","Auto Retry on Rate Limit":"速率受限时自动重试","Auto-Expand Changes Overview":"自动展开代码变更概览","Auto-Format Code":"自动格式化代码","Auto-kill Background Tasks on Exit":"退出应用时自动终止后台任务","Auto-Open Edited Files":"自动打开已修改文件","Auto-Save Files":"自动保存文件","autocomplete":"Tab 键补全","Automatic Check for Updates":"自动检查更新","Automatically download and install updates":"自动下载并安装更新","Automatically prompt you to restart the app when a new update is available. When disabled, you can check for updates manually from the app menu.":"当检测到新版本时，自动提示您重启应用完成升级。禁用后可在菜单中手动检查更新。","Available AI credits":"当前可用 AI 额度","Avatar URL":"头像 URL","Background":"背景色","Bearer Token":"Bearer 令牌","Block all browser JavaScript execution.":"严格禁止在浏览器中执行任何 JavaScript 脚本。","Bot Name":"机器人名称","Bracket Pair Colorization":"括号对彩色配对","Bracket Pair Guides":"括号对引导线","Breadcrumbs Enabled":"启用代码面包屑导航","Browser Actuation Permissions":"浏览器操作执行权限","Browser Actuation Rules":"浏览器交互操作规则","Browser Automation Tool":"浏览器自动化交互工具 (Playwright/Puppeteer)","Browser CDP Port":"浏览器 CDP 调试端口","Browser Javascript Execution Policy":"浏览器 JS 执行策略","Browser Settings":"浏览器工具设置","Browser URL Allowlist":"浏览器 URL 白名单","Browser user profile path":"浏览器用户配置文件路径","Build With Google Plugins":"基于 Google 官方插件构建","By using this app, you agree to its":"使用本软件即表示您同意其","Bypass Proxy for Addresses":"绕过代理的目标地址","Bypass Proxy List":"绕过代理列表","Catppuccin":"Catppuccin 猫咪","Change Keybinding":"修改快捷键","Changes the base URL for marketplace search results. You must restart Antigravity to use the new marketplace after changing this value.":"更改市场搜索结果的基础 URL。更改此配置后必须重启 Antigravity 才能生效。","Changes the base URL on each extension page. You must restart Antigravity to use the new marketplace after changing this value.":"更改每个扩展页面的基础 URL。更改此配置后必须重启 Antigravity 才能生效。","Chat Model Metadata":"聊天模型元数据","Chat Settings":"会话体验设置","chat space":"聊天空间","Choose a predefined security preset for the agent. This controls terminal auto-execution policy, and file access policy.":"为智能体选择预设的安全级别，用于控制终端命令的自动执行策略及文件访问权限。","Choose your preferred terminal and review policies":"选择您偏好的终端执行与审查策略","Choose your preferred terminal and review policies.":"选择您偏好的终端执行与操作审查策略。","Choose your theme":"选择您偏好的主题","Chrome Binary Path":"Chrome 浏览器可执行文件路径","CitC Settings":"CitC 设置","Claude 3 Opus":"Claude 3 Opus","Claude 3.5 Haiku":"Claude 3.5 Haiku","Claude 3.5 Sonnet":"Claude 3.5 Sonnet","Claude 3.7 Sonnet":"Claude 3.7 Sonnet","Claude 3.7 Sonnet (Thinking)":"Claude 3.7 Sonnet (深度思考)","Claude and GPT models":"Claude 与 GPT 驱动模型","Color Theme":"颜色主题","Command Auto Execution":"终端命令自动执行","Command Prompt (cmd.exe)":"命令提示符 (cmd.exe)","Commands Outside Sandbox":"沙箱外命令执行","Compact":"紧凑","Compact Mode":"紧凑模式","Configure a chat bot so you can use Jetski directly from Google Chat.":"配置聊天机器人，即可直接从 Google Chat 使用 Jetski。","Configure agent execution, queued message delivery, and permissions.":"配置智能体执行模式、排队消息触发时机及权限控制。","Configure AI models and view your quota.":"配置驱动 AI 模型并实时查看当前额度配额消耗。","Configure allowed and denied paths for file reads and writes.":"配置允许或禁止智能体读写的文件与目录路径。","Configure allowed and denied URLs for browser actuation.":"配置允许或禁止智能体进行交互点击与表单操作的目标 URL 规则。","Configure allowed and denied URLs for reading.":"配置允许或禁止智能体读取的 URL 地址。","Configure allowed commands outside the sandbox.":"配置允许在本地沙箱环境之外执行的终端命令。","Configure allowed terminal commands.":"配置允许智能体免审批执行的终端命令。","Configure default behaviors, skills, and MCP servers.":"配置全局默认行为、技能预设以及 MCP 服务器。","Configure editor-specific behaviors and shortcuts.":"配置编辑器专属行为与快捷键。","Configure external tools via Model Context Protocol.":"通过模型上下文协议 (Model Context Protocol) 统一配置外部工具链。","Configure global allowed and denied resource permissions.":"配置全局允许与禁止的底层系统资源访问权限。","Configure tab completion, suggestions, and navigation behavior.":"配置 Tab 补全、建议与导航行为。","Configure the agent's visual theme and display preferences.":"配置智能体的视觉主题风格与交互呈现偏好。","Configure the browser subagent. It requires":"配置浏览器子智能体。它需要","Configure the maximum width of the conversation panel.":"自定义会话主对话区域的最大显示宽度。","Configure when follow-up messages are sent.":"配置追加消息在队列中的发送介入时机。","Configure Your Editor":"配置编辑器","Configure your editor settings below.":"在下方自定义您的编辑器参数。","Configures how the agent tries to access files outside of its working folders.":"配置当智能体尝试访问工作区以外的文件时所采取的权限审查策略。","Context Window Limit":"上下文窗口上限","Context Window Size":"上下文窗口大小","Control which URLs the browser can access. Add domains or full URLs to the allowlist.":"控制浏览器可访问的目标网址。您可以将域名或完整 URL 添加至允许列表中。","Controls whether terminal commands require your approval before running.":"控制终端命令在执行前是否必须征得您的人工批准。","Controls whether the agent can run custom JavaScript to automate complex browser actions.":"控制智能体是否可以在内置浏览器中执行自定义 JavaScript 以实现复杂交互自动化。","Conversation Width":"会话面板宽度","Copy on Selection in Terminal":"终端选中文本时自动复制","Crash Reporting":"自动崩溃报告","Cron Expression":"Cron 表达式","Cron Expression:":"Cron 表达式：","Cron Schedule":"Cron 周期计划","Cursor Blinking":"光标闪烁模式","Cursor Smooth Caret":"光标平滑动画","Cursor Style":"光标样式","Custom":"自定义 (Custom)","Custom CA Certificates":"自定义根证书 (CA) 路径","Custom Headers":"自定义请求头 (Headers)","Custom Model Provider":"自定义模型服务商","Custom path for the browser user profile directory. Leave empty for default (~/.gemini/antigravity-browser-profile).":"自定义浏览器独立用户数据目录的存放路径。留空则使用默认路径 (~/.gemini/antigravity-browser-profile)。","Custom Rules":"自定义规则","Custom Title Bar":"自定义标题栏","customizations":"个性化定制","Customize":"个性化定制","Customize Global Skills":"自定义全局技能","Dark":"深色","Dark Mode":"深色模式","Dark Theme":"深色主题","Date Added":"创建日期","day":"天","days":"天","Deep Reasoning Mode":"深度推理与规划增强模式","DeepSeek-R1":"DeepSeek-R1","DeepSeek-V3":"DeepSeek-V3","Default":"默认 (Default)","Default Agent Model":"默认智能体模型","Default Chat Model":"默认对话模型","Default Dark":"默认深色","Default Fast Model":"默认极速模型","Default Light":"默认浅色","Default Pro Model":"默认专家模型","Default Shell":"默认终端 Shell","Default Terminal Shell":"默认终端 Shell","Delete Custom Model":"删除自定义模型","Demo Mode (Beta)":"演示模式 (Beta)","Deny":"拒绝","Deny List Terminal Commands":"终端命令黑名单","Describe the goal you want the agent to achieve...":"详细描述您希望智能体自主实现的任务目标...","Developer":"开发者","Developer-only tools. These settings are stored locally in this browser and do not affect other users.":"开发者专属工具。这些设置仅存储于本浏览器，不影响其他用户。","Disable Strict Mode":"关闭严格模式","Disable Strict Mode?":"确认关闭严格安全模式？","Disabled - Agent will never run Javascript code in the browser.":"已禁用 - 智能体绝不在浏览器中运行任何 JavaScript 脚本。","Disables all safety barriers for maximal iteration velocity.":"禁用所有安全审查拦截，以获得最极速、无打扰的端到端执行效率。","Disabling strict mode allows the agent to run tasks with fewer interruptions, but increases security risks.":"关闭严格模式可减少智能体执行任务时的弹窗确认，但这会提高潜在的安全风险。","Display and preserve intermediate thinking steps":"在会话流中完整显示并保留中间思维链步骤","Display and preserve intermediate thinking steps.":"显示并保留中间思考步骤。","Display Language":"界面语言","Dracula":"Dracula 德古拉","e.g., https://example.com":"例如：https://example.com","e.g., npm test":"例如：npm test","Edit Custom Model":"编辑自定义模型","Editor Font Family":"编辑器字体","Editor Font Size":"编辑器字号","Editor Settings":"编辑器设置","Editor Tab Size":"编辑器缩进空格数","Email":"电子邮箱","Enable AI Credit Overages":"启用 AI 额度超量抵扣","Enable Browser Tools":"启用浏览器工具","Enable Code Minimap":"显示代码缩略图","Enable Demo Mode (Beta)":"启用演示模式 (Beta)","Enable Experimental Features":"启用实验性功能","Enable Line Numbers":"显示行号","Enable Notifications":"启用系统通知","Enable Sandbox Mode (Preview)":"启用沙箱隔离模式 (预览版)","Enable Shell Integration":"启用 Shell 集成","Enable Sounds for Agent":"启用智能体提示音","Enable Streaming":"启用流式输出","Enable Telemetry":"启用遥测数据上报","Enable Terminal Sandbox":"启用终端沙箱","Enable Workspace API":"启用工作区 API","Ensure Single Final Newline":"确保文件末尾仅有一个换行符","Enter Sends immediately":"Enter 立即发送","Enter tool name or server...":"输入工具名称或 MCP 服务地址...","Enter your goal...":"输入您的长程目标...","Environment Variables for Terminal":"终端自定义环境变量","Execute URLs":"交互操作目标 URL","Execution":"执行策略","Expected behavior":"预期行为","Experimental Features":"实验性功能","Explain and Fix in Current Conversation":"在当前会话中解释并修复","External tools the agent can call via Model Context Protocol.":"智能体可通过模型上下文协议（Model Context Protocol）调用的外部扩展工具。","Fallback Model":"备选容灾模型","Fast":"极速","Feedback":"反馈","Feedback Type":"反馈类型","File Access":"文件访问权限","File Access Rules":"文件访问规则","File Permissions":"文件读写权限","File Picker":"文件选择器","File Reads":"文件读取权限","File Writes":"文件写入权限","Find in Pane":"在面板中查找","Five Hour Limit":"5 小时配额限制","Five Hour Limit Remaining":"5 小时剩余配额","Five-Hour Limit Remaining":"5 小时剩余配额","Folder":"文件夹","Follow Operating System Theme":"自动跟随操作系统主题","Font Size (px)":"字体大小 (像素)","For help, visit":"如需帮助，请访问","for more information (this migration is experimental).":"了解更多信息（此迁移为实验性功能）。","Foreground":"前景色","Format on Paste":"粘贴时自动格式化","Format on Save":"保存时自动格式化","Frequency Penalty":"频率惩罚 (Frequency Penalty)","Full Machine":"全机访问 (Full Machine)","GCP Project ID for enterprise features.":"用于接入 Google Cloud Platform 企业特性的 Project ID。","Gemini 2.0 Flash Thinking":"Gemini 2.0 Flash 思考版","Gemini 2.5 Flash":"Gemini 2.5 Flash","Gemini 2.5 Pro":"Gemini 2.5 Pro","Gemini 3.0 Flash":"Gemini 3.0 Flash","Gemini 3.0 Pro":"Gemini 3.0 Pro","Gemini 3.7 Flash":"Gemini 3.7 Flash","Gemini 3.7 Flash (High)":"Gemini 3.7 Flash (高推理)","Gemini 3.7 Pro":"Gemini 3.7 Pro","Gemini Models":"Gemini 驱动模型","General Settings":"通用设置","Get notified when the agent needs your attention or completes a task.":"当智能体需要人工确认或完成任务时接收系统通知。","Get Started":"开始使用","Git Bash":"Git Bash","global":"全局应用","global settings":"全局设置","Go Forward":"前进","Go To Projects":"前往项目列表","Goal aborted":"目标已终止","Goal achieved!":"目标已顺利达成！","Goal execution failed":"目标任务执行失败","Goal Settings":"长程目标设置","Google Drive integration not available":"Google Drive 集成不可用","Google3 chats will be regrouped into their workspaces in the sidebar. See":"Google3 聊天将重新分组到侧边栏对应工作区中。详见","GPT-4.5":"GPT-4.5","GPT-4o":"GPT-4o","GPT-4o mini":"GPT-4o mini","Group By":"分组方式","Hide breakdown":"隐藏明细","Hide breakdown...":"隐藏明细...","High":"High","High Contrast Dark":"高对比度深色","High Contrast Light":"高对比度浅色","Highlight After Accept":"补全后高亮","Highlight newly inserted text after accepting a Tab completion.":"接受 Tab 键补全后，短暂高亮新插入的代码片段。","hour":"小时","hours":"小时","HTTP Proxy Server":"HTTP 代理服务器","HTTPS Proxy Server":"HTTPS 代理服务器","In addition to the custom skills folder, Antigravity will search the following paths in order to find skills for the agent.":"除了默认自定义技能目录外，Antigravity 还将按顺序在以下路径中为智能体检索加载技能组件。","Inactive":"未激活","Inherit General Settings":"继承通用设置","Inherit Global":"继承全局设置 (Inherit Global)","Inherit Model Settings":"继承全局模型配置","Inherit Project":"继承项目设置 (Inherit Project)","Inherit System":"跟随系统","Inherits from":"继承自 ","Inherits from global settings. Local permissions have higher priority.":"继承自全局设置。针对当前工作区的本地权限具有更高的优先权。","Inherits your general settings (effective in this project).":"继承您的通用设置 (在此项目中生效)。","Insert Spaces":"使用空格替代制表符","Insufficient AI Credits":"AI 额度不足","Integrated Terminal":"内置集成终端","Interrupt the agent and send immediately.":"立即打断智能体的当前思考并发送。","Jetski Chat":"Jetski 聊天","Keep Computer Awake":"防止计算机休眠","Keep In Menu Bar":"常驻系统托盘/菜单栏","Keep Strict Mode":"保持严格模式","Keep the app accessible from the menu bar and running in the background when all windows are closed.":"当所有主窗口关闭后，应用仍将常驻系统托盘/菜单栏并在后台保持活跃运行。","Keybindings":"快捷键绑定","Keyboard Shortcuts":"键盘快捷键","Keyboard shortcuts for quick navigation and control.":"用于提升操作与导航效率的全局快捷键一览。","Labs":"实验室","Last Updated":"最近更新时间","LAYOUT CONTROLS":"界面布局快捷键","Learn more about Default":"了解默认预设 (Default) 的详细规则","Letter Spacing":"字间距","Light":"浅色","Light Mode":"浅色模式","Light Theme":"浅色主题","Line Height":"行高","Loading custom agents...":"正在加载自定义智能体...","Loading metrics...":"正在加载指标数据...","Loading models...":"正在加载驱动模型...","Loading skills...":"正在加载技能...","Loading token usage...":"正在加载 Token 使用量...","Loading workspace customizations...":"正在加载工作区定制项...","Local Permissions":"本地工作区权限","Local Vector Acceleration":"本地向量硬件加速 (ONNX/Vulkan)","Local Workspace Permissions":"本地工作区权限","Low":"Low","Main Agent":"主智能体","Manage":"管理","Manage application settings.":"管理 Antigravity 客户端应用设置。","Manage project folders,":"管理项目文件夹，","Manage project folders, agent settings, and permissions.":"管理项目文件夹映射、智能体专属参数与权限策略。","Manage settings specific to Google CitC workspaces development.":"管理 Google CitC 工作区开发专属设置。","Manage your model quota and credits.":"管理您的模型配额与 AI 额度。","Manage your plan, credentials, and general preferences.":"管理您的订阅套餐、认证凭证以及全局通用偏好设置。","Manual Proxy Configuration":"手动配置代理","Manually customize individual settings.":"手动精细化配置每一项安全与权限策略。","Marketing Emails":"营销与产品资讯邮件","Marketplace Gallery URL":"插件市场展厅 URL","Max Completion Tokens":"最大生成标记数","Max Output Length":"最大输出长度","Max Output Tokens":"最大输出标记数 (Tokens)","Max Tokens":"最大 Token 数","Maximum":"最大","MCP Tools":"MCP 扩展工具","Medium":"Medium","Minimap Enabled":"启用右侧代码缩略图","Minimum":"最小","minute":"分钟","minutes":"分钟","Model":"驱动模型","Model Credits":"AI 额度","Model Endpoint":"模型接口端点 (Endpoint)","Model Name:":"模型名称：","Model Provider":"模型服务商","Model Quota":"模型配额","Model quota reached":"模型配额已达上限","Model Selection":"模型选择","Model Settings":"模型设置","Model Temperature":"模型采样温度","models":"驱动模型","Models & Usage":"模型与额度使用","Models Tab":"模型面板","Modify scoped permissions, folders, and agent settings like Sandbox and Terminal Command Execution.":"自定义项目作用域下的专属权限、文件夹映射、终端沙箱及命令执行策略。","Monokai":"Monokai","Month":"月","Months":"月","Multimodal Voice Input":"多模态语音输入与交互","my-gcp-project-id":"my-gcp-project-id","Narrow":"紧凑模式 (Narrow)","Native Title Bar":"原生标题栏","NAVIGATION":"智能跳转","Network Access Rules":"网络访问规则","Network Permissions":"网络访问权限","Never run":"从不运行","Next Pane Tab":"下一个面板标签页","No active timers or schedules":"暂无运行中的定时器或计划任务","No customizations found for this workspace.":"当前工作区未找到个性化定制配置。","No message prompts available":"暂无可用提示词","No Proxy":"不使用代理","No rules configured.":"尚未配置任何规则。","No rules found.":"未检索到匹配的规则。","No Subtitle":"隐藏副标题","None":"不分组","Not in Project":"未加入项目","Note: A change to this setting will only apply to new messages sent to Agent. In-progress responses will use the previous setting value.":"提示：该设置项的变更仅对之后发送的新指令生效。正在生成中的任务将沿用先前的策略。","Notification Settings":"通知设置","notifications":"通知设置","Now":"现在","of the customization budget is available.":"的个性化定制预算额度可用。","Off":"关闭","On":"开启","One Dark Pro":"One Dark Pro 深色","One Light":"One Light 浅色","Open Agent on Reload":"重载窗口时自动打开智能体","Open Agent panel on window reload":"当窗口重新加载时自动唤起智能体面板。","Open Antigravity IDE":"打开 Antigravity IDE","Open Conversation Picker":"打开会话选择器","Open Editor Settings":"打开编辑器设置","Open File Search":"打开文件搜索","Open files in the background if agent creates or edits them":"当智能体新建或修改文件时，在后台编辑器中自动打开。","Open Keybindings (JSON)":"打开 keybindings.json 配置文件","Open MCP Config":"打开 MCP 配置文件","Open New Window on Launch":"启动时打开新窗口","or join the":"或加入","Organization ID":"组织机构 ID","Outside of folders file access policy":"工作文件夹外部文件访问策略","Path to the Chrome/Chromium executable. Leave empty for auto-detection.":"Chrome/Chromium 浏览器的物理路径。留空则启用全自动探测。","Permanently delete this project and all of its conversations.":"永久删除此项目及其包含的全部历史会话记录。","Permissions":"权限控制","Plan":"订阅计划","Plugin:":"插件：","Port number for Chrome DevTools Protocol remote debugging. Leave empty for default (9222).":"用于 Chrome DevTools Protocol 远程调试的通信端口号。留空则默认使用 9222 端口。","PowerShell":"PowerShell","Predict the location of your next edit":"预测下一次编辑位置并快捷导航","Predict the location of your next edit and navigates you there with a tab keypress.":"预测您的下一个代码编辑位置，按 Tab 键即可一键跳转。","Presence Penalty":"存在惩罚 (Presence Penalty)","Preset":"主题预设","Prevent Sleep":"防止系统休眠","Prevent the computer from sleeping while the app is running.":"在客户端执行长程任务时，阻止计算机自动进入休眠状态。","Previous Pane Tab":"上一个面板标签页","Priority action":"优先操作","Privacy & Security":"隐私与安全","Privacy Policy":"隐私政策","Project":"项目","Project ID":"项目 ID","Project Rules":"项目规则","Project-Specific Settings":"项目专属设置","Prompt for approval before running browser scripts.":"在浏览器中运行脚本前必须弹出审批提示。","Provide Feedback":"提供反馈建议","Proxy Mode":"代理模式","Proxy Server Address":"代理服务器地址","Proxy Settings":"代理服务器设置","Purchase Credits":"购买额度","Queue After Turn":"当前轮次结束后发送","Queue until after the current turn.":"在当前会话推理轮次全部结束后自动发送。","Queued Messages":"排队消息机制","Quickly add and update imports with a tab keypress.":"按 Tab 键快速补全或更新模块导入声明。","Read URLs":"URL 读取权限","Receive product updates, tips, and promotions from Google Antigravity via email.":"通过邮件接收来自 Google Antigravity 的新功能速递、使用技巧与活动资讯。","RECOMMENDED":"推荐快捷键","Record Keys":"按下要绑定的按键...","Refreshes in":"重置倒计时：","Regroup Google3 Chats":"将 Google3 聊天重新分组","Render Control Characters":"呈现控制字符","Render Whitespace":"呈现空白字符","Request Review":"请求审查","Request Review - Agent always asks for confirmation before executing terminal commands (except those in the Allow list).":"请求审查 - 执行终端命令前始终会请求人工确认（白名单中的命令除外）。","Request Review - Agent will always stop to ask for permission to run Javascript code in the browser.":"请求审查 - 智能体在浏览器中执行 JavaScript 脚本前，始终会停下来征得您的许可。","Request Timeout (seconds)":"请求超时时间 (秒)","Require Review":"需要人工审查","Requires manual review for all terminal commands and file accesses outside of the working folders.":"执行所有终端命令以及访问工作文件夹以外的任何文件时，均需人工逐一审核确认。","Reset Defaults":"重置为默认值","Reset Keybinding to Default":"重置按键绑定为默认值","Restore Previous Session on Launch":"启动时恢复上次会话","Restricts agent tools to a secure, isolated local sandbox.":"限制智能体工具链必须在严格隔离的安全本地沙箱环境中运行。","Resume Goal":"恢复目标任务","Review Policy":"审查策略","Rules and Customizations":"规则与个性化定制","Run in Background":"在后台运行","Run task once after":"在指定时长后单次执行任务","Run task repeatedly using cron":"使用 Cron 表达式周期性重复执行任务","Schedule Timer":"创建定时任务","Search Keybindings":"搜索快捷键","Second":"秒","Seconds":"秒","Secure mode enabled state":"安全模式启用状态","Security":"安全性","Security Preset":"安全预设","Security Preset Level":"安全预设级别","Select branch":"选择分支","Select light, dark, or inherit system settings.":"选择浅色、深色主题或跟随系统自动切换。","Select Model":"选择模型","Select Next Conversation":"切换到下一个会话","Select Previous Conversation":"切换到上一个会话","SELECTION ACTIONS":"文本划选操作","Send Crash Reports":"发送崩溃诊断报告","Send Error Logs":"发送错误日志","Send Immediately":"立即打断并发送","Send Usage Data":"发送匿名使用统计数据","Set the speed of tab suggestions":"配置 Tab 代码补全建议的响应速度","Settings -":"设置 - ","Settings - Account":"设置 - 账户","Settings - Agent":"设置 - 智能体","Settings - Autocomplete":"设置 - Tab 键补全","Settings - Browser":"设置 - 浏览器","Settings - Customizations":"设置 - 个性化定制","Settings - Editor":"设置 - 编辑器","Settings - Models":"设置 - 驱动模型","Settings - Notifications":"设置 - 通知设置","Settings Saved":"设置已保存","Settings-":"设置-","Setup Jetski Chat":"设置 Jetski 聊天","Shell Integration":"Shell 集成","Shortcuts":"快捷键","Show \"Edit\" and \"Chat\" buttons when selecting text in the editor.":"在编辑器中划选代码时，显示“编辑”和“发送到聊天”快捷操作按钮。","Show breakdown":"展开明细","Show breakdown...":"展开明细...","Show Conflicts Only":"仅显示冲突的按键","Show Selection Actions":"显示划选操作气泡","Show suggestions when typing in the editor":"在编辑器键入时实时显示补全建议","Skill Custom Paths":"技能自定义搜索路径","Slow":"平稳","Smooth Scrolling":"平滑滚动","Snooze":"稍后提醒","Solarized Light":"Solarized Light 浅色","Some":"部分","Sort Conversations":"会话排序规则","Specifies Agent's behavior when asking for review on artifacts, which are documents it creates to enable a richer conversation experience.":"配置智能体在生成或更新交付件（Artifacts）时的审批行为。交付件是智能体用于沉淀结构化成果的重要文档。","Specifies Agent's behavior when asking for review on artifacts, which are documents it creates to enable a richer conversation experience. • Always Proceeds - Agent never asks for review. This maximizes the autonomy of the Agent, but also has the highest risk of the Agent operating over unsafe or injected Artifact content. • Agent Decides - Agent will decide when to ask for review based on task complexity and user preference. • Asks for Review - Agent always asks for review.":"配置智能体在生成或更新交付件（Artifacts）时的审批行为。交付件是智能体沉淀结构化成果的关键载体。\n• 始终继续 - 从不请求人工审查，最大化自动化效率，但面临潜在的不安全内容风险。\n• 智能体决策 - 智能体根据任务复杂度及意图自主决策何时请求确认。\n• 请求审查 - 智能体在处理交付件时始终严格请求人工审查确认。","Start":"开始","Start Voice Recording":"开始语音输入","Startup Behavior":"启动行为","Status":"按状态分组","Steps to Reproduce":"重现步骤","Stop Goal":"停止目标任务","Stop Voice Recording":"停止语音录音","Streaming Responses":"流式输出响应","Strict Mode":"严格安全模式","Strict SSL Certificate Validation":"严格 SSL 证书验证","Subtitles":"副标题显示","SUGGESTIONS":"补全建议","Suggestions in Editor":"编辑器内代码补全","System Mode":"跟随系统","System Proxy":"跟随系统代理","Tab":"Tab 键补全","Tab Gitignore Access":"Tab 补全访问 .gitignore 忽略文件","Tab Size":"制表符缩进空格数 (Tab Size)","Tab Speed":"Tab 建议触发速度","Tab to Import":"Tab 键自动导入依赖","Tab to Jump":"按 Tab 键快速跳转到下一处","Telemetry":"遥测与体验改进","Telemetry & Analytics":"遥测与产品分析","Telemetry Collection":"匿名遥测数据收集","Temperature":"采样温度 (Temperature)","Terminal & Tooling Permissions":"终端与工具链权限","Terminal Command Auto Execution":"终端命令自动执行策略","Terminal Command Policy":"终端命令策略","Terminal Commands":"终端命令策略","Terminal Commands Policy":"终端命令策略","Terminal Cursor Style":"终端光标样式","Terminal execution policy":"终端执行策略","Terminal Font Family":"终端字体族","Terminal Font Size":"终端字体大小","Terminal Integrated Shell":"终端集成 Shell","Terminal Line Height":"终端行高","Terminal Scrollback Buffer":"终端回滚缓冲区行数","Terms of Service":"服务条款","The app will be accessible from the menu bar and will keep running in the background when all windows are closed.":"当所有主窗口关闭后，应用仍将常驻系统托盘/菜单栏并在后台保持活跃运行。","The breakdown below shows token usage from customizations like skills, rules, and MCP. If the budget is exceeded, large customizations will be truncated automatically.":"下方明细展示了技能预设、规则与 MCP 等定制项的 Token 占用情况。若超出上下文预算配额，过大的定制内容将被自动截断。","The browser subagent can be invoked by typing /browser in the conversation input box.":"可在对话输入框中输入 /browser 调用浏览器子智能体。","Theme":"界面主题","Theme Mode":"主题模式","Thinking / Reasoning Budget":"思考/推理预算 (Tokens)","This provides the Agent with maximum autonomy to perform complex actions and validation in the browser, but also has the highest exposure to security exploits.":"这赋予了智能体在浏览器中执行端到端复杂自动化任务的最强能力，但也伴随更高的安全风险。","Timer":"定时触发器","to be installed.":"进行安装。","To modify editor settings, open Settings within the editor window.":"如需修改编辑器具体参数，请在编辑器窗口内打开设置。","To modify notification settings, open your operating system's system preferences.":"如需自定义系统级通知行为，请打开操作系统的系统设置。","Toggle Auxiliary Pane":"切换辅助侧边栏","Toggle Model Selector":"切换模型选择面板","Toggle Voice Recording":"开始/停止语音输入","Token Usage":"Token 使用量","Tokens":"Token 消耗","Tokyo Night":"Tokyo Night 东京之夜","Top-P (Nucleus Sampling)":"核采样 (Top-P)","Top-P Sampling":"Top-P 核采样","Trim Trailing Whitespace":"自动去除行尾空白","Troubleshooting guide":"故障排查指南","Try out early-stage features before they ship. These may change or be removed at any time.":"抢先体验尚未发布的前沿功能。这些功能可能随时变更或移除。","Turbo Mode":"极速模式 (Turbo Mode)","UI Font Family":"界面字体","Unarchive":"取消归档","Upgrade":"升级计划","Use Global":"使用全局设置","Useful for tasks that require file access across your full machine. The agent has full read and write access to all local files, but all proposed terminal commands require manual review and approval before running.":"适用于需要跨全机访问文件的任务。智能体对本地所有文件拥有完全的读写权限，但拟执行的终端命令在运行前必须经过人工审核。","Useful for typical development with an emphasis on security. It prioritizes safety over speed by requiring manual approval for all terminal commands and files outside the project directory.":"适用于注重安全性的常规开发场景。优先保障系统安全，在执行所有终端命令以及访问项目目录外的文件时，均需人工审核批准。","Uses global settings when working in this project.":"在此项目中工作时继承全局设置。","Verbose agent chat":"显示详细智能体推理","View your available model quota and AI credits. Model quota refreshes periodically based on your plan. Enable AI Credit Overages to continue using models when your quota is exhausted.":"查看当前可用模型配额与 AI 额度。模型配额会根据您的计划定期刷新重置。开启“AI 额度超量抵扣”可在配额用尽时无缝继续工作。","View your available model quota. Quota refreshes periodically based on your plan.":"查看当前可用模型配额。配额将根据您的订阅计划定期刷新重置。","We recommend attaching logs. Attaching logs will help the Antigravity team act on and prioritize your feedback.":"建议附带日志。日志将帮助 Antigravity 团队跟进并优先处理您的反馈。","Web Search Tool":"联网搜索工具 (Google Web Search)","Week":"周","Weekly Limit":"每周配额限制","Weekly Limit Remaining":"本周剩余配额","Weeks":"周","When enabled, \"Explain and Fix\" actions will continue in the current conversation instead of starting a new one.":"启用后，“解释并修复”操作将在当前会话中无缝继续，而不会另起新会话。","When enabled, Agent can use browser tools to open URLs, read web pages, and interact with browser content. This allows the Agent access to important (and often critical) knowledge and methods of validation, but any browser integration does increase exposure to external malicious parties for security exploits.":"启用后，智能体可使用内置浏览器工具访问网页、抓取文档与验证 Web 界面。这能大幅提升智能体的调研与自测能力，但也会增加访问未知外部网页时的安全暴露面。","When enabled, Agent will use IDE's shell integration to detect and report terminal command execution. When disabled, the agent will use its own shell. Restart the application for this to take effect.":"启用后，智能体将复用 IDE 的 Shell 集成以探测并上报终端命令执行状态；禁用后将使用独立 Shell。重启应用程序后生效。","When enabled, Antigravity will play a sound when Agent finishes generating a response.":"启用后，当智能体完成推理与代码生成时将播放提示音。","When enabled, enforces settings that prevent the agent from autonomously running targeted exploits and requires human review for all agent actions. Visit antigravity.google/docs/strict-mode for details.":"开启后将强制执行安全沙箱，防止智能体未经授权执行高危行为，并要求对所有操作进行人工审核。详情请访问 antigravity.google/docs/strict-mode。","When enabled, the agent will be able to access its knowledge base to inform its responses and automatically generate knowledge items in the background. Disabling this will prevent the agent from accessing existing knowledge items, but will not delete them.":"启用后，智能体将能够检索知识库以增强回答能力，并在后台自动生成知识条目。禁用此项将暂停访问知识库，但不会删除已积累的条目。","When enabled, the agent will be able to access past conversations to inform its responses.":"启用后，智能体将能够检索历史会话记录以辅助生成回答。","When enabled, the Changes Overview toolbar will automatically expand when Agent finishes generating a response.":"启用后，智能体生成完成时将自动展开代码变更概览工具栏。","When enabled, you will be automatically prompted to restart the app when there is a new update available. When disabled, you can check for updates manually from the app menu.":"启用后，检测到新版本将自动提示重启应用以完成更新；禁用后，可在应用菜单中手动检查更新。","When enabled, your UI will be slightly modified to ensure more consistent demos. This is only recommended for demo purposes. In most cases, you can run \"Antigravity: Start Demo Mode\" and \"Antigravity: Stop Demo Mode\" to control this switch and update your ~/.gemini/antigravity data directory.":"启用后，界面将进行微调以确保演示效果的稳定性。仅推荐在录屏演示时开启。您也可以运行 \"Antigravity: Start Demo Mode\" 和 \"Antigravity: Stop Demo Mode\" 指令来快捷控制此开关。","When toggled on, Antigravity collects usage data to help Google enhance performance and features.":"开启后，Antigravity 将收集匿名使用数据以帮助 Google 持续优化产品性能与功能体验。","When toggled on, Antigravity will use your AI credits to fulfill model requests once you're out of model quota. Antigravity will always use your model quota first before using AI credits.":"开启后，当模型配额耗尽时将自动使用 AI 额度继续调用模型。系统始终会优先消耗模型配额，配额用尽后再扣除 AI 额度。","when working in this project.":"（在此项目中生效）。","Wide":"宽屏模式 (Wide)","Window Controls Style":"窗口控件样式","Within each group, models share a weekly limit and a 5-hour limit. Quota is consumed proportionally to the cost of the tokens. Thus, limits will last longer with shorter tasks or using more cost-effective models. The 5-hour limit smooths out aggregate demand to fairly distribute global capacity across all users, while your weekly limit is tied directly to your individual tier.":"同一分组内的模型共享周配额与 5 小时配额。配额消耗与 Token 实际成本成正比，执行简短任务或选用高性价比模型可使额度更持久。5 小时限额旨在平滑全局并发需求以公平分配算力，而周限额则直接绑定您的账户订阅级别。","Word Wrap":"自动换行","Word Wrap Column":"自动换行字符列数","Word Wrap Mode":"自动换行模式","Workspace API":"工作区 API","Worktree":"工作区树 (Worktree)","WSL (Bash)":"WSL (Linux 子系统)","Year":"年","Years":"年","You can upgrade to a Google AI Ultra plan to receive higher rate limits.":"您可以升级至 Google AI Ultra 计划以获取更高的并发与速率限制。","You can upgrade to a Google AI Ultra plan to receive the highest rate limits.":"您可以升级至 Google AI Ultra 计划以获取最高层级的速率限制与模型权限。","You can upgrade to the Google AI Ultra plan to receive the highest rate limits.":"您可以升级至 Google AI Ultra 计划以获取顶级并发与速率限制。","You currently don't have any MCP Servers installed.":"您当前尚未安装任何 MCP 服务器。","You currently don't have any MCP Servers installed. Add an MCP server above":"您当前尚未安装任何 MCP 服务器。请在上方添加 MCP 服务器。","Your Plan: Google AI Pro":"当前订阅计划：Google AI Pro","Zoom Factor":"界面缩放比例","Application":"应用","Manage Antigravity app settings.":"管理 Antigravity 应用设置。","Remote Control":"远程控制","Enable Remote Control":"启用远程控制","Work with local agents from another device.":"通过其他设备远程协作本地智能体。","Best of N":"多路优选 (Best of N)","Manage how Best of N sets up the workspaces its arms run in.":"配置多路优选（Best of N）为其分支创建工作区的方式。","Inline Actions":"行内快捷操作","Show a floating notification card when background conversations need your input. Answer questions, approve commands, and grant permissions without leaving your current conversation. Share feedback at go/inline-actions-feedback.":"当后台会话需要您介入时，显示悬浮通知卡片。无需离开当前会话即可回答问题、批准命令和授权。反馈请访问 go/inline-actions-feedback。","No MCP servers installed":"暂未安装任何 MCP 服务器","Use Add MCP to browse the store, or add a custom server via the MCP config.":"点击“添加 MCP”浏览商店，或通过 MCP 配置文件添加自定义服务器。","Browse and enable plugins from the Build With Google catalog.":"从 Build With Google 插件目录中浏览并启用插件。","Google Chrome":"Google Chrome","Google3 chats will be regrouped into their workspaces in the sidebar.":"Google3 会话将重新归入侧边栏对应的工作区中。","This migration may mess up your settings, chats, and sidebar.":"此迁移可能会打乱您的设置、会话与侧边栏布局。","to back up your data and run the migration.":"以备份数据并执行迁移。","Follow the guide at":"请按以下指南操作：","Device Name":"设备名称","Scan the code to open this device in Remote Control, or":"扫描二维码以在远程控制中打开此设备，或","Enter bot name (optional)":"输入机器人名称（可选）","Enter avatar URL (optional)":"输入头像 URL（可选）","Enter device name...":"输入设备名称...","Edit project name":"编辑项目名称","Delete plugin":"删除插件","How to render rich interactive HTML widgets inline in the chat or as standalone artifacts. Use this skill when you want to show the user diagrams, data visualizations, interactive controls, educational walkthroughs, or any rich visual content beyond plain text and markdown.":"如何在聊天中以内联方式或作为独立交付件渲染丰富的可交互 HTML 部件。当您希望向用户展示图表、数据可视化、交互式控件、教育演练或超越纯文本和 Markdown 的任何丰富视觉内容时使用此技能。","Automatically migrate legacy workflows (.agents/workflows/ or ~/.gemini/config/workflows/) to skills (.agents/skills/ or ~/.gemini/config/skills/). Scans for existing workflows, creates target SKILL.md files, and archives old workflow files.":"自动将旧版工作流（.agents/workflows/ 或 ~/.gemini/config/workflows/）迁移为技能（.agents/skills/ 或 ~/.gemini/config/skills/）。扫描现有工作流，创建目标 SKILL.md 文件并归档旧工作流文件。","Guidelines for interacting with GitHub and request permissions from the user when commands fail due to restrictions in the agent environment.":"与 GitHub 交互的指导规范，以及当命令因智能体环境限制而失败时向用户请求必要权限。","Active Sessions":"当前会话","Add Folder to Workspace":"添加文件夹到工作区","Add Folder to Workspace...":"添加文件夹到工作区...","Add folders to get started":"添加文件夹以开始使用","Add Subfolder":"添加子文件夹","Archive Workspace":"归档工作区","Are you sure you want to delete this workspace?":"确定要删除此工作区吗？","Branch Isolation":"独立分支环境隔离","Branch Workspace (Isolated)":"分支工作区 (独立隔离)","Checkout Branch":"检出分支","Clean Temporary Files":"清理临时缓存文件","Clean Workspace Storage":"清理工作区缓存","Clear Recent Workspaces":"清除最近工作区列表","Close Workspace":"关闭工作区","Commit & Push":"提交并推送","Commit Message":"提交说明","Configure Workspace":"配置工作区","Copy Absolute Path":"复制绝对路径","Copy Workspace Path":"复制工作区路径","Create Branch":"新建分支","Create Isolated Branch":"创建隔离分支工作区","Create Workspace":"创建工作区","Current Branch":"当前分支","Default Workspace":"默认工作区","Delete Branch Workspace":"删除分支工作区","Delete Workspace":"删除工作区","Discard All Changes":"放弃所有更改","Drag and drop folders here to add them to your workspace.":"拖放文件夹至此以将其添加到工作区。","Duplicate Workspace":"复制工作区","Duplicate Workspace Configuration":"复制当前工作区配置","Edit Workspace Name":"修改工作区名称","Ephemeral Workspace":"临时工作空间","Exclude Paths":"排除路径","Excluded Folders":"已排除的文件夹","Export Workspace":"导出工作区配置","Export Workspace Setup":"导出工作区配置方案","Failed to delete conversation":"删除会话失败","Failed to load conversation":"加载会话失败","Fetch Changes":"获取更改 (Fetch)","File Watcher Excludes":"文件监听排除项","File Watcher Settings":"文件监听器配置","Getting started with a Project":"项目快速上手","Ignored Files":"已忽略的文件","Import Workspace":"导入工作区配置","Include Patterns":"包含匹配模式","Isolated Environment":"隔离运行环境","Loading conversation...":"正在加载会话...","Manage folders in this workspace":"管理此工作区中的文件夹","Merge Branch":"合并分支","Merge Branch Workspace":"合并分支工作区","No folders in workspace":"工作区中暂无文件夹","Now that you've created a project, configure your project's agent settings or start a conversation.":"您已成功创建项目，现在可以配置项目的智能体设置或直接发起会话。","Open Containing Folder":"打开所在文件夹","Open in Editor":"在编辑器中打开","Open in External Terminal":"在外部终端中打开","Open in Terminal":"在终端中打开","Open Recent Workspace":"打开最近工作区","Pop Stash":"弹出暂存 (Pop Stash)","Pull Changes":"拉取更改 (Pull)","Push Changes":"推送更改 (Push)","Recent Workspaces":"最近使用的工作区","Recent Workspaces List":"最近工作区列表","Remove Folder":"移除文件夹","Remove Folder from Workspace":"从工作区移除文件夹","Rename Workspace":"重命名工作区","Restore Session":"恢复会话","Reveal in File Explorer":"在资源管理器中显示","Reveal in Finder":"在访达中显示","Root Directory":"根目录","Save Workspace":"保存工作区","Saved Sessions":"已保存会话","Search Excludes":"搜索排除项","Set as Default Workspace":"设为默认工作区","Share Workspace (Worktree)":"共享工作区 (Git Worktree)","Staged Changes":"已暂存的更改","Start first conversation":"开启首次会话","Stash Changes":"暂存更改 (Stash)","Subfolder":"子文件夹","Switch Branch":"切换分支","Switch Workspace":"切换工作区","Sync with Main Workspace":"与主工作区同步","Temporary Workspace":"临时工作区","This will remove the workspace from Antigravity, but will not delete the folders on your computer.":"此操作仅从 Antigravity 中解除工作区关联，不会删除您计算机本地的实际文件夹。","Unstaged Changes":"未暂存的更改","Untracked Files":"未跟踪的文件","When enabled, this agent will be able to access past conversations to inform its responses.":"启用后，智能体将能够参考历史会话记录以生成更精准的响应。","Workspace Configuration":"工作区配置","Workspace Directory":"工作区目录","Workspace Explorer":"工作区资源管理器","Workspace folders":"工作区文件夹","Workspace Git Branch":"工作区 Git 分支","Workspace Info":"工作区信息","Workspace Local Storage":"工作区本地存储","Workspace Path":"工作区路径","Workspace Root":"工作区根节点","Workspace Root Path":"工作区根路径","Workspace Settings":"工作区设置","Workspace Storage":"工作区缓存与存储","Worktree Mode":"Git Worktree 共享模式","New Workspace":"新建工作区","Add Workspace":"添加工作区","Current Workspace":"当前工作区","Project General":"项目通用设置","Project Folders":"项目文件夹","File Explorer":"文件资源管理器","File Viewer":"文件查看器","Archive project":"归档项目","Enter file or directory path...":"输入文件或目录路径...","Inherits your General settings when working in this project.":"在此项目中工作时继承您的通用偏好设置。","Previous 7 Days":"过去 7 天","Previous 30 Days":"过去 30 天","This week":"本周","Last week":"上周","Older":"更早","Export conversation":"导出会话","Export as Markdown":"导出为 Markdown","Export as JSON":"导出为 JSON","Fork conversation":"派生会话分支","Branch conversation":"从分支创建会话","Duplicate conversation":"复制会话","Copy conversation link":"复制会话链接","No conversations found":"未找到匹配的会话","No archived conversations":"暂无已归档会话","Filter conversations...":"筛选会话...","Add Project":"添加项目","Delete project group":"删除项目分组","Unarchive project":"取消归档项目","No projects yet":"暂无项目","Filter projects...":"筛选项目...","Recurring tasks":"周期任务","Next run":"下次运行","Last run":"上次运行","Pause schedule":"暂停计划","Resume schedule":"恢复计划","Delete schedule":"删除计划","No scheduled tasks":"暂无计划任务","Create scheduled task":"创建计划任务"}));
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

    // 2. 🛡️ AI 正文、思考链与流式打字专属小容器（精准锁定真实 Markdown 段落与思考链，绝不连坐消息外壳、步骤条与操作控件）
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

    // 3. 显微镜级核心安全禁区小容器（拒绝大容器一刀切，精确锁定真正的代码正文、终端缓冲区与用户输入段落）：
    //    核心锁定：代码行视口、代码块、终端字符屏幕、交付件正文、输入框与用户纯提问文本、公式与免翻标记
    const FORBIDDEN_SUBTREE_SELECTOR = [
        // Monaco / VS Code / Diff 代码正文小容器（精准锁定代码行视口，保护代码；释放边距槽.margin加号气泡与面包屑）
        '.lines-content', '[class*="lines-content"]', '.view-lines', '[class*="view-lines"]', '.view-line', '[class*="view-line"]',
        '[data-mode-id] .lines-content', '[data-mode-id] .view-lines', '[data-mode-id] .view-line',
        '.monaco-diff-editor .lines-content', '.monaco-editor .lines-content',
        '.decorationsOverviewRuler', '.suggest-widget .monaco-list', '.parameter-hints-widget',
        // CodeMirror 5 & 6 代码小容器
        '.cm-content', '[class*="cm-content"]', '.cm-line', '[class*="cm-line"]', '.cm-editor .cm-scroller',
        '.CodeMirror-lines', '.CodeMirror-line', '.CodeMirror-code',
        // Ace Editor 代码小容器
        '.ace_content', '.ace_line', '[class*="ace_line"]', '.ace_layer', '.ace_text-layer',
        // 通用 Markdown 与 HTML 语法高亮代码小容器
        'pre', 'code', 'kbd', 'samp', 'var',
        '.hljs', '.hljs-line', '[class*="hljs-"]', 'code[class*="language-"]', 'pre[class*="language-"]', '[class*="shiki"]',
        '.code-block pre', '.code-block code', '.code-line', '.line-content',
        // 终端字符输出小容器（保护终端字符流，释放终端工具栏与新建标签页按钮）
        '.xterm-screen', '.xterm-rows', '.xterm-row', '.xterm-accessibility', '.xterm-accessibility-tree',
        '[class*="terminal-screen"]', '[class*="terminal-rows"]',
        // 真实用户表单输入控件（保护用户输入，释放外层操作按钮）
        'input', 'textarea', '[contenteditable="true"]', '[role="textbox"]', '[role="searchbox"]',
        // 公式、免翻标记、矢量图与模板
        '.katex', '.katex-html', '[translate="no"]', '.notranslate', 'svg', 'math', 'template',
        // 交付件内部真实正文与代码
        '[class*="artifact-markdown"]', '[class*="artifact-code"]', '[class*="artifact-preview"]',
        '[class*="artifact-content"] pre', '[class*="artifact-content"] code',
        '[class*="artifact-body"] pre', '[class*="artifact-body"] code',
        '[class*="artifact-details"] pre', '[class*="artifact-details"] code',
        // 用户提问纯文本段落（保护提问原文与代码，释放外围操作按钮与时间戳）
        '[class*="user-input-step"] .whitespace-pre-wrap',
        '[data-turn-role="user"] .whitespace-pre-wrap',
        '[data-message-author="user"] .whitespace-pre-wrap',
        '[data-turn-role="user"] pre', '[data-turn-role="user"] code',
        // 会话自定义历史标题
        'a[href*="/c/"] [class*="truncate"]',
        '[data-testid*="conversation-item"] [class*="truncate"]',
        // 工具调用内部具体命令输出与终端代码（释放步骤条本身的标题、折叠箭头与悬浮气泡）
        '[class*="tool-call-details"] pre', '[class*="tool-call-details"] code',
        '[data-testid*="tool-call-content"] pre', '[data-testid*="tool-call-content"] code',
        '[class*="tool-call-result"]', '[class*="terminal-output"]'
    ].join(', ');

    // 未命中采集：收集“非禁区但未翻译”的英文文本，便于迭代补全字典（内存 Set 去重，零 I/O 开销）
    const missedTexts = new Set();
    const MISSED_TEXTS_MAX = 5000;

    function norm(s) {
        if (!s) return '';
        return s.replace(/\s+/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').trim();
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
        const m = itemStr.trim().match(/^([\d,.]+)\s+([a-zA-Z\s]+)$/);
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
        if (/^active\s+conversations?$/.test(unit)) return num + ' 个活跃会话';
        if (/^conversations?$/.test(unit)) return num + ' 个会话';
        if (/^image\s+attachments?$/.test(unit)) return num + ' 个图片附件';
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
        const taskMatch = normT.match(/^task-(\d+|[a-zA-Z0-9_-]+)$/i);
        if (taskMatch) return '任务 ' + taskMatch[1];
        return target;
    }

    function translateWithShortcut(val) {
        if (!val) return null;
        const match = val.match(/^(.+?)\s*\((Ctrl|Cmd|Alt|Shift|⌘|⌥|⇧|⌃)\+?([^)]*)\)$/i);
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
        const countMatch = val.match(/^(.+?)\s*\(([0-9]+)\)$/);
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
        const letterMatch = val.match(/^(.+?)\s*\(([A-Za-z]{1,2})\)$/);
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
        const symbolMatch = val.match(/^([+•*>-])\s+(.+)$/);
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

        // 分支 3：常规 UI 与交互控件（按钮、菜单、导航、设置面板等） -> 100% 默认放行
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
        if (/^(Rules|Skills):\s*([\d,]+)\s*tokens$/i.test(t)) {
            return t.replace(/^(Rules|Skills):\s*([\d,]+)\s*tokens$/i, (m, type, num) => {
                const typeCn = type.toLowerCase() === 'rules' ? '规则' : '技能';
                return typeCn + '：' + num + ' tokens';
            });
        }
        if (/^Plugin:\s*(.+)$/i.test(t)) {
            return t.replace(/^Plugin:\s*(.+)$/i, '插件：$1');
        }
        if (/^Toggle\s+(.+)$/i.test(t)) {
            return t.replace(/^Toggle\s+(.+)$/i, '切换 $1');
        }
        if (/^Load older messages, showing (\d+) of (\d+)$/i.test(t)) {
            return t.replace(/^Load older messages, showing (\d+) of (\d+)$/i, '加载更早的消息，当前显示 $1 / $2');
        }
        if (/^\+(\d+)\s+more\s+lines?$/i.test(t)) {
            return t.replace(/^\+(\d+)\s+more\s+lines?$/i, '+$1 行');
        }
        if (/^Showing\s+(\d+)\s+lines?$/i.test(t)) {
            return t.replace(/^Showing\s+(\d+)\s+lines?$/i, '显示 $1 行');
        }
        if (/^Enter\s+(.+?)\s+name\.\.\.$/i.test(t)) {
            return t.replace(/^Enter\s+(.+?)\s+name\.\.\.$/i, (m, name) => {
                const nameCn = name === 'scheduled task' ? '计划任务' : (name === 'automation' ? '自动化' : name);
                return '输入' + nameCn + '名称...';
            });
        }
        if (/^Enter a prompt for the agent to run\.\.\.$/i.test(t)) {
            return '输入供智能体执行的提示词...';
        }
        if (/^([\d,.]+\s+[a-zA-Z\s]+)(?:,\s*[\d,.]+\s+[a-zA-Z\s]+)*$/i.test(t)) {
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

            // 🛡️ 物理保护 1：文件路径、代码文件名、网址URL、UUID/Hash与命令行
            if (/^(https?:\/\/|[a-zA-Z]:[\\/]|[\\/][a-zA-Z0-9_.-]|\.[\\/]|\.\.[\\/])/.test(valNorm)) return;
            if (/^[a-zA-Z0-9_\-.]+\.(js|ts|jsx|tsx|json|py|go|rs|cpp|c|h|hpp|java|kt|dart|html|css|scss|md|mdx|yaml|yml|toml|xml|sql|sh|bat|ps1|asar|exe|dll|zip|tar|gz|png|jpg|svg|ico)$/i.test(valNorm)) return;
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valNorm)) return;

            // 🛡️ 物理保护 2：纯代码行/函数调用特征（放行动作步骤标题，如 Ran node ...）
            if (!/^(Ran|Running|Explored|Analyzed|Searched|Edited|Thought for|Worked for|Checked|Killed|Starting|Started)\b/i.test(valNorm)) {
                if (/[a-zA-Z0-9_$]+\.[a-zA-Z0-9_$]+\(/.test(valNorm) || /^[a-zA-Z0-9_$]+\(.*\)$/.test(valNorm)) return;
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
                            .replace(/(\d+)\s*days?/gi, '$1 天')
                            .replace(/(\d+)\s*hours?/gi, '$1 小时')
                            .replace(/(\d+)\s*minutes?/gi, '$1 分钟')
                            .replace(/(\d+)\s*seconds?/gi, '$1 秒')
                            .replace(/,\s*/g, ' ')
                            .replace(/\s+/g, ' ');
                        return tTrans + "后刷新";
                    });
                } else if (/^You have used some of your (.+?) limit, it will fully refresh in (.+?)\.?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^You have used some of your (.+?) limit, it will fully refresh in (.+?)\.?$/i, (match, limitType, timeStr) => {
                        let lType = limitType.trim().toLowerCase();
                        let lTrans = limitType.trim();
                        if (lType === 'weekly') lTrans = '每周';
                        else if (lType === 'daily') lTrans = '每日';
                        else if (lType === 'monthly') lTrans = '每月';
                        else if (lType.includes('5-hour') || lType.includes('5 hour')) lTrans = '5 小时';
                        else {
                            lTrans = lType.replace(/(\d+)-hour/g, '$1 小时').replace(/(\d+)\s*hours?/g, '$1 小时');
                        }
                        
                        let tTrans = timeStr.trim()
                            .replace(/(\d+)\s*days?/gi, '$1 天')
                            .replace(/(\d+)\s*hours?/gi, '$1 小时')
                            .replace(/(\d+)\s*minutes?/gi, '$1 分钟')
                            .replace(/(\d+)\s*seconds?/gi, '$1 秒')
                            .replace(/,\s*/g, ' ')
                            .replace(/\s+/g, ' ');
                            
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
                    temp = temp.replace(/(\d+)\s*days?/gi, '$1 天');
                    temp = temp.replace(/(\d+)\s*hours?/gi, '$1 小时');
                    temp = temp.replace(/(\d+)\s*minutes?/gi, '$1 分钟');
                    temp = temp.replace(/(\d+)\s*seconds?/gi, '$1 秒');
                    temp = temp.replace(/部分\s+每周/g, '部分每周');
                    temp = temp.replace(/部分\s+每日/g, '部分每日');
                    temp = temp.replace(/部分\s+每月/g, '部分每月');
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
                } else if (valNorm.includes('了解更多关于') && /inherit\s+general/i.test(valNorm)) {
                    newVal = valNorm.replace(/inherit\s+general/gi, '继承通用设置 (Inherit General)');
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
                } else if (/^Your Plan:\s*(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Your Plan:\s*(.+)$/i, (match, plan) => {
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
                } else if (/^(\d+) tools? enabled$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(\d+) tools? enabled$/i, (match, num) => {
                        return num + " 个工具已启用";
                    });
                } else if (/^Show (\d+) more(\.\.\.|…)?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Show (\d+) more(\.\.\.|…)?$/i, (match, num) => {
                        return "显示另外 " + num + " 个...";
                    });
                } else if (/^Show (\d+) breakdowns?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Show (\d+) breakdowns?$/i, (match, num) => {
                        return "显示 " + num + " 个细目";
                    });
                } else if (/^Hide (\d+) breakdowns?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Hide (\d+) breakdowns?$/i, (match, num) => {
                        return "隐藏 " + num + " 个细目";
                    });
                } else if (/^Show all (\d+) breakdowns?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Show all (\d+) breakdowns?$/i, (match, num) => {
                        return "显示全部 " + num + " 个细目";
                    });
                } else if (/^Hide all (\d+) breakdowns?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Hide all (\d+) breakdowns?$/i, (match, num) => {
                        return "隐藏全部 " + num + " 个细目";
                    });
                } else if (/^(Rules|Skills):\s*([\d,]+)\s*tokens$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(Rules|Skills):\s*([\d,]+)\s*tokens$/i, (m, type, num) => {
                        const t = type.toLowerCase() === 'rules' ? '规则' : '技能';
                        return t + '：' + num + ' tokens';
                    });
                } else if (/^Media \((Today|Yesterday)\s+(\d{1,2}:\d{2})\s*(AM|PM)?\)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Media \((Today|Yesterday)\s+(\d{1,2}:\d{2})\s*(AM|PM)?\)$/i, (m, day, time, ap) => {
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
                } else if (/^Skills providing tailored instructions for happy path (.+?) development workflows\.?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Skills providing tailored instructions for happy path (.+?) development workflows\.?$/i, (match, lang) => {
                        let translatedLang = lang;
                        if (lang.toLowerCase() === 'dart and flutter') translatedLang = "Dart 和 Flutter";
                        return "提供为 " + translatedLang + " 的顺畅 (Happy Path) 开发流程量身定制的技能指令。";
                    });
                } else if (/^Worked for (\d+)(s|m|h|d|w|mo|yr)?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Worked for (\d+)(s|m|h|d|w|mo|yr)?$/i, (match, num, unit) => {
                        return "已工作 " + num + " " + unitToCn(unit);
                    });
                } else if (/^Working for (\d+)(s|m|h|d|w|mo|yr)?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Working for (\d+)(s|m|h|d|w|mo|yr)?$/i, (match, num, unit) => {
                        return "已工作 " + num + " " + unitToCn(unit);
                    });
                } else if (/^Thinking \(?(\d+)(s|m|h|d|w|mo|yr)?\)?(\.{1,3}|…)?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Thinking \(?(\d+)(s|m|h|d|w|mo|yr)?\)?(\.{1,3}|…)?$/i, (match, num, unit, dots) => {
                        return "思考中 (" + num + " " + unitToCn(unit) + ")" + (dots || "…");
                    });
                } else if (/^Waiting for (.+?)(\.{1,3}|…)?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Waiting for (.+?)(\.{1,3}|…)?$/i, (match, target, dots) => {
                        let t = target.trim().toLowerCase();
                        let trans = target;
                        if (t === 'input') trans = "输入";
                        else if (t === 'user') trans = "用户";
                        else if (t === 'tool' || t === 'tools') trans = "工具";
                        else if (t === 'agent' || t === 'agents') trans = "智能体";
                        return "等待 " + trans + " 中...";
                    });
                } else if (/^Thinking for (\d+)(s|m|h|d|w|mo|yr)?(\.{0,3}|…)?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Thinking for (\d+)(s|m|h|d|w|mo|yr)?(\.{0,3}|…)?$/i, (match, num, unit, dots) => {
                        return "已思考 " + num + " " + unitToCn(unit) + (dots || "");
                    });
                } else if (/^Running for (\d+)(s|m|h|d|w|mo|yr)?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Running for (\d+)(s|m|h|d|w|mo|yr)?$/i, (match, num, unit) => {
                        return "已运行 " + num + " " + unitToCn(unit);
                    });
                } else if (/^Executing for (\d+)(s|m|h|d|w|mo|yr)?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Executing for (\d+)(s|m|h|d|w|mo|yr)?$/i, (match, num, unit) => {
                        return "已执行 " + num + " " + unitToCn(unit);
                    });
                } else if (/^Thought for (\d+)(s|m|h)?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Thought for (\d+)(s|m|h)?$/i, (match, num, unit) => {
                        return "思考了 " + num + " " + unitToCn(unit);
                    });
                } else if (/^Timed (\d+)\s+seconds?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Timed (\d+)\s+seconds?$/i, (match, num) => {
                        return "计时 " + num + " 秒";
                    });
                // 动词步骤摘要（Explored/Analyzed/Edited/Created/Deleted/Searching）不设引擎整句支路：
                // 字典动作词精确匹配 + 分片计数（官方 UI 将动作词与计数拆成独立文本节点）是唯一机制，避免双重翻译
                } else if (/^(?:Ran|Running)\s+(\d+)\s+commands?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(Ran|Running)\s+(\d+)\s+commands?$/i, (m, verb, num) => {
                        return (verb.toLowerCase() === 'running' ? "正在运行 " : "已运行 ") + num + " 条命令";
                    });
                } else if (/^Ran\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Ran\s+(.+)$/i, (match, prefix) => {
                        let isWorking = / Working\.\.\.$/i.test(prefix);
                        let cleanPrefix = prefix.replace(/ Working\.\.\.$/i, '');
                        let trans = translateCountList(cleanPrefix);
                        return (isWorking ? "正在执行 " : "已执行 ") + trans + (isWorking ? " 正在处理..." : "");
                    });
                } else if (/^Searched\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Searched\s+(.+)$/i, (match, body) => {
                        let res = body.replace(/(\d+)\s+results?/i, '$1 个结果').replace(/(\d+)\s+result/i, '$1 个结果');
                        return "已搜索 " + res;
                    });
                } else if (/^Checked task\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Checked task\s+(.+)$/i, (match, target) => {
                        return "已检查任务 " + translateTaskTarget(target);
                    });
                } else if (/^Checking task\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Checking task\s+(.+)$/i, (match, target) => {
                        return "正在检查任务 " + translateTaskTarget(target);
                    });
                } else if (/^Killed task\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Killed task\s+(.+)$/i, (match, target) => {
                        return "已终止任务 " + translateTaskTarget(target);
                    });
                } else if (/^Killing task\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Killing task\s+(.+)$/i, (match, target) => {
                        return "正在终止任务 " + translateTaskTarget(target);
                    });
                } else if (/^Started task\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Started task\s+(.+)$/i, (match, target) => {
                        return "已启动任务 " + translateTaskTarget(target);
                    });
                } else if (/^Starting task\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Starting task\s+(.+)$/i, (match, target) => {
                        return "正在启动任务 " + translateTaskTarget(target);
                    });
                } else if (/^Paused task\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Paused task\s+(.+)$/i, (match, target) => {
                        return "已暂停任务 " + translateTaskTarget(target);
                    });
                } else if (/^Pausing task\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Pausing task\s+(.+)$/i, (match, target) => {
                        return "正在暂停任务 " + translateTaskTarget(target);
                    });
                } else if (/^Resumed task\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Resumed task\s+(.+)$/i, (match, target) => {
                        return "已恢复任务 " + translateTaskTarget(target);
                    });
                } else if (/^Resuming task\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Resuming task\s+(.+)$/i, (match, target) => {
                        return "正在恢复任务 " + translateTaskTarget(target);
                    });
                } else if (/^Created task\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Created task\s+(.+)$/i, (match, target) => {
                        return "已创建任务 " + translateTaskTarget(target);
                    });
                } else if (/^Creating task\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Creating task\s+(.+)$/i, (match, target) => {
                        return "正在创建任务 " + translateTaskTarget(target);
                    });
                } else if (/^Sent input to task\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Sent input to task\s+(.+)$/i, (match, target) => {
                        return "已向任务发送输入 " + translateTaskTarget(target);
                    });
                } else if (/^Sending input to task\s+(.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Sending input to task\s+(.+)$/i, (match, target) => {
                        return "正在向任务发送输入 " + translateTaskTarget(target);
                    });
                } else if (/^Checked (.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Checked (.+)$/i, (match, prefix) => {
                        let isWorking = / Working\.\.\.$/i.test(prefix);
                        let cleanPrefix = prefix.replace(/ Working\.\.\.$/i, '');
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
                        let isWorking = / Working\.\.\.$/i.test(prefix);
                        let cleanPrefix = prefix.replace(/ Working\.\.\.$/i, '');
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
                } else if (/^Load older messages, showing (\d+) of (\d+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Load older messages, showing (\d+) of (\d+)$/i, '加载更早的消息，当前显示 $1 / $2');
                } else if (/^(\d+) files? changed(\s*\+\d+\s*-\d+)?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(\d+) files? changed(\s*\+\d+\s*-\d+)?$/i, (match, num, diff) => {
                        let diffStr = diff || "";
                        return num + " 个文件已改动" + diffStr;
                    });
                } else if (/^(\d+)\s+subagents?\/tasks?\s+running$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(\d+)\s+subagents?\/tasks?\s+running$/i, '$1 个子智能体/任务正在运行');
                } else if (/^(\d+)\s+subagents?\s+running$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(\d+)\s+subagents?\s+running$/i, '$1 个子智能体正在运行');
                } else if (/^(\d+)\s+tasks?\s+running$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(\d+)\s+tasks?\s+running$/i, '$1 个任务正在运行');
                } else if (/^(\d+\s+[a-zA-Z\s]+)(?:,\s*\d+\s+[a-zA-Z\s]+)*$/i.test(valNorm) && translateCountList(valNorm) !== valNorm) {
                    newVal = translateCountList(valNorm);
                } else if (/^\+(\d+)\s+more\s+lines?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^\+(\d+)\s+more\s+lines?$/i, '+$1 行');
                } else if (/^Showing\s+(\d+)\s+lines?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Showing\s+(\d+)\s+lines?$/i, '显示 $1 行');
                } else if (/^Permanently delete (.+?), including (\d+) active conversations?\.?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Permanently delete (.+?), including (\d+) active conversations?\.?$/i, (match, proj, count) => {
                        return "永久删除 " + proj + "，包含 " + count + " 个活跃会话。";
                    });
                } else if (/^including (\d+) active conversations?\.?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^including (\d+) active conversations?\.?$/i, "包含 $1 个活跃会话。");
                } else if (/^All changes since (.+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^All changes since (.+)$/i, '自 $1 以来的所有更改');
                } else if (/^All\s+(?:scheduled tasks?|automations?)\s+run\s+as\s+(.+?)\.?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^All\s+(?:scheduled tasks?|automations?)\s+run\s+as\s+(.+?)\.?$/i, '所有计划任务均以 $1 模型运行。');
                } else if (/^A\s+(?:scheduled task|automation)\s+with\s+ID\s+(.+?)\s+already\s+exists\.?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^A\s+(?:scheduled task|automation)\s+with\s+ID\s+(.+?)\s+already\s+exists\.?$/i, 'ID 为 $1 的任务已存在。');
                } else if (/^See all \((\d+)\)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^See all \((\d+)\)$/i, (match, num) => {
                        return "显示全部 (" + num + ")";
                    });
                } else if (/^Available AI Credits: (\d+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Available AI Credits: (\d+)$/i, (match, num) => {
                        return "可用 AI 额度: " + num;
                    });
                } else if (/^Version\s+([\d\.]+)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Version\s+([\d\.]+)$/i, (match, v) => {
                        return "版本 " + v;
                    });
                } else if (/^(\d+)(s|m|h|d|w|mo|yr)$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(\d+)(s|m|h|d|w|mo|yr)$/i, (match, num, unit) => {
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
                } else if (/^Are you sure you want to delete (the |this )?(project group|project|workspace)?\s*(.+?)\??$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Are you sure you want to delete (the |this )?(project group|project|workspace)?\s*(.+?)\??$/i, (match, article, type, name) => {
                        let typeStr = "项目";
                        if (type && type.toLowerCase().includes('group')) typeStr = "项目分组";
                        else if (type && type.toLowerCase() === 'workspace') typeStr = "工作区";
                        return "您确定要删除 " + typeStr + " " + name + " 吗？";
                    });
                } else if (/^This will permanently delete (\d+) active conversations? within it\.?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^This will permanently delete (\d+) active conversations? within it\.?$/i, (match, count) => {
                        return "此操作将永久删除其中的 " + count + " 个活跃会话。";
                    });
                } else if (/^This will permanently delete (.+?) within it\.?$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^This will permanently delete (.+?) within it\.?$/i, (match, target) => {
                        return "此操作将永久删除其中的 " + target + "。";
                    });
                } else if (/^(.+?): context deadline exceeded$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(.+?): context deadline exceeded$/i, (match, prefix) => {
                        return prefix + ": 请求超时 (context deadline exceeded)";
                    });
                } else if (/^(.+?): i\/o timeout$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^(.+?): i\/o timeout$/i, (match, prefix) => {
                        return prefix + ": I\/O 超时 (i\/o timeout)";
                    });
                } else if (/^Are you sure you want to delete (the |this )?project (.+?)\??$/i.test(valNorm)) {
                    newVal = valNorm.replace(/^Are you sure you want to delete (the |this )?project (.+?)\??$/i, (match, article, name) => {
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
                    if (!/^#L\d+(-\d+)?$/i.test(valNorm)) {
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
            // 🚪 根节点前置物理熔断大门禁：若当前子树本身位于核心禁区或 AI 正文内，全树瞬间跳过！
            if (typeof root.closest === 'function' && 
                root.closest(FORBIDDEN_SUBTREE_SELECTOR + ', ' + AI_STREAM_PROSE_SELECTOR)) {
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

        // 🚀【父级直接切断向下扫描器（绝对零回溯）】：单向前向单向流水线
        // 核心铁律：不回溯父级，而是在遇到安全禁区的“父级”节点时，直接 FILTER_REJECT 切断向下扫描！
        // 内部成千上万行代码 0 次深入、0 次触碰；合法的常规 UI 节点向下深入时顺带翻译自身属性，到达叶子文本纯粹直通！
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
            acceptNode: function(n) {
                if (n.nodeType === Node.ELEMENT_NODE) {
                    const tag = n.tagName ? n.tagName.toUpperCase() : '';
                    if (BLOCKED_TAGS.has(tag)) return NodeFilter.FILTER_REJECT; // 🛑 标签级父级一刀切断
                    if (typeof n.matches === 'function') {
                        if (n.matches(FORBIDDEN_SUBTREE_SELECTOR) || n.matches(AI_STREAM_PROSE_SELECTOR)) {
                            return NodeFilter.FILTER_REJECT; // 🛑 核心铁律：在安全区“父级”切断向下扫描！整树丢弃，绝不深入！
                        }
                    }
                    // ✅ 走到这里的都是经过父级门禁检验的合法常规 UI 元素：顺带翻译当前元素自身属性（无 querySelector，无 closest 回溯）
                    translateElementAttrs(n);
                    return NodeFilter.FILTER_SKIP; // 跳过当前元素自身，继续向下扫描合法的常规子元素
                }
                if (n.nodeType === Node.TEXT_NODE) {
                    if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT; // ✅ 合法常规 UI 叶子文本，0 次向上回溯，绝对纯粹直通！
                }
                return NodeFilter.FILTER_SKIP;
            }
        });

        let curr = walker.nextNode();
        while (curr) {
            translateTextNode(curr, true); // 纯粹直通，0 次向上爬楼梯回溯
            curr = walker.nextNode();
        }
    }

    // 暴露未命中采集结果：调用 window.__AG_DUMP_MISSING__() 输出并返回未翻译文案列表
    window.__AG_MISSED_TEXTS__ = missedTexts;
    window.__AG_DUMP_MISSING__ = function() {
        const arr = Array.from(missedTexts).sort();
        console.log('[AG汉化] 未翻译文案 ' + arr.length + ' 条:\n' + arr.join('\n'));
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
                        if (typeof n.closest === 'function' && (n.closest(FORBIDDEN_SUBTREE_SELECTOR) || n.closest(AI_STREAM_PROSE_SELECTOR))) continue;
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
                    if (typeof target.closest === 'function') {
                        if (target.closest(FORBIDDEN_SUBTREE_SELECTOR + ', ' + AI_STREAM_PROSE_SELECTOR)) {
                            continue;
                        }
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

    // 引擎全部初始化完成，写入跨 world 防重标志（供另一 world 的引擎检测后退出）
    if (rootEl && rootEl.dataset) rootEl.dataset.agHanhua = '1';
})();
/* --- ANTIGRAVITY CHINESE LOCALIZATION END --- */