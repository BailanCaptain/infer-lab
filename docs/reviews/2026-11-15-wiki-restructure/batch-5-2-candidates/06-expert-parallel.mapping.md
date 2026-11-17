# 06-expert-parallel 候选映射说明

## 1. 基本信息
- **源页面**：`wiki/concepts/expert-parallel.md`（758 行，分类：`B1`）
- **候选文件**：`docs/reviews/2026-11-15-wiki-restructure/batch-5-2-candidates/06-expert-parallel.md`（758 行）
- **Frontmatter 保真**：保留 `id: expert-parallel`、`type: feature`、`origin: gap`、`chapters: ['14']`、`order: 10`、`evidence: C`、全部 `90` 条 `sources`（`L19-L122`，其中 `L20, L22, L26, L54, L59, L63, L65, L67, L69, L71, L73, L75, L101, L103` 为 `>-` 跨行续写）、`3` 条 `verified`（`L123-L126`）、`5` 条 `relations`（`L128-L143`）、`2` 条 `rawSources`（`L147-L151`）。

## 2. 段落重排与补丁清理映射
- **重排 `### 怎么开` 中被 `--all2all-backend` 表格隔断的 `--enable-expert-parallel` 核心开关说明（恢复「上一行完整组合」的直接指代）**：
  - 将 `enable_expert_parallel` 默认值与「入口与取值」两段（源 `L594-L596` → 候选 `L584-L586`）前移至紧接 `L582`（「两端启动参数的核心组合是 `--tensor-parallel-size 8 --data-parallel-size 2 --data-parallel-size-local 1 --enable-expert-parallel`...」）之后，使 `L586` 中「两端都使用上一行完整组合」直接承接核心启动命令段落；将上游 `--all2all-backend` 对照表与说明（源 `L584-L592` → 候选 `L588-L596`）移至其后。
- **清理 `### 版本差异` 的粗体补丁起手句，恢复代码与张量形状反引号**：
  - `### 版本差异`（源 `L686` → 候选 `L686`）：去掉突兀的粗体补丁起手句，自然衔接到 `v0.30.0rc2` 的 EP 通信选路条件说明。
  - 恢复正文与 `## 对照源码` 中被剥离的张量形状、变量名、CLI 选项与配置字段反引号（如 `[4,4096]`、`[4,288]`、`[1,4096]`、`[1,288]`、`[1,8]`、`[N_r,4096]`、`[N_r,2048]`、`[8,4096]`、`[6048,4096]`、`[6048,288]`、`[12096,4096]`、`[12096,288]`、`[12096,8]`、`N_r`、`--enable-expert-parallel`、`--no-enable-expert-parallel`、`ParallelConfig.all2all_backend`、`allgather_reducescatter`、`deepep_high_throughput`、`deepep_low_latency`、`flashinfer_nvlink_one_sided`、`two_sided`、`ALLGATHER`、`ALLTOALL`、`MC2` 等）。

## 3. 零丢失自检清单
- **`headersRemoved: []`**：源页面全部 9 个 H2 与 22 个 H3 标题（共 31 个标题）100% 保留。
- **冻结 3D 场景、图表与公式块保真**：
  - 冻结 3D `wiki-scene` 块逐字节保留：`parallel-mechanism:7`（`L357-L359`）。
  - 8 个 `wiki-diagram` 块原样保留：`expert-parallel-intuition`（`L162-L164`）、`expert-parallel-vs-tp`（`L191-L193`）、`expert-parallel-flow`（`L221-L223`）、`expert-parallel-wait`（`L284-L286`）、`expert-parallel-assign`（`L379-L381`）、`expert-parallel-fit`（`L446-L448`）、`expert-parallel-split`（`L485-L487`）、`expert-parallel`（`L505-L507`）。
  - 8 个 `calc` 块逐字节保留：`示意模型的专家权重放不放得下（数为示意）`（`L182-L187`）、`跟着「苹果」走一遍（数为示意）`（`L231-L241`）、`一张卡每层发出、收回多少（数为示意）`（`L268-L276`）、`4 个 token 的负载（数为示意）`（`L290-L297`）、`「苹果」这一层 MoE 的输出（数为示意）`（`L321-L326`）、`一个 token 的 MoE 输出`（`L406-L411`）、`场景 M 与纯 decode 对照的每卡账`（`L529-L558`）、`同一批专家权重的 TP16 与 EP16 分法`（`L658-L668`）。
- **门禁与证据核对**：
  - `sources` 数组共 `90` 项、`verified` `3` 项、`relations` `5` 项、`rawSources` `2` 项无删减；全部行内引用标记共 `25` 次出现、`21` 种唯一标记（`[C3]`、`[C37]`、`[S2]`、`[C18]`、`[C30]`、`[D]`、`[C38]`、`[C20]`、`[C21]`、`[C23]`、`[C22]`、`[C24]`、`[S1]`、`[C4]`、`[C8]`、`[C33]`、`[C10]`、`[C14]`、`[C7]`、`[C9]`、`[C11]`，其中重复出现标记已按原位置逐一保留）100% 保留。
