import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { diagramRefs, diagramSpecSchema, isNativeSvgSpec, loadDiagrams, renderDiagram } from "./diagrams";
import { figureProblems } from "./figure";
import { validateNativeSvg } from "./native-svg";
import { loadPages } from "./pages";
import { replaceText } from "./review-files";
import { sceneCollisions, sceneOverflows } from "./scene";
import { checkStandard, loadStandardConfig } from "./standard";

/**
 * 统一解析图资产在 Drop 复核与批准回执中的完整材料路径：
 * figure/scene 仅绑定决定输出的规格 YAML（保持旧缓存兼容）；
 * native-svg 必须同时绑定伴生 YAML 与同名 SVG 纯数据。
 */
export function diagramMaterialPaths(id: string, yamlText: string): string[] {
  const spec = diagramSpecSchema.parse(parse(yamlText));
  return isNativeSvgSpec(spec) ? [`diagrams/${id}.yaml`, `diagrams/${id}.svg`] : [`diagrams/${id}.yaml`];
}

export function stageDropDiagram(root: string, id: string, yaml: string, svg?: string) {
  let spec: ReturnType<typeof diagramSpecSchema.parse>;
  try {
    spec = diagramSpecSchema.parse(parse(yaml));
  } catch (error) {
    throw new Error(`图规格校验失败：${String(error)}`);
  }
  if (spec.id !== id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))
    throw new Error("图规格校验失败：图身份不匹配");
  if (spec.size[0] > 900 || spec.size.some((n) => n <= 0))
    throw new Error("图规格校验失败：图画布必须为正且宽度不超过 900");
  if (isNativeSvgSpec(spec)) {
    if (typeof svg !== "string" || !svg.trim())
      throw new Error("图规格校验失败：native-svg 必须同时提供同名 SVG 纯数据");
    const svgIssues = validateNativeSvg(svg, spec.size);
    if (svgIssues.length) throw new Error(`原生 SVG 校验失败：${svgIssues.join("；")}`);
    replaceText(root, `wiki/diagrams/${id}.yaml`, stringify(spec));
    replaceText(root, `wiki/diagrams/${id}.svg`, svg);
    return;
  }
  if (svg !== undefined)
    throw new Error("图规格校验失败：figure/scene 图由规格确定性渲染，禁止附带额外 svg 字段");
  const issues =
    spec.layout === "figure" ? figureProblems(spec) : [...sceneOverflows(spec), ...sceneCollisions(spec)];
  if (issues.length) throw new Error(`图布局校验失败：${issues.join("；")}`);
  const rendered = renderDiagram(spec);
  replaceText(root, `wiki/diagrams/${id}.yaml`, stringify(spec));
  replaceText(root, `wiki/diagrams/${id}.svg`, rendered);
}

/** Revalidate deterministic assets on approval as well as generation. */
export function validateDropAssets(root: string, paths: string[], enforceTeaching = false): string[] {
  const { diagrams, problems } = loadDiagrams(join(root, "wiki"));
  const issues = problems.map((p) => `${p.file}: ${p.message}`);
  const { pages, problems: pageProblems } = loadPages(join(root, "wiki"));
  issues.push(
    ...pageProblems.filter((p) => paths.includes(`wiki/${p.file}`)).map((p) => `${p.file}: ${p.message}`),
  );
  const touchedDiagramIds = [
    ...new Set(
      paths
        .filter((p) => /^wiki\/diagrams\/.*\.(yaml|svg)$/.test(p))
        .map((p) =>
          p
            .split("/")
            .at(-1)!
            .replace(/\.(yaml|svg)$/, ""),
        ),
    ),
  ];
  for (const id of touchedDiagramIds) {
    const d = diagrams.get(id);
    if (!d) {
      if (paths.includes(`wiki/diagrams/${id}.yaml`)) issues.push(`图缺失：${id}`);
      continue;
    }
    const spec = d.spec;
    if (spec.size[0] > 900) issues.push(`图过宽：${id}`);
    issues.push(
      ...(isNativeSvgSpec(spec)
        ? []
        : spec.layout === "figure"
          ? figureProblems(spec)
          : [...sceneOverflows(spec), ...sceneCollisions(spec)]
      ).map((p) => `${id}: ${p}`),
    );
    if (!isNativeSvgSpec(spec)) {
      try {
        if (readFileSync(join(root, "wiki", d.svgFile), "utf8") !== renderDiagram(spec))
          issues.push(`图规格与 SVG 不一致：${id}`);
      } catch {
        issues.push(`缺少 SVG：${id}`);
      }
    }
    if (!pages.some((p) => diagramRefs(p.body).includes(id))) issues.push(`图未被正文引用：${id}`);
  }
  for (const path of paths.filter((p) => p.endsWith(".svg"))) {
    const id = path.split("/").at(-1)!.slice(0, -4);
    const d = diagrams.get(id);
    if (!paths.includes(path.replace(/\.svg$/, ".yaml")) && (!d || !isNativeSvgSpec(d.spec)))
      issues.push(`SVG 必须与图规格共同审批：${path}`);
  }
  if (enforceTeaching) {
    const cfg = loadStandardConfig();
    for (const page of pages.filter(
      (p) => paths.includes(`wiki/${p.file}`) && ["concept", "feature"].includes(p.fm.type),
    )) {
      if (!page.fm.toc) issues.push(`新整合教学页缺目录位置：${page.fm.id}`);
      issues.push(
        ...checkStandard({ ...page, lineOffset: (page.bodyLine ?? 1) - 1 }, cfg, diagrams).problems.map(
          (p) => `${p.file}: ${p.message}`,
        ),
      );
    }
  }
  return issues;
}

/** Collect non-blocking teaching readability advisories with true file line numbers. */
export function collectDropAssetAdvisories(root: string, paths: string[]): string[] {
  const { diagrams } = loadDiagrams(join(root, "wiki"));
  const { pages } = loadPages(join(root, "wiki"));
  const cfg = loadStandardConfig();
  return pages
    .filter((p) => paths.includes(`wiki/${p.file}`) && ["concept", "feature"].includes(p.fm.type))
    .flatMap((page) =>
      checkStandard({ ...page, lineOffset: (page.bodyLine ?? 1) - 1 }, cfg, diagrams).advisories.map(
        (p) => `${p.file}: ${p.message}`,
      ),
    );
}
