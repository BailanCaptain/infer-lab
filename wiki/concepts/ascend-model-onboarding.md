---
id: ascend-model-onboarding
title: 新模型上线标准流程：核对兼容版本、识别仍维护的部署指南与权重选型
type: concept
origin: direct
legacyAnchors:
  第一关为什么必须锁死五维配套: 第一关：为什么必须核对五维兼容版本？
  第二关怎样查模型支持状态并避开-27-篇停服桩: 第二关：怎样查模型支持状态，并避开 27 篇停止维护公告？
  先看支持矩阵图例再识破52-篇食谱陷阱: 先看支持矩阵图例，再分清 52 篇部署指南的维护状态
  v0300-全部-25-篇活跃模型食谱分类清单: v0.30.0 全部 25 篇仍维护的部署指南清单
summary: >-
  在昇腾上跑通一个新模型，先核对 vllm、vllm-ascend、CANN、torch_npu 与硬件卡型五维兼容版本，再从 v0.30.0 的 25 篇仍维护的部署指南（避开 27 篇停止维护公告，注意 GLM5.md 中 GLM-5 停止维护而 GLM-5.1 仍在维护）与三路注册机制确认支持路径，最后按代际完成权重与启动配置选型。
aliases:
  - 新模型上线
  - 模型上线
  - 新模型适配
  - 五维版本锁死
  - 版本配套
  - 模型食谱
  - Model Tutorials
  - Supported Models
  - Model Onboarding
  - 模型支持矩阵
  - 停服模型
  - Discontinued Models
  - 权重选型
  - ModelRegistry
  - 昇腾支持哪些模型
  - 新模型怎么上线
chapters:
  - '01'
order: 3
sources:
  - 'vllm-ascend@c09d3e20:docs/source/community/versioning_policy.md#L20-L32'
  - 'vllm-ascend@c09d3e20:docs/source/getting_started/installation/supported_hardware.inc.md#L1-L6'
  - 'vllm-ascend@c09d3e20:docs/source/getting_started/installation/install_vllm_ascend.inc.md#L24-L47'
  - 'vllm-ascend@c09d3e20:docs/source/getting_started/installation/install_vllm_ascend.inc.md#L135-L166'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/support_matrix/supported_models.md#L11-L69'
  - 'vllm-ascend@c09d3e20:docs/source/tutorials/models/GLM5.md#L1-L15'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/quantization.md#L105-L126'
  - 'vllm-ascend@c09d3e20:docs/source/getting_started/quick_start/online/qwen3-0.6b-310p.inc.md#L1-L16'
  - 'vllm-ascend@c09d3e20:Dockerfile#L17-L66'
  - 'vllm-ascend@c09d3e20:requirements.txt#L16-L40'
  - 'vllm-ascend@c09d3e20:setup.py#L141-L165'
  - 'vllm-ascend@c09d3e20:setup.py#L506-L517'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/hardware.py#L16-L76'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/device_config.py#L65-L77'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L283-L387'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L153-L160'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/__init__.py#L4-L102'
  - 'vllm@ced6857a:vllm/model_executor/models/registry.py#L1318-L1423'
  - 'vllm@ced6857a:vllm/config/model.py#L167-L369'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/utils.py#L140-L265'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L130-L240'
  - 'vllm-ascend@2c59ff10:vllm_ascend/utils.py#L824-L860'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L786-L820'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/__init__.py#L1-L130'
  - 'vllm@ced6857a:vllm/envs.py#L716-L719'
  - 'vllm-ascend@c09d3e20:mkdocs.yml#L176-L180'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L341-L350'
verified:
  - releases/v0.30.0
  - releases/v0.23.0
  - releases/v0.26.0rc
  - main
evidence: C
relations:
  - to: hf-model-anatomy
    kind: builds-on
    note: 先读懂模型目录的 config.json、架构名与量化文件特征，再按四道关完成昇腾版本锁死与权重选型
  - to: hardware-devices
    kind: builds-on
    note: 分清 Atlas A2/A3、310P 与 950DT 系列及软件可见设备映射，才能正确锁死第五维卡型
contradicts: []
updated: '2026-11-18'
---

在昇腾（Ascend）上把一个模型跑通并提供服务，不是装好最新包再敲 `vllm serve` 就完事。由于推理框架、插件层、底层计算栈和芯片卡型彼此咬合，上线新模型须按顺序走通四道关：核对五维兼容版本、辨别仍维护的部署指南与停止维护公告、确认模型类由谁提供，最后按代际芯片挑对权重（模型训练后保存的数值参数）格式与最小启动开关。

本文以 `vLLM Ascend v0.30.0` 配对上游 `vLLM v0.30.0` 为标准主基线，贯穿两个教学标尺：`Qwen3-8B`（Dense GQA，多个查询头共享一个键值头的密集模型）与 `Qwen3-30B-A3B`（MoE，每个输入 token 仅激活部分专家的混合专家模型）。

## 上线一个新模型之前，先走通哪四道关？

把“在昇腾上上线一个新模型”拆成四个依次把关的问题，哪一步没对齐，后面就会在导入、启动或加载权重时直接报错或悄悄吃掉翻倍显存：

```wiki-diagram
file: onboarding-four-gates
```

对照上图，四道关各自要核实的核心问题与失配后果如下：

| 关卡 | 要回答的核心问题 | 不对齐的典型后果 |
|---|---|---|
| 第一关：核对兼容版本 | 我的 `vllm`、`vllm-ascend`、`CANN`、`torch_npu` 与硬件卡型是否版本兼容？ | 导入缺符号、`pip` 装错卡型包，或 Worker 启动检查直接抛 `RuntimeError` |
| 第二关：支持矩阵与部署指南 | 目标模型有仍维护的部署指南，还是已发停止维护公告？能否直接跑 `v0.30.0` 正式标准镜像？ | 误照已停止维护的文档或型号调参，或拿正式标准镜像去跑专属镜像模型而失败 |
| 第三关：模型代码从哪来 | `vllm serve` 会命中上游内置类、`vllm-ascend` 专有/覆写类，还是回退 `transformers`？ | 报不支持该架构（`ValueError`），或漏开远程代码信任与配置覆盖开关 |
| 第四关：权重选型与转换 | 选浮点、`ModelSlim`、`LLM-Compressor` 还是原生分块 `FP8`？加载期会怎样改写？ | `310P` 用 `BF16` 或原生 `FP8` 失败，或原生 `FP8` 在 A2/A3 上静默反量化成 `BF16` 导致显存翻倍 |

## 第一关：为什么必须核对五维兼容版本？

