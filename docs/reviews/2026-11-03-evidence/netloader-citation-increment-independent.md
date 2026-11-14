# Netloader 引文增量独立复核

审查者：`/root/review_first_pages`。2026-11-03。结论：接受本次增量，未发现仍需处理的 P1/P2。

完整阅读 `netloader-guide-citation-remediation.diff`，复读当前正文 96–132、186–303 行及相关前提。旧空闲环境变量的引入、删除和固定版本的替代路径形成了证据链；HCCL 缓冲的拼写、默认量、通信域粒度与 CANN 9.0 边界清楚。现有加载步骤、配置示例和运行验证缺口仍保留。

实际来源读取如下：

- PR #16226：读取本轮保存的官方 API 作者正文与三个文件的完整补丁（`pr16226.txt`、`pr16226-files.txt`）。最终补丁通过可选 `SpinSleepTimer` 降低空闲读端轮询频率，支持 CPU 忙等解释。此独立复核没有重读全部 36 条讨论，不将作者最初划掉的 10 秒方案当作最终行为。
- Issue #16660：读取保存的官方正文（包括环境和问题描述）。这是旧 XPU 环境空闲 CPU 占用报告，不能证明 GLM 双机 Netloader 的 HCCL 性能。
- `vllm@6f0dd93801163a6418695c6dc0b43c516261f55a`：实际 `git show` 读取 `envs.py` 与 `shm_broadcast.py` 的完整删除/替代差异；`git merge-base --is-ancestor 6f0dd938 0fc695fc` 返回 0。其他文件不在本次增量核验声明中。
- `vllm@0fc695fc:shm_broadcast.py:103–215,665–717`：完整读取 SpinCondition 及实际读端等待调用。短时间轮询、空闲等待通知和取消/超时分支存在；这不是 Netloader 新传输协议。
- `vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/netloader.md`：全文 1–98 行，包含配置表、示例、旧变量建议和拼错的 HCCL 变量。本文引用的旧建议确实来自该文；指南图片未在本次独立复核中查看。
- 同 pin `executor/elastic_load.py:33–646`：完整分批读取扩展后的来源范围，包含 transferable 过滤、data_ptr 去重、清单、ND/NZ 转换、接收和发送实际循环。源码允许对主机缓存 `.to(model_device)`、临时连续化和格式转换，正文未把来源扩展误写成无额外内存或无搬运。
- `baa023ad..7d825229` 的完整 Netloader 目录差异：只有 utils 的三项默认 loader 配置保留助手及实际调用，支持本次新增来源映射；未由此扩大协议兼容承诺。
- `vllm-ascend@0576b6471c7a35707920a665352391d33c77451c` 的 GLM5.3-Flash 教程 237–341：完整双机命令，两个节点均为 `HCCL_BUFFSIZE=1024`，未运行命令。
- [CANN 9.0 HCCL_BUFFSIZE](https://www.hiascend.com/doc_center/source/zh/canncommercial/900/API/hcclug/hcclenvref_07_0005.html)：本轮直接打开并读取全文 0–41 行，包含支持设备和所有注意事项。默认 200 MB、每通信域收发合计两倍、域级配置优先，均支持正文。此来源没有被当成目标镜像实测或所有版本通用事实。

范围仅本次精确增量与相关上下文，不代表重新核验作者账本的全部 21 项旧来源。未修改教学页、未运行 NPU、未做浏览器或视觉验收。最终页面哈希见配套 JSON。
