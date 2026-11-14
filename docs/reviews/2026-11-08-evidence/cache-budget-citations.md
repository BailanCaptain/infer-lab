# 缓存基础组：串行续跑交接（未完成）

## 状态与边界

- 按用户最新指令于安全检查点暂停。**未完成整组核验，未独审，未做浏览器验收。**
- 独占页面：kv-cache-spec、kv-cache、kv-cache-memory-profiling、vllm-kv-block-allocation、prefix-caching、kv-cache-cpu-offload、kv-cache-layerwise-offload、kv-cache-sparse-offload、recompute-cpu-offload、kvpp。
- 10 页正文（含 frontmatter、正文、页末、版本表）已完整读完。原有 392 条 sources 已逐项取得并阅读指定范围；相同字节区间复用已读内容，不代表各页主张已全部判定闭合。**本轮尚未把全部逐项语义判断落到账本，不能将 392 计为支持或完成。**
- 增补 5 条固定来源（spec 1、prefix 2、sparse 1、recompute 1），均已在修订前实读；当前预计 397 条，以配套 JSON 实际计数为准。
- **没有启动任何审查子代理，sessionID：无。**曾读取 OpenCode CLI 帮助以准备独审，尚未调用 `opencode run`，之后按用户指令暂停新增审查。
- 未修改旧组总账。基线继续用 `.tmp/wiki-evidence-resume-2026-11-08/baseline`，没有从 HEAD 覆盖任何正文。

## 阅读证据在哪里

定点提取器：`.tmp/wiki-evidence-resume-2026-11-08/cache-extract.py`。只解析上述 10 页 sources 并执行固定 `git show <commit>:<path>`，没有全库扫描上游仓库，也没有自动判断支持。

提取结果在 `.tmp/wiki-evidence-resume-2026-11-08/cache-sources/<id>.txt`；每条以 `SOURCE <编号>: <完整引用>` 开头，实际源码行号随行保留。`manifest.json` 保存原 392 条引用的 blob/range SHA256、引用区间和字节复用映射。

提取器初版有“复用比较可能越过前条引用结束行”的问题，已修成严格限于前条引用范围并重新生成；现行文件是修正版本。spec 前半最初按旧输出读，后半按修正输出读；今后如要求机械证明阅读覆盖，重新打开 spec 1–41 的修正输出核齐复用边界。不要把原始提取日志当成自动语义认证。

| 页 | 原 sources | 本轮实读摘录输出范围 | 当前 source 数 |
|---|---:|---|---:|
| kv-cache-spec | 63 | 旧输出 1–1963；修正版 1920–3027；补读 engine/core.py 235–270 | 64 |
| kv-cache | 46 | 修正版 1–1081 | 46 |
| kv-cache-memory-profiling | 44 | 修正版 1–1316 | 44 |
| vllm-kv-block-allocation | 40 | 修正版 1–1209 | 40 |
| prefix-caching | 29 | 修正版 1–535；补读 Mamba 分配/回收 | 31 |
| kv-cache-cpu-offload | 26 | 修正版 1–809 | 26 |
| kv-cache-layerwise-offload | 34 | 修正版 1–1180 | 34 |
| kv-cache-sparse-offload | 39 | 修正版 1–1259；补读后续 SparseKVOffloadConfig | 40 |
| recompute-cpu-offload | 33 | 修正版 1–1161；复用已读 BlockPool 初始化 | 34 |
| kvpp | 38 | 修正版 1–1018 | 38 |

JSON 的待判条目明确记为“已读待逐项落账”，不是支持。已手工落账的条目只覆盖下面实际修订所依据的主张；同条来源的其他用途仍须结合完整页面核对。

### 外部原文

