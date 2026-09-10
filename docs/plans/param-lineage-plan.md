# F002 实施计划：vLLM-Ascend 参数清单与版本谱系

Feature 文档：[F002-param-lineage.md](../features/F002-param-lineage.md)
依赖：[F001](../features/F001-llm-wiki.md) AC9（多 ref 钉定与完整克隆）——本计划 Phase 1 就是把它做掉。

## Goal

让知识库能回答关于 vllm-ascend 任意配置参数的三类问题：它是什么、它在哪些版本存在、它被哪个 PR 改动或删除。参数的**发现与版本事实由脚本确定性产出**（零额度、每日自动刷新），LLM 只负责补写人类才写得出的正文。

## Acceptance Criteria

逐条抄自 F002：

- **AC1 · 参数扫描器**：`pnpm wiki:scan-params --ref <ref>` 输出该 ref 的全量参数清单到 `wiki/lineage/params-<ref>.json`，每条含 `name`、`type`、`default`、`class`、`json_path`、`file`、`line`、`comment`、`constraints`、`confidence`（`certain` / `suspect`）。三路合一：Python `ast` 拿结构 + 全仓 grep 交叉验证 + 注释里捞自由字典的合法键。验收：单元测试用固定的 Python 源码样本断言四种定义形态都被识别。
- **AC2 · 疑似项由 LLM 复核**：`confidence: suspect` 的条目走一次 agent 调用复核，输出「确认是参数 / 不是参数 / 拿不准」三态与理由，写回 JSON。拿不准的留在清单里并标记，不静默丢弃。验收：故意混入一个非参数标识符，复核后被标为「不是参数」且带理由。
- **AC3 · 版本谱系**：`pnpm wiki:lineage` 对每个参数跨全部 ref 计算 `wiki/lineage/<param>.json`：各 ref 有无、首次出现的提交与 PR 号、被删除的提交与 PR 号、含它的 tag 列表。PR 号从 squash 提交信息尾部的 `(#NNNN)` 提取。验收：`layer_sharding` 的谱系文件与实测表一致，且给出 v0.23→v0.24 之间的删除提交。
- **AC4 · 骨架页零成本覆盖全部参数**：`pnpm wiki:build-param-pages` 由 `params-*.json` + 谱系确定性生成 `wiki/params/<name>.md`。不调用任何 LLM。验收：跑一次生成全部参数页，`pnpm wiki:lint` 通过，重复运行 `git diff` 为空。
- **AC5 · LLM 选择性补正文**：`pnpm wiki:ingest --params <name,...>` 把骨架页交给提取 agent 补四节正文，骨架部分由脚本重新覆盖，agent 不得改动。验收：补完一页后重跑 `wiki:build-param-pages`，版本表被刷新而正文保留。
- **AC6 · 每日同步与新参数触发**：`pnpm wiki:sync` 拉全部 ref、重跑扫描与谱系、与上次结果 diff；新增参数进队列并生成骨架页；消失的参数标注移除版本与 PR；默认值变化写进 `wiki/log.md`。失败非零退出并留原因。验收：人为改掉一条上次结果，跑 sync 能报「新增 1 / 删除 1 / 变更 1」并落到对应文件。

## Architecture

```
tools/repos/vllm-ascend/        完整克隆（全部分支与 tag），不进 git
scripts/wiki/params/
  scan.py                       Python AST 解析器，stdout 输出 JSON（不执行被解析的代码）
  scan.ts                       调 scan.py + 全仓 grep 交叉验证 + 合并 confidence
  lineage.ts                    跨 ref 计算谱系，纯 git 命令，无网络
  pages.ts                      骨架页渲染（确定性、幂等）
  review.ts                     suspect 条目送 LLM 复核（复用 F001 的 claude-cli.ts）
scripts/wiki-scan-params.ts     入口：--ref <ref> [--all-refs]
scripts/wiki-lineage.ts         入口
scripts/wiki-build-param-pages.ts 入口
scripts/wiki-sync.ts            入口：拉 ref → 扫描 → 谱系 → diff → 触发
wiki/lineage/
  params-<ref>.json             每个 ref 的参数清单（派生物，进 git 便于 diff 追溯）
  <param>.json                  每个参数的跨 ref 谱系
wiki/params/<name>.md           参数页：脚本骨架 + LLM 正文
```

