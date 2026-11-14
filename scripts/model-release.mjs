// Publish the accepted master without its temporary appearance experiments.
// Fail on changed source markers so a later sync cannot silently restore debug UI.
function replace(text, before, after) {
  if (!text.includes(before)) throw new Error(`Model release source changed: ${before.slice(0, 90)}`);
  return text.replace(before, after);
}

function between(text, start, end, replacement) {
  const a = text.indexOf(start);
  const b = text.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`Model release source changed: ${start}`);
  return text.slice(0, a) + replacement + text.slice(b);
}

// The embedded model can finish loading after the reader has pressed pause.
// Retain that intent instead of sending a command to an unready frame.
export function adaptChapterPlayback(text) {
  text = replace(
    text,
    "if(m.ev==='ready'){ready=true;if(queued){send({cmd:queued.play?'play':'go',n:queued.n});queued=null}}",
    "if(m.ev==='ready'){ready=true;if(queued){if(queued.t!==undefined)send({cmd:'seek',n:queued.n,t:queued.t});if(queued.play)send({cmd:'play',n:queued.n});else if(queued.t===undefined)send({cmd:'go',n:queued.n});queued=null}}",
  );
  return replace(
    text,
    "$('#play').onclick=()=>{if(!cur)return select(order[0],{play:true});if(state.playing)send({cmd:'pause'});else send({cmd:'play',n:cur})};",
    "$('#play').onclick=()=>{if(!cur)return select(order[0],{play:true});if(!ready){state.playing=!state.playing;queued={n:cur,play:state.playing,t:state.t};paint();return}if(state.playing)send({cmd:'pause'});else send({cmd:'play',n:cur})};",
  );
}

