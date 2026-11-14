# 01/02 组整改独立验收

日期：2026-11-03。独立审查者：`/root/review_groups_03_04`；教学整改作者为 `/root/review_first_pages`、根代理及并行 rc2 作者。本审查者没有改写这两组教学正文或图。

## 验收结论与范围

本次覆盖范围内的整改通过**静态内容独立验收**，发现的尾项已经由根代理修改并经实际文件复读关闭，没有遗留的已确认 P1/P2。浏览器与 NPU 验证未进行，不能将此结论表述为视觉验收、真实部署运行或全部历史事实验证通过。

先收到写手“35 页与两对图已稳定、不再修改”的确认，再从 `phase1-pages.zip` 重新生成差异。按 inventory 比较 01/02 两组全部 48 页，42 页有差异，6 页无差异；完整读取全部差异，补读关键定义、公式、配置边界及前后文。基线已包含第一阶段及部分并行版本内容，因此本验收覆盖**基线之后的实际差异及必要上下文**，不冒称重新通读 48 页全文或逐条复验所有 rc2 内容。根代理对 `linear-attention`、`moe` 等页的修改及元数据清理也纳入实际差异，没有只按写手自报的 35 页清单筛选。

完整阅读的初始差异为：

| 产物 | 字符数 | SHA-256 |
|---|---:|---|
| `.tmp/wiki-remediation-2026-11-03/g01-independent.diff` | 32,038 | `269b56fb040ccb4037eb5dd84df9d825f59db8307d13bdd7e4e21dcfe2d3f8ed` |
| `.tmp/wiki-remediation-2026-11-03/g02-independent.diff` | 64,426 | `20c82f4be0c7195b047999a84b52ab0a10cc97d73b0eb383932d1a414dacbeac` |

审查期间新增修订后，完整读完 9,762 字符的 `g01-g02-independent-closing-increment.diff`，并复读修改后的 MoE、batch scheduler、Sinkhorn 图和七处过程叙事的实际上下文。最终差异与快照如下；字符数以 UTF-8 文本解码后的字符计，不是 token 数。

| 产物 | 字符数 | SHA-256 |
|---|---:|---|
| `.tmp/wiki-remediation-2026-11-03/g01-independent-final.diff` | 35,432 | `c94041140e82b08add033585548036c05a3ba7fb48c679e4efbd852143f350b7` |
| `.tmp/wiki-remediation-2026-11-03/g02-independent-final.diff` | 67,768 | `63cc3684a17edd85d640645dfe2a495e790f22b99ce99978af52464743d57e6e` |

## 独立发现与整改闭环

| 编号 / 级别 | 实际位置 | 影响与证据 | 最小修法与复审结果 |
|---|---|---|---|
| IA01 / P2 | `batch-job-aware-scheduler.md:225` | 正文已区分 full 与尾状态组，粗体仍说 decode 几乎不要新块，会把 full 组的增长周期误推广到临时借还。固定调度源码按验证位置安排并在拒绝后回退进度；正文 228–237 已说明这些条件。 | 改为“full 组通常隔多步才续块；尾状态组仍逐步借还”；保留 640÷4=160 的全接受、忽略起点与 lookahead 前提。实际复读 219–243，关闭。 |
| IA02 / P2 | `moe.md:343–347` | 原句“一半卡拿不到真 token，全靠补位走空”混淆源行与目的专家负载，与 EP 页 332/342、并发页 428/432 冲突；EP 派发按选中专家去向，源行为空仍可能收到真实工作。原同段还把所有额外开销断言为远小于矩阵乘，并把逻辑配对数当作实际搬运同比。 | 保留 R1、rank 4–7 和关联链接，明确源补位不等于无专家工作；成本按负载、目的地、复用和同步区分。实际复读修改段，关闭。 |
| IA03 / 原 P1 的图文尾项 | `layers-sinkhorn.yaml:3,82` 及对应 SVG；关联 `layers-and-hidden.md:237,391` | 正文已说明有限轮与 eps 下近似归一，旧图 caption 仍称 20 轮后“两个方向的和都是 1”。固定 `ops/mhc.py:31–35` 的分母含 eps，有限轮不能推成精确双随机。 | 保留全部矩阵数值、坐标和布局，caption 明确忽略稳定项、显示为近似舍入；③标题改成“行、列和接近 1”。重读 YAML 与生成 SVG 标签，并通过生成一致性检查，关闭。 |
| IA04 / P2 | `moe.md:355,361` | 新正文已区分旧原生 max 与融合 top-2 sum，版本节仍说三版“数学一致/语义不变”。固定 main `grouped_topk_router.py:59–128` 的组分数取 max，不能把旧融合多组路径概括为统一数学。 | 限定为本页 GLM 的 `n_group=topk_group=1`；多组筛选须分别核对。复读两处及 339 的反例回链，关闭。 |
| IA05 / P3 | `api-server-entry.md:580,589`、`sampling.md:1083`、`structured-output.md:599`、`tensor-layout.md:232,261`、`vllm-platform-interface.md:258` | 维护过程词留在正式解释；静态源码计数还被称为“本轮实测”。 | 转成参数钉点与版本边界说明；保留日期、commit、默认值、计数方法与未测限制。七处逐一复读，关闭。 |

