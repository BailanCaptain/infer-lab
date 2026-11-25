import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Hit } from "../../content/wiki/retrieve";
import * as QuickSearchModule from "./QuickSearch";

describe("Wiki 快捷搜索状态机与视图（Task 751 第 2 短轮）", () => {
  it("识别 Cmd+K 与 Ctrl+K 组合键，排除多余修饰键", () => {
    const { isQuickSearchShortcut } = QuickSearchModule;
    expect(
      isQuickSearchShortcut({ key: "k", metaKey: true, ctrlKey: false, altKey: false, shiftKey: false }),
    ).toBe(true);
    expect(
      isQuickSearchShortcut({ key: "K", metaKey: false, ctrlKey: true, altKey: false, shiftKey: false }),
    ).toBe(true);
    expect(
      isQuickSearchShortcut({ key: "k", metaKey: false, ctrlKey: true, altKey: true, shiftKey: false }),
    ).toBe(false);
    expect(
      isQuickSearchShortcut({ key: "k", metaKey: false, ctrlKey: false, altKey: false, shiftKey: false }),
    ).toBe(false);
  });

  it("支持上下循环选择、Enter 跳转、中文输入法组合期防误触发，以及 Esc/遮罩关闭归还焦点", async () => {
    const { createQuickSearchController } = QuickSearchModule;
    const navigated: string[] = [];
    let focusRestored = 0;
    const hits: Hit[] = [
      { id: "kv-cache", title: "KV Cache", summary: "缓存 K 与 V。", evidence: "C", score: 10, how: "exact" },
      {
        id: "enable-super-kernel-ce990e186bfa",
        title: "enable_super_kernel",
        summary: "Super Kernel 优化开关。",
        evidence: "C",
        score: 8,
        how: "keyword",
      },
    ];
    const ctl = createQuickSearchController({
      search: async () => hits,
      getPages: () => [
        { id: "kv-cache", type: "concept" },
        { id: "enable-super-kernel-ce990e186bfa", type: "param" },
      ],
      onNavigate: (id) => navigated.push(id),
      onRestoreFocus: () => {
        focusRestored++;
      },
    });

    ctl.openSearch();
    expect(ctl.getState()).toMatchObject({ open: true, query: "", status: "idle", items: [] });

    await ctl.setQuery("super");
    expect(ctl.getState().status).toBe("ready");
    expect(ctl.getState().items.map((x) => `${x.id}:${x.typeLabel}`)).toEqual([
      "kv-cache:概念",
      "enable-super-kernel-ce990e186bfa:参数",
    ]);
    expect(ctl.getState().selectedIndex).toBe(0);

    // 中文 IME 组合输入期间按 Enter / ArrowDown / Escape 均不得触发跳转、切项或关闭弹层
    const prevent = vi.fn();
    expect(ctl.handleKeyDown({ key: "Enter", isComposing: true, preventDefault: prevent })).toBe(false);
    expect(ctl.handleKeyDown({ key: "Enter", keyCode: 229, preventDefault: prevent })).toBe(false);
    expect(ctl.handleKeyDown({ key: "ArrowDown", isComposing: true, preventDefault: prevent })).toBe(false);
    expect(ctl.handleKeyDown({ key: "Escape", isComposing: true, preventDefault: prevent })).toBe(false);
    expect(navigated).toEqual([]);
    expect(ctl.getState().open).toBe(true);
    expect(ctl.getState().selectedIndex).toBe(0);

    // ArrowDown 移到第 2 项，再按 ArrowDown 回绕到第 1 项，ArrowUp 回绕到最后一项
    ctl.handleKeyDown({ key: "ArrowDown", preventDefault: prevent });
    expect(ctl.getState().selectedIndex).toBe(1);
    ctl.handleKeyDown({ key: "ArrowDown", preventDefault: prevent });
    expect(ctl.getState().selectedIndex).toBe(0);
    ctl.handleKeyDown({ key: "ArrowUp", preventDefault: prevent });
    expect(ctl.getState().selectedIndex).toBe(1);

    // Enter 跳转至选中页并关闭弹层（路由跳转由页面接管焦点，不把焦点拉回旧触发按钮）
    ctl.handleKeyDown({ key: "Enter", preventDefault: prevent });
    expect(navigated).toEqual(["enable-super-kernel-ce990e186bfa"]);
    expect(ctl.getState().open).toBe(false);
    expect(focusRestored).toBe(0);

    // 重新打开后按 Escape 关闭，焦点归还触发前元素
    ctl.openSearch();
    expect(ctl.getState().query).toBe("");
    ctl.handleKeyDown({ key: "Escape", preventDefault: prevent });
    expect(ctl.getState().open).toBe(false);
    expect(focusRestored).toBe(1);

    // 遮罩点击关闭同样归还焦点
    ctl.openSearch();
    ctl.closeSearch({ restoreFocus: true });
    expect(focusRestored).toBe(2);
  });

  it("异步旧查询晚返回不得覆盖新查询或清空状态，且索引加载失败后支持原词重试恢复", async () => {
    const { createQuickSearchController, QuickSearchDialog } = QuickSearchModule;
    let resolveSlow!: (value: Hit[]) => void;
    let failNext = false;
    const search = vi.fn((q: string) => {
      if (failNext) {
        failNext = false;
        return Promise.reject(new Error("检索索引块加载失败"));
      }
      if (q === "slow") {
        return new Promise<Hit[]>((resolve) => {
          resolveSlow = resolve;
        });
      }
      return Promise.resolve<Hit[]>(
        q === "nomatch"
          ? []
          : [
              {
                id: "rope-page",
                title: "RoPE 旋转编码",
                summary: "位置编码。",
                evidence: "C",
                score: 5,
                how: "keyword",
              },
            ],
      );
    });

    const ctl = createQuickSearchController({
      search,
      getPages: () => [{ id: "rope-page", type: "concept" }],
      onNavigate: () => {},
    });

    ctl.openSearch();
    const slowPromise = ctl.setQuery("slow");
    expect(ctl.getState().status).toBe("loading");
    await ctl.setQuery("rope");
    expect(ctl.getState().items.map((x) => x.id)).toEqual(["rope-page"]);

    // 慢查询晚返回：不得覆盖新查询 "rope" 的结果
    resolveSlow([
      { id: "stale-page", title: "旧结果", summary: "不应出现", evidence: "I", score: 99, how: "exact" },
    ]);
    await slowPromise;
    expect(ctl.getState().items.map((x) => x.id)).toEqual(["rope-page"]);

    // 无结果状态渲染清晰提示
    await ctl.setQuery("nomatch");
    expect(ctl.getState()).toMatchObject({ status: "ready", items: [] });
    const emptyHtml = renderToStaticMarkup(
      createElement(QuickSearchDialog, {
        state: ctl.getState(),
        onQueryChange: () => {},
        onSelectIndex: () => {},
        onPickItem: () => {},
        onRetry: () => {},
        onClose: () => {},
        onInputKeyDown: () => {},
      }),
    );
    expect(emptyHtml).toContain("未找到与「nomatch」匹配的页面");

    // 索引加载失败 -> 显示可重试按钮 -> 点击重试后恢复为正常命中结果
    failNext = true;
    await ctl.setQuery("w8a8");
    expect(ctl.getState().status).toBe("error");
    expect(ctl.getState().error).toContain("检索索引块加载失败");
    const errHtml = renderToStaticMarkup(
      createElement(QuickSearchDialog, {
        state: ctl.getState(),
        onQueryChange: () => {},
        onSelectIndex: () => {},
        onPickItem: () => {},
        onRetry: () => {},
        onClose: () => {},
        onInputKeyDown: () => {},
      }),
    );
    expect(errHtml).toContain('data-testid="wiki-quick-search-retry"');

    await ctl.retry();
    expect(ctl.getState().status).toBe("ready");
    expect(ctl.getState().items.map((x) => x.id)).toEqual(["rope-page"]);
  });

  it("P2-3: 新查询或快照刷新进入 loading 期间必须清空旧结果并禁止 Enter/点击误跳旧条目", async () => {
    const { createQuickSearchController, QuickSearchDialog } = QuickSearchModule;
    const navigated: string[] = [];
    let resolveNew!: (value: Hit[]) => void;
    let resolveRefresh!: (value: Hit[]) => void;
    let refreshSlow = false;

    const ctl = createQuickSearchController({
      search: (q: string) => {
        if (q === "old") {
          return Promise.resolve([
            { id: "old-page", title: "Old Page", summary: "旧命中", evidence: "C", score: 9, how: "exact" },
          ]);
        }
        if (q === "new" && !refreshSlow) {
          return new Promise<Hit[]>((resolve) => {
            resolveNew = resolve;
          });
        }
        return new Promise<Hit[]>((resolve) => {
          resolveRefresh = resolve;
        });
      },
      getPages: () => [
        { id: "old-page", type: "concept" },
        { id: "new-page", type: "feature" },
      ],
      onNavigate: (id) => navigated.push(id),
    });

    ctl.openSearch();
    await ctl.setQuery("old");
    expect(ctl.getState().status).toBe("ready");
    expect(ctl.getState().items.map((x) => x.id)).toEqual(["old-page"]);

    // 发起慢查询 "new"：进入 loading 时不得残留上一轮 "old-page"
    const pendingNew = ctl.setQuery("new");
    expect(ctl.getState()).toMatchObject({
      open: true,
      query: "new",
      status: "loading",
      items: [],
      selectedIndex: 0,
    });

    const prevent = vi.fn();
    expect(ctl.handleKeyDown({ key: "ArrowDown", preventDefault: prevent })).toBe(false);
    expect(ctl.handleKeyDown({ key: "ArrowUp", preventDefault: prevent })).toBe(false);
    expect(ctl.handleKeyDown({ key: "Enter", preventDefault: prevent })).toBe(false);
    ctl.selectIndex(0);
    ctl.pickItem(0);
    expect(navigated).toEqual([]);
    expect(ctl.getState().open).toBe(true);

    // 视图层防御：即便传入非 ready 状态，也不得渲染旧 listbox 选项
    const loadingHtml = renderToStaticMarkup(
      createElement(QuickSearchDialog, {
        state: {
          open: true,
          query: "new",
          status: "loading",
          items: [
            {
              id: "old-page",
              title: "Old Page",
              type: "concept",
              typeLabel: "概念",
              summary: "旧命中",
              evidence: "C",
              how: "exact",
            },
          ],
          selectedIndex: 0,
          error: "",
        },
        onQueryChange: () => {},
        onSelectIndex: () => {},
        onPickItem: () => {},
        onRetry: () => {},
        onClose: () => {},
        onInputKeyDown: () => {},
      }),
    );
    expect(loadingHtml).not.toContain('data-testid="wiki-quick-search-item"');
    expect(loadingHtml).toContain('aria-expanded="false"');

    // "new" 解析后恢复可选择与跳转能力
    resolveNew([
      { id: "new-page", title: "New Page", summary: "新命中", evidence: "C", score: 10, how: "exact" },
    ]);
    await pendingNew;
    expect(ctl.getState().status).toBe("ready");
    expect(ctl.getState().items.map((x) => x.id)).toEqual(["new-page"]);

    // 快照热更新触发重查进入 loading 时，同样清空旧项并阻止旧跳转
    refreshSlow = true;
    ctl.onSnapshotChanged();
    expect(ctl.getState()).toMatchObject({
      open: true,
      query: "new",
      status: "loading",
      items: [],
      selectedIndex: 0,
    });
    expect(ctl.handleKeyDown({ key: "Enter", preventDefault: prevent })).toBe(false);
    ctl.pickItem(0);
    expect(navigated).toEqual([]);

    resolveRefresh([
      { id: "new-page", title: "New Page", summary: "刷新后命中", evidence: "C", score: 10, how: "exact" },
    ]);
    await Promise.resolve();
    await Promise.resolve();
    expect(ctl.getState().status).toBe("ready");
    expect(ctl.handleKeyDown({ key: "Enter", preventDefault: prevent })).toBe(true);
    expect(navigated).toEqual(["new-page"]);
  });

  it("P2-1 & P2-2: 弹层容器仅接管 Escape 与 Tab/Shift+Tab 焦点环绕，不劫持独立按钮 Enter/Space", () => {
    const { nextModalFocusIndex, handleModalDialogKeyDown } = QuickSearchModule;
    expect(typeof nextModalFocusIndex).toBe("function");
    expect(typeof handleModalDialogKeyDown).toBe("function");

    // 2 个可聚焦控件（输入框 + Esc 关闭按钮）严格环绕
    expect(nextModalFocusIndex(2, 0, false)).toBe(1);
    expect(nextModalFocusIndex(2, 1, false)).toBe(0);
    expect(nextModalFocusIndex(2, 0, true)).toBe(1);
    expect(nextModalFocusIndex(2, 1, true)).toBe(0);
    // 焦点意外落到容器外（-1）时拉回模态框内首/尾控件
    expect(nextModalFocusIndex(2, -1, false)).toBe(0);
    expect(nextModalFocusIndex(2, -1, true)).toBe(1);

    // 3 个可聚焦控件（错误态：输入框 + Esc 关闭按钮 + 重试加载按钮）严格环绕
    expect(nextModalFocusIndex(3, 0, false)).toBe(1);
    expect(nextModalFocusIndex(3, 1, false)).toBe(2);
    expect(nextModalFocusIndex(3, 2, false)).toBe(0);
    expect(nextModalFocusIndex(3, 0, true)).toBe(2);

    // 独立按钮（如「关闭快捷搜索」「重试加载」）冒泡上来的 Enter / Space 不被 dialog 劫持
    const prevent = vi.fn();
    const focusedIndices: number[] = [];
    let closed = 0;

    expect(
      handleModalDialogKeyDown({
        key: "Enter",
        focusableCount: 2,
        activeFocusIndex: 1,
        preventDefault: prevent,
        focusAt: (idx: number) => focusedIndices.push(idx),
        onClose: () => {
          closed++;
        },
      }),
    ).toBe(false);
    expect(
      handleModalDialogKeyDown({
        key: " ",
        focusableCount: 3,
        activeFocusIndex: 2,
        preventDefault: prevent,
        focusAt: (idx: number) => focusedIndices.push(idx),
        onClose: () => {
          closed++;
        },
      }),
    ).toBe(false);
    expect(prevent).not.toHaveBeenCalled();
    expect(closed).toBe(0);

    // Tab / Shift+Tab 在模态框内强制环绕并阻止浏览器默认逃逸到滚动容器或 BODY
    expect(
      handleModalDialogKeyDown({
        key: "Tab",
        shiftKey: false,
        focusableCount: 2,
        activeFocusIndex: 1,
        preventDefault: prevent,
        focusAt: (idx: number) => focusedIndices.push(idx),
        onClose: () => {
          closed++;
        },
      }),
    ).toBe(true);
    expect(focusedIndices).toEqual([0]);
    expect(prevent).toHaveBeenCalledTimes(1);

    // Escape 从模态框内任意控件（含按钮）均可关闭弹层
    expect(
      handleModalDialogKeyDown({
        key: "Escape",
        focusableCount: 2,
        activeFocusIndex: 1,
        preventDefault: prevent,
        focusAt: (idx: number) => focusedIndices.push(idx),
        onClose: () => {
          closed++;
        },
      }),
    ).toBe(true);
    expect(closed).toBe(1);
  });

  it("WS2: 对明确报错特征码、CLI 参数与预设模型提供 1–2 条带「工具/3D」徽章的可点选直达项，绝不自动强跳", async () => {
    const { createQuickSearchController, matchQuickSearchActionItems, QuickSearchDialog } = QuickSearchModule;
    const navigated: string[] = [];

    for (const q of [
      "507015",
      "EI0006",
      "HCCL",
      "OOM",
      "ACLGraph",
      "--gpu-memory-utilization",
      "--tensor-parallel-size",
      "--max-num-batched-tokens",
      "vllm serve",
      "Qwen3-8B",
      "Qwen3-32B",
      "Qwen3-30B-A3B",
      "Qwen3-235B-A22B",
      "DeepSeek-V3",
    ]) {
      const actions = matchQuickSearchActionItems(q);
      expect(actions.length, q).toBeGreaterThanOrEqual(1);
      expect(actions.length, q).toBeLessThanOrEqual(2);
      for (const item of actions) {
        expect(["工具", "3D"]).toContain(item.typeLabel);
        expect(item.route).toMatch(/^\/(?:tools|hardware|model)/);
      }
    }

    const ctl = createQuickSearchController({
      search: async (q) =>
        q === "--gpu-memory-utilization"
          ? [
              {
                id: "gpu-memory-utilization",
                title: "gpu_memory_utilization",
                summary: "显存预算比例参数。",
                evidence: "C",
                score: 20,
                how: "exact",
              },
            ]
          : [],
      getPages: () => [{ id: "gpu-memory-utilization", type: "param" }],
      onNavigate: (target) => navigated.push(target),
    });

    ctl.openSearch();
    // 1. 输入 EI0006：仅展示候选列表，绝不自动跳转
    await ctl.setQuery("EI0006");
    expect(navigated).toEqual([]);
    expect(ctl.getState().open).toBe(true);
    expect(ctl.getState().items[0]?.typeLabel).toBe("工具");
    expect(ctl.getState().items[0]?.route).toContain("/tools?tab=troubleshoot");

    const html = renderToStaticMarkup(
      createElement(QuickSearchDialog, {
        state: ctl.getState(),
        onQueryChange: () => {},
        onSelectIndex: () => {},
        onPickItem: () => {},
        onRetry: () => {},
        onClose: () => {},
        onInputKeyDown: () => {},
      }),
    );
    expect(html).toContain('data-testid="wiki-quick-search-action-badge"');

    // 用户显式按 Enter 后才跳转至目标工具路由
    const prevent = vi.fn();
    expect(ctl.handleKeyDown({ key: "Enter", preventDefault: prevent })).toBe(true);
    expect(navigated).toEqual(["/tools?tab=troubleshoot&fixture=multi-rank-hccl-rank3-fault"]);
    expect(ctl.getState().open).toBe(false);

    // 2. 精确命中参数页（--gpu-memory-utilization）时：参数页保持第 0 项，工具动作项紧随第 1 项
    ctl.openSearch();
    await ctl.setQuery("--gpu-memory-utilization");
    expect(ctl.getState().items.map((x) => `${x.typeLabel}:${x.route ?? x.id}`)).toEqual([
      "参数:gpu-memory-utilization",
      "工具:/tools?tab=calculator",
    ]);

    // 3. 预设模型 Qwen3-235B-A22B 提供算账台（工具）与 3D 硬件分片（3D）双入口
    await ctl.setQuery("Qwen3-235B-A22B");
    expect(ctl.getState().items.map((x) => x.typeLabel)).toEqual(["工具", "3D"]);
    ctl.pickItem(1);
    expect(navigated.at(-1)).toMatch(/^\/hardware\?vendor=ascend&model=atlas-800i-a3&level=2&deploy=/);
  });

  it("Red-Team #1: QuickSearch 处理 vllm serve 命令时必须脱敏 --api-key / Token / IP，绝不将明文密钥编入 URL", async () => {
    const { createQuickSearchController, matchQuickSearchActionItems } = QuickSearchModule;
    const rawCmd =
      "HF_TOKEN=hf_SecretToken9999999999 vllm serve Qwen/Qwen3-8B --api-key SECRET -tp 2 --host 10.20.30.40";
    const items = matchQuickSearchActionItems(rawCmd);
    expect(items.length).toBeGreaterThanOrEqual(1);

    for (const item of items) {
      const route = item.route ?? "";
      expect(route).not.toContain("SECRET");
      expect(route).not.toContain("hf_SecretToken9999999999");
      expect(route).not.toContain("10.20.30.40");
      const qIdx = route.indexOf("?");
      if (qIdx >= 0) {
        const sp = new URLSearchParams(route.slice(qIdx + 1));
        const cmdB64 = sp.get("cmd");
        if (cmdB64) {
          const pad = "=".repeat((4 - (cmdB64.length % 4)) % 4);
          const decoded = Buffer.from(cmdB64.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString(
            "utf8",
          );
          expect(decoded).not.toContain("SECRET");
          expect(decoded).not.toContain("hf_SecretToken9999999999");
          expect(decoded).not.toContain("10.20.30.40");
          expect(decoded).toContain("[REDACTED]");
        }
      }
    }

    const navigated: string[] = [];
    const ctl = createQuickSearchController({
      search: async () => [],
      getPages: () => [],
      onNavigate: (target) => navigated.push(target),
    });
    ctl.openSearch();
    await ctl.setQuery("vllm serve Qwen/Qwen3-8B --api-key SECRET");
    expect(ctl.handleKeyDown({ key: "Enter", preventDefault: () => {} })).toBe(true);
    expect(navigated).toHaveLength(1);
    expect(navigated[0]).not.toContain("SECRET");
    const sp = new URLSearchParams(navigated[0]!.split("?")[1] ?? "");
    const cmdParam = sp.get("cmd") ?? "";
    const decodedNav = Buffer.from(
      cmdParam.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (cmdParam.length % 4)) % 4),
      "base64",
    ).toString("utf8");
    expect(decodedNav).not.toContain("SECRET");
    expect(decodedNav).toContain("--api-key [REDACTED]");
  });

  it("Red-Team #2: 普通 Wiki 词条检索（如「HCCL 超时原理」）保持 Wiki 命中排首不劫持 Enter，且拒绝将蒸馏模型误判为 DeepSeek-V3/Qwen3", async () => {
    const { createQuickSearchController, matchQuickSearchActionItems } = QuickSearchModule;
    const navigated: string[] = [];

    // 1. 蒸馏与非预设变体绝不误报为 256 专家 MLA DeepSeek-V3 或 Qwen3-32B/8B
    for (const nonMatchingModel of [
      "DeepSeek-R1-Distill-Qwen-32B",
      "deepseek-ai/DeepSeek-R1-Distill-Llama-8B",
      "deepseek-ai/DeepSeek-R1-0528-Qwen3-8B",
      "Qwen/Qwen2.5-32B-Instruct",
      "Qwen/Qwen3-VL-8B-Instruct",
      "deepseek-ai/DeepSeek-V2-Lite",
    ]) {
      expect(matchQuickSearchActionItems(nonMatchingModel), nonMatchingModel).toEqual([]);
    }

    // 2. 有 Wiki 页面命中时（即使非 exact 标题匹配，如 "HCCL 超时原理"），Wiki 页面始终排在最前，按 Enter 打开 cann-hccl
    const ctl = createQuickSearchController({
      search: async (q) =>
        q === "HCCL 超时原理"
          ? [
              {
                id: "cann-hccl",
                title: "CANN HCCL 集合通信",
                summary: "昇腾集合通信库与超时排查。",
                evidence: "C",
                score: 14,
                how: "keyword",
              },
              {
                id: "hccl-buffer",
                title: "HCCL 通信域显存缓冲",
                summary: "HCCL_BUFFSIZE 与通信域分配机制。",
                evidence: "C",
                score: 11,
                how: "related",
              },
            ]
          : [],
      getPages: () => [
        { id: "cann-hccl", type: "concept" },
        { id: "hccl-buffer", type: "param" },
      ],
      onNavigate: (target) => navigated.push(target),
    });

    ctl.openSearch();
    await ctl.setQuery("HCCL 超时原理");
    expect(ctl.getState().items.map((x) => x.id)).toEqual([
      "cann-hccl",
      "hccl-buffer",
      "action:troubleshoot-hccl",
      "action:hw3d-hccl",
    ]);
    expect(ctl.handleKeyDown({ key: "Enter", preventDefault: () => {} })).toBe(true);
    expect(navigated).toEqual(["cann-hccl"]);
  });
});
