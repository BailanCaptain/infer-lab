# 关联外部原文补读

## FA3 安装入口

已实际完整读取官方 `921ccc52` Flash Attention 指南的 171 行，以及该指南指向的 `MinghuasLab/flash-attention-npu` 的 `trainInferConsist` README 全文（含 v2/v3 接口、安装、测试、功能表和许可证说明）。本次 GitHub API 将分支解析为 `429a64f2437ed332f513c7be409b272ea3a8d188`；随后取得固定提交的 README，并与实际读取的分支版本逐字哈希比较相同。

- 固定原文：`https://github.com/MinghuasLab/flash-attention-npu/blob/429a64f2437ed332f513c7be409b272ea3a8d188/README.md`。
- 缓存：`.tmp/wiki-evidence-resume-2026-11-08/external/fa3-429a64f2437ed332f513c7be409b272ea3a8d188.md`。
- SHA-256：`78a100a17f7fe7dae4a7354d72ed407f3247bd85f3c40ffeef2bb203b28ca2cb`。
- README 列出 Linux、910B/910C、CANN ≥8.5.0、PyTorch 与 torch_npu 配套，以及构建 v2/v3 的选择。命令和依赖是文档证据，本轮没有安装或运行该 NPU 软件。
- 接口签名与大段 docstring 保留 RoPE、window、softcap、FP8 等字段，而末尾功能表仍将这些特性标为未支持。字段存在不能作为 Ascend 实现已经支持的证据；当前 `attention-backend-family.md` 的条件化说明与该范围一致。
- 固定 Ascend 指南首段说包已开源，末节仍列“未来开源”；本次公开仓库可访问只证明查询时刻的仓库状态，不能重写旧文档的历史事实或证明其所有命令可执行。

这次关闭了旧 `official-03-04.json` 中 FA3 外部 README 尚未阅读的缺口。没有把 README 的图片徽章或链接出去的整个依赖网络计为技术材料全文阅读。

## DeepSeek 生产文章

本次再次访问 `https://zhuanlan.zhihu.com/p/2095560295930508953`，仍返回 HTTP 403。随后用户直接提供了文章复制正文，现已全文阅读并保存于 `materials/deepseek-v41-production-user-copy.md`。当前证据状态更新为“已读用户提供的文字副本，未独立抓取网页，三处原图表缺失”，不再笼统记为正文无法取得。旧账本的 403 是当时事实，最终汇总通过新记录覆盖当前阅读状态，不抹去历史。

副本中的生产架构、四类负载均衡、扩缩容、缓存分层、命中和回放规则可与固定 QA / 开源实现进一步逐项对照。正文的生产收益和峰值数字只能归属于作者所述线上系统；缺失图表、负载条件和原始测量不能由复制文字补齐。文中“GPU 全程无空闲”与“重算代价与层数无关”须按实际重叠条件及固定重算长度解释，不直接升格为任意系统的时延或复杂度保证。

已重新完整读取固定 `DeepInfer@774ce244` 的 `doc/inference_deployment_qa.md`，包含所有章节、表格与示例。生产文的扩缩容信号、1 分钟宽限期、0.8 禁缩容、故障域和重启重新确定 EP 均与该问答一致。P 侧 EPLB 实测值不同：用户副本 EP2/DP2=1.0320、EP4/DP4=1.0618，固定问答为1.045、1.074；不合并为同一统计。D 侧1.090一致，也不表示本轮硬件复测。

据此更新 `deepseek-serving-case.md` 和 `inference-capacity-and-reliability.md` 的来源对应；前者补出 P/D 组大小与实例数量的资源计数示意，并保留固定问答建议的高效部署单位。新状态是“副本文字已读，相关机制由固定官方问答交叉支持”；原图表仍不作已读判定。新增差异须经独立复审后才关闭。

## 六篇论文中的位图补读

已逐张实际打开并阅读六篇论文 HTML 引用的23张技术位图，原图 URL、SHA-256 与保存位置在 `.tmp/wiki-evidence-resume-2026-11-08/paper-figures/manifest.json`。论文为 BFLOAT16、FP8、HiF8、DeepSeek-V4.1、FlashAttention、FlashAttention-3。三张透明背景图另以白底合成读取，图像数据未改。

- BFLOAT16：FP32 主权重/累加与 BFLOAT16 输入输出的混合精度流程；DS2、GNMT、SR-GAN 的曲线只支持指定实验的比较。
- FP8：各 GPT 规模训练曲线及指数偏置敏感性图；对 GEMM 与残差都量化的曲线变化更大，不支持任意层一律一字节驻留或任意精度等价。
- HiF8：有效精度随指数变化、随机舍入阈值布局，以及指定网络/模型训练曲线；不将格式论文转换成任何硬件自动支持的证明。
- DeepSeek-V4.1：模型代际全局 KV 每 token 字节数、精度加权 decode FLOPs 和两组性能/预训练图。字节口径不是所有运行态总缓存；FLOPs 不是设备实测时延。
- FlashAttention：A100、3090、T4 的条件化加速柱状图；没有将 GPU 收益外推至昇腾。
- FA3：warpgroup ping-pong 与两阶段/三阶段流水图，展示重叠组织，不构成整个服务零空闲保证。

这23张是 HTML 中的位图资源，不等于六篇论文的全部插图；HTML 还含 SVG/object 图与表格，未将未看的部分记为视觉已读。

## 浏览器条件

本轮使用项目现有 Playwright/Chromium 打开本地 Vite 阅读站，已取得 PP 与 DeepSeek 页面首屏截图，并实际读取截图。两个页面均正常显示中文、导航和正文，PP 无页面脚本异常。此条只记录这两张首屏，不作为全站图表或交互验收结论；后续记录在最终浏览器报告中。
