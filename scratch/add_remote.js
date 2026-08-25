const fs=require('fs');
const file='dicts/page_settings.json';
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const adds={
  "Device Name": "设备名称",
  "Scan the code to open this device in Remote Control, or": "扫描二维码以在远程控制中打开此设备，或"
};
let c=0;
for(const [k,v] of Object.entries(adds)){
  if(!(k in data)){
    data[k]=v;
    c++;
    console.log('added',k);
  } else {
    console.log('exists',k);
  }
}
fs.writeFileSync(file, JSON.stringify(data,null,4),'utf8');
console.log(`done ${c}, total ${Object.keys(data).length}`);
