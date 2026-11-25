import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { ID_RE, type ParamEntry } from "../../../src/content/wiki/schema";
import type { WikiPage } from "../pages";
import {
  matchesConfirmedParamDefinition,
  paramId,
  parsePinnedParamIdentity,
  protectedParamSection,
  resolveConfiguredRepoDir,
} from "./pages";
import { parameterKey } from "./sync";

const schema = z
  .object({
    schemaVersion: z.literal(1),
    bindings: z.array(
      z
        .object({
          repo: z.string().min(1),
          file: z.string().min(1),
          class: z.string(),
          json_path: z.string().min(1),
          pageId: z.string().regex(ID_RE),
          role: z.enum(["definition", "reference"]).optional(),
        })
        .strict(),
    ),
  })
  .strict();

export function parameterBindings(root: string) {
  const path = join(root, "wiki/params/identities.json");
  const bindings = existsSync(path) ? schema.parse(JSON.parse(readFileSync(path, "utf8"))).bindings : [];
  const keys = bindings.map((b) => `${b.repo}:${parameterKey(b)}`);
  if (new Set(keys).size !== keys.length) throw new Error("参数身份映射重复");
  const definitions = bindings.filter((b) => b.role !== "reference").map((b) => `${b.repo}:${b.pageId}`);
  if (new Set(definitions).size !== definitions.length) throw new Error("同一参数页只能绑定一个定义身份");
  return bindings;
}

export function topLevelAdditionalConfigJsonPath(entry: Pick<ParamEntry, "json_path">): string | undefined {
  const m = /^(additional_config\["[^"]+"\])(?:\["[^"]+"\])+$/.exec(entry.json_path);
  return m?.[1];
}

export function isNestedAdditionalConfigSubKey(entry: Pick<ParamEntry, "json_path">): boolean {
  return topLevelAdditionalConfigJsonPath(entry) !== undefined;
}

export function hasPublishedParentParamPage(
  entry: Pick<ParamEntry, "json_path">,
  pages: readonly WikiPage[],
): boolean {
  const parentJsonPath = topLevelAdditionalConfigJsonPath(entry);
  if (!parentJsonPath) return false;
  return pages.some((p) => {
    if (p.fm.type !== "param" || !p.file.startsWith("params/")) return false;
    const pinned = parsePinnedParamIdentity(p.body);
    return pinned?.kind === "json_path" && pinned.jsonPath === parentJsonPath;
  });
}

function matchesBoundParamTarget(
  repo: string,
  repoDir: string | undefined,
  page: WikiPage | undefined,
  entry: ParamEntry,
  role: "definition" | "reference" | undefined,
  pages: WikiPage[],
): boolean {
  if (page?.fm.type !== "param") return false;
  const pinned = parsePinnedParamIdentity(page.body);
  if (!pinned) {
    if (protectedParamSection(page.body)) return false;
    return page.fm.title === entry.name || page.fm.aliases.includes(entry.name);
  }
  if (role === "reference") {
    return (
      pinned.name === entry.name ||
      Boolean(pinned.jsonPath && entry.json_path.startsWith(`${pinned.jsonPath}[`)) ||
      page.fm.aliases.includes(entry.name)
    );
  }
  if (!matchesConfirmedParamDefinition({ repo, repoDir, sources: page.fm.sources, pinned }, entry)) {
    return false;
  }
  const naturalId = paramId(entry);
  if (
    page.fm.id !== naturalId &&
    pages.some((other) => other.fm.type === "param" && other.fm.id === naturalId)
  ) {
    return false;
  }
  return true;
}

/** Explicit identities preserve public links; a title alone never authorizes a rename. */
export function parameterPageId(
  root: string,
  repo: string,
  entry: ParamEntry,
  pages: WikiPage[],
  repoDir = resolveConfiguredRepoDir(root, repo),
) {
  const bindings = parameterBindings(root);
  const binding = bindings.find((b) => b.repo === repo && parameterKey(b) === parameterKey(entry));
  const id = binding?.pageId ?? paramId(entry);
  const page = pages.find((p) => p.fm.id === id);
  if (binding && !matchesBoundParamTarget(repo, repoDir, page, entry, binding.role, pages))
    throw new Error(`参数身份映射目标不匹配：${id}`);
  if (!binding && !page && hasPublishedParentParamPage(entry, pages)) {
    const unmappedLegacySubKey = pages.some((p) => {
      if (p.fm.type !== "param" || p.fm.id === id) return false;
      const pinned = parsePinnedParamIdentity(p.body);
      return pinned?.jsonPath === entry.json_path;
    });
    if (unmappedLegacySubKey) throw new Error(`旧参数页需要明确身份映射：${entry.name}`);
    return undefined;
  }
  if (
    !binding &&
    !page &&
    pages.some((p) => {
      if (p.fm.type !== "param" || p.fm.id === id) return false;
      const pinned = parsePinnedParamIdentity(p.body);
      const existingName = pinned ? pinned.name : protectedParamSection(p.body) ? undefined : p.fm.title;
      return existingName === entry.name;
    })
  )
    throw new Error(`旧参数页需要明确身份映射：${entry.name}`);
  return binding?.role === "reference" ? undefined : id;
}
