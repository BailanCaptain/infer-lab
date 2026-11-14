# G1 两个待核变量的独立源码核查

本轮把两个变量从“尚未找到消费位置”改为有范围的结论：**VLLM_RPC_TIMEOUT 在固定 vLLM 中未注册、没有包内消费者；TP_SOCKET_IFNAME 是 PyTorch 和 torch_npu 的 TensorPipe RPC 设置，当前 GLM 双机主路径不启用它。** 两者都不应作为本部署有效通信参数新增独立参考说明，但应在对应页面解释教程残留配置与实际路径的区别。

本核查没有修改 wiki，也不是补写后页面的独立终审。源码结论不替代现场镜像和 NPU 实测。

## 固定版本与公开镜像

vLLM 为 `0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665`，Ascend 为 `db701c1fd31de40ab028628ee2580ae68c7fd3c0`。Ascend [requirements.txt 第 16–17 行](https://github.com/vllm-project/vllm-ascend/blob/db701c1fd31de40ab028628ee2580ae68c7fd3c0/requirements.txt#L16-L17) 指定 torch 2.10.0、torch-npu 2.10.0.post2。

- PyTorch v2.10.0 对应提交 `449b1768410104d3ed79d3bcfe4ba1d65c7f22c0`。
- torch_npu 的 `v26.0.1-pytorch2.10.0` 对应 `8751b36d5d6959e499e6bf6530c1928060ced030`，其 [version.txt](https://github.com/Ascend/pytorch/blob/8751b36d5d6959e499e6bf6530c1928060ced030/version.txt) 为 2.10.0.post2；未把名称相近的 post1/post3 分支当作 post2。
- [Dockerfile.a2 第 18 行](https://github.com/vllm-project/vllm-ascend/blob/db701c1fd31de40ab028628ee2580ae68c7fd3c0/Dockerfile.a2#L18) 使用 CANN 9.1.0；同仓库默认 Dockerfile 使用 9.0.1，不能因此认定 GLM A2 镜像是 9.0.1。

2026-11-01 读取公开 Quay tag API 和 OCI metadata，`glm-5.3-flash` 的 index digest 为 `sha256:d46b8603cff8adb8edc22dfbe4d3ff64f7a35f3692cf6d51e3444efc7b09ead6`。amd64 与 arm64 两个 config 都含 `ASCEND_TOOLKIT_HOME=/usr/local/Ascend/cann-9.1.0`，构建历史也以 CANN 9.1.0 为基础。只下载 manifest/config，未下载 6 GB 镜像层。原始文件存于 `tools/wiki-runtime/g1-communication-20261101/variable-audit/oci-*.json`。

这证明所查公开 digest 的构建元数据与 A2 Dockerfile 一致，不证明用户现场已运行该 digest，也不从构建历史推断安装后的每一个 wheel 文件。文档若引用 CANN 9.0 的范围或默认，必须明确为该版本对照，不能直接套到这份 9.1.0 配方镜像。

## VLLM_RPC_TIMEOUT

两个固定仓库的运行包 UTF-8 文本中，此名称均为零匹配。它不在 vLLM 的环境变量注册表，因而不是当前 `VLLM_EXECUTE_MODEL_TIMEOUT_SECONDS` 的别名。作为历史对照，vLLM v0.12.0 的 envs.py 仍声明过它，类型注释为毫秒、定义默认 10000；这不是当前版本的默认或有效单位。

当前还有明确的未知变量校验：

- [envs.py 第 2082–2088 行](https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/vllm/envs.py#L2082-L2088) 遍历环境中的 VLLM_ 前缀；未注册时，通常记 `Unknown vLLM environment variable detected` 警告；hard_fail 为真则抛 ValueError。
- [arg_utils.py 第 714 行](https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/vllm/engine/arg_utils.py#L714) 的 fail_on_environ_validation 默认 false；[第 1716 行](https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/vllm/engine/arg_utils.py#L1716) 调用该校验。

建议正文措辞：**固定教程保留了 VLLM_RPC_TIMEOUT 的 export，但在所查固定 vLLM 中它未注册，不能靠它改变 Worker 执行等待；默认环境校验会把它作为未知变量警告。实际 Worker 等待请看 VLLM_EXECUTE_MODEL_TIMEOUT_SECONDS。** 不把教程的 3600000 写成本版本有效超时，不自动给它换算成小时。

## TP_SOCKET_IFNAME

它确实存在于依赖中，不能写成“Ascend 没有这个变量”：

- PyTorch [TensorPipe agent 第 25–28 行](https://github.com/pytorch/pytorch/blob/449b1768410104d3ed79d3bcfe4ba1d65c7f22c0/torch/csrc/distributed/rpc/tensorpipe_agent.cpp#L25-L28) 定义这个环境变量；[第 163–185 行](https://github.com/pytorch/pytorch/blob/449b1768410104d3ed79d3bcfe4ba1d65c7f22c0/torch/csrc/distributed/rpc/tensorpipe_agent.cpp#L163-L185) 在 TensorPipeAgent.guessAddress 中按网卡名找地址，失败可回 loopback。
- 匹配的 torch_npu [TensorPipe agent 第 29–33 行、第 155–180 行](https://github.com/Ascend/pytorch/blob/8751b36d5d6959e499e6bf6530c1928060ced030/torch_npu/csrc/distributed/rpc/tensorpipe_agent.cpp#L155-L180) 有相应定义和读取。
- torch_npu 导入时会调用 `_rpc_backend_registry()`；[注册函数第 288–298 行](https://github.com/Ascend/pytorch/blob/8751b36d5d6959e499e6bf6530c1928060ced030/torch_npu/distributed/rpc/backend_registry.py#L288-L298) 只是登记 NPU_TENSORPIPE 后端及初始化 handler。真正创建 agent 在 `_npu_tensorpipe_init_backend_handler` 的 [第 216–276 行](https://github.com/Ascend/pytorch/blob/8751b36d5d6959e499e6bf6530c1928060ced030/torch_npu/distributed/rpc/backend_registry.py#L216-L276)。注册可用后端不等于已经启动 RPC agent。

两个固定推理包没有 TensorPipe/RPC 初始化调用；当前 Worker 的多进程 RPC 与 torch.distributed.rpc 不是同一机制，CPU 集合通信通过 Gloo 建组。由固定调用路径与全包检索共同判定：**主配方不消费 TP_SOCKET_IFNAME；它的 TP 指 TensorPipe，不是张量并行 TP8 的网络选择开关。** 只有另行引入 TensorPipe RPC 的扩展才重新核查；不将“两个推理包未直接读取”误当作“依赖也没有消费者”。

## GLOO_SOCKET_IFNAME 补写证据

它与 TP_SOCKET_IFNAME 不同，当前主路径确实会通过依赖消费。vLLM [parallel_state.py 第 417–425 行](https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/vllm/distributed/parallel_state.py#L417-L425) 创建设备通信组并另建 `backend="gloo"` 的 CPU 组。

PyTorch 2.10 [ProcessGroupGloo.cpp 第 549–567 行](https://github.com/pytorch/pytorch/blob/449b1768410104d3ed79d3bcfe4ba1d65c7f22c0/torch/csrc/distributed/c10d/ProcessGroupGloo.cpp#L549-L567) 读取环境变量并按逗号切分接口列表；该源码的显式列表条件是字符串长度大于 1，空串和单字符走默认分支。缺省路径先解析本机 hostname；无法获得可用本地地址时警告并回到 loopback，见 [第 493–515 行](https://github.com/pytorch/pytorch/blob/449b1768410104d3ed79d3bcfe4ba1d65c7f22c0/torch/csrc/distributed/c10d/ProcessGroupGloo.cpp#L493-L515)。因此不能把默认描述成固定使用 eth0，也不能保证自动选中跨机所需网卡。

Gloo 子模块被 PyTorch 固定到 `54cbae0d3a67fa890b4c3d9ee162b7860315e341`。其 [TCP device.cc 第 30–84 行](https://github.com/pytorch/gloo/blob/54cbae0d3a67fa890b4c3d9ee162b7860315e341/gloo/transport/tcp/device.cc#L30-L84) 对接口名做 strcmp 精确匹配；名称不存在会报找不到地址。不要套用 HCCL/NCCL 的前缀、排除或等号匹配语法。

[PyTorch 2.10 官方说明](https://docs.pytorch.org/docs/2.10/distributed.html#choosing-the-network-interface-to-use) 明确支持逗号分隔的多接口并轮转分派，所有进程必须指定相同的接口数量。GLM 固定配方只选本机 local_ip 对应的一张接口；不同节点的接口名可以不同，重点是本机接口存在、地址可达且配置口径一致。

## 检索范围与证据文件

没有读取 `tools/repos/`。从 GitHub 固定提交归档在内存中扫描，不解压出完整源码树，只保存匹配文件、针对性源码和机器结果。扫描排除含 NUL 或不能按 UTF-8 解码的非文本文件，负向结论限定在所列源码范围。

| 固定仓库 | 全归档文件 | UTF-8 文本 | 运行包文本 | 关键结果 |
| --- | ---: | ---: | ---: | --- |
| vLLM 0fc695fc | 5440 | 5347 | 2370 | 两待核变量与 TensorPipe/RPC 初始化检索串均无包内命中 |
| Ascend db701c1f | 3063 | 3026 | 461 | 同上；文档/示例有 export，不据此判定消费者 |
| torch_npu 8751b36d | 1587 | 1561 | 717 | VLLM_RPC_TIMEOUT 零命中；TP_SOCKET_IFNAME 在 TensorPipe agent 中有消费者 |

原始结果：`variable-audit/vllm-archive-scan.json`、`vllm-ascend-archive-scan.json`、`torch-npu-archive-scan.json`。每份记录固定提交、归档 URL、SHA256、扫描数量、检索词及全部匹配位置；镜像 metadata、依赖版本映射和 Gloo 源文件在同目录。

结论适用于固定源码和已核依赖路径。用户现场若另行装插件、改入口或注入自定义代码，应针对这些额外消费者重新判断；不影响本轮把两项从“未知参数缺口”收束为“教程配置与当前路径区别说明”。

## 补充版本核查

### Worker 执行超时的平台改写

对 GLM 镜像、v0.23 维护分支、v0.26 rc 和固定 main 的完整 Ascend 归档分别检索 VLLM_EXECUTE_MODEL_TIMEOUT_SECONDS。结果不是三版一致：

| 版本 | Ascend 平台行为 | 源码位置 |
| --- | --- | --- |
| GLM 镜像 db701c1f | 值小于 1836 时，将 vllm.envs 模块属性设为 3000 | platform.py 1264–1271；调用在 473 |
| v0.23 维护分支 2c59ff10 | 同镜像 | platform.py 1274–1281；调用在 473 |
| v0.26 rc 2ed6cbba | 没有上述平台改写；运行包和 csrc 中此变量零命中 | platform.py 429 调用 `_fix_incompatible_config`，其实现始于 1056，但没有这条逻辑 |
| 固定 main baa023ad | 又有相同数值改写，辅助函数移到模块级 | platform.py 863–870；调用在 487，函数始于 642 |

rc 的全部 3289 个 UTF-8 文本中仍有 61 处该名称，全部位于文档、翻译和 e2e 配置；不能把那些 export 当成平台消费者。对运行包及 csrc 的扫描未发现逻辑迁移到其他模块。准确措辞是“该固定 rc 快照没有 Ascend 的强制改写”，不是“相应上游 vLLM 没有这个环境变量”，也不据四个快照猜测首次删除/恢复的发布版本。

镜像、v0.23 和 main 的 1836 是这段代码的比较常量，3000 是模块属性改写值；不能把代码日志所说的 HCCL operator timeout=1836 当作所有 CANN/产品/展开模式的实际运行时默认。它也没有把 os.environ 中的字符串同步改成 3000。

固定源码链接：[GLM](https://github.com/vllm-project/vllm-ascend/blob/db701c1fd31de40ab028628ee2580ae68c7fd3c0/vllm_ascend/platform.py#L1264-L1271)、[v0.23](https://github.com/vllm-project/vllm-ascend/blob/2c59ff1047573f40a471cf7535f01a8877344415/vllm_ascend/platform.py#L1274-L1281)、[v0.26 rc](https://github.com/vllm-project/vllm-ascend/blob/2ed6cbbaf481d84cfd3f2d01d47bcf79ee064c1f/vllm_ascend/platform.py#L1056)、[main](https://github.com/vllm-project/vllm-ascend/blob/baa023ada41a5b889cac6249845a688aab130892/vllm_ascend/platform.py#L863-L870)。

### HCCL_BUFFSIZE 的 MC2 tiling 解析

四个固定提交的 `csrc/mc2/dispatch_ffn_combine/op_host/dispatch_ffn_combine_tiling.cpp` **整个文件字节一致**，SHA256 均为 `77d93e50bd9295193246babb1b38c7df3152c3cc3ec647b6213ea6aea3c4c69a`，所以以下解析与判据可共写：

- 第 62–84 行：局部默认窗口为 200；getenv 后用 std::stoul 解析，数值不大于 uint16_t 上限时转存，越界或抛异常保留 200。乘数 MB_SIZE 在第 49 行定义为 1024×1024。这个读取器没有独立拒绝 0，也没有检查整个输入字符串都被消耗；不能把它写成严格的正整数格式校验，更不能据它代表 CANN 自身的合法范围。
- 第 284–290 行：实际需求为 `M × topK × K × sizeof(int8_t) × 3 + 10 × MB_SIZE`，大于窗口则返回 GRAPH_FAILED。报错文案仍写 `+ 3MB`，与实现不一致，四版都保留这个差异。

这证明的是此 DispatchFFNCombine 算子文件的一致性，不代表所有 MC2 算子、MegaMoe 或 HCCL 运行时实现一致。main 新增的 forward-context 注释还明确把 MegaMoe 的独立 symm buffer 与 HCCL_BUFFSIZE 区分，不能扩大这份 tiling 对照的结论。

四份源文件、四份完整检索结果和五项一致性检查保存在 `tools/wiki-runtime/g1-communication-20261101/variable-audit/version-comparison/`；[验证 JSON](../../../tools/wiki-runtime/g1-communication-20261101/variable-audit/version-comparison/comparison-validation.json) 的 5 项检查均通过。
