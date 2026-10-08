import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { dropItemSchema } from "../src/content/wiki/drop";
import { acceptBatch, editBatch, listBatches, readBatch } from "../scripts/wiki/drop-batch";
import { cancelDrop, type DropRunnerDeps, startDrop } from "../scripts/wiki/drop-run";
import { checkWriter, HttpError, readJson, send } from "./http";

const runInput = z
  .object({
    retry: z.boolean().optional(),
    feedback: z.string().trim().min(1).max(4000).optional(),
    newAttempt: z.boolean().optional(),
  })
  .strict();
const editInput = z
  .object({
    remove: z.array(z.number().int().nonnegative()).optional(),
    items: z.array(dropItemSchema).optional(),
  })
  .strict();
export async function handleDrop(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
  deps: DropRunnerDeps = {},
): Promise<boolean> {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  if (path !== "/api/wiki/drops" && !path.startsWith("/api/wiki/drops/")) return false;
  try {
    const match = /^\/api\/wiki\/drops(?:\/([a-f0-9-]{36})(?:\/(run|edit|cancel))?)?$/.exec(path);
    if (!match) throw new HttpError(400, "无效的资料批次路径");
    const [, id, action] = match;
    if (req.method === "GET" && !action) {
      send(res, 200, id ? { batch: readBatch(root, id) } : { batches: listBatches(root) });
      return true;
    }
    if (req.method !== "POST") throw new HttpError(405, "需要 GET 或 POST");
    checkWriter(req);
    const body = await readJson(req, 8 * 1024 * 1024);
    if (!id) send(res, 201, { batch: await acceptBatch(root, body) });
    else if (action === "edit") send(res, 200, { batch: await editBatch(root, id, editInput.parse(body)) });
    else if (action === "cancel") {
      z.object({}).strict().parse(body);
      send(res, 200, { batch: await cancelDrop(root, id) });
    } else if (action === "run") {
      const result = await startDrop(root, id, runInput.parse(body), deps);
      void result.done.catch((error) => console.error("drop background failure", String(error)));
      send(res, 202, { batch: result.batch });
    } else throw new HttpError(400, "需要明确操作");
  } catch (error) {
    send(
      res,
      error instanceof HttpError
        ? error.status
        : error instanceof z.ZodError
          ? 400
          : (error as NodeJS.ErrnoException).code === "ENOENT"
            ? 404
            : 409,
      { error: error instanceof z.ZodError ? "资料请求不符合契约" : String(error) },
    );
  }
  return true;
}
