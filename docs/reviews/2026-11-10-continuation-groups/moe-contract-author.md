# MoE 交接约定、CustomOp 与 EP 后端：作者交付

作者：spec_final_review。2026-11-11。状态：作者整改和作者验证完成，等待新的独立审查者逐项复核；本报告不是独立验收，也不修改全站总账。

## 范围与结果

本组承接官方目录 12、15、25、88，补在已有三页中，没有另造平行的解释体系。`ops-and-kernels.md` 增加 8 条来源，`moe.md` 增加 24 条，`expert-parallel.md` 增加 7 条，共 39 条。39 是引文项数，不是全文篇数。逐项主张、实际范围、文件与摘录哈希见 `moe-contract-additions.json`。

| 页面 | 本次补齐 | 当前 SHA256 |
|---|---|---|
| ops-and-kernels | 整类替换与 CustomOp 方法分派分开；运行时 name、列表语法、默认值与回退边界 | e03b68b1b72922b1c9d70fafc81cf8c2f266362dca74f0bbb64d2e95084059d6 |
| moe | prepare / experts / finalize 的布局、有效行与预留容量、工作区、量化时机、权重归约和异步完成 | 3cc5c3e547b6fe8a40f605628e9f0917f1cb0bdadbde91bf88f45445512855be |
| expert-parallel | 上游后端名的用途与硬件前提、Ascend 改写字段与真实执行链的区别、回链 MoE / 启动 / P/D | cb7cd614f25916a39ba842e4b21e67d01f27a5a6e3073e68938dad96a2346810 |

## 实际阅读与有界承接

四篇母文均从固定 vLLM `0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665` 取得并实际完整阅读：12 共 318 行、15 共 245 行、25 共 112 行、88 共 320 行。身份见 `mother-identity.json`。这些属于已有全文材料的复用，新增全文记 0。

12 的 40 个生成片段实际展开、逐段读完，记录在 `custom-includes.json` 和 `custom-includes.txt`；它们是注册、类声明和说明片段，不冒充 40 个源码全文。15 的 4 张原图实际打开查看，输入二维布局、按专家预留布局、通信准备/收尾和计算块都纳入判断；图中示例量化顺序和历史容量数字不扩写为所有当前实现的默认规则。

沿四篇母文继续读了真正的配置消费者和执行范围，记录在 `read-ranges.json`。CustomOp 全文件、两种方法基类、DeepEP LL 全文件实际读完；modular_kernel、unquantized oracle、DeepEP HT、BatchedTriton、归约、CLI、平台配置、Ascend MoE 等只按记录中的范围作已读声明。新增 39 条引用的每一行均处于实际读过的范围或四篇母文中；未把源码取回、哈希命中或作者结论自动算成阅读。

母文 12 的模块目录包含 PluggableLayer，不能把目录项都解释成 CustomOp。其细粒度示例把多条规则放进同一个字符串，与当前语法检查冲突，教学页改用多个独立元素。母文 15 的旧工厂方法名不直接照搬：当前未量化路径经 oracle 创建模块化实现，旧 `select_gemm_impl` 会抛错。母文 25 的摘要不能推成“所有专家计算输入都已量化”；实际存在延迟量化，HT 与 LL 支持条件不同。

母文 88 的后端安装、GPU 脚本与链路条件按原场景阅读，不作为 Ascend 的命令模板。TP×DP 的简式也不覆盖 PCP 非 1 的情形。headless、API 入口与多节点参数已有页面讲解，本次读了 serve/EngineArgs 消费范围后通过链接连接，不重复复制。母文的冗余专家措辞和容量式沿已有 EPLB 正确解释承接：冗余数量是全局配置，每 rank 本地数量还须除以 EP 规模，包含全部专家的容量不能当成新增量。相关 eplb_utils 和 Ascend 适配器范围重新读过。

母文 P/D 示例的“D 忽略 prompt”没有沿用。已有 `ep-prompt-independent-review.md` 对普通 NIXL 输入约定作了独立修正；本次完整读该报告并实际阅读页面相关段落，以页面同 SHA `7ca01c3c3925918f486da0264fe6d07791c0138fdd128c038cbd145217b1b41b` 复用这个已核范围，再实际点击回链。没有重复计算该组的 10 条来源，也不声称重审全部 P/D 来源。

## 保留与原函数复现

编辑前保存三页快照。`moe-contract-author-preservation.json` 校验旧来源列表仍是新列表前缀，原链接目的地、17 个图块和 10 个 calc 块全部保留；Moe 只新增 1 个容量演算。17 个图的 YAML / SVG 当前哈希也保存，作者没有改图资产。三份本次 diff 实际读过。

新容量例子接回原卡 A 的三个专家：有效配对 1、4、1，共 6 行；2 个派发端各最多 4 行，给每专家预留 8 行，3 个专家共 24 行；教学隐藏宽度 4、BF16 输入区为 192 B。它没有把容量当实际负载，也没有把输入区当全部显存。

`reproduce_contracts.py` 执行从固定源码抽出的原 AST 片段或原方法，使用普通替身对象提供必要状态，结果在 `reproduce-contracts-result.json`：

- 合并元素 `["all,-rms_norm"]` 与 `["none,+rms_norm,+rotary_embedding"]` 均触发原语法错误；拆分元素通过该语法循环。
- 原 `register_oot` 把替代类的 name 设为登记键 `RMSNorm`，验证运行时名字不能凭原类名转小写推断。
- 原 BatchedTriton 工作区方法返回 `(3,8,16)`、`(3,8,8)`、`(3,8,4)`，与预留行的解释相符。
- 其他支持谓词为真时，原 `is_supported_config` 仍拒绝布局不一致。

复现只证明这些 Python 方法的行为，没有启动完整 vLLM，没有执行 GPU/NPU、通信或专家 kernel，也没有测吞吐或显存峰值。

## 作者页面检查

在现有 `http://127.0.0.1:5201/` 实际启动 Chromium 访问三页、滚动、截图并点击链接。`browser/report.json` 记录页面哈希前后相同、页面错误 0、三页横向溢出均 false；三张新表的单元格溢出均 0。

实际查看全部 20 张截图：三页前两屏与新增内容共 11 张视口截图、3 张新表、6 张图/演算截图。原苹果路由、共享专家算式、TP/EP 权重与通信算式保留；新增 8 / 24 / 6 / 192 B 演算完整可见，没有文本裁切。实际点击 ops→AI Core、moe→CustomOp 新段、EP→MoE 新段、EP→P/D 提示词边界四条链接，目标页和锚点成立。

`pnpm check:content` 通过（164 页、11 个主题）。本组未改产品代码；统一五项工程检查由 root 运行。最终 diff 空白检查结果另存本组证据目录。

## 边界与交接

本组只关闭四篇母文在本站相关教学页中的明确承接缺口，不关闭 DeepEP / FlashInfer / NIXL 的整个外部生态，不列所有 GPU 内核支持矩阵，不把现有四版表扩大为新增段落已逐版验证。新增段落明确固定上游和 GLM 插件边界；没有新增外部 URL 白名单需求。

证据目录 `.tmp/continuation-groups-2026-11-10/moe-contract-followthrough/`；归档位置、成员数和 SHA 见 `moe-contract-author-archive.json`。请新的独立审查者逐条读 39 项范围与实际页面，重点检查 OOT 名字、延迟量化、权重只归约一次、Ascend 后端字段的消费者和旧算例保留。当前没有作者已知待修的 P1/P2；最终支持判定与是否验收仍由独审决定。
