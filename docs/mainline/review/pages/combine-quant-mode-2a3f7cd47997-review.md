# combine-quant-mode-2a3f7cd47997 审查记录

## P5 写作记录（2026-10-02，第 26 批小修）

**改了什么。** 保留参数页四段式（一句话 / 事实表 / 为什么存在 / 开了的代价）和两节自动生成内容，只改四处；正文 5,482 → 6,254 字（wiki:audit 口径）。无图，按「沿用现有图」不新增。
1. 一句话节：删掉旧算例（Qwen3-0.6B）那一段，换成「放到 GLM 双机」：本部署版本（v0.23 维护分支 2c59ff10、GLM 代码 db701c1f）都没有这个键，启动命令也不传 additional config；combine 由推断得 0、BF16 送回，dispatch 由 W8A8 推成 int8；所以「发 int8、收 BF16」在主线上本来就成立，这个键只是 main 上的旋钮。设 2/4 后的算子支持、字节和精度写成「待核」，没有给任何效果数字。
2. 为什么存在：删掉「两侧误差容忍度不同」「所以叫 combine_quant_mode」两句无出处的推测，改为源码可证的两侧默认推断不对称 + PR #15441 说明里写的目的；上游为何不默认量化 combine 不下结论（与 quantization 页口径一致）。
3. 为什么存在：「推断前提在调优、验新算子、不匹配时不成立」收紧为 PR 写明的「不改权重量化、单独换 combine 精度」。
4. 开了的代价：纠正单测描述（见下 P1 疑点）；补一句 PR 说明与合入代码在两处相反（字符串宽松转换、优先级），以代码为准。
5. frontmatter `updated` 改为 2026-10-02；summary 未动（仍 ≤200 字）。

**数字出处。** 每个（token, 专家）副本 combine 至多 8,192 B（BF16）、dispatch 4,100 B（int8 + FP32 系数）：docs/mainline/02-forward.md §6.5 字节表；§6.6 只用来确认 W8A8 专家计算路径，未引数字。页面里链到 expert-parallel「4. combine、拼回 token、加共享输出」和 quantization「为什么 EP dispatch 搬的是 int8」，不重算、不推导量化 combine 后能省多少。

**核对的源码（钉住版本）。**
- 存在范围：`git grep combine_quant_mode` 在 db701c1f、2c59ff10、2ed6cbba 的 vllm_ascend/ 与 docs/ 均无；baa023ad 有（ascend_config.py:474 字段、token_dispatcher.py:276–287、docs additional_config.md:83）。
- combine 推断（baa023ad token_dispatcher.py:279–287）：本键非 0 → 显式 comm_quant_mode → W8A8MXFP 用 4 → 0。GLM 代码 db701c1f 同函数（:279–284）无本键，W8A8 落到 0。
- dispatch 推断（baa023ad :168–173）：显式 → dispatch_with_quant（moe_quant.py:72–78 含 W8A8）→ 2 或 MXFP 的 4 → 0。
- 单测（baa023ad）：tests/ut/test_ascend_config.py:1628–1663 锁了默认 0、接受 0/2/4、拒 "4"、拒 "true"；tests/ut/ops/test_token_dispatcher.py:422 起锁了本键优先于显式 comm_quant_mode。
- fused MC2 不读本键：moe_comm_method.py FusedMC2CommImpl 自己的 fused_experts（:473）走 _apply_cann_mega_moe（:492）或 dispatch_ffn_combine（:501），不调 token_combine（全文件仅 :156 一处，在基类）。
- main 严格校验：ascend_config.py:455 extra="forbid"；:1662–1667 装了 vllm_omni 时未知键降为 warning。
- 提交 203ae3eb（2026-09-07）提交说明：目的、优先级（写的是显式 comm_quant_mode 优先）、字符串 "4" 宽松转换——后两条与合入代码/单测相反。

**旧版信息清单勾选**（清单存 scratchpad p5/combine-quant-mode-2a3f7cd47997-facts.md，F1–F24）。
- F1–F4、F6–F18、F20、F21、F23、F24：原样保留。
- F5（Qwen3-0.6B 用不到）：删除，旧算例已不是主线；「要走到这里得有 MoE + EP」的意思并入新的「放到 GLM 双机」段，并换成本部署的真实情况。
- F19（只给 combine 的理由、命名理由）：删除推测部分，原因是无出处且与 quantization 页「源码未写理由、不下结论」冲突；保留可证的不对称现状。
- F22（「1 与 "4" 各有单测」）：改正，见 P1 疑点。

**P1 疑点（已在本页处理）。** 旧版称上游为「1」和「"4"」各写了一个单测；实际钉住 main 的两个拒收单测是 "4" 和 "true"，「1」只靠 Literal 白名单挡住、没有专门单测。已改正。

**三检。** pnpm wiki:lint 通过（5 处待留意均为他页 mark-flood）；pnpm wiki:diagrams --check 287 张一致（本页无图）；pnpm wiki:audit 通过，本页来源 18 条均有效。参数页不在写作标准名单内，audit 只统计不报错。

**跳过。** 无。

## P5 审查（10-02）

审查员独立核对，只审不改页面。按参数页小修口径：四段式（一句话 / 事实表 / 为什么存在 / 开了的代价）+ 两节自动生成保持不变，未按深入页骨架扣分。

**结论：9.5 / 10。P1 0 条，P2 0 条，P3 2 条。audit 本页通过（evidence=C，正文 6254 字 / 6 节，来源 18 条；全库无效 commit / 文件不存在 / 行号越界均为 0）。**

