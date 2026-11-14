# EPLB 引文整改增量独立复核

root，2026-11-03。完整读取 333 行精确差异、当前图规格与对应证据，接受本次增量；不把本次复核记作独立重读全部 76 项来源。页面 SHA256：`a0b3567eb96d7f36cc8b0664fb65516cb7ee9421da21475cabbed91be0426238`。

实际读固定 db701c1f 的 updater 79–153、adaptor 60–146、worker 71–100 / 303–335、Random policy 1–26、配置 816–875、热度收集 513–539、通信结果 131–171、AllGather dispatch 351–461、prepare 436–499、forward context 80–254 与 MC2 dispatch 101–252。采集关闭时的 598/599 边界、冗余副本平均分摊假设、接收缓冲区键与形状约束、AllGather padding 与 MC2 mask 条件均与正文一致。

独立阅读并实际执行 `.tmp/wiki-remediation-2026-11-03/check-eplb-counter.py`，退出码 0：598 且不采集时不推进；599 且不采集时仍 gather/planner 并到 600；598 且采集时到 599。另算出示例日志估值 1.0，而实际 rank 峰均比为 1.2。该验证使用固定函数的 AST 原样提取和桩副作用，仅为 CPU 控制流/公式验证，不是 NPU 服务实测。结果为同目录 `eplb-counter-runtime.json`。

MTP 注册链实际读 model runner 3679–3788、GLM MoE 1490–1520、fused MoE 注册 306–310、MTP 39–179、decoder 2105–2157、proposer 291–374、上游 draft config 1157–1200。正常单模型、PP=1 的限定保留，不能外推成任意生命周期的固定层数。另读 baa023ad placement 46–95、rc2 patch 867–874、v0.23/v0.26 的 v2 runner 拒绝 dynamic EPLB 分支，确认版本边界。

图仅修改解释文字，数值与布局未变；已读取规格与差异，但未在浏览器视觉验收。异步提交不被解释为保证重叠或性能提升，设计文档中的示例函数也不作为现有实现缺失的证明。
