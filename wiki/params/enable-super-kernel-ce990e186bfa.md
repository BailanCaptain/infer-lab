---
id: enable-super-kernel-ce990e186bfa
legacyAnchors:
  一句话: 它优化什么，和前两级开关是什么关系？
  事实表: 对照源码
  为什么存在: 在哪两步生效，为什么写了 true 却没开？
  开了的代价: 启动耗时是谁的账、编译缓存怎么变，放到 GLM 双机能开吗？
title: enable_super_kernel
type: param
summary: >-
  ascend_compilation_config 中的 Super Kernel 优化开关：在编译与 ACL Graph 捕获时提交优化选项与
  scope，把符合条件的静态子 kernel 合并。v0.26 维护快照、v0.30.0 及 main 可用，省略时跟随
  enable_static_kernel；实际生效还受图模式与硬件能力限制。
aliases:
  - ascend_compilation_config.enable_super_kernel
  - 超级内核开关
  - super_kernel_optimize
  - super_kernel_scope
chapters:
  - '16'
origin: seed
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
updated: 2026-11-19T00:00:00.000Z
relations:
  - to: npugraph-ex
    kind: builds-on
    note: 它是 npugraph_ex → static kernel 之上的第三级，融的是什么、为什么要分三级，在那一页
  - to: acl-graph
    kind: builds-on
    note: >-
      第二个生效点在 ACL Graph 捕获期：wrapper 的 runnable 框入 scope，录完再请求
      super_kernel_optimize
sources:
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ascend_config.py#L115
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L113-L134'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L136-L160'
  - 'vllm-ascend@baa023ad:vllm_ascend/compilation/compiler_interface.py#L122-L135'
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L1054-L1064'
  - 'vllm-ascend@baa023ad:vllm_ascend/compilation/acl_graph.py#L246-L252'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1188-L1229'
  - 'vllm-ascend@baa023ad:vllm_ascend/compilation/compiler_interface.py#L245-L255'
  - 'vllm-ascend@baa023ad:vllm_ascend/config_utils.py#L43-L48'
  - 'vllm-ascend@baa023ad:vllm_ascend/device/hardware_profile.py#L287-L308'
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L108-L112
  - >-
    https://docs.vllm.ai/projects/ascend/en/latest/user_guide/configuration/additional_config.html
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/graph_mode.md#L271-L276
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L599-L661'
  - >-
    vllm-ascend@2ed6cbba:docs/source/user_guide/configuration/additional_config.md#L124
  - >-
    https://docs.vllm.ai/projects/ascend/en/v0.26.0rc1/user_guide/configuration/additional_config.html
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L607-L614'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L640-L659'
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/graph_mode.md#L184-L186
  - 'vllm-ascend@baa023ad:vllm_ascend/compilation/acl_graph.py#L210-L213'
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ascend_config.py#L124
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L126
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L588-L596'
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L114
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L123
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L124
  - >-
    raw:sha256-42c8fbc306605cf0e919ba3633fd18873e64133802338c685a530f755989462b.md#L1-L346
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L123-L170'
  - 'vllm-ascend@7d825229:vllm_ascend/compilation/acl_graph.py#L202-L217'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L126
  - 'vllm-ascend@f2f74a16:vllm_ascend/ascend_config.py#L590-L647'
  - 'vllm-ascend@3b318862:vllm_ascend/ascend_config.py#L59-L90'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L545-L605'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/compilation/compiler_interface.py#L244-L255'
  - 'vllm-ascend@baa023ad:vllm_ascend/compilation/acl_graph.py#L66-L111'
  - 'vllm-ascend@baa023ad:tests/ut/test_ascend_config.py#L937-L956'
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L127
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L124
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L112-L170'
  - 'vllm-ascend@c09d3e20:vllm_ascend/compilation/compiler_interface.py#L149-L160'
  - 'vllm-ascend@c09d3e20:vllm_ascend/compilation/compiler_interface.py#L266-L281'
  - 'vllm-ascend@c09d3e20:vllm_ascend/compilation/acl_graph.py#L210-L252'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1310-L1345'
  - 'vllm-ascend@c09d3e20:vllm_ascend/config_utils.py#L43-L50'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L355-L381'
  - >-
    vllm-ascend@c09d3e20:docs/source/user_guide/configuration/additional_config.md#L95-L101
  - >-
    vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/graph_mode.md#L228-L287
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L120-L178'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1518-L1550'
  - 'vllm-ascend@8d6180e2:vllm_ascend/compilation/acl_graph.py#L218-L260'
