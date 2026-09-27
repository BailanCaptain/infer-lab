# matmul-and-weights · P5 写作记录

## 范围与改写（2026-09-28）

本轮深改 `wiki/concepts/matmul-and-weights.md`，重绘首屏 `matmul-shapes`，修订 `matmul-weights-share` 的 decode 条件，新增 `matmul-forward`，各 YAML/SVG 成对保存。未修改其他页面、src、scripts、tests、计划或共享索引，未提交 Git。

改前先读共同要求、wiki-writing-standard、队列范围/数字口径/本页行/第 02 批验收/拍板结果，以及 TP、EP、one-request 样板。现有工作区有大量未提交修改，本轮以 scratchpad 中的 before.md 为改前基线，没有还原其他改动。

Why：旧页把教学矩阵、未分片 BF16 对照和实际部署的口径放在一起，缺少 A4 挂靠、主机/设备边界、调用流程及版本对照。新结构先解释行乘列，随后讲计算/访存/通信成本，再跟随 R1 经过 MLP，最后集中容量账、特殊层、误解和源码。

What：首屏明确矩阵、token、NPU、设备内存、CPU 与平台接口；三图分别表达逐列填满输出行、跨轮次共用权重、A3→A4 的稠密/MoE 分支→A5。区分主机 RAM、设备驻留、逻辑容量和实际读取字节；普通单行 decode 明确为关闭投机的对照，固定部署的 MTP decode 链回 R1。

## 数字与单一出处

- 02 §2.3：4096 隐藏宽度、四路残差、R1 [4,4096] 与 [4,4,4096]、128 KiB；只引用结论，推导回链 R 的“词嵌入与四路残差”。
- 02 §3.3：每卡 gate/up 3072 列、门控后 1536 列、down 部分和 [4,4096]，一次归约 32,768 B；回链 R 的稠密 MLP。权重主体 12/6/18/54 MiB 只引结论，推导回链 T。
- 本页保留原有独占推导：未分片 up 有 50,331,648 个参数、R1 四行 201,326,592 次乘法，近似 402,653,184 次乘加操作；BF16 容量 100,663,296 B = 96 MiB。整数算术规模与实际浮点指令数分开说明。
- M 页负责结构与参数口径：稠密宽度 12288，专家宽度 2048，288 个可路由专家中每 token 选 8 个，另有共享专家；保留整批专家并集大于 8、总参数不能简单乘 8/288 的边界。
- 未加入场景 M 的整批账或复算 D/R/C 已有账单。

## 核心概念的一手核对

已实际读取本机 Git 对象，而非仅核行号存在：

- `vllm@0fc695fc:vllm/model_executor/layers/linear.py` 407–454、1389–1444、1537–1558：数学方向的列切/行切、部分和与 All-Reduce。
- `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py` 1403–1539、2106–2160、2212–2239：gate/up→激活→down、无偏置、共享/路由专家、mHC 输入与子层前后顺序。
- 同提交 `ops/linear.py` 272–371：后端转发及偏置条件错误；`ops/activation.py` 34–58：限幅先于 SiLU 和乘法。
- 同提交 `quantization/methods/w8a8_dynamic.py` 48–153：逐 token 动态量化、INT8 权重、scale、加载后转置、量化乘法与输出类型。
- 三版 Ascend `2c59ff10` 48–126、`2ed6cbba` 47–125、`baa023ad` 新路径 `methods/w8a8/w8a8_dynamic.py` 59–129：方法存在、INT8 默认、量化/乘法顺序一致；main 移动路径并去掉旧的大维度拆块分支。只核这些方法，不宣称完整 GLM 三版兼容，因此 verified 留空。
- PyTorch 2.14 Linear 官方文档已联网阅读，核 X 乘存储权重转置与偏置含义。Hugging Face 固定配置链接本轮 web 工具未能打开，模型形状对照本仓库已核基线与底稿，不声称该外链本轮访问成功。

## 独立审查与修订

按写作标准交新独立审查者 `/root/review_matmul`，只读正文、改前副本、底稿、钉住源码和实际 SVG。

