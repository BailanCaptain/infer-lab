// The 2D diagrams of GLM-5.3-Flash (09-24, in the manner of Sebastian Raschka's LLM Architecture Gallery), as pieces a
// page can take: the whole model as a column, each part of a layer as a dotted panel (arch.html shows them all; the
// chapter page shows the column as its map and a panel beside each segment — one drawing, not a second one, 09-26:
// the user asked where "我们之前画的 2D 图" had gone). The boxes carry data-comp (colouring), data-step (a panel's box
// = a step of truth-spec.js) and data-row (the column's rows), so a page can light the one it is at.
import {layerSpec} from './truth-spec.js';
import {panelLayout,modelColumn,EDGE_NAMES,CW,RH} from './arch-layout.js';

// skin (a page's own look, 09-27 the chapter page: "字体啊啥的……跟模型图里的很割裂"): the colours of ink, grey, lines and the
// numbers, whether a panel has its dotted frame, its title's size; arch.html keeps the defaults
export function makeArch(cfg, P, skin = {}) {
  const T=6,SPEC={0:layerSpec(cfg,T,0),3:layerSpec(cfg,T,3),4:layerSpec(cfg,T,4)},M=modelColumn(cfg),MTP_B=(layerSpec(cfg,T,cfg.num_hidden_layers).params+2*cfg.hidden_size+2*cfg.hidden_size*cfg.hidden_size+cfg.hidden_size)/1e9;
  // the same layers with twice the words: a size that doubles is the number of words (T); one that grows from 1 to 3 is the
  // number of groups of 4 words the indexer compresses them into (T/4)
  const SPEC2={0:layerSpec(cfg,2*T,0),3:layerSpec(cfg,2*T,3),4:layerSpec(cfg,2*T,4)};
  const {INK='#2b2823',GREY='#6b665c',LINE='#57524a',BLUE='#1d4ed8',frame=true,titleSize=17}=skin;
  const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const fmt=n=>n.toLocaleString('en');
  // ---- text: wrap a title into lines that fit a width (a CJK character ~ the font size, anything else ~ .55 of it)
  // (a line breaks at a space when there is one in it, so a shape [16,384, 1,536] stays whole)
  function wrap(s,px,size){const cw=ch=>/[⺀-￿]/.test(ch)?size:size*.56,W=t=>[...t].reduce((a,c)=>a+cw(c),0);const out=[];let line='';
   for(const ch of s){if(W(line+ch)>px&&line){const k=line.lastIndexOf(' ');if(k>0&&/[!-~]/.test(ch+line.slice(k+1))){out.push(line.slice(0,k));line=line.slice(k+1)+ch;continue}out.push(line);line=''}line+=ch}if(line)out.push(line);return out}
  const TWICE=Object.fromEntries(Object.values(SPEC2).flatMap(s=>s.tensors.map(t=>[t.id,t.shape])));
  const shapeText=t=>{const s2=TWICE[t.id]||t.shape;return '['+t.shape.map((d,i)=>s2[i]===2*d&&d===T?'T':s2[i]===Math.floor(2*T/cfg.index_kpool)&&d===Math.floor(T/cfg.index_kpool)&&s2[i]!==d?'T/'+cfg.index_kpool:d).join(', ')+']'};
  // what a step box says under its title: a matmul its weight and shape; otherwise the shape of what it writes
  function subOf(spec,s){
   const byId=id=>spec.tensors.find(t=>t.id===id);
   const w=s.params.map(byId).find(t=>t&&!t.vector);
   if(s.op==='linear'&&w)return `${w.id} ${shapeText(w)}`;
   if(s.op==='kda')return `${shapeText(byId('core_out'))} · 记忆 S ${shapeText(byId('state'))}`;
   return s.writes.map(id=>shapeText(byId(id))).join(' · ');
  }
  // ---- the palette as tuned
  const colorOf=(comp,weight)=>comp&&P[comp]?(weight?P[comp][1]:P[comp][0]):'#ffffff';

  // ---- pieces of SVG, every coloured one tagged with its component (so tuning and fading reach it)
  const S=[];
  const box=({x,y,w,h,title,sub,comp,weight,io,src,tip,step,row},size=12.5)=>{
   const fill=io?colorOf(comp,false):weight?colorOf(comp,true):'#ffffff',stroke=comp?colorOf(comp,false):'#b9b2a3';
   const tl=wrap(title,w-14,size),sl=sub?wrap(sub,w-12,11):[],lh=size+3,th=tl.length*lh+sl.length*14,y0=y+h/2-th/2+size-1;
   let t=tl.map((l,i)=>`<text x="${x+w/2}" y="${y0+i*lh}" text-anchor="middle" font-size="${size}" font-weight="700" fill="${INK}" class="ttl">${esc(l)}</text>`).join('');
   t+=sl.map((l,i)=>`<text x="${x+w/2}" y="${y0+tl.length*lh+i*14}" text-anchor="middle" font-size="11" fill="${GREY}" class="sub">${esc(l)}</text>`).join('');
   return `<g class="box" data-comp="${comp||''}" data-kind="${io||!weight?'data':'weight'}"${step?` data-step="${step}"`:''}${row?` data-row="${row}"`:''}><title>${esc(tip||title)}${src?' · 官方代码 '+src+' 行':''}</title><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${io?h/2:7}" fill="${fill}" stroke="${stroke}" stroke-width="${io?0:2}" data-role="${io?'res':weight?'wt':'op'}"/>${t}</g>`;
  };
  const arrow=(pts,{color=LINE,w=1.6,head=true,dash=''}={})=>{
   const d='M'+pts.map(p=>p.join(' ')).join(' L');
   let s=`<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" ${dash?`stroke-dasharray="${dash}"`:''} stroke-linejoin="round"/>`;
   if(head){const [a,b]=pts.slice(-2),dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L,s1=7,s2=3.6;
    s+=`<path d="M${b[0]} ${b[1]} L${b[0]-ux*s1-uy*s2} ${b[1]-uy*s1+ux*s2} L${b[0]-ux*s1+uy*s2} ${b[1]-uy*s1-ux*s2} Z" fill="${color}"/>`}
   return s;
  };
  const text=(x,y,s,{size=12.5,weight=400,color=INK,anchor='start'}={})=>`<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${s}</text>`;
  const num=n=>`<tspan fill="${BLUE}" font-weight="700">${n}</tspan>`;

  // ---- a panel: its boxes and arrows from arch-layout.js, in a dotted frame with a title and its numbers
  function panel(key,li,ox,oy,title,facts){
   const spec=SPEC[li],L=panelLayout(spec,key),tensor=id=>spec.tensors.find(t=>t.id===id),PADX=22,top=58;
   const g=[];
   if(frame)g.push(`<rect x="${ox}" y="${oy}" width="${L.W+2*PADX}" height="${L.H+top+26}" rx="16" fill="none" stroke="${INK}" stroke-width="2.2" stroke-dasharray="3 5"/>`);
   g.push(text(ox+PADX,oy+26,esc(title),{size:titleSize,weight:800}));
   g.push(text(ox+PADX,oy+45,facts,{size:12.5,color:GREY}));
   const X=x=>ox+PADX+x,Y=y=>oy+top+y;
   for(const e of L.edges){g.push(arrow(e.pts.map(([x,y])=>[X(x),Y(y)])));const n=EDGE_NAMES[e.tensor];if(n&&e.pts.length>2)g.push(text(X(e.pts[1][0])+4,Y(e.pts[1][1])-3,esc(n),{size:10.5,color:GREY}))}
   for(const b of Object.values(L.box)){
    if(b.io){const t=tensor(b.tensor);g.push(box({x:X(b.x0),y:Y(b.y0)+8,w:b.x1-b.x0,h:RH-16,title:`${b.io==='in'?'':'→ '}${t.name}`,sub:null,comp:t.comp,io:b.io,tip:`${t.name} ${shapeText(t)}`},12))}
    else if(b.step.pseudo)g.push(`<g><rect x="${X(b.x0)}" y="${Y(b.y0)}" width="${b.x1-b.x0}" height="${RH}" rx="7" fill="#efe9dc" stroke="#b9b2a3" stroke-dasharray="4 3"/>${text(X((b.x0+b.x1)/2),Y(b.y0)+RH/2+4,esc(b.step.title),{size:12,anchor:'middle',color:GREY})}</g>`);
    else{const s=b.step,comp=tensor(s.writes[0]).comp,w=s.params.map(tensor).some(t=>t&&!t.vector);
     g.push(box({x:X(b.x0),y:Y(b.y0),w:b.x1-b.x0,h:RH,title:s.title,sub:subOf(spec,s),comp,weight:w,src:s.src,tip:s.title+(s.merged?'：'+s.merged:''),step:s.id},12))}
   }
   return {svg:g.join(''),w:L.W+2*PADX,h:L.H+top+26};
  }

  // ---- the model column: the words in, the 45 layers as one box with the 4 streams along its right, the scores out
  function column(ox,oy){
   const g=[],w=276,h=46,gap=26,sx=ox+w+34,px=ox,cx=ox+w/2;   // sx: where the 4 streams run
   let y=oy;const anchors={};
   const put=(b,dy=gap)=>{g.push(box({x:px,y,w,h,title:b.title,sub:b.sub,comp:b.comp,weight:b.weight,io:b.comp&&!b.weight?'mid':null,src:b.src,row:'col:'+b.id},13));anchors[b.id]={x:px,y,w,h};const r=y;y+=h+dy;return r};
   // text, embedding
   for(const [i,b] of M.top.entries()){const yy=put(b);if(i<M.top.length-1)g.push(arrow([[cx,yy+h],[cx,yy+h+gap]]))}
   // the 45 layers
   const ly=y+34,rows=[['mhc','合成 1 路','mHC：4 路 → 24 个系数 → 1 路','resid'],['norm','RMSNorm 1','input_layernorm','norm'],['attn','注意力','KDA × '+M.counts.kda+'  或  MLA + 索引器 × '+M.counts.mla,'kda'],['write','写回 4 路','post · 结果 + comb · 4 路','resid'],
    ['mhc2','合成 1 路','mHC','resid'],['norm2','RMSNorm 2','post_attention_layernorm','norm'],['ffn','前馈','稠密 × '+M.counts.dense+'  或  MoE × '+M.counts.moe,'dense'],['write2','写回 4 路','post · 结果 + comb · 4 路','resid']];
   const bh=40,bg=18,inner=px+22,iw=w-44,LH=rows.length*(bh+bg)+34;
   g.push(`<rect x="${px-4}" y="${ly-18}" width="${w+74}" height="${LH}" rx="18" fill="#e9f0fb" stroke="${BLUE}" stroke-width="1.6"/>`);
   g.push(text(px+2,ly-24,`<tspan font-size="22" font-weight="800" fill="${BLUE}">× ${M.n} 层</tspan>`,{}));
   let yy=ly;const rowY={};
   for(const [id,title,sub,comp] of rows){
    const attnOrFfn=id==='attn'||id==='ffn';
    if(attnOrFfn){   // two halves: one colour each kind
     const k2=id==='attn'?['kda','attn']:['dense','expert'],hw=(iw-20)/2;
     g.push(box({x:inner,y:yy,w:hw,h:bh,title:id==='attn'?'KDA 线性注意力':'稠密前馈',sub:id==='attn'?`${M.counts.kda} 层`:`前 ${M.counts.dense} 层`,comp:k2[0],weight:true,row:id+'-'+k2[0]},12));
     g.push(box({x:inner+hw+20,y:yy,w:hw,h:bh,title:id==='attn'?'MLA + 索引器':'MoE',sub:id==='attn'?`${M.counts.mla} 层`:`${M.counts.moe} 层`,comp:k2[1],weight:true,row:id+'-'+k2[1]},12));
     g.push(text(inner+iw/2,yy+bh/2+4,'或',{size:12,color:GREY,anchor:'middle'}));
    } else g.push(box({x:inner,y:yy,w:iw,h:bh,title,sub,comp,weight:id.startsWith('norm'),row:id},12));
    rowY[id]=yy;anchors[id]={x:inner,y:yy,w:iw,h:bh};yy+=bh+bg;
   }
   // arrows down the layer
   const ids=rows.map(r=>r[0]),split=id=>id==='attn'||id==='ffn';
   for(let i=1;i<ids.length;i++){const a=ids[i-1],b=ids[i];if(split(b)){for(const x of [inner+(iw-20)/4,inner+iw-(iw-20)/4])g.push(arrow([[inner+iw/2,rowY[a]+bh],[inner+iw/2,rowY[a]+bh+bg/2],[x,rowY[a]+bh+bg/2],[x,rowY[b]]]))}
    else if(split(a)){for(const x of [inner+(iw-20)/4,inner+iw-(iw-20)/4])g.push(arrow([[x,rowY[a]+bh],[x,rowY[a]+bh+bg/2],[inner+iw/2,rowY[a]+bh+bg/2],[inner+iw/2,rowY[b]]],{head:x>inner+iw/2}))}
    else g.push(arrow([[inner+iw/2,rowY[a]+bh],[inner+iw/2,rowY[b]]]))}
   // the 4 streams along the right, from the copy to the mean; each half takes them in and writes them back
   const top=anchors.expand.y+h,endY=ly-18+LH+gap+2,col=colorOf('resid',false);
   for(let k=0;k<4;k++)g.push(`<line x1="${sx+k*6}" y1="${top-6}" x2="${sx+k*6}" y2="${endY}" stroke="${col}" stroke-width="3" data-comp="resid" data-role="res"/>`);
   g.push(arrow([[anchors.expand.x+w,top-12],[sx-4,top-12]],{color:col,w:2}).replace(/<path/g,'<path data-comp="resid" data-role="res-stroke"'));
   g.push(text(sx+24,top+6,'4 路残差',{size:11.5,color:GREY}));
   for(const id of ['mhc','mhc2'])g.push(arrow([[sx-3,rowY[id]+bh/2],[inner+iw,rowY[id]+bh/2]],{w:1.6}));
   for(const id of ['write','write2'])g.push(arrow([[inner+iw,rowY[id]+bh/2],[sx-3,rowY[id]+bh/2]],{w:1.6}));
   y=ly-18+LH+gap;
   g.push(arrow([[sx+9,endY],[sx+9,y+h/2],[px+w,y+h/2]],{w:1.6}));
   for(const [i,b] of M.bottom.entries()){const yy2=put(b);if(i<M.bottom.length-1)g.push(arrow([[cx,yy2+h],[cx,yy2+h+gap]]))}
   // the MTP layer: the new word joins the sentence moved on by one; the main model's last hidden states come down the
   // left (off the arrow out of the final RMSNorm); its vocabulary and output head are the ones above (named in the boxes)
   const my=y+34,mTop=my-18;
   g.push(arrow([[cx,y-gap],[cx,my]]));
   g.push(`<rect x="${px-4}" y="${mTop}" width="${w+8}" height="${M.mtp.length*(h+gap)-gap+36}" rx="18" fill="#f1efea" stroke="#8a857c" stroke-width="1.6"/>`);
   // (its name left of the arrow coming in, what it does right of it)
   g.push(text(px+2,mTop-6,`<tspan font-size="18" font-weight="800">MTP</tspan><tspan font-size="12.5" fill="${GREY}"> · 第 ${M.n} 层</tspan>`,{}));
   g.push(text(cx+10,mTop-6,`猜再下一个词 · ${MTP_B.toFixed(2)}B`,{size:12.5,color:GREY}));
   y=my;
   for(const [i,b] of M.mtp.entries()){const yy2=put(b);if(i<M.mtp.length-1)g.push(arrow([[cx,yy2+h],[cx,yy2+h+gap]]))}
   const nA=anchors.norm,mA=anchors.mtp_norm,xh=px-9;
   g.push(arrow([[cx,nA.y+nA.h+gap/2],[xh,nA.y+nA.h+gap/2],[xh,mA.y+mA.h/2],[px,mA.y+mA.h/2]],{w:1.6}));
   return {svg:g.join(''),anchors,rowY,w:w+80,h:y-oy};
  }

  // ---- the 45 layers, one cell each: the attention's colour on top, the feed-forward's below
  function strip(ox,oy){
   const g=[],cell=26,gap=5,per=9,rows=Math.ceil(M.kinds.length/per);
   g.push(`<rect x="${ox}" y="${oy}" width="${per*(cell+gap)+40}" height="${rows*(cell+18+gap)+104}" rx="16" fill="none" stroke="${INK}" stroke-width="2.2" stroke-dasharray="3 5"/>`);
   g.push(text(ox+22,oy+26,'45 层各是哪一种',{size:17,weight:800}));
   g.push(text(ox+22,oy+45,`上半格 = 注意力：KDA ${num(M.counts.kda)} 层、MLA + 索引器 ${num(M.counts.mla)} 层`,{size:12.5,color:GREY}));
   g.push(text(ox+22,oy+63,`下半格 = 前馈：稠密 ${num(M.counts.dense)} 层、MoE ${num(M.counts.moe)} 层`,{size:12.5,color:GREY}));
   M.kinds.forEach(([a,f],i)=>{const x=ox+22+(i%per)*(cell+gap),y=oy+78+Math.floor(i/per)*(cell+18+gap),ca=a==='kda'?'kda':'attn',cf=f==='dense'?'dense':'expert';
    g.push(`<g class="box" data-comp="${ca}" data-kind="data"><title>L${String(i).padStart(2,'0')}：${a==='kda'?'KDA':'MLA + 索引器'} + ${f==='dense'?'稠密前馈':'MoE'}</title><rect x="${x}" y="${y}" width="${cell}" height="${cell*.62}" fill="${colorOf(ca,false)}" data-role="res"/></g>`);
    g.push(`<g class="box" data-comp="${cf}" data-kind="data"><rect x="${x}" y="${y+cell*.62}" width="${cell}" height="${cell*.38}" fill="${colorOf(cf,false)}" data-role="res"/></g>`);
    g.push(text(x+cell/2,y+cell+12,'L'+String(i).padStart(2,'0'),{size:9.5,color:GREY,anchor:'middle'}))});
   return {svg:g.join(''),w:per*(cell+gap)+40,h:rows*(cell+18+gap)+104};
  }

  // ---- the five panels with their titles and numbers (one place: arch.html's page and the chapter's segments)
  const PANELS = {
    mhc: () => [0, 'mHC：4 路残差的合成与写回（每层 2 次）',`每个词算 ${num(24)} 个系数：pre ${num(4)} 个合成 1 路，post ${num(4)} + comb ${num('4×4')} 个写回`],
    kda: () => [0, `KDA 线性注意力（${M.counts.kda} 层）`,`${num(64)} 个头，每头 ${num(128)} 维 · 短卷积 ${num(4)} 个抽头 · 每个头一个 ${num('128×128')} 的记忆 S，逐词更新（不存每个词的 K V，只存 S 和最近几个词的卷积窗口）`],
    mla: () => [3, `MLA + 索引器（${M.counts.mla} 层：L03、L07 … L43）`,`${num(64)} 个头 · Q 先压到 ${num(1536)}、K V 先压到 ${num(512)} · 索引器 ${num(32)} 个头，每 ${num(4)} 个词压成 1 个 K，最多挑 ${num(2048)} + ${num(3)} 个词来看（+3 是最后不满一组的尾巴）`],
    dense: () => [0, `稠密前馈（前 ${M.counts.dense} 层）`,`隐藏层 ${num(fmt(cfg.intermediate_size))}`],
    moe: () => [4, `MoE 前馈（${M.counts.moe} 层）`,`${num(288)} 个专家挑 ${num(8)} 个 + ${num(1)} 个共享专家，每个隐藏层 ${num(fmt(cfg.moe_intermediate_size))}`],
  };
  const titled = (key, ox, oy) => { const [li, t, f] = PANELS[key](); return panel(key, li, ox, oy, t, f) };

  // ---- the page
  function render(){
   const g=[],X0=24,Y0=124;
   g.push(text(X0,44,`GLM-5.3-Flash 的文字部分`,{size:28,weight:800}));
   g.push(text(X0,72,`按配置算：${num('313.3B')} 个参数（另有 MTP ${num(MTP_B.toFixed(2)+'B')}），每个词用到约 ${num('17.4B')}（1 个共享专家 + 288 个里挑 ${num(8)} 个；含词表嵌入 0.63B，不算它是 16.7B）· 隐藏维度 ${num(fmt(M.C))} · 词表 ${num(fmt(M.V))}`,{size:13.5,color:GREY}));
   g.push(text(X0,92,`64 个头 · 不用位置编码（NoPE）· 另有 24 层视觉编码器，这里不画 · 数据从上往下流，和 3D 一样`,{size:13.5,color:GREY}));
   const col=column(X0,Y0+20),RX=X0+col.w+44;
   g.push(col.svg);
   // the panels, right of the column
   const pM=titled('mhc',RX,Y0);
   const pS=strip(X0,Y0+20+col.h+30);
   const y1=Y0+pM.h+34;
   const pK=titled('kda',RX,y1);
   const y2=y1+pK.h+34;
   const pA=titled('mla',RX,y2);
   const y3=y2+pA.h+34;
   const yD=Y0+20+col.h+30+pS.h+34,pD=titled('dense',X0,yD);
   const pE=titled('moe',RX,y3);
   g.push(pM.svg,pS.svg,pK.svg,pA.svg,pD.svg,pE.svg);
   // dotted leaders from the column to the panels (as the gallery's)
   const A=col.anchors,lead=(a,x,y)=>g.push(`<path d="M${a.x+a.w} ${a.y+a.h/2} L${x} ${y}" stroke="${INK}" stroke-width="1.8" stroke-dasharray="2 5" fill="none"/>`);
   lead(A.mhc,RX,Y0+30);lead(A.attn,RX,y1+30);lead(A.attn,RX,y2+30);lead(A.ffn,RX,y3+30);
   // (the dense panel sits under the column: its leader runs down the page's left margin, clear of the column's boxes)
   g.push(`<path d="M${A.ffn.x} ${A.ffn.y+A.ffn.h/2} L${X0-14} ${A.ffn.y+A.ffn.h/2} L${X0-14} ${yD+30} L${X0} ${yD+30}" stroke="${INK}" stroke-width="1.8" stroke-dasharray="2 5" fill="none"/>`);
   const W=Math.max(RX+pK.w,RX+pA.w,RX+pE.w,RX+pM.w)+30,H=Math.max(y3+pE.h,yD+pD.h)+60;
   return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g.join('')}</svg>`;
  }
  return { panel, titled, column, strip, render, SPEC, M, colorOf };
}
