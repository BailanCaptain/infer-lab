# 固定 GLM 图元数据待核项收尾独审

审查者 `/root/groups_recompute_review`；作者 root。只核 `acl-graph.md` 的这次增量，新增 8 个引文出现项，不重计此前 118 项，不计整篇阅读。已实际读 33 个固定范围，包含生产者、实际注册和消费者；[证据候选](graph-metadata-evidence-candidates.json)区分 8 项新增建议、11 项既有复用和 14 项调用链补读。

内容、视觉和本组工程验收通过；详见[验收状态](graph-metadata-acceptance.json)。没有 NPU 执行、精度或性能实测。

发现并关闭两个 P2：第一，ACL 仍说“不知道元数据由谁更新”，而图模式页已有持久缓冲解释；第二，第一次作者正文已经引用来源 119–126，frontmatter 实际仍止于 118。后一问题由 `verified: []` 导致追加脚本精确匹配未命中。作者按真实格式补写后，本审查者逐项读回全部 8 个引用及顺序；没有把脚本声称 added 当成成功。

实际链条支持新正文：Runner 先构建本轮元数据，再设置 forward context 并执行模型。主 SFA 引用公共块表、查询累计终点和长度切片；GLM 子类沿父实现进入实际 `npu_sparse_flash_attention`。压缩索引器单独预分配并原地刷新 slot、长度、块表，真实压缩与索引操作读取这些数据。KDA 使用 v0.23 注册到 `kimi_kda.py` 的实现，GDN 将持久状态索引/查询起点/接受数包装给短卷积和递推算子；没有拿 `glm5_next.py` 中旧参考线性注意力类冒充生产路径。8 项逐条结论与 SHA 在[人工账](graph-metadata-manual-judgments.json)。

正文改为短结论并回链唯一解释，页末将待核收窄到 NPU 实际依赖、eager 数值对照及七档资源/性能数据。原通用侧流路径不执行这一事实、普通 paged attention 的事件解释、旧 ViT 四版边界与全部图/算例均保留。6 个图源/产物文件与此前快照字节相同，`graph-mode-layer.md` 未被本组修改；见[保留清单](graph-metadata-preservation.json)。

实际运行 `node .tmp/continuation-groups-2026-11-10/review-graph-metadata-browser.mjs` 成功。新 GLM 段、源码索引及三个目标页面均实际看过截图；“图模式的数据准备”“图模式”源码区、“算子页”源码区三次点击均落到相应标题。浏览前后页面哈希稳定、0 pageerror、0 横溢出。截图与结果在 `.tmp/continuation-groups-2026-11-10/graph-metadata/review-browser/`，前后正文及 diff、最终快照也在该组目录。

本轮为静态问题收尾，不能把静态写入和调用顺序解释扩成设备正确性认证。后续性能目录审查另立记录，不因本组闭合而宣布全部官方资料完成。

工程证据：实际逐一读过 lifecycle-current 的五份日志并校验 SHA；content/lint/audit/diagrams/build 全部退出 0，页面前后 SHA d1529ff…dc49 稳定。全站机械统计为 164 页、7679 来源、7205 固定范围、474 URL 未联网、3937 raw 待核；104/104 标准、344 图、10 处非阻断 lint 提示。机械通过不代替本文人工语义审查。