## 原整改事项的独立复核

原 F01–F17 的详细初查证据保留于 `groups-01-02.md/json`。下表是本审查者根据实际差异与独立读取作出的结论，不以写手自查代替验收。

| 项目 | 复核结果与保留的信息 |
|---|---|
| F01 采样 / P1 | `sampling:313,323` 已区分 prefill 建状态、decode 新输入与历史状态、投机多位置；6 词表、T=1、top-k=3、top-p=0.8、73%/27% 的算例保留。无“每次重算全部前文”的残留于修改段。 |
| F02 mHC / P1 | `layers-and-hidden:219,237,239,391` 保留双随机的非负与行列和定义、总和约束，同时加入有符号抵消反例；入口稳定项、20 轮近似、两种参考循环不严格相同和未核融合数值等价边界仍在。独立重算 2.74/1.12/2.06/2.08 与总和 8，并验证全 1/4 矩阵把 [1,-1,1,-1] 混为零。关联图 IA03 关闭后此项闭环。 |
| F03 权重容量与读量 | lm_head、引擎、调度、prefill、prepare-inputs 等修改段不再把驻留容量、一次调用或理想复用当作实测 HBM 次数/瓶颈；embedding 仍明确按选中行查表。151.25 MiB、FLOP 及批宽例子与其理想前提保留。 |
| F04 MoE 路由 | 原生组最大值和融合 top-2 和已分开；原示意三个组的代表分分别为 [0.88,0.83,0.62] 与 [1.15,1.45,0.74]，独立重算确实选择不同组。保留偏置只用于选择的 grouped 条件、GLM 单组退化条件；IA04 已补版本节。 |
| F05 稀疏定义 | `sparse-attention:84–116` 从通用位置子集解释到 DSA 内容选择，DSA 留历史与纯局部窗口可回收区分；原重新归一化算例、局部+位置0的 15 格与密集 21 格图未删。位置清单复用与重新评分区分仍在。 |
| F06 prefill 与执行状态 | 通用定义允许分轮处理，4-token R1 的一次处理仍保留具体前提；DecodeOnly/SpecDecoding 是执行形态，不独立证明提示词已完成，单位置尾块反例保留。 |
| F07 环境与配置 | 环境读取收窄到当前进程，未暗示修改启动 shell 可热更新子进程；配置显式 false 的键优先级和独立配置字段仍在。 |
| F08 插件 | 安装、发现、白名单、导入、调用、设备可用性分开；唯一外部候选优先，多内置候选仅在没有外部候选时冲突；导入异常与函数执行异常的区别保留。已直接核固定上游加载与选择分支。 |
| F09 调度净进度 | 4 个验证位置不等于 4 个净推进；160 轮算例改为持续全接受、忽略起点及 lookahead 的理想周期。缓存组差异及非 GLM 支持保证均保留；IA01 已补首句。 |
| F10 并发通信 | 148.4 MiB/层、6.09 GiB/42层作为逻辑张量量级保留，4.15 GiB 跨 DP 量单列；不再把两种不同载荷相除当作真实链路/时延倍数。MC2 mask、同机/本卡去向、空闲 DP 的真实远端专家计算保留；图同步限定统计口径，IA02 修跨页残留。 |
| F11 短请求优先 | 首步两方案均 16；第二步分别 6 与 7，实际计算量不再称相同；先后次序和 TTFT 的步骤示意保留。 |
| F12 异步收尾 | 只有调度时可以确定在途步即使草稿全拒也达到长度上限才避免再排，197→200 反例保留；源码守卫与拒绝回退直接核读。 |
| F13 性能承诺 | 扩大 prefill 预算与 PD 分离的收益改为有条件的影响，保留排队、KV 传输、图模式与共享资源代价，没有删减可用调参解释。 |
| F14 KDA 容量 | 页面容量、每请求分配与有效状态载荷分开，85 MiB、95.6 MiB、18.2 MiB 等账及当前分组前提保留；未继续把 page 容量当作每步必然写量。 |
| F15 结构化输出 | 固定调用顺序确为先 `.to(cpu).float()`，再 `.to(device).to(original_dtype)`；两方向逻辑数据量 37.8125/75.625 MiB，合计 113.4375 MiB，独立计算一致；未把它们当成链路实测。 |
| F16 维护叙事 | 原草稿转述、未读源等过程语句改成实际可用的分支/支持条件；固定版本、未获得镜像安装产物、缺 NPU 实测等真实限制仍保留。IA05 补尾项。 |
| F17 流式可见性 | `streaming-output:172–174` 已区分首个输出 token 与可见文字，保留反分词、停止串缓冲、解析、发送间隔和网络；200-token 示例明确忽略额外差异。固定 detokenizer 的扣留字符与空增量分支直接支持该修订。 |

