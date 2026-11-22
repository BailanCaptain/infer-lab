/** 问答服务没起来时，代理或静态服务器回的是 HTML / 空响应——给一句人话，不把解析异常抛给读者 */
export const SERVICE_DOWN = "连不上问答服务。先在项目目录运行 pnpm dev:server，再重试。";
export const STATIC_OFFLINE_HINT = "当前为纯静态离线浏览模式：可使用 Ctrl+K 全站检索，或复制下方脱敏诊断摘要";

export type BackendAvailability = "unknown" | "online" | "offline";

export class StaticBackendOfflineError extends Error {
  readonly isStaticOffline = true;
  constructor(message = STATIC_OFFLINE_HINT) {
    super(message);
    this.name = "StaticBackendOfflineError";
  }
}

export function isStaticOfflineError(error: unknown): error is StaticBackendOfflineError {
  return (
    error instanceof StaticBackendOfflineError ||
    (typeof error === "object" &&
      error !== null &&
      "isStaticOffline" in error &&
      (error as { isStaticOffline?: unknown }).isStaticOffline === true)
  );
}

let backendAvailability: BackendAvailability = "unknown";
const backendListeners = new Set<() => void>();

export function getBackendAvailability(): BackendAvailability {
  return backendAvailability;
}

export function setBackendAvailability(next: BackendAvailability): void {
  if (backendAvailability === next) return;
  backendAvailability = next;
  for (const listener of backendListeners) listener();
}

export function subscribeBackendAvailability(listener: () => void): () => void {
  backendListeners.add(listener);
  return () => {
    backendListeners.delete(listener);
  };
}

const TOP_LEVEL_PROBE_PATHS = new Set(["pages", "reviews", "drops", "status"]);

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
  if (revision && response.status === 304) {
    setBackendAvailability("online");
    return null as T;
  }

  const contentType = (response.headers?.get?.("content-type") ?? "").toLowerCase();
  const proxyOffline = response.headers?.get?.("x-wiki-backend-offline") === "1";
  const isProbePath = body === undefined && TOP_LEVEL_PROBE_PATHS.has(path);
  const isStaticHtmlFallback =
    response.ok && contentType.length > 0 && !contentType.includes("application/json");
  const isStaticMissingRoute =
    isProbePath && response.status === 404 && !contentType.includes("application/json");

  if (proxyOffline || isStaticHtmlFallback || isStaticMissingRoute) {
    setBackendAvailability("offline");
    throw new StaticBackendOfflineError();
  }

  let data: {
    error?: string;
    canNewAttempt?: boolean;
    budgetUsd?: number;
    rejectedReviewId?: string;
  };
  try {
    data = await response.json();
  } catch {
    if (response.ok || (isProbePath && response.status === 404)) {
      setBackendAvailability("offline");
      throw new StaticBackendOfflineError();
    }
    throw new Error(response.ok ? "问答服务返回了无法解析的内容" : SERVICE_DOWN);
  }
  if (!response.ok) {
    if (isProbePath && response.status === 404 && !data.error) {
      setBackendAvailability("offline");
      throw new StaticBackendOfflineError();
    }
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
  setBackendAvailability("online");
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
