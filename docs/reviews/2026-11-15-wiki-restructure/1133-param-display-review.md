# 1133 参数展示与来源编号独立检视

砚砚 / gpt-6-astra，2026-11-17 02:00 UTC；原 Task 044。对应作者交付 `0001794880462184-001133-df4a74bb`，基于在盘代码、独立测试与真实 Chromium 操作。

**结论：Changes Requested（0 P1 / 2 P2：新增测试运行数据隔离、检索别名改变既有整合缓存输入）。** 界面功能验收通过，来源列表编号 P2 已独立闭合；另有一项单一真相源契约需收口。完成下面各项后再签收此子批；不是阶段一终验。

## 必须收口：参数身份与受保护小节解析仍有两份实现

`src/content/wiki/param-display.ts:61` 的 `parsePinnedParamIdentity`、类型和内部身份解析函数复制自 `scripts/wiki/params/pages.ts:61`；`param-display.ts:27` 的 `sliceHeadingSection` 又复制 `scripts/wiki/lineage.ts:12` 的 `generatedSection`。当前 33 篇样本上的输出确实相同，但“复制实现 + 等价测试”并未满足项目 P4 同一规则只定义一次的要求。

将这些零 Node 依赖的纯函数放在一个合规的共用入口，原 Node 入口改为 import/re-export，展示派生直接调用同一实现。保留原导出契约、受保护小节和固定源码身份语义。允许为此最小调整已审 Node 调用文件；不修改正式文章，也不趁此扩成全仓解析器重构。缓存实现指纹应覆盖实际新公共文件。此项已提前在 `1132` 消息说明。

## P2：新增快照测试直接使用实际工作区运行数据

`server/param-display-snapshot.test.ts:22` 将 ROOT 设为 `process.cwd()`，并在第 71–72 行调用 `readReaderSnapshot(ROOT)` / `readKnowledgeSnapshot(ROOT)`。这并非纯只读：`server/snapshot.ts:160` → `persistSnapshot` 会在实际根目录 `tools/wiki-runtime/reader-snapshot.bin` 原子写入派生缓存，同时使用实际 WorkflowStore 发布锁/Review 状态。这使新测试与现有运行站点共享运行数据，违反隔离开发/测试数据的约定，也会受实际发布状态干扰。

保留对 33 篇正式页及四个 oracle 的只读哈希校验；将需要 WorkflowStore/快照生产的测试复制到临时根目录后运行，并在 finally 释放该临时目录。不要删除、回滚或“恢复”实际运行缓存。独立浏览器探针已经采用隔离副本；本项仅要求新测试遵循相同边界。未发现正式文章、旧 Review 或封存模型缓存被本测试改写，不扩大陈述影响。

## 独立验证证据

### 02:08 UTC 补充 P2：文件名别名无条件加入旧 Drop 检索，导致同代缓存提前失配

`src/content/wiki/retrieve.ts:117` 对所有 PageIndex 无条件新增 `${p.id}.md` 精确/压平别名。`DropDiscovery` 仍传原有无 `file/displayTitle` 的固定页元数据，却也受到这个新别名影响；它参与 `retrieve.ts:416` 的模糊匹配 closeness 计算，改变普通标识符问题的分数。

`1137-edit-resume-probe.mts` 在原 258 次批次的完整隔离克隆运行真实 `startDrop`，首次未命中缓存的输入竟回到 `drop-discover / 查找相关知识与补证：0`，而非下一条 `[856, ...)` 的 drop-edit。探针在调用真实 provider 前用受控失败停止，真实模型调用 0，原批次与所有旧不可变回执未改动。`1137-resume-input-diff-v2.json` 的最近原帧 `208857b0…` 与新帧 `1db7b155…` 除收据外仅有两个字段不同：`suggestions[2].items[0].score: 40.038 → 40.194`、`suggestions[7].items[0].score: 33.904 → 34.141`。

`1137-retrieval-cache-control.mts` / `1137-retrieval-cache-control-v2.json` 的内存对照只移除新合成的 `.md` 别名即恢复上述旧分数；9 个查询的原 id/score 列表全部相等，替回原始输入后 `controlledFullInputEqualsOld=true`，按真实 selection/budget/protocol 计算的哈希精确恢复为 `208857b01f767e9f4819a3d2e4c66b750ba9071d79e606530e13952969e6fceb`。正文、固定快照、模型预算、规则均未改变。此为当前 UI 子批对真实流程的回归，不是 1126 响应契约或微分片算法返工。请将新增文件名查询限定在真实文件元数据/相应展示索引语义，不无条件改变旧 DropDiscovery 输入；不得删除、改写、舍弃前序缓存或靠真实重跑补齐。保留读者的 id / 文件名 / 原 title / aliases / 展示名五种入口。修后用同探针确认前 258 帧零真实调用复用，首个新输入恢复到编辑位置 856；微片长度项在下一独立修复前允许继续红灯，不混淆两个问题。

