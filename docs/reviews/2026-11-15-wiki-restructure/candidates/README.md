# 首批四类知识库样板页：教学改写候选稿与旧事实→新段落映射（编辑候选包）

> **权威性质与证据边界声明（必读）：**
> 1. **编辑候选稿，非新一手证据**：本目录（`docs/reviews/2026-11-15-wiki-restructure/candidates/`）下的候选文稿、2D 图与映射表是任务 `042` 作者（`@墨墨`）基于正式库现有页面、`wiki/raw/` 已归档材料与钉住源码提交编制的**教学改写编辑候选稿**，**严禁当作新一手源码或实测证据**。
> 2. **新三步法流程与历史记录边界**：按用户 `000541`/`000555`/`000557`/`000593` 指令，全部 24 篇候选文档均重走「烁烁 `558` 前置参考提炼 → 墨墨 `042` 单篇短回合重写与 2D 重画 → 烁烁 `039` 审讲法/2D + 砚砚 `038` 独立核源码/事实」新三步法；**早期 `000234` 预检结论与旧 SHA 仅作历史记录保留，不再冒充当前完成状态**，且候选双审通过不替代真实写管线、`fact-disposition` 核验与 `Review` 整组审阅发布。
> 3. **2D 允许改、3D 严格冻结**：全部现有 `wiki-scene` 3D 围栏及与其绑定的核心算例数字、稳定主键 `id` 与真实 `verified` 状态严格冻结保护；2D `wiki-diagram` 允许按教学理解需要重设计重画（如 `quantization-flow.yaml`、`chunked-prefill-flow.yaml`），不硬塞凑数流程图。

## 1. 候选文稿、2D 图、正式基线与当前新流程状态索引

| 序号 | 正式页面与 2D 图基线（含 SHA-256） | 当前候选文稿与重画 2D 图（含 SHA-256） | 基线与章节改动映射表 | 新三步法当前状态（历史 `000234` 旧 SHA 仅作历史） |
|---|---|---|---|---|
| 01 | `wiki/concepts/chunked-prefill.md`<br>`54c0fce9a21c9de8cd99865da3ded8df39d8a1345bb63690d0a4afd33d94ce19`（350 行 / 51 sources）<br>`wiki/diagrams/chunked-prefill-flow.yaml`<br>`54d5a06b118b1c0dbff67b6abda2a76949964df58a21ac9f9af3118f88c632b6`（41 行） | [01-chunked-prefill.md](01-chunked-prefill.md)<br>`0370306fb60f343548703a516fee1aa7c9045e1252a0df37a27d6d1bcfd47cbe`（366 行 / 56 sources）<br>[chunked-prefill-flow.yaml](chunked-prefill-flow.yaml)<br>`adfd77160698331c03dde8a2ce823df42c31ede2a6186501ceaaaa2b54855efd`（37 行） | [01-chunked-prefill.mapping.md](01-chunked-prefill.mapping.md)<br>`10cdfeacde3b2158e740b6aed59b086453fe99745eede3462df509a230777f6f`（37 行） | **已双审 Approved（第 2/24 篇）**：`038` 事实复审 `000686`（[679-chunked-prefill-rereview.md](../679-chunked-prefill-rereview.md)）+ `039` 教学与 2D 复审 `000702` 通过（历史旧 SHA `372f39d4…` 已作废） |
| 02 | `wiki/concepts/quantization.md`<br>`3cd91ecca9ef96cc88b7c21a04e849c18aa30b47385218392745c4b80af6d8ae`（455 行 / 55 sources）<br>`wiki/diagrams/quantization-flow.yaml`<br>`46ff8769f904523b3838820264db03e4b2525b012a573fb93e14608926227262`（57 行） | [02-quantization.md](02-quantization.md)<br>`931e8f056452b3e46949fd2cb79b95e74a3f79bd77a9f15212873681a2f0b9ec`（451 行 / 59 sources）<br>[quantization-flow.yaml](quantization-flow.yaml)<br>`6d6077924ce5a8bc1c75e9b277ee192b6e867075770dd3d8ad8185a0bde9987e`（46 行） | [02-quantization.mapping.md](02-quantization.mapping.md)（36 行） | **已双审 Approved（第 1/24 篇）**：`038` 事实复审 `000657` + `039` 教学与 2D 复审 `000647`/`000659` 通过（历史旧 SHA `6d875da6…` 已作废） |
| 03 | `wiki/params/enable-super-kernel-ce990e186bfa.md`<br>`c2cd68ecb004004228ef280b825812ef00c45cd656b76f4f754f17d18292a83d`（224 行 / 37 sources） | [03-enable-super-kernel-ce990e186bfa.md](03-enable-super-kernel-ce990e186bfa.md)<br>`c18906ea533a6db74726d92089dcd7e8f451379761b2fcf87806d7b8bb8e1132`（234 行 / 43 sources，自动生成尾部逐字节保留） | [03-enable-super-kernel-ce990e186bfa.mapping.md](03-enable-super-kernel-ce990e186bfa.mapping.md)（28 行） | **新流程第 3/24 篇已完成 `721` 三项 P2 返修，待复审与 `039` 教学审查**：依据 `558` 提炼稿（`000713` `fcfdba7b…`）与 `721` 复审报告重排（历史旧 SHA `53b3a0b4…` 仅作历史） |
| 04 | `wiki/concepts/inference-troubleshooting.md`<br>`ae2646d352daad0352369ed59aec86269a53863b430c3075f0e9d7d3d78c1954`（235 行 / 12 sources） | [04-inference-troubleshooting.md](04-inference-troubleshooting.md)（历史旧稿 `2d867562d3a875a76ad26bab35872522a2bb70aabd752626350a455805a5438c`，230 行 / 13 sources） | [04-inference-troubleshooting.mapping.md](04-inference-troubleshooting.mapping.md) | **待新三步法提炼与重写**：当前文件仅保留历史 `000234` 预检旧稿备查，不代表新流程完成 |

