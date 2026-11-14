# CPU 绑核引文整改独立复核

审查者：`/root/review_first_pages`。只读教学文件；实际完整读 `.tmp/wiki-remediation-2026-11-03/cpu-binding-citation-scope.diff`，并读当前正文 100–145、196–294 行上下文。结论：本次差异可接受，未发现需要阻断的 P1/P2；不将这次增量复核称作全页逐条事实核验。

- 显式 false：实际读 `db701c1f:platform.py` 1206–1222，`setdefault` 保留已有值；提示日志不等于最终开关为真，修正成立。
- A5 独立分支：实际读 `db701c1f:cpu_binding.py` 14–33、299–806；四社区版分别读 `2c59ff10` 538–548、`2ed6cbba` 539–549、`baa023ad` 与 `7d825229` 535–545。A5 在普通分段前返回，8×线程数的组大小与 UVB、无 IRQ/独立 ACL/release 的说明成立。硬件能力另读 `baa023ad:hardware_profile.py` 256–334、`7d825229` 338–361。
- 部分生效：固定镜像线程依次设置、迁页和 IRQ 在后，无回滚；实际读 `db701c1f:worker.py` 760–773 的异常捕获，支持服务启动不保证所有步骤成功。
- rc2 迁页：实际读 `7d825229:cpu_binding.py` 700–802、`worker.py` 940–954；`migrate_memory=false` 仅跳过迁页，线程与适用 IRQ 流程保留，修正成立。
- 全局分段：固定镜像 444–518 的公式依赖相同允许 CPU 列表与设备总数，不能只凭不同全局编号保证任意 cpuset 不重叠。
- 默认值：实际读 `baa023ad:ascend_config.py` 452–463，字段默认为 true。
- 进程账：核对本站统一部署账的角色表及 `engine-processes` 的角色统计边界；20 是 1 前端 + 1 协调器 + 2 EngineCore + 16 Worker 的示意账，不含启动父进程与运行时辅助进程。此次不是操作系统进程实测。
- 官方来源：`vllm-ascend@921ccc52:docs/source/user_guide/feature_guide/cpu_binding.md` 全部 1–149 行实际阅读；与正文产品条件、依赖、PID 可见性、异常日志说明一致。

两份图 YAML 的本次文字差异已经读完，A2 限定与部分失败条件和正文一致；没有进行 SVG 视觉、浏览器或设备验收。源文件哈希与当前教学文件哈希记录在同名 JSON。
