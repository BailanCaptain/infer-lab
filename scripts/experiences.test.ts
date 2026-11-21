import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
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
    "glm-flow/master/arch-draw.js",
    "glm-flow/master/arch.html",
    "glm-flow/master/chapter.html",
    "glm-flow/master/flow-colors.js",
    "glm-flow/master/flow-look.js",
    "glm-flow/master/flow.html",
    "glm-flow/master/lesson-data.js",
    "glm-flow/master/model-layout.js",
    "glm-flow/master/model.html",
    "glm-flow/master/play.js",
    "glm-flow/master/segments-rest.js",
    "glm-flow/master/truth-spec.js",
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

it("三维模型直接启用精修定稿，对齐 MTP 末列输入、MLA 低秩缓存说明与全段播放契约", async () => {
  const root = "public/experiences";
  expect(existsSync(join(root, "glm-flow/legacy"))).toBe(false);
  const readerTheme = readFileSync(join(root, "reader-theme.css"), "utf8");
  expect(readerTheme).toContain("p.sub");
  expect(readerTheme).not.toMatch(/:is\(\.sub\b/);
  const flowLook = readFileSync(join(root, "glm-flow/master/flow-look.js"), "utf8");
  expect(flowLook).toContain("addArrowBatch");
  expect(flowLook).toContain("setRecv");
  const playJs = readFileSync(join(root, "glm-flow/master/play.js"), "utf8");
  expect(playJs).toContain("op.token !== undefined");
  expect(playJs).toContain("B[bid + '/0']");
  expect(playJs).toContain("...beat.op.lesson.reads, ...beat.op.lesson.params");
  const cfg = JSON.parse(
    readFileSync(join(root, "glm-flow/reference/official-config.json"), "utf8"),
  ).text_config;
  const [{ modelSpec }, { layoutModel }, { layerSpec }] = await Promise.all([
    import(pathToFileURL(resolve(root, "glm-flow/master/model-spec.js")).href),
    import(pathToFileURL(resolve(root, "glm-flow/master/model-layout.js")).href),
    import(pathToFileURL(resolve(root, "glm-flow/master/truth-spec.js")).href),
  ]);
  const layout = layoutModel(modelSpec(cfg, 6));
  const em = layout.B.e_mtp;
  const colW = (em.x1 - em.x0) / 6;
  const arrow = layout.arrows.find(
    (a: { from: string; to: string }) => a.from === "next_id" && a.to === "e_mtp",
  )!;
  expect(arrow.pts.at(-1)[0]).toBeCloseTo(em.x1 - colW / 2, 5);
  const mlaSpec = layerSpec(cfg, 6, 3);
  const kvStep = mlaSpec.steps.find((s: { id: string }) => s.id === "proj_kv_b")!;
  expect(kvStep.merged).toContain("只缓存 512 维低秩 c_kv");
  expect(kvStep.merged).toContain("1/64");
  expect(kvStep.merged).not.toContain("省 64 倍显存");
});

it("全部九套硬件三维 GLB 资产登记在案，具备合法二进制头与分层语义节点", () => {
  const root = "public/experiences";
  const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as {
    files: { path: string; bytes: number; sha256: string }[];
  };
  const expected: [string, string, number][] = [
    ["whole/assets/cabinet-42u.glb", "rack", 1],
    ["whole/assets/atlas-800t-a2.glb", "npu", 8],
    ["whole/assets/atlas-800i-a3.glb", "npu", 8],
    ["whole/assets/atlas-800-3000.glb", "npu", 4],
    ["whole/assets/ascend-950dt.glb", "npu", 8],
    ["whole/assets/dgx-h100.glb", "gpu", 8],
    ["whole/assets/dgx-b200.glb", "gpu", 8],
    ["whole/assets/gb200-nvl72.glb", "gpu", 4],
    ["whole/assets/h100-nvl-pcie.glb", "gpu", 4],
  ];
  for (const [relPath, accelKind, accelCount] of expected) {
    expect(
      manifest.files.some((entry) => entry.path === relPath),
      relPath,
    ).toBe(true);
    const buf = readFileSync(join(root, relPath));
    expect(buf.readUInt32LE(0), relPath).toBe(0x46546c67);
    expect(buf.readUInt32LE(4), relPath).toBe(2);
    expect(buf.readUInt32LE(8), relPath).toBe(buf.length);
    const jsonLen = buf.readUInt32LE(12);
    expect(buf.readUInt32LE(16), relPath).toBe(0x4e4f534a);
    const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8")) as {
      nodes: { extras?: { kind?: string } }[];
    };
    const matching = gltf.nodes.filter((n) => n.extras?.kind === accelKind);
    expect(matching.length, `${relPath} ${accelKind}`).toBe(accelCount);
    if (accelKind !== "rack") {
      expect(gltf.nodes.filter((n) => n.extras?.kind === "ihs").length, `${relPath} ihs`).toBe(accelCount);
    }
    const totalPrimitives =
      (gltf as { meshes?: { primitives: unknown[] }[] }).meshes?.reduce(
        (sum, m) => sum + m.primitives.length,
        0,
      ) ?? 0;
    expect(totalPrimitives, `${relPath} batched draw-call primitives <= 250`).toBeLessThanOrEqual(250);
  }
});

