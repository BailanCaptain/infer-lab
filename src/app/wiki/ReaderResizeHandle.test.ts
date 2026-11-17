import { describe, expect, it } from "vitest";
import { createResizeSession, type StorageLike } from "./ReaderResizeHandle";

function createFakeColumnEnv(opts: {
  side: "directory" | "assistant";
  initialWidth: number;
  min: number;
  max: number;
}) {
  const writes: Array<{ k: string; v: string }> = [];
  const store = new Map<string, string>();
  let throwsOnStorage = false;
  let width = opts.initialWidth;
  let resizing = false;

  const storage: StorageLike = {
    getItem(k) {
      if (throwsOnStorage) throw new Error("storage unavailable");
      return store.get(k) ?? null;
    },
    setItem(k, v) {
      writes.push({ k, v });
      if (throwsOnStorage) throw new Error("storage unavailable");
      store.set(k, v);
    },
    removeItem(k) {
      if (throwsOnStorage) throw new Error("storage unavailable");
      store.delete(k);
    },
  };

  const session = createResizeSession({
    side: opts.side,
    storageKey: `infra-reader-${opts.side}-width`,
    getStorage: () => storage,
    applyCandidateWidth(requested) {
      width = Math.round(Math.min(opts.max, Math.max(opts.min, requested)));
      return width;
    },
    resetStyleWidth() {
      width = opts.initialWidth;
    },
    setResizingClass(active) {
      resizing = active;
    },
  });

  return {
    session,
    writes,
    store,
    getWidth: () => width,
    isResizing: () => resizing,
    setThrows: (value: boolean) => {
      throwsOnStorage = value;
    },
  };
}

describe("ReaderResizeHandle 宽度调整持久化状态机", () => {
  it("左右两侧无关按键、原地点击或触边未改变宽度时绝不写 localStorage", () => {
    for (const cfg of [
      { side: "directory" as const, initialWidth: 240, min: 180, max: 420 },
      { side: "assistant" as const, initialWidth: 547, min: 320, max: 1100 },
    ]) {
      const env = createFakeColumnEnv(cfg);
      for (const k of ["a", "Shift", "Tab", "Enter", "Escape", "ArrowUp", "ArrowDown"]) {
        expect(env.session.keyDown(k, env.getWidth())).toBe(false);
        env.session.keyUp(k);
      }
      env.session.blur();
      // 原地按下抬起（包括双击前的两次点击）无位移 -> 不写偏好
      expect(env.session.pointerDown(0, 300, env.getWidth())).toBe(true);
      env.session.pointerFinish();
      // 非主键点击忽略
      expect(env.session.pointerDown(2, 300, env.getWidth())).toBe(false);
      expect(env.writes).toEqual([]);

      // 已达最小边界继续向小方向按方向键：宽度未发生有效变化 -> 不写偏好
      const clampEnv = createFakeColumnEnv({ ...cfg, initialWidth: cfg.min });
      const shrinkKey = cfg.side === "directory" ? "ArrowLeft" : "ArrowRight";
      expect(clampEnv.session.keyDown(shrinkKey, clampEnv.getWidth())).toBe(true);
      clampEnv.session.keyUp(shrinkKey);
      expect(clampEnv.writes).toEqual([]);
    }
  });

  it("方向键微调（含 keyup 收口与中途 blur 离焦收口）、指针拖拽保存真实测量宽度，双击复位清偏好，存储异常时仍正常操作", () => {
    const dir = createFakeColumnEnv({ side: "directory", initialWidth: 240, min: 180, max: 420 });
    expect(dir.session.keyDown("ArrowRight", dir.getWidth())).toBe(true);
    expect(dir.getWidth()).toBe(256);
    dir.session.keyUp("ArrowRight");
    expect(dir.store.get("infra-reader-directory-width")).toBe("256");
    expect(dir.writes).toEqual([{ k: "infra-reader-directory-width", v: "256" }]);

    // 连续两次微调后直接 Tab 离焦（blur 先于 ArrowRight keyup）：不丢最终宽度且不重复写第二次
    dir.writes.length = 0;
    dir.session.keyDown("ArrowRight", dir.getWidth());
    dir.session.keyDown("ArrowRight", dir.getWidth());
    expect(dir.getWidth()).toBe(288);
    dir.session.blur();
    dir.session.keyUp("ArrowRight");
    expect(dir.writes).toEqual([{ k: "infra-reader-directory-width", v: "288" }]);

    // 右栏 assistant 反向增量（ArrowLeft 变宽、向左拖拽变宽）及双击复位与存储异常降级
    const asst = createFakeColumnEnv({ side: "assistant", initialWidth: 547, min: 320, max: 1100 });
    asst.session.keyDown("ArrowLeft", asst.getWidth());
    asst.session.keyUp("ArrowLeft");
    expect(asst.getWidth()).toBe(563);
    expect(asst.store.get("infra-reader-assistant-width")).toBe("563");

    asst.session.pointerDown(0, 800, asst.getWidth());
    expect(asst.isResizing()).toBe(true);
    asst.session.pointerMove(768);
    asst.session.pointerFinish();
    expect(asst.isResizing()).toBe(false);
    expect(asst.getWidth()).toBe(595);
    expect(asst.store.get("infra-reader-assistant-width")).toBe("595");

    asst.session.doubleClick();
    expect(asst.getWidth()).toBe(547);
    expect(asst.store.has("infra-reader-assistant-width")).toBe(false);

    // 存储抛异常时仍可微调与双击复位
    asst.setThrows(true);
    expect(() => {
      asst.session.keyDown("ArrowLeft", asst.getWidth());
      asst.session.keyUp("ArrowLeft");
    }).not.toThrow();
    expect(asst.getWidth()).toBe(563);
    expect(() => asst.session.doubleClick()).not.toThrow();
    expect(asst.getWidth()).toBe(547);
  });
});