rawSources:
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-42c8fbc306605cf0e919ba3633fd18873e64133802338c685a530f755989462b.md
  - >-
    raw/sha256-4d26972cc76190b84fb0c4bc4fa8e5dc38bccbff799b1073a88ed88e66a1f7a1.md
  - >-
    raw/sha256-79a5ae22b065a783af11ee034b70e8f7a2a05feeb4589e15b8dcd74952c8e662.md
  - >-
    raw/sha256-b4c233521b02d2783805e7bb877b5cc54f0a1ce018f865c48fe3005500157cba.md
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
  - >-
    raw/sha256-c464f43f6b53bd43e74846ad95a26448484a9ba179597922409ed7774ce99fff.md
  - >-
    raw/sha256-c72498576a170455c135d749651303ce5defbeb08b46a62e6c257bd2f15dcced.md
  - >-
    raw/sha256-c972368829e7e384b3c21d0815797ac0f5e2be6ddf069b67ecd9ccc8e557e677.md
  - >-
    raw/sha256-e224a73e7bf7fcecea30207720d1ad2c4b83c8765a0247f4b252b2fa35c9796d.md
  - >-
    raw/sha256-ebc514e0f60b58ff8115eb677ddc78fa222976b6c86c214942a1d9f8502a3fe7.md
  - >-
    raw/sha256-f0620a0aa51e253e6317b8c200fef748f9a19d4f602343246dd853e3c06121e5.md
---
## 它优化什么，和前两级开关是什么关系？

`enable_super_kernel` 是 `ascend_compilation_config` 中的第三级图编译优化开关（kernel 指一个算子在设备上运行的程序）。前两级先把计算图交给昇腾图编译器、再按固定形状把算子编译成静态二进制；开启 `enable_super_kernel` 后，底层会在已编译的静态算子二进制之上识别可融合子图，把符合条件的相邻子 kernel 合并为一个更大的 Super Kernel 并按依赖关系自动插入内部同步，目的是减少逐个算子下发和调度的等待开销。不兼容的算子可能把融合范围截成多段，它不保证整张网最终只剩单个 kernel，实际融合覆盖率与性能收益仍须在设备上实测（与 static kernel 的分工见 [npugraph_ex](../concepts/npugraph-ex.md)）。

它是**跟随式开关**：配置里只开 `enable_static_kernel` 而省略 `enable_super_kernel` 时，它会自动跟着变成 `true`；且开启它硬性要求同时开启 `enable_static_kernel`（后者又要求开启 `enable_npugraph_ex`）。三级开关的层次关系如下：

| 级别与配置键 | 做什么 | 默认行为与依赖 |
| --- | --- | --- |
| 第一级：`enable_npugraph_ex` | 把计算图交给昇腾图编译器做图级优化 | 默认 `true`；是后两级的基础 |
| 第二级：`enable_static_kernel` | 图捕获时按固定批次形状预编译静态算子二进制 | 默认 `false`；开启时要求 `enable_npugraph_ex` 为真 |
| 第三级：`enable_super_kernel` | 在静态算子二进制上合并符合条件的子 kernel 并插入同步 | 省略时跟随 `enable_static_kernel`；开启时要求 `enable_static_kernel` 为真 |

如果只想开启静态算子、单独关掉 Super Kernel，必须在 JSON 里显式写布尔值 `"enable_super_kernel": false`（若省略这一项，它会跟随 `enable_static_kernel` 自动变为 `true`，见[线上配置文档](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/configuration/additional_config.html)）。下面给出在官方示例基础上补齐图模式的**配置形式示例**（实际可用仍需对应版本、模型图模式与支持 `NPUGRAPH_EX` 的硬件配合，本工作区无 NPU 实机执行验证）：

```bash
vllm serve Qwen/Qwen2-7B-Instruct \
  --compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}' \
  --additional-config '{"ascend_compilation_config":{"enable_npugraph_ex":true, "enable_static_kernel":true, "enable_super_kernel":false}}'
```

## 在哪两步生效，为什么写了 true 却没开？

