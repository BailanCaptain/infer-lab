---
id: rfork-config
title: RFork 配置：四类端口、各项超时与可复制的启动示例
type: feature
summary: >-
  工作版 RFork 参数完整参考与启动说明，区分 model-loader-extra-config、环境变量、Planner 参数和网络端点；解释
  patch7 固定端口、动态 EPLB、混合设备限制与验收方法。
aliases:
  - RFork 配置
  - rfork_scheduler_url
  - rfork_seed_port_base
  - rfork_seed_advertise_host
  - rfork_request_timeout_sec
  - rfork_heartbeat_interval_sec
  - rfork_lease_release_max_attempts
  - rfork_seed_timeout_sec
chapters: []
order: 90
sources:
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/config.py#L11-L139'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L35-L49'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L349-L413'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L207-L233'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L289-L295'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L373-L382'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L539-L561'
  - 'rfork@3284850b:examples/rfork/rfork_planner.py#L39-L75'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/planner_client.py#L213-L267'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L395-L614'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/seed_server.py#L127-L377'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L414-L419'
  - 'rfork@3284850b:docs/source/user_guide/feature_guide/rfork.md#L160-L165'
  - 'rfork@3284850b:examples/rfork/rfork_planner.py#L542-L582'
verified:
  - 'rfork:main'
evidence: C
relations:
  - to: rfork-identity
    kind: builds-on
    note: model_url 与部署策略是匹配标识，必须先理解它们不等于 served-model-name
  - to: rfork-lifecycle
    kind: builds-on
    note: lease 重试、心跳与 seed 启动超时分别作用于不同生命周期
contradicts: []
updated: '2026-09-23'
rawSources:
  - >-
    raw/sha256-073796cbe486e20d214f38511765d39c6eeadc44ccf5568f0097b54b2d1dc28e.md
  - >-
    raw/sha256-1ae36dd2945d6704b17e8d8c2d24f1e68a61a92f72ed3f18b9ba0c7dfcc97db3.md
  - >-
    raw/sha256-22f6d04426e0defa217c4f60bcb3fba3c71e2a966e4f415864440ec682d871d3.md
  - >-
    raw/sha256-280c501d0e376e2b74d0e921324d49b1ce5a99025fb3935c1e55f50fa73111da.md
  - >-
    raw/sha256-59591a4419847f7e688d941665e517ceeff58268f61c79d46d5e2398c4b5e7ce.md
  - >-
    raw/sha256-5bad70ef874cd30dbb1c42ecd2370b814b3bafa2c63fceb2ab55f1da7f506deb.md
  - >-
    raw/sha256-7c1cf46ed24557ae509144bda485106fc93a596c0e8a111ed26f83c3491c0981.md
  - >-
    raw/sha256-be7651d21c2f6c44f19cb939989ef0d4119a8cdfdaf2f59003e14ee2166cd069.md
---

## 一句话

**RFork 自己的设置放在 `--model-loader-extra-config`，不是 `--additional-config`。** `--load-format rfork` 选择加载器；Planner 的 TTL 和并发容量属于另一个服务，客户端参数不会替它改配置。[C1][C8]

本页是用户工作版的参考页，按“怎么配、具体含义、怎么核验”展开，不套概念页的请求流程骨架。所有示例都需要现场替换地址与模型路径；页里的参数含义来自源码，尚未在真实 NPU 上跑过一次完整加载。

## 一条启动命令里，三个“模型名字”各管什么

| 字段 | 管什么 | 是否必须两端相同 |
|---|---|---|
| `vllm serve` 后的模型路径 | 本地构建和默认加载从哪里取模型 | 路径文字可不同，但实际模型内容与配置需对应 |
| `model_url` | RFork 模型身份字符串 | 要进入同一兼容池就应一致 |
| `model_deploy_strategy_name` | RFork 部署策略命名空间 | 同池一致，隔离不兼容部署时使用新值 |
| `--served-model-name` | 对外 API 使用的服务模型名称 | 不是 RFork 指纹的直接字段 |

`model_url` 这个名字容易使人以为 RFork 会下载该 URL。此处它被读取为字符串用于身份匹配；实际 fallback 仍使用模型加载配置。空 `model_url` 或空 strategy 会使 session 初始化失败。[C2]

