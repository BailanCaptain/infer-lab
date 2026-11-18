import {hardwareDiagram} from './explain.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const NS='http://www.w3.org/2000/svg';

const MODELS={
 'atlas-800t-a2':{
  vendor:'ascend',
  file:'atlas-800t-a2',
  short:'Atlas 800T A2',
  tag:'4U · 8×OAM 模组',
  badge:'4U 训练 / 大模型推理',
  name:'华为 Atlas 800T A2',
  chip:'NPU',
  moduleNav:'NPU 模组',
  u:4,height:1.75,slots:8,cpu:4,dimm:32,fan:8,psu:4,drive:10,
  accelSummary:'每台 8 颗昇腾 NPU 模组',
  accelNodeLabel:'昇腾 NPU 模组 ×8',
  interconnectShort:'7 路 HCCS Full Mesh · 峰值 392 GB/s',
  netShort:'RoCE 直出 ×8',
  netSub:'8×200GE QSFP56',
  psuSub:'4×2.6kW (2+2 冗余)',
  dieShort:'SoC 计算晶粒 + 4×HBM (64 GB)',
  hasCooling:false,
  rackFacts:[['机柜规格','42U'],['展示整机','8 台 (4U)'],['每机 NPU','8 模组']],
  serverFacts:[
   ['加速模组','8 × NPU'],['单卡显存','64 GB HBM'],['机内互联','392 GB/s HCCS'],
   ['主机处理器','4 × 鲲鹏 920'],['主机内存槽','32 × DDR4'],['参数面网络','8 × 200GE RoCE']
  ],
  dieTitle:'昇腾 910B 系列模组封装示意',
  dieDesc:'掀开均热板热管散热器与金属顶盖（IHS），可见有机基板上的主计算晶粒（含达芬奇 AI Core 的 Cube 矩阵与 Vector 向量阵列、片上 L2）及两侧 4 颗 HBM 高带宽显存堆栈。',
  dieCallouts:[
   {title:'昇腾计算晶粒 (SoC)',sub:'AIC (Cube) + AIV (Vector) + 片上 L2',pos:[0,.13,-.02],side:[-1,-1]},
   {title:'HBM 高带宽显存 ×4',sub:'整模组 64 GB · 存放权重与 KV 状态',pos:[.16,.12,-.10],side:[1,-1]},
   {title:'多相 VRM 与去耦电容',sub:'两侧 12 相电感与基板高频滤波环',pos:[-.36,.10,.12],side:[-1,1]},
   {title:'高速板间连接器',sub:'供电输入并引出 7 路 HCCS 互联信号',pos:[.20,.11,.62],side:[1,1]}
  ],
  boundary:'主要部件类别、数量与峰值规格依据 Atlas 800T A2 官方白皮书（v16）；板内走线、鳍片片数及封装内晶粒/HBM 排布为教学示意，非工程 CAD。',
  wiki:[['hardware-devices','NPU、板卡与机柜'],['ai-core','AI Core 计算与搬运'],['cann-hccl','CANN 与 HCCL']],
  url:'https://e.huawei.com/cn/documents/products/computing/b0b253c4d5da4e05ba80a39e3dc65fd2'
 },
 'atlas-800i-a3':{
  vendor:'ascend',
  file:'atlas-800i-a3',
  short:'Atlas 800I A3',
  tag:'10U · 灵衢 + 液冷辅风',
  badge:'10U 超节点推理服务器',
  name:'华为 Atlas 800I A3',
  chip:'NPU',
  moduleNav:'NPU 模组',
  u:10,height:4.42,slots:3,cpu:4,dimm:32,fan:10,psu:6,drive:8,
  accelSummary:'8 颗双芯模组 · 1 TB 显存',
  accelNodeLabel:'A3 双芯模组 ×8 (1 TB)',
  interconnectShort:'灵衢 (UB) 互联 · 双向 784 GB/s',
  netShort:'64×400GE 光口',
  netSub:'56 灵衢 + 8 RoCE',
  psuSub:'AC/HVDC 16.2 kW 级',
  dieShort:'双计算晶粒 + 8×HBM (128 GB)',
  hasCooling:true,
  coolingLabel:'LAAC 液冷辅风',
  rackFacts:[['机柜规格','42U'],['展示整机','3 台 (10U)'],['超节点扩展','最大 384 卡']],
  serverFacts:[
   ['加速模组','8 × 双芯 NPU'],['片上总显存','8 × 128 GB'],['显存总带宽','3.2 TB/s'],
   ['灵衢互联','784 GB/s 双向'],['背部光口','64 × 400GE'],['散热架构','LAAC 液冷辅风']
  ],
  dieTitle:'Atlas A3 双晶粒 128 GB 封装示意',
  dieDesc:'移开微通道铜质液冷冷板与均热盖，可见对称排布的 2 颗计算晶粒、晶粒间高密互联桥接区，以及两侧共 8 颗高带宽存储堆栈（单模组 128 GB、带宽 3.2 TB/s）。',
  dieCallouts:[
   {title:'双计算晶粒协同封装',sub:'2 颗计算 Die 经高密桥接协同运算',pos:[0,.13,-.12],side:[-1,-1]},
   {title:'8 堆栈高带宽显存',sub:'单模组 128 GB · 3.2 TB/s 带宽',pos:[.17,.12,.08],side:[1,-1]},
   {title:'高密供电与滤波阵列',sub:'支撑双晶粒高热流密度持续输出',pos:[-.37,.10,.14],side:[-1,1]},
   {title:'灵衢 (UB) 高速通道侧',sub:'7 路灵衢 + 1 路 RoCE · 双向 784 GB/s',pos:[.20,.11,.62],side:[1,1]}
  ],
  boundary:'单机 10U 形态、8×128 GB 显存、双向 784 GB/s 灵衢互联、64×400GE QSFP-DD 接口与 LAAC 液冷辅助风冷依据华为 Atlas 800I/800T A3 公开规格；内部管路与晶粒排布为架构示意。',
  wiki:[['hardware-devices','超节点与 MemFabric'],['ai-qos','A3 灵衢网络与 AI QoS'],['kv-cache-sparse-offload','A3 Sparse KV Offload']],
  url:'https://e.huawei.com/cn/products/computing/ascend'
 },
 'atlas-800-3000':{
  vendor:'ascend',
  file:'atlas-800-3000',
  short:'Atlas 800 (3000)',
  tag:'2U · 4×300I Duo 标卡',
  badge:'2U 中心推理 · 双芯 PCIe 标卡',
  name:'华为 Atlas 800 (型号 3000)',
  chip:'NPU',
  moduleNav:'PCIe 标卡',
  u:2,height:.89,slots:12,cpu:2,dimm:32,fan:4,psu:2,drive:12,
  accelSummary:'4 张双芯 PCIe 卡 (8 可见设备)',
  accelNodeLabel:'Atlas 300I Duo 标卡 ×4',
  interconnectShort:'PCIe 4.0 ×16 接入 · 共 8 颗推理芯片',
  netShort:'OCP 网卡 + 管理',
  netSub:'4×25GE + iBMC',
  psuSub:'2×2000W (1+1 冗余)',
  dieShort:'单卡双颗昇腾芯片 + LPDDR4X',
  hasCooling:false,
  rackFacts:[['机柜规格','42U'],['展示整机','12 台 (2U)'],['每机推理卡','4 张 (8 芯片)']],
  serverFacts:[
   ['物理加速卡','4 × 300I Duo'],['软件可见设备','8 × NPU Device'],['单卡内存','48 / 96 GB'],
   ['总线形态','PCIe 4.0 ×16'],['主机处理器','2 × 鲲鹏 920'],['单卡最大功耗','150 W 直通风冷']
  ],
  dieTitle:'Atlas 300I Duo 单卡双芯结构示意',
  dieDesc:'抬起单槽全高全长铝合金导流罩，可见同一张 PCIe 板卡上纵向排列的 2 颗昇腾推理芯片、8 颗 LPDDR4X 显存颗粒（总带宽 408 GB/s）与底部黄铜金手指。一张物理卡在运行时暴露为 2 个独立可见 Device。',
  dieCallouts:[
   {title:'PCIe 4.0 ×16 金手指',sub:'插入 2U Riser 转接槽 · 无需外接供电线',pos:[-.46,.04,.22],side:[-1,-1]},
   {title:'昇腾推理芯片 0',sub:'含达芬奇 AI Core 与硬件编解码 DVPP',pos:[.06,.09,-.48],side:[1,-1]},
   {title:'昇腾推理芯片 1',sub:'同卡第二颗芯片 · 对应独立 Device',pos:[.06,.09,.36],side:[-1,1]},
   {title:'LPDDR4X 内存颗粒 ×8',sub:'整卡 48 / 96 GB · 带宽 408 GB/s',pos:[.30,.07,.45],side:[1,1]}
  ],
  boundary:'2U 机箱、2 路鲲鹏 920、32 槽 DDR4 及最多 4 张全高全长单槽 Atlas 300I Duo 双芯卡依据华为官方产品规格；板内 PCIe 桥片与颗粒排布为教学示意。',
  wiki:[['hardware-devices','物理板卡 vs 可见 Device'],['device-memory','主机内存与显存'],['ai-core','AI Core 与计算搬运']],
  url:'https://e.huawei.com/cn/products/computing/ascend'
 },
 'ascend-950dt':{
  vendor:'ascend',
  file:'ascend-950dt',
  short:'昇腾 950DT',
  tag:'4U · UMA 四晶粒架构',
  badge:'下一代架构探索 · 白皮书规格',
  name:'昇腾 950DT 架构节点',
  chip:'NPU',
  moduleNav:'950 模组',
  u:4,height:1.75,slots:8,cpu:4,dimm:32,fan:8,psu:4,drive:8,
  accelSummary:'8 颗 950DT (UMA 多晶粒封装)',
  accelNodeLabel:'昇腾 950DT 模组 ×8',
  interconnectShort:'72×112G Unified Bus · 双向 2016 GB/s',
  netShort:'18 口 UB / UBoE',
  netSub:'共用 UBoE / PCIe 5.0',
  psuSub:'4 模块冗余供电示意',
  dieShort:'2×AI Die + 2×IO Die + 4×HBM',
  hasCooling:true,
  coolingLabel:'混冷分液歧管',
  rackFacts:[['展示机柜','42U'],['架构节点','8 台示意'],['每节点芯片','8 × 950DT']],
  serverFacts:[
   ['封装晶粒','2 AI + 2 IO Die'],['高速内存','144 / 96 GB (4栈)'],['内存带宽','4 TB/s (UMA)'],
   ['Cube / Vector','最高 36C / 72V'],['片上 L2 缓存','128 MB'],['UB 互联峰值','2016 GB/s 双向']
  ],
  dieTitle:'昇腾 950DT 白皮书 UMA 封装示意',
  dieDesc:'依据《昇腾 950 NPU 架构白皮书》构建：中央 2 颗计算晶粒（AI Die，含 Cube/Vector 直通融合、128 MB L2、五维 NDDMA 与 SIMD/SIMT），南北两侧 2 颗通信晶粒（IO Die，提供 18 口 Unified Bus / UBoE / PCIe 5.0），左右共 4 颗高速内存模块。',
  dieCallouts:[
   {title:'双计算晶粒 (2×AI Die)',sub:'Cube/Vector 直通 · 128MB L2 · NDDMA',pos:[0,.13,-.08],side:[-1,-1]},
   {title:'双通信晶粒 (2×IO Die)',sub:'72×112G HiLink UB / UBoE / PCIe 5.0',pos:[0,.12,-.21],side:[1,-1]},
   {title:'4×高速内存模块 (UMA)',sub:'144 / 96 GB 容量 · 4 TB/s 内存带宽',pos:[-.17,.12,.08],side:[-1,1]},
   {title:'多相供电与基板互连',sub:'支撑 MXFP4 / HiF8 / FP8 低精度矩阵算力',pos:[.20,.11,.62],side:[1,1]}
  ],
  boundary:'芯片晶粒构成（2 AI Die + 2 IO Die + 4 内存模块）、Cube/Vector 档位、4 TB/s 带宽及 18 端口 Unified Bus 严格源自《昇腾 950 NPU 架构白皮书》；整机机箱与混冷管路为教学承载示意，非特定商用服务器外观。',
  wiki:[['ascend-950-architecture','昇腾 950 计算与搬运'],['ascend-950-execution-interconnect','STARS 2.0 与 UB 互联'],['low-precision-formats','MXFP4 与 HiF8 格式']],
  url:'https://public-download.obs.cn-east-2.myhuaweicloud.com/ascend/%E6%98%87%E8%85%BE950%20NPU%E6%9E%B6%E6%9E%84%E7%99%BD%E7%9A%AE%E4%B9%A6.pdf'
 },
 'dgx-h100':{
  vendor:'nvidia',
  file:'dgx-h100',
  short:'DGX H100',
  tag:'8U · 8×SXM5 + NVSwitch',
  badge:'8U 训练 / 推理对照基准',
  name:'NVIDIA DGX H100',
  chip:'GPU',
  moduleNav:'GPU 模组',
  u:8,height:3.56,slots:4,cpu:2,dimm:32,fan:12,psu:6,drive:8,
  accelSummary:'每台 8 颗 H100 SXM5 + 4 NVSwitch',
  accelNodeLabel:'H100 SXM5 模组 ×8',
  interconnectShort:'4 颗 NVSwitch 全互连 · 单卡 900 GB/s',
  netShort:'Cedar-7 OSFP',
  netSub:'8×400G InfiniBand',
  psuSub:'6×3.3kW 钛金电源',
  dieShort:'GH100 晶粒 + 6×HBM3 (80 GB)',
  hasCooling:false,
  rackFacts:[['机柜规格','42U'],['展示整机','4 台 (8U)'],['每机 GPU','8 模组']],
  serverFacts:[
   ['加速模组','8 × H100 SXM5'],['单卡显存','80 GB HBM3'],['机内交换','4 × NVSwitch'],
   ['单卡互联','900 GB/s NVLink'],['主机处理器','2 × Intel Xeon'],['计算网络','8 × 400G OSFP']
  ],
  dieTitle:'NVIDIA H100 SXM5 (GH100) 封装示意',
  dieDesc:'抬起带香槟金顶盖的铜热管均热板散热器与封装盖，可见 CoWoS 硅中介层中央的 GH100 计算晶粒，以及左右两侧共 6 个 HBM3 堆栈位（公开架构为 5 颗启用共 80 GB + 1 颗冗余位）。',
  dieCallouts:[
   {title:'GH100 计算晶粒',sub:'Hopper SM / Tensor Core 与 L2 缓存',pos:[0,.13,-.02],side:[-1,-1]},
   {title:'6×HBM3 堆栈位 (CoWoS)',sub:'80 GB HBM3（5 启用 + 1 冗余堆栈位）',pos:[.17,.12,-.12],side:[1,-1]},
   {title:'多相高流 VRM 供电阵',sub:'支撑 SXM5 模组最高 700 W 功耗预算',pos:[-.36,.10,.15],side:[-1,1]},
   {title:'SXM5 板间高密连接器',sub:'直通基板 4 颗第三代 NVSwitch',pos:[.25,.11,.79],side:[1,1]}
  ],
  boundary:'8U 双仓布局、8×H100 SXM5、4×NVSwitch、Cedar-7 网络与 6 电源依据 NVIDIA DGX H100 官方用户指南；内部走线与封装晶粒为风格化教学示意。',
  wiki:[['hardware-devices','设备层级与互联对照'],['collective-communication','集合通信基础']],
  url:'https://docs.nvidia.com/dgx/dgxh100-user-guide/introduction-to-dgxh100.html'
 }
};

