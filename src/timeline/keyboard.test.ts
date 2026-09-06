import { describe, expect, it, vi } from "vitest";
import { handlePlaybackKey, isEditableTarget, type KeyLike } from "./keyboard";
import type { PlaybackActions } from "./store";

function actions(): PlaybackActions & { calls: string[] } {
  const calls: string[] = [];
  const rec = (name: string) => () => {
    calls.push(name);
  };
  return {
    calls,
    setLoading: rec("setLoading"),
    setError: rec("setError"),
    load: rec("load"),
    unload: rec("unload"),
    play: rec("play"),
    pause: rec("pause"),
    toggle: rec("toggle"),
    next: rec("next"),
    prev: rec("prev"),
    first: rec("first"),
    last: rec("last"),
    seek: () => true,
    setSpeed: rec("setSpeed"),
    stepSpeed: (d) => {
      calls.push(`stepSpeed:${d}`);
    },
    setLayer: rec("setLayer"),
    setReducedMotion: rec("setReducedMotion"),
    setNofx: rec("setNofx"),
    setCameraOverride: rec("setCameraOverride"),
    resetCamera: rec("resetCamera"),
  };
}

function key(k: string, over: Partial<KeyLike> = {}): KeyLike & { preventDefault: ReturnType<typeof vi.fn> } {
  return {
    key: k,
    target: null,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    preventDefault: vi.fn(),
    ...over,
  } as KeyLike & { preventDefault: ReturnType<typeof vi.fn> };
}

describe("快捷键", () => {
  it("映射：Space/←/→/Home/End/Esc/[ ]", () => {
    const a = actions();
    const keys = [" ", "ArrowRight", "ArrowLeft", "Home", "End", "Escape", "]", "["];
    for (const k of keys) {
      const e = key(k);
      expect(handlePlaybackKey(e, a)).toBe(true);
      expect(e.preventDefault).toHaveBeenCalledOnce();
    }
    expect(a.calls).toEqual([
      "toggle",
      "next",
      "prev",
      "first",
      "last",
      "resetCamera",
      "stepSpeed:1",
      "stepSpeed:-1",
    ]);
  });
  it("未绑定的键、组合键不处理，也不 preventDefault", () => {
    const a = actions();
    for (const e of [
      key("a"),
      key(" ", { ctrlKey: true }),
      key("ArrowRight", { metaKey: true }),
      key("[", { altKey: true }),
    ]) {
      expect(handlePlaybackKey(e, a)).toBe(false);
      expect(e.preventDefault).not.toHaveBeenCalled();
    }
    expect(a.calls).toEqual([]);
  });
  it("输入控件与 contenteditable 聚焦时忽略", () => {
    const a = actions();
    const input = { tagName: "INPUT" } as unknown as EventTarget;
    const editable = { tagName: "DIV", isContentEditable: true } as unknown as EventTarget;
    const div = { tagName: "DIV", isContentEditable: false } as unknown as EventTarget;
    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(editable)).toBe(true);
    expect(isEditableTarget(div)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
    expect(handlePlaybackKey(key(" ", { target: input }), a)).toBe(false);
    expect(handlePlaybackKey(key(" ", { target: editable }), a)).toBe(false);
    expect(handlePlaybackKey(key(" ", { target: div }), a)).toBe(true);
    expect(a.calls).toEqual(["toggle"]);
  });
});