`vllm-ascend` 不是一份独立的推理引擎，而是挂在 `vllm` 之外的平台插件（详见 [vLLM-Ascend 概览](vllm-ascend-overview.md)）。它一头调用 `vllm` 的调度与引擎接口，另一头通过编译好的 C++/AscendC 算子和 PyTorch 昇腾扩展（`torch_npu`）去驱动 **CANN**（昇腾底层软件栈，提供运行时、算子、图编排和集合通信能力）与具体 **NPU**（昇腾计算处理器）。

这五条线——`vllm`、`vllm-ascend`、`CANN`、`torch_npu` 与 **硬件卡型**——必须同时核对并固定在同一发布基线上，原因有二：

- **接口与 ABI 强绑定**：Python 接口与算子二进制接口（ABI）跨版本极易不兼容。
- **启动期卡型硬校验**：安装包构建时会把目标卡型写死进 `vllm_ascend/_build_info.py` 的 `__device_type__`。负责执行计算的 **Worker**（`NPUWorker`）启动时，`NPUWorker.__init__` 会立刻调用 `check_ascend_device_type()`，读取 `torch_npu.npu.get_soc_version()` 与安装卡型比对；两者不符时在加载权重前直接抛出 `RuntimeError` 退出（Worker 六步启动顺序见 [NPUWorker 启动](npu-worker-lifecycle.md)）。

下图以立体拆解剖面配合中文引线直标，把四层软件栈、启动期 SoC 校验门禁与右侧四大硬件族的对应关系对应到同一张视图上：

```wiki-diagram
file: onboarding-plate-five-dims
```

### `v0.30.0` 五维软件配套基线

顺着剖面图左侧的四层软件栈逐项核对，`v0.30.0` 标准基线上五个软件层和关键辅助依赖的对应关系如下：

| 配套维度 | `v0.30.0` 标准基线要求 | 说明 |
|---|---|---|
| `vllm-ascend` | `v0.30.0` | 插件本体，内置昇腾模型注册、算子与硬件档案 |
| `vllm` | `v0.30.0`（以 `VLLM_TARGET_DEVICE="empty"` 方式安装） | 上游推理框架、调度器、模型注册表与通用入口 |
| `CANN` | `9.2.1`（配套 `NNAL 9.2.0`、`HDK 26.1.1`） | 官方 Docker 镜像与版本策略文件均锁定 `9.2.1` |
| `PyTorch` / `torch_npu` | `torch==2.10.0` + `torch-npu==2.10.0.post7` | 设备张量运行时、算子分发与内存管理接口 |
| `triton-ascend` 与 `transformers` | `triton-ascend==3.6.0.post2`（**`310P` 除外**）、`transformers==5.14.1`、`Python >= 3.10, < 3.13` | A2/A3/950DT 需先卸载上游 `triton` 再装 `triton-ascend`；`310P` 不支持 `triton` |

### 第五维：四族硬件卡型与安装/运行分流

仅锁软件版本还不够，因为 `vllm-ascend` 在编译期与运行期把昇腾产品线分为四大硬件族（芯片与板卡的物理拓扑差异详见 [NPU、板卡、服务器与机柜](hardware-devices.md)），不同硬件族的镜像标签、安装通道和运行开关并不通用：

```wiki-diagram
file: onboarding-fig-four-families
```

对照上方四列硬件卡，各族典型产品、安装渠道与运行期硬限制汇总如下：

| 硬件族 | 典型产品与 `SOC_VERSION` | 官方镜像与安装通道 | 核心硬件限制与必改开关 |
|---|---|---|---|
| **Atlas A2** | `Atlas 800T/I A2`、`900 A2 PoD`、`200T A2 Box16`、`300T A2`（`ascend910b*`） | `vllm-ascend:v0.30.0`；标准 `pip install vllm-ascend` 默认预编译 wheel **仅面向 A2** | 需 `triton-ascend`；支持 `BF16`、`W8A8`、`W4A8`、`ACL Graph`（昇腾图模式，捕获算子序列以减少逐次下发开销） |
| **Atlas A3** | `Atlas 800T/I A3`、`900/9000 A3 SuperPoD`（`ascend910_93*`） | `vllm-ascend:v0.30.0-a3`；不能直接用默认 `pip` wheel，需官方镜像、`uv` WheelNext（按硬件架构自动选包的扩展索引）或带芯片型号标识 `SOC_VERSION` 的源码编译 | 双裸片（dual-Die）设计使单张物理 NPU 暴露为两个可见设备（`/dev/davinci[0-15]`）；需 `triton-ascend` |
| **Atlas 300I DUO / 200I Pro（`310P`）** | `Atlas 300I DUO`、`Atlas 200I Pro`（`ascend310p*`） | `vllm-ascend:v0.30.0-310p`；源码编译或镜像均定向构建，使用专用 `NPUWorker310` | **不支持 `triton`/`triton-ascend`**、**不支持 `BF16`**、**不支持 `npugraph_ex`**；启动必须显式传 `--dtype float16`（或 `W8A8-310P`）、限制 `FULL_DECODE_ONLY` 捕获尺寸，并设 `enable_npugraph_ex: false` |
| **950DT（`A5`）** | `950DT` 系列（`ascend950*`） | `vllm-ascend:v0.30.0-a5`；需对应镜像、`uv` WheelNext 或源码编译 | 硬件档案启用 `FP8_OPTIMIZED` 与 `CANN_MEGAMOE_MXFP`，支持 `MXFP8` / `MXFP4` 低比特路径；需 `triton-ascend` |

动手前先在宿主机跑一遍 `npu-smi info`，核对卡型号、可见设备号和驱动版本；如果没有把握自己从源码配齐子模块与编译环境，初学者应优先直接拉取对应硬件后缀的官方 `v0.30.0` 预构建容器镜像。

## 第二关：怎样查模型支持状态，并避开 27 篇停止维护公告？

核对好兼容版本后，不要凭记忆或模型仓库名猜测能不能跑，先查 `vllm-ascend` 官方文档里的模型支持矩阵（`supported_models.md`）与模型部署指南目录（`docs/source/tutorials/models/`）。下图把 52 篇指南文档的筛选漏斗、`20 + 5` 镜像分档以及最隐蔽的 `GLM5.md` 同文件分叉陷阱浓缩在一张图里：

```wiki-diagram
file: onboarding-fig-recipes-funnel
```

### 先看支持矩阵图例，再分清 52 篇部署指南的维护状态

`supported_models.md` 用五种状态标记模型成熟度：`✅ Supported`（正式支持）、`🔵 Experimental`（实验支持，部分特性或卡型受限）、`🟡 Unverified`（未完整验证）、`🔴 Unmaintained`（不再维护）和 `❌ Unsupported`（明确不支持，如 `Atlas 300I DUO` 的 `BF16` 列）。

