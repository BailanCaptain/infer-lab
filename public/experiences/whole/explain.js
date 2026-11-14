import {drawDiagram} from '../diagram-kit.js';
export function hardwareDiagram(host,{level,platform,spec,selected},onPick){
 let nodes=[],edges=[],note='',title='2D 位置图 · 点击可进入对应层级';
 const add=(id,label,x,y,role='paper',sub='',type='operator',w=180,h=37)=>nodes.push({id,label,x,y,role,sub,type,w,h});
 if(level<2){
  add('level:0','整座机柜',150,25,'copper','收纳多台服务器');add('level:1','一台 '+spec.name.replace('NVIDIA ','').replace('华为 ',''),150,90,'paper',`${spec.u}U · 每台8个${spec.chip}`,'matrix',252,44);add('level:2','打开机箱看内部',150,157,'sage','计算、内存、网络、供电与散热');add('level:3','一个 '+spec.chip+' 模组',150,224,'gold','从整机中定位，再独立观察');edges=[['level:0','level:1'],['level:1','level:2'],['level:2','level:3']];note='这是包含关系：机柜里有服务器，服务器里有加速器。机柜装机数量为展示示意。';
 }else if(level===3&&['gpu','npu'].includes(selected?.kind)){
  title='2D 部件图 · 从外到内理解模组';add('cooler','散热器',150,25,'paper','把热量带离封装');add('package',spec.chip+' 封装',150,91,'gold','矩阵运算发生在芯片内部','matrix',196,43);add('board','模组板与连接器',150,160,'sage','连接整机的计算、供电与通信','matrix',231,43);add('level:2','回到整机内部',150,227,'paper');edges=[['cooler','package'],['package','board'],['board','level:2']];note='层次与功能示意，不是晶体管或精确封装截面。3D“抬起散热器”能显示下方模组。';
 }else{
  title='2D 功能图 · 这几个部件如何分工';add('kind:host','CPU + 主存',75,35,'paper','控制流程 / 存放主机数据','matrix',138,44);add('kind:network','网络接口',230,35,'sage','与其他机器通信','matrix',116,44);add('kind:'+spec.chip.toLowerCase(),spec.chip+' 加速器 ×8',150,115,'gold','执行大量矩阵运算','matrix',207,48);add('kind:psu','电源模块',76,197,'copper','向部件供电','operator',128,40);add('kind:fans','风扇 / 散热',225,197,'paper','移走计算产生的热量','operator',128,40);edges=[['kind:host','kind:'+spec.chip.toLowerCase()],['kind:network','kind:'+spec.chip.toLowerCase()]];note='连线只表示功能关联，未声称端口直连、带宽或厂商总线拓扑。点击部件，可在3D中独立观察。';
 }
 drawDiagram(host,{title,note,nodes,edges,height:267,selected:selected?{id:'kind:'+selected.kind}:null,onPick});
}
