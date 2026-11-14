# MiniCPM 子依赖的当前教学范围核对

目录 50 的作者建议：可把**现有多模态教学所依赖的 MiniCPM 字段与切片范围**交独立审查收口；不把“所有递归外链全文读完”作为结论。本轮未改 API 页，该页正由另一作者收口。

## 实际读了什么

公开页面 `https://huggingface.co/openbmb/MiniCPM-V-2_6` 的模型卡正文已从架构说明、更新、能力描述，读到单图、多图、few-shot、视频示例、许可与引用（网页文本 L240–479）。这不是受限 raw README 的固定提交阅读；未重试绕过先前 raw 401，也没有接受许可、获取权重或登录。公开页中的 benchmark 图没有在本次独立打开查看，不能将文字读取计成图像验收或性能验证。

公开 HTML 快照：`.tmp/continuation-groups-2026-11-10/lora-minicpm-scope/external/minicpm-public-card.html`，SHA256 `b91b6694257d942ffb15522a90efece19effd0eddb6e77a9a32d7e6292693ea7`，UTC 抓取时间 `2026-11-10T17:10:10.975667+00:00`。平台 HTML 是当时公开内容留档，不是模型仓库 raw commit。

固定 vLLM 源码实际读取：旧基线 `minicpmv.py` 454–486（字段和尺寸消费者）、584–650（切片占位）；v0.26 的相应完整函数 diff；rc2 的字段配置 diff；相同 get_image_size 与 main 的同文用 SHA 复用。机器记录位于 `lora-tail-author-summary.json` 的 minicpm_consumer_ranges，共四版 × 三函数的定位与摘录哈希。其余整个模型文件没有宣称全文阅读。

## 本站怎样承接

当前 `api-server-entry.md` 的“图片怎样和文字一起交给模型”说明图片尺寸参与切片解释；源码区说明 MiniCPM-V-2_6 的预计算媒体输入除嵌入外还需 image_sizes，源 245 / 246 对应固定字段与占位实现。实际源码将尺寸第 0 项读成宽、第 1 项读成高，切片占位由处理器结合尺寸生成，不能从“二维向量”推广为所有模型通用输入。

公开卡主要是其模型架构、CUDA 运行示例与性能自述。视频示例中的 64 帧上限、use_image_id=False、max_slice_nums=2 是该示例选择，不应补成 GLM 或 Ascend 的默认部署值。新版源码中移除的 MiniCPM 4.6 分支也不能移作 2.6 的行为差异。rc2 的 keep_on_cpu 字段变化属于特定消费者放置方式，不改变尺寸的宽高含义。

因此没有为了“读过一篇”向教学正文复制无关模型卡内容。向 root 提供一个可选的小精度建议：现有“在线单项为 2 个数”可明确为“宽、高两个数”，但不是缺乏机制解释的 P1/P2，本作者按要求未改 API 页。

既有四份多模态示例与 Qwen 指南的阅读记录位于 `request-mm-followthrough-reading.json`，本次检查其记录及教学承接，没有重新计为本作者全文阅读。现有 API 多模态段及 LoRA 新回链在本次浏览器实际打开到目标标题。

## 待审边界

当前教学范围未发现必须新增的 P1/P2。独立审查者应确认既有 MiniCPM 字段解释与上述原始消费者的承接，再决定目录 50 的 scoped 收口。受限 raw README 的固定全文、所有图、全部递归子链接均不能标为完成。机器记录保留这些限制，全局全文计数未加。
