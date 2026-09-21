---
id: lmcache
title: LMCache：先分清谁注册连接器，再谈外部 KV 复用
type: feature
summary: >-
  LMCache-Ascend 把 LMCache 接到昇腾 NPU。两个发布分支由 vllm-ascend 注册连接器，main
  已把注册交回插件；连接器能创建不等于存储后端和版本组合已经配好。
aliases:
  - LMCache
  - LMCache-Ascend
  - LMCacheAscendConnector
  - LMCacheConnectorV1
chapters:
  - '11'
order: 90
sources:
  - 'vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/__init__.py#L57-L65'
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/lmcache_ascend_connector.py#L1-L5
  - >-
    vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/lmcache_connector.py#L83-L115
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/lmcache_ascend_deployment.md#L53-L94
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/lmcache_ascend_deployment.md#L3-L24
  - 'vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/__init__.py#L57-L65'
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/lmcache_ascend_deployment.md#L70-L72
  - >-
    https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/lmcache_ascend_deployment.html
  - >-
    https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/lmcache_ascend_deployment.html
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - main
evidence: "S"
relations:
  - to: prefix-caching
    kind: builds-on
    note: 先理解复用前缀为什么能少做 prefill，再看连接器如何接入外部 KV
  - to: kv-pool
    kind: alternative-to
    note: AscendStoreConnector 与 LMCache 是两条独立的外部 KV 接入路线，配置名和依赖不能混用
contradicts: []
updated: '2026-09-22'
rawSources:
  - >-
    raw/sha256-270dff2763ab31da099d3b705abb5a04988fb56717bd6319f797153dc2cb61ef.md
---

## 一句话

LMCache-Ascend 是让 LMCache 在昇腾 NPU 上工作的社区插件。读它的部署配置时，最先要确认的是**连接器由谁注册、实现从哪个包加载**；配置里写了一个名字，不代表外部存储已经就绪。

v0.23 维护分支和 v0.26 分支（2026-09-17 的 rc 源码快照）都注册 `LMCacheAscendConnector` [C1][C6]；main 开发主线在当前快照里已取消这个注册，官方文档要求改用 LMCache-Ascend 包提供的注册与运行配置 [S7]。这是接入责任变化，不能解释成 LMCache 不再支持昇腾。

```wiki-diagram
file: lmcache
```

## 那条请求默认用不到它

[那条请求](one-request.md)只有 37 token 的问题、200 token 的回答，而且没有配置外部连接器，因此不会走 LMCache。若要观察外部 KV 复用，可以保持模型不变，另做“两次请求共享一段长前缀”的实验 [A]；先确认第一次确实保存、第二次确实命中，再比较 prefill 耗时。

这里不能直接套 [KV Pool](kv-pool.md) 的块对齐公式：那是另一套连接器的实现。LMCache 的 chunk、部分前缀处理和落盘策略要跟实际安装的插件配置一起核对，本页所引昇腾包装层没有定义这些规则 [C2]。

## 昇腾包装层只有五行，真正实现来自依赖包

两个发布分支把配置名 `LMCacheAscendConnector` 映射到昇腾模块里的 `LMCacheConnectorV1`。打开这个模块，只做了两件事：导入 `lmcache_ascend`，再从上游 vLLM 导入 `LMCacheConnectorV1` [C2]。

接着上游构造函数看 `use_native`，默认 `False`：默认从已安装的 `lmcache.integration.vllm.vllm_v1_adapter` 取实现；显式为真才转向 vLLM 自带的集成模块 [C3]。**“昇腾注册了连接器”与“LMCache 的缓存引擎已经正确安装”是两道不同的检查。** 也不能把上游的默认分支当成所有插件版本都兼容的承诺。

## 发布分支的配置入口能核对，依赖组合仍要单独钉定

官方部署页先假定 vLLM 和 vllm-ascend 已安装，再给出 `NO_CUDA_EXT=1 pip install lmcache==0.3.12` 和 LMCache-Ascend 的安装步骤；克隆插件还要求带 submodule [S4][S5]。这说明只装 Python 主包并不能代替插件及算子依赖的准备。

下面是发布分支文档中的**连接器配置片段**，用于接进已有服务命令，不是一份已在 NPU 上验证的完整部署脚本 [S4]：

```json
{
  "kv_connector": "LMCacheAscendConnector",
  "kv_role": "kv_both"
}
```

把它作为 `--kv-transfer-config` 的值；该文档的服务示例另写了 `--block-size 128`。`kv_both` 是读写角色配置，不能替代存储后端、容量和传输策略的选择。

尤其要留意，部署页的 Docker 镜像名仍带 `vllm-ascend-v0.11.0` [S5]。**文档位于 v0.23 分支，不等于里面的旧镜像示例已证明适配 v0.23。** 实际部署应记录 vLLM、vllm-ascend、LMCache、LMCache-Ascend 的准确版本；本页只核验仓库里的接入方式，不声称该组合已做设备实测。

## 升到 main 时，先更换接入说明

| 项 | v0.23 维护分支／v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| 谁注册连接器 | vllm-ascend 注册 `LMCacheAscendConnector` | 交给 LMCache-Ascend 包 | [!] 不能只升级 vllm-ascend 后原样照抄旧连接器配置 |
| 部署页的 Usage | 给出上述配置名的在线、离线示例 | 删除旧示例，指向插件自身说明 | 选择插件版本时同时核对它的注册方法和运行配置 [S7] |

main 文档没有在本仓库钉住替代插件的具体版本，因而本页不猜一个新的配置名。这里的 `verified` 表示这三个分支的仓库入口与文档已核对，不表示任意第三方依赖组合都通过了部署验证。

## 常见误解

- **“LMCache 就是 AscendStoreConnector 的另一个名字。”**——它们是独立注册项；前者经 LMCache 集成，后者走昇腾自己的 KV Pool 路线。
- **“文档写 LMCacheAscendConnectorV1Dynamic，配置就填这个。”**——发布分支文档在介绍句里用了这个名字，但实际配置与注册表写的是 `LMCacheAscendConnector`，不要把描述名当注册名 [S4][C1]。
- **“外部缓存打开后，第一次请求也一定更快。”**——第一次没有可复用数据时，不能据此期待命中收益；实验必须把冷缓存与热缓存分开，并核实日志里的实际读写 [I]。
