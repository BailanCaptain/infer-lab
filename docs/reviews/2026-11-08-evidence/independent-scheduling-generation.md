# 四页原文独立审查

状态：进行中；本文件是本轮实际阅读检查点，不是验收通过结论。审查者使用当前模型独立核验，未委派。

## 范围与基线

仅审查 sampling、structured-output、prefill、request-teardown；仅写本报告及同名 JSON。当前来源数分别为 180、93、50、76，共 399；附件中的 739 不作为这四页的分母。旧账本未修改。

四页当前文件与 `.tmp/wiki-evidence-resume-2026-11-08/baseline/wiki/concepts` 对应文件逐字节相等；已实际运行逐文件比较，三个已执行的 `git diff --no-index`（structured-output、prefill、request-teardown）均无输出。不存在可归因于本轮写手的新正文 diff。

| 页面 | 当前 SHA-256 | 正文阅读 |
|---|---|---|
| sampling | cbeb11b77bb0e114f7c69b6a0fef836a5c4d2f78f07ce69d9860d4a00f62a048 | 1–1161 全文 |
| structured-output | 22f81405c5edac783f63aa2bccff41d49193584b11721b97857d57fa1af700e4 | 1–660 全文 |
| prefill | 261b1c691958df3ec41a51bf5dc76db7f479669cafc9bbf93d1c6f7b75794e6c | 1–489 全文 |
| request-teardown | 43322aeccd03b7e417483dff09864cd4b77ee39c13c0687fb7ba46493636360f | 1–526 全文 |

已读 AGENTS.md、写作标准、HANDBOOK 证据/版本协议及本轮 plan。摘取包仅用来阅读源码；遇到省略而指向尚未读的其他页片段，定点 git show 补读，不把相等标记本身当语义支持。

## 已确认问题

### SG-01 · P2 · 异步草稿过滤不等于省掉主模型前向

- 位置：`wiki/concepts/structured-output.md:319`，连同 233、337 的异步说明。
- 原句：主模型因此不会白白验证注定被拒的草稿。
- 影响：读者会把非法候选的接受屏蔽误计为主模型前向计算量减少；固定部署讲解采用异步路径，恰好不能作此推导。
- 固定原文：`vllm@0fc695fc:vllm/v1/engine/core.py#L505-L596` 先在 514–516 派发 execute_model，再在 577–595 取草稿、更新过滤、填 mask 和采样；`vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1759-L1795` 按原计划长度补 −1，并没有缩短该次已派发前向的 scheduled token 数。
- 精确修订建议：将该句改为“同步路径在下一轮排程前可截短非法草稿；异步路径的本步前向已派发，过滤后按原长度补 −1，使非法草稿不能被接受，但不因此省掉已派发的主模型前向。”保留 MTP 接受率尚无实测的限制。

### SG-02 · P2 · 完整请求的模型名与固定教程不一致

- 位置：`wiki/concepts/structured-output.md:376,388`。
- 影响：照着固定教程启动后直接发送完整示例，会请求未注册的 glm-flash；本页其他说明明确以固定部署为前提。
- 固定原文：`vllm-ascend@0576b6471c7a35707920a665352391d33c77451c:docs/source/tutorials/models/GLM5.3-Flash.md`，§5.2 两端命令均为 `--served-model-name glm`，已联网阅读原文。
- 精确修订建议：376 行改为“固定教程对外名称是 glm；若自行改过，以 /v1/models 返回值为准”，388 行改为 `"model": "glm"`。

## 关键核对记录

- request-teardown：前端检测字符串命中可把返回原因改成 STOP（output_processor.py 639–644）；若 EngineCore 尚未结束则加入 abort 名单（678–681）。EngineCore.abort_requests 把请求交给 FINISHED_ABORTED（core.py 378–384）。因此客户端 stop 与引擎 FINISHED_ABORTED 可同时成立。当前正文已描述两阶段，但应明确点出状态名差别，便于排错。
- min_tokens：基线 detokenizer 在输出数 ≤ min_tokens 时推进搜索起点，只有 > min_tokens 才搜索新文本；因此 min=2、E/N/D 三枚示意在 D 到达时可截出空文本，不与最少输出编号数矛盾。
- request-teardown：main 的最少长度保护确实移至 EOS/手工编号/长度判停之后；v0.23 在它们之前。正常判停与 connector 延迟释放不能混为无条件立即回池。
- prefill：请求语义阶段与 attention state 不是同一个判定。单位置提示词尾块可能进入 DecodeOnly/SpecDecoding，投机图模式另查提示词是否全部计算完成。
- structured-output：请求辅助字段确实未进入 type/spec 编译键；服务 disable_* 与请求同名字段不能互换。guidance 只给缺失 additionalProperties 的对象补 false；main 新增 stop_token_ids 编译参数。

## 已实际复算

六词分数 [3,2,1,0,−1,−2]：T=1 概率为 [0.6336913,0.2331220,0.0857608,0.0315496,0.0116065,0.0042698]；T=0.5 与 T=2 的六项逐项重算与表中舍入一致。top-k=3 后为 [0.66524096,0.24472847,0.09003057]；再取 p=0.8 后为 [0.73105858,0.26894142]。正文用先舍入指数再求和的 31.71 是近似过程，不是精确指数和。

bitmask：2¹+2⁴+2⁶=82；154880/32=4840；4840×4=19360 B；32×4×19360=2478080 B=2.36328125 MiB。

logits：128×154880×2=39649280 B；FP32=79298560 B；两方向合计 113.4375 MiB；3 个验证行 FP32=1.7724609375 MiB。

prefill：2048−12=2036；6000−2036−2036=1928；6000×2/64=187.5≈188；ceil(199/4)=50；ln(0.233)=−1.4567168254。

## 归档比较

本轮重新运行原文分段比较（仅剥离片段外缘空白，保留内部代码）：request-teardown raw 45/45、prefill raw 25/25、structured-output raw 39/39 与固定 git show 原文相等，三个文件 SHA-256 均与文件名一致。归档不独立增加语义证据；实际支持仍由读过的原文分支判断。

## 限制与剩余工作

尚未完成 sampling 全部来源阅读及四页逐来源 JSON 落账；structured-output 部分外链仍须读原文。未做 NPU 推理、浏览器视觉验收或全站构建。当前不声称四页审查完成，也不声称上述问题已修订；用户授权只允许报告。
