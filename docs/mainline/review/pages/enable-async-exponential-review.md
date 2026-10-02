# enable-async-exponential 审查记录

## P5 写作记录（2026-10-02，第 26 批小修）

**改了什么。** 保留参数页四段式（一句话 / 事实表 / 为什么存在 / 开了的代价）和两节自动生成内容；正文 8,766 → 9,345 字（wiki:audit 口径）。沿用现有图，只去掉图上的旧模型层数。
1. 一句话节：「藏进 28 层前向」改为「藏进模型各层的前向」；新增「放到 GLM 双机」段：本部署版本（2c59ff10、db701c1f）都带着开关、默认 False、启动未传 → 本部署没开；GLM 默认 T=1、top-p 0.95 会走到取用 q 的分支；开着 MTP 时 q 行数与补抽 token 的行数对不上（源码推断，写成待核）；PR 数字不当成本部署效果。
2. 事实表：删掉两行 Qwen3-0.6B 旧算例（18.55 MiB、593.5 KiB），换成「GLM 双机是否开启」和「假如打开 q 多大」两行。
3. 为什么存在：指数分布竞赛的原理压成一句 + 链接 sampling「真实实现怎样按概率抽」（sampling 已达标）；PR #4501 段补上 A2 数据（Qwen2.5-32B 约 +2.3%）和 Qwen3-30B 的具体降幅，删掉「MoE 副流本来就忙」这句无出处的解释（PR 没给原因）。
4. 开了的代价 2：Qwen3-0.6B 词表算例换成 GLM 词表并指向事实表；补一句开 MTP 时异步 q 与同步 q 不再一样大。
5. 开了的代价 1：上游用例代码块的引导语从「可复制的写法」改为「只用来说明两个条件；已删除，不要照抄」。
6. frontmatter：relations 里 npu-model-runner 的 note 去掉「28 层」；新增 builds-on sampling；updated 改为 2026-10-02。summary 未动。
7. 图 wiki/diagrams/enable-async-exponential.yaml：caption、开路径 note、两个框标题里的「28 层」改为不带层数的说法；pnpm wiki:diagrams 重新生成 svg（只更新这 1 张）。

**数字出处。** 词表 154880：docs/mainline/03-sample-decode.md §0 固定量表；R1 decode 步每请求 4 行、满载 decode 32 × 4 = 128 行：03 §A5「本部署下的具体数字和算式」。由此推出 q 每行 154880 × 4 B = 619,520 B、4 行 2,478,080 B ≈ 2.36 MiB、128 行 79,298,560 B ≈ 75.6 MiB，标 [D]，只作张量大小，不作收益。没有该开关的收益实测数，未写任何 GLM 效果数字。PR 性能数（A2 +2.28%、A3 +7% / +13.3%、Qwen3-30B 867.97 → 803.29 tok/s）取自 PR #4501 页面描述（本轮打开核对过），页面标 [I] 并写明是别的模型。

**核对的源码（钉住版本）。**
- 开关与默认：2c59ff10 与 db701c1f 的 ascend_config.py:256–262（默认 False，VLLM_BATCH_INVARIANT 为真时强制 False）；2ed6cbba、baa023ad 的 vllm_ascend/ 与 user_guide 文档里 0 处。
- 调用点：db701c1f model_runner_v1.py:2247–2252（b_s = logits_indices 行数，head_dim = 词表大小）；2c59ff10 对应 :2278–2283。
- 取用点：db701c1f sample/sampler.py:182–191（softmax 后 synchronize，再 probs.div_(self.q)）。
- MTP 行数疑点：db701c1f model_runner_v1.py:665 拒绝采样器包着同一个 sampler；rejection_sampler.py:185–187 补抽 token 只传 bonus 行（每请求 1 行），而 q 按 logits_indices（每请求 草稿数 + 1 行）建。未实跑，页面写成待核。
- GLM 默认采样参数与 MTP 4 行：sampling 页「请求不写采样参数时」「有 MTP 候选时」两节（已达标页）。
- record_stream：2ed6cbba sampler.py:43、baa023ad :44 有；2c59ff10 sampler.py 无。
- PR #4501 提交说明（5d02eed1）：默认关是因为「可能在 MoE 模型上表现不好（Qwen3-30B）」，未给原因。

