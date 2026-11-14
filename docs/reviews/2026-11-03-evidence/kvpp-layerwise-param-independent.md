# KVPP 与逐层参数增量独立复核

审查者：review_first_pages。结论：接受当前三页增量；发现的 P2 和 P3 已由作者修正并再次核对。范围是 `kvpp-layerwise-param-remediation.diff` 全部差异、相邻教学上下文及下列实际原文，不代表重新核完三页所有历史引文。未修改教学页，未进行 UI、NPU 或部署运行验证。

## 实际核对

- `baa023ad ascend_config.py 62–140、1603–1608、1660–1678`，`7d825229 ascend_config.py 62–140、1834–1912`：size 推导、类型校验、派生键过滤、七项 main 条件及 rc2 的 DSpark 专属分支。新文没有把跳过 KVPP 专属检查说成服务一定启动。
- `baa023ad worker.py 1096–1106`、`worker/v2/kvpp.py 22–58`、`worker/v2/attn_utils.py 628–637`、`pool_worker.py 116–126`、`platform.py 1495–1505`：组件复用推导规则；worker 随后可读单例，旧设计动机推断已去除。
- `baa023ad kv_p2p/mooncake/base_worker.py 209–246`、`core/kv_cache_placement.py 19–44、128–159`：只发布 owner 常驻层；MTP 不进入层归属，容量算例有等大层和额外常驻限制。
- `baa023ad distributed/kvpp.py 8–35`、`worker/v2/kvpp.py 46–58`、官方 `kvpp.md 97–104、193–197`：广播整层已分配 buffer，num_blocks 增大会增通信量，不能从增加 owner 数推出通信量或时延不变。
- `baa023ad pool_worker.py 625–762`、后端注册表 `backend/__init__.py 15–73`、`mooncake_layerwise.py 20–185`、`memcache_backend.py 80–105`、`yuanrong_backend.py 20–141`：逐层和非逐层均有线程路径；Memcache/Mooncake 协议并存；Yuanrong 元数据初始化及查询异常并非静默保证。
- `2c59ff10 pool_scheduler.py 68–85`、`2ed6cbba pool_scheduler.py 75–92`、`layerwise_cache_layout.py 255–305`：Mamba align 条件、仅存在复用关系时的缓存类型/描述符限制，不能统一否定所有混合缓存。
- `7d825229 ascend_store_connector.py 332–366`：先等当前层加载再复制 Mamba 状态；`baa023ad pool_scheduler.py 289–309`：逐层从 block 0 查询。
- `0fc695fc vllm/config/vllm.py 1244–1276`、`db701c1f ascend_store_connector.py 78–89`、`platform.py 596–623`：含整图才要求 PIECEWISE；后续 enforce_eager 可置 NONE，未扩大 GLM 可部署保证。
- `baa023ad` 官方 `mooncake_layerwise_adaptation_and_optimization.md 1–95、191–199`：实际读的是这些完整范围；没有声称读了该指南全文。逐层使用同一对象的不同字节范围，示例预取距离可为 2。

## 问题闭环

1. **P2，use-layerwise 当前第 168 行**：原相邻段将逐层概括为“每层一个远端对象”。官方固定指南 19–59 与协议 35–49 明确 Mooncake 为每 block/rank 一个对象。作者改为按层定位，区别 per-layer key 与 block-key 字节范围，并保留对象数减少不等于有效载荷减少。新增来源 42；已实际复读修订段，关闭。
2. **P3，use-layerwise 当前第 182 行**：原图模式结论没有紧邻说明后置 eager 覆盖。作者扩来源 23 至 1276，并加入 NONE/最大捕获宽度 0 的条件；已实际复读源码和当前段，关闭。

容量算例与旧版本边界保留。当前三页增量未发现其他可核实的 P1/P2。最终文件哈希见同名 JSON。
