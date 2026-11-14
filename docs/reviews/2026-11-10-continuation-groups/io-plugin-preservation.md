# IO 与统计插件增量保留清单

作者改前快照：`.tmp/continuation-groups-2026-11-10/io-plugin-coverage/platform-plugin-registration-before.md`，SHA256 `6d262af500aab89530d46df472ec7fd79111e3b04b0179043778c4b6a692e835`。旧页面 45 项来源、两张图及原算例均保留。本组只写插件主解释；API 回链交 root，不修改 API。

逐项保留要求：

- 平台组返回类路径、通用组逐个调用；发现、加载入口、执行注册、加载权重四个阶段及各自失败边界。
- Ascend 平台入口不探测 NPU、唯一外部平台优先、main/rc2 显式 CPU 分支；平台解析缓存与通用一次性标志不同。
- GLM TP8/DP2/EP16、20 个核心角色进程、19 次通用登记的 spawn 与正常执行条件；原 1+2+16 算例、辅助进程不计入的解释。
- 五个 Ascend 入口、三个通用入口先应用全局 patch、没有全局固定顺序；v0.26 模型入口额外兼容处理与 rc2 指标 provider。
- GLM 架构名、模型注册仅建映射、20.58 GiB 语言权重子账及视觉塔等未计项；原加载与部署回链。
- 原错误表、误解、四版来源与运行证据边界，不删除原事实来容纳新内容。
- 旧首图及首屏保持；新增 IO 工作流放在 GLM 之前。源码区承接开法、失败、代价、四版差异；不把第三方地理模型示例变成 GLM 部署建议。

完成后用完整 diff、原来源前缀与实际浏览器检查逐项闭合；作者自检不代替 root 独立审查。

## 作者完成核对

- 以上七组旧信息逐项保留。完整 diff 只有四条旧正文行被替换：一条将“名字=函数”的表述明确限定于本节平台/通用组；三条长表行改为简短结论，指标 provider 完整组名/路径、v0.26 Kimi config→HunyuanVL 补丁→模型注册顺序及 processor 导入语句移到表后，原 C25/C23 与 source24 依据保留。没有删除旧例子、数字、错误或运行边界。
- 旧 45 sources 按序完整保留；来源 46–109 的 64 个原文与选段 SHA、范围均再次检查。原两图不改；新增一图和一个方形切片示意 calc，原 19 次 calc 保留。
- 浏览器实际打开前两屏、三张图、两块 calc、七个表与六段新增说明；20 张截图逐张 view。旧版本表内部裁切在作者自查发现并修复，最新 table-4、table-5 及 retained-table-notes 三张再次实看。renderer、统计开关、LoRA 三条链接实际点击，均到正确页与锚。
- 最终本页 SHA256：346324acad53eb18f7c9478415e8a759accc3a99db1ec74aadc0f913ae297aad。图 YAML 8d9bf85fc8417aef66c3febc56b1ffa4971a7d399d1566ef0852ea6d63060c25，SVG 55feaaa146df3ab5a40338f56238632e41effef0bba951db2a72441c5ef4affa。作者包 `.tmp/continuation-groups-2026-11-10/io-plugin-author.zip`，SHA256 dcc85f0b63f43e6e8ee40eb402c1484ea213f33c7c3fe0b74962ced967b7530f。
