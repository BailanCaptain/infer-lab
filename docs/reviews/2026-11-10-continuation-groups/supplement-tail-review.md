# 剩余补证 21 项独立审查

审查者：`/root/groups_recompute_review`，2026-11-10。本次没有编辑教学正文或其他会话代码。

**内容与局部视觉审查通过，未发现本范围剩余 P1/P2。** 范围是 4 个旧残项、DP 6 个前批追加来源、Large-scale EP 11 个前批追加来源，共 21 个来源出现项，不是 21 篇官方全文，也不是这五页全部主张重新认证。

逐项独立笔记、固定引用、全文源文件 SHA256、摘录 SHA256、当前页面 SHA256 与检查结果见 [supplement-tail-independent.json](supplement-tail-independent.json)。脚本与原始材料位于 `.tmp/continuation-groups-2026-11-10/supplement-tail/` 和 `review-supplement-tail.py`。

## 如何核验

已读本项目写作标准；实际读取 manifest 中 20 份固定源码摘录和 HF 模型配置完整 JSON，逐项对当前正文及相关已有来源，而未采用主写手的判断表作语义证据。20/20 源码范围有效，摘录逐行与固定 git 对象一致，21/21 当前引用与冻结 manifest 相同。

模型配置另外从 Hugging Face 的固定提交 `56d4cbbb4d29f4355bab4b9a39ccb717a14ad5ad` 重新联网获取；与原存材料字节一致，SHA256 为 `79ddea672a62e95d3f0be27be434375538e1988975971cffcf87c96c1de84a65`。这是一份完整配置文件，不是完整模型部署资料。

独立补读 `ParallelConfig` 环境回退、`EngineArgs` 的 local 数量派生、实际 `@config` 使用位置和 proxy 记账调用方，区分短片段支持的内容与需要其他来源补全的主张。当前 PD 正文已被另一任务修改，未按旧页面哈希直接继承认证，专门重读现行失败策略段。

## 逐项结论

| 页面、来源 | 独立结论 |
|---|---|
| DP 51 | 普通单 API 的 serve 分支调用 run_server；只证明配置链入口可达，不证明环境变量单独能部署在线多组 |
| DP 52 | CLI 参数生成 AsyncEngineArgs，随后 create_engine_config；与 53–55 和已有回退谓词连成调用链 |
| DP 53 | run_server 经 run_server_worker 调 build_async_engine_client，普通在线路径确实存在 |
| DP 54 | from_cli_args 按 dataclass 字段复制 CLI 值；环境读取不发生在本函数 |
| DP 55 | global/local 参数传入 ParallelConfig；local 的派生还需已有来源 37 及实际上下文，已补读 |
| DP 56 | 环境读取器缺省 size=1、rank=0，本地 rank 缺省继承全局 rank；实际是否读取受已有来源 41 的条件约束 |
| KV Pool 13 | 固定同步 get 返回非零错误或 None 时，单组登记 invalid IDs，多组只记错误并跳过该回退。现文正确区分，未声称多组一定按默认策略结束 |
| Large-scale EP 27 | 固定模型 JSON 支持 MoE 层 256 路由专家、每 token 8 个；不独立证明 A3 卡数、72 个服务或部署量化格式 |
| Large-scale EP 45 | main 配置装饰器缺省 extra=forbid；另查 AscendConfig 实际无覆盖地使用 @config，与已有构造入口共同支持严格顶层校验 |
| Large-scale EP 46 | rc2 可发现 vllm_omni 时告警并过滤未知顶层键；其他走 AscendConfig 验证。仅限该顶层分支，不泛化嵌套键 |
| Large-scale EP 47 | rc2 fault tolerance 依赖 external；DP>1 的非 MoE 外置模式拒绝；缺 rank 或 local 不为 1/None 抛 ValueError，成功分支 local=1 |
| Large-scale EP 48 | rc2 external 另要求 DP>1，独立于非 MoE 检查 |
| Large-scale EP 49 | rc2 Mooncake V1 按 rank×TP×PP×PCP 偏移，再加 rank 内设备索引；公式相同不代表任意主机端口均无冲突 |
| Large-scale EP 50 | rc2 V1、D2RH、V2 分别注册，V1 仍在旧文件，V2 在新目录；仅支持入口与路径，不证明 V2 设备运行 |
| Large-scale EP 51 | 两种估分函数与正文公式一致；请求体长度来源和计入哪个负载字段需既有调用方，短函数不独立证明全部记账流程 |
| Large-scale EP 52 | prefill 优先级为 active_tokens+0.3×active_kv_cache，decode 为 active_tokens；小顶堆跳过失效条目。只说挑选规则相同，不说整份 proxy 没变化 |
| Large-scale EP 53 | external 默认 API 数量 1，显式多个仍可进多 API；多端口、headless、Rust、elastic 有各自条件，现文保留默认/显式区别 |
| Large-scale EP 54 | rc2 配置 0/1 禁用 MegaMoE 支持，2 检查 cann_ops_transformer 后归一为 1；不能套用旧 GLM 模式 2 的选择语义 |
| Large-scale EP 55 | 旧 0fc695fc 已要求 external DP>1，支持这一约束并非 rc2 新增 |
| PD 73 | 有 KV 传输配置且策略为 recompute 时，固定 GLM 镜像断言模型非 hybrid；当前 L414 正确限定。默认 fail 和运行时 FINISHED_ERROR 另由已有来源支持 |
| KV 块分配 41 | 无本步抢占且未暂停才处理 waiting；blocked/LoRA 可以跳过，并开始查本地缓存。waiting 借块失败后 break 在已有来源 15，不由本摘录单独证明 |

