const fs=require('fs');
const file='dicts/common.json';
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const adds={
  "No artifacts generated": "暂未生成交付件",
  "No uploads": "暂无上传"
};
let c=0;
for(const [k,v] of Object.entries(adds)){
  if(!(k in data)){
    data[k]=v;
    c++;
    console.log('added',k);
  } else {
    console.log('exists',k, data[k]);
  }
}
fs.writeFileSync(file, JSON.stringify(data,null,4),'utf8');
console.log(`done ${c}, total ${Object.keys(data).length}`);
