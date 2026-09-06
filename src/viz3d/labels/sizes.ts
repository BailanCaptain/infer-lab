/**
 * 3D 标签字号（世界单位）与文本宽度估算：纯模块，布局与相机都能用，不引 drei。
 * 与 DESIGN.md 的字阶同源，3D 里只留三档。
 */
export const LABEL_SIZE = { title: 0.26, body: 0.19, micro: 0.15 } as const;

export type LabelSize = keyof typeof LABEL_SIZE;

/** 估算文本在世界单位里的宽度：CJK 全宽 1.0、空格 0.3、其余 0.58（Noto/JetBrains 的均值） */
export function textWidth(text: string, size: number): number {
  let w = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    w += c >= 0x2e80 ? 1.0 : c === 0x20 ? 0.3 : 0.58;
  }
  return w * size;
}
