# 模型解析：作者交审记录

状态：作者稿已稳定，交根助手作新的独立审查；本文件不是独审通过结论。

## 本批补的缺口

唯一主解释位于 `wiki/concepts/npu-worker-lifecycle.md` 的“装权重之前，怎样知道要构造哪一种模型？”。解释配置类、执行实现、权重、tokenizer 四个不同选择，接回 Worker 第③步的构造参数、装权重、后处理。示意“猫”的编号 7/12 说明分词器与词向量行必须对应；不是 GLM 真实编号。

同页源码区补 9 个 CLI/Python 入口、来源与修订的默认继承、错误定位和四版差异。兼容 Transformers 有明确条件，不能由原生失败推断自动修好；普通默认加载器与专用加载器分开；revision 解析只尽力而为；重试只包配置解析调用。固定 GLM 教程仍走原生 Ascend 路径，不宣称兼容后端已通过 NPU 验收。

API 页由根助手维护，本作者未编辑。建议该页只回链主解释：`npu-worker-lifecycle.md#装权重之前怎样知道要构造哪一种模型`。

## 改前与保留

改前快照：`.tmp/continuation-groups-2026-11-10/model-resolution-author/npu-worker-lifecycle-before.md`，SHA256 `f86c281eeda5f93fe507e06f80fad8304fdffce73abe6bd40c05c4aaf807b53d`。

作者稿：SHA256 `8db9f4c35185535dea08c06247fff79683dce9792278ad10d9b30a973f7671f2`。`model-resolution-author-preservation.json` 逐组记录六步、GLM 数字、patch、预读、KV 预算、capture、版本、误解、实测缺口的保留。旧正文逐行顺序保留、旧 73 源编号不变、1 个原 calc 原样保留、两张原图 YAML 与改前一致；新增图独立为 `model-resolution-flow`，未修改其他会话 3D。

## 阅读与补证

`model-resolution-additions.json` 给出新增来源 74–117 的逐条作者判断、固定文件 SHA、精确范围、摘录 SHA 和页面编号。44 条是引用范围，不是 44 篇文章：29 个既有证据范围复用，10 个构造桥接与四版字段范围，3 个官方说明/承接范围，2 个 CLI 到配置范围。构造与字段分属少量完整源码文件，不能按范围数计全文。

实际阅读记录在 `model-resolution-author-reading.json`：两篇母文 23/31 行重读；支持矩阵本轮读 1–405，根助手先前全文 784 行记录仅复用既有覆盖。本轮全局新全文数记 0。源码先读实际函数，再核差异；仅函数范围同字节的地方复用同一段判断，不把整个文件说成相同。

证据包的一处版本归纳已告知根助手并在教学中修正：基线 tokenizer 加载已通过 get_config 登记配置；v0.26 追加的是 cached_tokenizer_from_config 对已有配置类的预先登记，不能概括成“v0.26 才开始登记”。母文较早的“架构未登记即不支持”也不能覆盖当前条件式兼容后端。原文仍留作阅读证据，当前教学按固定消费者解释。

## 作者实查

- `pnpm check:content`：退出 0，164 页。
- `pnpm wiki:audit`：退出 0，104/104 标准页通过；7898 源的机械范围检查不是语义验收，478 URL 未联网、4155 raw 机械待定位仍照实保留。
- `pnpm wiki:diagrams`：退出 0，349 张图，仅生成新图 1 张。
- `pnpm wiki:lint`：退出 1，唯一失败是并行 `npugraph-ex.md` 的 tlparse 域尚未登记；worker 无错误。已通知根助手，保留本次失败日志，不代称全站通过。
- 浏览器：5201 实际打开，前两屏、三张静态图、原 calc、新配置职责表、9 参数表和四版表截图已实际查看。新图 900×620，无文字碰撞，左右职责可辨；版本表各列均在屏内。页面 SHA 前后稳定，pageerror 0，文档横向溢出 false。
- 实际点击 token/API 回链成功；新 H2 的实际 id 与计划回链一致，带正确 hash 的直达位置为 107.64px。浏览器报告和图像位于 `model-resolution-author/review-replay-model-resolution-browser/`。

全站最终工程检查与独立审查由根助手另行完成；本作者不以自查代替独审。无 NPU 设备结果。所有外部模型卡、HF SDK、Hub 库与专用加载器并非全部读完，记录为范围外承接，不据此宣称全部官方资料完成。
