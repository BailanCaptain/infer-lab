# ViT encoder graph：独立缺口调查

审阅人 `/root/groups_recompute_review`。本记录是作者补文前的调查与证据交接，不是教学页面的最终验收；没有修改 `wiki/concepts/acl-graph.md`。初始快照为 `.tmp/continuation-groups-2026-11-10/vit-graph/review-before.zip`。已完整阅读当前 ACL Graph 正文及官方母文的四个固定版本，沿入口、模型协议、预算、打包、NPU 捕获和回放追到消费者。

## 已确认的问题

**P2：官方已有独立视觉图机制，本站缺少解释和连接。** 当前页所有图档位都围绕语言模型一步的 token 宽度，不能解释官方 `cudagraph_mm_encoder` 与三个 encoder 预算字段，也不能回答图片数量相同、分辨率不同为什么会选不同图。应补“视觉塔先把图像变成一串表示，再交给语言模型”的站点关系、输出 token 预算、按项装箱与选档、固定地址/复制/恢复原顺序以及额外捕获和缓冲成本。四版都存在这些字段，但模型和 runner 的实际入口须分别说明。

**P1：旧正文首两屏未明确成本。** 首图前讲清了减少 Host 提交的收益，启动捕获、固定缓冲占用与补齐执行代价在后文。按写作标准应在首图前补一句具体成本，保留后文解释。最终必须实际查看首两屏，不用文档检查代替视觉。

以下均是新增解释必须保留的条件，不是已发生的设备故障报告。

## 可以支撑的机制与算例

独立 encoder manager 按模型给出的输出 token 预算录制图；这不是服务端生成 token 数、图片张数或像素数。自动预算从模型最小值逐次翻倍并追加最大值，不能概括为所有档位都是绝对的 2 次幂。批量物品上限、图预算和视频帧元数据容量是三个约束；配置校验与模型准备缓冲、执行装箱分别负责不同部分。

可用示意：图档位 128、256、512，每批最多两项，原输入 A/B/C 分别输出 192/96/160 个 token。执行端先按输出量排序为 B/C/A，把 B+C=256 放入 256 档，再让 A=192 使用 256 档；输出拆分后恢复 A/B/C 的原顺序。选择清单和 padding 不改变图像的原顺序语义。单项超过最大图预算时走 eager；这一条不能扩成“任意元数据超容量都自动退回”。

视频一项能带多帧：Qwen3-VL 的 `prepare_encoder_metadata` 为每帧累加 attention 序列终点，帧预算控制 `cu_seqlens` 等缓冲容量。已读 `_execute_local` 的打包只检查各路径 token 和物品个数；元数据函数只在实际序列数小于目标时补齐，超过时没有截断。因此不应承诺把帧预算设小后自动拆批或回退，显式 0 也不是禁视频接口。禁视频入口是多模态输入限制中的 video=0。

`mm_encoder_tp_mode=data` 把视觉项分到同一 TP 组内各 rank，随后收集、去补齐并恢复顺序；它不是另开服务 DP 实例，也不能用于计算新的模型副本数。

## 入口和版本边界

| 范围 | 已读源码支持的结论 |
|---|---|
| 四版上游配置 | 开关默认 false、预算列表空、物品上限 0、帧容量 None。四版 V1 `capture_model` 都先在总图模式 NONE 时返回，之后才创建 encoder manager；独立预算和对象不等于能绕过该入口。 |
| 四版上游模型协议 | 开关、MM 输入能力与运行时协议检查均需成立。Qwen3-VL 的多模态裁剪开启时 modalities 为空，图片和视频都会退出这条图路径，不是只关闭视频。 |
| v0.23 Ascend 与固定 GLM | NPU V1 在捕获上下文把上游 manager 替换为 `EncoderAclGraphManager`。固定 GLM 的实际注册 wrapper 继承旧 GLM4V；已读该子类完整 638–706 和父类完整 1589–1929，均未实现必要 encoder graph 方法，故固定 GLM 不能仅靠此开关获得视觉图。 |
| v0.26 | 上游增加双路径，GLM4V 实现协议；Ascend 固定注册表没有 GLM5Next，不能把上游 GLM4V 的支持迁为固定 GLM 部署验证。NPU 图参数仍按 token_budget 建账，文件中有多路径改键 TODO，不能把接口接受 path 当成完整 NPU 多路径验收。 |
| rc2 / main | 上游通用多路径和 capture axes；NPU 捕获与回放明确拒绝非空 axis_keys。GLM5Next 有自己的多模态注册与协议适配，删除视觉塔不产生的 pos_embeds；这只是静态接线，不是全套 NPU 捕获/精度/性能实测。 |

