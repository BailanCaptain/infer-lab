# 离线请求队列增量独立审查

审查者：`queue_final_review`，与作者 `groups_ucm` 分离。审查日期：2026-11-11。

结论：**本轮新增教学、47 项来源映射、保留性和实际浏览器验收通过；未发现需要修订的 P1/P2。** 本结论限定下列冻结文件及离线队列增量，不代替全站工程检查，不把旧 93 项来源重新计作逐项语义核验，不增加官方全文阅读数量。

## 范围与方法

先完整阅读 `docs/wiki-writing-standard.md` 与 `wiki/AGENTS-GUIDE.md`；本任务是文档及事实核查，未启用代码协作 skills。阅读实际页面、作者完整 diff、新图 YAML、作者自查与保留记录。作者记录只用于定位证据，未据其自报结果直接批准。

对 `offline-queue-additions.json` 的 47 项，从本地官方仓库的固定提交独立执行 `git show <pin>:<path>`，核对完整文件 SHA 和指定范围 SHA。19 个不同范围中，15 个完整所列范围实际阅读，4 个范围读完与已读基线的全部非空差异并复用共同上下文；其余 28 项在独立提取且范围 SHA 完全相同后绑定到已读范围。每一项的判定及理由见 `offline-queue-independent-judgments.json`。这是 47 项引文绑定核验，**不是 47 篇全文阅读**。

独立摘录和校验结果：`.tmp/continuation-groups-2026-11-10/queue-independent-source/{候选编号}.txt`、`integrity.json`。此外复读旧来源 7 的后台主循环，并扩读实际调用者和相邻消费者：`LLM.__init__`、`LLMEngine` 的未完成计数/step/sleep/wake、两个同步客户端的 sleep/wake，以及进程内 `EngineCore.pause_scheduler`。这些上下文没有新增来源或全文计数。

## 核心语义判定

| 核对点 | 实际依据与判定 |
| --- | --- |
| 默认 MP 可以在等待前计算 | 环境 getter 默认字符串 `1`；普通 LLM 构造未强制另一模式；factory 选择 SyncMPClient；add_request 当前调用内发送 ADD；独立 EngineCore 主循环处理输入并推进 step。页面第 340 行区分了这一行为与注释中不够完整的“不开始处理”，没有照抄错误的统一解释。 |
| 进程内由调用方推进 | InprocClient.add_request 预处理并登记；get_output 才直接 step/post_step。页面与图的下分支准确。环境关闭也不覆盖显式强制 MP，页面回链到已讲强制条件的位置。 |
| 等待全部、只收最终结果、按编号排序 | 共享循环检查前端所有未完成请求，类型断言并非过滤，保存 finished 输出，按数字 request_id 排序；接口没有 ID 子集参数。3+2、完成顺序 2/0/4/1/3、返回顺序 0/1/2/3/4 的示意与一输入一答案前提一致。前端尚未消费的最终输出仍属于待收集工作，不能仅按设备已算完判断空队列。 |
| 加入异常 | render/add 逐条交错执行，后续条目失败时取消这次调用已加入的 ID 并重抛；不能倒转后台已经发生的计算。页面第 356、440 行明确了这点。 |
| level 0 暂停前提 | mode 默认 abort，会终止既有请求；示例从清醒且没有已有工作的引擎开始，先暂停、后分批加入、再 scheduling 唤醒。level 0 不进入 executor.sleep，clear_prefix_cache=False；页面未把它写成卸载权重或任意运行中任务的无损屏障。 |
| 四版差异 | 基线 wake 直接恢复；v0.26 起先检查执行器内存已醒；rc2/main 在完成暂停时额外 synchronize_device，再按条件清缓存。rc2 的 renderer 参数、ZMQ 对象生命周期处理及请求计数发布不改变该队列契约。main 是固定对照，不宣称与 Ascend main 精确配套。 |
| 与原 GLM 主线的关系 | 新增分支说明脚本收结果，原 HTTP 七站路径保持；明确 enqueue 与 EngineCore 异步调度不是同一开关。没有把普通离线示意扩写为 GLM 双机、多 DP 暂停的实测结论。 |
| 开销与用途 | 全量结果列表会占主机内存，设备端仍要规划缓存；单组 generate/chat 已满足普通多输入，只有分批准备、统一收尾需要此接口。没有凭静态实现声称吞吐增益。 |