## 工作版客户端参数表

| JSON 字段 | 默认值 | 有效输入与环境回退 | 作用 |
|---|---|---|---|
| `model_url` | 空字符串 | `MODEL_URL` | 必填模型身份 |
| `model_deploy_strategy_name` | 空字符串 | `MODEL_DEPLOY_STRATEGY_NAME` | 必填部署策略 |
| `rfork_scheduler_url` | 空字符串 | `RFORK_SCHEDULER_URL` | 必填 Planner URL，如 `http://10.0.0.10:1223` |
| `rfork_seed_timeout_sec` | 5.0 秒 | 有限正数；`RFORK_SEED_TIMEOUT_SEC` | 本地 seed 服务启动 / 健康检查预算，不是 lease TTL |
| `rfork_request_timeout_sec` | 10.0 秒 | 有限正数；`RFORK_REQUEST_TIMEOUT_SEC` | Planner 与 metadata 的 HTTP timeout |
| `rfork_seed_bind_host` | `0.0.0.0` | `RFORK_SEED_BIND_HOST` | seed HTTP 监听的本机接口 |
| `rfork_seed_advertise_host` | None，随后自动探测 IP | `RFORK_SEED_ADVERTISE_HOST` | 向 Planner 宣告、供远端连接的地址 |
| `rfork_seed_port_base` | 0 | JSON 整数；无环境变量回退 | 0 为动态端口，正值加 global rank 形成 seed HTTP 端口 |
| `rfork_heartbeat_interval_sec` | 30.0 秒 | 严格有限正 JSON number；无环境回退 | 心跳请求完成后等待多久 |
| `rfork_lease_release_max_attempts` | 3 | 严格正 JSON integer；无环境回退 | 一次 lease 的释放总尝试数，含第一次 |
| `rfork_lease_release_retry_interval_sec` | 30.0 秒 | 严格有限正 JSON number；无环境回退 | 可重试失败之间的等待 |

默认值与读取顺序来自 `RForkConfig`。三个运维字段 heartbeat / release attempts / release interval 显式填错会抛 ValueError；前两个 timeout 对无效输入会尝试环境值，再退默认值。不要把两种行为混为一条“所有错误都会报错”。[C1]

表里有两行的措辞是精确的，不是随手写的：心跳间隔是**上一次心跳 HTTP 结束之后**再等这么久，不是固定频率的定时器，所以 Planner 侧看到的心跳周期总比 30 秒长一点；advertise 留空时由上报函数当场取本机 IP 填进去，而不是保持为空。[C9]

这些参数在加载器 `__init__` 中解析，早于 `load_model` 内的 RFork 回退保护。因而严格校验抛出的 ValueError 不能解释成“一定自动转默认加载”；应先修正配置。[C12][D]

**只有三个字段有别名**，其余字段各自只认表里那一个键：request timeout 还认 `request_timeout_sec`；bind host 还认 `seed_bind_host`、`bind_host`；advertise host 还认 `seed_advertise_host`、`advertise_host`。`model_url`、`model_deploy_strategy_name`、`rfork_scheduler_url`、`rfork_seed_timeout_sec` 都**没有**别名。把它们写错一个字，不会报“未知字段”，而是整条被当作没填：先去查对应的环境变量，查不到就退默认值或空串。后果分两种——`rfork_seed_timeout_sec` 写成 `seed_timeout_sec`，就悄悄按 5.0 秒跑下去，你以为改了其实没改；`rfork_scheduler_url` 写成 `scheduler_url`，则一路空到 session 初始化，报出来的是“`rfork_scheduler_url` is required”，看不出你其实写了、只是键名不对。[C1]

有别名的那三个字段，取的是**第一个出现的键**，不是挨个找第一个有效值：写了 `rfork_seed_bind_host` 就只看它，即使它的值无效，也不会改去读 `bind_host`。值无效时两类字段都一样——转去查环境变量，再退默认值。[C1]

