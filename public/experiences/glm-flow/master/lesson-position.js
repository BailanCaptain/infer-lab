// Flat storage index → actual layout axes. Independent of camera and renderer.
export function lessonPosition(b,index,shape,weight,blocks){
 const along=(k,n,a)=>a==='x'?b.x0+(k+.5)/n*(b.x1-b.x0):b.y1-(k+.5)/n*(b.y1-b.y0);
 const slab=h=>b.div[2]<=1?b.z1:b.z1-h*(b.z1-b.z0)/b.div[2]-(b.z1-b.z0)/b.div[2]/(1+(b.headGap||0))/2;
 const cols=shape.at(-1),per=shape.slice(1).reduce((a,b)=>a*b,1),token=Math.floor(index/per),r=index%per;
 let x=(b.x0+b.x1)/2,y=(b.y0+b.y1)/2,z=b.z1,candidate=null;
 if(weight){
  let row=Math.floor(index/cols),c=index%cols;
  if(shape.length===1){if(b.orient==='bar')x=along(index,shape[0],'x');else y=along(index,shape[0],'y')}
  else if(b.t.id==='W_embed'){x=along(token,shape[0],'x');y=along(r,cols,'y');candidate=token}
  else if(b.t.id==='ape'){x=along(token,shape[0],'x');y=along(r,cols,'y')}
  else{
   if(shape.length===3){z=slab(Math.floor(row/shape[1]));row%=shape[1]}
   const outputs=b.t.cols,H=b.t.deck?.n||1,inputs=b.t.rows.n;
   if(b.t.deck?.kind==='stream'){x=along(c%inputs,inputs,'x');y=along(row,outputs,'y');z=slab(Math.floor(c/inputs))}
   else if(b.orient==='wt'){x=along(row,outputs,'x');y=along(c,inputs,'y')}
   else if(b.t.headAxis==='y'){x=along(c,inputs*H,'x');y=along(row,outputs,'y')}
   else if(b.alt==='y'){x=along(c,inputs,'x');y=along(row,outputs*H,'y')}
   else{x=along(c,inputs,'x');y=along(row%outputs,outputs,'y');if(shape.length!==3&&b.div[2]>1)z=slab(Math.floor(row/outputs))}
   if(b.t.id==='W_head')candidate=row;
  }
 }else{
  let j=token,ch=r,h=0;const nc=b.t.cols,nt=b.t.rows.n,H=b.t.deck?.n||1;
  if(shape.length===1){j=b.t.id==='ids'?index:0;ch=0}
  if(b.t.id==='attn_w'){h=Math.floor(index/(nt*nc));j=Math.floor(index%(nt*nc)/nc);ch=index%nc}
  else if(b.div[2]>1&&nc>1){h=Math.floor(ch/nc);ch%=nc}
  if(b.orient==='row'){x=along(ch,nc,'x');y=along(j,nt,'y')}
  else{x=along(j,nt,'x');y=along(b.alt==='y'?r:ch,b.alt==='y'?nc*H:nc>1?nc:H,'y')}
  if(b.div[2]>1&&nc>1)z=slab(h);
  if(['logits','probs'].includes(b.t.id)&&b.end)candidate=r;
 }
 let omitted=false;
 if(b.elided&&candidate!==null){
  const count=154880,visible=Math.round((b.x1-b.x0)/.008),left=blocks[b.id+'/0'];
  if(candidate<visible&&left)x=left.x0+(candidate+.5)/visible*(left.x1-left.x0);
  else if(candidate>=count-visible)x=along(candidate-count+visible,visible,'x');
  else{x=(left.x1+b.x0)/2;omitted=true}
 }
 return{x,y,z,omitted,candidate};
}

export function lessonProgress(b,shape,u){
 const n=shape.reduce((a,b)=>a*b,1),q=Math.min(n-1,Math.floor(Math.min(1,u)*n));
 if(b.t.deck?.kind==='head'&&b.div[2]>1){
  const H=b.t.deck.n,T=b.t.rows.n,C=b.t.cols,h=Math.floor(q/(T*C)),j=Math.floor(q%(T*C)/C),r=q%C;
  return{index:b.t.id==='attn_w'?(h*T+j)*C+r:(j*H+h)*C+r,j,R:h*C+r};
 }
 const per=shape.slice(1).reduce((a,b)=>a*b,1);
 return{index:q,j:Math.floor(q/per),R:q%per};
}
