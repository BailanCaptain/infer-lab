# 复审：P4 两个试点深入页的修订是否落实（2026-09-27）

- 对象：`wiki/concepts/tensor-parallel.md`（480 行，图 `tensor-parallel`、`tensor-parallel-forward`）；`wiki/concepts/expert-parallel.md`（416 行，图 `expert-parallel`、`-assign`、`-fit`、`-split`）
- 依据：`tensor-parallel-review.md` 第八节修订记录；`expert-parallel-review.md` 第十二节修订记录；协调者对 TP P1-1 的决定（可切权重保持 1,774.5 MiB，另起一行写每卡运行时复制 54 MiB）
- 方法：页面按 ≤150 行分段读；图读 yaml，并查 SVG 的 `viewBox`/`width`；底稿只用 grep；源码用 `git show <commit>:<path>` 取单个函数片段（≤60 行）；统计用脚本 `scratchpad/p4/recheck/check.py`、`wide.py`（输出 `check.json`）；锚点按 `src/content/wiki/anchors.ts:8-30` 的同一规则重建两页全部 47 个相对链接
- 实际运行：`pnpm wiki:lint`、`pnpm wiki:diagrams --check`、`pnpm wiki:audit`，全部退出 0（见 §六）
- 没做：未读 `HANDBOOK.md`、`docs/plans/`、整份 `TERMS.md`；未自己起服务进浏览器，宽度与跳转以 yaml/SVG 静态核对，再加上写手在最后一次修改之后生成的浏览器证据（见 §七）；本轮没有读取被拦截

## 结论

| 页面 | 判定 |
|---|---|
| `tensor-parallel.md` | **不通过**。修订记录里的 P1-1、P2-1～3、P3-1～6 和三处卡点**全部落实**，P1-1 按协调者的决定写，算式自洽。但页面还有两项不达标：①免责句占比 **16/208 = 7.69%**，换成最宽的口径也有 4.12%，都超过 3%；②`图尺寸`、`图模式` 只写了中文自造名（P2），EP 页同类问题已按 P2-4 改掉 |
| `expert-parallel.md` | **不通过（只差 1 处 P2）**。P2-1～5、P3-1～10 与两处教学断点**全部落实**，免责句 0%，结构、角标、图宽和 113 倍对比图都正确。剩下的问题在 `:123`：链接说 `disable_tp=False` 的推导“统一见 tensor-parallel”，但 TP 页目标节里没有这段推导，共享专家为什么按 TP8 切，现在两页正文都没讲 |

## 一、tensor-parallel：逐条核对

