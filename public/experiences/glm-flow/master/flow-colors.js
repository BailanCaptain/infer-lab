// Approved master 3D mineral palette: OKLCH-calibrated [activation/result, parameter/weight] pairs,
// harmonized 1-to-1 with 2D architecture tokens (reader-palette.css) while honoring component-per-hue identity.
const hx = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
export const mix = (a, b, t) => '#' + hx(a).map((v, i) => Math.round(v + (hx(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');

export const PAGE = '#f7f8f5';

export const PALETTES = {
  user: {
    resid:  ['#c3aecc', '#daccdf'],   // Smoky Mauve-Plum (4-stream mHC spine & dynamic mix weights; H=316°)
    norm:   ['#cec8b7', '#dfdcd2'],   // Warm Travertine-Limestone (RMSNorm / LayerNorm; H=90°)
    kda:    ['#8cc2b1', '#b8d9ce'],   // Pine-Celadon Jade (34-layer KDA linear attention; H=172.5°)
    attn:   ['#a0b6db', '#c3d1e9'],   // Slate Cobalt-Indigo (11-layer Sparse MLA + Indexer; H=260°)
    dense:  ['#a5c19c', '#c6d8c1'],   // Botanical Moss-Sage (L00–L02 Dense FFN; H=138.5°)
    router: ['#daa29b', '#eac6c2'],   // Terracotta Cinnabar (MoE Router & Top-8 weights; H=26.5°)
    expert: ['#d2b68d', '#e3d1b7'],   // Warm Ochre-Sandstone (42-layer MoE 288 Routed + Shared Experts; H=77.3°)
    embed:  ['#99bcd1', '#bfd5e2'],   // Nordic Fjord Slate-Cerulean (Vocabulary Embed & Independent LM Head; H=235.5°)
    mtp:    ['#cbbcb0', '#dfd5cd'],   // Warm Umber-Taupe (MTP Speculative Layer; H=59.5°)
    vis:    ['#8fc3c7', '#bad9db'],   // Glacier Sea-Slate (Vision Encoder; H=202°)
  },
};
export const DEFAULT_PALETTE = 'user';
export const NAMES = { resid: '残差（主干）', norm: '归一化', kda: 'KDA 注意力', attn: '稀疏注意力（MLA）', dense: '稠密前馈', router: '路由',
                       expert: '专家', embed: '词表（嵌入、输出头）', mtp: 'MTP', vis: '视觉' };
// Exact 1-to-1 mineral ink accents shared with reader-palette.css (--arch-*)
export const ACCENTS = {
  resid: '#6f5e76', norm: '#787262', kda: '#356859', attn: '#495d7d',
  dense: '#556e4e', router: '#8c5650', expert: '#7d6643', embed: '#4d6778',
  mtp: '#6e6259', vis: '#36686d',
};
// Arrows carry a restrained mineral-slate ribbon tone (matching --arch-resid-rail on the 4-stream spine)
export const arrowColor = (res, comp) =>
  comp === 'resid'
    ? '#8d7b94'
    : comp && ACCENTS[comp]
      ? mix(mix(res, ACCENTS[comp], .34), '#4e5a55', .28)
      : mix(res, '#4e5a55', .32);


export function loadPalette() {
  return Object.fromEntries(Object.entries(PALETTES.user).map(([key, pair]) => [key, [...pair]]));
}
