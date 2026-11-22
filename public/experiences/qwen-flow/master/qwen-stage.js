// Three.js WebGL 3D stage for Qwen3-8B and Qwen3-30B-A3B (shared by play, model, and layer views).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ACCENTS, PAGE, PALETTES, arrowColor, mix } from '../../glm-flow/master/flow-colors.js';
import { makeFlowLook } from '../../glm-flow/master/flow-look.js';
import { makeView } from '../../glm-flow/master/truth-view.js';
import { layoutQwenLayer, layoutQwenModel, ptWorld, toWorld } from './qwen-layout.js';
import { QWEN_MODELS, QWEN_TOKENS, getQwenVariant } from './qwen-spec.js';

const PAGE_COL = new THREE.Color(PAGE);
const DEFAULT_DIR = new THREE.Vector3(0.32, 0.24, 0.92).normalize();

function buildSceneData(mode, variant) {
  if (mode === 'layer') {
    const raw = layoutQwenLayer(variant);
    const blocks = raw.blocks.map(toWorld);
    const arrows = raw.arrows.map((a) => ({ ...a, pts: a.pts.map(ptWorld) }));
    const B = Object.fromEntries(blocks.map((b) => [b.id, b]));
    const boxOf = (list) => ({
      x0: Math.min(...list.map((b) => b.x0)), x1: Math.max(...list.map((b) => b.x1)),
      y0: Math.min(...list.map((b) => b.y0)), y1: Math.max(...list.map((b) => b.y1)),
      z0: Math.min(...list.map((b) => b.z0)), z1: Math.max(...list.map((b) => b.z1)),
    });
    const bounds = boxOf(blocks);
    return {
      blocks, arrows, B, bounds, stackIds: [], variant: raw.variant, spec: raw.spec,
      groupBoxes: {
        whole: bounds,
        attn: boxOf(blocks.filter((b) => b.group === 'attn')),
        ffn: boxOf(blocks.filter((b) => b.group === 'ffn')),
      },
    };
  }
  return layoutQwenModel(variant);
}

