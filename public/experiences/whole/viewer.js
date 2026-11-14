import {hardwareDiagram} from './explain.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const spec={nvidia:{file:'dgx-h100',name:'NVIDIA DGX H100',chip:'GPU',u:8,height:3.56,slots:4,cpu:2,fan:12,psu:6,drive:8,url:'https://docs.nvidia.com/dgx/dgxh100-user-guide/introduction-to-dgxh100.html'},ascend:{file:'atlas-800t-a2',name:'华为 Atlas 800T A2',chip:'NPU',u:4,height:1.75,slots:8,cpu:4,fan:8,psu:4,drive:10,url:'https://e.huawei.com/cn/documents/products/computing/b0b253c4d5da4e05ba80a39e3dc65fd2'}};
const scene=new THREE.Scene();scene.background=new THREE.Color('#dce2da');scene.fog=new THREE.Fog('#dce2da',40,105);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;$('#stage').appendChild(renderer.domElement);
const camera=new THREE.PerspectiveCamera(34,1,.1,180);const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.48;controls.minDistance=1.5;controls.maxDistance=70;controls.autoRotateSpeed=.45;
scene.add(new THREE.HemisphereLight('#f6f1da','#809184',2.0));
const key=new THREE.DirectionalLight('#fff1d4',3.1);key.position.set(-9,24,15);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-23,right:23,top:30,bottom:-25,near:1,far:70});key.shadow.bias=-.00025;key.shadow.normalBias=.035;scene.add(key);
const fill=new THREE.DirectionalLight('#dceaf2',1.2);fill.position.set(12,15,-9);scene.add(fill);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(240,240),new THREE.MeshStandardMaterial({color:'#d4dbcf',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.15;ground.receiveShadow=true;scene.add(ground);
const plinth=new THREE.Mesh(new THREE.CylinderGeometry(7.4,7.6,.3,64),new THREE.MeshStandardMaterial({color:'#e5e3d4',roughness:.85}));plinth.position.y=.01;plinth.receiveShadow=true;plinth.castShadow=true;scene.add(plinth);
const cabinetRoot=new THREE.Group(), serverRoot=new THREE.Group(), focusRoot=new THREE.Group();scene.add(cabinetRoot,serverRoot,focusRoot);
const entry=new URLSearchParams(location.search),SITE=entry.get('site')==='1';
// Use the reader's surface and a contact shadow inside the site.
if(SITE){
 const palette=getComputedStyle(document.documentElement);
 const paper=palette.getPropertyValue('--reader-sidebar').trim();
 scene.background.set(paper);scene.fog.color.set(paper);
 ground.material.dispose();
 ground.material=new THREE.ShadowMaterial({color:palette.getPropertyValue('--ink').trim(),opacity:.14});
 plinth.visible=false;
}
let platform=entry.get('vendor')==='ascend'?'ascend':'nvidia',level=Math.max(0,Math.min(3,Number(entry.get('level'))||0)),spread=.65,templates={},cabinet,server,focused,selection=null,parts=[],pickables=[],animation=null,down=null,ready=false,doorOpen=false,doorAngle=0,cabinetDoor=null;
// Render only when interaction, camera damping or a scene animation changes the picture.
let renderRequest=0,doorMotion=null;
function invalidate(shadows=false){
 if(shadows)renderer.shadowMap.needsUpdate=true;
 if(!renderRequest&&!document.hidden)renderRequest=requestAnimationFrame(draw);
}
controls.addEventListener('change',()=>invalidate());
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){cancelAnimationFrame(renderRequest);renderRequest=0;}else invalidate();
});
const doorButton=document.createElement('button');doorButton.id='door';doorButton.textContent='打开柜门';$('.viewtools').prepend(doorButton);doorButton.onclick=()=>{doorOpen=!doorOpen;doorMotion={from:doorAngle,start:performance.now()};invalidate(true);doorButton.textContent=doorOpen?'合上柜门':'打开柜门';doorButton.setAttribute('aria-expanded',doorOpen);};
const fit={0:{pos:[25,22,36],target:[0,9,0]},1:{pos:[13,12,18],target:[0,1.1,0]},2:{pos:[12,17,18],target:[0,2.4,0]},3:{pos:[2.7,2.8,4],target:[0,.4,0]}};
function frame(reset=true){invalidate();const f=fit[level];const target=new THREE.Vector3(...f.target),pos=new THREE.Vector3(...f.pos);if(level===3&&focused){const bounds=new THREE.Box3().setFromObject(focused),size=bounds.getSize(new THREE.Vector3()),extent=Math.max(size.x,size.y,size.z);bounds.getCenter(target);pos.copy(target).add(new THREE.Vector3(1,1.1,1.5).normalize().multiplyScalar(extent*3));if(!SITE)target.x+=extent*.28;}else if(!SITE&&innerWidth>900)target.x+=level===0?2.7:1.6;if(innerWidth<900)pos.multiplyScalar(1.15);if(reset){animation={from:camera.position.clone(),to:pos,fromT:controls.target.clone(),toT:target,start:performance.now()};}}
function configure(o){o.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;n.material.side=THREE.DoubleSide;}if(n.userData.kind){n.userData.home=n.position.clone();}});return o;}
function pruneShell(o){for(const child of [...o.children]){if(child.userData.kind && child.userData.kind!=='lid')o.remove(child);else pruneShell(child);}return o;}
function clear(g){g.clear();}
function collect(){parts=[];server.traverse(o=>{if(o.userData.kind && !['cooler','lid'].includes(o.userData.kind))parts.push(o);});pickables=[];server.traverse(o=>{if(o.isMesh)pickables.push(o);});}
function rebuild(){clear(cabinetRoot);clear(serverRoot);clear(focusRoot);const p=spec[platform];
 cabinet=configure(templates.cabinet.clone(true));cabinetRoot.add(cabinet);cabinetDoor=null;cabinet.traverse(o=>{if(o.userData.kind==='door')cabinetDoor=o;});doorOpen=false;doorAngle=0;doorMotion=null;doorButton.textContent='打开柜门';doorButton.setAttribute('aria-expanded','false');
 const servers=new THREE.Group();cabinetRoot.add(servers);
 for(let i=0;i<p.slots;i++){const shell=pruneShell(templates[platform].clone(true));shell.position.set(0,.75+i*p.u*.4445,0);configure(shell);servers.add(shell);}
 // Empty slots and two generic network appliances complete the rack silhouette.
 const m=new THREE.MeshStandardMaterial({color:'#43594c',roughness:.72});for(let i=0;i<2;i++){const box=new THREE.Mesh(new THREE.BoxGeometry(4.8,.40,5.4),m);box.position.set(0,16.5+i*.75,1.7);box.castShadow=true;cabinetRoot.add(box);for(let j=0;j<12;j++){const port=new THREE.Mesh(new THREE.BoxGeometry(.19,.12,.02),new THREE.MeshStandardMaterial({color:j%3?'#c1bea0':'#859d67',roughness:.6}));port.position.set(-2+j*.35,16.5+i*.75,4.411);cabinetRoot.add(port);}}
 server=configure(templates[platform].clone(true));server.position.y=.23;serverRoot.add(server);collect();selection=parts.find(x=>x.userData.kind===p.chip.toLowerCase());applyLevel();}
