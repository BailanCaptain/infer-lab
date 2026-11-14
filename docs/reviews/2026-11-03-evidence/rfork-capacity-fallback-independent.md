# RFork 容量与回退图增量独立复核

审查者 `/root/review_first_pages`。实际读 `rfork-capacity-followup-remediation.diff` 的两页全部差异，以及 `rfork-fallback-diagrams-remediation.diff` 的 YAML/SVG 文字差异；SVG 重复的 title/aria 与 YAML caption 另做一致性核对。只验本次差异及相关上下文，不计为 RFork 全页逐引文核完。

**结论：容量增量通过；图中的清理门槛 P2 已修后关闭。** 原泛称“清理失败则报错”会把租约归还失败也算入阻断，修后明确服务停止和登记内存清理成功才回退，仅租约尚未归还可后台重试。两份 YAML 与 SVG 当前文字一致。总览原约 305 GiB 磁盘读取下界的残留，也已复读修后第 236 行，明确为语言张量遍历估算，通过该句增量复核；不代表接受总览其他在途差异。

实际原文阅读范围（`rfork/source` 工作版，身份来自 `rfork/manifest.json` 与 VERSION-NOTE 的 3284850b）：

- `rfork_loader.py` 129–150、441–465：主/草稿使用不同会话属性，各有自己的身份和 RForkSession；521–710 核加载、申请、传输、清理及默认加载的顺序。
- `session.py` 21–150、251–317：每会话持有自己的租约，传输先登记再清单与读取；归还异步，prepare_for_fallback 分别返回停服务/归还/注销结果。
- `types.py` 38–49：`can_schedule_seed = service_stopped and memory_reset`，不包含 `lease_released`；loader 667–671 的阻断严格按此条件。
- `examples/rfork/rfork_planner.py` 31–61、165–286、288–292、321–343：默认 60 秒；借/还和清扫时回收过期租约，只回收名额，不直接中断读取。
- `transfer_backend.py` 33–35、121–152：1 GiB 字节上限、512 段上限，先拆超大张量再组批。20,572 MiB 至少 21 批；844 MiB 子账本身不能证明完整草稿只有一批。
- 另读本站 `rfork.md` 原 230–260 与修后 234–238，复用此前独立核过的 3121/9e55 量化差异与统一部署子账。20.09/60≈0.335 GiB/s 只是主模型子账的必要门槛，主草合计 20.91 GiB 不能当作一份主租约的字节。

未运行 RFork、NPU 或浏览器，也未做图视觉验收。没有把清理单项状态、队列提交或日志出现等同于全部动作完成。
