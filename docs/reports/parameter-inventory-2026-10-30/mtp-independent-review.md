# B5 MTP 五参数独立审查

审查日期：2026-11-01。审查者为本批新建的 `mtp_independent_review`，没有编写 wiki 正文。先读 [wiki 写作标准](../../wiki-writing-standard.md)、[知识库读页规矩](../../../wiki/AGENTS-GUIDE.md)，再读完整旧页、实际新页、before/diff、两图 YAML、固定源码、实际浏览器截图和验证日志。**本批五单元的文本、关键分支、保留性、图像与检索验收通过，没有未关闭的 P1/P2；最终构建通过。**

## 范围与证据

五项为 speculative_config 容器及其 method、model、num_speculative_tokens、草稿 enforce_eager，唯一主参考为 [Speculative decoding](../../../wiki/concepts/speculative-decoding.md)。主模型 eager、图模式与异步调度复用 B4/B3 的主参考，不另复制参数定义。

独立读取 vLLM 0fc695fc、568afb3a、84030bbe，与 Ascend db701c1f、2c59ff10、2ed6cbba、baa023ad。新增官方固定源码保存在 `tools/wiki-runtime/mtp-20261101/independent/`，EngineArgs、LLM 与 CLI 解析复用 capacity-kv 的钉点源码，四版 Ascend proposer 复用 main-graph 的独立下载。没有读取 tools/repos。GLM 模型配置独立取自官方 Hugging Face 固定提交 690b7052；旧来源 30 的 eb9eb208 保留，未用新模型钉点删除旧证据。

## 五单元事实核对

| 单元 | 独立结论与关键来源 |
|---|---|
| 容器与入口 | EngineArgs 默认 None；三个快捷字段逐字段合并，同字段双写即使同值也拒绝。None 且快捷项全缺省返回无配置，空对象会构造并因缺 K 被拒绝。baseline arg_utils.py L1665–1701，rc L1741–1777，main L1907–1943。CLI 点号解析支持等号、保留字段下划线；Python LLM 快捷项传给 EngineArgs。 |
| method | 基线字段集合及 17 个旧 MTP 名逐一与 Literal 对照；旧名归一为 mtp。rc 新增 dspark 与三个 MTP 名，main 再增加六个 MTP 名，表格准确；名称被字段接受不能推出 Ascend 实现支持。baseline speculative.py L34–96、L525–588，rc L36–104，main L37–83。 |
| model | 已给 K、model 为 None 且方法为 MTP 时复用主模型路径，未给草稿量化时继承目标量化。基线/rc 的含点裸字符串可覆盖显式 method 为 custom_class；main 只在 method 缺省时判断，要求至少两段 Python 标识符。同模型复用 main 优先 model_weights，否则 model，旧版只用 model。baseline L556–570，main L1104–1132。 |
| K | 正整数约束与后验检查存在；0 不是关闭值。MTP 层数与候选数不同，GLM 的一层可串行跑三遍。通用 n_predict 回填存在，但三版识别 MTP 后先执行 K>1，再回填；显式 MTP model 省 K 先产生 None 与 int 比较 TypeError，不能宣称自动取 1。baseline L715–727 与 L765–780，rc L895–905 与 L973–987，main L1334–1346 与后续回填。K 大于层数 n 时须整除 n。 |
| 草稿 eager | 四版实际门控都是 Runner 图可用且草稿字段不为真；随后先做禁补齐/FULL 检查，最后 GLM 强制关闭草稿图。None 与 False 不保证开图，False 不能绕过 GLM 或恢复主模型已关的图；True 可避开前置草稿图检查。GLM 警告仅在原先启用图且通过前置检查时打印。db gate L217–236/guard L284–294；社区 gate L215–234/guard L284–294；rc L200–219/L271–281；main L241–260/L322–332。 |

GLM patch 的 `hf_config_override` 在 L120–128 把 glm5_next/glm5_next_text 转为 glm5_next_mtp，将 num_nextn_predict_layers 赋给 n_predict，设置 Glm5NextMTPModel；L148–154 注册补丁与模型类型。固定模型 JSON L242 的预测层数为 1。正文对官方配方 K=3、deepseek_mtp 旧名、草稿 eager=True 的解释与以上条件一致。

独立运行 `python tools/wiki-runtime/mtp-20261101/independent-checks.py`，**114 条断言通过**，结果见同目录 JSON。脚本提取真实 `__post_init__`、`_verify_args`、EngineArgs 构造函数及 Ascend 图门控/保护函数体，使用轻量配置、模型与日志 fixture 执行，没有改写这些分支。覆盖缺省/空对象/只给方法/只给 K、改名、复用和量化、K 回填与更早 TypeError、整除、零负值、快捷冲突、main 权重路径优先、GLM 补丁、四版草稿三态与检查先后。

