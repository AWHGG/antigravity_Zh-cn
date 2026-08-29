// 漏译清单 → 待填字典骨架生成器
// 用法：
//   node scratch/apply_missing.js <missing.txt>            # 预览将生成的骨架（不写盘）
//   node scratch/apply_missing.js <missing.txt> --write    # 合并写入 dicts/page_missing_pending.json
// 输入兼容两种形态：
//   1) dump_missing.js 的控制台输出（含 `MISSING "..."` / `[TAG] "..."` 行）
//   2) 引擎 __AG_DUMP_MISSING__() 导出的纯文本清单（每行一条）
// 过滤规则：剔除已被字典覆盖（归一化+小写）、纯代码/路径/UUID/命令行特征、以及含中文或无字母的噪声条目。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DICTS_DIR = path.join(ROOT, 'dicts');
const PENDING_FILE = path.join(DICTS_DIR, 'page_missing_pending.json');

function norm(s) {
    if (!s || typeof s !== 'string') return '';
    return s.replace(/\s+/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').trim();
}

// 与翻译内核 isCodeLikeText 对齐的代码/路径特征判定，避免把代码片段写进字典
function isCodeLike(s) {
    if (/^(https?:\/\/|[a-zA-Z]:[\\/]|[\\/][a-zA-Z0-9_.-]|\.[\\/]|\.\.[\\/])/.test(s)) return true;
    if (/^[a-zA-Z0-9_\-.]+\.(js|ts|jsx|tsx|json|py|go|rs|cpp|c|h|hpp|java|kt|dart|html|css|scss|md|mdx|yaml|yml|toml|xml|sql|sh|bat|ps1|asar|exe|dll|zip|tar|gz|png|jpg|svg|ico|txt|log|env)$/i.test(s)) return true;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return true;
    if (/^[0-9a-f]{7,40}$/i.test(s)) return true;
    if (/^--?[a-zA-Z0-9_\-]+(=.*)?$/.test(s)) return true;
    if (/[a-zA-Z0-9_$]+\.[a-zA-Z0-9_$]+\(/.test(s) || /^[a-zA-Z0-9_$]+\(.*\)$/.test(s)) return true;
    // 含路径分隔符且以扩展名收尾的相对路径（如 src/utils/helper.js），不应成为字典键
    if (/[\\/]/.test(s) && !/\s/.test(s) && /\.[a-z0-9]{1,6}$/i.test(s)) return true;
    return false;
}

function loadExistingKeys() {
    const keys = new Set();
    for (const file of fs.readdirSync(DICTS_DIR)) {
        if (!file.endsWith('.json')) continue;
        try {
            const data = JSON.parse(fs.readFileSync(path.join(DICTS_DIR, file), 'utf-8'));
            for (const k of Object.keys(data)) {
                const nk = norm(k);
                if (nk) {
                    keys.add(nk);
                    keys.add(nk.toLowerCase());
                }
            }
        } catch (e) {
            console.error(`[警告] 字典解析失败，跳过: ${file} (${e.message})`);
        }
    }
    return keys;
}

// 从一行原始输出中提取候选文本：优先取双引号包裹的 JSON 字符串，否则取整行
function extractCandidate(line) {
    const m = line.match(/"((?:[^"\\]|\\.)*)"/);
    if (m) {
        try { return JSON.parse('"' + m[1] + '"'); } catch (e) { return m[1]; }
    }
    return line.trim();
}

function main() {
    const args = process.argv.slice(2);
    const writeFile = args.includes('--write');
    const inputArg = args.find(a => !a.startsWith('--'));
    if (!inputArg) {
        console.error('用法: node scratch/apply_missing.js <missing.txt> [--write]');
        process.exit(1);
    }
    const inputPath = path.resolve(inputArg);
    if (!fs.existsSync(inputPath)) {
        console.error(`[错误] 输入文件不存在: ${inputPath}`);
        process.exit(1);
    }

    const lines = fs.readFileSync(inputPath, 'utf-8').split(/\r?\n/);
    const existing = loadExistingKeys();

    const skeleton = {};
    let seen = 0, covered = 0, codeLike = 0, noise = 0, added = 0;
    for (const rawLine of lines) {
        if (!rawLine.trim()) continue;
        const cand = norm(extractCandidate(rawLine));
        if (!cand) continue;
        seen++;
        if (!/[a-zA-Z]/.test(cand) || /[一-龥]/.test(cand)) { noise++; continue; }
        if (existing.has(cand) || existing.has(cand.toLowerCase())) { covered++; continue; }
        if (isCodeLike(cand)) { codeLike++; continue; }
        if (!(cand in skeleton)) {
            skeleton[cand] = '';
            added++;
        }
    }

    console.log(`[统计] 候选 ${seen} 条 | 已覆盖 ${covered} | 代码样 ${codeLike} | 噪声 ${noise} | 待填 ${added}`);
    if (added === 0) {
        console.log('[结果] 无新增待填词条。');
        return;
    }

    if (writeFile) {
        // 合并已有 pending 文件（保留已填写的译值，不覆盖人工成果）
        let merged = {};
        if (fs.existsSync(PENDING_FILE)) {
            try { merged = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf-8')); } catch (e) { merged = {}; }
        }
        for (const [k, v] of Object.entries(skeleton)) {
            if (!(k in merged)) merged[k] = v;
        }
        const sorted = {};
        for (const k of Object.keys(merged).sort((a, b) => a.localeCompare(b))) sorted[k] = merged[k];
        fs.writeFileSync(PENDING_FILE, JSON.stringify(sorted, null, 2) + '\n', 'utf-8');
        console.log(`[写入] 已合并到 ${path.relative(ROOT, PENDING_FILE)}（共 ${Object.keys(sorted).length} 条，空值待人工补译）`);
    } else {
        console.log('[预览] 待填骨架（加 --write 写入 dicts/page_missing_pending.json）:');
        console.log(JSON.stringify(skeleton, null, 2));
    }
}

main();