| 条目 | 落点 | 核对结果 |
|---|---|---|
| P1-1（写手驳回，协调者裁定） | `:369-392` | 已按决定写。`:373` 复制部分 727.5 MiB 不含副本，`:374` 注明“不含运行时 FP32 副本”，`:375` 可切部分 **1,774.5 MiB**；`:381` 用粗体另起一行写“**每卡运行时复制**：索引器 FP32 副本约 54 MiB”，`:383-390` 单列 calc。脚本复算：18,576 / 2,502 / 727.5 / 1,774.5；TP4 22,852.5 MiB = 22.317 GiB，TP16 20,190.75 MiB = 19.718 GiB；副本 12×288×4096×4 = 56,623,104 B = 54 MiB；加副本后是 22.370 / 20.637 / 19.770 GiB；差值 1.733 / 0.866 GiB，与 `:392` 一致 ✓。驳回理由成立：底稿 `02-forward.md:121` 的稠密 MLP 18×3 = 54 MiB 在原审查的自底向上重建里被漏掉；`:134` 把索引器 FP32 副本列在表外；从底向上加一遍得 1,774.4，与差额口径只差 0.1 的取整。源码 `glm5_next.py#L1349-L1352`（db701c1f）确实是在首次前向时惰性创建 `_wk_weight_f32` / `_gate_weight_f32` ✓ |
| P2-1 图 2 过宽 | `tensor-parallel-forward.yaml:4` | 改成 `[960,1380]`，SVG `width="960"` ✓。稠密层与 MoE 分成上下两块，MoE 两栏互斥，共享分支与外层入口的归约互补（yaml `:21-22`、`:26-27`）✓ |
| P2-2 集合通信大小写 | 全页 | All-Reduce 21 处、All-Gather 11 处，小写 `all-reduce` / `all-gather` 剩 0 处；剩下 2 处 `allreduce` 都是 `:446`、`:452` 的特性名 matmul-allreduce ✓ |
| P2-3 relations 落到正文 | `:88`、`:110`、`:125`、`:202` | 四处链接都在；脚本核过 27 个相对链接，目标文件和锚点全部存在 ✓ |
| P3-1 / P3-2 / P3-3 图 1 | `tensor-parallel.yaml:6,41-42,8,37` | 首框下移到 y=74；column 标签在 gate/up 下方（`:41`），row 标签在 down 下方（`:42`）；八个 P 放进同一外框（`:8`，x 54–906），All-Reduce 从外框下沿中点 x=480 引出（`:37`）✓ |
| 卡点 3 部分和形状 | yaml `:13-20` | 八张同尺寸的 `[4,4096]` 矩阵分两排，`style: faded`，图注写“完整形状、数值仍为部分和” ✓ |
| P3-4 细粒度 TP | `:406`、`:421-423` | 补回了“沿 DP 维建组”和“非 MoE 模型报错”。写手没有照原审查写“普通 TP>1 不生效”，而是收窄到 OProj，**理由成立**：`parallel_state.py#L117-L149` 用 `rank_grid[pp_idx][chunk…, tp_idx]` 沿 DP 维取组；`ascend_config.py#L505-L577` 里只有 OProj 在 `tensor_parallel_size > 1` 时 `raise`，所有模块都做非 MoE 检查和 DP 整除检查 ✓ |
| P3-5 通信量与模型大小 | `:405` | 已补。同一份 20.58 GiB/卡的权重，R1 一次归约 32 KiB，场景 M 一次 47.25 MiB，与 `:301`、`:332` 的 calc 一致；结论正确 ✓ |
| P3-6 算子层链接 | `:419`，frontmatter `:58` | 已补 ✓ |
| 卡点 1 KDA 18.2→85 MiB | `:187-194` | 已补 calc：34×561,152 B = 18.2 MiB；34×4×655,360 B = 89,128,960 B = 85 MiB ✓ |
| 卡点 2 MC2/ALLGATHER 计数 | `:268-277` | 已新增小节和两行对照表。源码复核：`fused_moe_0_23_0.py#L663-L670` 在 MC2 下对 `shared_out` 做 All-Reduce；`register_custom_ops.py#L159-L167` 在 MC2 下直接 `return` ✓ |

## 二、expert-parallel：逐条核对

