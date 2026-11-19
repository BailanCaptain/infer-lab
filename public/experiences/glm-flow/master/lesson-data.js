// Scalar explanations for the remaining chapter steps. Pure functions: QA recomputes
// these against saved float32 tensors; the browser uses the same operands on its lines.
const combCache=new WeakMap();
function combOf(D,site,j,xn,rms){
 let cache=combCache.get(D);if(!cache)combCache.set(D,cache=new Map());const key=site+':'+j;if(cache.has(key))return cache.get(key);
 const F=Math.fround,a=new Float64Array(16),n=16384,x=D.get(xn).a;
 for(let r=0;r<16;r++){let z=0;for(let c=0;c<n;c++)z+=D.weight('fn_'+site,(8+r)*n+c)*F(x[j*n+c]/rms);a[r]=F(F(F(z)*D.weight('scale_'+site,2))+D.weight('base_'+site,8+r))}
 for(let r=0;r<4;r++){const m=Math.max(...a.slice(r*4,r*4+4)),ex=Array.from(a.slice(r*4,r*4+4),v=>Math.exp(v-m)),den=ex.reduce((s,v)=>s+v,0);for(let c=0;c<4;c++)a[r*4+c]=F(F(ex[c]/den)+1e-6)}
 const normalise=axis=>{for(let k=0;k<4;k++){const ix=Array.from({length:4},(_,i)=>axis?k*4+i:i*4+k),sum=F(ix.reduce((s,i)=>s+a[i],0)+1e-6);ix.forEach(i=>a[i]=F(a[i]/sum))}};
 normalise(0);for(let k=1;k<20;k++){normalise(1);normalise(0)}cache.set(key,a);return a;
}
export function explain(D, st, index=0) {
  const O=D.get(st.writes[0]), shape=O.shape, per=shape.slice(1).reduce((a,b)=>a*b,1), j=Math.floor(index/per), r=index%per;
  const sources=[], terms=[];
  const val=(id,k,w=false)=>w?D.weight(id,k):D.get(id).a[k];
  const ref=(id,k,w=false)=>{const q={id,index:k,weight:w,value:val(id,k,w)};sources.push(q);return q.value};
  const a=(id,k)=>val(id,k), w=(id,k)=>val(id,k,true);
  const dot=(n,left,right)=>{let sum=0;for(let c=0;c<n;c++){const [li,lk,lw=false]=left(c),[ri,rk,rw=false]=right(c),lv=val(li,lk,lw),rv=val(ri,rk,rw);sum+=lv*rv;if(c<3||c===n-1)terms.push({c,a:{id:li,index:lk,weight:lw,value:lv},b:{id:ri,index:rk,weight:rw,value:rv},product:lv*rv})}sources.push(terms[0].a,terms[0].b);return sum};
  const sum=(n,f)=>{let s=0;for(let k=0;k<n;k++){const v=f(k);s+=v;if(k<4||k===n-1)terms.push({c:k,value:v})}return s};
  const norm=(id,t,n)=>{let q=0;for(let k=0;k<n;k++)q+=a(id,t*n+k)**2;return Math.sqrt(q/n+1e-5)};
  let result, formula='', detail='', total=0;
  const id=st.id;
  if(st.op==='linear'&&!id.startsWith('mix_')) {
    const wn=st.params[0],xn=st.reads[0],ws=D.W.tensors[wn].shape,cols=ws.at(-1);
    let base=j*cols, row=r, expert=0;
    if(wn==='W_gu'||wn==='W_dn') {const k=Math.floor(r/O.shape.at(-1));expert=a('topk_i',j*8+k);row=r%O.shape.at(-1);base=wn==='W_gu'?j*cols:(j*8+k)*cols;detail=`选中位置 ${k+1} → 专家 #${expert}；`}
    if(id==='head')base=5*cols;
    const offset=expert*ws.at(-2)*cols;
    result=dot(cols,c=>[wn,offset+row*cols+c,true],c=>[xn,base+c]);total=cols;
    formula=`Σ ${cols} 对乘积`;
    if(id==='idx_w'){result/=Math.sqrt(32);formula+=' ÷ √32'}
    if(wn==='W_dn'){const k=Math.floor(r/4096),wt=ref('topk_w',j*8+k);result*=wt;formula+=' × 配对路由权重';detail+=`路由权重 ${wt.toFixed(5)}，只乘一次。`}
  } else if(id.startsWith('mix_')) {
    const site=id.endsWith('ffn')?'ffn':'attn',xn=st.reads[0],n=16384,rr=r;
    const rms=norm(xn,j,n),scale=w('scale_'+site,rr<4?0:rr<8?1:2),base=w('base_'+site,rr);
    const raw=dot(n,c=>['fn_'+site,rr*n+c,true],c=>[xn,j*n+c])/rms;total=n;
    if(rr<8){result=(rr<4?1:2)/(1+Math.exp(-(raw*scale+base)))+(rr<4?1e-6:0);formula=rr<4?'sigmoid(dot ÷ RMS × scale + base) + ε':'2 × sigmoid(dot ÷ RMS × scale + base)'}
    else {result=combOf(D,site,j,xn,rms)[rr-8];formula='softmax → 列归一化 → 19 轮行/列归一化';detail='comb 的 16 个数必须一起归一化；不是独立 sigmoid。'}
    detail+=`四路拼成 16384 维；RMS=${rms.toFixed(5)}；scale=${scale.toFixed(5)}；base=${base.toFixed(5)}。`;
  } else if(id.startsWith('collapse_')) {
    const site=id.endsWith('ffn')?'ffn':'attn';result=dot(4,k=>['coef_'+site,j*24+k],k=>[st.reads[0],j*16384+k*4096+r]);total=4;formula='Σ₄ pre × 旧路';
  } else if(id.startsWith('write_')) {
    const site=id.endsWith('ffn')?'ffn':'attn',s=Math.floor(r/4096),c=r%4096,xn=st.reads[1],yn=st.reads[0];
    result=dot(5,k=>['coef_'+site,j*24+(k===0?4+s:8+(k-1)*4+s)],k=>k===0?[yn,j*4096+c]:[xn,j*16384+(k-1)*4096+c]);total=5;formula='post × 新输出 + comb 第 s 列 × 旧四路';
  } else if(id.startsWith('norm_')||id==='norm_final') {
    const xn=st.reads[0],g=st.params[0],n=per,rm=norm(xn,j,n),v=ref(xn,index),gamma=ref(g,r,true);result=v/rm*gamma;formula='x ÷ RMS × γ';detail=`RMS = √(Σ ${n} 个平方 ÷ ${n} + 0.00001) = ${rm.toFixed(6)}`;
  } else if(id==='idx_k_norm') {
    const row=D.get('ik_raw').a.slice(j*128,(j+1)*128),mean=row.reduce((s,v)=>s+v,0)/128,sd=Math.sqrt(row.reduce((s,v)=>s+(v-mean)**2,0)/128+1e-6);
    result=(ref('ik_raw',index)-mean)/sd*ref('ln_w',r,true)+w('ln_b',r);formula='(x − 均值) ÷ 标准差 × γ + β';detail=`均值 ${mean.toFixed(6)}，标准差 ${sd.toFixed(6)}；LayerNorm 会减均值。`;
  } else if(id==='idx_pool') {
    const source=(id,index,weight=false)=>{const q={id,index,weight,value:val(id,index,weight)};sources.push(q);return q};
    for(let k=0;k<4;k++)terms.push({c:k,cg:source('cg',(j*4+k)*128+r),ape:source('ape',k*128+r,true),key:source('ik',(j*4+k)*128+r)});
    const g=terms.map(t=>t.cg.value+t.ape.value),mx=Math.max(...g),ex=g.map(x=>Math.exp(x-mx)),den=ex.reduce((s,x)=>s+x,0);
    result=terms.reduce((s,t,k)=>{t.alpha=ex[k]/den;t.value=t.alpha*t.key.value;return s+t.value},0);
    formula='Σ₄ softmax(cg + ape) × K';total=4;detail='α = exp(cg + ape − 最大值) ÷ 四词指数总和；每个通道独立归一化，尾词不压缩。';
  } else if(id==='idx_score') {
    const h=r;result=Math.max(0,dot(128,c=>['iq',(j*32+h)*128+c],c=>['pool_k',c])/Math.sqrt(128));total=128;formula='ReLU(索引 Q · 组 K ÷ √128)';detail='算例按 HF 参考实现取 ReLU；vllm-ascend 推理部署将头权重融合进查询向量直接点乘组 K。';
  } else if(id==='idx_sum') {
    result=dot(32,h=>['iw',j*32+h],h=>['iscore',j*32+h]);total=32;formula='Σ₃₂ 头权重 × 组分数';
  } else if(id==='idx_topk') {
    const tail=(j+1)%4;result=r<4?(j>=3?r:-1):r<4+tail?j+1-tail+r-4:-1;ref('isum',j);formula=result<0?'未使用位置填 −1':`可见位置 ${result+1} → 编号 ${result}`;detail='6 个词远少于预算 2048 + 3。只选完整可见组，再补可见尾巴；未来词仍不可见。';
  } else if(id==='mask') {
    result=r<=j?0:-3.4028234663852886e38;ref('topk',j*2051+(j<3?4:0));formula=r<=j?'可见位置 → 0':'未来位置 → float32 最小值';detail=`查询位置 ${j+1}，键位置 ${r+1}；64 个头共用这个因果遮罩。`;
  } else if(id==='attn_w') {
    const h=Math.floor(index/36),t=Math.floor(index%36/6),k=index%6;
    const scores=Array.from({length:t+1},(_,q)=>{let z=0;for(let c=0;c<256;c++)z+=a('Q',(t*64+h)*256+c)*a('KV',(q*64+h)*512+c);return z/16});
    const mx=Math.max(...scores),den=scores.reduce((s,x)=>s+Math.exp(x-mx),0);
    dot(256,c=>['Q',(t*64+h)*256+c],c=>['KV',(k*64+h)*512+c]);total=256;
    result=k>t?0:Math.exp(scores[k]-mx)/den;formula='softmax(Q·K ÷ 16 + 遮罩)';detail=`第 ${h+1} 头，第 ${t+1} 个查询：可见分数 [${scores.map(x=>x.toFixed(3)).join(', ')}]；未来概率为 0。`;
  } else if(id==='attn_v') {
    const h=Math.floor(r/256),c=r%256;result=dot(j+1,k=>['attn_w',h*36+j*6+k],k=>['KV',(k*64+h)*512+256+c]);total=j+1;formula='Σ可见词 注意力权重 × V';
  } else if(id==='route') {
    const scores=Array.from({length:288},(_,e)=>[e,1/(1+Math.exp(-a('logits',j*288+e)))]).sort((a0,b0)=>(b0[1]+w('e_bias',b0[0]))-(a0[1]+w('e_bias',a0[0])));
    result=scores[r][0];ref('logits',j*288+result);ref('e_bias',result,true);formula='sigmoid(logit) + 偏置 → 前 8 个编号';detail=`选中 ${scores.slice(0,8).map(x=>'#'+x[0]).join(' ')}；权重用原 sigmoid 分数归一 × 2.5。`;
  } else if(id==='expert_swiglu'||id==='s_swiglu') {
    const expert=st.writes[0]==='e_h',g=expert?ref('e_gu',j*8*4096+Math.floor(r/2048)*4096+r%2048):ref('s_gate',index),u=expert?ref('e_gu',j*8*4096+Math.floor(r/2048)*4096+2048+r%2048):ref('s_up',index);
    const gc=Math.min(g,10),uc=Math.max(-10,Math.min(10,u));result=gc/(1+Math.exp(-gc))*uc;formula='SiLU(min(gate,10)) × clamp(up,−10,10)';
  } else if(id==='combine') {result=sum(8,k=>ref('e_out',(j*8+k)*4096+r));total=8;formula='8 份已加权输出相加（不再乘权重）';
  } else if(id==='moe_sum') {result=ref('routed',index)+ref('s_out',index);formula='路由合计 + 共享输出';
  } else if(id==='embed') {ref('ids',j);result=ref('W_embed',D.ids[j]*4096+r,true);formula=`词 ID ${D.ids[j]} → 词表第 ${D.ids[j]} 行，第 ${r+1} 个数`;detail='查表，直接取出这一行；没有矩阵乘法。';
  } else if(id==='expand') {result=ref('x0',j*4096+r%4096);formula='同一个词向量复制到 4 路';
  } else if(id==='hc_head') {result=sum(4,s=>ref('last_residual',j*16384+s*4096+r))/4;total=4;formula='(第 1 路 + 第 2 路 + 第 3 路 + 第 4 路) ÷ 4';
  } else if(id==='softmax') {
    const z=D.get('logits').a,mx=z.reduce((m,v)=>Math.max(m,v),-Infinity),den=z.reduce((s,v)=>s+Math.exp(v-mx),0);result=Math.exp(ref('logits',index)-mx)/den;formula='exp(z − max) ÷ Σ₁₅₄₈₈₀ exp(z − max)';detail=`温度 1.0；完整词表参与分母，所有概率之和为 1。示例概率，不是实际模型预测。`;
  } else if(id==='sample') {result=O.a[0];ref('probs',result);const info=D.get('sample_info').a;formula=`top_p 0.95 → 固定抽样 u = 0.314159 → ID ${result}`;detail=`保留概率最高的 ${info[0]} 个候选，重新归一。固定抽样数便于回放，不等于总选最高分。`;
  } else throw Error('No scalar explanation: '+id+' / '+st.op);
  if(!Number.isFinite(result))throw Error('Nonfinite example '+id);
  return {result,stored:O.a[index],formula,detail,sources,terms,total,index,shape};
}