NPU 专用 V1 捕获记录 FIA 任务句柄与 ExternalEvent；回放的 Python 调用先 `replay()` 再更新参数，捕获图里的事件等待使 FIA 消费者等到更新流设置参数并记录事件。不能按 Python 调用先后误写成“先用旧长度计算、之后才更新”。manager 返回复用输出，上游后处理的 clone 才保证后续回放不覆盖已分出的结果。

Ascend 五个固定比较点都把 `mm_encoder_attn_backend` 重置 None。官方 GPU 文档的 FLASH_ATTN/FLASHINFER 指令和 GPU 支持表不应直接写成 NPU 配置指南；310P 注册另一个实现，当前 FIA 链不认证全部设备。

## V2 已追到哪里

上游 rc2 V2 `ModelState` 在非 enforce_eager、开关与协议满足时创建 encoder manager；V2 的捕获分别判断 encoder 和 decoder，因此不同于 V1 的 NONE 门禁。Ascend 的实际 state 工厂替换与默认 state 的父类调用也已读到：默认链最终使用上游模块导入的 `EncoderCudaGraphManager`；全局 CUDA wrapper 把图对象换为 NPU UpdatableGraph，decoder 图工厂另行替换。没有在这条链中发现 V1 专用 encoder FIA manager 注入，统一 unsupported 列表也没有一个 encoder graph 的硬拒项。

因此本轮只能写“上游 V2 入口不同；NPU V2 没有按 V1 专用链完成设备验收”。不能编造“V2 一律不支持”，也不能说“用了 UpdatableGraph 就等价支持”。模型自有 state、混合模型和 310P 还有各自分支，待实际 NPU 跟踪与模型测试后才能扩大结论。

## 证据与阅读账

初批证据为 [57 项候选](vit-graph-evidence-candidates.json)，补充 [35 项候选](vit-graph-evidence-supplement.json)；每项含完整固定 ref、文件/范围 SHA 和本地带行号摘录。补充项 58–64 支撑帧容量；65–69 支撑平台后端重置；70–82 与 92 支撑 GLM 注册/继承/协议边界；83–91 仅为 V2 调查 readscope。候选数量不等于最终新增引用，也不等于完整文件数。

[官方阅读账](vit-graph-official-reading.json)记录母文 0fc 229 行、v26 289 行、rc2/main 315 行，四个版本三份独特全文；PR 35963、38061、43586 的描述正文完整读取，分别 101、144、89 行，只记 PR 描述，不记整条讨论。PR 旧字段名不能替代当前源码字段；GPU benchmark 也不能迁为本站 NPU 收益。PR 正文缓存已改为 API 原始字节，消除 Windows 换行重复造成的错误行数；原 SHA 与修正理由留账。

官方母文从 CUDA graphs 目录反查，先展开三个关联 PR，随后继续完整读取前置 PR 41234/42288 的描述正文（29/84 行），以及 DeepSeek-OCR v1 论文 22 页。全文、全部 13 图与 4 表均实际看过，证据见 [承接账](vit-graph-ocr-followthrough.json)。22 页只计一篇论文，不计 22 篇；PR 描述只计描述，不计完整讨论。继续读完 ViT tracker 38175（90 行）和 Ascend V2 roadmap 5208（43 行）的 issue 描述：38175 的 `/pull` 地址会重定向，已更正分类；两个 tracker 的子链接单列待读并交父账去重，不将未勾选清单当成固定版本功能不支持的证据。

论文的 SAM、压缩模块、CLIP 是串行组件；实现的 global/local 图路径是全图与局部裁块两种输入，两边都调用这些组件。论文 Base 模式的 256 个视觉位置不能替代实现预算：已读 v26 DeepSeek-OCR 消费者，全图图输出为 16×17=272（含每行换行）；局部每块 100 个位置在后处理中才组装换行，最后另加视图分隔。论文 PP/DP 设置属于训练；OCR 压缩与评估结果不证明本项目 NPU 图加速，论文也保留进一步验证长上下文的限制。

## 最终验收尚未发生

作者修改后仍需检查：保留旧 36 来源、13.5/10 格例子和 GLM 七档捕获宽度；保留已有图和真实待核边界；逐条核新增引用与四版表；实际查看首两屏、机制算例、图及表，并点击跨页链接。当前 `verified: []` 不能仅因视觉图增量就改成整页四版全验收。工程检查需要使用这次新正文稳定后的回执，不复用 IndexCache/DBO 的已闭检查。
