# rfork-layout 审查记录

## P5 写作记录（2026-10-02，第 21 批小修）

### 改了什么

- 正文 5,688 → 10,745 字（按 audit 的 page.body.length 口径）；H2 由 9 节变 11 节，沿用现有图 `rfork-layout.yaml`，未改图。
- 第一节补一句话定义（张量布局 = 形状、类型、存储格式、派生张量）和示意例子：6 × 4 int8 专家权重经后处理转置成 4 × 6、转 NZ、新建 FP32 副本，B 照 checkpoint 开空位会把 24 个字节解释错。
- 新增「为什么不能先收下，再自己转」：A 只剩处理后那一版；B 反过来先建布局再覆盖；代价一句 + 链总览；三项路线配置都在兼容性指纹里，所以两端路线一致（链 rfork-identity）。按原形状搬正是「先收下再转」适用的情况，已写明。
- 「先看 B 要不要转布局」：补 weight_nz_mode 0 / 1 / 2 三档含义，以及为什么条件只认 2（写成「可以这样理解」）。
- **纠错（P1 级）**：旧版把采集里的 `impl` 说成「量化实现对象」。核 `tensor_layout.py#L155-L191` 与 vLLM `attention.py#L373`、`mla_attention.py#L441`：`impl` 是模块上的算子实现对象（最常见是注意力后端），官方点名的两份派生权重就挂在 MLA 的 impl 上。表格、正文三处、误解一条已改。
- **纠错（P2 级）**：旧版说读前那道 MoE 处理是因为「共享专家校验必然出错」。核 `fused_moe.py#L493-L506`：包装只在 `multistream_overlap_shared_expert` 为真时才装，默认 False（`ascend_config.py#L153`），且与 fused MC2 同开会被强制关（`#L194-L195`）。改为「对着空壳对比没有意义」，并写明不开开关时这一步什么也不换；「必然出错」无源码证据，删除。
- 工作区一节：补「批处理上限不在指纹里」（`identity.py` 无 scheduler_config；01 §A0.8 指纹输入清单），测试数改成 calc。
- 新增「放到 GLM 双机」一节（三个 H3）：走哪条路；MoE 两道处理都用不上；top-k 下标缓冲 64.09 + 68.0 ≈ 132.1 MiB 被排除名单挡下。全节标「按源码推，未实测」。
- 常见误解加两条（GLM 两道 MoE 处理；impl 不是量化方法）。
- 对照源码：补齐缺失的「版本差异」H3（v0.23 / v0.26 / db701c1f / main 逐项核过，末尾只链总览版本表）；「怎么开」补 NZ 配置来源、布局耗时日志、重叠开关条件；「源码位置」补 fused_moe、ascend_config、utils、w8a8_dynamic、GLM 两处与社区对照行号。
- frontmatter 只改 `updated`。

### 数字出处

- 部署前提：链 glm-5-3-flash-two-node.md#部署前提。
- W8A8 走 processed、专家转置 + NZ + `w13_weight_scale_fp32`：01 §A0.8「W8A8 为什么必须走 processed-layout 分支」；源码 `db701c1f` 与 `rfork@3284850b` 的 `w8a8_dynamic.py#L353-L366` 一致。
- 专家全是 int8：02 §0.4 结论。
- 重叠开关默认关、教程未开：02 §6.7（L719）。
- top-k 缓冲 8192 × 2051 × 4 B = 64.09 MiB、MTP 8192 × 2176 × 4 B = 68.0 MiB、合计 132.1 MiB、11 个 MLA 层共用：02 §5.x（L444-L447）与 §7.5 表末行；`index_topk=2048`、`index_kpool=4`：02 L33。
- 每卡读多少字节、借几次：不重算，链总览 GLM 一节。

### 核心概念对照

- 路线判断：`rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L503-L519`、`#L593-L608`。
- MoE 两道处理：同文件 `#L335-L372`、`#L386-L411`；包装来源 `vllm_ascend/ops/fused_moe/fused_moe.py#L493-L506`。
- NZ 三档：`ascend_config.py#L262-L269`、`utils.py#L258-L279`。
- 采集与去重：`tensor_layout.py#L21-L25`、`#L118-L152`、`#L155-L197`。
- GLM 缓冲：`vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2252-L2259`、`#L1260`、`#L402`；`glm5_next_mtp.py#L64-L77`。
- 社区版：`2c59ff10` / `2ed6cbba` / `db701c1f` 的 `_requires_processed_layout_transfer` 只看 quantization、无 synchronize、无 MoE 处理；`baa023ad` 有 synchronize（L390）、`__wrapped__`（L175）、未量化 MoE 跳过（L202-L206）；四版均按 `data_ptr` 去重、无 conflicting 报错、无 topk 排除（`git grep` 计数 0）。

