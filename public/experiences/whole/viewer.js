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
  boundary:'8U 双仓布局、8×H100 SXM5、4×NVSwitch、54V 供电母排、Cedar-7 网络与 6 电源依据 NVIDIA DGX H100 官方用户指南；内部走线与封装晶粒为风格化教学示意。',
  wiki:[['hardware-devices','设备层级与互联对照'],['collective-communication','集合通信基础']],
  url:'https://docs.nvidia.com/dgx/dgxh100-user-guide/introduction-to-dgxh100.html'
 },
 'dgx-b200':{
  vendor:'nvidia',
  file:'dgx-b200',
  short:'DGX B200',
  tag:'10U · 8×B200 双光罩',
  badge:'10U 风冷 Blackwell 旗舰',
  name:'NVIDIA DGX B200',
  chip:'GPU',
  moduleNav:'GPU 模组',
  u:10,height:4.42,slots:3,cpu:2,dimm:32,fan:15,psu:6,drive:8,
  accelSummary:'每台 8 颗 B200 SXM + 2 颗 NVLink 5 交换芯片（NVSwitch）',
  accelNodeLabel:'B200 SXM 模组 ×8',
  interconnectShort:'2 × NVSwitch (NVLink 5) · 聚合 14.4 TB/s',
  netShort:'CX-7 + BF-3',
  netSub:'8×400G OSFP + 双 DPU',
  psuSub:'6×3.3kW 钛金电源',
  dieShort:'双光罩晶粒 + NV-HBI + 8×HBM3e',
  hasCooling:false,
  rackFacts:[['机柜规格','42U'],['展示整机','3 台 (10U)'],['每机 GPU','8 × B200']],
  serverFacts:[
   ['加速模组','8 × B200 SXM'],['单卡显存','180 GB HBM3e'],['整机显存','1,440 GB HBM3e'],
   ['机内互联','14.4 TB/s NVLink 5'],['交换芯片','2 × NVSwitch (NVLink 5)'],['主机处理器','2 × Xeon 8570']
  ],
  dieTitle:'NVIDIA Blackwell B200 双光罩 CoWoS-L 封装示意',
  dieDesc:'掀开 1000W 级加高 6 热管散热塔与均热顶盖，可见 CoWoS-L 中介层上并排拼接的 2 颗光罩极限计算晶粒、中央 10 TB/s NV-HBI 高密桥接缝及左右两侧共 8 颗 HBM3e 堆栈（单卡 180 GB、8 TB/s）。',
  dieCallouts:[
   {title:'双光罩计算晶粒 (2×Die)',sub:'共享统一缓存一致性，软件呈单一 GPU',pos:[-.04,.13,-.12],side:[-1,-1]},
   {title:'10 TB/s NV-HBI 片间桥接',sub:'高带宽超低开销跨晶粒直连缝',pos:[.04,.13,-.02],side:[1,-1]},
   {title:'8×HBM3e 显存堆栈',sub:'单模组 180 GB 容量 · 8 TB/s 带宽',pos:[-.17,.12,.14],side:[-1,1]},
   {title:'NVLink 5 板间高速引出',sub:'单卡 1.8 TB/s 直通 2 颗 NVLink 5 交换芯片（NVSwitch）',pos:[.25,.11,.79],side:[1,1]}
  ],
  boundary:'10U 机箱规格、8×B200（1,440 GB HBM3e）、2 颗 NVLink 5 交换芯片（NVSwitch）、8×OSFP 与 6×3.3kW 电源依据 NVIDIA DGX B200 用户指南；散热塔与晶粒网格为教学示意。',
  wiki:[['hardware-devices','设备层级与互联对照'],['low-precision-formats','FP4 / FP8 低精度格式'],['tensor-parallel','张量并行基础']],
  url:'https://docs.nvidia.com/dgx/dgxb200-user-guide/introduction-to-dgxb200.html'
 },
 'gb200-nvl72':{
  vendor:'nvidia',
  file:'gb200-nvl72',
  short:'GB200 NVL72',
  tag:'1U 冷板直冷+辅风 · 2×Grace+4×B200',
  badge:'1U 冷板直冷 + 外围风冷计算托盘',
  name:'NVIDIA GB200 NVL72 计算托盘',
  chip:'GPU',
  moduleNav:'液冷 B200',
  u:1,height:0.52,slots:18,cpu:2,dimm:0,fan:4,psu:2,drive:8,
  accelSummary:'Grace + B200 冷板直冷（外围网卡/存储辅以风冷）',
  accelNodeLabel:'液冷 B200 模组 ×4',
  interconnectShort:'NVLink-C2C + 机柜 72 卡 NVLink 5 域',
  netShort:'前置 CX-7/BF-3',
  netSub:'4×OSFP + E1.S ×8',
  psuSub:'50V 母排盲插供电',
  dieShort:'DLC 冷板 + 双光罩 B200 + 8×HBM3e',
  hasCooling:true,
  coolingLabel:'DLC 冷板 + 辅助风冷',
  rackFacts:[['超节点编排','18 计算 + 9 交换'],['整柜 GPU','72 × B200'],['互联域带宽','130 TB/s NVLink']],
  serverFacts:[
   ['托盘规格','1U 冷板直冷 + 辅助风冷'],['计算配置','2×Grace + 4×B200'],['C2C 带宽','900 GB/s NVLink-C2C'],
   ['单托盘盲插','7.2 TB/s NVLink 5'],['主机内存','焊装 LPDDR5X'],['散热分工','CPU/GPU 液冷 · 网卡/存储风冷']
  ],
  dieTitle:'GB200 液冷模组与双光罩 B200 封装示意',
  dieDesc:'抬起 1U 超薄微通道紫铜液冷板与金属均热盖，可见内部双光罩 B200 计算晶粒、中央 10 TB/s NV-HBI 桥接缝与两侧 8 颗 HBM3e 堆栈；Grace + B200 冷板直冷（外围网卡/存储辅以风冷）。',
  dieCallouts:[
   {title:'双光罩 B200 计算晶粒',sub:'与前仓 Grace CPU 经 900 GB/s C2C 互联',pos:[-.04,.13,-.12],side:[-1,-1]},
   {title:'NV-HBI 跨晶粒高速缝',sub:'10 TB/s 裸片间一致性互连',pos:[.04,.13,-.02],side:[1,-1]},
   {title:'8×HBM3e 显存堆栈',sub:'由 1U 微通道铜冷板统一覆盖导热',pos:[-.17,.12,.14],side:[-1,1]},
   {title:'盲插 NVLink 5 引出端',sub:'汇入机柜中置 9 台 NVLink Switch 托盘',pos:[.20,.10,-.58],side:[1,1]}
  ],
  boundary:'18 台 1U 计算托盘（每台 2×Grace + 4×B200 冷板直冷，外围网卡与 NVMe 存储辅以托盘风扇风冷）、中置 9 台 NVLink Switch 托盘、前置免滴漏快换头及背部盲插依据 NVIDIA DGX GB200 用户指南示意，非机房施工图。',
  wiki:[['hardware-devices','超节点与单机边界对照'],['expert-parallel','大规模专家并行 EP'],['collective-communication','机柜级集合通信']],
  url:'https://www.nvidia.com/en-us/data-center/gb200-nvl72/'
 },
 'h100-nvl-pcie':{
  vendor:'nvidia',
  file:'h100-nvl-pcie',
  short:'H100 NVL PCIe',
  tag:'4U · 双槽 PCIe + 三桥接',
  badge:'4U 中心推理 · 双卡桥接标卡',
  name:'NVIDIA H100 NVL PCIe 推理节点',
  chip:'GPU',
  moduleNav:'PCIe 推理卡',
  u:4,height:1.75,slots:8,cpu:2,dimm:32,fan:8,psu:4,drive:10,
  accelSummary:'4 张双槽 94GB 卡 · 每对 2×94 GB（共 188 GB，按单卡与并行策略预算）',
  accelNodeLabel:'H100 NVL 双槽卡 ×4',
  interconnectShort:'成对 3 槽 NVLink 4 桥接 · 600 GB/s/对',
  netShort:'ConnectX-7 ×4',
  netSub:'400G RoCE / IB',
  psuSub:'4×2.4kW (2+2 冗余)',
  dieShort:'GH100 + 全启用 6×HBM3 (94 GB)',
  hasCooling:false,
  rackFacts:[['机柜规格','42U'],['展示整机','8 台 (4U)'],['每机推理卡','4 张 (2 对桥接)']],
  serverFacts:[
   ['板卡形态','双槽全高全长 PCIe 5.0'],['单卡显存','94 GB HBM3 (6 栈全开)'],['单卡带宽','3.9 TB/s HBM3'],
   ['成对显存','每对 2×94 GB (共 188 GB)'],['桥接带宽','600 GB/s (3×NVLink 桥)'],['单卡供电','16-pin 12V-2x6 / 12VHPWR']
  ],
  dieTitle:'NVIDIA H100 NVL PCIe (94 GB 全栈 HBM3) 板卡示意',
  dieDesc:'拆下双槽被动导流铝合金散热罩与均热盖，可见 PCIe 5.0×16 金手指、尾部 16-pin 12V-2x6 / 12VHPWR 供电座、顶部 3 组 NVLink 4 桥接金手指，以及启用全部 6 颗 HBM3 堆栈（单卡 94 GB、3.9 TB/s；每对 2×94 GB 共 188 GB，按单卡与并行策略预算，非单一统一 GPU HBM 地址空间）的 GH100 CoWoS 封装。',
  dieCallouts:[
   {title:'GH100 计算晶粒 (8×GPC)',sub:'双槽 350–400W 推理调优频率与张量核',pos:[0,.12,-.10],side:[-1,-1]},
   {title:'6×全启用 HBM3 堆栈',sub:'每对 2×94 GB（共 188 GB，按单卡与并行策略预算）',pos:[.16,.11,-.21],side:[1,-1]},
   {title:'顶部 3 组 NVLink 4 金手指',sub:'跨接三槽桥接器提供 600 GB/s 双向带宽',pos:[.48,.05,-.10],side:[1,1]},
   {title:'PCIe 5.0 ×16 + 16-pin 供电',sub:'16-pin 12V-2x6 / 12VHPWR 与企业风冷 Riser 仓',pos:[-.48,.05,.20],side:[-1,1]}
  ],
  boundary:'双槽 PCIe 5.0 形态、单卡 94 GB（6 栈 HBM3 全启用，每对 2×94 GB 共 188 GB，按单卡与并行策略预算）、16-pin 12V-2x6 / 12VHPWR 供电及每对 3 个 NVLink 桥接器（600 GB/s）依据 NVIDIA H100 NVL 官方规格；4U 整机为通用企业服务器承载示意。',
  wiki:[['hardware-devices','PCIe 标卡与模组形态对照'],['pipeline-parallel','流水线并行与跨对通信']],
  url:'https://www.nvidia.com/en-us/data-center/h100/'
 }
};

