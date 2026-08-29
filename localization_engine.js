const fs = require('fs');
const path = require('path');
const os = require('os');
const child_process = require('child_process');
const crypto = require('crypto');

const DICTS_FOLDER = 'dicts';
const SRC_DIR = path.join(__dirname, 'src');
// 引擎版本号：取自 package.json，注入生成产物（window.__AG_I18N_VERSION__）供运行诊断与版本比对
const ENGINE_VERSION = (() => {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
        return String(pkg.version || '1.0.0');
    } catch (e) {
        return '1.0.0';
    }
})();
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
    const keyOrigin = Object.create(null);
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
                        if (normK && normK !== '__proto__' && normK !== 'constructor' && normK !== 'prototype') {
                            // 归一化同键冲突检测：跨文件重复键会被后加载者静默覆盖，提前告警避免译值被意外改写
                            if (keyOrigin[normK] !== undefined) {
                                console.warn(`[警告] 字典键冲突: "${normK}" 同时出现于 ${keyOrigin[normK]} 与 ${file}，将采用后者译值。`);
                            } else {
                                keyOrigin[normK] = file;
                            }
                            totalMap[normK] = v;
                        }
                    }
                } catch (e) {
                    console.error(`[警告] 字典文件解析失败，已跳过该文件: ${file} (${e.message})`);
                }
            }
        }
    }
    if (BRAND_TITLE_MODE === 'english') {
        // 保持英文原样，但保留为 identity 键（值=原文）：翻译结果不变，且不会因"未命中"污染漏译采集池
        totalMap[normalizeText('Antigravity')] = 'Antigravity';
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

    // 渲染层引擎与共享翻译内核均维护在独立文件中（正规 JS 源文件，可 lint/测试/调试），
    // 宿主负责把内核（已注入字典与版本号）拼装进渲染层的 __AG_KERNEL__ 标记处。
    // 注意：用函数形式替换，避免字典内容中的 $& / $` / $' 等字符被 String.replace 当作特殊替换模式解析
    const jsSource = fs.readFileSync(path.join(SRC_DIR, 'renderer_engine.src.js'), 'utf-8');
    return jsSource.replace('// __AG_KERNEL__', () => buildKernelSource(fullDict));
}

// 共享翻译内核：渲染层与主进程同源。构建时注入字典（DICT_PLACEHOLDER）与版本号（__AG_I18N_VERSION__）
function buildKernelSource(fullDict) {
    const dictJson = JSON.stringify(fullDict);
    return fs.readFileSync(path.join(SRC_DIR, 'translate_kernel.src.js'), 'utf-8')
        .replace('DICT_PLACEHOLDER', () => dictJson)
        .replace('__AG_I18N_VERSION__', () => ENGINE_VERSION);
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
    const rendererJs = generateJs(fullDict);
    const rendererJsEscaped = JSON.stringify(rendererJs);

    // 主进程拦截核心源码维护在独立文件中，宿主注入共享内核（含字典）与渲染层注入码
    // 注意：用函数形式替换，避免替换内容中的 $& / $` / $' 等字符被 String.replace 当作特殊替换模式解析
    return fs.readFileSync(path.join(SRC_DIR, 'main_core.src.js'), 'utf-8')
        .replace('// __AG_KERNEL__', () => buildKernelSource(fullDict))
        .replace('RENDERER_CODE_PLACEHOLDER', () => rendererJsEscaped);
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