### 旧版信息清单勾选（清单在 scratchpad\p5\rfork-layout-facts.md）

- F1–F6、F8–F10、F13–F19：新版保留，位置不变或扩写。
- F7：保留，读前那道改正触发条件（见上「纠错 P2」）。
- F8、F11：保留，「量化实现对象」改为 impl 对象（见上「纠错 P1」）。
- F12：保留。
- F16：保留并改成 calc。
- 无删除项。

### 疑点 / 待核

- GLM 一节是工作版加载器 + db701c1f 模型代码合推，未实测；top-k 缓冲每层挂几处（至少索引器与其内部的稀疏索引模块两处）未逐层数，正文只写「每挂一处一个名字」。
- 浏览器：Playwright 只读打开 5193 `#/wiki/rfork-layout`，11 个 H2、2 个 calc、图正常渲染，无页面报错。

## P5 审查（09-29）

审查对象：第 21 批小修后的 `wiki/concepts/rfork-layout.md`（工作区未提交版，11 个 H2，正文 10,745 字）。审查员只审不改页面。

**分数：8.5 / 10。学习顺序通过。`pnpm wiki:audit` 本页通过（8 条来源行号全部 ✓）。`pnpm wiki:lint` 通过。P1 = 0，P2 = 2，P3 = 3。**

### 初学者测试（只读前两屏）

一句话：A 把权重加载进显存后会转置、转成昇腾的 NZ 排布、另建缩放系数副本，所以 A 显存里的字节已经不是 checkpoint 的样子；B 要按地址对拷，就得先把自己的布局转成一样的，再用 A 的数据覆盖。代价是搭模型和后处理的时间一分不省，省的只是读盘和主机到卡这几步。前两屏能读出这两点，通过。

### 核心概念逐条核实（都查了源码 / 底稿，附行号）

| 页面说法 | 核实结果 |
|---|---|
| impl = 模块上挂的算子实现对象（最常见是注意力后端），不是量化实现对象 | **正确**。`rfork@3284850b:tensor_layout.py#L170`（processed 路只对 `attr_name == "impl"` 打开对象扫描）、`#L185-L188`（checkpoint 路单独扫 `impl`）；`vllm@0fc695fc:vllm/model_executor/layers/attention/attention.py#L373`、`mla_attention.py#L441` 都是 `self.impl = impl_cls(...)`。旧版「量化实现对象」确实错了，改正成立。`tensor_layout.py#L71` 的注释说的是「可调用对象可能持有打包权重」，与 `impl` 无关，不构成旧说法的依据 |
| 官方点名的两份派生权重挂在 MLA 的 impl 上 | **正确**。`rfork` 仓 `docs/source/user_guide/feature_guide/rfork.md#L286` 点名 `W_UV` / `W_UK_T`；`tests/ut/attention/a2/test_mla_v1.py#L1336-L1337, L1412-L1413` 显示它们是 `self.impl` 的属性 |
| 读前那道 MoE 处理只在打开 `multistream_overlap_shared_expert` 时才有包装可换；默认 False；与 fused MC2 同开会被强制关 | **正确**。`fused_moe.py#L493-L506`（`@wraps` 包上 `_validate_shared_expert_consistency`，注释写明是「拆成两段算 vs 合起来算」的一致性校验）、`ascend_config.py#L153`（默认 False）、`#L194-L195`（强制关）。旧版「校验必然出错」无源码依据，删掉是对的 |
| 三个走 processed 的条件 | **正确**，`rfork_loader.py#L503-L519` 逐条对上；取不到 AscendConfig / 硬件档案的兜底也写对了 |
| `weight_nz_mode` 0 / 1 / 2 三档含义与默认 1 | **正确**。`ascend_config.py#L262-L269`、`envs.py#L88`（默认 1）、`utils.py` 的转换规则；与 01 §A0.7（L306）口径一致 |
| 排除名单只有 `topk_indices_buffer`，按名字最后一段比对 | **正确**。`tensor_layout.py#L21`、`#L25` |
| 批处理上限不在兼容性指纹里，三项路线配置在指纹里 | **正确**。01 L422 的指纹输入清单含 `quantization`、`weight_nz_mode`、硬件布局策略，不含 scheduler 配置 |
| 版本差异三行（v0.23 `2c59ff10`、v0.26 `2ed6cbba`、`db701c1f` 只看量化；main `baa023ad` 补了同步和两道 MoE 处理；四版都按 `data_ptr` 去重、无排除名单） | **正确**。前三版的 rfork 目录里 grep 不到 `weight_nz_mode` / `FORCE_NZ` / `npu.synchronize` / `topk_indices_buffer` / `conflicting tensor`（计数 0）；`baa023ad:rfork_loader.py#L175`（`__wrapped__`）、`#L202-L206`（`AscendUnquantizedFusedMoEMethod`）、`#L390`（`torch.npu.synchronize`）都在写手说的行上 |

