# 额外休眠清理引文增量独立复核

审查者：`/root/review_first_pages`。2026-11-03。接受 `sleep-cleanup-citation-remediation.diff` 的三文件增量，未发现仍需处理的 P1/P2。

实际完整读取该 diff、当前教学正文 111–195 行和图 YAML 全文，并读取 SVG 文本差异。图的整体布局、尺寸和箭头保持，改动集中在条件、恢复内容及版本范围。此处仅验收语义和文本同步，没有进行浏览器视觉验收或 NPU 运行。

## 已核对的结论

- 唤醒先重新映射指定标签的空间，仅在存在 CPU 备份时拷回；旧 KV 内容不备份，不能写成“KV 搬回”。level 2 的权重需要外部更新；Worker 保存的 buffers 与持久分配是另有处理的对象。
- 图捕获要求启用 ACL 图，且 tags 为 None 或包含 kv_cache。weights-only 和空列表的内部调用不会捕图；管理器没有“一轮只调用一次”的守卫。线上 API 无 tags 会转为 None，不能用 HTTP 未传标签模拟内部空列表。
- 旧清理开关不替代 weight_nz_mode=0 和开发管理接口环境变量。main/rc2 的 rl_config 会补这些设置，不能把仅替换清理键称为旧版等价命令。
- 旧路径的清理顺序、整卡显存差日志、正常初始化条件，与 rc2 的 anchor / MoE 拆卸失败跳过策略分别说明，未把旧版无 try/except 推给 rc2。
- 历史 PR 的显存数字真实存在，单位 GB 与作者报告一致，但该 PR 还描述 rotary cache 清理且缺完整模型/硬件复现条件。正文保留固定部署仍未实测的边界。

## 实际原始证据范围

- `vllm-ascend@2c59ff10:device_allocator/camem.py:130–249`：单例构造断言、持久分配、备份、释放与恢复完整相关路径；与 `baa023ad` 的完整文件 diff 仅增加睡前同步，备份/恢复语义不变。
- `2c59ff10:worker/worker.py:206–299,672–698`；`2ed6cbba:worker/worker.py:247–260`：sleep 的 level 条件、NZ 入口检查、专用池和权重分配顺序。
- `baa023ad:worker/worker.py:235–300`；`ascend_config.py:261–292`：两个键共同守卫、buffer 备份/恢复、主模式关闭 NZ 和设置开发接口变量。
- `baa023ad:device_allocator/sleep_mem_optimized.py` **全文 1–186**：清理、整卡空闲显存差、图字段清空、tags 条件、HCCL 等待/销毁/重建/日志。
- `baa023ad:tests/ut/worker/test_worker_v1.py:595–638`：确实在主开关 False、子键 True 下核权重布局和 allocator 调用，未声称该测试覆盖全部清理组合或曾由本项目执行。
- `7d825229:ascend_config.py:365–395`；`device_allocator/sleep_mem_optimized.py:34–71,154–302`：rc2 anchor 实际 barrier 初始化、单 rank/异常跳过、MoE 准备、恢复后释放以及 staged wake 的条件。
- `vllm@0fc695fc:entrypoints/openai/api_server.py:184–208`，`entrypoints/serve/__init__.py` 全文与 `entrypoints/serve/dev/sleep/api_router.py` 全文：开发变量守卫到 sleep/wake 路由的完整连接。
- `baa023ad:docs/source/user_guide/feature_guide/rl.md:98–119`：原始同卡命令及额外清理取舍。此前独立核过的配置工厂/Omni 过滤路径复用于相邻说明，不声称新读完整 RL 指南。
- 官方 API 保存的 [PR #9585](https://github.com/vllm-project/vllm-ascend/pull/9585) 与 [PR #13838](https://github.com/vllm-project/vllm-ascend/pull/13838) 作者正文完整读取。前者含两组数字和 rotary cache，后者限定受验证的配置路径及保留的 balance bootstrap 例外；未重读所有讨论或所有 PR 文件。

范围只含本次精确增量和依赖上下文，不替代作者本页 52 项逐源核验。最终三文件 SHA-256 见配套 JSON。无需改变教学布局；视觉与运行限制仍保留。
