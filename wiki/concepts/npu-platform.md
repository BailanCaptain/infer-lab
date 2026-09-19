---
id: npu-platform
title: NPUPlatform
type: feature
summary: 继承上游 Platform 的那个类。vLLM 一切硬件相关的问题都问它，它还会在启动时真的改写用户给的配置。
aliases: [NPUPlatform, platform.py, 平台类, PlatformEnum.OOT]
chapters: ["10"]
order: 60
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L128-L146
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L176-L182
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L184-L204
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L275-L290
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L312-L333
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L338-L348
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L349-L360
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L361-L449
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L450-L472
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L815-L841
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L880-L882
  - vllm-ascend@b255ab59:vllm_ascend/platform.py#L80-L98
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2305-L2332
evidence: "C"
relations:
  - to: ascend-config-system
    kind: builds-on
    note: check_and_update_config 改写与最终定稿的，就是那一页解出来的那份配置
  - to: one-request
    kind: builds-on
    note: 那条请求的 block_size、注意力后端、token 预算档位，三个数都是这个类定的
contradicts: []
updated: "2026-09-19"
origin: seed
---

## 一句话

`NPUPlatform` 是 `vllm_ascend/platform.py` 里唯一的主角，`_enum` 标成 `PlatformEnum.OOT`（out-of-tree）[C1]。它承担两件性质完全不同的事：**回答 vLLM 的硬件问题**，以及**在启动时改写与拦截配置**。只把它当成一张属性表读，会漏掉后面那件 [D]。

```wiki-diagram
file: platform-surface
```

## 那条请求走到这里

那条请求身上有三个数是这个类定下来的，而定的时候它还不存在：

| 它的哪个数 | 谁定的 |
|---|---|
| `block_size = 128`，于是 37 个 token 占 1 块 | `check_and_update_config` 顶上去的 |
| 第 92 步写 KV 时调哪个算子 | `get_attn_backend_cls` 查表查出来的 [C10] |
| 一步最多能拿多少 token 名额 | 间接由 `get_device_total_memory` 决定——见下 |

**第三行是这一页最值得记的一条。** 上游算 `max_num_batched_tokens` 默认值时要先问卡有多大显存，而昇腾这个方法**直接抛 `NotImplementedError`** [C4]。上游那段查询包在 `try` 里，异常被吞掉之后把显存当成 0 [C13]。

后果是：**在昇腾上，那张「显存 ≥ 70 GiB 走大档」的表永远走不到大档**，跟卡上插了多少 HBM 无关。起 API server 时默认预算就是 2048，用 `LLM` 类是 8192 [C13]。那条请求的 37 个 token 之所以一步算完，最终可以追到这个 `NotImplementedError` 上 [D]。

这不是 bug——注释写明了：实现它会连带提前初始化 `torch_npu`，而后者只允许全局初始化一次 [C4]。**一个「没实现」的方法改变了调度器的默认行为**，这是插件模式最典型的一种连带效应。

## 第一组：身份与属性

类体顶部几行就定完了身份：`device_name` 与 `device_type` 都是 `"npu"`，`ray_device_key` 是 `"NPU"`，可见设备的环境变量是 `ASCEND_RT_VISIBLE_DEVICES`，PyTorch 侧的 `dispatch_key` 是 `"PrivateUse1"` [C1]。

这一组里有一个反直觉的成员：`get_device_total_memory` **故意抛 `NotImplementedError`**，而不是返回显存大小 [C4]。源码里紧跟的注释写了原因——实现它会提前调用 `get_device_name()` 从而过早初始化 `torch_npu`，而 `torch_npu` 只允许全局初始化一次，重复初始化会报错。所以「问平台要总显存」这条路在昇腾上是走不通的，显存预算得靠别的办法算 [D]。

## 第二组：启动时真的改配置

`pre_register_and_update` 是最早被调到的那个，它做三件事：打全局 patch、把 `ascend` 追加进 `--quantization` 的可选值、按是否 310p 导入不同的量化配置类 [C3]。把量化选项塞进 argparse 的 choices 是个很具体的例子——在线服务模式下 `ascend` 本来不是合法取值，是这里加上去的 [D]。

`check_and_update_config` 是量级最大的一个（第 450 行起）。它的开头两个分支都是「不是我的事就退出」：设备类型不是 `npu` 直接返回，`model_config` 缺失就警告后返回。接着按固定顺序跑四个校验，然后才初始化 AscendConfig [C9]。

## 第三组：四个校验决定什么配置组合不合法

按 `check_and_update_config` 里的调用顺序 [C9]：

| 校验 | 拦的是什么 |
|---|---|
| `_validate_layer_sharding_config` | `layer_sharding` 只允许在 PD 分离的 P 节点开；`kv_role` 不是 `kv_producer` 就直接抛 `ValueError` [C6] |
| `_validate_draft_decode_context_parallel_config` | 投机解码与 decode 侧上下文并行的组合 [C8] |
| `_validate_parallel_config` | 并行组合，例如 `data_parallel_size > 1` 同时 `prefill_context_parallel_size > 1` 就抛错 [C7] |
| `_validate_pd_pp_mtp_config` | PD 分离、PP 与 MTP 三者的组合 [C8] |

这是排查「为什么我这套参数起不来」时最值得先看的一组：报错文本就在这几个函数里，比翻文档快 [A]。

## 第四组：把请求转给具体实现

`get_attn_backend_cls` 在五个注意力后端里选一个 [C10]，`get_device_communicator_cls` 给出通信器类路径，`get_compile_backend` 与 `get_static_graph_wrapper_cls` 各返回一个类路径字符串 [C2]。这四个方法是从平台层跳进各子系统的跳板 [D]；顺着它们能一路走到 [注意力后端家族](attention-backend-family.md) 与 [图模式层](graph-mode-layer.md)。

## 行号会漂，引用必须带 commit

| 项 | v0.23 维护分支 | main 开发主线 |
|---|---|---|
| `class NPUPlatform` 起始行 | 128 [C1] | 81 [C12] |
| 两者相差 | — | 47 行 [D] |

这就是本库所有来源都写成 `repo@commit:path#L起-L止` 的原因——只记行号的笔记在换分支之后会指到别的代码上。

## 常见误解

- **「平台类只是个属性表」**——它还改配置、还拦配置。`check_and_update_config` 会真的修改传进来的 `VllmConfig` [C9]，启动参数和实际生效的配置可能不是一回事。
- **「`get_device_total_memory` 没实现是个 bug」**——是有意的，注释写明了是为了避免过早初始化 `torch_npu` [C4]。
- **「`simple_compile_backend = "eager"` 说明昇腾不支持图模式」**——只说明它不走上游那条 `torch.compile` 默认路径；昇腾自己那套在 `get_compile_backend` 与 `get_static_graph_wrapper_cls` 里 [C1][C2]。