数据流向是单向的：`git refs → scan → params-*.json → lineage → <param>.json → 骨架页 → （可选）LLM 补正文`。骨架区与正文区在同一个 md 文件里用标记分隔，脚本只覆盖骨架区。

## Tech Stack

沿用 F001：TypeScript + tsx + vitest 5 + zod 3 + gray-matter。新增：

- **Python 3**（本机 `/f/ProgramData/Anaconda3/python`，3.9.13）只用标准库 `ast` 与 `json`。`ast.parse()` 解析源码文本，不执行、不 import，所以**不需要安装 vllm 或 pydantic**。
- 不新增 npm 依赖。

## Straight-Line Check

**终点线**：`pnpm wiki:sync` 一条命令跑完，`wiki/params/` 下每个 vllm-ascend 参数都有一页，页上的版本表准确反映当前各分支状态，新参数会自动出现。

**不做什么**：不做参数的运行时实测；不做 vllm 上游仓库；不做前端（复用 F001 阅读页）；不做 issue / PR 语料（F003）；不做向量检索。

**终态数据结构**（先定，后面每步都往它收敛）：

```typescript
// wiki/lineage/params-<ref>.json
interface ParamEntry {
  name: string;                    // "dynamic_eplb"
  jsonPath: string;                // 'additional_config["eplb_config"]["dynamic_eplb"]'
  class: string | null;            // "EplbConfig"
  type: string | null;             // "bool"
  default: string | null;          // "False"（源码字面量的字符串形式）
  file: string;                    // "vllm_ascend/ascend_config.py"
  line: number;                    // 102
  comment: string | null;          // 字段上方的注释块
  constraints: string[];           // validator 报错串里提取："eplb_policy_type must in [0, 1, 2, 3]"
  form: "field" | "nested" | "dict-key" | "string-lookup";  // 四种定义形态
  confidence: "certain" | "suspect";
  review?: { verdict: "param" | "not-param" | "unsure"; reason: string };  // AC2 写回
}

// wiki/lineage/<param>.json
interface ParamLineage {
  name: string;
  refs: Record<string, { present: boolean; files: number }>;  // ref → 有无
  introduced: { commit: string; date: string; pr: number | null; subject: string } | null;
  removed:    { commit: string; date: string; pr: number | null; subject: string } | null;
  tagsWithout: string[];           // 含删除提交的 tag（即这些版本已无该参数）
  branchesWith: string[];
  branchesWithout: string[];
}
```

**每步过三问**（产物在终态原样保留吗 / 完成后能验证什么 / 去掉这步的代价）——逐 Task 在下面标注。

## 锚点核验记录（2026-09-10 实跑，命令与输出）

写计划前实际跑过的验证，计划里的断言都以此为据。