it("所有整机风扇墙笼架采用镂空蜂巢框架，不以实心平板遮挡或共面闪烁扇叶孔径", () => {
  const root = "public/experiences";
  const serverGlbs: [string, [number, number][]][] = [
    [
      "whole/assets/atlas-800t-a2.glb",
      [
        [-1.32, 0.34],
        [0.44, 0.94],
      ],
    ],
    [
      "whole/assets/atlas-800i-a3.glb",
      [
        [-1.48, 2.85],
        [0, 2.85],
        [0, 1.05],
      ],
    ],
    [
      "whole/assets/atlas-800-3000.glb",
      [
        [-1.42, 0.33],
        [0.47, 0.33],
      ],
    ],
    [
      "whole/assets/ascend-950dt.glb",
      [
        [-1.32, 0.34],
        [0.44, 0.94],
      ],
    ],
    [
      "whole/assets/dgx-h100.glb",
      [
        [-1.34, 0.38],
        [0.45, 1.9],
      ],
    ],
    [
      "whole/assets/dgx-b200.glb",
      [
        [-1.48, 0.98],
        [0, 2.82],
      ],
    ],
    [
      "whole/assets/gb200-nvl72.glb",
      [
        [-1.05, 0.18],
        [0.35, 0.18],
      ],
    ],
    [
      "whole/assets/h100-nvl-pcie.glb",
      [
        [-1.32, 0.34],
        [0.44, 0.94],
      ],
    ],
  ];

  for (const [relPath, fanCenters] of serverGlbs) {
    const buf = readFileSync(join(root, relPath));
    const jsonLen = buf.readUInt32LE(12);
    const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8")) as {
      nodes: { name?: string; mesh?: number; children?: number[]; extras?: { kind?: string } }[];
      meshes: { primitives: { attributes: { POSITION: number }; indices: number; material: number }[] }[];
      materials: { name: string }[];
      accessors: { bufferView: number; componentType: number; count: number }[];
      bufferViews: { byteOffset: number; byteLength: number }[];
    };
    const binStart = 20 + jsonLen + 8;
    const fansNode = gltf.nodes.find((n) => n.extras?.kind === "fans");
    expect(fansNode, `${relPath} fans node`).toBeDefined();

    // Inspect Silver / warm satin cage frame mesh inside fans node
    for (const childIdx of fansNode!.children ?? []) {
      const child = gltf.nodes[childIdx]!;
      if (child.mesh === undefined) continue;
      for (const prim of gltf.meshes[child.mesh]!.primitives) {
        if (gltf.materials[prim.material]?.name !== "Silver / warm satin") continue;
        const posAcc = gltf.accessors[prim.attributes.POSITION]!;
        const posBv = gltf.bufferViews[posAcc.bufferView]!;
        const idxAcc = gltf.accessors[prim.indices]!;
        const idxBv = gltf.bufferViews[idxAcc.bufferView]!;
        const posStart = binStart + posBv.byteOffset;
        const idxStart = binStart + idxBv.byteOffset;
        const isU16 = idxAcc.componentType === 5123;

        const readIdx = (k: number) =>
          isU16 ? buf.readUInt16LE(idxStart + k * 2) : buf.readUInt32LE(idxStart + k * 4);
        const readXY = (v: number): [number, number, number] => [
          buf.readFloatLE(posStart + v * 12),
          buf.readFloatLE(posStart + v * 12 + 4),
          buf.readFloatLE(posStart + v * 12 + 8),
        ];

        // Check if any large silver slab spans > 0.25 width across a fan bore center (fx, fy)
        for (const [fx, fy] of fanCenters) {
          let slabHits = 0;
          for (let t = 0; t < idxAcc.count; t += 3) {
            const [ax, ay] = readXY(readIdx(t));
            const [bx, by] = readXY(readIdx(t + 1));
            const [cx, cy] = readXY(readIdx(t + 2));
            const spanX = Math.max(ax, bx, cx) - Math.min(ax, bx, cx);
            const spanY = Math.max(ay, by, cy) - Math.min(ay, by, cy);
            // Ignore thin 0.012mm finger-guard wires; detect solid wall slabs covering the bore!
            if (spanX < 0.05 || spanY < 0.05) continue;
            const d1 = (fx - bx) * (ay - by) - (ax - bx) * (fy - by);
            const d2 = (fx - cx) * (by - cy) - (bx - cx) * (fy - cy);
            const d3 = (fx - ax) * (cy - ay) - (cx - ax) * (fy - ay);
            const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
            const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
            if (!(hasNeg && hasPos)) slabHits++;
          }
          expect(slabHits, `${relPath} fan bore (${fx}, ${fy}) occluded by solid silver slab`).toBe(0);
        }
      }
    }
  }
});

