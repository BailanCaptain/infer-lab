import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ease, opacityAt, type Point, parseFade, parseKeys, pointAlong, pointAt } from "./animTimeline";

export type { Point };
export { ease, pointAlong };

/**
 * 分镜图播放器（2026-09-29）。
 *
 * figure 版式的 exchanges 分镜（scripts/wiki/figure.ts）把「一步一格」从上往下画进同一张 SVG：
 * 每格是一个 g.wiki-anim-band，里面有裁切框 rect.wiki-anim-box、标题 .wiki-anim-title，
 * 以及这一步要发的块 g.wiki-anim-move（块本身 g.wiki-anim-payload + 看不见的路线 path.wiki-anim-route）。
 * 这里只做两件事：把画布裁到当前这一格；「下一步」时让块沿路线从源块飞到目的块，落地后换到下一格
 * （下一格画的就是收完以后各卡手里的样子）。几何全在 SVG 里，这里不认识任何具体的图。
 * 没有 JS 或 SVG 里没有分镜时，图照原样显示整条分镜。
 *
 * 逐张卡演的格（2026-09-29，band 上写了 data-ms）按关键帧播：块的 data-keys 给每个折点一个时刻，
 * 带 data-show / data-hide 的元素（路上的块、加号、加出来的和）到时刻才出现、消失。
 * 取点和缓动在 animTimeline.ts，渲染器算时刻用的也是它。
 */

/** 路线只由 M / L 组成：源块中心 → 箭头起点 → 箭头终点 → 目的块中心 */
export function parseRoute(d: string): Point[] {
  return [...d.matchAll(/[ML]\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
  }));
}

interface Band {
  box: [number, number, number, number];
  title: string;
}

const HOLD_MS = 450;
/** 按关键帧播的格：块一开始就在源块上，不用先跳回去再停，只留一小拍 */
const KEYED_HOLD_MS = 150;
const FLY_MS = 1400;
const LAND_MS = 350;
const PAUSE_MS = 1100;
/** 卸载后这么久之内又挂载，算同一次阅读里的重新挂载；更久就是换页再回来 */
const REMOUNT_MS = 1000;

/**
 * 按钮状态。飞行中「下一步」只标 aria-disabled、点了不理，不真禁用：
 * 真禁用会让键盘焦点掉到 body，键盘用户每走一步都得重新 Tab 回来。只有走到最后一格才禁用。
 */
export function controlState(step: number, last: number, busy: boolean, playing: boolean) {
  const atEnd = step >= last;
  return {
    prevDisabled: step === 0,
    nextDisabled: atEnd,
    nextBusy: busy && !atEnd,
    primary: playing ? "暂停" : atEnd ? "从头播放" : "播放",
  } as const;
}

/** 刚按下的按钮在新的一格变成禁用时（走到头、退到头），焦点交给主按钮 */
export function focusAfter(pressed: "prev" | "next" | null, step: number, last: number): "primary" | null {
  if (pressed === "next" && step >= last) return "primary";
  if (pressed === "prev" && step === 0) return "primary";
  return null;
}

export interface PlayerMemory {
  step: number;
  playing: boolean;
  /** 卸载那一刻是否有一步正在飞：重新挂载后把这一步补飞完 */
  flying: boolean;
  bands: number;
  /** 卸载的时刻；挂着的时候是 null */
  leftAt: number | null;
}

/** 重新挂载时要不要接着上次：格数没变、卸载不到 1 秒才接着；换页再回来从第 1 格开始 */
export function resumeFrom(
  saved: PlayerMemory | undefined,
  bands: number,
  now: number,
): PlayerMemory | undefined {
  if (!saved || saved.bands !== bands || saved.step >= bands) return undefined;
  if (saved.leftAt !== null && now - saved.leftAt > REMOUNT_MS) return undefined;
  return saved;
}

/**
 * 每张图播到第几格、是否在连播、是否正在飞，按图 id 记在组件外面。
 * 知识页正文每重渲染一次（快照刷新、面板开合、dev 下 wiki 文件变动），图就会整个重新挂载；
 * 不记在外面，读者正看到第 4 格，一刷新就被打回第 1 格，刚按的「下一步」也被吞掉。
 */
const memory = new Map<string, PlayerMemory>();

