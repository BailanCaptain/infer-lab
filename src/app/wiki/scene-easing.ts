/** Shared easing for every parallel scene, so scrubbing and playback derive from one curve. */
export const smooth = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};
export const span = (p: number, start: number, end: number) => smooth((p - start) / (end - start));