const ASCEND_KEYS=['atlas-800t-a2','atlas-800i-a3','atlas-800-3000','ascend-950dt'];

const scene=new THREE.Scene();
scene.background=new THREE.Color('#dce2da');
scene.fog=new THREE.Fog('#dce2da',46,120);

const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
renderer.shadowMap.enabled=true;
renderer.shadowMap.autoUpdate=false;
renderer.shadowMap.needsUpdate=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.14;
$('#stage').prepend(renderer.domElement);

// Soft studio environment gives satin aluminum, copper heatpipes, brass pins and silicon dies natural specular sheen.
const pmrem=new THREE.PMREMGenerator(renderer);
const envRT=pmrem.fromScene(new RoomEnvironment(),0.045);
scene.environment=envRT.texture;
scene.environmentIntensity=0.34;
pmrem.dispose();

const camera=new THREE.PerspectiveCamera(34,1,.08,190);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;
controls.dampingFactor=0.075;
controls.maxPolarAngle=Math.PI*.485;
controls.minDistance=.85;
controls.maxDistance=72;
controls.autoRotateSpeed=.45;

scene.add(new THREE.HemisphereLight('#f8f3df','#7d8f82',1.85));
const key=new THREE.DirectionalLight('#fff2d8',2.85);
key.position.set(-9,24,15);
key.castShadow=true;
key.shadow.mapSize.set(2048,2048);
Object.assign(key.shadow.camera,{left:-20,right:20,top:26,bottom:-22,near:1,far:72});
key.shadow.bias=-.0002;
key.shadow.normalBias=.022;
scene.add(key);

