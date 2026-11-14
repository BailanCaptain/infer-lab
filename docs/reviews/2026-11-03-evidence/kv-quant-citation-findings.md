# KV cache 量化：48 项作者核验

root，2026-11-03。实际读完当前正文、两张 YAML 与原 40 项来源的固定范围；新增 8 项及扩展范围也已读取。来源 35 复用本轮 root 已完整读取的 KIVI 论文，来源 36 本轮联网完整读取正文、限制和示例（网页 3106–3296 行，不将站点导航计为正文）。没有执行论文示例、部署命令或 NPU 测试。

## 发现与处理

- P2：旧图与段落把普通 C8 的 INT8 写入概括成每层每步通用路径，实际 db forward 明确区分无 KV transfer、producer、非 producer；producer 的 prefill 直接写原类型。已明确图的非 PD / BF16 示例范围，并补全 source 8，保留图结构和算例。
- P2：把反量化临时 dtype 一律说成 BF16，实际由 query.dtype 传入；已把 BF16 作为示例条件。chunked prefill 的直接浮点分支还要求 float_key/value 非空，补上这一条件。
- P2：rc2 C8-MXFP 与旧 INT8 C8 的读取和 PD 限制不同。实际前者 prefill/decode 统一 QFA 读缓存，支持传四份张量的 Mooncake 路径；后者阻止 GQA 通过普通 Mooncake 直接传不同精度的原块。新增后端来源 43–45，说明 512-token kernel 页、CP、非因果、滑窗及尺度传输限制。
- P2：main 仅用 import 证明构造路径不充分。source 27 改为真实 wrapper 构造，41–42 补 Ascend 注册映射与内部 MLAAttention 创建；不把上游类名理解为跳过 Ascend 插件。
- 旧“量化描述本机没有”的待核已过时。对已取得的两个固定 JSON 分别完整解析 113,358 / 113,454 个键，筛查 kv_cache / fa_quant / fa_k. / fa_v. / indexer.quant，无匹配。该事实不证明现场目录采用任一版本，也不是声称人工逐字读过 11 万键。
- 容量和性能边界：图中系数与偏移另占显存；BF16→INT8 载荷减半不保证实际 HBM 流量、耗时或所有模型容量同比变化。MLA 还要区分潜向量、RoPE 与不同稀疏打包方式；分页零偏移是恢复每个缓存数值的配方条件，未伪造主动拒绝非零偏移的检查。
- 独立复核收尾：将常见误解与源码表里的“只有 prefill 接历史”同步改为旧普通 C8 的 prefill 接历史或浮点 K/V 不可用，避免漏掉同一函数的另一条件；表中范围同步到 1893。1,152-token 推算补明没有显式指定更大块的前提，保留原数值。

## 逐项来源记录

