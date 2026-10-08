# rfork-maintenance 审查记录

## P5 写作记录（2026-10-02，第 21 批小修）

### 改了什么
- 第一节补一句话定义（版本维护＝随时说清运行的是哪份完整代码，并让原补丁、代码、知识页对得上），RFork 是什么只链接总览。
- 新增直觉图 `wiki/diagrams/rfork-patch-history.yaml`（第一节）：社区基线 → 补丁 1–3 共用，补丁 3 后分两路；上路补丁 4–6，下路另外三次提交 → 补丁 7（现在运行的代码）；补丁 6 直接打补丁 7 标「直接打不上」，另一条虚线是衔接差异。队列写「沿用现有图」，但本页原来没有图，所以新画；diagrams 无本图告警。
- 「七份补丁不是一条链」改成对照图讲：两路各是哪些提交、下路三次提交按提交说明做的同类工作、衔接差异的规模（18 文件、+3080/−185，源码 6 个文件约 300 行），并点明下路变化不能按补丁编号归因。
- 补丁表：开头一句链接[总览的版本对照]（rfork.md#版本差异），表只留「原件管的事 / 读的时候的边界」；补丁 7 一行改成按 rank 固定端口、跳过名单只有 top-k 缓冲区；端口、缓冲区、晚申请租约、后台归还分别链接配置、布局、启动、生命周期页。
- 「代码放在哪」补换机与链接规则：现版提交已在同事仓库公开；未公开本地提交要存 Git bundle；不能为链接可用擅自推送。
- 「新补丁来了」改标题为「回看哪些页，上线时怎样和旧版隔开」；先回看表、再讲上线隔离；修掉表里重复的「传输」链接，输出一致性验收链到 rfork.md#成功至少有四种不能压成一个开关；指纹段写清字段与「模型版本号≠RFork 代码版本」、换策略名为何能隔离；规程摘要按 README 八步更新。
- 常见误解加两条（指纹版本号误解；按补丁编号归因）。
- 对照源码·版本差异：开头声明全章版本对照只在总览，本页只管工作版身份；补归档提交关系和分叉各提交号；基线 f2f74a16 的社区归属。
- frontmatter 只改 updated。

### 数字出处
本页无部署数字（队列：不适用）。新增的版本事实全部本轮实测：
- 分叉：`git merge-base 7ddcfca9 09b8eeae` = 395a59cb；两路 `git log` 见 rfork/VERSION-NOTE.md 第 17–23 行，与实测一致。
- 衔接差异规模：`git diff --stat 7ddcfca9 09b8eeae`，18 files, +3080/−185；源码 6 文件增删 119+35+2+58+75+10=299。
- 归档提交：`git show --stat 2db39b67`（父 7ddcfca9，6 个 .patch）、`7b1a690b`（父 3284850b，1 个 .patch）。
- 基线：manifest.json `baseCommit` = f2f74a16；社区克隆 `merge-base --is-ancestor`：对 2ed6cbba 为 yes，对 2c59ff10、baa023ad 为 no。

### 核心概念对照的源码（rfork@3284850b）
- compat.py L1–20：仅当 hardware_profile 模块缺失时按 is_310p 造替身（FORCE_NZ / CONFIGURABLE），其他导入错误照抛；调用方 identity.py L213、rfork_loader.py L516。
- identity.py L145–158、L218–243：指纹字段（model_url、model_deploy_strategy_name、model_revision、dtype、quantization、量化配置摘要、结构、并行大小、权重布局），无 RFork 代码版本；model_revision 取模型配置 / HF 配置的 revision 或 commit hash。
- 补丁 7（`git show 3284850b`）：config.py 加 seed_port_base（0–65535 校验）；session.py L363–378 端口＝基数+global_rank，0 走系统随机，超 65535 告警退回随机；tensor_layout.py 运行期名单只有 topk_indices_buffer。
- session.py L150–225：后台线程归还租约，lease_release_max_attempts 上限。rfork_loader.py L198–260：回退时摘编译钩子、清 MoE 引用。
- rfork/README.md 第 33–46 行：八步规程、Git bundle、同事仓库链接规则；wiki/seeds/rfork.yaml 第 5–8 行钉点。

### 旧版信息清单勾选（清单在 scratchpad p5/rfork-maintenance-facts.md）
F1–F25 全部保留在新版对应节（F8 补丁表保留并改列名；F16 回看表保留并修重复链接；F21–F25 对照源码五节保留）。无删除项。新增 N1–N6 均已写入。

### 验证
- `pnpm wiki:lint`：通过，本页 0 报错（待留意 5 处均为他页 mark-flood）。
- `pnpm wiki:diagrams --check`：284 张图与 spec 一致；本图无告警。
- `pnpm wiki:audit`：通过；本页正文 7965 字 / 8 节，来源 5 条行号有效。
- 浏览器：5193 只读打开 `#/wiki/rfork-maintenance`，新文字与图均已渲染，图在正文宽度下文字清晰（Playwright 截图）。8790 不在线（502），未起停任何服务。

