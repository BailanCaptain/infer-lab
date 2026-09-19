---
id: vllm-ascend-repo-map
title: vllm_ascend 目录地图
type: concept
summary: 23 个子目录、442 个 .py、130661 行。按职责分成六组，主干只有 worker、attention、ops 三个。
aliases: [目录结构, 代码结构, 仓库结构, repo map, vllm_ascend 目录]
chapters: ["20"]
order: 10
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/__init__.py#L38-L42
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L128-L146
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L268-L269
  - vllm-ascend@2c59ff10:vllm_ascend/ops/__init__.py#L21-L33
  - vllm-ascend@28bf3a2e:vllm_ascend/platform.py#L81-L99
evidence: "D"
relations:
  - to: vllm-ascend-overview
    kind: builds-on
    note: 看地图之前要先知道这个仓库为什么存在，边界在哪里
  - to: one-request
    kind: builds-on
    note: 跟完那条请求只需要读两个目录，其余 394 个文件它一个都不碰
contradicts: []
updated: "2026-09-19"
origin: seed
---

## 一句话

v0.23 维护分支上 `vllm_ascend/` 有 23 个子目录、442 个 `.py` 文件、130661 行代码 [D]。全读一遍不现实也没必要——按职责分成六组之后，真正的主干只有三个目录。

```wiki-diagram
file: vllm-ascend-repo-map
```

## 那条请求走到这里

跟完那条请求的 200 步，需要读的目录只有两个：**`worker/`（31 个文件）与 `attention/`（17 个文件）**，一共 48 个。

其余 394 个文件它一个都不碰 [A]：

- `distributed/` 46 个——TP=1，没有跨卡通信；
- `quantization/` 27 个——bf16，没开量化；
- `spec_decode/` 12 个——没开投机解码；
- `_310p/` 49 个——不是那一代硬件；
- `ops/` 89 个——会碰到，但是被动的：它是被模型 forward 调到的实现，不是跟链路时要追的入口。

**「13 万行」之所以吓人，是因为它把所有场景的代码加在了一起。** 任何一条具体的请求只会走过其中很小一部分。先钉死一条请求再决定读哪几个目录，是这个仓库唯一可行的读法。

## 六组里只有第一组是主干

**第一组 · 主干（三个目录，137 个文件）。** `worker/` 是「一张卡上发生什么」的全部，`attention/` 是注意力算子与 KV Cache 形状，`ops/` 是被替换掉的各类算子。读懂这三个就能跟完一次请求；`worker/model_runner_v1.py` 一个文件 5251 行，占了 `worker/` 的三分之一。

**第二组 · 接缝（`patch/`、`core/`、`model_executor/`）。** 这一组不实现推理逻辑，只负责「怎么接进上游 vLLM」。`patch/` 64 个文件是运行时替换上游对象的地方，见 [Patch 机制](ascend-patch-system.md)。

**第三组 · 并行与通信（四个目录，68 个文件）。** `distributed/` 单独就有 46 个文件、20985 行，是除 `ops/` 外第二大的目录；它覆盖 TP/PP/DP/EP 的通信、KV 传输、权重传输。第一遍读不必进去，但排查跨卡问题一定会回到这里。

**第四组 · 图与编译（`compilation/`、`xlite/`）。** 两条路径：`compilation/` 是 ACL Graph 与自有编译后端，`xlite/` 是另一条实验性的，见 [图模式层](graph-mode-layer.md)。

**第五组 · 模型、权重与采样（六个目录）。** `quantization/` 27 个文件，`model_loader/` 16 个（含 netloader 与 rfork 两个加载器），`spec_decode/` 12 个。这一组的共同点是「按模型或按特性才会走到」。

**第六组 · 专用与周边。** `_310p/` 49 个文件是 310P 这一代硬件的专用实现，形态上是整套主干的平行副本；`_cann_ops_custom/` 里没有 `.py`，是构建产物的落点。这一组第一遍读**应该跳过**——尤其 `_310p/`，它会让人误以为同一个类有两套互相矛盾的实现。

## 按规模排一下，读的顺序会更清楚

| 目录 | 文件数 | 行数 | 什么时候读 |
|---|---|---|---|
| `ops/` | 89 | 23484 | 追一个具体算子时 |
| `distributed/` | 46 | 20985 | 排查跨卡问题时 |
| `attention/` | 17 | 14732 | 第一遍就读 |
| `worker/` | 31 | 14486 | 第一遍就读 |
| `patch/` | 64 | 10546 | 怀疑上游行为被改过时 |
| `_310p/` | 49 | 6838 | 只在 310P 上跑时 |
| `quantization/` | 27 | 6578 | 开量化时 |

行数全部实测于 `2c59ff10` [D]。注意 `ops/` 与 `patch/` 的文件数多但单文件都很小，`attention/` 与 `worker/` 反过来——文件少而单文件极大。这决定了两种不同的读法：前者靠目录名定位，后者必须靠函数名跳转，见 [NPUModelRunner 怎么读](npu-model-runner.md)。

## 两个分支在目录层面差 7 项

`2c59ff10` 上独有 `flash_common3_context.py`、`kv_offload/`、`memcache_comm_fence.py`、`simple_kv_offload/`；`28bf3a2e` 上独有 `config_utils.py`、`ec_manager/`、`observability/` [D]。其余 19 个子目录两边同名——**同名不等于同内容**，例如 `platform.py` 里 `class NPUPlatform` 在 `2c59ff10` 是第 128 行、在 `28bf3a2e` 是第 81 行 [C2][C5]。对照方法见 [怎么读这个仓库](reading-vllm-ascend.md)。

## 常见误解

- **「目录名能直接推出职责」**——大部分能，两个例外要记住：`core/` 不是核心推理逻辑而是接上游调度与 KV Cache 管理的接缝；`model_executor/` 只有 3 个文件 263 行，远比名字听起来小 [D]。
- **「`_310p/` 是旧代码」**——它是 310P 这一代硬件的专用实现，49 个文件在 v0.23 分支上是活的 [D]。看到同名类有两套实现，先确认自己在看哪一套。
- **「文件多的目录最重要」**——`ops/` 文件最多，但第一次读请求路径时它是被动的一层；`worker/` 文件少一半却是主干 [D]。
