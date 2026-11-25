import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { ensurePage, ensureWikiGraph, getPage, getReaderState } from "../../content/wiki/index";
import type { RegistryEntry, WikiGraphEdge } from "../../content/wiki/schema";
import { buildToc, CORE_26_IDS } from "../../content/wiki/toc";
import { Article } from "../pages/WikiPage";
import {
  computeCore26Progress,
  createReadingProgressStore,
  READING_PROGRESS_STORAGE_KEY,
} from "./readingProgressStore";
import {
  buildCausalNeighborhood,
  countUniqueCausalEdges,
  isParamBlastRadiusPage,
  resolveAlignedGraphEdges,
  resolveGraphFocus,
  resolveUrlGraphMode,
  WikiCausalGraphPanel,
  WikiViewSwitch,
} from "./WikiCausalGraphView";

function makeEntry(
  overrides: Partial<RegistryEntry> & Pick<RegistryEntry, "id" | "title" | "type">,
): RegistryEntry {
  return {
    origin: "seed",
    summary: `${overrides.title}的一句话摘要`,
    aliases: [],
    chapters: [],
    order: 500,
    prerequisites: [],
    sources: ["https://example.com/doc"],
    verified: [],
    evidence: "C",
    relations: [],
    related: [],
    contradicts: [],
    updated: "2026-11-24",
    file: `concepts/${overrides.id}.md`,
    backlinks: [],
    ...overrides,
  };
}

