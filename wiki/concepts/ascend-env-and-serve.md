---
id: ascend-env-and-serve
title: 容器镜像、核心环境变量与 vllm serve 最小起服务清单
type: concept
origin: direct
summary: >-
  锁死镜像并读懂模型目录后，把昇腾容器挂载（/dev/davinci*、驱动库、--shm-size 与 A3 双裸片成对映射）、四层环境变量真伪甄别与单机 vllm serve 最小启动及三步冒烟测试一次跑通。
aliases:
  - vllm serve
  - 容器镜像
  - 环境变量
  - docker run
  - 最小起服务
  - 冒烟测试
  - VLLM_USE_MODELSCOPE
  - vllm_ascend/envs.py
  - set_env.sh
chapters:
  - '01'
order: 20
sources:
  - 'vllm-ascend@c09d3e20:docs/source/getting_started/installation/prebuilt_image.inc.md#L12-L26'
  - 'vllm-ascend@c09d3e20:docs/source/getting_started/quick_start/ascend_image/atlas-a2.inc.md#L25-L52'
  - 'vllm-ascend@c09d3e20:docs/source/getting_started/quick_start/ascend_image/atlas-a3.inc.md#L26-L55'
  - 'vllm-ascend@c09d3e20:docs/source/getting_started/quick_start/ascend_image/atlas-950dt.inc.md#L25-L49'
  - 'vllm-ascend@c09d3e20:docs/source/getting_started/quick_start/ascend_image/verify_container.inc.md#L1-L16'
  - 'vllm-ascend@c09d3e20:docs/source/getting_started/installation/existing_cann_environment.inc.md#L35-L49'
  - 'vllm-ascend@c09d3e20:docs/source/getting_started/quick_start/online/qwen3-0.6b-310p.inc.md#L1-L18'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/configuration/additional_config.md#L57-L64'
  - 'vllm-ascend@c09d3e20:Dockerfile#L53-L68'
  - 'vllm-ascend@c09d3e20:vllm_ascend/envs.py#L38-L93'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L94-L98'
  - 'vllm-ascend@c09d3e20:vllm_ascend/cpu_binding.py#L24-L26'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1445-L1481'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L726-L746'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L120-L169'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L614-L756'
  - 'vllm-ascend@c09d3e20:csrc/mc2/dispatch_ffn_combine/op_host/dispatch_ffn_combine_tiling.cpp#L28-L66'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/device_op.py#L1255-L1260'
  - 'vllm@ced6857a:vllm/envs.py#L705-L720'
  - 'vllm@ced6857a:vllm/envs.py#L930-L932'
  - 'vllm@ced6857a:vllm/config/cache.py#L102-L106'
  - 'vllm@ced6857a:vllm/config/model.py#L2176-L2190'
  - 'vllm@ced6857a:vllm/entrypoints/serve/instrumentator/health.py#L20-L33'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/api_router.py#L40-L60'
  - 'vllm-ascend@2c59ff10:vllm_ascend/envs.py#L30-L114'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/envs.py#L30-L110'
  - 'vllm-ascend@8d6180e2:vllm_ascend/envs.py#L26-L99'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: ascend-model-onboarding
    kind: builds-on
    note: 承接五维版本配套、活跃食谱核验与权重格式选型结论，把选定的镜像与权重真正拉起成在线服务
  - to: hf-model-anatomy
    kind: builds-on
    note: 将从 config.json 与分词模板读出的架构、上下文上限与精度字段转化为 vllm serve 启动参数
  - to: hardware-devices
    kind: builds-on
    note: 对照四族昇腾硬件与 A3 双裸片物理拓扑，理解 /dev/davinci* 设备节点挂载与逻辑卡重映射
contradicts: []
updated: '2026-11-18'
---

锁死五维版本与权重选型（[新模型上线标准流程](ascend-model-onboarding.md)）、摸清模型结构（[读懂 HF 模型目录](hf-model-anatomy.md)）之后，临门一脚就是起容器、配环境变量并敲下 `vllm serve`。很多新手明明下对了镜像和权重，却栽在“容器找不到 NPU”“共享内存崩掉”或“抄了已失效的旧环境变量”。本页把单机起服务拆成**容器挂载、环境变量四层甄别、最小启动命令与三步冒烟闭环**四个动作，一次跑通 `Qwen3-8B` 与 `Qwen3-30B-A3B`。

## 第一步：容器怎么挂设备、驱动与缓存？

官方预构建镜像 `quay.io/ascend/vllm-ascend` 按硬件族分标签：`v0.30.0` 对应 A2，`-a3` 对应 A3，`-310p` 对应 300I DUO / 200I Pro，`-a5` 对应 950DT（另有 `-openeuler` 变体）。镜像已内置用户态 **CANN `9.2.1`**、NNAL `9.2.0`（含 ATB 算子加速库）、`torch_npu` 与 `vllm`。由于 Linux 容器不含宿主机内核驱动，`docker run` 必须通过 `--device` 和 `-v` 接入 NPU 设备节点、驱动库与权重缓存，并用双层机制隔离空闲卡：

```wiki-diagram
file: env-serve-container-mounts
```

对照上图，启动容器的四组核心参数各自承担明确职责，漏掉任意一组都会引发特定故障：