| # | 断言 | 命令 | 结果 |
|---|---|---|---|
| 1 | `ascend_config.py` 规模 | `wc -l vllm_ascend/ascend_config.py` | 1432 行 |
| 2 | Config 类数量 | `grep -cE '^class .*Config' vllm_ascend/ascend_config.py` | 15 |
| 3 | 顶层字段数（正则口径，**不准**，见 D1） | `grep -cE '^\s{4}[a-z_]+\s*:\s' vllm_ascend/ascend_config.py` | 96 |
| 4 | 环境变量 | `grep -cE '^\s{4}"[A-Z_0-9]+":' vllm_ascend/envs.py` | 12（文件 87 行）|
| 5 | 散落 getenv | `git grep -ohE 'os\.getenv\("[A-Z_0-9]+"' -- 'vllm_ascend/*.py' \| sort -u \| wc -l` | 25 |
| 6 | docs 树规模 | `find docs -name '*.md' \| wc -l` | 152 |
| 7 | 全树无记载的参数 | 逐个 `grep -rl <name> docs --include='*.md'` | 8 个：`ascend_log_path`、`draft_window_size`、`enable_sp_by_pass`、`mix_placement`、`num_head_replica`、`olora_tensor_parallel_size`、`pd_head_ratio`、`pd_tp_ratio` |
| 8 | 只在教程里提到的参数 | 同上 | 6 个：`keep_device_kv_cache`、`sparse_kv_offload_config`、`topk`、`topk_buffer_size`（在 `feature_guide/layerwise_and_sparse_kv_cache_offloading.md`）；`ascend_fusion_config`、`fusion_ops_gmmswigluquant`（在 `tutorials/models/GLM4.x.md`）|
| 9 | 正则口径会错判 | 逐个 `git grep -n <name> -- 'vllm_ascend/*.py'` | `budget_threshold`、`budget_update_interval`、`initial_verify_budget_per_req` 实为 `DynamicSpecConfig.method_params` 的合法键，只在 `ascend_config.py:876-881` 的注释里列出；`min_verify_tokens` 在 `spec_decode/utils.py:277` 按字符串取值。正则全部漏判为「代码里没有」 |
| 10 | `layer_sharding` 分支分布非单调 | `for b in ...; do git grep -l layer_sharding $b -- '*.py' \| wc -l; done` | v0.13.0=5、v0.18.0=1、v0.23.0=13、v0.24.0rc=0、v0.25.1rc=0、v0.26.0rc=1、v0.27.1rc=0、main=0 |
| 11 | 部分克隆会静默漏文件 | 同一命令在部分克隆与完整拉取下对比 | v0.23.0 部分克隆数出 11，完整拉取 13。**这是 Phase 1 改完整克隆的直接依据** |
| 12 | 删除提交与 PR 号可从本地 git 取得 | `git log --all --oneline -- vllm_ascend/ops/layer_shard_linear.py` | `89601215 [Refactor] remove layer sharding (#11953)`，日期 2026-07-15 |
| 13 | 含删除提交的 ref | `git branch -r --contains 89601215` / `git tag --contains 89601215` | 分支：main、releases/v0.24.0rc、v0.25.1rc、v0.26.0rc、v0.27.1rc；tag：v0.24.0rc1、v0.25.1rc1、v0.26.0rc1 |
| 14 | `(#NNNN)` 格式覆盖率 | `git log --oneline -200 origin/main \| grep -cE '\(#[0-9]+\)$'` | 200/200 |
| 15 | Python 可用且版本 | `python --version` | 3.9.13（`/f/ProgramData/Anaconda3/python`）|

**核验 12 + 13 合起来就是用户原始问题的完整答案**，且全部来自本地 git、无网络、无 LLM：

> `layer_sharding` 由 PR **#11953**（提交 `89601215`，2026-07-15，`[Refactor] remove layer sharding`）移除；
> 已移除的分支：`main`、`releases/v0.24.0rc`、`v0.25.1rc`、`v0.26.0rc`、`v0.27.1rc`；
> 已移除的 tag：`v0.24.0rc1` 起；
> 仍保留的分支：`releases/v0.23.0`（13 个文件，核心实现 `vllm_ascend/ops/layer_shard_linear.py`）及更早的 v0.18.0、v0.13.0。

**遗留待查**：核验 10 显示 `releases/v0.26.0rc` 有 1 个 `.py` 文件仍含 `layer_sharding`，而核验 13 显示该分支包含删除提交。两者不矛盾（可能是测试或注释残留，也可能是局部回带），但要在 Task 14 的谱系实现里作为真实用例查清并覆盖——这正是「按 ref 列表而非单一版本号」的价值所在。当时因 `schannel: failed to receive handshake` 未查完。

## 设计决策