| 条目 | 落点 | 核对结果 |
|---|---|---|
| P2-1 免责句 | 全页 | 5 个关键词 0/220；把“待核”也算进去是 3/220 = 1.36%（`:119`、`:369`、`:412`），和写手自报一致 ✓ |
| P2-2 共享专家单一出处 | `:121-123` | 形状与字节已删：grep `[512,4096]`、`3,145,728`、`[4096,256]` 全部 0 命中；只留“TP8 合切、每卡每层 3 MiB”，并链到 `tensor-parallel.md#共享专家走-tp8路由专家走-ep16`。锚点按 `anchors.ts:8-14` 生成，结果就是这一串，TP 页 `:240` 只有这一个同名标题；写手的 `link-click.json` 显示点击后 `headingVisible: true` ✓。**但链接文字多承诺了 `disable_tp=False` 的推导，见 §五 EP-1** |
| P2-3 为什么用 EP 而不是按 TP 切 | `:87-115` | 已补对照表和 calc：24 MiB/专家；TP16 下中间维 128、每专家每卡 1.5 MiB；两种分法都是 432 MiB/卡/层；`:99` 写明“专家越切越窄，down 输出仍是 4096 维，归约张量不随中间维缩小”。`:91` 说“未开 EP 时拍平成专家内部 TP、开 EP 时 EP16/TP1”，与 `vllm@0fc695fc fused_moe/config.py` 的 `use_ep` 和 `flatten_tp_across_dp_and_pcp` 分支一致 ✓ |
| 开了也没用的边界 | `:346` | 已补：非 MoE 模型 → `None`；未开 EP 或 EP 组只有 1 张卡 → ALLGATHER；上游 `use_ep = dp×pcp×tp > 1 and enable_expert_parallel`。与 `ascend_forward_context.py#L311-L363` 以及上游 `config.py:1165-1168` 一致 ✓ |
| P2-4 graph mode / capture size | `:190` | 首次出现处写成英文原名，并附中文解释 ✓ |
| P2-5 图 | 四个 yaml | `assign` 画了 rank 0 的源卡/目的卡两种角色（`:26-34`），16 卡的专家区间都等于 18r…18r+17 ✓；`expert-parallel` 两路并排 ✓；`fit` 保留 ✓；`split` 改成比例条形图（§三-2）✓ |
| P3-1 | `:123` | “同样挂在 `FusedMoE` 下，按 EP 分的只有路由专家” ✓ |
| P3-2 | `:188` | 执行快照没有 LoRA 分支；补了 `ALLTOALL` / `FUSED_MC2` 的归属 ✓ |
| P3-3 | `:346` | 同上“边界”行，新增来源 C37 = frontmatter 第 37 条（`:46`）✓ |
| P3-4 | `:213` | 标题改为“场景 M 与它的纯 decode 对照” ✓ |
| P3-5 | `:143` [C33]、`:344` [C19]、`:358` [C30] | 三条来源的序号与 frontmatter `:42`、`:28`、`:39` 对应 ✓ |
| P3-6 | `:117` | 17.72 GiB、432 MiB、20.58 GiB 都引自部署页，占比 calc 已撤 ✓ |
| P3-7 | `:129` | 正文里 MC2 / AllGather 第一次出现就给了定义 ✓ |
| P3-8 | `fit.yaml:23` | “否”放在 `[736,254]`，贴着折线起点 `[720,269]`；底部重复的 note 已删 ✓ |
| P3-9 | `:71`、`:89`、`:119` | 分工、精度、提交号分成三处写 ✓ |
| P3-10 | `:117` | 补了 Multi-Token Prediction ✓ |
| 断点：为什么切源 token | `:137` | ✓ |
| 断点：combine 与 All-Gather | `:166` | “combine 合齐专家贡献，All-Gather 拼回 token 行”，共享分支始终是完整的 `[4,4096]` ✓ |

## 三、重点检查

1. **图宽**：6 张 SVG 的宽度分别是 tensor-parallel 960、tensor-parallel-forward 960、expert-parallel 960、-assign 960、-fit 900、-split 960，全部 ≤1000 ✓。写手的 `browser-evidence.json`（20:49，晚于页面最后修改 20:47:55）记录图容器 `clientWidth = scrollWidth = 1000`、“左右滑动”提示 0 个。
2. **55.1 MiB vs 6.09 GiB 条形图**（`expert-parallel-split.yaml`）：两段数值是 `55.13525390625` = 42×1,376,512 B ÷ 2²⁰，和 `6232.5703125` = 42×155,602,944 B ÷ 2²⁰ = 6.0865 GiB，都精确；比值 113.04 ✓。按 0.1 px/MiB 的比例，条长 5.5 px 和 623.3 px，右端 x = 861 仍在画布内；两段标签的数值和口径（“源侧上界”“同一线性比例”）与正文 `:215-221`、calc `:231-258` 一致 ✓。
3. **四段补回的内容**：“为什么用 EP 而不是按 TP 切”（EP `:87-115`）、“开了也没用”（EP `:346`）、“细粒度 TP 只切 DP 维”（TP `:421-423`，`:406`）、“通信量与模型大小成正比是误解”（TP `:405`）都已对照源码或本页 calc 核过，**写得正确**。TP `:423` 有一处措辞小问题，见 §五 P3。
4. **共享专家单一出处**：推导只留在 TP `:240-254`，EP 页只保留结论和链接，锚点可达 ✓；但链接承诺的内容不全，见 EP-1。
5. **跨页数字一致**：R1 的 finalize 8,192 B 和共享归约 32,768 B（TP `:291-292` ↔ EP `:184`）；纯 decode 的 64 KiB 和 512 KiB（TP `:346-347` ↔ EP `:237-238`）；场景 M 一次 hidden 47.25 MiB（TP `:332` ↔ EP `:251-254`）；84 = 42×2 次 EP 通信（TP `:316` ↔ EP `:184` 每层 4 次）；每卡 18 个专家、每卡每层 432 MiB、主干 17.72 GiB、整卡 20.58 GiB——两页全部一致。两页都各写了一次“MC2 在共享分支归约 / ALLGATHER 在外层归约”（TP `:268-277` 是对照表，EP `:211` 是一句结论），EP 那句没有另做推导，按原审查 P2-2 允许保留的“归约时点对比”处理，不算重复推导。

