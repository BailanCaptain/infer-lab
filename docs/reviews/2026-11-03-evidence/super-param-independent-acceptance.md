# Super Kernel 增量独立复核

完整阅读 `super-param-remediation.diff`，并核对当前页面的新增 sources、正文与邻接元数据。实际独立读取：baa023ad ascend_config.py 113–160、platform.py 1188–1229、compiler_interface.py 122–135/245–255、acl_graph.py 66–111/185–252、utils.py 1054–1064、hardware_profile.py 287–308；2ed6cbba ascend_config.py 599–661、platform.py 545–605、compiler_interface.py 244–255；f2f74a16 ascend_config.py 590–647、3b318862 同文件59–90；rc2 7d825229 同文件123–170。另读 baa graph_mode.md 171–195/261–278 与 Pydantic v2.12.5 官方文档 Booleans 全节（GitHub 渲染行178–214）。

这些证据支持本次修订：scope 包住实际 runnable，名称不能证明整网融合为一个 kernel；hash 变化不能推出删除其他缓存或每次完整重编；固定 v0.26 维护快照与最初发布标签不同；图模式分支、硬件降级、静态内核依赖共同决定有效配置。GLM 更换版本仍需完整兼容性核验，当前文已保留此边界。读过 root 的旧构造器 AST 复现输出，未把该输出冒称本 agent 独立执行；main 字符串转换根据类型化字段与官方 bool 规则判定，没有在本机执行 Pydantic 或 NPU。

未发现差异新增 P1/P2。frontmatter 对 acl-graph 的 relation note 已由 root 改为 wrapper 的 runnable，P3 关闭。来源36最终改为 baa023ad tests/ut/test_ascend_config.py 937–956；本 agent 实际全文读了该范围，952–956直接覆盖同一配置类的 lax bool 与未知键拒绝测试。该测试用 enable_npugraph_ex，不能冒称直接测试 enable_super_kernel；后者的结论仍结合已读 bool 字段、validator 和 Pydantic 官方规则。官方原文保留为审核补充，未声称在本机执行这些 UT。此记录仅验收增量，不代替 root 对全页36项来源的独立账本，也不表示浏览器视觉或硬件部署验收。
