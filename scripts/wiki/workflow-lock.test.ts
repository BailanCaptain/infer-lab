import * as fs from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { wikiFixture } from "./test-fixture";
import { WorkflowStore } from "./workflow";

vi.mock("node:fs", async (original) => {
  const actual = await original<typeof fs>();
  return { ...actual, openSync: vi.fn(actual.openSync) };
});
afterEach(() => {
  vi.mocked(fs.openSync).mockRestore();
  vi.restoreAllMocks();
});

it.each(["", '{"pid":'])(
  "waits for a new owner's incomplete record (%j) without taking its lock",
  async (record) => {
    const f = wikiFixture();
    try {
      const actual = await vi.importActual<typeof fs>("node:fs");
      const path = join(f.root, "tools/wiki-runtime/workflow.lock");
      f.write("tools/wiki-runtime/workflow.lock", record);
      let attempts = 0;
      vi.mocked(fs.openSync).mockImplementation((file, flags, mode) => {
        if (String(file) === path && flags === "wx") {
          attempts++;
          if (attempts === 52) {
            expect(actual.readFileSync(path, "utf8")).toBe(record);
            actual.writeFileSync(path, JSON.stringify({ pid: process.pid }));
          }
          if (attempts === 53) actual.rmSync(path);
        }
        return actual.openSync(file, flags, mode);
      });
      const callback = vi.fn(() => "acquired");
      await expect(new WorkflowStore(f.root).locked(callback)).resolves.toBe("acquired");
      expect(callback).toHaveBeenCalledTimes(1);
      expect(attempts).toBe(53);
      expect(fs.existsSync(path)).toBe(false);
    } finally {
      f.cleanup();
    }
  },
);

it.each(["", "malformed owner"])(
  "preserves an incomplete owner at the original deadline (%j)",
  async (record) => {
    const f = wikiFixture();
    try {
      const actual = await vi.importActual<typeof fs>("node:fs");
      const path = join(f.root, "tools/wiki-runtime/workflow.lock");
      f.write("tools/wiki-runtime/workflow.lock", record);
      let attempts = 0;
      const now = Date.now();
      vi.spyOn(Date, "now").mockImplementation(() => now + (attempts >= 52 ? 30_000 : 0));
      vi.mocked(fs.openSync).mockImplementation((file, flags, mode) => {
        if (String(file) === path && flags === "wx") attempts++;
        return actual.openSync(file, flags, mode);
      });
      const callback = vi.fn();
      await expect(new WorkflowStore(f.root).locked(callback)).rejects.toThrow("工作状态锁被占用");
      expect(callback).not.toHaveBeenCalled();
      expect(attempts).toBe(52);
      expect(actual.readFileSync(path, "utf8")).toBe(record);
    } finally {
      f.cleanup();
    }
  },
);

it.each([false, true])(
  "retries a normal release before owner-read without extending the deadline (expired=%s)",
  async (expired) => {
    const f = wikiFixture();
    try {
      const actual = await vi.importActual<typeof fs>("node:fs");
      const path = join(f.root, "tools/wiki-runtime/workflow.lock");
      f.write("tools/wiki-runtime/workflow.lock", JSON.stringify({ pid: process.pid }));
      let attempts = 0;
      let released = false;
      const now = Date.now();
      vi.spyOn(Date, "now").mockImplementation(() => now + (expired && released ? 30_000 : 0));
      vi.mocked(fs.openSync).mockImplementation((file, flags, mode) => {
        if (String(file) === path && flags === "wx" && ++attempts === 51) {
          actual.rmSync(path);
          released = true;
          throw Object.assign(new Error("Owner released after exclusive open"), { code: "EEXIST" });
        }
        return actual.openSync(file, flags, mode);
      });
      const callback = vi.fn(() => "acquired");
      const result = new WorkflowStore(f.root).locked(callback);
      if (expired) {
        await expect(result).rejects.toThrow("工作状态锁被占用");
        expect(callback).not.toHaveBeenCalled();
        expect(attempts).toBe(51);
      } else {
        await expect(result).resolves.toBe("acquired");
        expect(callback).toHaveBeenCalledTimes(1);
        expect(attempts).toBe(52);
      }
      expect(fs.existsSync(path)).toBe(false);
    } finally {
      f.cleanup();
    }
  },
);

it.runIf(process.platform === "win32")(
  "retries a transient Windows lock-open denial using exclusive creation",
  async () => {
    const f = wikiFixture();
    try {
      const actual = await vi.importActual<typeof fs>("node:fs");
      vi.mocked(fs.openSync)
        .mockImplementationOnce(() => {
          throw Object.assign(new Error("Windows lock transition"), { code: "EPERM" });
        })
        .mockImplementationOnce((path, flags, mode) => {
          expect(flags).toBe("wx");
          return actual.openSync(path, flags, mode);
        });
      expect(await new WorkflowStore(f.root).locked(() => "acquired")).toBe("acquired");
      expect(fs.existsSync(join(f.root, "tools/wiki-runtime/workflow.lock"))).toBe(false);
    } finally {
      f.cleanup();
    }
  },
);

it.runIf(process.platform === "win32")(
  "preserves an existing lock and reports persistent permission denial after bounded retries",
  async () => {
    const f = wikiFixture();
    try {
      const path = "tools/wiki-runtime/workflow.lock";
      f.write(path, "existing owner");
      vi.mocked(fs.openSync).mockImplementation(() => {
        throw Object.assign(new Error("persistent denial"), { code: "EPERM" });
      });
      await expect(new WorkflowStore(f.root).locked(() => "must not run")).rejects.toThrow(
        "persistent denial",
      );
      expect(fs.openSync).toHaveBeenCalledTimes(6);
      expect(fs.readFileSync(join(f.root, path), "utf8")).toBe("existing owner");
    } finally {
      f.cleanup();
    }
  },
);