- P1：流程图初稿将 clamp 放在 SiLU×up 之后。按源码改成先限制 gate 上界为 10、up 范围 −10 到 10，再做 SiLU(gate)×up；补直接来源与图 pin。独立复审确认关闭。
- P2：首图初稿箭头从暗色第二行底部出发，已改为高亮首行右缘；重新生成 SVG 并独立看图确认关闭。
- P2：down、gate/up、W8A8 在定义前出现，改为降维投影、两路升维、8 位整数乘法；数学节偏置句也不再提前使用投影名称。
- P2：verified 的编排说明迁到本记录，正文只留运行兼容边界。
- 独立信息保留核对：旧页参数/配置、输入随层改变、形状/转置、四项数量、普通 decode、BF16 对照、访存复用、MoE 总/激活参数边界均保留。初学者能复述行×列及乘加、搬数和归约等待的成本。
- 写手浏览器发现 PowerShell 写出的 UTF-8 BOM 使前端将 frontmatter 显示为正文，已仅将本轮三个手写文件保存为无 BOM UTF-8，并重开页面核实元数据不再进入正文。

## 底稿矛盾（仅报告）

`docs/mainline/02-forward.md:213`（§3.1）写“silu(gate)*up 并夹到 ±10”，与实际 `ops/activation.py:46–58` 及上游 `activation.py:155–183` 的先夹 gate/up 再乘法不一致。P1 本页已按直接源码纠正；按共同要求没有修改底稿。02 §2.3、§3.3 本页引用的数字未发现算错。

## 验证与范围

四项共同检查均实际运行，日志在下述证据目录：

- `pnpm wiki:lint`：本轮最后一次仅 hardware-devices 的两条华为 URL 不在白名单，汇总为 1 处失败；本页没有错误或提醒。较早轮次曾有其他并行页的 schema、双向 relation 和缺图问题，未越界修订。
- `pnpm check:content`：通过，registry 131 页；尚无章节，Term 检查跳过。
- `pnpm wiki:diagrams --check`：通过，163 张图与 spec 一致；本页三图单独 figureProblems 均为空。
- `pnpm wiki:audit`：通过，131 页/1621 条来源，本地行号有效 1523、URL 未联网验证 98，commit/文件/行号/仓库错误均为 0；raw 摘录待核 1362。它不证明外链或结论语义。
- 对本页直接调用 checkStandard（没有修改强制名单）：全部规则通过；教学正文 3305 字，源码角标 0、行内代码 0，calc 2（每千字 0.605），每节至多一个、无表/calc 相邻；免责词句 2/103=1.94%。首图前无 calc 或部署数量；A4 为站点编号。图宽 820/900/860，均不超 900。全文证据角标 12，C 级 9（75%）。
- 所有 Markdown 跨页锚点按项目 headingSlug 核对通过。限定本轮文件 `git diff --check` 通过。
- 字数口径：汉字数＋拉丁单词数，排除围栏及链接目标；改前全文 1325 字，改后教学正文 3305 字、含源码区全文 4806 字。原始 body 字符长度为 2344→8965，不能与前述字数混用。

共享 wiki:build 会写 `wiki/index.md` 与 `src/content/wiki/registry.json`，按本批共享派生物由协调者串行集成、写手不改 src 的范围没有执行；页面用实时 reader snapshot 验证。不改应用代码，未运行完整应用测试/类型构建；本轮验证对象为文档、来源、图和实际阅读。

证据目录：`C:/Users/-/AppData/Local/Temp/claude/C--Users---Desktop-infra-view-new/13898c74-f916-4e2c-8924-fe9bf130f160/scratchpad/p5/matmul-and-weights/`。

Tradeoff：保留完整机制和旧页事实，新增源码/平台与主机边界，因此篇幅增加；无 NPU 实测，量化文件逐层 dtype、实际 kernel/融合、访存、耗时、主机峰值及 mHC 数值等价性仍明确待核。Open Questions：用户无需选择；底稿限幅顺序及其他页 lint 交协调者处理。