# Chunked prefill 历史风险补充独审

审查者 `/root/queue_final_review`，作者 `/root`，2026-11-11。接受本次精确修订，关闭旧引文 17、23、28 对应的三个风险；没有把本轮范围扩大成该页全部 51 条来源的重新审查。

最终页面 SHA256：`54c0fce9a21c9de8cd99865da3ded8df39d8a1345bb63690d0a4afd33d94ce19`。旧 39 条来源原样作为前缀保留，新增 40–51 共 12 条逐项记录在 `chunked-risk-followup-independent-judgments.json`。

## 事实复核

实际读取 v0.26 与 main 的 EngineCore 节拍判断、Scheduler 两个附加条件、running 跳过、waiting 远端 KV 优先分支和容量标记更新。非对齐步并非无条件推迟新请求：容量标记为假且 running 中已有非 prefill 请求才产生 defer，已经运行中的 prefill 也受影响。新文完整保留这些条件，并明确容量标记不是显存余量测量。

固定 GLM 的同步普通采样、同步投机采样和异步输出链分别实读：随机数 offset 回拨、普通行清空、投机 mask、异步下步输入索引排除、请求输出不追加，以及 CPU 拷贝完成后输出对象的过滤。正文将“当场扔掉”改为“不追加输出”，没有把异步处理时点说成同步时点。

旧来源 28 只支撑执行标签。版本表已将“执行标签与丢弃采样”收窄为“runner 的执行标签”；采样完整消费者另由 48–51 承接。默认值行也不再笼统写“默认开”，改为按模型支持推导，并与单条上限 0、关闭分块后的 waiting 接纳行为分行，链接到 Prefill 的版本对照。实际读取目标表和来源索引；其三版默认来源 51–53、rc2 来源 49 的独立消费者核验由并行的历史风险收尾承接，本报告不冒领那四份来源的新增阅读量。

证据为 `.tmp/continuation-groups-2026-11-10/chunked-risk-consumers*.txt` 及 `chunked-risk-independent/source-40.txt` 至 `source-51.txt`。后者重新从固定 Git 对象抽取，核编号、范围和内容身份；不凭摘录哈希代替前述实际阅读。

## 保留与页面复看

完整阅读修前快照与最终精确 diff。两张静态图、四个 calc、交互场景、全部旧链接及其数值/前提保留，其他 frontmatter 不变；只增加一条 Prefill 版本对照链接。保留记录见 `chunked-risk-followup-independent-preservation.json`。

作者实际浏览器截图由本独审者独立查看：`final-local-followup-browser/chunked-prefill-fix0.png`、`fix1.png`，以及补齐的 `final-extra-browser/chunked-prefill-table.png`、`chunked-prefill-conditions.png`。修订采样段、完整版本表和门控条件均可读，没有截断、横向溢出或布局问题。最终浏览器报告显示页面前后哈希稳定、错误 0、overflow=false；作者实点新增链接到 Prefill 的“版本差异”。本报告明确这是独立查看作者的实际浏览器结果，没有声称本审查者另外操纵了同一浏览器。

未改动图、算例和 3D，本轮不重复其播放验收；全站工程检查由 root 统一执行。未运行模型、NPU 或性能测试，新增官方全文阅读计数为 0。没有遗留的本次 P1/P2。
