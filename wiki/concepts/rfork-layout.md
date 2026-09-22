---
id: rfork-layout
title: RFork 张量布局：先对齐算子要的形状，再决定搬什么
type: feature
summary: >-
  区分 checkpoint 与 processed 两条加载路径，解释量化、NZ、impl 派生权重、MoE 后处理和 patch7 的 topk
  工作区排除。说明张量采集与同名冲突的处理边界。
aliases:
  - RFork processed layout
  - RFork checkpoint layout
  - RFork NZ
  - RFork topk_indices_buffer
  - RFork conflicting tensor entries
  - collect_transferable_tensors
chapters: []
order: 50
sources:
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L503-L519'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L335-L411'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L584-L644'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/tensor_layout.py#L18-L55'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/tensor_layout.py#L58-L152'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/tensor_layout.py#L155-L208'
  - >-
    rfork@3284850b:tests/ut/model_loader/rfork/test_tensor_safety_isolated.py#L143-L170
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L317-L345'
verified:
  - 'rfork:main'
evidence: C
relations:
  - to: rfork-startup
    kind: builds-on
    note: processed 路径把后处理挪到申请租约前，改变整条启动路径的顺序
  - to: rfork-identity
    kind: builds-on
    note: dtype、量化与 NZ 策略先进入兼容性指纹，再对齐具体张量清单
contradicts: []
updated: '2026-09-23'
rawSources:
  - >-
    raw/sha256-280c501d0e376e2b74d0e921324d49b1ce5a99025fb3935c1e55f50fa73111da.md
  - >-
    raw/sha256-5f3e3227968d32d9fcc21a566c964c88b54df66a96481747265dad39632dbe25.md
  - >-
    raw/sha256-be7651d21c2f6c44f19cb939989ef0d4119a8cdfdaf2f59003e14ee2166cd069.md
  - >-
    raw/sha256-ced334d86bb2fbc3284d127854ea3710bee45de12d95cdd91aeb6efb5e08e13f.md
---

## 一句话

RFork 拷贝的是模型当前实际使用的 NPU 张量。**量化或 NZ 转换可能换掉 shape、storage 和张量集合，所以接收端必须先具备对应布局，不能把原始 checkpoint 形状当成永远成立。**[C1][C3]

```wiki-diagram
file: rfork-layout
```

## 那条请求的模型，先问权重走哪条路径

[那条请求](one-request.md)是 Qwen3-0.6B，它的 token 数不会决定此处选择。沿用它做[实例 B](rfork.md)——已有实例 A 完成加载，B 用 `--load-format rfork` 启动——的模型时，要看 B 是否设置了量化、`weight_nz_mode == 2`，或硬件策略要求 `FORCE_NZ`。任一条件成立就选择 processed-layout transfer；否则走另一条路径。[C1]

这一节不推定共享请求当前的全部启动参数。实际分析时先读取两端配置和 `uses post-load tensor layout transfer` 日志，再确定图里哪一条适用。

## “后处理”有两种位置，名字相同但时机不同

先说清表头两个容易误读的词。**“数据读入”指的是通过 TransferEngine 从 seed 的 NPU 读回字节**，不是从磁盘读 checkpoint 文件；**`checkpoint layout` 说的是“张量此刻还保持 checkpoint 里的形状”**，不是“收到磁盘文件”。两条路径都靠远端 NPU 字节读取拿数据。

| 工作版路径 | 数据读入之前 | 数据读入之后 | 成为 seed 之前 |
|---|---|---|---|
| processed layout | 构建模型 → `process_weights_after_loading` → `torch.npu.synchronize` | 不重复一般后处理，直接进入 eval 与发布判断 | 已注册的是处理后的最终缓冲区 |
| checkpoint layout | 构建模型后直接申请租约 | 执行后处理，但临时跳过未量化 MoE 的特定后处理 | 刷新内存注册，因为后处理可能替换 storage |

分叉条件与两条路径的先后顺序都由加载器决定，最后那一列的“刷新注册”也发生在启动 seed 服务的入口里。[C1][C8]

processed 路径先对空的目标模型执行布局准备，再用 seed 的真实数据覆盖相应缓冲区。NPU 转换可能异步执行，因此必须在注册/读取前同步；否则转换与远端写入可能触及同一批目标字节。[C3][D]

## MoE 有两道专门处理，不能把它们理解成禁用所有校验

processed 路径的 `_rfork_pre_transfer_weight_processing`，会把特定 MoE quant method 的包装后处理临时替换成其 `__wrapped__` 原函数，避免尚未装入真实权重时执行 shared-expert 包装校验。离开上下文时，无论成功还是异常，都恢复原方法。[C2]

