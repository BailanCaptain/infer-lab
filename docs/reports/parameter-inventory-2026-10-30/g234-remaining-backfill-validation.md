# GLM 必补范围收尾：加载、输入与基础日志

2026-11-01：G2 的 3 项、G3 的 9 项、G4 的 9 项共 **21/21 项补齐**，合入现有五页。结合此前 G1 的 9 项，当前 GLM 双机筛选范围为 **30/30 项完成，必补剩余 0 项**；两个配方消费待核变量已在 G1 核清。可选候选不自动转为待办。

历史统计为 A/B 100 + C 结构化输出 20 + G1 原项 3 + 本轮 21 = **144 个原台账单元**，另有 G1 的 **6 个配方外部变量**单列。不能说成完成 150 个原台账单元，也不能据此宣称全参数百科无遗漏。历史分类台账保留原判定，完成状态见 [本轮覆盖层](g234-remaining-validation.json)与 [G1 覆盖层](g1-communication-validation.json)。

## 版本与落页

主线仍是 GLM-5.3-Flash 双机 A2、TP8/DP2/EP16、W8A8、mp，node0 一个 API 进程、node1 headless。控制流固定 `0fc695fc`，执行侧固定 `db701c1f`；对照 vLLM `568afb3a` / `84030bbe` 与 Ascend `2c59ff10` / `2ed6cbba` / `baa023ad`。分配器另外核对配套 torch_npu 2.10.0.post2 的 `8751b36d`，不拿浮动 main 代替安装版本。

| 批次 | 原项与参数 | 唯一主说明页 |
| --- | --- | --- |
| G2 | W0161 `PYTORCH_NPU_ALLOC_CONF` | [设备内存](../../../wiki/concepts/device-memory.md) |
| G2 | W1679 `safetensors_load_strategy`；W1702 `trust_remote_code` | [Worker 启动](../../../wiki/concepts/npu-worker-lifecycle.md) |
| G3 | W1603 `limit_mm_per_prompt`；W0466 `add_generation_prompt`；W0467 `add_special_tokens`；W0474 `continue_final_message`；W0473 `chat_template_kwargs`；W0546 `truncate_prompt_tokens`；W0547 `truncation_side` | [Token](../../../wiki/concepts/token.md) |
| G3 | W0493 `messages`；W0503 `prompt` | [API 入口](../../../wiki/concepts/api-server-entry.md) |
| G4 | W0278 `VLLM_LOGGING_LEVEL`；W0202 `VLLM_CONFIGURE_LOGGING`；W0277 `VLLM_LOGGING_CONFIG_PATH`；W1547 `disable_log_stats`；W0283 `VLLM_LOG_STATS_INTERVAL`；W1507 `aggregate_engine_logging` | [性能分析](../../../wiki/concepts/inference-performance-analysis.md) |
| G4 | W1564 `enable_log_requests`；W1444 `max_log_len`；W1461 `uvicorn_log_level` | [API 入口](../../../wiki/concepts/api-server-entry.md) |

每项补默认、入口、有效阶段、示例、限制及固定版本差异；已有教学、模板、输出预算和加载机制通过引用复用。重要边界包括：依赖默认与平台注入不同；显式 lazy 与未指定策略不同；模板直接返回编号时没有第二次文本编码；截断方向、预算与缺分词器路径不同；关闭统计与隐藏 INFO 日志不同。

## 独立审查与修订

两位独立审查者分别核查加载/输入和日志/来源白名单，阅读固定源码及实际前后差量。发现 **5 项 P2、3 项 P3**，均已修正并复审关闭；无未解决的 P1/P2。

- 输入审查修正新增来源行号、补齐模板产出编号后跳过文本编码的消费者、限定 main 分配器清理为 `rl_config.enabled=true`，并把批次式表头改为实际参数名称。
- 日志审查去掉没有相应说明的错误输出日志跨页引用，补本页开关边界和 main Uvicorn 定义来源，修正更新日期与 DP 执行组措辞。
- 独立提取三版真实 RequestLogger 与统计间隔 getter，执行 **33/33** 断言；这是消费者分支验证，不是 NPU 服务测试。

完整记录：[加载与输入审查](../../../tools/wiki-runtime/g234-remaining-20261101/input-review.md)、[日志与白名单审查](../../../tools/wiki-runtime/g234-remaining-20261101/logging-review.md)、[独立执行断言](../../../tools/wiki-runtime/g234-remaining-20261101/logging-review-extracted-checks.json)。

## 检索、呈现与保留验证

- `pnpm wiki:build`：167 页成功；`pnpm check:content`：167 页、11 个主题完整且无重复。
- `pnpm wiki:lint`：通过，另有 8 条既有非阻塞提示，未将其计为本轮已修复问题。
- CLI 逐项检索 **21/21** 命中预期主说明页且排名第一；实际浏览器目录检索 **21/21** 命中预期页。`prompt` 是通用词，UI 有 4 个结果，没有把它冒充唯一命中。
- 实际浏览器打开五页，检查新增参考说明、首屏教学及表格；操作性能页→API、API→Token、Token→内存的既有链接，并从参数搜索进入 Worker 页。Token 与 Worker 的 14 张表未见自身横向溢出，截图观察新增参数与版本表无裁切。
- 五页“对照源码”之前的教学正文逐字保留，原 sources 顺序与内容保持前缀不变，Worker 机器历史尾注不变；相关 **24/24 个图文件**哈希未变。详见 [保留检查](../../../tools/wiki-runtime/g234-remaining-20261101/preservation-final.json)。
- `pnpm wiki:diagrams --check`：331 张图与 spec 一致；原有图中文字提示仍存在，本轮没有重绘图。
- `pnpm wiki:audit`：标准名单 **104/104** 通过；167 页、5134 条来源中行号有效 4841，越界/缺文件/无效 commit/未知仓库均 0。293 个 URL 未联网验证、1769 个 raw 引用待核，不把该命令通过当成全库来源语义已验收。
- `pnpm exec vitest run scripts/wiki/sources.test.ts`：**41/41** 通过；`pnpm exec biome check scripts/wiki/sources.ts` 通过。来源代码仅增加固定 torch_npu 的三个精确文件白名单，并同步 HANDBOOK，不扩大域名授权。

CLI 证据：[cli-search.json](../../../tools/wiki-runtime/g234-remaining-20261101/cli-search.json)；UI 实际结果记录：[ui-search.json](../../../tools/wiki-runtime/g234-remaining-20261101/ui-search.json)。命令与审计日志集中于 [验证目录](../../../tools/wiki-runtime/g234-remaining-20261101)。浏览器使用本轮专用的本地 Vite 开发服务；未把旧 dist 当成本轮构建产物。

## 限制与未决事项

`pnpm build` 未通过：本轮未修改的 `src/app/wiki/wiki-parallel-mechanism-renderer.ts:1815` 存在未使用变量 `x`，触发 TS6133。该 3D 文件不属于文档补写范围，未为让检查变绿而改动其他任务的内容；日志见 [build.log](../../../tools/wiki-runtime/g234-remaining-20261101/build.log)。因此本次结论是必补文档、独立审查与检索收尾，**不是全项目生产构建通过**。

没有登录双机运行服务、实测分配器或 GLM tokenizer；原有未核边界保留，不将源码核读替代现场结果。没有需要用户决定的范围问题。若以后启用新的部署分支，再从可选候选取差量，不把 597 个候选直接当成欠缺参数数。
