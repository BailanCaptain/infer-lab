# 第 06 组三处维护过程措辞收尾

日期：2026-11-03。范围仅为下列三段，未扩展为其他内容重写。编辑前保存 `.tmp/wiki-remediation-2026-11-03/group06-final-tail-before.zip`，编辑后逐项阅读实际 diff；差异恰为三页各一段。修改前后哈希保存在同名 JSON 报告。

| 页面与位置 | 改动 | 保留的事实或限制 |
|---|---|---|
| `wiki/sources/answer-fbdf834736fd6584fd523555c449c21fa1c755b9e992cf949c98cd86e147a1ad.md:99` | 删除核查过程和归档行号，直接引用 `[C6]` | 固定 `0fc695fc` 中，引用计数归零且不是空哨兵块才回到空闲队列；其他持有者仍持有时不能重新分配 |
| `wiki/sources/glm-5-3-flash-baseline.md:156` | 将“本轮已核”改为固定源码的直接行为及 `[C25]` 引用 | `enable_sp()` 初始化或刷新时的共享专家 DP 覆写条件；目标部署实际传入值仍未核定，因此 SP 关闭只作默认分支的条件性基线，不是运行观测 |
| `wiki/params/enable-sleep-mode-extra-cleanup.md:129` | 将“先后顺序本轮未核”改为具体证据缺口 | main 平台注入与 RL 配置移除相对于 `CaMemAllocator` 首次构造的启动顺序，以及最终环境值尚无核定证据；不推断 main 必然触发或避开断言，保留旧版源码推断未经实跑的限制 |

本次重新读取的原始依据：`vllm@0fc695fc:vllm/v1/core/block_pool.py#L419-L441`；`vllm-ascend@db701c1f:vllm_ascend/utils.py#L905-L931`；`vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L261-L292` 与 `platform.py#L1318-L1354`。只确认对应条件和局部行为，没有把局部源码阅读说成启动顺序已核实。三处改动不涉及图、前端或执行代码，未进行浏览器或 NPU 验证。独立验收交由 `review_first_pages`。
