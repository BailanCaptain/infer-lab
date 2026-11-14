# DP 与 DeepInfer 引文整改的独立复核

日期：2026-11-03。审查者：root。只接受本次精确增量；不表示全站或硬件验收完成。

## data-parallel

完整阅读 `.tmp/wiki-remediation-2026-11-03/data-parallel-citation-scope.diff` 的七个文件，并复核修改后的相邻正文及 loop 图 YAML。固定源码实际阅读包括：db701c1f model_runner_v1.py 652–740、2898–3012、3332–3363、3408–3652、5383–5389；GLM KDA 1707–1758、MoE 1453–1508；utils.py 1257–1303；0fc695fc parallel.py 683–707、parallel_state.py 1833–1875、FusedMoE 1118–1200、core.py 1719–1945、gpu_model_runner.py 804–818；rc2 core.py 2263–2271、配置中默认值 16。

接受：请求归属与 EP 跨组专家计算分开；图宽补齐保留执行条件；dummy 并不等价完整真实请求；周期性共识下的额外空转有明确条件；进程角色数不再当作全部操作系统进程数。复核提出的相邻问题已修订：KV cache 不再统一解释成各层 K/V；跨组共同完成同一轮不声称同时进入或结束；自然空闲与运维暂停区分，后者忽略普通 wave 唤醒，须显式恢复并完成协调。最终正文 SHA-256：`1c362c5e6cd8e41d6c49f66edbbfa175d4818002ae8a345ef944eb4cb4aae445`。

## deepseek-serving-case

完整阅读 `.tmp/wiki-remediation-2026-11-03/deepseek-serving-citation-scope.diff`。复用本轮 root 在 capacity 页已全文阅读的固定 DeepInfer README、QA 和 examples README；这些资料支持 E/P/D、缓存分层、路由及公开系统边界。此次修改把事实依据明确落到可取得的固定官方 QA，知乎保留为延伸阅读，删除无法由本轮证据证明的“浏览器阅读全文并看图”过程声明，并避免把扩展钩子等同于完整生产控制系统。接受这两段增量；不把知乎来源记为全文已读。

本报告没有浏览器视觉验收、图像实际播放或 NPU 执行证据。