function applySpread(){invalidate(true);server.traverse(o=>{const u=o.userData;if(!u.kind)return;const h=u.home;if(!h)return;o.position.copy(h);if(level===2){o.position.y+=(u.explodeZ||0)*spread;o.position.z-=(u.explodeY||0)*spread;}if(u.kind==='lid')o.visible=level!==2;if(u.kind==='cooler')o.position.copy(h);});if(focused)focused.traverse(o=>{if(o.userData.kind==='cooler'){o.position.copy(o.userData.home);o.position.y+=spread*.9;}});}
function setFocus(part){selection=part;clear(focusRoot);focused=configure(part.clone(true));focused.position.set(0,.23,0);focusRoot.add(focused);focused.traverse(o=>{if(o.userData.kind==='cooler')o.userData.home=o.position.clone();});applySpread();}
function applyLevel(){const p=spec[platform];cabinetRoot.visible=level===0;serverRoot.visible=level===1||level===2;focusRoot.visible=level===3;doorButton.hidden=level!==0;plinth.scale.setScalar(level===0?.7:level===3?.22:1);if(level===3 && selection)setFocus(selection);applySpread();frame();updateUI();}
function setLevel(n){level=n;applyLevel();}
function updateUI(){const p=spec[platform];$$('[data-level]').forEach(b=>{b.classList.toggle('active',+b.dataset.level===level);b.setAttribute('aria-current',+b.dataset.level===level?'step':'false');});$$('[data-vendor]').forEach(b=>{b.classList.toggle('active',b.dataset.vendor===platform);b.setAttribute('aria-pressed',b.dataset.vendor===platform);});$('#modulelabel').textContent=p.chip+' 模组';$('#source').href=p.url;$('#download').href='./assets/'+p.file+'.glb';$('#previous').disabled=level===0;$('#next').disabled=level===3;$('#next').textContent=['抽出服务器 →','打开机箱 →','查看'+p.chip+' →','正在独立观察'][level];$('#title').textContent=level===0?p.name:level===1?p.name:level===2?'整机内部结构':selection?.userData.label;
 $('#description').textContent=[`通用 42U 展示机柜。${p.slots} 台 ${p.u}U 服务器呈现整体层次，可继续进入其中一台。`,'保留整机比例、前面板与外部接口。打开机箱，逐层观察计算、存储与供电部件。','CPU 主板、加速器载板、散热、内存、风扇和电源分层展开。点击模型或下方名称，单独观察。',selection?.userData.description||'独立观察部件，拖动环绕查看外形。'][level];
 $('#facts').innerHTML=level===0?`<div><small>机柜</small><b>42U</b></div><div><small>展示整机</small><b>${p.slots}</b></div><div><small>每机 ${p.chip}</small><b>8</b></div>`:`<div><small>${p.chip}</small><b>8</b></div><div><small>CPU</small><b>${p.cpu}</b></div><div><small>DIMM 槽</small><b>32</b></div>`;
 $('#boundary').textContent=level===0?'机柜及装机数量为展示示意，不代表厂商整柜交付、供电或散热方案。':'主要部件数量与外形参考官方资料；位置、尺寸和微小结构经过简化，不是工程 CAD。';
 $('#stagecode').textContent=['01 / CABINET','02 / SERVER','03 / COMPONENTS','04 / MODULE'][level];$('#stepnote').textContent=['从一座机柜，走进计算发生的地方。','观察完整外形，再打开上盖。','用展开距离调节层次，点击部件继续观察。','抬起散热器，观察模组板、连接器和紧固件。'][level];$('#transport').hidden=level<2;$('#spreadlabel').textContent=level===3?'抬起散热器':'展开距离';$('#components').replaceChildren();
 if(level>=2){const choices=parts.filter(o=>['gpu','npu','host','fans','psu','drives','network','board','cpu'].includes(o.userData.kind));for(const o of choices){const b=document.createElement('button');b.textContent=o.userData.label;b.classList.toggle('active',level===3&&o===selection);b.onclick=()=>{selection=o;setLevel(3);};$('#components').append(b);}}
 $('#status').textContent=`${p.name} · 独立模型研究 · ${['整柜','整机','内部','部件'][level]}`;document.body.dataset.level=level;document.body.dataset.platform=platform;updateDiagram();
}
function defaultModule(){selection=parts.find(o=>o.userData.kind===spec[platform].chip.toLowerCase());}
$('#next').onclick=()=>{if(level===2)defaultModule();setLevel(Math.min(level+1,3));};$('#previous').onclick=()=>setLevel(Math.max(level-1,0));$$('[data-level]').forEach(b=>b.onclick=()=>{if(+b.dataset.level===3)defaultModule();setLevel(+b.dataset.level);});$$('[data-vendor]').forEach(b=>b.onclick=()=>loadPlatform(b.dataset.vendor));$('#spread').oninput=e=>{spread=+e.target.value;$('#amount').textContent=Math.round(spread*100)+'%';applySpread();};$('#reset').onclick=()=>frame();$('#top').onclick=()=>{invalidate();animation=null;camera.position.copy(controls.target).add(new THREE.Vector3(.01,level===0?36:level===3?Math.max(5,new THREE.Box3().setFromObject(focused).getSize(new THREE.Vector3()).length()*2):20,.1));};$('#rotate').onclick=()=>{controls.autoRotate=!controls.autoRotate;invalidate();$('#rotate').setAttribute('aria-pressed',controls.autoRotate);};controls.addEventListener('start',()=>animation=null);
const ray=new THREE.Raycaster();renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);renderer.domElement.addEventListener('pointerup',e=>{if(!ready||level!==2||!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;ray.setFromCamera(new THREE.Vector2((e.clientX-renderer.domElement.getBoundingClientRect().left)/renderer.domElement.clientWidth*2-1,-(e.clientY-renderer.domElement.getBoundingClientRect().top)/renderer.domElement.clientHeight*2+1),camera);for(const hit of ray.intersectObjects(pickables,false)){let o=hit.object;while(o&&!o.userData.kind)o=o.parent;if(o?.userData.kind==='cooler')o=o.parent;if(o && parts.includes(o)){selection=o;setLevel(3);break;}}});
function resize(){const box=SITE?$('#stage').getBoundingClientRect():{width:innerWidth,height:innerHeight};renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5,Math.sqrt(2500000/Math.max(1,box.width*box.height))));renderer.setSize(box.width,box.height);invalidate();camera.aspect=box.width/box.height;camera.updateProjectionMatrix();}if(SITE)new ResizeObserver(resize).observe(document.getElementById('stage'));else addEventListener('resize',resize);resize();camera.position.set(25,22,36);controls.target.set(0,9,0);
const loader=new GLTFLoader(),pendingTemplates=new Map();
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

function draw(now){
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



function updateDiagram(){hardwareDiagram(document.getElementById('diagram'),{platform,level,spec:spec[platform],selected:selection?.userData},id=>{
 if(id.startsWith('level:')){const n=Number(id.split(':')[1]);if(n===3)defaultModule();setLevel(n);return}
 if(id==='cooler'){spread=1;$('#spread').value='1';$('#amount').textContent='100%';applySpread();return}
 if(id==='package'){frame();return}
 const kind=id==='board'?'board':id.split(':')[1];const part=parts.find(o=>o.userData.kind===kind);if(part){selection=part;setLevel(3)}
})}