describe("WikiCausalGraphView 有向因果三栏、Core-26 进度与参数爆炸半径", () => {
  const pages: RegistryEntry[] = [
    makeEntry({ id: "matmul-and-weights", title: "矩阵乘与权重", type: "concept" }),
    makeEntry({
      id: "kv-cache",
      legacyIds: ["legacy-kv-cache"],
      title: "KV Cache",
      type: "concept",
    }),
    makeEntry({ id: "paged-attention", title: "PagedAttention", type: "concept" }),
    makeEntry({ id: "mla", title: "MLA 多头潜在注意力", type: "feature" }),
    makeEntry({ id: "acl-graph", title: "ACLGraph 图模式", type: "feature" }),
    makeEntry({
      id: "enable-super-kernel-ce990e186bfa",
      title: "enable_super_kernel",
      displayTitle: "AscendCompilationConfig.enable_super_kernel",
      type: "param",
    }),
    makeEntry({ id: "enforce-eager-opt", title: "enforce_eager 逐算子执行", type: "param" }),
    makeEntry({ id: "linear-attention", title: "线性注意力", type: "feature" }),
  ];

  const rawEdges: WikiGraphEdge[] = [
    { from: "kv-cache", to: "matmul-and-weights", kind: "builds-on", note: "K/V 由投影矩阵乘算出" },
    { from: "paged-attention", to: "legacy-kv-cache", kind: "builds-on", note: "把连续 KV Cache 切成固定块" },
    { from: "mla", to: "kv-cache", kind: "variant-of", note: "将 KV 压缩为低秩潜在向量" },
    { from: "kv-cache", to: "linear-attention", kind: "alternative-to", note: "用固定状态替代增长缓存" },
    {
      from: "enable-super-kernel-ce990e186bfa",
      to: "acl-graph",
      kind: "builds-on",
      note: "SuperKernel 建立在静态图捕获之上",
    },
    {
      from: "enable-super-kernel-ce990e186bfa",
      to: "enforce-eager-opt",
      kind: "conflicts-with",
      note: "开启 eager 时图内算子超融合不生效",
    },
    // 对称边双向声明时绝不重复计数
    {
      from: "enforce-eager-opt",
      to: "enable-super-kernel-ce990e186bfa",
      kind: "conflicts-with",
      note: "开启 eager 时图内算子超融合不生效",
    },
  ];

  it("严格按有向边划分先读地基、牵动下游与互斥边界，绝不混入无向边或重复相加对称/反向边", () => {
    const rev = "1".repeat(64);
    const aligned = resolveAlignedGraphEdges({
      revision: rev,
      mode: "build",
      pages,
      graph: { revision: rev, edges: rawEdges },
    });
    expect(aligned.ready).toBe(true);
    // 6 条唯一因果关系（双向声明的 conflicts-with 只计 1 条）
    expect(countUniqueCausalEdges(aligned.edges)).toBe(6);

    const kvCausal = buildCausalNeighborhood("kv-cache", aligned.edges);
    expect(kvCausal.foundations).toEqual([
      { id: "matmul-and-weights", kind: "builds-on", note: "K/V 由投影矩阵乘算出" },
    ]);
    expect(kvCausal.dependents).toEqual([
      { id: "paged-attention", kind: "enables", note: "把连续 KV Cache 切成固定块" },
      { id: "mla", kind: "has-variant", note: "将 KV 压缩为低秩潜在向量" },
    ]);
    expect(kvCausal.siblings).toEqual([
      { id: "linear-attention", kind: "alternative-to", note: "用固定状态替代增长缓存" },
    ]);

    const superKernelCausal = buildCausalNeighborhood("enable-super-kernel-ce990e186bfa", aligned.edges);
    expect(superKernelCausal.foundations.map((x) => `${x.id}:${x.kind}`)).toEqual(["acl-graph:builds-on"]);
    expect(superKernelCausal.dependents).toEqual([]);
    expect(superKernelCausal.siblings).toEqual([
      {
        id: "enforce-eager-opt",
        kind: "conflicts-with",
        note: "开启 eager 时图内算子超融合不生效",
      },
    ]);

    // 旧 revision 图谱自动忽略；local 模式下已载入内存的 relations 优先与当前 revision 对齐
    const stale = resolveAlignedGraphEdges({
      revision: "2".repeat(64),
      mode: "build",
      pages,
      graph: { revision: rev, edges: rawEdges },
    });
    expect(stale).toEqual({ ready: false, edges: [] });

    const livePages = pages.map((p) =>
      p.id === "kv-cache"
        ? {
            ...p,
            relations: [{ to: "acl-graph", kind: "conflicts-with" as const, note: "实时编辑的新增互斥边" }],
          }
        : p,
    );
    const liveAligned = resolveAlignedGraphEdges({
      revision: rev,
      mode: "local",
      pages: livePages,
      graph: { revision: rev, edges: rawEdges },
    });
    const liveKv = buildCausalNeighborhood("kv-cache", liveAligned.edges);
    expect(liveKv.foundations).toEqual([]);
    expect(liveKv.siblings).toEqual([
      { id: "acl-graph", kind: "conflicts-with", note: "实时编辑的新增互斥边" },
    ]);
  });

  it("readingProgressStore 持久化规范 ID 并经 resolveCanonicalPageId 与 CORE_26_SET 求交，避免旧别名重复计数", () => {
    const bucket = new Map<string, string>();
    bucket.set(
      READING_PROGRESS_STORAGE_KEY,
      JSON.stringify(["legacy-kv-cache", "kv-cache", "enable-super-kernel-ce990e186bfa", "ghost-page"]),
    );
    const mockStorage = {
      getItem: (key: string) => bucket.get(key) ?? null,
      setItem: (key: string, val: string) => {
        bucket.set(key, val);
      },
    };
    const store = createReadingProgressStore(() => mockStorage);
    const initialProgress = computeCore26Progress(store.getSnapshot(), pages);
    // legacy-kv-cache 与 kv-cache 归一后仅计 1 篇 Core-26；param 页计入全库已读但不计入 Core-26；ghost-page 忽略
    expect(initialProgress.completed).toBe(1);
    expect(initialProgress.total).toBe(CORE_26_IDS.length);
    expect([...initialProgress.completedCoreIds]).toEqual(["kv-cache"]);
    expect([...initialProgress.canonicalReadIds].sort()).toEqual([
      "enable-super-kernel-ce990e186bfa",
      "kv-cache",
    ]);

    // 手动切换 kv-cache 为未读时，同步清除其旧 legacyId，不会卡在已读态
    expect(store.toggleRead("kv-cache", pages)).toBe(false);
    expect(store.isRead("kv-cache", pages)).toBe(false);
    expect(computeCore26Progress(store.getSnapshot(), pages).completed).toBe(0);
    expect(JSON.parse(bucket.get(READING_PROGRESS_STORAGE_KEY)!)).toEqual([
      "enable-super-kernel-ce990e186bfa",
    ]);

    // 跨标签页共享同一 storage 时，两个独立 store 实例交替写入不会互相覆盖丢失进度
    const tabBStore = createReadingProgressStore(() => mockStorage);
    store.markRead("mla", pages);
    tabBStore.markRead("paged-attention", pages);
    expect(JSON.parse(bucket.get(READING_PROGRESS_STORAGE_KEY)!)).toEqual([
      "enable-super-kernel-ce990e186bfa",
      "mla",
      "paged-attention",
    ]);
    store.reload();
    expect(store.isRead("paged-attention", pages)).toBe(true);
    expect(tabBStore.isRead("mla", pages)).toBe(true);

    // 无存储或抛错环境下安全降级到内存态
    const throwingStore = createReadingProgressStore(() => ({
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    }));
    expect(() => throwingStore.markRead("paged-attention", pages)).not.toThrow();
    expect(throwingStore.isRead("paged-attention", pages)).toBe(true);
    throwingStore.markRead("mla", pages);
    expect(throwingStore.isRead("paged-attention", pages)).toBe(true);
    expect(throwingStore.isRead("mla", pages)).toBe(true);
  });

  it("渲染 12 章分区地图、参数爆炸半径筛选、互斥警示框与切换聚焦及文章页头星图入口", async () => {
    const rev = "3".repeat(64);
    const aligned = resolveAlignedGraphEdges({
      revision: rev,
      mode: "build",
      pages,
      graph: { revision: rev, edges: rawEdges },
    });
    const toc = buildToc(pages);

    let currentFocus = "kv-cache";
    let currentFilter: "all" | "core-26" | "params" = "all";
    const renderPanel = () =>
      renderToStaticMarkup(
        createElement(
          MemoryRouter,
          null,
          createElement(WikiCausalGraphPanel, {
            pages,
            toc,
            graphReady: true,
            edges: aligned.edges,
            requestedFocusId: currentFocus,
            filter: currentFilter,
            nodeQuery: "",
            roamTrail: ["matmul-and-weights", currentFocus],
            rawReadIds: ["legacy-kv-cache", "kv-cache", "paged-attention"],
            onChangeFilter: (next) => {
              currentFilter = next;
            },
            onChangeNodeQuery: () => {},
            onSelectFocus: (next) => {
              currentFocus = next;
            },
            onToggleRead: () => {},
          }),
        ),
      );

    const initialHtml = renderPanel();
    expect(initialHtml).toContain("Core-26 主线已点亮 2 / 26");
    expect(initialHtml).toContain('data-testid="focus-node-kv-cache"');
    expect(initialHtml).toContain('data-testid="focus-core26-badge"');
    expect(initialHtml).toContain("K/V 由投影矩阵乘算出");
    expect(initialHtml).toContain("把连续 KV Cache 切成固定块");
    expect(initialHtml).toContain('href="/wiki/kv-cache"');

    // 切换至「参数与配置爆炸半径」视角并点击聚焦 SuperKernel 参数节点
    currentFilter = "params";
    currentFocus = "enable-super-kernel-ce990e186bfa";
    const paramHtml = renderPanel();
    expect(paramHtml).toContain('data-testid="focus-node-enable-super-kernel-ce990e186bfa"');
    expect(paramHtml).toContain("AscendCompilationConfig.enable_super_kernel");
    expect(paramHtml).toContain("SuperKernel 建立在静态图捕获之上");
    expect(paramHtml).toContain('data-testid="causal-sub-siblings"');
    expect(paramHtml).toContain('data-relation-kind="conflicts-with"');
    expect(paramHtml).toContain("开启 eager 时图内算子超融合不生效");
    // 参数爆炸半径视角下仅保留 param 与调参枢纽（如 acl-graph），过滤普通纯概念页
    expect(paramHtml).toContain('data-testid="graph-node-acl-graph"');
    expect(paramHtml).toContain('data-testid="graph-node-enable-super-kernel-ce990e186bfa"');
    expect(paramHtml).not.toContain('data-testid="graph-node-matmul-and-weights"');

    // 校验真实生产快照：12 章完整分区、调参枢纽命中与单篇文章页头星图入口
    const realState = getReaderState();
    const realToc = buildToc(realState.pages);
    expect(realToc).toHaveLength(12);
    for (const hubId of [
      "core-cli-params",
      "ascend-env-and-serve",
      "kv-cache-memory-profiling",
      "acl-graph",
      "hccl-buffer",
    ]) {
      const hub = realState.pages.find((p) => p.id === hubId);
      expect(hub, `missing hub ${hubId}`).toBeDefined();
      expect(isParamBlastRadiusPage(hub!)).toBe(true);
    }
    const realGraph = await ensureWikiGraph();
    expect(realGraph.revision).toBe(realState.revision);
    expect(realGraph.edges.length).toBeGreaterThan(0);

    await ensurePage("acl-graph");
    const aclPage = getPage("acl-graph")!;
    const articleHtml = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(Article, {
          page: aclPage.fm,
          body: "",
          compiled: aclPage.compiled,
          diagrams: realState.diagrams,
        }),
      ),
    );
    expect(articleHtml).toContain('data-testid="article-open-graph"');
    expect(articleHtml).toContain('href="/wiki?view=graph&amp;focus=acl-graph"');

    const switchHtml = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(WikiViewSwitch, { activeView: "graph", focusId: "acl-graph" }),
      ),
    );
    expect(switchHtml).toContain('href="/wiki"');
    expect(switchHtml).toContain('href="/wiki?view=graph&amp;focus=acl-graph"');

    // Directory round-trip preserves explicit graph mode & focus
    const modeSwitchHtml = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(WikiViewSwitch, { activeView: "graph", focusId: "acl-graph", mode: "params" }),
      ),
    );
    expect(modeSwitchHtml).toContain('href="/wiki?mode=params&amp;focus=acl-graph"');
    expect(modeSwitchHtml).toContain('href="/wiki?view=graph&amp;mode=params&amp;focus=acl-graph"');
    const dirReturnHtml = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(WikiViewSwitch, { activeView: "directory", focusId: "acl-graph", mode: "params" }),
      ),
    );
    expect(dirReturnHtml).toContain('href="/wiki?view=graph&amp;mode=params&amp;focus=acl-graph"');

    // 验证重构后的三视图切换与折叠噪点控制：
    // 1) core-26 必读路线呈现排序步骤卡 + 推荐下一篇 + 关键词即时筛选
    const roadmapHtml = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(WikiCausalGraphPanel, {
          pages: realState.pages,
          toc: realToc,
          graphReady: true,
          edges: realGraph.edges,
          requestedFocusId: "kv-cache",
          filter: "core-26",
          nodeQuery: "KV cache",
          roamTrail: [],
          rawReadIds: ["request-overview"],
          onChangeFilter: () => {},
          onChangeNodeQuery: () => {},
          onSelectFocus: () => {},
          onToggleRead: () => {},
        }),
      ),
    );
    expect(roadmapHtml).toContain('data-testid="wiki-core26-roadmap"');
    expect(roadmapHtml).toContain('data-testid="roadmap-node-kv-cache"');
    expect(roadmapHtml).toContain('data-testid="roadmap-inspect-kv-cache"');
    expect(roadmapHtml).not.toContain('data-testid="wiki-causal-triad"');

    // 2) all 模式（连线因果图）呈现 SVG 连线、章选切换器与折叠旁支按钮，不再首屏堆砌 26 张长卡墙
    const flowRealHtml = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(WikiCausalGraphPanel, {
          pages: realState.pages,
          toc: realToc,
          graphReady: true,
          edges: realGraph.edges,
          requestedFocusId: "kv-cache",
          filter: "all",
          nodeQuery: "",
          roamTrail: [],
          rawReadIds: [],
          onChangeFilter: () => {},
          onChangeNodeQuery: () => {},
          onSelectFocus: () => {},
          onToggleRead: () => {},
        }),
      ),
    );
    expect(flowRealHtml).toContain('class="wiki-causal-wires"');
    expect(flowRealHtml).toContain('data-testid="causal-chapter-picker"');
    expect(flowRealHtml).toContain('data-testid="toggle-extra-dependents"');

    // 3) params 模式呈现左右分栏调参影响速查并置顶核心调参枢纽
    const paramExplorerHtml = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(WikiCausalGraphPanel, {
          pages: realState.pages,
          toc: realToc,
          graphReady: true,
          edges: realGraph.edges,
          requestedFocusId: "core-cli-params",
          filter: "params",
          nodeQuery: "",
          roamTrail: [],
          rawReadIds: [],
          onChangeFilter: () => {},
          onChangeNodeQuery: () => {},
          onSelectFocus: () => {},
          onToggleRead: () => {},
        }),
      ),
    );
    expect(paramExplorerHtml).toContain('data-testid="wiki-param-explorer"');
    expect(paramExplorerHtml).toContain('data-testid="focus-node-core-cli-params"');
    expect(paramExplorerHtml).toContain("#/tools?tab=doctor");
  });

  it("enforces params-mode focus filtering, URL mode restoration on Back, and strict secondary folding", () => {
    const pages: RegistryEntry[] = [
      makeEntry({ id: "core-cli-params", title: "核心参数", type: "param" }),
      makeEntry({ id: "gqa", title: "GQA 分组查询注意力", type: "concept" }),
      makeEntry({ id: "src-ref-a", title: "源码参考 A", type: "source" }),
      makeEntry({ id: "pr-ref-b", title: "PR 参考 B", type: "pr" }),
    ];
    const toc = buildToc(pages);

    // P2-1: params 模式不得采纳非参数页 focus=gqa，而应回退到默认调参枢纽
    const paramFocus = resolveGraphFocus({ requestedFocusId: "gqa", filter: "params", pages, toc });
    expect(paramFocus.focusId).toBe("core-cli-params");
    expect(paramFocus.missingRequestedId).toBeUndefined();

    // P2-1: params 模式在不存在任何参数页的快照下也不得回退到 pool[0]（gqa）
    const noParamPages: RegistryEntry[] = [
      makeEntry({ id: "gqa", title: "GQA 分组查询注意力", type: "concept" }),
    ];
    const noParamToc = buildToc(noParamPages);
    const emptyParamFocus = resolveGraphFocus({
      requestedFocusId: "gqa",
      filter: "params",
      pages: noParamPages,
      toc: noParamToc,
    });
    expect(emptyParamFocus.focusId).toBeUndefined();
    expect(emptyParamFocus.missingRequestedId).toBeUndefined();

    // P2-1: 浏览器后退至无 mode/focus 的 ?view=graph 应恢复 core-26；无 mode 但带 focus=gqa 时切至 all
    expect(resolveUrlGraphMode(new URLSearchParams("view=graph"))).toBe("core-26");
    expect(resolveUrlGraphMode(new URLSearchParams("view=graph&focus=gqa"))).toBe("all");
    expect(resolveUrlGraphMode(new URLSearchParams("view=graph&mode=params&focus=acl-graph"))).toBe("params");

    // P3-7 & P3-8: 当某侧仅有 <=4 条 source/pr 次要档案、无核心条目时，首屏保持折叠并仍提供展开按钮，
    // 且展开后 SVG 连线数与卡片数保持 1:1 匹配（不截断在第 4 条）
    const manyPrimary = Array.from({ length: 6 }, (_, idx) =>
      makeEntry({ id: `core-prereq-${idx}`, title: `核心前置 ${idx}`, type: "concept" }),
    );
    const allPages = [...pages, ...manyPrimary];
    const allToc = buildToc(allPages);
    const edges: WikiGraphEdge[] = [
      { from: "src-ref-a", to: "gqa", kind: "builds-on", note: "源码补充前置" },
      { from: "pr-ref-b", to: "gqa", kind: "builds-on", note: "PR 记录前置" },
      ...manyPrimary.map((p) => ({
        from: "gqa",
        to: p.id,
        kind: "builds-on" as const,
        note: "进阶派生模块",
      })),
    ];
    const collapsedHtml = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(WikiCausalGraphPanel, {
          pages: allPages,
          toc: allToc,
          graphReady: true,
          edges,
          requestedFocusId: "gqa",
          filter: "all",
          nodeQuery: "",
          roamTrail: [],
          rawReadIds: [],
          onChangeFilter: () => {},
          onChangeNodeQuery: () => {},
          onSelectFocus: () => {},
          onToggleRead: () => {},
        }),
      ),
    );
    expect(collapsedHtml).toContain('data-testid="toggle-extra-dependents"');
    expect(collapsedHtml).toContain("当前已无更多核心进阶页；下方保留 2 条源码问答/PR 记录");
    expect(collapsedHtml).not.toContain('data-testid="causal-card-src-ref-a"');
    expect(collapsedHtml).toContain('role="tab" aria-selected="true" tabindex="0"');
  });
});
