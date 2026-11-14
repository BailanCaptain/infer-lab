# Attention backend 增量独立复核

root，2026-11-03。完整读取精确 diff 与 findings，接受本次修改。SHA256：`a9263f43583989731c0fe723ea362eca52905451f0ce0529e29a587e0ca8b745`。本报告不是 root 独立重读全部 62 项来源或全部论文的声明。

实际读取新增来源 46–62 的全部范围，旧来源 4、5、17、18、20、21、25、26、41、43 的全部范围，并核对 main 上游 84030bbe 的同一 get_attn_backend 调用段。main 的 MLAAttention 与 rc2 的 AscendMLAAttention 构造、注册、上游选择、模型工厂返回 indexer nn.Module 的职责区分均成立。rc2 的 PCP/DCP 拒绝发生在 indexer 构造中，不被通用后端支持覆盖。

FA3 核验覆盖旧版显式选择与批不变的先后判断、main/rc2 未开 PCP 与 RL 双开关、类型与包入口校验；decode 固定 causal=false 不被外推为多查询投机正确性。KDA 单份形状与 MambaSpec 分配公式、投机状态消费者的区分成立。

完整读取 PyTorch 稀疏参考函数 857–1063、分块常量与单测调用。另实际运行固定提交的 git grep，生产树只见该方法定义，测试树见两个调用与一处说明引用；没有发现生产直接调用。此静态检索不等于设备 tiling 或流量测量。缓存注册范围扩展也已核对。

原图未改；没有 NPU、浏览器或性能实测。论文阅读范围沿用作者明确记录，不扩成 root 二次全文阅读。