const ASCEND_KEYS=['atlas-800t-a2','atlas-800i-a3','atlas-800-3000','ascend-950dt'];
const NVIDIA_KEYS=['dgx-h100','dgx-b200','gb200-nvl72','h100-nvl-pcie'];

const scene=new THREE.Scene();
scene.background=new THREE.Color('#dce2da');
scene.fog=new THREE.Fog('#dce2da',46,120);

const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
renderer.shadowMap.enabled=true;
renderer.shadowMap.autoUpdate=false;
renderer.shadowMap.needsUpdate=true;
renderer.shadowMap.type=THREE.PCFShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.14;
$('#stage').prepend(renderer.domElement);

// Soft studio environment gives satin aluminum, copper heatpipes, brass pins and silicon dies natural specular sheen.
const pmrem=new THREE.PMREMGenerator(renderer);
const envRT=pmrem.fromScene(new RoomEnvironment(),0.04);
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
 focusRoot=new THREE.Group(),
 overlayRoot=new THREE.Group();
scene.add(cabinetRoot,serverRoot,guideRoot,focusRoot,overlayRoot);

const DEPLOY_CARDS={
 'a2-64g':{model:'atlas-800t-a2',slots:8,dies:1,ranks:8,gib:64,prefix:'npu',dieWord:'Rank',displaced:[]},
 'a2-32g':{model:'atlas-800t-a2',slots:8,dies:1,ranks:8,gib:32,prefix:'npu',dieWord:'Rank',displaced:[]},
 'a3-die64g':{model:'atlas-800i-a3',slots:8,dies:2,ranks:16,gib:64,prefix:'npu',dieWord:'Die',displaced:[]},
 '310p-24g':{model:'atlas-800-3000',slots:4,dies:2,ranks:8,gib:24,prefix:'card',dieWord:'Chip',displaced:[0,2]},
 '950dt-128g':{model:'ascend-950dt',slots:8,dies:1,ranks:8,gib:128,prefix:'npu',dieWord:'Rank',displaced:[]}
};
const DEPLOY_MODEL_NAMES={
 'qwen3-0.6b':'Qwen3-0.6B','qwen3-8b':'Qwen3-8B','qwen3-30b-a3b':'Qwen3-30B-A3B',
 'deepseek-v3-mla':'DeepSeek-V3 MLA 样例','hybrid-kda-gqa':'KDA+GQA 混合样例',
 'csa2-sparse-mla':'CSA2 稀疏注意力样例','engram-conditional':'Engram 条件记忆样例',
 'custom-dense':'自定义稠密模型','custom-moe':'自定义 MoE 模型',
 'custom-mla':'自定义 MLA 模型','custom-kda':'自定义线性注意力模型'
};
const DEPLOY_OOM_LABELS={
 fits:'装得下',tight_budget_oom_risk:'预算紧绷风险',
 insufficient_for_single_max_len_seq:'不足单条满长序列 KV',
 weights_exceed_budget:'权重超出可用预算',
 weights_plus_activation_exceed_budget:'权重+激活超出预算',
 non_kv_exceeds_budget:'非 KV 固定项超预算',
 headroom_overflow:'录图穿透 1−u 裕度',
 headroom_risk:'录图逼近 1−u 余量风险'
};
function parseDeployParam(raw){
 if(!raw||raw.length>1024||!/^[A-Za-z0-9_-]+$/.test(raw)||raw.length%4===1)return null;
 try{
  const pad=(4-(raw.length%4))%4;
  const bin=atob(raw.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat(pad));
  const bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  const txt=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  const o=JSON.parse(txt);
  if(!o||typeof o!=='object'||Array.isArray(o)||o.v!==1)return null;
  const card=DEPLOY_CARDS[o.c],mName=DEPLOY_MODEL_NAMES[o.m];
  if(!card||!mName||!DEPLOY_OOM_LABELS[o.oom])return null;
  const okP=n=>[1,2,4,8].includes(n);
  const pcp=o.pcp===undefined?1:o.pcp,dcp=o.dcp===undefined?1:o.dcp;
  if(!okP(o.tp)||!okP(o.pp)||!okP(o.dp)||!okP(pcp)||!okP(dcp))return null;
  if(o.ep!==0&&o.ep!==1&&typeof o.ep!=='boolean')return null;
  if(!Number.isInteger(o.r)||o.r<1||o.r>4096||o.r!==o.tp*o.pp*o.dp*pcp)return null;
  if(o.cg!==card.gib||typeof o.u!=='number'||!Number.isFinite(o.u)||o.u<0.1||o.u>0.99)return null;
  const okG=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=4096;
  if(!okG(o.w)||!okG(o.kv)||!okG(o.rt))return null;
  const localRanks=Math.min(o.r,card.ranks);
  return {
   modelKey:o.m,modelName:mName,cardId:o.c,targetModel:card.model,
   physicalSlots:card.slots,diesPerSlot:card.dies,ranksPerNode:card.ranks,
   partPrefix:card.prefix,dieWord:card.dieWord,displaced:card.displaced,
   tp:o.tp,pp:o.pp,dp:o.dp,pcp,dcp,ep:Boolean(o.ep),
   totalRanks:o.r,localRanks,nodeCount:Math.max(1,Math.ceil(o.r/card.ranks)),
   activePhysicalSlots:Math.ceil(localRanks/card.dies),
   cardGiB:card.gib,u:o.u,weightGiB:o.w,kvGiB:o.kv,runtimeGiB:o.rt,oomStatus:o.oom,
   headroomOverflow:Boolean(o.ho),
   headroomRisk:Boolean(o.hr)||o.oom==='headroom_risk'
  };
 }catch{return null;}
}

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

const deployPlan=parseDeployParam(entry.get('deploy'));
const requestedVendor=entry.get('vendor')==='ascend'?'ascend':entry.get('vendor')==='nvidia'?'nvidia':(deployPlan||SITE?'ascend':'nvidia');
const requestedModel=entry.get('model')||(deployPlan&&requestedVendor!=='nvidia'?deployPlan.targetModel:null);
let lastAscendModel=ASCEND_KEYS.includes(requestedModel)?requestedModel:(deployPlan?deployPlan.targetModel:'atlas-800t-a2');
let lastNvidiaModel=NVIDIA_KEYS.includes(requestedModel)?requestedModel:'dgx-h100';
let currentModel=ASCEND_KEYS.includes(requestedModel)||NVIDIA_KEYS.includes(requestedModel)
 ?requestedModel
 :(requestedVendor==='nvidia'?lastNvidiaModel:lastAscendModel);
let platform=MODELS[currentModel].vendor;
let level=entry.has('level')?Math.max(0,Math.min(4,Number(entry.get('level'))||0)):(deployPlan?2:0);
let spread=deployPlan?.78:.65,
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
if(deployPlan){
 $('#spread').value='0.78';
 $('#amount').textContent='78%';
}