### 疑点 / 未做
- 无 GLM 双机节：本页是维护附录，队列标「数字取自 不适用」。
- 下路三次提交的作用只按提交说明概括，未逐行比对它们与补丁 4–6 的差异（规模见衔接差异）。
- 跳过：无。

## P5 审查（09-29）

审查员：Opus 5.5 独立审查（2026-10-02，第 21 批）。只审未改页面。

### 结论
- 分数：**8.5 / 10**
- 学习顺序：**通过**。第一屏是问题式 H2 + 加粗一句话定义 + 补丁分叉图；接着讲为什么七份补丁不是一条链，再讲每份补丁的阅读边界、代码放在哪、新补丁来了怎么做、哪些要到现场核，最后是常见误解和对照源码。本页是维护附录，没有 GLM 双机一节，队列标了「不适用」，合理。
- 初学者测试（只读前两屏）：版本维护就是随时说得清「现在跑的是哪一份完整代码」，也就是钉在 3284850b 的补丁 7 那一格，并让原补丁、这份代码和知识页三者对得上。难点在于七份补丁在补丁 3 之后分成了两路，补丁 7 不能直接打在补丁 6 上，中间要靠一份衔接差异才能重放出来。
- `pnpm wiki:audit`：本页**通过**（7965 字 / 8 节，来源 5 条）。`pnpm wiki:lint`：通过，本页 0 报错。
- 旧版信息清单：存在（13898c74 scratchpad p5/rfork-maintenance-facts.md）。抽查 F2、F5、F6、F10、F14+N4、N3 共 6 条，新版都在，勾选属实。`git diff` 删掉的 18 行都是改写，没有丢信息；旧回看表里重复的「传输」链接已修掉。

### 对照 RFork git 历史与源码逐条核（tools/repos/rfork）
- 分叉图与正文：以下各项都与 `git log -1 --format=%p` 一致。
  - 补丁 1 = b5445840（#12995），补丁 2 = 54081fd7，补丁 3 = 395a59cb。
  - 上路：3aa0ee8f → ac2be61b → 7ddcfca9。
  - 下路：4c3016fe → 996d9bd0 → 09b8eeae → 3284850b。
  - 归档提交：2db39b67 的父提交是 7ddcfca9，7b1a690b 的父提交是 3284850b。
  - 基线 f2f74a16 是 v0.26 钉点 2ed6cbba 的祖先，图上写「v0.26 分支」成立。
  - 下路三次提交的说明，与正文第 76 行的概括相符。
- 衔接差异：`git diff --shortstat 7ddcfca9 09b8eeae` 的结果是 18 个文件、+3080/−185。源码六个文件合计 299 行，测试文件 10 个，另有设计文档 1 份，与第 82 行一致。
- 补丁 7 改到的文件里，test_seed_server_cleanup_isolated.py 和 test_tensor_safety_isolated.py 在 7ddcfca9 上不存在，tensor_layout.py 在两路之间有 75 行差异。这与第 78 行「打不上」的说法一致。
- 补丁 7 的内容核过：新增 seed_port_base，端口 = 基数 + global_rank；`_RUNTIME_ONLY_TENSOR_NAMES` 里只有 topk_indices_buffer；没有改 transfer_backend。第 97 行写的边界都成立。
- 其他源码核对：
  - 指纹字段：identity.py L219–241，确实不含 RFork 代码版本。
  - compat 垫片：compat.py L10–21 是 FORCE_NZ / CONFIGURABLE 二选一的替身；调用方是 identity.py L213 和 rfork_loader.py L516。
  - 租约后台归还有次数上限：session.py L158、L204。
  - 第二份补丁保留原始存储：transfer_backend.py L155–175。
- README 第 35–42 行是八步规程，与第 129 行一致。

### P1（0 条）
无。

### P2（2 条）
1. **第 112 行**：「重新克隆再检出钉点就行」这句与 git 实况不符。
   - 证据：2026-10-02 跑 `git ls-remote --heads origin`，同事仓库共 62 个分支头，没有一个包含 3284850b 或 7b1a690b（逐个跑过 `merge-base --is-ancestor`）。GitHub 上这两个提交的页面能打开（HTTP 200），但它们不在任何分支上。本地 `codex/rfork-work` 的 reflog 记的是「Created from 3284850b…」，说明当初是按 SHA 取下来的。
   - 影响：普通克隆不会带下不在分支上的提交，照这句话做，换机时可能检出失败。不在分支上的提交还可能被 GitHub 回收，所以「现在不需要 bundle」的前提也站不住。rfork/README.md 第 46 行有同一个说法（单一出处在 README）。
   - 改法：README 和本页一起改，二选一：
     - 写明要先 `git fetch origin <完整 SHA>` 再检出，并建议请同事给这两个提交留一个分支；
     - 或者现在就按未公开提交的做法存 Git bundle。
2. **第 131 行**：把指纹字段逐项又列了一遍（模型地址、部署策略名、版本号、精度量化、结构、并行大小、权重布局），重讲了[身份](rfork-identity.md)「部署指纹里写了什么」一节的内容，违反本批「身份、配置、布局各管自己的锚点」。
   - 改法：只留本页要用的那一点，也就是「指纹里有部署策略名和模型权重的版本号，没有 RFork 代码版本」，再链到 rfork-identity.md#部署指纹里写了什么。

