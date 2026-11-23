---
id: v030rc2-baseline
title: v0.30.0rc2 的版本基线与阅读边界
type: source
summary: >-
  固定用户指定的 Ascend rc2 分支及配套 vLLM，区分 PCP、DCP、DSA-CP、执行器和 GLM 教学基线，避免把正式版或浮动 main
  的行为混入对照。
aliases:
  - v0.30.0rc2
  - '0.30'
  - rc2
  - 三十版本
  - Model Runner V2
  - 7d825229
  - v0.30.0rc2 基线
  - rc2 基线
chapters:
  - '10'
  - '15'
sources:
  - 'vllm-ascend@7d825229:docs/source/user_guide/release_notes.md#L1-L18'
  - >-
    vllm-ascend@7d825229:docs/source/developer_guide/Design_Documents/context_parallel.md#L1-L20
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1641-L1700'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/v2/pcp_manager.py#L230-L261'
  - 'vllm-ascend@7d825229:docs/source/tutorials/models/GLM5.3-Flash.md#L17-L33'
  - 'vllm-ascend@7d825229:vllm_ascend/attention/indexer_kpool.py#L437-L476'
  - 'vllm@ced6857a:vllm/config/vllm.py#L675-L724'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229c77025cfb185a010c25819c1214b9450/docs/source/user_guide/release_notes.md
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/user_guide/release_notes.md#L1-L18
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/developer_guide/Design_Documents/context_parallel.md#L1-L20
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/tutorials/models/GLM5.3-Flash.md#L17-L33
  - >-
    vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L18-L43
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L491-L506'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L192-L193'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/__init__.py#L20-L27'
  - 'vllm@ced6857a:docker/Dockerfile.cpu#L141-L151'
verified: []
evidence: S
relations:
  - to: context-parallel
    kind: builds-on
    note: 逐项比较 PCP、DCP、DSA-CP 与模型支持条件
  - to: glm-5-3-flash-two-node
    kind: builds-on
    note: 保留旧双机部署的固定来源，迁移版本时重新核对容量和运行条件
  - to: v030-release-baseline
    kind: variant-of
    note: 本页归档历史 v0.30.0rc2 快照（7d825229），不包含后来 v0.30.0 正式版（c09d3e20）的修复与生产迁移清单
  - to: model-runner-v2
    kind: builds-on
    note: rc2 的 PCP 管理器与执行器补丁（只读 VLLM_USE_V2_MODEL_RUNNER）依赖 Model Runner V2 的演进边界
contradicts: []
updated: '2026-11-03'
rawSources:
  - >-
    raw/sha256-0a18f68e80f9d340d5f64f8ffbaacde9bed117318923b84e29262e052d73de85.md
  - >-
    raw/sha256-70a5d83159e69184dd0782ed6cc62694bbbf1d8b3af5451d386d07742d2e8e3a.md
---

## 这里的 rc2 指哪一份代码

本站新增的 0.30 对照使用用户指定的 `releases/v0.30.0rc2` 分支，固定在 2026-11-03 核对的提交 `7d825229`。该提交比 `v0.30.0rc2` 发布标签多两次文档提交，CP 设计文档在这两点之间没有变化。完整提交与仓库路径统一登记在 `wiki/seeds` 中，后续核对不随远端分支移动而改写已成立结论。

`rc2` 发布说明沿用 `rc1` 对上游 vLLM `v0.30.0` 的配套声明；本站控制流对照固定在该发布分支的 `ced6857a` 快照。2026-11-03 06:56 UTC 查询 `origin` 时，远端 `v0.30.0` 标签和 `releases/v0.30.0` 分支均指向 `ced6857a`，而本地已有同名标签仍指向 `9ed533eb`，两者不能混作同一次标签观测。

`ced6857a` 是 `9ed533eb` 之后的 CPU 镜像构建修复提交，仅为 `Dockerfile` 增加 SLEEF 子模块获取兜底，未改执行代码（完整固定值以 seeds 为准）。Ascend 的 `rc2` 发布说明称这次 RC 更新主要修复 Docker 构建所用的 CANN 版本，不能把“rc1 到 rc2 没有业务代码变化”解释成“0.26 到 rc2 没有变化”。[S1]

这组基线不包含后来 Ascend [`v0.30.0` 正式版](../concepts/v030-release-baseline.md)的修复。旧的 v0.23、v0.26 和 `main` 快照继续保留；GLM 双机教学仍按其[来源基线](glm-5-3-flash-baseline.md)解释已有形状、通信与容量算例。RFork 是独立工作版，不随社区版本升级。

## 为什么不能只照 CP 设计文档的一句话判断支持范围

先分清三个[上下文并行（CP）](../concepts/context-parallel.md)术语：**PCP** 是预填充上下文并行（prefill 切序列）、**DCP** 是解码上下文并行（decode 切历史 KV）、**DSA-CP** 是面向稀疏注意力的实验性上下文并行；**V1 / V2** 指两代单卡执行器（新一代执行器见 [Model Runner V2](../concepts/model-runner-v2.md)）。同一 rc2 提交的设计说明写着 PCP 不支持，但实际平台只在未启用 V2 时拒绝 PCP，V2 已有 PCP 管理器与后端分派。其限制包括 encoder-decoder、多模态输入、LoRA、投机方法及 graph mode 组合；“存在实现”和“所有模型都支持”之间还有这些校验。[S2][C3][C4]

GLM-5.3-Flash 的教程要求 V1，KPool 后端明确拒绝 PCP 或 DCP。它另有实验性的 SFA-only DSA-CP：在 TP 组内分担 SFA 查询位置，主 KV、索引池与尾缓存仍复制，KDA 沿用 TP；此时 PCP=DCP=1。三个名称不能互换，也不能由 DSA-CP 推出“GLM 的 KV 已按 DCP 分片”。[S5][C6]

## 怎样读各页新增的版本对照

每页的 rc2 段落说明本机制相对于旧快照的改变、保留行为及适用条件，来源固定到本版本代码。通用数学推演与旧部署数字保留原范围；新后端、新缓存布局、新默认值不能反向改变旧实验的事实。

执行器需核对最终配置：上游原配置属性会综合功能要求、显式环境变量与平台条件；Ascend 平台初始化导入的补丁将该属性改为只读 `VLLM_USE_V2_MODEL_RUNNER`，未设置时默认用 V1，模型兼容性交由 NPU runner 校验。

Worker 会保存最终属性，再在设备初始化时选择 V1 或 V2 实现。现场排错应先记录实际执行器、模型、硬件、最终配置与 commit，再对照相关页面。[C7][C12]

页头 verified 表示整页相关版本结论已逐条核对。增加一个局部版本差异或登记新 pin 都不自动获得该标记；静态源码验证也不等于 NPU 实测。

## 对照源码

平台补丁导入、Worker 保存选择与创建 runner 分别见来源 15、14、13。来源 16 是 ced6857a 的 CPU 构建兜底；版本身份还需结合该提交的父提交与 v0.30.0 标签，不能只靠文件正文推断标签归属。
