# B9 Ascend 融合与布局：独立审查

审查日期：2026-11-01。审查者：独立子代理 `fusion_layout_independent_review`，不是正文作者。

最终状态：**B9 五单元独立审查通过，未留未关闭 P1/P2。** 固定源码、受控分支验证、全文、真实 before→after、检索和作者浏览器证据均已复核；此结论是文档验收，不是 NPU 运行认证。

## 范围与方法

- B9 的 W0028 `ascend_compilation_config`、W0029 `fuse_muls_add`、W0030 `fuse_norm_quant`、W0031 `fuse_qknorm_rope`、W0078 `weight_nz_mode`（兼容输入 `VLLM_ASCEND_ENABLE_NZ`）。
- 阅读项目 AGENTS、`docs/wiki-writing-standard.md`、`wiki/AGENTS-GUIDE.md`，完整阅读 `npugraph-ex.md`、`tensor-layout.md` 及其五张引用图，相关配置系统页按相关段落核对。
- 独立从 GitHub 官方 raw 固定提交下载；没有读取 `tools/repos`。来源、行数与 SHA256 见 `tools/wiki-runtime/fusion-layout-20261101/independent/source-manifest.json`。
- vLLM：`0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665`、`568afb3a13806beb53bb2e6bd518269357b237c0`、`84030bbe3d74d99bad477a3d2e37a973ccd8865c`。
- Ascend：GLM `db701c1fd31de40ab028628ee2580ae68c7fd3c0`、community `2c59ff1047573f40a471cf7535f01a8877344415`、rc `2ed6cbbaf481d84cfd3f2d01d47bcf79ee064c1f`、main `baa023ada41a5b889cac6249845a688aab130892`。教程 `0576b6471c7a35707920a665352391d33c77451c`。

## 独立源码结论

| 单元 | 确认内容 | 独立依据 |
| --- | --- | --- |
| W0028 | 是 `additional_config` 内嵌对象，不是请求字段。旧三线构造器有 `**kwargs`，未知子键被吞；类型注解不强制 bool。main 真实 `@config` 是 Pydantic dataclass，`extra=forbid`，会转换合法 bool 字符串，拒绝 `None` 和未知子键。static 依赖 backend；硬件降级先于依赖断言。main 显式 static 且省略 super 时，before validator 让 super 跟随 static。 | 各线 `ascend_config.py`；main `config_utils.py` 28–50；GLM 579–640；main 103–160 |
| W0029 | 三线旧版 `kwargs.get(..., True)`；main 正式 bool 字段默认 True。候选受 dtype FP16/BF16/FP32 与硬件门控；标量从 `hf_text_config.routed_scaling_factor` 取得，缺省 1.0，不是任意标量都保证命中。 | 四线 `muls_add_pass.py` 82–104；pass manager |
| W0030 | 默认 True；候选只限 BF16/FP16；包含 W4A4_DYNAMIC/W4A4_FLATQUANT_DYNAMIC 时跳过。eps 只注册 1e-5 与 1e-6。静态量化及部分带 bias 候选依赖 custom op；无 bias dynamic 候选不全部受此门控；MX 另有设备/符号或 capability 条件。main 删除旧 SP 变体，不能跨版复制候选数量。 | 旧三线 `norm_quant_fusion_pass.py` 684–730；main 365–393 |
| W0031 | 默认 True；BF16，发现上游 `Attention`，取首个 layer 的元数据且 head_size=128；每个 eps 注册无 bias/带 bias 两种。首层不匹配不会自动挑第二层。GLM 的非该 Attention 结构不能因开关 True 就宣称实际融合。 | 四线 `qknorm_rope_fusion_pass.py` 192–225 |
| W0078 | 旧三线 JSON 键存在即优先（包含0），否则 ENV 整数解析，ENV 未设默认1；但实参先求值，非法 ENV 会在 JSON 覆盖前报 ValueError。helper 先跳过 FP32/meta，再处理310P强制NZ，再判0/1/2。普通 W8A8 linear 经 helper，MoE 直接 format cast，mode0不是全模型禁NZ。main 无该 ENV兼容项，正式int字段并校验0/1/2，helper新增末两维单维为1跳过与硬件策略。 | GLM config 249–254/335–346、envs 92、utils 261–298、w8a8_dynamic 127–149/353–360；main config 501/538–555、utils 329–383 |

