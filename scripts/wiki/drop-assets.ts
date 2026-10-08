import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { diagramRefs, diagramSpecSchema, loadDiagrams, renderDiagram } from "./diagrams";
import { figureProblems } from "./figure";
import { loadPages } from "./pages";
import { replaceText } from "./review-files";
import { sceneCollisions, sceneOverflows } from "./scene";
import { checkStandard, loadStandardConfig } from "./standard";

export function stageDropDiagram(root: string, id: string, yaml: string) {
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
  const issues =
    spec.layout === "figure" ? figureProblems(spec) : [...sceneOverflows(spec), ...sceneCollisions(spec)];
  if (issues.length) throw new Error(`图布局校验失败：${issues.join("；")}`);
  replaceText(root, `wiki/diagrams/${id}.yaml`, stringify(spec));
  replaceText(root, `wiki/diagrams/${id}.svg`, renderDiagram(spec));
}

/** Revalidate deterministic assets on approval as well as generation. */
export function validateDropAssets(root: string, paths: string[], enforceTeaching = false): string[] {
  const { diagrams, problems } = loadDiagrams(join(root, "wiki"));
  const issues = problems.map((p) => `${p.file}: ${p.message}`);
  const { pages } = loadPages(join(root, "wiki"));
  for (const path of paths.filter((p) => /^wiki\/diagrams\/.*\.yaml$/.test(p))) {
    const id = path.split("/").at(-1)!.slice(0, -5);
    const d = diagrams.get(id);
    if (!d) {
      issues.push(`图缺失：${id}`);
      continue;
    }
    const spec = d.spec;
    if (spec.size[0] > 900) issues.push(`图过宽：${id}`);
    issues.push(
      ...(spec.layout === "figure"
        ? figureProblems(spec)
        : [...sceneOverflows(spec), ...sceneCollisions(spec)]
      ).map((p) => `${id}: ${p}`),
    );
    try {
      if (readFileSync(join(root, "wiki", d.svgFile), "utf8") !== renderDiagram(spec))
        issues.push(`图规格与 SVG 不一致：${id}`);
    } catch {
      issues.push(`缺少 SVG：${id}`);
    }
    if (!pages.some((p) => diagramRefs(p.body).includes(id))) issues.push(`图未被正文引用：${id}`);
  }
  for (const path of paths.filter((p) => p.endsWith(".svg")))
    if (!paths.includes(path.replace(/\.svg$/, ".yaml"))) issues.push(`SVG 必须与图规格共同审批：${path}`);
  if (enforceTeaching)
    for (const page of pages.filter(
      (p) => paths.includes(`wiki/${p.file}`) && ["concept", "feature"].includes(p.fm.type),
    )) {
      if (!page.fm.toc) issues.push(`新整合教学页缺目录位置：${page.fm.id}`);
      if (!diagramRefs(page.body).length) issues.push(`教学页缺图：${page.fm.id}`);
      issues.push(
        ...checkStandard({ ...page, lineOffset: 0 }, loadStandardConfig(), diagrams).problems.map(
          (p) => `${p.file}: ${p.message}`,
        ),
      );
    }
  return issues;
}
