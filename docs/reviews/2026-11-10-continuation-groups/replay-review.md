# SWA bounded replay 独立审查

审查者：`/root/groups_replay_review`。日期：2026-11-10。对象为 `wiki/concepts/swa-bounded-replay.md`，最终页面 SHA-256：`15a40826c9c320d1e260f1a6ee2a1e89c08b1231e7eae4afddce12509da758fa`。本文记录独立教学/事实/浏览器审查，不代替本批整体工程验收。

已先读 `docs/wiki-writing-standard.md` 与 `wiki/AGENTS-GUIDE.md`，完整阅读目标正文、三个 YAML/SVG 图及相关模型版本承接。按 `recompute-manifest.json` 冻结的旧队列核了本页来源 1–8，另外核了作者补入的来源 9–11。逐项机器记录见 `replay-judgments.json`；阅读、下载和实际看图范围见 `replay-official-reading.json`。

## 结论与关闭的问题

当前无未关闭的 P1/P2。旧八项逐条核验完成，新三项单列，不能把它们说成 11 篇新全文。该结论不包括 NPU/GPU 推理实验，也不包括仍未取回的生产文章三张原图。

| 级别 | 原问题、影响与复核方式 | 最终处理 |
| --- | --- | --- |
| P2 | 原版本表遗漏 v0.30.0rc2；读者无法辨别官方 Ascend 模型部署与 DeepInfer 实验入口的关系 | 页面 180 行增加 rc2 条件并链接模型页「版本差异」。实际点击可达。固定模型教程有模型/回放介绍，不能据此推导 off/mask/compact 环境变量通用于 Ascend；当前措辞保留这个边界 |
| P2 | 原 L1/L2 入口省略根目录、同源扩展、L1 可见设备、L2 默认规模及 MTP/confidence 范围，读者照命令无法知道完整前提 | 页面 161–163 行补全：L1 不加载权重但准备锁页元数据仍需单可见设备；L2 默认 8 设备、兼容 V4.1 HF YoCo checkpoint、CP 整除 EP、同一 DEEPINFER 环境；MTP 仅 DFlash+YoCo，confidence 首轮空、末次前向未输出。官方 41 行指南及相关脚本逐项支持 |
| P3 | compact 一概写成移除前部行，未交代早期 chunk 的占位行与短输入恒等路径，容易高估省掉的计算 | 页面 128 行补上早期 chunk 至少保留一行、该行不写 SWA 环、短输入不减行；C++ L202–359 直接支持 |
| 补充边界 | 固定 134 需要与实际回退设置建立关系 | 页面 108 行补实际回退为 max(用户值, 推测步数+1)，默认推测 5 对应至少 6；keep 的入口校验同时核对环境、C++ 和 L2。未把 134 写成所有模式固定槽数 |

## 逐项证据判断

下面的支持结论均限定于页面具体主张，不表示整个仓库、文件所有行为或设备数值结果通过验证。

