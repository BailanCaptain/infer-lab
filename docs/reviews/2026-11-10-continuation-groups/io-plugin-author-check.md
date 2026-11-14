# IO 与统计插件作者自查

状态：已完成作者正文、证据、保留与浏览器自查，交 root 独立审查；尚未独立验收，不宣称本轮工程检查已通过。

改动仅插件页及 plugin-io-processing.yaml/svg。补 pooling 自定义 data 的展开/收齐/合并、四类入口契约、实际配置与报错、主机开销、四版同步/异步边界、统计入口与既有性能分析连接。原 GLM 双机平台/通用五入口主线及图、19 次登记算例保留。

证据：request-io-plugin-evidence.json 的 64 个手工主张范围；io-plugin-additions.json 映射到来源 46–109。request-io-plugin-followthrough-reading.json 区分母文复读、完整文件、差异复用、选段和仅下载。固定外部 TerraTorch 83c3a928、BART 77673541 作为具体插件示例，不当作 Ascend 配套版本或设备验证。

本地验证：仅生成本图，figureProblems=0；author-check.json 逐项原文/选段 SHA 与 64 范围匹配，旧 45 项前缀完整。首图前 calc 0，教学正文 7641 个 Markdown 字符、全文正文 16960（不含 frontmatter）；行内代码分别 14、104，约 1.83、6.13 个/千字符；源码区前证据角标 0；共 2 calc，分属新 IO 示意和原 GLM 登记示意，无相邻表/calc。

浏览器证据：review-io-author-browser/report.json。前后文件指纹一致、page errors 0、页面 overflow 0、表右边界 overflow 0；实际看图额外发现旧三版表在内部容器被裁切，已将长解释移表后修复，说明仅自动 overflow 值不够。20 张内容截图全部实际查看；修改后两版本表、表后保留文字又单独实际查看。三条新回链实际点击正确。图 860px 宽，文字可读，顺序为自定义输入→四个模型子输入→计算→按原编号收齐→插件合并。四片可分批执行，caption 明确不是同时计算承诺。

完整保留说明见 io-plugin-preservation.md，diff 与当前哈希见 `.tmp/continuation-groups-2026-11-10/io-plugin-coverage/`。统一 content/lint/audit/diagrams/build 由 root 在稳定文件上执行，本作者未重复全站检查。没有 GeoTIFF 实推、模型权重或 NPU/GPU 测试。

API 回链建议（由 root 作者决定并写入）：在「几种变体：不套模板的接口、一次要多个回答、开多个前端」末补一句，区别普通生成与 pooling 插件入口，链接 `platform-plugin-registration.md#输入输出插件为什么能把一张图拆成多个请求`。准确标题为「输入输出插件为什么能把一张图拆成多个请求？」；只给结论与链接，不在 API 页复制切片流程、参数和版本表。