| 参数组 | 必传挂载项与推荐值 | 它解决什么问题（漏掉会怎样） |
| --- | --- | --- |
| **1. 计算与管理设备（`--device`）** | `/dev/davinci0..N`、`/dev/davinci_manager`、`/dev/devmm_svm`、`/dev/hisi_hdc` | 暴露计算核、设备管理与共享虚拟内存。**Atlas A3 双裸片**单卡对应一对节点（如 `davinci0`+`1`，8 卡为 `0-15`，见 [硬件设备](hardware-devices.md)），须成对挂载；`950DT` 省去 `devmm_svm` 并加挂 `hccn_tool` |
| **2. 宿主机驱动直通（`-v`）** | `/usr/local/Ascend/driver/lib64/`、`driver/version.info`、`/etc/ascend_install.info`、`/usr/local/dcmi`、`/usr/local/bin/npu-smi` | 让容器内用户态 CANN 加载与宿主机内核一致的 `libascend_hal.so` 驱动库并完成版本校验；漏挂会导致 `torch.npu.is_available()` 返回 `False` 或 `npu-smi` 无法执行 |
| **3. 共享内存与端口（`--shm-size` / `-p`）** | 单卡最小 `--shm-size=1g`，多卡 TP 推荐 `--shm-size=16g`；单机桥接用 `-p 8000:8000`（或 `--net=host`） | Docker 默认 `/dev/shm` 仅有 `64 MiB`，多进程 **Worker**（负责设备初始化与模型执行的工作进程）交换队列或缓存张量超限时直接报 `Bus error` 或共享内存耗尽（`/dev/shm`、`memlock` 锁页配额与宿主机静态大页三者的区别见 [宿主机内存底座与静态大页](host-memory-and-hugepages.md)） |
| **4. 权重缓存与空闲卡隔离** | `-v "$MODEL_CACHE:/root/.cache"`（或挂载本地权重盘）；容器内设 `ASCEND_RT_VISIBLE_DEVICES` | 避免 `--rm` 退出容器后重复下载几十 GiB 权重；若容器挂入了整机全部 `/dev/davinci*`，启动前用 `export ASCEND_RT_VISIBLE_DEVICES=2,3` 切出空闲设备并将其重映射为进程内从 `0` 开始的逻辑卡号 |

以 **Atlas A3** 挂载单张物理卡（成对挂载 `davinci0` 与 `davinci1`）并映射本地缓存为例，标准起容器与两步入站验活命令如下：

```bash
export IMAGE=quay.io/ascend/vllm-ascend:v0.30.0-a3
export MODEL_CACHE="${HOME}/.cache"
mkdir -p "$MODEL_CACHE"

docker run --rm -it \
    --name vllm-ascend-dev \
    --shm-size=16g \
    --device /dev/davinci0 \
    --device /dev/davinci1 \
    --device /dev/davinci_manager \
    --device /dev/devmm_svm \
    --device /dev/hisi_hdc \
    -v /usr/local/dcmi:/usr/local/dcmi \
    -v /usr/local/bin/npu-smi:/usr/local/bin/npu-smi \
    -v /usr/local/Ascend/driver/lib64/:/usr/local/Ascend/driver/lib64/ \
    -v /usr/local/Ascend/driver/version.info:/usr/local/Ascend/driver/version.info \
    -v /etc/ascend_install.info:/etc/ascend_install.info \
    -v "$MODEL_CACHE:/root/.cache" \
    -p 8000:8000 \
    "$IMAGE" bash

# 进入容器后先跑两步验活，看到 OK 再往下走：
npu-smi info
python3 -c 'import torch, vllm, vllm_ascend; assert torch.npu.is_available(); print("vLLM Ascend environment: OK")'
```

## 第二步：环境变量四层体系——谁真的在代码里被读取？

网上流传的昇腾启动脚本经常在 `vllm serve` 前面一口气粘贴二十多行 `export`，其中既有必填项，也有代码早已默认代劳的项，甚至混着 **`v0.30.0` 已经删掉不再读取的旧开关**和无法在开源仓核实的民间变量。按“固定版本源码里究竟有没有真实读取点”，可以把所有环境变量厘清成四层：

```wiki-diagram
file: env-serve-env-hierarchy
```

### 1. 底层 CANN 与 ATB 环境脚本（裸机必跑，官方镜像已内置）

官方预构建镜像在构建阶段已经固化了底层路径，进容器无需再手敲 `source`；但如果你在宿主机裸机或自定义基础容器里运行，启动前**必须依次加载两份环境脚本**：

```bash
source /usr/local/Ascend/ascend-toolkit/set_env.sh
source /usr/local/Ascend/nnal/atb/set_env.sh
```

第一行设置 `ASCEND_HOME_PATH`、`ASCEND_OPP_PATH` 与动态库搜索路径，供 C++ 算子加载器寻址；第二行注册加速库 ATB——只要漏跑第二行，运行期就会报 `libatb.so: cannot open shared object file`。此外，官方 `Dockerfile` 默认写入了 `TASK_QUEUE_ENABLE=1`（开启 `torch_npu` 一级异步算子下发队列；`0/1/2` 三档差异及 `=2` 的显存峰值与图捕获冲突边界见 [昇腾算子下发流水与运行时调优](ascend-runtime-and-tuning.md)）和 `OMP_NUM_THREADS=1`（避免多 Worker 并发时 OpenMP 线程争抢 CPU 核）。

### 2. 框架入口与显存分配器实读变量（`vllm/envs.py` + `platform.py`）

这一层在 `vllm` 与 `vllm-ascend` 的 Python 代码中有明确的读取逻辑，直接决定单机能否找到设备和模型：

