const fs=require('fs');
const path=require('path');
const norm=s=>String(s).replace(/\s+/g,' ').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').trim();
let all={}; for(const f of fs.readdirSync('dicts').filter(x=>x.endsWith('.json'))) Object.assign(all, JSON.parse(fs.readFileSync('dicts/'+f,'utf8')));
const dictLower=new Set(Object.keys(all).map(k=>norm(k).toLowerCase()));
const candidates=[
  "Sidebar",
  "Project options",
  "More options",
  "Message input",
  "Select model, current: Gemini 3.7 Flash High",
  "Record voice memo",
  "Typeahead menu",
  "Rules: 2,629 tokens",
  "Skills: 1,789 tokens",
  "Refresh MCP servers",
  "Show Remote Control QR code",
  "Remote Control link",
  "Refresh quota and credits data",
  "Substation Document Identification"
];
for(const k of candidates){
  const n=norm(k).toLowerCase();
  console.log(JSON.stringify(k), dictLower.has(n)?'FOUND':'MISSING');
}
