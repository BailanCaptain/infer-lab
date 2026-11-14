# API 的 IO 插件回链独立审查

结论：本次单段增量通过；无 P1/P2/P3，未新增来源。不是 API 全页重新验收，统一工程由根助手后续合并。

根助手作者修改，审查者 groups_ucm_review 对照 `.tmp/continuation-groups-2026-11-10/io-plugin-coverage/api-before-io-link.md` 与当前 API 正文，差异只有“三种变体”末尾一段。它限定 pooling 模型，说明应用数据可以展开成多个子请求、收齐再合并，不用 HTTP 请求数代替模型任务数；与已读插件调用者和根助手已独审的主解释一致。原有 Completions、n 个回答和多前端解释全部保留。

实际运行 `node .tmp/continuation-groups-2026-11-10/review-api-io-link.mjs`，在 1440×1100 桌面浏览器打开新增段并点击“输入输出插件”。链接进入 platform-plugin-registration 对应标题，标题距视口顶部约 108 px；两张前后截图均由审查者实际查看，正文可读、目标图可见、无横向溢出。脚本结果 stable=true、errors=[]，记录为 `review-api-io-link/report.json`，图为同目录 before.png / after.png。

验收时 API SHA256 为 `b220e4ce0dd028823aa654e641dd69fbf2e91e497738644729a280129dc0f109`，目标插件页为 `346324acad53eb18f7c9478415e8a759accc3a99db1ec74aadc0f913ae297aad`，浏览前后未变。本审查不承担未来 API 其他增量的验收。
