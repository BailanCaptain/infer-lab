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
});