- PagedAttention `https://arxiv.org/html/2309.06180v1` 已在线读取，实际覆盖正文开头至 §4.4，尤其 §2.1–2.2、§4.1–4.3；输出在 `C:/Users/-/.local/share/opencode/tool-output/tool_1b740a4770016EGAIQ0hZ2ZSXA`。**没有通读全文后半**，不把下载全文计为全文阅读。
- DeepSeek-V2 `https://arxiv.org/html/2405.04434v5` 已在线读取，实际覆盖到 §3.1.2 标题，尤其完整 §2.1.1–2.1.4（联合压缩、RoPE 段、元素数公式）；输出在 `C:/Users/-/.local/share/opencode/tool-output/tool_1b740a73e001Pp7m8cryitaMTd`。**没有通读全文后半**。
- GLM 配置固定 revision `690b705278a3a58e538fcb37c2ca8b5f9511213c` 的 resolve/config.json 已在线取到并读取 text_config、vision_config 及前部量化字段，层型/512 latent/128 index/64 KDA 头/卷积4/MTP1/RoPE0 均可定位；输出在 `C:/Users/-/.local/share/opencode/tool-output/tool_1b740a73f001oRC20ZGPx6Q6Ht`。长 modules_to_not_convert 尾部被工具截断，**没有宣称全文读完**。
- issue `https://github.com/vllm-project/vllm/issues/56830` 已读正文和返回的评论。H100 v0.29.0 释放显存失败/持有成功是社区复现，不升为 Ascend 实测；评论含其他设备和后续版本，未迁入正文。
- PR `https://github.com/vllm-project/vllm-ascend/pull/16510` 已读主题、作者说明、改名/MRV2 提交及 merge `9eb752ab`，后续长引用自动截断；输出在 `C:/Users/-/.local/share/opencode/tool-output/tool_1b743ad4a001se2b4Cj7uY3nK5`。PR 讨论仅支持历史身份，运行时行为仍按固定源码。
- sources 中 GitHub blob 文档由同仓、同 commit 的原始 git blob 读取，包括完整教程 `0576b647` 与后续联合卸载指南 `921ccc52`；**未逐个联网点击 GitHub blob URL**，本地取得原文不等于联网可达性验收。
- 本轮未发现原文取得失败；剩余外部全文阅读、文内直接事实外链枚举与可达性仍未完成，不能据此宣称全站无不可取得原文。

### 额外实际读过的范围

- `vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L958-L1053`：align 回收与候选保护。
- 同文件 `#L1121-L1269`：none/align 分配、null 补位、复用候选块、状态登记。
- `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L725-L752`：waiting 的 effective_lookahead_tokens，正常非异步加载保留 lookahead。
- `vllm@0fc695fc:vllm/v1/engine/core.py#L233-L279`：先收规格、后 profile、再构建 KV 配置。
- `vllm-ascend@921ccc52:vllm_ascend/ascend_config.py#L1654-L1673`：enabled false、topk -1、DRAM110、默认 use_fused_copy_sfa = enabled and not use_fused_overlap。

## 已手工修订（尚待独审）

