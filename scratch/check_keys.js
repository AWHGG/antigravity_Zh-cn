const fs=require('fs');
const path=require('path');
const norm=s=>String(s).replace(/\s+/g,' ').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').trim();
const dir='dicts';
let all={};
for(const f of fs.readdirSync(dir).filter(x=>x.endsWith('.json'))) Object.assign(all, JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')));
const keys=[
  'Application',
  'Manage Antigravity app settings.',
  'Remote Control',
  'Enable Remote Control',
  'Work with local agents from another device.',
  'Best of N',
  'Manage how Best of N sets up the workspaces its arms run in.',
  'Inline Actions',
  'Show a floating notification card when background conversations need your input. Answer questions, approve commands, and grant permissions without leaving your current conversation. Share feedback at go/inline-actions-feedback.',
  'No MCP servers installed',
  'Use Add MCP to browse the store, or add a custom server via the MCP config.',
  'Browse and enable plugins from the Build With Google catalog.',
  'Google Chrome',
  'Google3 chats will be regrouped into their workspaces in the sidebar.',
  'This migration may mess up your settings, chats, and sidebar.',
  'to back up your data and run the migration.',
  'Follow the guide at'
];
for(const k of keys){
  const n=norm(k).toLowerCase();
  const found=Object.keys(all).find(x=>norm(x).toLowerCase()===n);
  console.log(JSON.stringify(k), found ? 'FOUND in '+found+' => '+JSON.stringify(all[found]).slice(0,80) : 'MISSING');
}