通用入口三线复核：`LLM(**kwargs)` 将参数交给 `EngineArgs`（base 305–344、rc 294–333、main 298–338）；CLI `--additional-config` 在 `arg_utils.py` 1489/1567/1714，字典 JSON 转换分支在 374–376/379–381/389–391，传入 `VllmConfig.additional_config` 在 2250/2394/2651。`VllmConfig` 声明在 `config/vllm.py` 360/375/426。三线 `PassConfig.fuse_norm_quant` 都在 `config/compilation.py` 121，属于 `compilation_config.pass_config`，声明默认 `None`，是上游 Inductor 选项，不是 Ascend 内嵌配置的 True 默认值。

外部 backend 与融合 pass 的关系以真实调用为准：GLM compiler_interface 282–301 的 backend 关闭分支仍进入 `fusion_pass_compile`；完全关闭编译与仅关闭外部 backend 不等价。static 的依赖、图范围和平台模式仍必须一起检查。固定教程双机两条命令（269–290、318–340）没有 B9 JSON 和 NZ ENV 显式覆盖，结论仅对固定命令加默认环境成立，不是用户机器实测。

## 本轮真实执行证据

1. `python tools/wiki-runtime/fusion-layout-20261101/independent/verify_ast.py`：**83 passed / 0 failed**。从归档源码抽取真实 AST，受控替代依赖；验证旧三线默认值、错误字符串、未知键、static断言、硬件降级、ENV提前求值、NZ dtype矩阵/meta/310P优先级、四线QK候选门槛与muls标量。输出 `independent/ast-results.json`。
2. `py -3.12 tools/wiki-runtime/fusion-layout-20261101/independent/verify_pydantic.py`：**19 passed / 0 failed**。实际 Pydantic 2.14.2，执行固定 main 真实 `config_utils.py` 装饰器与 `AscendCompilationConfig` 类，硬件profile受控。覆盖 bool字符串、None、未知键、非法字符串、static/super依赖与继承、硬件先降级。另将真实 NZ int 字段交给 TypeAdapter，再执行真实 `_validate_user_input_ranges`，验证0/1/2、字符串转整数、None/非法文本拒绝、3/-1范围拒绝；没有构造完整 AscendConfig。输出 `independent/pydantic-results.json`。这是本机依赖版本的分支验证，不是对部署镜像Pydantic版本的确认。
3. 独立以写作前快照生成两份真实 diff：`independent/npugraph-ex.review.diff`、`independent/tensor-layout.review.diff`。逐项对照作者保留清单，旧教学数字、四个 calc、部署前提、推断/待核、误解、链接与机器尾注均保留。五图逐字哈希一致，见 `independent/diagram-preservation.json`；已全文核图中数据顺序、模式分支与正文无冲突。
4. 独立执行9条 `pnpm -s wiki:find "查询词" --json`：`ascend_compilation_config`、`fuse_muls_add`、`fuse_norm_quant`、`fuse_qknorm_rope`、乘加融合、归一化量化融合首条均为 `npugraph-ex / exact`；`weight_nz_mode`、`VLLM_ASCEND_ENABLE_NZ`、权重NZ模式首条均为 `tensor-layout / exact`。结果附已核版本字段，存于 `independent/retrieval-results.json`。
5. 实际逐张复看作者浏览器产生的 `01-fusion-first.png` 至 `21-ui-search.png`。范围覆盖两页首段、五图、访存/归一化/NZ补齐算例、参数与优先级表、版本长表、配置 JSON、检索结果及双向配置跳转落点；图文一致，没有新增遮挡或横溢。浏览器操作由作者执行，独立审查者复核截图与操作结果，不冒称亲自执行了浏览器点击。作者 `ui-search.json` 为14/14，`cross-links.json` 为2/2；`layout-widths.json` 两页各5表全部不超过961px，父容器scrollWidth=clientWidth。最终第10张验证缩短表头后的版本表，第20张验证参数表层级表达。
6. 阅读本轮仓库验证日志：wiki:build与check:content为167页；wiki:lint通过、8条既有非阻塞提醒；wiki:diagrams为331张一致；audit-final.log为4913来源、4648行号有效、0无效commit/文件不存在/越界、强制名单104/104通过。265个URL未联网与1622个raw引用待核仍是全库审计边界，不被“通过”覆盖。作者报告typecheck会话61922 exit0且无输出，Vite生产构建46.51秒exit0；本审查没有重复执行这些全库命令。

