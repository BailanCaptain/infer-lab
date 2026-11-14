# ViT 编码器图增量独立审查

审查者：`/root/groups_recompute_review`。对象是 `acl-graph.md` 的视觉编码器图增量；作者由 root 担任。按 `docs/wiki-writing-standard.md` 阅读完整正文、固定原文、调用方、差量和实际渲染后验收。未修改教学页。

本组内容、视觉和工程验收通过。82 个新增引文出现项逐项见 [人工判断](vit-graph-manual-judgments.json)，旧 36 个引用未重计；旧正文没有删改行，summary 扩展、aliases 增补与新节插入另列。详见 [保留清单](vit-graph-preservation.json)、[冻结清单](vit-graph-manifest.json) 和 [验收状态](vit-graph-acceptance.json)。这不是全站完成结论，也不是 82 份官方全文。

## 初学者复述与机制复核

只读前两屏，可以复述为：ACL Graph 记录一步里的设备任务次序和读写地址，之后一次提交整串任务，省去 Host 逐个下发形成的空隙；它不让原来算的数学工作消失。代价是逐档捕获、常驻图和固定缓冲，以及形状补齐带来的额外计算。旧 6 任务例子仍是 13.5 格降到 10 格，设备工作都为 9 格，数字明确是示意。

新增视觉节先说明编码器把媒体变为特征，再区分“本次还算但减少下发”与“缓存命中复用旧结果”。容量按输出位置计，A/B/C 的 192/96/160 在每批两项约束下，排序 B/C/A、分成 256 和 192，均回放 256 档：容量 512、有效 448、余量 64。图、算式、正文及固定分批源码一致；恢复原顺序和输出复制解释完整。余量未冒充时延损失。

帧元数据容量与 token 装箱分开；小帧缓冲没有被说成自动裁剪或 eager 保障。视觉 data 模式在 TP ranks 内分媒体项，未增加服务 DP 数。NPU 的 replay 调用先于参数更新，通过捕获时的 ExternalEvent 等待与更新后的 record 解释设备实际顺序；310P 另一实现和 V2 未完成设备验证均保留边界。

## 已关闭的问题

1. **P1：首图前没有把机制代价讲全。** 作者已补逐档捕获、常驻缓冲和补齐成本。实际 1440×1100 浏览器首两屏确认其出现在首张图前，且没有挤掉原有 Host 瓶颈解释。
2. **P2：rc2/main 的 NPU 多路径表容易使人误以为预算单键限制已修复。** 实际三版 `EncoderGraphParams` 都仍使用 int budget 为键，并保留 `(path, token_budget)` 分账 TODO。作者新增来源 116–118，表和来源索引现在同时写明预算记账限制与非空 capture axes 拒绝；已独立读这三个固定范围复验。

原来四个固定上游的默认值、校验、V1 NONE 早返和 Qwen3-VL 裁剪已逐项核；五个 Ascend 快照核实际替换上下文及平台后端重置。固定 GLM 注册→完整旧子类→完整旧父类→运行时协议判断已接通，不能只添开关便认为原部署支持视觉图。新版 GLM4V 与 Ascend GLM5Next 的协议适配明确分开，不借上游类支持证明旧镜像或 NPU 实测。

## 保留与浏览器证据

初始快照为 `.tmp/continuation-groups-2026-11-10/vit-graph/review-before.zip`，最终快照为同目录 `review-final.zip`。旧两图的 YAML/SVG 四文件原字节不变；原时间算例、固定缓冲、图外操作、七档 GLM、降级条件、错误表、旧版本比较、链接和真实待核均保留。新增一张容量图和一个算式，未重做其他会话的 3D。

实际执行 `node .tmp/continuation-groups-2026-11-10/review-vit-browser.mjs`：页面与七文件哈希在浏览前后稳定，5 个 figure、5 张 table，0 pageerror，0 页面横溢出。逐张看过三张机制图、两块算式与全部五表；表均在 1076 像素内容区内完整展示。实际点击“编码结果缓存”和“部署分组”，两处目标标题均出现在视口 y≈108。截图与结果在 `vit-graph/review-browser/`。第一次脚本因目标标题漏写中文问号而失败，修正脚本后重跑通过；这是检查脚本选择器问题，没有伪称产品链接损坏或抹去失败。

## 官方阅读与技术承接

阅读账单独在 [官方阅读记录](vit-graph-official-reading.json) 和 [OCR 承接记录](vit-graph-ocr-followthrough.json)：四个固定版本的设计文档中 rc2/main 原文相同，不能算四份不同文本；源码只对标记的完整文件或范围宣称实际阅读。另读五个相关 PR 正文、两份 issue/RFC 正文及 DeepSeek-OCR v1 全文 22 页、13 图、4 表。PR 正文不等于所有讨论/patch 已读，论文参考文献也不等于所有下游论文已读。

OCR 中 SAM→压缩→CLIP 是串行部件；实现中的 global/local 是全图与局部切片路径，两者不混淆。论文基础模式 256 个视觉 token 与实现加入换行后的 272 个输出位置已分清。训练 PP/DP 和 A100 性能没有挪作本站推理资源或 NPU 收益。关联 tracker 的未展开链接仍在阅读账中明确保留，按本站相关性继续处理，不把母文阅读冒充所有子链闭合。

## 工程与限制

引用本组 [统一工程记录](coverage-transfer-media-scoring-vit-verification.json)，其冻结 `acl-graph.md` SHA 为 `1b999e41e3305ee2270de567a24c4a7f1e87ee86c90ace0e3071d3918bc5462d`，与独审实际页面相同。已读取并核验五份 `coverage-closed-*` 日志：`check:content`、`wiki:lint`、`wiki:audit`、`wiki:diagrams --check`、`build` 均退出 0。164 页、7535 来源、344 图，写作名单 104/104；10 条非阻塞 lint 提醒保留。机械审计仍不验证全部 URL、raw 文本和语义，本组语义结论来自独立逐项审查。

未做 NPU 硬件执行或性能实验；`verified: []` 保持不变。原 GLM 稀疏 MLA/KDA 元数据更新尾项没有借本次视觉图审查删掉，将继续沿实际构建器/消费者补查。该后续项不改变本组新增视觉解释的支持范围。
