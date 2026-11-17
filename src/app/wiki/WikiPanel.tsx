import { MessageSquare, RefreshCw, X } from "lucide-react";
import { type KeyboardEvent, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { createEvidenceViewController } from "../../content/wiki/evidence-schema";
import { wikiRequest } from "./api";
import { ChatPane, type ChatState, useChat } from "./ChatDrawer";
import { DropPane } from "./DropPane";
import { EvidencePane, type EvidenceViewController } from "./EvidencePane";
import { ReaderResizeHandle } from "./ReaderResizeHandle";
import { ReviewPane, type ReviewSummary } from "./ReviewPane";
import { StatusPane } from "./StatusPane";
import { tabIndexAfterKey } from "./tablist";

export type WikiPanelTab = "chat" | "evidence" | "drop" | "review" | "status";
const TABS: { id: WikiPanelTab; label: string }[] = [
  { id: "chat", label: "问答" },
  { id: "evidence", label: "证据" },
  { id: "drop", label: "Drop" },
  { id: "review", label: "审阅" },
  { id: "status", label: "状态" },
];
const tabIdOf = (tab: WikiPanelTab) => `wiki-panel-tab-${tab}`;
const panelIdOf = (tab: WikiPanelTab) => `wiki-panel-${tab}`;

export function shouldStopChatOnPanelClose(tab: WikiPanelTab): boolean {
  return tab === "chat";
}

/**
 * 知识库的全部操作收在一个侧栏里：问答、审阅、刷新，外加一页只读的运行状态。
 * 两个页签常驻渲染、只切显隐——对话记录、滚动位置和读到一半的 diff 都不因切换而丢。
 */
export interface WikiPanelProps {
  revision: string;
  mode: "build" | "local";
  currentId?: string | undefined;
  chat?: ChatState | undefined;
  evidenceController?: EvidenceViewController | undefined;
  evidenceOpenSeq?: number | undefined;
  panelCommand?: { seq: number; tab: WikiPanelTab } | undefined;
  lastTriggerRef?: RefObject<HTMLElement | null> | undefined;
  /** 返回 true 表示读者快照已更新到最新发布版本 */
  onRefresh: () => Promise<boolean>;
  /** 外层要知道面板开没开、在哪个页签（浮层开着时「本页目录」按钮要挪到它左边） */
  onLayout: (layout: "closed" | WikiPanelTab) => void;
}

export function WikiPanel(props: WikiPanelProps) {
  if (props.chat) {
    return <WikiPanelView {...props} chat={props.chat} />;
  }
  return <WikiPanelStandalone {...props} />;
}

function WikiPanelStandalone(props: WikiPanelProps) {
  const chat = useChat();
  return <WikiPanelView {...props} chat={chat} />;
}

function WikiPanelView({
  revision,
  mode,
  currentId,
  chat,
  evidenceController,
  evidenceOpenSeq,
  panelCommand,
  lastTriggerRef,
  onRefresh,
  onLayout,
}: Omit<WikiPanelProps, "chat"> & { chat: ChatState }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<WikiPanelTab>("chat");
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [listError, setListError] = useState("");
  const [selected, setSelected] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const [fallbackEvidence] = useState(() =>
    createEvidenceViewController({
      loadPageEvidence: () => Promise.reject(new Error("当前环境未接入证据读取入口。")),
    }),
  );
  const activeEvidence = evidenceController ?? fallbackEvidence;
  const tabRefs = useRef<Partial<Record<WikiPanelTab, HTMLButtonElement | null>>>({});
  const fabRef = useRef<HTMLButtonElement>(null);
  const currentTab = useRef(tab);
  currentTab.current = tab;
  const wasOpen = useRef(open);
  const seenEvidenceSeq = useRef(0);
  const seenCommandSeq = useRef(0);

  const loadReviews = useCallback(async () => {
    try {
      setReviews((await wikiRequest<{ reviews: ReviewSummary[] }>("reviews")).reviews);
      setListError("");
    } catch (e) {
      setListError((e as Error).message);
    }
  }, []);

  // 待审数要挂在入口上，所以面板没打开也要先取一次
  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);
  useEffect(() => {
    if (open && tab === "review") void loadReviews();
  }, [open, tab, loadReviews]);
  useEffect(() => {
    if (!evidenceOpenSeq || evidenceOpenSeq === seenEvidenceSeq.current) return;
    seenEvidenceSeq.current = evidenceOpenSeq;
    setTab("evidence");
    setOpen(true);
  }, [evidenceOpenSeq]);
  useEffect(() => {
    if (!panelCommand || panelCommand.seq === seenCommandSeq.current) return;
    seenCommandSeq.current = panelCommand.seq;
    setTab(panelCommand.tab);
    setOpen(true);
  }, [panelCommand]);
  useEffect(() => {
    onLayout(!open ? "closed" : tab);
  }, [open, tab, onLayout]);
  // 打开时焦点到当前页签，关上时优先回到触发来源，否则回到「问知识库」按钮；首次渲染不抢焦点
  useEffect(() => {
    if (open === wasOpen.current) return;
    wasOpen.current = open;
    if (open) {
      tabRefs.current[currentTab.current]?.focus({ preventScroll: true });
      return;
    }
    const trigger = lastTriggerRef?.current;
    if (trigger?.isConnected) {
      lastTriggerRef!.current = null;
      trigger.focus({ preventScroll: true });
    } else {
      fabRef.current?.focus({ preventScroll: true });
    }
  }, [open, lastTriggerRef]);

  const pending = reviews.filter((r) => r.state === "pending" || r.state === "publishing").length;

  const openReview = useCallback(
    (id: string) => {
      void loadReviews();
      setSelected(id);
      setTab("review");
      setOpen(true);
    },
    [loadReviews],
  );

  function onTabKey(e: KeyboardEvent) {
    const index = tabIndexAfterKey(
      e.key,
      TABS.findIndex((t) => t.id === tab),
      TABS.length,
    );
    const next = index === undefined ? undefined : TABS[index];
    if (!next) return;
    e.preventDefault();
    setTab(next.id);
    tabRefs.current[next.id]?.focus();
  }

  if (!open) {
    return (
      <button
        ref={fabRef}
        type="button"
        className="wiki-chat-fab"
        data-testid="chat-open"
        title="问知识库"
        onClick={() => setOpen(true)}
      >
        {/* 桌面上缩成图标时字只给读屏（wiki.css 的按钮道），按钮的名字始终是「问知识库」 */}
        <MessageSquare size={14} /> <span className="wiki-fab-label">问知识库</span>
        {pending > 0 && (
          <span className="wiki-panel-badge" title={`${pending} 份变更待审`}>
            {pending}
          </span>
        )}
      </button>
    );
  }

  return (
    <aside className={`wiki-panel is-${tab}`} data-testid="chat-drawer" aria-label="知识库助手">
      <ReaderResizeHandle side="assistant" />
      <header className="wiki-panel-head">
        <div className="wiki-panel-tabs" role="tablist" aria-label="知识库助手" onKeyDown={onTabKey}>
          {TABS.map((t) => (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={tabIdOf(t.id)}
              aria-controls={panelIdOf(t.id)}
              aria-selected={tab === t.id}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === "review" && pending > 0 && <span className="wiki-panel-badge">{pending}</span>}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="wiki-panel-icon"
          aria-label="关闭"
          data-testid="chat-close"
          onClick={() => {
            if (shouldStopChatOnPanelClose(tab)) chat.stop();
            if (tab === "evidence") activeEvidence.close();
            setOpen(false);
          }}
        >
          <X size={15} />
        </button>
      </header>

      <div className="wiki-panel-status">
        <span title={revision}>
          {mode === "build" ? "构建版本" : "知识版本"} <code>{revision.slice(0, 12)}</code>
        </span>
        <button
          type="button"
          disabled={refreshing}
          onClick={() => {
            setRefreshing(true);
            void onRefresh()
              .catch(() => false)
              .finally(() => setRefreshing(false));
            void loadReviews();
          }}
        >
          <RefreshCw size={12} className={refreshing ? "is-spinning" : undefined} />
          刷新知识库
        </button>
      </div>

      <ChatPane
        id={panelIdOf("chat")}
        chat={chat}
        currentId={currentId}
        hidden={tab !== "chat"}
        onReview={openReview}
      />
      <EvidencePane id={panelIdOf("evidence")} hidden={tab !== "evidence"} controller={activeEvidence} />
      <DropPane id={panelIdOf("drop")} hidden={tab !== "drop"} onReview={openReview} />
      <ReviewPane
        id={panelIdOf("review")}
        hidden={tab !== "review"}
        reviews={reviews}
        listError={listError}
        selected={selected}
        onSelect={setSelected}
        onChanged={(r) => setReviews((items) => items.map((x) => (x.id === r.id ? { ...x, ...r } : x)))}
        onPublished={async () => {
          // false means a newer refresh superseded this one; actual read failures reject.
          // Reload the list too: a batch publishes its parent receipt as well as its children.
          await Promise.all([onRefresh(), loadReviews()]);
        }}
      />
      <StatusPane id={panelIdOf("status")} hidden={tab !== "status"} onOpenReview={() => setTab("review")} />
    </aside>
  );
}
