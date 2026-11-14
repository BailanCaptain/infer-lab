import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { expect, it } from "vitest";

it("站内演示保留母版计算与几何，适配入口、布局、字体并移除临时调试", () => {
  const root = "public/experiences";
  const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as {
    files: { path: string; bytes: number; sourceSha256: string; sha256: string }[];
  };
  expect(manifest.files.length).toBeGreaterThan(200);
  const changed: string[] = [];
  for (const entry of manifest.files) {
    const bytes = readFileSync(join(root, entry.path));
    expect(bytes.length, entry.path).toBe(entry.bytes);
    expect(createHash("sha256").update(bytes).digest("hex"), entry.path).toBe(entry.sha256);
    if (entry.sha256 !== entry.sourceSha256) changed.push(entry.path);
  }
  expect(changed.sort()).toEqual([
    "fonts/jetbrains-mono/400.css",
    "fonts/jetbrains-mono/500.css",
    "fonts/jetbrains-mono/700.css",
    "glm-flow/master/arch.html",
    "glm-flow/master/chapter.html",
    "glm-flow/master/flow-colors.js",
    "glm-flow/master/flow-look.js",
    "glm-flow/master/flow.html",
    "glm-flow/master/model.html",
    "glm-flow/master/truth-view.js",
    "whole/index.html",
    "whole/viewer.js",
  ]);
  expect(existsSync(join(root, "index.html"))).toBe(false);
  expect(existsSync(join(root, "assets/atlas-a2-study.glb"))).toBe(false);
  expect(existsSync(join(root, "hardware-site.css"))).toBe(true);
  expect(existsSync(join(root, "glm-flow/master/flow-tune.js"))).toBe(false);
  for (const file of ["l00.bin", "l03.bin", "l04.bin", "ends.bin", "chain.json"]) {
    expect(manifest.files.some((entry) => entry.path === `glm-flow/master/demo/continuous/${file}`)).toBe(
      true,
    );
  }
});

it("演示复用的中文字体与主站安装版本一致", () => {
  const viewer = "public/experiences/vendor/fonts";
  const shell = "node_modules/@fontsource/noto-sans-sc";
  for (const weight of [400, 700]) {
    const css = readFileSync(join(viewer, `${weight}.css`), "utf8");
    expect(css).toBe(readFileSync(join(shell, `${weight}.css`), "utf8"));
    for (const [, path] of css.matchAll(/url\(\.\/([^)]*\.woff2)\)/g)) {
      const hash = (root: string) =>
        createHash("sha256")
          .update(readFileSync(join(root, path)))
          .digest("hex");
      expect(hash(viewer), path).toBe(hash(shell));
    }
  }
});

it("每个演示文档独立加载共享字体，字体样式及 WOFF2 资产可离线解析", () => {
  const root = "public/experiences";
  for (const path of [
    "whole/index.html",
    "glm-flow/master/chapter.html",
    "glm-flow/master/model.html",
    "glm-flow/master/flow.html",
    "glm-flow/master/arch.html",
  ]) {
    const html = readFileSync(join(root, path), "utf8");
    expect(html, path).toMatch(/<link rel="stylesheet" href="(?:\.\.\/)+typography\.css">/);
    expect(html, path).not.toMatch(/["']Microsoft YaHei["'],sans-serif/);
  }
  const visited = new Set<string>();
  function checkStylesheet(path: string) {
    if (visited.has(path)) return;
    visited.add(path);
    const css = readFileSync(path, "utf8");
    for (const [, relative] of css.matchAll(/@import\s+["']([^"']+)["']/g)) {
      checkStylesheet(resolve(dirname(path), relative));
    }
    for (const [, relative] of css.matchAll(/url\(["']?([^)'"\s]+\.woff2)["']?\)/g)) {
      expect(existsSync(resolve(dirname(path), relative)), relative).toBe(true);
    }
  }
  checkStylesheet(resolve(root, "typography.css"));
  for (const family of ["inter", "jetbrains-mono"]) {
    expect(existsSync(join(root, "fonts", family, "LICENSE")), family).toBe(true);
  }
});
