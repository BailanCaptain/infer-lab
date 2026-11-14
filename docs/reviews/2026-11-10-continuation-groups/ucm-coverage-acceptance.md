# UCM 官方覆盖增量验收

本批从官方目录反查漏讲，补齐多模态编码结果缓存、诊断工具、Kubernetes 实例与 Pod 计数，以及容量计算器的适用条件。25个新增来源出现项逐项记录于 `ucm-coverage-judgments.json`；不从原队列再减25，活动旧队列仍余964项。前73项的正文和来源继续按原验收与本次保留复核使用。

EC 解释编码结果与 KV 的区别、完整 item 命中、分块补零、写读参与者、共享身份、逐项加载与每步保存等待；新增5×2 BF16示例及图，20B有效数据、24B分配、4B尾部补零。独立配置和验证入口补齐，v23缺helper的静态不兼容不再笼统写成未实测。工具部分区分模拟与实际I/O、Counter与Gauge、提交与完成、多层重复计数；官方metrics参数与实际预设冲突有真实函数复现。Helm按固定小模型模板演算2P2D共8引擎Pod，并解释DP、额外worker、headless及hybrid的关系，未改写固定GLM部署。

外部UCM固定版本59份英文Markdown均有实际全文阅读记录：46技术、12导航/介绍、1贡献流程。原31份保留，本次补读28份；不把这些数字与来源出现项相加。EC时序、设计Mermaid、Helm架构SVG实际查看；计算器实际操作GLM的两条路径，并核相关函数，记录显示ceil而实际floor及滚动状态假设。尚未读完所有JS、CSS、Chart开发文件或外部站点，精确范围见 `ucm-official-inventory.json`。

独审 `ucm-coverage-review.md` 已覆盖来源74–98、全部新段与图、保留差异及实际浏览器操作。EC语义4项P2、工具Counter/Gauge问题、图注和模型卷措辞等均已修订复核；无未关闭P1/P2。官方tp_size旧指令的初步建议经真实函数核对撤回，改为说明版本冲突，没有迎合错误指南。旧三组图字节保持不变，原教学与数字保留，仅普通KV验证标题限定范围。

最终五项实际命令均exit 0：`pnpm check:content`、`pnpm wiki:lint`、`pnpm wiki:audit`、`pnpm wiki:diagrams --check`、`pnpm build`。日志见 `ucm-coverage-verification.json`；lint仍有9条既有非阻塞提示。原V2阻塞在共享工作区已不再出现，该页已有独立alias与toc配置，本批未修改或验收该页，也不把其变化归作本批成果。audit当时164页6823项来源、104/104标准页通过；并发页面增源使全站差值不等于本批25项。

浏览器证据在 `.tmp/continuation-groups-2026-11-10/` 的 root-ucm 与 review-ucm 文件；前两屏、新图、表、calc、内部与固定官方外链均实际检查，无页面错误或横向溢出。最终指纹见 `ucm-coverage-checkpoint.json`，独审另冻结98项快照。没有运行NPU、真实媒体/Store、Kubernetes集群或性能精度测试；源码和公式核验不替代这些实测。无待用户决定问题，继续缓存重算余项与全站覆盖。