## 四、脚本统计

| 项 | tensor-parallel | expert-parallel |
|---|---|---|
| 免责句（5 个关键词，去掉 frontmatter、围栏、标题、表格和孤立角标，按 `。！？`/换行分句；与 EP 写手同一口径） | **16/208 = 7.69%** ✗ | 0/220 = 0.00% ✓ |
| 同上，另把“待核”也算进去 | 21/208 = 10.10% | 3/220 = 1.36% |
| 最宽口径（正文+表格+calc+标题全部算句子） | 22/534 = 4.12% ✗ | 0/486 = 0% |
| 按文件行数（有关键词的行 / 全文件行数） | 19/481 = 3.95% ✗ | 0/417 = 0% |
| `## 对照源码` 之后的 H2 | 0 ✓ | 0 ✓ |
| 其下的 H3 | 怎么开 / 会报什么错 / 开销和什么时候别开 / 版本差异 / 源码位置 ✓ | 同左 ✓ |
| 角标总数 | 26（C17 D7 S1 I1）✓ | 27（C20 D5 S2）✓ |
| [C] 占比 | 65.4% ✓ | 74.1% ✓ |
| 相对链接 / 失效 | 27 / 0 ✓ | 20 / 0 ✓ |

原审查的 TP 数值（12/470 = 2.55%）用的是别的分母，而且是第一轮版本；第二轮修订新增了 `:277`、`:392`、`:405`、`:406`、`:421`、`:423` 等句，修订记录里没有复算这一项。

## 五、未落实条目

### TP-1（P2，标准项）免责句 7.69% > 3%

命中的 16 句：`:204`“切头不等于切潜向量”；`:228`“不能按…去除 cache 字节数”；`:277`×2“不能再算一次 / 不能把两条路径…相加计数”；`:318`×2“并非…就结束 / 还不能把…换成”；`:328`“尚未归约”；`:367`“不能把 20.58 GiB 翻倍”；`:392`“不能从加载权重中扣出来”；`:394`×2“也不能证明 / 不能套用”；`:405`“参数总量不能直接换算”；`:406`“不能开启任何细粒度模块”；`:421`“不能把它当作”；`:423`“不能一概说无效”；`:455`“不能推出整个版本失去该能力”。其中 `:328` 是描述性用法，`:406` 是源码约束，这两句可以保留；要降到 3% 以下（≤6/208），至少还得把 10 句改成正面陈述。比如 `:277` 的两句合成一句“每层只计 1 次”，`:392` 删掉后半句，`:421` 与 `:406` 保留一处。

### TP-2（P2，术语规则）`图尺寸` / `图模式` 只写了中文自造名

`:322`“图尺寸、两组对齐及陪跑的推导见并发页”；`:407`“开图就没有通信了 … 图模式预先录下算子序列再回放”。EP 页 `:190` 已按 P2-4 写成 capture size（图尺寸）/ graph mode（图模式）。同一术语在两页写法不同。

### EP-1（P2，单一出处落空）`:123` 链接承诺的 `disable_tp=False` 推导在 TP 页不存在

- EP `:123` 原文：“形状、字节数和 `disable_tp=False` 的推导统一见 tensor-parallel「共享专家走 TP8，路由专家走 EP16」”。
- TP 全页 grep `disable_tp` 只命中 `:208`，而且说的是 MLA 的 `fused_qkv_a_proj` 取 `disable_tp=True`；目标节 `:240-254` 只讲了形状、3 MiB 和 `reduce_results=False`。
- 这一条件在源码里确实存在：`vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py` 共享 MLP 的 `disable_tp=is_sequence_parallel`（`#L1421`、`#L1430`），`self.is_sequence_parallel = parallel_config.use_sequence_parallel_moe`（`#L1462`），传入点在 `#L1474-L1475`；EP 源码表 `:410` 引的 `platform.py#L650-L653` 通过改 `all2all_backend` 关掉 `use_sequence_parallel_moe`。
- 结果是：共享专家“为什么按 TP8 切”只在 EP 的源码位置表里剩一行，两页正文都没有讲。建议在 TP `:252` 补一句并挂 `platform.py` 的来源，因为共享专家的单一出处就在 TP 页；或者把 EP `:123` 链接文字里的 `disable_tp=False` 删掉，改成就地一句话。