### P3（3 条）
1. **第 76 行**「同一类事，只是写法不同」说得偏松。下路的 996d9bd0 多做了回退时释放 MoE 旧权重，09b8eeae 是摘编译钩子，补丁 6 是清理与 Planner 并发，并不是一一对应、只换了写法；后文第 82 和 146 行也强调衔接差异另外带来了变化。建议改成「主题相近，但实现和覆盖范围不同」。
2. **第 66 行**「多存了一份补丁文件」有歧义：2db39b67 存的是 6 个 .patch，7b1a690b 存的是 1 个。建议改成「多存了补丁原件」。
3. **第 99 行**指向[配置](rfork-config.md)和[布局](rfork-layout.md)的是整页链接，建议精确到锚点：rfork-config「四类端口：谁监听、谁来连、由什么决定」，rfork-layout「本机的工作区不从 A 搬」。

### 浏览器
- 用 Playwright 只读访问 http://localhost:5193/#/wiki/rfork-maintenance（桌面宽 1440），没有起停 5193 / 8790。
- 截图在本审查会话 scratchpad：rfork-maintenance-review-first.png、rfork-maintenance-review-diagram.png。
- 第一屏显示标题、一句话定义和分叉图，图上文字清楚，补丁 7「现在运行的代码」用强调色。页面没有 meta 文本，也没有新加的分镜动图。

### 跳过
- 按纪律没读「对照源码」一节的正文，只用 grep 核了五个 H3 的顺序和 v0.23 / v0.26 / main 是否出现。
- 没读 sources 区。

## P5 修订记录（2026-10-02）

- **P2-1 成立，已改**（「代码放在哪」末段 + 对照源码·怎么开新增一条）。本轮复核：`git ls-remote origin` 共 62 个分支头、0 标签；逐个 `merge-base --is-ancestor`，没有一个包含 3284850b 或 7b1a690b；2db39b67 是分支 v0.26.0rc1-rfork-my-PR 的头。本地只有 codex/rfork-work 含钉点（reflog：Created from 3284850b…）。在 scratchpad 空仓库实测 `git fetch --depth=1 --filter=blob:none <同事仓库> 3284850b…` 成功取到。两个提交的 GitHub 页面 curl 均为 200。`scripts/wiki/clone.ts` 第 68 行的 fetch 只拉 `refs/heads/*` 和标签，按逻辑拿不到钉点（全新机器未实测）。页面改为：先说明没有保障与原因 → 按完整提交号单独拉取再检出（实测可行）→ 保留多久写「待核：缺同事仓库的保留约定」→ 二选一保住（请同事留分支 / 现在就存 Git bundle）。
- **P2-2 成立，已改**：指纹段压成一句「指纹里有部署策略名和模型权重的版本号，却没有 RFork 代码本身的版本」，链到 rfork-identity.md#部署指纹里写了什么（标题已在该页第 126 行，lint 通过）。未改 rfork-identity。
- **README 同一句错话**：文件是 `rfork/README.md` 第 46 行（「当前版本已有公开提交，不需要额外 bundle」）；同文件第 25 行的 `pnpm wiki:clone --seeds wiki/seeds/rfork.yaml` 也受同一问题影响（只拉分支头）。`git log --format='%an %ad %s' -3 -- rfork/README.md` 只有一条：BailanCaptain，2026-09-23 02:01:41 +0800，「Add the RFork working-version chapter, reviewed against its source」（d86a580）；工作区无未提交改动。按指示未改，等主会话决定。
- **P3-1 已改**：「同一类事，只是写法不同」→「主题相近，但实现和覆盖范围不同」。
- **P3-2 已改**：「多存了一份补丁文件」→「多存了补丁原件（前者 6 个、后者 1 个）」。
- **P3-3 已改**：配置链到 rfork-config.md#四类端口谁监听谁来连由什么决定，布局链到 rfork-layout.md#本机的工作区不从-a-搬。
- 验证：`pnpm wiki:lint` 通过，本页 0 报错；`pnpm wiki:diagrams --check` 285 张一致；`pnpm wiki:audit` 本页 0 报错（正文 8354 字 / 8 节，来源 5 条），整体失败 2 处都在 rfork-layout（diagram-first、hedge-ratio），不是本页。
- **README 修订（主会话确认可改）**：只改 `rfork/README.md` 第 46 行「当前版本已有公开提交，不需要额外 bundle」一句，改为：pin 与 patch7 归档不在任何分支上、普通 clone 与 `pnpm wiki:clone` 拿不到 → 先 `git fetch origin <完整 SHA>` 再检出（10-02 实测可取到）→ 保留期限待核 → 请同事留分支或现在就存 bundle，并链到本页「代码放在哪」节；`git diff --stat` 为 1 行替换，`pnpm wiki:lint` 通过（README 不在 lint 范围）。
