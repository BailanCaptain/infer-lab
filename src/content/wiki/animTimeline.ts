/**
 * 分镜动画的时间轴（2026-09-29）。
 *
 * 渲染器（scripts/wiki/figure.ts）把块的路线、关键帧、出现 / 消失 / 淡出的时刻写进 SVG，
 * 播放器（DiagramPlayer.tsx）照着播。这里是「关键帧怎么解释」的唯一定义：
 * 播放器用它取点，渲染器的测试也用它按时刻采样，查路上的块会不会互相压住。
 */

export interface Point {
  x: number;
  y: number;
}

/** 折线上按长度比例 u（0 到 1）取点 */
export function pointAlong(points: Point[], u: number): Point {
  const first = points[0];
  if (!first) return { x: 0, y: 0 };
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i]!.x, p.y - points[i]!.y));
  const total = lengths.reduce((a, b) => a + b, 0);
  let left = Math.min(Math.max(u, 0), 1) * total;
  for (const [i, l] of lengths.entries()) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (left <= l || i === lengths.length - 1) {
      const t = l > 0 ? Math.min(left / l, 1) : 1;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    left -= l;
  }
  return first;
}

/** 起步和落地都放慢，看得清块从哪张卡出发、落进哪一格 */
export function ease(u: number): number {
  return u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
}

/**
 * 读 data-keys：路线上每个折点一个时刻（整段播放时间的比例，0 到 1），「-」是中间点。
 * 个数和折点数不一样、头尾是「-」、时刻倒退都算写错，返回 null（播放器照旧按总长度走）。
 */
export function parseKeys(s: string | null | undefined, n: number): (number | null)[] | null {
  if (!s) return null;
  const keys = s
    .trim()
    .split(/\s+/)
    .map((k) => (k === "-" ? null : Number(k)));
  if (keys.length !== n || keys[0] === null || keys.at(-1) === null) return null;
  let prev = Number.NEGATIVE_INFINITY;
  for (const k of keys) {
    if (k === null) continue;
    if (!Number.isFinite(k) || k < prev) return null;
    prev = k;
  }
  return keys;
}

/**
 * 按关键帧取点：相邻两个关键点之间整段缓动（中间点按长度分），所以拐弯不停顿；
 * 两个关键点落在同一处就是停在那里。第一个关键点之前停在起点，最后一个之后停在终点。
 */
export function pointAt(points: Point[], keys: (number | null)[], u: number): Point {
  const idx = keys.flatMap((k, i) => (k === null ? [] : [i]));
  const start = points[idx[0] ?? 0];
  if (!start) return { x: 0, y: 0 };
  if (u <= (keys[idx[0]!] ?? 0)) return start;
  for (let j = 0; j + 1 < idx.length; j++) {
    const a = idx[j]!;
    const b = idx[j + 1]!;
    const ka = keys[a]!;
    const kb = keys[b]!;
    if (u <= kb) {
      const t = kb > ka ? ease((u - ka) / (kb - ka)) : 1;
      return pointAlong(points.slice(a, b + 1), t);
    }
  }
  return points[idx.at(-1)!] ?? start;
}

/** data-show / data-hide：u 这一刻看不看得见（show 那一刻起可见，hide 那一刻起消失） */
export function shownAt(show: number | null, hide: number | null, u: number): boolean {
  return (show === null || u >= show) && (hide === null || u < hide);
}

/** 读 data-fade="a b"：从 a 到 b 由不透明淡到透明；写错返回 null */
export function parseFade(s: string | null | undefined): [number, number] | null {
  const m = /^\s*([\d.]+)\s+([\d.]+)\s*$/.exec(s ?? "");
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return Number.isFinite(a) && Number.isFinite(b) && b > a ? [a, b] : null;
}

/** u 这一刻的不透明度：看不见是 0；在淡出窗口里按时间线性变淡 */
export function opacityAt(
  show: number | null,
  hide: number | null,
  fade: [number, number] | null,
  u: number,
): number {
  if (!shownAt(show, hide, u)) return 0;
  if (!fade || u <= fade[0]) return 1;
  if (u >= fade[1]) return 0;
  return (fade[1] - u) / (fade[1] - fade[0]);
}
