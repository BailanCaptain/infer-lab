# RL 逐条核验与修订

root，2026-11-03。正文和两份图 YAML 全读；39 个原来源逐项核对，新增 12 个来源补实际调用链，共 51 项作者判断。raw 原件的 22 段均与已实际读过的固定源码范围精确相同，记录为去重核验，未冒称另逐字读过原件 1540 行。独立复核待完成。

本轮实际全文阅读官方增量：921ccc52 RL 指南、baa023ad 两份 HTTP 传输示例、指南所链 182ea044 稀疏示例、上游 NCCL 最新文章正文。全文计数不得与原官方阅读清单重复相加；文件与本轮证据在 `.tmp/wiki-evidence-2026-11-03/rl-*`。

修订的 P2：

- main 指南的 ipc 与真实注册名不符，命令改 npu_ipc。上游工厂原样查名，ipc 仍指上游引擎；旧分支的 patch 映射单独保留。
- main packed IPC 消费者仅返回解包并 clone 的列表；receive_weights 的装载调用在非 packed 分支，外层同步不补装载。rc2 将调用移到分支外。正文、版本条件和图同步限定，不能把 HTTP 成功等同更新成功。
- main HTTP IPC 示例手动 start 后调用自带 start/finish 的 trainer.send_weights，导致重复 start。补正确责任边界：工厂负责初始化，发送方法负责一轮更新，外层负责暂停与成功后的恢复。
- HCCL HTTP 示例的线程 join 不传播请求异常；保留并发握手与广播解释，补客户端必须把失败传回控制流程。
- FA3 的条件补无 PCP、RL 总开关与子开关，GLM 拒绝条件对应收窄；启用 PCP 绕过选择不等于得到 FA3 一致性。
- finish 的后端或 LoRA 清理失败会保留 active；update 异常清标没有回滚已写入权重。
- 补 tokens-only 与显式关闭端点冲突，普通服务端点选择；稀疏示例必须放得下完整 BF16 模型，少传元素不意味着完整训练模型可省。

证据：`python -X utf8 .tmp/wiki-evidence-2026-11-03/rl-extra-evidence.py` 实际退出 0，直接从固定源码 AST 提取方法，用 CPU 替身调用模型装载观察器：baa packed 装载 0 次、rc2 1 次；实际 Worker.start 与 Trainer.send 的组合在发送前报重复 start，send_reached=false。结果 `rl-cpu-evidence.json`。这仅复现 Python 控制流，不是 IPC、HTTP、通信或 NPU 验收。

保留原 RL 直觉循环、3 种暂停及代价、1+2=3 参与者算例、数据返回及 R3 形状、sleep 次序、GLM 未启用条件、旧版 NZ 错误、Sparse/Trace API 和模型限制。只修改 update 图标题、IPC 节点文字与证据 pin，布局不变；cycle 图未改。独立复核、浏览器视觉与真实 NPU 全循环仍未验收。
