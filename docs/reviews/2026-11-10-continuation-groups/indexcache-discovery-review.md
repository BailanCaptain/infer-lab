# IndexCache 官方覆盖反查：独立发现与补证

审查者 `/root/groups_recompute_review`；状态是作者修订前的发现与补证，尚非教学终验。未修改教学文件。初始快照 `.tmp/continuation-groups-2026-11-10/indexcache/review-before.zip` 含正文和三图的 YAML/SVG 共 7 文件；原 24 项来源不重开、不重计。

## 已确认缺口

P2：`sparse-attention.md` 首个图后只提“跳过 top-k 可读缓存”，没有解释官方 IndexCache 的 F/S 角色、配置入口、共享什么、适用模型或代价，末尾仍把调用方条件整体列待核。学习者无法从已有概念连接官方 `--hf-overrides` 命令。应补先算一份位置清单、后层复用的例子，说明每层仍做自己的主 attention；位置复用可改变输出，pattern 不能仅凭复用比例决定。

P2：必须分开主干跨层与 MTP 跨草拟步骤复用。固定 GLM 的主干专用 wrapper 默认不跳，MTP predictor 无 setter，不能由 HF 字段推断有效。rc2/main GLM 有 setter、wrapper 转发、proposer 首步重算及后续切换/行整理；复用时仍更新 KPool 压缩 cache 与 raw tail。只看到公共 SFA `skip_topk` 不足以给所有版本和模型相同结论。

## 实际消费者与证据

完整候选记录 `.tmp/continuation-groups-2026-11-10/indexcache/review-evidence-additions.json`：69 个候选，38 建议新增、1 复用现有第 5 项、30 仅记阅读域；不能把候选数等同最终来源数或官方全文数。每项保留固定 ref、原文摘录、SHA、独立支撑句。

四版 DeepSeek 模型按 `index_topk_freq`、`index_topk_pattern`、默认 offset 2 决定是否跳过；pattern 非 null 时优先，只有大写 S 进入跳过，短 pattern 以外层不跳，未做完整内容合法性验证。频率 4 从第 0 层起是 FFSSSFSSSF…，不应写成从第 0 层严格 FSSS。标准 Ascend 的 F 层发布共享位置由 SFA 的 `use_index_cache` 或共享层配置控制；模型选择 S 未看该开关不意味着可以省略官方显式 true。

rc2/main registry 虽转向 `vllm.models.deepseek_v32`，实际平台入口仅 CUDA 选 NVIDIA 实现，OOT 的 NPU 回到 `deepseek_v2`。已读 registry、平台选择和真实消费者，避免引用一个存在但未调用的旧文件。通用 DS indexer 与 GLM KPool 不同：前者返回选出的 tensor，再由 SFA 发布；后者在 main 直接 copy、rc2 以 output_buffer 写共享清单。

本轮没有 NPU 运行、质量评估、性能或任意 PP 分段保证；不把通用 DSA 支持迁移为 GLM 主干支持。维持官方显式开关，也不把官方简化表格当完整源码条件。

## 官方全文与图表

固定 `docs/features/index_cache.md` 四版逐字节相同：54 行，SHA256 `ce06dcccc93422150760b8ccdb92a74dbaa1f74c31096330475fa786584be92e`。审查者曾误报 61 行，父任务据此复述；实际 git 核对纠正为 54 行，61 是示例 pattern 的字符数。本记录保留该更正。

官方明确链接的论文固定 v1，18 页已全文及实际查看渲染图，包含正文、参考文献、附录 A–D、图 1–4、表 1–5 与 Algorithm 1；逐页截图 SHA、PDF SHA、读域在 `review-paper-reading.json`。论文只承接机制和质量条件，实验模型、框架、硬件与本站固定部署不同，不能搬用收益数字。18 页按 1 篇全文记账，新增全局数量由父任务去重。

固定 HF `DeepSeek-V3.2` config 66 行全文另存 `official/deepseek-v32-ba658fb-config.json`，用于 architecture 注册链和 61 层例子；读取它不等于验证权重部署。

## 后续终验范围

`review-preservation-before.json` 保存旧标题、表、计算块、必须保留的教学主张。等作者修订后，独立核新增引用、原解释保留、首两屏复述、实际浏览器和新连接；冻结最终文件前不作验收通过声明。Sampling 自定义处理器增量已独立闭合，工程回执见其独审，不在本组重复计数。
