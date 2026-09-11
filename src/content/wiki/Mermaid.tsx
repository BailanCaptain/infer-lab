import { useEffect, useRef, useState } from "react";

/**
 * 渲染 wiki 正文里的 ```mermaid 代码块。
 *
 * HANDBOOK「页面格式」第 3 节要求讲结构关系时必须画图，产出的就是 mermaid 块。
 * 没有这个组件，图会以源码形式显示——规则写了图、读者看不到图。
 *
 * mermaid 有 1 MB 上下，动态 import 让它只在真有图的页面上加载；
 * 渲染失败不能让整页白屏，退回显示源码。
 */

type Status = "idle" | "ok" | "error";

/** 与 tokens.css 对齐，图不能是一块和页面无关的蓝白色 */
const THEME_VARS = {
  fontFamily: "'Inter Variable', 'Noto Sans SC', system-ui, sans-serif",
  fontSize: "14px",
  background: "#fbfaf6",
  primaryColor: "#e8edff",
  primaryTextColor: "#17211f",
  primaryBorderColor: "#4c65b6",
  lineColor: "#8a928f",
  secondaryColor: "#fff4cf",
  secondaryBorderColor: "#c78300",
  tertiaryColor: "#ece9df",
  tertiaryBorderColor: "#b8bcb5",
  noteBkgColor: "#fff0e9",
  noteBorderColor: "#e85b32",
  noteTextColor: "#17211f",
  actorBkg: "#e8edff",
  actorBorder: "#4c65b6",
  clusterBkg: "#f5f2ea",
  clusterBorder: "#d8d8cf",
} as const;

let ready: Promise<typeof import("mermaid").default> | null = null;

function loadMermaid() {
  if (!ready) {
    ready = import("mermaid").then((m) => {
      m.default.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        themeVariables: THEME_VARS,
        // wrappingWidth 默认 200px，中文节点标签会被拦腰断开——实测「调度器给出的
        // 新增块号」断在「块」后面，留一个孤零零的「号」。260 是试出来的平衡点：
        // 十来个字的中文短语能一行放下，而 `[max_num_reqs, ...] int32` 这种长
        // 方括号表达式仍会换行。再放宽图会变宽，useMaxWidth 缩放后字反而更小。
        flowchart: { curve: "basis", useMaxWidth: true, wrappingWidth: 260 },
        sequence: { useMaxWidth: true, wrap: true, width: 220 },
      });
      return m.default;
    });
  }
  return ready;
}

let seq = 0;

export function Mermaid({ chart }: { chart: string }) {
  const [svg, setSvg] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const id = useRef(`wiki-mmd-${++seq}`);

  useEffect(() => {
    let alive = true;
    setStatus("idle");
    loadMermaid()
      .then((mermaid) => mermaid.render(id.current, chart))
      .then(({ svg: out }) => {
        if (!alive) return;
        setSvg(out);
        setStatus("ok");
      })
      .catch(() => {
        if (alive) setStatus("error");
      });
    return () => {
      alive = false;
      // mermaid 渲染失败时会把探测用的容器留在 body 上
      document.getElementById(`d${id.current}`)?.remove();
    };
  }, [chart]);

  if (status === "error") {
    return (
      <figure className="wiki-diagram wiki-diagram-failed">
        <pre>
          <code>{chart}</code>
        </pre>
        <figcaption>这张图没能渲染，上面是它的源码。</figcaption>
      </figure>
    );
  }
  return (
    <figure className="wiki-diagram" data-status={status}>
      {status === "ok" ? (
        // biome-ignore lint/security/noDangerouslySetInnerHtml: mermaid 以 securityLevel:"strict" 渲染，输出已过滤
        <div className="wiki-diagram-svg" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="wiki-diagram-loading">图加载中…</div>
      )}
    </figure>
  );
}
