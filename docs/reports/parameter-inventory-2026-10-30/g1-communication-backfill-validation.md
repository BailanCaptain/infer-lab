# G1 通信与超时补写与验收

2026-11-01：G1 **9/9 个有效配置项已补写并验收**，另 2 个待核变量已按固定源码与依赖关闭消费位置疑问。当前 GLM 必补范围由 30 项降为 **21 项**：G2 加载与显存 3、G3 输入边界 9、G4 基础日志 9。可选候选不自动进入待办。

## 范围与落页

依据 [wiki 写作标准](../../wiki-writing-standard.md) 和 [GLM 范围计划](glm-scope-plan.md)，保留机制教学与唯一出处，补入口、默认、范围、覆盖、配方、报错与版本边界。固定 vLLM 0fc695fc、Ascend db701c1f、教程 0576b647；不能用上游默认替代平台处理后的值。

固定 A2 Dockerfile、匹配 torch/torch_npu 依赖与公开 GLM 镜像 OCI 元数据共同限定核查范围；HCCL 说明按 CANN 9.1.X 的 A2 条目。公开镜像 metadata 为 CANN 9.1.0，不等于已核用户现场 digest。详细证据见 [两个变量核查](g1-pending-variable-audit.md)。

| 原 ID | 配置项 | 唯一参考页 | 补齐重点 |
|---|---|---|---|
| W0126 | HCCL_OP_EXPANSION_MODE | [引擎进程](../../../wiki/concepts/engine-processes.md#怎么开) | A2 四种模式、默认与配方、通信域/确定性覆盖、双机与图限制 |
| R001 | GLOO_SOCKET_IFNAME | 同上 | CPU 组消费者、精确名称、多接口轮转、缺省与 loopback 回退 |
| R003 | HCCL_SOCKET_IFNAME | 同上 | Host 建链接口、匹配语法、缺省选择、与 Gloo 区别 |
| R004 | HCCL_IF_IP | 同上 | 每机 Host 地址、IPv4/IPv6、优先于接口名、不是 NPU IP |
| W0253 | VLLM_EXECUTE_MODEL_TIMEOUT_SECONDS | [调用链](../../../wiki/concepts/request-call-chain.md#怎么开) | 上游 300、固定 Ascend 小值改 3000、两次 RPC 分别计时、三版差异 |
| R005 | HCCL_CONNECT_TIMEOUT | 同上 | 秒、120–7200、默认 120、配方 1200、另加 20 秒失败通知 |
| R006 | HCCL_EXEC_TIMEOUT | 同上 | HOST 与 AIV 的范围/0/精度差异、通信域覆盖、配方 3600 不是实际等待保证 |
| W0267 | VLLM_HTTP_TIMEOUT_KEEP_ALIVE | [API 入口](../../../wiki/concepts/api-server-entry.md#怎么开) | 整数秒/默认 5、HTTP 空闲复用示例、不是生成总时限或 SSE 心跳 |
| R007 | HCCL_BUFFSIZE | [HCCL buffer](../../../wiki/concepts/gap-a5164fe10fa9184412f8.md#怎么开) | ≥1/默认 200/配方 1024、收发预算、逐域覆盖、MC2 单窗口区别 |

- **R008 VLLM_RPC_TIMEOUT**：固定 vLLM 未注册，无包内消费者；默认未知环境变量检查告警，严格检查才拒绝。不能替代实际 Worker 等待参数，不把教程的 3600000 换算为本版本有效时限。
- **R002 TP_SOCKET_IFNAME**：匹配 PyTorch/torch_npu 中有 TensorPipe 消费者，但固定主路径不启动其 agent；不是 TP8 网卡开关。注册后端与启动 agent 已分开核查。

两项各在原页面解释，不计入 9 个有效配置项。旧台账保留历史状态，当前完成覆盖层为 [G1 验证 JSON](g1-communication-validation.json)。历史原 120 个完成单元加本批 3 个 W 项，为 **123**；6 个 R 项是配方新发现的外部变量，单列计数，不能写成原台账完成 129。

## 独立审查与纠错

[独立审查](g1-independent-review.md)由新的审查者在写后阅读实际页面、diff、固定来源与图：1 P1、1 P2、2 P3 已修订并复审关闭，无遗留发现。

- HCCL 原图暗示逻辑组数等于独立缓冲份数；保留布局，改为三个独立底层域，每色块代表含收发的整套缓冲，同步纠正标题与首节。
- 展开模式补齐替代枚举及 A2 双机边界；额外 20 秒不再称未经证实的轮询；严格环境检查的默认补固定来源。
- 调用链及 V1 总览不再把上游 300 秒泛化成 GLM 实际值；部署页只追加两个唯一参考链接。
- 来源规则仅登记五个固定提交文件和 Uvicorn 设置文档路径，保持生态级，同步 HANDBOOK；不放行整个依赖仓库。

独立审查另核初学者开篇复述、信息保留；HCCL 图有独立渲染并目检的 [PNG](../../../tools/wiki-runtime/g1-communication-20261101/review-hccl-buffer.png)。

## 实际验证

原始结果位于 `tools/wiki-runtime/g1-communication-20261101/`。

| 验证 | 实际结果 |
|---|---|
| 包、依赖与 OCI | 11/11 断言；版本/tiling 比较 5/5，见 variable-audit 下两个 validation JSON |
| 来源分类与代码风格 | `pnpm exec vitest run scripts/wiki/sources.test.ts`：38/38；两份来源代码 Biome 检查通过 |
| Wiki 构建与内容 | `pnpm wiki:build`、`pnpm check:content`：167 页、11 主题，正文完整无重复 |
| 标准及来源审计 | `pnpm wiki:audit`：104/104 强制页达标，4777 条行号有效，0 无效 commit/缺文件/越界；288 个 URL 与 1701 条 raw 摘录不在该命令联网/内容认证范围内 |
| Wiki lint | 通过；10 条既存非阻塞提醒。本批新增重复别名已去掉 |
| 图 | 仅生成 hccl-buffer.svg；`pnpm wiki:diagrams --check`：331 张一致 |
| 生产构建 | `pnpm build`：TypeScript 与 Vite 成功；保留配置加载和性能计时提示 |
| CLI 检索 | 11/11 首条命中预期参考页，详见 cli-retrieval.json |
| 桌面检索 | 实际输入 11 个名称，每次目录返回 1 个预期页，未用文本扫描冒充 UI 操作 |
| 桌面阅读及链接 | 5205 构建预览读四主页面前两屏、图与参考段；HCCL 原两个 calc 正常显示；实点进程→超时、入口→调用链、部署→通信环境；V1 纠错行已阅读 |

browser-verification.json 是实际 UI 操作和截图观察记录，不冒充自动 DOM 断言。没有运行真实双机通信或超时触发实验。

## 保留性与写作自查

六个相关页的原 sources 前缀、calc、机器历史尾注全部保留；独立审查另做语义去向检查。36 个原图文件仅 HCCL 首图 YAML/SVG 因纠错改变，另 34 个哈希一致。详见 preservation-and-density.json。

下表按仓库口径“汉字数 + 拉丁单词数”；正文为对照源码前且排除围栏，全文另排除机器历史和围栏。

| 主页面 | 正文字数 / 行内代码每千字 | 正文角标 | 首图前 calc | 全文行内代码每千字 |
|---|---|---:|---:|---:|
| 进程 | 6364 / 0 | 0 | 0 | 9.90 |
| 调用链 | 5125 / 11.12 | 0 | 0 | 28.73 |
| API 入口 | 6421 / 0 | 0 | 0 | 6.35 |
| HCCL buffer | 2555 / 5.09 | 0 | 0 | 13.24 |

进程与 HCCL 首图前无数字 token；API 保留原示意 ID 7/31/1052/9，调用链保留原部署角色与七站表数字。首图正文行号分别 11、34、17、7，完整数字列表、calc 数及免责句比例见 JSON。没有为降低统计值删除既有解释；源码区密度另报，不伪称全文也低于教学正文阈值。

## 限制与下一批

现场 digest、环境继承、逐域覆盖、实际 AIV 路径/量化时限、缓冲分配及性能仍需真实双机日志。这些边界没有随消费位置核清而删除。

文档交付无待用户决定的问题。下一批 G2：PYTORCH_NPU_ALLOC_CONF、safetensors_load_strategy、trust_remote_code，共 3 项，补设备内存与 Worker 生命周期页。
