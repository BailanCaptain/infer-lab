import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { approveReview, listReviews, readReview, rejectReview, reviewDiff } from "../scripts/wiki/review";
import { parsePage } from "../scripts/wiki/pages";
import { buildToc } from "../src/content/wiki/toc";

const revision = z.string().regex(/^[a-f0-9]{64}$/);
const approveInput = z.object({ revision }).strict();
const rejectInput = approveInput.extend({ reason: z.string().trim().min(1).max(2000) }).strict();

import { checkWriter, HttpError, readJson, send } from "./http";

/** HTTP only transports existing revisions. CLI and HTTP call the same publisher. */
export async function handleReview(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
): Promise<boolean> {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  if (path !== "/api/wiki/reviews" && !path.startsWith("/api/wiki/reviews/")) return false;
  try {
    if (path === "/api/wiki/reviews") {
      if (req.method !== "GET") throw new HttpError(405, "需要 GET");
      send(res, 200, {
        reviews: listReviews(root).map(({ id, state, reason, payload }) => ({
          id,
          state,
          reason,
          decision: payload.decision,
          files: payload.writes.map((w) => w.path),
        })),
      });
      return true;
    }
    const match = /^\/api\/wiki\/reviews\/([a-f0-9]{64})(?:\/(approve|reject))?$/.exec(path);
    if (!match) throw new HttpError(400, "需要完整的 revision 与合法操作");
    const id = match[1]!;
    const action = match[2];
    if (req.method !== (action ? "POST" : "GET")) throw new HttpError(405, action ? "需要 POST" : "需要 GET");
    if (!action) {
      const review = readReview(root, id);
      const placement = (path: string, text: string | null) => {
        if (!text) return "无此页";
        const page = parsePage(path.replace(/^wiki\//, ""), text).page;
        if (!page) return "未编排";
        return buildToc([page.fm])
          .flatMap((p) => p.sections.map((s) => `${p.title} → ${s.title} → ${page.fm.title}`))
          .join("；");
      };
      const placements = review.payload.drop
        ? review.payload.writes
            .filter((w) => /^wiki\/(concepts|sources|params)\/.*\.md$/.test(w.path))
            .map((w) => ({
              path: w.path,
              before: placement(w.path, w.before),
              after: placement(w.path, w.after),
            }))
        : [];
      send(res, 200, { review, diff: reviewDiff(root, id), placements });
      return true;
    }
    checkWriter(req);
    const input = (action === "approve" ? approveInput : rejectInput).parse(await readJson(req));
    if (input.revision !== id) throw new HttpError(400, "批准版本与所选 revision 不一致");
    const review =
      action === "approve"
        ? await approveReview(root, id)
        : await rejectReview(root, id, rejectInput.parse(input).reason);
    send(res, 200, { id: review.id, state: review.state, reason: review.reason });
  } catch (error) {
    const status =
      error instanceof HttpError
        ? error.status
        : error instanceof z.ZodError
          ? 400
          : (error as NodeJS.ErrnoException).code === "ENOENT"
            ? 404
            : 409;
    send(res, status, { error: error instanceof z.ZodError ? "请求或审阅记录不符合契约" : String(error) });
  }
  return true;
}
