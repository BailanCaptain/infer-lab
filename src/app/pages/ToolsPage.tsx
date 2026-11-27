import "../../design/tools.css";
import { ArrowLeft } from "lucide-react";
import {
  Component,
  type ComponentType,
  type LazyExoticComponent,
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { WARGAME_SCENARIOS } from "../../sim/wargame/scenarios";
import type { AiCoreLabViewProps } from "../tools/AiCoreLabView";
import type { ConfigDoctorViewProps } from "../tools/ConfigDoctorView";
import type { DeployCalculatorViewProps } from "../tools/DeployCalculatorView";
import type { IncidentWarGameViewProps } from "../tools/IncidentWarGameView";
import type { TroubleshootWorkbenchViewProps } from "../tools/TroubleshootWorkbenchView";
import {
  applyControlledTabQueryUpdate,
  preserveWikiBackParams,
  resolveToolsBackTarget,
  type WorkbenchTabId,
} from "../tools/workbenchHandoff";

type ActiveToolTab = WorkbenchTabId;

const pendingTestPreloads: Array<Promise<void>> = [];

function createLazyView<P extends object>(
  loader: () => Promise<{ default: ComponentType<P> }>,
): LazyExoticComponent<ComponentType<P>> {
  let preloaded: { default: ComponentType<P> } | undefined;
  if (import.meta.env.MODE === "test") {
    pendingTestPreloads.push(
      loader().then((mod) => {
        preloaded = mod;
      }),
    );
  }
  return lazy(() => {
    if (preloaded) {
      const resolved = preloaded;
      return {
        // biome-ignore lint/suspicious/noThenProperty: React 19 lazy() requires a synchronous Thenable during Vitest SSR renderToStaticMarkup
        then(onfulfilled) {
          return Promise.resolve(onfulfilled ? onfulfilled(resolved) : (resolved as never));
        },
      } as PromiseLike<{ default: ComponentType<P> }> as Promise<{ default: ComponentType<P> }>;
    }
    return loader();
  });
}

const loadDeployCalculatorView = async (): Promise<{ default: ComponentType<DeployCalculatorViewProps> }> => {
  const { DeployCalculatorView } = await import("../tools/DeployCalculatorView");
  return { default: DeployCalculatorView };
};

const loadConfigDoctorView = async (): Promise<{ default: ComponentType<ConfigDoctorViewProps> }> => {
  const { ConfigDoctorView } = await import("../tools/ConfigDoctorView");
  return { default: ConfigDoctorView };
};

const loadTroubleshootWorkbenchView = async (): Promise<{
  default: ComponentType<TroubleshootWorkbenchViewProps>;
}> => {
  const { TroubleshootWorkbenchView } = await import("../tools/TroubleshootWorkbenchView");
  return { default: TroubleshootWorkbenchView };
};

const loadAiCoreLabView = async (): Promise<{ default: ComponentType<AiCoreLabViewProps> }> => {
  const { AiCoreLabView } = await import("../tools/AiCoreLabView");
  return { default: AiCoreLabView };
};

const loadIncidentWarGameView = async (): Promise<{ default: ComponentType<IncidentWarGameViewProps> }> => {
  const { IncidentWarGameView } = await import("../tools/IncidentWarGameView");
  return { default: IncidentWarGameView };
};

const LazyDeployCalculatorView = createLazyView<DeployCalculatorViewProps>(loadDeployCalculatorView);
const LazyConfigDoctorView = createLazyView<ConfigDoctorViewProps>(loadConfigDoctorView);
const LazyTroubleshootWorkbenchView = createLazyView<TroubleshootWorkbenchViewProps>(
  loadTroubleshootWorkbenchView,
);
const LazyAiCoreLabView = createLazyView<AiCoreLabViewProps>(loadAiCoreLabView);
const LazyIncidentWarGameView = createLazyView<IncidentWarGameViewProps>(loadIncidentWarGameView);

if (import.meta.env.MODE === "test") {
  await Promise.all(pendingTestPreloads);
}

export interface ToolTabErrorBoundaryProps {
  tabId: ActiveToolTab;
  activeTab: ActiveToolTab;
  tabLabel: string;
  retryCount: number;
  onRetry: () => void;
  children: ReactNode;
}

interface ToolTabErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ToolTabErrorBoundary extends Component<ToolTabErrorBoundaryProps, ToolTabErrorBoundaryState> {
  override state: ToolTabErrorBoundaryState = { hasError: false, errorMessage: "" };

  static getDerivedStateFromError(error: unknown): ToolTabErrorBoundaryState {
    const message = error instanceof Error && error.message ? error.message : "模块加载或渲染出现异常";
    return { hasError: true, errorMessage: message };
  }

  override componentDidUpdate(prevProps: ToolTabErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.activeTab !== this.props.activeTab) {
      this.setState({ hasError: false, errorMessage: "" });
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, errorMessage: "" });
    this.props.onRetry();
  };

  private handleReloadPage = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      const repeatedFailure = this.props.retryCount > 0;
      return (
        <div
          className="wt-card"
          data-testid={`tools-tab-error-${this.props.tabId}`}
          role="alert"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            borderColor: "color-mix(in srgb, var(--color-danger) 45%, var(--color-line))",
            background: "color-mix(in srgb, var(--color-danger) 7%, var(--color-surface-elevated))",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <strong style={{ color: "var(--color-danger)", fontSize: 15 }}>
              「{this.props.tabLabel}」加载失败
            </strong>
            <span style={{ color: "var(--color-ink-muted)", fontSize: 13.5 }}>
              {repeatedFailure
                ? `${this.state.errorMessage}（模块初始化重试仍失败，浏览器模块缓存可能已锁定错误，建议完整刷新页面恢复；不影响切换到其他工具标签页）`
                : `${this.state.errorMessage}（不影响切换到其他工具标签页）`}
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              className={repeatedFailure ? "wt-preset-btn" : "wt-assistant-btn"}
              data-testid={`tools-tab-retry-${this.props.tabId}`}
              onClick={this.handleRetry}
            >
              重新加载此工具
            </button>
            <button
              type="button"
              className={repeatedFailure ? "wt-assistant-btn" : "wt-preset-btn"}
              data-testid={`tools-tab-reload-${this.props.tabId}`}
              onClick={this.handleReloadPage}
            >
              完整刷新此页恢复
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface ScenarioTabMeta {
  id: ActiveToolTab;
  tag: string;
  title: string;
  desc: string;
  teaching?: boolean;
}

const SCENARIO_TABS: readonly ScenarioTabMeta[] = [
  {
    id: "calculator",
    tag: "① 上线前算账",
    title: "估算要几张卡",
    desc: "选模型与昇腾卡型，3 秒算出最少卡数与 KV 显存余量；有日志也可核对偏差。",
  },
  {
    id: "doctor",
    tag: "② 启动前体检",
    title: "检查启动命令",
    desc: "贴入 vllm serve 命令，提前揪出参数冲突与会被昇腾悄悄改写的配置。",
  },
  {
    id: "troubleshoot",
    tag: "③ 报错后定位",
    title: "分析报错日志",
    desc: "起不来、多卡 EI0006 超时或变慢时，贴日志定位最早出错的卡（首错 Rank）。",
  },
  {
    id: "aicore",
    tag: "④ 微观原理演示",
    title: "芯片算子沙盘",
    desc: "配合硬件章节直观理解 AI Core 双缓冲与算子融合如何省显存带宽。",
    teaching: true,
  },
  {
    id: "wargame",
    tag: "⑤ 实战闯关演练",
    title: "生产故障通关场",
    desc: `${WARGAME_SCENARIOS.length} 道真实生产故障演练：看日志判首错、改对启动命令并通过防逃课判卷。`,
    teaching: true,
  },
];

function resolveToolTab(raw: string | null): ActiveToolTab {
  if (raw === "doctor" || raw === "troubleshoot" || raw === "aicore" || raw === "wargame") return raw;
  return "calculator";
}

export function ToolsPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = resolveToolTab(searchParams.get("tab"));
  const activeTabRef = useRef<ActiveToolTab>(activeTab);
  const searchParamsRef = useRef<URLSearchParams>(searchParams);
  activeTabRef.current = activeTab;
  searchParamsRef.current = searchParams;
  const [visitedTabs, setVisitedTabs] = useState<ReadonlySet<ActiveToolTab>>(() => new Set([activeTab]));
  const [retryNonce, setRetryNonce] = useState<Record<ActiveToolTab, number>>({
    calculator: 0,
    doctor: 0,
    troubleshoot: 0,
    aicore: 0,
    wargame: 0,
  });

  const bumpRetry = (tab: ActiveToolTab) => {
    setRetryNonce((prev) => ({ ...prev, [tab]: prev[tab] + 1 }));
  };

  const CalculatorView = useMemo(
    () => (retryNonce.calculator === 0 ? LazyDeployCalculatorView : createLazyView(loadDeployCalculatorView)),
    [retryNonce.calculator],
  );
  const DoctorView = useMemo(
    () => (retryNonce.doctor === 0 ? LazyConfigDoctorView : createLazyView(loadConfigDoctorView)),
    [retryNonce.doctor],
  );
  const TroubleshootView = useMemo(
    () =>
      retryNonce.troubleshoot === 0
        ? LazyTroubleshootWorkbenchView
        : createLazyView(loadTroubleshootWorkbenchView),
    [retryNonce.troubleshoot],
  );
  const AiCoreView = useMemo(
    () => (retryNonce.aicore === 0 ? LazyAiCoreLabView : createLazyView(loadAiCoreLabView)),
    [retryNonce.aicore],
  );
  const WarGameView = useMemo(
    () => (retryNonce.wargame === 0 ? LazyIncidentWarGameView : createLazyView(loadIncidentWarGameView)),
    [retryNonce.wargame],
  );

  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  const navigateToTab = useCallback(
    (next: ActiveToolTab, extra?: Record<string, string>, replace = true) => {
      const nextParams = new URLSearchParams();
      nextParams.set("tab", next);
      preserveWikiBackParams(nextParams, searchParamsRef.current);
      if (extra) {
        for (const [k, v] of Object.entries(extra)) {
          nextParams.set(k, v);
        }
      }
      setSearchParams(nextParams, { replace });
    },
    [setSearchParams],
  );

  const handleUpdateTabSearchParams = useCallback(
    (ownerTab: ActiveToolTab, tabParams: URLSearchParams, opts?: { replace?: boolean }) => {
      const merged = applyControlledTabQueryUpdate(
        activeTabRef.current,
        ownerTab,
        searchParamsRef.current,
        tabParams,
      );
      if (!merged) return;
      setSearchParams(merged, { replace: opts?.replace ?? true, preventScrollReset: true });
    },
    [setSearchParams],
  );

  const backTarget = resolveToolsBackTarget(searchParams);
  const backTo = backTarget.hash
    ? { pathname: backTarget.pathname, hash: backTarget.hash }
    : backTarget.pathname;

  const isTabMounted = (tab: ActiveToolTab) => activeTab === tab || visitedTabs.has(tab);

  return (
    <main id="main-content" className="wt-workbench" data-testid="tools-workbench" tabIndex={-1}>
      <header className="wt-workbench-head">
        <div className="wt-workbench-heading">
          <span className="wt-workbench-eyebrow">昇腾部署与排障 · VLLM-ASCEND V0.30.0 / MAIN</span>
          <h1 className="wt-workbench-title">部署与排障工作台</h1>
          <p className="wt-workbench-desc">
            前三个工具按真实上线顺序排好：先算卡数、再查启动命令、报错后查日志；后两个提供芯片算子微观沙盘与{" "}
            {WARGAME_SCENARIOS.length} 关真实生产故障实战闯关。
          </p>
        </div>
        <Link className="wt-workbench-back" to={backTo} data-testid="tools-back-to-wiki">
          <ArrowLeft size={15} aria-hidden="true" />
          <span>{backTarget.fromPage ? `返回主章节 · ${backTarget.fromPage}` : "返回主章节"}</span>
        </Link>
      </header>

      <div className="wt-scenario-tabs" role="tablist" aria-label="按当前任务选择工具">
        {SCENARIO_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`wt-scenario-tab${isActive ? " is-active" : ""}${tab.teaching ? " is-teaching" : ""}`}
              data-testid={`tools-tab-${tab.id}`}
              onClick={() => {
                if (!isActive) navigateToTab(tab.id);
              }}
            >
              <span className="wt-scenario-tab-top">
                <span className="wt-scenario-tag">{tab.tag}</span>
              </span>
              <span className="wt-scenario-tab-title">{tab.title}</span>
              <span className="wt-scenario-tab-desc">{tab.desc}</span>
            </button>
          );
        })}
      </div>

      {isTabMounted("calculator") && (
        <div className="wt-workbench-pane" hidden={activeTab !== "calculator"}>
          <ToolTabErrorBoundary
            tabId="calculator"
            activeTab={activeTab}
            tabLabel="估算要几张卡（部署算账）"
            retryCount={retryNonce.calculator}
            onRetry={() => bumpRetry("calculator")}
          >
            <Suspense
              fallback={
                <div className="wt-pane-loading" role="status">
                  正在加载「估算要几张卡（部署算账）」…
                </div>
              }
            >
              <CalculatorView
                mode="full"
                title="估算要几张卡（部署算账）"
                summary="① 选模型 → ② 选卡与上下文 → ③ 看人话结论与复制命令；已有启动日志也可切到右上角「已有日志对账」核对偏差。"
                searchParams={searchParams}
                locationKey={location.key}
                onUpdateSearchParams={(params, opts) =>
                  handleUpdateTabSearchParams("calculator", params, opts)
                }
                onClearCalculatorShareParams={(nextSubMode, pushHistory) => {
                  if (activeTabRef.current !== "calculator") return;
                  navigateToTab(
                    "calculator",
                    nextSubMode === "reconcile" ? { panel: "reconcile" } : undefined,
                    !pushHistory,
                  );
                }}
                onNavigateToDoctor={() => navigateToTab("doctor")}
              />
            </Suspense>
          </ToolTabErrorBoundary>
        </div>
      )}

      {isTabMounted("doctor") && (
        <div className="wt-workbench-pane" hidden={activeTab !== "doctor"}>
          <ToolTabErrorBoundary
            tabId="doctor"
            activeTab={activeTab}
            tabLabel="检查启动命令（配置体检）"
            retryCount={retryNonce.doctor}
            onRetry={() => bumpRetry("doctor")}
          >
            <Suspense
              fallback={
                <div className="wt-pane-loading" role="status">
                  正在加载「检查启动命令（配置体检）」…
                </div>
              }
            >
              <DoctorView
                mode="full"
                isActive={activeTab === "doctor"}
                searchParams={searchParams}
                locationKey={location.key}
                onUpdateSearchParams={(params, opts) => handleUpdateTabSearchParams("doctor", params, opts)}
                title="检查启动命令（配置体检）"
                summary="粘贴单机或 P/D 分离的 vllm serve 命令，按 vllm-ascend 源码规则提前揪出参数冲突、会被悄悄改写的选项与实际生效值。"
              />
            </Suspense>
          </ToolTabErrorBoundary>
        </div>
      )}

      {isTabMounted("troubleshoot") && (
        <div className="wt-workbench-pane" hidden={activeTab !== "troubleshoot"}>
          <ToolTabErrorBoundary
            tabId="troubleshoot"
            activeTab={activeTab}
            tabLabel="分析报错日志（在线排障）"
            retryCount={retryNonce.troubleshoot}
            onRetry={() => bumpRetry("troubleshoot")}
          >
            <Suspense
              fallback={
                <div className="wt-pane-loading" role="status">
                  正在加载「分析报错日志（在线排障）」…
                </div>
              }
            >
              <TroubleshootView
                mode="full"
                isActive={activeTab === "troubleshoot"}
                searchParams={searchParams}
                locationKey={location.key}
                onUpdateSearchParams={(params, opts) =>
                  handleUpdateTabSearchParams("troubleshoot", params, opts)
                }
                title="分析报错日志（在线排障）"
                summary="粘贴真实报错日志、CANN/HCCL 错误码或 /metrics 指标，自动定位最早出错的卡（首错 Rank）；也可切到右侧查看 6 类典型阻塞的时序演示。"
                onNavigateToReconcile={() => navigateToTab("calculator", { panel: "reconcile" })}
              />
            </Suspense>
          </ToolTabErrorBoundary>
        </div>
      )}

      {isTabMounted("aicore") && (
        <div className="wt-workbench-pane" hidden={activeTab !== "aicore"}>
          <ToolTabErrorBoundary
            tabId="aicore"
            activeTab={activeTab}
            tabLabel="芯片算子沙盘（微观原理演示 · AI Core）"
            retryCount={retryNonce.aicore}
            onRetry={() => bumpRetry("aicore")}
          >
            <Suspense
              fallback={
                <div className="wt-pane-loading" role="status">
                  正在加载「芯片算子沙盘（微观原理演示）」…
                </div>
              }
            >
              <AiCoreView
                mode="full"
                isActive={activeTab === "aicore"}
                searchParams={searchParams}
                locationKey={location.key}
                onUpdateSearchParams={(params, opts) => handleUpdateTabSearchParams("aicore", params, opts)}
                title="芯片算子沙盘（微观原理演示 · AI Core）"
                summary="配合硬件章节理解底层原理：切换双缓冲、算子融合与 910B/950 架构，直观观察数据搬运怎样省显存带宽、以及离群值如何影响量化精度。"
              />
            </Suspense>
          </ToolTabErrorBoundary>
        </div>
      )}

      {isTabMounted("wargame") && (
        <div className="wt-workbench-pane" hidden={activeTab !== "wargame"}>
          <ToolTabErrorBoundary
            tabId="wargame"
            activeTab={activeTab}
            tabLabel="生产故障通关场（实战闯关演练）"
            retryCount={retryNonce.wargame}
            onRetry={() => bumpRetry("wargame")}
          >
            <Suspense
              fallback={
                <div className="wt-pane-loading" role="status">
                  正在加载「生产故障通关场（实战闯关演练）」…
                </div>
              }
            >
              <WarGameView
                isActive={activeTab === "wargame"}
                searchParams={searchParams}
                locationKey={location.key}
                onUpdateSearchParams={(params, opts) => handleUpdateTabSearchParams("wargame", params, opts)}
                title="生产故障通关场（实战闯关演练）"
                summary={`${WARGAME_SCENARIOS.length} 道源自本仓源码 [C]、910B3 真机实测 [M] 与社区真实工单改编的生产故障关卡：先看现场日志或 /metrics 锁定首错根因，再亲手修复启动命令并通过确定性防逃课判卷。`}
              />
            </Suspense>
          </ToolTabErrorBoundary>
        </div>
      )}
    </main>
  );
}
