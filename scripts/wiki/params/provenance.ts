import { join } from "node:path";
import matter from "gray-matter";
import { sourceLines } from "../audit";
import { gitText } from "../git";
import { lineageTerm } from "../lineage";
import { readPageRaw, saveRawSnapshot, withRawSources } from "../raw";
import { isCompatibleParamJsonPath, parsePinnedParamIdentity, protectedParamSection } from "./pages";
import { scanSources } from "./scan";

/** Recover a definition from its pinned generated citation, never from its title alone. */
export function parameterDefinition(repoDir: string, text: string) {
  const section = protectedParamSection(text);
  if (!section) return undefined;
  const page = matter(text);
  const citation = /^\| 定义 \| `([^`]+):(\d+)` \[C(\d+)\] \|$/m.exec(section);
  const source = citation && page.data.sources?.[Number(citation[3]) - 1];
  const ref = typeof source === "string" && /^[^@]+@([a-f0-9]{7,40}):([^#]+)#L(\d+)(?:-L\d+)?$/.exec(source);
  if (!citation || !ref || ref[2] !== citation[1] || ref[3] !== citation[2])
    throw new Error("参数定义的固定来源与自动表不匹配，未重算谱系");
  const file = ref[2]!;
  const pinned = parsePinnedParamIdentity(text);
  if (/^\| (?:标识|字段身份（不代表用户输入入口）) \|/m.test(section) && !pinned)
    throw new Error("不能唯一定位参数定义，未重算谱系");
  const expectedName = pinned?.name ?? lineageTerm(page.data.title ?? "");
  const entries = scanSources({ [file]: gitText(repoDir, ["show", `${ref[1]}:${file}`]) });
  const matches = entries.filter(
    (entry) =>
      entry.line === Number(ref[3]) &&
      entry.name === expectedName &&
      (!pinned?.hasExplicitClass || entry.class === pinned.className) &&
      (pinned?.kind === "json_path" && pinned.jsonPath
        ? isCompatibleParamJsonPath(pinned.jsonPath, entry)
        : true),
  );
  if (matches.length !== 1) throw new Error("不能唯一定位参数定义，未重算谱系");
  return matches[0]!;
}

/** Archive what this static scan actually read; never reconstruct historical agent receipts. */
export function recordParamSource(
  root: string,
  repoDir: string,
  repo: string,
  commit: string,
  file: string,
  text: string,
) {
  const page = matter(text);
  const wiki = join(root, "wiki");
  const paths: string[] = [...(page.data.rawSources ?? [])];
  if (!paths.length) {
    const legacy = readPageRaw(wiki, page.data.id);
    if (legacy.trim()) paths.push(saveRawSnapshot(wiki, legacy));
  }
  const source = gitText(repoDir, ["show", `${commit}:${file}`]);
  const ref = `${repo}@${commit}:${file}#L1-L${sourceLines(source).length}`;
  paths.push(
    saveRawSnapshot(
      wiki,
      `# Static parameter scan input\n\nThis snapshot records the pinned input read by the static scanner, not a historical agent receipt.\n\nSource: \`${ref}\`\n\n${source}`,
    ),
  );
  return withRawSources(text, paths);
}