这三级整体开关与编译期匹配局部子图并替换融合算子的 `fuse_*` 规则分属两层：固定 Ascend manager 的 `fuse_norm_quant`、`fuse_qknorm_rope`、`fuse_muls_add` 只替换对应的几步局部子图（不代表整套编译器只有三种优化；旧 `fuse_allreduce_rms` 入口自 `v0.25.1rc1` 起已移除，详见 [fuse_allreduce_rms](fuse-allreduce-rms.md) 与 [npugraph_ex](../concepts/npugraph-ex.md#怎么找出能合的一段又怎么替换)）。而有效开启 `enable_super_kernel` 后，它会先后参与**图编译期**和 **ACL Graph 捕获期**两个环节：

- **编译期追加优化选项**：`compiler_interface.py` 在 `enable_static_kernel` 为真的分支内部再检查 `enable_super_kernel`，为真时向 `npugraph_ex` 的 `options` 字典写入 `super_kernel_optimize=True` 与 `super_kernel_optimize_options={"dcci_after_kernel_end": [".*"]}`。因为这段逻辑嵌在静态内核分支里面，只要 `enable_static_kernel` 没开就根本走不到这里——这正是配置校验要求 `Super kernel generation requires static kernel to be enabled.` 的原因。
- **捕获期框定 `scope` 并触发优化**：捕获 ACL Graph 时，代码用上下文管理器 `super_kernel_scope("full_model", self.enable_super_kernel)` 包住 `self.runnable(*args, **kwargs)`（关闭时直接执行内部代码，开启时调用 `torch.npu.super_kernel_scope_begin("full_model")` 与 `scope_end("full_model")`）；等整张图录制完成后，再调用 `aclgraph.super_kernel_optimize(optimize_options={"dcci_after_kernel_end": [".*"]})`。注意这里的范围名虽然叫 `full_model`，实际只覆盖该 wrapper 执行的 `runnable`，不能据此认为它覆盖了全部服务步骤；同时，启动日志（`Super kernel optimization is enabled for ACL graph capture.`）只能证明上述优化步骤被调用，要确认实际合并了多少子 kernel 与端到端时延收益，仍须采集性能剖析数据（如对比 `kernel_details.csv` 中的算子数量、耗时及 `Block Dim`）。

排查“明明配了却没生效或直接报错”时，按顺序核对以下四道门槛：

1. **图模式（`cudagraph_mode`）门槛**：当图模式为 `NONE`、不支持的 NPU 图模式，或需要 piecewise 拆分编译的模式（包括默认的 `FULL_AND_PIECEWISE`）时，平台层都会把 `enable_npugraph_ex`、`enable_static_kernel`、`enable_super_kernel` 全部写回 `False`。其中 piecewise 分支在关闭三级开关前还会先检查编译模式是否合法：`v0.26` 维护快照无条件执行 `assert compilation_config.mode == CompilationMode.VLLM_COMPILE`；`v0.30.0` 与 `main` 则只在**编译模式不是 `CompilationMode.VLLM_COMPILE` 且 `VLLM_USE_BREAKABLE_CUDAGRAPH` 开关为假**这两个条件同时成立时才抛出 `AssertionError`（编译模式本身已是 `VLLM_COMPILE` 时，即使该开关为假也不会触发这个异常）。只有进入 `has_full_cudagraphs()` 分支（如按模型支持配置 `FULL` 或 `FULL_DECODE_ONLY`）才会保留这三级开关并清空 `splitting_ops = []`，详见 [ACL Graph](../concepts/acl-graph.md)。
2. **硬件能力降级与硬依赖门槛**：在 Ascend 310P 等不支持 `NPUGRAPH_EX` 的硬件上（`v0.26` 用 `is_310p()` 判断，`v0.30.0` 与 `main` 查硬件画像的 `HardwareCapability.NPUGRAPH_EX`），配置校验会对请求开启的项逐条打出告警，然后把三级开关全部置为 `False`；告警文本在 `v0.26` 中包含 `Ascend 310P`，而在 `v0.30.0` 与 `main` 中改成了 `current hardware profile`，查日志时不能只搜 `310P`。降级处理完成后，若仍开启 `enable_static_kernel` 则断言 `enable_npugraph_ex` 为真，若仍开启 `enable_super_kernel` 则断言 `enable_static_kernel` 为真。
3. **省略键、显式 `None`（JSON `null`）与字符串 `"false"` 的差异**：「不写就跟随」在两代配置里的实现不同——`v0.26` 把参数默认设为 `bool | None = None` 当哨兵，进入 `__init__` 首步若为 `None` 就取 `enable_static_kernel`，因此显式传 `None`（JSON `null`）也会跟随静态内核；`v0.30.0` 与 `main` 迁到 pydantic 后字段类型为非可空 `bool`（静态默认 `False`），改由 `mode="before"` 校验器在输入里**省略本键**且传入 `enable_static_kernel` 时把后者的值抄过去，显式传 `None`（JSON `null`）不算省略，会被布尔类型校验直接拒绝（官方文档 Default 栏写 `Inherits enable_static_kernel` 描述的是省略时的外部行为，不能单看静态字段定义 `False`）。反之，把值写成字符串 `"false"` 时，`v0.26` 不做类型转换、非空字符串判为真（若未开 static 会直接触发依赖断言报错），而 `v0.30.0` 与 `main` 会由 pydantic 宽松转换为 `False`。
4. **版本、早期发布标签与未知键门槛**：`v0.23` 与固定 GLM 双机镜像没有此键，传入时连同拼错的键名都会落入 `AscendCompilationConfig.__init__` 的 `**kwargs` 被静默忽略；`v0.26` 维护快照虽有此键，但早期发布标签 `v0.26.0rc1` 与 `v0.27.1rc1` 均无此键，主线实现自 `v0.28.0.rc1` 才可见，不能只按“版本号不小于 v0.26”或线上文档反推早期标签已支持。到了 `v0.30.0` 与 `main`，`@config` 默认开启 `extra="forbid"`，键名拼错或误传已移除的 `fuse_allreduce_rms` 都会直接报错。

## 启动耗时是谁的账、编译缓存怎么变，放到 GLM 双机能开吗？

- **启动编译耗时要分清 `static_kernel` 与 `super_kernel` 的归属**：有效开启 `enable_super_kernel` 必须同时开启 `enable_static_kernel`。官方文档提示启动图捕获阶段可能因算子数量与模型复杂度多花**几分钟到几十分钟**，这段时间描述的是 `enable_static_kernel` 按批次形状编译静态算子二进制的开销，不能算成 `enable_super_kernel` 单独增加的耗时，也不是任何模型的固定保证值。要测量 Super Kernel 自己的真实增量，必须固定 `enable_static_kernel=true`、只切换 `enable_super_kernel`，对比启动耗时、实际融合数量与吞吐时延；本仓库尚无这组设备实测对照。
- **切换开关会改变编译缓存键**：`AscendCompiler.compute_hash` 把 `torch_npu_version` 与 `enable_npugraph_ex`、`enable_static_kernel`、`enable_super_kernel` 一起算进缓存键（取 SHA-256 前 10 位）。开启与关闭对应不同的缓存键，不能直接共用同一份缓存条目；但如果目标缓存键下已有可用缓存，是否命中由后续缓存读取逻辑决定——切换开关不等于清空已有缓存，也不代表每次切换都必须重跑完整编译时间。
- **放到固定 GLM 双机部署：当前镜像没有这个键**：固定双机镜像 `db701c1f` 的 `AscendCompilationConfig.__init__` 没有 `enable_super_kernel` 参数，写进 JSON 只会被未使用的 `**kwargs` 静默收下，不会启用该功能。即使升级到包含该键的新版本，也还须逐项核对 GLM 专用模型实现、量化、runner、配套 `CANN`/`torch_npu`、图模式与算子支持，不能认为“只要换版本再打开 `enable_static_kernel` 就一定能跑”；固定教程里的 `FULL_DECODE_ONLY` 只说明其配置写法避开了上面的 piecewise 关闭分支，不构成升级后的兼容性证明，也不能把主线局部算子融合的数字当成这项优化的收益。

## 对照源码

下表对照 `enable_super_kernel` 在四个固定版本快照中的字段定义、校验规则与运行时行为：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) |
|---|---|---|---|---|
| 这个键是否存在 | 无（连同拼错被 `**kwargs` 静默吞掉）[C17] | 有（早期 `v0.26.0rc1`/`v0.27.1rc1` 标签无）[C31] | 有 [C39] | 有 [C48] |
| 类型、默认与显式 `null` | — | `bool \| None = None`，省略或传 `null` 均跟随 `enable_static_kernel` [C14] | 非可空 `bool = False`，仅省略且传入 `enable_static_kernel` 时由 before validator 补齐，传 `null` 被拒绝 [!] | 同 `v0.30.0` [C48] |
| 未知键与字符串 `"false"` | 未知键静默忽略；— | 未知键静默忽略；字符串 `"false"` 无转换判为真（未开 static 还会触发 `assert`）[D][!] | `@config` 默认 `extra="forbid"` 拒收未知键；`"false"` 宽松转为 `False` [C44] | 同 `v0.30.0` |
| 硬件降级与硬依赖 | — | 判 `is_310p()`，告警含 `Ascend 310P` 并关三级开关 | 查 `HardwareCapability.NPUGRAPH_EX`，告警含 `current hardware profile` 并关三级开关，随后断言 `super → static → npugraph_ex` [C45] | 同 `v0.30.0` |
| `cudagraph_mode` 关闭分支 | — | `NONE`/piecewise 关三级开关（piecewise 无条件断言 `mode == VLLM_COMPILE`）[C33] | 仅 `mode != VLLM_COMPILE` 且 `VLLM_USE_BREAKABLE_CUDAGRAPH` 为假时抛错 [C43] | 同 `v0.30.0` [C49] |
| 编译缓存 hash | — | 进 `compute_hash` [C34] | 进 `compute_hash` [C41] | 同 `v0.30.0` |