## 独立读取的原始证据

以下是本轮亲自执行 `git show` 并读到的范围，不把初查者的全站/官方阅读覆盖计入本次独立阅读。主要证据为固定源码，未在这一轮重新联网复读所有官方指南；官方扩读范围见原分组报告及根组总覆盖。

| 固定来源 | 本轮读取范围 | 核对目标 |
|---|---|---|
| Ascend `db701c1f:ops/mhc.py` | 全文 1–37 | sigmoid/eps、softmax 后稳定项、20 轮行列分母 |
| Ascend `db701c1f:ops/fused_moe/experts_selector.py` | 155–195、285–310 | native max 与 fused mode=1 |
| Ascend `db701c1f:csrc/moe/moe_gating_top_k/op_host/moe_gating_top_k_proto.h` | 30–45 | mode 0/1 的最大值/前两名和契约 |
| Ascend `baa023ad:ops/fused_moe/router/grouped_topk_router.py` | 全文 1–128 | main 原生分组、偏置的 grouped 边界 |
| 上游 `0fc695fc:vllm/v1/core/sched/scheduler.py` | 350–420、1390–1442 | 位置预算、提前停排条件、投机拒绝回退 |
| 上游 `0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py` | 448–503、767–796 | 滑窗跳过并释放旧块，反证稀疏必须全留的泛化 |
| Ascend `db701c1f:worker/model_runner_v1.py` | 2412–2435 | grammar 非空才 CPU 往返；返回设备后才恢复 dtype |
| 上游 `0fc695fc:vllm/plugins/__init__.py` | 28–82 | 发现、白名单、导入异常与入口执行 |
| 上游 `0fc695fc:vllm/platforms/__init__.py` | 212–281 | 外部优先、冲突、再次调用、懒加载 |
| Ascend `7d825229:patch/platform/patch_use_v2_model_runner.py` | 全文 1–63 | rc2 未设环境时仍返回 False；选择不等于全部组合支持 |
| Ascend `db701c1f:ops/triton/glm5_next_lightning_indexer.py` | 148–237 | FP32 临时 score 按 token 行分块、top-k 和尾部索引 |
| Ascend `db701c1f:ops/fused_moe/prepare_finalize.py` | 440–560 | 按 DP 最大宽度补齐、all-gather、reduce-scatter 张量口径 |
| 上游 `0fc695fc:vllm/v1/engine/detokenizer.py` | 47–166 | stop 缓冲、增量为空与可见文字边界 |
| 上游 `0fc695fc:vllm/v1/sample/ops/topk_topp_sampler.py` | 373–390 | top-k 严格小于阈值；之后 top-p |
| 上游 `0fc695fc:vllm/v1/sample/sampler.py` | 257–302 | all_greedy 提前返回与混合批逐行选择 |