export function DiagramPlayer({
  id,
  host,
  svg,
}: {
  id: string;
  host: RefObject<HTMLDivElement | null>;
  svg: string;
}) {
  const [bands, setBands] = useState<Band[]>([]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  // 重新挂载前有一步没飞完：挂好后补飞
  const [pending, setPending] = useState(false);
  // 每次开飞、暂停、换格都换一个代号；旧的那一趟看到代号变了就停
  const run = useRef(0);
  // 刚按下播放：第一步马上发，不先停一拍
  const kick = useRef(false);
  // 最近按的是哪个按钮：它在新的一格变成禁用时，把焦点交给主按钮
  const pressed = useRef<"prev" | "next" | null>(null);
  // 这个实例是否已经往 memory 里写过自己的状态
  const wrote = useRef(false);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const prevRef = useRef<HTMLButtonElement>(null);

  const root = useCallback(() => host.current?.querySelector("svg") ?? null, [host]);
  const groups = useCallback(
    () => [...(root()?.querySelectorAll<SVGGElement>("g.wiki-anim-band") ?? [])],
    [root],
  );

  // svg 参数只用来在图换了（热更新、换页）时重新读分镜
  // biome-ignore lint/correctness/useExhaustiveDependencies: 见上一行
  useLayoutEffect(() => {
    run.current++;
    const list = groups().map((g): Band => {
      const r = g.querySelector("rect.wiki-anim-box");
      const n = (a: string) => Number(r?.getAttribute(a) ?? 0);
      return {
        box: [n("x"), n("y"), n("width"), n("height")],
        title: g.querySelector(".wiki-anim-title")?.textContent?.trim() ?? "",
      };
    });
    const resume = resumeFrom(memory.get(id), list.length, performance.now());
    setBands(list);
    setStep(resume?.step ?? 0);
    setPlaying(resume?.playing ?? false);
    setPending(Boolean(resume?.flying && !resume.playing));
    setBusy(false);
  }, [id, svg, groups]);

  useEffect(() => {
    if (!bands.length) return;
    wrote.current = true;
    memory.set(id, { step, playing, flying: busy, bands: bands.length, leftAt: null });
  }, [id, step, playing, busy, bands]);
  // 卸载时记下时刻，用来区分「同一次阅读里重新挂载」和「换页再回来」。
  // 只有自己写过记录的实例才记：开发模式下 StrictMode 会把刚挂上的实例先卸一次，
  // 那一次还没读完分镜，不能把换页前留下的旧记录改成「刚卸载」，否则回到本页会接着旧格子播
  useEffect(
    () => () => {
      const saved = memory.get(id);
      if (wrote.current && saved) memory.set(id, { ...saved, leftAt: performance.now() });
    },
    [id],
  );

  // 裁到当前这一格；所有块回到箭头上的静止位置
  useLayoutEffect(() => {
    const s = root();
    const b = bands[step];
    if (!s || !b) return;
    const [x, y, w, h] = b.box;
    s.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
    s.setAttribute("width", String(w));
    s.setAttribute("height", String(h));
    for (const p of s.querySelectorAll("g.wiki-anim-payload")) p.removeAttribute("transform");
    for (const e of s.querySelectorAll<SVGElement>("[data-show],[data-hide],[data-fade]"))
      e.style.removeProperty("opacity");
  }, [bands, step, root]);

  /** 第 k 格的块从源块飞到目的块；被打断返回 false */
  const fly = useCallback(
    (k: number) =>
      new Promise<boolean>((resolve) => {
        const token = ++run.current;
        const g = groups()[k];
        if (!g) {
          resolve(false);
          return;
        }
        const movers = [...g.querySelectorAll<SVGGElement>("g.wiki-anim-move")].flatMap((m) => {
          const route = m.querySelector("path.wiki-anim-route");
          const pay = m.querySelector<SVGGElement>("g.wiki-anim-payload");
          const rect = pay?.querySelector("rect");
          if (!route || !pay || !rect) return [];
          const n = (a: string) => Number(rect.getAttribute(a) ?? 0);
          const center = { x: n("x") + n("width") / 2, y: n("y") + n("height") / 2 };
          const points = parseRoute(route.getAttribute("d") ?? "");
          return [{ pay, points, keys: parseKeys(m.getAttribute("data-keys"), points.length), center }];
        });
        // 到时刻才出现 / 消失的元素：逐张卡演的块、加号、加出来的和
        const at = (e: Element, a: string) => {
          const v = e.getAttribute(a);
          return v === null ? null : Number(v);
        };
        const timed = [...g.querySelectorAll<SVGElement>("[data-show],[data-hide],[data-fade]")].map((e) => ({
          e,
          show: at(e, "data-show"),
          hide: at(e, "data-hide"),
          fade: parseFade(e.getAttribute("data-fade")),
        }));
        const keyedMs = Number(g.getAttribute("data-ms") ?? 0);
        const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
        const [hold, flyMs, land] = still
          ? [0, 0, 0]
          : keyedMs > 0
            ? [KEYED_HOLD_MS, keyedMs, LAND_MS]
            : [HOLD_MS, FLY_MS, LAND_MS];
        const place = (u: number) => {
          for (const m of movers) {
            const p = m.keys ? pointAt(m.points, m.keys, u) : pointAlong(m.points, ease(u));
            m.pay.setAttribute(
              "transform",
              `translate(${(p.x - m.center.x).toFixed(1)} ${(p.y - m.center.y).toFixed(1)})`,
            );
          }
          for (const t of timed) t.e.style.opacity = String(opacityAt(t.show, t.hide, t.fade, u));
        };
        place(0);
        const t0 = performance.now();
        const tick = (now: number) => {
          if (run.current !== token) {
            for (const m of movers) m.pay.removeAttribute("transform");
            for (const t of timed) t.e.style.removeProperty("opacity");
            resolve(false);
            return;
          }
          const e = now - t0;
          if (e < hold) place(0);
          else if (e < hold + flyMs) place((e - hold) / flyMs);
          else {
            place(1);
            if (e >= hold + flyMs + land) {
              resolve(true);
              return;
            }
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    [groups],
  );

  const last = bands.length - 1;
  const advance = useCallback(async () => {
    if (busy || step >= last) return;
    setBusy(true);
    // fly 会把代号加到这个数；之后代号变了，说明这一趟被暂停、上一步或更新的一趟打断，由打断的一方收拾 busy
    const mine = run.current + 1;
    const ok = await fly(step);
    if (run.current !== mine) return;
    setBusy(false);
    if (ok) setStep((s) => Math.min(s + 1, last));
  }, [busy, step, last, fly]);

  // 重新挂载前有一步没飞完：挂好后补飞，读者刚按的「下一步」不会被吞掉
  useEffect(() => {
    if (!pending || !bands.length || busy) return;
    setPending(false);
    void advance();
  }, [pending, bands, busy, advance]);

  // 连续播放：落地换格后停一会儿再发下一步，到最后一格自动停
  useEffect(() => {
    if (!playing || busy) return;
    if (step >= last) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => void advance(), kick.current ? 150 : PAUSE_MS);
    kick.current = false;
    return () => window.clearTimeout(timer);
  }, [playing, busy, step, last, advance]);

  // 刚按的按钮在新的一格被禁用了：焦点交给主按钮，别掉到 body
  useLayoutEffect(() => {
    const who = pressed.current;
    if (!who || !focusAfter(who, step, last)) return;
    const held = who === "next" ? nextRef.current : prevRef.current;
    const active = document.activeElement;
    if (active === held || active === document.body || active === null) primaryRef.current?.focus();
    pressed.current = null;
  }, [step, last]);

  if (bands.length < 2) return null;
  const stop = () => {
    run.current++;
    setPlaying(false);
    setBusy(false);
  };
  const ui = controlState(step, last, busy, playing);
  return (
    <fieldset className="wiki-anim-controls" aria-label="分步播放">
      <button
        ref={prevRef}
        type="button"
        className="wiki-anim-btn"
        disabled={ui.prevDisabled}
        onClick={() => {
          pressed.current = "prev";
          stop();
          setStep((s) => Math.max(s - 1, 0));
        }}
      >
        上一步
      </button>
      <button
        ref={primaryRef}
        type="button"
        className="wiki-anim-btn wiki-anim-primary"
        onClick={() => {
          pressed.current = null;
          if (playing) return stop();
          if (step >= last) setStep(0);
          else kick.current = true;
          setPlaying(true);
        }}
      >
        {ui.primary}
      </button>
      <button
        ref={nextRef}
        type="button"
        className="wiki-anim-btn"
        disabled={ui.nextDisabled}
        aria-disabled={ui.nextBusy || undefined}
        onClick={() => {
          if (busy) return;
          pressed.current = "next";
          setPlaying(false);
          void advance();
        }}
      >
        下一步
      </button>
      <span className="wiki-anim-count" aria-hidden="true">
        {step + 1} / {bands.length}
      </span>
      <span className="wiki-anim-live" aria-live="polite">
        第 {step + 1} 格，共 {bands.length} 格：{bands[step]?.title}
      </span>
    </fieldset>
  );
}