checkpoint 路径的数据已经读入后，`_rfork_skip_unquantized_moe_post_load_processing` 仅临时把 `AscendUnquantizedFusedMoEMethod` 的后处理置为 no-op；dense 层仍走后处理，结束时也恢复方法。[C2]

这两处处理作用于不同阶段、不同方法范围。调试时要先说清“哪条布局路径、哪一种 quant method”，不能用“RFork 不做后处理”概括它们。

## 真正需要搬的张量，常常不只在 Parameters 里

| 采集范围 | checkpoint layout | processed layout |
|---|---|---|
| `named_parameters()` | 扫描 | 扫描 |
| `named_buffers()` | 扫描 | 扫描 |
| 非 Module 的 `impl` 对象 | 扫描公开属性里的张量和容器 | 同样扫描 |
| 其他 Module 公开属性中的张量 / 容器 | 不做这一层广泛扫描 | 扫描 |

processed 模型可能把派生权重挂在普通属性，或藏进量化实现对象的 `impl`；只扫 `state_dict()` 会漏。遍历有循环引用防护，不扫描函数、方法、类本身；可调用的自定义实例若拥有公开属性，则在允许对象扫描时仍会被检查。[C5][C6]

采集时排除 meta、空张量和非 NPU 张量；此外注册入口还检查已物化的非 NPU Parameters / buffers，避免“漏掉 CPU 状态但谎称整个模型传完”。这不等于检查任意 Python 对象里的一切状态。[C4][C6]

## 同名项必须一致，不同名 alias 可以同时保留

官方文档的量化一节点名了 `W_UV` / `W_UK_T`（原文出处与行号见[官方核读页](../sources/rfork-official-guide.md)，本页只引工作版源码）。它们提醒的是**原始权重之外的派生状态也影响推理**：先把 receiver 的算子布局和派生张量建出来，再把 seed 的对应数据读入，才不会让 receiver 留下由空壳/未加载权重构造的派生值。工作版通过 `process_weights_after_loading` 准备布局，并用 processed collector 扫描普通公开属性和 `impl`；不是通过硬编码这两个名字来保证所有模型完整。[C5][C6]

例如 SFA 把原 `kv_b_proj` 权重拆分、转置为两份算子实际使用的权重后，旧 Parameter 可能已被释放为空；对应实现与名词解释见[官方核读中的源码对照](../sources/rfork-official-guide.md)。只对比 checkpoint 文件或 Parameters 数量会漏掉真正参与计算的状态；验收应检查最终清单和与默认加载的输出对照，不把官网模型表的测试自动算到本工作版。[I]

一个逻辑名称可能从 Parameters 和公开属性被发现两次。若是同一个对象，或地址、numel、shape、dtype、stride 全相同，就去重；否则抛 `conflicting tensor entries for logical name`，不悄悄保留较大或较小的那个。[C5]

不同逻辑名称可以对应同一 storage 的视图。这些名称可能都需要出现在 manifest；后续注册会合并部分范围，但传输按逻辑名字执行，因此同一段字节可能被读回多次。[D] 不能只按本地地址去重远端读取，具体原因见[传输页](rfork-transfer.md)。

## patch7 留下本机 topk 工作区，解决跨实例容量差异

`topk_indices_buffer` 是运行时 scratch，容量受本实例的 batching 配置影响。它不是应当从 seed 继承的 checkpoint 权重。patch7 把这个名字写进一张运行时张量名单，再由两条路径共用的采集入口 `_try_collect` 按名称最后一段比对排除，所以直接属性、buffer 或 `impl` 路径下的同名项都不进入清单。[C4][C5]

随补丁附带的回归测试构造 batching limits 为 2048 与 4096 的两个模型，topk 张量 shape 分别为 `(2048, 2048)` 与 `(4096, 2048)`，dtype 为 int32；期望排除后两份权重清单相同，普通 weight 和 packed weight 仍保留。[C7]

对应容量是 16 MiB 与 32 MiB，差的 16 MiB 来自 `2048 × 2048 × 4`。这是测试样例的字节推导，不代表所有模型实际工作区的固定大小。[D]

**边界是一张只有明确名称的排除名单。** 名单里现在只有这一个名字，所以它既没有自动识别其他 scratch，也没有证明改变所有 scheduler 参数都兼容。[D] 未来新增工作区应重新审视清单，不能照抄“排除所有 buffer”。

## 常见误解

- **“shape 一样就布局一样”**——量化打包、dtype、storage 与算子策略也影响字节解释。
- **“processed 是收到数据后才转换”**——在这条路径里，接收端先转换并同步，再读入 seed 的已处理张量。
- **“patch7 修复所有 shape mismatch”**——它解决了特定本地工作区被误传的问题；权重本身不匹配仍应拒绝。
