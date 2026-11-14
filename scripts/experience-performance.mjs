// Apply to the published copy; keep the accepted standalone scene data intact.
function replace(text, before, after) {
  if (!text.includes(before)) throw new Error(`Experience source changed: ${before.slice(0, 80)}`);
  return text.replace(before, () => after);
}

export function adaptExperience(path, source) {
  if (path === "glm-flow/master/truth-view.js") return labelTransforms(source);
  if (path === "whole/viewer.js") return adaptHardwareTheme(hardwareOnDemand(hardwareLoading(source)));
  if (path === "whole/index.html") return replace(source, "HARDWARE COLLECTION / 01", "当前观察");
  if (!/^glm-flow\/master\/(chapter|model|flow|arch)\.html$/.test(path)) return source;
  let text = replace(
    source,
    "</head>",
    '<link rel="stylesheet" href="../../reader-theme.css"><script>if(new URLSearchParams(location.search).get("site")==="1"||window.frameElement?.classList.contains("experience-frame"))document.documentElement.dataset.site="true";</script></head>',
  );
  if (path.endsWith("chapter.html")) {
    text = replace(
      text,
      "function load(){ready=false;const r=$('#right').getBoundingClientRect();",
      "let loadedSize='';\nfunction load(){const r=$('#right').getBoundingClientRect(),size=Math.round(r.width)+'x'+Math.round(r.height);if(size===loadedSize)return;loadedSize=size;ready=false;",
    );
    return replace(text, "model.html?embed=1&w=", "model.html?embed=1&site=1&w=");
  }
  if (path.endsWith("arch.html")) return text;
  const model = path.endsWith("model.html");
  text = replace(
    text,
    model ? "preserveDrawingBuffer:!EMBED" : "preserveDrawingBuffer:true",
    "preserveDrawingBuffer:false",
  );
  text = replace(
    text,
    model
      ? "EMBED?Math.min(2,Math.max(1.5,devicePixelRatio||1)):Math.min(3,Math.max(2,devicePixelRatio||1))"
      : "Math.min(3,Math.max(2,devicePixelRatio||1))",
    "Math.min(devicePixelRatio||1,1.5,Math.sqrt(2500000/(W*H)))",
  );
  // Camera changes and playback can request the same frame several times.
  text = replace(
    text,
    "function frame(){",
    "let frameRequest=0;\nfunction frame(){if(!frameRequest)frameRequest=requestAnimationFrame(()=>{frameRequest=0;renderFrame()})}\nfunction renderFrame(){",
  );
  return text;
}

// Keep the accepted label anchors and collision algorithm; moving a label need not lay out the whole page.
function labelTransforms(source) {
  let text = replace(
    source,
    "el.style.left = (q.x + 1) * W / 2 + 'px'; el.style.top = (1 - q.y) * H / 2 + 'px'",
    "el.style.left = '0'; el.style.top = '0'; el.style.translate = (q.x + 1) * W / 2 + 'px ' + (1 - q.y) * H / 2 + 'px'",
  );
  text = replace(
    text,
    "if (dy) l.el.style.top = (parseFloat(l.el.style.top) + dy) + 'px';",
    "if (dy) { const [x, y] = l.el.style.translate.split(' ').map(parseFloat); l.el.style.translate = x + 'px ' + (y + dy) + 'px' }",
  );
  return text;
}

function hardwareLoading(source) {
  const text = replace(
    source,
    "$$('[data-vendor]').forEach(b=>b.onclick=()=>{platform=b.dataset.vendor;rebuild();});",
    "$$('[data-vendor]').forEach(b=>b.onclick=()=>loadPlatform(b.dataset.vendor));",
  );
  const start = text.indexOf("const loader=new GLTFLoader();Promise.all(");
  const end = text.indexOf("\n", start);
  if (start < 0 || end < 0) throw new Error("Hardware loader marker changed");
  return (
    text.slice(0, start) +
    `const loader=new GLTFLoader(),pendingTemplates=new Map();
let platformLoad=0;
const retryLoad=document.createElement('button');retryLoad.textContent='重试加载';retryLoad.hidden=true;$('#loading').append(retryLoad);
function loadTemplate(name){
 if(templates[name])return Promise.resolve(templates[name]);
 if(!pendingTemplates.has(name)){
  const file=name==='cabinet'?'cabinet-42u':spec[name].file;
  pendingTemplates.set(name,loader.loadAsync('./assets/'+file+'.glb').then(gltf=>{
   templates[name]=gltf.scene.children[0];return templates[name];
  }).catch(error=>{pendingTemplates.delete(name);throw error}));
 }
 return pendingTemplates.get(name);
}
async function loadPlatform(next){
 if(ready&&next===platform)return;
 const request=++platformLoad;ready=false;
 $('#loading').hidden=false;$('#loading b').textContent='正在载入硬件';$('#loading span').textContent=spec[next].name;retryLoad.hidden=true;
 try{
  await Promise.all([loadTemplate('cabinet'),loadTemplate(next)]);
  if(request!==platformLoad)return;
  platform=next;rebuild();ready=true;$('#loading').hidden=true;
 }catch(error){
  if(request!==platformLoad)return;
  $('#loading b').textContent='模型载入失败';$('#loading span').textContent=error.message;
  retryLoad.hidden=false;retryLoad.onclick=()=>loadPlatform(next);console.error(error);
 }
}
loadPlatform(platform);
` +
    text.slice(end)
  );
}

