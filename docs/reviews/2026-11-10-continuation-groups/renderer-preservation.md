# Renderer 增量保留清单

改前 API 文件来自 .tmp/continuation-groups-2026-11-10/renderer-coverage/api-server-entry-before.md，内容沿用已验收 reasoning 版本。与最终版的完整 diff 及 hash 见同目录 review-api.diff、review-identity.json。

- API 既有正文没有删除行；请求入口、七步流程、GLM 双机、嵌入向量、媒体预处理、磁盘缓存、长度准入、模板思考参数及既有表格完整保留。
- 新增独立 renderer H2、一个示意 calc、一张图；源码区新增入口、错误、四版表与来源映射。来源 288–321 追加，旧 287 项不重新计数。
- 原有图、3D、关系与版本标记未改。新图仅表达调用方串接，不替代原请求入口流程图。
- 冻结包含当前 API 页与新增图 YAML/SVG；后续 HF 或 beam 回链改变 API 时，必须另做差量验证，不用这份指纹冒充未来页面验收。