export function mountQwenStage({ host, mode = 'model', variant: rawVariant = '8b', onVariantChange, onFirstFrame }) {
  const variant = getQwenVariant(rawVariant);
  const spec = QWEN_MODELS[variant];
  const data = buildSceneData(mode, variant);
  host.innerHTML = '';

  const rect0 = host.getBoundingClientRect();
  let W = Math.max(320, Math.round(rect0.width || window.innerWidth));
  let H = Math.max(260, Math.round(rect0.height || window.innerHeight));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(dpr);
  renderer.setSize(W, H, false);
  renderer.setClearColor(PAGE, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, W / H, 0.5, 4500);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.85;
  controls.minPolarAngle = Math.PI * 0.12;
  controls.minDistance = 24;
  controls.maxDistance = 1400;

  const look = makeFlowLook({ px: dpr, pal: 'user', minPx: 1.5, viewH: H, slabs: 'gap', lines: 'band', prism: true });
  const batchMeshes = look.addBlockBatch(scene, data.blocks);
  const P = PALETTES.user;
  const arrowDefs = data.arrows.map((a) => ({
    pts: a.pts,
    color: arrowColor(P[a.comp]?.[0] || P.resid[0], a.comp),
    w: a.w || 2,
    z: -1.6,
    head: a.head !== false,
    r: 2.2,
    meta: { from: a.from, to: a.to, comp: a.comp },
  }));
  const arrowBatch = look.addArrowBatch(scene, arrowDefs);
  const view = makeView({ host, W, H, camera, controls });

  // Header & View Controls (zero debug controls, zero pal=/heads=)
  const modeLabel = mode === 'layer' ? '单层结构 (L00)' : mode === 'play' ? '计算演示舞台' : '整模型三维结构';
  view.title(`<b>${spec.name}</b> · ${modeLabel}`, spec.tagline);

  const viewsEl = document.createElement('div');
  viewsEl.id = 'views';
  const camBtns = mode === 'layer'
    ? `<button type="button" class="vbtn on" data-cam="whole">整层</button><button type="button" class="vbtn" data-cam="attn">注意力</button><button type="button" class="vbtn" data-cam="ffn">前馈</button><button type="button" class="vbtn" data-cam="reset">复位视角</button>`
    : `<button type="button" class="vbtn on" data-cam="whole">整模型</button><button type="button" class="vbtn" data-cam="attn">L00 注意力</button><button type="button" class="vbtn" data-cam="ffn">L00 前馈</button><button type="button" class="vbtn" data-cam="reset">复位视角</button>`;
  viewsEl.innerHTML = `
    <div>
      <button type="button" class="vbtn ${variant === '8b' ? 'on' : ''}" data-variant="8b">8B Dense</button>
      <button type="button" class="vbtn ${variant === '30b-a3b' ? 'on' : ''}" data-variant="30b-a3b">30B-A3B MoE</button>
    </div>
    <div>${camBtns}</div>
  `;
  host.append(viewsEl);

  // Semantic Legend
  const legendEl = document.createElement('div');
  legendEl.id = 'legend';
  const legItems = spec.ffnKind === 'moe'
    ? [['embed', '词表/LM Head'], ['resid', '单路残差'], ['norm', 'RMSNorm/QK-Norm'], ['attn', 'GQA 8:1/RoPE/KV'], ['router', '128选8 Softmax路由'], ['expert', '激活专家(0共享)']]
    : [['embed', '词表/LM Head'], ['resid', '单路残差'], ['norm', 'RMSNorm/QK-Norm'], ['attn', 'GQA 4:1/RoPE/KV'], ['dense', 'SwiGLU 稠密前馈']];
  legendEl.innerHTML = `<h1>${spec.name}</h1>` + legItems.map(([k, n]) => `<span class="k" style="background:${P[k][0]}"></span>${n}`).join('') +
    ` <span style="margin-left:10px;color:#52605a">KV Cache: ${spec.kvKiBPerTokenTotal} KiB/tok</span>`;
  host.append(legendEl);

  // 3D HTML labels + 6 token badges
  const MAJOR_IDS = mode === 'layer'
    ? new Set(['residual_in', 'Q_rope', 'kv_cache', 'residual_mid', 'h_ffn', 'W_moe_gu', 'residual_out'])
    : new Set(['token_ids', 'W_embed', 'Q_rope', 'kv_cache', 'h_ffn', 'W_moe_gu', 'layer_stack', 'W_lm_head', 'probs_next']);
  const DETAIL_IDS = new Set([
    'token_ids', 'W_embed', 'embed_out', 'residual_in', 'x_attn', 'Q', 'K', 'Q_norm', 'Q_rope',
    'kv_cache', 'attn_scores', 'attn_pv', 'attn_out', 'residual_mid', 'x_ffn', 'W_gate', 'h_ffn',
    'W_router', 'topk_prob', 'W_moe_gu', 'ffn_out', 'residual_out', 'layer_stack', 'final_norm',
    'W_lm_head', 'logits', 'probs_next',
  ]);
  const RIGHT_IDS = new Set(['residual_in', 'residual_mid', 'residual_out']);
  const labelEntries = [];
  for (const b of data.blocks) {
    if (b.id.startsWith('layer_stack_') || !DETAIL_IDS.has(b.id)) continue;
    const isRight = b.group === 'stack' || b.group === 'output' || RIGHT_IDS.has(b.id);
    const p = view.V(isRight ? b.x1 + 3.5 : b.x0 - 3.5, (b.y0 + b.y1) / 2, 0.5);
    const el = view.label(`<b>${b.label}</b> <i>${b.shapeText}</i>`, p, isRight ? 'r' : 'rr', true);
    labelEntries.push({ id: b.id, group: b.group, major: MAJOR_IDS.has(b.id), el });
  }

  // Token badges strip floating over input tokens
  const tokStrip = document.createElement('div');
  tokStrip.className = 'tok-strip';
  tokStrip.innerHTML = QWEN_TOKENS.map((t, i) => `<span class="tok-badge" data-ti="${i}">${t.text}<i>#${t.id}</i></span>`).join('');
  host.append(tokStrip);

  // Computation Lens (#dotcard & #dotpill)
  const dotcard = document.createElement('div');
  dotcard.id = 'dotcard';
  dotcard.className = 'dot-card';
  dotcard.hidden = true;
  const dotpill = document.createElement('div');
  dotpill.id = 'dotpill';
  dotpill.className = 'dot-pill';
  dotpill.hidden = true;
  host.append(dotcard, dotpill);

  // WebGL context lost gentle recovery banner
  const lostEl = document.createElement('div');
  lostEl.id = 'webgl-lost';
  lostEl.hidden = true;
  lostEl.innerHTML = `<div class="lost-box"><b>WebGL 渲染上下文暂时中断</b><p>浏览器回收了显卡资源，可点击下方按钮恢复三维舞台。</p><button type="button" class="btn primary" id="reload-stage">重新加载舞台</button></div>`;
  host.append(lostEl);
  const onLost = (ev) => { ev.preventDefault(); lostEl.hidden = false; };
  renderer.domElement.addEventListener('webglcontextlost', onLost, false);
  lostEl.querySelector('#reload-stage').addEventListener('click', () => location.reload());

  let dirty = true;
  let rafId = 0;
  let disposed = false;
  let firstFrameFired = false;
  let activeCamKey = 'whole';
  let lastSegN = -1;
  let lastBeatIdx = -1;

  function syncLabelVisibility(keepSet = null) {
    const majorOnly = lastSegN < 0 && activeCamKey === 'whole';
    for (let i = 0; i < labelEntries.length; i++) {
      const e = labelEntries[i];
      const show = keepSet ? keepSet.has(e.id) : majorOnly ? e.major : e.group === activeCamKey;
      e.el.classList.toggle('off', !show);
    }
  }

  function fitBox(box, zoom = 0.94) {
    view.fit(box, DEFAULT_DIR, 0.9, [0, 0], false, zoom);
    dirty = true;
  }
  function setCamPreset(key) {
    activeCamKey = key === 'reset' ? 'whole' : key;
    const box = data.groupBoxes[activeCamKey] || data.bounds;
    fitBox(box, activeCamKey === 'whole' ? 0.94 : 0.88);
    viewsEl.querySelectorAll('button[data-cam]').forEach((b) => {
      b.classList.toggle('on', b.dataset.cam === activeCamKey);
    });
    if (lastSegN < 0) syncLabelVisibility(null);
  }

  function showWhole() {
    lastSegN = -1;
    lastBeatIdx = -1;
    for (const b of data.blocks) {
      look.dimOne(b.id, 0);
      look.setRecv(b.id, 0);
    }
    arrowBatch.syncDim(() => true, PAGE_COL, 0);
    dotcard.hidden = true;
    dotpill.hidden = true;
    host.classList.remove('inseg');
    tokStrip.classList.remove('is-focus');
    tokStrip.querySelectorAll('.tok-badge').forEach((el) => el.classList.remove('active'));
    setCamPreset('whole');
    syncLabelVisibility(null);
    dirty = true;
  }

  function focusSegment(seg, beatIdx = 0, beatFrac = 1) {
    if (!seg) return showWhole();
    const segChanged = seg.n !== lastSegN;
    const beatChanged = segChanged || beatIdx !== lastBeatIdx;
    lastSegN = seg.n;
    lastBeatIdx = beatIdx;

    const keep = new Set(seg.focusIds);
    const writes = new Set(seg.writeIds || []);
    if (keep.has('layer_stack')) for (const sid of data.stackIds) keep.add(sid);
    syncLabelVisibility(keep);
    for (const b of data.blocks) {
      const hit = keep.has(b.id);
      look.dimOne(b.id, hit ? 0 : 0.78);
      look.setRecv(b.id, writes.has(b.id) && beatFrac < 0.85 ? 1 : 0);
    }
    arrowBatch.syncDim((it) => keep.has(it.from) || keep.has(it.to), PAGE_COL, 0.82);

    if (segChanged) {
      const activeBlocks = data.blocks.filter((b) => keep.has(b.id));
      if (activeBlocks.length > 0) {
        const box = {
          x0: Math.min(...activeBlocks.map((b) => b.x0)) - 12,
          x1: Math.max(...activeBlocks.map((b) => b.x1)) + 12,
          y0: Math.min(...activeBlocks.map((b) => b.y0)) - 10,
          y1: Math.max(...activeBlocks.map((b) => b.y1)) + 10,
          z0: Math.min(...activeBlocks.map((b) => b.z0)) - 4,
          z1: 2,
        };
        fitBox(box, 0.84);
      }
    }

    if (beatChanged) {
      const compAccent = ACCENTS[seg.comp] || '#286151';
      const flows = variant === '30b-a3b' ? seg.flow30b : seg.flow8b;
      const beat = seg.beats[beatIdx] || seg.beats[0];
      dotcard.style.setProperty('--dot-accent', compAccent);
      dotcard.innerHTML = `
        <div class="dot-tag">第 ${String(seg.n).padStart(2, '0')} 步 · ${seg.title}</div>
        <div class="dot-shape"><i>张量流</i><b>${flows.join(' → ')}</b></div>
        <div class="dot-shape"><i>当前动作</i>${beat ? beat.text : seg.summary}</div>
      `;
      dotcard.hidden = false;
      dotpill.innerHTML = `<div class="dot-formula">${seg.formula(spec)}</div>`;
      dotpill.hidden = false;
    }

    tokStrip.classList.toggle('is-focus', seg.n <= 2);
    const tokIdx = Math.min(QWEN_TOKENS.length - 1, Math.floor(beatFrac * QWEN_TOKENS.length));
    tokStrip.querySelectorAll('.tok-badge').forEach((el, idx) => {
      el.classList.toggle('active', seg.n <= 2 ? idx <= tokIdx : idx === tokIdx);
    });
    dirty = true;
  }

  viewsEl.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    if (btn.dataset.variant && btn.dataset.variant !== variant && onVariantChange) {
      onVariantChange(btn.dataset.variant);
    } else if (btn.dataset.cam) {
      setCamPreset(btn.dataset.cam);
    }
  });
  controls.addEventListener('change', () => { dirty = true; });

  const ro = new ResizeObserver(() => {
    const r = host.getBoundingClientRect();
    const nw = Math.max(260, Math.round(r.width));
    const nh = Math.max(220, Math.round(r.height));
    if (nw === W && nh === H) return;
    W = nw; H = nh;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H, false);
    look.setResolution(dpr, H);
    view.resize(W, H);
    fitBox(data.groupBoxes[activeCamKey] || data.bounds, activeCamKey === 'whole' ? 0.94 : 0.88);
    dirty = true;
  });
  ro.observe(host);

  function resolveLabelOverlaps() {
    for (let i = 0; i < labelEntries.length; i++) labelEntries[i].el.style.top = '0px';
    const hr = host.getBoundingClientRect();
    const maxY = (legendEl ? legendEl.getBoundingClientRect().top : hr.bottom) - hr.top - 4;
    const items = [];
    for (let i = 0; i < labelEntries.length; i++) {
      const el = labelEntries[i].el;
      if (el.style.display === 'none' || el.classList.contains('off')) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      items.push({
        el,
        left: r.left - hr.left,
        right: r.right - hr.left,
        top: r.top - hr.top,
        h: r.height,
        cx: (r.left + r.right) * 0.5 - hr.left,
        dy: 0,
      });
    }
    const pushCol = (col) => {
      col.sort((a, b) => a.top - b.top);
      for (let i = 1; i < col.length; i++) {
        const prev = col[i - 1];
        const cur = col[i];
        const minTop = prev.top + Math.max(22, prev.h + 4);
        if (cur.top < minTop) {
          const shift = minTop - cur.top;
          cur.top += shift;
          cur.dy += shift;
        }
      }
    };
    pushCol(items.filter((it) => it.cx < W * 0.5));
    pushCol(items.filter((it) => it.cx >= W * 0.5));
    items.sort((a, b) => a.top - b.top);
    for (let i = 1; i < items.length; i++) {
      const cur = items[i];
      for (let j = 0; j < i; j++) {
        const prev = items[j];
        if (cur.left < prev.right + 4 && prev.left < cur.right + 4) {
          const minTop = prev.top + Math.max(22, prev.h + 4);
          if (cur.top < minTop) {
            const shift = minTop - cur.top;
            cur.top += shift;
            cur.dy += shift;
          }
        }
      }
    }
    const uiRects = ['legend', 'dotcard', 'dotpill'].map((id) => document.getElementById(id))
      .concat([tokStrip])
      .filter((u) => u && !u.hidden && u.style.display !== 'none')
      .map((u) => {
        const r = u.getBoundingClientRect();
        return { left: r.left - hr.left, right: r.right - hr.left, top: r.top - hr.top, bottom: r.bottom - hr.top };
      });
    for (const it of items) {
      if (it.dy) it.el.style.top = `${Math.round(it.dy)}px`;
      const bot = it.top + it.h;
      const hitUI = uiRects.some((u) => it.left < u.right && u.left < it.right && it.top < u.bottom && u.top < bot);
      if (bot > maxY || hitUI) it.el.style.display = 'none';
    }
  }

  setCamPreset('whole');

  function frame() {
    if (disposed) return;
    rafId = requestAnimationFrame(frame);
    if (document.hidden) return;
    if (controls.update() || dirty) {
      renderer.render(scene, camera);
      view.place();
      view.hideUnderUI(['title', 'legend', 'views', 'dotcard', 'dotpill', 'webgl-lost']);
      resolveLabelOverlaps();
      dirty = false;
      if (!firstFrameFired) {
        firstFrameFired = true;
        if (onFirstFrame) onFirstFrame();
      }
    }
  }
  rafId = requestAnimationFrame(frame);

  return {
    variant,
    spec,
    focusSegment,
    showWhole,
    setCamPreset,
    dispose() {
      disposed = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      controls.dispose();
      for (const m of batchMeshes) { m.geometry?.dispose(); m.material?.dispose(); }
      arrowBatch.mesh?.geometry?.dispose();
      arrowBatch.mesh?.material?.dispose();
      renderer.dispose();
    },
  };
}
