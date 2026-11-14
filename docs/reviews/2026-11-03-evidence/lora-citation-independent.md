# LoRA 本次增量独立复核

root，2026-11-03。完整读取本轮 `lora-citation-remediation.diff`、作者 findings 与修订段落，并独立核对下列实际来源。接受本次语义修订；这不是独立重读全部 48 项旧引文的声明。

- 论文 v2 §4.1（本地全文文本 115–143）：合并、撤回旧更新再切换任务，与同一混批共用一份基座的限制区分正确；未将浮点相消理解为逐位还原保证。
- db `punica_npu.py` 21–322、324–451 与上游 mixin 52–68：旧普通线性路径按 SGMV 分派，不代表 MoE / logits 的直接 BGMV 入口失效。310P 或最大秩至少 128 的函数绑定、FP32 shrink buffer 与 slot/expert 索引关系均对上。
- 921 `lora_ops.py` 136–453、460–501：Triton 可用、capture、BF16、连续布局、打包、支持秩、128-token 上限及宽输出额外 32/64 门槛是联合条件。split-K=4 与 expand 合并的文字和实现一致；不把指南简述当成充分条件。
- 上游 `model_manager.py` 273–308、750–779，`worker_manager.py` 258–307，scheduler 589–602，base_linear 99–145 与 config 31–46：正常调度延后新适配器，与 worker / slot 层报错区分；按配置最大秩和槽数预分配不能等同实际已加载秩。
- 上游图 dispatcher 115–134、287–328：字段存在不等于每个数量都捕获。独立复核发现原增量遗漏回退前提，作者已补“允许 NONE 才回退，否则断言报错”，并复读当前第 166 行关闭。
- v0.26/main forward_context 487–496 / 396–405：EP 组大小为 1 先走 AllGather，之后才判断 LoRA + EP 的 All-to-All。db runner 1306–1322、3788–3798 及 binding 2733–2747 补上实际调用与注册，避免只查配置定义。

图未修改。本次没有浏览器、NPU、模型或适配器兼容性实测；接受范围是所列差异与原始证据。最终页面 SHA256：`3cae2c05b734a7c70474f23e5d2a98d064e4b0660327f960f02a1d874ac3c8b1`。
