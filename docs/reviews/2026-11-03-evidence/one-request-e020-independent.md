# One-request E020 独立增量复核

2026-11-03，审查者 `/root/review_groups_03_04`，写手 `/root/review_first_pages`。完整读取最初 32,697 字符的五文件增量、相关当前上下文、两张变更图 YAML 全文及 SVG 文字差异；最后复读同轮通信措辞。这里只验收增量及相关证据，不代表重新独立核完全页 60 项来源。

主要修订接受：7.3/7.15 MiB 是混合定义的逻辑载荷账，不能当网络流量上界；218 按所列通信操作计数，排除 MTP、DP 元数据与其他控制通信；空闲组仍可能承担真实目的专家计算，无元数据的 eager dummy 跳过 KDA 核心；TP 不代表所有矩阵均分；共享专家、SP、完整词表路径、MC2 容量条件前置；MTP 540.75 MiB 限定 3121 语言子账，嵌入与输出头共享判断分开；prompt logprobs 补额外投影；输出停止与缓存释放先后、量化版本与图缓冲区保留均有证据。七站、15 块、16–17 块、三步生成和原数学算例保留，没有把原有效解释整段删除。

本次实际读取 db patch_kv_cache_utils 136–228、445–515，reject_sample 69–120，register_custom_ops 84–102，proposer 489–596，model_runner 3332–3371、2738–2742、2486–2509，KDA 477–494，prepare_finalize 440–495；0fc multiproc_executor 131–157、495–509，gpu_model_runner 5399–5501，scheduler 1390–1585，chat serving 865–936；baa MTP 80–104、proposer 241–260。MC2 prepare 193–314、dispatcher 150–339 复用本审查人本轮 collective/DP 全来源核验中的实际原文阅读；固定量化、共享权重、Token 默认 16 编号与 18/36 标记、SP 条件也复用本人本轮真实核验，不把作者账本当作本人读过。

独立审查指出 :261 的“16 张卡同时参与”容易混同严格时刻同步，写手改为参加同一轮通信、缺少参与者无法完成；已复读接受。最终正文 SHA256：`cb5e5fed9b9b02a7b98b4aadc5b48063b40edceca30ae4a1044ee21dea8da20f`。本次没有未闭 P1/P2。

没有浏览器或 3D 播放、图视觉、NPU 或性能验收；没有声称所有模型路径和动态调度轨迹均已实测。本报告不计入 03/04 全页来源覆盖。
