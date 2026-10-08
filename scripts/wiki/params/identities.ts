import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { ID_RE, type ParamEntry } from "../../../src/content/wiki/schema";
import type { WikiPage } from "../pages";
import { paramId } from "./pages";
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

/** Explicit identities preserve public links; a title alone never authorizes a rename. */
export function parameterPageId(root: string, repo: string, entry: ParamEntry, pages: WikiPage[]) {
  const bindings = parameterBindings(root);
  const binding = bindings.find((b) => b.repo === repo && parameterKey(b) === parameterKey(entry));
  const id = binding?.pageId ?? paramId(entry);
  const page = pages.find((p) => p.fm.id === id);
  if (binding && (page?.fm.type !== "param" || page.fm.title !== entry.name))
    throw new Error(`参数身份映射目标不匹配：${id}`);
  if (
    !binding &&
    !page &&
    pages.some((p) => p.fm.type === "param" && p.fm.title === entry.name && p.fm.id !== id)
  )
    throw new Error(`旧参数页需要明确身份映射：${entry.name}`);
  return binding?.role === "reference" ? undefined : id;
}
