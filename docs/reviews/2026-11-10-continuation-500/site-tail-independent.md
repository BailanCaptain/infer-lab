# 三页尾项的独立局部审查

审查者：`continuation_site_tail_review`，未参与这三页产品修改。日期：2026-11-10。范围为写手 `continuation_site_tail` 对 `ascend-config-system.md`、`data-parallel.md`、`engine-processes.md` 的局部修订，以及由该修订直接发现的同段问题。对照基线为 `.tmp/continuation-500-2026-11-10/before.zip`；写手保存的逐字快照与记录同时用于核对，不以其结论代替独立核源。

已读写作标准、知识库使用规则、三页开篇概念与代价段、全部实际差异及修改位置的上下文。以下是局部差异审查，不是三页全部主张重新认证，也不把配置源码正确当作部署成功。

## 结论与闭环

没有发现本次修改引入的P1。独审补发现1项P2和1组P3，写手已修订，本审查者复读实际文件关闭。

| 级别 | 位置与影响 | 原始证据与修订结果 |
|---|---|---|
| P2 | DP页“怎么开”原段把省略DP或写1说成普通在线入口最终为1，再仅介绍离线SPMD环境回退。在线服务继承旧环境时，读者会误以为这些环境不影响最终配置。 | 不只核配置类：实际跟通固定0fc695fc的单API在线调用链，确认传入DP=1、local非0时仍进入环境回退。现文限定默认环境得到1，并明确在线入口可到该分支、离线SPMD只是使用场景之一。新增51–56补齐调用链；未声称只配环境就能成功部署在线多组。复审关闭。 |
| P3 | 进程页原L530/557/559及DP版本表附近仍有“本轮”“本批”“旧页”“认证”等维护措辞。只改原指定尾句不足以清理同页相邻的维护叙述。 | 已改为实际参数、固定版本与缺少的证据范围；main其余进程通信、补丁、状态行为仍缺完整调用链核验，设备日志也仍明确需要。DP后续执行侧采用各自注明的版本。原事实、条件、源码编号和回链保留。复审关闭。 |

配置页的原修订可接受：从“可能报错”改成具体触发条件，且按独审建议写明“任一必要属性”。这没有扩大守卫能力，也没有为降低免责比例删除限制。

## 独立核源范围

### Ascend配置守卫

实际 `git show` 阅读 `vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L878-L925`。初始化守卫在L889–891检查对象非None，以及 `ascend_compilation_config`、`eplb_config` 两属性同时存在；getter在L923–924对None或守卫失败直接抛RuntimeError。因此“取配置时缓存为空或缺任一必要属性会报未初始化错误”有确定分支支持。

同时保留相邻解释：复用缓存还检查同一个总配置对象与refresh，新对象不完整时不更新旧缓存而仍返回调用方，守卫不等于全部业务校验；进程边界、初始化是否成功和JSON错误来源没有被删除。这里是源码分支核查，没有运行NPU构造或制造报错。

### DP在线入口与环境回退

固定 `vllm@0fc695fc` 实际读取范围：

1. `vllm/entrypoints/cli/serve.py#L139-L148`：普通单API路径调用run_server。
2. `vllm/entrypoints/openai/api_server.py#L652-L682`：run_server调用run_server_worker，后者进入build_async_engine_client；`#L94-L123`把CLI参数转为AsyncEngineArgs并创建引擎配置。
3. `vllm/engine/arg_utils.py#L1542-L1549`：按dataclass字段传入CLI参数；`#L1817-L1928`：外置、本地、节点推断与普通mp缺省；`#L1962-L1970`：将DP总数及派生本地数传给ParallelConfig。
4. `vllm/config/parallel.py#L801-L836`：总数大于1或local=0走显式分支；否则读取VLLM_DP_*，没有以在线/离线作条件。注释中的离线SPMD只是举例。稠密模型在环境回退后DP大于1还会被拒绝。
5. `vllm/envs.py#L1297-L1309`：读取实际进程环境，VLLM_DP_SIZE默认1。对固定entrypoints与arg_utils检索VLLM_DP_SIZE没有命中；正向调用链而非这项负向搜索承担主要结论。

这足以确认在线配置可以继承环境值，不证明后续拓扑、前端数量、rank或服务可用性。新版的完整在线链不在本局部审查范围；另读v26 `parallel.py#L840-L877`、main `#L907-L944`，只确认这些片段保留环境回退结构，不据此扩展整页新版认证。

### main比较范围

实际补读固定main `84030bbe` 的 `parallel.py#L950-L995`、`entrypoints/cli/serve.py#L62-L95`、`entrypoints/launchers/cli_args.py#L396-L410`、`entrypoints/serve/utils/api_utils.py#L149-L166`，分别核默认执行器选择、headless/API入口、CLI字段默认及CLI在未设时写spawn。修改后的“配置入口比较”与“其余进程通信等仍缺完整调用链”边界一致。没有把这几段阅读代替进程页全部旧内容的重审。

## 信息保留与检查

对before.zip与当前文件作实际逐行diff：原数值、calc、表格、图规格均保留，已有sources未删改；DP页只另加6个来源，编号51–56与正文对应。显式rank、本地数1/None、headless大于0、local=0用途、默认组数与环境例外均保留并更精确。进程页84030bbe钉点、两发布分支的已有结论和原四项待核的实质边界保留。删掉的是批次叙述，没有将缺证据改成“已验证”。

独立运行既有 `pnpm exec tsx .tmp/continuation-500-2026-11-10/site-tail-check.ts`，三页problems均为空；配置页3/121、DP页3/239、进程页0/188，未改检查阈值。该检查在增补DP在线说明前执行；增补位于源码区，最终全批检查由主执行者统一记录。配置页分母没有靠添加空话增加。

读取了写手的浏览器操作记录 `.tmp/continuation-500-2026-11-10/browser/site-tail/result.json`，记录包含实际变更段与回链、pageerror为空。本独审没有操作浏览器、没有把写手截图说成自己视觉验收；最终修订后的视觉记录由写手和主执行者负责。

## 暂缓范围与交付边界

V2样板不属于本次修改或验收。写手在preservation中记录了另一会话的用户暂缓指示及原句；本独审据已明确的任务范围不移动、不合并、不删除V2，也未重审其全部内容。现存三项V2 lint不能报为通过。

Why：移除维护叙述同时保留适用条件，并避免把环境派生误解为离线专属。What：独立核对三页局部修订，关闭同段DP问题和维护口吻残留。Evidence：实际diff、上述固定源码及三页写作检查。Tradeoff：只到配置/控制流证据，不含NPU、全页、全站或独立浏览器验收。Open Questions：本局部修订无待用户决定项；设备与main完整调用链缺口继续按页末保留。
