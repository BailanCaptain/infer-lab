# 阅读路线 E021 独立增量复核

2026-11-03，审查者 `/root/review_groups_03_04`，写手 `/root/review_first_pages`。完整读取 10,842 字符三文件增量、相关当前正文、ascend-vs-upstream YAML 全文与 SVG 文字差异；最终复读 v0.26 rc 表头。接受本增量，不代表本人重新核完全页 37 项来源。

本次实际读取 2c config 354–365、84–89，2ed config 370–381、109–114；2c utils 736–818、2ed utils 707–780、baa utils 841–926；rc2 config 1793–1933 全工厂。db utils 905–931、db platform 668–700 与 main config 1613–1685 复用本审查人同轮原文阅读。明确键存在优先包括 false；标准 RMSNorm 映射后仍有硬件覆盖；kwargs 过滤不改原始 JSON；rc2 工厂在构造后继续派生校验并有缓存条件。这些均支持当前修订。

调度适配、默认字段不等于最终 SP 值、固定快照不推断祖先关系、版本与消费者区分均有证据，三条阅读路线和原算例保留。唯一相邻残留为版本表未写 rc，作者手修后复读关闭；正文 SHA256 为 `b289851f625dd68f67ac76b2bc6b28c10c1a4157049a3cbcd78b9d3e16a7b3dc`。没有未闭 P1/P2，没有 UI、图视觉或 NPU 验收。

同批额外完整复读 `lm-head-token-conditions.diff` 两段：保留 4 FLOP/B 的理想读取假设，将瓶颈判断落到设备与实测；聊天模板缺失条件、Transformers v4.44 边界与已有模板例外均保留。接受这两句条件化表达；这不扩大为两页全部来源重新独审。
