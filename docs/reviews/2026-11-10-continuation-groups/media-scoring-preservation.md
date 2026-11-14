# 媒体下载缓存 / K8s / 生成式评分保留清单

此批只独审39项新增引文及对应教学差量；没有改教学文件。API旧255项MM与engine旧141项的全文验收记录沿用前批，sampling旧278项沿用已验收正文；不重新计作新增全文。

- API原请求步骤、长度算例、MM三层缓存、UUID/EC条件、媒体输入图、四版差异均保留。对media-config-before差异只有新增（含同期评分回链），无删除。
- engine原GLM两机/进程/启动参数/四版/patch说明均保留；新增Service命名冲突及一行版本表，无删除。
- sampling原采样机制、普通logprobs、GLM限制、自定义处理器、预算及版本解释保留；新增评分概念、算例、请求表与四版表，无删除。
- scoring-api-before→当前API只有评分回链以及本批媒体OSError措辞更正；所替换媒体句属于同批未冻结新内容，不是删除旧有效解释。
- 此批没有新增/改动图或3D。既有图继续沿用前批已验收哈希，不把其他线程3D工作算为本批。

具体差异：`.tmp/continuation-groups-2026-11-10/{media-config,scoring-coverage}/review-*.patch`。冻结后三页hash及zip见media-scoring-checkpoint.json；未来reasoning/renderer/beam增量不在此冻结范围内。