let renderRequest=0,doorMotion=null,modelLoadSeq=0,hasLoadedOnce=false,viewerDisposed=false;
function invalidate(shadows=false){
 if(viewerDisposed)return;
 if(shadows)renderer.shadowMap.needsUpdate=true;
 if(!renderRequest&&!document.hidden)renderRequest=requestAnimationFrame(draw);
}
const onControlsChange=()=>invalidate();
const onVisibilityChange=()=>{
 if(document.hidden){cancelAnimationFrame(renderRequest);renderRequest=0;}
 else invalidate();
};
controls.addEventListener('change',onControlsChange);
document.addEventListener('visibilitychange',onVisibilityChange);

// Populate 4-model switcher cards for active platform (Ascend or NVIDIA)
const modelGrid=$('#modelgrid');
let renderedGridPlatform=null;
function renderModelGrid(vendorKey){
 if(renderedGridPlatform===vendorKey)return;
 renderedGridPlatform=vendorKey;
 modelGrid.replaceChildren();
 const keys=vendorKey==='nvidia'?NVIDIA_KEYS:ASCEND_KEYS;
 $('#modelpickerlabel').textContent=vendorKey==='nvidia'
  ?'NVIDIA 硬件谱系 · 选择机型对照形态与架构'
  :'昇腾硬件谱系 · 选择机型对照形态与架构';
 for(const keyName of keys){
  const m=MODELS[keyName];
  const btn=document.createElement('button');
  btn.type='button';
  btn.dataset.modelKey=keyName;
  btn.innerHTML=`<b>${m.short}</b><small>${m.tag}</small>`;
  btn.onclick=()=>loadModel(keyName);
  modelGrid.append(btn);
 }
}
renderModelGrid(platform);

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
  else if(p.u<=1)pos.multiplyScalar(.92);
 }else if(level===2){
  target.y=Math.max(1.5,p.height*.62+.9);
  if(p.u>=8)pos.multiplyScalar(1.18);
  else if(p.u<=1)pos.multiplyScalar(.94);
  if(isDeployOverlayActive())pos.y+=2.8;
 }else if((level===3||level===4)&&focused){
  const bounds=new THREE.Box3().setFromObject(focused),
   size=bounds.getSize(new THREE.Vector3()),
   extent=Math.max(size.x,size.y,size.z);
  bounds.getCenter(target);
  if(level===4){
   const isPcie=p.file==='atlas-800-3000'||p.file==='h100-nvl-pcie';
   const isSxm=p.file==='dgx-h100'||p.file==='dgx-b200';
   target.set(0,.33,isPcie?-.08:isSxm?.04:-.02);
   const dist=isPcie?2.58:isSxm?2.28:1.95;
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

function configure(o,castMajorOnly=false){
 o.traverse(n=>{
  if(n.isMesh){
   n.receiveShadow=true;
   if(castMajorOnly&&n.geometry){
    if(!n.geometry.boundingBox)n.geometry.computeBoundingBox();
    const bb=n.geometry.boundingBox;
    const sx=bb.max.x-bb.min.x,sy=bb.max.y-bb.min.y,sz=bb.max.z-bb.min.z;
    n.castShadow=Math.max(sx,sy,sz)>0.14&&Math.min(sx,sy,sz)>0.014;
   }else{
    n.castShadow=true;
   }
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
  if(o.userData?.ownGeo)o.geometry?.dispose();
  if(o.userData?.ownMat){
   if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());
   else o.material?.dispose();
  }
  if(o.isInstancedMesh)o.dispose?.();
 });
 g.clear();
}

const RACK_MATS={
 dark:new THREE.MeshStandardMaterial({color:'#1c2622',roughness:.62,metalness:.16}),
 sage:new THREE.MeshStandardMaterial({color:'#43594c',roughness:.64,metalness:.16}),
 silver:new THREE.MeshStandardMaterial({color:'#8c9388',roughness:.45,metalness:.38}),
 portDark:new THREE.MeshStandardMaterial({color:'#0e1513',roughness:.72}),
 copper:new THREE.MeshStandardMaterial({color:'#9b573b',roughness:.42,metalness:.52}),
 slate:new THREE.MeshStandardMaterial({color:'#416876',roughness:.48,metalness:.25}),
 led:new THREE.MeshStandardMaterial({color:'#859d67',roughness:.5}),
 champagne:new THREE.MeshStandardMaterial({color:'#8b7b48',roughness:.44,metalness:.36}),
 vermilion:new THREE.MeshStandardMaterial({color:'#8a3023',roughness:.46,metalness:.22})
};
const UNIT_BOX=new THREE.BoxGeometry(1,1,1);
const GUIDE_DOT_GEO=new THREE.SphereGeometry(.038,8,8);
const GUIDE_DOT_MAT=new THREE.MeshBasicMaterial({color:'#8b6a47'});
const GUIDE_LINE_MAT=new THREE.LineDashedMaterial({color:'#6c7f72',dashSize:.14,gapSize:.10,transparent:true,opacity:.68});
const DEPLOY_PORT_GEO=new THREE.SphereGeometry(.034,10,10);
const DEPLOY_MATS={
 weight:new THREE.MeshStandardMaterial({color:'#c78300',roughness:.44,metalness:.14}),
 kv:new THREE.MeshStandardMaterial({color:'#4c65b6',roughness:.46,metalness:.12}),
 runtime:new THREE.MeshStandardMaterial({color:'#9a4b86',roughness:.48,metalness:.12}),
 oom:new THREE.MeshStandardMaterial({color:'#b54237',roughness:.40,metalness:.10,emissive:'#3d100c'}),
 pedestal:new THREE.MeshStandardMaterial({color:'#efe6cc',roughness:.52,metalness:.18,emissive:'#261906'}),
 pedestalIdle:new THREE.MeshStandardMaterial({color:'#d8dbd2',roughness:.82,metalness:.06,transparent:true,opacity:.72}),
 uCollar:new THREE.MeshStandardMaterial({color:'#17211f',roughness:.55,metalness:.20}),
 outerFrame:new THREE.LineBasicMaterial({color:'#8a928f',transparent:true,opacity:.44}),
 uFrame:new THREE.LineDashedMaterial({color:'#66716d',dashSize:.045,gapSize:.035,transparent:true,opacity:.90}),
 oomFrame:new THREE.LineBasicMaterial({color:'#b54237',transparent:true,opacity:.96}),
 tpArc:new THREE.MeshStandardMaterial({color:'#087f73',roughness:.34,metalness:.18,emissive:'#043832'}),
 ppArc:new THREE.MeshStandardMaterial({color:'#9a4b86',roughness:.38,metalness:.16,emissive:'#2c1125'}),
 dpArc:new THREE.MeshStandardMaterial({color:'#5b75a6',roughness:.36,metalness:.16,emissive:'#16233b'}),
 leaderDash:new THREE.LineDashedMaterial({color:'#6b533b',dashSize:.065,gapSize:.045,transparent:true,opacity:.92}),
 leaderPort:new THREE.MeshBasicMaterial({color:'#a9553e'}),
 tpPort:new THREE.MeshBasicMaterial({color:'#087f73'})
};
const _tmpM4=new THREE.Matrix4(),_tmpPos=new THREE.Vector3(),_tmpQuat=new THREE.Quaternion(),_tmpScl=new THREE.Vector3();
const _tubePt=new THREE.Vector3(),_idleTint=new THREE.Color('#cfd3cb');
const TUBE_SEGS=22,TUBE_RADIAL=6;
function updateTubeGeoInPlace(geom,curve,radius){
 const frames=curve.computeFrenetFrames(TUBE_SEGS,false);
 const posAttr=geom.getAttribute('position'),normAttr=geom.getAttribute('normal');
 const pa=posAttr.array,na=normAttr.array;
 let idx=0;
 for(let i=0;i<=TUBE_SEGS;i++){
  curve.getPointAt(i/TUBE_SEGS,_tubePt);
  const N=frames.normals[i],B=frames.binormals[i];
  for(let j=0;j<=TUBE_RADIAL;j++){
   const v=(j/TUBE_RADIAL)*Math.PI*2,cv=-Math.cos(v),sv=Math.sin(v);
   const nx=cv*N.x+sv*B.x,ny=cv*N.y+sv*B.y,nz=cv*N.z+sv*B.z;
   const len=Math.hypot(nx,ny,nz)||1,ux=nx/len,uy=ny/len,uz=nz/len;
   na[idx]=ux;na[idx+1]=uy;na[idx+2]=uz;
   pa[idx]=_tubePt.x+radius*ux;pa[idx+1]=_tubePt.y+radius*uy;pa[idx+2]=_tubePt.z+radius*uz;
   idx+=3;
  }
 }
 posAttr.needsUpdate=true;
 normAttr.needsUpdate=true;
 geom.computeBoundingSphere();
}

function addInstancedBoxes(parent,mat,specs,castShadow=false){
 if(!specs.length)return;
 const im=new THREE.InstancedMesh(UNIT_BOX,mat,specs.length);
 im.castShadow=castShadow;
 im.receiveShadow=true;
 for(let i=0;i<specs.length;i++){
  const [px,py,pz,sx,sy,sz]=specs[i];
  _tmpPos.set(px,py,pz);
  _tmpScl.set(sx,sy,sz);
  _tmpM4.compose(_tmpPos,_tmpQuat,_tmpScl);
  im.setMatrixAt(i,_tmpM4);
 }
 im.instanceMatrix.needsUpdate=true;
 im.userData.ownGeo=false;
 im.userData.ownMat=false;
 parent.add(im);
}

function addDisposableMesh(parent,geom,mat,pos,rot){
 const m=new THREE.Mesh(geom,mat);
 if(pos)m.position.set(...pos);
 if(rot)m.rotation.set(...rot);
 m.castShadow=true;
 m.receiveShadow=true;
 m.userData.ownGeo=true;
 m.userData.ownMat=false;
 parent.add(m);
 return m;
}

function buildRackAccessories(p){
 const acc=new THREE.Group();
 const bDark=[],bSage=[],bSilver=[],bPort=[],bCopper=[],bSlate=[],bLed=[],bChamp=[];

 if(p.file==='gb200-nvl72'){
  for(let j=0;j<9;j++){
   const sy=6.62+j*0.52;
   (j%2?bDark:bSage).push([0,sy,0,4.78,.42,8.4]);
   bChamp.push([0,sy,4.28,5.02,.40,.04]);
   bPort.push([0,sy,4.315,3.60,.10,.02]);
   bLed.push([2.18,sy,4.315,.10,.10,.02]);
  }
  bSilver.push([-0.62,8.42,-4.48,2.60,15.3,.36]);
  addDisposableMesh(acc,new THREE.CylinderGeometry(.09,.09,16.2,12),RACK_MATS.vermilion,[-2.24,8.6,-4.52]);
  addDisposableMesh(acc,new THREE.CylinderGeometry(.09,.09,16.2,12),RACK_MATS.slate,[-1.98,8.6,-4.52]);
 }else{
  const stackTop=0.75+p.slots*p.u*0.4445;
  for(let y=stackTop+0.44;y<16.85;y+=0.889){
   bDark.push([0,y,4.34,5.02,.82,.04]);
   bSilver.push([0,y,4.375,4.42,.05,.02]);
  }
 }

 for(let i=0;i<2;i++){
  const sy=17.45+i*0.82;
  (i===0?bSage:bDark).push([0,sy,1.22,4.62,.40,6.1]);
  bSilver.push([0,sy,4.34,5.06,.40,.04]);
  for(let j=0;j<16;j++){
   const px=-2.05+j*0.273;
   bSilver.push([px,sy,4.38,.20,.14,.04]);
   bPort.push([px,sy,4.41,.15,.08,.02]);
   (j%2?bCopper:bSlate).push([px+.08,sy,4.435,.025,.08,.03]);
   if(j%3===0)bLed.push([px-.07,sy+.105,4.41,.03,.03,.016]);
  }
  for(const side of [-1,1]){
   const curve=new THREE.CatmullRomCurve3([
    new THREE.Vector3(side*1.45,sy,-1.95),
    new THREE.Vector3(side*2.15,sy-.18,-3.35),
    new THREE.Vector3(side*2.58,sy-.85,-4.42)
   ]);
   addDisposableMesh(acc,new THREE.TubeGeometry(curve,14,.038,8,false),side<0?RACK_MATS.copper:RACK_MATS.slate);
  }
 }
 addInstancedBoxes(acc,RACK_MATS.dark,bDark,true);
 addInstancedBoxes(acc,RACK_MATS.sage,bSage,true);
 addInstancedBoxes(acc,RACK_MATS.silver,bSilver,false);
 addInstancedBoxes(acc,RACK_MATS.portDark,bPort,false);
 addInstancedBoxes(acc,RACK_MATS.copper,bCopper,false);
 addInstancedBoxes(acc,RACK_MATS.slate,bSlate,false);
 addInstancedBoxes(acc,RACK_MATS.led,bLed,false);
 addInstancedBoxes(acc,RACK_MATS.champagne,bChamp,false);
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
    const targetHex=o.userData.deployEmissive!==undefined?o.userData.deployEmissive:o.userData.origEmissive;
    o.material.emissive?.setHex(targetHex);
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
      o.userData.ownMat=true;
      o.userData.ownGeo=false;
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

const GUIDE_KINDS=new Set(['host','board','cooling','nvswitch','fans','drives','network','psu','bus']);
let guideDotsMesh=null,guideLinesObj=null;
function rebuildGuides(){
 if(level!==2||spread<.04||!server){
  if(guideDotsMesh)guideDotsMesh.visible=false;
  if(guideLinesObj)guideLinesObj.visible=false;
  return;
 }
 if(!guideDotsMesh){
  guideDotsMesh=new THREE.InstancedMesh(GUIDE_DOT_GEO,GUIDE_DOT_MAT,24);
  guideDotsMesh.castShadow=false;
  guideDotsMesh.receiveShadow=false;
  guideRoot.add(guideDotsMesh);
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(24*6),3));
  guideLinesObj=new THREE.LineSegments(g,GUIDE_LINE_MAT);
  guideLinesObj.frustumCulled=false;
  guideRoot.add(guideLinesObj);
 }
 server.updateMatrixWorld(true);
 const posAttr=guideLinesObj.geometry.getAttribute('position');
 const arr=posAttr.array;
 let count=0;
 _tmpScl.set(1,1,1);
 for(const part of parts){
  if(!GUIDE_KINDS.has(part.userData.kind)||count>=24)continue;
  const u=part.userData,h=u.home;
  if(!h||(!(u.explodeZ||0)&&!(u.explodeY||0)))continue;
  const parentWorld=part.parent.matrixWorld;
  const pHome=h.clone().applyMatrix4(parentWorld);
  const pCur=part.position.clone().applyMatrix4(parentWorld);
  if(pHome.distanceTo(pCur)<.08)continue;
  const base=count*6;
  arr[base]=pHome.x;arr[base+1]=pHome.y;arr[base+2]=pHome.z;
  arr[base+3]=pCur.x;arr[base+4]=pCur.y;arr[base+5]=pCur.z;
  _tmpM4.compose(pHome,_tmpQuat,_tmpScl);
  guideDotsMesh.setMatrixAt(count,_tmpM4);
  count++;
 }
 guideDotsMesh.count=count;
 guideDotsMesh.visible=count>0;
 guideLinesObj.visible=count>0;
 if(count>0){
  guideDotsMesh.instanceMatrix.needsUpdate=true;
  posAttr.needsUpdate=true;
  guideLinesObj.geometry.setDrawRange(0,count*2);
  guideLinesObj.computeLineDistances();
 }
}

let deployColEntries=[],deployArcEntries=[],activeDeployPartSet=new Set();
function isDeployOverlayActive(){
 return Boolean(deployPlan&&level===2&&currentModel===deployPlan.targetModel&&server);
}
function clearDeployLabels(){
 const host=$('#deploy-labels'),tags=$('#deploy-label-tags'),lines=$('#deploy-label-lines');
 if(tags)tags.replaceChildren();
 if(lines)lines.replaceChildren();
 if(host)host.hidden=true;
}
function ensureCloneMat(mesh){
 if(!mesh.userData.deployMatCloned&&mesh.material){
  mesh.material=mesh.material.clone();
  mesh.userData.deployMatCloned=true;
  mesh.userData.ownMat=true;
  mesh.userData.ownGeo=false;
  if(mesh.userData.origEmissive===undefined&&mesh.material.emissive){
   mesh.userData.origEmissive=mesh.material.emissive.getHex();
  }
  if(mesh.material.color)mesh.userData.origBaseColor=mesh.material.color.getHex();
  mesh.userData.origOpacity=mesh.material.opacity;
  mesh.userData.origTransparent=mesh.material.transparent;
  mesh.userData.origDepthWrite=mesh.material.depthWrite;
 }
}
let hasSyncedDeployMats=false;
function syncDeployServerMaterials(active){
 if(!server)return;
 if(!active&&!hasSyncedDeployMats)return;
 if(active)hasSyncedDeployMats=true;
 for(const part of parts){
  const kind=part.userData.kind;
  if(kind==='cooling'){
   part.traverse(m=>{
    if(!m.isMesh||!m.material)return;
    ensureCloneMat(m);
    if(active){
     m.material.transparent=true;
     m.material.opacity=.24;
     m.material.depthWrite=false;
    }else{
     m.material.transparent=m.userData.origTransparent;
     m.material.opacity=m.userData.origOpacity;
     m.material.depthWrite=m.userData.origDepthWrite;
    }
   });
  }else if(kind==='npu'){
   const slotActive=activeDeployPartSet.has(part);
   part.traverse(m=>{
    if(!m.isMesh||!m.material)return;
    ensureCloneMat(m);
    if(active){
     if(m.material.color&&m.userData.origBaseColor!==undefined){
      m.material.color.setHex(m.userData.origBaseColor);
      if(!slotActive)m.material.color.lerp(_idleTint,.44);
     }
     m.userData.deployEmissive=slotActive?0x221606:0x000000;
     if(hoveredPart!==part)m.material.emissive?.setHex(m.userData.deployEmissive);
    }else{
     if(m.material.color&&m.userData.origBaseColor!==undefined)m.material.color.setHex(m.userData.origBaseColor);
     m.userData.deployEmissive=undefined;
     if(hoveredPart!==part&&m.userData.origEmissive!==undefined)m.material.emissive?.setHex(m.userData.origEmissive);
    }
   });
  }
 }
}

function computePartLocalTopY(part){
 part.updateMatrixWorld(true);
 const inv=part.matrixWorld.clone().invert(),box=new THREE.Box3(),sub=new THREE.Box3();
 part.traverse(m=>{
  if(!m.isMesh||!m.geometry)return;
  if(!m.geometry.boundingBox)m.geometry.computeBoundingBox();
  sub.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld).applyMatrix4(inv);
  box.union(sub);
 });
 return Number.isFinite(box.max.y)?box.max.y:.62;
}
function addOverlayMesh(parent,geo,mat,x,y,z){
 const m=new THREE.Mesh(geo,mat);
 m.position.set(x,y,z);
 m.castShadow=false;m.receiveShadow=false;
 m.userData.ownGeo=true;m.userData.ownMat=false;
 parent.add(m);
 return m;
}
function addOverlayEdges(parent,w,h,d,mat,yc,dashed){
 const b=new THREE.BoxGeometry(w,h,d),eg=new THREE.EdgesGeometry(b);
 b.dispose();
 const ls=new THREE.LineSegments(eg,mat);
 ls.position.y=yc;ls.frustumCulled=false;
 ls.userData.ownGeo=true;ls.userData.ownMat=false;
 if(dashed)ls.computeLineDistances();
 parent.add(ls);
 return ls;
}
function buildDeployOverlay(){
 disposeGroup(overlayRoot);
 clearDeployLabels();
 deployColEntries=[];deployArcEntries=[];activeDeployPartSet=new Set();
 if(!deployPlan||currentModel!==deployPlan.targetModel||!server)return;
 const npuParts=parts.filter(o=>o.userData.kind==='npu').map(o=>{
  const m=o.name.match(/(?:npu|card)(\d+)$/i);
  return {part:o,idx:m?Number(m[1]):999};
 }).sort((a,b)=>a.idx-b.idx);
 const labelsHost=$('#deploy-label-tags')||$('#deploy-labels'),linesSvg=$('#deploy-label-lines');
 const C=deployPlan.cardGiB,u=deployPlan.u,budgetGiB=u*C;
 const usedGiB=deployPlan.weightGiB+deployPlan.kvGiB+deployPlan.runtimeGiB;
 const explicitHeadroomRisk=(deployPlan.oomStatus==='headroom_risk'||Boolean(deployPlan.headroomRisk))&&!deployPlan.headroomOverflow&&deployPlan.oomStatus!=='headroom_overflow';
 const physOverflow=!explicitHeadroomRisk&&usedGiB>C+.005;
 const hardBudgetOom=['weights_exceed_budget','weights_plus_activation_exceed_budget','non_kv_exceeds_budget','headroom_overflow'].includes(deployPlan.oomStatus);
 const budgetOverflow=!physOverflow&&(hardBudgetOom||Boolean(deployPlan.headroomOverflow)||deployPlan.weightGiB+deployPlan.kvGiB>budgetGiB+.02);
 const isOom=physOverflow||budgetOverflow;
 const isWarn=!isOom&&(deployPlan.oomStatus!=='fits'||explicitHeadroomRisk);
 const innerGroup=deployPlan.tp*deployPlan.pcp,repStride=innerGroup*deployPlan.pp;
 for(let slot=0;slot<deployPlan.physicalSlots;slot++){
  const entryItem=npuParts[slot];
  if(!entryItem)continue;
  const part=entryItem.part,topY=computePartLocalTopY(part);
  const displacedDir=deployPlan.displaced.includes(slot)?(slot===0?-1:1):0;
  let slotHasActive=false;
  for(let d=0;d<deployPlan.diesPerSlot;d++){
   if(slot*deployPlan.diesPerSlot+d<deployPlan.localRanks)slotHasActive=true;
  }
  if(slotHasActive)activeDeployPartSet.add(part);
  for(let d=0;d<deployPlan.diesPerSlot;d++){
   const rank=slot*deployPlan.diesPerSlot+d,active=rank<deployPlan.localRanks;
   if(!active&&!slotHasActive)continue;
   const isPcie=deployPlan.partPrefix==='card',isDualNpu=deployPlan.diesPerSlot===2&&!isPcie;
   const lx=isDualNpu?(d===0?-.19:.19):(isPcie?.06:0),lz=isPcie?(d===0?-.48:.36):.02;
   const colW=isDualNpu?.23:(isPcie?.25:.34),colD=isDualNpu?.27:(isPcie?.30:.34),fullH=isPcie?.88:(isDualNpu?.92:.96);
   const colGroup=new THREE.Group();
   overlayRoot.add(colGroup);
   if(!active){
    addOverlayMesh(colGroup,new THREE.BoxGeometry(colW+.04,.024,colD+.04),DEPLOY_MATS.pedestalIdle,0,.012,0);
    addOverlayEdges(colGroup,colW,.20*fullH,colD,DEPLOY_MATS.outerFrame,.03+.10*fullH,false);
    deployColEntries.push({rank,active:false,part,slot,isPcie,localAnchor:new THREE.Vector3(lx,topY+.045,lz),displacedDir,colGroup,portDot:null,leaderLine:null,cardPortDot:null,tagEl:null,capTopY:.25});
    continue;
   }
   addOverlayMesh(colGroup,new THREE.BoxGeometry(colW+.06,.032,colD+.06),DEPLOY_MATS.pedestal,0,.016,0);
   const portDot=new THREE.Mesh(DEPLOY_PORT_GEO,deployPlan.tp>1?DEPLOY_MATS.tpPort:DEPLOY_MATS.uCollar);
   portDot.position.set(0,.034,isPcie?0:(slot<4?.14:-.14));
   portDot.userData.ownGeo=false;portDot.userData.ownMat=false;
   colGroup.add(portDot);
   const yBase=.040;
   let curGiB=0;
   for(const [gib,mat] of [[deployPlan.weightGiB,DEPLOY_MATS.weight],[deployPlan.kvGiB,DEPLOY_MATS.kv],[deployPlan.runtimeGiB,DEPLOY_MATS.runtime]]){
    const lo=Math.min(curGiB,C),hi=Math.min(curGiB+gib,C);
    curGiB+=gib;
    if(hi-lo>.004*C){
     const h=((hi-lo)/C)*fullH,visH=Math.max(.010,h-.004);
     addOverlayMesh(colGroup,new THREE.BoxGeometry(colW,visH,colD),mat,0,yBase+(lo/C)*fullH+h*.5,0);
    }
   }
   addOverlayEdges(colGroup,colW+.012,fullH,colD+.012,DEPLOY_MATS.outerFrame,yBase+fullH*.5,false);
   addOverlayMesh(colGroup,new THREE.BoxGeometry(colW+.028,.014,colD+.028),DEPLOY_MATS.uCollar,0,yBase+u*fullH,0);
   const remH=Math.max(.024,(1-u)*fullH);
   addOverlayEdges(colGroup,colW+.020,remH,colD+.020,isOom?DEPLOY_MATS.oomFrame:DEPLOY_MATS.uFrame,yBase+u*fullH+remH*.5,!isOom);
   let capTopY=yBase+fullH+.03;
   if(physOverflow){
    const oomRatio=(usedGiB-C)/C;
    const oomH=Math.min(.48*fullH,Math.max(.045*fullH,oomRatio*fullH));
    addOverlayMesh(colGroup,new THREE.BoxGeometry(colW+.024,oomH,colD+.024),DEPLOY_MATS.oom,0,yBase+fullH+.010+oomH*.5,0);
    capTopY=yBase+fullH+.024+oomH;
   }else if(isOom){
    const overLo=budgetGiB,overHi=Math.min(C,Math.max(usedGiB,budgetGiB+.045*C));
    const overH=Math.max(.022,((overHi-overLo)/C)*fullH);
    addOverlayMesh(colGroup,new THREE.BoxGeometry(colW+.016,overH,colD+.016),DEPLOY_MATS.oom,0,yBase+(overLo/C)*fullH+overH*.5,0);
   }
   let leaderLine=null,cardPortDot=null;
   if(displacedDir!==0){
    const lg=new THREE.BufferGeometry();
    lg.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(9),3));
    lg.setAttribute('lineDistance',new THREE.Float32BufferAttribute(new Float32Array(3),1));
    leaderLine=new THREE.Line(lg,DEPLOY_MATS.leaderDash);
    leaderLine.frustumCulled=false;leaderLine.userData.ownGeo=true;leaderLine.userData.ownMat=false;
    overlayRoot.add(leaderLine);
    cardPortDot=new THREE.Mesh(DEPLOY_PORT_GEO,DEPLOY_MATS.leaderPort);
    cardPortDot.userData.ownGeo=false;cardPortDot.userData.ownMat=false;
    overlayRoot.add(cardPortDot);
   }
   const ppStage=Math.floor((rank%repStride)/innerGroup);
   const tag=document.createElement('div');
   tag.className='deploy-rank-tag'+(isOom?' is-oom':'');
   const dieTag=deployPlan.diesPerSlot>1?(isPcie?`·C${d}`:`·D${d}`):'';
   const ppTag=deployPlan.pp>1?`·P${ppStage}`:'';
   const tagFull=`R${rank}${dieTag}${ppTag}${isOom?' !':(isWarn?' ?':'')}`;
   const tagCompact=`R${rank}${isOom?'!':(isWarn?'?':'')}`;
   tag.textContent=tagFull;
   labelsHost.append(tag);
   let tickEl=null;
   if(linesSvg){
    tickEl=document.createElementNS(NS,'path');
    tickEl.setAttribute('fill','none');
    tickEl.setAttribute('stroke','#7b6a55');
    tickEl.setAttribute('stroke-width','1.2');
    tickEl.setAttribute('stroke-dasharray','2.5 2');
    linesSvg.append(tickEl);
   }
   deployColEntries.push({rank,active:true,part,slot,isPcie,localAnchor:new THREE.Vector3(lx,topY+.045,lz),displacedDir,colGroup,portDot,leaderLine,cardPortDot,tagEl:tag,tickEl,tagFull,tagCompact,capTopY});
  }
 }
 const dummyCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(0,.2,0),new THREE.Vector3(.2,0,0)]);
 const addArc=(fromRank,toRank,kind)=>{
  const radius=kind==='tp'?.022:(kind==='dp'?.015:.017);
  const mat=kind==='tp'?DEPLOY_MATS.tpArc:(kind==='dp'?DEPLOY_MATS.dpArc:DEPLOY_MATS.ppArc);
  const geo=new THREE.TubeGeometry(dummyCurve,TUBE_SEGS,radius,TUBE_RADIAL,false);
  const mesh=new THREE.Mesh(geo,mat);
  mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;
  mesh.userData.ownGeo=true;mesh.userData.ownMat=false;
  overlayRoot.add(mesh);
  deployArcEntries.push({fromRank,toRank,kind,radius,mesh});
 };
 if(deployPlan.tp>1){
  for(let r=0;r+1<deployPlan.localRanks;r++){
   if(Math.floor(r/deployPlan.tp)===Math.floor((r+1)/deployPlan.tp))addArc(r,r+1,'tp');
  }
 }
 if(deployPlan.pp>1){
  for(let r=0;r+innerGroup<deployPlan.localRanks;r+=innerGroup){
   if(r%innerGroup===0&&Math.floor(r/repStride)===Math.floor((r+innerGroup)/repStride))addArc(r,r+innerGroup,'pp');
  }
 }
 if(deployPlan.dp>1){
  const dpKind=deployPlan.ep?'ep':'dp';
  for(let r=0;r+repStride<deployPlan.localRanks;r+=repStride){
   if(r%repStride===0)addArc(r,r+repStride,dpKind);
  }
 }
}

