declare module "subset-font" {
  export default function subsetFont(
    buffer: Buffer,
    text: string,
    options?: {
      targetFormat?: "sfnt" | "woff" | "woff2";
      preserveNameIds?: number[];
      /** 可变字体实例化：固定轴值 */
      variationAxes?: Record<string, number | { min: number; max: number; default?: number }>;
    },
  ): Promise<Buffer>;
}