所有下列临时产物位于 `C:/Users/-/AppData/Local/Temp/infra-wiki-review-20261115/`。

- `1133-param-data-observed.json`：全库 33 篇参数页，稳定 id、文件、原 title/aliases 不变；四个明确身份样本与搜索结果正确。
- `1133-param-reader-build.json`：独立复制正式内容构建 `/nested/` 静态站；Vite API 成功返回，代码与正式内容前后哈希一致。PowerShell 的 stderr 重定向把 Vite 提示转成了外层 NativeCommandError；因此不把该外层命令写成 exit 0，构建成功依据 API 结果及下列实际浏览器加载。
- `1133-param-display-browser.json`：断 API、1440×900，四样本共 20 项标题、当前面包屑、目录、搜索、稳定路由/query 检查全绿，浏览器零错误。
- `1133-param-reader-build-GE2ULA/1133-source-numbering-browser.json`：one-request 的 60 条来源恢复原生 decimal/list-item 编号，每条证据按钮与外链均保留且能打开证据栏。原红灯产物未覆盖。
- `1134-param-live-browser-v2.json`：18 项全绿；纯隔离副本中改变受保护身份并引入 legacyId，经真实快照生产函数及 `/api/wiki/pages` 刷新后，页头、目录、面包屑、检索一致；旧链接 replace 保留 query/编码锚点与历史行为。初始索引请求为 0，搜索只懒载一个索引，跳转只加载目标页；三栏无重叠，正式内容哈希不变。
- `1135-reader-state-browser-v3.json`：7 项全绿；精确第二 pin、交互图 step=3/横滚/DOM 实例在证据栏与快捷搜索开关后保持；从真实关系图生成的 KVPPConfig.size 推荐使用稳定 id，键盘跳转正确。此聊天仅为本地合成已保存 DTO 的界面协议检查，不冒充真实模型语义验收。已实际打开截图复核。
- `1134-param-ui-tests.json/log`：9 个实际测试文件、105 项通过，exit 0。命令中一个不存在的 related-reading.test.ts 路径被 Vitest 忽略，故不计成第十个套件；相关阅读函数另由真实图/浏览器验证。
- `1134-param-ui-types.json`、`1135-param-ui-biome.json`、`1135-param-ui-deps.json`：全部 exit 0。

`1134-param-live-browser.json` 与 `1135-reader-state-browser{,-v2}.json` 的失败均为验收脚本自身的 TSX 序列化/过宽定位器问题，已保留并用独立新文件名修正复跑；不将其列为产品故障。

## 审阅字节

作者交付的 15 文件 SHA-256 均在本轮重新计算并完全一致。关键字节：

| 文件 | SHA-256 |
| --- | --- |
| src/content/wiki/param-display.ts | 19fd7fdd5ef31c6b6a2472c3ede8b4331b3d27ddcaf906657d6aca6deaaf894a |
| src/content/wiki/schema.ts | c3fbc85893827b3f59ccf19ba865d3f43d36f6cfe192b33755605f49f29ac09c |
| src/content/wiki/retrieve.ts | 30d283be8667007623db235037ea27628440f915a10b6e6993e8b93d08909b22 |
| src/content/wiki/reader-store.ts | 57ad247afb8190c690019c7b5a13a9a6aac1cc22b101f89b508bbe68005071f9 |
| src/app/pages/WikiPage.tsx | 6465b39688aa1fe4f47b38e2acb9c1ce03f5c9e48d6c3d15fdbf2edabb6061e7 |
| src/design/wiki.css | fdcc7503b64d27f31ecf8ed69b450cddd877d200efac29f23f75cc103acaf8c0 |
| server/snapshot.ts | 2c80ad2553aaecf4135942bf25f7ff98f13ff51f0fbcf1c6952d60fcc3ae7202 |
| server/related-reading.ts | 7f849c45fe923fb0e792bbe2d12228a235576bab2fec639c3578b26bb73bb601 |
| scripts/wiki/params/pages.ts（旧入口） | b625e04e2649723f850b115bc0c6b0590da9d035975df49e706ff61839808a37 |
| scripts/wiki/lineage.ts（旧入口） | 89eea7acef7c5787d5cee7e94004045e8d563c893126fd07bbd1b1df8e159656 |

## 后续顺序与边界

先收口本次共用入口，再处理已单列的 `1132-real-edit-granularity-review.md` 微分片 P2；真实批次停在同代 258 次，不盲目继续模型调用。之后继续原 044 AST 工具/只读预演及四类真实样本完整工程验收。所有正文整改仍留第二阶段；第一阶段最终独立签署并发布记录/后续清单后停止派工，保持现有服务。
