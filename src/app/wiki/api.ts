/** 问答服务没起来时，代理或静态服务器回的是 HTML / 空响应——给一句人话，不把解析异常抛给读者 */
export const SERVICE_DOWN = "连不上问答服务。先在项目目录运行 pnpm dev:server，再重试。";

export async function wikiRequest<T>(path: string, body?: unknown, revision?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(
      `/api/wiki/${path}`,
      body === undefined
        ? { headers: revision ? { "If-None-Match": `"${revision}"` } : {} }
        : {
            method: "POST",
            headers: { "content-type": "application/json", "x-wiki-review": "1" },
            body: JSON.stringify(body),
          },
    );
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new Error(SERVICE_DOWN);
  }
  if (revision && response.status === 304) return null as T;
  let data: {
    error?: string;
    canNewAttempt?: boolean;
    budgetUsd?: number;
    rejectedReviewId?: string;
  };
  try {
    data = await response.json();
  } catch {
    throw new Error(response.ok ? "问答服务返回了无法解析的内容" : SERVICE_DOWN);
  }
  if (!response.ok) {
    const err = new Error(data.error ?? `服务返回 ${response.status}`) as Error & {
      canNewAttempt?: boolean;
      budgetUsd?: number;
      rejectedReviewId?: string;
    };
    if (typeof data.canNewAttempt === "boolean") err.canNewAttempt = data.canNewAttempt;
    if (typeof data.budgetUsd === "number") err.budgetUsd = data.budgetUsd;
    if (typeof data.rejectedReviewId === "string") err.rejectedReviewId = data.rejectedReviewId;
    throw err;
  }
  return data as T;
}

const pendingSnapshots = new Map<string, Promise<unknown>>();
export function requestReaderSnapshot(revision: string): Promise<unknown> {
  let pending = pendingSnapshots.get(revision);
  if (!pending) {
    pending = wikiRequest("pages", undefined, revision).finally(() => pendingSnapshots.delete(revision));
    pendingSnapshots.set(revision, pending);
  }
  return pending;
}
