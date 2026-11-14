# B10 常用入口：独立审查

状态：B10 13 单元独立审查通过。已审实际四页全文、before/after、12 图 YAML，完成独立分支验证、桌面应用内浏览器阅读和检索。未发现未关闭的 P1/P2。

审查者：独立子代理 `/root/common_entry_independent_review`。未修改 wiki 正文；未读取 `tools/repos/`；未借用 B9 的审查结论。

## 范围与基线

13 个单元：host、port、config、chat_template、chat_template_content_format、trust_request_chat_template、model、served_model_name、tokenizer、tokenizer_mode、dtype、quantization、load_format。主页面为 api-server-entry、token、quantization、npu-worker-lifecycle；同概念的长解释只在指定主页面维护。

已读 wiki 写作标准、知识库读页规矩、B10 台账、四页现有全文，以及四页引用的 12 份图 YAML。版本依据为 vLLM `0fc695fc` / Ascend GLM `db701c1f`、社区 `2c59ff10`；rc `568afb3a` / `2ed6cbba`；固定 main `84030bbe` / `baa023ad`。官方固定源码直接下载到 `tools/wiki-runtime/common-entry-20261101/independent/sources/`。

## 已向编写者提出的实质检查点

| 检查点 | 源码结论 | 完稿要求 |
|---|---|---|
| host 字段默认与 GLM 配方 | 字段默认 None；TCP 入口使用 host or 空串，GLM 显式 0.0.0.0 不是字段默认 | 分开写定义、有效监听和部署取值 |
| config 的模型入口 | 公开 parse_args 先将 --model X / --model=X 告警并改写成位置模型，再合并 YAML；真正没有任何模型来源才拒绝 | 不把私有合并函数单测当完整 CLI 行为；不把 ModelConfig 默认值当 config 入口必然兜底 |
| YAML false 的版本差异 | base/rc 忽略 false；main 对已注册负开关生成 --no-xxx，未注册的仍略过。空列表略过，null 转字符串 None | 不写三版完全一致，不把 YAML null 当 Python None |
| 模型名优先级 | serve 的位置 model_tag 最终覆盖 args.model；别名列表接收多个名称，返回和指标取首项 | 模型文件路径、客户端别名、HTTP model 字段需区分 |
| 模板信任开关 | 禁止的是请求模板及 kwargs 内 chat_template；普通模板变量仍可传 | 不写为禁止所有 chat_template_kwargs |
| 模板与内容形状 | 显式模板、无 tools 时 processor、tokenizer、预定义 fallback；基线/rc 显式 content format 直接返回，main 仍检测并在不符时告警，最终采用显式值 | 省略模板不等于一定直接用 tokenizer；保留 main 检测行为的真实差异 |
| dtype auto | 实际消费者按平台支持序列和模型约束选偏好；pooling 另优先 half；FP32 不是恒定转换 FP16 | 描述实际分支，不能只抄字段帮助文本 |
| quantization | 上游配置校验可能先拒绝方法冲突；Ascend 后续探测尊重已有非空值。GLM/社区 FP8 探测有 A5 条件，rc/main 探测已无此条件 | 自动探测成功不等于硬件、算子和 checkpoint 能加载 |
| 浮点回退 | 改描述中的 FLOAT 只选实现，不会恢复量化过程中丢失的数值或凭空生成浮点 checkpoint | 修正旧页“改描述就退浮点”的潜在误导 |
| load_format auto | 先看 consolidated safetensors 走 Mistral；普通 HF 顺序 safetensors→bin，pt 回退受 fall_back_to_pt 控制 | 不把 auto 笼统说成 pt；加载格式与量化、dtype 分开 |
| 模式注册表 | rc 删除 grok2/qwen_vl，增加 inkling；main 增 cohere/deepseek_v41/kimi_k3；rc 删除 gguf loader，main 删除 bitsandbytes 增 ipc_cache | 按固定版本注册表说明，不把所有名称列成 Ascend 支持保证 |

## 独立可复现验证

命令：`python tools/wiki-runtime/common-entry-20261101/independent/check_branches.py`

本轮结果：`PASS 143 independent fixed-source branch checks`。逐例输出保存于 `independent/branch-results.json`。

方法：从独立下载的官方固定文件提取原函数 AST，保持函数体不改，提供明确的外部依赖替身和临时文件。覆盖三版 YAML 合并、公开 parse_args 的模型参数改写、缺失/重复/扩展名错误、false 差异、别名选择、dtype auto、模板信任守卫、tokenizer 模式选择和冲突、加载文件选择/缺失；四版 Ascend 的量化探测优先级与 FP8 条件。格式为 pt 的分支实际选择 `.pt`，普通 auto 的 bin 回退选择 `.bin`。审查过程中曾将私有 `_pull_args_from_config` 的直接调用结果误推至公开 CLI；经编写者指出前序改写，已增跑完整 parse_args 方法（真实 argparse 基类）并更正结论。

边界：这不是安装完整 vLLM 的服务集成测试，没有启动 HTTP 服务、加载真实模型权重、访问 NPU、执行量化算子或双机压测。受控分支结果不升级为上述环境的实测证据。

