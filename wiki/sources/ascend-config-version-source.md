---
id: ascend-config-version-source
title: AscendConfig 三版本来源摘要
type: source
summary: 三个固定快照展示共享专家开关、动态分块设置和配置缓存的取值变化；main 仍读取旧 FlashComm1 输入，不能仅凭旧辅助函数消失判断环境输入已失效。
aliases:
  - AscendConfig 三版本来源摘要
  - clear_ascend_config
  - enable_shared_expert_dp
chapters:
  - '10'
order: 20
sources:
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L55-L94'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L114-L122'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L353-L365'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L738-L760'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L897-L944'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L83-L135'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L369-L381'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L721-L743'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L995-L1026'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L1092-L1139'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L573-L628'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1261-L1297'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1420-L1464'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1536-L1563'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1584-L1604'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1673-L1716'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L520-L522'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1626-L1628'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L393-L396'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L409-L412'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L896-L899'
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L157-L165
  - >-
    vllm-ascend@2ed6cbba:docs/source/user_guide/configuration/additional_config.md#L154-L162
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L156-L164
  - >-
    vllm-ascend@2ed6cbba:docs/source/user_guide/configuration/additional_config.md#L75-L75
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - main
evidence: C
relations:
  - to: ascend-config-system
    kind: builds-on
    note: 本摘要记录三项配置与缓存的固定版本证据，配置输入和消费者的教学由该页维护
  - to: sequence-parallel
    kind: builds-on
    note: FlashComm1 与共享专家配置涉及位置分片，执行机制需要另读序列并行专题
  - to: profiling-chunk-config
    kind: builds-on
    note: 本摘要区分构造默认与校验门槛，参数的生成定义仍由原参数页维护
contradicts: []
updated: '2026-10-07'
rawSources:
  - >-
    raw/sha256-3efa25973cae50780b72a10187d3892b2e32ef48bfcdd427fb2788045147b9af.md
  - >-
    raw/sha256-6306d7807bae22080e3af8f33a322b183124deacf770ae5ba43c9053cc53264f.md
---

## 本摘要覆盖哪些证据？

AscendConfig 是将 vLLM 的 `additional_config` 转成昇腾插件配置的对象。本页只记录共享专家 DP、FlashComm1、动态分块子配置与模块级配置缓存的来源差异，配置体系的教学见[Ascend 配置](../concepts/ascend-config-system.md)。没有完整执行调用链或 NPU 实机验证。

核对记录日期为 2026-10-07，范围是 v0.23 维护分支、v0.26 分支（仍为 rc，本次核对的指定快照）和 main 开发主线的指定快照。该日期不声称是提交日期，也不将结论外推到浮动 main。逐字摘录见[原始材料](../raw/sha256-3efa25973cae50780b72a10187d3892b2e32ef48bfcdd427fb2788045147b9af.md)。

## 共享专家 DP 的有效值如何形成？

共享专家是 MoE 中不参与路由专家 top-k 竞争的专家路径；此处 DP 表示其数据并行计算设置。三个快照都将输入开关与专家并行开启、张量并行大小大于 1 的条件相与，用户请求开启不等于有效值必然为真。

| 核对项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
| --- | --- | --- | --- | --- |
| 未填写共享专家 DP 开关 | 输入兜底 `False` | 输入兜底为已解析的 FlashComm1 值 | 声明字段默认 `False` | v0.26 不能概括成省略即关闭 |
| 该初始化片段的 SP 检查 | 开启后断言 `enable_sp(..., enable_shared_expert_dp=True)` | 该处不再执行此断言 | 该处不执行此断言 | 只证明局部校验变化，不证明完整 SP 条件 |

这些默认与检查的版本差异见来源 2、6、11、17。[!] v0.26 文档仍写默认 `False`，没有表达 FlashComm1 为真且并行门槛满足时的省略行为，源码与文档存在差异。[!][S25]

三个快照的 `_check_mix_placement` 都拒绝 `mix_placement` 与共享专家 DP 或共享专家多流重叠同时开启；依据分别在来源 19、20、21。未提供 `enable_sp` 定义，不能补写它的完整支持条件。

## FlashComm1 的兼容输入为何需要重新核对？

两个发布分支使用 `_get_config_value`：配置字典含键就直接用其值，缺键才返回传入的环境值。因此显式配置 `false` 可以覆盖环境开启值。材料没有 `envs.py`，不能独立核定环境未设置时的实际默认，也不能将该辅助函数解释为会转换 JSON 值或校验布尔类型。来源 1、3、6、7支持这些解析边界。

main 改变了入口和优先级。[!] 工厂发现旧配置键或环境变量时发出弃用警告，旧键在严格配置构造前被过滤；但推导阶段仍消费它们：配置键经布尔校验，缺键传入 `False`，再与环境变量判断做逻辑或。环境字符串去空白、转小写后，仅 `"1"` 或 `"true"` 被此处视为开启。[C11]

所以 main 中显式 JSON `false` 不会覆盖环境的开启值。旧属性读取方式不能沿用，但“弃用”也不等于“停止读取”；工厂和过滤位置见来源 14、18。[!]

推导阶段还把上述显式开启结果与 `enable_dsa_cp` 做逻辑或，形成 `effective_flashcomm`。结果为假时写入 `all2all_backend="flashinfer_all2allv"`；为真但 `use_sequence_parallel_moe` 为假时打印禁用警告，否则打印开启日志。[C11] 这些只说明初始化分支，不证明所有执行路径均使用 FlashComm。