const fill=new THREE.DirectionalLight('#ddebf3',1.15);
fill.position.set(12,15,-10);
scene.add(fill);

const rim=new THREE.DirectionalLight('#f5e5cc',.65);
rim.position.set(0,8,-18);
scene.add(rim);

const ground=new THREE.Mesh(
 new THREE.PlaneGeometry(240,240),
 new THREE.MeshStandardMaterial({color:'#d4dbcf',roughness:1})
);
ground.rotation.x=-Math.PI/2;
ground.position.y=-.15;
ground.receiveShadow=true;
scene.add(ground);

const plinth=new THREE.Mesh(
 new THREE.CylinderGeometry(7.4,7.6,.3,64),
 new THREE.MeshStandardMaterial({color:'#e5e3d4',roughness:.85})
);
plinth.position.y=.01;
plinth.receiveShadow=true;
plinth.castShadow=true;
scene.add(plinth);

const cabinetRoot=new THREE.Group(),
 serverRoot=new THREE.Group(),
 guideRoot=new THREE.Group(),
 focusRoot=new THREE.Group();
scene.add(cabinetRoot,serverRoot,guideRoot,focusRoot);

const entry=new URLSearchParams(location.search),SITE=entry.get('site')==='1';
if(SITE){
 const palette=getComputedStyle(document.documentElement);
 const paper=palette.getPropertyValue('--reader-sidebar').trim()||'#ece9df';
 const ink=palette.getPropertyValue('--ink').trim()||'#242d27';
 scene.background.set(paper);
 scene.fog.color.set(paper);
 ground.material.dispose();
 ground.material=new THREE.ShadowMaterial({color:ink,opacity:.13});
 plinth.visible=false;
}

const requestedVendor=entry.get('vendor')==='ascend'?'ascend':entry.get('vendor')==='nvidia'?'nvidia':(SITE?'ascend':'nvidia');
const requestedModel=entry.get('model');
let lastAscendModel=ASCEND_KEYS.includes(requestedModel)?requestedModel:'atlas-800t-a2';
let currentModel=requestedVendor==='nvidia'?'dgx-h100':lastAscendModel;
let platform=MODELS[currentModel].vendor;
let level=Math.max(0,Math.min(4,Number(entry.get('level'))||0));
let spread=.65,
 templates={},
 cabinet,
 server,
 focused,
 selection=null,
 parts=[],
 pickables=[],
 hoveredPart=null,
 animation=null,
 down=null,
 ready=false,
 doorOpen=false,
 doorAngle=0,
 cabinetDoor=null,
 showCallouts=true,
 activeCallouts=[];

