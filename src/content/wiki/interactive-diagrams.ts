import type { ComponentType } from "react";
import {
  type InteractiveDiagramProps,
  QuantizationIntuitionInteractive,
} from "./QuantizationIntuitionInteractive";

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
]);

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

/**
 * 纯 TypeScript 同步 FIPS 180-4 UTF-8 SHA-256，供浏览器渲染期同步核对人工注册图与审定 SVG 版本指纹。
 */
export function sha256Hex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const buf = new Uint8Array(paddedLen);
  buf.set(bytes);
  buf[bytes.length] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + K[i]! + w[i]!) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7].map((v) => v.toString(16).padStart(8, "0")).join("");
}

export interface InteractiveDiagramRegistration {
  readonly id: string;
  /** 绑定人工审定时对应静态 SVG（LF 归一后）的精确 SHA-256；候选预览或正式图变更时自动退回真实静态 SVG */
  readonly approvedSvgSha256: string;
  readonly Component: ComponentType<InteractiveDiagramProps>;
}

const VALID_DIAGRAM_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const QUANTIZATION_INTUITION_APPROVED_SHA256 =
  "1def4a3114ad4757dd3e8e6486778cd5e214f21c0829914ee9fba48f91ddc953";

/**
 * 人工代码审查的编译期静态白名单注册表：
 * 仅允许显式静态 import 的组件，绝不接受外部模块路径、动态 import 或任意组件字符串。
 */
const INTERACTIVE_2D_REGISTRY: ReadonlyMap<string, InteractiveDiagramRegistration> = new Map([
  [
    "quantization-intuition",
    {
      id: "quantization-intuition",
      approvedSvgSha256: QUANTIZATION_INTUITION_APPROVED_SHA256,
      Component: QuantizationIntuitionInteractive,
    },
  ],
]);

export function registeredInteractiveDiagramIds(): readonly string[] {
  return [...INTERACTIVE_2D_REGISTRY.keys()];
}

export function resolveInteractiveDiagram(options: {
  id: string;
  svg: string | undefined;
  /** 默认关闭；ReviewPane 等未发布预览必须保持关闭，始终渲染候选自身清洗后的静态 SVG */
  allowInteractive?: boolean | undefined;
}): InteractiveDiagramRegistration | null {
  if (options.allowInteractive !== true || typeof options.svg !== "string" || !options.svg) {
    return null;
  }
  if (!VALID_DIAGRAM_ID_RE.test(options.id)) return null;
  const entry = INTERACTIVE_2D_REGISTRY.get(options.id);
  if (!entry) return null;
  const normalizedSvg = options.svg.replace(/\r\n/g, "\n");
  if (sha256Hex(normalizedSvg) !== entry.approvedSvgSha256) return null;
  return entry;
}
