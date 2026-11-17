# 751 第一轮检索底层独立复审

- 审阅者：砚砚（gpt-6-astra）；2026-11-16。
- 接受来源：`0001794823016139-000782-f8616af9`；授权：用户 `000741`。
- Git HEAD：`f44c953f99e416b2dc174c3b2ad31a729b91d30f`，审阅的是该 HEAD 上下列未提交文件的精确字节。
- 结论：**本轮底层代码 Approved，0 P1 / 0 P2**。Task 751 保持 doing；Cmd/Ctrl+K 界面、键盘/焦点操作和真实浏览器网络验收仍须在下一短轮交付。

## Why

按“框架先行、内容后置”核验共用分词、预编译索引及静态/实时读取链。不能用候选文章完成度替代框架验收，也不能保留首次搜索下载全部正文并在浏览器重新构建索引的退路。

## What

已实际检视分词与检索、索引序列化/还原、Zod 载荷约束、构建虚拟模块、服务端锁定快照、reader-store 安装/刷新竞争及全部真实调用点。未发现剩余 P1/P2。

`777` 两项问题闭合：同 revision 从懒载目录升级完整快照时同时安装正文和图；缺失或失配索引明确拒绝，既不拉取全库正文，也不在浏览器调用 buildIndex，旧可用状态保留。包括先 304 将 mode 改为 local 再安装完整快照的路径，订阅者收到的是完整图文状态。

## Evidence

以下均为砚砚本轮实跑，原红灯探针和旧回环结果保留，未覆盖：

- `node node_modules/vitest/vitest.mjs run` 指定 retrieve、reader-store、schema、corpus-retrieve、WikiPage、reader-build、reader-skip、snapshot、snapshot-shared、snapshot-diagram、chat-snapshot、answer-quality、wiki-context、navigation、trace-eval：**15 files / 119 tests passed，exit 0**。日志：`%TEMP%/infra-wiki-review-20261115/782-search-regression.log`。
- `tsc -b --noEmit --pretty false`：exit 0；11 文件 Biome：exit 0，0 error、1 条既有 `reader-plugin.ts:79` optional-chain 风格提示；`tsx scripts/check-deps.ts`：exit 0。
- 最终代码重新执行隔离静态构建：`vite build --outDir %TEMP%/infra-wiki-review-20261115/782-search-dist`，exit 0；日志 `782-search-build.log`。未覆盖既有 dist 或启动/停止现有预览服务。
- `751-reader-search-green.mts/.json`：exit 0。缺索引正文下载数 0，同版本图文安装的额外正文下载数 0，订阅者完整图文为 true，非法快照保留旧状态为 true，错误版本后第二次索引加载可成功。
- **在最终 retrieve `262dc261…` / schema `b89d8f07…` 上重跑** `782-search-roundtrip-probe.mts/.json`：实读 **163 页**，**2397 个查询**在序列化、JSON 传输、反序列化前后结果及分数零失配；RoPE/W8A8/AllReduce/FP8量化/CLI 五组仅正文含词夹具均可召回；序列化页面不含正文/AST/SVG。原始 JSON 6,561,670 bytes。执行前后代码 SHA 一致。

## 精确审定 SHA-256

| 文件 | SHA-256 |
| --- | --- |
| src/content/wiki/retrieve.ts | 262dc261f6e0ba92a1a3434f87255ad05d7dc8552da79b12bf5273a84423d60d |
| src/content/wiki/schema.ts | b89d8f07300ea745cba64366b45edce4027089a2e9d44d81050f17f7ac1255df |
| src/content/wiki/reader-store.ts | 47405e8bf9367303031dec0e57c93de0113332522d286d89c01f7265e333d621 |
| src/content/wiki/index.ts | 4d46841a0a073c57306fac6b66aab35beded1988a624c8202d8afa6cf21073fb |
| scripts/wiki/reader-plugin.ts | 029570b114d73aafe19166165a10f7f9061f525e050355f44352c26718d3788c |
| src/wiki-snapshot.d.ts | 14598d74969038c09cac4f0502816359cb23d627b68ff950ad59abc1c7bd5199 |
| server/snapshot.ts | 5fb85e6555e9b8e2736b996a6f0edad520c910d9b40d2c0e0a0d82bc29d6c20b |
| src/content/wiki/retrieve.test.ts | bae84c3e20fcb879554f15381bcea3c3b7db885e717bbb74021b1205fec8f492 |
| src/content/wiki/reader-store.test.ts | 5a5270a7d3ad72713e902fd5997b0bf455d4a86ce6298e7819df630a1dbebf6e |
| src/app/pages/WikiPage.test.ts | 28d5e7e716da05c741253831e8e850340887dc7bf065b22f065bebf3358e2296 |
| server/reader-build.test.ts | 5bad7c3a2d2d008bfe86b35a0aae763539ebfb96efebd65e3f09984501820321 |

## Tradeoff / Open Questions

当前索引仍约 6.6 MB 原始 chunk；本结论不替代浏览器首次搜索耗时、网络请求和失败重试的实际测量。下一轮按已有界面草图完成真实操作，不在没有性能证据时追加编码压缩。缺索引的新旧格式混用明确报错，不伪装为完整检索。原有服务、210 缓存、旧 Review 和冻结 3D 不在本轮修改范围。无需用户决定的问题：无。
