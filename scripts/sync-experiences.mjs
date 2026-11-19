// Copy the accepted standalone viewers without modifying their source workspace.
// Usage: node scripts/sync-experiences.mjs <hardware-study-directory>
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { adaptExperience } from "./experience-performance.mjs";
import { releaseModelFile } from "./model-release.mjs";

const source = process.argv[2];
if (!source) throw new Error("Pass the hardware-study directory.");
const destination = fileURLToPath(new URL("../public/experiences/", import.meta.url));
const packages = fileURLToPath(new URL("../node_modules/", import.meta.url));
const entries = [];
// Remove only obsolete trial/debug files previously copied by this script.
// Never delete the source workspace or unrelated files in the destination.
const priorManifest = join(destination, "manifest.json");
const prior = existsSync(priorManifest) ? JSON.parse(readFileSync(priorManifest, "utf8")).files : [];
for (const path of [
  "index.html",
  "viewer.js",
  "assets/manifest.json",
  "assets/atlas-a2-study.glb",
  "glm-flow/master/flow-tune.js",
]) {
  const target = join(destination, path);
  if (!existsSync(target)) continue;
  const previous = prior.find((entry) => entry.path === path);
  if (!previous || hash(readFileSync(target)) !== previous.sha256)
    throw new Error(`Modified obsolete file: ${path}`);
  unlinkSync(target);
}
function copy(path, transform, originalPath = join(resolve(source), path)) {
  const original = readFileSync(originalPath);
  const output = transform
    ? Buffer.from(adaptExperience(path, transform(original.toString("utf8"))))
    : original;
  const target = join(destination, path);
  mkdirSync(dirname(target), { recursive: true });
  if (transform) writeFileSync(target, output);
  else copyFileSync(originalPath, target);
  entries.push({ path, bytes: output.length, sourceSha256: hash(original), sha256: hash(output) });
}
function hash(data) {
  return createHash("sha256").update(data).digest("hex");
}
function tree(path) {
  for (const entry of readdirSync(join(source, path), { withFileTypes: true })) {
    const child = `${path}/${entry.name}`;
    if (entry.isDirectory()) tree(child);
    else copy(child);
  }
}
function replace(text, before, after) {
  if (!text.includes(before)) throw new Error(`Source changed: missing ${before.slice(0, 90)}`);
  return text.replace(before, after);
}

function typography(text, stylesheet) {
  text = text
    .replaceAll(/['"]Microsoft YaHei['"],sans-serif/g, "var(--journey-font-sans)")
    .replaceAll("ui-monospace,Consolas,monospace", "var(--journey-font-mono)")
    .replaceAll("SimSun,serif", "var(--journey-font-title)");
  return replace(text, "</head>", `<link rel="stylesheet" href="${stylesheet}"></head>`);
}

// Match the shell's installed fonts. Reuse the identical Noto Sans SC 400/700
// already in vendor; only copy these additional font families and used weights.
for (const [name, packageName, stylesheets] of [
  ["inter", "@fontsource-variable/inter", ["index.css"]],
  ["jetbrains-mono", "@fontsource/jetbrains-mono", ["400.css", "500.css", "700.css"]],
]) {
  const packagePath = join(packages, packageName);
  copy(`fonts/${name}/LICENSE`, undefined, join(packagePath, "LICENSE"));
  for (const stylesheet of stylesheets) {
    const originalPath = join(packagePath, stylesheet);
    const css = readFileSync(originalPath, "utf8");
    copy(
      `fonts/${name}/${stylesheet}`,
      (text) => text.replaceAll(/, url\([^)]*\.woff\) format\('woff'\)/g, ""),
      originalPath,
    );
    for (const [, path] of css.matchAll(/url\(\.\/([^)]*\.woff2)\)/g)) {
      copy(`fonts/${name}/${path}`, undefined, join(packagePath, path));
    }
  }
}

