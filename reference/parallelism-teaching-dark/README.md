# 大模型并行策略教学图（深色知乎风格·高清版）

本套共 19 张竖版图：PNG 为 2400×4800，SVG 可无限放大。技术口径以官方文档、论文和固定源码为准；知乎原文只用于视觉风格与章节组织参照。

## 最重要的结论

用户提出的 `TP2 · PP2 · PCP2 · DP2 · DCP2` 在 current vLLM Ascend 不能直接启动：

1. upstream `ParallelConfig` 拒绝 `PCP>1 × DP>1`；
2. Ascend current 文档/源码拒绝 `PCP>1 × PP>1`；
3. Ascend current MLA/GQA attention backend 拒绝 `PCP>1 × DCP>1`。

名义 worker 数仍是 `TP×PP×PCP×DP = 16`；DCP 复用既有 rank，不再乘成 32。图 14 给出逐项验算。为避免乱编，64K 教学拆为：

- Path A：`TP2·PP1·PCP2·DP1·DCP1`，只讲 PCP current DualChunkSwap 机制快照；不做生产认证。
- Path B：`TP2·PP2·PCP1·DP2·DCP2`，讲 PP/DP/DCP 的 config-level 合法几何；具体模型的 PP+DCP 组合仍标注需实机验证。

## 推荐授课顺序

| 页 | 文件 | 教学目标 |
|---:|---|---|
| 00 | `00-parallelism-map.png` | 先按“切什么”建立九种并行的坐标系，解释 `[S]/[D]/[A]/[!]`。 |
| 01 | `01-tp-concept.png` | TP 切层内权重/heads；同一批 token rows；经典 Attention/MLP 路径。 |
| 02 | `02-tp-matrix-communication.png` | 用矩阵 shape 解释 Column 输出拼接语义与 Row partial 求和语义。 |
| 03 | `03-pp-pipeline.png` | PP 切连续层深度；TP2×PP2 rank group；推理 bubble。 |
| 04 | `04-dp-request-routing.png` | 推理 DP 切请求/批次，不切单请求；与训练 DDP 分开。 |
| 05 | `05-ep-routing.png` | EP 切 expert 权重；Top-k assignment、dispatch、local expert、weighted combine。 |
| 06 | `06-dpa-attention-ep.png` | DPA 用 DP groups 做 Attention、同一物理 ranks 在 MoE 层重组成 EP。 |
| 07 | `07-sp-classic.png` | 经典 Megatron SP 的 LN/Dropout sequence shard 与 AG/RS 生命周期。 |
| 08 | `08-cp-context.png` | CP 从输入到整层持续切 sequence；KV AllGather 与 Ring 是两类实现。 |
| 09 | `09-sp-vs-cp.png` | 把 SP/CP/PCP/DCP 的对象、生命周期和通信边界一次对齐。 |
| 10 | `10-pcp-dual-chunk.png` | current MRV2 的 `2×PCP` DualChunkSwap；64K 的 4×16K 镜像分配。 |
| 11 | `11-pcp-attention-status.png` | PCP local Q 仍需全局 K/V；区分候选策略、current cache-write 与版本成熟度。 |
| 12 | `12-dcp-kv-layout.png` | DCP KV cache 的 interleaved layout；`B=I=128`、512 blocks、每 rank 256 blocks。 |
| 13 | `13-dcp-lse-merge.png` | DCP 每 rank 算 local KV，使用 partial O/LSE 做 softmax-correct merge。 |
| 14 | `14-target-topology-audit.png` | 原五维目标的 worker 数、三重硬阻断、docs↔HEAD 漂移。 |
| 15 | `15-64k-path-a-pcp.png` | Path A：一条 64K 在 PCP2×TP2 上如何分 rows、写 KV、恢复顺序与采样。 |
| 16 | `16-64k-path-b-topology.png` | Path B：8 workers 的 DP2 replicas、PP2 stages、TP2/DCP2 groups。 |
| 17 | `17-64k-path-b-flow.png` | Path B：完整 64K Prefill、first token 与后续 Decode 的逐步流。 |
| 18 | `18-teaching-recap.png` | 并行选择顺序、目标结论与部署前八项复核清单。 |

## 64K 的统一定义

本套图固定：

```text
64K = 64 × 1024 = 65,536 tokens
```

因此：

- PCP2 current DualChunkSwap：4 个 16,384-token chunks；PCP0 拿 C0+C3，PCP1 拿 C1+C2。
- DCP2 且 `B=I=128`：共 512 KV blocks；两个 DCP ranks 各存 256 blocks=32,768 token positions。
- 下一 Decode step 的新输入 position 为 65,536；`65,536 mod 256 = 0`，故先落 DCP0 的 128-token stripe。

## 授课时务必说清的边界

- DP2 只决定整请求进入哪个 replica；一条 64K 不会被 DP 拆成两个 32K。
- PP2 只切连续 layers；不切 sequence。
- TP2 只切层内支持的 weights/heads；不切独立 request replicas。
- PCP2 才切 Prefill token-row computation；current MRV2 是 head+tail 镜像块，不是连续前后半。
- DCP2 切的是 KV-cache token positions；它不增加 worker rank。
- PCP 的 upstream 两种 Attention 策略仍标为 active development；不能画成 Ascend 两个稳定可切参数。
- `latest/main` 的 PCP 用户指南、设计文档与 HEAD 源码目前不同步；任何“可启动”结论必须固定版本后实测。

## 证据文件

- `SOURCE_INDEX.md`：全部 `[Sxx]` 一手 URL、固定 commit 与使用范围。
- `CLAIM_LEDGER.md`：全部 `[D01–D45]` 推导和 `[A01–A10]` 教学假设。
- `00-contact-sheet.png`：全套缩略总览。

## 文件用途

- PNG：直接插入文档、课件或网页。
- SVG：需要再次排版、放大输出或修改文字时使用。
- 生成脚本：完整版压缩包内保留 `generate_teaching_dark.py`，可复现所有 SVG/PNG。
