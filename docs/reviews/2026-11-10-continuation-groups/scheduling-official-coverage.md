# 调度与并发：官方覆盖反查

范围是 Scheduler 与并发两页的本轮审查，不是全部官方资料已经读完。固定文件与指纹保存在 `.tmp/continuation-groups-2026-11-10/scheduling/official/inventory.json`。本轮实际读完下列五份文本，首次阅读身份交全站总账按固定版本/路径去重；不能将五份直接报作五份新增。

| 固定官方材料 | 实际阅读 | 与本站的对照 |
|---|---|---|
| vLLM0fc `docs/configuration/optimization.md` | 全文462行 | 请求并发、分块和抢占的取舍由两页保留；官方“先decode再prefill”的简述不覆盖running内尚未完成prefill，本站保留更精确源码解释。还指出DP入口与多模态CPU内存问题，相关深页承接 |
| vLLM0fc `docs/serving/data_parallel_deployment.md` | 全文133行；两张官方图实际查看 | 区分内部共享HTTP入口与外部各rank入口，不能把API进程数当DP副本数；本组场景使用固定单API内部路由，四版评分另比 |
| Ascend7d `docs/source/user_guide/feature_guide/batch_job_aware_scheduler.md` | 全文150行 | 本站已有独立batch-job页，Scheduler缺回链已报修；不把变体列为可同时叠加生效 |
| Ascend7d `docs/source/developer_guide/Design_Documents/balance_schedule_refactor.md` | 全文562行 | 设计稿带历史v0.24语境与阶段计划，不等于rc2现状；独立核7d实际配置、gather门和关闭回退消费者 |
| vLLM0fc `docs/configuration/conserving_memory.md` | 全文185行 | 从optimization真实链接展开。maxlen/maxseq/图捕获内存取舍与本站相符；MM尺寸hint只用于profile、不约束实际输入的细节由入口/MM专题承接 |

两张DP图是该固定提交的 `docs/assets/deployment/dp_internal_lb.png`、`dp_external_lb.png`，提取并观看的文件在同一official目录。五份文本中其余相邻链接，例如optimization_levels、CPU安装、expert_parallel_deployment、offline示例、架构、attention backends、量化和模型示例，没有因母页读完而自动计入本轮全文；可能已被其他组阅读，应从全站账查身份。本组仅在需要支持当前主张时沿调用方继续读固定源码，不用链接数量冒充事实覆盖。

本轮通过反查发现的整项教学缺口为DP prefill节奏、四版本完成同步与runner补齐/草拟条件、batch-job连接。它们以实际配置生产者、EngineCore传递和Scheduler/runner消费者交叉核验，详见72项补证候选及106项旧账。底层NPU算子的完整执行、吞吐/时延收益与故障超时无实机验证。
