# 指标增量独立审查

审查者 root，作者 groups_recompute_review。两页新增正文、图、算例及来源审查通过；统一工程验收另记，不在此提前关闭官方目录的全部子材料。

## 实际读取与判断

57 个新增来源由 root 重新从固定 Git 对象或固定 raw 地址取出，逐一校验文件和引用范围 SHA。47 个不同范围直接读取或在已读基线之上读取完整非空差异，10 个同范围版本绑定复用；这不是新读 57 篇全文。补充的 24 项四版等价性核对另存 `metrics-root-source/equivalence-integrity.json`，HTTP 路由补丁与 collector 清理差异均实际读取。

逐项结论见 `metrics-tail-root-judgments.json`。首次调度不被恢复覆盖、单调时钟与前端墙上时钟、输出事件间隔与请求平均、短输出计零、事件更新先于本轮解码均已沿生产和消费核对。图中 20/80/100/180 ms 及 100/(4−1)=33.33 ms 是明确的示意演算，抢占后的等待确实落在阶段时间内。

核对了 Gauge/Counter/Histogram 的真实类型与标签，完成原因枚举、输入 token 来源、普通/抢占/外部/媒体缓存计数、空闲队列与 null 块公式、最近批次窗口和 token 加权。块抽样器及分配/touch/淘汰/drain 调用链支持 9/4/3 秒示例，释放引用与淘汰分开，未把 touch 写成每次 attention 的显存访问。

OTLP 配置、初始化、完成输出调用和状态断言已核；不以字段存在证明 NPU kernel tracing。独审发现一项 P2：基础依赖已随固定 vLLM 提供，原新增文要求直接安装会误导正常镜像用户。作者已改为先确认，缺失才补齐；root 重读修订并核四版 `requirements/common.txt` 的四项基础依赖，问题关闭。

Prometheus README 57 行、配置 10 行、OTLP README 86 行、Python 多进程说明 154 行实际全文读取。Grafana 1527 行 JSON 由作者全文读，root 独立解析全部 12 个面板的标题、单位及查询；Queue/Prefill/Decode 确为仅对 sum 求 rate，本站的均值分母纠正成立，不将 root 的结构化核对称为再读整份 JSON。Prometheus functions 仅读 323–458 与 818–847；histograms 的 root 阅读范围为 138–302、339–525，作者另有全文记录。桶聚合、保留 le、先 rate 再 sum、分位数估计误差和无样本状态均有原始规则支持。

## 保留与浏览器

完整新增 diff 已读，原 52 个来源不重计，旧图与原有压测、Roofline 和瓶颈例子保留。作者保留检查见 `metrics-tail-preservation.json`。root 实际运行 `root-metrics-browser.mjs`，查看全部 15 张根截图：两页前两屏、新指标段、新图与 calc、相关版本表、指标表、PromQL 和修订后的 OTLP 说明。图内顺序、单位和跨框箭头清楚，表格未裁切；表宽均不超过正文 1076 px。两条跨页链接实际点击到目标，页面哈希稳定、pageerror 0、无页面溢出或断图。报告为 `.tmp/continuation-groups-2026-11-10/metrics-root-browser/report.json`。

## 接受边界

两页哈希分别为 `8c505f8ab816a99de4a85cd2540803b82b57ddba1695713e3d5d93f2d722bc1b` 与 `71f9bd3324e785bbf9215a91361ec780606e9782846f27d5f4ed08b6fe138260`。新图 YAML 为 `8725f21aea47ebf405ba74bf4ce4f7e65504de21b722332002fb44e6b908861b`，SVG 为 `9d4f2a22cd615e94701c04120c033d9154d176e897656ff304cac83834b4c957`。

本增量没有未关闭 P1/P2，但不覆盖随后发现的离线 LLM.get_metrics 入口，后者继续单列。未启动 NPU、Prometheus、Grafana、Jaeger 或 OTLP 采集器。示例中的四张 imgur 原图仍未取得：作者 GET 返回 429，root 在线打开分别失败或只得 JavaScript 站点壳；没有将下载尝试算成看图。它们与此前 DeepSeek 三张缺图分别保留，不据此宣称全部官方资料已核完。
