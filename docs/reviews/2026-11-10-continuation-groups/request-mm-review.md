# API 多模态增量独立审查

结论：本次新增范围接受。新增来源 194–255 共 62 项已逐项独立核对实际主张、固定原文和版本；逐项依据见 [request-mm-independent.json](request-mm-independent.json)。未把原 193 项再计作本轮核验，也未把 62 项引文计成 62 篇全文阅读。教学正文及图由根写手修改，本审查只写证据与报告。

## 范围与依据

按 `docs/wiki-writing-standard.md`，审查 `wiki/concepts/api-server-entry.md` 的多模态增量、`api-multimodal-input.yaml/svg`、改前快照和最终 diff。已读官方处理设计 63 行、输入指南 1194 行；其四个关联示例 415/718/1725/2952 行另有实际全文阅读，不据母页自动宣称子资料读完。模型技术指南及生成 API 文档的后续覆盖继续单独记账，非本批硬件验收。

机制核对覆盖 CPU 媒体处理与占位更新、命中/未命中原序合并、临时文字分支、CPU/EC/KV 三类缓存、单 API 且 DP1/external LB 的 IPC 缓存条件、UUID 四版差异、空媒体错误、编码输出缓存与填入语言输入。模型字段核对 Qwen2 grid、Qwen3 base/deepstack、MiniCPM image_sizes；视频核对 OpenCV 默认关闭、有界前扫及真实分派；音频核对采样率与声道、ASR 切分调用条件和旧版前进保护缺失；超时核对初次尝试值及 HTTP 重试，而不是整体耗时承诺。

上游比较点为 0fc695fc / 568afb3a / ced6857a / 84030bbe；main 只是明确固定的上游比较点，未宣称与 Ascend main 精确配套。GLM 基线继续纯文本主线，无 NPU、双机或各模型兼容性运行结果。

## 问题及复审

| 级别 | 问题、证据与处置 | 最终状态 |
|---|---|---|
| P2 | 早稿把只交 UUID、不交媒体的例子泛化；基线与 v0.26 音频 parse 不接受 None，rc2/main 才加入该分支。最终以图片 A 为例，正文及版本表写明解析器与真实缓存命中条件 | 已关闭；来源 228/234/237/239 与最终正文、浏览器表复核 |
| P2 | 视频字段表“HTTP 字段在顶层”会误导把 fps 等直接放顶层；官方指南 L880–891 实为 media_io_kwargs → video → 字段 | 已关闭；最终表明确完整层级，实际浏览器复看 |
| 图面修订 | 左边占位箭头接近第二框标题；根写手调整折线路径，最终 y315 转折未压标题，图意与 CPU→编码→语言模型分工一致 | 已复看最终 SVG 与实际页面 |
| 证据更正 | 独审候选 rc2/main opencv read_frames 结束行误写 324，但固定文件仅 316 行；审查者全检 131 候选后仅这两项越界 | 已更正；[完整更正记录](request-mm-candidate-range-check.json)，正文来源 254 为 L282–L316 |

无未关闭 P1/P2。未把指南注释、同名参数或机械行号有效当作语义支持；例如 CPU 缓存容量注释受真实 IPC 分支约束，四版 UUID 行也没有强行写成一致。

## 实际浏览器与保留

使用独立临时 Playwright 脚本 `.tmp/continuation-groups-2026-11-10/review-mm-final-browser.mjs` 实际打开 `http://127.0.0.1:5201/#/wiki/api-server-entry`，滚动阅读前两屏、新节、七位置例子、UUID/布局/音视频说明、新图及全部四张新增表。截图已实际打开检查，非仅生成文件。新图边与文字无重叠，表内容完整，无水平溢出（1440/1440），浏览器 pageerror 为 0。最终往返读取文件 hash 一致。

实际点击“编码器分离与缓存”和“UCM 编码结果复用”，对应路由及目标锚存在。两个固定官方文档链接也经联网打开，解析到 `0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665` 的正确文件；源码 commit/路径/范围由 Git 固定原文复核。详细浏览器证据在 `.tmp/continuation-groups-2026-11-10/mm-coverage/review-browser/report.json` 和同目录截图。

初学者复述：入口先把媒体变为模型能用的张量，并指出媒体特征应放在哪些输入位置；真正的编码特征之后才计算或命中 EC。CPU、编码器、语言层分别有代价，也分别有缓存。七位置例子给出 A 的 1–2、B 的 4–6 与文字 0/3，不能把“一张图”当一个 token。其定义、代价和后续例子相互一致。原有效信息保留见 [request-mm-preservation.md](request-mm-preservation.md)。

## 工程结果与冻结

根写手最终 `custom-mm-closed-{content,lint,audit,diagrams,build}.log` 五项 exit 0 已回报，本审查实际读取日志关键结果：164 页内容校验、lint 通过（10 条非阻塞提示）、7276 来源本地校验且无无效 commit/缺文件/越界、写作标准 104/104、343 图与 spec 一致、build 7.36 秒。该全站机械校验不证明全部 URL、raw 或语义通过；467 URL 未联网核与 3534 raw 机械待核仍保留，其他会话的页面/图变化不归本批成果。

| 冻结文件 | SHA-256 |
|---|---|
| api-server-entry.md | e9a434b01ba102aa50ab60183996a74d48192ac28ff382919006a52422d55f85 |
| api-multimodal-input.yaml | 3ead6c2599aaeeb42e8ba3ec3baaee48cd2da77abf4f7db85b401a8be076a885 |
| api-multimodal-input.svg | b9b0cf237c699d1b173813959b195dca72da03c4ed51d9afb92d3b8fa6812a6f |

快照 `.tmp/continuation-groups-2026-11-10/mm-coverage/reviewed-after.zip`，SHA-256 `22a2591c5c4250aa5b6d2e161e71c361ac3079edffa66d45ea24aa4ab4809cd1`。无用户待决事项；全站官方技术链接覆盖仍继续，不以本批接受宣称全站完成。