终稿哈希存于 `independent/final-page-hashes.json`；两份真实diff已更新到最终表头版本。短表头没有删去参数全名、固定版本或默认值，完整名称仍在配置区与来源钉点中。

初学者前两屏复述：融合是在图中把满足规则的一串调用换成融合实现，潜在收益是减少中间张量外写回读，代价是编译准备与数值验证，捕获回放是另一层；ND/NZ则保持有效元素数值而改变存储顺序，按块方便接口取数，需要格式搬运与可能的补齐空间。两页都先出现直觉图再进入计算，图前无 calc；首屏无需源码符号即可理解概念与成本。未发现定义或教学顺序的 P1。

## 审查发现与关闭要求

| 编号 | 严重级别 | 发现 | 当前状态 |
| --- | --- | --- | --- |
| R1 | P2 | 原版本表只写 main super 默认False会漏掉显式static且省略super时的before-validator继承。 | 已关闭：版本表明确省略继承条件，真实Pydantic验证通过 |
| R2 | P2 | 只讲JSON优先，未说明非法ENV实参先求值，容易错误承诺JSON覆盖能绕过非法ENV。 | 已关闭：配置优先表与错误表均写清，并有真实AST复现 |
| R3 | P2 | 三融合参数不能只解释算子作用，须给dtype、eps、标量、层类和custom-op条件；避免把True写成命中。 | 已关闭：规则表、教学解释与源码区补齐；W4A4来源扩到657–738，main候选差异单列 |
| R4 | P2 | 不可把同名上游 `PassConfig.fuse_norm_quant` 及其默认值当作 Ascend 内嵌配置。 | 已关闭：怎么开区明确分层与None/True区别，三线独立来源已追加 |
| R5 | P2 | 初稿 tensor-layout 怎么开误写 `is_nz`；真实策略函数为 `_should_trans_nz`，会误导代码定位。 | 已关闭：最新正文与真实diff已核为正确函数名 |
| R6 | P2 | 作者浏览器检查发现初版融合版本表1062px超过961px内容区，影响实际阅读。 | 已关闭：缩短列名与默认字段标签；独立复看第10/20张截图和layout-widths.json，数据/条件保留且无横溢 |

## 未实测边界

没有 NPU、生产镜像、模型权重或外部 npugraph_ex 包运行环境；未测实际FX匹配、融合计数、算子正确性/性能、NZ物理内存、GLM量化描述逐层内容、部署镜像具体依赖版本。受控fixture证明分支行为，不证明全链路可运行。main 迁移后的全部量化消费者未全仓扫描，本次对 mode0 非全局禁NZ 的消费者结论以固定GLM普通线性/MoE路径为准。

本次文档验收范围内没有剩余待办或需用户决定事项；上述 NPU、部署镜像、量化包与全库URL/raw边界继续保留，不能据本次验收删除。
