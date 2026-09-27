---
id: rfork-config
title: RFork 配置：四类端口、各项超时与可复制的启动示例
type: feature
summary: >-
  想让第二个实例从已有实例借权重，要在启动命令里写哪些设置、写在哪。这页按用途讲工作版 RFork 的十一个客户端设置：模型身份、找 Planner、
  来源地址和端口、心跳与还租约；讲清楚键名写错为什么不报错、固定端口只固定了哪一个、几种超时各管什么、动态专家均衡为什么会让它不生效，最后给可复制的启动示例和验收方法。
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
updated: '2026-09-25'
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

## 第二个实例要从第一个实例借权重，设置写在哪

机器 A 上已经跑着一个模型实例。现在要在机器 B 上再起一个同样的实例，希望它不从磁盘读权重，而是直接从 A 的显存里拷过来。B 的启动命令里要多写些什么？

两件事：一是告诉 vLLM「这次用 RFork 这种加载方式」；二是把 RFork 自己的一包设置（模型身份、Planner 在哪、自己对外报什么地址、心跳多久一次……）交给**模型加载器的额外设置**那个入口。容易写错的地方是：这包设置**不是**塞进昇腾插件平时用的那个「附加设置」入口里。

还有一件要分清的：Planner 是另一个独立的服务，负责撮合「谁向谁借」、记账借用名额。它的租约有效期、容量这些，是在启动 Planner 时由它自己的命令行定；B 这边的客户端设置改不了它。

这页是用户工作版的参考页，按「怎么配、每项什么意思、怎么核验」展开。下面所有示例里的地址和模型路径都要换成现场的；各项含义来自读源码，**还没有在真实 NPU 上跑通过一次完整加载**。具体字段名、命令和报错都在后面的「对照源码」里。

## 三个「模型名字」各管各的

一条启动命令里，至少有三处看起来像「模型名」，但作用完全不同，再加上部署策略名一共四项：

| 这一项 | 管什么 | A、B 两端要不要一样 |
|---|---|---|
| 启动命令后面跟的模型路径 | 本地从哪里取模型来构建、以及借不到时正常加载从哪读 | 路径文字可以不同，但实际模型内容和配置要对得上 |
| 模型身份串 | RFork 用来判断「是不是同一个模型」的字符串 | 想进同一个可互借的池子，就要一致 |
| 部署策略名 | RFork 的部署方式命名空间 | 同池一致；不兼容的部署要隔开时，换一个新值 |
| 对外服务名 | 调 API 时写的模型名 | 不参与 RFork 的匹配 |

模型身份串的字段名里带「URL」，很容易让人以为 RFork 会去这个地址下载模型。其实它只被当作一串文字做身份比对；借不到时的正常加载仍按模型路径走。身份串或策略名留空，加载一开始就会失败。更细的匹配规则见[身份与匹配](rfork-identity.md)。

## 十一项客户端设置，按用途分四组

| 组 | 设置 | 默认值 | 说明 |
|---|---|---|---|
| 身份与找人 | 模型身份串 | 空 | 必填 |
| | 部署策略名 | 空 | 必填 |
| | Planner 地址 | 空 | 必填，形如 `http://10.0.0.10:1223` |
| 超时 | 来源服务启动预算 | 5 秒 | 本机来源服务起来并通过健康检查的预算；**不是**租约有效期 |
| | 单次请求超时 | 10 秒 | 找 Planner、取元数据的每一次 HTTP 请求 |
| 地址与端口 | 监听地址 | `0.0.0.0` | 来源服务在本机哪块网卡上监听 |
| | 对外宣告地址 | 留空，自动取本机 IP | 报给 Planner、供别的机器来连的地址 |
| | 端口基数 | 0 | 0 表示端口由系统随机分配；正数时，端口 = 基数 + 本进程在分布式组里的全局编号 |
| 心跳与还租约 | 心跳间隔 | 30 秒 | 上一次心跳结束后再等多久发下一次 |
| | 还租约总次数 | 3 | 含第一次 |
| | 还租约重试间隔 | 30 秒 | 两次可重试失败之间等多久 |

前八项除了写在设置包里，还可以用同名的大写环境变量给（端口基数除外）；后三项只认设置包里的值。

表里两行的措辞是有意这样写的：心跳间隔是**上一次心跳请求结束之后**再等这么久，不是固定节拍的定时器，所以 Planner 那边看到的心跳周期总比 30 秒长一点；宣告地址留空时，上报那一刻会当场取本机 IP 填进去，不会真的报一个空地址。

**填错值的后果分两类**，别混成「填错都会报错」：