### 非阻塞（P3，建议顺手改）

- TP `:72` 第一次出现 MTP，只有中文解释，没有 Multi-Token Prediction（EP 已按 P3-10 补上）。
- TP `:72`、`:242` 写的是“MoE（Mixture of Experts）”，大写，而且定义了两次；EP `:65` 写的是小写 “mixture of experts”，两页不一致。
- 同一条 MoE 路径，TP 写 `ALLGATHER`（如 `:252`、`:275`），EP 全页写 AllGather（30 处）；EP `:263` 把“AllGather”和“DP All-Gather”放在同一格，两者只差一个连字符，初学者容易混。建议两页统一路径名的写法。
- TP `:381`“profile run 跳过索引器”只挂了 [C37]（`glm5_next.py#L1349-L1352`，只能证明惰性创建）。“跳过”的依据是 `sfa_v1.py#L1660-L1666`：`attn_metadata is None` 时 `return output.fill_(0)`，本轮已核，结论属实，但页面没有引用；所链部署页 `#启动时发生了什么` 也没有提到索引器副本。
- TP `:423`“OProj 细粒度 TP 不生效，配置检查直接报错”：源码是 `raise AssertionError`，“不生效”容易读成静默忽略，建议只保留“直接报错”。
- `wiki:diagrams --check` 对 TP 两张图有 6 条非阻塞提醒（`diagrams.log:35-40`）：图上出现代码名 `o_proj`、`gate_up`、`down_proj`；`tensor-parallel.yaml` 的 texts[0]、texts[5] 被判为整句。TP 修订记录只写了“152 张图一致”，没有提这 6 条。EP 四张图 0 条提醒。

## 六、命令输出