端口有一个要实事求是的细节：JSON 输入不是 int 时，读取函数先退成 0；所以 `"35000"` 不会被解析成固定端口。布尔值虽被 Python 当作 int 的子类，后续仍明确拒绝；负数或大于 65535 的整数也拒绝。推荐始终传真实 JSON 整数。[C1]

## patch7 固定的是 seed HTTP 端口，不是所有端口

| 端点 | 谁连接它 | 从哪里确定 |
|---|---|---|
| 模型 API 端口 | 业务请求客户端 | `vllm serve --port` |
| Planner HTTP 端口 | RFork Worker | `rfork_scheduler_url` |
| seed HTTP 端口 | receiver 获取元数据 | 默认 OS 动态分配；或 base + global rank |
| TransferEngine 端点 | 真正权重传输 | `get_ip()` + `get_open_port()`，初始化时选择 |

`rfork_seed_advertise_host` 只修改发布给 Planner 的 seed HTTP 地址，不会同时覆盖 TransferEngine 自动选择的端点。metadata 能拿到、native read 却失败时，要检查第四行的可达性。[C3][C4]

base=35000、global rank=3 时，seed HTTP 端口是 35003；若相加超过 65535，工作版记录 warning 并退回随机端口。端口被占用时没有同样的自动改口保证，应看 seed 启动错误。[C3]

global rank 在一个分布式组内唯一，不保证同机多个独立实例之间唯一。main 和 draft 也可能使用同一个 Worker 的 global rank。固定端口配置因此可能发生竞争；需要按实际部署隔离端口或保留动态端口，并验证两个模型角色各自的 seed 启动结果。[I]

本地健康检查使用实际绑定地址；监听 `0.0.0.0` / `::` 时改用本机回环地址。因此健康检查 200 只能证明本机服务响应，不能证明别的节点能访问 advertise 地址，也不能证明 TransferEngine 数据端点连通。[C11]

内建 seed 服务以普通 HTTP 启动；seed key 是匹配字段，不是用户认证凭据。若部署通过代理提供 HTTPS，必须核对代理、URL 和转发配置，不能只把客户端地址改成 `https://` 就认为内建服务支持 TLS。

## timeout、重试间隔与总耗时不是同一个量

`rfork_request_timeout_sec` 传给 Requests，约束连接/读等待，不是从申请 seed 到发布服务的总截止时间。默认 release 总尝试 3 次，两次间隔各 30 秒；若三次均需重试，光等待间隔就可能占 60 秒，实际耗时还要加每次 HTTP、锁等待和线程调度。把它算成 `3 × 10 + 2 × 30 = 90 秒` **只能是每次 HTTP 恰好耗时 10 秒的算例，不能当作严格上界**。[M13][D]

seed 启动会用单调时钟计算健康检查 deadline，并用剩余时间限制队列和轮询；失败清理又有单独等待预算。单次 Requests 行为也不是硬性总时限，所以配置中的 5 秒不能理解成整个启动/失败清理函数最多运行 5 秒。[C11]

lease TTL 的评估要覆盖**申请成功后的注册、metadata、实际 read 和异步 release**，并考虑重试间隔；调大 HTTP timeout 不会让 Planner 自动延长 TTL。具体借用是否过期，应看服务端租约时间和接收端 `held_elapsed`，见[生命周期](rfork-lifecycle.md)。

## Linux / NPU 环境的启动示例

先在具备依赖的环境启动此版本的**示例** Planner；它是协议演示，不自动提供生产级持久化或多副本共享状态：

```bash
python examples/rfork/rfork_planner.py --host 0.0.0.0 --port 1223 --lease-ttl-sec 60
```

这三个开关（以及 `--heartbeat-ttl-sec`、`--default-resource-points`、`--alloc-policy`）都由示例 Planner 自己的命令行解析定义，默认值来自同名的 `RFORK_MOCK_*` 环境变量；它们配置的是**服务端**的租约与容量，和上面那张客户端参数表不是一套东西。[C14]

然后为每个实例设置自身可被远端访问的 advertise IP。下例使用默认动态 seed 端口，避免把同机拓扑假设硬写进最小命令：

