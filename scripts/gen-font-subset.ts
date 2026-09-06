/**
 * 生成 3D 场景内 SDF 文字用的 Noto Sans SC 子集字体。
 * 字符集 = 基础集（ASCII、常用符号、希腊字母、上下标）+ 术语表 + 章节 MDX + 硬件/张量标签中出现的所有 CJK 字符。
 * 输入：tools/fonts/NotoSansSC-Regular.ttf（OFL，脚本可自动下载）
 * 输出：public/fonts/notosc-3d.woff
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import subsetFont from "subset-font";

const SRC_TTF = join(process.cwd(), "tools/fonts/NotoSansSC-Regular.ttf");
const OUT = join(process.cwd(), "public/fonts/notosc-3d.woff");
const FONT_URL = "https://github.com/google/fonts/raw/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf";

const BASE =
  " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~" +
  "×·→←↑↓↔⋯…∑∏√∞≈≠≤≥±∈∉⊗⊕∘′″°" +
  "αβγδεζηθικλμνξπρστυφχψωΓΔΘΛΞΠΣΦΨΩ" +
  "₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹ᵀᵢⱼₖₙₘ" +
  "，。、；：？！（）【】《》「」『』〈〉—～·" +
  "①②③④⑤⑥⑦⑧⑨⑩⟳";

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mdx|md)$/.test(name)) out.push(p);
  }
  return out;
}

/** 去掉块注释与行注释；`//` 前面紧跟 `:` 的是 URL，不算注释 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

async function main() {
  if (!existsSync(SRC_TTF)) {
    console.log("下载 Noto Sans SC ...");
    const res = await fetch(FONT_URL);
    if (!res.ok) throw new Error(`下载失败 ${res.status}`);
    mkdirSync(join(process.cwd(), "tools/fonts"), { recursive: true });
    writeFileSync(SRC_TTF, Buffer.from(await res.arrayBuffer()));
  }
  const chars = new Set<string>(BASE);
  // 扫描内容与标签源码中的 CJK 字符。ts/tsx 先剥掉注释（注释里的中文不会出现在 3D 标签里），md/mdx 全文扫。
  const scanDirs = ["src/content", "src/sim", "src/viz3d", "src/timeline"].map((d) => join(process.cwd(), d));
  for (const file of scanDirs.flatMap((d) => walk(d))) {
    const raw = readFileSync(file, "utf8");
    const text = /\.(ts|tsx)$/.test(file) ? stripComments(raw) : raw;
    for (const ch of text) {
      const code = ch.codePointAt(0) ?? 0;
      if (code >= 0x3000) chars.add(ch);
    }
  }
  const text = [...chars].join("");
  const src = readFileSync(SRC_TTF);
  const woff = await subsetFont(src, text, { targetFormat: "woff" });
  mkdirSync(join(process.cwd(), "public/fonts"), { recursive: true });
  writeFileSync(OUT, woff);
  console.log(`ok 字体子集：${chars.size} 字符 → ${OUT} (${(woff.length / 1024).toFixed(1)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
