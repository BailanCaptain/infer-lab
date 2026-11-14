# 第 05 组：性能、量化、图、投机与可靠性

审查日期：2026-11-03。审查者：主协作代理。24 页均完整阅读当前正文、配置区、版本区与来源区；逐页内容哈希另见 `group-05.json`。完整阅读不表示逐条重验全部引文。此组的第二轮修改仍须独立审查。

## 已确认问题与整改要求

| 编号 | 级别 | 页面与定位（整改前） | 影响、证据和修法 |
| --- | --- | --- | --- |
| G05-01 | P2 | acl-graph 238–246；attention-backend-family 151、246、293；npugraph-ex 216、353–355 | 正文仍混入“依据草稿转述、未独立核验、raw 第几行”的维护叙事，部分与同页已核版本表冲突。实际读取 db701c1f ACL wrapper 138–170、2c59ff10 wrapper 28–106、db701c1f platform 207–241、上游 0fc695fc compilation 1437–1518、db701c1f GLM `_is_kda_layer` 216–227 及完整 flash_attention 指南，均能直接支持相应受限结论；保留未取得的设备数据与后端元数据路径限制，删除审计过程。 |
| G05-02 | P2 | npugraph-ex 216 与版本表；graph-mode-layer 280–282 | SuperKernel 只剩未核依赖，Xlite 只列开关，缺配置、执行预算和验证方法。全文扩读 921ccc52 graph_mode 与 npugraph_ex 设计；核 2ed6cbba config 599–661、baa023ad 103–160、7d825229 114–171。补齐 super→static→npugraph_ex、配置默认的版本差异、profiling 验证；Xlite 区分 decode-only/full、DP 最大 token 数、越界回退及受支持架构，保留旧 GLM 未启用结论。 |
| G05-03 | P2 | HCCL buffer：为什么提前留、配置折算、常见误解、开销 | 开头说分配时机未测，后文却断言建组即分配且服务期间不释放；650 M 配置之和又容易被当成实际 KV 损失。配置及建组源码只能证明字段与路径，不证明物理分配时点；收发方向、复用、单成员组还会影响实占。改为配置折算参考和实际非 torch 增量，保留 650/600/82 的算术但移除实测口吻。 |
| G05-04 | P2 | LoRA：GLM 适用说明与“怎么开” | “本部署正落在支持矩阵这一格”把 W8A8/通信条件当成 GLM 模型兼容证明；缺少注册名字与请求 model 的对应。921ccc52 LoRA 指南全文提供注册、静态选择、动态装卸与 fast path 条件。补最小注册和请求例，显式区分 base_model_name 与 adapter name，保留旧版最大秩字段和新版支持范围差异。 |
| G05-05 | P2 | inference-performance-analysis / walkthrough；inference-correctness-troubleshooting | 排障方法已有完整因果解释，但读者缺实际采集入口。全文阅读 921ccc52 service_profiling_guide 与 msprobe_guide：补 profiler-config、start/stop、PD 直连与 EPD 代理差别、产物定位；补 MSProbe eager/graph 字段限制、配置入口和首个分歧对照，版本限定为新快照。 |
| G05-06 | P2 | vllm-ascend-for-rl | 旧版生命周期解释有效，但现行官方增加 Sparse HCCL、Trace Replay，页面完全没有入口。921ccc52 RL 全文与其上游 Sparse NCCL 语义段交叉核对：稀疏更新是 checkpoint 坐标替换、共同基线、失败后保持暂停；Trace Replay 强制 token、保留模型真实概率、MRV2/端点前提。补独立新快照段，不能宣称旧镜像或 GLM W8A8 支持。 |
| G05-07 | P2 | speculative-decoding“为什么需要”；quantization“再看搬运” | 把每步读全部权重且恰读一次写成通则，忽略 MoE 只执行选中专家、内核缓存和重复读取。将其收敛为本步实际使用的权重与理想批内复用解释，保留 200 token 步数、接受率和量化算例，不从字节数直接声称真实瓶颈。 |
| G05-08 | P3 | graph-mode-layer、LoRA、Netloader、low-precision-formats、性能系列的页末 | 保留必要来源索引及真实待核项，将“本轮已核、原归档编号”等过程描述改为结论对应的固定来源；Netloader 的空清单、缓存字段省略、登记与重排失败条件不能丢失。 |
| G05-09 | P3 | acl-graph 动机；KV cache 量化页末 | decode 不必然是主机瓶颈；旧 GLM 不支持缓存量化不能扩成 rc2 的模型结论。修改近旁限定，不删有效机制。 |

## 保留内容

性能分析的关键路径、时间基准、实际到达率、失败分母、消息与 token 计时区分；量化的缩放/零点/误差推导与 ND/NZ 区别；KV C8 的 producer、prefill 展开和分页读约束；投机的拒绝采样、状态回退、GLM 草稿与主模型差异；睡眠两级与恢复顺序；Netloader 供需方生命周期；已有全部图和算例均作为保留基座。只有确有错误的句子与缺失的操作小节改变。

## 官方扩读记录

以下均为全文阅读，不把下载当阅读：921ccc52 的 graph_mode、npugraph_ex 设计、quantization 用户指南与适配设计、LoRA、Netloader、Sleep Mode、RL、performance_benchmark、service_profiling_guide、msprobe_guide。前轮已读 DSpark/Runtime Guard 等沿用前轮记录，不重复计数。另读 db701c1f 的完整 Flash Attention 指南；联网读上游 CUDA Graphs 与 torch.compile 设计正文，并沿 RL 链读 Sparse NCCL 更新语义与限制段。

Xlite 外部 AtomGit README 返回限流/登录页，未能阅读全文；未拿它作为实现支持证据。Ascend 官方 Xlite 章节可以支撑配置和预算说明，不证明任意模型都可执行。

## 验收边界

修订后需逐项回读、核来源与跨页链接，再做独立复审。浏览器实际阅读受 computer-use URL 识别限制，本轮尚未完成；无 NPU，不能验收性能、数值精度和端到端部署。自动内容/引用检查通过不能替代这些验证。

## 整改闭环

以上为整改前的初审要求。正文修订后已由 review_publication_fix 独立阅读差异、官方指南与关键消费者；追加发现的 HCCL 实占条件、Xlite 预算及过程叙事均已修订关闭，见 [独立验收](group-05-independent.md)。最终代码与静态内容检查结果见 [总报告](summary.md)，不改变上述视觉与设备限制。
