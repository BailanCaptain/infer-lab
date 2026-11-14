# 默认与采样参数补写验证

2026-10-31。B1 的 **8/8 个单元已补齐并验收**，主说明统一落到 [sampling](../../../wiki/concepts/sampling.md)，复用原有六词算例、两张图与 penalty、停止条件说明。累计完成 A 批 11 个和 B1 的 8 个，共 19 个补写单元；B 批为 8/89，下一组是 B2 容量与 KV 的 9 个单元。这是计划内补写进度，不是全库参数覆盖率。

## 本轮补齐内容

| 台账单元 | 参数 | 补齐内容 |
|---|---|---|
| W0539 | temperature | 对象、普通 HTTP、模型默认的区别；小正温度抬升、greedy 初始化、三版范围检查 |
| W0545 | top_p | 默认、关闭值、范围、请求 null 的继承、与温度和 top-k 的配合 |
| W0543 | top_k | 默认、0/−1、整数检查、词表上限、并列边界；精确名称检索 |
| W0494 | min_p | 默认、范围、HTTP/Python 空值区别；MTP 校验阈值及 greedy 归零顺序 |
| W0518 | 请求 seed | None/−1/0、有符号 int64、独立随机流、取数顺序与复现条件 |
| W1685 | 启动 seed | 默认 0、固定配方 1024、初始化消费者和 NumPy 范围；与请求种子分开 |
| W1582 | generation_config | auto/vllm/自定义来源、文件缺失回退、采样默认与特殊编号读取链 |
| W1662 | override_generation_config | JSON/dict、默认 {}、六项提取名单、三层覆盖表、启动 null 与请求 null 的差别 |

教学区先解释两层随机流和三层配置覆盖，再在「怎么开」给请求表、启动表、HTTP JSON、离线 Python 和部署参数片段。「版本差异」覆盖 vLLM 0fc695fc、568afb3a、84030bbe，固定执行侧为 Ascend db701c1f。版本依据沿用知识库参考部署钉点，未新增线上镜像安装内容的认证。

原有六词数值、六个 calc、两图、GLM 数字、三种 penalty、token 控制、最少长度 MTP 边界、误解和待核均保留。机器维护的「已废弃的说法」尾注与改前快照逐字相同。首两屏 greedy 的复现说明补上「分数和并列处理相同」条件，与后文 seed 说明保持一致。长度硬上限与停止编号的细节仍分别回链 API 入口、请求收尾页。

## 独立审查

新的 defaults_sampling_review 审查者读取实际正文、改前快照、diff、固定源码和两图，并复核最终浏览器证据。过渡文稿中 1 项 P2 已关闭：from_optional 不能为 top_k=None 自动归一化中性值，当前正文明确 top-k、min_p 应传数值。最终无未关闭 P1/P2/P3。详见 [独立审查记录](defaults-sampling-independent-review.md)。

独立审查者提取三版原始 AST 函数体，完成 22 项×3版，共 **66 项断言**。覆盖默认合并、override null、seed=-1/0、小正温度、greedy 与校验顺序、MTP 阈值、from_optional 空值及温度版本差异。隔离执行使用少量环境桩，没有导入 NPU、启动 HTTP 服务或运行模型。

## 实际验证结果

| 检查 | 结果 |
|---|---|
| pnpm -s wiki:build | 167 页生成成功 |
| pnpm -s check:content | 167 页、11 个主题，正文完整且目录无重复 |
| pnpm -s wiki:lint | 通过；8 项其他页面提醒，本页无提醒 |
| pnpm -s wiki:audit | 104/104 强制标准页通过；4620 条来源，无无效 commit、缺文件、越界行号或未知仓库 |
| 示例语法 | 教学与源码区 4 个 JSON、4 个 Python 围栏分别通过 JSON / AST 解析 |
| CLI 检索 | 12 个参数名、连字符写法和中文别名查询，首项均为 sampling，how=exact |
| 浏览器目录检索 | 9 个查询均为 1 个匹配页面，逐项点击进入采样页 |
| 浏览器阅读 | 检查首两屏、两图、原 calc、新默认表、请求表、启动表、离线示例及版本表；独立审查者复核 21 张最终 PNG |
| 跨页链接 | 实点「输出预算」「停止条件」，分别落到 API 入口和请求收尾的「怎么开」 |

全库自动审计仍有 264 条 URL 未由该命令联网验证、1331 条 raw 摘录待核；本轮的固定源码核读和 NumPy 官方文档在线核对另有记录。自动审计通过不能代表全库每条证据的语义已经审完。上批的三个措辞密度阻塞在本轮运行时已不存在，但这些页面不是本轮修改，不能归功于本批补写。

手工密度口径为去 fenced code 后的汉字数，排除 frontmatter 与审计尾注：教学区 10997 汉字、行内代码 0.91/千字；含源码区全文 19116 汉字、5.28/千字。教学区角标 0，全文角标 26、其中 C 级 19（73.1%）；6 个 calc、每个内容小节至多 1 个，首图前无 calc。自动审计使用自己的字数口径，两组统计不混用。

## 来源登记与检索修订

首次 lint 发现两个问题，均已处理：top-k 别名与 MoE 页重复，改为「top-k 采样」，保留精确键名 top_k；NumPy 官方传统随机接口未在可引来源表登记，新增其**确切页面路径**，分级为 ecosystem。来源用于证明全局初始化所依赖的整数种子范围，不证明设备复现。文档已在线核到 [0 到 2³²−1 的范围](https://numpy.org/doc/stable/reference/random/legacy.html)。

登记仅修改 scripts/wiki/sources.ts 的数据行、对应测试和 wiki/HANDBOOK.md 的同一条记录，没有修改分类算法或阈值。新测试先得到 1 失败/23 通过；登记后 sources、lint 两个测试文件 **81 项全部通过**，相似域名和其他路径仍不接受，ecosystem 仍不能单独支持 S。独立审查者另行重跑并审查了实际代码差异。Biome 检查两个代码文件通过，pnpm -s build（tsc -b 与 Vite）通过。

## 改动范围与证据

本轮知识正文只改 sampling.md；另外更新上述来源登记、生成 registry 和交付记录。registry 相对本轮快照的 sampling 仅 aliases、sources 变化；同次生成还反映 dyntra-lb、request-call-chain、vllm-scheduler 已有的外部改动，本轮未编辑其正文或撤销这些变化。历史缺口台账不改写为当前覆盖统计。

证据保存在 tools/wiki-runtime/defaults-sampling-20261031/：改前快照、sampling.diff、21 份固定上游文件、independent-branch-checks.py/json、metrics.json、retrieval.json、ui-retrieval.json、registry-changes.json、各检查日志和浏览器 PNG。first.png 是旧缓存页，排除出最终视觉证据；first-final.png 和其余 20 张是最终页面。

没有进行 GLM/NPU 实测，没有提交示例请求给真实模型，也没有用生成式问答认证回答质量。正文补写、独立审查、检索和页面阅读验收已完成；本轮待修项及需用户决定事项：无。
