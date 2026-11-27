---
id: npu-platform
title: NPUPlatform：配置校验与设备实现选择
type: feature
legacyAnchors:
  落到-glm-双机这一层交出的名字和数: 混合状态怎样改变块长与注意力选择
summary: >-
  昇腾插件交给 vLLM 的平台实现。启动时它按组合校验整份配置、就地改写，再答出 Worker 类、注意力后端与图包装的类名；也是「查不到设备显存以后默认
  token 预算怎么定」的唯一推导处。
aliases:
  - NPUPlatform
  - platform.py
  - 平台类
  - 昇腾平台类
  - PlatformEnum.OOT
  - check_and_update_config
  - get_device_total_memory
  - get_attn_backend_cls
  - worker_cls
  - 默认 token 预算
  - 回退档
  - refresh_block_size
chapters:
  - '10'
order: 60
sources:
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L128-L206'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L1330-L1340'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2010-L2051'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L275-L331'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L338-L428'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L430-L448'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L450-L500'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L500-L528'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L529-L634'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L1054-L1060'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L636-L700'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L805-L886'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L1396-L1446'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L74-L84'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L228-L234'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/transformers_utils/configs/glm5_next.py#L186-L192
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2300-L2335'
  - 'vllm@0fc695fc:vllm/config/scheduler.py#L38-L64'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L642-L652'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2484-L2566'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L274-L426'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L225-L238'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L457-L495'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1491-L1502'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1232-L1248'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - 'vllm@0fc695fc:vllm/config/vllm.py#L850-L860'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L1880-L1905'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L150-L160
  - 'vllm@0fc695fc:vllm/model_executor/layers/fused_moe/config.py#L1255-L1260'
  - 'vllm@f7e62e3d:vllm/envs.py#L1143-L1148'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L175-L180'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2372-L2377'
  - >-
    vllm@0fc695fc:vllm/transformers_utils/model_arch_config_convertor.py#L252-L308
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_config.py#L14-L30
  - 'vllm@0fc695fc:vllm/config/cache.py#L46'
  - 'vllm@0fc695fc:vllm/config/cache.py#L231-L239'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L338-L480'
  - >-
    raw:sha256-1dc31584af8351da9ceeef16c9e41373f5abd84c2501b7f0f7b4f67dd4866b6d.md#L1-L1290
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1625-L1711'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1714-L1783'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L893-L900'
  - 'vllm-ascend@baa023ad:vllm_ascend/device/hardware_profile.py#L255-L268'
  - >-
    https://www.modelscope.cn/api/v1/models/Eco-Tech/GLM-5.3-Flash-w8a8/repo?Revision=9e55cbc8e2b19e20c63b08b916d2582f25a22504&FilePath=config.json
  - 'vllm-ascend@db701c1f:vllm_ascend/transformers_utils/configs/glm5_next.py#L335-L424'
  - 'vllm@0fc695fc:vllm/config/model.py#L1768-L1811'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_speculative_config.py#L120-L154'
  - 'vllm@0fc695fc:vllm/config/model.py#L751-L758'
  - 'vllm@0fc695fc:vllm/config/model.py#L1646-L1648'
  - 'vllm@0fc695fc:vllm/transformers_utils/model_arch_config_convertor.py#L345-L363'
  - 'vllm@0fc695fc:vllm/transformers_utils/model_arch_config_convertor.py#L581-L613'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L478-L504'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L621-L633'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L372-L377'
  - 'vllm@0fc695fc:vllm/config/speculative.py#L674-L694'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L230-L244'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L232-L245'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L478-L525'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1365-L1375'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L260-L273'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L606-L683'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1570-L1580'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L2700-L2740'
  - 'vllm@ba15685a:vllm/engine/arg_utils.py#L2985-L3030'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: vllm-platform-interface
    kind: builds-on
    note: 先理解平台契约：谁在问、当前平台怎么选出来
  - to: platform-plugin-registration
    kind: builds-on
    note: NPUPlatform 类路径由 vllm.platform_plugins 入口点返回后懒加载实例化
  - to: hardware-devices
    kind: builds-on
    note: NPUPlatform 按 A2 / A3 / 310P 等硬件画像校验并行、图模式与量化组合
  - to: cann-hccl
    kind: builds-on
    note: 平台对外交出 NPUCommunicator 类并协调设备通信器选择，底层通信库见 HCCL 页
  - to: kv-cache-spec
    kind: builds-on
    note: 平台在此就地写回 128 块长或豁免混合模型 640 块长，五种块大小消歧见缓存规格页
contradicts: []
updated: '2026-11-19'
origin: gap
rawSources:
  - >-
    raw/sha256-1dc31584af8351da9ceeef16c9e41373f5abd84c2501b7f0f7b4f67dd4866b6d.md
  - >-
    raw/sha256-deeaac288e4901b0b767fc1a62fe08407cceb4040cf308ba9e3e8654a4244bce.md
---

## 你写在命令里的配置，为什么不是最后生效的那一份

**`NPUPlatform` 是昇腾插件交给 vLLM 的平台实现。** 启动时它按 `HardwareProfile` 校验整份汇总配置——不支持的组合当场报错，该补齐的默认值就地写回——再在被问到时答出 Worker、注意力后端与图包装等实现类名。[Platform 契约](vllm-platform-interface.md)规定上游怎么问、当前平台怎么选出来；本页讲昇腾这一侧答了什么、改了什么。