let renderRequest=0,doorMotion=null;
function invalidate(shadows=false){
 if(shadows)renderer.shadowMap.needsUpdate=true;
 if(!renderRequest&&!document.hidden)renderRequest=requestAnimationFrame(draw);
}
controls.addEventListener('change',()=>invalidate());
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){cancelAnimationFrame(renderRequest);renderRequest=0;}
 else invalidate();
});

// Populate Ascend 4-model switcher cards
const modelGrid=$('#modelgrid');
for(const keyName of ASCEND_KEYS){
 const m=MODELS[keyName];
 const btn=document.createElement('button');
 btn.type='button';
 btn.dataset.modelKey=keyName;
 btn.innerHTML=`<b>${m.short}</b><small>${m.tag}</small>`;
 btn.onclick=()=>loadModel(keyName);
 modelGrid.append(btn);
}

const doorButton=document.createElement('button');
doorButton.id='door';
doorButton.textContent='打开柜门';
$('.viewtools').prepend(doorButton);
doorButton.onclick=()=>{
 doorOpen=!doorOpen;
 doorMotion={from:doorAngle,start:performance.now()};
 invalidate(true);
 doorButton.textContent=doorOpen?'合上柜门':'打开柜门';
 doorButton.setAttribute('aria-expanded',String(doorOpen));
};

const fit={
 0:{pos:[24.5,21.5,35.5],target:[0,9.2,0]},
 1:{pos:[12.2,10.8,17.2],target:[0,1.2,0]},
 2:{pos:[12.4,15.8,17.8],target:[0,2.2,0]},
 3:{pos:[2.65,2.75,3.85],target:[0,.38,0]},
 4:{pos:[1.12,1.42,1.58],target:[0,.34,-.02]}
};

function updateShadowFrustum(target){
 const span=[19,6.8,8.5,2.1,1.15][level]||8;
 key.target.position.copy(target);
 key.target.updateMatrixWorld();
 key.position.set(target.x-span*.55,target.y+span*1.35,target.z+span*.82);
 Object.assign(key.shadow.camera,{
  left:-span,
  right:span,
  top:span*1.25,
  bottom:-span*1.1,
  near:Math.max(.2,span*.15),
  far:span*4.2
 });
 key.shadow.camera.updateProjectionMatrix();
 renderer.shadowMap.needsUpdate=true;
}

function frame(reset=true){
 invalidate(true);
 const p=MODELS[currentModel];
 const f=fit[level];
 const target=new THREE.Vector3(...f.target),
  pos=new THREE.Vector3(...f.pos);
 if(level===1){
  target.y=p.height*.5+.2;
  if(p.u>=8)pos.multiplyScalar(1.16);
 }else if(level===2){
  target.y=Math.max(1.8,p.height*.62+.9);
  if(p.u>=8)pos.multiplyScalar(1.18);
 }else if((level===3||level===4)&&focused){
  const bounds=new THREE.Box3().setFromObject(focused),
   size=bounds.getSize(new THREE.Vector3()),
   extent=Math.max(size.x,size.y,size.z);
  bounds.getCenter(target);
  if(level===4){
   target.set(0,.33,p.file==='atlas-800-3000'?-.06:p.file==='dgx-h100'?.05:-.02);
   const dist=p.file==='atlas-800-3000'?2.55:p.file==='dgx-h100'?2.32:1.95;
   pos.copy(target).add(new THREE.Vector3(.72,1.08,1.22).normalize().multiplyScalar(dist));
  }else{
   pos.copy(target).add(new THREE.Vector3(1,1.08,1.48).normalize().multiplyScalar(Math.max(2.6,extent*2.85)));
  }
  if(!SITE&&level===3)target.x+=extent*.24;
 }else if(!SITE&&innerWidth>900){
  target.x+=level===0?2.6:1.5;
 }
 if(innerWidth<900)pos.multiplyScalar(1.16);
 const [nearPlane,farPlane]=[[0.8,130],[0.45,75],[0.45,85],[0.12,28],[0.05,15]][level]||[0.3,120];
 camera.near=nearPlane;
 camera.far=farPlane;
 camera.updateProjectionMatrix();
 updateShadowFrustum(target);
 if(reset){
  animation={from:camera.position.clone(),to:pos,fromT:controls.target.clone(),toT:target,start:performance.now()};
 }
}

function configure(o){
 o.traverse(n=>{
  if(n.isMesh){
   n.castShadow=true;
   n.receiveShadow=true;
   if(n.material)n.material.side=THREE.DoubleSide;
  }
  if(n.userData.kind){
   n.userData.home=n.position.clone();
   n.userData.homeRotX=n.rotation.x;
  }
 });
 return o;
}

function pruneShell(o){
 for(const child of [...o.children]){
  if(child.userData.kind&&child.userData.kind!=='lid')o.remove(child);
  else pruneShell(child);
 }
 return o;
}

function disposeGroup(g){
 g.traverse(o=>{
  if(o.userData?.disposable){
   o.geometry?.dispose();
   if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());
   else o.material?.dispose();
  }
 });
 g.clear();
}

function addDisposableMesh(parent,geom,mat,pos,rot){
 const m=new THREE.Mesh(geom,mat);
 if(pos)m.position.set(...pos);
 if(rot)m.rotation.set(...rot);
 m.castShadow=true;
 m.receiveShadow=true;
 m.userData.disposable=true;
 parent.add(m);
 return m;
}