## 实际稿发现与关闭

首次实际 diff 审查发现以下 P2，写手已修订，本轮逐项回读关闭：

1. api-server-entry 的请求模板守卫把“非空”和“出现键”作为拒绝条件，遗漏空字符串与 null 区别。实际判定为 `is not None`：空字符串仍拒绝，kwargs 的 chat_template 为 null 则不拒绝。已增加三版共 9 个真实守卫分支验证。
2. 同页新增来源尾注把模板守卫指向来源 5（模型名检查），正确为来源 8（serve/render/serving.py L452–L471）。影响结论可追溯性，需更正。
3. 同页 rc/main 的 argparse_utils 新引用末行越界，已修正为官方文件末行 590/611。
4. 同页最初未区分 main 显式内容格式仍做检测；已限定基线/rc，并在版本段写明 main 的告警及显式值优先。独立真实函数验证覆盖此差异。
5. quantization 最初把 quantization_config / 在线简写称为 main 新增；base 与 rc 的 model.py L210–214 已有同项，已改三版都有。
6. Worker 新增文件模式未转义，浏览器把成对星号当作强调，显示丢失通配符。写手转义后重新构建；独立刷新页面确认 *.safetensors、*.bin、*.pt、consolidated*.safetensors 全部完整显示。

已检查四页完整 before/after：既有 aliases 全保留、sources 的旧顺序前缀保持不变、全部 calc/wiki-diagram 代码块逐字不变、机器维护尾注不变。最终数据、正文 SHA256 和新增来源范围在 `independent/final-static-review.json`。49 项新增固定来源全部能在独立下载文件中定位，起止行合法。

## 实际阅读与教学检查

在独立后台 IAB 标签打开 `http://localhost:5202/#/wiki/api-server-entry`，逐页阅读 API、token、quantization、npu-worker-lifecycle；查看四页首屏/首图、新增表格、版本说明和 Worker 读盘 calc。截图与 DOM 阅读记录在本轮独立浏览器工具返回中。实际点击 API 的“分词器来源”到 token 的“怎么开”、quantization 的“Worker 加载入口”到 Worker 的“怎么开”，均定位正确。修订后重载 Worker 页面，完整匹配模式已肉眼和渲染文本复查。

最后一轮构建后再次刷新，独立查看 API、Worker、量化三张旧版本表的实际截图：均完整落在正文栏内，首列缩短后仍能清楚对应各版本。量化表前移出的完整路径和版本钉点已回读；API 的旧 main 渲染基线与 B10 新 main 核对范围仍明确区分，没有因压缩排版丢失这些事实。最终正文哈希及保留性统计已重新读取。

以开头两屏建立的理解复述：

- API 入口把消息转换成编号、设置及请求标识，留下回程接收位置再交引擎；这些字符串与请求记录处理占主机资源。
- Token 是词表编号代表的文本单元，编号和序列位置不同；切分决定序列长度，配套词表不可随意替换。开头先解释编号，后文展开词表大小、计算和历史存储的取舍。
- W8A8 将数值存窄并保留缩放系数，加载或计算时按对应规则使用；首图直接展示舍入和溢出截断，字节收益伴随误差。
- Worker 是一张设备的执行者，先选卡建组、装权重，再量预算建缓存和预热录图；前一步的产物被后一步使用，启动耗时与设备资源准备需分阶段看。

没有把主机分词、YAML 转换、加载器注册存在性等同于 NPU 实际运行。保留了 GLM 量化描述文件缺失、真实 tokenizer 编号未测、设备 trace 和双机性能未测等原有待核边界。

## 独立检索

实际执行 `pnpm -s wiki:find <query> --json --limit 5`，15/15 查询首位命中指定主页面：13 单元加“监听地址”“权重加载格式”。host 使用 frontend.host 精确别名，以保留原来主机内存页的 Host 含义。完整查询和返回保存为 `independent/retrieval-results.json`。

另外在真实页面目录输入 load_format、--host，均出现 1 个正确匹配页面；点击 --host 结果成功进入 API 入口。CLI 的前导 -- 会被工具当选项过滤，故没有拿这类 CLI 空查询冒充命中；--host 的实际检索由浏览器验证。

## 写作约束与保留性

下表为独立统计：剔除 frontmatter、机器尾注及 fenced code，按非空白 Markdown 字符计数；教学区截至“对照源码”之前。该口径与纯汉字数不同，原始数据见 final-static-review.json。

| 页面 | 教学区行内代码/千字符 | 含源码区行内代码/千字符 | 全页角标 | C 占比 | 教学区角标 |
|---|---:|---:|---:|---:|---:|
| api-server-entry | 0.00 | 3.89 | 0 | 不适用 | 0 |
| token | 1.14 | 2.52 | 26 | 61.5% | 0 |
| quantization | 0.75 | 1.74 | 29 | 79.3% | 0 |
| npu-worker-lifecycle | 0.00 | 9.03 | 30 | 73.3% | 0 |

原图、演算与机器尾注均保留，新内容集中于现有“对照源码”结构，不新增重复的参数专页。开放问题：无需要用户决策的事项；上述硬件与真实模型实测仍属明确保留的证据边界。
