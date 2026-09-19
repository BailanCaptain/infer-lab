import { join } from "node:path";
import matter from "gray-matter";
import { sourceLines } from "../audit";
import { gitText } from "../git";
import { readPageRaw, saveRawSnapshot, withRawSources } from "../raw";

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
