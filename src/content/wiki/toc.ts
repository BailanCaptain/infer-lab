/**
 * 阅读页左侧目录的章法，唯一定义处（用户 2026-09-20 定）：
 *
 *   一 推理基础知识 → 二 代码全流程 → 三 特性 → 四 参数
 *
 * 之前目录按课程 22 章的章号分组：多数章是空的，读者看到的是「未归章 → 00 → 04 → 05 → 09…」的跳号，
 * 没章号的参数页全堆在最顶上。章号（frontmatter 的 `chapters`）仍然保留，但只回答「这页对应课程哪一章」，
 * 不再决定目录结构。
 *
 * 「基础」和「全流程」是要循序渐进读的，顺序靠人排，写在 CURATED 里。
 * 没被点名的页自动归位，永远不会出现「未归类」：
 *   param → 参数；feature → 特性（按主题分组）；concept → 课程前 7 章的进「基础」，其余进「全流程 · 其他」。
 */
import { CHAPTER_TITLES } from "./chapters";

export interface TocPage {
  id: string;
  title: string;
  type: string;
  chapters: string[];
  order: number;
}
export interface TocSection<P> {
  /** 小标题；空串表示这一部分不分组 */
  title: string;
  pages: P[];
}
export interface TocPart<P> {
  id: "basics" | "flow" | "features" | "params";
  title: string;
  blurb: string;
  sections: TocSection<P>[];
}

const PARTS: Pick<TocPart<never>, "id" | "title" | "blurb">[] = [
  { id: "basics", title: "推理基础知识", blurb: "读代码之前要懂的词" },
  { id: "flow", title: "代码全流程", blurb: "跟着一条请求，从 vLLM 走到昇腾算子" },
  { id: "features", title: "特性", blurb: "vLLM 与 vLLM-Ascend 的各项特性" },
  { id: "params", title: "参数", blurb: "每个配置参数的定义、默认值与版本谱系" },
];

/** 人排的阅读顺序。这里写了 id 的页，位置以这里为准。 */
const CURATED: Record<"basics" | "flow", { title: string; pages: string[] }[]> = {
  basics: [{ title: "", pages: ["one-request", "prefill", "kv-cache", "rope", "attention-cost"] }],
  flow: [
    {
      title: "先看全貌",
      pages: ["vllm-v1-shape", "vllm-ascend-overview", "who-owns-what", "request-call-chain"],
    },
    {
      title: "启动：昇腾怎么挂进 vLLM",
      pages: [
        "platform-plugin-registration",
        "vllm-platform-interface",
        "npu-platform",
        "ascend-config-system",
        "ascend-patch-system",
        "engine-processes",
        "npu-worker-lifecycle",
      ],
    },
    {
      title: "每一步：调度、分块、准备输入、前向",
      pages: [
        "vllm-engine-core",
        "vllm-scheduler",
        "vllm-kv-block-allocation",
        "block-table",
        "prepare-inputs-flow",
        "npu-model-runner",
        "attention-backend-family",
      ],
    },
    { title: "往下：算子与图", pages: ["ops-and-kernels", "op-to-ai-core", "graph-mode-layer"] },
    { title: "自己读源码", pages: ["vllm-ascend-repo-map", "reading-vllm-ascend"] },
  ],
};

/** 课程第 00–06 章讲模型与推理本身，之后才是引擎、硬件与工程 */
const BASICS_LAST_CHAPTER = "06";
const byOrder = <P extends TocPage>(a: P, b: P) => a.order - b.order || a.title.localeCompare(b.title, "zh");

export function buildToc<P extends TocPage>(pages: P[]): TocPart<P>[] {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const placed = new Set<string>();
  const curated = (part: "basics" | "flow") =>
    CURATED[part]
      .map((section) => ({
        title: section.title,
        pages: section.pages.flatMap((id) => {
          const page = byId.get(id);
          if (!page || placed.has(id)) return [];
          placed.add(id);
          return [page];
        }),
      }))
      .filter((section) => section.pages.length > 0);

  const basics = curated("basics");
  const flow = curated("flow");
  const rest = pages.filter((p) => !placed.has(p.id));

  const isBasic = (p: P) => p.chapters.length > 0 && p.chapters.every((c) => c <= BASICS_LAST_CHAPTER);
  const concepts = rest.filter((p) => p.type !== "param" && p.type !== "feature");
  const moreBasics = concepts.filter(isBasic).sort(byOrder);
  const moreFlow = concepts.filter((p) => !isBasic(p)).sort(byOrder);
  if (moreBasics.length) {
    // 基础部分不分组：新术语页直接接在人排的那几页后面
    if (basics[0] && basics[0].title === "") basics[0].pages.push(...moreBasics);
    else basics.push({ title: "", pages: moreBasics });
  }
  if (moreFlow.length) flow.push({ title: "其他", pages: moreFlow });

  // 特性按主题分组：主题取第一个章号的章名，组的先后按章号
  const topics = new Map<string, P[]>();
  for (const p of rest.filter((p) => p.type === "feature")) {
    const key = p.chapters[0] ?? "~";
    topics.set(key, [...(topics.get(key) ?? []), p]);
  }
  const features = [...topics.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1)) // 码点序：没章号的 "~" 落在最后
    .map(([chapter, list]) => ({ title: CHAPTER_TITLES[chapter] ?? "其他", pages: list.sort(byOrder) }));

  const params = rest.filter((p) => p.type === "param").sort((a, b) => a.title.localeCompare(b.title, "en"));

  const sections = { basics, flow, features, params: params.length ? [{ title: "", pages: params }] : [] };
  return PARTS.map((part) => ({ ...part, sections: sections[part.id] })).filter(
    (part) => part.sections.length > 0,
  );
}
