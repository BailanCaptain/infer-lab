# 踩过的坑（工程备忘，不是交接文档）

从 HANDOFF.md 挪出来的清单；新坑往这里加一条，HANDOFF 保持一屏。

- 权重形状约定 `[in, out]`（`y = x·W`），与 HF checkpoint 的 `[out, in]` 相反，写文案时要说明。
- `sim/` 层禁止 import react / zustand / 任何渲染库；`timeline/` 禁止 import 渲染库。违反会被 `pnpm check:deps` 与 Biome 拦下。
- Tailwind v4 用 `@theme`（`src/design/tokens.css`），Biome 需 `css.parser.tailwindDirectives: true`（已配）。
- 大批量写文件不要用 bash heredoc；含 U+2212（−）等字符的 heredoc 在 Git Bash 里会被截断。改动多时写成脚本文件再执行。
- 高亮 `Highlight.rows/cols` 在带 `head` 的三维张量上指头内二维（`[n_q,S,S_k]` 的 rows 是 S），validate 已按 dims 里的 `n_q`/`n_kv` 识别头维；新张量的头维必须用这两个名字。
- RMSNorm 后 RMS 不是恰好 1：词嵌入数值小（σ=0.02）时 ε=1e-6 占 mean(x²) 的 0.25%，RMS≈0.99875。写文案和断言都要按 `sqrt(ms/(ms+ε))`。
- 因果 mask 的 −1e30 存进 Float32 是 `Math.fround(-1e30)`，断言别用字面量。
- `ropeInplace` / `causalMaskInplace` 原地修改，`splitHeads` / `mergeHeads` 是共享 data 的视图：录制前要 `clone`，否则前一步的张量会被改掉。
- `tsconfig.*.tsbuildinfo` 被 git 跟踪，每次 tsc 都会改动；提交时不要顺手带上（建议用户决定是否 `git rm --cached` + 加 .gitignore）。
- `src/sim/model/presets.tokens.json` 是生成文件：改句子只改 `scripts/gen-preset-tokens.ts` 的 `SENTENCES`，然后 `pnpm gen:presets --write`；改完要同步 `presets.test.ts` 的 golden id。`tools/tokenizer/*.json` 已 gitignore，勿提交 11 MB 词表。
- `pnpm gen:trace` 用 transformers.js 跑真实 Qwen3-0.6B（ONNX q8，缓存 `tools/hf-cache/` 598 MB，已 gitignore）；Node 要加 `NODE_USE_ENV_PROXY=1` 才走系统代理，否则 fetch huggingface.co 超时。
- Tailwind v4 冲突类按样式表顺序而非 class 顺序取胜：`bg-surface-elevated` 会盖掉后写的 `bg-accent`。基础类不要带背景色，按钮变体各自加（见 `PlaybackBar` 的 `btnGhost/btnPrimary`）。
- 不要用 react-router 的 `useSearchParams` 写播放 URL：每次写都让整页重渲染。用 `timeline/url.ts` 的 `replaceHashQuery`。
- **`L0.attn.masked` 的 `absMax` 是 1e30**（因果 mask 的 −1e30 参与了统计）。任何按 `|v| / absMax` 着色的显示都会整张图变 0 色，要按分位数定标并把 ≤ −1e29 的哨兵单独当「已掩码」。`ids` 的 `absMax` 是 113272（token id 数值），也不能当数值场。
- 预设句里选的词都是词表内完整 UTF-8 片段的 token；若新句子有字被拆成半个 UTF-8 字节序列，脚本会直接报错，换一句而不是存乱码。
- Playwright 每次运行会清空 `test-results/`；`playwright.config.ts` 已设 `workers: 1`：两个浏览器同时跑时 8B Worker 构建从 2.2 s 变成 6.1 s，计时断言会被拖垮。
- UI 验收必须看截图：曾有字体渲染成实心方块而所有数值断言全过的情况。