- `pnpm wiki:lint`：退出 0；`ok wiki:lint 通过（另有 22 处待留意）`，22 条都在别的页面，两页 0 条。
- `pnpm wiki:diagrams --check`：退出 0；`ok wiki:diagrams 152 张图与 spec 一致`；TP 两图 6 条提醒如上，EP 0 条。
- `pnpm wiki:audit`：退出 0；审计 131 页、来源 1476 条；行号有效 1391，URL 未联网 85，无效 commit / 缺文件 / 行号越界 / 未知仓库均为 0。两页分别有来源 39 条（TP）和 38 条（EP）。
- 日志：`C:\Users\-\AppData\Local\Temp\claude\C--Users---Desktop-infra-view-new\13898c74-f916-4e2c-8924-fe9bf130f160\scratchpad\p4\recheck\`（`lint.log`、`diagrams.log`、`audit.log`、`check.json`、`check.py`、`wide.py`）。

## 七、未核

1. 没有自己在浏览器里渲染两页。图宽、跳转、表格溢出依据的是写手的 `browser-evidence.json`、`link-click.json`，文件时间都晚于页面最后修改，再加上本轮的 yaml/SVG 静态核对。
2. `quant_model_description.json` 仍然缺失，W8A8 逐层精度的假设沿用部署页（两页都标了待核）。
3. EP 的 TP16 对照只是静态形状比较，“EP 更合算”的性能结论两页都没有写成实测，本轮也没有 NPU 数据。
4. 两页 sources 共 77 条，本轮只抽核了 11 处源码片段：索引器副本、细粒度 TP 建组与检查、选择器入口、上游 `use_ep`、共享专家归约和外层返回、SFA profile 早返回、共享 MLP 的 `disable_tp`、`platform.py`。其余条目依赖 `wiki:audit` 的行号校验。

## 八、本次剩余问题修订记录（2026-09-27）

- **修改范围**：仅修订 `wiki/concepts/tensor-parallel.md`、`wiki/concepts/expert-parallel.md`，并在本报告末尾追加此记录；未提交 git，未启动开发服务器或进行浏览器验收。
- **TP-1（措辞编辑）**：将原统计命中的 16 句逐项改为直接说明分片、复制、归约计数、权重分类和配置约束的陈述；保留原有计算、数值、适用条件和未知项。HCCL 的缺证据项明确包含算法、链路计数与耗时测量；版本分派入口之外的能力追踪写为“待核：缺……”。没有删除技术信息或增加无关句子稀释比例。
- **TP-2（术语编辑）**：TP `:328` 改用 `capture size`，首次附“图尺寸，预先捕获、可供回放的执行 token 宽度”；`:413` 改用 `graph mode`，首次附中文名称及捕获、回放的解释。仅 grep 核对 `wiki/TERMS.md:68` 的 graph mode 条目（capture size 无独立条目），并对照 EP `:190` 和并发主线页的用法。
- **EP-1（机制补充，选择 a）**：推导放在 TP `:246-248` 的共享专家节，EP `:123` 保留结论与指向该节的链接。原因是此机制解释共享专家为何采用 column / row 的 TP8 分片，紧接现有形状和 3 MiB 算式最自然，也使 EP 专注专家派发与回收，保持推导的单一出处。
  - 固定 `worker_cls="auto"`、编译配置未开启 `enable_sp` 的条件下，平台设置 `all2all_backend="flashinfer_all2allv"`；该值在上游序列并行 MoE 的 backend 集合之外，故 `use_sequence_parallel_moe=False`。
  - 模型把该值依次传给 `self.is_sequence_parallel`、共享 MLP 和两种投影的 `disable_tp`；因此共享专家沿现有 TP8 切分。`reduce_results=False` 单独控制归约时机。
  - 用 `git show <commit>:<path>` 核对 `vllm-ascend@db701c1f` 的 `platform.py:650-653`、`models/glm5_next.py:1403-1442,1451-1479`，以及 `vllm@0fc695fc` 的 `config/parallel.py:625-641`、`model_executor/layers/linear.py:433-455,1421-1445`。TP 新增 sources 40、41，模型传递链沿用 source 7；源码位置表同步补入口。

### 脚本复算与验证

复用 §六日志目录中的原始 `check.py`、`wide.py`，未修改统计脚本。改前运行得到 TP **16/208 = 7.69%**、EP **0/220 = 0.00%**；改后结果如下。主口径仍排除 frontmatter、围栏、标题、表格与孤立角标，按 `。！？` 和换行分句，关键词仍为 `不能|不等于|尚未|并非|不代表`。

| 统计口径 | tensor-parallel | expert-parallel |
|---|---|---|
| 本任务五关键词口径 | **0/214 = 0.00%** | **0/220 = 0.00%** |
| 正文加表格 | 4/386 = 1.04% | 0/401 = 0.00% |
| 最宽口径（含标题、表格、calc） | 5/544 = 0.92% | 0/486 = 0.00% |
| 附加诊断：五关键词再加“待核” | 7/214 = 3.27% | 3/220 = 1.36% |
| 相对链接 / 失效 | 27 / 0 | 20 / 0 |

“待核”列单独呈现缺证据项，不属于本任务定义的五关键词验收口径；这些未知项仍保留。宽口径中保留了报错表的四项整除约束及容量算式的范围说明。

- `pnpm.cmd wiki:lint`：退出 0，`ok wiki:lint 通过（另有 22 处待留意）`；提醒均在其他页面，两页为 0。
- `pnpm.cmd wiki:audit`：退出 0，审计 131 页、来源 1478 条；行号有效 1393，URL 未联网验证 85，无效 commit / 文件不存在 / 行号越界 / 未知仓库均为 0，raw 引用待核对 1219。此次通过仅覆盖本地引用和行号，未扩展为全部来源语义或实机验证。
- Windows PowerShell 的 `pnpm.ps1` 被本机执行策略拦截，改用同一安装的 `pnpm.cmd` 执行两项命令，未改执行策略。
- `git diff --check -- wiki/concepts/tensor-parallel.md wiki/concepts/expert-parallel.md`：通过；共享专家目标锚点仍可解析。
- **待用户决定的问题：无。** 原有量化文件、NPU 实测与执行轨迹缺口继续在正文标注；本次只处理指定的三项剩余问题。