| # | 决策 | 结论 | 依据 |
|---|---|---|---|
| D1 | 扫描不用正则 | Python `ast` + 全仓 grep + 注释解析三路合一 | 锚点 9：正则口径在 101 个候选里错判 4 个、漏判嵌套类。正则读不出「这个标识符是不是字段」这件事 |
| D2 | 解析器用 Python 而非 TS 重写 | `scripts/wiki/params/scan.py`，`execFileSync` 调用，stdout 传 JSON | 被解析的就是 Python 源码；标准库 `ast` 是唯一不会与上游语法漂移的解析器。TS 侧的 Python parser 要么引入 wasm 依赖要么手写，都比这脆 |
| D3 | `ast.parse` 不执行代码 | 不需要装 vllm / pydantic / torch | `ast.parse()` 只做词法与语法分析。这一条要写进脚本注释，避免后人以为要建 Python 环境 |
| D4 | 四种定义形态都要覆盖 | `form` 字段区分 `field` / `nested` / `dict-key` / `string-lookup` | 锚点 9 的实例：`dynamic_eplb` 是 field，`eplb_config` 里一层是 nested，`budget_threshold` 是 dict-key，`min_verify_tokens` 是 string-lookup |
| D5 | 拿不准的不丢弃 | `confidence: "suspect"` + AC2 的 LLM 三态复核，保留 `unsure` | 用户 2026-09-10 拍板由 LLM 复核；静默丢弃会让清单看起来干净但实际有洞，比标出来更糟 |
| D6 | 谱系不查 GitHub API | 全部用本地 git：`git log -S`、`git branch -r --contains`、`git tag --contains`，PR 号从 `(#NNNN)` 取 | 锚点 12–14 已验证可行且覆盖率 200/200。不依赖 token、不受限额影响、可离线跑 |
| D7 | 骨架与正文分区 | 参数页用 GENERATED 注释标记包住脚本区，脚本只覆盖区内 | 谱系每日刷新、正文由 LLM 写；不分区就会互相覆盖。F001 已吃过 build 与 biome 互相重排的亏 |
| D8 | 参数页放 `wiki/params/` 而非 `concepts/` | 新目录，`wiki:lint` 与 `wiki:build` 都要认它 | 参数页有脚本生成区，生命周期与人写的 concept 页不同；混在一起 lint 规则会打架 |
| D9 | `params-<ref>.json` 进 git | 是（派生物但进 git） | 它是 sync 做 diff 的基准；进 git 才能用 `git diff` 看出「上游这次加了什么参数」，这本身就是有价值的历史 |
| D10 | 一次全量扫描而非增量 | 每次扫全部 ref，结果做 diff | 单 ref 扫描是秒级；增量的复杂度换不来收益，且全量能顺带发现改名 |

## Out of Scope

参数运行时实测行为（PLAN 的 M 级证据）；vllm 上游仓库参数；前端展示（复用 F001 AC6）；issue / PR 语料与报错检索（F003）；向量检索。

---

## Phase 1：多 ref 钉定与完整克隆（F001 AC9）

这是 F002 的地基，但改的是 F001 的代码，所以 AC 挂在 F001 上。

### Task 1 — `seedsSchema` 支持一组 ref

**三问**：产物（多 ref 的 seeds 结构）在终态原样保留；完成后可验证 seeds 能声明多个 ref 且 feature 能指定 ref；去掉这步则扫描器无法跨分支跑。

**先写失败测试**，在 `scripts/wiki/ingest.test.ts` 追加两个用例：

1. 一个 repo 声明 `refs: { main: <sha>, "releases/v0.23.0": <sha> }`，一个 feature 声明 `ref: "releases/v0.23.0"`，断言 `parseSeeds` 解析出两个 ref 且 feature 的 ref 正确。
2. feature 指向未声明的 ref 时，`parseSeeds` 抛错且信息含「ref「nope」不在」。

**跑，确认失败**：`pnpm vitest run scripts/wiki/ingest.test.ts`
预期：两个用例失败，第一个报 `Unrecognized key "refs"`，第二个报未抛错。

**最少实现** `scripts/wiki/ingest.ts`：

- `repos` 的 `commit: z.string()` 换成 `refs: z.record(z.string().regex(/^[0-9a-f]{7,40}$/))`。
- `features` 加 `ref: z.string().default("main")`。
- `superRefine` 补一条：feature 的 `ref` 必须是所属 repo 的 `refs` 的键。
- 兼容旧格式：`commit` 保留为可选字段，存在时归一化成 `refs: { main: commit }`，这样现有的 `wiki/seeds/vllm-ascend.yaml` 不用立刻改。

**跑，确认通过**，再跑 `pnpm check` 确认没打破 F001 的 168 个测试。

**提交**：`feat(wiki): seeds 支持一个 repo 钉多个 ref`

### Task 2 — `wiki:clone` 改完整克隆并校验全部 ref

**三问**：完整克隆是终态；完成后可验证跨分支 grep 数目正确；去掉这步则谱系与扫描结果都会静默漏项（锚点 11）。

**先写失败测试** `scripts/wiki/clone.test.ts`（新文件）。把决策逻辑抽成纯函数 `planClone(existing, repo)` 再测，避免测试里真去 clone：

1. 目录不存在时，`plan.args` 等于 `["clone", "--no-checkout", url, path]`，且**不含** `--filter=blob:none`。
2. 目录已存在但缺某个 ref 时，`plan.fetchRefs` 含该 ref。

