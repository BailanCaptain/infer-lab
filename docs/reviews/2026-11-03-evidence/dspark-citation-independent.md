# DSpark 消费者补核独立复核

root，2026-11-03。完整读取本次 diff，实际读 DeepInfer 774ce worker.py 191–258、Ascend 921 配置 579–593、proposer 416–453、SlidingWindowAdapter 26–112。接受本次消费者补齐与关闭方式修订；本报告没有独立重读原 12 项来源或整篇 DSpark 论文。

DeepInfer 的置信度长度修正要求上一轮状态不是空或 placeholder、请求映射存在交集，并开启 MTP_VARLEN；只在变长分支异步回写 seqlens_q 并记录事件。Ascend 的窗口是可空整数，MTP 分支不创建该适配器；DFlash / DSpark 与 EAGLE3 的 future_offset 不同，块表按窗口裁剪，主机和设备长度一并改写，slot mapping 仍使用完整缓存。页面未把读取窗口当成已分配缓存容量。

独立复核提出的正文 C15 / C16 角标位置已移到页末映射，复读关闭。未修改图，未进行 NPU、GPU、图布局或吞吐验证。最终页面 SHA256：`5c0429de9ca5f2645720a414caba83d0d65648ca5c18a0b6fcaf25ec4f5a3d9a`。