const _rankPorts=new Map();
function updateDeployOverlayPositions(){
 const active=isDeployOverlayActive();
 overlayRoot.visible=active;
 syncDeployServerMaterials(active);
 if(!active){
  const host=$('#deploy-labels');
  if(host)host.hidden=true;
  return;
 }
 $('#deploy-labels').hidden=false;
 server.updateMatrixWorld(true);
 _rankPorts.clear();
 for(const item of deployColEntries){
  const portWorld=item.localAnchor.clone().applyMatrix4(item.part.matrixWorld);
  if(item.displacedDir===0){
   item.colGroup.position.copy(portWorld);
  }else{
   const dx=item.displacedDir<0?-1.10:.96;
   const colY=Math.max(portWorld.y+.14,server.position.y+.96);
   item.colGroup.position.set(portWorld.x+dx,colY,portWorld.z);
   if(item.cardPortDot)item.cardPortDot.position.set(portWorld.x,portWorld.y-.02,portWorld.z);
   if(item.leaderLine){
    const arr=item.leaderLine.geometry.getAttribute('position').array;
    const x0=portWorld.x,y0=portWorld.y-.02,z0=portWorld.z;
    const x1=portWorld.x+dx*.75,y1=portWorld.y+.03,z1=portWorld.z;
    const x2=item.colGroup.position.x,y2=item.colGroup.position.y+.016,z2=item.colGroup.position.z;
    arr[0]=x0;arr[1]=y0;arr[2]=z0;
    arr[3]=x1;arr[4]=y1;arr[5]=z1;
    arr[6]=x2;arr[7]=y2;arr[8]=z2;
    item.leaderLine.geometry.getAttribute('position').needsUpdate=true;
    const distAttr=item.leaderLine.geometry.getAttribute('lineDistance');
    if(distAttr){
     const da=distAttr.array;
     da[0]=0;
     da[1]=Math.hypot(x1-x0,y1-y0,z1-z0);
     da[2]=da[1]+Math.hypot(x2-x1,y2-y1,z2-z1);
     distAttr.needsUpdate=true;
    }
   }
  }
  if(item.active&&item.portDot){
   item.colGroup.updateMatrixWorld(true);
   const pPos=new THREE.Vector3().setFromMatrixPosition(item.portDot.matrixWorld);
   _rankPorts.set(item.rank,{pos:pPos,slot:item.slot,isPcie:item.isPcie});
  }
 }
 for(const arc of deployArcEntries){
  const a=_rankPorts.get(arc.fromRank),b=_rankPorts.get(arc.toRank);
  if(!a||!b){arc.mesh.visible=false;continue;}
  arc.mesh.visible=true;
  const pA=a.pos,pB=b.pos,hd=Math.hypot(pB.x-pA.x,pB.z-pA.z);
  const midX=(pA.x+pB.x)*.5,midZ=(pA.z+pB.z)*.5;
  const lift=(arc.kind==='tp'?.20:.38)+hd*.11;
  const bowZ=!a.isPcie&&Math.abs(pA.z-pB.z)<.3?(a.slot<4?.22:.24):0;
  const bowX=a.isPcie&&Math.abs(pA.x-pB.x)<.2?(pA.x<0?-.18:.18):0;
  const cMid=new THREE.Vector3(midX+bowX,Math.max(pA.y,pB.y)+lift,midZ+bowZ);
  const curve=new THREE.CatmullRomCurve3([pA,cMid,pB]);
  updateTubeGeoInPlace(arc.mesh.geometry,curve,arc.radius);
 }
 projectDeployLabels();
}