**跑，确认失败**（`planClone` 不存在）。

**实现**：`scripts/wiki/clone.ts` 导出 `planClone`，`scripts/wiki-clone.ts` 只做 IO。克隆命令去掉 `--filter=blob:none`，改成 `git clone --no-checkout <url> <dir>`，随后 `git fetch origin "+refs/heads/*:refs/remotes/origin/*" --tags`。

**跑通过** → **提交**：`fix(wiki): 克隆改为完整克隆，部分克隆会静默漏文件`

### Task 3 — 提取请求按 feature 的 ref 解析工作树

**三问**：终态保留；可验证 `--add-dir` 指向正确 ref 的工作树；去掉则无法为历史参数写页。

多个 ref 要同时可读，用 `git worktree add tools/repos/vllm-ascend@<ref>` 为每个**被 seeds 真正引用的** ref 建独立工作树（不是全部 ref）。

**先写失败测试**：`extractRequest` 对声明了 `ref: "releases/v0.23.0"` 的 feature，`--add-dir` 应为该 ref 的工作树路径，且 `sources` 前缀用该 ref 的 commit 而非 main 的。

**实现** → **通过** → **提交**：`feat(wiki): 提取按 feature 声明的 ref 选择工作树`

### Task 4 — 实跑重新克隆并复核锚点 11

**命令**：

```bash
rm -rf tools/repos/vllm-ascend
pnpm wiki:clone --seeds wiki/seeds/vllm-ascend.yaml
cd tools/repos/vllm-ascend
git grep -l layer_sharding origin/releases/v0.23.0 -- "*.py" | wc -l
```

**预期输出**：`13`（部分克隆时为 11）。不是 13 就停下来查，不要继续 Phase 2。

同时复核锚点 10 那张分支分布表在完整克隆下是否有变化；有变化就更新 F002 的 Why 与本计划的锚点记录。

**提交**：`chore(wiki): 重建完整克隆并复核跨分支计数`

---

## Phase 2：参数扫描器（AC1）

### Task 5 — `scan.py` 识别形态①（pydantic dataclass 字段）

**先写失败测试** `scripts/wiki/params/scan.test.ts`。用**固定的源码样本**而不是真实仓库文件——真实仓库会随克隆与上游变化，测试必须稳定。样本按 `EplbConfig` 的真实结构写：一个带 `@config` 装饰器的类，一个 `dynamic_eplb: bool = False` 字段，一个上方带两行注释的 `load_collection_phase: str = "all"` 字段。

断言 `scanSource(SAMPLE, path)` 对 `load_collection_phase` 返回 `{ name, type: "str", default: '"all"', class: "EplbConfig", form: "field", confidence: "certain", line }`，且 `comment` 含注释首句。

**跑，确认失败**（`scanSource` 不存在）。

**实现** `scripts/wiki/params/scan.py`：`ast.parse` 后遍历 `ClassDef` 的 `AnnAssign` 节点，取 `target.id`、`ast.unparse(annotation)`、`ast.unparse(value)`、`lineno`。注释用源码行回溯——`ast` 不保留注释，所以从 `lineno - 1` 往上收连续的 `#` 行。文件头注释里写明 D3（`ast.parse` 不执行代码，不需要装 vllm）。

`scripts/wiki/params/scan.ts` 用 `execFileSync(python, [scanPy], { input: source })` 调用，stdout 用 zod 校验成 `ParamEntry[]`。

**通过** → **提交**：`feat(wiki): 参数扫描器识别 dataclass 字段`

### Task 6 — 形态②嵌套 config 类与 `jsonPath`

样本加一层：`AscendConfig` 里有 `eplb_config: EplbConfig`。断言 `dynamic_eplb` 的 `jsonPath` 为 `additional_config["eplb_config"]["dynamic_eplb"]`，`form` 为 `nested`。

**实现**：先扫出全部类与字段，再按「字段的类型名是本文件里定义的另一个 Config 类」建父子关系，自顶向下拼 `jsonPath`。根类从类 docstring 里的 `additional_config` 字样识别；识别不到就标 suspect 而不是猜。

**提交**：`feat(wiki): 参数扫描器解析嵌套 config 与 jsonPath`

### Task 7 — 形态③注释里列出的自由字典键

