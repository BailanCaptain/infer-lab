import type { MasterParts, PartArrow, PartBlock, PartTensor } from "./matrix-parts";

// The published master supplies the dimensions, aligned layout, mesh and demo values.
let source: Promise<MasterParts> | undefined;
export function loadMasterParts(): Promise<MasterParts> {
  if (source) return source;
  const base = `${import.meta.env.BASE_URL}experiences/`;
  const master = `${base}glm-flow/master/`;
  // Absolute HTTP imports bypass Vite's source-module pipeline for published, unbundled assets.
  const moduleAt = (url: string) => import(/* @vite-ignore */ new URL(url, window.location.href).href);
  const response = async (url: string) => {
    const result = await fetch(url);
    if (!result.ok) throw new Error(`矩阵数据加载失败（${result.status}）`);
    return result;
  };
  source = Promise.all([
    moduleAt(`${base}vendor/build/three.module.js`),
    moduleAt(`${master}flow-look.js`),
    moduleAt(`${master}flow-layout.js`),
    moduleAt(`${master}truth-spec.js`),
    moduleAt(`${master}demo-data.js`),
    response(`${base}glm-flow/reference/official-config.json`).then((r) => r.json()),
    response(`${master}demo/continuous/l00.json`).then((r) => r.json()),
    response(`${master}demo/continuous/l00.bin`).then((r) => r.arrayBuffer()),
  ])
    .then(([three, look, layout, spec, data, config, index, bytes]) => {
      const layer = spec.layerSpec(config.text_config, index.ids.length, 0);
      const tensors: PartTensor[] = layer.tensors;
      const native = layout.layoutFlow(layer);
      const blocks: PartBlock[] = native.blocks.map(layout.toWorld);
      const arrows: PartArrow[] = native.arrows.map((arrow: PartArrow) => ({
        ...arrow,
        pts: arrow.pts.map(layout.ptWorld),
      }));
      return {
        three,
        demo: data.makeDemo(index.weights, index, new Float32Array(bytes)),
        tensors: new Map(tensors.map((tensor) => [tensor.id, tensor])),
        layoutBlocks: new Map(blocks.map((block) => [block.id, block])),
        layoutArrows: arrows,
        epsilon: config.text_config.rms_norm_eps,
        limit: config.text_config.swiglu_limit,
        shapeOf: layout.shapeOf,
        makeFlowLook: look.makeFlowLook,
      };
    })
    .catch((error: unknown) => {
      source = undefined;
      throw error;
    });
  return source;
}
