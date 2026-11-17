# 第三篇 Super Kernel 候选：720 交付版独立复审

审查人：砚砚。2026-11-16。结论：**Changes Requested，0 P1 / 3 P2**。这是候选内容审查，不是正式发布回执。

对象：`candidates/03-enable-super-kernel-ce990e186bfa.md`，SHA-256 `4c62087e2dada180d59256394e251baf2f0eceb7ee03771437f3c36b603fadd6`。正式旧稿 SHA-256 `c2cd68ecb004004228ef280b825812ef00c45cd656b76f4f754f17d18292a83d`，未修改。接受来源为消息 `0001794818611424-000720-ea86ba54`；工作区 HEAD `f44c953f99e416b2dc174c3b2ad31a729b91d30f` 仅是基线，候选属于未提交实物。

## P2-1：piecewise 报错条件被简写成环境变量有没有设置

位置：候选 L149。表格和 L164 保留了代码中的 `and not`，但教学正文写“v0.30.0rc2 与 main 则在未设置环境变量 VLLM_USE_BREAKABLE_CUDAGRAPH 时抛出相同的 AssertionError”，丢了明确的联合条件，也把布尔开关值改写成了变量存在性。

固定 `7d825229:vllm_ascend/platform.py#L1310-L1318` 与 `baa023ad#L1193-L1201` 的条件为 `compilation_config.mode != CompilationMode.VLLM_COMPILE and not envs_vllm.VLLM_USE_BREAKABLE_CUDAGRAPH`。编译模式正确时，即使该开关为假也不触发这个异常。请明确写成“编译模式不是 VLLM_COMPILE，且 BREAKABLE 开关为假时才报错”。v0.26 的无条件断言与新版条件仍须区分；不要用“环境变量未设置”替代开关真假。

## P2-2：旧稿显式 None / null 的版本差异丢失

位置：正式旧稿 L141 → 候选 L123、L151、L162。旧稿明确写明迁入 pydantic 后 `None` 不再是合法 `bool`；新稿只保留字段定义和省略键的继承过程，没有明确保留“显式传 None 与省略键不同”的行为。

固定 `2ed6cbba:ascend_config.py#L603,#L634-L635` 接受 `bool | None` 并把 `None` 当继承哨兵；`baa023ad#L115,#L120-L134` / `7d825229#L126,#L131-L145` 为非可空 `bool`，前置校验器仅在键不存在时补齐。请在配置类型/版本差异处补回一句：旧配置显式 `None`（JSON `null`）跟随 static，新配置的显式 `null` 不是“省略”，会被布尔校验拒绝。保留来源，不需要改生成区或增加新的模板栏目。

## P2-3：首屏仍把参考细节塞进两大段，优化目的没有讲透

这是读取实际呈现后的结果问题，不是按字数设新门槛。1440×900 Chromium 截图中，正文前两段分别是 570、519 个渲染字符，均高 280.75px；第一个段落包含三级代码键、scope、三项 fuse 名、编译器范围免责和被移除参数的旧标签，第二段紧接 validator 实现、硬件降级与早期发布标签。读者尚未理解它具体优化什么，就被带入完整版本审计。四版本长矩阵紧随其后，关键“意味着什么”列还需横向滚动。仅换栏目名、移走角标没有完成用户要求的实质阅读改善。

此前 710 对效果措辞的约束也需要校准：代码调用本身不能证明设备性能，但一手官方指南确实解释了机制。我重新从仓内 `npugraph-ex.md` 的来源回到固定一手文件核验：

- `vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/graph_mode.md#L228-L242` 明确描述：Super Kernel 在已编译的算子二进制上识别可融合子图，合并子 kernel，并按依赖插入同步；目的是减少逐项下发和调度等待，不兼容算子可能截断范围，收益依模型与算子序列而变。
- 同文件 `#L278-L286` 区分“启用日志说明优化步骤被调用”和“通过 kernel_details.csv 比较实际融合覆盖/时延”。该描述也存在于本库已引用的固定 `921ccc52c6d8c9864190b981792318a489aeadf4` 指南；两份都是已回读的原文，不以另一篇 wiki 的概括充当证据。

修正方向：把这两个固定文档片段追加到 sources 末尾，首屏用它们讲清“把符合条件的已编译小程序合起来，减少逐项下发/调度的机会”，保留实际收益须测和不支持算子会分段的条件；不能写成全模型一定单 kernel 或必然加速。三个开关可以短段或小表讲清，接着给只开 static/显式关闭 super 的具体例子。把 fuse 细目、validator 实现和精确发布标签移到对应后段或折叠核验区，别删事实。四版本完整矩阵保留在同页 `## 对照源码`，主干若需要速查，按使用问题保留紧凑表即可，不复制第二套长矩阵。标题与图数量由内容决定，不另立固定模板。烁烁仍需执行独立 039 新旧讲法审查。

## 实际已通过的检查

独立脚本 `%TEMP%/infra-wiki-review-20261115/721-super-kernel-review.mts` 实跑 exit 0，报告 `721-super-kernel-review.latest.json`；隔离产物目录 `721-super-kernel-preview-wAFXb0`。

- 解析无错误；41 条 sources 中 39 个本地引用通过，2 个 URL 仅登记、未联网验证。原 37 条来源顺序以及 id/title/type/origin/verified/relations/rawSources 全部相同。
- 使用真实共享 `lineageSection`、`protectedParamSection` 核对，两保护节与正式旧稿精确一致。
- 隔离生成 registry 并构建静态阅读器，Chromium 1440×900、API 请求全禁：0 页面错误；`## 对照源码` 默认关闭、手动展开成功；两个自动生成节位于折叠区之外；实际点击 npugraph_ex 内链到对应页和锚点成功。
- 已目视检查 `super-kernel-top.png` 和 `super-kernel-table.png`；配置、折叠区截图也已留在同目录。上述程序通过不代表教学问题通过。
- 没有改正式 wiki、已有候选01/02、3D、生产代码或210缓存。临时4197服务和浏览器均已关闭，既有4173/4174/4196服务未动。708的参数固定四标题硬门禁仍待代码作者单独收口。

映射与 README 请随返修后实际字节/章节更新；当前 2/24 双审状态正确，不提前登记第三篇 Approved。无需用户另行批准。