样本照抄 `ascend_config.py:874-881` 的真实结构：`DynamicSpecConfig.method_params: dict[str, Any]`，上方注释里写 `dspark accepts initial_verify_budget_per_req, budget_update_interval and budget_threshold`。

断言扫出 3 个 `form: "dict-key"`、`confidence: "suspect"` 的条目，`jsonPath` 形如 `...["method_params"]["budget_threshold"]`。

**实现**：字段类型为 `dict[...]` 时，从其注释里抽 snake_case 标识符作为候选键。这一步**必然有误报**（注释里会提到别的东西），所以一律标 suspect 交 AC2 复核——这就是 D5 存在的理由。

**提交**：`feat(wiki): 从注释里捞自由字典的合法键（标 suspect）`

### Task 8 — 从 validator 提取 constraints

样本用 `EplbConfig._validate_config` 的真实片段。断言三件事：

- `eplb_policy_type` 的 `constraints` 含 `must in [0, 1, 2, 3]`；
- `dynamic_eplb` 的 constraints 记下对环境变量 `DYNAMIC_EPLB` 的依赖；
- `expert_map_record_path` 的 constraints 记下「设置后会强制 `dynamic_eplb=True`」这条隐式联动。

**实现**：遍历 validator 函数体，收集 `raise ValueError/TypeError` 的字符串字面量，以及形如 `self.X = <常量>` 的隐式赋值。字符串里出现哪个字段名就把这条挂到哪个字段上。

这一步产出的是学习者最容易踩的坑，价值高于字段本身。

**提交**：`feat(wiki): 从 validator 提取取值范围与字段联动`

### Task 9 — 形态④全仓 grep 交叉验证

对每个已扫出的参数名，全仓 grep 记录所有出现位置；同时**反向**找出「像参数名、但没被 AST 扫到」的字符串字面量（如 `spec_decode/utils.py:277` 的 `min_verify_tokens`），标 `form: "string-lookup"`、`confidence: "suspect"`。

**提交**：`feat(wiki): grep 交叉验证补出按字符串取值的参数`

### Task 10 — 入口与 schema 定型

`scripts/wiki-scan-params.ts`：`--ref <ref>` 与 `--all-refs`，输出 `wiki/lineage/params-<ref>.json`，键排序保证幂等。`ParamEntry` 的 zod schema 放 `src/content/wiki/schema.ts`，与前端共用（沿用 F001 的做法）。

**验收命令**：

```bash
pnpm wiki:scan-params --ref main
node -e "const p=require('./wiki/lineage/params-main.json'); console.log(p.length, p.filter(x => x.confidence === 'suspect').length)"
```

**预期**：总数 > 100；suspect 数 > 0（形态③④必然产生）。把实际数字回填到 F002 的 Why 里，替换掉现在那个正则口径的约数。

**提交**：`feat(wiki): wiki:scan-params 入口与产物 schema`

### Task 11 — 与官方文档对账（顺带产出，零成本）

扫描结果与 `docs/source/user_guide/configuration/*.md` 做集合差，输出「代码有文档无」「文档有代码无」两张表到 `wiki/lineage/doc-gap-<ref>.json`。

这是锚点 7、8 那次手工对账的自动化版本，也是知识库对学习者最直接的价值：**告诉他官方文档漏了什么**。同时它是扫描器的健康探针——上游重构后若 doc-gap 突然暴涨，说明扫描器可能失效了。

**提交**：`feat(wiki): 参数与官方文档对账`

---

## Phase 3：版本谱系（AC3）

- **Task 12**：`lineage.ts` 的 `refPresence(param, refs)`，逐 ref 跑 `git grep -l` 计数。测试用 stub 的 git 执行器，不碰真实仓库。
- **Task 13**：`introducedAt` / `removedAt`，用 `git log -S<name> --all --oneline --reverse` 取首尾提交；PR 号用 `/\(#(\d+)\)\s*$/` 从 subject 提取（锚点 14：近 200 条提交覆盖率 200/200）。
- **Task 14**：`tagsWithout` / `branchesWith` / `branchesWithout`，用 `git tag --contains` 与 `git branch -r --contains`。**用 `layer_sharding` 作真实用例**，断言输出与锚点 12、13 一致，并顺手查清「`releases/v0.26.0rc` 含删除提交却仍有 1 个 py 文件命中」这个遗留问题。
- **Task 15**：入口 `pnpm wiki:lineage`，产出 `wiki/lineage/<param>.json`。

