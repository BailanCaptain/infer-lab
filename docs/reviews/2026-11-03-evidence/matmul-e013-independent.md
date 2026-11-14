# E013 矩阵乘法增量独立复核

审查人：review_groups_03_04。范围为 `matmul-e013.diff` 的教学页及两份 YAML/SVG，共 5 文件；完整读取差异，并读取当前正文 247–427 行、两份完整 YAML 的格值、标签与固定来源。不是整页 37 项引文重新验收。

实际回核原始材料：

- Roofline 作者原论文 `https://arxiv.org/html/2009.02449v4`：Introduction 的 Eq.1 与内存层级定义、§III-B2 与 Table I。公式约束的是吞吐上限，不保证实际达到；字节计数要指定内存层级。未把论文的 CPU/GPU 测量值移植为 A2 实测。
- `vllm-ascend@db701c1f`：`glm5_next.py` 1541–1680（KDA 各投影、短卷积及显式 FP32 的 A_log/dt_bias）；`w8a8_dynamic.py` 48–153（动态量化、缩放和输出 dtype、仅大 wq_b 的拆块条件）；`utils.py` 735–762、819–820（注册名）；`linear_op.py` 535–613（普通归约与 FlashComm1 分支）；`linear.py` 83–140（默认权重 dtype/非量化创建）。
- `vllm@0fc695fc`：`activation.py` 154–184；`custom_op.py` 109–207、261–353（按类名替换、注册名和原生路径）；`linear.py` 179–215。
- 两份固定量化描述复用本审查人已核 `9e55cbc8` / `3121f187` 原始材料：新旧 MLP 均为 W8A8，四组 MLA 原始投影由 FLOAT 改为 W8A8；源码合并 Q/KV 后表现为三个大投影。FLOAT 不是 FP32 的同义词。

逻辑复用与真实 HBM 读量、只计一次权重主体读取的 2T 预算、整数/浮点算力口径、SP 条件性基线、量化版本和静态注册链的修改均有上述证据。原来的矩阵乘算例、96/48 MiB 容量、TP8 的 12/6/18/54 MiB、48/6048 行和 126 倍比例均保留。两图坐标与数值没有重做；权重复用图逐格相乘与输出一致。

发现一处相邻残留 P2：正文通用 EP 项仍称“共享专家仍然按 TP 切”，应限定本页 GLM 条件性基线，其他配置需另核复制/切分。作者已修改，独立复读当前 269–273 行，条件准确；该项关闭，本增量接受。

最终 SHA256：

| 文件 | SHA256 |
|---|---|
| matmul-and-weights.md | c82cf7d100745e5317fd6380100489fe60a1f1d3bddac3b869e9b572f11da0f4 |
| matmul-weights-share.yaml | d3c93a05aea2f404e0b37268f712000c7b5633df7db061d6537b4de48e94af3e |
| matmul-weights-share.svg | 29b4ca91f47840eb4f080d0f2ef3d936db840ef51642f35528cb1324aea07e03 |
| matmul-forward.yaml | 45b58a1aa6906e1e30d13171e1d02d908808dd48a22a866ed27eb70282d76c53 |
| matmul-forward.svg | 33ae15b4e8793e77bbbcb7faa99e3621e82d072b3702fd43c8299e20114be8d6 |

限制：仅静态事实与差异审查，未做浏览器图形、播放、设备 profiling 或 NPU 验证；未声称实际 kernel 数或耗时已经确认。
