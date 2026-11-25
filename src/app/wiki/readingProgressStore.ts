import { useSyncExternalStore } from "react";
import { type RegistryEntry, resolveCanonicalPageId } from "../../content/wiki/schema";
import { CORE_26_SET } from "../../content/wiki/toc";

export const READING_PROGRESS_STORAGE_KEY = "infer-lab:wiki-read:v1";

export interface ReadingProgressStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface Core26Progress {
  readonly canonicalReadIds: ReadonlySet<string>;
  readonly completedCoreIds: ReadonlySet<string>;
  readonly completed: number;
  readonly total: number;
}

function defaultStorage(): ReadingProgressStorageLike | null {
  try {
    if (typeof localStorage === "undefined") return null;
    if (typeof localStorage.getItem !== "function" || typeof localStorage.setItem !== "function") {
      return null;
    }
    return localStorage;
  } catch {
    return null;
  }
}

function parseStoredRaw(raw: string | null): Set<string> {
  if (!raw) return new Set();
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return new Set();
  return new Set(parsed.filter((item): item is string => typeof item === "string" && item.length > 0));
}

function tryReadStoredIds(storage: ReadingProgressStorageLike | null): Set<string> | null {
  if (!storage) return null;
  try {
    return parseStoredRaw(storage.getItem(READING_PROGRESS_STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStoredIds(storage: ReadingProgressStorageLike | null, ids: ReadonlySet<string>): boolean {
  if (!storage) return false;
  try {
    storage.setItem(READING_PROGRESS_STORAGE_KEY, JSON.stringify([...ids].sort()));
    return true;
  } catch {
    // 兼容无存储或配额受限环境，保留内存态不抛错
    return false;
  }
}

/** 将已读 ID 集合经 resolveCanonicalPageId 归一到当前快照规范页面 ID，过滤未知与跳过页并消除旧 ID 重复计数 */
export function normalizeReadPageIds(
  rawReadIds: Iterable<string>,
  pages: readonly Pick<RegistryEntry, "id" | "legacyIds">[],
  skippedIds?: ReadonlySet<string>,
): ReadonlySet<string> {
  const canonical = new Set<string>();
  for (const rawId of rawReadIds) {
    const resolved = resolveCanonicalPageId(pages, rawId, skippedIds);
    if (resolved) canonical.add(resolved);
  }
  return canonical;
}

/** Core-26 进度统计：先归一为 canonical 页面 ID，再与 CORE_26_SET 求交集 */
export function computeCore26Progress(
  rawReadIds: Iterable<string>,
  pages: readonly Pick<RegistryEntry, "id" | "legacyIds">[],
  skippedIds?: ReadonlySet<string>,
): Core26Progress {
  const canonicalReadIds = normalizeReadPageIds(rawReadIds, pages, skippedIds);
  const completedCoreIds = new Set<string>();
  for (const id of canonicalReadIds) {
    if (CORE_26_SET.has(id)) completedCoreIds.add(id);
  }
  return {
    canonicalReadIds,
    completedCoreIds,
    completed: completedCoreIds.size,
    total: CORE_26_SET.size,
  };
}

export interface ReadingProgressStore {
  readonly getSnapshot: () => ReadonlySet<string>;
  readonly subscribe: (listener: () => void) => () => void;
  readonly isRead: (
    rawId: string,
    pages?: readonly Pick<RegistryEntry, "id" | "legacyIds">[],
    skippedIds?: ReadonlySet<string>,
  ) => boolean;
  readonly markRead: (
    rawId: string,
    pages?: readonly Pick<RegistryEntry, "id" | "legacyIds">[],
    skippedIds?: ReadonlySet<string>,
  ) => void;
  readonly markUnread: (
    rawId: string,
    pages?: readonly Pick<RegistryEntry, "id" | "legacyIds">[],
    skippedIds?: ReadonlySet<string>,
  ) => void;
  readonly toggleRead: (
    rawId: string,
    pages?: readonly Pick<RegistryEntry, "id" | "legacyIds">[],
    skippedIds?: ReadonlySet<string>,
  ) => boolean;
  readonly reload: () => void;
}

export function createReadingProgressStore(
  getStorage: () => ReadingProgressStorageLike | null = defaultStorage,
): ReadingProgressStore {
  const initialStored = tryReadStoredIds(getStorage());
  let memoryFallback = initialStored === null;
  let snapshot: ReadonlySet<string> = initialStored ?? new Set();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const readAuthoritativeBase = (): ReadonlySet<string> => {
    if (memoryFallback) return snapshot;
    const latest = tryReadStoredIds(getStorage());
    if (latest === null) {
      memoryFallback = true;
      return snapshot;
    }
    return latest;
  };
  const resolveTarget = (
    rawId: string,
    pages?: readonly Pick<RegistryEntry, "id" | "legacyIds">[],
    skippedIds?: ReadonlySet<string>,
  ): { canonicalId: string; aliasesToClear: readonly string[] } | null => {
    const trimmed = rawId.trim();
    if (!trimmed) return null;
    if (!pages) return { canonicalId: trimmed, aliasesToClear: [] };
    const canonicalId = resolveCanonicalPageId(pages, trimmed, skippedIds);
    if (!canonicalId) return null;
    const entry = pages.find((p) => p.id === canonicalId);
    return { canonicalId, aliasesToClear: entry?.legacyIds ?? [] };
  };
  const isRead: ReadingProgressStore["isRead"] = (rawId, pages, skippedIds) => {
    const target = resolveTarget(rawId, pages, skippedIds);
    if (!target) return false;
    const current = readAuthoritativeBase();
    if (current.has(target.canonicalId)) return true;
    return target.aliasesToClear.some((legacyId) => current.has(legacyId));
  };
  const setsEqual = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean => {
    if (a.size !== b.size) return false;
    for (const id of a) {
      if (!b.has(id)) return false;
    }
    return true;
  };
  const commitNext = (next: Set<string>) => {
    const prevSnapshot = snapshot;
    snapshot = next;
    const persisted = writeStoredIds(getStorage(), snapshot);
    memoryFallback = !persisted;
    if (!setsEqual(prevSnapshot, snapshot)) notify();
  };
  const markRead: ReadingProgressStore["markRead"] = (rawId, pages, skippedIds) => {
    const target = resolveTarget(rawId, pages, skippedIds);
    if (!target) return;
    const base = readAuthoritativeBase();
    const next = pages ? new Set(normalizeReadPageIds(base, pages, skippedIds)) : new Set(base);
    for (const legacyId of target.aliasesToClear) next.delete(legacyId);
    next.add(target.canonicalId);
    if (setsEqual(base, next) && setsEqual(snapshot, next)) return;
    commitNext(next);
  };
  const markUnread: ReadingProgressStore["markUnread"] = (rawId, pages, skippedIds) => {
    const target = resolveTarget(rawId, pages, skippedIds);
    if (!target) return;
    const base = readAuthoritativeBase();
    const next = pages ? new Set(normalizeReadPageIds(base, pages, skippedIds)) : new Set(base);
    next.delete(target.canonicalId);
    for (const legacyId of target.aliasesToClear) next.delete(legacyId);
    if (setsEqual(base, next) && setsEqual(snapshot, next)) return;
    commitNext(next);
  };
  const toggleRead: ReadingProgressStore["toggleRead"] = (rawId, pages, skippedIds) => {
    if (isRead(rawId, pages, skippedIds)) {
      markUnread(rawId, pages, skippedIds);
      return false;
    }
    markRead(rawId, pages, skippedIds);
    return true;
  };
  const reload = () => {
    const latest = tryReadStoredIds(getStorage());
    if (latest === null) {
      memoryFallback = true;
      return;
    }
    memoryFallback = false;
    if (!setsEqual(snapshot, latest)) {
      snapshot = latest;
      notify();
    }
  };
  let removeWindowStorageListener: (() => void) | null = null;
  const ensureWindowStorageSync = () => {
    if (removeWindowStorageListener || getStorage !== defaultStorage) return;
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === READING_PROGRESS_STORAGE_KEY) reload();
    };
    window.addEventListener("storage", onStorage);
    removeWindowStorageListener = () => {
      window.removeEventListener("storage", onStorage);
      removeWindowStorageListener = null;
    };
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      const wasEmpty = listeners.size === 0;
      listeners.add(listener);
      ensureWindowStorageSync();
      if (wasEmpty) {
        const latest = tryReadStoredIds(getStorage());
        if (latest === null) {
          memoryFallback = true;
        } else {
          memoryFallback = false;
          if (!setsEqual(snapshot, latest)) {
            snapshot = latest;
          }
        }
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && removeWindowStorageListener) {
          removeWindowStorageListener();
        }
      };
    },
    isRead,
    markRead,
    markUnread,
    toggleRead,
    reload,
  };
}

export const readingProgressStore = createReadingProgressStore();
export const subscribeReadingProgress = readingProgressStore.subscribe;
export const getReadIdsSnapshot = readingProgressStore.getSnapshot;
export const markPageRead = readingProgressStore.markRead;
export const markPageUnread = readingProgressStore.markUnread;
export const togglePageRead = readingProgressStore.toggleRead;

export function useReadingProgress(): ReadonlySet<string> {
  return useSyncExternalStore(subscribeReadingProgress, getReadIdsSnapshot, getReadIdsSnapshot);
}
