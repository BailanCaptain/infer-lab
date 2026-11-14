// Approved master palette. Temporary browser choices never override this release.
const hx = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
export const mix = (a, b, t) => '#' + hx(a).map((v, i) => Math.round(v + (hx(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');

export const PAGE = '#f8f5ee';

export const PALETTES = {
  user: { resid: ['#DECBE4', '#f6c8b7'], norm: ['#d3cebb', '#e5e2d8'], kda: ['#a3e7f0', '#9cc3a3'], attn: ['#CBD5E8', '#b3abce'],
          dense: ['#E5D8BD', '#79b087'], router: ['#cc6677', '#e0a6ad'], expert: ['#CCDDAA', '#c5e3d8'], embed: ['#E5D8BD', '#a1c3d7'],   // (09-25 the user: from #999933 / #c4c287)
          mtp: ['#a8a29e', '#e7e5e4'], vis: ['#7dd3fc', '#e0f2fe'] },
};
export const DEFAULT_PALETTE = 'user';
export const NAMES = { resid: '残差（主干）', norm: '归一化', kda: 'KDA 注意力', attn: '稀疏注意力（MLA）', dense: '稠密前馈', router: '路由',
                       expert: '专家', embed: '词表（嵌入、输出头）', mtp: 'MTP', vis: '视觉' };
// an arrow is the colour of the component it comes from, a quarter of the way to the page
export const arrowColor = res => mix(res, PAGE, .25);


export function loadPalette() {
  return Object.fromEntries(Object.entries(PALETTES.user).map(([key, pair]) => [key, [...pair]]));
}
