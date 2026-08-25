const fs=require('fs');
const path=require('path');
const norm=s=>String(s).replace(/\s+/g,' ').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').trim();
let all={};
for(const f of fs.readdirSync('dicts').filter(x=>x.endsWith('.json'))) Object.assign(all, JSON.parse(fs.readFileSync('dicts/'+f,'utf8')));
const dictLower=new Set(Object.keys(all).map(k=>norm(k).toLowerCase()));
const checks=[
  "Enter bot name (optional)",
  "Enter avatar URL (optional)",
  "Enter device name..."
];
for(const k of checks){
  console.log(JSON.stringify(k), dictLower.has(norm(k).toLowerCase()) ? 'FOUND' : 'MISSING');
}