- **机制说明与剖析核验出处**：官方文档 `graph_mode.md`（`c09d3e20#L228-L287`）写明 Super Kernel 在静态算子二进制上识别可融合子图、合并相邻子 kernel 并按依赖插入内部同步，同时区分“启动日志只代表优化步骤被调用”与“通过 `kernel_details.csv` 核对融合覆盖率、`Block Dim` 与耗时” [S47]；`additional_config.md` 将 Default 记为 `Inherits enable_static_kernel` [S46]；`static_kernel` 启动耗时提示见 `graph_mode.md#L184-L186` [S19]。
- **维护分支、发布标签与历史镜像**：`v0.23.0`（`2c59ff10`）与 GLM 固定镜像 `db701c1f`（来源 23）无此键；`v0.26.0rc`（`2ed6cbba`）已合入 PR #15074，但早期发布标签 `v0.26.0rc1`（`f2f74a16`）与 `v0.27.1rc1`（`3b318862`）均无此键（线上 `v0.26` 文档见来源 15、16，不可反推早期标签）[S15]。`v0.30.0` 与 `main` 通过 pydantic 宽松解析布尔字符串并拒收未知键（单测见来源 36）[D]。
- **编译期与捕获期生效位置**：`v0.30.0` 编译期在 `enable_static_kernel` 分支内注入 `super_kernel_optimize=True` 与 `{"dcci_after_kernel_end": [".*"]}`（`c09d3e20:compiler_interface.py#L149-L160`）[C40]；ACL Graph 捕获期用 `super_kernel_scope("full_model", self.enable_super_kernel)` 包住 `self.runnable` 并在录完后调 `aclgraph.super_kernel_optimize(...)`（`c09d3e20:acl_graph.py#L210-L252` [C42]；`main` 见 `8d6180e2:acl_graph.py#L218-L260` [C50]；上下文管理器实现见来源 5）。
- **待核**：本工作区无 NPU 实机环境，尚无固定 `enable_static_kernel=true` 下切换 `enable_super_kernel` 的启动耗时、实际 kernel 数量变化或 GLM 双机 TPOT 实测对照。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendCompilationConfig.enable_super_kernel` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `8d6180e2` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 有 | `2ed6cbba` |
| releases/v0.30.0rc2 | 有 | `7d825229` |
| releases/v0.30.0 | 有 | `c09d3e20` |

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["ascend_compilation_config"]["enable_super_kernel"]` |
| 所属类 | `AscendCompilationConfig` |
| 类型 | `bool` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:124` [C38] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if isinstance(data, ArgsKwargs):
    if data.kwargs is None:
        return data
    kw = dict(data.kwargs)
    if 'enable_super_kernel' not in kw and 'enable_static_kernel' in kw:
        kw['enable_super_kernel'] = kw['enable_static_kernel']
    return ArgsKwargs(data.args, kw)
````

````python
if isinstance(data, dict):
    if 'enable_super_kernel' not in data and 'enable_static_kernel' in data:
        data = dict(data)
        data['enable_super_kernel'] = data['enable_static_kernel']
````

````python
if not get_current_hardware_profile().supports(HardwareCapability.NPUGRAPH_EX):
    if self.enable_npugraph_ex:
        logger.warning('npugraph_ex is not supported by the current hardware profile. Disabling it.')
    if self.enable_static_kernel:
        logger.warning('static kernel requires npugraph_ex, which is not supported by the current hardware profile. Disabling it.')
    if self.enable_super_kernel:
        logger.warning('super kernel requires static kernel, which is not supported by the current hardware profile. Disabling it.')
    self.enable_npugraph_ex = False
    self.enable_static_kernel = False
    self.enable_super_kernel = False
````
