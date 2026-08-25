const fs=require('fs');
const file='dicts/page_settings.json';
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const adds={
  "Enter bot name (optional)": "输入机器人名称（可选）",
  "Enter avatar URL (optional)": "输入头像 URL（可选）",
  "Enter device name...": "输入设备名称..."
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