**旧版信息清单勾选**（清单存 scratchpad p5/enable-async-exponential-facts.md，G1–G26）。
- G1：保留，「28 层」改为不带层数（旧模型的层数）。
- G2–G8、G10–G16、G18–G26：原样保留（G13 原理改为一句 + 链接 sampling，机制结论仍在）。
- G9（Qwen3-0.6B 的 18.55 MiB、593.5 KiB）：删除，旧算例已不是主线；「q 随行数 × 词表变、greedy 步不取用」两个结论保留在事实表新行里，大小换成 GLM 词表口径。
- G17：数字保留并补 A2 数据；「MoE 副流本来就忙」删除，原因是 PR 只说可能表现不好、没有给原因，属于无出处推测。
- G20 的 Qwen3-0.6B 词表算例：换成 GLM 词表；「同步路径 q 一样大」限定为不开 MTP 时。

**P1 疑点。** 无已确认的 P1。待核一条：GLM + MTP 下打开本开关时，q 行数（每请求 4 行）与补抽 token 的采样行数（每请求 1 行）在源码上对不上，可能在随机采样请求上报形状错误；本部署没开，不影响主线，但页面已写明待核。

**三检。** pnpm wiki:lint 通过（5 处待留意均为他页 mark-flood）；pnpm wiki:diagrams --check 288 张一致；pnpm wiki:audit 通过，本页来源 19 条有效。frontmatter 第 13 条来源（原 Qwen3-0.6B 词表出处 [S13]）在正文已不再引用，为避免后续 [S17] 等编号错位未删除。

**跳过。** 无。

## P5 审查（10-02）

审查员独立核对，只审不改页面。按参数页小修口径：四段式 + 两节自动生成保持不变，未按深入页骨架扣分。

**结论：9.0 / 10。P1 0 条，P2 1 条，P3 4 条。audit 本页通过（evidence=C，正文 9345 字 / 6 节，来源 19 条）；`pnpm wiki:lint` 通过（5 处待留意均为他页），`pnpm wiki:diagrams --check` 290 张一致。**

**数字。** 154880 与 docs/mainline/03-sample-decode.md §0 固定量表一致；4 行 / 128 行与 03 §A5「本部署下的具体数字和算式」L183、L187 一致。154880 × 4 = 619,520 B；× 4 = 2,478,080 B ≈ 2.36 MiB；× 128 = 79,298,560 B ≈ 75.6 MiB——手算全对，标 [D]，只作张量大小。没有该开关的 GLM 收益数，PR 数字标 [I] 并写明是别的模型——未把 GLM 主线数字当成该开关效果，未虚构收益。PR #4501 页面（本轮打开核对）：A2 Qwen2.5-32B 2113.7 → 2161.8 tok/s（+2.28%）；A3 Qwen2.5-32B +7%、Qwen3-32B +13.3%；Qwen3-30B 开 EP 867.97 → 803.29，不开 EP 1071.78 → 1063.40（−0.8%）。页面数字都对，表述见 P3-2。

**sampling 重讲检查。** 「为什么存在」第一段已压成一句 + 链到 sampling「真实实现怎样按概率抽」，没有重讲指数分布竞赛的推导——不记 P2。

**旧版信息清单。** 清单存在（旧会话 scratchpad p5/enable-async-exponential-facts.md，G1–G26）。抽 6 条到新版：G4（v0.26 静默忽略 / main forbid 起不来，L60）✓；G7（VLLM_BATCH_INVARIANT=1 静默置回 False，L72）✓；G10（Event.synchronize 阻塞 host，L76、L121）✓；G15（exponential_ 可能落 AI CPU，L87）✓；G21（与 enable_reduce_sample 同开纯亏、全 greedy 步白分配，L119）✓；G25（升级必须删键、vllm_omni 例外、FlashComm3 勘误，L127）✓。G9（Qwen3-0.6B 两个数）删除并换成 GLM 词表口径、G17「MoE 副流本来就忙」删除（PR 与提交 5d02eed1 都只说可能表现不好、没给原因）——理由成立，不算丢信息。