新手最容易踩的坑在教程目录里：`v0.30.0` 的 `docs/source/tutorials/models/` 下共有 `52` 篇模型文档（另加 `index.md`），但其中**只有 `25` 篇是仍维护的部署指南**。其余 **`27` 篇全是只有 3 行的停止维护公告（Discontinued stub）**，点进去只有 `# 模型名` 标题、一行空行，以及一句停止维护提示：

> `This model has been discontinued since vLLM Ascend v0.30.0 and will no longer receive support or fixes in subsequent versions.`

停止维护公告末尾只附带跳回 `v0.23.0` 历史文档的链接。只要在 `supported_models.md` 看到 `🔴 Unmaintained` 或点进文档看到上述三行声明，就说明该模型已退出 `v0.30.0` 维护，不能把旧命令当成当前基线的支持依据。

### 特别提醒：`GLM5.md` 的「同文件分叉」陷阱

还要格外注意 `GLM5.md`（标题 `# GLM-5 & GLM-5.1`）：它虽属于 25 篇仍维护的部署指南，但第 11 行明确声明 **`GLM-5` 自 `vLLM Ascend v0.30.0` 起已停止维护**（支持矩阵标 `🔴`）。从第 13 行起介绍的 **`GLM-5.1`** 才是 `v0.30.0` 正式支持的在护模型（标 `✅`）。看到 `GLM5.md` 仍在仓库里，并不代表 `GLM-5` 受支持；至于同属仍维护部署指南的 `GLM5.3-Flash.md`，本站另有一条双机 16 卡历史绑定算例在 [GLM-5.3-Flash 模型结构](glm-5-3-flash.md) 中展开，阅读时须区分基线版本。

### `v0.30.0` 全部 25 篇仍维护的部署指南清单

下面列出 `vllm-ascend v0.30.0` 中全部 **25 篇仍维护的部署指南**。其中 **20 篇**可直接使用 `v0.30.0` 正式标准镜像；另有 **5 篇**在指南安装节注明专属镜像标签、`not yet been merged` 或 `nightly-main` 依赖。拉取镜像前务必先读指南安装节核对这两点，再确认能否直接跑 `v0.30.0` 正式标准镜像（下表「镜像与合入状态」列已逐一标出，多机并行命令以各自指南正文为准）：

#### 1. 文本密集（Dense）与混合专家（MoE）主干模型（16 篇）

| 食谱文件 | 覆盖模型与定位 | 核心硬件、Runner 与权重提示 | 镜像与合入状态 |
|---|---|---|---|
| `Qwen3-Dense.md` | `Qwen3-0.6B/1.7B/4B/8B/14B/32B`（**标准教学标尺 `Qwen3-8B`**） | A2/A3（`BF16`、`W8A8`、`W4A4`），300I DUO（`W8A8SC-310`） | `v0.30.0` 正式标准镜像 |
| `Qwen3-30B-A3B.md` | `Qwen3-30B-A3B`（30.5B/3.3B MoE，**标准教学标尺**） | A2/A3（`BF16`、`W8A8`，常配合 EP 与 [EAGLE3](speculative-decoding.md) 投机解码），300I DUO（`w8a8-QuaRot-310`） | `v0.30.0` 正式标准镜像 |
| `Qwen3.5-Dense.md` | `Qwen3.5-2B/4B/9B`（[GDN 门控线性注意力](linear-attention.md) + 全注意力） | Atlas 300I DUO 与 Atlas 200I Pro（`FP16`、`W8A8-310P`） | `v0.30.0` 正式标准镜像 |
| `Qwen3.5-27B-Qwen3.6-27B.md` | `Qwen3.5-27B` & `Qwen3.6-27B`（GDN + 全注意力） | A2/A3（`BF16`/`W8A8`），300I DUO（浮点权重配 `--dtype float16` / `W8A8-310P`），950DT（`BF16`/`w8a8-mxfp8`/`w8a8c8-mxfp8`） | `v0.30.0` 正式标准镜像 |
| `Qwen3.6-35B-A3B.md` | `Qwen3.6-35B-A3B`（GDN + 全注意力 MoE） | A2/A3（`BF16`/`W8A8`）、300I DUO（浮点权重配 `--dtype float16` / `W8A8`），950DT（`BF16`/`w8a8-mxfp8`/`w8a8c8-mxfp8`/`w4a8-mxfp`） | `v0.30.0` 正式标准镜像 |
| `Qwen3.8-27B.md` | `Qwen3.8-27B`（GDN + 全注意力 + [MTP 多 token 预测](speculative-decoding.md)） | 950PR/950DT（`BF16`/`mxfp8`/`w8a8c8-mxfp8`），A2/A3（`BF16`/`W8A8`），300I DUO（`W8A8-310P`） | `v0.30.0` 正式标准镜像 |
| `Qwen3.8-2.4T-A95B.md` | `Qwen3.8-2.4T-A95B`（2.4T 总参 / 95B 激活 MoE） | 多机 A3（`W8A8`，4×A3）或 A2（`W4A8`，8×A2） | **需专属镜像 / 代码未进 `v0.30.0` 正式包**（食谱指定 `vllm-ascend:qwen3.8-a3` / `qwen3.8-a2`） |
| `Qwen3.8-Flash-Next.md` | `Qwen3.8-Flash-Next`（实验支持 `🔵`，GDN + QSA MoE） | **仅 Atlas A3**（`W8A8`）；A2 与 950 暂不支持 | **需专属镜像 / 代码未进 `v0.30.0` 正式包**（食谱指定 `vllm-ascend:qwen3.8-next-a3` / `-openeuler`） |
| `DeepSeek-V4-Flash.md` | `DeepSeek-V4-Flash`（[mHC 多路残差](layers-and-hidden.md) + [稀疏](sparse-attention.md)/[MLA](mla.md) MoE） | A2/A3（`W8A8`），950DT（`MXFP`、`W4A4C8`） | **需专属镜像 / 代码未进 `v0.30.0` 正式包**（MTP 路径用 `v0.30.0` 标准镜像；[DSpark](dspark.md) 变体与超长序列 PD 注明改用 `vllm-ascend:nightly-main`） |
| `DeepSeek-V4-Pro.md` | `DeepSeek-V4-Pro` | A2/A3（`W4A8`），950DT（`MXFP`、`W4A4C8`） | `v0.30.0` 正式标准镜像 |
| `DeepSeek-V4.1-Flash.md` | `DeepSeek-V4.1-Flash`（552B/8B CED + CSA2 + Engram） | 950DT（`MXFP` + `VLLM_USE_V2_MODEL_RUNNER=1` + `--quantization deepseek_v4_fp8`），A2/A3（`W8A8` + `VLLM_USE_V2_MODEL_RUNNER=0`） | `v0.30.0` 正式标准镜像 |
| `GLM5.md` | `# GLM-5 & GLM-5.1`（**仅 `GLM-5.1` 活跃，`GLM-5` 已停服**） | `GLM-5.1` 支持 A2/A3（`W4A8`/`W8A8`/`W8A8C8-MTP`）与 950DT（`W4A4C8-mxfp4`），要求 `transformers >= 5.2.0` | `v0.30.0` 正式标准镜像 |
| `GLM5.2.md` | `GLM-5.2` & `GLM-5.3` | A2/A3（`W8A8C8`），950DT（`W8A8C8-mxfp8`/`W4A4C8-mxfp4`） | `v0.30.0` 正式标准镜像 |
| `GLM5.3-Flash.md` | `GLM-5.3-Flash`（320B/18B KDA + 稀疏 MLA + mHC） | A2/A3（`W8A8`，`VLLM_USE_V2_MODEL_RUNNER=0`），950DT（`W8A8-mxfp8`） | `v0.30.0` 正式标准镜像 |
| `Hy4-preview.md` | `Hy4-preview`（实验支持 `🔵`，770B/49B MoE） | **仅 Atlas A3**（`W8A8` + `--quantization ascend`）；A2 不支持 | **需专属镜像 / 代码未进 `v0.30.0` 正式包**（原文写 `supporting code has not yet been merged`，仅支持 `vllm-ascend:hy4-a3`，暂不支持源码安装） |
| `Kimi-K3.md` | `Kimi-K3`（KDA + MLA + LatentMoE + MoonViT） | `v0.30.0` 验证支持 950DT、A3、A2（`W4A8`，支持 DSpark） | `v0.30.0` 正式标准镜像 |