function buildRackAccessories(p){
 const acc=new THREE.Group();
 const darkMat=new THREE.MeshStandardMaterial({color:'#1c2622',roughness:.62,metalness:.16});
 const sageMat=new THREE.MeshStandardMaterial({color:'#43594c',roughness:.64,metalness:.16});
 const silverMat=new THREE.MeshStandardMaterial({color:'#8c9388',roughness:.45,metalness:.38});
 const portDark=new THREE.MeshStandardMaterial({color:'#0e1513',roughness:.72});
 const copperMat=new THREE.MeshStandardMaterial({color:'#9b573b',roughness:.42,metalness:.52});
 const slateMat=new THREE.MeshStandardMaterial({color:'#416876',roughness:.48,metalness:.25});
 const ledMat=new THREE.MeshStandardMaterial({color:'#859d67',roughness:.5});

 // Fill unused U-space between top of servers and ToR switches with sleek 2U tool-less blanking panels
 // Mounted cleanly in front of the EIA rail face (z = 4.308) so rail cage-nut pockets never Z-fight
 const stackTop=0.75+p.slots*p.u*0.4445;
 for(let y=stackTop+0.44;y<16.85;y+=0.889){
  addDisposableMesh(acc,new THREE.BoxGeometry(5.02,.82,.04),darkMat,[0,y,4.34]);
  addDisposableMesh(acc,new THREE.BoxGeometry(4.42,.05,.02),silverMat,[0,y,4.375]);
 }

 // Two detailed 1U Top-of-Rack Leaf / Management Switches + QSFP-DD cages + rear optical patch trunks
 for(let i=0;i<2;i++){
  const sy=17.45+i*0.82;
  addDisposableMesh(acc,new THREE.BoxGeometry(4.62,.40,6.1),i===0?sageMat:darkMat,[0,sy,1.22]);
  addDisposableMesh(acc,new THREE.BoxGeometry(5.06,.40,.04),silverMat,[0,sy,4.34]);
  for(let j=0;j<16;j++){
   const px=-2.05+j*0.273;
   addDisposableMesh(acc,new THREE.BoxGeometry(.20,.14,.04),silverMat,[px,sy,4.38]);
   addDisposableMesh(acc,new THREE.BoxGeometry(.15,.08,.02),portDark,[px,sy,4.41]);
   addDisposableMesh(acc,new THREE.BoxGeometry(.025,.08,.03),j%2?copperMat:slateMat,[px+.08,sy,4.435]);
   if(j%3===0)addDisposableMesh(acc,new THREE.BoxGeometry(.03,.03,.016),ledMat,[px-.07,sy+.105,4.41]);
  }
  // Graceful optical trunk loops from rear of ToR switches into left & right rear cable raceways
  for(const side of [-1,1]){
   const curve=new THREE.CatmullRomCurve3([
    new THREE.Vector3(side*1.45,sy,-1.95),
    new THREE.Vector3(side*2.15,sy-.18,-3.35),
    new THREE.Vector3(side*2.58,sy-.85,-4.42)
   ]);
   addDisposableMesh(acc,new THREE.TubeGeometry(curve,14,.038,8,false),side<0?copperMat:slateMat);
  }
 }
 return acc;
}

function collect(){
 parts=[];
 server.traverse(o=>{
  if(o.userData.kind&&!['cooler','ihs','lid','memory'].includes(o.userData.kind))parts.push(o);
 });
 pickables=[];
 server.traverse(o=>{if(o.isMesh)pickables.push(o);});
}

function clearHover(){
 if(hoveredPart){
  hoveredPart.traverse(o=>{
   if(o.isMesh&&o.userData.origEmissive!==undefined){
    o.material.emissive?.setHex(o.userData.origEmissive);
   }
  });
  hoveredPart=null;
 }
 renderer.domElement.style.cursor='';
 $('#hover-pill').hidden=true;
}

function setHover(part,clientX,clientY){
 if(hoveredPart!==part){
  clearHover();
  hoveredPart=part;
  if(part){
   part.traverse(o=>{
    if(o.isMesh&&o.material?.emissive){
     if(o.userData.origEmissive===undefined){
      o.material=o.material.clone();
      o.userData.origEmissive=o.material.emissive.getHex();
      o.userData.disposable=true;
     }
     o.material.emissive.setHex(0x1f362a);
    }
   });
   invalidate();
  }
 }
 const pill=$('#hover-pill');
 if(part){
  renderer.domElement.style.cursor='pointer';
  const rect=$('#stage').getBoundingClientRect();
  pill.textContent=`${part.userData.label} · 点击观察`;
  pill.style.left=`${clientX-rect.left}px`;
  pill.style.top=`${clientY-rect.top}px`;
  pill.hidden=false;
 }
}

function rebuildGuides(){
 disposeGroup(guideRoot);
 if(level!==2||spread<.04||!server)return;
 const positions=[];
 const guideKinds=new Set(['host','board','cooling','nvswitch','fans','drives','network','psu','bus']);
 const mat=new THREE.LineDashedMaterial({color:'#6c7f72',dashSize:.14,gapSize:.10,transparent:true,opacity:.68});
 mat.userData={disposable:true};
 server.updateMatrixWorld(true);
 for(const part of parts){
  if(!guideKinds.has(part.userData.kind))continue;
  const u=part.userData,h=u.home;
  if(!h||(!(u.explodeZ||0)&&!(u.explodeY||0)))continue;
  const parentWorld=part.parent.matrixWorld;
  const pHome=h.clone().applyMatrix4(parentWorld);
  const pCur=part.position.clone().applyMatrix4(parentWorld);
  if(pHome.distanceTo(pCur)<.08)continue;
  positions.push(pHome.x,pHome.y,pHome.z,pCur.x,pCur.y,pCur.z);
  const dotMat=new THREE.MeshBasicMaterial({color:'#8b6a47'});
  addDisposableMesh(guideRoot,new THREE.SphereGeometry(.038,8,8),dotMat,[pHome.x,pHome.y,pHome.z]);
 }
 if(positions.length){
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  const lines=new THREE.LineSegments(g,mat);
  lines.computeLineDistances();
  lines.userData.disposable=true;
  guideRoot.add(lines);
 }
}

function rebuild(){
 clearHover();
 disposeGroup(cabinetRoot);
 disposeGroup(serverRoot);
 disposeGroup(guideRoot);
 disposeGroup(focusRoot);
 const p=MODELS[currentModel];
 cabinet=configure(templates.cabinet.clone(true));
 cabinetRoot.add(cabinet);
 cabinetDoor=null;
 cabinet.traverse(o=>{if(o.userData.kind==='door')cabinetDoor=o;});
 doorOpen=false;doorAngle=0;doorMotion=null;
 doorButton.textContent='打开柜门';
 doorButton.setAttribute('aria-expanded','false');

 const servers=new THREE.Group();
 cabinetRoot.add(servers);
 for(let i=0;i<p.slots;i++){
  const shell=pruneShell(templates[currentModel].clone(true));
  shell.position.set(0,.75+i*p.u*.4445,0);
  configure(shell);
  servers.add(shell);
 }
 cabinetRoot.add(buildRackAccessories(p));

 server=configure(templates[currentModel].clone(true));
 server.position.y=.23;
 serverRoot.add(server);
 collect();
 defaultModule();
 applyLevel();
}

function defaultModule(){
 const p=MODELS[currentModel];
 selection=parts.find(o=>o.userData.kind===p.chip.toLowerCase())||parts[0];
}

