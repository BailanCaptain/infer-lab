# KV cache 量化页本次增量独立复核

审查者：review_publication_fix，2026-11-03。本次完整读取 kv-quant-citation-remediation.diff、正文相关段及两份 YAML/SVG 文本，实际核对下列固定原文。增量独立接受；不把本报告算成独立重读全部 48 项历史来源。

- db701c1f kv_c8.py 108–145；attention_v1.py 1568–1643、1650–1934：非 PD/producer 写入分支、舍入截断、scale 与 offset、query.dtype、decode 直接读取、prefill 全新浮点分支与历史/浮点 K/V 缺失时的收拢分支。上述范围按来源 2–6、8–10 分段核读，未声称执行 NPU。
- db701c1f patch_mamba_config.py 112–139：缓存精度与块大小计算，显式 requested_block_size 的 max 前提。当前 1,152 token 算例已限定未显式指定更大块。
- baa023ad 模型 attention.py 301–323、ops/mla.py 189–218、utils.py 842–873：可替换包装层及 Ascend 注册、实际构造上游 MLA，不以包装类名推实际后端。
- 7d 固定 rc2 attention_c8_mxfp.py 377–399、723–803、854–925：PCP/DCP 边界、512 核块、统一 QFA、decode/MTP mask 与 actual q length、Mooncake 四缓存以及拥有 KV 的 rank 写入分支；mxfp_c8.py 51–103 的 K 动态/V 静态及 scale 类型已在低精度独核实际读。
- baa023ad modelslim_config.py 707–745：FA 配方/950 与非 producer 的 D 端、MLA cache 精度限制。
- 独立解析两份固定公开量化 JSON（旧 113,358 键、新 113,454 键），筛查 kv_cache/fa_quant/fa_k.scale/fa_v.scale/indexer.quant_type 均无命中。该结果只说明这两份文件，未扩大到所有权重或实际加载。

相邻 P2 已关闭：原“只有 prefill 接历史才展开临时副本”遗漏浮点 K/V 不可用分支，作者已同步常见误解，并限定旧普通 C8。源码表 1794–1893 范围亦已同步。原教学算例、C8-MXFP 与 INT8 C8 的区别及精度/平台条件保留。

本次仅静态语义及图文本同步核验，没有本站浏览器、布局视觉、NPU、部署、性能验收。最终 SHA256：`a209cd904c2655d83899983bb202e28e832741caa25ad16d744e7219a53a4407`。
