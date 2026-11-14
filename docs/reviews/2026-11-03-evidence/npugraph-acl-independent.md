# npugraph_ex 与 ACL Graph 增量独立复核

审查人：root；日期：2026-11-03。完整读取两份 citation-remediation.diff、修改后相关正文与两份图 YAML；接受本轮增量。该结论不等于重新完成两页全部来源审核，也不包含浏览器视觉或 NPU 验收。

npugraph_ex：实读 db compiler_interface39–68/278–301、base_pattern41–63、manager36–79、platform158–173/589–645、上游 backends845–849/940–966，确认本地返回 FX 图、平台关闭 Inductor 编译器；本地 compile-range 检查与外部 stream-scope 检查不同。完整读取 allreduce_rmsnorm_fusion_pass1–159，核对未量化 GEMM、残差加 RMSNorm 与本地起点大于512的门槛；要求并复看 source11 扩为32–159。

实读 db layernorm28–88、GLM2189–2241、norm_quant657–738、QK192–230，支持 mHC 单输入 RMSNorm 不能直接套残差融合候选，也不能从语言主干类名推定整个服务零候选。读取 Triton muls_add8–57 和注册303–309，支持中间张量读写示意，未宣称设备实测流量。三版配置、三版 EngineArgs 透传与 main937–956配置测试均实读；初始 v0.26 tag 缺字段的结论复用本轮 root Super Kernel 全来源审核。合并重复角标没有删结论或虚增来源。

ACL Graph：实读固定包装器138–170/226–259、错误识别28–54、monitor87–99、普通 attention454–518/1117–1172、runner830–837/2803–2835、block_table284–288，确认有效行更新、位置 Tensor 地址检查、事件等待与更新后 record 的次序。主机提交顺序不等于设备执行顺序；此事件链没有推广为 GLM MLA/KDA 的完整验证。

实读 db platform76–124/599–623、上游 config/vllm1545–1566/1690–1771、baa platform1184–1229与硬件枚举、两版捕获错误包装及2ed platform581–619。独立执行固定 baa 包/示例/测试的变量搜索。原“过滤后必然更新最大宽度”遗漏了双显式值不一致先抛错的分支，已要求修正并复看新句，source7扩至1763；这项相邻 P2 已关闭。

没有执行部署、捕获、模型推理或测试教程命令。SVG仅核对与已读 YAML 的文案差异，未冒称视觉验收。
