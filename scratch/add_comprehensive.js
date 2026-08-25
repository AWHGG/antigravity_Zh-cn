const fs=require('fs');
const file='dicts/common.json';
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const adds={
  "Sidebar": "侧边栏",
  "Project options": "项目选项",
  "More options": "更多选项",
  "Message input": "消息输入",
  "Select model, current: Gemini 3.7 Flash High": "选择模型，当前：Gemini 3.7 Flash High",
  "Record voice memo": "录制语音备忘录",
  "Typeahead menu": "输入联想菜单",
  "Rules: 2,629 tokens": "规则：2,629 tokens",
  "Skills: 1,789 tokens": "技能：1,789 tokens",
  "Refresh MCP servers": "刷新 MCP 服务器",
  "Show Remote Control QR code": "显示远程控制二维码",
  "Remote Control link": "远程控制链接",
  "Refresh quota and credits data": "刷新配额与额度数据"
};
let c=0;
for(const [k,v] of Object.entries(adds)){
  if(!(k in data)){
    data[k]=v;
    c++;
    console.log('added',k);
  }
}
fs.writeFileSync(file, JSON.stringify(data,null,4),'utf8');
console.log(`done ${c}, total ${Object.keys(data).length}`);