**源码抽核。** 2c59ff10 / db701c1f 的 ascend_config.py:256–262 都有开关、默认 False、与 VLLM_BATCH_INVARIANT 互斥 ✓；全 vllm_ascend/ 只有两处使用（model_runner_v1.py:2247、sampler.py:183），没有任何与投机解码互斥的保护。

### MTP 下 q 行数（写手待核项）——源码层面已核清

结论：**行数确实对不上，而且按 PyTorch 广播规则，这不是「效果待定」，而是 GLM + MTP 下打开本开关、遇到随机采样请求时，采样那一步会直接报形状错误。** 依据（全部在钉住的 db701c1f / vllm@0fc695fc 上）：
1. q 的行数：model_runner_v1.py:2247–2252 以 `logits_indices.shape[0]` 为行数建 q；有草稿时 :1306 取 `spec_decode_metadata.logits_indices`，:1518 按每条请求「草稿数 + 1」展开。本部署 decode 每请求 1 + 3 = 4 行（03 §0「uniform_decode_query_len = 4」、03 §A5 L183「1 × (3 + 1) = 4 行」、满载 32 × 4 = 128 行；concurrent-requests L92/L276 同口径）。混合批里没有草稿的请求各 1 行，所以准确说法是 q 行数 = Σ(各请求草稿数 + 1)。`lmhead_tensor_parallel_size=0`（03 §0 末段），:1320–1322 的补齐分支不走。
2. 采样时实际传进来的行数：有草稿时 :2589–2611 不调 self.sampler、改调 AscendRejectionSampler（:665 用同一个 sampler 构造）；rejection_sampler.py:186–197 只把 `logits[bonus_logits_indices]`（每请求 1 行）交给 sampler 补抽（03 §A6 L380–L385 同口径）。草稿 proposer 不经过 sampler（vllm_ascend/spec_decode 下无调用）。
3. 取用处：sampler.py:182–190 在随机分支直接 `probs.div_(self.q)`，没有按行切片；vllm@0fc695fc v1/sample/sampler.py:256–286 只有 all_greedy 才在 topk_topp_sampler 之前返回，混有随机请求的批都会走到这里。
4. 后果：probs 是 [请求数, 154880]，q 是 [Σ(草稿数+1), 154880]；原地 div_ 要求 q 能广播到 probs 的形状，两者第 0 维不等且 q 那一维不是 1，必然抛 RuntimeError。GLM 不写采样参数时 T = 1（sampling 页「请求不写采样参数时」），所以默认请求就会触发；prefill 那一步之后 MTP 已经草拟，下一个 decode 步就会撞上。
5. 仍缺的：没有在设备上实跑（只是按 PyTorch / torch_npu 的广播语义推出报错），上游提交历史里也没有针对「投机解码 + async exponential」的修复（`git log --grep exponential`：之后只有 #12306 整体删除）。所以「行数不一致」可标 [C]，「会报形状错误」标 [D]。

### P2
1. 「一句话 · 放到 GLM 双机」（L64）与「开了的代价」2 末句（L117）：写手按上面结论落实。改法：把「从源码看两边行数对不上 [D]。待核：能否正常运行、吞吐变化多少」改成——q 按 Σ(草稿数 + 1) 行建（本部署 decode 每请求 4 行），补抽时采样器只拿到每请求 1 行，取用处原地 `div_` 不做切片，所以带随机采样请求的 MTP decode 步会报形状错误（按源码推断、未实跑 [D]）；也就是在这套部署上它不是「快一点慢一点」的问题，而是开了可能就跑不起来。吞吐那半句可删（跑不起来就谈不上吞吐）。行数依据引 03 §A5 / §A6，不另算。