| 级别 | 文件 | 已处理主张 | 原始依据 |
|---|---|---|---|
| P1 | prefix-caching.md | all 是每个块边界；align 只留对齐的调度步终点，不是每跨 640 就留档；加入 0→7680 例子、null 中间占位、旧档可回收/淘汰 | cache.py 133–141；single_type manager 1018–1046、1121–1230；GLM aligned split 34–55 |
| P2 | prefix-caching.md | 区分命中活动块与空闲块；登记留存不等于继续独占容量 | block_pool.py 402–441 |
| P2 | kv-cache-memory-profiling.md | 页末仍写“漏量只偏低、不超过单层”，与正文冲突；改为不能推出统一上下界 | dummy metadata 3332–3460、SFA早退1660–1666、KDA早退487–489 |
| P1/P2 | kv-cache.md | 首屏定义限定普通因果 attention 并接上 MLA/KDA；R1 的 15–16 状态块加 full 1 块才是 16–17 总块 | 已读缓存规格、分配公式及普通注意力论文 |
| P2 | kv-cache-cpu-offload.md | 段约束比较 token 块长，不是页字节；prompt-only 默认下，尾段不会靠 decode 凑满后保存 | offload/base.py 407–442；scheduler.py 733–748 |
| P1 | recompute-cpu-offload.md | CPU BlockPool 同样永久保留 null block；16384 总块只能容纳一条8192块请求，第二条差1块；GLM预算128总块可借127 | manager.py63–118、133–156；block_pool.py149–177 |
| P2 | recompute-cpu-offload.md | 区分配置名 PreemptOffloadConnector 与实现类 PreemptOffloadConnectorV1 | kv_transfer/__init__.py118–123 |
| P2 | kvpp.md | bool 入口是 Pydantic 转换；首层广播可与缓存访问前投影重叠；容量取各卡块数最小，层数最多只在等预算等层字节下成立 | ascend_config.py52–77；mla_v1.py2057–2061；kv_cache_placement.py33–44 |
| P2 | kv-cache-layerwise-offload.md | 理想重叠公式补双向传输、存出、带宽条件；后续层预取等提交时当前层 attention gate，不是等目标层自身 | pool_worker.py1356–1383；memcache_comm_fence.py64–82 |
| P2 | kv-cache-spec.md + kv-cache-spec-flow.yaml | 流程改为先量显存再引擎分组；普通页公式限定未打包主数据，补量化特殊布局；四个组更正五组三种块长 | engine/core.py235–270；kv_cache_interface.py159–200、353–384 |
| P2 | vllm-kv-block-allocation.md | 按需容量例扣 null block；平均长度不是逐请求ceil后一定能容纳的充分条件；旧“未核卸载”改为本组已有边界链接 | block_pool.py149–177、单组求块与准入范围 |
| P2 | kv-cache-sparse-offload.md | 3 GiB只计2048主体位置，最多3尾部另加4.5MiB；明确不受支持的GLM变体估算；收益不只由命中率决定；补后续默认路径来源 | onload_topk_kv1215–1337；已读模型topk及本文载荷算术 |

只有上表列出的修订落盘；**没有宣称 P1/P2 全部闭合**。没有运行设备用例，修改前错误由固定原文与手算反例证明。

## 图阅读与生成状态

已读 YAML：`kv-cache-spec`、`kv-cache-spec-flow`、`prefix-caching`、`block-allocation`、`block-allocation-flow`、`kv-cache-memory-profiling`。只读了规格与文字，**没有实际打开 SVG/浏览器检查**。

本轮只修改 `wiki/diagrams/kv-cache-spec-flow.yaml`，**对应 SVG 尚未定向生成**。须先读 `scripts/wiki-diagrams.ts` 找到可定向调用的渲染入口；已 grep 到该 CLI 只有 `--check`，不能猜有 `--id`。避免运行全图写入覆盖其他组工作。

其余待读图：kv-cache、kv-cache-recompute、kv-cache-size、共享 block-table、kv-cache-lifecycle、kv-cache-memory-profiling-flow、kv-cache-cpu-offload、kv-cache-cpu-offload-cost、kv-cache-layerwise-offload-overlap、kv-cache-layerwise-offload、kv-cache-sparse-offload、kv-cache-sparse-offload-step、recompute-cpu-offload、kvpp、kvpp-broadcast、kvpp-flow。

## 续跑必须处理的未闭合项

