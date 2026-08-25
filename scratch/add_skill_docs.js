const fs=require('fs');
const path=require('path');
const file='dicts/common.json';
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const adds={
  "Comprehensive guide and reference for the Antigravity Customization System. Use to explain how customizations work, their loading priority, discovery mechanisms, and to guide the creation of skills, rules, plugins, hooks, and MCP servers.": "Antigravity 定制系统的综合指南与参考，用于解释定制项的工作原理、加载优先级与发现机制，并指导技能、规则、插件、钩子及 MCP 服务器的创建。",
  "Provides a comprehensive guide, quick reference, and sitemap for Google Antigravity (AGY), including the Antigravity CLI (agy), Antigravity 2.0, Antigravity IDE, Python SDK, slash commands, keybindings, and customizations (skills, rules, MCP, sidecars). Activate this skill when the user asks questions about how to use, configure, or customize Antigravity, AGY, the agy CLI, the Antigravity IDE, or Antigravity 2.0.": "为 Google Antigravity (AGY) 提供全面的指南、快速参考和站点地图，涵盖 Antigravity CLI (agy)、Antigravity 2.0、Antigravity IDE、Python SDK、斜杠命令、快捷键及定制化（技能、规则、MCP、侧边栏）。当用户询问如何使用、配置或定制 Antigravity、AGY、agy CLI、Antigravity IDE 或 Antigravity 2.0 时激活此技能。",
  "Search tool for modern web development best practices. MANDATORY: Execute FIRST for all HTML/CSS and clientside JS tasks. Do NOT skip — web APIs evolve rapidly and training weights contain obsolete patterns. Trigger immediately for: - UI/Layout: Modals, dialogs, popovers, Glassmorphism/backdrop-filters, anchor positioning, container queries, `:has()`, `:user-valid`. - Scroll/Motion: View Transitions, Scroll-driven animations, scroll parallax/reveals. - Performance: CWV (LCP, INP), content-visibility, Fetch Priority, image optimization. - System/APIs: Local filesystem access, WebUSB, WebSockets sync, WebAssembly widgets. - Frameworks: Adapting layout/styles in React, Vue, Angular. - General Frontend: Forms, autofill, advanced inputs, custom scrollbars, modern component states, etc. DO NOT trigger for: - Backend: Database SQL, ORMs, Express API routes. - Pipelines: CI/CD deployment, Docker, Actions. - Generic: Local scripts (Python/Go tools), ESLint, Git.": "现代 Web 开发最佳实践的搜索工具。强制要求：所有 HTML/CSS 及客户端 JS 任务必须优先执行。切勿跳过——Web API 演进迅速，训练权重中的模式已过时。立即触发于：- UI/布局：弹窗、对话框、浮层、毛玻璃/背景滤镜、锚点定位、容器查询、`:has()`、`:user-valid`。- 滚动/动效：视图过渡、滚动驱动动画、滚动视差/揭示。- 性能：核心 Web 指标 (LCP, INP)、content-visibility、Fetch Priority、图片优化。- 系统/API：本地文件系统访问、WebUSB、WebSocket 同步、WebAssembly 组件。- 框架：在 React、Vue、Angular 中适配布局/样式。- 通用前端：表单、自动填充、高级输入、自定义滚动条、现代组件状态等。切勿触发于：- 后端：数据库 SQL、ORM、Express API 路由。- 流水线：CI/CD 部署、Docker、Actions。- 通用：本地脚本（Python/Go 工具）、ESLint、Git。"
};
let added=0;
for(const [k,v] of Object.entries(adds)){
  if(!(k in data)){
    data[k]=v;
    added++;
    console.log('added',k.slice(0,60));
  } else {
    console.log('already exists',k.slice(0,60));
  }
}
fs.writeFileSync(file, JSON.stringify(data, null, 4), 'utf8');
console.log(`done added ${added}, total ${Object.keys(data).length}`);