Ascend Python 路径在上表中省略共同前缀 `vllm_ascend/`，C++ 路径不省略。数学复算为本机纯 Python 运算，没有导入/运行 Ascend 模型，也不是设备测试。

图检查实际覆盖 18 张图的全部 SVG 文字标签：attention-cost、concurrent-request-moe-switch、layers-sinkhorn、sampling-intuition、dense-sparse-attention，以及 layers-what、layers-one-layer、layers-and-hidden-intuition、layers-stack、moe-intuition、moe-router-calc、moe-batch-load、glm-flash-moe、moe-pick、moe-branches、sparse-attention-intuition、sparse-attention-path、sampling-flow。其中前五张还完整读了 YAML spec。对 mHC 原始手算矩阵可精确归一的教学示意，与固定实现有限迭代的近似结果作了区分；未重做已认可布局。

## 实际检查与限制

本审查者独立执行下列命令，日志在 `.tmp/wiki-remediation-2026-11-03/g01-g02-independent-<名称>.log`：

- `pnpm check:content`：exit 0，163 页、11 个主题，正文完整无重复。
- `pnpm wiki:audit`：exit 0，本地引用/行号有效，104/104 强制名单达标；明确不覆盖 URL 在线可达、raw 语义与所有结论。
- `pnpm wiki:lint`：exit 0，当时有两处非阻塞提醒，分别为其他组的 `rfork-startup` C 标记占比和 baseline 来源页 31 处标记。
- `pnpm wiki:diagrams --check`：exit 0，331 张图与 spec 一致；仍有全站已有图中文字提示，不等于视觉布局已验收。
- `git diff --check -- <48 页、3 对图及本报告>`：exit 0，无空白错误。

按根组明确限制，本轮没有使用 UI；没有浏览器实读、交互操作、3D 播放或 NPU。源码路径与数值推导通过不代替这些验证。未对未变化的六页重新做全文事实验收；未将写手完整阅读记录冒记为本审查者的独立阅读。此次发现没有需要用户决定的未闭合事项。

## 最终快照清单

以下 SHA-256 取自复审后的实际文件字节，供根组识别后续并发变化。完整 JSON 为 `.tmp/wiki-remediation-2026-11-03/g01-g02-independent-final-manifest.json`；`sha256_review` 为初读时快照，`sha256_final` 为闭环快照。差异“有/无”只表示与第一阶段 zip 的比较，不表示全文所有事实已被重新证明。

