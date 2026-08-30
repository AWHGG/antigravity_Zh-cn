/*
 * Antigravity 共享翻译内核（渲染层与主进程同源）
 * 宿主在生成时注入字典 JSON 与引擎版本号，请勿直接运行本文件。
 */
const AG_I18N_VERSION = '__AG_I18N_VERSION__';

    const map = new Map(Object.entries(DICT_PLACEHOLDER));
    const lowerMap = new Map();
    for (const [k, v] of map.entries()) lowerMap.set(k.toLowerCase(), v);
    

    // 归一化前置探测：无弯引号、无非空格空白、无连续空白、无首尾空白时归一化为恒等变换，
    // 直接返回原串跳过 3 次 replace + trim 的完整正则链（高频路径每文本节点执行）
    const NEEDS_NORM_RE = /[\u2018\u2019\u201C\u201D]|[^\S ]|\s\s|^\s|\s$/;
    function norm(s) {
        if (!s || typeof s !== 'string') return '';
        if (!NEEDS_NORM_RE.test(s)) return s;
        return s.replace(/\s+/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').trim();
    }

    function lookup(s) {
        if (!s) return null;
        const n = norm(s);
        if (!n) return null;
        // 用 has 显式区分"未命中"与"空串译值"：品牌隐藏（--brand-title hidden）模式注入空译值，
        // 不能被真值判断吞掉，否则隐藏功能在运行期整体失效
        if (map.has(n)) return map.get(n);
        const lower = n.toLowerCase();
        if (lowerMap.has(lower)) return lowerMap.get(lower);
        return null;
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

    // 时间段换算：把 "2 hours 30 minutes" 之类的英文时长统一换算为中文（供刷新倒计时与额度提示共用）
    function translateTimeSpan(timeStr) {
        return String(timeStr || '').trim()
            .replace(/(\d+)\s*days?/gi, '$1 天')
            .replace(/(\d+)\s*hours?/gi, '$1 小时')
            .replace(/(\d+)\s*minutes?/gi, '$1 分钟')
            .replace(/(\d+)\s*seconds?/gi, '$1 秒')
            .replace(/,\s*/g, ' ')
            .replace(/\s+/g, ' ');
    }

    // 相对时间单位 → 中文（不含尾部"前"字）：统一紧凑形式 (s/m/h/…) 与完整单词 (seconds/…) 两套映射
    function agoUnitCn(unit) {
        const u = String(unit || '').toLowerCase();
        if (u === 's' || u.startsWith('second')) return '秒';
        if (u === 'm' || u.startsWith('minute')) return '分钟';
        if (u === 'h' || u.startsWith('hour')) return '小时';
        if (u === 'd' || u.startsWith('day')) return '天';
        if (u === 'w' || u.startsWith('week')) return '周';
        if (u === 'mo' || u.startsWith('month')) return '个月';
        if (u === 'yr' || u.startsWith('year')) return '年';
        return '';
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
        const items = listStr.split(/,\s+(?=\d)/);
        return items.map(s => translateCountItem(s.trim())).join('、');
    }

    // 动词 + 计数列表摘要：统一处理结尾 " Working..." 运行态、剥离后换算计数并按完成/进行态组装
    // （供 Ran / Checked / Killed 三个支路共用，避免同一段逻辑复制三份）
    function verbCountPhrase(body, donePrefix, doingPrefix, workingSuffix) {
        const isWorking = / Working\.\.\.$/i.test(body);
        const cleanBody = body.replace(/ Working\.\.\.$/i, '');
        const trans = translateCountList(cleanBody);
        return (isWorking ? doingPrefix : donePrefix) + trans + (isWorking ? workingSuffix : "");
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
        const match = val.match(/^(.+?)\s*\((Ctrl|Cmd|Alt|Shift|⌘|⌥|⇧|⌃)\+?([^)]*)\)$/i);
        if (match) {
            const transPref = lookup(match[1]);
            if (transPref) return transPref + " (" + match[2] + (match[3] ? "+" + match[3] : "") + ")";
        }
        const countMatch = val.match(/^(.+?)\s*\(([0-9]+)\)$/);
        if (countMatch) {
            const transPref = lookup(countMatch[1]);
            if (transPref) return transPref + " (" + countMatch[2] + ")";
        }
        // 单字母缩写后缀：如 "Medium (M)" / "Low (L)" / "High (H)"
        const letterMatch = val.match(/^(.+?)\s*\(([A-Za-z]{1,2})\)$/);
        if (letterMatch) {
            const transPref = lookup(letterMatch[1]);
            if (transPref) return transPref + " (" + letterMatch[2] + ")";
        }
        const symbolMatch = val.match(/^([+•*>-])\s+(.+)$/);
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

    // 安全门禁：判断是否属于 AI 长句正文或英文段落（防止宽泛动态正则暴力改写 AI 输出）
    function isLongProse(s) {
        if (!s || typeof s !== 'string') return false;
        if (s.length > 70) return true;
        const spaces = (s.match(/ /g) || []).length;
        if (spaces > 6) return true;
        return false;
    }

    // 动态句式规则表：每条规则含 words（可分派首词集合）与 run 执行器（返回译文或 null 表示未命中）。
    // generic: true 的规则可匹配非字母开头（数字/符号/通配前缀）的字符串，参与无首词分派；
    // 声明顺序即匹配优先级，分派时词桶与通用规则按全局序号归并，语义与顺序 if 链完全一致。
    const DYNAMIC_RULES = [
        {
            words: ['refreshes'],
            run(v) {
                if (/^Refreshes in (.+?)$/i.test(v)) {
                    return v.replace(/^Refreshes in (.+?)$/i, (match, timeStr) => {
                        return translateTimeSpan(timeStr) + "后刷新";
                    });
                }
                return null;
            }
        },
        {
            words: ['you'],
            run(v) {
                if (/^You have used some of your (.+?) limit, it will fully refresh in (.+?)\.?$/i.test(v)) {
                    return v.replace(/^You have used some of your (.+?) limit, it will fully refresh in (.+?)\.?$/i, (match, limitType, timeStr) => {
                        let lType = limitType.trim().toLowerCase();
                        let lTrans = limitType.trim();
                        if (lType === 'weekly') lTrans = '每周';
                        else if (lType === 'daily') lTrans = '每日';
                        else if (lType === 'monthly') lTrans = '每月';
                        else if (lType.includes('5-hour') || lType.includes('5 hour')) lTrans = '5 小时';
                        else {
                            lTrans = lType.replace(/(\d+)-hour/g, '$1 小时').replace(/(\d+)\s*hours?/g, '$1 小时');
                        }
                        const tTrans = translateTimeSpan(timeStr);
                        let prefix = "您已使用了部分";
                        if (lTrans === "每周" || lTrans === "每日" || lTrans === "每月") prefix += lTrans;
                        else prefix += " " + lTrans;
                        return prefix + "限制，将在 " + tTrans + "后完全刷新。";
                    });
                }
                return null;
            }
        },
        {
            words: ['learn'],
            run(v) {
                if (/^Learn more about (.+)$/i.test(v) && !isLongProse(v)) {
                    return v.replace(/^Learn more about (.+)$/i, (match, p) => {
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
                return null;
            }
        },
        {
            words: ['timed'],
            run(v) {
                if (/^Timed\s+(\d+)\s*(seconds?|minutes?|hours?|s|mins?|hrs?|ms)$/i.test(v)) {
                    return v.replace(/^Timed\s+(\d+)\s*(seconds?|minutes?|hours?|s|mins?|hrs?|ms)$/i, (m, num, unit) => {
                        let uCn = '秒';
                        const uLower = unit.toLowerCase();
                        if (uLower.startsWith('m') && !uLower.startsWith('ms')) uCn = '分钟';
                        else if (uLower.startsWith('h')) uCn = '小时';
                        else if (uLower === 'ms') uCn = '毫秒';
                        return '计时 ' + num + ' ' + uCn;
                    });
                }
                return null;
            }
        },
        {
            words: ['status'],
            run(v) {
                if (/^Status:\s*(.+)$/i.test(v) && !isLongProse(v)) {
                    return v.replace(/^Status:\s*(.+)$/i, (m, st) => {
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
                return null;
            }
        },
        {
            words: ['the'],
            run(v) {
                if (/^The command exited with code\s+(\d+)(?:\.\s*Output:\s*(.*))?$/i.test(v)) {
                    return v.replace(/^The command exited with code\s+(\d+)(?:\.\s*Output:\s*(.*))?$/i, (m, code, out) => {
                        if (out !== undefined) return '命令已退出，退出码 ' + code + '。输出：' + out;
                        return '命令已退出，退出码 ' + code;
                    });
                }
                return null;
            }
        },
        {
            words: null,
            run(v) {
                if (/^(.+?)\s+finished$/i.test(v) && !isLongProse(v)) {
                    return v.replace(/^(.+?)\s+finished$/i, (m, prefix) => {
                        const pCn = lookup(prefix) || prefix;
                        return pCn + ' 已完成';
                    });
                }
                return null;
            }
        },
        {
            // 可选 Commit 前缀：既能匹配 "Commit N file changes..."（首词 commit），也能匹配 "N file changes..."（数字开头）
            words: ['commit'],
            generic: true,
            run(v) {
                if (/^(?:Commit\s+)?(\d+)\s+file\s+changes\s+to(?:\s+(.*))?$/i.test(v)) {
                    return v.replace(/^(?:Commit\s+)?(\d+)\s+file\s+changes\s+to(?:\s+(.*))?$/i, (m, count, branch) => {
                        if (branch) return '提交 ' + count + ' 个文件更改至 ' + branch;
                        return '提交 ' + count + ' 个文件更改至';
                    });
                }
                return null;
            }
        },
        {
            words: ['file'],
            run(v) {
                if (/^file\s+changes\s+to(?:\s+(.*))?$/i.test(v)) {
                    return v.replace(/^file\s+changes\s+to(?:\s+(.*))?$/i, (m, branch) => {
                        if (branch) return '个文件更改至 ' + branch;
                        return '个文件更改至';
                    });
                }
                return null;
            }
        },
        {
            // 上下文依赖分支：独立 "to" 文本节点按父级 git 上下文翻译
            words: ['to'],
            run(v, o, n) {
                if (v.toLowerCase() === 'to' && n && n.parentElement) {
                    const pText = n.parentElement.textContent || '';
                    if (/master|main|branch|changes|commit|更改|提交/i.test(pText)) {
                        return (o || 'to').replace(/\bto\b/i, '至');
                    }
                }
                return null;
            }
        },
        {
            words: ['inherits'],
            run(v) {
                if (/^Inherits your (.+?) settings(.*)$/i.test(v)) {
                    return v.replace(/^Inherits your (.+?) settings(.*)$/i, (match, cat, rest) => {
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
                }
                return null;
            }
        },
        {
            words: null,
            run(v) {
                if (/^(\d+)% of the customization budget is available\.?$/i.test(v)) {
                    return v.replace(/^(\d+)% of the customization budget is available\.?$/i, '$1% 的定制预算可用。');
                }
                return null;
            }
        },
        {
            words: ['send'],
            run(v) {
                if (/^Send feedback as (.+)$/i.test(v)) {
                    return v.replace(/^Send feedback as (.+)$/i, '以 $1 身份发送反馈');
                }
                return null;
            }
        },
        {
            words: ['your'],
            run(v) {
                if (/^Your Plan:\s*(.+)$/i.test(v)) {
                    return v.replace(/^Your Plan:\s*(.+)$/i, '您的计划：$1');
                }
                return null;
            }
        },
        {
            // 合并：Yes, and always allow '...' (含可选 in this project)
            words: ['yes'],
            run(v) {
                if (/^Yes, and always allow '(.+?)'( in this project)?$/i.test(v)) {
                    return v.replace(/^Yes, and always allow '(.+?)'( in this project)?$/i, (match, cmd, inProj) => {
                        return "是，且" + (inProj ? "在此项目中始终允许运行 '" : "始终允许运行 '") + cmd + "'";
                    });
                }
                return null;
            }
        },
        {
            words: null,
            run(v) {
                if (/^(\d+) tools? enabled$/i.test(v)) {
                    return v.replace(/^(\d+) tools? enabled$/i, '$1 个工具已启用');
                }
                return null;
            }
        },
        {
            words: ['show'],
            run(v) {
                if (/^Show (\d+) more(\.\.\.|…)?$/i.test(v)) {
                    return v.replace(/^Show (\d+) more(\.\.\.|…)?$/i, '显示另外 $1 个...');
                }
                return null;
            }
        },
        {
            // 合并：Show / Hide (all) N breakdowns
            words: ['show', 'hide'],
            run(v) {
                if (/^(Show|Hide)(?:\s+(all))?\s+(\d+)\s+breakdowns?$/i.test(v)) {
                    return v.replace(/^(Show|Hide)(?:\s+(all))?\s+(\d+)\s+breakdowns?$/i, (match, action, all, num) => {
                        const isShow = action.toLowerCase() === 'show';
                        return (isShow ? '显示' : '隐藏') + (all ? '全部 ' : ' ') + num + ' 个细目';
                    });
                }
                return null;
            }
        },
        {
            words: ['rules', 'skills'],
            run(v) {
                if (/^(Rules|Skills):\s*([\d,]+)\s*tokens$/i.test(v)) {
                    return v.replace(/^(Rules|Skills):\s*([\d,]+)\s*tokens$/i, (m, type, num) => {
                        const t = type.toLowerCase() === 'rules' ? '规则' : '技能';
                        return t + '：' + num + ' tokens';
                    });
                }
                return null;
            }
        },
        {
            words: ['media'],
            run(v) {
                if (/^Media \((Today|Yesterday)\s+(\d{1,2}:\d{2})\s*(AM|PM)?\)$/i.test(v)) {
                    return v.replace(/^Media \((Today|Yesterday)\s+(\d{1,2}:\d{2})\s*(AM|PM)?\)$/i, (m, day, time, ap) => {
                        const d = day.toLowerCase() === 'today' ? '今天' : '昨天';
                        return '媒体 (' + d + ' ' + time + (ap ? ' ' + ap : '') + ')';
                    });
                }
                return null;
            }
        },
        {
            words: ['select'],
            run(v) {
                if (/^Select model, current: (.+)$/i.test(v)) {
                    return v.replace(/^Select model, current: (.+)$/i, '选择模型，当前：$1');
                }
                return null;
            }
        },
        {
            words: ['refresh'],
            run(v) {
                if (/^Refresh (MCP servers|quota and credits data)$/i.test(v)) {
                    return v.replace(/^Refresh (MCP servers|quota and credits data)$/i, (m, t) => {
                        if (t.toLowerCase() === 'mcp servers') return '刷新 MCP 服务器';
                        return '刷新配额与额度数据';
                    });
                }
                return null;
            }
        },
        {
            words: ['skills'],
            run(v) {
                if (/^Skills providing tailored instructions for happy path (.+?) development workflows\.?$/i.test(v)) {
                    return v.replace(/^Skills providing tailored instructions for happy path (.+?) development workflows\.?$/i, (match, lang) => {
                        let translatedLang = lang;
                        if (lang.toLowerCase() === 'dart and flutter') translatedLang = "Dart 和 Flutter";
                        return "提供为 " + translatedLang + " 的顺畅 (Happy Path) 开发流程量身定制的技能指令。";
                    });
                }
                return null;
            }
        },
        {
            words: ['worked', 'working'],
            run(v) {
                if (/^(Worked|Working) for (\d+)(s|m|h|d|w|mo|yr)?$/i.test(v)) {
                    return v.replace(/^(Worked|Working) for (\d+)(s|m|h|d|w|mo|yr)?$/i, (match, verb, num, unit) => {
                        return "已工作 " + num + " " + unitToCn(unit);
                    });
                }
                return null;
            }
        },
        {
            words: ['thinking'],
            run(v) {
                if (/^Thinking \(?(\d+)(s|m|h|d|w|mo|yr)?\)?(\.{1,3}|…)?$/i.test(v)) {
                    return v.replace(/^Thinking \(?(\d+)(s|m|h|d|w|mo|yr)?\)?(\.{1,3}|…)?$/i, (match, num, unit, dots) => {
                        return "思考中 (" + num + " " + unitToCn(unit) + ")" + (dots || "…");
                    });
                }
                return null;
            }
        },
        {
            words: ['waiting'],
            run(v) {
                if (/^Waiting for (.+?)(\.{1,3}|…)?$/i.test(v)) {
                    return v.replace(/^Waiting for (.+?)(\.{1,3}|…)?$/i, (match, target, dots) => {
                        let t = target.trim().toLowerCase();
                        let trans = target;
                        if (t === 'input') trans = "输入";
                        else if (t === 'user') trans = "用户";
                        else if (t === 'tool' || t === 'tools') trans = "工具";
                        else if (t === 'agent' || t === 'agents') trans = "智能体";
                        return "等待 " + trans + " 中...";
                    });
                }
                return null;
            }
        },
        {
            words: ['thinking'],
            run(v) {
                if (/^Thinking for (\d+)(s|m|h|d|w|mo|yr)?(\.{0,3}|…)?$/i.test(v)) {
                    return v.replace(/^Thinking for (\d+)(s|m|h|d|w|mo|yr)?(\.{0,3}|…)?$/i, (match, num, unit, dots) => {
                        return "已思考 " + num + " " + unitToCn(unit) + (dots || "");
                    });
                }
                return null;
            }
        },
        {
            words: ['running'],
            run(v) {
                if (/^Running for (\d+)(s|m|h|d|w|mo|yr)?$/i.test(v)) {
                    return v.replace(/^Running for (\d+)(s|m|h|d|w|mo|yr)?$/i, (match, num, unit) => {
                        return "已运行 " + num + " " + unitToCn(unit);
                    });
                }
                return null;
            }
        },
        {
            words: ['executing'],
            run(v) {
                if (/^Executing for (\d+)(s|m|h|d|w|mo|yr)?$/i.test(v)) {
                    return v.replace(/^Executing for (\d+)(s|m|h|d|w|mo|yr)?$/i, (match, num, unit) => {
                        return "已执行 " + num + " " + unitToCn(unit);
                    });
                }
                return null;
            }
        },
        {
            words: ['thought'],
            run(v) {
                if (/^Thought for (\d+)(s|m+h)?$/i.test(v)) {
                    return v.replace(/^Thought for (\d+)(s|m+h)?$/i, (match, num, unit) => {
                        return "思考了 " + num + " " + unitToCn(unit);
                    });
                }
                return null;
            }
        },
        {
            words: ['ran', 'running'],
            run(v) {
                if (/^(?:Ran|Running)\s+(\d+)\s+commands?$/i.test(v)) {
                    return v.replace(/^(Ran|Running)\s+(\d+)\s+commands?$/i, (m, verb, num) => {
                        return (verb.toLowerCase() === 'running' ? "正在运行 " : "已运行 ") + num + " 条命令";
                    });
                }
                return null;
            }
        },
        {
            words: ['ran'],
            run(v) {
                if (/^Ran\s+(.+)$/i.test(v) && !isLongProse(v)) {
                    return v.replace(/^Ran\s+(.+)$/i, (match, prefix) => {
                        return verbCountPhrase(prefix, "已执行 ", "正在执行 ", " 正在处理...");
                    });
                }
                return null;
            }
        },
        {
            words: ['searched'],
            run(v) {
                if (/^Searched\s+(.+)$/i.test(v) && !isLongProse(v)) {
                    return v.replace(/^Searched\s+(.+)$/i, (match, body) => {
                        let res = body.replace(/(\d+)\s+results?/i, '$1 个结果');
                        const countList = translateCountList(res);
                        return "已搜索 " + (countList !== res ? countList : res);
                    });
                }
                return null;
            }
        },
        {
            // 任务状态动词：14 个分支统一合并
            words: ['checked', 'checking', 'killed', 'killing', 'started', 'starting', 'paused', 'pausing', 'resumed', 'resuming', 'created', 'creating', 'sent', 'sending'],
            run(v) {
                const taskVerbMatch = v.match(/^(Checked|Checking|Killed|Killing|Started|Starting|Paused|Pausing|Resumed|Resuming|Created|Creating|Sent input to|Sending input to)\s+task\s+(.+)$/i);
                if (taskVerbMatch && !isLongProse(v)) {
                    const actionKey = taskVerbMatch[1].toLowerCase();
                    const prefix = TASK_VERB_ACTIONS[actionKey] || (taskVerbMatch[1] + ' task ');
                    return prefix + translateTaskTarget(taskVerbMatch[2]);
                }
                return null;
            }
        },
        {
            words: ['checked'],
            run(v) {
                if (/^Checked (.+)$/i.test(v) && !isLongProse(v)) {
                    return v.replace(/^Checked (.+)$/i, (match, prefix) => {
                        return verbCountPhrase(prefix, "已检查 ", "正在检查 ", "...");
                    });
                }
                return null;
            }
        },
        {
            words: ['checking'],
            run(v) {
                if (/^Checking (.+)$/i.test(v) && !isLongProse(v)) {
                    return v.replace(/^Checking (.+)$/i, (match, prefix) => {
                        return "正在检查 " + translateCountList(prefix);
                    });
                }
                return null;
            }
        },
        {
            words: ['killed'],
            run(v) {
                if (/^Killed (.+)$/i.test(v) && !isLongProse(v)) {
                    return v.replace(/^Killed (.+)$/i, (match, prefix) => {
                        return verbCountPhrase(prefix, "已终止 ", "正在终止 ", "...");
                    });
                }
                return null;
            }
        },
        {
            words: ['killing'],
            run(v) {
                if (/^Killing (.+)$/i.test(v) && !isLongProse(v)) {
                    return v.replace(/^Killing (.+)$/i, (match, prefix) => {
                        return "正在终止 " + translateCountList(prefix);
                    });
                }
                return null;
            }
        },
        {
            words: ['run'],
            run(v) {
                if (/^Run (.+)$/i.test(v) && !isLongProse(v)) {
                    return v.replace(/^Run (.+)$/i, (match, prefix) => {
                        if (/^command finished$/i.test(prefix)) return "命令执行完成";
                        if (/^task finished$/i.test(prefix)) return "任务执行完成";
                        let trans = translateCountList(prefix);
                        if (trans !== prefix) return "运行 " + trans;
                        return "运行 " + translateTaskTarget(prefix);
                    });
                }
                return null;
            }
        },
        {
            words: ['load'],
            run(v) {
                if (/^Load older messages, showing (\d+) of (\d+)$/i.test(v)) {
                    return v.replace(/^Load older messages, showing (\d+) of (\d+)$/i, '加载更早的消息，当前显示 $1 / $2');
                }
                return null;
            }
        },
        {
            words: null,
            run(v) {
                if (/^(\d+) files? changed(\s*\+\d+\s*-\d+)?$/i.test(v)) {
                    return v.replace(/^(\d+) files? changed(\s*\+\d+\s*-\d+)?$/i, (match, num, diff) => {
                        return num + " 个文件已改动" + (diff || "");
                    });
                }
                return null;
            }
        },
        {
            // 合并：subagents / tasks running
            words: null,
            run(v) {
                const subagentsMatch = v.match(/^(\d+)\s+(subagents?\/tasks?|subagents?|tasks?)\s+running$/i);
                if (subagentsMatch) {
                    const num = subagentsMatch[1];
                    const targetType = subagentsMatch[2].toLowerCase();
                    let typeCn = '个任务';
                    if (targetType.startsWith('subagent') && targetType.includes('/')) typeCn = '个子智能体/任务';
                    else if (targetType.startsWith('subagent')) typeCn = '个子智能体';
                    return num + ' ' + typeCn + '正在运行';
                }
                return null;
            }
        },
        {
            words: null,
            run(v) {
                if (/^([\d,.]+\s+[a-zA-Z\s]+)(?:,\s*[\d,.]+\s+[a-zA-Z\s]+)*$/i.test(v)) {
                    const trans = translateCountList(v);
                    if (trans !== v) return trans;
                }
                return null;
            }
        },
        {
            words: null,
            run(v) {
                if (/^\+(\d+)\s+more\s+lines?$/i.test(v)) {
                    return v.replace(/^\+(\d+)\s+more\s+lines?$/i, '+$1 行');
                }
                return null;
            }
        },
        {
            words: ['showing'],
            run(v) {
                if (/^Showing\s+(\d+)\s+lines?$/i.test(v)) {
                    return v.replace(/^Showing\s+(\d+)\s+lines?$/i, '显示 $1 行');
                }
                return null;
            }
        },
        {
            words: ['permanently'],
            run(v) {
                if (/^Permanently delete (.+?), including (\d+) active conversations?\.?$/i.test(v)) {
                    return v.replace(/^Permanently delete (.+?), including (\d+) active conversations?\.?$/i, '永久删除 $1，包含 $2 个活跃会话。');
                }
                return null;
            }
        },
        {
            words: ['including'],
            run(v) {
                if (/^including (\d+) active conversations?\.?$/i.test(v)) {
                    return v.replace(/^including (\d+) active conversations?\.?$/i, "包含 $1 个活跃会话。");
                }
                return null;
            }
        },
        {
            words: ['all'],
            run(v) {
                if (/^All changes since (.+)$/i.test(v)) {
                    return v.replace(/^All changes since (.+)$/i, '自 $1 以来的所有更改');
                }
                return null;
            }
        },
        {
            words: ['all'],
            run(v) {
                if (/^All\s+(?:scheduled tasks?|automations?)\s+run\s+as\s+(.+?)\.?$/i.test(v)) {
                    return v.replace(/^All\s+(?:scheduled tasks?|automations?)\s+run\s+as\s+(.+?)\.?$/i, '所有计划任务均以 $1 模型运行。');
                }
                return null;
            }
        },
        {
            words: ['a'],
            run(v) {
                if (/^A\s+(?:scheduled task|automation)\s+with\s+ID\s+(.+?)\s+already\s+exists\.?$/i.test(v)) {
                    return v.replace(/^A\s+(?:scheduled task|automation)\s+with\s+ID\s+(.+?)\s+already\s+exists\.?$/i, 'ID 为 $1 的任务已存在。');
                }
                return null;
            }
        },
        {
            words: ['see'],
            run(v) {
                if (/^See all \((\d+)\)$/i.test(v)) {
                    return v.replace(/^See all \((\d+)\)$/i, '显示全部 ($1)');
                }
                return null;
            }
        },
        {
            words: ['available'],
            run(v) {
                if (/^Available AI Credits: (\d+)$/i.test(v)) {
                    return v.replace(/^Available AI Credits: (\d+)$/i, '可用 AI 额度: $1');
                }
                return null;
            }
        },
        {
            words: ['version'],
            run(v) {
                if (/^Version\s+([\d.]+)$/i.test(v)) {
                    return v.replace(/^Version\s+([\d.]+)$/i, '版本 $1');
                }
                return null;
            }
        },
        {
            words: null,
            run(v) {
                if (/^(\d+)(s|m|h|d|w|mo|yr)$/i.test(v)) {
                    return v.replace(/^(\d+)(s|m|h|d|w|mo|yr)$/i, (match, num, unit) => {
                        return num + agoUnitCn(unit) + "前";
                    });
                }
                return null;
            }
        },
        {
            // 完整时间戳句式："3 hours ago" / "1 minute ago"（单节点形态；客户端拆分渲染时由字典分片键兜底）
            words: null,
            run(v) {
                if (/^(\d+)\s+(seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s+ago$/i.test(v)) {
                    return v.replace(/^(\d+)\s+(seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s+ago$/i, (m, num, unit) => {
                        return num + " " + agoUnitCn(unit) + "前";
                    });
                }
                return null;
            }
        },
        {
            words: ['are'],
            run(v) {
                if (/^Are you sure you want to delete (the |this )?(project group|project|workspace)?\s*(.+?)\??$/i.test(v)) {
                    return v.replace(/^Are you sure you want to delete (the |this )?(project group|project|workspace)?\s*(.+?)\??$/i, (match, article, type, name) => {
                        let typeStr = "";
                        if (type) {
                            const tLower = type.toLowerCase().trim();
                            if (tLower.includes('group')) typeStr = "项目分组";
                            else if (tLower === 'workspace') typeStr = "工作区";
                            else if (tLower === 'project') typeStr = "项目";
                        }
                        let artStr = "";
                        if (article) {
                            artStr = article.toLowerCase().startsWith('this') ? "此" : "该";
                        }
                        const prefixTarget = artStr + typeStr;
                        // 清洗结尾问号吞噬：裸类型句式（如 "…delete this project?"）中 "?" 会被 (.+?)\??$ 吞进名称捕获
                        const cleanName = String(name || '').replace(/\?+$/, '').trim();
                        return "您确定要删除" + prefixTarget + (cleanName ? " " + cleanName : "") + (cleanName ? " 吗？" : "吗？");
                    });
                }
                return null;
            }
        },
        {
            words: ['this'],
            run(v) {
                if (/^This will permanently delete (\d+) active conversations? within it\.?$/i.test(v)) {
                    return v.replace(/^This will permanently delete (\d+) active conversations? within it\.?$/i, '此操作将永久删除其中的 $1 个活跃会话。');
                }
                return null;
            }
        },
        {
            words: ['this'],
            run(v) {
                if (/^This will permanently delete (.+?) within it\.?$/i.test(v)) {
                    return v.replace(/^This will permanently delete (.+?) within it\.?$/i, '此操作将永久删除其中的 $1。');
                }
                return null;
            }
        },
        {
            words: null,
            run(v) {
                if (/^(.+?): context deadline exceeded$/i.test(v)) {
                    return v.replace(/^(.+?): context deadline exceeded$/i, '$1: 请求超时 (context deadline exceeded)');
                }
                return null;
            }
        },
        {
            words: null,
            run(v) {
                if (/^(.+?): i\/o timeout$/i.test(v)) {
                    return v.replace(/^(.+?): i\/o timeout$/i, '$1: I/O 超时 (i/o timeout)');
                }
                return null;
            }
        },
        {
            words: ['updated'],
            run(v) {
                if (/^Updated (.+)$/i.test(v) && !isLongProse(v)) {
                    return v.replace(/^Updated (.+)$/i, '更新于 $1');
                }
                return null;
            }
        },
        // 动态属性与控件正则
        {
            words: ['plugin'],
            run(v) {
                if (/^Plugin:\s*(.+)$/i.test(v)) {
                    return v.replace(/^Plugin:\s*(.+)$/i, '插件：$1');
                }
                return null;
            }
        },
        {
            words: ['toggle'],
            run(v) {
                if (/^Toggle\s+(.+)$/i.test(v)) {
                    return v.replace(/^Toggle\s+(.+)$/i, '切换 $1');
                }
                return null;
            }
        },
        {
            words: ['enter'],
            run(v) {
                if (/^Enter\s+(.+?)\s+name\.\.\.$/i.test(v)) {
                    return v.replace(/^Enter\s+(.+?)\s+name\.\.\.$/i, (m, name) => {
                        const nameCn = name === 'scheduled task' ? '计划任务' : (name === 'automation' ? '自动化' : name);
                        return '输入' + nameCn + '名称...';
                    });
                }
                return null;
            }
        },
        {
            words: ['enter'],
            run(v) {
                if (/^Enter a prompt for the agent to run\.\.\.$/i.test(v)) {
                    return '输入供智能体执行的提示词...';
                }
                return null;
            }
        }
    ];

    // 全局序号即原声明顺序；词桶与通用规则按序号归并后与顺序 if 链的匹配优先级完全一致
    for (let i = 0; i < DYNAMIC_RULES.length; i++) DYNAMIC_RULES[i].seq = i;
    const GENERIC_DYNAMIC_RULES = DYNAMIC_RULES.filter(r => !r.words || r.generic);
    const WORD_DYNAMIC_RULES = new Map();
    for (const rule of DYNAMIC_RULES) {
        if (!rule.words) continue;
        for (const w of rule.words) {
            if (!WORD_DYNAMIC_RULES.has(w)) WORD_DYNAMIC_RULES.set(w, []);
            WORD_DYNAMIC_RULES.get(w).push(rule);
        }
    }
    // 分派缓存：每个首词只需归并一次，运行期直接命中已排序列表
    const DYNAMIC_DISPATCH_CACHE = new Map();
    function dynamicRulesFor(firstWord) {
        if (!firstWord) return GENERIC_DYNAMIC_RULES;
        let merged = DYNAMIC_DISPATCH_CACHE.get(firstWord);
        if (!merged) {
            const wordRules = WORD_DYNAMIC_RULES.get(firstWord) || [];
            merged = wordRules.concat(GENERIC_DYNAMIC_RULES).sort((a, b) => a.seq - b.seq);
            DYNAMIC_DISPATCH_CACHE.set(firstWord, merged);
        }
        return merged;
    }

    // 动态句式翻译器：按首词分派候选规则集。仅未命中字典的字符串会到达此处，
    // 分派把 50+ 个顺序正则的逐条尝试缩减为常数条（词桶 + 通用规则）。
    function translateDynamicText(valNorm, originalVal, node) {
        const firstWordMatch = /^[A-Za-z]+/.exec(valNorm);
        const rules = dynamicRulesFor(firstWordMatch ? firstWordMatch[0].toLowerCase() : null);
        for (const rule of rules) {
            const result = rule.run(valNorm, originalVal, node);
            if (result !== null && result !== undefined) return result;
        }
        return null;
    }

    // 通用底层字符串翻译入口（文本节点与元素属性共用）
    function translateString(text, node) {
        if (!text || typeof text !== 'string') return null;
        const valNorm = norm(text);
        if (!valNorm) return null;
        // 字典精确命中优先于快捷键正则剥离：绝大多数字符串为字典键，
        // O(1) 查表前置可跳过 4 个快捷键正则（已核查字典唯一可双命中的
        // "Previous match (Shift+Enter)" 其快捷键支路因裸键缺失必然返回 null，调换零行为差异）
        const exactTrans = lookup(valNorm);
        if (exactTrans !== null) return exactTrans;
        const shortcutTrans = translateWithShortcut(valNorm);
        if (shortcutTrans) return shortcutTrans;
        const dynamicTrans = translateDynamicText(valNorm, text, node);
        if (dynamicTrans && dynamicTrans !== valNorm) return dynamicTrans;
        return null;
    }


    // 文本物理特征与代码语法防御：识别路径、网址、扩展名、UUID/Hash、CLI 参数与代码调用，一律保持原样
    function isCodeLikeText(valNorm) {
        if (/^(https?:\/\/|[a-zA-Z]:[\\/]|[\\/][a-zA-Z0-9_.-]|\.[\\/]|\.\.[\\/])/.test(valNorm)) return true;
        if (/^[a-zA-Z0-9_\-.]+\.(js|ts|jsx|tsx|json|py|go|rs|cpp|c|h|hpp|java|kt|dart|html|css|scss|md|mdx|yaml|yml|toml|xml|sql|sh|bat|ps1|asar|exe|dll|zip|tar|gz|png|jpg|svg|ico|txt|log|env)$/i.test(valNorm)) return true;
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valNorm)) return true;
        if (/^[0-9a-f]{7,40}$/i.test(valNorm)) return true;
        if (/^--?[a-zA-Z0-9_-]+(=.*)?$/.test(valNorm)) return true;
        // 纯代码语法特征过滤：放行动作步骤标题（如 Ran node ...），跳过代码调用特征
        if (!/^(Ran|Running|Explored|Analyzed|Searched|Edited|Thought for|Worked for|Checked|Killed|Starting|Started|Timed|Status|The command exited|Verify|Commit)\b/i.test(valNorm)) {
            if (/[a-zA-Z0-9_$]+\.[a-zA-Z0-9_$]+\(/.test(valNorm) || /^[a-zA-Z0-9_$]+\(.*\)$/.test(valNorm)) return true;
        }
        return false;
    }

    // 复合标题分段翻译：按破折号/连字符拆分为前后两段分别翻译后重组（如 "New chat — Antigravity"）
    function translateCompoundTitle(title, translatePart) {
        const valNorm = norm(title);
        if (!valNorm) return null;
        const compoundMatch = valNorm.match(/^(.+?)\s*([—–-])\s*(.+)$/);
        if (!compoundMatch) return null;
        const prefix = compoundMatch[1].trim();
        const sep = compoundMatch[2];
        const suffix = compoundMatch[3].trim();
        const prefixCn = translatePart(prefix);
        const suffixCn = translatePart(suffix);
        if (prefixCn !== prefix || suffixCn !== suffix) {
            // 任一段译值为空串（品牌隐藏模式）：直接退化为另一段，避免残留悬挂分隔符
            if (prefixCn === '' || suffixCn === '') {
                return prefixCn === '' ? suffixCn : prefixCn;
            }
            return prefixCn + ' ' + sep + ' ' + suffixCn;
        }
        return null;
    }