it("九套硬件 GLB 在闭合与展开态（65% / 100%）无子部件穿模、机箱壁卡死或异材质共面闪烁", () => {
  const root = "public/experiences/whole/assets";
  const files = [
    "cabinet-42u.glb",
    "atlas-800t-a2.glb",
    "atlas-800i-a3.glb",
    "atlas-800-3000.glb",
    "ascend-950dt.glb",
    "dgx-h100.glb",
    "dgx-b200.glb",
    "gb200-nvl72.glb",
    "h100-nvl-pcie.glb",
  ];

  type GltfDoc = {
    scenes: { nodes: number[] }[];
    nodes: {
      name?: string;
      mesh?: number;
      translation?: [number, number, number];
      children?: number[];
      extras?: { kind?: string; explodeZ?: number; explodeY?: number };
    }[];
    meshes: {
      primitives: { attributes: { POSITION: number; NORMAL: number }; indices: number; material: number }[];
    }[];
    materials: { name: string }[];
    accessors: { bufferView: number; componentType: number; count: number }[];
    bufferViews: { byteOffset: number; byteLength: number }[];
  };

  type MeshWorldItem = {
    nodePath: string;
    mat: string;
    pos: Float32Array;
    nrm: Float32Array;
    idx: Uint32Array;
  };

  function loadWorldItems(
    buf: Buffer,
    gltf: GltfDoc,
    mode: "closed" | "exploded",
    spread = 1,
  ): MeshWorldItem[] {
    const jsonLen = buf.readUInt32LE(12);
    const binStart = 20 + jsonLen + 8;
    const items: MeshWorldItem[] = [];

    function visit(nodeIdx: number, ox: number, oy: number, oz: number, prefix: string) {
      const n = gltf.nodes[nodeIdx]!;
      const ex = n.extras ?? {};
      if (mode === "exploded" && ex.kind === "lid") return;
      const tx = ox + (n.translation?.[0] ?? 0);
      let ty = oy + (n.translation?.[1] ?? 0);
      let tz = oz + (n.translation?.[2] ?? 0);
      if (mode === "exploded" && ex.kind) {
        ty += (ex.explodeZ ?? 0) * spread;
        tz -= (ex.explodeY ?? 0) * spread;
      }
      const curPath =
        n.mesh !== undefined ? prefix : prefix ? `${prefix}/${n.name ?? nodeIdx}` : `${n.name ?? nodeIdx}`;
      if (n.mesh !== undefined) {
        for (const prim of gltf.meshes[n.mesh]!.primitives) {
          const pAcc = gltf.accessors[prim.attributes.POSITION]!;
          const nAcc = gltf.accessors[prim.attributes.NORMAL]!;
          const iAcc = gltf.accessors[prim.indices]!;
          const pOff = binStart + gltf.bufferViews[pAcc.bufferView]!.byteOffset;
          const nOff = binStart + gltf.bufferViews[nAcc.bufferView]!.byteOffset;
          const iOff = binStart + gltf.bufferViews[iAcc.bufferView]!.byteOffset;
          const pos = new Float32Array(pAcc.count * 3);
          const nrm = new Float32Array(nAcc.count * 3);
          for (let v = 0; v < pAcc.count; v++) {
            pos[v * 3] = buf.readFloatLE(pOff + v * 12) + tx;
            pos[v * 3 + 1] = buf.readFloatLE(pOff + v * 12 + 4) + ty;
            pos[v * 3 + 2] = buf.readFloatLE(pOff + v * 12 + 8) + tz;
            nrm[v * 3] = buf.readFloatLE(nOff + v * 12);
            nrm[v * 3 + 1] = buf.readFloatLE(nOff + v * 12 + 4);
            nrm[v * 3 + 2] = buf.readFloatLE(nOff + v * 12 + 8);
          }
          const idx = new Uint32Array(iAcc.count);
          const isU16 = iAcc.componentType === 5123;
          for (let k = 0; k < iAcc.count; k++) {
            idx[k] = isU16 ? buf.readUInt16LE(iOff + k * 2) : buf.readUInt32LE(iOff + k * 4);
          }
          items.push({
            nodePath: curPath,
            mat: gltf.materials[prim.material]?.name ?? String(prim.material),
            pos,
            nrm,
            idx,
          });
        }
      }
      for (const ch of n.children ?? []) visit(ch, tx, ty, tz, curPath);
    }

    for (const r of gltf.scenes[0]!.nodes) visit(r, 0, 0, 0, "");
    return items;
  }

  function findCoplanarZFighting(items: MeshWorldItem[], eps = 0.0045): string[] {
    const dirs: [string, number, number, number, number, number, number][] = [
      ["+X", 1, 0, 0, 0, 1, 2],
      ["-X", -1, 0, 0, 0, 1, 2],
      ["+Y", 0, 1, 0, 1, 0, 2],
      ["-Y", 0, -1, 0, 1, 0, 2],
      ["+Z", 0, 0, 1, 2, 0, 1],
      ["-Z", 0, 0, -1, 2, 0, 1],
    ];
    const hits = new Set<string>();
    for (const [dName, dx, dy, dz, ax, uAx, vAx] of dirs) {
      const tris: { c: number; u0: number; u1: number; v0: number; v1: number; mat: string; node: string }[] =
        [];
      for (const it of items) {
        const { pos, nrm, idx, mat, nodePath } = it;
        for (let t = 0; t < idx.length; t += 3) {
          const i0 = idx[t]! * 3;
          const i1 = idx[t + 1]! * 3;
          const i2 = idx[t + 2]! * 3;
          const nx = (nrm[i0]! + nrm[i1]! + nrm[i2]!) / 3;
          const ny = (nrm[i0 + 1]! + nrm[i1 + 1]! + nrm[i2 + 1]!) / 3;
          const nz = (nrm[i0 + 2]! + nrm[i1 + 2]! + nrm[i2 + 2]!) / 3;
          if (nx * dx + ny * dy + nz * dz <= 0.985) continue;
          const u0 = Math.min(pos[i0 + uAx]!, pos[i1 + uAx]!, pos[i2 + uAx]!);
          const u1 = Math.max(pos[i0 + uAx]!, pos[i1 + uAx]!, pos[i2 + uAx]!);
          const v0 = Math.min(pos[i0 + vAx]!, pos[i1 + vAx]!, pos[i2 + vAx]!);
          const v1 = Math.max(pos[i0 + vAx]!, pos[i1 + vAx]!, pos[i2 + vAx]!);
          if (u1 - u0 <= 0.004 || v1 - v0 <= 0.004) continue;
          const c = (pos[i0 + ax]! + pos[i1 + ax]! + pos[i2 + ax]!) / 3;
          tris.push({ c, u0, u1, v0, v1, mat, node: nodePath });
        }
      }
      tris.sort((a, b) => a.c - b.c);
      for (let i = 0; i < tris.length; i++) {
        const ti = tris[i]!;
        for (let j = i + 1; j < tris.length && tris[j]!.c - ti.c <= eps; j++) {
          const tj = tris[j]!;
          if (ti.mat === tj.mat && ti.node === tj.node) continue;
          const ovU = Math.min(ti.u1, tj.u1) - Math.max(ti.u0, tj.u0);
          const ovV = Math.min(ti.v1, tj.v1) - Math.max(ti.v0, tj.v0);
          if (ovU > 0.004 && ovV > 0.004) {
            const pair = [
              `${ti.node.replace(/\d+/g, "#")}[${ti.mat}]`,
              `${tj.node.replace(/\d+/g, "#")}[${tj.mat}]`,
            ].sort();
            hits.add(`${dName} dc=${Math.abs(tj.c - ti.c).toFixed(4)}: ${pair[0]} <-> ${pair[1]}`);
          }
        }
      }
    }
    return [...hits].sort();
  }

  function findExplodedCollisions(items: MeshWorldItem[]): string[] {
    const boxes = new Map<string, [number, number, number, number, number, number]>();
    for (const it of items) {
      const parts = it.nodePath.split("/");
      const key = parts.length >= 2 ? parts[1]! : "__CHASSIS__";
      let b = boxes.get(key);
      if (!b) {
        b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
        boxes.set(key, b);
      }
      for (let v = 0; v < it.pos.length; v += 3) {
        const x = it.pos[v]!;
        const y = it.pos[v + 1]!;
        const z = it.pos[v + 2]!;
        if (x < b[0]) b[0] = x;
        if (y < b[1]) b[1] = y;
        if (z < b[2]) b[2] = z;
        if (x > b[3]) b[3] = x;
        if (y > b[4]) b[4] = y;
        if (z > b[5]) b[5] = z;
      }
    }
    const issues: string[] = [];
    const keys = [...boxes.keys()].filter((k) => k !== "__CHASSIS__").sort();
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const a = boxes.get(keys[i]!)!;
        const b = boxes.get(keys[j]!)!;
        const ox = Math.min(a[3], b[3]) - Math.max(a[0], b[0]);
        const oy = Math.min(a[4], b[4]) - Math.max(a[1], b[1]);
        const oz = Math.min(a[5], b[5]) - Math.max(a[2], b[2]);
        if (ox > 0.03 && oy > 0.03 && oz > 0.03) {
          issues.push(
            `SUB-SUB ${keys[i]} vs ${keys[j]} (${ox.toFixed(2)}x${oy.toFixed(2)}x${oz.toFixed(2)})`,
          );
        }
      }
    }
    const ch = boxes.get("__CHASSIS__");
    if (ch) {
      const fz = ch[5];
      const rz = ch[2];
      const ty = ch[4];
      for (const k of keys) {
        const b = boxes.get(k)!;
        if (
          (k.includes("fans") || k.includes("drives")) &&
          b[2] < fz + 0.02 &&
          b[5] > fz - 0.16 &&
          b[1] < ty
        ) {
          issues.push(
            `WALL-CLIP FRONT ${k} z=[${b[2].toFixed(2)},${b[5].toFixed(2)}] vs fz=${fz.toFixed(2)}`,
          );
        }
        if (
          (k.includes("power") || k.includes("network")) &&
          b[5] > rz - 0.02 &&
          b[2] < rz + 0.16 &&
          b[1] < ty
        ) {
          issues.push(`WALL-CLIP REAR ${k} z=[${b[2].toFixed(2)},${b[5].toFixed(2)}] vs rz=${rz.toFixed(2)}`);
        }
      }
    }
    return issues;
  }

  const allFailures: string[] = [];
  for (const file of files) {
    const buf = readFileSync(join(root, file));
    const jsonLen = buf.readUInt32LE(12);
    const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8")) as GltfDoc;

    const closedZf = findCoplanarZFighting(loadWorldItems(buf, gltf, "closed"));
    for (const h of closedZf) allFailures.push(`${file} [closed] ${h}`);

    if (file !== "cabinet-42u.glb") {
      const items100 = loadWorldItems(buf, gltf, "exploded", 1.0);
      for (const h of findCoplanarZFighting(items100)) {
        if (!closedZf.includes(h)) allFailures.push(`${file} [exploded-100%] ${h}`);
      }
      for (const sp of [0.65, 1.0]) {
        const itemsSp = sp === 1.0 ? items100 : loadWorldItems(buf, gltf, "exploded", sp);
        for (const c of findExplodedCollisions(itemsSp)) {
          allFailures.push(`${file} [spread=${Math.round(sp * 100)}%] ${c}`);
        }
      }
    }
  }
  expect(allFailures).toEqual([]);
});