先看 `v0.30.0` 主基线下标准 **Qwen3** 启动时 `NPUPlatform` 完成的三步接管：

```wiki-diagram
file: platform-surface-qwen3
```

图分三步，对应两个时刻：

1. **硬件画像与组合校验（启动期）**：结合 `HardwareProfile`（识别 A2 / A3 / 310P 等芯片能力）检查并行、图模式与特性组合，不兼容的参数组合在建通信组与加载权重前直接拦截。
2. **平台默认值就地写回（启动期，同一次 `check_and_update_config` 调用）**：`worker_cls` 为 `"auto"` 时，按 `HardwareProfile.default_worker_cls` 选定常规 `NPUWorker`（310P 选专用 Worker，开启且硬件支持 Xlite 时选 `XliteWorker`）。Model Runner 在 `v0.30.0` 未显式设 `VLLM_USE_V2_MODEL_RUNNER` 时保持第一代，显式打开才切第二代 [Model Runner V2](model-runner-v2.md)（`main` 则在入口直接锁定 V2）。非混合模型未传块长，或开启前缀缓存 / chunked prefill 且块长不为 `128` 时，默认 `block_size` 写回 `128`。未显式指定图捕获尺寸或上限时，平台还会选定图档位并收敛默认最大捕获尺寸（如封顶 `512` 且不超过单步预算）。校验与改写穿插执行：后段检查失败时前面的就地改写已发生，启动仍立即中止。
3. **建层时统一答复后端（Worker 起卡后）**：模型建层时调用 `get_attn_backend_cls`，标准 **GQA**（[分组查询注意力](gqa.md)，如 `Qwen3-8B` 全 36 层或 `Qwen3-30B-A3B` 全 48 层）统一绑定 `AscendAttentionBackend`，不需要异构层自带私有后端绕行。

## 为什么这层非要能改配置，代价在哪

**只读属性表挡不住昇腾硬件与算子的启动约束。** 以最常见的 `--block-size` 为例：上游 `CacheConfig` 在缺省时会把块长填成 `16`，而昇腾注意力算子在开启[前缀缓存](prefix-caching.md)或 [chunked prefill](chunked-prefill.md)（将长提示词拆成多步送入）时要求块长为 `128`。`NPUPlatform` 在 `check_and_update_config` 里就地把它补齐或改回 `128`，并自动挑出与当前芯片匹配的 `NPUWorker` 与图模式，用户才能用极简 CLI 启动标准 `Qwen3` 模型。

如果换到混合注意力模型（如后文历史 GLM 双机案例），逻辑会再深一层：更早运行的混合模型[补丁](ascend-patch-system.md)把逻辑块倒推写成 `640`（推导见[部署页](glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token)），更晚被调用的平台则专门对混合模型**跳过「改回 128」这一条**，把 `640` 保留下来。可见，用户不能仅凭命令行是否显式传参，就断言最终生效值。

代价是三条，后面三节各讲一条：