## Phase 4：骨架页（AC4）

- **Task 16**：`pages.ts` 的 `renderSkeleton(param, lineage)`，输出带 GENERATED 标记区的 md：frontmatter（`type: param`、`sources` 指向定义行、`evidence: "C"`）、定义位置、默认值、constraints、跨 ref 版本表。
- **Task 17**：`mergeSkeleton(existing, fresh)` 只替换 GENERATED 区，保留区外正文。测试：给一页手写正文，重新生成后正文一字不变。
- **Task 18**：`wiki:lint` 与 `wiki:build` 认 `wiki/params/`；页面 `type` 枚举加 `param`。跑全量生成 + `pnpm check`；连跑两次 `git diff` 为空。

## Phase 5：复核、补正文与每日同步（AC2 / AC5 / AC6）

- **Task 19**：`review.ts` 把 suspect 条目分批送 agent 复核（复用 F001 的 `claude-cli.ts` 与 HANDBOOK 切片机制，在 HANDBOOK 新增一个 `## 参数复核` H2 切片），三态结果写回 JSON。
- **Task 20**：`wiki:ingest --params <name,...>`，agent 只允许写 GENERATED 区之外的正文，越界由 F001 已有的批级快照差集兜底。
- **Task 21**：`wiki-sync.ts`：拉 ref → 扫描 → 谱系 → 与 `git show HEAD:wiki/lineage/params-<ref>.json` 做 diff → 新增参数进 `_param-queue.json` 并生成骨架页 → 消失的参数标注移除版本与 PR → 默认值变化写 `wiki/log.md`。
- **Task 22**：注册 Windows 计划任务；失败时非零退出且 log 可读（区分网络失败、git 失败、扫描器失败三类）。

## 验证

| AC | 验证方式 | 通过标准 |
|---|---|---|
| F001 AC9 | Task 4 实跑 | `git grep -l layer_sharding origin/releases/v0.23.0 -- "*.py" \| wc -l` 等于 13 |
| AC1 | Task 5–10 单测 + 实跑 | 四种形态各有用例；`params-main.json` 条数 > 100 |
| AC2 | Task 19 | 注入的非参数标识符被判 `not-param` 且带理由 |
| AC3 | Task 14 | `layer_sharding` 谱系与锚点 12、13 一致；v0.26.0rc 残留已查清 |
| AC4 | Task 18 | 两次生成 `git diff` 为空；`pnpm check` 全绿 |
| AC5 | Task 20 | 补完正文后重跑生成，版本表刷新而正文保留 |
| AC6 | Task 21 | 人为改掉基准后 sync 报「新增 1 / 删除 1 / 变更 1」 |

## 风险

| 风险 | 影响 | 应对 |
|---|---|---|
| 上游重构 config 定义方式 | 扫描器失效，清单变空或残缺 | Task 11 的 doc-gap 对账是健康探针（突然暴涨即异常）；sync 失败非零退出，不静默产出空清单 |
| 形态③注释解析误报多 | suspect 清单膨胀，复核成本上升 | 先统计一次误报率；若 suspect 占比过高，收窄触发条件到「字段类型是 dict 且注释里出现 accepts / expected keys 字样」 |
| 完整克隆体积 | 磁盘占用上升（当前部分克隆 `.git` 为 32 MB）| `tools/repos/` 不进 git；实测体积后写进 HANDOFF；仍只克隆 vllm-ascend 一个仓库 |
| 多 worktree 的磁盘与维护 | 每个 ref 一份工作树 | 只为 seeds 真正引用的 ref 建；`wiki:clone` 负责回收不再被引用的工作树 |
| Python 缺失或版本差异 | 扫描器跑不起来 | `scan.ts` 启动时检查 `python --version`，缺失时明确报错而**不降级到正则**——那正是 D1 要避免的 |
| 网络不稳（本轮已遇到 `schannel: failed to receive handshake`）| 克隆与 fetch 中断 | `wiki:clone` 支持断点续跑；sync 失败记 log，次日重试 |
| LLM 复核把真参数判成非参数 | 清单出现假阴性 | 复核只降不删：判为 `not-param` 的条目仍留在 JSON 里并标记，不从清单移除；页面不生成但记录可查 |
