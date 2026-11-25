import { describe, expect, it, vi } from "vitest";
import {
  createReadingProgressStore,
  READING_PROGRESS_STORAGE_KEY,
  type ReadingProgressStorageLike,
} from "./readingProgressStore";

function createMemoryStorage(initial?: Record<string, string>): {
  storage: ReadingProgressStorageLike;
  raw: Map<string, string>;
} {
  const raw = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    raw,
    storage: {
      getItem: (key) => raw.get(key) ?? null,
      setItem: (key, value) => {
        raw.set(key, value);
      },
      removeItem: (key) => {
        raw.delete(key);
      },
    },
  };
}

describe("readingProgressStore", () => {
  it("P3-5: 在无订阅期间 storage 被外部更新后，首个订阅者重新接入时立即同步最新存储", () => {
    const { storage, raw } = createMemoryStorage({
      [READING_PROGRESS_STORAGE_KEY]: JSON.stringify(["page-a"]),
    });
    const store = createReadingProgressStore(() => storage);

    expect([...store.getSnapshot()]).toEqual(["page-a"]);

    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    expect([...store.getSnapshot()]).toEqual(["page-a"]);

    // 取消最后一个订阅者后，监听器集合归零
    unsubscribe();

    // 在无订阅期间，外部标签页或其他写入方更新了底层 storage
    raw.set(READING_PROGRESS_STORAGE_KEY, JSON.stringify(["page-a", "page-b"]));

    // 重新接入首个订阅者（0 -> 1）时，立即从 storage 同步最新快照
    const listener2 = vi.fn();
    const unsubscribe2 = store.subscribe(listener2);
    expect([...store.getSnapshot()].sort()).toEqual(["page-a", "page-b"]);
    expect(listener2).not.toHaveBeenCalled();

    // 若无变化，重新订阅保持快照引用稳定
    unsubscribe2();
    const snapshotBefore = store.getSnapshot();
    const unsubscribe3 = store.subscribe(() => {});
    expect(store.getSnapshot()).toBe(snapshotBefore);
    unsubscribe3();
  });

  it("支持 markRead / markUnread / toggleRead 与 legacyIds 归一化", () => {
    const pages = [
      { id: "kv-cache", legacyIds: ["kv-old"] },
      { id: "paged-attention", legacyIds: [] },
    ];
    const { storage } = createMemoryStorage({
      [READING_PROGRESS_STORAGE_KEY]: JSON.stringify(["kv-old"]),
    });
    const store = createReadingProgressStore(() => storage);

    expect(store.isRead("kv-cache", pages)).toBe(true);
    expect(store.toggleRead("paged-attention", pages)).toBe(true);
    expect([...store.getSnapshot()].sort()).toEqual(["kv-cache", "paged-attention"]);

    store.markUnread("kv-cache", pages);
    expect([...store.getSnapshot()]).toEqual(["paged-attention"]);
    expect(store.isRead("kv-old", pages)).toBe(false);
  });

  it("storage 不可用时回退内存态，且重新订阅不丢失内存进度", () => {
    const store = createReadingProgressStore(() => null);
    store.markRead("page-mem");
    expect([...store.getSnapshot()]).toEqual(["page-mem"]);

    const unsubscribe = store.subscribe(() => {});
    expect([...store.getSnapshot()]).toEqual(["page-mem"]);
    unsubscribe();
  });
});
