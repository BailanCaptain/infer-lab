# RFork 工作版代码

这是随用户提供的补丁独立演进的 RFork，不跟随社区 main 自动升级。用户已确认以 patch7 所在的完整实现历史作为本次基线；实际提交的唯一钉点在 [seeds/rfork.yaml](../wiki/seeds/rfork.yaml)。教学入口为 [RFork 专章](../wiki/concepts/rfork.md)。

## 三种文件，各有一个职责

| 位置 | 职责 | 是否进入主项目 Git |
|---|---|---|
| `source/` | 当前钉点的 RFork 实现、测试、Planner、相关设计文档、注册入口与 LICENSE，字节保持原样 | 是 |
| `patches/`、`reconciliation/`、`manifest.json` | 用户原补丁、明确标记的历史衔接差异、原始来源及 SHA256 | 是 |
| `../tools/repos/rfork/` | 完整 vllm-ascend 独立代码工作树，可应用补丁、构建和查 Git 历史；本机工作分支为 `codex/rfork-work` | 否，需要重建 |

`source/` 是入库快照，不是脱离 vLLM/Ascend 依赖就能 pip install 的独立软件包。完整仓库才是开发与运行上下文。修改在完整仓库进行，审定后导出 `source/`；不要同时手改两处。导出范围由 `manifest.sourceScope` 定义，文件完整性由 `sourceFiles` 定义，不另维护一份手写文件清单。

上游文件版权声明与 Apache-2.0 许可证保留在 `source/`。本次没有修改 RFork 算法，没有声称解决用户尚未提供的生产报错。

[官网与工作版对照](../wiki/sources/rfork-official-guide.md)单独保留官方指南和引用源码的不可变材料。`pnpm rfork:evidence` 只自动重建 `wiki/concepts/rfork*.md` 机制页的源码材料；来源对照页混合了官网与固定版本代码，重新核读时需同步其 `sources` 和材料快照，不把它自动覆盖成当前工作版源码。

## 重建与核验

在 Wiki 工作树根目录运行：

```bash
pnpm rfork:verify
pnpm wiki:clone --seeds wiki/seeds/rfork.yaml
pnpm rfork:verify --git
```

第一条只读入库文件，检查源码、补丁及衔接差异的 SHA256 和文件清单。第二条需要网络，克隆到独立的 `tools/repos/rfork` 并按固定提交检出；已有本地修改时不要先跑它。第三条进一步核对原 Git blob，并在**临时 Git index** 中重放完整补丁链，比较最后的整个仓库 tree，既不改工作树也不切分支。

2026-09-21 已实际核验：原 patch1–6 → 单独登记的衔接差异 → patch7，完整 tree 与选定提交一致。分叉证据见 [VERSION-NOTE.md](VERSION-NOTE.md)。衔接差异不是用户原 patch7，也不是靠手工解决冲突猜出来的实现；它由两个明确提交之间的 `git diff --binary --full-index` 导出。

## 后续收到新补丁怎么维护

1. **先保存原件**。放进 `patches/`，在 manifest 的 `patches` 尾部追加原名、顺序与 SHA256；只增加新记录，不改旧原件。有 Git 归档时填写 `sourceCommit` / `sourcePath`，仅本地提供时省略这两个字段、用 `origin` 记录取得方式。校验器对两种原件均核对 SHA256 并参与代码树重放，不伪造来源提交。
2. **确认基线**。检查完整仓库 `git status`、HEAD 和当前 seeds pin。不要在社区 `tools/repos/vllm-ascend` 上打这个补丁，不覆盖独立分支已有修改。
3. **检查再应用**。在当前工作版的独立分支/工作树执行 `git apply --check <绝对补丁路径>`；检查失败就读基线差异，不能强行忽略 hunk。确认原件是邮件格式且父版本吻合时可用 `git am`，普通 diff 用 `git apply --index` 后提交。记录应用结果的 commit 与 tree，不按文件编号猜版本。
4. **核对行为变化**。对变动函数和相关测试做 review。比较启动顺序、identity / manifest、MR / storage owner、main/draft、release / fallback / shutdown；协议或布局变化要同时检查 seed 和 receiver，不能只改一边。
5. **运行合适的测试**。完整 RFork 测试依赖对应 vLLM、torch/torch_npu 和数据系统环境；隔离 CPU 测试也有各自依赖。测试日志应写明真实环境、通过/失败/未执行，不能把 AST parse 或 fake backend 测试当成 NPU 传输验收。
6. **更新同一个版本事实**。将 `wiki/seeds/rfork.yaml` 的工作版 pin 改成已审定的新 commit；按 `sourceScope` 从该 commit 的 Git blob 导出 `source/`，删除已确认从新版本移除的旧快照文件，重算 `sourceFiles`，登记新补丁并保留原历史桥接。固定提交是源，入库文件和哈希是派生物。
7. **同步知识页**。逐条检查受影响的 sources、图 pin、参数、日志表和正文，更新前先移除这些页旧的 `verified: ["rfork:main"]`，复核完成再加回。运行 `pnpm rfork:evidence`，从已核验快照为引用文件生成不可变 raw 材料并更新页面的 `rawSources`；旧材料保留。站内问答的冻结快照会携带这些材料，不能假定它能直接读取外部 `tools/repos/`。旧事故注明实际版本，不因当前 pin 移动就重解释成新版本故障。
8. **校验后交付**。`pnpm rfork:verify --git` → Wiki build / lint / audit / diagram check；动了 UI 或检索代码再跑对应代码测试和浏览器验证。最后记录变了什么、为何改变、哪些现场验证尚缺。

仅有本地新提交时，源码与补丁仍可完整入库并供 Agent 查阅，不需要发布到社区。对外源码链接必须按实际可达性处理：当前章节链接到同事仓库 `yangsonglin13/vllm-ascend` 上的固定提交（不是用户本人的仓库）；未来本地提交尚未公开时，不得假装同名 GitHub 链接已经存在，应在交付与页面中提供本地入库文件定位并明确链接范围，或使用知识库的归档材料查看机制。不能为了让链接可用擅自推送代码。

本地提交不能只留下一个 SHA：交付新版本时还要保存包含该提交的 Git bundle，登记文件哈希及所需的公开父版本。换机先恢复 bundle 再检出 pin；仅重新 clone 远端找不到未推送的提交。当前版本已有公开提交，不需要额外 bundle。本机初次取源使用按需下载历史对象的克隆；当前工作树和补丁重放已核验，查询未缓存的历史可能仍需网络。

## 怎样判断一轮更新完成

版本 pin、快照、补丁重放结果和 Wiki 描述应指向同一份最终实现；原始补丁字节可核验；版本范围说清楚；发生故障时能从关键日志找到机制页和确切代码位置。

本机没有 NPU / CANN / YuanRong，也没有 torch、pytest 等 RFork Python 依赖。本次校验范围是源码事实、原件与代码树一致性、Python 语法、Wiki 构建/引用和阅读页面；真实设备的输出一致性、性能、MTP 共享和传输引擎清理语义需要部署环境验证。
