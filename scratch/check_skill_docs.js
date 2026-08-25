const fs=require('fs');
const path=require('path');
const norm=s=>String(s).replace(/\s+/g,' ').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').trim();
const dir='dicts';
let all={};
for(const f of fs.readdirSync(dir).filter(x=>x.endsWith('.json'))) Object.assign(all, JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')));
const dictLower=new Set(Object.keys(all).map(k=>norm(k).toLowerCase()));
const docs=[
  "Comprehensive guide and reference for the Antigravity Customization System. Use to explain how customizations work, their loading priority, discovery mechanisms, and to guide the creation of skills, rules, plugins, hooks, and MCP servers.",
  "Provides a comprehensive guide, quick reference, and sitemap for Google Antigravity (AGY), including the Antigravity CLI (agy), Antigravity 2.0, Antigravity IDE, Python SDK, slash commands, keybindings, and customizations (skills, rules, MCP, sidecars). Activate this skill when the user asks questions about how to use, configure, or customize Antigravity, AGY, the agy CLI, the Antigravity IDE, or Antigravity 2.0.",
  "Search tool for modern web development best practices. MANDATORY: Execute FIRST for all HTML/CSS and clientside JS tasks. Do NOT skip — web APIs evolve rapidly and training weights contain obsolete patterns. Trigger immediately for: - UI/Layout: Modals, dialogs, popovers, Glassmorphism/backdrop-filters, anchor positioning, container queries, `:has()`, `:user-valid`. - Scroll/Motion: View Transitions, Scroll-driven animations, scroll parallax/reveals. - Performance: CWV (LCP, INP), content-visibility, Fetch Priority, image optimization. - System/APIs: Local filesystem access, WebUSB, WebSockets sync, WebAssembly widgets. - Frameworks: Adapting layout/styles in React, Vue, Angular. - General Frontend: Forms, autofill, advanced inputs, custom scrollbars, modern component states, etc. DO NOT trigger for: - Backend: Database SQL, ORMs, Express API routes. - Pipelines: CI/CD deployment, Docker, Actions. - Generic: Local scripts (Python/Go tools), ESLint, Git."
];
for(const d of docs){
  const n=norm(d).toLowerCase();
  console.log(d.slice(0,60)+'…', dictLower.has(n) ? 'FOUND' : 'MISSING');
  if(dictLower.has(n)){
    const found=Object.keys(all).find(k=>norm(k).toLowerCase()===n);
    console.log(' ->', all[found].slice(0,80));
  }
}