function projectDeployLabels(){
 if(!isDeployOverlayActive()||!deployColEntries.length)return;
 const rect=$('#stage').getBoundingClientRect();
 const w=rect.width||1,h=rect.height||1,compact=w<540;
 const linesSvg=$('#deploy-label-lines');
 if(linesSvg)linesSvg.setAttribute('viewBox',`0 0 ${w} ${h}`);
 const vis=[];
 for(const item of deployColEntries){
  if(!item.active||!item.tagEl)continue;
  const world=item.colGroup.position.clone();
  world.y+=item.capTopY;
  const ndc=world.project(camera);
  if(ndc.z>1){
   item.tagEl.style.display='none';
   if(item.tickEl)item.tickEl.setAttribute('d','');
   continue;
  }
  const txt=compact?item.tagCompact:item.tagFull;
  if(item.tagEl.textContent!==txt)item.tagEl.textContent=txt;
  item.tagEl.style.display='';
  const ax=(ndc.x*.5+.5)*w,ay=(-ndc.y*.5+.5)*h;
  const halfW=Math.max(15,txt.length*3.7+(compact?5:8));
  vis.push({item,ax,ay,tx:ax,ty:ay-(item.rank%2===0?14:3),halfW});
 }
 const tagH=compact?17:20;
 vis.sort((a,b)=>a.ay-b.ay||a.ax-b.ax);
 for(let pass=0;pass<6;pass++){
  for(let i=0;i<vis.length;i++){
   for(let j=i+1;j<vis.length;j++){
    const a=vis[i],b=vis[j];
    const minX=a.halfW+b.halfW+4,dx=b.tx-a.tx,dy=b.ty-a.ty;
    if(Math.abs(dx)<minX&&Math.abs(dy)<tagH){
     const pushY=(tagH-Math.abs(dy))*.55+1;
     if(a.ty<=b.ty){a.ty-=pushY;b.ty+=pushY*.35;}else{b.ty-=pushY;a.ty+=pushY*.35;}
     const sign=dx>=0?1:-1;
     a.tx-=sign*2.8;b.tx+=sign*2.8;
    }
   }
  }
 }
 for(const v of vis){
  const cx=THREE.MathUtils.clamp(v.tx,v.halfW+6,w-v.halfW-6);
  const cy=THREE.MathUtils.clamp(v.ty,22,h-10);
  v.item.tagEl.style.left=`${cx.toFixed(1)}px`;
  v.item.tagEl.style.top=`${cy.toFixed(1)}px`;
  if(v.item.tickEl){
   if(Math.hypot(cx-v.ax,cy-v.ay)>6){
    v.item.tickEl.setAttribute('d',`M${v.ax.toFixed(1)},${v.ay.toFixed(1)} L${cx.toFixed(1)},${(cy+1).toFixed(1)}`);
   }else v.item.tickEl.setAttribute('d','');
  }
 }
}