```bash
export RFORK_CONFIG='{
  "model_url": "qwen3-0.6b-model-revision-A",
  "model_deploy_strategy_name": "rfork-work-patch7-tp1",
  "rfork_scheduler_url": "http://10.0.0.10:1223",
  "rfork_seed_advertise_host": "10.0.0.21",
  "rfork_seed_port_base": 0,
  "rfork_request_timeout_sec": 10.0,
  "rfork_heartbeat_interval_sec": 30.0,
  "rfork_lease_release_max_attempts": 3,
  "rfork_lease_release_retry_interval_sec": 30.0
}'
vllm serve /models/Qwen3-0.6B \
  --tensor-parallel-size 1 \
  --served-model-name qwen3 \
  --port 8000 \
  --load-format rfork \
  --model-loader-extra-config "$RFORK_CONFIG"
```

`10.0.0.*`、模型路径和版本标签均是示例，不能直接代表你的现场。第二个实例保留相同模型与策略标识，改成自己的 advertise 地址和可用业务端口；两端必须部署相容的 RFork 代码与模型配置。[A]

## 配置正确还不够，依赖与限制要实际核对

- TransferEngine 初始化使用 `yr.datasystem` 的 `TransferEngine`、`MemoryRegistration`、`ErrorCode`，传输类型为 `ascend`。[C4] 注册这一步还要求引擎提供 `batch_register_memory_ex`，缺了它会直接判定不支持；不能只凭装了同名包就判断兼容。[C10]
- 实际物化的 Parameters / buffers 必须在 NPU，混合 CPU/NPU 状态会被拒绝并尝试默认加载。[C5]
- `parallel_config.enable_eplb`、`eplb_config.dynamic_eplb` 或 `expert_map_record_path` 命中动态 EPLB 检查时，RFork 被绕过；调整重试数不会改变这个限制。[C6][C7]
- 仍需保留正常模型加载路径，以便第一实例冷启动或后续 fallback；“从 seed 加载”不等于可以移除 checkpoint 的可用性。

官网安装项与随工作版保存的指南使用的发行包名存在差异，见[官方核读](../sources/rfork-official-guide.md)。不要在已运行环境里直接升级到某个同名包的最新版本。先在**实际 Worker 所用的 Python 环境**做下面的只读 API 检查，记录模块来源与包版本，再按部署配套版本验证设备行为：

```python
from importlib.metadata import PackageNotFoundError, version
import yr.datasystem as ds

print("module:", ds.__file__)
for package in ("openyuanrong-transfer-engine", "openyuanrong-datasystem"):
    try:
        print(package, version(package))
    except PackageNotFoundError:
        print(package, "distribution metadata not found")

required = ("initialize", "batch_register_memory_ex",
            "batch_unregister_memory", "batch_transfer_sync_read", "finalize")
engine_class = getattr(ds, "TransferEngine", None)
missing = [name for name in required
           if not callable(getattr(engine_class, name, None))]
if not callable(getattr(ds, "MemoryRegistration", None)):
    missing.append("MemoryRegistration")
if not hasattr(getattr(ds, "ErrorCode", None), "kNotReady"):
    missing.append("ErrorCode.kNotReady")
print("missing required API:", missing)
print("optional kNotFound:",
      hasattr(getattr(ds, "ErrorCode", None), "kNotFound"))
```

此检查不实例化引擎、不注册设备内存；通过只说明 API 名称可见。还需核对 `MemoryRegistration` 四参数的语义、部分失败后的注销结果、native 返回对象及 finalize 对活动传输的行为。`kNotFound` 在工作版是可选探测，缺少时不能走对应的“已不存在”确认逻辑；不能擅自补一个猜测错误码。[C4][C10]

## 怎样验收这个配置真的有用

按相同模型、输入与采样配置，记录默认加载基线、首实例冷启动、第二实例 seed 命中、seed 缺失和故障回退。分别收集初始化、布局、申请、注册、metadata、read、release、seed 发布以及服务 ready 的时间。

对比输出或 logits 的方法应符合模型的确定性与容差要求；同时观察 seed 上正在运行的推理延迟和并发扩容时的尾部启动耗时。不能只测一条小请求正常就宣称所有模型、量化和共享路径都被支持。[I]