- 心跳与还租约那三项是严格检查的，显式填了非法值（比如负数、字符串）会直接报错，进程起不来。而且这个检查发生在加载器刚创建的时候，比「RFork 失败就退回正常加载」那层保护更早——所以这里报错**不会**自动改用正常加载，得先把设置改对。
- 两个超时填了非法值不报错：先去看环境变量，没有就用默认值。

## 键名写错不报错，只是悄悄当没填

十一项里只有三项认别名：单次请求超时、监听地址、宣告地址各有一两个短写法可用。其余每项只认唯一那个键名。

键名拼错一个字，程序**不会**提示「未知字段」，而是当作这项没填：先查环境变量，查不到就用默认值或空串。后果有两种：

- 把来源服务启动预算的键名少写了前缀——它就悄悄按默认 5 秒跑，你以为改了其实没改。
- 把 Planner 地址的键名少写了前缀——它一路空到加载开始，报的是「Planner 地址是必填项」，看不出你其实写了，只是键名不对。

有别名的那三项，看的是**第一个出现的键**，不是挨个找第一个有效的值：写了正式键名就只看它，哪怕它的值无效，也不会改去读短写法。值无效时处理方式和上面一样——查环境变量，再退默认值。

端口基数还有一个细节：必须是真正的整数。写成带引号的 `"35000"` 会被当作 0，也就是退回随机端口；`true` / `false` 虽然在 Python 里算整数的一种，也会被拒绝；负数或大于 65535 同样拒绝。

## 一台机器上有四类端口，固定的只是其中一个

「把端口固定下来」这件事，只固定了**来源元数据服务**那一个端口：

| 端点 | 谁来连它 | 由什么决定 |
|---|---|---|
| 模型 API 端口 | 发推理请求的业务方 | 启动命令里的端口 |
| Planner 端口 | 每个 RFork 进程 | 设置里的 Planner 地址 |
| 来源元数据端口 | 来借权重的新实例，先来这里取元数据 | 默认系统随机分配；或基数 + 全局编号 |
| 传输引擎端点 | 真正搬权重的那条通道 | 初始化时自动取本机 IP 和一个空闲端口 |

宣告地址只改报给 Planner 的元数据地址，不会顺带改传输引擎自己选的端点。所以如果「元数据取得到，真正读权重却失败」，要查的是第四行能不能连通。

举例：基数 35000、全局编号 3，元数据端口就是 35003。相加超过 65535 时，工作版打一条警告，退回随机端口；但端口**被占用**时没有这种自动改口，要去看来源服务的启动报错。

全局编号只在一个分布式组内唯一，同一台机器上两个互不相干的实例可能撞号；主模型和投机解码的 draft 模型也可能用同一个进程的编号。所以固定端口可能互相抢——要么按实际部署把端口隔开，要么保持随机端口，并且分别确认两个模型角色的来源服务都起来了。

本机健康检查连的是实际绑定地址；监听 `0.0.0.0` 这类「所有网卡」地址时，改连本机回环地址。所以健康检查通过**只说明本机能访问**，不说明别的机器能连上宣告地址，更不说明传输通道通。

内建的来源服务是普通 HTTP。设置里用来匹配的那串身份只是匹配用的，不是登录凭据。如果现场要走 HTTPS，得核对代理、地址和转发怎么配；不能只把地址改成 `https://` 就当内建服务支持加密。

## 超时、重试间隔和总耗时不是一个量

单次请求超时管的是每一次 HTTP 请求等连接、等回复的时间，不是「从借来源到对外服务」整件事的截止时间。

还租约默认最多 3 次、间隔 30 秒。三次都要重试时，光间隔就占 60 秒，还要加上每次请求本身、等锁、线程调度的时间。如果每次请求恰好都卡满 10 秒，总共约 90 秒——但这只是一个算例，**不是上限**。

来源服务启动那 5 秒也一样：它用来算健康检查的截止时间，并用剩下的时间限制排队和轮询；失败后的清理另有一份等待预算。单次请求本身也不是硬截止，所以整个启动或失败清理的函数并不保证 5 秒内结束。

评估租约有效期要够长时，要把**借到之后的内存登记、取元数据、真正读权重、后台还租约**都算进去，再加上重试间隔。调大单次请求超时不会让 Planner 自动延长租约。某次借用到底有没有过期，要看 Planner 那边记的租约时间和借用方日志里的持有时长，见[生命周期](rfork-lifecycle.md)。

## 设置写对了还不够：依赖和限制要实际核对