export function adaptHardwareTheme(source) {
  const text = replace(
    source,
    "const entry=new URLSearchParams(location.search),SITE=entry.get('site')==='1';",
    `const entry=new URLSearchParams(location.search),SITE=entry.get('site')==='1';
// Use the reader's surface and a contact shadow inside the site.
if(SITE){
 const palette=getComputedStyle(document.documentElement);
 const paper=palette.getPropertyValue('--reader-sidebar').trim();
 scene.background.set(paper);scene.fog.color.set(paper);
 ground.material.dispose();
 ground.material=new THREE.ShadowMaterial({color:palette.getPropertyValue('--ink').trim(),opacity:.14});
 plinth.visible=false;
}`,
  );
  return replace(
    text,
    "addEventListener('resize',resize);",
    "if(SITE)new ResizeObserver(resize).observe(document.getElementById('stage'));else addEventListener('resize',resize);",
  );
}

function hardwareOnDemand(source) {
  let text = replace(
    source,
    "renderer.shadowMap.enabled=true;",
    "renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;",
  );
  text = replace(
    text,
    "const doorButton=",
    `// Render only when interaction, camera damping or a scene animation changes the picture.
let renderRequest=0,doorMotion=null;
function invalidate(shadows=false){
 if(shadows)renderer.shadowMap.needsUpdate=true;
 if(!renderRequest&&!document.hidden)renderRequest=requestAnimationFrame(draw);
}
controls.addEventListener('change',()=>invalidate());
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){cancelAnimationFrame(renderRequest);renderRequest=0;}else invalidate();
});
const doorButton=`,
  );
  text = replace(
    text,
    "doorOpen=!doorOpen;",
    "doorOpen=!doorOpen;doorMotion={from:doorAngle,start:performance.now()};invalidate(true);",
  );
  text = replace(
    text,
    "doorOpen=false;doorAngle=0;doorButton",
    "doorOpen=false;doorAngle=0;doorMotion=null;doorButton",
  );
  text = replace(text, "function frame(reset=true){", "function frame(reset=true){invalidate();");
  text = replace(text, "function applySpread(){", "function applySpread(){invalidate(true);");
  text = replace(
    text,
    "$('#top').onclick=()=>{animation=null;",
    "$('#top').onclick=()=>{invalidate();animation=null;",
  );
  text = replace(
    text,
    "controls.autoRotate=!controls.autoRotate;",
    "controls.autoRotate=!controls.autoRotate;invalidate();",
  );
  text = replace(
    text,
    "renderer.setSize(box.width,box.height);",
    "renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5,Math.sqrt(2500000/Math.max(1,box.width*box.height))));renderer.setSize(box.width,box.height);invalidate();",
  );
  const start = text.indexOf("renderer.setAnimationLoop(");
  const end = text.indexOf("\n", start);
  if (start < 0 || end < 0) throw new Error("Hardware animation loop marker changed");
  return (
    text.slice(0, start) +
    `function draw(now){
 renderRequest=0;
 const targetAngle=doorOpen?-Math.PI*.40:0;
 if(doorMotion){
  const t=Math.min((now-doorMotion.start)/650,1);
  doorAngle=THREE.MathUtils.lerp(doorMotion.from,targetAngle,1-(1-t)**3);
  if(t===1)doorMotion=null;
  renderer.shadowMap.needsUpdate=true;
 }else doorAngle=targetAngle;
 if(cabinetDoor)cabinetDoor.rotation.y=doorAngle;
 if(animation){
  const t=Math.min((performance.now()-animation.start)/850,1),s=t*t*(3-2*t);
  camera.position.lerpVectors(animation.from,animation.to,s);
  controls.target.lerpVectors(animation.fromT,animation.toT,s);
  if(t===1)animation=null;
 }
 const changed=controls.update();
 renderer.render(scene,camera);
 if(animation||doorMotion||controls.autoRotate||changed)invalidate();
}
` +
    text.slice(end)
  );
}
