---
id: enable-super-kernel-ce990e186bfa
title: enable_super_kernel
type: param
summary: >-
  控制是否启用 Super Kernel 优化。所给材料中，省略时会跟随 static kernel，但两份快照的继承条件不同；启用依赖 static
  kernel，图模式校验还可能将它关闭。
aliases:
  - ascend_compilation_config.enable_super_kernel
  - 超级内核开关
  - super_kernel_optimize
  - super_kernel_scope
chapters:
  - '16'
order: 30
sources:
  - >-
    raw:sha256-42c8fbc306605cf0e919ba3633fd18873e64133802338c685a530f755989462b.md#L1-L346
verified: []
evidence: I
relations:
  - to: npugraph-ex
    kind: builds-on
    note: Super Kernel 要求先启用 static kernel，而 static kernel 又依赖 npugraph_ex
  - to: acl-graph
    kind: builds-on
    note: 理解 graph capture 阶段有助于区分启动编译成本与后续请求执行
contradicts: []
updated: '2026-10-29'
origin: gap
rawSources:
  - >-
    raw/sha256-42c8fbc306605cf0e919ba3633fd18873e64133802338c685a530f755989462b.md
---

## 一句话

`enable_super_kernel` 是 `ascend_compilation_config` 中控制 Super Kernel 优化的开关：所给编译器摘录在它开启时，向编译选项写入 `super_kernel_optimize=True` 及对应优化选项。

理解这个开关需要区分三件事：用户填写的值、配置校验后的值，以及编译器实际收到的选项。填写 `true` 只是起点；依赖配置、硬件检查和图模式处理都可能影响最终结果。

本页是依据本地摘录整理的中间草稿。摘录含多个提交标识，但没有足以核实的发布分支映射，因此下文按材料中的快照标识区分行为，不将其对应到 v0.23 维护分支、v0.26 分支或 main 开发主线，也不登记这些版本为已核对。

## 事实表

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 所属配置 | `ascend_compilation_config` | 它控制编译优化，不是模型生成参数。 |
| 文档中的省略行为 | 跟随 `enable_static_kernel` | 省略 Super Kernel 开关，可能随 static kernel 一起开启。 |
| `baa023ad` 摘录中的继承条件 | 输入缺少 super 字段，同时含有 static 字段 | 校验器会复制 static 的输入值；显式提供 super 字段时不走这条继承分支。 |
| `2ed6cbba` 摘录中的参数声明 | `bool \| None = None` | 声明允许空值；材料未提供足够内容来完整核对后续空值处理。 |
| Super Kernel 的依赖 | static kernel 必须开启 | 单独开启 Super Kernel 不满足依赖，可能触发断言。 |
| static kernel 的依赖 | npugraph_ex 必须开启 | 要沿依赖链检查配置，不能只检查最上层开关。 |
| 独立关闭方式 | static 为 `true`，super 为 `false` | 可以使用 static kernel 而不启用 Super Kernel。 |
| 图模式关闭路径 | 图模式为 `NONE` 时，三项开关均被写为 `False` | 显式填写的开启值仍可能被平台处理覆盖。 |
| 编译选项 | `super_kernel_optimize=True`，并设置 `dcci_after_kernel_end: [".*"]` | 摘录证明了选项传递，尚不能据此确定实际融合数量或性能收益。 |

表中配置继承见材料第 25–27 行，依赖断言见第 49–55 行，编译选项见第 68–72 行，图模式关闭路径见第 101–105 行。文档说明和显式关闭示例见第 188–197 行，可空参数声明见第 203–205 行。

## 为什么存在

这个开关让 Super Kernel 优化能够单独受控。材料中的文档允许 static kernel 开启、Super Kernel 关闭，因此两者虽然存在依赖关系，仍是两个可以区分的配置选择。

static kernel 在这里是 Super Kernel 的前置条件。摘录中的断言形成一条单向依赖链：启用 Super Kernel 要求 static kernel，启用 static kernel 又要求 npugraph_ex。理解底层编译路径可接着阅读 [npugraph_ex](../concepts/npugraph-ex.md)；这里关注的是开关怎样继承、校验并传到编译器。

以材料第 25–27 行的字典输入处理为例，假设输入已将 npugraph_ex 和 static kernel 设为开启：

- **没有填写 super 字段**：校验器发现 static 字段存在，复制它的值，因而补入开启的 super 配置。
- **显式填写 super 为 `false`**：super 字段已经存在，校验器不执行复制，保留关闭值。

这解释了为什么查看字段声明或只看用户是否写过 `enable_super_kernel`，都不足以判断最终状态。还需要沿配置处理过程检查它是否被补入、依赖是否满足，以及平台是否随后关闭了这些选项。

在编译器摘录中，Super Kernel 开启后会加入优化标志，并将 `dcci_after_kernel_end` 的匹配表达式设为 `[".*"]`。这段代码说明开关如何影响编译输入；材料尚不足以展开该选项的底层执行机制，也不足以证明某个模型会合并哪些 kernel。

## 开了的代价

开启前先检查依赖链。材料给出的两条断言分别是：

```text
Static kernel generation requires npugraph_ex to be enabled.
Super kernel generation requires static kernel to be enabled.
```

硬件降级路径也会影响结果。材料第 49–55 行展示了三项开关被一起关闭的代码，随后才执行依赖断言；所提供的这段原文没有展开硬件判据，因而不能据此列出支持或不支持的设备清单。

图模式同样会改变最终配置。第 101–105 行明确展示：当 `cudagraph_mode` 为 `NONE` 时，平台关闭编译模式，并把 npugraph_ex、static kernel 和 Super Kernel 全部写为关闭。因此，判断是否生效应检查配置处理后的状态，不能只依据启动时提交的 JSON。

材料中的文档提供了保留 static kernel、关闭 Super Kernel 的写法：

```json
{
  "ascend_compilation_config": {
    "enable_npugraph_ex": true,
    "enable_static_kernel": true,
    "enable_super_kernel": false
  }
}
```

这段配置用于说明三个开关的关系，不是 GLM-5.3-Flash 双机部署验证结果。

启动时间需要单独归因。材料第 307 行把“数分钟至数十分钟”的额外启动时间归于 **static kernel 在服务启动的 graph capture 阶段触发编译**，并说明时间取决于算子数量和模型复杂度。graph capture 是记录设备操作以便后续回放的阶段，相关基础见 [ACL Graph](../concepts/acl-graph.md)。该时间范围不能作为 Super Kernel 在 static kernel 基础上的独立增量成本。

是否值得开启，仍缺少保持其他条件一致、只切换 Super Kernel 的对照数据。当前材料不能量化它单独增加的启动时间、实际融合数量、请求时延变化或吞吐收益。

版本与输入边界也需补核：两份快照分别呈现了“字段缺省时复制 static 输入值”和“参数允许 `None`”的不同写法，不能据此保证显式传入 `null` 时行为一致。发布分支映射、未知键处理、字符串布尔值转换，以及固定 GLM 双机部署中的最终生效情况，均未在本次材料中完成核对。
