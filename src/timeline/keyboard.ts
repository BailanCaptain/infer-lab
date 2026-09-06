/**
 * 播放快捷键（自写，不引库）：Space 播/停、←/→ 步进、Home/End 首末、Esc 重置相机、[ ] 调速。
 * 输入框、textarea、select、contenteditable 聚焦时忽略；带 Ctrl/Meta/Alt 的组合键不拦截。
 */
import { type PlaybackActions, usePlayback } from "./store";

export interface KeyLike {
  key: string;
  target: EventTarget | null;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  preventDefault(): void;
}

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as { tagName?: string; isContentEditable?: boolean };
  if (el.tagName && EDITABLE_TAGS.has(el.tagName)) return true;
  return el.isContentEditable === true;
}

type NoArgAction = "toggle" | "next" | "prev" | "first" | "last" | "resetCamera";

export const KEY_BINDINGS: Record<string, NoArgAction | "speedUp" | "speedDown"> = {
  " ": "toggle",
  ArrowRight: "next",
  ArrowLeft: "prev",
  Home: "first",
  End: "last",
  Escape: "resetCamera",
  "]": "speedUp",
  "[": "speedDown",
};

/** 返回 true 表示已处理（并已 preventDefault）。 */
export function handlePlaybackKey(e: KeyLike, actions: PlaybackActions): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (isEditableTarget(e.target)) return false;
  const binding = KEY_BINDINGS[e.key];
  if (!binding) return false;
  e.preventDefault();
  if (binding === "speedUp") actions.stepSpeed(1);
  else if (binding === "speedDown") actions.stepSpeed(-1);
  else actions[binding]();
  return true;
}

/** 挂到 window 上，返回卸载函数。 */
export function installPlaybackKeys(
  target: Pick<Window, "addEventListener" | "removeEventListener"> = window,
) {
  const listener = (e: KeyboardEvent) => {
    handlePlaybackKey(e, usePlayback.getState());
  };
  target.addEventListener("keydown", listener);
  return () => target.removeEventListener("keydown", listener);
}