## 2. 真实整合输入材料对应关系（供写管线收敛后真实整合使用）

- **`01` `wiki/concepts/chunked-prefill.md`**：
  - 既有归档 `rawSources`（2 份）：
    - `wiki/raw/sha256-a784826e7872c29e9344402dd0c34d9437753b13b503dd7eb663ea72c2414099.md`
    - `wiki/raw/sha256-ab8d477aec6bfdfa592d8282eafcfa581f0abbd5f9a7f08e30f386f9a7864ecd.md`
  - 钉住源码/文档 `sources`：原 51 条有序前缀 + 追加 5 条（`vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py` 的 `#L259-L290`、`#L448-L501`、`#L767-L793`、`#L1121-L1132` 与 `vllm-ascend@7d825229:docs/source/user_guide/feature_guide/batch_invariance.md#L184-L190`）。
- **`02` `wiki/concepts/quantization.md`**：
  - 既有归档 `rawSources`：无（`origin: direct`，直接绑定固定源码与文档锚点）。
  - 钉住源码/文档 `sources`：原 55 条有序前缀 + 追加 4 条（`vllm@ced6857a:vllm/config/model.py` 的 `#L170-L179`、`#L230-L239`、`#L1258-L1345`、`#L2238-L2366`）。
- **`03` `wiki/params/enable-super-kernel-ce990e186bfa.md`**：
  - 既有归档 `rawSources`（11 份）：
    - `wiki/raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md`
    - `wiki/raw/sha256-42c8fbc306605cf0e919ba3633fd18873e64133802338c685a530f755989462b.md`
    - `wiki/raw/sha256-4d26972cc76190b84fb0c4bc4fa8e5dc38bccbff799b1073a88ed88e66a1f7a1.md`
    - `wiki/raw/sha256-79a5ae22b065a783af11ee034b70e8f7a2a05feeb4589e15b8dcd74952c8e662.md`
    - `wiki/raw/sha256-b4c233521b02d2783805e7bb877b5cc54f0a1ce018f865c48fe3005500157cba.md`
    - `wiki/raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md`
    - `wiki/raw/sha256-c464f43f6b53bd43e74846ad95a26448484a9ba179597922409ed7774ce99fff.md`
    - `wiki/raw/sha256-c72498576a170455c135d749651303ce5defbeb08b46a62e6c257bd2f15dcced.md`
    - `wiki/raw/sha256-c972368829e7e384b3c21d0815797ac0f5e2be6ddf069b67ecd9ccc8e557e677.md`
    - `wiki/raw/sha256-ebc514e0f60b58ff8115eb677ddc78fa222976b6c86c214942a1d9f8502a3fe7.md`
    - `wiki/raw/sha256-f0620a0aa51e253e6317b8c200fef748f9a19d4f602343246dd853e3c06121e5.md`
  - 钉住源码/文档 `sources`：原 37 条有序前缀（`sources[29]` 即 `[C30]` 为 `vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L126`）+ 追加 4 条 `vllm-ascend@7d825229` 源码（`config_utils.py#L43-L50`、`device/hardware_profile.py#L315-L337`、`platform.py#L1305-L1343`、`compilation/compiler_interface.py#L241-L255`）+ 追加 2 条 `vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/graph_mode.md`（`#L228-L242`、`#L278-L286`），共 43 条。
- **`04` `wiki/concepts/inference-troubleshooting.md`**：
  - 既有归档 `rawSources`：无（`origin: direct`，直接绑定固定源码与文档锚点）。
  - 钉住源码/文档 `sources`：原 12 条有序前缀 + 追加 1 条（`vllm-ascend@7d825229:vllm_ascend/xlite/xlite.py#L592-L593`）。
