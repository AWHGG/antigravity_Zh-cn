const {execSync}=require('child_process');
try{
  const out=execSync('npx --yes @electron/asar list "C:\\Users\\geniu\\AppData\\Local\\Programs\\antigravity\\resources\\app.asar.bak"', {encoding:'utf8'});
  const lines=out.split('\n').filter(Boolean);
  console.log('bak total',lines.length);
  console.log('has dist?',lines.some(l=>l.includes('\\dist\\main.js')));
  console.log('dist files bak',lines.filter(l=>l.includes('\\dist')).slice(0,20).join('\n'));
  console.log('---');
  const out2=execSync('npx --yes @electron/asar list "C:\\Users\\geniu\\AppData\\Local\\Programs\\antigravity\\resources\\app.asar"', {encoding:'utf8'});
  const lines2=out2.split('\n').filter(Boolean);
  console.log('asar total',lines2.length);
  console.log('has dist?',lines2.some(l=>l.includes('\\dist\\main.js')));
  console.log('dist files asar',lines2.filter(l=>l.includes('\\dist')).slice(0,40).join('\n'));
  // compare sets
  const s1=new Set(lines);
  const s2=new Set(lines2);
  const diff=[...s2].filter(x=>!s1.has(x));
  const diff2=[...s1].filter(x=>!s2.has(x));
  console.log('only in asar',diff);
  console.log('only in bak',diff2);
}catch(e){console.log(e.message)}