function applySpread(){
 invalidate(true);
 if(!server)return;
 server.traverse(o=>{
  const u=o.userData;
  if(!u.kind||!u.home)return;
  o.position.copy(u.home);
  o.rotation.x=u.homeRotX||0;
  o.visible=true;
  if(level===2){
   o.position.y+=(u.explodeZ||0)*spread;
   o.position.z-=(u.explodeY||0)*spread;
  }
  if(u.kind==='lid')o.visible=level!==2;
 });
 rebuildGuides();

 if(focused){
  focused.traverse(o=>{
   const u=o.userData;
   if(!u.home)return;
   if(u.kind==='cooler'){
    o.visible=level!==4;
    o.position.copy(u.home);
    if(level===3)o.position.y+=Math.min(1,spread/.62)*.92;
   }else if(u.kind==='ihs'){
    o.visible=true;
    o.position.copy(u.home);
    o.rotation.x=u.homeRotX||0;
    if(level===3){
     o.position.y+=Math.max(0,(spread-.48)/.52)*.42;
    }else if(level===4){
     // Prop the IHS lid neatly behind the exposed silicon package like a watchmaker's caseback
     o.position.set(u.home.x,u.home.y+.24,u.home.z-.66);
     o.rotation.x=-.42;
    }
   }
  });
 }
}

function setFocus(part){
 selection=part;
 disposeGroup(focusRoot);
 focused=configure(part.clone(true));
 focused.position.set(0,.23,0);
 focusRoot.add(focused);
 focused.traverse(o=>{
  if(o.userData.kind==='cooler'||o.userData.kind==='ihs'){
   o.userData.home=o.position.clone();
   o.userData.homeRotX=o.rotation.x;
  }
 });
 applySpread();
}

function buildDieCallouts(){
 const p=MODELS[currentModel];
 const tagsHost=$('#callout-tags');
 const linesSvg=$('#callout-lines');
 tagsHost.replaceChildren();
 linesSvg.replaceChildren();
 activeCallouts=[];
 if(level!==4||!showCallouts||!focused){
  $('#callouts').hidden=true;
  return;
 }
 $('#callouts').hidden=false;
 for(const item of p.dieCallouts){
  const tag=document.createElement('div');
  tag.className='callout-tag';
  tag.innerHTML=`<b>${item.title}</b><small>${item.sub}</small>`;
  tagsHost.append(tag);
  const path=document.createElementNS(NS,'path');
  path.setAttribute('fill','none');
  path.setAttribute('stroke','#7b5b3e');
  path.setAttribute('stroke-width','1.4');
  path.setAttribute('stroke-dasharray','3 2.5');
  const dot=document.createElementNS(NS,'circle');
  dot.setAttribute('r','3.2');
  dot.setAttribute('fill','#a9553e');
  dot.setAttribute('stroke','#faf7ef');
  dot.setAttribute('stroke-width','1.2');
  linesSvg.append(path,dot);
  activeCallouts.push({item,tag,path,dot});
 }
 projectCallouts();
}

function projectCallouts(){
 if(level!==4||!showCallouts||!activeCallouts.length||!focused)return;
 const rect=$('#stage').getBoundingClientRect();
 const w=rect.width||1,h=rect.height||1;
 const linesSvg=$('#callout-lines');
 linesSvg.setAttribute('viewBox',`0 0 ${w} ${h}`);
 focused.updateMatrixWorld(true);
 for(const entryItem of activeCallouts){
  const {item,tag,path,dot}=entryItem;
  const world=new THREE.Vector3(...item.pos).applyMatrix4(focused.matrixWorld);
  const ndc=world.clone().project(camera);
  const sx=(ndc.x*.5+.5)*w;
  const sy=(-ndc.y*.5+.5)*h;
  const [dx,dy]=item.side;
  const tx=THREE.MathUtils.clamp(w*.5+dx*Math.min(w*.32,215),95,w-95);
  const ty=THREE.MathUtils.clamp(h*.5+dy*Math.min(h*.27,138),54,h-42);
  tag.style.left=`${tx}px`;
  tag.style.top=`${ty}px`;
  const elbowX=tx-dx*58;
  path.setAttribute('d',`M${sx.toFixed(1)},${sy.toFixed(1)} L${elbowX.toFixed(1)},${ty.toFixed(1)} L${tx.toFixed(1)},${ty.toFixed(1)}`);
  dot.setAttribute('cx',sx.toFixed(1));
  dot.setAttribute('cy',sy.toFixed(1));
 }
}

function updatePresets(){
 const host=$('#presets');
 host.replaceChildren();
 if(level===2){
  for(const [lbl,val] of [['收拢',0],['标准',.65],['全展开',1]]){
   const b=document.createElement('button');
   b.type='button';
   b.textContent=lbl;
   b.onclick=()=>{spread=val;$('#spread').value=String(val);$('#amount').textContent=Math.round(val*100)+'%';applySpread();};
   host.append(b);
  }
 }else if(level===3){
  const isAccel=['npu','gpu'].includes(selection?.userData.kind);
  const items=isAccel?[['合拢',0],['抬散热器',.52],['开盖看晶粒',1]]:[['复位',0],['抬起散热',1]];
  for(const [lbl,val] of items){
   const b=document.createElement('button');
   b.type='button';
   b.textContent=lbl;
   b.onclick=()=>{spread=val;$('#spread').value=String(val);$('#amount').textContent=Math.round(val*100)+'%';applySpread();};
   host.append(b);
  }
 }
}

function applyLevel(){
 clearHover();
 const p=MODELS[currentModel];
 if(level===4&&!['npu','gpu'].includes(selection?.userData.kind)){
  defaultModule();
 }
 cabinetRoot.visible=level===0;
 serverRoot.visible=level===1||level===2;
 guideRoot.visible=level===2;
 focusRoot.visible=level===3||level===4;
 doorButton.hidden=level!==0;
 plinth.scale.setScalar(level===0?.7:level>=3?.22:1);
 if((level===3||level===4)&&selection)setFocus(selection);
 applySpread();
 buildDieCallouts();
 frame();
 updateUI();
}

function setLevel(n){
 level=Math.max(0,Math.min(4,n));
 applyLevel();
}

