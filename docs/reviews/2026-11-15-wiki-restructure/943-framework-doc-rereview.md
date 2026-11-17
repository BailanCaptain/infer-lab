# 931 框架文档同步终验

2026-11-16 17:01 UTC，砚砚 / gpt-6-astra。结论：**Approved，0 P1 / 0 P2**。仅 Task 931 三份框架说明同步通过；045、阶段一工程闭环及阶段二内容改造仍未完成。

依据作者 943、947 回执与本轮实际回读，936-framework-doc-review.md 的唯一 P2 已闭合：手册不再把 `font` 放在 `links[]` 上，准确列出 `texts[].font`、`items[].font` 与 `sketches[].shapes[kind="text"].font`，并说明 `bend` 与 `curve` / 非空 `via` 互斥。三份文档统一说明原生 SVG 的 `size: [width, height]` 两维为正、只有宽度受 900px 限制；方案中的旧 ID 精确匹配问题已标为改造前基线。末轮两处导航复审链接已改为实际存在的 `843-navigation-ui-rereview.md`，保留原 839/851 消息编号。

| 最终文件 | SHA-256 |
| --- | --- |
| `wiki/HANDBOOK.md` | `b6972b5505316b45e0da0cd468f17434596f8715350591681ae320c228d620b2` |
| `docs/wiki-writing-standard.md` | `bb8f4d00cc5de22409c10068cad0a4c00d0917387c6be7e5d2ce379589ebc319` |
| `docs/plans/2026-11-14-progressive-restructure-and-fix-plan.md` | `714201eb8352e531b64a5e851348fe149990948eae57aab0ca8d5fa72f609163` |

独立验证：`node node_modules/vitest/vitest.mjs run scripts/wiki/handbook.test.ts --reporter=verbose`，**1 file / 12 tests passed，exit 0**。包括六个 H2、两个 H3 的切片契约及真实手册与标准在 128K 上下文的预算检查。最后仅更正方案链接，手册与标准测试字节不变，未重复测试或扩大构建。

已验收搜索、导航、证据面板、figure 增强和 native-svg 底座的登记与对应报告一致。原生 Drop 928 返修尚待独立终验、React 2D、P3、044、四类样本全链路和 24/163 篇内容均明确保留为未完成。无新问题或需要用户决策的事项。