**单测说法（本轮重点）——写手改正属实。** 在 vllm-ascend@baa023ad 上 `git grep combine_quant_mode -- tests` 共两处测试文件：
- tests/ut/test_ascend_config.py：:1628 默认 0；:1634–1643 接受白名单整数，循环值是 (0, 2, 4)（3 也没进循环）；:1647 拒 "4"；:1657 拒 "true"。全仓 tests 下没有任何给 1 的用例，「1 只靠 Literal 白名单挡住、没有专门单测」成立。
- tests/ut/ops/test_token_dispatcher.py：:347 非 0 强制、:386 为 0 时非 MXFP 落 0、:422 本键优先于显式 comm_quant_mode——事实表「优先级」行「上游单测专门锁了这条」成立。
- 提交 203ae3eb（2026-09-07，PR #15441）说明里写的是「显式 comm_quant_mode 仍然优先」「"4" 宽松转成 4」，与合入代码 token_dispatcher.py:279–287（本键非 0 → 显式 → W8A8MXFP 用 4 → 0）和上面两个单测相反；页面「以代码为准」的处理正确。

**源码抽核（钉住版本）。** baa023ad：ascend_config.py:474 字段 `Literal[0, 2, 3, 4] = 0`、:455 `extra="forbid"`；moe_comm_method.py 中 token_combine 只在基类 :156 调用，FusedMC2CommImpl 的 fused_experts（:473）走 :492 `_apply_cann_mega_moe` 或 :501 `dispatch_ffn_combine`——「fused MC2 读不到本键」成立。db701c1f（GLM 代码）token_dispatcher.py :279–284 combine 推断无本键，W8A8 非 MXFP 落 0；dispatch :166–170 走 dispatch_with_quant → A2 上为 2——「发 int8、收 BF16」成立。

**GLM 双机段数字。** 8,192 B / 4,100 B 与 docs/mainline/02-forward.md §6.5 字节表（L691–L692）一致，且都标为「至多」（底稿口径是上界）；「启动命令没有 additional config」与 02 L318、03 L26 一致。段内没有给出设 2/4 后的任何收益数字，明确写「待核、在册资料无实测」——未把 GLM 主线数字当成该开关效果，未虚构收益。

**旧版信息清单。** 清单存在（旧会话 scratchpad p5/combine-quant-mode-2a3f7cd47997-facts.md，F1–F24）。抽 6 条到新版：F2（只动 combine，L77）✓；F4（旧分支静默、main forbid、vLLM-Omni 降 warning，L79）✓；F7（白名单 + 填 1 被挡，L89）✓；F11（只有 MC2CommImpl，L94）✓；F21（官方表描述抄自上一行、照它理解会弄反，L122）✓；F23（只往旧分支搬会静默无效，L126）✓。F5 删除（旧 Qwen3-0.6B 算例，已换成 GLM 双机段）、F19 删除（无出处的推测，与 quantization 页「源码未写理由、不下结论」对齐）——两处删除理由成立，不算丢信息。`git diff` 删掉的 5 行均在上述范围内。

**链接。** expert-parallel 的 `### 4. combine、拼回 token、加共享输出`（L297）与 quantization 的 `### 为什么 EP dispatch 搬的是 int8`（L219）都在；全库入链 wiki/index.md、warnings/patrol-2026-09-25.md，未受影响。

### P3
1. 「开了的代价」第三段（L124）：说 `Literal[0, 2, 3, 4]` 是「编译期白名单」不准确——它是类型注解，由 pydantic 在构造配置时（启动期）校验，事实表 L89 也写的是「启动期被挡回来」。改法：「编译期」改为「启动期由 pydantic 校验的白名单」。
2. 「放到 GLM 双机」段（L81）：「combine 推出 0、按 BF16 送回」只在走 MC2 时成立；02 §6.8 说 token 数 > 128 走 ALLGATHER 路径，那条路不经过 MC2 combine。改法：在该句前加「走 MC2 那条路时」，或一句话链到 expert-parallel / 02 §6.4 的路径判断。

### 环境与跳过
- 浏览器实测未能完成：Playwright 打开 http://localhost:5193/#/wiki/combine-quant-mode-2a3f7cd47997（1440 宽）只得到 Vite 报错浮层「知识库页面不合法，暂不接受新问答」。原因是同批另一页 concepts/request-teardown.md 的 frontmatter 解析失败（`pnpm wiki:lint` 唯一的 x：L78 col 70 缺逗号），整库快照读取被拦，与本页无关。本页无图，按「沿用现有图」不要求新截图；待 request-teardown 修好后补看一次首屏。
- 「版本谱系」「参数定义（自动生成）」两节与 sources 区未读（按纪律）。
- 补记（同日稍后）：request-teardown 修好后 `pnpm wiki:lint` 已通过，重新用 Playwright 1440 宽打开本页，首屏正常（一句话、存在范围、放到 GLM 双机三段与事实表表头可见，两条站内链接正常显示）。截图存审查员 scratchpad：combine-quant-mode-2a3f7cd47997-review-1.png。上面「浏览器实测未能完成」一条以此为准。

## P5 修订记录（10-02）

正文 6,254 → 6,400 字（wiki:audit 口径）。审查无 P1/P2，两条 P3 均处理：
1. 清：「开了的代价」第三段「编译期白名单」改为「启动期由 pydantic 校验的白名单」，与事实表「启动期被挡回来」一致。
2. 清：「放到 GLM 双机」段在「combine 推出 0、按 BF16 送回」之前加限定「走 MC2 那条路时」，并说明 token 多到改走 AllGather 时不经过这一步，链到 expert-parallel「MC2 还是 AllGather」（依据 02 §6.4、§6.8；本键只在 MC2 dispatcher 的 combine 参数里读取）。

**三检。** pnpm wiki:lint、pnpm wiki:diagrams --check、pnpm wiki:audit 退出码均为 0；本页来源 18 条。