function updateUI(){
 const p=MODELS[currentModel];
 platform=p.vendor;
 $$('[data-level]').forEach(b=>{
  const on=+b.dataset.level===level;
  b.classList.toggle('active',on);
  b.setAttribute('aria-current',on?'step':'false');
 });
 $$('[data-vendor]').forEach(b=>{
  const on=b.dataset.vendor===platform;
  b.classList.toggle('active',on);
  b.setAttribute('aria-pressed',String(on));
 });
 $('#modelpicker').hidden=platform!=='ascend';
 $$('[data-model-key]').forEach(b=>{
  const on=b.dataset.modelKey===currentModel;
  b.classList.toggle('active',on);
  b.setAttribute('aria-pressed',String(on));
 });

 $('#modulelabel').textContent=p.moduleNav;
 $('#formfactor').textContent=p.badge;
 $('#source').href=p.url;
 $('#download').href='./assets/'+p.file+'.glb';
 $('#previous').disabled=level===0;
 $('#next').disabled=level===4;
 $('#next').textContent=[
  '抽出服务器 →',
  '打开机箱 →',
  '查看'+p.chip+' →',
  '透视封装晶粒 →',
  '已至晶粒层'
 ][level];

 $('#title').textContent=
  level===0?p.name:
  level===1?p.name:
  level===2?'整机内部结构':
  level===3?(selection?.userData.label||p.moduleNav):
  p.dieTitle;

 $('#description').textContent=[
  `通用 42U 标准机柜示意（含打孔网门、EIA 立柱、竖装双路 PDU、ToR 交换机与光纤理线）。当前编排 ${p.slots} 台 ${p.u}U 整机，可抽出单台逐级拆解。`,
  `保留 ${p.u}U 整机外形比例、前面板进风导流格栅与背部高速光口/冗余电源细节。点击“背板接口”可环绕查看机箱尾部端口阵列。`,
  'CPU 主板、加速载板/Riser、散热系统、内存、风扇与电源分层展开，虚线标示部件原位归属。悬停或点击任意部件可独立观察。',
  selection?.userData.description||'独立观察部件；拖动下方滑杆可分段抬起散热器与金属封装顶盖。',
  p.dieDesc
 ][level];

 const factRows=level===0?p.rackFacts:p.serverFacts;
 $('#facts').innerHTML=factRows.map(([k,v])=>`<div><small>${k}</small><b>${v}</b></div>`).join('');

 $('#boundary').textContent=level===0
  ?'机柜装机台数、顶部交换机与线束为空间尺度示意，不代表厂商整柜交付、供电密度或认证液冷机房方案。'
  :p.boundary;

 $('#stagecode').textContent=['01 / CABINET','02 / SERVER','03 / SUBASSEMBLIES','04 / MODULE','05 / SILICON'][level];
 $('#stepnote').textContent=[
  '从一座机柜，走进计算发生的地方。',
  '观察前后面板与端口细节，再打开机箱上盖。',
  '调节展开距离，悬停或点击部件进入独立拆解。',
  '分段抬起散热器与顶盖，或继续进入封装晶粒透视。',
  '微距观察封装基板上的计算晶粒、片上分区与高速显存堆栈。'
 ][level];

 // Dynamic secondary view button (#rearview)
 const rv=$('#rearview');
 if(level===0){
  rv.hidden=false;rv.textContent='背面理线';rv.setAttribute('aria-pressed','false');
 }else if(level===1||level===2){
  rv.hidden=false;rv.textContent='背板接口';rv.setAttribute('aria-pressed','false');
 }else if(level===4){
  rv.hidden=false;rv.textContent=showCallouts?'隐藏标注':'显示标注';rv.setAttribute('aria-pressed',String(showCallouts));
 }else{
  rv.hidden=true;
 }

 $('#transport').hidden=level!==2&&level!==3;
 $('#spreadlabel').textContent=level===3?'拆解深度':'展开距离';
 updatePresets();

 $('#components').replaceChildren();
 if(level>=2){
  const choices=parts.filter(o=>['board','gpu','npu','cooling','nvswitch','bus','host','cpu','fans','drives','network','psu'].includes(o.userData.kind));
  for(const o of choices){
   const b=document.createElement('button');
   b.type='button';
   b.textContent=o.userData.label;
   b.classList.toggle('active',(level===3||level===4)&&o===selection);
   b.onclick=()=>{
    selection=o;
    setLevel(level===4&&['npu','gpu'].includes(o.userData.kind)?4:3);
   };
   $('#components').append(b);
  }
 }

 // Wiki deep-links
 const wikiHost=$('#wikilinks');
 wikiHost.replaceChildren();
 for(const [slug,label] of p.wiki||[]){
  const a=document.createElement('a');
  a.href=`/#/wiki/${slug}`;
  a.textContent=`↗ ${label}`;
  a.onclick=e=>{
   if(SITE&&window.top){
    e.preventDefault();
    window.top.location.hash=`#/wiki/${slug}`;
   }
  };
  wikiHost.append(a);
 }

 $('#status').textContent=`${p.name} · ${['整柜','整机','内部','部件','晶粒'][level]}`;
 document.body.dataset.level=String(level);
 document.body.dataset.platform=platform;
 document.body.dataset.model=currentModel;
 updateDiagram();
}

$('#next').onclick=()=>{
 if(level===2)defaultModule();
 if(level===3&&!['npu','gpu'].includes(selection?.userData.kind))defaultModule();
 setLevel(Math.min(level+1,4));
};
$('#previous').onclick=()=>setLevel(Math.max(level-1,0));

$$('[data-level]').forEach(b=>b.onclick=()=>{
 const targetLevel=+b.dataset.level;
 if((targetLevel===3||targetLevel===4)&&!['npu','gpu'].includes(selection?.userData.kind))defaultModule();
 setLevel(targetLevel);
});

$$('[data-vendor]').forEach(b=>b.onclick=()=>{
 const v=b.dataset.vendor;
 loadModel(v==='nvidia'?'dgx-h100':lastAscendModel);
});

$('#spread').oninput=e=>{
 spread=+e.target.value;
 $('#amount').textContent=Math.round(spread*100)+'%';
 applySpread();
};

$('#reset').onclick=()=>frame();
$('#top').onclick=()=>{
 invalidate();
 animation=null;
 const dist=level===0?40:level===4?2.2:level===3?Math.max(4.5,new THREE.Box3().setFromObject(focused).getSize(new THREE.Vector3()).length()*2):(level===2?22+spread*3:19);
 camera.position.copy(controls.target).add(new THREE.Vector3(.01,dist,.08));
};
$('#rearview').onclick=()=>{
 if(level===4){
  showCallouts=!showCallouts;
  buildDieCallouts();
  updateUI();
  invalidate();
  return;
 }
 const p=MODELS[currentModel];
 let toT,to;
 if(level===0){
  toT=new THREE.Vector3(0,9.2,-1.0);
  to=new THREE.Vector3(-15.5,15.8,-33.5);
 }else if(level===2){
  const s=p.u>=8?1.18:1.05;
  toT=new THREE.Vector3(0,Math.max(1.6,p.height*.52+.65),-1.5*spread);
  to=new THREE.Vector3(-11.2*s,(12.6+spread*2.2)*s,(-19.6-spread*2.8)*s);
 }else{
  const s=p.u>=8?1.16:1;
  toT=new THREE.Vector3(0,p.height*.48+.25,-1.0);
  to=new THREE.Vector3(-9.2*s,(6.4+p.height*.45)*s,-16.6*s);
 }
 updateShadowFrustum(toT);
 animation={from:camera.position.clone(),to,fromT:controls.target.clone(),toT,start:performance.now()};
 invalidate();
};
$('#rotate').onclick=()=>{
 controls.autoRotate=!controls.autoRotate;
 invalidate();
 $('#rotate').setAttribute('aria-pressed',String(controls.autoRotate));
};
controls.addEventListener('start',()=>animation=null);

