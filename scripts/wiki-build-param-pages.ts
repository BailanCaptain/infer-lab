import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { paramEntrySchema } from "../src/content/wiki/schema";
import { gitText } from "./wiki/git";
import { parseSeeds } from "./wiki/ingest";
import { replaceSection } from "./wiki/lineage";
import { gitLineage, renderVerifiedLineage } from "./wiki/lineage-git";
import { loadPages } from "./wiki/pages";
import { parameterPageId } from "./wiki/params/identities";
import { buildParamPage, paramId } from "./wiki/params/pages";
import { recordParamSource } from "./wiki/params/provenance";
import { scanRepo } from "./wiki/params/scan";
import { atomicText } from "./wiki/workflow";

try {
  const { values } = parseArgs({
    options: {
      input: { type: "string", default: "wiki/lineage/params-main.json" },
      only: { type: "string" },
      out: { type: "string", default: "wiki/params" },
      seeds: { type: "string", default: "wiki/seeds/vllm-ascend.yaml" },
      "dry-run": { type: "boolean" },
    },
  });
  const data = z
    .object({ repo: z.string(), ref: z.string(), commit: z.string(), entries: paramEntrySchema.array() })
    .parse(JSON.parse(readFileSync(values.input, "utf8")));
  const seeds = parseSeeds(readFileSync(values.seeds, "utf8"));
  const repo = seeds.repos[data.repo];
  if (!repo) throw new Error("参数来源未配置");
  const pin = repo.refs[data.ref];
  if (
    !pin ||
    gitText(resolve(repo.path), ["rev-parse", "--verify", `${pin}^{commit}`]).trim() !== data.commit
  )
    throw new Error("扫描提交不匹配教学 seeds 钉点；巡检差异须先审阅，不可直接刷新正式定义");
  const repoDir = resolve(repo.path);
  const wanted = values.only?.split(",");
  const known = loadPages(resolve("wiki")).pages;
  const rows = data.entries.filter(
    (p) =>
      (!wanted || wanted.includes(p.name) || wanted.includes(paramId(p))) &&
      (p.confidence === "certain" ||
        p.review?.verdict === "param" ||
        known.some((page) => page.fm.id === parameterPageId(process.cwd(), data.repo, p, known, repoDir))) &&
      p.review?.verdict !== "not-param",
  );
  if (!rows.length) throw new Error("没有已确认的参数");
  const actual = scanRepo(repoDir, data.commit).entries;
  for (const p of rows)
    if (
      !actual.some(
        (a) =>
          a.file === p.file &&
          a.class === p.class &&
          a.name === p.name &&
          a.line === p.line &&
          a.default === p.default &&
          a.type === p.type &&
          a.json_path === p.json_path &&
          a.comment === p.comment &&
          JSON.stringify(a.constraints) === JSON.stringify(p.constraints),
      )
    )
      throw new Error(`参数记录与钉定源码不符：${p.name}`);
  const dir = resolve(values.out);
  const outputs = rows.flatMap((entry) => {
    const id = parameterPageId(process.cwd(), data.repo, entry, known, repoDir);
    if (!id) return [];
    const target = join(dir, `${id}.md`);
    // Static scans can refresh an authored page but cannot publish a new skeleton.
    const path =
      relative(dir, resolve("wiki/params")) === "" && !existsSync(target)
        ? resolve("wiki/_drafts", `${id}.md`)
        : target;
    let text = buildParamPage(
      { ...data, entry, pageId: id, repoDir, date: new Date().toISOString().slice(0, 10) },
      existsSync(path) ? readFileSync(path, "utf8") : undefined,
    );
    if (!values["dry-run"])
      text = recordParamSource(process.cwd(), repoDir, data.repo, data.commit, entry.file, text);
    const lineage = gitLineage(
      repoDir,
      entry.name,
      Object.values(repo.refs),
      entry.class ? [entry.file] : ["vllm_ascend/"],
      entry.class || undefined,
    );
    lineage.presence.forEach((p, i) => {
      p.ref = Object.keys(repo.refs)[i]!;
    });
    return { path, text: replaceSection(text, "## 版本谱系", renderVerifiedLineage(lineage)) };
  });
  if (!values["dry-run"]) {
    mkdirSync(dir, { recursive: true });
    mkdirSync(resolve("wiki/_drafts"), { recursive: true });
    for (const item of outputs) atomicText(item.path, item.text);
  }
  console.log(
    JSON.stringify({ count: outputs.length, dryRun: !!values["dry-run"], paths: outputs.map((o) => o.path) }),
  );
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