function updateDeployBanner(){
 const banner=$('#deploy-banner');
 if(!banner)return;
 if(!deployPlan){
  banner.hidden=true;
  delete document.body.dataset.deploy;
  return;
 }
 document.body.dataset.deploy='true';
 banner.hidden=false;
 banner.replaceChildren();
 const targetInfo=MODELS[deployPlan.targetModel];
 if(currentModel!==deployPlan.targetModel){
  const head=document.createElement('div');
  head.className='deploy-banner-head';
  const title=document.createElement('div');
  title.className='deploy-banner-title';
  const mp=document.createElement('span');mp.className='deploy-pill';mp.textContent=deployPlan.modelName;
  const txt=document.createElement('span');
  txt.textContent=`当前浏览 ${MODELS[currentModel].name}（原部署方案对应 ${targetInfo.name}，已自动隐藏显存染色柱）`;
  title.append(mp,txt);
  const btn=document.createElement('button');
  btn.type='button';btn.className='deploy-action-btn';btn.dataset.testid='deploy-restore-model';
  btn.textContent='已切换硬件视图 · 点击切回原部署机型';
  btn.onclick=async()=>{
   if(level!==2)level=2;
   await loadModel(deployPlan.targetModel);
  };
  head.append(title,btn);
  banner.append(head);
  return;
 }
 const topoParts=[`TP=${deployPlan.tp}`];
 if(deployPlan.pp>1)topoParts.push(`PP=${deployPlan.pp}`);
 if(deployPlan.dp>1)topoParts.push(`DP=${deployPlan.dp}`);
 if(deployPlan.pcp>1)topoParts.push(`PCP=${deployPlan.pcp}`);
 if(deployPlan.dcp>1)topoParts.push(`DCP=${deployPlan.dcp}`);
 if(deployPlan.ep)topoParts.push('EP=开');
 const used=deployPlan.weightGiB+deployPlan.kvGiB+deployPlan.runtimeGiB;
 const headroom=Math.max(0,deployPlan.cardGiB-used);
 const explicitHeadroomRisk=(deployPlan.oomStatus==='headroom_risk'||Boolean(deployPlan.headroomRisk))&&!deployPlan.headroomOverflow&&deployPlan.oomStatus!=='headroom_overflow';
 const physOver=!explicitHeadroomRisk&&used>deployPlan.cardGiB+.005;
 const hardBudgetOom=['weights_exceed_budget','weights_plus_activation_exceed_budget','non_kv_exceeds_budget','headroom_overflow'].includes(deployPlan.oomStatus);
 const isOom=physOver||hardBudgetOom||Boolean(deployPlan.headroomOverflow)||deployPlan.weightGiB+deployPlan.kvGiB>deployPlan.u*deployPlan.cardGiB+.02;
 const hasAdmissionOrTightWarn=['insufficient_for_single_max_len_seq','tight_budget_oom_risk'].includes(deployPlan.oomStatus);
 const hasHeadroomRisk=!isOom&&explicitHeadroomRisk;
 const head=document.createElement('div');head.className='deploy-banner-head';
 const title=document.createElement('div');title.className='deploy-banner-title';
 const pModel=document.createElement('span');pModel.className='deploy-pill';pModel.textContent=`${deployPlan.modelName} · ${topoParts.join(' · ')}`;
 const pNode=document.createElement('span');
 if(deployPlan.totalRanks>deployPlan.ranksPerNode){
  pNode.className='deploy-pill is-multinode';
  pNode.textContent=`共 ${deployPlan.totalRanks} Ranks（跨 ${deployPlan.nodeCount} 台整机 · 当前展示第 1 节点本机槽位）`;
 }else{
  pNode.className='deploy-pill is-tp';
  const dualTxt=deployPlan.diesPerSlot>1?` · 单槽双${deployPlan.dieWord}`:'';
  pNode.textContent=`本机 ${deployPlan.totalRanks}/${deployPlan.ranksPerNode} 逻辑 Ranks（激活 ${deployPlan.activePhysicalSlots}/${deployPlan.physicalSlots} 物理槽${dualTxt}）`;
 }
 title.append(pModel,pNode);
 if(isOom){
  const pOom=document.createElement('span');pOom.className='deploy-pill is-oom';
  const oomLabel=hardBudgetOom?DEPLOY_OOM_LABELS[deployPlan.oomStatus]:(deployPlan.headroomOverflow||physOver?DEPLOY_OOM_LABELS.headroom_overflow:'超出 u 预算上限');
  pOom.textContent=`OOM 超支：${oomLabel}`;
  title.append(pOom);
 }
 if(hasAdmissionOrTightWarn){
  const pWarn=document.createElement('span');pWarn.className='deploy-pill is-multinode';
  pWarn.textContent=`容量/准入告警：${DEPLOY_OOM_LABELS[deployPlan.oomStatus]}`;
  title.append(pWarn);
 }
 if(hasHeadroomRisk){
  const pRisk=document.createElement('span');pRisk.className='deploy-pill is-multinode';
  pRisk.textContent=`录图告警：${DEPLOY_OOM_LABELS.headroom_risk}`;
  title.append(pRisk);
 }
 head.append(title);
 if(level!==2){
  const lBtn=document.createElement('button');
  lBtn.type='button';lBtn.className='deploy-action-btn';
  lBtn.textContent='切至「展开内部」查看 3D 显存柱 →';
  lBtn.onclick=()=>setLevel(2);
  head.append(lBtn);
 }
 const metrics=document.createElement('div');metrics.className='deploy-banner-metrics';
 metrics.innerHTML=`<span>单 Rank 容量 <b>${deployPlan.cardGiB} GiB</b> (u=${deployPlan.u.toFixed(2)})</span><span>常驻权重 <b>${deployPlan.weightGiB.toFixed(2)} GiB</b></span><span>可用 KV <b>${deployPlan.kvGiB.toFixed(2)} GiB</b></span><span>运行态/图/HCCL <b>${deployPlan.runtimeGiB.toFixed(2)} GiB</b></span><span>物理余量 <b>${headroom.toFixed(2)} GiB</b></span>`;
 const legend=document.createElement('div');legend.className='deploy-legend';
 const items=[['#c78300','权重','box'],['#4c65b6','KV Cache','box'],['#9a4b86','运行态/录图/HCCL','box'],['','1−u 预留虚框','u']];
 if(deployPlan.tp>1)items.push(['#087f73','TP 组内通信','arc']);
 if(deployPlan.pp>1||(deployPlan.dp>1&&deployPlan.ep))items.push(['#9a4b86','PP/EP 跨组互联','arc']);
 if(deployPlan.dp>1&&!deployPlan.ep)items.push(['#5b75a6','DP 副本分组','arc']);
 if(isOom)items.push(['#b54237',physOver?'超出物理显存 OOM':'越过 u 预算上限警示','box']);
 for(const [col,lbl,shape] of items){
  const sw=document.createElement('span');sw.className='deploy-swatch';
  const ic=document.createElement('i');
  if(shape==='u')ic.className='is-u';
  else if(shape==='arc'){ic.className='is-arc';ic.style.background=col;}
  else ic.style.background=col;
  sw.append(ic,document.createTextNode(lbl));
  legend.append(sw);
 }
 banner.append(head,metrics,legend);
}

