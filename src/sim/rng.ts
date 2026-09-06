/**
 * 确定性随机数：整个 sim 层禁止 Math.random / Date。
 * - hashString: FNV-1a 32 位，把张量 id 变成种子
 * - mixSeed: 把 (种子, 下标) 混成一个 32 位值，权重按位置惰性生成靠它
 */

export function hashString(s: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function mixSeed(a: number, b: number): number {
  let x = (a ^ Math.imul(b + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return x >>> 0 || 0x1234567;
}