export function releaseModelFile(name, text) {
  // Independently importable matrix renderer, sharing the master's own Three version.
  if (name === "flow-look.js")
    return replace(text, "from 'three'", "from '../../vendor/build/three.module.js'");
  if (["flow-colors.js", "chapter.html", "model.html", "flow.html", "arch.html"].includes(name))
    text = text.replaceAll("\r\n", "\n");
  if (name === "flow-colors.js") {
    // Read the approved values from the master; never duplicate them in the shell.
    const user = text.slice(text.indexOf("  user: {"), text.indexOf("  tailwind: {"));
    if (!user.startsWith("  user: {") || !user.includes("#E5D8BD"))
      throw new Error("Missing approved model palette");
    const helpers = text.slice(text.indexOf("const hx ="), text.indexOf("// Apple's"));
    const names = text.slice(text.indexOf("export const NAMES"), text.indexOf("const key ="));
    return `// Approved master palette. Temporary browser choices never override this release.\n${helpers}
export const PALETTES = {\n${user}};
export const DEFAULT_PALETTE = 'user';
${names}
export function loadPalette() {
  return Object.fromEntries(Object.entries(PALETTES.user).map(([key, pair]) => [key, [...pair]]));
}\n`;
  }

  if (name === "chapter.html") {
    text = adaptChapterPlayback(text);
    text = replace(text, "loadPalette,DEFAULT_PALETTE", "loadPalette");
    text = replace(
      text,
      "loadPalette(new URLSearchParams(location.search).get('pal')||DEFAULT_PALETTE)",
      "loadPalette()",
    );
    text = replace(text, `\${location.search.replace('?','&')}`, "");
    text = replace(
      text,
      "</style>",
      `
body[data-inline] #app{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) auto}
body[data-inline] #right{grid-row:1;min-height:0}
body[data-inline] #left{grid-row:2;border-right:0}
body[data-inline] #scroll{display:none}
</style>`,
    );
    return replace(
      text,
      "load();paint();",
      "const entryParams=new URLSearchParams(location.search);\nif(entryParams.get('inline')==='1')document.body.dataset.inline='';\nload();\nconst entry=Number(entryParams.get('segment'));\nif(built.has(entry))select(entry,{play:true});\npaint();",
    );
  }

  if (!["model.html", "flow.html", "arch.html"].includes(name)) return text;
  text = replace(text, "import {makeTuner} from './flow-tune.js';", "");

  if (name === "arch.html") {
    text = replace(text, "PAGE,NAMES,PALETTE_NAMES,DEFAULT_PALETTE,onOutsideChange,mix", "loadPalette");
    text = replace(text, ".box{cursor:pointer}\n.box:hover rect{filter:brightness(.97)}", "");
    text = replace(text, "#tunebar{position:absolute!important}#tunepop{position:fixed!important}", "");
    text = between(text, "const Q=new URLSearchParams", "const cfg=", "");
    text = between(
      text,
      "const P={};",
      "const page=",
      "const P=loadPalette();\nconst {render}=makeArch(cfg,P);\n",
    );
    text = between(
      text,
      "const comps=new Set();",
      "window.__arch=",
      `page.innerHTML=render();paint();
const v=document.createElement('div');v.id='views';
v.innerHTML='<div>3D：<a href="model.html">整个模型</a><a href="flow.html?layer=0">L00</a><a href="flow.html?layer=4">L04</a><a href="flow.html?layer=3">L03</a></div>';
document.body.append(v);
`,
    );
    return text.replace("// and tuned by clicking a box (flow-tune.js).", "// using the approved palette.");
  }

  text = replace(
    text,
    "PAGE,NAMES,PALETTE_NAMES,DEFAULT_PALETTE,arrowColor,onOutsideChange",
    "PAGE,NAMES,DEFAULT_PALETTE,arrowColor",
  );
  for (const [before, after] of [
    ["PAL=Q.get('pal')||DEFAULT_PALETTE", "PAL=DEFAULT_PALETTE"],
    ["HEADS=Q.get('heads')||'z'", "HEADS='z'"],
    ["SLABS=Q.get('slabs')||'gap'", "SLABS='gap'"],
    ["+(Q.get('gap')??HEAD_GAP)", "HEAD_GAP"],
    ["minPx:+(Q.get('minpx')??3)", "minPx:3"],
    ["alt:Q.get('alt')==='1'", "alt:false"],
    ["fine:+(Q.get('fine')??16)", "fine:16"],
    ["hlines:Q.get('hlines')!=='0'", "hlines:true"],
    ["fineWords:Q.get('fw')!=='0'", "fineWords:true"],
    ["flat:Q.get('flat')==='1'", "flat:false"],
  ])
    text = replace(text, before, after);

  text = between(
    text,
    "const present=[...new Set(WB.map(b=>b.comp))];",
    "if(Q.get('tabs')",
    `const present=[...new Set(WB.map(b=>b.comp))];
if(LEGEND){const lg=document.createElement('div');lg.id='legend';lg.innerHTML=\`一个词一列 · 张量按真实尺寸绘制 · 结果与权重使用同组颜色<br>\${present.map(k=>\`<span class="k" style="background:\${look.palette[k][0]}"></span>\${NAMES[k]||k}\`).join('')}\`;host.append(lg)}
`,
  );
  // Keep exploration by view/layer; remove only the appearance comparison rows.
  text = text
    .split("\n")
    .filter((line) => !line.includes("+`<div>配色：") && !line.includes("+`<div>头："))
    .join("\n");
  text = replace(text, ";tabsBottom=v.offsetTop+v.offsetHeight+6", "");
  text = replace(
    text,
    "if(Q.get('labels')==='0'){for(const el of [...host.querySelectorAll('.l')])el.remove();labels.length=0}",
    "",
  );
  text = text.replaceAll(`?pal=\${PAL}`, "");

  if (name === "model.html") {
    text = replace(text, "LEGEND=Q.get('legend')!=='0'&&!EMBED", "LEGEND=!EMBED");
    text = replace(text, "lines:Q.get('lines')||'band'", "lines:'band'");
    text = replace(text, "MINPX=+(Q.get('minpx')??3)", "MINPX=3");
    text = replace(text, "dir=Q.get('dir')?V(...Q.get('dir').split(',').map(Number)):dir0", "dir=dir0");
    text = replace(text, "if(Q.get('tabs')!=='0'&&!EMBED)", "if(!EMBED)");
    text = replace(text, "'tunebar','tunepop',", "");
    // Playback uses each arrow's original colour when restoring a scene.
    return between(
      text,
      "// ---- temporary colour tuning",
      "window.__truth=",
      "for(const a of ARROWS)a.base=a.m.material.color.clone();\n",
    );
  }

  text = replace(text, "<title>照 bbycroft 排的一层</title>", "<title>GLM 单层结构</title>");
  text = replace(text, "LEGEND=Q.get('legend')!=='0'", "LEGEND=true");
  text = replace(
    text,
    "const dir=Q.get('dir')?V(...Q.get('dir').split(',').map(Number)):V(.5,.42,1)",
    "const dir=V(.5,.42,1)",
  );
  text = between(text, "if(Q.get('fit'))", "const present=", "");
  text = replace(text, "if(Q.get('tabs')!=='0')", "");
  text = replace(text, "if(!Q.get('fit'))settle();", "settle();");
  return between(text, "// ---- temporary colour tuning", "window.__truth=", "");
}
