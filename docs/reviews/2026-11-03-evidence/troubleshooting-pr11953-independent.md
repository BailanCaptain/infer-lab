# 排错与 PR 11953 增量独立复核

审查者：review_publication_fix。读取两份实际差异 `troubleshooting-citation-remediation.diff`、`pr-11953-citation-remediation.diff`，未修改教学页。接受本轮增量，未发现新的 P1/P2；这不替代 root 的全部59项来源逐项审查。

排错页：实际读取 rc2 `ascend_config.py` 549–565、1844–1912，过滤名单确含工厂消费的用户选项，Omni 由 `find_spec` 可发现且存在未知顶层键才走告警/剔除；读取 platform1641–1648、固定 GLM 教程26–33、indexer_kpool432–455。通用 PCP 要 MRV2、该 GLM 教程要求 MRV1、KPool拒绝 PCP/DCP 与 SFA query 分片不是同一路径。删除维护者 verified 过程句保留了现场版本/负载边界。

PR 页：读取归档全文334行、GitHub PR作者正文与合并日期，未把机器人建议或作者风险判断当实测；实际读取旧 RFork110–112/234–246、新 RFork225–249及完整 RFork父子差异，确认检查的是值的真值，删除后该选择段只剩动态 EPLB。读取 db 平台338–346及 baa release_notes1–60；独立执行 `merge-base --is-ancestor`、包目录grep与 `tag --contains --sort=version:refname`：2c/db不包含删除且各38处匹配，2ed/baa/7d及v0.24.0rc1含删除且各0处；当前本地已知标签最早v0.24.0rc1。独立读提交元数据确认单父2b115d02、2026-07-15合并；已核标签范围表述保留，未推广未来分支。计算掩盖搬运被改为有条件收益，正确保留原教学意义。

没有运行模型、NPU、UI或部署；没有逐个审查PR所有51文件的完整差异，也没有新抓取完整网页讨论线程。全部来源计数仍由 root 账本记录，独立验收不重复计入。
