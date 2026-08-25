const fs=require('fs');
const {execSync}=require('child_process');
const asarPath='C:/Users/geniu/AppData/Local/Programs/antigravity/resources/app.asar';
const bakPath='C:/Users/geniu/AppData/Local/Programs/antigravity/resources/app.asar.bak';
function headerSize(p){
  try{
    const fd=fs.openSync(p,'r');
    const head=Buffer.alloc(8);
    fs.readSync(fd,head,0,8,0);
    fs.closeSync(fd);
    return head.readUInt32LE(4);
  }catch(e){return -1}
}
console.log('asar header',headerSize(asarPath));
console.log('bak header',headerSize(bakPath));
console.log('asar size',fs.statSync(asarPath).size);
console.log('bak size',fs.statSync(bakPath).size);
try{
  const out=execSync('npx --yes @electron/asar list "C:\\Users\\geniu\\AppData\\Local\\Programs\\antigravity\\resources\\app.asar.bak"', {encoding:'utf8'});
  console.log(out.split('\n').slice(0,30).join('\n'));
  console.log('total lines bak',out.split('\n').length);
}catch(e){console.log('bak list err',e.message)}
try{
  const out2=execSync('npx --yes @electron/asar list "C:\\Users\\geniu\\AppData\\Local\\Programs\\antigravity\\resources\\app.asar"', {encoding:'utf8'});
  console.log('---asar---');
  console.log(out2.split('\n').slice(0,30).join('\n'));
  console.log('total lines asar',out2.split('\n').length);
}catch(e){console.log('asar list err',e.message)}