1. **逐项落账与复核**：配套 JSON 只手工明确判定修订相关条目，其余不得从“已读”自动设为支持。将每条 source 对应的实际页内主张、条件、版本逐条补全。spec 的补充版本分配表（sleep pool、每层缓冲、存储块长等）现有 sources 可能不足，须定点补证。
2. **独审**：主会话按最新安排统一调度。读相对 baseline 的实际 diff、页面及原文，处理所有 P1/P2。此组没有可复用的独审 session。
3. **prefix 版本边界**：基础段落仍以“只认完整物理块”泛称；v0.26/main 的 partial-tail 登记已在 block-allocation 版本表出现。须明确老基线范围并说明哈希粒度与物理块不同。prefix 直觉图用“块0”作为实体前缀块，需明确是示意逻辑编号或改编号，避免与 null block 冲突。
4. **分配流程图**：block-allocation-flow 把每步 running 都画成先查前缀；实际查命中是 waiting 且 num_computed_tokens==0。图还省略了 full_sequence_must_fit 在 remove_skipped_blocks 前的准入检查，须明确简化分支而非声称唯一顺序。正文“常驻15–16”有一处缺“状态块”限定仍待修。
5. **跨组主线差异交主代理**：kv-cache 满长“约222块”，block-allocation 的稳定 decode 上限式为208+12+4=224；实际达到max_model_len会封顶lookahead，需按终点重新核，不能直接任选一个数。部署/one-request/concurrent-requests 的旧预算未扣null及平均容量推论也需统一。勿在本组越界改主线。
6. **profile 源码补齐**：v0.26/main 的源18–20引用从扣减后段开始，未完整覆盖其入口和最后建议日志；正文“扣减函数和试跑函数逐行相同”需用相应范围字节核对。第194行把3.4GiB叫激活峰值，实际假设为激活+非torch合计。第223行“唯一的实测来源”过强，可改为当前汇总日志入口。
7. **CPU offload 兼容史**：导入失败判断已读 imports/manager 签名，但尚未本轮执行固定路径存在性检查；删除commit c42981d034、PR13389历史尚未核。v0.26 blocks_per_chunk 新增也缺本轮对应上游范围。保留精确版本条件，必要时补引用，不能拿main证v0.26。
8. **layerwise 支持/实现范围**：缺KDA旧版未调用save钩子的定点证明、main save钩子范围、_parse_int_config/默认8定义、同版本整文件逐字相同断言的验证；现有引用17只覆盖load钩子。推导保留理想流水条件，图尚待相应核对。
9. **recompute 存量与顺序**：开篇“拷完才让块”是设备覆盖顺序的简述，调度侧实际上先还块再由worker在覆盖前同步拷；图/首段要统一。GLM KDA截取是否只保存首块的精确错误与后续行为尚未闭合；源码已有明确风险，不要仅用泛泛待核替代。main V1别名注册不能从类名推断。版本整文件相同仍须验证。
10. **KVPP**：原历史引入PR16094/16444及日期未核；组内owner也必须等广播源读完成（transport已读），正文“常驻卡直接用”宜补这一条件；开头“只能eager”仍须就近钉旧main，rc2已支持PIECEWISE。后续图需按实际等待点核对。变体算例“开后块数只会更多”未证，应收紧。
11. **Sparse**：main/旧镜像不存在该特性的否定结论须定点核入口、配置、目录；已有GLM变体不能变成支持声明。源32只证明量化开关派生，不证明与卸载兼容。模型/硬件/配置检查先后、per-query槽与req映射要结合图核对。
12. **外链、图、数学与浏览器**：继续枚举文内直接事实外链；目前只按sources抓取，不能声称无遗漏。论文仅阅读相关章节，全文缺口如上。图的实际视觉验收、定向SVG生成、修订后的逐页浏览器链接/表/calc验收未做。
13. **集成验证**：按分工由主代理统一运行 lint/typecheck/build/content/audit。此组尚未运行这些检查，也未运行算术脚本回归；需核对新calc格式及手工来源追加后的角标/哈希。

## 交付取舍

Why：用户要求停止并发并改串行，故保存真实安全点。What：10页正文及指定来源阅读、上表手工修订、可复用的字节摘录与哈希。Evidence：实际工具读取范围、固定git片段与在线原文已列。Tradeoff：未完成逐项支持落账、独审及渲染验收。Open Questions：无需用户重新授权；主代理按较小单元续跑以上清单。
