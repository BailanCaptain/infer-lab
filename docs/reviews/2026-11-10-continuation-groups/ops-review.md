# 算子两页独立审查与修订复审

审查日期：2026-11-10。审查者：独立代理 `groups_ops_review`。按 `docs/wiki-writing-standard.md` 阅读当前两页全文、改前快照差异、来源与四张图；审查者未修改教学页面。下列问题由写手修订后再次核对。

结论：本轮发现的 1 个 P1、6 个 P2 已关闭，当前审查范围无未关闭 P1/P2。这里验收的是两页与冻结的 32 个来源项及本轮补证，不表示全站或全部官方文档已经核完，也不表示完成 NPU 运行或性能验证。

## 范围与证据

- 页面：`wiki/concepts/op-to-ai-core.md`、`wiki/concepts/ops-and-kernels.md`。
- 改前比较：`.tmp/continuation-groups-2026-11-10/ops-before.zip` 中两页全文；旧图 YAML/SVG 也保留在包内。
- 冻结清单：`ops-manifest.json`，共 32 项；`op-to-ai-core` 的 1–27，`ops-and-kernels` 的 28、33、41、42、43。
- 本轮补证：前页新增 28、29；后页新增 44–47。两页 MoE 来源起点从 133 扩到 113，KDA 合并来源末尾从 645 扩到 659。
- 固定源码用 `git -C tools/repos/vllm-ascend show <commit>:<path>` 和本轮本地摘录读取。特别读了四版完整注册函数以及扩展门控与调用分支，未把“路径/行号存在”当成语义验证。
- CANN 80RC2《基本架构》已联网读全文，并查看耦合、分离及处理器三图。RMSNorm 原论文读取 §4（含公式、表 1、4.1、4.2），只认这部分支持的定义，不记整篇论文全文阅读。
- 模型配置核对固定 `690b705278a3a58e538fcb37c2ca8b5f9511213c` 本地缓存的引用字段 `linear_attn_config.short_conv_kernel_size=4`，未把配置文件当作当前设备执行的证明。
- raw 来源 24 只作为归档完整性记录：`ops-raw-check.json` 报告 SHA 与 21/21 摘录匹配。对应 21 段源码另逐段阅读，不能将 raw 再计成 21 份新官方文档或一次额外语义验证。

## 问题及关闭依据

| 级别 | 位置（修订后行号） | 原问题与影响 | 依据、修法及复审 |
|---|---|---|---|
| P1 | `ops-and-kernels.md:137`、`:192`、`:284` | 将“分块会把一次运算拆成多个 kernel”作为算子数不等于启动数的理由，混淆数据分块、核内循环与 kernel launch。读者据块数估算下发次数会出错。 | `db701c1f` Host 的 `SetBlockDim`、设备 `GetBlockIdx` 及 `Process/SubProcess` 表明同一 kernel 能由多核分块并循环。三处已明确区分算子调用数、kernel 启动数、数据分块数；实际启动数仍看 trace。独立复审关闭。 |
| P2 | `ops-and-kernels.md:247`，版本表及 `:254` | main 列用 KDA 文件存在推断旧 KDA 项在替换表登记，掩盖版本变化。 | 读 `2ed6cbba:utils.py#L660-L783`、`baa023ad:utils.py#L794-L926`、`7d825229:utils.py#L819-L955`。v0.26 基础表有 `KimiGatedDeltaNetAttention`；main、rc2 无旧项。main 的 KimiK3 MLA wrapper 不能证明 KDA 登记。已改表并补来源 46、47，未推断未经追踪的新适配方式；关闭。 |
| P2 | `ops-and-kernels.md:171`，来源 45 | “按原位置合回”涉及 647–659 的 `index_copy_`，原补证停在 645；同时普通 decode/prefill 拼接与投机/非投机索引回填混写。 | 已扩到 659，正文分别说明 decode 在前、prefill 在后的 concat，以及投机/非投机按索引回填。逐行核对 `_forward` 的拆分条件、递推参数和两个合并步骤；关闭。 |
| P2 | `ops-and-kernels.md:146` | GLM 实际执行链表将无 residual 与有 residual 两支并列，容易把扩展对照分支误认成该模型实际调用。 | `db701c1f:glm5_next.py#L2212-L2235` 两个 RMSNorm 均只传混合后张量。表已写实际 `npu_rms_norm`，带 residual 对照保留为邻页链接；关闭。 |
| P2 | 前页来源 17、`:279`；后页来源 26、`:278` | MoE 引文从 133 开始，缺失正文所讲动态量化复用与融合候选的条件定义。 | 已向前扩到 113：包含融合/EPLB 条件与 `dynamic_scale is None` 分支；正文来源文字也同步。该扩展不改变固定 W8A8 示例范围；关闭。 |
| P2 | `ops-and-kernels.md` 正文密度 | 修订中间态免责词统计为 3/91=3.30%，超过标准 3%。 | 将融合的泛化“可能”改成成立条件，保留量化包与 NPU 缺证限制。最终 2/91=2.20%；关闭。 |
| P2 | `wiki/diagrams/op-to-ai-core.yaml` 连接融合算子与 C++ 下发的线 | 连线穿过“可选融合扩展：Host 规划 → Vector 执行”标题，影响图中阶段边界阅读。 | 修订后从标题右侧进入下一框再连向 C++ 节点；实际渲染截图确认不压字。新 dispatch 图 OOT 说明也移至底部避开竖线；关闭。 |

