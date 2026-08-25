const fs=require('fs');
const path=require('path');
const norm=s=>String(s).replace(/\s+/g,' ').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').trim();
let all={};
for(const f of fs.readdirSync('dicts').filter(x=>x.endsWith('.json'))) Object.assign(all, JSON.parse(fs.readFileSync('dicts/'+f,'utf8')));
const keys=['No file changes','No background tasks','No conversations yet'];
for(const k of keys){
  const n=norm(k).toLowerCase();
  const found=Object.keys(all).find(x=>norm(x).toLowerCase()===n);
  console.log(JSON.stringify(k), found? 'FOUND '+JSON.stringify(found).slice(0,60)+' => '+JSON.stringify(all[found]).slice(0,60) : 'MISSING');
}
