import { useId, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { DiagramPlayer } from "./DiagramPlayer";
import { allowedAttribute, captionOf, sanitizeDiagram } from "./diagram-sanitize";
import { resolveInteractiveDiagram } from "./interactive-diagrams";

export { allowedAttribute, captionOf, sanitizeDiagram };

export interface ScrollHintState {
  readonly scrollable: boolean;
  readonly atEnd: boolean;
}

export interface ScrollHintHostLike {
  readonly scrollWidth: number;
  readonly clientWidth: number;
  readonly scrollLeft: number;
  readonly children: ArrayLike<Element>;
}

export interface ResizeObserverLike {
  observe(target: Element): void;
  disconnect(): void;
}

const IDLE_SCROLL_HINT: ScrollHintState = { scrollable: false, atEnd: false };

function defaultResizeObserverFactory(callback: () => void): ResizeObserverLike | null {
  return typeof ResizeObserver === "function" ? new ResizeObserver(callback) : null;
}

/**
 * 以实际滚动宿主 DOM 节点为观察生命周期：
 * 交互分支与静态分支切换（或同宿主内部替换 SVG 子节点）时，立即断开旧节点、重测新宿主并绑定新观察器。
 */
export function createScrollHintController<THost extends ScrollHintHostLike = HTMLDivElement>(
  createObserver: (callback: () => void) => ResizeObserverLike | null = defaultResizeObserverFactory,
) {
  let host: THost | null = null;
  let observer: ResizeObserverLike | null = null;
  let state: ScrollHintState = IDLE_SCROLL_HINT;
  const listeners = new Set<() => void>();
  const hostRef: { current: THost | null } = { current: null };

  const setNextState = (next: ScrollHintState) => {
    if (state.scrollable === next.scrollable && state.atEnd === next.atEnd) return;
    state = next;
    for (const listener of listeners) listener();
  };

  const measure = () => {
    if (!host) {
      setNextState(IDLE_SCROLL_HINT);
      return;
    }
    const slack = host.scrollWidth - host.clientWidth;
    setNextState({
      scrollable: slack > 1,
      atEnd: slack > 1 && host.scrollLeft >= slack - 1,
    });
  };

  const disconnect = () => {
    if (!observer) return;
    observer.disconnect();
    observer = null;
  };

  const rebind = () => {
    disconnect();
    measure();
    if (!host) return;
    const nextObserver = createObserver(measure);
    if (!nextObserver) return;
    observer = nextObserver;
    nextObserver.observe(host as unknown as Element);
    for (let i = 0; i < host.children.length; i++) {
      const child = host.children[i];
      if (child) nextObserver.observe(child);
    }
  };

  const ref = (node: THost | null): void => {
    if (host === node) return;
    host = node;
    hostRef.current = node;
    rebind();
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const getSnapshot = () => state;

  return {
    ref,
    hostRef,
    measure,
    rebind,
    subscribe,
    getSnapshot,
  };
}

/**
 * 画布放不下整张图时要让读者知道能横拖：手机上图按 1:1 显示（缩到容器宽只有 316px，
 * 图里的字会掉到 4 px 左右，根本读不了），放不下的部分留在画布里横向滚。
 * 是否真的放不下要量出来——窄图在手机上也放得下，不该挂提示。
 */
function useScrollHint(safe: string | null) {
  const controllerRef = useRef<ReturnType<typeof createScrollHintController<HTMLDivElement>> | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createScrollHintController<HTMLDivElement>();
  }
  const controller = controllerRef.current;
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  // 同一宿主内 safe 变化会通过 dangerouslySetInnerHTML 替换内部 <svg> 子节点：重新测量并重绑子节点观察器
  // biome-ignore lint/correctness/useExhaustiveDependencies: safe 变更驱动内部子节点更新后重绑观察器
  useLayoutEffect(() => {
    controller.rebind();
  }, [controller, safe]);
  return {
    ref: controller.ref,
    hostRef: controller.hostRef,
    ...state,
    onScroll: controller.measure,
  };
}

export function WikiDiagram({
  id,
  svg,
  allowInteractive = false,
  onOpenEvidence,
}: {
  id: string;
  svg: string | undefined;
  /** 默认关闭；仅正式知识阅读页显式开启，且须匹配注册表审定 SVG 版本指纹 */
  allowInteractive?: boolean | undefined;
  /** 仅正式知识阅读页显式传入；Review 等未发布预览不传此入口，不显示证据动作 */
  onOpenEvidence?: ((diagramId: string, trigger: HTMLElement | null) => void) | undefined;
}) {
  const instanceId = useId();
  const safe = useMemo(
    () => (svg ? sanitizeDiagram(svg, `${id}::${instanceId}`) : null),
    [svg, id, instanceId],
  );
  const interactive = useMemo(
    () => resolveInteractiveDiagram({ id, svg, allowInteractive }),
    [id, svg, allowInteractive],
  );
  // React 19 只要 {__html} 换了个对象就重写 innerHTML：滚动提示的状态一变，整张 SVG 就被重新注入，
  // 分镜播放器裁好的画布和飞到一半的块都会被冲掉。对象跟着 safe 走，图没变就不重写。
  const html = useMemo(() => ({ __html: safe ?? "" }), [safe]);
  const caption = svg ? captionOf(svg) : "";
  const hint = useScrollHint(safe);
  if (!safe) {
    // 图缺了要看得出来，不能静静地少一张图
    return (
      <figure className="wiki-diagram wiki-diagram-failed" data-diagram={id}>
        <figcaption>这张图（{id}）没能渲染。</figcaption>
      </figure>
    );
  }
  const InteractiveComponent = interactive?.Component;
  return (
    <figure
      className="wiki-diagram"
      data-diagram={id}
      data-status="ok"
      data-interactive={InteractiveComponent ? "true" : undefined}
      data-scrollable={hint.scrollable || undefined}
      data-at-end={hint.atEnd || undefined}
    >
      {hint.scrollable && (
        // 提示放在画布上方：读者先看到它，才不会以为图被裁了
        <p className="wiki-diagram-hint" data-testid="diagram-scroll-hint">
          <span aria-hidden="true">⇄</span> 图比屏幕宽，左右滑动看全图
        </p>
      )}
      {InteractiveComponent ? (
        <InteractiveComponent
          id={id}
          safeSvg={safe}
          caption={caption}
          scrollRef={hint.ref}
          scrollable={hint.scrollable}
          onScroll={hint.onScroll}
        />
      ) : (
        <>
          {/* 画布外再包一层：右边缘那道渐隐挂在这一层上，只压住画布，不盖提示和图说明 */}
          <div className="wiki-diagram-canvas">
            <div
              className="wiki-diagram-svg"
              ref={hint.ref}
              onScroll={hint.onScroll}
              // 画布能横滚时它就是一个可聚焦的滚动区：键盘用户也要能左右看
              {...(hint.scrollable ? { tabIndex: 0, role: "group", "aria-label": caption || id } : {})}
              // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitizeDiagram 按白名单重建，只留几何与排版
              dangerouslySetInnerHTML={html}
            />
          </div>
          {/* 分镜图（exchanges）一次显示一格、块沿箭头飞；普通图这里什么也不渲染 */}
          <DiagramPlayer id={id} host={hint.hostRef} svg={safe} />
        </>
      )}
      {caption ? <figcaption>{caption}</figcaption> : null}
      {onOpenEvidence && (
        <div className="wiki-diagram-foot">
          <button
            type="button"
            className="wiki-diagram-evidence-btn"
            data-testid={`diagram-evidence-${id}`}
            onClick={(event) => onOpenEvidence(id, event.currentTarget)}
          >
            对照源码
          </button>
        </div>
      )}
    </figure>
  );
}
