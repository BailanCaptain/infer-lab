/** 问答服务没起来时，代理或静态服务器回的是 HTML / 空响应——给一句人话，不把解析异常抛给读者 */
export const SERVICE_DOWN = "连不上问答服务。先在项目目录运行 pnpm dev:server，再重试。";
export const SERVICE_DOWN_CHAT_HINT =
  "本地问答服务未启动：请在终端运行 pnpm dev:server（或 pnpm dev:all），再点上方「重新连接」";
export const STATIC_OFFLINE_HINT = "当前为纯静态离线浏览模式：可使用 Ctrl+K 全站检索，或复制下方脱敏诊断摘要";

export type BackendAvailability = "unknown" | "online" | "service-down" | "offline";

export class StaticBackendOfflineError extends Error {
  readonly isStaticOffline = true;
  readonly requestEpoch?: number | undefined;
  constructor(message = STATIC_OFFLINE_HINT, requestEpoch?: number) {
    super(message);
    this.name = "StaticBackendOfflineError";
    this.requestEpoch = requestEpoch;
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
let nextRequestStartSeq = 0;
let newestVerdictStartSeq = 0;
const backendListeners = new Set<() => void>();

export function getBackendAvailability(): BackendAvailability {
  return backendAvailability;
}

export function beginBackendRequestEpoch(): number {
  return ++nextRequestStartSeq;
}

export function commitBackendVerdictForSeq(startSeq: number, verdict: BackendAvailability): void {
  if (startSeq < newestVerdictStartSeq) return;
  newestVerdictStartSeq = startSeq;
  if (backendAvailability === verdict) return;
  backendAvailability = verdict;
  for (const listener of backendListeners) listener();
}

export function setBackendAvailability(next: BackendAvailability): void {
  commitBackendVerdictForSeq(++nextRequestStartSeq, next);
}

export function reportBackendOnlineForEpoch(requestStartEpoch: number): void {
  commitBackendVerdictForSeq(requestStartEpoch, "online");
}

export function reportBackendFailureForEpoch(
  requestStartEpoch: number,
  next: "service-down" | "offline",
): void {
  commitBackendVerdictForSeq(requestStartEpoch, next);
}

export function subscribeBackendAvailability(listener: () => void): () => void {
  backendListeners.add(listener);
  return () => {
    backendListeners.delete(listener);
  };
}

export interface InflightBackendRequest<T> {
  promise: Promise<T>;
  startSeq: number;
}

const TOP_LEVEL_PROBE_PATHS = new Set(["pages", "reviews", "drops", "status", "health"]);

export async function wikiRequest<T>(
  path: string,
  body?: unknown,
  revision?: string,
  explicitStartSeq?: number,
): Promise<T> {
  const reqEpoch = explicitStartSeq ?? beginBackendRequestEpoch();
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
    reportBackendFailureForEpoch(reqEpoch, "service-down");
    throw new Error(SERVICE_DOWN);
  }
  if (revision && response.status === 304) {
    reportBackendOnlineForEpoch(reqEpoch);
    return null as T;
  }

  const contentType = (response.headers?.get?.("content-type") ?? "").toLowerCase();
  const proxyOffline = response.headers?.get?.("x-wiki-backend-offline") === "1";
  if (proxyOffline) {
    reportBackendFailureForEpoch(reqEpoch, "service-down");
    throw new Error(SERVICE_DOWN);
  }

  const isProbePath = body === undefined && TOP_LEVEL_PROBE_PATHS.has(path);
  const isGatewayDown =
    (response.status === 502 || response.status === 503 || response.status === 504) &&
    !contentType.includes("application/json");
  if (isGatewayDown) {
    reportBackendFailureForEpoch(reqEpoch, "service-down");
    throw new Error(SERVICE_DOWN);
  }

  const isStaticHtmlFallback =
    response.ok && contentType.length > 0 && !contentType.includes("application/json");
  const isStaticMissingRoute =
    isProbePath && response.status === 404 && !contentType.includes("application/json");

  if (isStaticHtmlFallback || isStaticMissingRoute) {
    reportBackendFailureForEpoch(reqEpoch, "offline");
    throw new StaticBackendOfflineError(undefined, reqEpoch);
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
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      reportBackendFailureForEpoch(reqEpoch, "service-down");
      throw new Error(SERVICE_DOWN);
    }
    if (response.ok || (isProbePath && response.status === 404)) {
      reportBackendFailureForEpoch(reqEpoch, "offline");
      throw new StaticBackendOfflineError(undefined, reqEpoch);
    }
    throw new Error(response.ok ? "问答服务返回了无法解析的内容" : SERVICE_DOWN);
  }
  if (!response.ok) {
    if (isProbePath && response.status === 404 && !data.error) {
      reportBackendFailureForEpoch(reqEpoch, "offline");
      throw new StaticBackendOfflineError(undefined, reqEpoch);
    }
    if ((response.status === 502 || response.status === 504) && !data.error) {
      reportBackendFailureForEpoch(reqEpoch, "service-down");
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
  reportBackendOnlineForEpoch(reqEpoch);
  return data as T;
}

let pendingHealthProbe: Promise<BackendAvailability> | null = null;
const DEFAULT_HEALTH_PROBE_TIMEOUT_MS = 4000;

/**
 * 主动探测本地问答服务 `/api/wiki/health`：合并并发点击、附带超时保护，收到 `200 { ok: true }` 立即切回 `"online"`。
 */
export function probeBackendHealth(
  fetchImpl: typeof fetch = fetch,
  timeoutMs = DEFAULT_HEALTH_PROBE_TIMEOUT_MS,
): Promise<BackendAvailability> {
  if (pendingHealthProbe) return pendingHealthProbe;
  const probeEpoch = beginBackendRequestEpoch();
  const abortController = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutSentinel = Symbol("probe-timeout");
  const timeoutPromise = new Promise<typeof timeoutSentinel>((resolve) => {
    timer = setTimeout(
      () => {
        abortController.abort();
        resolve(timeoutSentinel);
      },
      Math.max(1, timeoutMs),
    );
  });

  pendingHealthProbe = (async (): Promise<BackendAvailability> => {
    try {
      const raced = await Promise.race([
        fetchImpl("/api/wiki/health", { cache: "no-store", signal: abortController.signal }),
        timeoutPromise,
      ]);
      if (raced === timeoutSentinel) {
        reportBackendFailureForEpoch(probeEpoch, "service-down");
        return "service-down";
      }
      const response = raced;
      const contentType = (response.headers?.get?.("content-type") ?? "").toLowerCase();
      const proxyOffline = response.headers?.get?.("x-wiki-backend-offline") === "1";
      if (proxyOffline) {
        reportBackendFailureForEpoch(probeEpoch, "service-down");
        return "service-down";
      }
      if (
        (response.ok && contentType.length > 0 && !contentType.includes("application/json")) ||
        (response.status === 404 && !contentType.includes("application/json"))
      ) {
        reportBackendFailureForEpoch(probeEpoch, "offline");
        return "offline";
      }

      const jsonRaced = await Promise.race([response.json() as Promise<unknown>, timeoutPromise]);
      if (jsonRaced === timeoutSentinel) {
        reportBackendFailureForEpoch(probeEpoch, "service-down");
        return "service-down";
      }
      const data = jsonRaced;

      if (
        response.ok &&
        typeof data === "object" &&
        data !== null &&
        (data as { ok?: unknown }).ok === true
      ) {
        reportBackendOnlineForEpoch(probeEpoch);
        return "online";
      }
      if (response.status === 404 && !(data as { error?: unknown })?.error) {
        reportBackendFailureForEpoch(probeEpoch, "offline");
        return "offline";
      }
      reportBackendFailureForEpoch(probeEpoch, "service-down");
      return "service-down";
    } catch {
      reportBackendFailureForEpoch(probeEpoch, "service-down");
      return "service-down";
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  })().finally(() => {
    pendingHealthProbe = null;
  });
  return pendingHealthProbe;
}

const pendingSnapshots = new Map<string, InflightBackendRequest<unknown>>();

export function requestReaderSnapshotWithEpoch(revision: string): InflightBackendRequest<unknown> {
  let pending = pendingSnapshots.get(revision);
  if (!pending) {
    const startSeq = beginBackendRequestEpoch();
    const promise = wikiRequest("pages", undefined, revision, startSeq).finally(() => {
      if (pendingSnapshots.get(revision)?.promise === promise) {
        pendingSnapshots.delete(revision);
      }
    });
    pending = { promise, startSeq };
    pendingSnapshots.set(revision, pending);
  }
  return pending;
}

export function requestReaderSnapshot(revision: string): Promise<unknown> {
  return requestReaderSnapshotWithEpoch(revision).promise;
}