- **`ASCEND_RT_VISIBLE_DEVICES`**：昇腾平台唯一的设备可见性控制变量（`NPUPlatform.device_control_env_var` 与绑核模块 `cpu_binding.py` 均读取它）。例如设 `export ASCEND_RT_VISIBLE_DEVICES=2,3`，进程内看到的 `NPU 0, 1` 就对应宿主机的设备 `2, 3`。切记**不要写成 `CUDA_VISIBLE_DEVICES`，也不要漏掉中间的 `RT_` 写成 `ASCEND_VISIBLE_DEVICES`**。
- **`PYTORCH_NPU_ALLOC_CONF`**：`torch_npu` 显存（NPU 设备内存，常见为 HBM）分配器配置。`v0.30.0` 在未开睡眠模式（`enable_sleep_mode`）时，`_set_pytorch_npu_alloc_env()` 会**自动追加 `expandable_segments:True`**，用可扩展虚拟地址段缓解碎片。注意它不能与 `max_split_size_mb` 或 `garbage_collection_threshold` 同写；配合睡眠模式开启强化学习 `rl_config.enabled=true` 时代码又会自动剥离它。
- **`VLLM_USE_MODELSCOPE=True`**：由上游 `vllm/envs.py` 解析；机器无法直连 HuggingFace 时改从 ModelScope 下载权重（官方镜像已预装 `modelscope<1.38`）。如果直接传入本地已下载好的目录路径，无需设置该项。
- **`VLLM_WORKER_MULTIPROC_METHOD=spawn`**：控制多进程执行器（`MultiprocExecutor`，对应 `--distributed-executor-backend mp`）用 `spawn` 还是 `fork` 拉起子进程，二者正交配合而非互相替代。在线 `vllm serve` 未指定时默认注入 `"spawn"`；Python 离线 `LLM(...)` 默认 `"fork"`，若父进程提前触碰了 NPU 上下文，须显式设为 `spawn` 防卡死。
- **`VLLM_HOST_IP` 与 `VLLM_PORT`**：多网卡环境下固定本机通信 IP 与内部起始端口；注意 `VLLM_PORT` 必须是纯整数，若在 Kubernetes 中被同名 Service 自动注入成 `tcp://...` 字符串，启动会直接抛出 `ValueError`。

### 3. 插件与通信仓内实读变量（及 `v0.30.0` 旧变量下线大坑）

`v0.30.0` 的 `vllm_ascend/envs.py` 共保留 **14 项**变量（**8 项编译期** + **6 项运行期**；`main` 精简为 **12 项**）。8 项编译期开关含 `MAX_JOBS`、`SOC_VERSION`、`COMPILE_CUSTOM_KERNELS` 及传给 CMake 的 `VLLM_ASCEND_ENABLE_BATCH_MEMCPY` 等；6 项运行期变量里最常见的是 **`VLLM_VERSION`**、`ASCEND_HOME_PATH` 与 `HCCL_SO_PATH`。其中 `VLLM_VERSION` 仅在源码安装了非标准版本号触发 `InvalidVersion` 时才需手设 `0.30.0`（官方 `+empty` 后缀会自动剥离）。