同一快照的 FlashComm1 兼容路径说明：旧辅助函数消失不能推广成所有环境输入失效；[Ascend 配置页](../concepts/ascend-config-system.md#版本差异)在本批同步修正，并保留旧结论的废弃历史。[!]

## 动态分块默认、约束和迁移有哪些证据？

`profiling_chunk_config` 是动态分块的子配置，本材料只核对构造与校验，不证明实际测速、拟合或调度调用链。

| 项 | 三个快照的共同构造值或检查 | 意味着什么 |
| --- | --- | --- |
| `enabled` | 默认 `False` | 省略不请求开启 |
| `smooth_factor` | 默认 `1.0`，要求 `0 < x <= 1.0` | 零会被拒绝 |
| `min_chunk` | 默认 `4096`，要求大于零 | 开启后还可能按批次预算截小 |
| `max_fit_chunk` | 默认 `30`，小于等于 `5` 报错 | 硬性门槛是大于 5；报错推荐 30 是另一回事 |
| 未填写 `need_timing` | 最终跟随 `enabled` | 不能无条件写默认 `True` |

共同构造值与范围见来源 4、8、12。禁用时也会构造并执行范围校验。两个发布分支显式调用 `float()`、`int()`；main 使用类型字段与 `@model_validator`，装饰器底层定义未提供。

开启后，三个快照都在预算小于 `min_chunk` 时警告并截小，再要求流水线并行大小大于 1，并拒绝与均衡调度同时开启；来源 1、6、11提供这些条件。流水线并行是按模型计算顺序划分执行阶段的并行方式。

| 核对项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
| --- | --- | --- | --- | --- |
| 输入与对象位置 | 顶层输入；对象在 AscendConfig 顶层 | 优先嵌套在 `scheduler_config`，兼容顶层；对象在调度子配置下 | 同样优先嵌套并兼容顶层，由工厂预构造调度子配置 | 输入路径与读取路径都要迁移 |
| 嵌套与顶层同时提供 | 所引路径只读顶层 | 嵌套优先，忽略旧顶层并警告 | 同左 | 按整个字段选择，不合并字典 |
| `enabled=False, need_timing=True` | 保留 `True` | 保留 `True` | 警告并改为 `False` | main 增加禁用状态纠正 |
| 显式 `need_timing=None` | 保留 `None` | 保留 `None` | 当作未提供，改为 `enabled` | 空值与显式假值不同 |

上述版本差异的来源是 1、4、8、9、12、13。[!] 三份官方本地文档都有 profiling 表，但均写 `need_timing` 默认 `True`、`smooth_factor=0.0` 可禁用调整，与源码的条件默认和零值检查不一致。[!][S22][S23][S24]

对应线上入口为[v0.23 维护分支](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/configuration/additional_config.html)、[v0.26 分支](https://docs.vllm.ai/projects/ascend/en/v0.26.0rc1/user_guide/configuration/additional_config.html)、[main 开发主线](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/configuration/additional_config.html)。证据来自固定本地副本，线上内容可能变化。

## 模块级配置缓存何时复用和重建？

三个快照都用 `_ASCEND_CONFIG` 保存模块级实例，以两个必要属性是否存在检查初始化状态。`get_ascend_config()` 在缓存为空或检查不通过时抛 `RuntimeError`，不会自动初始化；这些检查不等于重新校验全部配置。

复用共同要求已有缓存、未请求刷新、必要属性存在，并且初始化使用同一个 `vllm_config` 对象。这里比较对象身份，不比较内容；原地修改同一对象而不刷新仍可能复用。新构造失败发生在更新缓存之前。这些缓存语义见来源 5、10、14、16。

| 核对项 | 两个发布分支 | main 开发主线 | 意味着什么 |
| --- | --- | --- | --- |
| 保存初始化对象身份 | 缓存对象的 `vllm_config` 属性 | 模块变量 `_INIT_VLLM_CONFIG` | 不能沿用旧属性路径解释 main |
| 刷新输入 | 顶层 `refresh` 缺省 `False`，直接判断真假 | 布尔校验；RL 开启强制刷新，非法非字典 RL 输入亦跳过复用 | main 的重建触发条件增加 |
| 发布新缓存前 | 构造完成并具有必要字段 | 预构造调度配置，构造实例，执行推导、RL 应用及子配置前提检查，再发布并清理 SP 判断缓存 | 绕过工厂不等于完成相同初始化 |
| 清理 | 清空配置缓存并调用 `clear_enable_sp()` | 另清空初始化对象身份 | main 多一份身份状态需要清理 |

上述版本差异见来源 5、10、14、15、16。[!] 材料没有锁、调用者或进程启动代码，不能据此承诺线程安全或跨进程共享。

## 哪些依赖页需要追加审查？

本批同步修正 Ascend 配置页的 main 环境兼容和未知顶层键结论，保留原有教学内容与来源编号。阅读 `sequence-parallel`、`dynamic-chunked-pp` 和 `profiling-chunk-config` 时，应区分这里的配置构造证据与完整执行链；本材料没有验证这些专题的全部分支。参数生成区仍由脚本维护。

进一步确认环境默认、SP 支持条件、类型校验实现和实际调度调用链，需要追加 `envs.py`、`utils.enable_sp`、`config_utils.py` 与调度执行文件。未提供的材料不作为本页的新源码证据。