未发现新增 P1/P2，因此没有修改教学页，也无需产生修订前快照。页末原有非 0 worker 异常传播、MRO 的待核边界仍保留在源码区，符合标准对页末待核的要求；本轮没有假称这些旧待核已被实验关闭。

## 保留性

从作者改前快照独立比较，而非只比较数字集合：

- 旧来源数 93、现来源数 140；前 93 项逐项完全相同。
- 完整差异只有增加，旧行删除数为 0；原七站叙述、已有数值/前提/误解、示例和链接均保留。
- 原五幅图的 10 个 YAML/SVG 文件重新计算 SHA，全部与改前清单相同。
- 浏览器中重新查看原五幅图和原表格，保留不只停留在文件数量核对。

证据为 `.tmp/continuation-groups-2026-11-10/queue-independent-source/page-preservation.json` 与 `preservation.json`。改前页面 SHA：`bfec12c747ff20bade5c9cb477bdf64f517cc5099f33e25629fbc40cadb68c1f`。

## 实际浏览器验收

首次访问 5201 被拒绝后，启动本地 Vite 服务；后台无可见终端窗口，日志为 `.tmp/continuation-groups-2026-11-10/queue-review-devserver.log`。随后实际运行：

```text
node .tmp/continuation-groups-2026-11-10/review-queue-independent-browser.mjs
```

浏览器视口 1440×1100，实际打开 `http://127.0.0.1:5201/#/wiki/request-call-chain`。独立读取报告并通过 view_image 实际逐张看完 26 张截图：前两屏、概念/算例/调用/异常/版本/来源 6 屏，6 幅图、1 个 calc，11 张表。旧图的进程泳道、RPC 两次调用、七站函数链、prefill/decode 分支和日志定位仍清楚；新图能看出后台运行与进程内推进的不同；3+2=5 和 5×1=5 的算例口径明确。表头、长路径、版本列及图中文字没有裁切或重叠。

浏览器结果：`stable=true`、`errors=[]`、`overflow=false`、`tableOverflow=0`、`brokenImages=[]`。表格宽度以正文容器宽度比较，避免仅以整窗宽度检查而漏掉正文裁切。新增“进程布局”“进程开关”“异步调度”三处链接均实际点击，分别到正确页面与预期锚点。

报告及截图目录：`.tmp/continuation-groups-2026-11-10/queue-independent-browser/`。首次尝试一次输出过多图片被工具截断的五幅旧图已分批重新打开，不把未显示的工具结果计作视觉验收。

## 冻结指纹与限制

| 文件 | SHA-256 |
| --- | --- |
| wiki/concepts/request-call-chain.md | `329033532db9d45d074dae399c63ad8f417952bfb1c40ab49a95ae6202a5381a` |
| wiki/diagrams/request-offline-queue.yaml | `ad6a2bbf2f0106596ae63733dfa9e381eb2b51cd944469f29019066229be79b6` |
| wiki/diagrams/request-offline-queue.svg | `66f1cf7ab60d1655ad9e0cf7fc9bdb702d995fd00eeaf114375b9e3006779861` |

审查没有改这三个文件，浏览器前后及最终记录的指纹一致。未运行 NPU/GPU 生成、GLM 多 DP 暂停、吞吐或峰值内存实验。全项目 content/lint/audit/diagrams/build 由根代理在并行内容稳定后统一运行；本报告不提前宣称全站通过。没有新增待用户决定的问题。

API 页可增加一段短回链，由根代理负责整合：需要脚本分批提交、最后统一取回结果时，转到请求调用链的离线队列小节；指出提交返回请求编号、默认后台收到输入即可计算，等待接口再收齐结果。不应在 API 页复制完整机制，防止形成第二份真相源。
