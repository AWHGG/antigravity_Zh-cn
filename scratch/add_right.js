const fs=require('fs');
const file='dicts/common.json';
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const adds={
  "No file changes": "暂无文件变更",
  "No background tasks": "暂无后台任务"
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
