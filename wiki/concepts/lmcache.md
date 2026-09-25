---
id: lmcache
title: LMCache：把算过的 KV 存到显存外面，下次直接取回
type: feature
summary: >-
  把算过的 KV 存到 NPU 显存之外，下一条请求开头相同就直接取回、不再重算。昇腾上的两个发布分支由
  vllm-ascend 替它登记名字，main 改由 LMCache-Ascend 插件自己登记；名字登记上不等于存储已经配好。
aliases:
  - LMCache
  - LMCache-Ascend
  - LMCacheAscendConnector
  - LMCacheConnectorV1
  - 外部 KV 缓存
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
  - 'vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/base.py#L3-L41'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/__init__.py#L21-L89'
  - >-
    vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/lmcache_integration/vllm_v1_adapter.py#L269-L286
  - >-
    vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/lmcache_integration/multi_process_adapter.py#L169-L174
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - main
evidence: "C"
relations:
  - to: prefix-caching
    kind: builds-on
    note: 先理解复用前缀为什么能少做 prefill，再看连接器如何接入外部 KV
  - to: kv-pool
    kind: alternative-to
    note: AscendStoreConnector 与 LMCache 是两条独立的外部 KV 接入路线，配置名和依赖不能混用
contradicts: []
updated: '2026-09-25'
rawSources:
  - >-
    raw/sha256-270dff2763ab31da099d3b705abb5a04988fb56717bd6319f797153dc2cb61ef.md
---

## 同一段开头，为什么每次都要重算

设想一个客服服务：每条请求前面都带着同一段很长的产品说明，后面才是用户自己的一句话。[前缀缓存](prefix-caching.md)能让第二条请求直接复用第一条算好的那段 KV——但前提是那些 KV 块还留在 NPU 显存里。显存就那么大，请求一多，旧块被挤掉，下次同样的开头又得从头 prefill 一遍。

LMCache 的做法是：把算过的 KV **另外存一份到本颗 NPU 显存之外**，下一条请求对上同一段开头，就从外面取回来，不用重算。它不改模型、不改调度规则，而是挂在 vLLM 留给「外部 KV」的一个标准接口上，每条请求分三件事：

1. 调度器先问一句：这条请求开头有多少个 token，外面已经存着了？
2. 存着的那部分，在真正计算之前读回显存。
3. 这次新算出来的 KV，一层一层写出去，留给以后的请求。

这三件事全部由 LMCache 自己完成，vllm-ascend 一件都不实现。LMCache-Ascend 是让 LMCache 在昇腾 NPU 上跑起来的社区插件。

## 贯穿例子用不上它，本页换一个例子讲

全库的[贯穿例子](one-request.md)——Qwen3.6-35B-A3B 跑在两颗 NPU 上、问题 37 个 token——默认没有配置任何外部连接器，所以根本不会走 LMCache。更要紧的是：同一套外部 KV 接口，也是 [PD 分离](pd-disaggregation.md)把 KV 从 P 节点搬到 D 节点时用的那一套，而这个模型的 PD 分离在 v0.23、v0.26、main 三个版本的支持矩阵里**都是 ❌**（见贯穿例子页的版本差异表）。拿它来讲「怎么把 KV 搬出显存」，读者照着做会直接撞墙。

所以本页讲机制时沿用官方 LMCache-Ascend 部署页自己的例子：Qwen3-32B，KV 块大小设成 128 个 token。想在贯穿例子上观察外部 KV 复用，得先确认你的版本组合支持这个模型走外部连接器，再另做「两次请求共享一段长前缀」的实验：先确认第一次真的存进去了、第二次真的命中了，再比较 prefill 耗时。

## vLLM 按块管，LMCache 按段存

这里有两个容易混的单位。

vLLM 管显存用的是 **KV 块**：部署页的例子一块 128 个 token。LMCache 往外存取用的是自己的一个单位，叫**段**（chunk）。vLLM 仓库自带的那份 LMCache 集成里，一段默认 256 个 token，不满一段的尾巴默认**不存**。另一条多进程的接法还要求一段必须正好是整数个块。

代入部署页的例子：256 ÷ 128 = 2，一段正好两块，对得上。但换成贯穿例子，情况就不一样了——那个模型 TP=2 时一块是 2048 个 token，一段 256 反而比一块还小，「一段是整数个块」这条要求就过不去。再看问题本身：37 个 token 连一段都凑不满，按「尾巴不存」的默认规则，这次什么都不会存出去。

[KV 池](kv-pool.md)那页算「凑不满一块、池根本不会被问到」用的是 vLLM 的块；本页的段是另一个数，两页的取整算法不能互换。而且默认加载的其实不是 vLLM 自带的那份集成，而是外部 LMCache 包里的同名实现，段长的具体默认值要按你装的那一版核对；昇腾这一层本身一条粒度规则都没定义。