| 文件 | 基线差异 | 最终 SHA-256 |
|---|---|---|
| wiki/concepts/attention-cost.md | 有 | 9ba099b54d27844bf05d6416b4e2d07e885c6d31621359c94e5fa22ab1c9abc9 |
| wiki/concepts/attention-qkv.md | 无 | 81e9c51d7934ee3fec01ba898df3b350ebba4ff0b734ea1ac2ae96b01877d274 |
| wiki/concepts/deepseek-v4-1-flash.md | 无 | 968e06891d5bc32902f06cff862819380f2eddb3f54b17426d9f9f99ef348a21 |
| wiki/concepts/embedding.md | 有 | 6a8ff5a9e8b05eba0d21549089aec3d660ac6d505903bbe716cdbcecddaca504 |
| wiki/concepts/glm-5-3-flash.md | 有 | c2fa5ffff6db00d287ca46761f96ea17d1f3b99a8ec96b5134b96da6de061f11 |
| wiki/concepts/gqa.md | 有 | 5ca40cdbbd8f36b160c8a83d82c88d6cc8bfe74d36024ed3458963db17542fad |
| wiki/concepts/layers-and-hidden.md | 有 | 2efbf13be0703d741d604fcc068891a28200e7de435e4b7cfdf71eaca5cd124d |
| wiki/concepts/learning-guide.md | 无 | b29e0314d77b15600601052c35142fae3aa16353f90e4e4d8e3dc6bb49faf849 |
| wiki/concepts/linear-attention.md | 有 | 9cf0a3d91044f74c42aaa7ad1376eea848531c1bd7d28b4a847394f896fe47af |
| wiki/concepts/lm-head.md | 有 | 1d5be4cac1b9fb2281ead3977fd8b0a4ce3a1f5815834cbd39d1bbf5f4ae9b34 |
| wiki/concepts/matmul-and-weights.md | 无 | b7f7e6114f10bbae3423b18d11c3802ed5c215bd2f2fc7557161c7ae698670df |
| wiki/concepts/mla.md | 有 | 9fd77ec8ca4fde09b3ae1387f4a2e777413bf7f5dbcae0811777859e0c73aaa6 |
| wiki/concepts/mlp-residual-norm.md | 无 | e6b905e8ffe0b6076169782c7188535fa2df67a521f703e2e0edd07972174d9d |
| wiki/concepts/moe.md | 有 | d17e01864fef4ca5098360ecca93ee75b65cf963c71a9127cdc3fe027321e1bc |
| wiki/concepts/one-request.md | 有 | 34b2cbf44562f1acecbdba9a212184c0915cf195d5302dcc2453689620e62b63 |
| wiki/concepts/rope.md | 无 | 1e6cf8b373052eb1bcb4f61b17370bd6bf296b15fa8aa840e0d4cad262781cb4 |
| wiki/concepts/sparse-attention.md | 有 | f892023a6ecf48c06ac835f75eb854741189b8935d92767e6b5e7f6386123e19 |
| wiki/concepts/tensor-layout.md | 有 | 0206784b09b42f8abe4b11c3a8f4c6eacadf9cc73f703f543da9805a6f62cd29 |
| wiki/concepts/token.md | 有 | 27c6e847f86446e4f7a547f254f26bd60867a77cf0fab356be2855cdc19ed5c1 |
| wiki/concepts/api-server-entry.md | 有 | 16209ae45d71b61589bbd649698edc7cdbf6f0ce12f94ec3c894804bac25dbde |
| wiki/concepts/ascend-config-system.md | 有 | f68a0b8d87d6049393423ef060fca3a9a67076d42488ee88110f698e90d29f5b |
| wiki/concepts/ascend-patch-system.md | 有 | 54c558669e28d495fa8022fe286085cab7ad7f8a9bc35934c3124bc3257f6eaa |
| wiki/concepts/async-scheduling.md | 有 | 5fdf14079170b1c8e84109cf055f937b47ae3fdd6786394516dbf7e7b36976c5 |
| wiki/concepts/balance-scheduling.md | 有 | 21deb1e2c7a66c3aefdc303233724a6f980c035e5e541e7e026e114eab1a533b |
| wiki/concepts/batch-job-aware-scheduler.md | 有 | 0996057369ee0eb2bda5a3de96e84e6ea639847eed20e634b54c7b0ca7a7b85c |
| wiki/concepts/chunked-prefill.md | 有 | b061722e3798d3b426bb89ade1b4be25518f52f46e8bead90da071d2f97a9ddb |
| wiki/concepts/concurrent-requests.md | 有 | 07ecc563f601dc48a7465874f45718395e4745057922ddb4e191d42c7eba33a0 |
| wiki/concepts/dp-request-routing.md | 有 | ab598ae8f4d5b9e1df795acc9f36d1f0327e8cf83d1ba85e5f7690a2c5ce3379 |
| wiki/concepts/engine-processes.md | 有 | f89b755a885b8926a05cf32ba0e094d7fbe0268b2609059854cde6064718d0e4 |
| wiki/concepts/npu-model-runner.md | 有 | 80cd0c303b92cda4ceddf9fa292ff54d6c9c0dbe38ebf38124538233186fc4be |
| wiki/concepts/npu-platform.md | 有 | d19dbe03811e774f963126eaf9056fc192d619dd8016f7ec5d62060c8f11af66 |
| wiki/concepts/npu-worker-lifecycle.md | 有 | 019298c111d53c503f970fa0b4763af351f34355b111ee3c7e55aa778f2644ab |
| wiki/concepts/platform-plugin-registration.md | 有 | 774ef53b823d04a7e705eaed09aa12b55846b541f8903a9ccc28cee33e4f4302 |
| wiki/concepts/prefill.md | 有 | 261b1c691958df3ec41a51bf5dc76db7f479669cafc9bbf93d1c6f7b75794e6c |
| wiki/concepts/prepare-inputs-flow.md | 有 | f81d47b98b2ab9af8c9dd970ad9d886c22d2952277b1a9a420827cae4ea08ad3 |
| wiki/concepts/reading-vllm-ascend.md | 有 | 56ec5239837016a97b6fd92309f95d822274f24d1e4abf4e22f22d8c06a5083c |
| wiki/concepts/request-call-chain.md | 有 | 3017755e3f651eae45fdda90b5726abb1e136e305b0cad8841e4bf080a8d100a |
| wiki/concepts/request-teardown.md | 有 | 43322aeccd03b7e417483dff09864cd4b77ee39c13c0687fb7ba46493636360f |
| wiki/concepts/sampling.md | 有 | cbeb11b77bb0e114f7c69b6a0fef836a5c4d2f78f07ce69d9860d4a00f62a048 |
| wiki/concepts/short-request-first.md | 有 | 31a34d96e3a4f97ae41f8cc9cf7ff332328b0c091b7ae796463a00bfa2a9d7aa |
| wiki/concepts/streaming-output.md | 有 | 469fe3e2c95f7f659db9ac1a4899017cf6cb7d2aaa251495a207f4df35b9e78e |
| wiki/concepts/structured-output.md | 有 | 22f81405c5edac783f63aa2bccff41d49193584b11721b97857d57fa1af700e4 |
| wiki/concepts/vllm-ascend-overview.md | 有 | d13c95ea592ba22ed58c5c2493eb0b4f6e3b39d5e7b83dd59040a9e29b32b57d |
| wiki/concepts/vllm-ascend-repo-map.md | 有 | 185f427a0bf2e86376962667ee7143505d02b7f474b28ff6659c9170035d3532 |
| wiki/concepts/vllm-engine-core.md | 有 | af9825b4c28a4e835bb5597f4094adf84cbbe5d79222934b273a4cc0fa224267 |
| wiki/concepts/vllm-platform-interface.md | 有 | f790047e61d3345caf1a01a618225902b85a0ff42eca1a1c8caf3a6569e4f7fd |
| wiki/concepts/vllm-scheduler.md | 有 | 7a95879e9f689f29271c642c57ebd134b05aa4ca72f529929258dfee94b6e55c |
| wiki/concepts/vllm-v1-shape.md | 有 | ffe7f5baa4b247f5dbfff0fc987b3d60c3b0dff4aac6c49e49a000f8720184bd |
| wiki/diagrams/attention-cost.yaml | 有 | d98b41f465ef1f58a1a4dda62416a10cd3237b2f2e01d242dbd6f88db78895c6 |
| wiki/diagrams/attention-cost.svg | 有 | 30ba2a5fb1c951cb386a6657b6cb3db53a675b95c8fa38684fe06bca64b1fd18 |
| wiki/diagrams/concurrent-request-moe-switch.yaml | 有 | 0c2a6da6bb89660bb7eb97dc2e7e81d2608277c0477f4d1768b0712a98f34821 |
| wiki/diagrams/concurrent-request-moe-switch.svg | 有 | 1b217ac3c89d45a5acc32878be885c460c5718626433fe3ecccdee00760ad6ca |
| wiki/diagrams/layers-sinkhorn.yaml | 有 | 14a36f36188feacf96e048e9aeaa270f26f8a07539685b49bdd4ebdc656b8abd |
| wiki/diagrams/layers-sinkhorn.svg | 有 | 40004c5fcd4d9636820551a3ecf50aa6299ddaaa31fc1f08e0bd84a6cfa0db89 |
