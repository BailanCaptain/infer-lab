---
id: dspark
title: DSpark：动态推测长度配置的已知入口与核对边界
type: source
summary: 本地摘录展示了 DSpark 动态推测长度配置：默认关闭，选择 dspark 时依赖置信头；参数具体默认值、运行时效果与模型支持范围仍需核对。
aliases:
  - DSpark
  - Confidence Scheduled Verification
  - 置信度调度
  - 变长验证
  - 可变验证长度
  - DFlash
  - MTP varlen
  - confidence head
chapters:
  - '17'
sources:
  - >-
    raw:sha256-dc75e5e9e7b4460bbcef217a1c5deb65ec844f4d08e653cec9ef780d44e03ea1.md#L1-L55
verified: []
evidence: I
relations: []
contradicts: []
updated: '2026-11-03'
origin: gap
rawSources:
  - >-
    raw/sha256-dc75e5e9e7b4460bbcef217a1c5deb65ec844f4d08e653cec9ef780d44e03ea1.md
---

本页整理本地材料中关于 DSpark 动态推测长度配置的摘录。材料展示的是配置声明与方法名校验，能够说明默认开关、允许的方法名以及注释声明的依赖；尚不足以解释完整算法、验证长度怎样变化，或某个模型与执行路径是否可用。

## 材料具体展示了什么？

材料给出两处源码定位：

| 材料中记录的提交 | 文件 | 原文件行段 |
| --- | --- | --- |
| `baa023ad` | `vllm_ascend/ascend_config.py` | 1112–1136 |
| `7d825229` | `vllm_ascend/ascend_config.py` | 1298–1322 |

两处摘录展示相同的 `DynamicSpecConfig` 配置内容。这里保留定位供后续核对；本次只读取了本地摘录，没有独立打开上游源码，也没有核实提交与发布分支的映射，因此不据此登记 `verified`。

## 默认是否启用 DSpark？

摘录中的方法字段为：

```python
method: str | None = None
```

紧邻注释说明，`None` 会关闭动态推测长度路径。因此，就这份配置声明而言，默认没有选择 DSpark，也没有选择其他动态方法。

支持的方法名列表为：

```python
SUPPORTED_METHODS: ClassVar[tuple[str, ...]] = ("dspark", "dflash")
```

这说明配置接受这两个名称。列表本身没有说明两者算法相同，也没有证明它们能用于所有模型或所有执行路径。

## DSpark 对模型有什么要求？

摘录注释明确说明，`dspark` 依赖 DSpark confidence head，即模型中供该方法使用的置信预测组件；没有这一组件的模型需要其他方法。

材料没有展开这个组件的输入、输出、训练方式，以及预测结果如何转换成验证长度。因此，本页不能据此补写接受概率公式或长度分配算法。支持列表中出现 `dflash`，也不足以证明它适用于所有没有 DSpark confidence head 的模型。

## 方法参数怎样提供？

`method_params` 保存所选动态方法的自定义参数，字段声明为：

```python
method_params: dict[str, Any] = dataclasses.field(default_factory=dict)
```

默认会得到一个空字典。注释说明，参数为空时，各方法使用自身的内置默认值；**空字典不表示关闭动态路径**，关闭与否由前面的 `method` 决定。

注释列举 DSpark 接受的参数键包括：

- `initial_verify_budget_per_req`
- `budget_update_interval`
- `budget_threshold`

这些是注释给出的示例键，不是已证明完整的参数清单。摘录没有提供它们各自的默认数值、类型约束、取值范围或调节效果，不能仅凭名称写出推荐配置。

## 配置校验能发现哪些错误？

材料展示的校验器在配置解析后检查方法名：如果 `method` 既不是 `None`，也不在支持列表中，就抛出 `ValueError`。错误信息的格式为：

```text
dynamic_spec_config.method must be one of {self.SUPPORTED_METHODS} or None, got {self.method!r}
```

这一段检查的是**方法名是否合法**。所示校验器没有展示对方法参数键、参数值或模型是否具有 confidence head 的检查。因此，方法名通过校验，仍不足以证明后续模型加载和执行能够成功。

## 后续整合还需要核对什么？

要把这些摘录整合成完整教学页，还需要补齐以下证据：

- 动态方法在运行时从哪里读取配置，如何决定每条请求的验证长度，以及怎样更新相关状态。
- confidence head 的实际输入输出，以及它与草稿生成、目标模型验证之间的协作关系。
- 三个示例参数的定义、内置默认值、约束与实际影响。
- v0.23 维护分支、v0.26 分支、v0.30.0rc2 分支和 main 开发主线各自的入口、默认值与支持边界。
- 不同模型、执行路径与并行配置的兼容条件，以及额外计算和状态开销。

本次没有进行设备运行、性能测量或采样分布验证。旧页面中的算法解释、教学算例、部署命令及版本对照仅是比较上下文，未作为本草稿的新证据。

本页全部依据为 frontmatter 中的本地材料：原文第 1 行和第 29 行记录两处源码定位；第 8–27 行展示第一处配置的支持方法、默认值、参数说明与校验逻辑。来源仍是本地摘录，未升级为独立核验的源码证据。
