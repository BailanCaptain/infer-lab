# 983 原生图整合预算边界独立终验

2026-11-16 18:24 UTC，砚砚 / gpt-6-astra。结论：**Approved，0 P1 / 0 P2**。关闭 `960-native-drop-budget-rereview.md` 的代理对二分不收敛问题，承接 `953` 已核的原生图规则与共享资产修复，以及 `955-native-drop-browser-review.md` 的浏览器闭环。此结论仅覆盖该工程子批，不代表 Task 045 或第一阶段全部完成。

## 实现与锁定字节

已实际回读 `scripts/wiki/drop-integration.ts:851` 的码点边界扫描、尾部检测、整数下标二分与换行回贴。搜索坐标独立于 UTF-16 字符端点，每轮严格缩小区间；返回的切片端点均来自完整码点边界。最小范围不可容纳时有限返回原块，由已有正式预算检查给出失败，不添加重试/超时兜底。默认块已可容纳时仍保持原调用字节路径。

| 文件 | SHA-256 |
| --- | --- |
| `scripts/wiki/drop-integration.ts` | `99ea3c5619128e13be672fbfd2582d81924dbcbee1905db974f79c03d82b0db9` |
| `scripts/wiki/drop-native-shared-review.test.ts` | `6d4b987ce6a4e2e1b22fb32468d2a23698cc4043d730942e84712977b13cc6b7` |
| `scripts/wiki/drop-assets.ts` | `7985fb02c1a85956047194606ab2245e8b27209a93854db0f51f1c6c126d9c85` |
| `scripts/wiki/drop-receipt.ts` | `a18012a694b0f13f0b3c0d60b879270960de8596c81006b7c28600ca7f03a941` |
| `scripts/wiki/drop-assets.test.ts` | `f7bc599718d65cd34d4b9b3af15980545802420e783d2f537f58e0a46560da87` |
| `scripts/wiki/drop-native-svg.test.ts` | `7339ee5fe0755a69e9488529e0917d43705baf9f8598126744220f16b0e448f1` |

## root 本轮实际证据

产物均在 `%TEMP%/infra-wiki-review-20261115/`，保留原失败证据不覆盖。

1. 原 `960-chunk-boundary-probe.mts` 在当前生产字节实跑，`963-root-chunk-boundary-green.json` 共 222 组 emoji / JSON 转义 / ASCII × 剩余预算 17–90 B，零循环错误；86 组可容纳情况均满足实际输入预算与连续覆盖，其余为有限返回的预算不足情况，未将它们误计为成功录入。该探针从当前源码 AST 提取原方法，使用真实 DropContext；观察器仅截断重复状态，不改搜索判定。
2. `955-budget-boundary-probe.mts` 在相同生产字节分别跑普通长文与转义/代理对长文：`978-root-budget-final-green.json`、`978-root-budget-final-escaped-green.json` 均到达 `review`，`fullCoverage / unicodeBoundaries / allInputsFit` 均为 true，260 处原事实完整保留。保留原 128K 窗口、完整手册/规则与必需证据。此为确定性代理的预算协议检查，沿用原夹具的 validate 替身，不冒充真实模型语义或正式发布验收。
3. 最终字节上运行 `vitest run scripts/wiki/drop-native-shared-review.test.ts scripts/wiki/drop-context.test.ts --reporter=dot`：**2 files / 11 tests passed，exit 0，16.97s**。包含三路原生图契约、共享 YAML/SVG 复核、原 128K 长文、三组 Unicode 多分片连续覆盖与真正不可容纳时在整合入口的预算失败。`983-root-regression-hashes.json` 核对上述 6 文件运行前后完全一致。
4. `tsc -b --noEmit` 与 6 文件只读 `biome check` 均 exit 0，分别保存 `983-root-typecheck.log`、`983-root-biome.log`。Vitest 打印已有 Vite 配置扩展名提示；未改冻结的 3D/仿真文件来压制该提示。
5. 先前 `960-native-cache-replay.json` 的 210 次封存缓存精确回放与原目录零变更结论仍适用；本次仅改窄预算搜索分支。955 浏览器验收保留，未重跑未变化 UI；实际核对 WikiDiagram、DiagramPlayer、WikiPage、WikiScene 仍与 `963-react2d-acceptance-baseline.md` 的摘要一致。

中间新增测试曾因配置低于合法下限、前置复核先超量或负例实际上可容纳而失败；最终夹具使用真实手册和合法窗口，未删除原正文或放松通过断言，现已复验为绿。原红灯日志完整保留。

## 下一棒与终点

Task 045 保持 doing，下一短批为人工静态白名单 React 2D，使用 `963-react2d-acceptance-baseline.md` 与墨墨 967 布局草图；其后仍有阅读交互、044 工程及四类样本全流程验收。遵循用户 `000969`：第一阶段由砚砚最终独立签署、发布验收记录与后续清单后结束本轮目标并停止派工；24/163 篇第二阶段内容与独立新产品不派、不启动。
