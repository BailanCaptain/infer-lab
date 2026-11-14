import type { PartArrow, PartBlock } from "../course/matrix-parts";

export function tokenFocus(block: PartBlock): [number[], number[]] {
  const [x, y, z] = block.div;
  return block.orient === "row"
    ? [
        [0, 5, 0],
        [x, 6, z],
      ]
    : [
        [5, 0, 0],
        [6, y, z],
      ];
}

/** Keep the master's dimensions; close the gaps left by omitted operations in a focused view. */
export function compactComputation(
  blocks: PartBlock[],
  step: number,
): { blocks: PartBlock[]; arrows: PartArrow[] } | null {
  const positions: Record<string, [number, number]> =
    step === 1
      ? {
          x_attn: [0, 115],
          W_q: [-120, 48],
          Q: [-80, 48],
          W_k: [-35, 48],
          K: [5, 48],
          W_v: [50, 48],
          V: [90, 48],
        }
      : step === 3
        ? {
            residual_mid: [-90, 65],
            coef_ffn: [-90, -5],
            ffn_out: [0, 65],
            residual_out: [90, 65],
          }
        : {};
  if (!Object.keys(positions).length) return null;
  const moved = blocks.map((b) => {
    const [x, top] = positions[b.id]!;
    return { ...b, x0: x, x1: x + b.x1 - b.x0, y0: top - (b.y1 - b.y0), y1: top };
  });
  const byId = Object.fromEntries(moved.map((b) => [b.id, b]));
  const midX = (b: PartBlock) => (b.x0 + b.x1) / 2;
  const midY = (b: PartBlock) => (b.y0 + b.y1) / 2;
  const arrows: PartArrow[] = [];
  if (step === 1) {
    for (const [weight, result] of [
      ["W_q", "Q"],
      ["W_k", "K"],
      ["W_v", "V"],
    ] as const) {
      const w = byId[weight]!,
        r = byId[result]!,
        x = byId.x_attn!;
      arrows.push({
        from: weight,
        to: result,
        pts: [
          [w.x1 + 1, midY(r)],
          [r.x0 - 1, midY(r)],
        ],
      });
      arrows.push({
        from: "x_attn",
        to: result,
        pts: [
          [midX(x), x.y0 - 1],
          [midX(x), 72],
          [midX(r), 72],
          [midX(r), r.y1 + 1],
        ],
      });
    }
  } else {
    const old = byId.residual_mid!,
      out = byId.residual_out!,
      ffn = byId.ffn_out!,
      coef = byId.coef_ffn!;
    arrows.push({
      from: old.id,
      to: out.id,
      pts: [
        [midX(old), old.y1 + 1],
        [midX(old), 95],
        [midX(out), 95],
        [midX(out), out.y1 + 1],
      ],
    });
    arrows.push({
      from: ffn.id,
      to: out.id,
      pts: [
        [ffn.x1 + 1, midY(ffn)],
        [out.x0 - 1, midY(out)],
      ],
    });
    arrows.push({
      from: coef.id,
      to: out.id,
      pts: [
        [coef.x1 + 1, midY(coef)],
        [midX(out), midY(coef)],
        [midX(out), out.y0 - 1],
      ],
    });
  }
  return { blocks: moved, arrows };
}
