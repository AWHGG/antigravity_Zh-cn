const fs=require('fs'), path=require('path'), vm=require('vm');
const ROOT=path.join(__dirname,'..');
const SRC=fs.readFileSync(path.join(ROOT,'localization_engine.js'),'utf8');
const DICTS_ABS=path.join(ROOT,'dicts').replace(/\\/g,'\\\\');
const MOD_SRC=SRC.replace("const DICTS_FOLDER = 'dicts';", `const DICTS_FOLDER = '${DICTS_ABS}';`).replace("path.join(__dirname, DICTS_FOLDER)", "DICTS_FOLDER").replace(/\nmain\(\);\s*$/, '\nmodule.exports={generateJs};\n');
const MOD_PATH=path.join(__dirname,'_test_mod2.js');
fs.writeFileSync(MOD_PATH, MOD_SRC);
const {generateJs}=require(MOD_PATH);
const js=generateJs();

class MockText{constructor(v){this.nodeType=3; this.nodeValue=v; this.parentElement=null; this.parentNode=null;}}
class MockElement{
  constructor(tag){this.nodeType=1; this.tagName=tag.toUpperCase(); this.attributes={}; this.classList={contains:()=>false, add:()=>{}}; this.style={setProperty:()=>{}}; this.childNodes=[]; this.parentElement=null; this.parentNode=null; this.shadowRoot=null; this.isContentEditable=false; this.host=null; this.dataset={};}
  getAttribute(n){return this.attributes[n]||null;}
  setAttribute(n,v){this.attributes[n]=v;}
  hasAttribute(n){return n in this.attributes;}
  get textContent(){let s=''; for(const c of this.childNodes) s+= c.nodeType===3?c.nodeValue: (c.textContent||''); return s;}
  appendChild(c){c.parentNode=this; c.parentElement=this; this.childNodes.push(c); return c;}
  get className(){return this.attributes['class']||'';}
  set className(v){this.attributes['class']=v;}
}
MockElement.prototype.attachShadow=function(){const sr={nodeType:11, childNodes:[], appendChild(c){this.childNodes.push(c);}}; this.shadowRoot=sr; return sr;};
class MockShadowRoot{constructor(host){this.nodeType=11; this.host=host; this.childNodes=[];}}
const Node={TEXT_NODE:3,ELEMENT_NODE:1,DOCUMENT_FRAGMENT_NODE:11};
const Element=MockElement;
class MutationObserver{constructor(cb){} observe(){}}

function runTest(name, setup){
  const body=new MockElement('body');
  const docEl=new MockElement('html');
  const document={body, documentElement:docEl, readyState:'complete', addEventListener:()=>{}};
  const window={addEventListener:()=>{}, setTimeout:()=>{}};
  const sandbox={window, document, Node, Element:MockElement, MutationObserver, console, setTimeout, WeakMap, Map, Set, Object, Array, String, RegExp, JSON, Math};
  const {textNode, parentSetup}=setup(body);
  vm.runInNewContext(js, sandbox);
  const result=textNode.nodeValue;
  console.log(`${name}: "${textNode.nodeValue}" (orig setup: ${parentSetup}) -> ${result===parentSetup?'NO CHANGE (blocked)':'TRANSLATED to '+JSON.stringify(result)}`);
  return result;
}

// Test 1: 长段英文中的单词 Analyzing 被拆分为独立 textNode，应被新保护拦截（不翻译）
runTest('Test1 LongProse fragment Analyzing', (body)=>{
  const p=new MockElement('div');
  // parent has long English
  const longText="Analyzing the spatial relationships observed in the original label compared to the current output of the image and need to do something";
  // Simuler parent textContent includes the fragment + rest
  // We create parent with two children: fragment "Analyzing" and rest " the spatial..."
  const frag=new MockText('Analyzing');
  const rest=new MockText(' the spatial relationships observed in the original label compared to the current output of the image and need to do something');
  p.appendChild(frag);
  p.appendChild(rest);
  body.appendChild(p);
  return {textNode: frag, parentSetup: 'Analyzing'};
});

// Test 2: 相同单词在短容器中应正常翻译（UI 枚举）
runTest('Test2 Short container Analyzing', (body)=>{
  const div=new MockElement('div');
  const t=new MockText('Analyzing');
  div.appendChild(t);
  body.appendChild(div);
  return {textNode: t, parentSetup: 'Analyzing'};
});

// Test 3: 短词 Now 在长段中应被旧保护拦截（已存在）
runTest('Test3 Short word Now in long prose', (body)=>{
  const p=new MockElement('p');
  const long="I am now focusing on the user observation about the uneven distribution of the label and need to analyze";
  const t=new MockText('Now');
  p.appendChild(t);
  const rest=new MockText(' is inside long paragraph '+long);
  p.appendChild(rest);
  body.appendChild(p);
  return {textNode: t, parentSetup: 'Now'};
});

// Test 4: 状态词 Explored 在 BUTTON 内长段中应仍翻译（UI 例外）
runTest('Test4 Explored in BUTTON inside long', (body)=>{
  const article=new MockElement('div');
  article.setAttribute('role','article');
  article.setAttribute('aria-label','Agent response');
  const btn=new MockElement('button');
  const span=new MockElement('span');
  const t=new MockText('Explored');
  span.appendChild(t);
  btn.appendChild(span);
  article.appendChild(btn);
  // 给 article 一个长文本兄弟以模拟长段 parent
  const p=new MockElement('p');
  const long=new MockText('This is a long English paragraph that exceeds forty characters and is mostly English to trigger prose detection');
  p.appendChild(long);
  article.appendChild(p);
  body.appendChild(article);
  return {textNode: t, parentSetup: 'Explored'};
});

fs.rmSync(MOD_PATH,{force:true});
