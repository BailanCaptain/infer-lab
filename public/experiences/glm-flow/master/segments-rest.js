// Remaining approved segments. Tensor names, shapes and operations come from the master spec.
import config from '../reference/official-config.json' with {type:'json'};
import {modelSpec} from './model-spec.js';
const M=modelSpec(config.text_config,6), L=M.layers[3], FAR=[.5,.42,1], NEAR=[.32,.3,1];
const WORDS=['春天','来了','，','花儿','都','开了'],IDS=[105087,100325,3837,121267,98401,103349];
// Captions explain the operation; implementation notes stay in the folded details.
const INTRO={
 embed:'按每个词的编号，到词表取出对应的一行，组成这个词的向量。',
 expand:'把每个词刚查到的向量复制四份，组成第一层接收的四路输入。',
 mix_attn:'读取每个词的四路，用本层权重算混合系数，决定怎样读出和写回。',
 collapse_attn:'用刚算好的 pre 分别乘四路，再逐位置相加，合成注意力的一路输入。',
 norm_attn:'对合成的一路逐词做 RMSNorm，调整尺度，再交给注意力投影。',
 proj_kv_a:'同一份注意力输入先乘 KV 这一路的权重，压成每词 512 个数。',
 norm_kv_a:'对刚压好的 KV 逐词做 RMSNorm，准备展开各个头的 K 和 V。',
 proj_q_a:'同一份注意力输入再乘 Q 这一路的权重，压成每词 1536 个数。',
 norm_q_a:'对低秩 Q 逐词做 RMSNorm；这一块稍后同时交给主注意力和索引器。',
 proj_kv_b:'把归一化后的 c_kv 展开为 64 头 K 与 V；主注意力推理缓存 512 维 c_kv（索引器缓存另计）并将权重吸收。',
 proj_q_b:'把归一化后的低秩 Q 展开为 64 头，每头得到 256 个查询数。',
 idx_w:'读取注意力输入，为索引器每个头各算一个权重，用来合并它们的分数。',
 idx_gate:'读取注意力输入，为每个通道算压缩分数，决定四词合组时各词占多少。',
 idx_k:'读取注意力输入，投影成索引 K，供 32 个索引头共同对照。',
 idx_k_norm:'对索引 K 逐词减均值、除标准差，再乘 γ 加 β，得到归一化后的 K。',
 idx_pool:'用压缩分数和组内位置偏置，把四个词的索引 K 合成一个组 K。',
 idx_q:'读取前面归一化的低秩 Q，展开为 32 个索引头，每头 128 个查询数。',
 idx_score:'每个索引头用 Q 对照组 K，点积缩放后取非负部分，得到该头的组分数。',
 idx_sum:'把各头给同一组的分数乘各自头权重，再相加，得到这个组的总分。',
 idx_topk:'按总分挑完整可见组，再补可见尾词；本例只有六词，保留全部历史词。',
 mask:'把选中的词编号变成可见标记，供主注意力使用；未来词始终不可见。',
 attn_w:'每头先用 Q 对照可见词的 K，再把这些分数变成注意力权重。',
 attn_v:'用刚算出的注意力权重，对可见词的 V 逐通道加权相加，得到每头输出。',
 proj_o:'把各头输出按顺序拼接，再乘输出权重，降回每词 4096 个数。',
 write_attn:'取回本半层的 post 和 comb，把注意力结果与旧四路组合，写出新四路。',
 mix_ffn:'前馈入口：读取注意力写回的四路，用前馈自己的权重重新算混合系数。',
 collapse_ffn:'用前馈入口刚算好的 pre 加权四路，合成一路，准备送给路由器和专家。',
 norm_ffn:'对前馈合成的一路逐词做 RMSNorm，得到路由器与专家共同读取的输入。',
 router:'选择专家：每词输入与路由权重逐行点积，给每个专家算一个原始分数。',
 route:'分数先过 sigmoid；加偏置挑八个专家，用未加偏置的分数算合并权重。',
 expert_gu:'专家计算：按选中编号取专家权重，各算 gate 和 up，写入八个选中位置。',
 s_gate:'所有词还要经过同一个共享专家；先用共享 gate 权重投影。',
 s_up:'同一份输入再乘共享 up 权重，得到另一份向量，与 gate 逐位置配对。',
 expert_swiglu:'每个选中专家将 gate、up 限幅，再让 gate 过 SiLU，与 up 相乘。',
 s_swiglu:'共享专家也将 gate、up 限幅，让 gate 过 SiLU 后与 up 相乘。',
 expert_down:'各选中专家把隐藏数降回 4096 维，再乘自己的路由权重，留下加权输出。',
 s_down:'共享专家把隐藏结果降回 4096 维，这一路不乘选中专家的路由权重。',
 combine:'合并写回：把同词的八份已加权输出逐位置相加；这里不重复乘权重。',
 moe_sum:'把路由合计与共享输出按同词、同位置相加，合成完整前馈输出。',
 write_ffn:'用前馈入口保留的 post 和 comb，把前馈结果与旧四路组合，写出本层四路。',
 hc_head:'在最终层末端，把每词的四路逐位置相加除以四，得到一份向量。',
 norm_final:'对刚才四路平均的结果逐词做 RMSNorm，得到输出头要读取的隐藏状态。',
 head:'只取最后位置的隐藏状态，与词表输出权重逐行点积，为每个候选打分。',
 softmax:'把所有候选分数减最大值、取指数，再除指数总和，得到和为一的概率。',
 sample:'按概率排序，保留累计刚到 95% 的候选，重新归一抽样，选出下一个编号。',
};
// Adjacent inputs kept inside the camera frame so source → destination handoff is always visible without flying far up.
const NEARBY_READS={
 embed:['ids'],
 expand:['x0'],
 collapse_attn:['coef_attn','residual_in'],
 norm_attn:['collapsed_attn'],
 norm_kv_a:['kv_a'],
 norm_q_a:['q_a'],
 proj_kv_b:['c_kv'],
 proj_q_b:['q_resid'],
 attn_w:['Q','mask'],
 attn_v:['attn_w'],
 proj_o:['attn_o'],
 collapse_ffn:['coef_ffn','residual_mid'],
 norm_ffn:['collapsed_ffn'],
 route:['logits'],
 expert_swiglu:['e_gu'],
 s_swiglu:['s_gate','s_up'],
 s_down:['s_h'],
 combine:['e_out'],
 moe_sum:['routed','s_out'],
 hc_head:['L44:residual_out'],
 norm_final:['h_mean'],
 softmax:['logits'],
 sample:['probs'],
};
const parts={
  1:['这个模型、这句话',['句子是「春天来了，花儿都开了」。官方分词器把它切成 6 个 token；这里为了好读，把 token 简称为“词”。','先认入口，再穿过 45 个主模型层，最后生成下一个词。训练权重决定变换；本章用教学权重连续计算全部 45 层；数值来自同一句话，不代表训练后的 GLM 预测。']],
  2:['怎么读这个物体',['一块代表一个张量，边长来自真实维度；数据通常<b>一个词一列</b>，前馈隐藏结果横放时一个词一行。','大矩阵是权重，旁边窄块是这句话的结果。权重按行、数据按词取数；箭头指向读写位置。','纹理只表示数值各不相同。词表中间省略，仍标完整形状；不是把所有矩阵缩成相同大小。']],
  3:['分词',['分词把文字变成词表编号，不是按语义猜编号。本例没有额外聊天模板或起止标记。','春天 → 105087；来了 → 100325；，→ 3837；花儿 → 121267；都 → 98401；开了 → 103349。一个 token 可以含多个汉字。','六个编号组成 [6]，下一步每个编号查词表一行。']],
  4:['词嵌入：查表',['词表有 154880 行，每行 4096 个可训练的数。编号是行号，不表示大小或含义。','沿线找到「春天」的编号 105087，取出对应行，放到词向量第一列；其他词各取自己的行。','这是查表，没有点积。结果 [6,4096] 与第 8–19 段 L00 的示例输入完全一致。']],
  5:['展成四路残差',['每个词向量复制四份，成为 [6,4,4096]，交给 L00。','这里只复制，不加权，也没有新增权重。四路起初相同，经过层内 post / comb 写回后会不同。']],
  6:['45 层，只有 3 种',['3 层 KDA + 稠密、31 层 KDA + MoE、11 层稀疏注意力 + MoE，合计 45 层。','每四层一次稀疏注意力：L03、L07……L43。各层权重独立，结构重复不代表共享权重。','本章按 L00 → L01 → … → L44 的实际顺序推进。三种层首次遇到时详讲，重复层快放，计算不省略。']],
  7:['四路残差贯穿始终',['紫色主干保留每词四份向量。每半层先从四路读出一路，计算后写回四路。','一层输出直接是下一层输入，没有重复画两份。主干折到下一列只是排版，不会跳层。','下面落到 L00，沿同一个模型逐步展开。']],
  26:['层全景：稀疏注意力 + MoE',['接着 L02 的输出进入 L03。这里首次遇到稀疏注意力和 MoE；当前四路来自同一句话的前面三层。','与 L00 相比，注意力换成低秩投影、索引器和稀疏注意力，前馈换成 MoE；mHC、归一化和写回规则相同。先认输入、输出和连线，再展开。']],
  27:['连续走过：四路合一 + 归一化',['读 L03 四路，算 pre / post / comb。pre 合成一路，post 与 comb 留到本半层末尾写回。','再做 RMSNorm，得到 [6,4096]。每步都保留来源、数值和写入标记；原理与第 9、10 段相同。']],
  28:['先压缩：低秩的 q 和 kv',['同一份 x_attn 分两路：q_a 压到 1536 维；kv_a 压到 512 维，各有独立权重和 RMSNorm。','Q 低秩结果还给索引器使用；KV 的低秩表示供 64 头展开。本配置 qk_rope_head_dim = 0，不另加 RoPE 维度，因果限制依旧存在。']],
  29:['再展开成 64 个头',['Q 从 1536 展开成 64 × 256；KV 从 512 展开成 64 × (256 + 256)，每头前半 K、后半 V。','不是复制 64 份：各头对应不同权重行，逐行点积后写进相应词、头和通道。HF 参考图把 K、V 显式画出以便对照；实际推理主注意力只缓存 512 维 c_kv（宽度为展开 K/V 的 1/64，索引器缓存另计），并把 W_kv_b 吸收进 Q 与输出端。','28–30 段保持这一组的共同取景，让分支来源可追溯；不会为取上方输入来回飞镜头。']],
  30:['索引器粗筛：哪些位置值得看',['索引器用 32 个小头，主注意力仍有 64 头。第 28 段的「Q 低秩·归一化后」（q_resid）提供索引 Q；注意力输入 x_attn 提供索引 K、压缩门和头权重。','K 先过 LayerNorm（减均值）。ape 是可学的组内位置偏置，四行对应四词位置，每个通道各有一个数。压缩分数 cg 加 ape 后，在四个词之间做 softmax，按权重把四个 K 压成一组。每头点积 ÷ √128，HF 参考算例再取 ReLU 后按头权重求和（vllm-ascend 推理部署将头权重融合进查询直接点乘组 K，并只缓存压缩后的组 K 与尾槽）。','只挑完整可见组，再补不满 4 个词的可见尾巴。预算 2048 + 最多 3 个尾词；本句只有 6 个词，<b>所有历史词都在预算内</b>，不能硬删词假装稀疏。','所选编号不足 2051 位时填 −1。遮罩 [6,6] 可见处为 0，其他处为极小值，未来词始终不可见。']],
  31:['注意力分数与 softmax',['主注意力每头把 Q 与 K 的 256 对数相乘求和，除 √256 = 16，再加遮罩。','同一查询的可见分数减最大值、取指数，再除这些指数的总和，得到和为一的权重。分母包含整行可见位置，不是每格独立 sigmoid。','先看第 4 个词「花儿」对前面词的权重；未来两个词为 0。64 个头各自形成 [6,6]；数值按教学算例精确计算。']],
  32:['取回 V，合头，投影并写回',['按注意力权重对可见词的 V 加权求和，每头仍有 256 个数。','64 头按顺序合成 16384 维，与 W_o 点积，降回 [6,4096]。合头是重排，不是取平均。','取出第 27 段保留的 post / comb，把新结果与旧四路组合，沿线写入新四路。']],
  33:['连续走过：MoE 半层',['接第 32 段四路，重新算前馈 mHC、RMSNorm，再为每词选 8 个专家。','按加偏置的 sigmoid 分数挑编号；权重用未加偏置分数归一 × 2.5。专家与共享分支都经过限幅、SiLU、Down。','8 份已加权结果求和，加共享输出，再用本半层 post / comb 写回四路。这里首次完整计算 MoE；后面的 L04 会继续使用同一套规则和本层输出。']],
  34:['来到最终层末端：四路平均与归一化',['前面已将同一句话依次通过 L00–L44。这里直接读取 L44 的输出，<b>没有替换成独立末端输入</b>。','hc_head 没有权重，四路逐位置相加除以 4，得 [6,4096]。再除各词均方根并乘最终 γ。','末端平均与层内 pre 加权不同。之后输出头读取最后一个词的位置。']],
  35:['只取最后一个词的位置',['六个词的隐藏状态都已算好。生成下一个词时，只把最后位置「开了」的 4096 个数交给输出头。','它经过因果注意力，能包含之前上下文；只取最后位置不等于只读最后一个词。','这是索引已有张量，没有新权重或新的模型块。训练或请求全部 logits 时可以保留其他位置。']],
  36:['输出头：给词表里每个词打分',['输出头 [154880,4096] 与输入词嵌入表不共享权重。','最后位置分别与每行点积，得到 [1,154880] 分数，可正可负，还不是概率。','省略部分的候选照样参与计算；连线会标注省略位置，不假装落在可见的格子上。']],
  37:['softmax 与选词',['154880 个分数整体 softmax：减最大值，取指数，除总和。概率来自本句经过 45 层后的输出与教学权重，<b>不是训练后 GLM 的真实预测</b>。','演示 temperature = 1、top_p = 0.95：保留按概率排序后累计刚到 95% 的最少候选，重新归一再抽样。','固定 u = 0.314159 让回放可复现，不等于总取最高概率。HF generate 不启用 do_sample 时可能是贪心选择。']],
  38:['接回句尾，开始下一轮',['抽出 token ID 后接回序列，长度 6 → 7。token 可能是字节片段，需要结合邻近 token 解码；这里保留准确编号，不猜汉字。','“快进一轮”回顾新编号查表 → 45 层 → 输出头的相同路径，不伪造另一轮数值。','实际推理复用 KDA 状态或注意力缓存，不必重算整段历史；缓存留给后续章节。本章结束，MTP 与视觉分支在进阶专题。']],
};
const shape=t=>'['+t.shape.join(', ')+']';
const tensor=(s,id)=>s.global?M.ends.tensors.find(t=>t.id===id)||M.layers[+(id.slice(1,3))]?.tensors.find(t=>t.id===id.split(':')[1]):L.tensors.find(t=>t.id===id);
const base=n=>({n,id:'s'+String(n).padStart(2,'0'),layer:n<8?0:n>=34?44:3,global:n<8||n>=34,lessonData:true,focusLabels:true,panel:null,rows:[],title:parts[n][0],text:parts[n][1],flow:[],poses:{},labels:[],beats:[],more:n>=26&&n<=33?'依据 reference/modeling_glm5_next.py：mHC 279–295；MLA / 索引器 763–879、901–1017、1051–1061、1169–1217；解码层 1282–1331。':'依据官方 config、tokenizer.json 与 modeling_glm5_next.py：输入 1416、1447、1476；末端 1492、2219–2221；采样配置 generation_config.json。'});
function label(s,id,at='b'){if(!s.labels.some(l=>l.id===id)){const t=tensor(s,id);s.labels.push({id,html:`<b>${t?.name||id}</b><br><i>${t?shape(t):''}</i>`,at})}}
function view(s,key,ids,extra={}){s.poses[key]={ids,dir:NEAR,pad:5,sideCard:true,narrowShift:[.6,0],...extra};ids.forEach(id=>label(s,id));return key}
function show(s,say,ids,cam,dur=4,opExtra={}){s.beats.push({say,dur,cam:cam||view(s,'view'+s.beats.length,ids),op:{show:ids,...opExtra}})}
function steps(s,ids,camOverride=null){
 for(const key of ids){
  const st=(s.global?M.ends.steps:L.steps).find(x=>x.id===key);if(!st)throw Error(key);
  const dst=st.writes[0],t=tensor(s,dst),reads=[...st.reads,...st.params];
  reads.forEach(id=>label(s,id,id==='W_embed'?'b':id==='W_head'?'t':id==='ids'?'r':'b'));
  const nearby=NEARBY_READS[key]||[];
  const poseIds=[...new Set([dst,...nearby,...st.params.filter(id=>!['scale_attn','base_attn','scale_ffn','base_ffn'].includes(id))])];
  const cam=camOverride||view(s,key,poseIds,key==='expert_down'?{narrowShift:[.68,0]}:key==='embed'?{pad:7,autoCard:true}:key==='expand'?{pad:6,autoCard:true}:{});
  label(s,dst,dst==='x0'||dst==='L00:residual_in'?'b':'b');
  s.flow.push(`${st.title} → ${shape(t)}`);
  if(!INTRO[key])throw Error('Missing introduction: '+key);
  const sample=key==='attn_w'?18:key==='attn_v'?3*64*256:key==='idx_topk'?4:key==='mask'?18:0;
  show(s,INTRO[key],reads,cam,4.5,{recv:dst,lesson:st,phase:'intro',sample});
  if(st.merged)s.more+=`<p><b>${st.title}</b>：${st.merged}</p>`;
  if(key==='idx_pool'){
   show(s,'ape 是可学的组内位置偏置；四行对应四个词的位置，每个通道各有一个数。',['ape','cg'],cam,5,{recv:dst,lesson:st,phase:'intro',steady:true,sample});
   show(s,'压缩分数加 ape 后，在四个词之间减最大值、取指数、除总和，得到压缩权重。',['ape','cg','ik'],cam,6,{recv:dst,lesson:st,phase:'intro',steady:true,sample});
  }
  if(key==='attn_w')show(s,'同一查询的可见分数减最大值、取指数，再除指数总和：权重和为一，未来词为零。',reads,cam,6,{recv:dst,lesson:st,phase:'intro',steady:true,sample});
  for(const [phase,dur,say]of [['pull',5,`沿线取数：先算 ${t.name} 的一个位置`],['sum',4,`${st.title}：按公式计算这一个位置`],['place',3,`沿箭头写入 ${t.name} 的标记位置`],['trace',5,`沿相同规则计算其余位置，写满 ${shape(t)}`]])s.beats.push({say,dur,cam,op:{lesson:st,phase,sample}});
 }
}
const ss=[];
for(let n=1;n<=7;n++){
 const s=base(n);s.flow=n===3?WORDS.map((w,i)=>`${w} → ${IDS[i]}`):[n<6?'句子 → 编号 → 词向量 → 四路':'45 层 → 隐藏状态 → 下一个词'];
 if(n===1){
  s.labels.push({id:'L00:residual_in',html:'<b>主干入口 (L00)</b><br><i>[6, 4, 4096]</i>',at:'r'},{id:'L44:residual_out',html:'<b>45 层末端 (L44)</b><br><i>[6, 4, 4096]</i>',at:'r'});
  view(s,'whole',['ids','L00:residual_in','L44:residual_out','next_id'],{dir:FAR,sideCard:false,poseShowLabels:['ids','L00:residual_in','L44:residual_out','next_id']});
  show(s,'先看整个模型：顶部输入，45 层主干，底部输出',['ids','W_embed','x0','L00:residual_in','L44:residual_out','W_head','next_id'],'whole',7,{overview:true});
  show(s,'这句话切成六个词；下一步把编号放进模型',['ids','W_embed','x0'],null,6);
 }
 if(n===2){
  show(s,'一个词一列，权重在结果旁边，线连到读写处',['L00:x_attn','L00:W_q','L00:Q'],null,7);
  show(s,'64 个头真实分开，各头读取不同的权重行',['L00:Q','L00:conv_q','L00:Q_conv'],null,6);
  show(s,'词表中间省略，实际有 154880 × 4096 个数',['ids','W_embed','x0'],null,6);
 }
 if(n===3){
  s.words='ids';
  label(s,'ids','r');
  view(s,'tokens',['ids','x0'],{pad:7,dir:[.22,.26,1],sideCard:false,topReserve:104});
  for(let j=0;j<6;j++)s.beats.push({say:`${WORDS[j]} → ID ${IDS[j]}，写入编号序列第 ${j+1} 位`,dur:3,cam:'tokens',op:{token:j,show:['ids']}});
 }
 if(n===4){s.words='ids';steps(s,['embed'])}
 if(n===5){s.words='x0';steps(s,['expand'])}
 if(n===6){
  for(const[l,title]of [[0,'KDA + 稠密，共 3 层（L00–L02）'],[4,'KDA + MoE，共 31 层（L04 等）'],[3,'稀疏注意力 + MoE，共 11 层（L03、L07 … L43）']]){
   const tag='L'+String(l).padStart(2,'0');
   const cam=view(s,'kind'+l,[`${tag}:residual_in`,`${tag}:residual_out`],{allLayer:l,dir:FAR,sideCard:false});
   show(s,title,[`${tag}:residual_in`,`${tag}:x_attn`,`${tag}:attn_out`,`${tag}:ffn_out`,`${tag}:residual_out`],cam,7,{layerWhole:l});
  }
 }
 if(n===7){show(s,'输入复制成四路，第一层从这里开始',['x0','L00:residual_in'],null,5);show(s,'每半层读出、计算、写回；下一层接同一根主干',['L00:residual_in','L00:residual_mid','L00:residual_out'],null,7);show(s,'停在 L00 入口，下一段正式开始计算',['L00:residual_in','L00:coef_attn'],null,5)}
 ss.push(s);
}
for(let n=26;n<=38;n++){
 const s=base(n);
 if(n===26){view(s,'layer',['residual_in','residual_out'],{dir:FAR,sideCard:false});show(s,'接 L02 算出的四路，进入 L03：先认低秩注意力与 MoE 的来源和去向',['residual_in','x_attn','attn_out','residual_mid','ffn_out','residual_out'],'layer',6);s.beats.push({say:'沿官方顺序经过注意力半层：输入 → 运算 → 写回',dur:14,cam:'layer',op:{tour:'attn'}},{say:'再经过同样的 MoE 半层，输出仍是四路',dur:10,cam:'layer',op:{tour:'ffn'}})}
 if(n===27)steps(s,['mix_attn','collapse_attn','norm_attn']);
 if([28,29,30].includes(n))view(s,'group',['W_kv_a','W_q_a','KV','Q'],{pad:8,dir:[.15,.18,1],autoCard:true});
 if(n===28)steps(s,['proj_kv_a','norm_kv_a','proj_q_a','norm_q_a'],'group');
 if(n===29)steps(s,['proj_kv_b','proj_q_b'],'group');
 if(n===30)steps(s,['idx_w','idx_gate','idx_k','idx_k_norm','idx_pool','idx_q','idx_score','idx_sum','idx_topk','mask'],'group');
 if(n===31)steps(s,['attn_w']);if(n===32)steps(s,['attn_v','proj_o','write_attn']);
 if(n===33){steps(s,['mix_ffn','collapse_ffn','norm_ffn']);view(s,'experts',['W_router','logits','topk_i','e_gu','e_h','s_gate','s_h'],{dir:[.15,.2,1],autoCard:true});steps(s,['router','route','expert_gu','s_gate','s_up','expert_swiglu','s_swiglu'],'experts');steps(s,['expert_down','s_down','combine','moe_sum','write_ffn'])}
 if(n===34){show(s,'45 层已按顺序算完；现在直接读取 L44 的四路输出，交给末端归一化。',['L44:residual_out'],view(s,'arrival',['L44:residual_out','h_mean']),6,{recv:'h_mean'});steps(s,['hc_head','norm_final'])}
 if(n===35){s.words='h_final';view(s,'last',['h_final'],{pad:9,sideCard:false,topReserve:96});show(s,'先认全部 6 个词的隐藏状态，每词 4096 个数',['h_final'],'last',4);s.beats.push({say:'只取最后位置「开了」，输出头使用这 4096 个数',dur:7,cam:'last',op:{last:true}})}
 if(n===36)steps(s,['head']);if(n===37)steps(s,['softmax','sample']);
 if(n===38){s.labels.push({id:'L00:residual_in',html:'<b>主干入口 (L00)</b><br><i>[6, 4, 4096]</i>',at:'r'},{id:'L44:residual_out',html:'<b>45 层末端 (L44)</b><br><i>[6, 4, 4096]</i>',at:'r'});view(s,'out',['next_id','probs'],{pad:7});view(s,'in',['ids','x0'],{pad:12,sideCard:false,topReserve:108});view(s,'cycle',['ids','L00:residual_in','L44:residual_out','next_id'],{dir:FAR,sideCard:false,poseShowLabels:['ids','L00:residual_in','L44:residual_out','next_id']});show(s,'选出的示例 ID 已经就位，接回句尾后长度成为 7',['next_id','probs'],'out',4);s.beats.push({say:'把新的 token ID 沿线接回六个编号后，长度 6 → 7',dur:6,cam:'in',op:{append:true,show:['ids','x0']}},{say:'快进一轮 · 结构回顾：查表 → 45 层 → 输出头 → 选词，不生成虚假第二轮数值',dur:12,cam:'cycle',op:{cycle:true}})}
 if(!s.flow.length)s.flow=[n<34?'四路 → 注意力 → 写回 → MoE → 四路':'完整词表 → 选词 → 追加到序列'];
 ss.push(s);
}
for(const s of ss){
 const mapping={1:[null,['col:text']],2:[null,['attn-kda']],3:[null,['col:text']],4:[null,['col:embed']],5:[null,['col:expand']],6:[null,['attn-kda','attn-attn','ffn-dense','ffn-expert']],7:[null,['mhc','write','mhc2','write2']],26:['mla',['attn-attn']],27:['mhc',['mhc','norm']],28:['mla',['attn-attn']],29:['mla',['attn-attn']],30:['mla',['attn-attn']],31:['mla',['attn-attn']],32:['mla',['attn-attn','write']],33:['moe',['mhc2','norm2','ffn-expert','write2']],34:[null,['col:hc_head','col:norm']],35:[null,['col:norm']],36:[null,['col:lm_head']],37:[null,['col:pick']],38:[null,['col:pick','col:text']]};
 [s.panel,s.rows]=mapping[s.n];
}
export const REMAINING=ss;
