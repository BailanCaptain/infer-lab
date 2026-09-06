/**
 * 张量显示说明（纯函数）：压缩比例、缩略采样、掩码、分类量。
 * 这些是超过 40 字量级的解释文案，按 DESIGN.md 进 DOM 面板，不进 3D 标签。
 */
import { planeView } from "../../sim/timeline/plane";
import type { TensorRecord } from "../../sim/timeline/types";
import { fmtAspect, planeSize, robustScale } from "../scale";
import { textureShape } from "./TensorPlane";

const ANY_BOX = { maxW: 8, maxH: 4 };

export function displayNotes(record: TensorRecord, sel: { head?: number | undefined } = {}): string[] {
  const view = planeView(record, sel);
  const size = planeSize(view.rows, view.cols, ANY_BOX);
  const tex = textureShape(view);
  const categorical = record.role === "input";
  const notes: string[] = [];
  if (size.compressed) notes.push(`显示比例已压缩，真实行列比 ${fmtAspect(size.trueAspect)}`);
  if (!tex.exact) notes.push(`全幅平面是 ${tex.cols}×${tex.rows} 采样，放大窗口里是真值`);
  if (categorical) notes.push("token id 是编号，不按大小着色");
  else {
    const cols = view.cols;
    const vs = view.thumb
      ? robustScale((i) => view.thumb?.data[i] ?? 0, view.thumb.data.length)
      : robustScale((i) => view.at(Math.floor(i / cols), i % cols), view.rows * view.cols);
    if (vs.hasMask) notes.push("含 −∞ 掩码格，灰色显示，不参与色阶");
  }
  return notes;
}
