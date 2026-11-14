# DyntraLB 引文整改增量独立复核

复核者 review_publication_fix。已完整读取 dyntra-citation-scope.diff 的正文、三份 YAML 差异及随后两个图内标签的小改；实际读取当前三份 YAML。未发现本次增量仍需修正的 P1/P2。这里只验收本次差异，不代表独立重读本页全部 50 项来源。

实际原始范围：baa023ad 的 patch_dyntra_lb_core.py 123–322、401–470；dyntra_lb_scheduler.py 166–248、667–720、800–879，并读取 get_dyntra_lb_request_block_num 的实际 token 编号计数；ascend_config.py 1420–1464、1613–1685；.github/vllm-release-tag.commit 全文。另读上游 84030bbe 与 ced6857a 的 core.py 2264–2281 附近同步分支和默认间隔字段，以及 98dff2a8 的 core.py 2268–2281。

独立从固定 baa 源码 AST 提取并执行 _balance_load，无 NPU 依赖：原例交换 1 块与 64 块；失衡恰为 5 时仍交换 1 块与 11 块；总负载 249 块的组在 100 条总请求的例子里可暂停 200 块请求。三个断言均通过，支持删除“上千块才可能暂停”的伪门槛；吞吐平局优先刚补项与达到阈值的比较也实际逐行核实。

零远端命中仍可能成为候选、预取失败尝试占名额、后续 token／LoRA／异步输出准入、D 端未命中 token 的计算、256 个有效规划步，以及 Omni 警告过滤都由已读控制流支持。旧算例完整保留且补了假设。bubble 图内“读 131／4 块”已同步为估计块数，小增量实际复读关闭。

图只做源文本与生成文本核对，未作 UI、视觉、NPU 或性能验收。最终文件哈希记录于 dyntra-increment-independent.json。


## 条件陈述末次增量

完整复读 dyntra-conditional-prose.diff 三处和当前对应正文。249 块、100 条请求、暂停 200 块的反例与本审查者此前实际执行的固定 AST 复现一致；零远端命中仅不排除候选，其他检查保留；编号列表与物理分配区分保留。接受此增量，无新增 P1/P2。当前页 SHA256：db4c07d71107fcbc1bdb91cc45cc23ad9457cce1cb18e2ec2948b1eabe99fc20。
