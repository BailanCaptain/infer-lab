# 编译与 IR 官方覆盖整改：作者交审

状态：正文与作者视觉检查完成；独立审查和最终工程检查由 root 完成。本报告不是全站完成声明。

## 改了什么，为什么

五份官方设计母文分别覆盖编译排查、融合规则、torch.compile、视觉编译和 IR。原本站主要讲 Ascend 融合、静态宽度与 CustomOp 替换，缺少“编译产物怎样复用”“视觉编译与捕获怎样分开”“IR 优先级到底在哪条执行路径上生效”三个连接。

只改 `wiki/concepts/npugraph-ex.md` 与 `wiki/concepts/ops-and-kernels.md`，新增 `ops-ir-selection.yaml/svg`。编译页补缓存、追踪证据、视觉编译门控与区间算例、四版实际入口；算子页补语义操作与实现选择、平台过滤/参数检查、maybe_inplace 输入捐赠、真实 CLI 注册和配置传递。未改其他会话的 3D、Attention、PD、MLA 或暂缓内容。

原来的后端结论仍成立，但其证明从平台旧 `use_inductor` 赋值改成实际 `get_compile_backend → AscendCompiler` 消费者链。四版核对区分固定 GLM 镜像与维护分支，Qwen 视觉入口不能推出旧 GLM 的支持。IR 通用输入捐赠也不被写成 Ascend 正常 RMSNorm 必走路径。

## 保留与学习检查

改前 `compile-tail/before.zip` 与 `before-manifest.json` 冻结两页及五张旧图的十个 YAML/SVG 文件。`compile-tail-preservation.json` 验证全部旧来源顺序、原标题及原算例保留（文本换行规范化后相同），十个旧图文件字节未改。旧 64B/128B、归一化量化与静态宽度算例、GLM 45 层逐站说明、版本差异及精确未核边界都保留。

首两屏能复述：编译融合减少独立提交和中间张量往返，但要付出启动编译与验证成本；算子语义、平台方法和设备 kernel 分层，具体方法仍可要求不同布局与依赖。新段的小例子分别展示缓存 A/A 与 A/B、两区间只扩大最后上界、FP16/BF16 候选分派；最后一个是规则示意，未伪装实际 provider。

## 本次账目

- 69 个新增引文出现项：编译页 38（53→91），算子页 31（47→78）。其中 63 个精确源码范围、5 个固定官方全文来源、1 个固定 tlparse README 来源。引文项不等于全文页。
- 前置证据包 120 个源码范围，重复版本按全文及范围 SHA 归并；另 4 个 CLI 范围于独审反馈后追加。没有把 124 个范围计作 124 个全文文件。
- 五母文全文再读：361 / 397 / 261 / 107 / 615 行。母账已有全文信用，故不重复增加全局全文数。
- tlparse 固定 README 53 行；vLLM 官方 torch.compile 博文固定源码 214 行及 9 张资产图（8 个编号图）；PR23207 仅正文 120 行。来源、pin、SHA 见 external-downloads.json。PR 评论和完整 patch 未计为阅读。
- PyTorch Dynamo 官方链接正文抓取空/403，raw 路径404，尚未读到；背景论文、视频及所有递归讨论不宣称读完。GPU 博文收益不转成 NPU 结论。

逐项来源映射见 `compile-tail-additions.json`；候选及完整/范围 SHA 见 `compile-tail-evidence-candidates.json`；阅读目录与明确未读边界见 `compile-tail-progress.json`。

## 实际验证

作者 Playwright 打开 5201，两页哈希前后稳定，页面错误 0、整页溢出 0；实看首两屏、五张旧图、原三算例、新 IR 图、新区间算例及全部表。三条跨页链接实际点击，目标标题在屏内。最新 `compile-tail/author-browser/report.json` 与截图已复核独审指出的列表次序、CLI 增量及来源索引。

作者初轮 content 退出 0；lint/audit 报官方 tlparse 仓库尚未入窄白名单和另一并行组尚未完成的 worker 图/引用。根负责维护白名单及最终统一五项检查；初轮日志不能充当最后四条 CLI 补证之后的通过结果。详情见 `compile-tail-author-checks.json`。

独审反馈已修：KDA bullet 移回原列表（P3），CLI 示例补真实注册、点号解析、类型校验和配置转移证据（证据完整性问题）。最后快照为 `compile-tail/author-final.zip` 与 `author-final-manifest.json`，等待 root 独立验收。

## 限制

无 NPU 执行、数值或性能实测。融合占位对象的具体下游消费者仍未定位，原文精确限制保留；没有用宽泛“已读编译源码”代替该验证。尚无需要用户决定的事项。