这是最小 Python 控制流复现，不是完整 Pydantic 构造、模型加载、NPU 推理或线上启动。K 的 int 与 gt=0 字段约束为静态读取；未把显式 JSON null 的字段校验冒称为实跑。GLM 补丁尾部使用本机 Python 不支持的新类型语法，测试只解析注册语句前的完整函数定义，执行函数体未修改。

## 发现、保留与写作标准

预审发现的 K 缺省顺序、草稿 None/False 与警告条件、GLM 保护晚于补齐检查、main 自定义类推断条件均已进入首稿，不将它们记作首稿遗留缺陷。首稿没有新增参数 P1/P2。提出三处一致性收口：frontmatter 图关系注释限定本站 FULL_DECODE_ONLY，证据归档的“异步调度自动打开”改成自动判定，流程图 rejection sampling 副文用“首个拒绝处补一个 token 后停止”兼容随机采样。写手修改后已逐处实读复核，三项关闭。

逐段对照本轮 before 与 diff，原有五块 calc 均保留：200 token/50 与 200 步、三词接受补抽、位置 5–8 后退到 8、接受率 0.6/0.2 的 1.68/0.96 倍、GLM 48 层次/4 与 128 个位置/32–128 个输出。猫/坐/在/床到垫子的教学链、bonus token、greedy 与随机算法及浮点边界、KV 覆盖与 prefix 登记、lookahead、KDA 状态与卷积额外空间、45+1 层、12 层 KV/13056 B、三组四块、七档、DP 陪跑和通信次数仍在。异步与图的旧绝对句按固定部署条件校正；原来源 1–37 顺序、五项待核和性能未实测限制保留。另独立执行文本提取比较，`independent-preservation.json` 确认 37 条旧来源为新 63 条的原序前缀，五块 calc 与完整待核区逐字不变。没有新增机器审计尾注，也没有借去重删除机制与算例。

独立 `independent-metrics.py/json`：教学区 6787 汉字、0 行内代码、0 证据角标；全文 10327 汉字、70 行内代码，即 **6.78/千汉字**。全文角标 **30，C 23（76.67%）**；5 个 calc、首图前无 calc；源码区五个 H3 顺序符合标准。两图宽 900，保留既有结构与布局，首图明确 greedy，流程图注明本站固定 K 与 FULL_DECODE_ONLY。

## 检索、构建与图像

已读取写手 `retrieval.json`：13/13 个下划线、连字符和快捷选项查询，首项均为 speculative-decoding，匹配方式 exact。没有添加裸 model/enforce_eager 别名抢占其他主参考。`ui-retrieval.json` 的同一组 13/13 查询各显示一个匹配页，均成功打开主参考，最终 UI 搜索截图独立读图通过。

审查者用图片工具实际打开写手产出的 18 张最终截图（01–15 和三张回链），以及一次后来被覆盖的异步链接未跳转画面。覆盖首两屏、猫例图、动机与算例、流程图及图注、新参数表上下、缺省和复用、完整方法集合、草稿 eager 矩阵、报错表、版本表上下、加速/减速 calc 与 UI 搜索。长参数名、合法集合和新增表格正常换行，没有文字叠压或图框溢出；布局保留，流程图首拒绝处的改文已生效，图注明确固定 K/FULL_DECODE_ONLY。`ui-links.json` 与三张目标截图确认主模型图、异步配置准确到各自“怎么开”，部署前提准确到部署页相应段。异步链接第一次点击没有离开原页，独立指出后重试并读到正确目标，不将首次画面计作通过。浏览器操作由写手执行，审查者独立读图与核结果，没有冒称自行重复操作浏览器。

已读本轮日志：wiki:audit 为 167 页、4749 条来源，4484 条本地行号有效，265 条 URL 未联网验证，0 无效提交/缺文件/越界，1461 条 raw 引用仍待另核；写作标准 **104/104** 名单页通过。wiki:lint 通过，8 处提示不在本批页面；内容检查为 11 主题、167 页完整无重复；索引生成成功；331 张图与 spec 一致。产品 build.log 的 TypeScript/Vite 构建通过，2396 modules，23.92 秒；三处收口后的 **build-final.log 也通过，17.31 秒**。这些自动检查不替代上面的源码语义核实或实际图像验收。

尚未验证：真实双机安装版本、NPU 启动、接受率、时延/吞吐/显存与旧页五项待核。本次是固定源码与知识库交付验收，不把它替代硬件实测。没有需要用户决定的新问题。