| 来源 | 实际核对范围 | 判断与边界 |
| --- | --- | --- |
| 1 论文 2609.19969v1 | 历史全文记录复用，本轮完整重读 §2.2、§3.2.1、§3.2.2；实际查看 Fig.3、Fig.4 的 SVG | 支持 CED、encoder/decoder 两种回放、近似传播和训练适配。encoder 复用未改写的全局 KV 并恢复缺失窗口；decoder 准备当前生成窗口、不写前缀缓存。不能从窗口长度固定推导算量不受层数影响。窗口 3 的均值算子是本站教学假设 |
| 2 生产 Q&A | 固定 `774ce244` 的 312 行全文、两张原仓库图片；新下载与既有证据同字节 | 支持前 20 层短期窗口、128 粒度、134 环、命中保留与窗口缺失回退。生产服务的外部缓存/负载均衡未完整公开；本文不把离线示例当线上命中链路实测 |
| 3 environ.py | 221 行全文 | 补充后支持默认 off/keep=0、推测步数 5、backtracking 的 max 约束；运行时拒绝不合格 keep 由来源 9/11 交叉核实 |
| 4 输入元数据 yoco.py | 182 行全文 | 支持 mask/compact 共用窗口可见域、原始位置和压缩元数据、CP 重排/贡献行/padding。静态代码与实验目标不等于已取得数值等价结果 |
| 5 模型 v4_modules/yoco.py | 123 行全文 | 支持 consumer 配置条件、边界 hidden/residual（含 lazy HC）选取、CP 汇集与候选处理；未把这些局部代码当完整 encoder 缓存命中实现 |
| 6 yoco/README | 41 行全文，承接实际脚本 | 补充后支持 L1/L2 启动前提、轨迹对齐的 logprob/top-K、MTP/confidence 局限；不证明近似截断满足所有任务质量 |
| 7 cache_engine.py | L88–119、L220–307；下载全文但不计全文已读 | 支持推理环 W+backtracking、按配置增加 prefill 锚点空间、持久化窗口与分配布局不同；不把总分配恒等于 134 |
| 8 README | 107 行全文、prefill/decode 两张性能图 | 支持 compact/140 为推荐启用方案、平台/构建要求、离线仓库范围。两图有固定硬件/并行/上下文/推测条件，不是 off 对 compact 的普适收益证明 |
| 9 prepare_tensor_input_v4.cpp | 引用 L202–359 全部核，周边 L130–201 与至 L364 亦读 | 新来源支持早期 chunk clamp 到至少一行、窗口外写槽为 −1、短输入恒等及 keep 的入口约束 |
| 10 yoco_equiv.py | L371–393；辅助 L38–51、L243–249 亦核 | 新来源支持当前仓库/同源扩展验证、单可见设备和锁页内存前提 |
| 11 yoco_equiv.py | L767–806 | 新来源支持有效回退、keep、CP>0 且 EP%CP==0、当前扩展和有效 prompt 数；未运行 L2 |

## 官方覆盖与阅读记账

沿固定仓库 README → examples/README → examples/yoco/README → shell/Python/C++/metadata/cache 实现展开，不只抽取本站已有引句。对固定 GitHub 目录树枚举了 YoCo 入口和 doc/images，实验说明没有遗漏另一份独立 YoCo 指南。实际通读 4 份 Markdown（根 README、examples README、YoCo README、生产 Q&A）、3 份 Python（环境、两份 YoCo）及 12 行 shell；另有 cache、等价脚本、C++ 三份按明确范围阅读。这里是本轮阅读记录，不能未经历史去重就计为新增官方全文。

examples README 的 124 行还核了 prefill/decode 测量口径、profile 本身的开销、sweep 条件与并行示例。FlashMLA、DeepGEMM、DeepEP、TileKernels、DeepSelect、量化和 recipe 等链接属于其他专题；本记录没有宣称这些链接及其全部后续文档都已读完。

实际看过 4 张固定 DeepInfer PNG：架构总图、wide EP decode、prefill、decode。图中的 EP/DP、131072 上下文、推测与接受率、chunk 范围均有条件，不能单凭图名推广吞吐结论。此外从论文原 HTML 获取并实际查看了 Fig.3 `arch_full.svg` 与 Fig.4 `arch_csa2.svg`，是本轮补看的 2 个 SVG 资产，不是新增两篇全文。早期只截到 Fig.4 caption 的临时 HTML 截图不作为看图证据；有效截图为 `paper-arch_full.png`、`paper-arch_csa2.png`。

版本核对到固定 rc2 模型/教程存在及当前模型页的承接。v0.23/v0.26/main 没有在本页做同等实现的完整证明，页面保留未验证的精确边界；本审查不把“有模型教程”扩充为“各版本均支持 DeepInfer 参数”。

