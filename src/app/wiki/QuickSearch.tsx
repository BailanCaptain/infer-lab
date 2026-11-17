import { Search } from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { retrieve } from "../../content/wiki/index";
import type { Hit, RetrieveOptions } from "../../content/wiki/retrieve";
import type { RegistryEntry } from "../../content/wiki/schema";

const TYPE_LABEL: Record<string, string> = {
  concept: "概念",
  feature: "特性",
  param: "参数",
  source: "来源",
  pr: "PR",
};

export type QuickSearchStatus = "idle" | "loading" | "ready" | "error";

export interface QuickSearchItem {
  id: string;
  title: string;
  type: string;
  typeLabel: string;
  summary: string;
  evidence: string;
  how: Hit["how"];
}

export interface QuickSearchState {
  open: boolean;
  query: string;
  status: QuickSearchStatus;
  items: QuickSearchItem[];
  selectedIndex: number;
  error: string;
}

export interface QuickSearchKeyInput {
  key: string;
  isComposing?: boolean;
  keyCode?: number;
  preventDefault: () => void;
}

export interface QuickSearchDeps {
  search: (query: string, opts?: RetrieveOptions) => Promise<Hit[]>;
  getPages: () => readonly Pick<RegistryEntry, "id" | "type">[];
  onNavigate: (id: string) => void;
  onRestoreFocus?: () => void;
  limit?: number;
}

export function isQuickSearchShortcut(event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}): boolean {
  return (
    (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k"
  );
}

const MODAL_TABBABLE_SELECTOR =
  'input:not([disabled]), button:not([disabled]):not([tabindex="-1"]), [href], [tabindex]:not([tabindex="-1"])';

export function getModalTabbableElements(container: ParentNode | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(MODAL_TABBABLE_SELECTOR));
}

export function nextModalFocusIndex(count: number, activeIndex: number, shiftKey: boolean): number {
  if (count <= 0) return -1;
  if (activeIndex < 0 || activeIndex >= count) {
    return shiftKey ? count - 1 : 0;
  }
  return shiftKey ? (activeIndex - 1 + count) % count : (activeIndex + 1) % count;
}

export interface ModalDialogKeyInput {
  key: string;
  shiftKey?: boolean;
  isComposing?: boolean;
  keyCode?: number;
  focusableCount: number;
  activeFocusIndex: number;
  preventDefault: () => void;
  focusAt: (index: number) => void;
  onClose: () => void;
}

export function handleModalDialogKeyDown(event: ModalDialogKeyInput): boolean {
  if (event.isComposing || event.keyCode === 229) return false;
  if (event.key === "Escape") {
    event.preventDefault();
    event.onClose();
    return true;
  }
  if (event.key === "Tab") {
    const nextIdx = nextModalFocusIndex(
      event.focusableCount,
      event.activeFocusIndex,
      Boolean(event.shiftKey),
    );
    if (nextIdx >= 0) {
      event.preventDefault();
      event.focusAt(nextIdx);
      return true;
    }
    return false;
  }
  return false;
}

