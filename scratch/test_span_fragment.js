const fs=require('fs'), path=require('path'), vm=require('vm');
const ROOT=path.join(__dirname,'..');
const SRC=fs.readFileSync(path.join(ROOT,'localization_engine.js'),'utf8');
const DICTS_ABS=path.join(ROOT,'dicts').replace(/\\/g,'\\\\');
const MOD_SRC=SRC.replace("const DICTS_FOLDER = 'dicts';", `const DICTS_FOLDER = '${DICTS_ABS}';`).replace("path.join(__dirname, DICTS_FOLDER)", "DICTS_FOLDER").replace(/\nmain\(\);\s*$/, '\nmodule.exports={generateJs};\n');
const MOD_PATH=path.join(__dirname,'_span_mod.js');
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
const Node={TEXT_NODE:3,ELEMENT_NODE:1,DOCUMENT_FRAGMENT_NODE:11};
const Element=MockElement;
class MutationObserver{constructor(cb){} observe(){}}

function run(name, fragText, containerLong, isInButton){
  const body=new MockElement('body');
  const docEl=new MockElement('html');
  const document={body, documentElement:docEl, readyState:'complete', addEventListener:()=>{}};
  const window={addEventListener:()=>{}, setTimeout:()=>{}};
  const sandbox={window, document, Node, Element:MockElement, MutationObserver, console, setTimeout, WeakMap, Map, Set, Object, Array, String, RegExp, JSON, Math};
  const container=new MockElement('div');
  let targetTextNode;
  if(isInButton){
    const btn=new MockElement('button');
    const span=new MockElement('span');
    const t=new MockText(fragText);
    span.appendChild(t);
    btn.appendChild(span);
    container.appendChild(btn);
    targetTextNode=t;
    const rest=new MockText(' '+containerLong.slice(fragText.length));
    container.appendChild(rest);
  } else {
    const span=new MockElement('span');
    const t=new MockText(fragText);
    span.appendChild(t);
    container.appendChild(span);
    const rest=new MockText(' '+containerLong.slice(fragText.length));
    container.appendChild(rest);
    targetTextNode=t;
  }
  body.appendChild(container);
  vm.runInNewContext(js, sandbox);
  console.log(`${name}: "${targetTextNode.nodeValue}" -> ${targetTextNode.nodeValue===fragText?'BLOCKED':'TRANSLATED '+JSON.stringify(targetTextNode.nodeValue)}`);
}

const long=" the spatial relationships observed in the original label compared to the current output of the image and need to do something very long to exceed forty chars";
run('Span fragment Analyzing in long (should BLOCK)', 'Analyzing', 'Analyzing'+long, false);
run('Span fragment Analyzing in short (should TRANSLATE)', 'Analyzing', 'Analyzing', false);
run('Button fragment Explored in long (should TRANSLATE via UI exception)', 'Explored', 'Explored'+long, true);
fs.rmSync(MOD_PATH,{force:true});