## 来源语义核对

下表按冻结项逐组覆盖，范围总和为 32；同组每个本地摘录均阅读，未以组内一条代替全部。

| 页面与来源号 | 核对内容与结论 |
|---|---|
| op-to-ai-core 1、2 | GLM 构造两个 RMSNorm；mHC pre → 单参数 norm → attention/MLP → mHC post。实际路径与残差融合对照分开。 |
| 3、4 | 固定注册基础 26 项；0.23 门控增加 FusedMoE 与 KDA。`__new__` 选实现类，`__init__` 保存方法，`forward` 调用已保存方法；禁用仍经 `maybe_compile`，OOT 基类默认可回 native。 |
| 5、6 | 固定 residual 分支按扩展门控选择；无 residual 调 torch_npu。门控缓存、batch invariant/A5 条件、编译期间不 bootstrap、特定 ImportError 才重试厂商库路径，均与解释一致。 |
| 7、8 | dtype、bias、UB 约束及 tiling key 选模板；入口调用选定模板，不从模板数量推导 kernel 启动数。 |
| 9、10、11 | 适配层分配 y/rstd/更新残差；CopyIn 相加后写残差，Compute 做平方、均值归约、epsilon、倒数平方根与缩放，CopyOut 输出结果/统计。残差仍写回支持对“融合必少写一次”的修正。 |
| 12、13 | 平台查询或编译信息读取 AIV 核数与 UB，扣预留空间；分配函数输出使用核数后才设置 BlockDim。 |
| 14 | CANN 基本架构正文与三图支持 Cube/Vector/Scalar、AIC/AIV 与存储搬运分工，不支持本部署核数或性能数字。 |
| 15 | 原论文 §4 支持均方根缩放、不减均值；融合 residual/bias 是实现另核的组合，不归给论文。 |
| 16、17 | W8A8 动态量化 → 量化矩阵乘；MoE 已量化输入复用、MC2 与偏置/偏移约束及三条融合候选，条件补至 113 后可追踪。 |
| 18、19、20 | 三版 RMSNorm：v0.23/v0.26 有 conditional fallback；main residual 分支直接导入和调用扩展。仅 v0.23 该无 residual 路径有预取后处理钩子，不能据调用推断实际预取。 |
| 21、22、23 | v0.23/v0.26 的 A5 禁用，与 main `RUNTIME_CUSTOM_OPS` 能力门控不同。门控布尔值不能虚构 main residual 分支的 fallback。 |
| 24 | raw 归档项，按上文边界记账；不是第二套独立事实来源。 |
| 25、26、27 | rc2 residual 直接扩展调用；通用加载仍受 batch invariant/硬件能力约束；PreparedLinearInput 可复用预量化，普通输入仍动态量化。另向后读完整加载函数，确认失败处理边界。 |
| ops-and-kernels 28、33 | v0.23 与 rc2 完整注册入口、各自版本/模型/硬件条件及注册完成标记；本轮追加 v0.26/main 完整函数后才作四版登记结论。 |
| 41、42、43 | 固定 KDA chunk size=64；配置解析优先 legacy 字段，否则 flat/default；固定配置短卷积宽度=4。宽度 4 与 kernel 程序不是同一概念。 |

