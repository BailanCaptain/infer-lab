# Attention backend 逐项核验与整改

62 项当前 sources 均逐项登记于 attention-citations-batch.json，未把存在性扫描算作语义证明。正文全文、唯一 YAML 全文已读；原始45项与新增17项分别给阅读范围。没有浏览器/NPU/实际部署验收。

本次 P2：

- 旧部署直接返回后端的路径原被泛化到 main/rc2。已限定旧 db701c1f；main 包装注册后构造上游 MLAAttention，rc2 构造其 Ascend 子类，分别补上注册、构造、上游 get_attn_backend 消费者。
- rc2 Glm5NextKPoolIndexerBackend 是模型侧 nn.Module 索引执行器，不是 attention 后端。补模型工厂与 IndexerWrapper 消费者，区分索引、实际 attention 与缓存管理三项职责。
- main FA3 条件漏 RL 总开关；旧错误说明漏 batch-invariant 先返回的顺序。四个固定快照的实际校验均已读，补齐条件并保留包/入口检查。
- 固定形状递推状态原被写成每请求只分配一份，并据此保证长上下文部署。改为单份状态大小固定，缓存模式与投机验证增加状态份数；补分配公式和投机消费者，保留层数与原 FLOP 账。

其他精度收尾：MTP 类型落点仅限固定配置；普通单查询 decode 的 causal=false 解释不能扩为多查询投机支持；PyTorch reference 完整函数、常量和实际 UT 调用已读，生产重写分派另外追踪。两份旧版本表来源扩展至真实 FA3 校验；缓存源扩展至重复注册检查。官方 db FA3 全156行阅读发现首段与136行对是否开源矛盾，来源34标部分支持，不用于判断包可用性。

保留检查：45主层/34KDA/11MLA+1MTP、2051位置、33.6/370 MFLOP静态上界、两个cache-only条目、分组键、PCP拒绝、layout/dtype和外部包边界、原图均保留。未改算法数值或图布局。两论文正文/附录/全部表/图注与完整算法已读；FA3另读SASS列表，参考文献条目和图像不算已读。详见attention-papers-read.json。

待独立复核：root。精确diff为attention-citation-remediation.diff；本轮快照在.tmp/doc-gap-2026-11-03/evidence-attention-before。
