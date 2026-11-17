# 045 figure 增强与图来源独立登记：独立复审

结论：**Approved，0 P1 / 0 P2**。本结论只覆盖 894 / 897 的 figure 工程子批；原生 SVG、人工注册 React 2D、P3 阅读交互、044 工程与四类端到端验收仍待完成，045 保持 doing。

接受来源：`0001794839137096-000894-816b4db3`；作者交付：`0001794841073118-000897-0d4a1644`。Task：`0001794686458967-000045-b7a20aea`。检视者：砚砚 / gpt-6-astra。HEAD：`f44c953f99e416b2dc174c3b2ad31a729b91d30f`；工作树未提交，审定字节以下表为准。

## 审定文件

| 文件 | SHA-256 |
| --- | --- |
| `scripts/wiki/scene.ts` | `179c051463dd31b38a9119f9d3fcaaa3276b9c13550b51eb63cde7918890e219` |
| `scripts/wiki/figure.ts` | `45da395bc8eeca4d319070eff9a67f860f28c155b714158a2b0c5463fa83ba64` |
| `scripts/wiki/diagram-audit.ts` | `275604fc060a940a0528ab79d8b284ec9a137bfd6bd4c11b20efd5b5bab90faf` |
| `scripts/wiki/figure.test.ts` | `45b713f25c6fb7d0c74cb3d874dad6a19c8d051478e731d462227a043db7eb64` |
| `scripts/wiki/diagram-audit.test.ts` | `26ee1e56802b59c76035bce749ce80c74575fb8a5684f57d2d2602c06c882dd2` |

全部验证后再次读取，上述五份文件仍与作者 897 一致。Git diff 中夹有此前已审变更，未把整份工作树差异当成本轮新改动。

## 实现检视

- `figure.ts:553` 的 `bend` 与旧 `curve` / 非空 `via` 明确互斥；`resolveLinkGeometry` 统一产生实际 SVG 路径及边界采样。正负弯曲遵循方向法向，0 与原直线路径一致，零长连线有可见错误且不生成 NaN。旧 curve / via 保留。
- `scene.ts:92` 的等宽估宽被文本、物体标签、自由画板文本及自动换行共同使用；字体沿既有 SVG 正向属性值规则进入浏览器。只移除段数、长句、代码名三类提醒，保留自由画板复杂度/跨图复用建议和几何硬门禁。
- `diagram-audit.ts:58` 只移除 pin 必须在页级 sources 重复登记的限制；固定提交 blob 不可读与虚构符号仍报错。其既有 AC11 是文件内符号检查，并非摘录范围检查；证据包的行范围校验仍由已审数据底座承担，不把测试名称中的“out-of-range”当作新增行范围门禁的证据。
- 路径坐标沿用 0.1px 舍入；任意方向的 bend 中点偏移因此允许亚像素误差。本次 32px 竖向与斜向样本分别测得 32.025px、32.032px，不声称所有输入浮点值均严格精确等于 bend。

## Reviewer 实跑证据

临时文件均位于 `%TEMP%/infra-wiki-review-20261115/`，没有执行覆盖正式图资产的命令。

1. `node node_modules/vitest/vitest.mjs run scripts/wiki/figure.test.ts scripts/wiki/diagram-audit.test.ts scripts/wiki/diagrams.test.ts scripts/wiki/diagram-cli.test.ts scripts/wiki/diagram-sanitize.test.ts scripts/wiki/drop-assets.test.ts scripts/wiki/lint.test.ts scripts/wiki/audit.test.ts src/content/wiki/WikiDiagram.test.ts --reporter=dot`：**9 files / 138 tests passed，exit 0**。日志 `897-root-tests.log`。作者先红记录见 897，本审阅不将其计入 root 独立执行次数。
2. `tsc -b --noEmit`、五文件 `biome check`、`node --import tsx scripts/check-deps.ts`：**全部 exit 0**，Biome 零提示。日志 `897-root-tsc.log`、`897-root-biome.log`、`897-root-deps.log`。
3. `894-legacy-diagram-bytes.mts 897-legacy-diagram-after.json`：**351 张正式图，0 parse problems / 0 stale SVG**。再与实现前 `894-legacy-diagram-before.json` 的全部 entries 比对，id、layout、YAML SHA、SVG SHA 与渲染 SHA 数组完全一致。
4. `897-root-figure-build.mts`：构建独立 `897-figure-fixture-nUlWx0/dist`，**真实 Vite 构建 exit 0**。正文只登记外部参考，图 pin 单独引用受控 Git 仓固定提交的 `fixture.py#L2-L4`；实际 AC11 合法 pin 返回 `[]`，虚构符号返回 `diagram-symbol`。新样本 `figureProblems=[]`；水平/竖向/斜向中点法向偏移符合约定，所有采样有限。结果 `897-root-figure-build.json`，日志 `897-root-build.log`。
5. `897-root-figure-browser.mjs`：**Chromium 14/14 检查通过，pageErrors=[]**。使用 `/nested/`、1440×900、API 全中止和随机临时端口。报告 `897-root-figure-browser/report.json`；两张截图已实际查看。

| 浏览器检查 | 实际结果 |
| --- | --- |
| 水平 bend -48 / 0 / +48 | SVG BBox 高度 48 / 0 / 48；双向 marker 存在，箭头沿切向 |
| 竖向 +32、斜向 -32 | 竖向中点 x=487.975；斜向中点约 (782.650, 107.350)，方向正确 |
| texts / items / sketches mono | 三处均实际使用 JetBrains Mono；表达式约 302.4px，与估宽一致；120px 换行约束满足 |
| 独立图来源 | 首开零证据下载；点击后仅一份包，精确显示 line_2 及第 2、3、4 行 |
| 存量代表 | scene `enable-async-exponential` 与 curve figure `attention-intuition` 均正常渲染 |

浏览器与临时 HTTP 服务在 finally 关闭；本轮命令句柄均已正常退出。隔离产物保留用于复查。测试构建包含既有应用模块，不代表修改或重新验收 3D；正式 wiki、3D/仿真、210 原缓存、旧 888 Review 与现有服务均未修改，付费模型调用为 0。

## 后续

按唯一方案进入原生 `.svg` + `mode: native-svg` 伴生 YAML：共同图 schema、加载/审计/证据、CLI 不覆盖人工 SVG、三种 Drop 资源输入与整组 Review 必须接通。实际待实现基线见 `868-2d-engineering-baseline.md` 与 `894-native-pipeline-baseline.json`。之后再完成静态白名单 React 2D 等剩余工程；不用逐篇教学重写阻塞框架。

Open Questions：无。