1. **输入值和生效值分家。** 排查「我配了怎么没效果」要多看一层：先确认平台这一步有没有把它改掉，再去看消费者（三路输入与优先级见[昇腾配置体系](ascend-config-system.md#解析完还会被改写生效值不是你写的值)）。
2. **校验随版本演进。** 建配置之前的校验数量逐版变化：`v0.23.0` 有 4 个类方法，`v0.26.0rc` 精简为 2 个（删掉层切分校验），`v0.30.0` 扩充为 7 项前置校验加量化/FP8 能力断言。到了 `main`，入口首行直接调用 `apply_v2_model_runner_config_patch()` 锁定 MRV2 并退役 MRV1 专属校验（对照见[配置页版本差异](ascend-config-system.md#版本差异)）。拿旧版本报错去新版本搜函数名往往搜不到。
3. **「拒答」也是一种行为。** 固定旧镜像的 `get_device_total_memory` 主动抛不支持，这个拒答会改变上游默认调度预算的档位。`v0.30.0` 与 `main` 改为守卫式查询——设备初始化后可答、未初始化前仍拒答；由于默认预算判定早于 `torch_npu` 初始化，在线服务未显式传参时依然落回小档起点 `2048`，不能把旧版的一律拒答与新版的守卫行为混为一谈。

## 校验与改写怎样影响执行

上游在汇总配置构造末尾调用 `check_and_update_config`，此时传入的是「用户输入 + 上游默认值」合起来的完整配置。在 `v0.30.0` 正式版（`c09d3e20`）中，内部按十步固定顺序推进：

1. **配置日志与两道早退。** 先初始化昇腾日志；随后若设备类型不是 `npu` 则直接返回，缺少 `model_config` 则打警告后返回，避免在非昇腾设备上误改配置。
2. **先跑七项前置校验，任一失败当场中止。** 依次检查 Model Runner 配置、Indexer PP、路由回放、PCP/DCP、草稿模型 DCP（同时开启[投机解码](speculative-decoding.md)、decode 侧[上下文并行](context-parallel.md) `DCP > 1` 且草稿模型非 MLA 时，核查三条头数约束：草稿张量并行数大于 KV 头数、$\text{DCP} \le \text{草稿 TP} \div \text{KV 头数}$、每 KV 头对应的 Q 头数能被 DCP 整除；MLA 草稿直接放行）、并行组合（拦截 `DP > 1` 且 `PCP > 1`，以及不在 [PD 分离](pd-disaggregation.md) producer 侧却同开 `PP > 1 + MTP`）与 Engram 配置。
3. **识别量化并校验缓存精度。** 前置校验通过后才调用 `maybe_auto_detect_quantization` 自动识别量化方法，接着校验 TurboQuant；若缓存或 indexer KV 精度设为 `fp8`，还会断言当前 `HardwareProfile` 支持 `FP8_ATTENTION`。
4. **修不兼容组合、初始化昇腾配置并核对 PD 角色。** 平台先调 `_fix_incompatible_config` 把已知冲突项改回可运行状态（如模型配置带 `indexer` 的 `top-k` 字段时，将缓存精度改写为模型自身 dtype），再构造[昇腾配置对象](ascend-config-system.md)并检查 DeepSeek V4 TP 与以下 PD 角色约束：

| 开关 / 策略 | 角色与组合约束 | 违反时的行为 |
|---|---|---|
| 均衡调度 | 仅允许 PD 混合角色（`kv_both`）或未配 KV 传输 | 显式设为 producer / consumer 时直接报错 |
| KV 载入失败策略（`recompute`） | 不支持混合模型 | 混合模型直接触发断言失败 |
| 重算调度（`recompute_scheduler_enable`） | 仅允许在 consumer 侧开启 | producer 侧打警告并重置为关；非 PD 角色直接报错 |

5. **定编译与图模式、重算捕获尺寸。** 按 Xlite 配置、纯 eager 要求与请求的图档位定编译和录图方案（见[图模式层](graph-mode-layer.md)）。若上游已要求纯 eager，图此前已关闭；其余四种情况会在本段把图整段关掉：开了 Xlite 全图却未开投机解码（同时改纯 eager）、编译档位不在昇腾支持的两种范围内、请求的图档位既非分段图也不含整图、或编码器-解码器模型请求整图却未走 vLLM 编译。此路径固定关闭 PyTorch Inductor，但图模式由独立字段控制——图模式关闭时才同步关编译与 `npugraph_ex`，分段图则必须走 vLLM 编译，因此**不能凭 Inductor 关闭就断定图模式也被关闭**。
6. **选 Worker、定块长、核一致性并配分配器环境。** `worker_cls` 为 `"auto"` 时，常规分支读取 `HardwareProfile.default_worker_cls`（标准 A2/A3/A5 取 `NPUWorker`，310P 取 `NPUWorker310`；开启且硬件支持 Xlite 时走 `XliteWorker`）。接着由 `refresh_block_size` 定块长：空值填 `128`（上游 `CacheConfig` 已先填 `16`，此处兜底）；已设值非 `128` 且开启前缀缓存或 chunked prefill 时强制改回 `128`；混合模型跳过后一条及 Xlite 下「不超过 128」限制，保留补丁更早写入的 `640`（五种块大小消歧见[缓存规格](kv-cache-spec.md)）。最后执行 SFA/DCP/KV/SP 一致性校验与 NPU 分配器环境设置。

**历史旧镜像对照（`db701c1f` / `v0.23.0`）。** 下图记录历史双机镜像的旧执行顺序：两道早退后**先识别量化，再跑四个校验**（含 `v0.23.0` 专有的「层切分仅许 PD producer 节点」，以及投机+DCP、并行组合、PP+MTP），末尾对 `worker_cls == "auto"` 硬编码 `310P / Xlite / NPUWorker` 三选一并执行角色检查。查 `v0.30.0` 启动栈时应按上方正式版顺序定位拒绝点，勿套旧顺序：

```wiki-diagram
file: platform-check-order
```

## 默认预算为何不能只看一个数字

把前面 `check_and_update_config` 在 `v0.30.0` / `main` 上的六段改写级联，与更早一步在 `EngineArgs` 发生的「拒答总显存 → 回落默认预算 `2048`」隐藏链条合在一张图里，两条启动线的先后因果一目了然：

```wiki-diagram
file: npu-platform-fig-override-cascade
```

这里说的预算是**调度预算**：一步最多收多少个 token 参与计算。它限制的是单步工作量，而不是显存容量（调度侧用法见[调度器](vllm-scheduler.md)）。用户不传该参数时，上游按硬件自动挑档，整条链分三段：

**第一段：平台被问显存，选择不答。** 上游在汇总配置对象之前，先调用平台的「单卡总显存」接口来定默认预算。固定旧镜像的昇腾实现一律抛不支持，注释写明原因：查询显存会顺带提前拉起设备运行库，而该库在单进程内只许初始化一次，提前拉起会让后续正式初始化报错。上游捕获该异常并吞掉，按 `0` 字节继续往下算。

**第二段：按容量选三档，另有一条批式 DP 入口。** 在 `v0.30.0` 配套上游（`ced6857a`）中，硬件分三档：容量 `≥ 160 GiB`（如 B200/B300）时离线库调用与在线 API 服务均取 `16384`，请求数上限 `1024`；容量 `≥ 70 GiB` 且设备名不含 `a100`（如 H100/H200/MI300x）时离线 `16384`、在线 `8192`，请求数上限 `1024`；其余情况落入小档——离线 `8192`、在线 API 服务 `2048`，在线与离线的请求数上限起点均为 `256`（仅在无 `UsageContext` 调用时，才回退取 `SchedulerConfig` 的无上下文兜底常量 `2048` 与请求数 `128`；历史 `v0.23.0` 尚无 `≥ 160 GiB` 档）。昇腾因参数解析早于 `torch_npu` 初始化，查询被拒后记 `0` 字节，常规在线服务遂从 `2048`（请求数 `256`）起算；完整六分支求值表见[核心 CLI 参数与跨层联动](core-cli-params.md#为什么昇腾在线服务默认批预算是-2048拆解-6-分支求值与-sppcp-静默取整)。

另一条互斥分支不看容量档位：当专家分发后端是低时延 DeepEP 或 NIXL EP、开了专家并行且 `DP > 1` 时，上游判定为「批式 DP MoE」，token 预算起点改取常量 `256`（请求数上限仍按上述上下文档位独立选定）。`256` 同时是 MoE 层最大 token 数的缺省值，旧版「MoE DP 分块」也默认 `256`（每个 DP rank 批式派发的工作单位），但不能据此推断通信内核容量封顶 `256`——后面的吞吐模式与模型长度条件仍会继续调整未显式设置的值。

**第三段：默认值还要过四道条件调整。** 定好起点（常规在线小档 token `2048` / 请求数 `256`、批式 DP token `256`、无上下文兜底请求数 `128`）后，上游只对**未显式设置**的项做四步加减：
1. 吞吐模式下，未显式设置的 token 预算和请求数上限各自翻倍；
2. 未开 chunked prefill（把长提示词拆步送入）时，token 预算抬升到至少等于单请求长度上限；
3. 多模态 prefix-LM 模式下，抬升单步准入 token 下限以容纳单个媒体项（注意这只是单步调度准入预算，运行期跨轮视觉编码特征的复用容量由独立的 `EncoderCacheManager` 管理，见[多模态视觉编码与特征缓存](multimodal-encoder-cache.md)）；
4. token 预算按 `请求数上限 × 单请求长度上限` 收窄，未显式设置的请求数上限再反过来按 token 预算收窄。

**token 预算与请求数上限各有一道独立闸门。** 无论用户有没有传参，进函数后问显存与选档照常执行；区别在于，只有未显式传参的那一项才会被默认值填回并参与上述调整。显式传入 token 预算会保留原值，但不会阻止未显式传入的请求数上限被翻倍或收窄；最终生效值还要再过配置验证与下游消费者。

所以三件事不能混着说：

- **拒答不等于没有显存。** 真正的显存账在 Worker 起卡、加载权重之后按占用测量得出，推导在[部署页](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)。
- **回退档不等于「昇腾默认每步 2048 token」。** 2048 只是 API 服务方式在小档上的起点，后面还要过第三段那四次加减，而且只在没显式设置时才成立。
- **调度预算不等于缓存块大小。** 前者说一步收多少 token，后者说历史状态按多大一页存，见[缓存规格](kv-cache-spec.md)。

## 混合状态怎样改变块长与注意力选择

与标准 `Qwen3` 全层统一走平台通用表不同，混合注意力与跨机专家并行模型会同时触发块长豁免、缓存精度改写与层内私有后端绑定。以历史 GLM-5.3-Flash 双机算例（例外 B，两台 A2 各 8 卡、TP8 / DP2 / EP16、W8A8，完整启动配方见[双机部署怎么开](glm-5-3-flash-two-node.md#怎么开)，启动时序见[启动时发生了什么](glm-5-3-flash-two-node.md#启动时发生了什么)）对照，平台改写与层内绕行的全貌如下：

```wiki-diagram
file: platform-surface
```

| 上游问什么 | 该混合模型部署得到什么 |
|---|---|
| 自动选哪个 Worker 类 | 常规 `NPUWorker`：不是 310P 设备，xlite 执行模式也没开 |
| 注意力后端用哪个 | 通用接口按三个标志查表回答；混合模型的两类层不走这张表 |
| 图包装与编译后端用哪个 | 昇腾自己的图包装类与编译器类，不是上游那条默认编译路 |
| 设备通信器类 | 昇腾的通信器类，通信后端名由 Worker 给出 |
| 缓存精度 | 因为模型配置带 `indexer` 的 `top-k` 字段，被改写成模型自身的 dtype |
| 逻辑块多大 | 补丁更早定成 640 个 token；平台遇到混合模型，跳过「改回 128」那一条，640 留下 |

**注意力后端那一行要展开讲，否则容易记错。** 通用接口的查表键是三个标志（是否 MLA、是否稀疏、是否压缩），四个组合各对一个昇腾后端类；显式指定 FlashAttention 且额外条件成立时另走 FA3；310P 设备有自己的一张表。但 GLM 的稀疏 MLA 层在算子实现里写死了配套后端，KDA 层由算子返回专用 GDN 后端，因此「在通用表里挑一个名字」不能代表 GLM 两类层的实际实现（完整对应见[注意力后端](attention-backend-family.md)）。

**边界与例外（FA3 验证）**：请求 FlashAttention 后端、进入验证且启用批不变选项时，MLA 或稀疏组合会直接报错；未启用批不变时，验证不通过并退回插件后端。这是该验证路径的组合限制，不能据此推断所有 MLA 配置都无法选后端。

**预算那一行反过来：平台的拒答不改变本部署的显式预算。** 官方命令显式写了每步 `8192` token、请求数上限 `32` 与显存比例 `0.85`，因此默认值函数直接保留 `8192` 和 `32`。若把 token 预算参数删掉、保留其余条件，推导顺着四步走完：
1. 此时专家分发后端仍为默认的 allgather / reducescatter，不进批式 DP；
2. 显存查询失败落入 API 服务小档，起点取 `2048`；
3. 均衡模式不翻倍，生成模型默认支持 chunked prefill，也不触发长度抬升；
4. 最终收窄得 $\min(32 \times 133{,}120,\; 2048) = \mathbf{2048}$。

注意，稍后平台仍可能改写分发后端，不能拿后写的值倒推这一步当时的分支。

这份推导还要求模型不启用多模态 prefix-LM。固定公开 W8A8 配置的架构是 `Glm5NextForConditionalGeneration`，其中没有 `is_mm_prefix_lm`，GLM 也不在上游默认名单中，因此不触发该下限。若现场配置或覆盖项将其设为真，须重新计算媒体项下限；公开配置不能代替容器内最终配置与启动日志（完整链条只在本页推导，[平台契约页](vllm-platform-interface.md#主机内存设备显存和-token-预算怎样分账)引用同一结论）。

**并行那条校验对本部署是硬约束。** 这里 DP 是 2，所以 prefill 侧上下文并行只能是 1；想开它就得先放弃 DP，而 DP2 是这套双机部署分派请求的方式。

读完可以沿三个结果继续往下走：Worker 类名进 [Worker 启动](npu-worker-lifecycle.md)，块大小与缓存精度进[状态池分配](vllm-kv-block-allocation.md)，后端类名进各层的注意力执行。组合通过校验只说明能进下一阶段，不等于模型已经跑起来。

## 常见误解

- **「平台只是一张属性表，读一读就知道硬件能干什么」**——它同时会拒绝组合、就地改写配置。命令里写的值和最终生效的值可以不同，排查要先确认这一层改过什么。
- **「查不到设备显存是个 bug」**——固定旧镜像主动拒绝这个查询，注释解释它会导致设备运行库过早初始化。`v0.30.0` 与 `main` 改为守卫式查询：未初始化时拒绝，初始化后可答；是否落到回退档取决于查询时设备运行库是否已经初始化。
- **「昇腾默认每步只收 2048 个 token」**——2048 只是 API 服务方式在小档上的起点，后面还有翻倍、抬升、收窄四道加减；并且选档照常发生，选出的值只在没显式写这个参数时才生效，本部署显式写了 8192。
- **「注意力后端在通用映射里挑一个名字就是 GLM 的实现」**——GLM 的稀疏 MLA 层与 KDA 层都在自己的算子实现里绑定专用后端，不查那张表。
- **「平台把 PyTorch 的编译关了，说明昇腾不支持 graph mode」**——关掉的只是上游那条默认编译路，昇腾自己的编译器类和图包装类是平台另外两个回答给出的。
- **「校验通过就说明这套配置能部署」**——通过只说明能进下一阶段；权重格式、算子、硬件是否相符要到 Worker 加载模型时才见分晓。

## 对照源码

**配置分支的来源范围。** 已核专用镜像 `db701c1f`：来源 11 的 `platform.py` 第 650–660 行仅在 `parallel_config` 存在且 `worker_cls == "auto"` 时，按 310P、Xlite、普通 `NPUWorker` 的顺序选择，把完整类路径写回 `parallel_config.worker_cls`。来源 9 第 592–603 行对应 `use_inductor=False`、图模式 `NONE` 时关闭编译与 `npugraph_ex`、分段编译要求 `VLLM_COMPILE`；来源 12 第 805–858 行对应 `FLASH_ATTN` 的验证入口和 `use_batch_invariant`、MLA/稀疏组合门槛，后续还有依赖包及接口检查。这些条件不能替代设备执行验证，也不推广到其他版本或所有后端组合。

### 怎么开

- **不需要开。** 装上 vllm-ascend 之后，vLLM 通过插件机制加载这个类，`_enum = PlatformEnum.OOT`（仓库外平台）；发现与激活过程见[插件注册](platform-plugin-registration.md)。身份字段都在类体顶部：`device_name` / `device_type` 为 `"npu"`，`ray_device_key = "NPU"`，`device_control_env_var = "ASCEND_RT_VISIBLE_DEVICES"`，`dispatch_key = "PrivateUse1"`，`simple_compile_backend = "eager"`（注释写的是 `# Disable torch.compile()`）。
- **配置前的准备：** `pre_register_and_update` 调 `adapt_patch(is_global_patch=True)` 装全局补丁，把 `ASCEND_QUANTIZATION_METHOD` 追加进 `--quantization` 的候选（所以 `--quantization ascend` 不是上游自带取值），再按 `is_310p()` 导入对应的量化配置类。GLM 的配置类型与模型实现不在这里登记：前者由[补丁](ascend-patch-system.md)模块补进上游的配置表，后者走通用的[模型插件登记](platform-plugin-registration.md)。注册一个量化名只表示后面解析配置时认得它，不表示模型能按这套量化跑起来——那还要求权重格式、模型实现、算子与硬件互相对得上。
- **调用时机：** `VllmConfig.__post_init__` 在构造末尾调 `current_platform.check_and_update_config(self)`；而默认调度预算在这之前、`EngineArgs` 里由 `_set_default_max_num_seqs_and_batched_tokens_args` 定好。两件事不在同一刻，是本页「拒答改变默认档」那条链的前提。
- **`check_and_update_config` 内部顺序**：`v0.30.0` 正式版（`c09d3e20` 第 478 行起）按「配置日志 → 两道早退 → 7 项前置 `_validate_*` → `maybe_auto_detect_quantization` / `validate_turboquant` / FP8 断言 → `_fix_incompatible_config` → `init_ascend_config` 与 DeepSeek V4 TP / `_check_ascend_config` → `_update_compilation_modes` → `_setup_compile_backend` → `_setup_worker_and_scheduler`（`HardwareProfile.default_worker_cls`、`refresh_block_size`、调度器扩展）→ `_validate_sfa_dcp_kv_sp` → `_set_pytorch_npu_alloc_env`」执行；历史旧镜像（`db701c1f` 第 450 行起）则是「两道早退 → `maybe_auto_detect_quantization` → 四个 `_validate_*` → `_fix_incompatible_config` → `init_ascend_config` → 日志与 KV 传输 id → 编译与 `cudagraph_mode` → `worker_cls` 三选一 → `refresh_block_size` → `custom_ops = ["all"]`（非 310P）→ 均衡调度、KV 载入失败策略、重算调度三条角色检查」。

  两道早退见来源 7 第 453–463 行：存在 `device_config` 且其有效设备类型不是 `npu`，或缺少 `model_config`，都会直接返回，不执行后续昇腾配置更新；缺少模型配置时还会记录警告。设备配置若没有 `device_type` 属性，这里用平台自身的设备类型作为默认值。
- **块大小的通用规则：** `refresh_block_size` 在 `block_size is None` 时填 128，`deepseek_v4` 另有 32 / 64 / 128 的限制，`model_config.is_hybrid` 为真就直接返回，交给模型专属算法。另有 `update_block_size_for_backend`：仅当前缀缓存关闭、混合 KV 管理器启用、配置了 KV 传输且 `mamba_cache_mode == "align"` 时处理 Mamba 块；原值为空或等于最大模型长度就改成逻辑块大小，其他值则断言它是逻辑块大小的整数倍。
- **要更大的每步预算就显式写 `--max-num-batched-tokens`。** 官方 GLM 双机命令写的是 8192。
- **通用后端选择：** `get_attn_backend_cls` 以 `(use_mla, use_sparse, use_compress)` 查 `backend_map`：`(False, False, False)` 得 `AscendAttentionBackend`，`(True, False, False)` 得 `AscendMLABackend`，`(True, True, False)` 得 `AscendSFABackend`，`(True, False, True)` 得 `AscendDSABackend`；选定 `FLASH_ATTN` 且 `_validate_fa3_backend` 通过时返回 `AscendFABackend`；310P 走 `backend_map_310`。GLM 侧的直接绑定：`IndexerKPoolMLACacheLayer` 把 `self.attn_backend` 设成 `AscendIndexerKPoolMLABackend`；`AscendKimiGatedDeltaNetAttention.get_attn_backend` 返回 `AscendGDNAttentionBackend`。
- **其他「答名字」的接口：** `get_compile_backend` 返回 `AscendCompiler`（被写进 `compilation_config.oot_compiler`），`get_static_graph_wrapper_cls` 返回 `ACLGraphWrapper`，`get_device_communicator_cls` 返回 `NPUCommunicator`。

### 会报什么错

| 报错 | 触发条件 |
|---|---|
| `additional_config.layer_sharding can only be enabled in PD-disaggregated's P node.` | 配了层切分而 `kv_role` 不是 `kv_producer`（只在 v0.23） |
| `PCP (Prefill Context Parallelism) and DP (Data Parallelism) cannot be enabled simultaneously...` | `data_parallel_size > 1` 且 `prefill_context_parallel_size > 1` |
| `PP+MTP is only supported on PD-disaggregated P nodes (kv_role='kv_producer').` | MTP + `pipeline_parallel_size > 1`，且不在 producer 一侧 |
| `enable_balance_scheduling only supports PD-mixed mode...` | 开了均衡调度、存在 KV 传输配置，且 `kv_role` 不是 `kv_both` |
| `Hybrid models do not support recompute mode kv load failure policy now.` | `kv_load_failure_policy=recompute` 且模型是混合模型（断言） |
| `recompute_scheduler_enable can only be enabled on PD-disaggregated D nodes...` | 开了重算调度而角色不是 consumer；在 producer 上只警告并重置为关 |
| `ACL graph is incompatible with ASCEND_LAUNCH_BLOCKING=1.` | 图模式没关而环境里设了这个调试变量 |
| `Invalid draft model parallel config for speculative decoding: ...` | `decode_context_parallel_size > 1` 且草稿模型不是 MLA 时，三条头数约束任一不满足（草稿 TP 大于 KV 头数；DCP ≤ 草稿 TP ÷ KV 头数；每个 KV 头对应的 Q 头数能被 DCP 整除） |

在默认预算查询这条路径中，`NotImplementedError` 被 `except Exception` 捕获，容量占位值改为 0；其他调用点若没有相同的异常处理，仍会把异常向外传播。

### 开销和什么时候别开

本页没有平台钩子的耗时测量，不能据“启动时调用”就认定开销可忽略；配置对象也能被多次构造。排查时应区分注册、配置检查、硬件查询及后续所选组件的耗时。下面关注配置变化带来的后果。

- **不要靠删校验来验证组合。** 被拦的组合往往在更下游没有实现，删掉检查只会把报错推迟到运行时。
- **别把一个版本的报错当通用知识。** 校验数量与函数名三个版本都不同，见下表。
- **显式写了每步预算，就不要再按「默认值」推断行为**，反之也一样：删掉这个参数不会回到 8192。
- **310P 与 xlite 是另外两条 Worker 分支**，它们的行为不能套到常规 A2 路径上；本部署走的是常规分支。

- **缓存精度那条改写是跟着模型配置走的**，换模型要重新看，不能当成昇腾的全局默认。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm-ascend@2c59ff10` / `vllm@0fc695fc`，GLM 专用镜像 `db701c1f` 同属此分支期）、`v0.26.0rc`（`vllm-ascend@2ed6cbba` / `vllm@568afb3a`）、`v0.30.0` 主基线（`vllm-ascend@c09d3e20` / `vllm@ced6857a`）与 `main`（`vllm-ascend@8d6180e2` / `vllm@ba15685a`）。**`v0.30.0` 与 `main` 均对 `get_device_total_memory` 实行守卫式查询：在 `EngineArgs` 解析默认值阶段 `torch_npu` 尚未初始化，仍抛出 `NotImplementedError("NPU total memory is unavailable before torch_npu initialization")`，使未显式设置 `--max-num-batched-tokens` 的在线 API 服务继续回落到小档起点 `2048`；`main` 在 `check_and_update_config` 入口首行直接调用 `apply_v2_model_runner_config_patch()` 锁定 MRV2。**

| 核验维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
|---|---|---|---|---|
| `check_and_update_config` 起始行与前置校验 | L450；4 个类方法（层切分 → 投机+DCP → 并行 → PD+PP+MTP） | L408；2 个类方法（投机+DCP → 并行），已移除层切分校验 | **L478**（`#L478-L525`）：先 `_validate_model_runner_config` / `indexer_pp` / `routing_replay` / `pcp_dcp` / `draft_dcp` / `parallel` / `engram`，再自动识别量化、`validate_turboquant` 与 FP8 能力断言 | **L606**（`#L606-L683`）：首行调用 `apply_v2_model_runner_config_patch()` 与 `sync_v2_extra_kwargs`，补齐 `compress_ratios` 兼容，新增 `_validate_glm5next_dflash2_pp_config`，退役 MRV1 专属校验 |
| 设备总显存查询 `get_device_total_memory` | 无条件抛 `NotImplementedError` | 无条件抛 `NotImplementedError` | 未初始化抛 `NotImplementedError`，初始化后读 `torch.npu.mem_get_info`（`#L232-L245`） | 延续守卫式查询（`#L260-L273`） |
| 未初始化抛错对默认 `max_num_batched_tokens` 的影响 | `arg_utils` 捕获异常置 `device_memory=0`，在线 API 服务默认回落小档起点 `2048` | 相同 | 上游新增 ≥160 GiB 档，但 `EngineArgs` 仍早于 `torch_npu` 初始化，抛错回落 `2048` 行为不变 | 延续回落 `2048`（`arg_utils.py#L2985-L3030`） |
| 并行与 CP 校验边界 | `DP > 1` 且 `PCP > 1` 才抛 | 未开 V2 runner 时 `PCP > 1` 即抛 | 延续 MRV1 拒绝 `PCP > 1` 与 routed-experts 返回；SFA C8 核对硬件能力，GQA/MQA 要求 `PCP == DCP`；非空 `num_speculative_tokens_per_batch_size` 在 MLA 放行前被拒；KVPP>1 交 `KVPPConfig` | 全量 MRV2 下走后端与 PCP 管理器校验；延续 PCP/DCP、草稿与 KVPP 约束 |
| 自动选 Worker | 方法内硬编码 310P / Xlite / `NPUWorker` | 同左 | 常规分支取 `HardwareProfile.default_worker_cls`（`#L1365-L1375`），Xlite 受能力与开关双门控 | 延续 `HardwareProfile.default_worker_cls`（`#L1570-L1580`） |

`v0.30.0` 与 `main` 对主模型和独立草稿模型分别校验，不能用主模型通过启动证明草稿拓扑合法；更多上下文并行边界见 [CP 页](context-parallel.md#版本差异)。GLM 专用镜像 `db701c1f` 的四个前置校验顺序、显存无条件拒答与 A2 Worker 选择与 `v0.23.0`（`2c59ff10`）一致，具体编译开关复位与重算调度复位细节见源码对照。

### 源码位置

| 看什么 | 去哪里 |
|---|---|
| 类本体、身份字段、各组方法 | `vllm_ascend/platform.py`，`class NPUPlatform` |
| 校验与改写的全部顺序 | 同上，`check_and_update_config` |
| 四个校验各自的条件 | 同上，`_validate_layer_sharding_config`、`_validate_draft_decode_context_parallel_config`、`_validate_parallel_config`、`_validate_pd_pp_mtp_config` |
| 通用块大小规则、混合模型跳过「改回 128」 | `vllm_ascend/utils.py`，`refresh_block_size` |
| 上游先填的默认块大小 16 | 上游 `vllm/config/cache.py`，`CacheConfig.DEFAULT_BLOCK_SIZE` 与 `_apply_block_size_default` |
| 全局补丁入口 | `vllm_ascend/utils.py`，`adapt_patch` |
| 混合模型的块大小算法 | `vllm_ascend/patch/platform/patch_mamba_config.py` |
| GLM 两类层的后端绑定 | `vllm_ascend/ops/indexer_kpool_mla.py`、`vllm_ascend/ops/kimi_kda.py` |
| 默认调度预算的档位与加减 | 上游 `vllm/engine/arg_utils.py`，`get_batch_defaults` 与 `_set_default_max_num_seqs_and_batched_tokens_args` |
| 平台校验的调用点 | 上游 `vllm/config/vllm.py`，`VllmConfig.__post_init__` |
| 补丁写 640 为什么早于平台 | 同上，`__post_init__` 先调 `try_verify_and_update_config`（混合模型配置检查），后调 `check_and_update_config` |
| 批式 DP 的 256 从哪来 | 上游 `vllm/model_executor/layers/fused_moe/config.py` 的 `max_num_tokens` 缺省值；删掉前的 `VLLM_MOE_DP_CHUNK_SIZE`（`vllm/envs.py`） |

**本页的条件性推导。** 将固定源码与部署参数合起来：常规 A2、未开 xlite 且 Worker 自动选择时，得到 NPUWorker；DP2 要求 PCP1；未配层切分、KV 传输和重算调度时，不触发相应角色限制；GLM 文本配置的 indexer top-k 字段触发缓存精度改写。官方命令显式写了 token 预算 8192 与请求数上限 32，默认值函数保留两者。只删掉 token 预算后，在前文列出的默认值和模型配置条件下，得到 min(32 × 133,120, 2048) = 2048。[D] 这份演算保留全部前提，不代替现场启动日志。

**来源与结论的对应。** 以下编号均指页头 sources：

- 身份字段、编译器和准备钩子见来源 1；平台调用与更早的预算构造见 2–3；设备总显存拒答及 Mamba 块更新的完整条件见 4。
- 前置校验见 5–7；缓存精度、编译与图模式见 8–10；Worker、块大小调用、算子开关和角色检查见 11，KV 载入失败策略的实际断言另见 42。
- 通用后端、FA3 检查及包装类见 12；块大小规则见 13；GLM 专用后端与 indexer top-k 配置分别见 14–16。
- 默认档位见 17；常量见 18；批式 DP 条件见 19；token 与请求数的两套独立调整条件见 20，均衡模式默认值见 54。MoE 缺省 token 数和旧分块参数分别见 30–31，不能从缺省值推出通信内核容量上限。
- 640 的写入时序见 27–29；默认分发后端与 chunked prefill 开关见 32–33，模型的 chunked prefill 能力判定见 46；多模态 prefix-LM 判定见 34，GLM 配置与元数据见 44–45；默认块大小 16 及其填充见 36–37。
- v0.23 的四项前置校验见 38；v0.26 rc 的两项校验与 Worker 分支见 21、53；main 的查询守卫、配置调用、并行限制、Worker 选择和 A2 默认类见 22–25、43；`v0.30.0`（及历史候选快照）的主模型与草稿限制及实际入口调用见 40–41、52，初始化后容量查询见来源 56。
- 官方双机的 8192、32、0.85 等参数见来源 26，命令全文与镜像边界见[来源基线](../sources/glm-5-3-flash-baseline.md)。

**怎样确认现场值。** 公开配置已经给出了多模态架构和 prefix-LM 字段的情况，main 的 A2 硬件画像也明确写着常规 NPUWorker；但本页没有容器最终配置、删去预算参数后的启动日志或 NPU 实测。因此，2048 是上述条件下的代码推导，Worker 的类路径也不是该设备组合已成功运行的证明。

草稿的 MLA 判定要跟完整链，不能只看主模型名字：来源 55 构造草稿配置时传入覆盖函数，来源 47 的覆盖把草稿顶层类型改成 `glm5_next_mtp`；来源 48 按顶层类型选转换器，来源 35 只为 `glm5_next` / `glm5_next_text` 注册专用转换器，上游映射见 51。落到基类时，来源 34 的 MLA 名单也没有这些 GLM 类型；转换结果写入结构字段（来源 50），再由 `use_mla` 读取并叠加环境开关（来源 49）。按这组固定注册和构造路径，草稿不走 MLA 放行分支；本部署 DCP1 会在此判断之前返回，改成 DCP 大于 1 才需要继续核草稿头数约束。这仍是固定代码路径的判断，不是 DCP 部署通过记录。
