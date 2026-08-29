# antigravity_cn_test — Antigravity 中文汉化工具

通过修改 Antigravity 桌面客户端（Electron 应用）安装目录中的 `app.asar`，注入全局 i18n 引擎实现中文化；支持一键还原官方英文。

## 使用（双击即可）

| 脚本 | 作用 |
| --- | --- |
| `双击安装中文汉化.bat` | 安装/更新汉化。可选左上角品牌显示：[1] 英文 Antigravity / [2] 隐藏 / [3] 中文品牌名 |
| `双击卸载还原官方英文.bat` | 用官方备份 `app.asar.bak` 还原原版 |
| `维护工具.bat` | 字典与漏译维护菜单（见下） |

安装会自动探测安装目录（可用 `--install-dir` 指定），安装前自动关闭客户端、完成后自动重启。全程日志写入 `_install_log.txt`。

## 架构（三层）

- **引擎 `localization_engine.js`**（唯一核心）：
  - 渲染进程引擎 `generateJs()` → 注入 `preload.js`，MutationObserver 驱动的 DOM 实时翻译；三级边界：禁区熔断（代码/终端/用户输入）→ AI 流式正文熔断 → 交互控件与常规 UI 放行；含动态句式正则、Shadow DOM、元素属性（placeholder/title/aria-label）翻译与漏译采集（`window.__AG_DUMP_MISSING__()`）。动词步骤摘要（Explored/Analyzed 等）**不设整句支路**——字典动作词精确匹配 + 分片计数是唯一机制，避免双重翻译。
  - 主进程拦截 `generateI18nCoreJs()` → 写入 `antigravity_i18n_core.js`，hook 原生菜单/托盘/对话框/通知（动态文案以渲染层为权威实现，core 仅覆盖静态文案与少量高频句式）。
  - 安装/还原 `install20()` / `restore20()`：解包 → 内容级状态判定（clean/legacy/new）→ 官方备份保护 → 注入 main.js + preload.js → 重打包 → 完整性校验。
- **字典 `dicts/*.json`**：`英文原文 → 中文`，安装时合并为一张表（key 做空白/引号归一化，未命中再走小写兜底）。
- **维护脚本 `scratch/`**：见下表。

## 维护工具菜单对应脚本

| 菜单 | 脚本 | 说明 |
| --- | --- | --- |
| 采集漏译清单 | `dump_missing.js` | CDP 连接运行中的客户端，扫描当前页面漏译 |
| 校验字典 | `dict_check.js` | 跨文件冲突、空值 |
| 检查字典质量 | `dict_quality_check.js` | 归一化重复、identity 键、超长值 |
| 检查主进程文案 | `mainproc_keys_check.js` | 菜单/托盘/对话框字典覆盖 |
| 活体验证 | `verify_fix_live.js` | 不重装，把新引擎注入活页面验证 |
| 同类翻译检查 | `enum_group_check.js` | 枚举组（低中高/状态等）半翻译检查 |
| 回归测试 | `engine_fix_test.js` | 转义扫描 + jsdom 真实 DOM 行为 + core 行为 + asar/状态检测/品牌模式/升级清理（100 项） |

## 开发注意

- 引擎渲染层代码在模板字符串内，正则必须双写反斜杠（`\\s`、`\\b`）；`engine_fix_test.js` 第 [0] 段会扫描此类回归。
- 测试依赖 jsdom（`npm i` 安装 devDependencies 后运行 `node scratch/engine_fix_test.js`）。
- 汉化包升级：`install20` 会自动识别旧版多点补丁并清理升级到单点架构。