1. db modelslim 964–980：完整读；量化类型与按键登记层号。
2. db kv_c8 108–145：完整读；非 producer 改 INT8、替换 impl、创建并 flatten 四份静态参数。
3. db attention 1733–1754：完整读；乘逆 scale、加 offset、round/clamp 后转 INT8。
4. db attention 1756–1791：完整读；分页 NZ INT8 decode、scale-only 参数、32 倍数断言。
5. db attention 1794–1893：扩展后完整读；decode 与 prefill 拆分，全新且浮点值可用才不反量化，最后输出写回。
6. db attention 1685–1731：完整读；按整张块表收集，掩有效位置，转 target_dtype 后只乘 scale。
7. db config 349–372：完整读；GQA、enable_c8_quant 与 Mooncake 检查及错误建议，不作为连接器运行成功证明。
8. db attention 1568–1643：扩展后完整读；非 PD、producer、非 producer 的实际写入分支、图捕获分支及 metadata=None 行为。
9. db attention 1650–1682：完整读；TP 头切分、尺度准备缓存和逆尺度；不由 scalar 参数默认值保证任意维度可用。
10. db attention 1895–1934：完整读；分页展开与非分页减 offset 再乘 scale 的区别。
11. db modelslim 770–779：完整读；按量化描述和层号选格式，MLA 只改变 K 侧。
12. db mla 760–765：完整读；enable_fa_quant 返回值决定内部 dtype。
13. db runner 3978–3989：完整读；MLAAttention 的 K=kv_lora_rank、V=qk_rope_head_dim，不能混同普通 K/V。
14. db cache spec 54–71：完整读；SFA 与 LI 的独立载荷、尺度以及打包组合。
15. db config 280–289：完整读；旧 sparse 两开关与 use_sparse、reshape 开关及层筛选入口。
16. db SFA 672–685：完整读；主缓存和索引器独立标志，A5 / 其他设备的缓存和尺度 dtype。
17. db KPool cache 69–77：完整读；固定旧 GLM 主缓存 BF16。
18. db KPool backend 557–578：完整读；indexer、reshape、DSA CP 检查及 use_sparse_c8 两字段禁用。
19. db platform 504–505：完整读；index_topk 属性存在时覆盖 cache dtype。
20. db mamba config 83–86：完整读；auto 与显式 dtype 的分支。
21. db mamba config 112–139：完整读；token 页字节含潜向量与 RoPE，GLM 定块包含 requested_block_size。1152 是沿旧示例、无更大显式请求块的假设推导。
22. vLLM 0fc cache 19–35：完整读；仅证明该固定提交枚举，不能反推 Ascend 全部支持。
23. v0.23 C8 111–130：完整读；producer 规则与旧 db 相同。
24. v0.26 C8 111–130：完整读；同上。
25. main C8 111–130：完整读；路径迁移，producer 规则保留。
26. v0.26 platform 460–461：完整读；带 index_topk 的覆盖保持。
27. main GLM attention 301–323：真实构造及缓存契约标记完整读，取代原来只有 import 的范围。
28. main GLM-5.1 测试配置 1–2：完整读；只证明此模型测试配置存在，不证明实际通过或适用于 5.3。
29. db DeepSeek V4 152–155：完整读；A5 自定 FP8 cache 的特例。
30. db quant utils 215–224：完整读；非 A5 需要 consumer，接逐层选择；不把总开关当成每层均支持。
31. db modelslim 745–754：完整读；非 A5 逐层还需 consumer 且非 producer，A5 仍查量化层号。
32. main quant utils 267–284：完整读；fp8/int8 dtype、硬件能力、consumer、配方与缺失配方报错。
33. v0.23 quant utils 217–220：完整读；旧总入口前置条件。
34. v0.26 quant utils 217–220：完整读；同前置条件。
35. KIVI v2：复用 root 量化验收核验时完整论文阅读；二位 K 按通道、V 按 token，保留高精度残余分组。没有 Ascend 实现或性能保证。
36. vLLM v0.25 FP8 KV 官方页：全文正文和全部示例已联网读；逐张量/逐头、FA 条件、默认 scale、随机预热后固定和数据集校准；未执行示例。它的链接示例库其他页面不因此计已读。
37. rc2 config 905–943：完整读；SFA/KPool、LI C8/C4、prefill reshape、配方筛选分别有条件。
38. rc2 GLM attention 96–117：完整读；完成池 BF16 与尾状态 FP32。
39. rc2 modelslim 797–837：完整读；标准 Attention 类型、显式 dtype 开关与 recipe 不是同一条件。
40. rc2 mxfp_c8 51–103：完整文件此前已读，本页扩到 103；K 动态、V 静态 E8M0 及逆尺度，不将 method.apply 当作实际缓存写入。
41. main ops/mla 189–218：完整读；Ascend 包装内部构造 MLAAttention 并传 cache / quant / indexer。
42. main utils 842–873：完整读；wrapper 对应 Ascend 实现的注册映射，不单靠 import 确认。
43. rc2 attention_c8_mxfp 377–399：完整读；两类工厂均拒绝 PCP/DCP，支持的 kernel block 为 512。
44. rc2 attention_c8_mxfp 723–803：完整读；非因果、滑窗拒绝，长度来源、单 query 行无 mask，统一 QFA 调用。
45. rc2 attention_c8_mxfp 854–925：完整读；输出量化、metadata、hamming、连接器、四份缓存、Q/K/V 量化及共享 KV owner 写入条件。
46. ModelScope 9e55 量化描述：完整 JSON 解析并逐键筛查缓存量化相关键；SHA-256 9aae1f3c7657115b7e24294bf6d668f6ea062e2c8fe9eccad4a3862284fe665f，无匹配。
47. ModelScope 3121 量化描述：同上，SHA-256 06da9cb1542eddc8748d1e7c3474ef2522a2d3f8946b71daddcee6ddcf11b137，无匹配；不等于人工逐字阅读全部参数项。
48. main modelslim 707–745：完整读；逐层 FA 要求与格式分配，补全 source 32 的后续消费者。

## 复用与验证边界

db、2c59、2ed6、baa 的五个 C8 写入/读取函数已逐函数比较，忽略函数末尾空白后全部相同；记录在 `.tmp/wiki-evidence-2026-11-03/kv-c8-version-compare.json`。只复用同一内容的阅读，不以相同函数外推整个版本相同。两张图只定向重新生成；页面与 SVG 的静态检查、独立复核分别记录，不能当作视觉或设备验收。