it("三维矿物色盘与二维架构令牌 1:1 对齐，激活/权重保持严格明度极性且镜头颜色跟随输出张量", async () => {
  const root = "public/experiences";
  const paletteCss = readFileSync(join(root, "reader-palette.css"), "utf8");
  const { ACCENTS, PALETTES } = (await import(
    pathToFileURL(resolve(root, "glm-flow/master/flow-colors.js")).href
  )) as {
    ACCENTS: Record<string, string>;
    PALETTES: { user: Record<string, [string, string]> };
  };
  const srgbToLum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  for (const key of ["embed", "resid", "norm", "kda", "attn", "dense", "router", "expert", "mtp"]) {
    const m = paletteCss.match(new RegExp(`--arch-${key}:\\s*(#[0-9a-fA-F]{6})`));
    expect(m?.[1]?.toLowerCase(), key).toBe(ACCENTS[key]?.toLowerCase());
  }
  for (const [key, [act, wt]] of Object.entries(PALETTES.user)) {
    expect(srgbToLum(act), `${key} activation fuller than weight`).toBeLessThan(srgbToLum(wt) - 0.08);
  }
  const playJs = readFileSync(join(root, "glm-flow/master/play.js"), "utf8");
  expect(playJs).not.toContain("bNow.lesson.comp");
  expect(playJs).toContain("activeComp = outId ? B[id(s, outId)]?.comp : null;");
  expect(playJs).toContain("wName: p0.X.t.name, xName: p0.W.t.name");
});

it("全套八款硬件演示的延伸阅读 Wiki 路由均真实存在，杜绝 404 断链", () => {
  const viewerJs = readFileSync("public/experiences/whole/viewer.js", "utf8");
  const wikiFiles = readdirSync("wiki", { recursive: true })
    .map((p) => String(p).replace(/\\/g, "/"))
    .filter((p) => p.endsWith(".md") && !p.startsWith("_drafts/") && !p.startsWith("raw/"));
  const validSlugs = new Set(wikiFiles.map((p) => p.split("/").pop()!.replace(/\.md$/, "")));

  const wikiBlocks = [...viewerJs.matchAll(/wiki:\s*\[([^\n]+)\]/g)];
  expect(wikiBlocks.length).toBe(8);
  const missing: string[] = [];
  for (const [, inner] of wikiBlocks) {
    for (const [, slug] of inner!.matchAll(/\[\s*'([^']+)'\s*,/g)) {
      if (!validSlugs.has(slug!)) missing.push(slug!);
    }
  }
  expect(missing).toEqual([]);
});