- 传输引擎来自 openYuanrong 数据系统的 Python 包。光「装了同名包」不够，它还得提供按批登记显存的那个接口，缺了会直接判为不支持。
- 模型已经落地的参数和缓冲区必须全部在 NPU 上；一部分在 CPU、一部分在 NPU 会被拒绝，转去正常加载。
- 开了动态专家负载均衡（EPLB），或者配了专家映射记录路径，RFork 会被整个绕过。调重试次数改变不了这个限制。
- 正常加载的路径必须留着：第一个实例冷启动要靠它，借不到时也要退回它。「能从来源加载」不等于可以不要磁盘上的权重文件。

官网写的安装包名和随工作版保存的指南里的包名不一致，见[官方文档核读](../sources/rfork-official-guide.md)。不要在已经在跑的环境里直接把某个同名包升到最新版。先在**真正跑推理进程的那个 Python 环境**里做一次只读检查（脚本在下半「怎么开」），记下模块从哪里加载、包是什么版本，再按部署配套的版本去验证设备上的行为。

## 怎样验收这套配置真的有用

在同样的模型、输入和采样设置下，分别记录五种情况：正常加载的基线、第一个实例冷启动、第二个实例借到来源、找不到来源、中途出故障退回正常加载。每种情况都分段记时间：初始化、排布、申请来源、登记内存、取元数据、读权重、还租约、自己发布成来源、服务就绪。

比对输出或 logits 时，方法要符合这个模型的确定性和容差要求。同时看两件事：被借的那台机器上，正在跑的推理延迟有没有变差；并发扩容多个实例时，启动耗时的长尾有多长。只测一条小请求正常，不能说明所有模型、量化方式和共享路径都支持。

## 对照源码

### 怎么开

RFork 的设置走 `--model-loader-extra-config`，不是 `--additional-config`；`--load-format rfork` 选择这个加载器。Planner 的 TTL 和并发容量属于 Planner 服务自己，客户端参数不会替它改配置。[C1][C8]

上半「三个模型名字」对应的字段：

| 上半叫法 | 字段 / 参数 |
|---|---|
| 启动命令后的模型路径 | `vllm serve` 后的位置参数 |
| 模型身份串 | `model_url` |
| 部署策略名 | `model_deploy_strategy_name` |
| 对外服务名 | `--served-model-name`，不是 RFork 指纹的直接字段 |

`model_url` 只作字符串参与身份匹配，fallback 仍使用模型加载配置。[C2]

客户端参数全表（默认值与读取顺序来自 `RForkConfig`）：

| JSON 字段 | 默认值 | 有效输入与环境回退 | 别名 |
|---|---|---|---|
| `model_url` | `""` | `MODEL_URL` | 无 |
| `model_deploy_strategy_name` | `""` | `MODEL_DEPLOY_STRATEGY_NAME` | 无 |
| `rfork_scheduler_url` | `""` | `RFORK_SCHEDULER_URL` | 无 |
| `rfork_seed_timeout_sec` | 5.0 | 有限正数；`RFORK_SEED_TIMEOUT_SEC` | 无 |
| `rfork_request_timeout_sec` | 10.0 | 有限正数；`RFORK_REQUEST_TIMEOUT_SEC` | `request_timeout_sec` |
| `rfork_seed_bind_host` | `0.0.0.0` | `RFORK_SEED_BIND_HOST` | `seed_bind_host`、`bind_host` |
| `rfork_seed_advertise_host` | None，随后自动探测 IP | `RFORK_SEED_ADVERTISE_HOST` | `seed_advertise_host`、`advertise_host` |
| `rfork_seed_port_base` | 0 | JSON 整数；无环境回退 | 无 |
| `rfork_heartbeat_interval_sec` | 30.0 | 严格有限正 JSON number；无环境回退 | 无 |
| `rfork_lease_release_max_attempts` | 3 | 严格正 JSON integer；无环境回退 | 无 |
| `rfork_lease_release_retry_interval_sec` | 30.0 | 严格有限正 JSON number；无环境回退 | 无 |

心跳「请求结束后再等」与 advertise 留空时由上报函数当场取本机 IP，见 `planner_client.py`。[C9]

先在具备依赖的环境启动此版本的**示例** Planner；它是协议演示，不自动提供生产级持久化或多副本共享状态：

```bash
python examples/rfork/rfork_planner.py --host 0.0.0.0 --port 1223 --lease-ttl-sec 60
```

这三个开关（以及 `--heartbeat-ttl-sec`、`--default-resource-points`、`--alloc-policy`）由示例 Planner 自己的命令行解析定义，默认值来自同名的 `RFORK_MOCK_*` 环境变量；它们配置的是**服务端**的租约与容量，和客户端参数表不是一套。[C14]

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

启动前在实际 Worker 所用的 Python 环境做只读 API 检查：

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