// Use the viewer's own Three.js version and fonts, including their license files.
tree("vendor");
const IN_REPO_MODEL_MASTER = new Set([
  "arch-draw.js",
  "arch.html",
  "chapter.html",
  "flow-colors.js",
  "flow-look.js",
  "flow.html",
  "lesson-data.js",
  "model-layout.js",
  "model.html",
  "play.js",
  "segments-rest.js",
  "truth-spec.js",
  "truth-view.js",
]);
for (const name of readdirSync(join(source, "glm-flow/master"))) {
  if (!/\.(js|html)$/.test(name) || /^(qa-|shot)/.test(name) || name === "flow-tune.js") continue;
  if (IN_REPO_MODEL_MASTER.has(name)) {
    // Preserve redesigned in-repo 2D/3D model master files while keeping their source baseline hashes.
    const original = readFileSync(join(resolve(source), `glm-flow/master/${name}`));
    const current = readFileSync(join(destination, `glm-flow/master/${name}`));
    entries.push({
      path: `glm-flow/master/${name}`,
      bytes: current.length,
      sourceSha256: hash(original),
      sha256: hash(current),
    });
    continue;
  }
  if (name.endsWith(".html")) {
    copy(`glm-flow/master/${name}`, (text) => {
      if (name === "chapter.html") {
        text = replace(
          text,
          "<title>02 模型结构</title>",
          '<meta name="viewport" content="width=device-width,initial-scale=1"><title>GLM 模型计算演示</title>',
        );
        // The independent demonstration supports several of the site's 22 chapters.
        text = replace(text, `第 \${+CHAPTER.n} 章 · \${CHAPTER.title}`, "GLM-5.3-Flash · 计算演示");
      }
      return typography(releaseModelFile(name, text), "../../typography.css");
    });
  } else if (name === "truth-view.js") copy(`glm-flow/master/${name}`, (text) => text);
  else if (name === "flow-colors.js" || name === "flow-look.js")
    copy(`glm-flow/master/${name}`, (text) => releaseModelFile(name, text));
  else copy(`glm-flow/master/${name}`);
}
copy("glm-flow/reference/official-config.json");
// These are the complete network dependencies of loadDemo. Other layers' full arrays
// are offline QA data; the continuous bridge uses boundary samples from chain.json.
for (const name of [
  "weights.json",
  "l00.json",
  "l00.bin",
  "l03.json",
  "l03.bin",
  "l04.json",
  "l04.bin",
  "ends.json",
  "ends.bin",
  "chain.json",
]) {
  copy(`glm-flow/master/demo/continuous/${name}`);
}
for (const path of [
  "diagram-kit.css",
  "diagram-kit.js",
  "whole/explain.js",
  "whole/readable-diagrams.css",
  "whole/README.md",
  "whole/assets/dgx-h100.glb",
  "whole/assets/atlas-800t-a2.glb",
  "whole/assets/cabinet-42u.glb",
])
  copy(path);

copy("whole/index.html", (text) => {
  text = replace(text, '<a href="./rack-hardware.blend" download>Blender 源文件</a>', "");
  text = replace(
    text,
    "</head>",
    '<link rel="stylesheet" href="../hardware-site.css"><script>if(new URLSearchParams(location.search).get("site")==="1")document.documentElement.dataset.site="true";</script></head>',
  );
  return typography(text, "../typography.css");
});
copy("whole/viewer.js", (text) => {
  text = replace(
    text,
    "./reference/atlas800t.pdf#page=13",
    "https://e.huawei.com/cn/documents/products/computing/b0b253c4d5da4e05ba80a39e3dc65fd2",
  );
  text = replace(
    text,
    "let platform='nvidia',level=0,",
    "const entry=new URLSearchParams(location.search),SITE=entry.get('site')==='1';\nlet platform=entry.get('vendor')==='ascend'?'ascend':'nvidia',level=Math.max(0,Math.min(3,Number(entry.get('level'))||0)),",
  );
  text = replace(text, "target.x+=extent*.28;", "if(!SITE)target.x+=extent*.28;");
  text = replace(text, "else if(innerWidth>900)", "else if(!SITE&&innerWidth>900)");
  text = replace(
    text,
    "e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1",
    "(e.clientX-renderer.domElement.getBoundingClientRect().left)/renderer.domElement.clientWidth*2-1,-(e.clientY-renderer.domElement.getBoundingClientRect().top)/renderer.domElement.clientHeight*2+1",
  );
  return replace(
    text,
    "renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;",
    "const box=SITE?$('#stage').getBoundingClientRect():{width:innerWidth,height:innerHeight};renderer.setSize(box.width,box.height);camera.aspect=box.width/box.height;",
  );
});
entries.sort((a, b) => a.path.localeCompare(b.path));
writeFileSync(
  join(destination, "manifest.json"),
  `${JSON.stringify(
    {
      description:
        "Accepted GLM and hardware runtime snapshot; adapted entry, layout, typography and release-only model UI, with locally installed self-hosted fonts.",
      files: entries,
    },
    null,
    2,
  )}\n`,
);
console.log(
  `Copied ${entries.length} runtime files, ${(entries.reduce((sum, entry) => sum + entry.bytes, 0) / 1048576).toFixed(2)} MiB. Source files unchanged.`,
);
