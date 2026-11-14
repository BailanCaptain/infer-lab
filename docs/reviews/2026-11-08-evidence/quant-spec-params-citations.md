# 量化 / 投机 / 参数末条来源续核

## 集成需处理的生成器问题（P2）

本组 20 个参数页的自动定义和版本谱系现已由扫描刷新到 `vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c`。`wiki/seeds/vllm-ascend.yaml:12–15` 的教学 main 仍为 `baa023ad`、rc2 为 `7d825229`。多页正文仍声称“当前自动定义取 rc2、谱系 main 仍为 baa023ad”，实际自动表并非如此。

复现：`absolute-balance-threshold-71578a0c428d` 的正文版本说明与自动定义/谱系；`replica-search-num-stages-e4b10925ff97` 的事实表“页底参数定义的提交”；`stair-config-cca9e594a052` 的“当前自动生成区的口径”。这不是来源单行不存在，而是不同版本口径混称。参数自动区按任务要求未手改；请主代理核生成器的 refs 真相源并再生成，或明确区分巡检快照与教学钉点。

`git diff 7d825229 01741ac9 -- vllm_ascend/ascend_config.py` 已实际阅读：

- KVPP 改为逐个校验 MultiConnector 子连接器，并移除了旧投机方法/固定 K 校验；不能将 rc2 的校验矩阵套到 01741ac9。
- `enable_force_eplb` 新增配置派生阶段 warning；旧正文的无专门告警只适用于旧消费者。
- PCP embedding/LM-head 分片新增与 batch-sharded sampling 的互斥；细粒度 TP 启用判据由 >0 改为 >1。
- Sparse KV offload 移除 `fused_op_type`，`use_fused_copy_sfa` 改为 `enabled and not use_fused_overlap`；默认 hot buffer -1 派生为 `(1+K)*2048`，增加 950 与 PreemptOffloadConnector 拒绝条件。不能由末条 `use_fused_overlap=False` 单行认证整套旧互斥语义。

上述跨组机制页由各组/主代理集成；本组新账本会按静态字段与运行时主张分别记录证据，不自动判整页支持。

## 2026-11-08 串行恢复检查点：已暂停，整组尚未验收

按主会话最新指示停止进一步阅读，当前进度已落盘。**没有启动任何审查子代理，sessionID：无。**

### 已保存的工作

- `quant-spec-params-citations.json` 已实际运行序列化：`pages=22 citations=142`。其中量化55、投机67、参数新增末条20；量化47/48是旧已核2条，逐字保留历史身份，本轮没有重新下载。其余140项均有人工填写的主张、范围、判定和说明；包括部分支持与原文未取得，不是140项均通过。
- 两篇概念页正文、六张专用YAML、20参数页正文已读。概念页所有当前本地源码来源区间已读；单行和窄区间的局限在每条判定中保留。
- 页面当前SHA256已逐页写入JSON；两篇概念页还记录了指定baseline文件SHA256。参数页未编辑，自动区和谱系未手工修改。
- `quantization.md`：v0.26 dtype来源30从150扩到149，补上实际字段声明；明确v0.26快照日期。
- `speculative-decoding.md`：纠正v0.26自定义草稿类推断条件及版本表；来源48扩到654以包括helper；区分dflash方法内选择DFlash2与合法方法名；补期望token数的逐位置条件接受率假设及alpha=1边界；版本表说明v0.26/main合并后连字符键归一化顺序。
- `quantization-intuition.yaml`：输出由错误4×4改为4×6，外框72×48，保留整体布局。已运行专用渲染脚本同步对应SVG，输出 `Rendered only quantization-intuition; figureProblems=0`。这不是视觉或独审验收。

### 已读原文定位与工作底稿

固定目录 `.tmp/wiki-evidence-resume-2026-11-08/`：

- `quant-spec-judgments.tsv`：两篇概念页逐条人工判定，未用存在性生成支持。
- `param-tail-judgments.tsv`：20条新来源逐项人工判定，分别写明真实消费者变化。
- `param-tail-scope.json`：20页面、末条编号和完整ref。
- `quant-sources-03-13.txt`、`quantization-14-36.txt`、`quantization-37-55.txt`；`spec-sources-01-17.txt`、`speculative-decoding-18-46.txt`、`speculative-decoding-47-67.txt`：定点git show阅读材料。最初两个PowerShell转存文件的非ASCII注释有编码损伤；复核请用下述脚本直接从git blob读取，不以乱码注释为证据。
- `params-1.txt`至`params-4.txt`：20页正文及新增末条原文。
- `read-quant-spec.py`：仅按给定页/来源区间读blob，支持单行；`serialize-quant-spec.py`：只将上述人工判定、当前ref和文件hash序列化，不推断支持；`render-quant-intuition.ts`：只渲染本组该图。

