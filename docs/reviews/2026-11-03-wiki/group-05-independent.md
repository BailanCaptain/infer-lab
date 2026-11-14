# 第 05 组整改独立差异复审

2026-11-03；审查者 `/root/review_publication_fix`。以 `.tmp/wiki-remediation-2026-11-03/phase1-pages.zip` 为修改前基线，没有用 HEAD 覆盖用户改动。本报告针对该组 24 页中的 15 个实际变更页；逐页读完这些差异并检查有关上下文，未宣称重新逐条核实 24 页的全部旧事实。

## 发现

1. **P2，HCCL buffer 的实占条件没有贯穿全文。** `wiki/concepts/gap-a5164fe10fa9184412f8.md:105` 仍从“每一块缓冲”直接推出“组越多……KV 块越少”，与同页已改的逻辑组复用、配置算术不等于实占相冲突。应限定为初始快照之后、计量结束之前实际新增且仍存在的非 torch 通信资源；KV 影响按实际增量和块数核对。原始依据：固定 GLM worker 的先快照后建组顺序、非 torch 增量口径及同页复用键源码。已即时通知主代理。
2. **P2，Xlite 表中基础预算遗漏执行侧上限与 TP 补齐。** `wiki/concepts/graph-mode-layer.md` 新增预算说明照录官方指南的简写，但 `921ccc52:vllm_ascend/xlite/xlite.py:374–379` 实际将 decode 预算取 `min(max_num_batched_tokens, max_num_seqs*(1+num_speculative_tokens))`，然后两种模式均向上补齐至 TP 倍数；第 769 行保存到 `self.max_tokens`，第 840–853 行才用 DP 最大 token 数比较。例如 TP8、max_num_seqs=9、无草稿、max_num_batched_tokens=64，实际预算 16，12-token 批仍走 Xlite。应补实际公式和示例的上限/对齐前提。已即时通知主代理。
3. **P3，少量维护口吻残留。** graph-mode-layer 末段仍有“提示词完成条件……已对照”“本轮核实”；HCCL 页也有“本轮……另核”。有用的分支、风险及版本条件应保留，句子改为直接说明规则和证据位置。不能只删除限制。

## 已核实的修订范围

- 完整阅读固定 `921ccc52` 的 graph_mode 410 行、LoRA 131 行、RL 435 行、service_profiling_guide 389 行、msprobe_guide 452 行。一次输出截断后另行补读遗漏段落，不把下载当阅读。
- 对照上述指南检查 LoRA 注册名与请求 model、动态装卸、单槽条件；Sparse HCCL 与 Trace Replay 的配置、用途和部署边界；MSProbe 的配置、L0/L1/mix、graph/eager 限制和可视化命令；性能采集的入口、PD 分别控制、EPD 广播与产物；static/Super Kernel 的依赖、日志与性能采集的不同含义。
- 另核实际执行者：`vllm@0fc695fc:vllm/entrypoints/serve/profile/api_router.py:37–46` 确认未配置 profiler 时不注册路由；`921ccc52:vllm_ascend/worker/v1/model_runner.py:440–458` 确认 MSProbe 的 eager/graph 类选择；`921ccc52:vllm_ascend/distributed/weight_transfer/sparse_hccl_engine.py:55–80,107–129` 确认 ND/量化/PP/EPLB 限制及写入不回滚；`921ccc52:vllm_ascend/ascend_config.py:129–168` 与 `2ed6cbba:ascend_config.py:599–661` 确认 Super Kernel 的继承和依赖；Xlite 实际预算/比较见上条发现。
- 量化和投机解码已将“每步全部权重完整读取一次”改为实际用到的权重、复用条件与真实瓶颈，保留了原有动机。LoRA 不再由通信/量化矩阵推导特定 GLM 兼容。Netloader 保留 sources 缺字段、不合并配置、空 manifest 放行、可选缓存模式以及 view 调整失败等边界。Sleep 保留旧 v0 注释的条件性和构建版本范围。
- 新版说明与固定 GLM 基线分开；没有将新版 LoRA、Xlite、Sparse HCCL、Trace Replay 支持反推到旧 GLM 镜像。

## 修订后复核

两项 P2 已根据当前文件再次核对并关闭：HCCL 第105段改为初始快照至计量结束的实际非torch增量，明确排除重复计数；Xlite 第290–295行加入min、TP向上补齐及9→16的反例，第444行给出实际消费者链接。Xlite表中“无投机时后项为1”另提示主代理改为“括号内为1”，避免与整个乘积混淆。

未操作浏览器、未在NPU部署或测量，不构成视觉或设备验收。全量验证由主代理执行。

## 最终增量：四处维护措辞清理

已只读复核主任务对 `eplb.md` 末尾、`recompute-scheduler.md` 末尾、`vllm-kv-block-allocation.md` 末尾和 `graph-mode-layer.md:389` 的措辞清理；对照 `phase1-pages.zip` 的原段落，未发现新问题。

- EPLB 保留补齐后 token 数的分类依据、旧 V2 拒绝 dynamic_eplb、W4A8MXFP 拒绝与量化/fused MC2 组合表、未加载映射才自动布局，以及 Qwen3 两卡测试不能证明 GLM 双机效果的限制。重新读取 `db701c1f` 的 model_runner_v1 第 529–553、3706–3715 行，v2/model_runner 第 72–73 行，vllm_adaptor 第 129–146 行，eplb_utils 第 46–107 行，以及 two_card/test_qwen3_moe_eplb 第 35–77 行，支持这些直接陈述。
- 重算调度保留旧 GLM 分支没有正式结束请求、接口异常未捕获，与 v0.26/固定 main 的差异；仍要求在对应部署验证端到端恢复和耗时。重新读取 `db701c1f` 的重算分支和 STOP 帧、`2ed6cbba` 第 128–146 行的结束流程、`baa023ad` 第 85–166 行的异常处理和结束流程。
- KV 块分配保留 null block 排除、prefix caching 条件、固定 GLM 未开启 APC、规格允许释放的前提，以及 Mamba 限制不能推广到 Ascend KDA。重新读取 `0fc695fc` 的 block_pool 第 402–419 行、kv_cache_manager 第 368–446 行、single_type_kv_cache_manager 第 1054–1087 行，确认 touch 对空闲容量的影响、先还窗口外块后检查容量，以及本步 Mamba 缓存依赖以 `num_gpu_blocks + 1` 阻止调度的行为。
- 图档位段落仍明确上游 v0.26 rc 为 `568afb3a`、固定 main 为 `84030bbe`，输入默认、自动派生和平台结果仍分开；删除维护过程措辞没有把固定快照扩大成浮动分支保证。

此增量只复核指定段落，不代表重新审查四页全部事实；没有改正文、运行部署或新增性能结论。
