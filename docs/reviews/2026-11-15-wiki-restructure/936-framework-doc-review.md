# 931 框架文档同步独立检视

结论：**Changes Requested，0 P1 / 1 P2**。用户 741/839 授权范围内的三份框架文档，主体顺序与已验收成果登记正确；仅需修正一个会让写手生成无效图规格的字段说明，并一并澄清宽度与历史现状措辞。来源交付 `0001794847637339-000936-ca6c924a`，原派工 `0001794847020156-000932-ca97bacc`。

2026-11-16 16:50 UTC，砚砚 / gpt-6-astra。实际文件 SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| `wiki/HANDBOOK.md` | `d5fc709b77d5bec11fd4a9a6a2d30d8d80d3a4a109be6ec7ef26731746463df2` |
| `docs/wiki-writing-standard.md` | `be6ae65b4ee75b397ee8cd2eee550a1e31cd34b51b2d9d51bbb3407e81945af4` |
| `docs/plans/2026-11-14-progressive-restructure-and-fix-plan.md` | `5703db829d82afe0fc36acfe33c5dc80e227497e13a19c0613a56e9af47293e9` |

## P2：font 路径与实际严格 schema 不一致

`wiki/HANDBOOK.md:163` 在 `links / fans` 一行中写“标签与连接点支持 `font: sans | mono`”。真实 `scripts/wiki/figure.ts:553-585` 的 `links[]` 没有 `font` 且为 strict；`font` 仅在 `texts[]`、`items[]` 和 `sketches[].shapes[kind=text]` 上支持。现有箭头也没有独立文字标签字段，按该句在箭头对象中填写 `font` 会被拒绝。

root 独立运行 schema 探针，`%TEMP%/infra-wiki-review-20261115/936-doc-schema-probe.json`：`links[0].font = mono` 返回 `unrecognized_keys`；`texts[].font` 和 `items[].font` 均通过。此处应移出箭头行，并在文本相关说明里列出三个真实可用字段路径；`bend` 保留箭头行，并说明与 `curve` / 非空 `via` 不能同用。

## 同轮文字校准

- 标准 `L61` 与方案 `L357/L446` 的“`size` ≤900px”改成明确的 `size: [width, height]`、`width <= 900`、两维正数。真实 `nativeSvgSpecSchema` 接受 `[600,1200]`；900 不约束高度，避免影响竖排图。
- 方案 `§5.2` 的 legacyIds 段落及包4触发问题仍以现在时写 `reader-store/WikiPage` “仅匹配精确 id”，但本轮已登记其通过验收。把旧原因标为改造前基线，当前行为链接已审报告；不删除历史问题与未完成 P3。

## 已核对与边界

实际对照 `754-708-independent-review.md`、`897-figure-foundation-review.md`、`910-native-svg-foundation-rereview.md` 及现行 `lint.ts` / `figure.ts` / `diagrams.ts`：参数页不再固定四标题但仍要求有效说明正文、原生 SVG 与派生图的 CLI 差异、图精确 pin 与 AC11、3D 冻结及框架/内容分期均保持。原生 Drop 两 P2、React2D/P3/044/四类实际 E2E 没有被提前记完成。

本次是框架说明事实校准，不重新做文章教学重写，不扩大代码修改。修正后跑现有 `handbook.test.ts` 并检查最终三份 SHA 即可；无需新建测试或重新跑全库构建。
