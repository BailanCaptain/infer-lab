# API 加载与生成方式回链独审

结论：本次三个回链改动及相邻总述的适用范围修正通过内容与浏览器独审。工程验收等待 root 当前统一检查；不复用旧 renderer 检查替代本次页面指纹。

范围与保留：改前为 `renderer-reviewed.zip` 中 API 页（SHA256 5ada092efa8f19943b178656f85df16954fb39454e9b2717333b391d069e205a）。本次只核模型名检查、beam 主解释链接、命名与加载主解释链接，以及审查反馈引起的相邻总述限制；来源 321 项、其他正文、图与算例未改。差异保存在 `.tmp/continuation-groups-2026-11-10/api-loading-links.diff`（前三处初稿）；最后总述修正由局部浏览器记录保存。

逐项判断：

1. API 第①步限定未启用 LoRA 的配方，已登记适配器与运行时 resolver 另行处理，支持。实际来源是当前 source 5：`vllm@0fc695fc:vllm/entrypoints/openai/engine/serving.py#L211-L238`，依次判断基座、已登记名字、动态 resolver，并保留加载失败 400，否则 404；不是 source 8。resolver 的真实加载与失败边界复用本次 LoRA 38 项独审范围，不扩设备兼容声明。
2. beam 链接只把原有区分连接到正确主解释，支持。已复读固定基线 Chat serving L294–330 的两类参数与分派，复用 `beam-independent.json` 的逐项语义判断；不把 HTTP stream 等同边生成边返回。
3. 命名段保留服务别名与加载来源的区分、token 页面入口，补模型解析主解释，支持。目标段逐一讲配置类、执行实现、权重文件、tokenizer；与 `request-model-resolution-evidence.json` 43 个实际消费者范围一致。本次只验回链与段落语义，不代替 Worker 新增教学整组独审。

发现与关闭：P2，相邻总述原称“前四步只在前端改写请求”，与 LoRA resolver 会调用引擎 add_lora 的例外冲突。作者已限定“在本页未启用 LoRA 的固定配方中”，复读及局部实看关闭。无未解决 P1/P2。

浏览器：使用 `review-api-loading-links.mjs`，3 个新链接均实际点击，正确目标标题在窗口内（顶部约 108 px）；6 张前后图实际打开检查。初稿 stable、page errors 0、overflow 0。修正总述后执行 `review-api-loading-scope.mjs`，`scope-fixed.png` 实际查看，最终 stable、errors 0、overflow 0。证据目录 `.tmp/continuation-groups-2026-11-10/review-api-loading-links/`。

最终 API SHA256：`2dba8f72b1d869c00f171ba5272dd3ea2dd0a3ad06f02b7a6066469c93072a73`。本次新引文数 0，新全文阅读计数 0；未运行模型、适配器权重或 NPU。


工程闭合：loading223-verification.json 的 API 哈希与本报告最终指纹完全一致，五项检查全部 exit 0，前后稳定。该回链增量已闭合；后续 IO 回链另行审查。