## 名字由谁登记：发布分支和 main 不一样

```wiki-diagram
file: lmcache
```

在服务配置里写一个连接器名字，vLLM 要先查到「这个名字由哪个模块提供」才能创建它，这一步叫登记。

- **v0.23 维护分支和 v0.26 分支**：vllm-ascend 替 LMCache 登记了一个昇腾专用的名字。顺着找过去是一层很薄的昇腾包装——只有五行：先把 LMCache-Ascend 插件加载进来，再把上游 vLLM 的 LMCache 连接器原样转出去。真正干活的是装好的 LMCache 包。
- **main 开发主线**：vllm-ascend 不再登记这个名字，整个目录里也找不到 LMCache 的字样；官方文档要求改用 LMCache-Ascend 插件自己的登记方式和配置。

这是**接入责任换了人**，不能理解成 LMCache 不再支持昇腾。反过来也一样：在发布分支上名字登记成功了，只说明「能找到这个类」，不说明 LMCache 的缓存引擎装对了、存储后端配好了——这是两道不同的检查。

## 装好名字不等于能用

官方部署页先假定 vLLM 和 vllm-ascend 已经装好，再单独装指定版本的 LMCache 主包和 LMCache-Ascend 插件；插件仓库还要连子模块一起克隆，因为它带着自己的算子。只装 Python 主包代替不了插件和算子的准备。

部署页里的 Docker 镜像名还带着很早的 vllm-ascend 版本号。文档放在新分支里，不等于里面的旧镜像已经证明适配新分支。实际部署要把 vLLM、vllm-ascend、LMCache、LMCache-Ascend 四个版本都记下来；本页只核对了仓库里的接入方式，不声称这套组合在设备上实测过。

## 常见误解

- **「LMCache 就是昇腾自己那个 KV 池的另一个名字。」**——两者是分开登记的两条路：LMCache 走 LMCache 自己的集成，KV 池走昇腾自己的实现，配置名和依赖都不能混用。
- **「外部缓存打开后，第一次请求也会更快。」**——第一次外面什么都没有，谈不上命中收益；做实验必须把冷缓存和热缓存分开，并从日志里核实实际读写了多少。
- **「升级 vllm-ascend 后，旧的连接器配置照抄就行。」**——升到 main 后原来那个名字没人登记了，要换成插件自己给的配置。

## 对照源码

### 怎么开

- 安装顺序（发布分支文档）：先 `NO_CUDA_EXT=1 pip install lmcache==0.3.12`，再在 LMCache-Ascend 目录 `python3 -m pip install --no-build-isolation -e .`；克隆插件要带 `--recurse-submodules`，因为仓库含 kvcache ops 子模块 [S4][S5]。
- 发布分支文档给的连接器配置片段，作为 `--kv-transfer-config` 的值接进已有服务命令；它不是一份已在 NPU 上验证的完整部署脚本 [S4]：

  ```json
  {
    "kv_connector": "LMCacheAscendConnector",
    "kv_role": "kv_both"
  }
  ```

  同一处的在线服务示例用 `/data/models/Qwen/Qwen3-32B` 并另写了 `--block-size 128`；离线示例是 `KVTransferConfig(kv_connector="LMCacheAscendConnector", kv_role="kv_both")` [S4]。`kv_both` 只是读写角色，不能替代存储后端、容量和传输策略的选择。
- 这个名字在两个发布分支里都由 `register_connector()` 映射到 `vllm_ascend.distributed.kv_transfer.kv_pool.lmcache_ascend_connector` 的 `LMCacheConnectorV1` [C1][C6]。该模块只有两句实质代码：`import lmcache_ascend`，再从上游 `vllm.distributed.kv_transfer.kv_connector.v1.lmcache_connector` 导入 `LMCacheConnectorV1` [C2]。
- 上游构造函数读 `kv_transfer_config` 的 extra config `use_native`，默认 `False`：默认从已安装的 `lmcache.integration.vllm.vllm_v1_adapter` 取 `LMCacheConnectorV1Impl`（日志 `Initializing latest dev LMCache connector`）；显式为真才改用 vLLM 自带的 `lmcache_integration.vllm_v1_adapter`（日志 `Initializing native LMCache connector`）[C3]。上游的默认分支不能当成「所有插件版本都兼容」的承诺。
- 接口分工写在上游基类的说明里：调度侧 `get_num_new_matched_tokens()` 问远端已有多少 token，worker 侧 `start_load_kv()` 读入命中部分、`save_kv_layer()` 逐层写出 [C10]。
- 段长：vLLM 自带集成的 `ReqMeta.from_request_tracker()` 默认 `lmcache_chunk_size=256`、`discard_partial_chunks=True` [C12]；多进程适配器从 LMCache 读 `chunk_size`，并断言它是 vLLM `block_size` 的整数倍 [C13]。
- main：`LMCacheAscendConnector` 不再由 vllm-ascend 注册，改用 LMCache-Ascend 包提供的注册与运行配置，当前示例见插件自己的 README [S7]。main 文档没有在本仓库钉住替代插件的具体版本，因此本页不猜新的配置名。