### P3
1. 「为什么存在」第二段（L85）把「exponential 不是 softmax 的 exp」又讲了一遍，与「一句话」L62 重复；保留一处即可（建议留 L85 带 [C3] 的那段，删 L62 或反之）。
2. 「为什么存在」PR 段（L95）：「不论开不开 expert parallel 都变慢（约 868 → 803 tok/s）」——868 → 803 只是开 EP 的数；不开 EP 是 1071.78 → 1063.40（约 −0.8%）。改法：括号里写成「开 EP 约 868 → 803，不开 EP 约 −0.8%」。另可补一句这些数都是 enforce-eager 下测的。
3. 事实表「假如在 GLM 双机上打开，q 多大」（L75）：没写这是每张卡各一份（8 张 TP 卡各自跑一遍同样的采样，03 §A5「采样在哪张卡上做」）。改法：「每张卡」三字。
4. frontmatter sources 里原 [S13]（旧 Qwen3-0.6B 词表出处）正文已不再引用；写手为免编号错位保留了，audit 不报。可在下次整理来源时一并清掉，不急。

### 截图
Playwright 1440 宽打开 http://localhost:5193/#/wiki/enable-async-exponential：首屏正常（四段式、GLM 双机段、事实表表头可见），图「开关只挪动一件事」正常渲染，图上已无「28 层」。截图存审查员 scratchpad：enable-async-exponential-review-1.png（首屏）、-review-2.png（图）。

### 跳过
「开了的代价」1 里的上游用例代码块（L105–L115）、「版本谱系」「参数定义（自动生成）」两节、sources 区未读（按纪律）。

## P5 修订记录（10-02）

正文 9,345 → 9,577 字（wiki:audit 口径）。按「P5 审查（10-02）」逐条处理：

**P2（清）。** 「一句话 · 放到 GLM 双机」那段的待核改写为：行数对不上标 [C3] [C5]（取用处 sampler.py#L182-L191 整块原地相除不切片、调用点 model_runner_v1.py#L2278-L2283 以分数行总数建 q；两处 2c59ff10 与 db701c1f 同码），q 行数 = 各请求（候选数 + 1）之和、本部署 decode 每请求 4 行引 03 §A5，补抽只交 1 行引 03 §A6，不另算；「会报形状错误」标 [D] 并写明按 PyTorch 广播规则推断、未在设备上实跑、上游之后只有整体删除（按审查员 git log 核对结论）；删掉「吞吐变化多少」半句，改为「开了可能就跑不起来」。「开了的代价」2 末句同步改为「按源码推断会报错（未实跑）」。

**P3。**
1. 清：删掉「一句话」里重复的「exponential 不是 softmax 的 exp」一段，保留「为什么存在」里带 [C3] 的那段。
2. 清：PR 段括号改为「开 EP 约 868 → 803 tok/s，不开 EP 约 −0.8%」；补「PR 写的测试配置是 TP4、enforce-eager」（本轮再次打开 PR #4501 核对：A2/A3 两段配置都写 tp4dp1 enforce-eager；Qwen3-30B 不开 EP 1071.78 → 1063.40）。
3. 清：事实表 q 大小一行补「每张卡各一份（8 张 TP 卡各自跑同样的采样）」，依据 sampling 页「8 张卡各采一遍，只交回一份」。
4. 暂缓：原 [S13] 来源未删。正文角标按 sources 顺序编号，删掉第 13 条会让后面的 [S17] 等错位，需要连同正文角标一起重排；审查员标「不急」，留到整理来源时处理。

**三检。** pnpm wiki:lint 退出码 0（中途一次 mark-unnumbered：新写的 [C] 未带编号，已改为 [C3] [C5]）；pnpm wiki:diagrams --check 退出码 0；pnpm wiki:audit 退出码 0，本页来源 19 条。

- **收尾清扫（2026-10-02）暂缓第 4 条已改。** 核实原第 13 条来源（Qwen3-0.6B 词表页）正文无任何 [X13] 角标引用，已删去该行；其后正文角标顺移一位（[C14]→[C13]、[C15]→[C14]、[C16]→[C15]、[S17]→[S16]、[C18]→[C17]、[C19]→[C18]），角标种类与次数前后一致。来源 19→18 条。`pnpm wiki:lint`、`pnpm wiki:audit` 均退出 0。（派活时此条记在 combine-quant-mode 名下，实为本页。）
