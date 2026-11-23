import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { getReaderState, refreshReaderSnapshot } from "../../content/wiki/index";
import {
  type BackendAvailability,
  getBackendAvailability,
  isStaticOfflineError,
  requestReaderSnapshot,
  subscribeBackendAvailability,
} from "./api";
import { type ChatState, type PendingChatAttachment, useChat } from "./chat-controller";
import type { EvidenceViewController } from "./EvidencePane";
import type { WikiPanelTab } from "./WikiPanel";

export interface OpenChatOptions {
  prompt?: string | undefined;
  pendingAttachment?: PendingChatAttachment | undefined;
  submit?: boolean | undefined;
  trigger?: HTMLElement | null | undefined;
}

export interface WikiHostRegistration {
  currentId?: string | undefined;
  evidenceController?: EvidenceViewController | undefined;
  onQuickSearchNavigate?: (() => void) | undefined;
}

export interface WikiAssistantContextValue {
  panel: "closed" | WikiPanelTab;
  setPanel: (panel: "closed" | WikiPanelTab) => void;
  backendAvailable: BackendAvailability;
  snapshotError: string;
  setSnapshotError: (message: string) => void;
  refresh: (signal?: AbortSignal) => Promise<boolean>;
  openChat: (options?: OpenChatOptions) => void;
  openEvidence: (trigger?: HTMLElement | null) => void;
  registerWikiHost: (host: WikiHostRegistration | null) => () => void;
  wikiHost: WikiHostRegistration | null;
  chat: ChatState;
  lastTriggerRef: RefObject<HTMLElement | null>;
}

const SNAPSHOT_ERROR_MSG = "未能更新，仍显示以上版本。连接问答服务后可重试刷新。";
const getServerBackendAvailability = (): BackendAvailability => "unknown";

const WikiAssistantContext = createContext<WikiAssistantContextValue | null>(null);

export interface WikiAssistantControllerState {
  panel: "closed" | WikiPanelTab;
}

export function createWikiAssistantController(deps: {
  active?: boolean | undefined;
  getChat: () => Pick<ChatState, "busy" | "send" | "setInput" | "setPendingAttachment">;
  lastTriggerRef?: RefObject<HTMLElement | null> | undefined;
}) {
  let active = deps.active ?? true;
  let state: WikiAssistantControllerState = { panel: "closed" };
  const listeners = new Set<() => void>();
  const lastTriggerRef: RefObject<HTMLElement | null> = deps.lastTriggerRef ?? { current: null };

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const setPanel = (nextPanel: "closed" | WikiPanelTab) => {
    const resolved = active ? nextPanel : "closed";
    if (state.panel === resolved) return;
    state = { panel: resolved };
    notify();
  };

  const setActive = (nextActive: boolean) => {
    active = nextActive;
    if (!active && state.panel !== "closed") {
      state = { panel: "closed" };
      notify();
    }
  };

  const openChat = (options?: OpenChatOptions) => {
    if (options?.trigger !== undefined) {
      lastTriggerRef.current = options.trigger ?? null;
    }
    if (active) setPanel("chat");
    const chat = deps.getChat();
    if (options?.pendingAttachment && chat.setPendingAttachment) {
      chat.setPendingAttachment(options.pendingAttachment);
      if (options.submit && !chat.busy) {
        void chat.send();
      }
      return;
    }
    if (options?.prompt) {
      if (options.submit && !chat.busy) {
        void chat.send(options.prompt);
      } else {
        chat.setInput(options.prompt);
      }
    }
  };

  const openEvidence = (trigger?: HTMLElement | null) => {
    if (trigger !== undefined) {
      lastTriggerRef.current = trigger ?? null;
    }
    if (active) setPanel("evidence");
  };

  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setActive,
    setPanel,
    openChat,
    openEvidence,
    lastTriggerRef,
  };
}

export async function runAssistantSnapshotRefresh(
  signal?: AbortSignal,
  onSnapshotError: (message: string) => void = () => {},
): Promise<boolean> {
  try {
    const updated = await refreshReaderSnapshot(
      () => requestReaderSnapshot(getReaderState().revision),
      signal,
    );
    if (updated) onSnapshotError("");
    return updated;
  } catch (error) {
    if (isStaticOfflineError(error)) {
      if (!signal?.aborted) onSnapshotError("");
      return false;
    }
    if (!signal?.aborted) onSnapshotError(SNAPSHOT_ERROR_MSG);
    throw error;
  }
}

export function WikiAssistantProvider({
  active = true,
  children,
}: {
  active?: boolean | undefined;
  children: ReactNode;
}) {
  const chat = useChat();
  const backendAvailable = useSyncExternalStore(
    subscribeBackendAvailability,
    getBackendAvailability,
    getServerBackendAvailability,
  );
  const [snapshotError, setSnapshotError] = useState("");
  const [wikiHost, setWikiHost] = useState<WikiHostRegistration | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const chatRef = useRef(chat);
  chatRef.current = chat;
  const [controller] = useState(() =>
    createWikiAssistantController({
      active,
      getChat: () => chatRef.current,
      lastTriggerRef,
    }),
  );
  const { panel } = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);

  useEffect(() => {
    controller.setActive(active);
  }, [active, controller]);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    return runAssistantSnapshotRefresh(signal, setSnapshotError);
  }, []);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    void refresh(controller.signal).catch(() => {});
    return () => controller.abort();
  }, [active, refresh]);

  useEffect(() => {
    if (!active) return;
    const onChanged = () => void refresh().catch(() => window.location.reload());
    import.meta.hot?.on("wiki:changed", onChanged);
    return () => import.meta.hot?.off("wiki:changed", onChanged);
  }, [active, refresh]);

  const registerWikiHost = useCallback((host: WikiHostRegistration | null) => {
    setWikiHost(host);
    return () => {
      setWikiHost((prev) => (prev === host ? null : prev));
    };
  }, []);

  const value = useMemo<WikiAssistantContextValue>(
    () => ({
      panel,
      setPanel: controller.setPanel,
      backendAvailable,
      snapshotError,
      setSnapshotError,
      refresh,
      openChat: controller.openChat,
      openEvidence: controller.openEvidence,
      registerWikiHost,
      wikiHost,
      chat,
      lastTriggerRef,
    }),
    [panel, controller, backendAvailable, snapshotError, refresh, registerWikiHost, wikiHost, chat],
  );

  return <WikiAssistantContext.Provider value={value}>{children}</WikiAssistantContext.Provider>;
}

export function useOptionalWikiAssistant(): WikiAssistantContextValue | null {
  return useContext(WikiAssistantContext);
}

export function useWikiAssistant(): WikiAssistantContextValue {
  const ctx = useContext(WikiAssistantContext);
  if (!ctx) throw new Error("useWikiAssistant 必须在 WikiAssistantProvider 内调用");
  return ctx;
}
