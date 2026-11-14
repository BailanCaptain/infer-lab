# 输出异常排查逐项引文核验

本轮完整读取当前正文，26 项来源分别记入 `correctness-citations-batch.json`。四段基础源码完整范围、两份 raw 内 4／10 段的逐字匹配、固定 MSProbe 指南全文 452 行、Runtime Guard 两指南全文 129／161 行、相关实际运行消费者均已核读。官方在线聊天模板和批不变正文已读；GitHub #64048 作者正文及三条可见评论已读。没有 UI、NPU、异常触发或转储执行验收。

确认一处 P2：rc2 版本段把混合批 FIA 分开计算泛化到了整个路径。实际 `7d825229:attention/attention_v1.py` 913–992 先分出 sinks、非因果和滑窗分支，最后常规分支才按批不变开关拆分。正文已保留这些条件，来源 21 扩为完整外层分支。另明确匹配源码可在主包安装后补装，纠正 issue 个案使用 S 标记的过高表述；作者报告仍保留环境、方法和自身部署证据边界。

Runtime Guard 进一步实际核读 rank_gate 25–49／137–165、采样 hooks 137–186／253–281／319–346、finite 153–220／295–340、processor_report 58–143、processor_dump 210–342、runtime_config 的 bootstrap/defaults 全文和 config 675–718／880–945。支持原文最后 PP 阶段、TP0 报告与全 TP 转储范围、手动水位和失败仍可能消耗次数、异步有限性分类时点的限定。MSProbe 实际检查 V1/V2 runner 的 debugger 构造入口，未把指南存在当作设备运行通过。

两图完整 YAML 中的编号与分数都是显式教学假设；第一处输入差异与 argmax 翻转一致。正文直接外链映射至来源 5／6，记录在 supplemental 账本；内部链接用于导航。图未修改，没有视觉验收。

精确增量见 `correctness-citation-remediation.diff`（本轮修改前快照，非 HEAD）。P2 修订等待主任务独立复核，26 项判定不表示独立审查者重复读完全部旧来源。
