export type LabelRect = { x: number; y: number; width: number; height: number };

/** Attach a value to its own projected block, rather than a detached column of values. */
export function placeSceneCellLabel(
  block: LabelRect,
  size: { width: number; height: number },
  side: "left" | "right",
  occupied: LabelRect[],
  bounds: LabelRect,
  wires: LabelRect[] = [],
): LabelRect {
  const x = side === "left" ? block.x - size.width - 8 : block.x + block.width + 8;
  const outside = x < bounds.x || x + size.width > bounds.x + bounds.width;
  const placed = placeSceneLabel(
    {
      x: outside ? block.x + (block.width - size.width) / 2 : x,
      y: outside ? block.y - size.height - 8 : block.y + (block.height - size.height) / 2,
      ...size,
    },
    [block, ...occupied],
    bounds,
  );
  if (!wires.length) return placed;
  const clearOfWires = placeSceneLabel(placed, [block, ...occupied, ...wires], bounds);
  // Keep ownership readable when a narrow canvas cannot fit both the wire and the value beside it.
  return Math.hypot(clearOfWires.x - placed.x, clearOfWires.y - placed.y) <= 32 ? clearOfWires : placed;
}

export function placeSceneLabel(wanted: LabelRect, occupied: LabelRect[], bounds: LabelRect): LabelRect {
  const gap = 6;
  const clamp = (x: number, y: number): LabelRect => ({
    ...wanted,
    x: Math.max(bounds.x, Math.min(x, bounds.x + bounds.width - wanted.width)),
    y: Math.max(bounds.y, Math.min(y, bounds.y + bounds.height - wanted.height)),
  });
  const clear = (a: LabelRect) =>
    occupied.every(
      (b) =>
        a.x + a.width + gap <= b.x ||
        a.x >= b.x + b.width + gap ||
        a.y + a.height + gap <= b.y ||
        a.y >= b.y + b.height + gap,
    );
  const origin = clamp(wanted.x, wanted.y);
  if (clear(origin)) return origin;
  const candidates: LabelRect[] = [];
  for (const r of occupied) {
    const left = r.x - wanted.width - gap,
      right = r.x + r.width + gap;
    const top = r.y - wanted.height - gap,
      bottom = r.y + r.height + gap;
    candidates.push(
      clamp(left, origin.y),
      clamp(right, origin.y),
      clamp(origin.x, top),
      clamp(origin.x, bottom),
    );
    for (const x of [left, right]) for (const y of [top, bottom]) candidates.push(clamp(x, y));
  }
  const distance = (r: LabelRect) => (r.x - origin.x) ** 2 + (r.y - origin.y) ** 2;
  candidates.sort((a, b) => distance(a) - distance(b));
  const nearest = candidates.find(clear);
  if (nearest) return nearest;
  // A narrow or nearly frontal view may need a free slot farther from the projected anchor.
  for (let radius = 12; radius < Math.max(bounds.width, bounds.height); radius += 12) {
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      const candidate = clamp(origin.x + dx! * radius, origin.y + dy! * radius);
      if (clear(candidate)) return candidate;
    }
  }
  return origin;
}