### GLM 一节：推断链与数字

- 推断链成立：W8A8 → `model_config.quantization` 非空 → `_requires_processed_layout_transfer` 第一条直接 True（`rfork_loader.py#L503-L505`）；后处理三件事对得上 `w8a8_dynamic.py#L358-L359`（两块专家权重转置）、`#L363-L364`（转 NZ）、`#L366`（`w13_weight_scale_fp32` 是挂在 layer 上的普通属性，不是 Parameter/buffer，所以确实只能靠 processed 路的「其他模块公开属性」扫到——页面这一句是对的）。
- top-k 缓冲：`db701c1f:glm5_next.py#L2252-L2259` 的形状就是 `(max_num_batched_tokens, index_topk + index_kpool - 1)` int32；`index_topk=2048`、`index_kpool=4` 出自 02 L33；8192 × 2051 × 4 B = 67,207,168 B = 64.09 MiB、MTP 宽度 `ceil(2051/128)×128 = 2176` → 68.0 MiB、合计 132.1 MiB、11 个 MLA 层共用一份，**四项全部与唯一出处 02 L152-L153、L446-L448 逐字一致，没有重算也没有新造数字**；MTP 取整规则对得上 `glm5_next_mtp.py#L64-L77`。
- 「挂在每个 MLA 层的索引器上」属实：`db701c1f:glm5_next.py#L402` 的宿主类是 `AscendSparseAttnIndexerKpool(nn.Module)`（class 定义在 `#L370`）。
- **标注合规**：L155 开头「这一节是按源码推，不是实测」，L185 结尾再次写明未实测并给出实测验证方法；GLM 字节数、借几次都链回总览不重算。**没有虚构部署数字，没有把主线数字当成某特性的实测效果。**

### 旧版信息清单（scratchpad\p5\rfork-layout-facts.md，F1–F19）抽查

抽 F2 / F5 / F8 / F12 / F13 / F15 / F17 六条逐条验：F2 三条件在 L77-L81；F5 两条路对照表在 L95-L98（四列齐）；F8 采集范围表在 L112-L117（impl 行已改正）；F12 SFA 例在 L125；F13 同名去重四项加冲突报错在 L129；F15 工作区按名字最后一段排除在 L137；F17 边界段在 L151。写手「无删除项」的勾选属实：`git diff` 只删 12 行，逐行都能在新版找到对应改写（含 `RFork %s model uses post-load tensor layout transfer.` 这条日志，现在 L201）；**没有 H2 被删或改名，全库也没有指向本页锚点的入链（`grep rfork-layout.md#` 命中 0），锚点无风险**。

### P1（0 条）

无。

### P2（2 条，本轮应处理）

- **P2-1 重讲总览已讲过的内容。** L67-L71「为什么不能先收下，再自己转」的末段与 L159-L161 GLM「走哪条路」，把 `rfork.md#W8A8 为什么省不掉后处理`（总览 L242-L244）已经讲完的三件事（int8 专家转置、转 NZ、新建 FP32 缩放副本）和「B 省下的只是找文件 / 读盘 / 名字映射与切片 / 主机到卡」几乎原样又讲了一遍。改法：本页第一节的示意例子保留（它是布局页自己的直觉入口），但 L71 的代价句和 L161 的三件事各缩成一句话 + 链到总览那个锚点，细节不再重复。
- **P2-2 MLA、MTP 两个术语先用后讲且无链接。** L123「MLA 注意力的实现对象」是全页第一次出现 MLA，L170「GLM 的 MLA 层」「MTP 层」同样没有解释或链接，而站内有 `mla.md` 和 `speculative-decoding.md`（MTP）。初学者读到 GLM 一节会卡在这两个词上。改法：L123 首次出现处链 `mla.md`，L170 的 MTP 首次出现处链 `speculative-decoding.md`，各加半句话说明是什么。