function rebuild(){
 clearHover();
 hasSyncedDeployMats=false;
 disposeGroup(cabinetRoot);
 disposeGroup(serverRoot);
 disposeGroup(focusRoot);
 disposeGroup(overlayRoot);
 clearDeployLabels();
 deployColEntries=[];deployArcEntries=[];activeDeployPartSet=new Set();
 if(guideDotsMesh)guideDotsMesh.visible=false;
 if(guideLinesObj)guideLinesObj.visible=false;
 const p=MODELS[currentModel];
 cabinet=configure(templates.cabinet.clone(true),true);
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
  const trayY=p.file==='gb200-nvl72'
   ?(i<10?0.75+i*0.56:11.45+(i-10)*0.56)
   :(0.75+i*p.u*.4445);
  shell.position.set(0,trayY,0);
  configure(shell,true);
  servers.add(shell);
 }
 cabinetRoot.add(buildRackAccessories(p));

 server=configure(templates[currentModel].clone(true),true);
 server.position.y=.23;
 serverRoot.add(server);
 collect();
 buildDeployOverlay();
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
   if(isDeployOverlayActive()&&MODELS[currentModel]?.u>=8&&(u.kind==='npu'||u.kind==='board')){
    o.position.y+=1.35*spread;
   }
  }
  if(u.kind==='lid')o.visible=level!==2;
 });
 rebuildGuides();
 updateDeployOverlayPositions();

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
 focused=configure(part.clone(true),true);
 focused.position.set(0,.23,0);
 focusRoot.add(focused);
 focused.traverse(o=>{
  if(o.isMesh){
   o.userData.ownGeo=false;
   if(o.userData.ownMat){
    o.material=o.material.clone();
    if(o.userData.origEmissive!==undefined)o.material.emissive?.setHex(o.userData.origEmissive);
   }
  }
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
 if(level!==2)syncDeployServerMaterials(false);
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
 renderModelGrid(platform);
 $('#modelpicker').hidden=false;
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

 const factRows=(level===0?p.rackFacts:p.serverFacts).map(([k,v])=>
  deployPlan&&deployPlan.targetModel===currentModel&&deployPlan.cardId==='a2-32g'&&k==='单卡显存'
   ?[k,'32 GB HBM (910B4 档)']
   :[k,v]
 );
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
 updateDeployBanner();
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
 loadModel(v==='nvidia'?lastNvidiaModel:lastAscendModel);
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
const onControlsStart=()=>animation=null;
controls.addEventListener('start',onControlsStart);

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

const onPointerDown=e=>{down=[e.clientX,e.clientY];};
const onPointerMove=e=>{
 if(viewerDisposed||!ready||level!==2||down)return;
 setHover(raycastPart(e),e.clientX,e.clientY);
};
const onPointerLeave=()=>clearHover();
const onPointerUp=e=>{
 const start=down;
 down=null;
 if(viewerDisposed||!ready||level!==2||!start||Math.hypot(e.clientX-start[0],e.clientY-start[1])>5)return;
 const picked=raycastPart(e);
 if(picked){
  selection=picked;
  setLevel(3);
 }
};
renderer.domElement.addEventListener('pointerdown',onPointerDown);
renderer.domElement.addEventListener('pointermove',onPointerMove);
renderer.domElement.addEventListener('pointerleave',onPointerLeave);
renderer.domElement.addEventListener('pointerup',onPointerUp);

function resize(){
 if(viewerDisposed)return;
 const stageEl=$('#stage');
 if(SITE&&!stageEl)return;
 const box=SITE?stageEl.getBoundingClientRect():{width:innerWidth,height:innerHeight};
 const w=Math.max(1,box.width),h=Math.max(1,box.height);
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5,Math.sqrt(2600000/(w*h))));
 renderer.setSize(w,h);
 camera.aspect=w/h;
 camera.updateProjectionMatrix();
 projectCallouts();
 projectDeployLabels();
 invalidate();
}
let stageResizeObserver=null;
if(SITE){
 stageResizeObserver=new ResizeObserver(resize);
 stageResizeObserver.observe(document.getElementById('stage'));
}else{
 addEventListener('resize',resize);
}
resize();
camera.position.set(24.5,21.5,35.5);
controls.target.set(0,9.2,0);