外部原文：

- 教程 `vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md` 全文1–430已读；双机命令237–340。
- `.tmp/evidence-2026-11-03/groups-01-02/glm-config-690b7052.json` 全文1–1810已读；`glm-config-eb9eb208.json`实际字节对比完全相同。两者SHA256均为 `bb8f01c42cb92a52ca72e65afb4d5bd8d11aef083cd210e8de25dfb904f23e9f`，每份69416字节。
- `https://arxiv.org/html/2211.17192v2` 完整HTML及附录A.1–A.5已读；剩余输出已从 `C:/Users/-/.local/share/opencode/tool-output/tool_1b73f6acd001cDMYZmgG83Hm8m` 430–592补读。
- `https://arxiv.org/html/2302.01318v1` 完整HTML及Supplementary Theorem1已读。
- 量化来源55 `https://www.hiascend.com/doc_center/source/en/CANNCommunityEdition/910/API/aolapi/context/ops-nn/aclnnDynamicQuant.md` **原文未取得**：webfetch transport error，urllib TLS EOF。没有用算子名字或下载状态代替公式核验。

01741ac9消费者补读范围已逐参数写入JSON。另已完整读 `git diff 7d825229 01741ac9 -- vllm_ascend/ascend_config.py`，以及同两点 `stair.py` 的5行差异。除前述生成器问题，还需注意：

- combine消费者280–310新增MX量化CEIL时默认0，不再无条件回退4。
- SFA/DSA-PCP消费者改用ParallelOProjection，prepare_weight_load异常捕获边界变化（sfa_cp65–112、dsa_cp525–555）。
- SFA-DCP恢复新增query_prepared时unpack_query分支（sfa_cp966–981），原旧版“总是permute再contiguous”不能套回新main。
- STAIR plan_layer1128–1195以冗余槽数为副本变更自然上界，并消费各搜索参数；窗口280–298增加显式累加dtype。

### 精确未完成清单（恢复时不要跳过）

1. **首次独审未做**：由主会话统一调度实际diff、页面、六图与原始范围；本组未创建审查子代理。图格数P1及上述版本/条件P2修订尚待独审确认。
2. **生成器P2尚待集成闭环**：前述20页自动区版本漂移；kvpp_config/size派生字段仍展示用户配置路径。根因未追生成器实现，本组没有越权手改自动区。若决定恢复rc2自动区，请再核新ref、编号及hash；若保留01741ac9，需明确区分后续巡检快照并补正文相关行为差异。
3. **部分支持仍有缺口**：投机来源3、11、13、17、21、23、27、31、35、54、55保留部分支持。54/55的归一化差异已写版本表，尚需独审确认规范字段与别名冲突边界；13的其他后端/多版本上限、27的proposer内部元数据、35的融合kernel数学等价尚未补读消费者。不能把引用局部支持升级为整页全部兼容。
4. **正文仍需精确处理的范围**：MTP“训练时只学多猜一格”只有按单层结构推断，当前正文语气偏确定（页末标I）；source35“数学等价”尚未读fused_eh_norm内核；常见误解里首个拒绝输入自身前向与用于判拒的前一位置输出应再分清。未在暂停前改动这些段落。
5. **来源55原文缺口**仍在；两份大体积量化描述只继承旧判定，未重新全文逐条读取。旧判定明确了实际核过字段及hash，没有冒称11万条全部逐字阅读。
6. **图与直接外链单独登记尚未完成**：六张YAML已读，直觉算例与源代码pin已对照，尚未给六图分别写入正式JSON的独立hash/证据项目；正文外链尚未全面重开（概念页主要为站内链接，参数页另有官方文档/PR直链，旧判定继续保留）。
7. **验证未完成**：未运行全组wiki:audit、wiki:lint、check:content、wiki:diagrams --check、类型检查或构建；未进行浏览器实读/链接操作/截图，亦无NPU实测。唯一新图验证是目标figureProblems=0与SVG同步，不冒充全站检查。

### 可复用进程

本组启动了 `pnpm dev --host 127.0.0.1 --port 5197`，后台shell ID `sh_1b7447b14001doF0UvqTc5zibl`；没有确认浏览器可访问，也没有轮询或停止其他会话服务。恢复者可复用或按自身计划管理此实例。

**Why / What / Evidence / Tradeoff / Open Questions：** 为保留可复核范围，已保存22页142条分级记录、3个源文件精确修订及1个派生SVG；证据为上述实际git范围、全文/字节对比、序列化和定点渲染输出。串行暂停前未取得全面检查/独审/视觉证据，整组不标完成。待主会话决定并闭环生成器版本口径，其余按清单继续。
