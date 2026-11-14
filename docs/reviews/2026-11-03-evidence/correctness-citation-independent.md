# 输出异常排查：独立增量复核

root 于 2026-11-03 实际读取 `correctness-citation-remediation.diff` 全文及作者 findings，并从固定 git 对象重读 7d825229 的 `batch_invariant.py` 166–189、批不变指南 25–41、`attention_v1.py` 913–992。

接受本次三项修订：混合 prefill/decode 拆分确实位于无 sinks、因果、无滑动窗口的末级分支，且同时要求 num_decodes 与 num_prefills 大于零；运行时变量与依赖检查不能证明所有算子均已切换；issue 作者报告改为 I 类个案而非官方功能保证。源码安装顺序与预编译 wheel 缺少 csrc 的说明一致。

本结论仅独立接受精确增量，未重复读取作者全部 26 条历史来源、未执行任何 NPU 异常或 Runtime Guard 场景。逐项全文阅读范围仍以作者账本为准，不能将本报告解释为设备验收。
