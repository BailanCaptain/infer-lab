/**
 * 依赖方向检查：design ← sim ← timeline ← viz3d/viz2d ← content ← app
 * 违反即非零退出。
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(process.cwd(), "src");
const ORDER = ["design", "sim", "timeline", "viz3d", "viz2d", "content", "app"] as const;
type Layer = (typeof ORDER)[number];
const rank = (l: Layer) => ORDER.indexOf(l);
const SIBLINGS: Record<string, string[]> = { viz3d: ["viz2d"], viz2d: ["viz3d"] };
const FORBIDDEN_PKGS: Record<string, string[]> = {
  sim: ["three", "react", "react-dom", "zustand", "@react-three/fiber", "@react-three/drei"],
  timeline: ["three", "@react-three/fiber", "@react-three/drei"],
  design: ["three", "react", "zustand"],
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mdx)$/.test(name)) out.push(p);
  }
  return out;
}

const importRe =
  /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s+['"]([^'"]+)['"]/gm;

function layerOf(spec: string, file: string): string | undefined {
  if (spec.startsWith("@/")) return spec.slice(2).split("/")[0];
  if (spec.startsWith(".")) {
    const abs = join(file, "..", spec);
    return relative(ROOT, abs).replace(/\\/g, "/").split("/")[0];
  }
  return undefined;
}

let errors = 0;
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  const layer = rel.split("/")[0] as Layer;
  if (!ORDER.includes(layer)) continue;
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(importRe)) {
    const spec = m[1] ?? m[2] ?? m[3];
    if (!spec) continue;
    for (const pkg of FORBIDDEN_PKGS[layer] ?? []) {
      if (spec === pkg || spec.startsWith(`${pkg}/`)) {
        console.error(`x ${rel}: ${layer} 层禁止依赖 ${pkg}`);
        errors++;
      }
    }
    const target = layerOf(spec, file);
    if (target && ORDER.includes(target as Layer) && target !== layer) {
      const t = target as Layer;
      const allowedSibling = SIBLINGS[layer]?.includes(t);
      if (rank(t) > rank(layer) && !allowedSibling) {
        console.error(`x ${rel}: ${layer} 层不能依赖上层 ${t}（${spec}）`);
        errors++;
      }
    }
  }
}
if (errors) {
  console.error(`\n依赖方向检查失败：${errors} 处`);
  process.exit(1);
}
console.log("ok 依赖方向检查通过");