## 本次跨页修订与信息保留

实际将 `large-scale-ep-before.md` 与当前页面逐行比较，只有环境回退一段改变，diff 保存在 `review-large-scale-ep.diff`。修订明确输入 DP=1 且 local≠0 才读 VLLM_DP_*；“离线 SPMD”是注释中的例子，不是排除普通在线入口的条件。解释回链到 DP 页唯一主段，仍保留“回退不等于外置 HTTP 分派”和需显式配置启动拓扑的限制。

该段旧来源 24 已涵盖 `parallel.py#L800-L831`，DP 来源 51–56 补调用链，未增加重复公式、重复来源或新的空白参数页。

DP、KV Pool、KV 块分配的页面 SHA256 与 500 批完成检查点完全一致；EP 除上述一段外无差异。PD 的当前哈希不同，本次仅针对来源 73 的现行语义重核，不为另一任务全部 PD 修改作背书。比较 500 批文件检查点及 before.zip 后，DP/EP/KV Pool/块分配共 26 个 YAML/SVG 文件全部保持对应验收状态，记录在 `review-diagrams.json`。

前批完整阅读与图/算例/版本表验收复用 `2026-11-10-continuation-500/acceptance.md` 及各独审；本轮没有把前批的全文和视觉数量重新累计。服务数 72、路由专家 256/8、P/D 专家份数 16/4、DP 请求归属和空闲陪跑、Pool 多组失败限制、块池抢占/等待区别均未删减。

## 局部视觉与工程边界

共享前端暂时不可用时没有记录视觉通过。主写手恢复工作流锁并重启其 5201 服务后，本审查实际运行 `review-supplement-tail-browser.mjs`：

- 在 Large-scale EP 页定位新环境回退段，实际点击“DP 的环境回退说明”。
- 路由到 `#/wiki/data-parallel#怎么开`，目标标题为“怎么开”，并继续查看 DP 环境回退全文和相邻参数条件。
- 1440×1100 页面无横向溢出、无 pageerror；已实际查看 `review-ep-fallback.png`、`review-dp-link-target.png`、`review-dp-fallback.png`。记录见 `review-browser.json`。

同一次恢复后还补完 Recompute 的 rc2 段/切片示例/错误/版本和缩字后流程图视觉，详见其独立报告。本报告不把另一会话的 renderer 构建问题算成本次文档修订，没有修改或屏蔽该代码。

最终实际读取 `supplement-closeout-verification.json`（记录于 `2026-11-10T09:36:28.785834+00:00`）及 build/audit 日志：`pnpm check:content`、`pnpm wiki:lint`、`pnpm wiki:audit`、`pnpm wiki:diagrams --check`、`pnpm build` 均 exit 0，构建完成 `built in 6.19s`。这一轮包括 EP 的最终回链段。9 处全站既存 lint 提示、467 个未联网验证 URL、3093 个 raw 待核及名单外页面的写作统计没有因此清零；本次 21 项的独立语义结论另见上文。

Why：关闭前批未逐条入账的来源，并修正 EP 与 DP 对同一环境回退规则的表述差异。What：21 项独立语义核验、源与页面哈希、保留检查及新回链实际操作。Evidence：20 源码摘录逐行一致、HF 固定 JSON 字节一致、单段 diff、26 图文件哈希一致、浏览器真实点击、最新五项工程检查通过。Tradeoff：局部补证与前批验收复用，不是五页全新全文认证或 NPU 部署验证。Open Questions：无待用户决定事项。
