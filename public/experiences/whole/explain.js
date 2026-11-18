import {drawDiagram} from '../diagram-kit.js';

export function hardwareDiagram(host,{level,model,spec,selected},onPick){
 let nodes=[],edges=[],note='',title='2D 位置图 · 点击可进入对应层级',height=276;
 const add=(id,label,x,y,role='paper',sub='',type='operator',w=186,h=37)=>nodes.push({id,label,x,y,role,sub,type,w,h});
 const shortName=spec.name.replace('NVIDIA ','').replace('华为 ','');

 if(level<2){
  height=298;
  add('level:0','01 整座机柜',150,24,'copper',`42U · 展示 ${spec.slots} 台整机`,'operator',206,36);
  add('level:1','02 '+shortName,150,82,'paper',`${spec.u}U · ${spec.accelSummary}`,'matrix',254,42);
  add('level:2','03 整机内部结构',150,142,'sage','主板、载板、散热、供电与网络','operator',226,38);
  add('level:3','04 '+spec.moduleNav,150,200,'gold','抬起散热器观察板级部件','matrix',226,38);
  add('level:4','05 封装与片上晶粒',150,258,'violet',spec.dieShort,'matrix',238,38);
  edges=[['level:0','level:1'],['level:1','level:2'],['level:2','level:3'],['level:3','level:4']];
  note='包含关系：机柜装服务器，服务器装加速卡/模组，模组封装内是计算晶粒与高速显存。机柜台数为展示编排。';
 }else if(level===4){
  title='2D 封装架构图 · 依据公开白皮书示意';
  if(model==='ascend-950dt'){
   add('die:io-n','IO Die ×2（南北通信晶粒）',150,28,'sage','72×112G UB / UBoE / PCIe 5.0','matrix',244,40);
   add('die:ai','AI Die ×2（计算晶粒）',150,96,'gold','Cube + Vector / 128MB L2 / NDDMA','matrix',248,44);
   add('die:hbm','高速内存模块 ×4',150,164,'violet','144 / 96 GB · 4 TB/s (UMA)','matrix',234,42);
   add('level:3','返回模组整体观察',150,228,'paper','', 'operator',184,34);
   edges=[['die:io-n','die:ai'],['die:hbm','die:ai'],['die:ai','level:3']];
   note='严格对应《昇腾 950 NPU 架构白皮书》2 AI Die + 2 IO Die + 4 内存模块的 UMA 封装描述；表面网格为逻辑示意。';
  }else if(model==='atlas-800-3000'){
   add('die:soc0','昇腾推理芯片 0',82,42,'gold','达芬奇 AI Core + DVPP','matrix',132,42);
   add('die:soc1','昇腾推理芯片 1',218,42,'gold','独立可见 NPU Device','matrix',132,42);
   add('die:lpddr','LPDDR4X 显存颗粒 ×8',150,114,'violet','整卡 48 / 96 GB · 408 GB/s','matrix',232,42);
   add('die:pcie','PCIe 4.0 ×16 金手指接口',150,180,'sage','单槽全高全长 · 最大 150 W','operator',222,38);
   add('level:2','返回整机 Riser 仓',150,234,'paper','','operator',176,32);
   edges=[['die:lpddr','die:soc0'],['die:lpddr','die:soc1'],['die:soc0','die:pcie'],['die:soc1','die:pcie']];
   note='物理上是一张 PCIe 标卡，内部含 2 颗芯片，运行时暴露 2 个 Device；体现物理板卡与软件设备的区别。';
  }else if(model==='atlas-800i-a3'){
   add('die:dual','双计算晶粒封装',150,32,'gold','高密桥接协同矩阵与向量运算','matrix',236,42);
   add('die:hbm8','高带宽内存堆栈 ×8',150,100,'violet','单模组 128 GB · 3.2 TB/s','matrix',236,42);
   add('die:ub','灵衢 (UB) + RoCE 高速口',150,168,'sage','双向 784 GB/s · 支持超节点池化','matrix',242,40);
   add('level:3','返回液冷模组层',150,228,'paper','','operator',182,34);
   edges=[['die:hbm8','die:dual'],['die:dual','die:ub'],['die:ub','level:3']];
   note='单机 8 模组合计 1 TB 显存；封装晶粒与堆栈排布为架构示意，非物理开盖显微版图。';
  }else if(model==='dgx-h100'){
   add('die:gh100','GH100 计算晶粒',150,32,'gold','SM / Tensor Core / L2 缓存','matrix',224,42);
   add('die:hbm3','CoWoS 中介层 + HBM3 ×6',150,100,'violet','80 GB HBM3（5 启用 + 1 冗余位）','matrix',246,42);
   add('die:sxm','SXM5 板间高密连接器',150,168,'sage','连接基板 4 颗 NVSwitch','matrix',228,40);
   add('level:3','返回模组整体观察',150,228,'paper','','operator',184,34);
   edges=[['die:hbm3','die:gh100'],['die:gh100','die:sxm'],['die:sxm','level:3']];
   note='层次与堆栈数量依据公开白皮书示意，不代表精确晶体管版图。';
  }else{
   add('die:soc','昇腾计算晶粒 (SoC)',150,32,'gold','AIC (Cube) + AIV (Vector) + L2','matrix',238,42);
   add('die:hbm4','HBM 高带宽显存 ×4',150,100,'violet','单模组 64 GB · 存放权重与 KV','matrix',236,42);
   add('die:hccs','基板 VRM 与 7 路 HCCS 引出',150,168,'sage','8P Full Mesh 峰值 392 GB/s','matrix',242,40);
   add('level:3','返回模组整体观察',150,228,'paper','','operator',184,34);
   edges=[['die:hbm4','die:soc'],['die:soc','die:hccs'],['die:hccs','level:3']];
   note='芯片内部分区对应 AI Core 章节的 Cube / Vector / 片上缓冲逻辑，封装表面网格为教学示意。';
  }
 }else if(level===3&&['gpu','npu'].includes(selected?.kind)){
  title='2D 模组拆解图 · 点击可联动拆解';
  add('cooler',model==='atlas-800i-a3'?'微通道液冷冷板':'均热板 / 导流散热器',150,26,'paper','拖动滑杆 0–55% 抬起散热模组','operator',222,38);
  add('ihs','金属均热顶盖 (IHS)',150,86,'copper','拖动滑杆 55–100% 继续掀开顶盖','operator',228,38);
  add('level:4',spec.chip+' 封装晶粒与显存',150,148,'gold','点击进入第 05 层微距透视','matrix',232,42);
  add('board','载板 / Riser 连接底座',150,212,'sage','供电输入与机内高速互联','matrix',218,38);
  edges=[['cooler','ihs'],['ihs','level:4'],['level:4','board']];
  note='支持两段式连续拆解：先分离散热器，再抬起封装金属盖露出下方硅晶粒与显存堆栈。';
 }else{
  title='2D 整机分工图 · 点击部件可单独观察';
  add('kind:host',`CPU ×${spec.cpu} + 主存`,76,34,'paper',`${spec.dimm} 槽主机侧调度与中转`,'matrix',140,44);
  add('kind:network',spec.netShort,228,34,'sage',spec.netSub,'matrix',124,44);
  add('kind:'+spec.chip.toLowerCase(),spec.accelNodeLabel,150,114,'gold',spec.interconnectShort,'matrix',228,48);
  add('kind:psu',`电源 ×${spec.psu}`,76,196,'copper',spec.psuSub,'operator',132,40);
  if(spec.hasCooling){
   add('kind:cooling',spec.coolingLabel,225,196,'paper','冷板分液与冷凝热交换','operator',134,40);
  }else{
   add('kind:fans',`风扇 ×${spec.fan}`,225,196,'paper','前后贯通风道带走热量','operator',132,40);
  }
  edges=[['kind:host','kind:'+spec.chip.toLowerCase()],['kind:network','kind:'+spec.chip.toLowerCase()]];
  note='连线仅表示功能协作关系，不声称未经核验的板内走线拓扑。点击框体或三维部件可独立观察。';
 }
 const selId=level===4?'level:4':selected?('kind:'+selected.kind):null;
 drawDiagram(host,{title,note,nodes,edges,height,selected:selId?{id:selId}:null,onPick});
}