const loader=new GLTFLoader(),pendingTemplates=new Map();
const retryLoad=document.createElement('button');
retryLoad.textContent='重试加载';
retryLoad.hidden=true;
$('#loading').append(retryLoad);

function loadTemplate(keyName){
 if(viewerDisposed)return Promise.resolve(null);
 if(templates[keyName])return Promise.resolve(templates[keyName]);
 if(!pendingTemplates.has(keyName)){
  const file=keyName==='cabinet'?'cabinet-42u':MODELS[keyName].file;
  pendingTemplates.set(
   keyName,
   loader.loadAsync('./assets/'+file+'.glb').then(gltf=>{
    const mesh=gltf.scene.children[0];
    if(viewerDisposed){
     disposeGroup(mesh);
     pendingTemplates.delete(keyName);
     return null;
    }
    templates[keyName]=mesh;
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
 if(viewerDisposed||!MODELS[nextKey])return;
 if(ready&&nextKey===currentModel)return;
 const request=++modelLoadSeq;
 const loadingEl=$('#loading');
 const cached=Boolean(templates.cabinet&&templates[nextKey]);
 ready=false;
 if(!cached){
  loadingEl.dataset.mode=hasLoadedOnce?'switching':'initial';
  loadingEl.hidden=false;
  $('#loading b').textContent=hasLoadedOnce?'正在切换硬件':'正在载入硬件';
  $('#loading span').textContent=MODELS[nextKey].name;
  retryLoad.hidden=true;
 }
 try{
  if(!cached)await Promise.all([loadTemplate('cabinet'),loadTemplate(nextKey)]);
  if(viewerDisposed||request!==modelLoadSeq)return;
  currentModel=nextKey;
  if(MODELS[nextKey].vendor==='ascend')lastAscendModel=nextKey;
  else lastNvidiaModel=nextKey;
  platform=MODELS[nextKey].vendor;
  rebuild();
  ready=true;
  hasLoadedOnce=true;
  delete loadingEl.dataset.mode;
  loadingEl.hidden=true;
  window.__wholeReady=true;
  try{window.parent?.postMessage({source:'infer-lab-experience',type:'ready',viewId:'hardware'},'*');}catch{}
 }catch(error){
  if(viewerDisposed||request!==modelLoadSeq)return;
  loadingEl.dataset.mode='error';
  loadingEl.hidden=false;
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
 if(viewerDisposed)return;
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
 if(level===2)projectDeployLabels();
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

function onPageHide(e){if(!e.persisted)disposeViewer();}
function onWindowMessage(e){
 if(e.origin&&e.origin!==location.origin)return;
 if(e.data?.type==='dispose')disposeViewer();
}

function disposeViewer(){
 if(viewerDisposed)return;
 viewerDisposed=true;
 ready=false;
 window.__wholeReady=false;
 modelLoadSeq+=1;
 cancelAnimationFrame(renderRequest);
 renderRequest=0;
 stageResizeObserver?.disconnect();
 stageResizeObserver=null;
 removeEventListener('resize',resize);
 removeEventListener('pagehide',onPageHide);
 removeEventListener('unload',disposeViewer);
 removeEventListener('message',onWindowMessage);
 document.removeEventListener('visibilitychange',onVisibilityChange);
 controls.removeEventListener('change',onControlsChange);
 controls.removeEventListener('start',onControlsStart);
 renderer.domElement.removeEventListener('pointerdown',onPointerDown);
 renderer.domElement.removeEventListener('pointermove',onPointerMove);
 renderer.domElement.removeEventListener('pointerleave',onPointerLeave);
 renderer.domElement.removeEventListener('pointerup',onPointerUp);
 controls.dispose();
 disposeGroup(cabinetRoot);
 disposeGroup(serverRoot);
 disposeGroup(guideRoot);
 disposeGroup(focusRoot);
 disposeGroup(overlayRoot);
 clearDeployLabels();
 deployColEntries=[];deployArcEntries=[];activeDeployPartSet=new Set();
 for(const tpl of Object.values(templates))disposeGroup(tpl);
 templates={};
 UNIT_BOX.dispose();
 GUIDE_DOT_GEO.dispose();
 GUIDE_DOT_MAT.dispose();
 GUIDE_LINE_MAT.dispose();
 DEPLOY_PORT_GEO.dispose();
 for(const mat of Object.values(RACK_MATS))mat.dispose();
 for(const mat of Object.values(DEPLOY_MATS))mat.dispose();
 ground.geometry?.dispose();
 ground.material?.dispose();
 plinth.geometry?.dispose();
 plinth.material?.dispose();
 scene.environment=null;
 envRT.dispose();
 renderer.forceContextLoss?.();
 renderer.dispose();
}
addEventListener('pagehide',onPageHide);
addEventListener('unload',disposeViewer);
addEventListener('message',onWindowMessage);
window.__viewer={dispose:disposeViewer,get envRT(){return envRT;},get rendererMemory(){return renderer.info.memory;}};