const ray=new THREE.Raycaster();
function raycastPart(e){
 const rect=renderer.domElement.getBoundingClientRect();
 ray.setFromCamera(
  new THREE.Vector2(
   ((e.clientX-rect.left)/rect.width)*2-1,
   -((e.clientY-rect.top)/rect.height)*2+1
  ),
  camera
 );
 for(const hit of ray.intersectObjects(pickables,false)){
  let o=hit.object;
  while(o&&!o.userData.kind)o=o.parent;
  while(o&&['cooler','ihs','memory'].includes(o.userData.kind))o=o.parent;
  if(o&&parts.includes(o))return o;
 }
 return null;
}

renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);
renderer.domElement.addEventListener('pointermove',e=>{
 if(!ready||level!==2||down)return;
 setHover(raycastPart(e),e.clientX,e.clientY);
});
renderer.domElement.addEventListener('pointerleave',()=>clearHover());
renderer.domElement.addEventListener('pointerup',e=>{
 const start=down;
 down=null;
 if(!ready||level!==2||!start||Math.hypot(e.clientX-start[0],e.clientY-start[1])>5)return;
 const picked=raycastPart(e);
 if(picked){
  selection=picked;
  setLevel(3);
 }
});

function resize(){
 const box=SITE?$('#stage').getBoundingClientRect():{width:innerWidth,height:innerHeight};
 const w=Math.max(1,box.width),h=Math.max(1,box.height);
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5,Math.sqrt(2600000/(w*h))));
 renderer.setSize(w,h);
 camera.aspect=w/h;
 camera.updateProjectionMatrix();
 projectCallouts();
 invalidate();
}
if(SITE)new ResizeObserver(resize).observe(document.getElementById('stage'));
else addEventListener('resize',resize);
resize();
camera.position.set(24.5,21.5,35.5);
controls.target.set(0,9.2,0);

const loader=new GLTFLoader(),pendingTemplates=new Map();
let modelLoadSeq=0;
const retryLoad=document.createElement('button');
retryLoad.textContent='重试加载';
retryLoad.hidden=true;
$('#loading').append(retryLoad);

function loadTemplate(keyName){
 if(templates[keyName])return Promise.resolve(templates[keyName]);
 if(!pendingTemplates.has(keyName)){
  const file=keyName==='cabinet'?'cabinet-42u':MODELS[keyName].file;
  pendingTemplates.set(
   keyName,
   loader.loadAsync('./assets/'+file+'.glb').then(gltf=>{
    templates[keyName]=gltf.scene.children[0];
    return templates[keyName];
   }).catch(error=>{
    pendingTemplates.delete(keyName);
    throw error;
   })
  );
 }
 return pendingTemplates.get(keyName);
}

async function loadModel(nextKey){
 if(!MODELS[nextKey])return;
 if(ready&&nextKey===currentModel)return;
 const request=++modelLoadSeq;
 ready=false;
 $('#loading').hidden=false;
 $('#loading b').textContent='正在载入硬件';
 $('#loading span').textContent=MODELS[nextKey].name;
 retryLoad.hidden=true;
 try{
  await Promise.all([loadTemplate('cabinet'),loadTemplate(nextKey)]);
  if(request!==modelLoadSeq)return;
  currentModel=nextKey;
  if(MODELS[nextKey].vendor==='ascend')lastAscendModel=nextKey;
  platform=MODELS[nextKey].vendor;
  rebuild();
  ready=true;
  $('#loading').hidden=true;
 }catch(error){
  if(request!==modelLoadSeq)return;
  $('#loading b').textContent='模型载入失败';
  $('#loading span').textContent=error.message;
  retryLoad.hidden=false;
  retryLoad.onclick=()=>loadModel(nextKey);
  console.error(error);
 }
}
loadModel(currentModel);

function draw(now){
 renderRequest=0;
 const targetAngle=doorOpen?-Math.PI*.42:0;
 if(doorMotion){
  const t=Math.min((now-doorMotion.start)/650,1);
  doorAngle=THREE.MathUtils.lerp(doorMotion.from,targetAngle,1-(1-t)**3);
  if(t===1)doorMotion=null;
  renderer.shadowMap.needsUpdate=true;
 }else doorAngle=targetAngle;
 if(cabinetDoor)cabinetDoor.rotation.y=doorAngle;
 if(animation){
  const t=Math.min((performance.now()-animation.start)/820,1),s=t*t*(3-2*t);
  camera.position.lerpVectors(animation.from,animation.to,s);
  controls.target.lerpVectors(animation.fromT,animation.toT,s);
  if(t===1)animation=null;
 }
 const changed=controls.update();
 if(level===4&&showCallouts)projectCallouts();
 renderer.render(scene,camera);
 if(animation||doorMotion||controls.autoRotate||changed)invalidate();
}

function updateDiagram(){
 const p=MODELS[currentModel];
 hardwareDiagram(
  document.getElementById('diagram'),
  {platform,model:currentModel,level,spec:p,selected:selection?.userData},
  id=>{
   if(id.startsWith('level:')){
    const n=Number(id.split(':')[1]);
    if((n===3||n===4)&&!['npu','gpu'].includes(selection?.userData.kind))defaultModule();
    setLevel(n);
    return;
   }
   if(id==='cooler'){
    spread=.52;$('#spread').value='.52';$('#amount').textContent='52%';applySpread();return;
   }
   if(id==='ihs'){
    spread=1;$('#spread').value='1';$('#amount').textContent='100%';applySpread();return;
   }
   if(id.startsWith('die:')){
    frame();return;
   }
   const kind=id==='board'?'board':id.split(':')[1];
   const part=parts.find(o=>o.userData.kind===kind);
   if(part){selection=part;setLevel(3);}
  }
 );
}
