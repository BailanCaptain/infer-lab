# 01-glm-5-3-flash-two-node.md 映射与核验台账

- **源页面**：`wiki/concepts/glm-5-3-flash-two-node.md`（479 行）
- **候选文件**：`docs/reviews/2026-11-15-wiki-restructure/batch-5-2-candidates/01-glm-5-3-flash-two-node.md`（527 行）
- **Frontmatter & Citations 盘点**：
  - `id: glm-5-3-flash-two-node`，`type: feature`，`origin: gap`，`chapters: ['13']`，`order: 90`，`sources: 44 条`（原 41 条 `L16-L67` 逐行 100% 保留，新增来源 42–44 `L68-L71`：Roofline 原始报告 `UCB/EECS-2008-134`、`vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1975-L2002` 与 `vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L1127-L1134`），`relations: 8 条`（`L72-L96` 逐行 100% 保留），`verified: []`，`evidence: C`，`rawSources: 2 条`（`L102-L106` 逐行 100% 保留）。
  - 图表与算式块：5 处 `wiki-diagram`（`glm-two-node-topology`、`glm-two-node-groups`、`glm-two-node-request-route`、`glm-two-node-card-budget`、`glm-two-node-startup`）100% 保留；原 4 个 `calc` 块（`L262-L270`、`L282-L288`、`L294-L301`、`L309-L316`）逐字 100% 保留，另在新增的 Q3/Q4 小节新增 2 个教学推算 `calc` 块（`L340-L350`、`L368-L373`），候选文件合计 6 个 `calc` 块。
  - 行内引用标签：共 `29` 处（`2` 处 `[S1]`、`23` 处 `[C2]`–`[C24]`、`3` 处 `[D]`、`1` 处 `[A]`），全部位于 `## 对照源码`（`L421-L527`），100% 保留。
- **H2 / H3 锚点核对（`headersRemoved: []`）**：
  - 原文全部 9 个 H2 与 13 个 H3（共 22 个标题）原样保留，未删改任何标题文本；在 `## 剩下的显存变成多少 KV cache` 末尾新增 2 个 H3 子节（`### 换成通用 (X, Y, z)：这套池子能同时接多少条请求？` 与 `### 单步延迟的三个理论分量（Roofline 算账框架）`），候选文件合计 9 个 H2、15 个 H3（24 个标题）。

## 段落级重排与扩充映射表

| 原文行号（`wiki/concepts/glm-5-3-flash-two-node.md`） | 原文内容摘要 | 候选文件行号（`01-glm-5-3-flash-two-node.md`） | 变更说明 |
|---|---|---|---|
| `L1-L327` | Frontmatter、`## 部署前提`、`## 为什么是两台机器，不是一台`、`## 16 张卡怎样分组`、`## 一条请求在这 16 张卡上怎么走`、`## 每张卡上放了什么`、`## 剩下的显存变成多少 KV cache` 及前 4 个 H3 子节 | `L1-L331` | Frontmatter `sources` 追加来源 42–44（`L68-L71`）；正文除 `L151` 将 `[上一页](glm-5-3-flash.md)` 措辞调整为 `[模型页](glm-5-3-flash.md)` 外，其余逐字 100% 原样保留 |
| 新增（对应 `044 §3.13` / `000417` 要求） | 新增 `### 换成通用 (X, Y, z)：这套池子能同时接多少条请求？`：给出单请求稳态块数公式 $b(X,Y)=16+\lceil(X+Y+3)/640\rceil$、调度名额 `max_num_seqs=32` 与 `3,855` 块池的双门限截断表（`calc` 块）、单 DP 组满 32 条请求的容量条件 $\lfloor 3{,}855 / b(X,Y) \rfloor \ge 32 \iff b(X,Y) \le 120$（`L352`），以及双机混部 vs 四机 PD 分离的账本边界 | `L332-L354` | 基于现有 640 token/块、KDA 12 块、索引器常驻 3–4 块与 `3,855` 块教学预算推导，不新增源码外事实 |
| 新增（对应 `044 §3.13` / `000417` / `000426` / `000429` / `000438` 要求） | 新增 `### 单步延迟的三个理论分量（Roofline 算账框架）`：依据 Williams/Waterman/Patterson（UCB/EECS-2008-134, §3 与附录 A.1.1，来源 42）在经过缓存过滤的实际 DRAM 传输字节 $Q_{\text{dram}}$ 上定义算术强度；针对 `W8A8` 与 BF16/FP32 混合精度按同精度、同计数口径定义 $T_{\text{compute}}(\{W_p/P_{\text{peak},p}\})$，并将 $T_{\text{comm,exposed}}$ 定义为既未与计算重叠也未与 HBM 访存重叠的暴露通信与下发耗时；明确区分常驻容量与每步实际流量，拆开 KV 常驻存储容量、压缩索引打分读取（来源 44）、`topk_indices` 入选历史读取（来源 43）与 KDA 状态读写四类口径；`calc` 块（`L368-L373`）采用独立假定单步 HBM 读写总流量 $Q_{\text{assumed}} = 4 / 16 / 24\text{ GiB}$ 做带宽项代算示意 | `L356-L373` | 严格遵循 Roofline 一手定义、固定源码（来源 42–44）与 `one-request.md` 边界 |
| `L328-L436` | `## 启动时发生了什么`、`## 这套部署给后面各章留下的后果`、`## 对照源码`（`### 怎么开`、`### 会报什么错`、`### 开销和什么时候别开`） | `L375-L483` | 逐字 100% 原样保留 |
| `L438-L446` | `### 版本差异`（含 `L440-L442` `**v0.30.0rc2 保留双机混部配方，也另给出四机 A2 的 PD 分离配方。**` 补丁段） | `L485-L492` | 将原 `L440-L446` 的四版本信息（`v0.23`、`GLM 专用镜像 db701c1f`、`v0.30.0rc2 7d825229`、`main baa023ad`）合并为四版本对比表，完整保留双机混部 vs 四机 PD 分离（`MooncakeConnectorV2`、`MRV1`、`KPool` 拒绝 `PCP/DCP`、`models/glm5next` 及容量重算边界）全部事实与条件 |
| `L448-L479` | `### 源码位置`（22 行源码定位表与版本/补丁/头数约束及来源 42–44 证据说明） | `L494-L527` | 原文 `L448-L479` 逐字 100% 原样保留，末尾 `L527` 补齐来源 42–44 定位说明 |