### P3（3 条，可随手改）

- **P3-1 读前那道 MoE 包装的条件少写了一半。** L104 和 L202 只说「`multistream_overlap_shared_expert` 为真」，源码 `fused_moe.py#L411-L412` 还要求 `shared_experts is not None`（该层得真有共享专家）。结论（GLM 下这一步什么也不换）不受影响，但条件写全更准。
- **P3-2 第一屏没有图。** 全页唯一的图在第 4 节（两条路流程图，浏览器实测渲染正常）。本批要求「沿用现有图」，所以不算改动范围内的问题；若以后补直觉图，第一节的 6 × 4 例子最适合画。
- **P3-3 字节顺序没演出来。** L61 说「按 6 × 4 去解释就全错了」，但没演一个数：补一句「原来第 2 行第 1 个数，转置后落到第 1 行第 2 个位置；B 按 6 × 4 读到的第 2 个字节其实是 A 的第 7 个数」，初学者才真看见「字节一个不少但顺序变了」。

### 浏览器实测（Playwright 只读访问用户的 5193 预览，桌面 1440 宽，未起停任何服务）

- `http://localhost:5193/#/wiki/rfork-layout` 第一屏：`scratchpad\rfork-layout-review-first.png`（标题、摘要、首节定义与 6 × 4 例子正常）。
- 两条路流程图：`scratchpad\rfork-layout-review-diagram.png`（两行三块，配色与站内一致，图注完整）。
- GLM 一节与 calc：`scratchpad\rfork-layout-review-glm.png`（132.1 MiB 的 calc 三行渲染正常，常见误解新增两条可见）。
- DOM 读到 11 个正文 H2，与源文件一致；无 JS 报错，仅 4 条后端资源 502（问答侧栏接口，与本页内容无关）。

### 其他检查

- 行内代码密度：对照源码之上 6 处 / 约 6,000 字 ≈ 1 处每千字（限 13）；每节最多 1 个 calc（共 2 个，分属两节）；表格与 calc 不相邻；对照源码之上无证据角标。
- 对照源码五个 H3 齐全且顺序正确；「版本差异」里 v0.23、v0.26、main、`db701c1f` 四个口径都在，末尾只链总览的逐补丁表，未重讲。
- 本轮没有新增分镜动图。
- 跳过：frontmatter 的 sources 区（按纪律不读，由 audit 校验）；对照源码正文只做结构与抽样核对；读 `rfork` 仓 `utils.py` NZ 转换那一段时被安全分类器拦下，改用 grep 从 `ascend_config.py#L262-L269` 与 `envs.py#L88` 核实 0/1/2 三档与默认值，结论不受影响。

## P5 修订记录（2026-10-02，按 P5 审查逐条处理）

- **P2-1 已改。** 「为什么不能先收下」的代价段压成一句 + 链 `rfork.md#w8a8-为什么省不掉后处理`；GLM「走哪条路」的三件事压成一句 + 同一锚点，只留本页要紧的一点（FP32 副本是普通属性，靠公开属性扫描进清单）。GLM 前提里「谁向谁借、每卡读多少」改链 `rfork.md#放到-glm-双机再起一个同构实例每张卡借多少`。两个锚点按 `src/content/wiki/anchors.ts` 规则写，lint 校验通过。
- **P2-2 已改。** MLA 首次出现（派生状态一段）链 `mla.md`，加半句：把各头的 K、V 压成共用短向量存、用时再展开的注意力。MTP 首次出现（GLM top-k 一节）链 `speculative-decoding.md`，加半句：投机解码里先猜后面几个 token 的那一层。
- **P3-1 已改。** 正文改为「每个带共享专家的 MoE 层」；「怎么开」与「源码位置」补 `shared_experts is not None` 条件，行号 `fused_moe.py#L410-L413`（已核 `rfork@3284850b`）。
- **P3-2 不改。** 本批任务行写明「直觉图：沿用现有图」，小修不新增图；现有两条路流程图讲的是第 4 节内容，挪到第一屏反而先于概念出现。审查也已注明不在本批范围。留给以后补图时用 6 × 4 例子。
- **P3-3 已改，但审查给的数不对，按自己推的写。** 审查建议写「第 2 个字节其实是 A 的第 7 个数」。推导：6 × 4 按行存，第 2 行第 1 个数下标 1 × 4 + 0 = 4，即第 5 个数；转置成 4 × 6 后位置 (0, 1)，下标 0 × 6 + 1 = 1，即第 2 个字节。所以 B 读到的第 2 个字节是原来第 5 个数，不是第 7 个。正文写为「第 2 行第 1 个数排在第 5 个字节，转置后变成第 2 个字节」，并注明只算转置、NZ 分块还会再打乱一次。
- 验证：`pnpm wiki:lint` 通过；`pnpm wiki:diagrams --check` 退出码 0（第一次运行时别页图中途报错一次，重跑通过，本页图无报错）；`pnpm wiki:audit` 通过，本页无问题行。
- **入名单后修订（2026-10-02）**：图先行，把原图挪到第 2 节「为什么不能先收下」，加一句读图引导，第 4 节改为「先后顺序见前面的图」。免责：正文 7 处陈述性的「可能」改成确定说法（会、有时会、有……的风险，均按源码语义核过）；GLM 一节的「按源码推、未实测」只在开头前提写一次，节末只留核对方法。audit 本页写作标准全 ✓（免责 0.0%），全站 audit / lint / diagrams --check 退出码都是 0；Playwright 只读打开 5193，图正常渲染。

