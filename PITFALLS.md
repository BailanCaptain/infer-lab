# 踩过的坑（工程备忘，不是交接文档）

从 HANDOFF.md 挪出来的清单；新坑往这里加一条，HANDOFF 保持一屏。

- 权重形状约定 `[in, out]`（`y = x·W`），与 HF checkpoint 的 `[out, in]` 相反，写文案时要说明。
- `sim/` 层禁止 import three / react / zustand；`timeline/` 禁止 import three。违反会被 `pnpm check:deps` 与 Biome 拦下。
- Tailwind v4 用 `@theme`（`src/design/tokens.css`），Biome 需 `css.parser.tailwindDirectives: true`（已配）。
- 大批量写文件不要用 bash heredoc 串联（历史上失败过），逐个文件写。
- 高亮 `Highlight.rows/cols` 在带 `head` 的三维张量上指头内二维（`[n_q,S,S_k]` 的 rows 是 S），validate 已按 dims 里的 `n_q`/`n_kv` 识别头维；新张量的头维必须用这两个名字。
- RMSNorm 后 RMS 不是恰好 1：词嵌入数值小（σ=0.02）时 ε=1e-6 占 mean(x²) 的 0.25%，RMS≈0.99875。写文案和断言都要按 `sqrt(ms/(ms+ε))`。
- 因果 mask 的 −1e30 存进 Float32 是 `Math.fround(-1e30)`，断言别用字面量。
- `ropeInplace` / `causalMaskInplace` 原地修改，`splitHeads` / `mergeHeads` 是共享 data 的视图：录制前要 `clone`，否则前一步的张量会被改掉。
- `tsconfig.*.tsbuildinfo` 被 git 跟踪，每次 tsc 都会改动；提交时不要顺手带上（建议用户决定是否 `git rm --cached` + 加 .gitignore）。
- `src/sim/model/presets.tokens.json` 是生成文件：改句子只改 `scripts/gen-preset-tokens.ts` 的 `SENTENCES`，然后 `pnpm gen:presets --write`；改完要同步 `presets.test.ts` 的 golden id，并用 transformers.js 复核（暂存目录 `npm i @huggingface/transformers@3`，不进项目依赖）。`tools/tokenizer/*.json` 已 gitignore，勿提交 11 MB 词表。
- Tailwind v4 冲突类按样式表顺序而非 class 顺序取胜：`bg-surface-elevated` 会盖掉后写的 `bg-accent`。基础类不要带背景色，按钮变体各自加（见 `SpikeCPage` 的 `btnBase/btn/btnPrimary`）。
- 不要用 react-router 的 `useSearchParams` 写播放 URL：每次写都让整页重渲染。用 `timeline/url.ts` 的 `replaceHashQuery`。
- R3F 9 + three 0.185 在控制台打 `THREE.Clock: This module has been deprecated` 警告，来自 R3F 内部，不是本项目代码，忽略即可。
- **`L0.attn.masked` 的 `absMax` 是 1e30**（因果 mask 的 −1e30 参与了统计）。着色若直接用 `|v| / absMax`，除被掩码格外整张图全是 0 色。TensorGrid 要么按分位数定标，要么把 ≤ −1e29 的哨兵值单独渲染成「已掩码」样式，不要参与色阶。`ids` 的 `absMax` 是 113272（token id 数值），也不能当作数值场着色。
- 预设句里选的词都是词表内完整 UTF-8 片段的 token；若新句子有字被拆成半个 UTF-8 字节序列，脚本会直接报错，换一句而不是存乱码。
- **troika `sdfGlyphSize` 必须是 2 的幂**（64/128）。填 96 时所有字形渲染成实心方块，数值断言全过、只有截图能看出来——UI 验收必须看图。
- Playwright 每次运行会清空 `test-results/`，跑第二个 spec 会删掉第一个的截图；要看图就把两个 spec 一起跑或先复制走。`playwright.config.ts` 已设 `workers: 1`：两个浏览器同时跑时 8B Worker 构建从 2.2 s 变成 6.1 s，帧数断言也会被拖垮。
- `pnpm gen:font` 现在只扫 ts/tsx 的**字符串**（注释已剥掉），子集 270 KB / 820 字；仍然包含 `forwardLayer.ts` 的 brief/detail 叙述文案（这些走 DOM，不进 3D）。要再瘦身需要把 3D 标签用字与 DOM 文案分开标注，属于后续内容管线的事。
- 3D 标签的文案只能来自 `primitives/layout.ts` 的 `gridTexts`；布局用它估文本宽度，TensorGrid 用它渲染。绕过它直接在 TensorGrid 里写标签，包围盒就不知道文字多宽，标题会互相撞（已经撞过一次）。
- `labelScale` 由 `resolveScene` 决定，TensorGrid/gridLayout 只接收；不要在图元里自己按距离放大字。
- `TensorGrid` 的 `window`/`box` prop 传字面量对象会让 `CellWindow` 每次父组件渲染都重写实例缓冲；页面里要 `useMemo`。换步不要给 TensorGrid 换 `key`（会把 5120 容量的 InstancedMesh 整个重建，耗时数字就不真实了）。
- 全幅平面上的高亮列带按「格数 × 0.004、至少半格」加宽（1024 列时约 4 格宽），否则一列宽只有半个像素；放大窗口里的高亮是逐格真值。文案里目前没写这条加宽，做章节页时若要严谨可加。