此检查不实例化引擎、不注册设备内存；通过只说明 API 名称可见。还需核对 `MemoryRegistration` 四参数的语义、部分失败后的注销结果、native 返回对象及 finalize 对活动传输的行为。`kNotFound` 在工作版是可选探测，缺少时不能走对应的「已不存在」确认逻辑；不能擅自补一个猜测错误码。[C4][C10]

### 会报什么错

- 空 `model_url` 或空 strategy：session 初始化失败。
- `rfork_scheduler_url` 键名写错（如写成 `scheduler_url`）且无环境变量：报 “`rfork_scheduler_url` is required”，看不出其实是键名不对。
- heartbeat / release attempts / release interval 三个运维字段显式填错：抛 `ValueError`；两个 timeout 对无效输入先试环境值，再退默认值。
- 这些参数在加载器 `__init__` 中解析，早于 `load_model` 内的 RFork 回退保护，所以严格校验抛出的 `ValueError` 不会自动转默认加载。[C12][D]
- `rfork_seed_port_base`：JSON 输入不是 int 时读取函数先退成 0（`"35000"` 不会成为固定端口）；bool 虽是 int 子类，后续仍明确拒绝；负数或大于 65535 也拒绝。
- base + global rank 超过 65535：记录 warning 并退回随机端口；端口被占用没有同样的自动改口，看 seed 启动错误。[C3]
- TransferEngine 初始化使用 `yr.datasystem` 的 `TransferEngine`、`MemoryRegistration`、`ErrorCode`，传输类型为 `ascend`。 缺 `batch_register_memory_ex` 直接判定不支持。
- 实际物化的 Parameters / buffers 不全在 NPU（混合 CPU/NPU）：拒绝并尝试默认加载。[C5]
- 本地健康检查使用实际绑定地址，监听 `0.0.0.0` / `::` 时改用回环地址；健康检查 200 不证明 advertise 地址远端可达，也不证明 TransferEngine 数据端点连通。[C11]
- metadata 能拿到、native read 却失败：`rfork_seed_advertise_host` 只改发布给 Planner 的 seed HTTP 地址，TransferEngine 端点由 `get_ip()` + `get_open_port()` 在初始化时选择，要单独查它的可达性。

### 开销和什么时候别开

- `parallel_config.enable_eplb`、`eplb_config.dynamic_eplb` 或 `expert_map_record_path` 命中动态 EPLB 检查时 RFork 被绕过，调重试数不改变这个限制。[C6][C7]
- `rfork_request_timeout_sec` 传给 Requests，约束连接 / 读等待，不是总截止时间。按 `3 × 10 + 2 × 30 = 90 秒` 计算只是每次 HTTP 恰好耗时 10 秒的算例，不是严格上界。[S13][D]
- seed 启动用单调时钟算健康检查 deadline，用剩余时间限制队列与轮询；失败清理另有等待预算。
- 固定端口：global rank 在分布式组内唯一，不保证同机多个独立实例之间唯一；main 与 draft 也可能用同一 Worker 的 global rank。需按部署隔离端口或保留动态端口，并分别验证两个模型角色的 seed 启动结果。[I]
- 内建 seed 服务以普通 HTTP 启动；seed key 是匹配字段，不是认证凭据；走 HTTPS 要核对代理、URL 与转发配置。
- 验收：只测一条小请求正常，不能宣称所有模型、量化与共享路径都被支持。[I]

### 版本差异

本页只讲用户确认的 RFork 工作版（`rfork@3284850b`），版本演进见[总览页](rfork.md)。官网安装项与随工作版保存的指南使用的发行包名存在差异，见[官方文档核读](../sources/rfork-official-guide.md)。

### 源码位置

- `RForkConfig` 默认值、环境回退、别名与严格校验：`vllm_ascend/model_loader/rfork/config.py`
- 空 `model_url` / strategy 的 session 初始化检查：`session.py`
- seed 端口计算、溢出回退随机端口、advertise 发布：`session.py`
- TransferEngine 初始化与端点选择：`transfer_backend.py`；注册接口与 `kNotFound` 可选探测：`transfer_backend.py`
- 混合 CPU/NPU 检查：`transfer_backend.py`
- 动态 EPLB 绕过：`rfork_loader.py`
- 参数在 `__init__` 解析、`load_model` 回退保护：`rfork_loader.py`
- 心跳间隔语义与 advertise 自动取 IP：`planner_client.py`
- seed HTTP 服务、健康检查 deadline 与回环地址：`seed_server.py`
- 示例 Planner 的 TTL 默认值 与命令行开关：`examples/rfork/rfork_planner.py`
- 工作版指南中的超时与重试说明：`docs/source/user_guide/feature_guide/rfork.md` [S13]
