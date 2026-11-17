# 03-enable-super-kernel-ce990e186bfa 改写映射说明（Old-vs-New Mapping）

- **正式版原文件（保持未改动）**：[enable-super-kernel-ce990e186bfa.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/params/enable-super-kernel-ce990e186bfa.md)（`224` 行，`37` 条 `sources`，`SHA256 = c2cd68ecb004004228ef280b825812ef00c45cd656b76f4f754f17d18292a83d`）
- **前置参考提炼稿（Task 558，`000713` 校准版）**：[03-enable-super-kernel-ce990e186bfa.md](file:///C:/Users/-/Desktop/infra-view-new/docs/reviews/2026-11-15-wiki-restructure/rewrite-briefs/03-enable-super-kernel-ce990e186bfa.md)（`93` 行，`SHA256 = fcfdba7b19ee5e722004259326690681235245c562592b626b5e60b36b4fa2bd`）
- **独立复审报告（`000725`）**：[721-super-kernel-factual-review.md](file:///C:/Users/-/Desktop/infra-view-new/docs/reviews/2026-11-15-wiki-restructure/721-super-kernel-factual-review.md)
- **候选重写稿（Task 042，`000725` 返修版）**：[03-enable-super-kernel-ce990e186bfa.md](file:///C:/Users/-/Desktop/infra-view-new/docs/reviews/2026-11-15-wiki-restructure/candidates/03-enable-super-kernel-ce990e186bfa.md)（`234` 行，`43` 条 `sources`，`SHA256 = c18906ea533a6db74726d92089dcd7e8f451379761b2fcf87806d7b8bb8e1132`）
- **配图与 3D 边界**：本页无既有 2D `wiki-diagram` 或 3D `wiki-scene`；按写作标准 §页面格式与信息层级（参数页靠清晰文字、对比表与源码对照即可讲清，不硬塞凑数流程图），不新增 2D 图。

## 1. 保留不动的契约与保护区

1. **自动生成尾部 100% 逐字节保护（[review.ts:459-464](file:///C:/Users/-/Desktop/infra-view-new/scripts/wiki/review.ts#L459-L464)）**：
   - `## 版本谱系`（候选稿 `L177-L186`）与 `## 参数定义（自动生成）`（候选稿 `L188-L234`）与正式页 `L167-L224` 100% 逐字节相同（`lineageSection` 与 `protectedParamSection` 相等，含 `L197` `[C30]` 指向第 `30` 条 `sources` 即 `vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L126`）。
   - `## 对照源码`（`L156-L175`）置于 `## 版本谱系` 之前，由 `rehypeCollapsibleSourceSection`（`markdown.ts:387-428`）仅折叠至下一个 `<h2>`（`## 版本谱系`）为止，不会吞掉自动生成尾部。
2. **Frontmatter 契约**：
   - `id: enable-super-kernel-ce990e186bfa`、`title: enable_super_kernel`、`type: param`、`origin: seed`、`verified: [releases/v0.23.0, releases/v0.26.0rc, main]`、`evidence: C`、2 条 `relations`（`npugraph-ex`、`acl-graph`）与 11 条 `rawSources` 原样保留；
   - 前 `37` 条 `sources`（`L32-L83`）顺序与内容严格不变；`L84-L87` 保留 4 条 `vllm-ascend@7d825229` 源码锚点（`config_utils.py#L43-L50` `[C38]`、`device/hardware_profile.py#L315-L337` `[C39]`、`platform.py#L1305-L1343` `[C40]`、`compilation/compiler_interface.py#L241-L255` `[C41]`）；`L88-L91` 追加 2 条 `vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/graph_mode.md` 官方特性指南片段（`#L228-L242` `[S42]` 与 `#L278-L286` `[S43]`），共 `43` 条 `sources`。
3. **入站链接与锚点**：全库仅 [npugraph-ex.md:274](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/npugraph-ex.md#L274) 链接本页且无 `#anchor`，无入站锚点锁死。

## 2. 段落级前后对照与改造说明（闭合 `721` 三项 P2）

| 候选稿位置 | 对应正式旧稿位置 | 对应 `558` 提炼与 `721` 复审 | 改造要点 |
|---|---|---|---|
| `L116-L134` `## 它优化什么，和前两级开关是什么关系？` + 3 行开关关系小表 + `vllm serve` 配置形式示例 | `L108-L115`（原 `## 一句话`）+ `L151-L159`（配置示例） | `721` P2-3 + 提炼第一屏 | **彻底瘦身首屏并讲透优化机制**：按 `graph_mode.md#L228-L242` 讲明“在已编译的静态算子二进制之上识别可融合子图，把符合条件的相邻子 kernel 合并为一个更大的 Super Kernel 并按依赖自动插入内部同步，以减少逐个算子下发和调度的等待开销；不兼容算子可能截断范围，实际覆盖率与收益须实测”；用紧凑 3 行小表（无需横向滚动）立住 `enable_npugraph_ex → enable_static_kernel → enable_super_kernel` 三级关系与跟随行为，紧接给出补齐 `FULL_DECODE_ONLY` 的 `vllm serve` 配置形式示例；把 `fuse_*` 细目、validator 内部实现与早期发布标签后移。 |
| `L136-L148` `## 在哪两步生效，为什么写了 true 却没开？` | `L130-L141`（原 `## 为什么存在`）+ `L145, L163` | `721` P2-1 / P2-2 / P2-3 | 区分 `fuse_*` 局部融合与编译期+捕获期两步配合，并按 `graph_mode.md#L278-L286` 区分“启动日志代表优化步骤被调用”与“通过 `kernel_details.csv` 对比实际算子数和时延”；四道排障门槛中：① **闭合 P2-1**：明确 `v0.30.0rc2`/`main` 仅在**编译模式不是 `CompilationMode.VLLM_COMPILE` 且 `VLLM_USE_BREAKABLE_CUDAGRAPH` 开关为假**联合成立时才抛 `AssertionError`（编译模式已是 `VLLM_COMPILE` 时不报错），与 `v0.26` 无条件断言区分；② **闭合 P2-2**：明确省略本键与显式传 `None`（JSON `null`）的差异（`v0.26` 接受 `bool \| None` 故显式 `None` 仍跟随 `enable_static_kernel`；`v0.30.0rc2`/`main` 为非可空 `bool`，仅在省略本键时补齐，显式传 `null` 会被布尔校验拒绝）。 |
| `L150-L154` `## 启动耗时是谁的账、编译缓存怎么变，放到 GLM 双机能开吗？` | `L147-L150, L161, L165`（原 `## 开了的代价` 剩余项） | 提炼第四屏 (`L66-L69`) | 清理原 `L149` 生贴的“来源19...”裸审计备注，算清 `static_kernel` 启动编译几分钟到几十分钟与 Super Kernel 增量测量的归属边界、四因子编译缓存 hash 行为，以及固定 GLM 双机镜像 `db701c1f` 无此键（被 `**kwargs` 静默收下）与升级后需逐项核对的边界。 |
| `L156-L175` `## 对照源码`（含 9 行四版本完整矩阵表 + 源码锚点列表） | `L116-L129`（原 `## 事实表`）及原散布正文的源码锚点 | `721` P2-3 + 提炼第五屏 | 将 9 行四版本完整长矩阵移入默认折叠的 `## 对照源码`（消除首屏宽表横向滚动），并集中收纳 `43` 条 `sources` 的版本演进、显式 `None`/`null`、piecewise 联合条件与剖析核验出处（教学主干零机器角标；全页共 `29` 处标记 `≤ 30`，`[C]` 占比 `19/29 = 65.52% < 80%`）。 |
| `L177-L234` `## 版本谱系` + `## 参数定义（自动生成）` | `L167-L224` | 保护区 (`L21-L23`) | 与正式页 `L167-L224` 100% 逐字节一致。 |