> **表内架构与权重量化代号速查**：`W8A8SC-310` 指面向 `310P` 的权重稀疏压缩量化包；`KDA` 为每步只维护定长状态的门控线性注意力；`QSA` 与 `CSA2` 均为只挑选高相关历史位置的稀疏注意力变体；`CED` 为前半层生成全局共享 KV、后半层复用的跨层编解码结构；`LatentMoE` 指先压入低维潜空间再进路由专家的混合专家层。

#### 2. 多模态视觉（VLM）、语音（ASR）与嵌入（Embedding）模型（9 篇）

> 多模态视觉语言模型（VLM）的图像/视频预处理与跨模态合并详见 [多模态推理](multimodal-inference.md)，分塔精度对齐、视觉编码耗时与特征缓存取证详见 [多模态编码缓存与分塔取证](multimodal-encoder-cache.md#新多模态模型量化精度对齐与服务级性能取证)；语音转写（ASR）与非自回归嵌入（Embedding）池化路径详见 [Pooling 与非自回归推理](pooling-and-non-ar.md)。

| 食谱文件 | 覆盖模型与定位 | 核心硬件与使用限制 | 镜像与合入状态 |
|---|---|---|---|
| `Qwen-VL-Dense.md` | `Qwen3-VL-8B/32B`（视觉语言密集模型） | A2/A3（`BF16`）、300I DUO（`FP16`），950DT（`W8A8`） | `v0.30.0` 正式标准镜像 |
| `Qwen3-VL-30B-A3B-Instruct.md` | `Qwen3-VL-30B-A3B-Instruct`（视觉语言 MoE） | A2/A3（`BF16`），950DT（`w8a8-mxfp8`） | `v0.30.0` 正式标准镜像 |
| `Qwen3.5-397B-A17B.md` | `Qwen3.5-397B-A17B`（多模态 MoE） | A2/A3（`BF16`/`W8A8`/`W4A8`），950DT（`BF16`/`mxfp8`/`mxfp4`） | `v0.30.0` 正式标准镜像 |
| `Gemma4.md` | `Gemma4`（实验支持 `🔵`，Dense 31B & MoE 26B-A4B 多模态） | A2/A3/950PR&950DT（`BF16`），950DT（`MXFP4` + `--quantization ascend`） | `v0.30.0` 正式标准镜像 |
| `Kimi-K2.6.md` | `Kimi-K2.6`（多模态智能体 MoE） | A2/A3（`W4A8`，支持 EAGLE3 / DFlash） | `v0.30.0` 正式标准镜像 |
| `MiniMax-M3.md` | `MiniMax-M3`（文本/图像/视频多模态） | A2/A3（`BF16`/`W8A8`），950DT（`MXFP8`） | `v0.30.0` 正式标准镜像 |
| `Dots3-Note.md` | `Dots3 Note`（MoE + MLA + 视觉/音频） | A2/A3；文本、图像与音频模式按进程启动参数互斥绑定 | **需专属镜像 / 代码未进 `v0.30.0` 正式包**（食谱指定 `vllm-ascend:dots3-note-prev*` 一体化预览镜像） |
| `Cohere-Transcribe.md` | `Cohere Transcribe`（2B Conformer 语音识别） | Atlas A2 单卡（`BF16`） | `v0.30.0` 正式标准镜像 |
| `SigLIP2.md` | `SigLIP2`（对比池化图像/文本嵌入模型） | **仅 Atlas 300I DUO**（`FP16`，通过 `llm.embed()` / `/v1/embeddings` 调用） | `v0.30.0` 正式标准镜像 |

## 第三关：`vllm serve` 怎么找到模型实现？三条支持路径分清楚

把模型目录或仓库 ID 交给 `vllm serve` 后，vLLM 不会猜模型结构，而是先读目录下的 `config.json`。若命令行传入了 `--hf-overrides`，会先在内存中覆盖 `architectures`、`model_type` 等字段而不改磁盘文件；随后把 `architectures` 列表交给 `ModelRegistry`，按以下三条路径依次解析模型类：

```wiki-diagram
file: onboarding-model-registry-routing
```

把这三条路径分清，就能解释为什么“有的新模型一发布就能直接跑，有的却必须等 `vllm-ascend` 发新版本”：

- **路径 A（上游 `vllm` 原生内置）**：`Qwen3-8B`（`Qwen3ForCausalLM`）与 `Qwen3-30B-A3B`（`Qwen3MoeForCausalLM`）的模型类已在上游 `_TEXT_GENERATION_MODELS` 中，`vllm_ascend/models/` 无需重写同名类。它们能在昇腾直接跑，靠的是 `NPUPlatform` 在插件发现期自动接入昇腾注意力后端、自定义算子与平台契约（见 [插件发现与模型注册](platform-plugin-registration.md)、[NPUPlatform](npu-platform.md) 与 [vLLM 平台接口](vllm-platform-interface.md)）。
- **路径 B（`vllm-ascend` 专有注册或覆写）**：`setup.py` 通过 `ascend_model = vllm_ascend:register_model` 向 `ModelRegistry` 注册了 `29` 个架构名。一类是上游尚未内置或高度定制的昇腾实现（如 `DeepseekV4*`、`DeepseekV41*`、`Glm5Next*`、`KimiLinearForCausalLM`、`KimiK3*`、`MiniMaxM3Sparse*`、`Gemma4ForConditionalGeneration` 及草稿模型）。另一类是**主动覆写上游同名条目**，例如把 `Qwen3_5ForConditionalGeneration` 与 `Qwen3_5MoeForConditionalGeneration` 替换为在 NPU 上做图像缩放、切块与归一化的实现。
- **路径 C（`transformers` 回退与配置微调）**：若架构名不在两仓注册表中且走常规生成路径，默认 `--model-impl auto` 会经 `_try_resolve_transformers` 回退到 HuggingFace `transformers` 后端（也可传 `--model-impl transformers` 强制指定）。仓库带 `auto_map` 自定义建模文件时须加 `--trust-remote-code`；若兼容变体只是改了架构名，可用 `--hf-overrides '{"architectures":["..."]}'` 在内存中改名验证。

## 第四关：权重格式怎么选？不同卡型在加载期会做什么转换

确认模型代码能解析后，下一步是挑一份和目标硬件匹配的权重（checkpoint）。在 `vllm-ascend v0.30.0` 中，`NPUPlatform.check_and_update_config` 会在读盘前自动调用 `maybe_auto_detect_quantization()`。若未显式传 `--quantization`，它会按固定优先级检查模型目录，自动决定 **quantization**（量化，用低比特数值与缩放系数表示权重或激活以省显存和带宽的方法，见 [量化](quantization.md)）或浮点加载路径。下图以立体拆解剖面配合引线直标，展示左侧四级探测门禁与右侧三类硬件代际的加载期转换分叉：

```wiki-diagram
file: onboarding-plate-weight-fork
```

### 四类权重路径与加载期探测优先级

`maybe_auto_detect_quantization()` 按自上而下的顺序识别权重文件特征，四类权重在硬件支持和参数要求上差异很大（数值格式本身的区别见 [低精度格式](low-precision-formats.md)）：

| 优先级 | 识别特征与代表工具 | 自动填充的 `--quantization` | 硬件适用性与关键注意事项 |
|---|---|---|---|
| 1 | 存在 `quant_model_description.json`（**ModelSlim** 产物，含 `W8A8`、`W4A8`、`W8A8C8`、`MXFP4` 等） | `"ascend"` | 最常见的昇腾量化路径；自动探测可免写参数，但显式加上 `--quantization ascend` 能避免混合目录歧义，且运行期可能将部分权重转为 **NZ**（`FRACTAL_NZ` 分块布局，相对通用多维 **ND** 格式更贴合矩阵核访存，见 [张量存储布局](tensor-layout.md)） |
| 2 | `config.json` 中 `quantization_config.quant_method == "compressed-tensors"`（**LLM-Compressor** 产物） | `"compressed-tensors"` | 上游生态标准压缩格式，**不要**额外加 `--quantization ascend` |
| 3 | `config.json` 中 `quantization_config.quant_method == "fp8"`（**原生分块 `FP8`**） | `"fp8"` | 仅支持带 `weight_block_size` 的**分块（block-wise）FP8**；逐张量或逐通道 `FP8` 无昇腾执行路径会报错。`310P` 走兼容后端不支持原生 `FP8`；**`950DT` 与 `A2/A3` 的加载期行为完全不同（见下文陷阱）** |
| 4 | 以上皆无（未量化浮点权重） | `None`（按浮点加载） | A2 / A3 / 950DT 默认可用 `BF16`（16 位脑浮点）作精度基线；**`310P` 不支持 `BF16`**，必须显式 `--dtype float16` 或换用 `W8A8-310P` 量化权重 |

### 重点避坑：原生分块 `FP8` 在 `A2/A3` 与 `950DT` 的行为分叉

越来越多开源模型直接以原生分块 `FP8`（每块权重存成 1 字节 `float8_e4m3fn` 配一个 `float32` 块缩放系数）发布。初学者常误以为磁盘文件只有 `BF16` 一半大，放到 **Atlas A2 / A3** 上也能省一半 **显存（HBM）**。在 `v0.30.0` 里这是危险误判，源码按硬件代际分成了三条路：

- **在 `Ascend 950（is_950() 为真）` 上**：`fp8_block.py` 在加载后处理（`process_weights_after_loading`）先解出分块权重，再在线重组为 **MXFP8**（每元素仍占 `1` 字节，配 `E8M0` 微缩放系数，走原生 `FP8` 矩阵乘）。只有两处局部回退 `model_dtype`（通常 `BF16`）：一是被注意力后端吸收的 MLA `kv_b_proj` 层，二是输入维 `in_features` 不能被 `32` 整除的线性层。
- **在 `Atlas A2 / A3（mxfp8_method 为 None）` 上**：`fp8_block.py` 调用 `resolve_block_scales()`，在加载期把分块 `FP8` 权重**静默反量化回 `model_dtype`（通常 `BF16`）**，再走 `BF16` 矩阵乘。计算结果等价，但卡上驻留权重直接翻倍到约 **2 字节/参数**。
- **在 `Atlas 300I DUO（310P）` 上**：硬件档案将量化后端族设为 `COMPATIBILITY`，`NPUPlatform` 只导入 `AscendModelSlimConfig310` 而**不注册 `AscendFp8Config`**，不支持加载原生 `FP8`。在 `310P` 上应选浮点权重配 `--dtype float16`，或专用 `W8A8-310P` 量化权重。

举个最小示意账（仅看纯权重容量，不含 KV cache、图工作区与分段冗余）：一份磁盘约 `30 GB` 的 30B 级原生分块 `FP8` 权重，放到 `950DT` 上重排成 `MXFP8` 后驻留仍接近 `30 GB`。但放到 `Atlas A2 / A3` 加载后会膨胀到约 `60 GB`；若总可用显存未按翻倍预留，显存探测阶段就会直接溢出失败。

## 拿 `Qwen3-8B` / `Qwen3-30B-A3B` 走一遍最小上线检查单

按前四关核对无误后，可用下面三步最小流水线验证“装得对、找得到模型、服务能吐字”。若机器无法直连 HuggingFace，启动前导出 `export VLLM_USE_MODELSCOPE=True` 即可改从 ModelScope 拉取；需要覆盖昇腾高级选项时，可用 `--additional-config` 传入 JSON（三路配置优先级见 [Ascend 配置体系](ascend-config-system.md)）：

```wiki-diagram
file: onboarding-fig-smoke-checklist
```

### 1. 启动前两步自检

1. 运行 `npu-smi info`，记下卡型（确认属于 `A2`、`A3`、`310P` 还是 `950DT`）以及空闲卡号，例如设置 `export ASCEND_RT_VISIBLE_DEVICES=0`（单卡）或 `0,1,2,3`（四卡）。
2. 检查模型目录里的 `config.json` 与是否存在 `quant_model_description.json`：
   - 如果跑原版浮点权重：`A2/A3/950DT` 直接用默认 `BF16`，`310P` 加上 `--dtype float16`。
   - 如果跑 ModelSlim 量化权重：确认目录下有 `quant_model_description.json`，并显式加上 `--quantization ascend`。

### 2. 最小化 `vllm serve` 启动示例

以下以 **Atlas A2/A3** 运行标准 `Qwen3-8B`（Dense）与 `Qwen3-30B-A3B`（MoE）为例，均采用 `FULL_DECODE_ONLY`（仅对 decode 阶段启用完整图捕获）。若换到 **Atlas 300I DUO（`310P`）**，必须在命令行补上 `--dtype float16`、限定 `cudagraph_capture_sizes` 并显式关闭 `npugraph_ex`：

```bash
# 示例 A：Atlas A2/A3 单卡启动 Qwen3-8B（未量化 BF16 基线；内置架构无需 --trust-remote-code，仅第三关含 auto_map 时才加）
export ASCEND_RT_VISIBLE_DEVICES=0
export PYTORCH_NPU_ALLOC_CONF=expandable_segments:True
vllm serve /path/to/Qwen3-8B \
    --served-model-name qwen3-8b \
    --max-model-len 8192 \
    --compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}' \
    --port 8000

# 示例 B：Atlas A2/A3 四卡启动 Qwen3-30B-A3B（开启 TP=4 + EP + ModelSlim 量化；内置架构无需 --trust-remote-code）
export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3
export PYTORCH_NPU_ALLOC_CONF=expandable_segments:True
vllm serve /path/to/Qwen3-30B-A3B-W8A8 \
    --served-model-name qwen3-30b-a3b \
    --tensor-parallel-size 4 \
    --enable-expert-parallel \
    --quantization ascend \
    --max-model-len 8192 \
    --compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}' \
    --port 8000

# 示例 C：Atlas 300I DUO (310P) 最小适配改动（注意 float16 与关闭 npugraph_ex）
vllm serve /path/to/Qwen3-Dense-or-0.6B \
    --dtype float16 \
    --max-num-seqs 8 \
    --compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY","cudagraph_capture_sizes":[1,2,4,8]}' \
    --additional-config '{"ascend_compilation_config":{"enable_npugraph_ex":false}}'
```

### 3. 两条冒烟测试命令

看到 `Application startup complete.` 后，用 `/v1/models` 和 `/v1/completions` 确认模型已注册并能真实生成非空文本：

```bash
curl --fail http://localhost:8000/v1/models
curl --fail http://localhost:8000/v1/completions \
    -H "Content-Type: application/json" \
    -d '{"model":"qwen3-8b","prompt":"Beijing is a","max_tokens":5,"temperature":0}'
```

## 常见误解

上线排查时最容易被直觉带偏的五个误区，可以按下方「错误直觉 vs 源码真相」对照板逐条排除：

```wiki-diagram
file: onboarding-fig-five-myths
```

- **「装最新版 `vllm` 配最新版 `vllm-ascend` 就行，不用管 `CANN` 和 `torch_npu`」**：错。`vllm-ascend` 强绑定特定 `CANN`、`torch_npu` 和 `triton-ascend` 版本，混装常见结果是导入缺符号、算子找不到或容器与宿主机驱动不匹配。
- **「`tutorials/models/` 下有 52 个文件，说明 `v0.30.0` 支持这 52 个模型」**：错。其中 `27` 篇是只有 3 行的停止维护公告，只有 `25` 篇是仍维护的部署指南；而且 `GLM5.md` 内部也是混合写法——`GLM-5` 已在文件开头声明停止维护，只有 `GLM-5.1` 在 `v0.30.0` 仍在维护。
- **「直接 `pip install vllm-ascend` 就能跑在所有昇腾卡上」**：错。默认预编译 wheel 仅锁定 `Atlas A2`；跑在 `A3`、`310P` 或 `950DT` 上时，`NPUWorker.__init__` 的 `check_ascend_device_type()` 会在启动时直接报 `RuntimeError`。
- **「原生 `FP8` 模型在 `A2/A3` 上也能按 1 字节/参数省显存」**：错。`v0.30.0` 只在 `Ascend 950` 上把分块 `FP8` 重组为 `MXFP8`（排除被吸收的 `kv_b_proj` 和归约维非 32 倍数的层）。在 `A2/A3` 上加载期会静默反量化回 `BF16`（约 2 字节/参数），而 `310P` 走 `COMPATIBILITY` 后端不注册 `AscendFp8Config`，不支持原生 `FP8`。
- **「报架构不支持一定是硬件不行，重装驱动就能好」**：错。报错先分清卡在第三关的 `ModelRegistry` 解析（`--model-impl`、`--trust-remote-code`、`--hf-overrides` 或插件版本），还是第四关的量化/数据类型限制（例如 `310P` 拒收 `BF16` 或非分块 `FP8` 缺少执行路径）。

## 对照源码

### 怎么开与五维检查点

- **版本与镜像钉点**：`v0.30.0`（`c09d3e20`）通过 `.github/vllm-release-tag.commit` 与 `.github/vllm-main-verified.commit` 锁定配套上游 `vllm@ced6857a`（`v0.30.0`）[S1]；四个官方 `Dockerfile*` 均以 `cann:9.2.1-...-ubuntu22.04-py3.12` 为基础镜像，分别传入 `SOC_VERSION` 为 `ascend910b1`（A2）、`ascend910_9391`（A3）、`ascend310p1`（310P）与 `ascend950dt_9582`（A5）[C9]。Python 依赖钉在 `requirements.txt`（`torch==2.10.0`、`torch-npu==2.10.0.post7`、`triton-ascend==3.6.0.post2`、`transformers==5.14.1` 等）[C10]。`mkdocs.yml` 将 `release_hdk_version` 与 `release_nnal_version` 分别钉为 `"26.1.1"` 与 `"9.2.0"`[C26]；其文档宏变量 `release_cann_version` 在 `c09d3e20` 快照仍滞留在 `"9.2.0"`，已在社区 `main`（`8d6180e2`）修正为 `"9.2.1"` 与 `Dockerfile*` 及版本策略页对齐。
- **编译期与运行期卡型锁死**：`setup.py` 在构建阶段调用 `device_type_from_soc_version()` 并写入 `vllm_ascend/_build_info.py` 的 `__device_type__`，官方安装文档说明标准 `pip` wheel 仅面向 `A2`（并给出 `assert __device_type__ == "A2"` 自检）[S3][C11]。运行时 `NPUWorker.__init__` 调用 `check_ascend_device_type()`，读取 `torch_npu.npu.get_soc_version()` 并经 `device_type_from_runtime_soc()` 映射后与构建期类型比对[C13][C14][C16]。硬件能力档案 `HardwareProfile` 随后据 `AscendDeviceType` 分发 `default_worker_cls`（310P 为 `NPUWorker310`）、`device_adaptor_family`（A5 为 `FP8_OPTIMIZED`）、`quantization_backend_family`（310P 为 `COMPATIBILITY`）及 `NPUGRAPH_EX` / `FP8_ATTENTION` / `CANN_MEGAMOE_MXFP` 等开关[C15]。
- **模型注册与解析链**：`setup.py` 的 `vllm.general_plugins` 声明 `ascend_model = vllm_ascend:register_model`[C12]，调用 `vllm_ascend/models/__init__.py` 完成 `29` 次 `ModelRegistry.register_model(...)`（含对 `Qwen3_5*` 的覆写）[C17]。上游 `ModelRegistry.resolve_model_cls` / `inspect_model_cls` 按 `model_impl == "transformers"` → `"terratorch"` → `"auto"`（查已合并注册表，未命中且 `convert_type == "none"` 时回退 `_try_resolve_transformers`，若 `auto_map` 存在则受 `trust_remote_code` 控制）顺序解析[C18][C19]。
- **量化自动探测与分块 `FP8` 分支**：`NPUPlatform.check_and_update_config` 触发 `maybe_auto_detect_quantization()`，依 `quant_model_description.json` → `config.json` 中 `compressed-tensors` → `fp8` → 浮点四级顺序自动填充 `model_config.quantization`[C20]；仅当 `quantization_backend_family` 为 `STANDARD` 时才注册 `AscendFp8Config`，`310P` 走 `COMPATIBILITY` 分支仅注册 `AscendModelSlimConfig310`[C27]。分块 `FP8` 由 `fp8_block.py` 在 `process_weights_after_loading()` 中执行：`is_950()` 为真时构造 `AscendW8A8MXFP8DynamicLinearMethod` 并调用 `_mx_quantize()` 重打包为 `MXFP8`（跳过被注意力吸收的 `kv_b_proj` 层与归约维非 `32` 倍数的层）；`mxfp8_method is None` 时（A2/A3）则保留 `resolve_block_scales()` 产生的 `model_dtype`（`BF16`）权重并做 `maybe_trans_nz`[S7][C21]。
- **ModelScope 镜像源开关**：当运行环境无法直连 HuggingFace 时，设置 `VLLM_USE_MODELSCOPE=True`（由上游 `vllm/envs.py` 解析布尔环境变量）即可切换从 ModelScope 拉取模型[C25]。

### 会报什么错

| 失败位置 | 触发条件 | 常见报错或现象 | 定位依据 |
|---|---|---|---|
| 安装与构建期 | 在 A3/310P/950DT 上直接用标准 `pip` wheel 或未安装对应版本依赖 | 标准 `pip` wheel 仅产 `A2` 包；或 `310P` 误装 `triton` 引发算子缺失 | [S3][S4] |
| Worker 初始化 | 构建期 `__device_type__` 与运行时 `torch_npu.npu.get_soc_version()` 所属硬件族不一致 | `check_ascend_device_type()` 抛出 `RuntimeError: Current device type: ... does not match ...` | 来源 14、16 |
| `310P` 启动期 | 沿用 A2/A3 的 `BF16` 默认精度、加载原生 `FP8` 或未关闭 `npugraph_ex` | `supported_models.md` 标明 `310P` 不支持 `BF16`，且 `COMPATIBILITY` 后端不注册 `AscendFp8Config`；须配 `--dtype float16`、`FULL_DECODE_ONLY` 及 `enable_npugraph_ex: false` | [S5][S8] |
| 模型解析阶段 | `architectures` 未在 `ModelRegistry` 注册且无法回退 `transformers`，或缺少远程代码信任 | `_raise_for_unsupported()` 抛出 `ValueError`；未开 `--trust-remote-code` 时拒绝加载 `auto_map` | 来源 18、19 |
| 原生 `FP8` 加载 | 传入无 `weight_block_size` 的 per-tensor/per-channel `FP8`，或在 A2/A3 按 1B/参数估算显存 | 非分块 `FP8` 无昇腾路径报错；A2/A3 静默反量化为 `BF16` 导致权重占用翻倍至显存不足 | [S7] |

### 版本差异

| 核验维度 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
|---|---|---|---|---|
| 配套上游与核心依赖 | 配套 `vllm@0fc695fc`（`v0.23.0`）；`CANN 9.1.0`、`torch 2.10.0 / torch-npu 2.10.0.post4`、`triton-ascend 3.2.2`、`transformers 5.5.4` | 配套 `vllm@568afb3a`（`v0.26.0`）；`CANN 9.1.0`、`torch 2.10.0 / torch-npu 2.10.0.post4`、`triton-ascend 3.2.2`、`transformers 5.14.1` | 配套 `vllm@ced6857a`（`v0.30.0`）；`CANN 9.2.1`（`mkdocs.yml` 宏滞留 `9.2.0`）、`torch 2.10.0 / torch-npu 2.10.0.post7`、`triton-ascend 3.6.0.post2`、`transformers 5.14.1` | 配套 `vllm@ba15685a`（`Dockerfile*` 用 `VLLM_TAG=v0.33.0`）；`Dockerfile*` 用 `CANN 9.3.0_20261113161300`（`mkdocs.yml` 已修正发布宏为 `9.2.1`）、`transformers 5.19.0` |
| 硬件卡型抽象与校验位置 | `AscendDeviceType` 位于 `vllm_ascend/utils.py` [C22] | `AscendDeviceType` 仍位于 `vllm_ascend/utils.py` [C23] | 独立重构为 `vllm_ascend/device/hardware.py`、`device_config.py`（`check_ascend_device_type()`）与 `hardware_profile.py` | 延续 `vllm_ascend/device/` 硬件抽象与档案体系 |
| `vllm_ascend/models/__init__.py` 注册数量 | `3` 次 `register_model` 调用 | `10` 次 `register_model` 调用 | `29` 次 `register_model` 调用（含覆写 `Qwen3_5*`） | 增至 `36` 次 `register_model` 调用 [C24] |
| `docs/source/tutorials/models/` 活跃食谱与停服桩 | `41` 篇教程，`0` 篇停服桩 | `42` 篇教程，`0` 篇停服桩 | `52` 篇模型文件 = `25` 篇活跃食谱（其中 `5` 篇部分或全部路径依赖专属镜像 / `nightly-main` / 未合入代码）+ `27` 篇 3 行停服桩（`GLM5.md` 中 `GLM-5` 停服、`GLM-5.1` 活跃）[S6] | `55` 篇模型文件 = `28` 篇活跃食谱 + `27` 篇停服桩 [D] |

### 源码位置与来源索引

以下编号对应页首 `sources` 列表的第 1–27 项（其中文档 8 项对应上方 `S1`–`S8`，源码与配置 19 项对应 `C9`–`C27`）：

- 来源 1（S1）：`vllm-ascend@c09d3e20:docs/source/community/versioning_policy.md#L20-L32` — `v0.23.0`、`v0.26.0rc1`、`v0.30.0` 与 `CANN`/`torch_npu`/`triton-ascend` 版本政策。
- 来源 2（S2）：`vllm-ascend@c09d3e20:docs/source/getting_started/installation/supported_hardware.inc.md#L1-L6` — 四大支持硬件产品系列清单。
- 来源 3（S3）：`vllm-ascend@c09d3e20:docs/source/getting_started/installation/install_vllm_ascend.inc.md#L24-L47` — `pip`/`uv`/源码安装路径差异与 A2 默认 wheel 限制。
- 来源 4（S4）：`vllm-ascend@c09d3e20:docs/source/getting_started/installation/install_vllm_ascend.inc.md#L135-L166` — `triton-ascend` 安装及 `310P` 不支持 `triton` 说明。
- 来源 5（S5）：`vllm-ascend@c09d3e20:docs/source/user_guide/support_matrix/supported_models.md#L11-L69` — 模型支持矩阵图例、`GLM-5`（`🔴`）与 `GLM-5.1`（`✅`）状态、300I DUO 不支持 `BF16`。
- 来源 6（S6）：`vllm-ascend@c09d3e20:docs/source/tutorials/models/GLM5.md#L1-L15` — `GLM5.md` 第 11 行声明 `GLM-5` 停服与第 13 行起介绍 `GLM-5.1` 活跃配置。
- 来源 7（S7）：`vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/quantization.md#L105-L126` — 原生分块 `FP8` 在 `950` 与其他代际硬件的行为分叉及 `--quantization ascend` 用法。
- 来源 8（S8）：`vllm-ascend@c09d3e20:docs/source/getting_started/quick_start/online/qwen3-0.6b-310p.inc.md#L1-L16` — `310P` 运行必选参数（`--dtype float16`、`FULL_DECODE_ONLY`、`enable_npugraph_ex: false`）。
- 来源 9（C9）：`vllm-ascend@c09d3e20:Dockerfile#L17-L66` — 正式镜像 `CANN 9.2.1` 基线、`VLLM_TAG=v0.30.0` 与 `SOC_VERSION` 构建参数。
- 来源 10（C10）：`vllm-ascend@c09d3e20:requirements.txt#L16-L40` — `torch`、`torch-npu`、`triton-ascend`、`transformers` 等依赖钉死版本。
- 来源 11（C11）：`vllm-ascend@c09d3e20:setup.py#L141-L165` — 构建期 `SOC_VERSION` 到 `__device_type__` 写入 `_build_info.py`。
- 来源 12（C12）：`vllm-ascend@c09d3e20:setup.py#L506-L517` — `vllm.general_plugins` 注册 `ascend_model = vllm_ascend:register_model`。
- 来源 13（C13）：`vllm-ascend@c09d3e20:vllm_ascend/device/hardware.py#L16-L76` — `SOC_VERSION` 字符串与运行时 SoC 整数码到 `AscendDeviceType` 映射。
- 来源 14（C14）：`vllm-ascend@c09d3e20:vllm_ascend/device/device_config.py#L65-L77` — `is_950()` 与 `check_ascend_device_type()` 运行时一致性校验。
- 来源 15（C15）：`vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L283-L387` — 各硬件族不可变能力档案 `HardwareProfile` 定义。
- 来源 16（C16）：`vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L153-L160` — `NPUWorker.__init__` 调用 `check_ascend_device_type()` 入口。
- 来源 17（C17）：`vllm-ascend@c09d3e20:vllm_ascend/models/__init__.py#L4-L102` — `v0.30.0` 全部 `29` 项昇腾模型与覆写架构注册。
- 来源 18（C18）：`vllm@ced6857a:vllm/model_executor/models/registry.py#L1318-L1423` — `ModelRegistry.resolve_model_cls` / `inspect_model_cls` 三路解析顺序。
- 来源 19（C19）：`vllm@ced6857a:vllm/config/model.py#L167-L369` — `trust_remote_code` 与 `model_impl="auto"` 默认字段定义。
- 来源 20（C20）：`vllm-ascend@c09d3e20:vllm_ascend/quantization/utils.py#L140-L265` — `maybe_auto_detect_quantization()` 四级自动探测逻辑。
- 来源 21（C21）：`vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L130-L240` — 分块 `FP8` 在 `950` 转 `MXFP8`（跳过 `kv_b_proj` 等）与在 `A2/A3` 静默反量化回 `model_dtype` 的分支实现。
- 来源 22（C22）：`vllm-ascend@2c59ff10:vllm_ascend/utils.py#L824-L860` — `v0.23.0` 硬件类型枚举旧位置。
- 来源 23（C23）：`vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L786-L820` — `v0.26.0rc` 硬件类型枚举旧位置。
- 来源 24（C24）：`vllm-ascend@8d6180e2:vllm_ascend/models/__init__.py#L1-L130` — 社区 `main` 分支扩展至 `36` 项模型注册。
- 来源 25（C25）：`vllm@ced6857a:vllm/envs.py#L716-L719` — `VLLM_USE_MODELSCOPE` 环境变量控制从 ModelScope 拉取模型。
- 来源 26（C26）：`vllm-ascend@c09d3e20:mkdocs.yml#L176-L180` — `release_hdk_version`（`26.1.1`）、`release_nnal_version`（`9.2.0`）及文档发布宏变量定义。
- 来源 27（C27）：`vllm-ascend@c09d3e20:vllm_ascend/platform.py#L341-L350` — `STANDARD` 量化后端注册 `AscendFp8Config`，而 `310P`（`COMPATIBILITY`）仅导入 `AscendModelSlimConfig310`。
- 推导说明 `[D]`：综合 `supported_models.md`（来源 5）与目录逐文件核对，`v0.30.0` 共 52 个模型文档（25 活跃 + 27 停服桩），`main` 新增 3 篇活跃食谱后共 55 个模型文档。