### 会报什么错

- **把文档介绍名当配置名。** 发布分支文档的介绍句写的是 `LMCacheAscendConnectorV1Dynamic`，但示例配置与注册表用的都是 `LMCacheAscendConnector` [S4]；照介绍句填，工厂里查不到这个名字。
- **升到 main 后照抄旧配置。** main 的 `register_connector()` 名单里没有 `LMCacheAscendConnector` [C11]，在 `baa023ad` 上对 `vllm_ascend/` 整目录不分大小写 grep `lmcache` 零命中 [D]；只升级 vllm-ascend 而不换成插件的登记方式，旧名字没有提供者。
- **依赖没装齐。** 昇腾包装模块在导入时就执行 `import lmcache_ascend`，默认路径又在构造时懒加载 `lmcache.integration.vllm.vllm_v1_adapter`；插件或 LMCache 主包缺一个，连接器创建就会在导入处失败 [I]。
- **段与块对不齐。** 多进程适配器断言失败时的信息是 `LMCache chunk size should be a multiple of vLLM block size`。贯穿例子 TP=2 的块是 2048 个 token（见[贯穿例子](one-request.md)），若段长仍是 256：`256 % 2048 = 256 ≠ 0`，这条断言过不去 [D]。部署页例子 `256 % 128 = 0`，一段两块 [D]。

### 开销和什么时候别开

- 冷缓存没有收益：第一次外面没有可复用数据，实验必须把冷、热两次分开，并核实日志里的实际读写 [I]。
- 短问题可能什么都不存：自带集成默认丢弃不满一段的尾巴，贯穿例子 37 个 token < 256，按这条默认规则一段都存不出去 [D]；默认路径用的是外部 `lmcache` 包的同名实现，具体数值按装的版本核对。昇腾包装层本身不定义任何粒度规则。
- 观察方法：保持模型不变，做「两次请求共享一段长前缀」的实验，先确认第一次确实保存、第二次确实命中，再比较 prefill 耗时 [A]。
- 部署页 Docker 镜像名是 `lmcache-ascend:v0.3.12-vllm-ascend-v0.11.0-openeuler` [S5]：文档位于 v0.23 分支，不等于这个旧镜像示例已证明适配 v0.23。

### 版本差异

| 项 | v0.23 维护分支 | v0.26 分支（2026-09-17 rc 快照） | main 开发主线 |
|---|---|---|---|
| 谁注册连接器 | vllm-ascend 注册 `LMCacheAscendConnector` | 同 | 交给 LMCache-Ascend 包[S7] |
| 部署页的 Usage | 给出该配置名的在线、离线示例 [S4] | 同 | 删除旧示例，指向插件自身说明 [S7] |
| 升级时要做什么 | — | — | [!] 不能只升级 vllm-ascend 后原样照抄旧连接器配置；选插件版本时同时核对它的注册方法和运行配置 |

`verified` 表示这三个分支的仓库入口与文档已核对（2026-09-22），不表示任意第三方依赖组合都通过了部署验证。贯穿例子模型的 PD 分离在三个版本都是 ❌，见[贯穿例子](one-request.md)的版本差异表。

### 源码位置

| 看什么 | 在哪 |
| --- | --- |
| 发布分支的注册 | `vllm_ascend/distributed/kv_transfer/__init__.py`，`register_connector()` 里 `LMCacheAscendConnector` 一段 |
| 昇腾包装层 | `vllm_ascend/distributed/kv_transfer/kv_pool/lmcache_ascend_connector.py` |
| 上游连接器与 `use_native` 分支 | 上游 `vllm/distributed/kv_transfer/kv_connector/v1/lmcache_connector.py`，`LMCacheConnectorV1.__init__` |
| 外部 KV 接口的分工 | 上游 `vllm/distributed/kv_transfer/kv_connector/v1/base.py` 文件头说明 |
| 段长与尾巴默认值 | 上游 `.../v1/lmcache_integration/vllm_v1_adapter.py`，`ReqMeta.from_request_tracker` |
| 段必须是块的整数倍 | 上游 `.../v1/lmcache_integration/multi_process_adapter.py` |
| 部署文档 | `docs/source/user_guide/feature_guide/lmcache_ascend_deployment.md` |