通信侧 **HCCL**（详见 [CANN 与 HCCL](cann-hccl.md)）在仓内 C++/Python 有真实读取点的常用项有两项。一项是 `HCCL_BUFFSIZE`，决定通算融合算子 [MC2](expert-parallel.md#mc2-还是-allgather) 的通信缓冲 MB 数（多卡 MoE 常设 `256` 或 `1024`）。另一项是 `HCCL_OP_EXPANSION_MODE`（如 `"AIV"`，把通信控制放在向量核展开以配合图捕获）。

> **升级 `v0.30.0` 配置陷阱（旧环境变量已下线）**：`VLLM_ASCEND_ENABLE_NZ`、`VLLM_ASCEND_ENABLE_MLAPO`、`VLLM_ASCEND_ENABLE_FUSED_MC2`、`MSMONITOR_USE_DAEMON` 已从 `envs.py` 删除，仓内 `0` 处读取，统一迁入 `--additional-config`（详见 [Ascend 配置体系](ascend-config-system.md)）。
> 例如调整权重向 **NZ**（`FRACTAL_NZ` 分块布局，见 [张量存储布局](tensor-layout.md)）转换时，写 `export VLLM_ASCEND_ENABLE_NZ=0` 不报错但**完全无效**。必须改传 `--additional-config '{"weight_nz_mode": 0}'`（默认 `1` 仅量化权重转 NZ，`2` 浮点尽量转 NZ）。仅 `VLLM_ASCEND_ENABLE_FLASHCOMM1` 仍保留 `os.getenv` 兼容回退，但也建议改配 `additional_config.enable_flashcomm1`。

### 4. 无仓内读取点的底层变量与祖传脚本甄别（诚实标 `unknown`）

排查他人脚本时还会遇到大量 `HCCL_*`、`ASCEND_*` 或 `PT_HCCL_*` 变量（如 `HCCL_BUFFSIZE_EP`、`HCCL_SOCKET_IFNAME`、`HCCL_INTRA_ROCE_ENABLE` 等 `45+` 项），它们在 `vllm` 与 `vllm-ascend` 两仓的 Python 和 C++ 源码中**读取次数为 `0`**。对待这类变量要守住两条工程边界：

1. **不武断判为语法错，诚实归为待核底层消费（`unknown`）**：两仓代码没读，不排除底层闭源 `libhccl.so` 或 CANN 运行时在 C 层直接通过 `getenv` 消费；在缺少固定版本 CANN 文档佐证前，本站配置体检器将其标为 `unknown` 提示核查，而非直接判错。
2. **单机最小起服务绝不盲抄全家桶**：单机卡间通信走片间高速互联，不需要跨机网卡选路或超大规模通信调优变量；先把无额外环境变量的干净基线跑通，只有当目标模型食谱明确点名某项变量时再按需加入。

## 第三步：单机 `vllm serve` 最小起服务清单与三步冒烟测试

容器验活通过、环境变量理顺之后，单机拉起在线服务只需要抓准六个基础命令行开关（跨实例分离与高阶图融合属于进阶调优，不混入首轮最小验证）：

```wiki-diagram
file: env-serve-startup-probes
```

| 核心参数 | 首轮验证推荐写法 | 作用与常见踩坑点 |
| --- | --- | --- |
| `<model>` 与 `--served-model-name` | `/root/.cache/Qwen3-8B --served-model-name qwen3-8b` | 指定权重目录并绑定客户端请求里的短模型名；若省略 `--served-model-name`，`get_served_model_name()` 默认把整串本地路径当成模型 ID，客户端传短名会报 `404`（接口入口见 [请求入口](api-server-entry.md)） |
| `--tensor-parallel-size`（`-tp`） | 单卡 `1`；四卡 `4`（MoE 配合 `--enable-expert-parallel`） | 单实例 **tensor parallel（TP，把单层矩阵计算切分到多张设备协同执行）** 设备数，须与 `ASCEND_RT_VISIBLE_DEVICES` 暴露的逻辑设备数匹配；MoE 模型开启 **expert parallel（EP，把路由专家分散到多张设备）** 时加上 `--enable-expert-parallel` |
| `--max-model-len` | 首轮验证传 `8192` 或 `16384` | 限制单条请求的输入与生成总 token（分词器切出的离散整数符号，见 [token](token.md)）上限；不传时默认取 `config.json` 原生上限（如 `32768` 或 `40960`），小显存卡易在预检阶段报错 |
| `--gpu-memory-utilization` | 显式传 `0.90`（`v0.30.0` 代码默认 `0.92`） | 控制单卡总显存划给当前实例的比例，扣除权重与运行时开销后剩余空间全部折算为 **KV cache**（保存历史键值表示以避免重算前文的缓存，详见 [KV 显存探测与划定](kv-cache-memory-profiling.md)） |
| `--dtype` 与 `--quantization` | A2/A3/950DT 浮点免传（默认 `BF16`），ModelSlim 量化传 `--quantization ascend`；**`310P` 必传 `--dtype float16`** | `310P` 硬件不支持 16 位脑浮点 **BF16**，跑浮点权重漏传 `--dtype float16` 会直接失败 |
| `--compilation-config` 与 `--additional-config` | A2/A3 常用 `'{"cudagraph_mode":"FULL_DECODE_ONLY"}'`（分段捕获可设 `"PIECEWISE"`）；**`310P` 必关 `enable_npugraph_ex`** | **ACL Graph**（昇腾上捕获并回放设备算子序列的图模式，见 [ACL Graph](acl-graph.md)）在 `FULL_DECODE_ONLY` 下对生成步做整图回放并默认开启 `npugraph_ex`（昇腾静态图编译扩展优化）；切为 `PIECEWISE` 时代码会自动关闭 `npugraph_ex`，而 `310P` 不支持 `npugraph_ex`，须显式关闭并限制捕获尺寸 |

### 1. 三套单机最小启动模板

按你的硬件族与标尺模型，直接选用下方对应模板启动（内置 `Qwen3` 架构走上游注册表，无需额外加 `--trust-remote-code`）：

```bash
# 清单 A：Atlas A2 / A3 单卡启动 Qwen3-8B（BF16 标准基线）
export ASCEND_RT_VISIBLE_DEVICES=0
vllm serve /root/.cache/Qwen3-8B \
    --served-model-name qwen3-8b \
    --max-model-len 8192 \
    --gpu-memory-utilization 0.90 \
    --compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}' \
    --port 8000

# 清单 B：Atlas A2 / A3 单机四卡启动 Qwen3-30B-A3B（ModelSlim W8A8 + TP4 + EP；A3 双裸片下占 2 张物理卡）
export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3
export HCCL_BUFFSIZE=1024
export HCCL_OP_EXPANSION_MODE="AIV"
vllm serve /root/.cache/Qwen3-30B-A3B-W8A8 \
    --served-model-name qwen3-30b-a3b \
    --tensor-parallel-size 4 \
    --enable-expert-parallel \
    --quantization ascend \
    --max-model-len 16384 \
    --gpu-memory-utilization 0.90 \
    --compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}' \
    --port 8000

# 清单 C：Atlas 300I DUO (310P) 单机最小适配（必改 float16 + 限制捕获尺寸或改用 PIECEWISE + 关 npugraph_ex）
export ASCEND_RT_VISIBLE_DEVICES=0
vllm serve /root/.cache/Qwen3-0.6B \
    --served-model-name qwen3-310p \
    --dtype float16 \
    --max-num-seqs 8 \
    --max-model-len 8192 \
    --gpu-memory-utilization 0.90 \
    --compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY","cudagraph_capture_sizes":[1,2,4,8]}' \
    --additional-config '{"ascend_compilation_config":{"enable_npugraph_ex":false}}' \
    --port 8000
```

把你准备执行的单机命令贴进下方轻量体检器，可以在敲回车前即时核查卡型精度、并行卡数与基础环境变量是否冲突：

```wiki-tool
tool: config-doctor
mode: minimal
title: 单机 vllm serve 最小配置体检器
summary: 粘贴你的单机启动命令与卡型，即时检查精度、卡数与基础环境变量冲突
```

### 2. 三步递进冒烟探针与优雅停服

敲下启动命令后，Worker 会依次经历设备校验、权重加载、显存预演与图捕获（完整过程见 [NPUWorker 启动](npu-worker-lifecycle.md)）。**必须等终端刷出 `INFO: Application startup complete.` 与 `Uvicorn running on http://0.0.0.0:8000` 之后**，再开另一个终端按顺序跑通以下三条 `curl` 探针：

```bash
# 探针 1：健康检查 —— 返回 HTTP/1.1 200 OK（响应体为空）代表引擎存活就绪；若崩溃则返回 503
curl -i --fail http://localhost:8000/health

# 探针 2：核对模型注册表 —— 确认返回的 id 为 "qwen3-8b" 且 max_model_len 为 8192
curl --fail http://localhost:8000/v1/models

# 探针 3：端到端对话吐字验证 —— 确认 choices[0].message.content 返回非空正常文本
curl --fail http://localhost:8000/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{
        "model": "qwen3-8b",
        "messages": [{"role": "user", "content": "用一句话解释什么是 KV cache。"}],
        "max_tokens": 32,
        "temperature": 0
    }'
```

验证完毕需要停掉前台服务时，按 `Ctrl+C`（后台服务先核准自己启动的进程 PID 再发 `kill -2 <PID>`）触发 `SIGINT` 优雅关闭，让框架正常销毁通信组并释放 `/dev/davinci*` 上下文；不要一上来直接 `kill -9`，否则极易残留僵尸子进程占死 NPU 显存。

### 3. 从单机扩到双机：主从节点最小增补参数（`v0.30.0`）

当超大 MoE 模型单机 8 卡装不下全部专家、需扩到两台 8 卡机器组 `DP=2 × TP=8 = 16 卡（EP16）` 时，无需重写整套逻辑——先在两台机器上把可见卡与张量并行均扩满本机 8 卡（`export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3,4,5,6,7`、`--tensor-parallel-size 8 --enable-expert-parallel`），再按主从角色补齐以下四项跨机参数（完整跨机进程分工与波次对齐见 [Data Parallel](data-parallel.md) 与 [进程分工](engine-processes.md)）：

| 跨机增补项 | 主节点（`node0`，对外接 HTTP） | 副节点（`node1`，仅跑后台引擎） | 作用与踩坑红线 |
| --- | --- | --- | --- |
| 宿主机通信网口变量 | `export HCCL_IF_IP=<node0_IP>` + `export GLOO_SOCKET_IFNAME=<网卡名>` | `export HCCL_IF_IP=<node1_IP>` + `export GLOO_SOCKET_IFNAME=<网卡名>` | 锁定跨机控制面握手 IP 与 CPU `Gloo` 同步网卡，防止容器绑错虚拟网桥导致启动卡死 |
| 全局、本机与起始 DP 组号 | `--data-parallel-size 2 --data-parallel-size-local 1`（默认从 `0` 起） | `-dp 2 -dpl 1 --data-parallel-start-rank 1` | 声明全局共 2 组、每台起 1 个本地 `EngineCore`，且副节点显式从 `DP1` 起步；漏传 `-dpl 1` 会在单机硬起两组，漏传 `--data-parallel-start-rank 1` 两台都会抢 `DP0` |
| 主节点协调地址与角色 | `--data-parallel-address <node0_IP> --data-parallel-rpc-port 13389` | 同左，并追加 **`--headless`** | 副节点加 `--headless` 后不启动前端 HTTP 服务，统一由 `node0:8000` 接请求并分发；**注意跨机 RoCE 跑 MoE 严禁同时开 `PP > 1` 与 `DP > 1`** |

## 常见误解

单机起服务最容易踩中的五个高频误区，可对照下方正误卡片逐条核查：

```wiki-diagram
file: env-serve-five-myths
```

- **「多卡容器用默认共享内存就行，切卡跟 GPU 一样写 `CUDA_VISIBLE_DEVICES`」**：错。Docker 默认 `64 MiB` `/dev/shm` 撑不住多进程张量与队列通信，多卡建议显式设 `--shm-size=16g`；切卡变量名只认 `ASCEND_RT_VISIBLE_DEVICES`，且 Atlas A3 双裸片单张物理卡必须成对挂载两个 `/dev/davinci` 节点。
- **「在 `v0.30.0` 里 `export VLLM_ASCEND_ENABLE_NZ=0` 就能关掉权重转 NZ」**：错。`v0.30.0` 已将 `VLLM_ASCEND_ENABLE_NZ`、`VLLM_ASCEND_ENABLE_MLAPO`、`VLLM_ASCEND_ENABLE_FUSED_MC2` 等旧环境变量从 `vllm_ascend/envs.py` 中移除，导出它们既不报错也不生效；必须改传 `--additional-config '{"weight_nz_mode": 0}'`。
- **「代码里搜不到的 `HCCL_*` 变量一定是错词，或者反过来把跨机脚本里的二十个变量全抄上更稳」**：错。两仓无读取点的 `HCCL_*` / `ASCEND_*` 变量可能由底层闭源 `libhccl.so` 在 C 层直接消费，应诚实归为 `unknown` 待核；单机最小起服务无需堆砌跨机通信调优项。
- **「不传 `--served-model-name`，客户端请求写 `"model": "qwen3"` 也能自动匹配」**：错。未传该参数时，服务端默认把传入的完整权重路径（如 `/root/.cache/Qwen3-8B`）注册为模型 ID，请求名不一致会直接收到 `404`。
- **「看到容器里 `vllm` 进程没退出就算起服成功，不必再跑 `/v1/chat/completions`」**：错。权重加载与图捕获耗时较长，进程存活不代表就绪；必须等 `/health` 返回 `200` 并通过 `/v1/chat/completions` 拿到非空文本，才算证明分词模板、KV 缓存与底层算子全链路闭环。

## 对照源码

### 怎么开

- **官方镜像与挂载边界**：预构建镜像按硬件族拆分为 `vllm-ascend:v0.30.0`（A2）、`-a3`、`-310p` 与 `-a5`（及 `-openeuler` 变体）[S1]。A2/310P 单卡快速入门挂载单个 `/dev/davinci0` 及 `davinci_manager`、`devmm_svm`、`hisi_hdc` 与宿主机 `driver/lib64`、`dcmi`、`npu-smi`[S2]；Atlas A3 因双裸片设计明确要求至少成对挂载两个设备节点（如 `davinci0` 与 `davinci1`）[S3]；950DT 快速入门使用 `--net=host`、挂载 `hccn_tool` 并省去 `devmm_svm`[S4]。进容器后用 `npu-smi info` 与 `torch.npu.is_available()` 完成验活[S5]。
- **CANN 脚本与四层环境变量**：裸机或基础环境须依次 `source` `ascend-toolkit/set_env.sh` 与 `nnal/atb/set_env.sh`[S6]；官方 `Dockerfile` 默认注入 `TASK_QUEUE_ENABLE=1` 与 `OMP_NUM_THREADS=1`[C9]。框架层由 `NPUPlatform.device_control_env_var` 与 `cpu_binding.py` 读取 `ASCEND_RT_VISIBLE_DEVICES`（来源 12）[C11]，由 `vllm/envs.py` 读取 `VLLM_USE_MODELSCOPE`、`VLLM_HOST_IP`、`VLLM_PORT` 与供 `MultiprocExecutor` 选择子进程派生方式的 `VLLM_WORKER_MULTIPROC_METHOD`（`vllm/envs.py` 默认为 `"fork"`，而 `vllm serve` CLI 入口在未设置时会默认注入 `"spawn"`，来源 20）[C19]，并由 `_set_pytorch_npu_alloc_env()` 在非睡眠模式下自动注入 `PYTORCH_NPU_ALLOC_CONF=expandable_segments:True`[C13]。插件层 `vllm_ascend/envs.py` 在 `v0.30.0` 共定义 `14` 个变量（`8` 个编译期 + `6` 个运行期，含供 `vllm_version_is()` 覆盖开发版号的 `VLLM_VERSION`、`ASCEND_HOME_PATH`、`HCCL_SO_PATH`）[C10][C14]；通信层 `HCCL_BUFFSIZE` 与 `HCCL_OP_EXPANSION_MODE` 分别在 MC2 C++ tiling 与 `device_op.py`（来源 18）中显式读取[C17]，其余无仓内读取点的 `HCCL_*`/`ASCEND_*` 变量在缺少固定 CANN 文档时按底层待核（`unknown`）处理[I]。旧 `VLLM_ASCEND_ENABLE_NZ`、`VLLM_ASCEND_ENABLE_MLAPO`、`VLLM_ASCEND_ENABLE_FUSED_MC2`、`MSMONITOR_USE_DAEMON` 已彻底下线（仓内零读取）并迁入 `additional_config`（如 `weight_nz_mode` 默认 `1`），而 `VLLM_ASCEND_ENABLE_FLASHCOMM1` 虽移出 `envs.py` 但仍保留 `os.getenv` 兼容回退（优先读取 `additional_config.enable_flashcomm1` 驱动 `enable_sp`）[S8][C16]。
- **最小启动开关与三步探针**：`CacheConfig.gpu_memory_utilization` 代码默认为 `0.92`[C21]，`get_served_model_name()` 未传时回退至原始 `model` 字符串[C22]；`310P` 须显式传 `--dtype float16`、限制 `FULL_DECODE_ONLY` 捕获尺寸（或走 `PIECEWISE`）并设 `enable_npugraph_ex: false`（`AscendCompilationConfig` 在不支持 `NPUGRAPH_EX` 的硬件上也会告警并置 `False`）[S7][C15]。就绪探针依次命中 `/health`（正常返回 `200`，`EngineDeadError` 返回 `503`）[C23]、`/v1/models` 与 `/v1/chat/completions`[C24]。

### 会报什么错

| 失败位置 | 触发条件 | 典型报错或现象 | 定位依据 |
| --- | --- | --- | --- |
| 裸机/自定义容器启动 | 仅执行了 `ascend-toolkit/set_env.sh`，漏跑 `nnal/atb/set_env.sh` | 运行时报错 `libatb.so: cannot open shared object file` | 来源 6 |
| 源码装开发版 `vllm` | `vllm.__version__` 非标准 `x.y.z` 且未设 `VLLM_VERSION` | `vllm_version_is()` 捕获 `InvalidVersion` 并抛出 `ValueError: Invalid vllm version ...` | 来源 14 |
| Kubernetes 环境启动 | 同名 Service 将 `VLLM_PORT` 注入为 `tcp://...` URI | `get_vllm_port()` 抛出 `ValueError: VLLM_PORT '...' appears to be a URI` | 来源 19 |
| 升级 `v0.30.0` 调优 | 仍用 `export VLLM_ASCEND_ENABLE_NZ=0` 关闭权重转 NZ | 不报错但静默不生效，量化权重仍按默认 `weight_nz_mode=1` 转 NZ | 来源 8、16 |
| `310P` 起服或探针请求 | 漏传 `--dtype float16`，或省略 `--served-model-name` 却用短名请求 | `310P` 拒收 `BF16`；模型名不匹配导致 `/v1/chat/completions` 返回 `404` | 来源 7、22 |

### 版本差异

| 核验维度 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
| --- | --- | --- | --- | --- |
| `vllm_ascend/envs.py` 变量数与布尔解析 | 共 `21` 项，含 `VLLM_ASCEND_ENABLE_NZ`、`ENABLE_MLAPO`、`ENABLE_FUSED_MC2`、`MSMONITOR_USE_DAEMON`、`ENABLE_MATMUL_ALLREDUCE` 等；用 `bool(int(...))` 解析 [C25] | 共 `20` 项（移除 `ENABLE_MATMUL_ALLREDUCE` 与 `FLASHCOMM2_PARALLEL_SIZE`，新增 `MLA_FIA_SPLIT`），仍保留 `VLLM_ASCEND_ENABLE_NZ` [C26] | 精简至 `14` 项（`8` 编译期 + `6` 运行期），**彻底下线 `VLLM_ASCEND_ENABLE_NZ`、`ENABLE_MLAPO`、`ENABLE_FUSED_MC2`、`MSMONITOR_USE_DAEMON`（仓内 `0` 读取）**并迁入 `additional_config`；`ENABLE_FLASHCOMM1` 移出 `envs.py` 但保留 `os.getenv` 兼容回退；新增 `_strict_binary_env` | 精简至 `12` 项（移除 `KVPOOL_RANGE_DEBUG` 与 `ROPE_UB_SIZE_KB`），改用 `_bool_env()` 兼容空串并校验 `'0'/'1'`，`ENABLE_FLASHCOMM1` 仍保留 `os.getenv` 回退 [C27] |
| 权重转 NZ 控制入口 | `VLLM_ASCEND_ENABLE_NZ` 与 `additional_config.weight_nz_mode` 双轨读取 | 同 `v0.23.0` 双轨读取 | **仅认 `additional_config.weight_nz_mode`**（`0/1/2`，默认 `1`；`rl_config.enabled=true` 或 `batch_invariant` 强制覆写为 `0`） | 延续 `v0.30.0` 单一 `weight_nz_mode` 入口 |
| `PYTORCH_NPU_ALLOC_CONF` 默认行为 | 非睡眠模式在 `platform.py` 默认追加 `expandable_segments:True` | 同 `v0.23.0` | 非睡眠模式默认追加 `expandable_segments:True`；新增 `_disable_expandable_segments()` 供 `rl_config` 自动剥离 | 同 `v0.30.0` |
| 上游 `gpu_memory_utilization` 默认值 | 配套 `vllm@0fc695fc` 默认 `0.92` | 配套 `vllm@568afb3a` 默认 `0.92` | 配套 `vllm@ced6857a` 默认 `0.92`（官方模型食谱常显式传 `0.90`） | 配套 `vllm@ba15685a` 字段默认 `None`，经 `resolved_gpu_memory_utilization` 在常规模式下仍解析为 `0.92` [D] |

### 源码位置

以下编号对应页首 `sources` 列表的第 1–27 项（文档 8 项对应 `S1`–`S8`，源码与配置 19 项对应 `C9`–`C27`）：

- 来源 1（S1）：`vllm-ascend@c09d3e20:docs/source/getting_started/installation/prebuilt_image.inc.md#L12-L26` — 四大硬件族与 Ubuntu / openEuler 官方预构建镜像标签对照表。
- 来源 2（S2）：`vllm-ascend@c09d3e20:docs/source/getting_started/quick_start/ascend_image/atlas-a2.inc.md#L25-L52` — Atlas A2 容器启动标准 `--device`、驱动 `-v` 与缓存挂载模板。
- 来源 3（S3）：`vllm-ascend@c09d3e20:docs/source/getting_started/quick_start/ascend_image/atlas-a3.inc.md#L26-L55` — Atlas A3 双裸片架构须成对挂载两个 `/dev/davinci` 节点说明。
- 来源 4（S4）：`vllm-ascend@c09d3e20:docs/source/getting_started/quick_start/ascend_image/atlas-950dt.inc.md#L25-L49` — 950DT 容器 `--net=host` 与 `hccn_tool` 挂载差异。
- 来源 5（S5）：`vllm-ascend@c09d3e20:docs/source/getting_started/quick_start/ascend_image/verify_container.inc.md#L1-L16` — 进容器后 `npu-smi info` 与 `torch.npu.is_available()` 双步验活脚本。
- 来源 6（S6）：`vllm-ascend@c09d3e20:docs/source/getting_started/installation/existing_cann_environment.inc.md#L35-L49` — 裸机依次执行 `ascend-toolkit/set_env.sh` 与 `nnal/atb/set_env.sh` 及 `libatb.so` 缺失提示。
- 来源 7（S7）：`vllm-ascend@c09d3e20:docs/source/getting_started/quick_start/online/qwen3-0.6b-310p.inc.md#L1-L18` — `310P` 在线起服务必选 `--dtype float16`、受限捕获尺寸与关闭 `enable_npugraph_ex`。
- 来源 8（S8）：`vllm-ascend@c09d3e20:docs/source/user_guide/configuration/additional_config.md#L57-L64` — `MSMONITOR_USE_DAEMON`、`VLLM_ASCEND_ENABLE_MLAPO`、`VLLM_ASCEND_ENABLE_NZ`、`VLLM_ASCEND_ENABLE_FUSED_MC2` 停止支持声明及 `enable_flashcomm1` 配置说明。
- 来源 9（C9）：`vllm-ascend@c09d3e20:Dockerfile#L53-L68` — 官方镜像默认 `TASK_QUEUE_ENABLE=1`、`OMP_NUM_THREADS=1` 与构建期环境加载。
- 来源 10（C10）：`vllm-ascend@c09d3e20:vllm_ascend/envs.py#L38-L93` — `v0.30.0` 全部 `14` 项插件环境变量定义（`8` 项编译期 + `6` 项运行期）。
- 来源 11（C11）：`vllm-ascend@c09d3e20:vllm_ascend/platform.py#L94-L98` — `NPUPlatform.device_control_env_var = "ASCEND_RT_VISIBLE_DEVICES"`。
- 来源 12（C12）：`vllm-ascend@c09d3e20:vllm_ascend/cpu_binding.py#L24-L26` — 拓扑亲和绑核读取 `ASCEND_RT_VISIBLE_DEVICES`。
- 来源 13（C13）：`vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1445-L1481` — `_set_pytorch_npu_alloc_env()` 默认注入与 `_disable_expandable_segments()` 剥离逻辑。
- 来源 14（C14）：`vllm-ascend@c09d3e20:vllm_ascend/utils.py#L726-L746` — `vllm_version_is()` 读取 `VLLM_VERSION`、剥离 `+empty` 及 `InvalidVersion` 报错。
- 来源 15（C15）：`vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L120-L169` — `AscendCompilationConfig` 默认值与不支持 `NPUGRAPH_EX` 硬件的自动降级。
- 来源 16（C16）：`vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L614-L756` — `AscendConfig.weight_nz_mode` 默认值 `1` 校验及 `enable_flashcomm1` 对 `VLLM_ASCEND_ENABLE_FLASHCOMM1` 的 `os.getenv` 兼容回退。
- 来源 17（C17）：`vllm-ascend@c09d3e20:csrc/mc2/dispatch_ffn_combine/op_host/dispatch_ffn_combine_tiling.cpp#L28-L66` — MC2 C++ 算子读取 `HCCL_BUFFSIZE`。
- 来源 18（C18）：`vllm-ascend@c09d3e20:vllm_ascend/device/device_op.py#L1255-L1260` — 设备算子层读取 `HCCL_OP_EXPANSION_MODE`。
- 来源 19（C19）：`vllm@ced6857a:vllm/envs.py#L705-L720` — 上游 `VLLM_HOST_IP`、`VLLM_PORT`（防 URI 报错）与 `VLLM_USE_MODELSCOPE` 解析。
- 来源 20（C20）：`vllm@ced6857a:vllm/envs.py#L930-L932` — `VLLM_WORKER_MULTIPROC_METHOD` 多进程启动方式选项。
- 来源 21（C21）：`vllm@ced6857a:vllm/config/cache.py#L102-L106` — `CacheConfig.gpu_memory_utilization` 默认值 `0.92`。
- 来源 22（C22）：`vllm@ced6857a:vllm/config/model.py#L2176-L2190` — `get_served_model_name()` 未指定时回退完整 `model` 路径。
- 来源 23（C23）：`vllm@ced6857a:vllm/entrypoints/serve/instrumentator/health.py#L20-L33` — `/health` 探针正常返回 `200`、引擎异常返回 `503`。
- 来源 24（C24）：`vllm@ced6857a:vllm/entrypoints/openai/chat_completion/api_router.py#L40-L60` — `/v1/chat/completions` 路由入口 `create_chat_completion`。
- 来源 25（C25）：`vllm-ascend@2c59ff10:vllm_ascend/envs.py#L30-L114` — `v0.23.0` 时期 `21` 项插件环境变量（含第 92 行 `VLLM_ASCEND_ENABLE_NZ`）。
- 来源 26（C26）：`vllm-ascend@2ed6cbba:vllm_ascend/envs.py#L30-L110` — `v0.26.0rc` 时期 `20` 项插件环境变量（含第 88 行 `VLLM_ASCEND_ENABLE_NZ`）。
- 来源 27（C27）：`vllm-ascend@8d6180e2:vllm_ascend/envs.py#L26-L99` — 社区 `main` 分支 `_bool_env()` 辅助函数与精简后的 `12` 项变量。
- 推导与待核说明：综合四版本 `vllm/config/cache.py` 比对得出 `gpu_memory_utilization` 跨版本默认行为差异（对应上表 D 标记）；两仓零读取的 `HCCL_*`/`ASCEND_*` 变量是否被闭源 `libhccl.so` 或 CANN runtime 消费，在无固定版本 CANN 官方文档前保持 `unknown` 待核（对应上文 I 标记）。
