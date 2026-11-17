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
} from "react";
import { getReaderState, refreshReaderSnapshot } from "../../content/wiki/index";
import { requestReaderSnapshot } from "./api";
import { type ChatState, useChat } from "./ChatDrawer";
import type { EvidenceViewController } from "./EvidencePane";
import type { WikiPanelTab } from "./WikiPanel";

export interface OpenChatOptions {
  prompt?: string | undefined;
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
  snapshotError: string;
  setSnapshotError: (message: string) => void;
  refresh: (signal?: AbortSignal) => Promise<boolean>;
  openChat: (options?: OpenChatOptions) => void;
  openEvidence: (trigger?: HTMLElement | null) => void;
  registerWikiHost: (host: WikiHostRegistration | null) => () => void;
  wikiHost: WikiHostRegistration | null;
  chat: ChatState;
  evidenceOpenSeq: number;
  panelCommand: { seq: number; tab: WikiPanelTab } | undefined;
  lastTriggerRef: RefObject<HTMLElement | null>;
}

const SNAPSHOT_ERROR_MSG = "未能更新，仍显示以上版本。连接问答服务后可重试刷新。";

const WikiAssistantContext = createContext<WikiAssistantContextValue | null>(null);

export function WikiAssistantProvider({
  active = true,
  children,
}: {
  active?: boolean | undefined;
  children: ReactNode;
}) {
  const chat = useChat();
  const [panel, setPanel] = useState<"closed" | WikiPanelTab>("closed");
  const [snapshotError, setSnapshotError] = useState("");
  const [evidenceOpenSeq, setEvidenceOpenSeq] = useState(0);
  const [panelCommand, setPanelCommand] = useState<{ seq: number; tab: WikiPanelTab } | undefined>();
  const [wikiHost, setWikiHost] = useState<WikiHostRegistration | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const commandSeqRef = useRef(0);
  const chatRef = useRef(chat);
  chatRef.current = chat;

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const updated = await refreshReaderSnapshot(
        () => requestReaderSnapshot(getReaderState().revision),
        signal,
      );
      if (updated) setSnapshotError("");
      return updated;
    } catch (error) {
      if (!signal?.aborted) setSnapshotError(SNAPSHOT_ERROR_MSG);
      throw error;
    }
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

  const openChat = useCallback((options?: OpenChatOptions) => {
    if (options?.trigger !== undefined) {
      lastTriggerRef.current = options.trigger ?? null;
    }
    commandSeqRef.current += 1;
    setPanelCommand({ seq: commandSeqRef.current, tab: "chat" });
    if (options?.prompt) {
      if (options.submit) {
        void chatRef.current.send(options.prompt);
      } else {
        chatRef.current.setInput(options.prompt);
      }
    }
  }, []);

  const openEvidence = useCallback((trigger?: HTMLElement | null) => {
    if (trigger !== undefined) {
      lastTriggerRef.current = trigger ?? null;
    }
    setEvidenceOpenSeq((n) => n + 1);
  }, []);

  const registerWikiHost = useCallback((host: WikiHostRegistration | null) => {
    setWikiHost(host);
    return () => {
      setWikiHost((prev) => (prev === host ? null : prev));
    };
  }, []);

  const value = useMemo<WikiAssistantContextValue>(
    () => ({
      panel,
      setPanel,
      snapshotError,
      setSnapshotError,
      refresh,
      openChat,
      openEvidence,
      registerWikiHost,
      wikiHost,
      chat,
      evidenceOpenSeq,
      panelCommand,
      lastTriggerRef,
    }),
    [
      panel,
      snapshotError,
      refresh,
      openChat,
      openEvidence,
      registerWikiHost,
      wikiHost,
      chat,
      evidenceOpenSeq,
      panelCommand,
    ],
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