生产文章文字已由用户提供，历史全文阅读记录有效，不能再次写成正文不可取得。本轮网页重试仍为 403；用户副本中的架构、线上统计、离线基准三张原图仍缺。固定仓库四张图和论文两张图可补充理解，不能未经同图核验就关闭这三项，尤其线上统计图没有补齐。尾项仍为 3，见阅读 JSON。

## 教学、图与保留性

首两屏能用自己的话复述为：长历史 KV 仍在，不代表每层近期 SWA 窗口也在；从末尾取回 token 输入并逐层重算，可恢复近似窗口，但边界早期行少读的信息会传到后续层。没有出现把近似当精确、把同位置当同数值、把布局等价当质量保证的问题。

按节核对：窗口 3 的可见范围 7/7–8/7–9 与公式 max(s,i−W+1) 一致；完整第一层 2、4、6，第二层位置 9 为 4，回放第二层为 6，均值示例不预测真实 attention 的误差。L=1000 的 866→768→640 算例一致，640–767 为 128 个回放位置，768–999 为 232 个新增位置；二者没有混账。128 是窗口/生产粒度，134 是特定回退组合，140 是推荐 keep；encoder/decoder、mask/compact/off、CP 边界和 GLM 不可照搬的条件都保留。

逐一实际看过状态图、均值传播图、模式比较图，画布宽为 820/850/850px，无超宽/裁切/重叠。状态图的 7/8/9 是历史位置，不是 token ID；模式图只演示 SWA 可见范围，没有暗示全局 KV 消失。两个 calc 和五张表也逐个看过。

`review-replay-integrity.py` 对 `recompute/before.zip` 的实际 diff 表明：原 8 个 sources 顺序和内容完全保留；3 个 YAML 与 3 个 SVG 字节完全不变。唯一替换的旧正文段是简略 L1/L2 入口，原命令、位置/槽位检查、同源扩展、固定轨迹对比和无设备结果边界都保留并展开；其余为新增回退、chunk、rc2 和来源说明。既有定义、两个算例、区间、版本边界、GLM/CP 条件、链接与 relations 未删减。哈希和 diff 在 `.tmp/continuation-groups-2026-11-10/review-replay-integrity.json` 与 `review-replay-preservation.diff`。

页面教学正文（扣除 frontmatter、代码围栏、末尾源码区，按项目中英混合口径）2701 字/词单位，正文行内代码 0，证据角标 0；2 个 calc，每千单位约 0.740；源码区全文角标 10，C 级 4（40%）。密度脚本的 `sourceSections`/`diagramFirst` 为 null，未拿空值冒充通过：人工确认“对照源码”最后，五个 H3 顺序正确，第一张直觉图先于数值表/公式，未把维护记录放回教学正文。

## 浏览器证据与限制

在 `http://127.0.0.1:5201/#/wiki/swa-bounded-replay` 实际打开页面，保存并查看首屏、第二屏、三图、两算式、五表、源码区。初次完整页面记录：`review-replay-browser/report.json` 的 figures=5（含两个 calc）、tables=5、overflow=false、errors=[]；不是只统计 DOM 数量。六个原有正文/relations 链接实际点击并确认模型、固定部署、KV、精度排查、前缀缓存等目标。

修订后再次查看回退、占位行、L1、L2、版本表截图；实际点击新增固定 GitHub 等价实验指南及模型版本锚点，目标标题/URL 正确，errors=[]，无可见溢出。最终证据为 `.tmp/continuation-groups-2026-11-10/review-replay-final-browser/`；脚本为同目录上级 `review-replay-final-browser.mjs`。初次完整截图对未变的图表继续有效；新增文字以最终截图为准。

本独立审查未运行 NPU/GPU L1/L2、模型质量集、生产缓存服务、吞吐实验，也未继承其他批次工程检查为本批成功。本批根审查者仍应把实际工程检查纳入统一验收。无需要用户另行决策的问题；全局三张原图缺失和全站尚未核完的其他组继续按各自账本推进。