新增来源 28/29 的 Host 分配与普通 kernel 消费已连起来核对：`ceil(10/4)=3`，实际核数 `ceil(10/3)=4`，尾核 `10-3×3=1`，对应行 0–2、3–5、6–8、9；2 行与 4 可用核只使用 2 核。核内 `rowFactor` 再决定循环与尾轮，不能把“每核几行”和“每轮几行”合并。示意有适用条件，未冒充实际 A2 核数或设备测量。

新增来源 44–47 已核模型补 GateLinear、设备覆盖、KDA 批内投机/非投机选路以及两版完整注册；其中 KDA 的普通混合拆分严格对应 `spec_masks is None` 且同时有 prefill/decode。

## 信息保留与教学阅读

与改前全文 diff 对照：保留 GLM 固定双机前提、34/11 层、卷积 4、chunk 64、原归一化数值例子与字节演算、mHC 两子层调用、W8A8 与 MC2 路径、三份输出、设备回退差异和所有仍缺 NPU 的项目。删除的“行分配仍待核”已由 Host/设备定义及两组算例替代。跨厂商复用、一次调用一个 token、分块即启动、融合必少写一次等旧结论均以更精确且有条件的解释替代，不是把问题从正文删掉。

首两屏复述：前页说明算子是语义、kernel 是设备程序、Cube 与 Vector 承担不同执行段；数据搬入与片上空间、循环和同步构成代价，融合还要交付后续所需结果。后页说明模型调用经实现选择、算子接口和运行库落到设备，排查需要逐层定位类/方法/接口，不能从 Python 调用行数推出执行情况。首图承担解释，未用大段引文或维护记录挤占正文。

四图均实际查看：`op-to-ai-core-intuition` 区分矩阵/向量执行段与纯向量 RMSNorm；`op-to-ai-core` 分开 GLM 实际无 residual 与扩展对照；`ops-layers` 展示三条实现入口与向下路径；`ops-dispatch-flow` 区分类选择/方法选择并保留禁用后编译条件。箭头没有宣称跨单元必须直接共享某一缓存；实际交接按实现另核。

## 实际验证

独立脚本与输出保存在 `.tmp/continuation-groups-2026-11-10/ops-independent-browser.mjs`、`ops-independent-measure.ts` 和 `ops-independent/`，未复用写手自查结论。

- `node .tmp/continuation-groups-2026-11-10/ops-independent-browser.mjs`：桌面 1440×1100，两页 pageerror 均为空；前两屏、4 图、表格及 calc/关键段截图已查看。实际点击“R1 的 MoE 站”“残差融合的数据交接”，均到目标页锚点。修图后再次截图确认。
- `pnpm exec tsx .tmp/continuation-groups-2026-11-10/ops-independent-measure.ts`：正文角标两页均 0；行内代码分别 0 与 2.10/千字；calc 分别 0.78 与 0/千字；免责词分别 2.50% 与 2.20%；源码 H3 顺序、图先行、相邻密集块通过。
- 全文角标前页 9（C 6，66.67%），后页 21（C 16，76.19%），均不超过 30 且 C 比例低于 80%。四图宽分别 860/880/900/880，没有超过 900。
- 此审查没有运行 NPU、没有测量耗时/访存/kernel 启动数，也没有对所有跨页材料重做全文验收。项目构建与全站检查由写手另记，不能用其通过替代上述语义审查。

尚需用户决定：无。本批修订后的源码与教学内容验收通过；设备实测缺口按页面保留。