## 7 处确定化的证据（2026-10-02 复核，均为 `rfork@3284850b`，路径前缀 `vllm_ascend/`）

| # | 位置（正文） | 现写法 | 证据 | 结论 |
|---|---|---|---|---|
| 1 | 第一节末段 | 量化打包、NZ 转换会改张量：换形状、换底层存储、多出新张量 | `quantization/methods/w8a8_dynamic.py#L357-L366`：`transpose(1, 2).contiguous()` 改形状并新建存储；`npu_format_cast(..., FRACTAL_NZ)` 改格式；新建 `w13_weight_scale_fp32` | 有证据，保留 |
| 2 | 两条路对比表「按原形状搬」行 | 原改为「后处理有时会换掉底层存储」 | `model_loader/rfork/session.py#L318-L320` 注释原文是 processing **may** replace storage，属于预防；按原形状路径上没找到一定会换存储的具体后处理 | **无直接证据，改回**：写成「一律重新刷新内存登记，防后处理换掉了底层存储」，只说预防目的，不断言会发生 |
| 3 | 两条路一节末段 | NPU 上的格式转换是异步执行的 | `model_loader/rfork/rfork_loader.py#L602-L603`：注释写明先完成异步的 NPU 布局转换，再交出缓冲区，随后 `torch.npu.synchronize()` | 有证据，保留（「同时碰到同一批字节」写成「有风险」，不作定论） |
| 4 | 要搬的张量一节 | 派生权重的两种挂法：普通属性 / impl | `quantization/methods/w8a8_dynamic.py#L366`（`layer.w13_weight_scale_fp32 = ...`，普通属性）；`attention/mla_v1.py#L1164-L1166`（`AscendMLAImpl` 上的 `self.W_UV`、`self.W_UK_T`，类定义 `#L878`） | 有证据；措辞从「转好布局后的模型会……」收窄为「源码里见到两种挂法」并举这两例 |
| 5 | 派生状态一节的稀疏注意力例子 | 原来那块随即被释放成 0 元素空张量 | `attention/sfa_v1.py#L708-L725`：拆出 W_UK / W_UV 后无条件 `dispose_layer(self.kv_b_proj)`；`utils.py#L1293-L1297`、`#L656-L657`：逐个张量 `set_(torch.empty((0,)))` | 有证据，保留并写得更准（对照源码一节同步改了） |
| 6 | 同名一节首句 | 同一个逻辑名字有时会从参数表和公开属性各找到一次 | `model_loader/rfork/tensor_layout.py#L133-L134` 注释原话，`#L155-L176` 先后扫参数表和公开属性 | 有证据，保留 |
| 7 | 同名一节第二段 | 不同名字都会进清单；同一段字节会被读回多次 | `model_loader/rfork/tensor_layout.py#L124-L131` 只按名字去重；`model_loader/rfork/transfer_backend.py#L121-L137` 按名字逐个生成读段，不按地址去重；`#L57-L68` 只在登记时合并地址范围 | 有证据，保留 |

小结：6 处有源码直接证据，保留；第 2 处没有直接证据，已改回预防写法。改完 `pnpm wiki:audit` 本页写作标准全 ✓（免责 0.0%），全站退出码 0；`pnpm wiki:lint` 退出码 0。
