import type { MasterParts, PartBlock } from "./matrix-parts";

/** Place the native matrix geometry; the global scene scale never changes its proportions. */
export function layerBlock(
  source: MasterParts,
  id: string,
  name: string,
  columns: number,
  channels: number,
  x: number,
  y: number,
): PartBlock {
  const native = source.layoutBlocks.get("collapsed_attn")!;
  const tensor = {
    ...native.t,
    id,
    name,
    rows: { ...native.t.rows, n: columns },
    cols: channels,
    shape: [columns, channels],
  };
  const shape = source.shapeOf(tensor, "col");
  const scale = 106 / (native.y1 - native.y0);
  // An eight-dimensional head is a magnified local view, using the RMS group's physical cell height.
  const local = channels <= 16;
  const h = (local ? ((native.y1 - native.y0) / native.div[1]) * channels : shape.h) * scale;
  const w = shape.w * scale;
  const d = local ? Math.min((native.z1 - native.z0) * scale, w, h) : shape.d * scale;
  return {
    ...native,
    id,
    t: tensor,
    x0: x - w / 2,
    x1: x + w / 2,
    y0: y - h / 2,
    y1: y + h / 2,
    z0: -d,
    z1: 0,
    div: local ? [columns, channels, 1] : shape.div,
    cut: shape.cut,
    alt: shape.alt,
  };
}

export function layerWeightBlock(
  source: MasterParts,
  id: string,
  inputs: number,
  outputs: number,
  x: number,
  top: number,
): PartBlock {
  const native = source.layoutBlocks.get("W_up")!;
  const tensor = {
    ...native.t,
    id,
    rows: { ...native.t.rows, n: inputs },
    cols: outputs,
    shape: [inputs, outputs],
    deck: null,
  };
  const shape = source.shapeOf(tensor, "wt");
  const input = source.layoutBlocks.get("collapsed_attn")!;
  const scale = 106 / (input.y1 - input.y0);
  const height = inputs <= 16 ? inputs * (106 / 16) : shape.h * scale;
  const width = shape.w * scale;
  return {
    ...native,
    id,
    t: tensor,
    orient: "wt",
    x0: x - width / 2,
    x1: x + width / 2,
    y0: top - height,
    y1: top,
    z0: -shape.d * scale,
    z1: 0,
    div: shape.div,
    cut: shape.cut,
    alt: shape.alt,
  };
}
