import type { IncomingMessage, ServerResponse } from "node:http";
import { getPageEvidenceCached } from "../scripts/wiki/evidence";
import { checkLocalReader, HttpError, parseWikiUrl, send } from "./http";
import { readLockedEvidenceSnapshot } from "./snapshot";

/** Read-only evidence pack bound to the exact locked reader snapshot revision; never reads working tree or unpublished drafts. */
export async function handleEvidence(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
): Promise<boolean> {
  const url = parseWikiUrl(req, res);
  if (!url) return true;
  if (url.pathname !== "/api/wiki/evidence") return false;
  try {
    checkLocalReader(req);
  } catch (error) {
    send(res, error instanceof HttpError ? error.status : 403, { error: String(error) });
    return true;
  }
  if (req.method !== "GET") {
    send(res, 405, { error: "需要 GET" });
    return true;
  }
  const page = url.searchParams.get("page")?.trim() ?? "";
  const revision = url.searchParams.get("revision")?.trim() ?? "";
  if (!page || !/^[a-f0-9]{64}$/.test(revision)) {
    send(res, 400, { error: "需要有效的 page 与 64 位 revision 参数" });
    return true;
  }
  let locked: Awaited<ReturnType<typeof readLockedEvidenceSnapshot>>;
  try {
    locked = await readLockedEvidenceSnapshot(root);
  } catch (error) {
    send(res, 503, { error: String(error) });
    return true;
  }
  if (locked.revision !== revision) {
    send(res, 409, { error: "证据版本已过期，请刷新知识库。", revision: locked.revision });
    return true;
  }
  // 先校验锁定版本（旧 revision 即使缓存里有也返回 409），再走非阻塞的 (revision, page) 缓存构建。
  let pack: Awaited<ReturnType<typeof getPageEvidenceCached>>;
  try {
    pack = await getPageEvidenceCached(root, locked, page);
  } catch (error) {
    send(res, 503, { error: String(error) });
    return true;
  }
  if (!pack) {
    send(res, 404, { error: "未找到对应知识库页面。" });
    return true;
  }
  send(res, 200, pack);
  return true;
}