export function createQuickSearchController(deps: QuickSearchDeps) {
  let state: QuickSearchState = {
    open: false,
    query: "",
    status: "idle",
    items: [],
    selectedIndex: 0,
    error: "",
  };
  let requestSeq = 0;
  const listeners = new Set<() => void>();
  const emit = (patch: Partial<QuickSearchState>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };

  const runQuery = async (rawQuery: string): Promise<void> => {
    const trimmed = rawQuery.trim();
    const seq = ++requestSeq;
    if (!trimmed) {
      emit({ query: rawQuery, status: "idle", items: [], selectedIndex: 0, error: "" });
      return;
    }
    emit({ query: rawQuery, status: "loading", items: [], selectedIndex: 0, error: "" });
    try {
      const hits = await deps.search(trimmed, { limit: deps.limit ?? 8 });
      if (seq !== requestSeq || !state.open) return;
      const typeById = new Map(deps.getPages().map((p) => [p.id, p.type]));
      const items: QuickSearchItem[] = hits.map((h) => {
        const type = typeById.get(h.id) ?? "concept";
        return {
          id: h.id,
          title: h.title,
          type,
          typeLabel: TYPE_LABEL[type] ?? type,
          summary: h.summary,
          evidence: h.evidence,
          how: h.how,
        };
      });
      emit({ status: "ready", items, selectedIndex: 0, error: "" });
    } catch (error) {
      if (seq !== requestSeq || !state.open) return;
      emit({
        status: "error",
        items: [],
        selectedIndex: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const openSearch = () => {
    requestSeq++;
    emit({ open: true, query: "", status: "idle", items: [], selectedIndex: 0, error: "" });
  };

  const closeSearch = ({ restoreFocus = true }: { restoreFocus?: boolean } = {}) => {
    if (!state.open) return;
    requestSeq++;
    emit({ open: false, status: "idle", items: [], selectedIndex: 0, error: "" });
    if (restoreFocus) deps.onRestoreFocus?.();
  };

  const pickItem = (index: number) => {
    if (!state.open || state.status !== "ready") return;
    const item = state.items[index];
    if (!item) return;
    closeSearch({ restoreFocus: false });
    deps.onNavigate(item.id);
  };

  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    openSearch,
    closeSearch,
    setQuery: (nextQuery: string) => runQuery(nextQuery),
    selectIndex: (index: number) => {
      if (state.status !== "ready") return;
      if (index >= 0 && index < state.items.length && index !== state.selectedIndex) {
        emit({ selectedIndex: index });
      }
    },
    pickItem,
    retry: () => runQuery(state.query),
    onSnapshotChanged: () => {
      if (state.open && state.query.trim()) void runQuery(state.query);
    },
    handleKeyDown: (event: QuickSearchKeyInput): boolean => {
      if (!state.open || event.isComposing || event.keyCode === 229) return false;
      if (event.key === "ArrowDown") {
        if (state.status !== "ready" || !state.items.length) return false;
        event.preventDefault();
        emit({ selectedIndex: (state.selectedIndex + 1) % state.items.length });
        return true;
      }
      if (event.key === "ArrowUp") {
        if (state.status !== "ready" || !state.items.length) return false;
        event.preventDefault();
        emit({ selectedIndex: (state.selectedIndex - 1 + state.items.length) % state.items.length });
        return true;
      }
      if (event.key === "Enter") {
        if (state.status === "error" && state.query.trim()) {
          event.preventDefault();
          void runQuery(state.query);
          return true;
        }
        if (state.status === "ready" && state.items.length > 0 && state.items[state.selectedIndex]) {
          event.preventDefault();
          pickItem(state.selectedIndex);
          return true;
        }
        return false;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeSearch({ restoreFocus: true });
        return true;
      }
      return false;
    },
  };
}

export interface QuickSearchDialogProps {
  state: QuickSearchState;
  dialogRef?: React.RefObject<HTMLDivElement | null>;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  listRef?: React.RefObject<HTMLDivElement | null>;
  onQueryChange: (query: string) => void;
  onSelectIndex: (index: number) => void;
  onPickItem: (index: number) => void;
  onRetry: () => void;
  onClose: () => void;
  onInputKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
}

export function QuickSearchDialog({
  state,
  dialogRef,
  inputRef,
  listRef,
  onQueryChange,
  onSelectIndex,
  onPickItem,
  onRetry,
  onClose,
  onInputKeyDown,
}: QuickSearchDialogProps) {
  const hasReadyItems = state.status === "ready" && state.items.length > 0;
  const activeOptionId =
    hasReadyItems && state.items[state.selectedIndex]
      ? `wiki-quick-search-option-${state.items[state.selectedIndex]!.id}`
      : undefined;

  return (
    <div className="wiki-quick-search-backdrop" data-testid="wiki-quick-search-backdrop">
      <button
        type="button"
        tabIndex={-1}
        className="wiki-quick-search-backdrop-scrim"
        data-testid="wiki-quick-search-scrim"
        aria-label="关闭全库快捷搜索"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        className="wiki-quick-search-dialog"
        data-testid="wiki-quick-search-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="全库快捷搜索"
        onKeyDown={(event) => {
          const native = event.nativeEvent;
          const controls = getModalTabbableElements(event.currentTarget);
          const active =
            typeof document !== "undefined" && document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
          handleModalDialogKeyDown({
            key: event.key,
            shiftKey: event.shiftKey,
            isComposing: native.isComposing,
            keyCode: native.keyCode,
            focusableCount: controls.length,
            activeFocusIndex: active ? controls.indexOf(active) : -1,
            preventDefault: () => event.preventDefault(),
            focusAt: (idx) => controls[idx]?.focus({ preventScroll: true }),
            onClose,
          });
        }}
      >
        <div className="wiki-quick-search-bar">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            className="wiki-quick-search-input"
            role="combobox"
            aria-expanded={hasReadyItems}
            aria-controls="wiki-quick-search-listbox"
            aria-activedescendant={activeOptionId}
            aria-autocomplete="list"
            aria-label="搜索知识库全文"
            data-testid="wiki-quick-search-input"
            placeholder="搜索概念、参数、CLI 开关或正文关键词…"
            value={state.query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={onInputKeyDown}
          />
          <button type="button" className="wiki-quick-search-esc" onClick={onClose} aria-label="关闭快捷搜索">
            Esc
          </button>
        </div>

        <div className="wiki-quick-search-body">
          {state.status === "idle" && (
            <p className="wiki-quick-search-hint">
              输入关键词检索全库标题、别名、摘要与正文（如{" "}
              <code className="wiki-quick-search-code">RoPE</code>、
              <code className="wiki-quick-search-code">W8A8</code>、
              <code className="wiki-quick-search-code">AllReduce</code>、
              <code className="wiki-quick-search-code">--enforce-eager</code>）。
            </p>
          )}

          {state.status === "loading" && (
            <p className="wiki-quick-search-hint" role="status">
              正在载入检索索引并匹配…
            </p>
          )}

          {state.status === "error" && (
            <div className="wiki-quick-search-error" role="alert">
              <p className="wiki-quick-search-error-msg">{state.error || "检索索引加载失败，请重试。"}</p>
              <button
                type="button"
                className="wiki-quick-search-retry-btn"
                data-testid="wiki-quick-search-retry"
                onClick={onRetry}
              >
                重试加载
              </button>
            </div>
          )}

          {state.status === "ready" && state.items.length === 0 && (
            <p className="wiki-quick-search-hint" role="status">
              {`未找到与「${state.query.trim()}」匹配的页面，可尝试缩写、参数名或相近术语。`}
            </p>
          )}

          {hasReadyItems && (
            <div
              ref={listRef}
              id="wiki-quick-search-listbox"
              className="wiki-quick-search-list"
              role="listbox"
              aria-label="搜索结果"
            >
              {state.items.map((item, idx) => {
                const selected = idx === state.selectedIndex;
                return (
                  <button
                    key={item.id}
                    id={`wiki-quick-search-option-${item.id}`}
                    type="button"
                    tabIndex={-1}
                    role="option"
                    aria-selected={selected}
                    data-testid="wiki-quick-search-item"
                    className={`wiki-quick-search-item${selected ? " is-selected" : ""}`}
                    onMouseEnter={() => onSelectIndex(idx)}
                    onClick={() => onPickItem(idx)}
                  >
                    <span className="wiki-quick-search-item-head">
                      <strong className="wiki-quick-search-title">{item.title}</strong>
                      <span className="wiki-quick-search-badges">
                        <span className="wiki-quick-search-type">{item.typeLabel}</span>
                        <span className="wiki-quick-search-ev">{`[${item.evidence}]`}</span>
                      </span>
                    </span>
                    {item.summary && <span className="wiki-quick-search-summary">{item.summary}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <footer className="wiki-quick-search-foot" aria-hidden="true">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> 选择
          </span>
          <span>
            <kbd>↵</kbd> 打开页面
          </span>
          <span>
            <kbd>Esc</kbd> 关闭
          </span>
        </footer>
      </div>
    </div>
  );
}

export function WikiQuickSearch({
  pages,
  revision,
  slot,
  onAfterNavigate,
}: {
  pages: readonly RegistryEntry[];
  revision: string;
  slot?: HTMLElement | null | undefined;
  onAfterNavigate?: (() => void) | undefined;
}) {
  const navigate = useNavigate();
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const afterNavRef = useRef(onAfterNavigate);
  afterNavRef.current = onAfterNavigate;

  const returnFocusRef = useRef<HTMLElement | null>(null);
  const triggerBtnRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);

  const [controller] = useState(() =>
    createQuickSearchController({
      search: (q, opts) => retrieve(q, opts),
      getPages: () => pagesRef.current,
      onNavigate: (targetId) => {
        afterNavRef.current?.();
        navigate(`/wiki/${targetId}`);
      },
      onRestoreFocus: () => {
        const target =
          returnFocusRef.current && document.contains(returnFocusRef.current)
            ? returnFocusRef.current
            : triggerBtnRef.current;
        returnFocusRef.current = null;
        requestAnimationFrame(() => {
          target?.focus({ preventScroll: true });
        });
      },
    }),
  );

  const [state, setState] = useState<QuickSearchState>(() => controller.getState());
  useEffect(() => controller.subscribe(() => setState(controller.getState())), [controller]);

  // Re-run active query cleanly if a live snapshot publication updates the revision while modal is open
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision intentionally triggers re-query on snapshot swap.
  useEffect(() => {
    controller.onSnapshotChanged();
  }, [controller, revision]);

  useLayoutEffect(() => {
    setHeaderSlot(slot ?? document.getElementById("reader-quick-search-slot"));
  }, [slot]);

  const openFromTrigger = (origin?: HTMLElement | null) => {
    returnFocusRef.current =
      origin ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : triggerBtnRef.current);
    controller.openSearch();
  };

  useEffect(() => {
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) return;
      if (isQuickSearchShortcut(event)) {
        event.preventDefault();
        if (controller.getState().open) {
          controller.closeSearch({ restoreFocus: true });
        } else {
          openFromTrigger(document.activeElement instanceof HTMLElement ? document.activeElement : null);
        }
        return;
      }
      if (controller.getState().open && !event.defaultPrevented) {
        const controls = getModalTabbableElements(dialogRef.current);
        const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        handleModalDialogKeyDown({
          key: event.key,
          shiftKey: event.shiftKey,
          isComposing: event.isComposing,
          keyCode: event.keyCode,
          focusableCount: controls.length,
          activeFocusIndex: active ? controls.indexOf(active) : -1,
          preventDefault: () => event.preventDefault(),
          focusAt: (idx) => controls[idx]?.focus({ preventScroll: true }),
          onClose: () => controller.closeSearch({ restoreFocus: true }),
        });
      }
    };
    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  });

  useEffect(() => {
    if (!state.open) return;
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [state.open]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: status transitions (e.g. retry button unmounting) must keep focus inside modal.
  useLayoutEffect(() => {
    if (!state.open) return;
    const active = document.activeElement;
    if (!active || active === document.body || !dialogRef.current?.contains(active)) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [state.open, state.status]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedIndex scroll sync runs when active option moves.
  useEffect(() => {
    if (!state.open) return;
    listRef.current
      ?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [state.open, state.selectedIndex]);

  const shortcutHint =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)
      ? "⌘K"
      : "Ctrl K";

  const triggerButton = (
    <button
      ref={triggerBtnRef}
      type="button"
      className="reader-quick-search-trigger"
      data-testid="wiki-quick-search-trigger"
      aria-label="打开全库快捷搜索"
      aria-haspopup="dialog"
      aria-expanded={state.open}
      onClick={(event) => openFromTrigger(event.currentTarget)}
    >
      <Search size={15} aria-hidden="true" />
      <span>搜索全文</span>
      <kbd>{shortcutHint}</kbd>
    </button>
  );

  return (
    <>
      {headerSlot ? createPortal(triggerButton, headerSlot) : triggerButton}
      {state.open &&
        typeof document !== "undefined" &&
        createPortal(
          <QuickSearchDialog
            state={state}
            dialogRef={dialogRef}
            inputRef={inputRef}
            listRef={listRef}
            onQueryChange={(q) => void controller.setQuery(q)}
            onSelectIndex={(idx) => controller.selectIndex(idx)}
            onPickItem={(idx) => controller.pickItem(idx)}
            onRetry={() => {
              inputRef.current?.focus({ preventScroll: true });
              void controller.retry();
            }}
            onClose={() => controller.closeSearch({ restoreFocus: true })}
            onInputKeyDown={(event) => {
              const native = event.nativeEvent;
              controller.handleKeyDown({
                key: event.key,
                isComposing: native.isComposing,
                keyCode: native.keyCode,
                preventDefault: () => event.preventDefault(),
              });
            }}
          />,
          document.body,
        )}
    </>
  );
}
