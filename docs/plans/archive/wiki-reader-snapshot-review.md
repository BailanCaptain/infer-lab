# 读者快照一致性验收（2026-09-15）

本轮补齐 F004 T5 的离线精确版本标识，并统一读者目录、正文与版本的更新。**这证明读者能识别和保留所读版本，不证明真实模型的回答已经改善。** 仍在 `infra-view-new-llm-wiki` / `feat/llm-wiki`，HEAD `8175224` 的既有工作基础上实施，未合入主干、未批量导入、未调用真实模型。

## 问题与处理

| 级别 | 位置与影响 | 复现 / 回归证据 | 处理 |
|---|---|---|---|
| P2 | `WikiPage.tsx` 的版本状态原来独立于正文缓存；断网离线只显示“构建快照”，无法判断正在读哪份内容 | 新增 `tests/wiki-reader.spec.ts` 在 API 不可用时打开 Block Table，修复前实际失败：期望 `构建版本 17a712287d5b`，收到 `构建快照` | 构建直接嵌入同一次读取的目录、正文和 revision；页面显示版本前 12 位，title 保留完整 64 位 |
| P2 | 原先版本标签随页面卸载清空，已安装的全局正文缓存仍保留；重新进入且 API 失败时会将线上缓存误标为构建内容 | `tests/wiki-review.spec.ts`：读取 API 页 → 返回首页 → 禁用 API → 浏览器后退；检查正文、版本文字和完整 revision 全部保留 | 用 `reader-store.ts` 原子保存内容及版本，React 订阅同一状态 |
| P2 | 多次刷新缺乏请求顺序约束，晚到的旧响应可能覆盖新内容；不完整或重复的响应也缺少完整拒绝条件 | `reader-store.test.ts` 控制两个请求的完成顺序；旧成功、旧失败均不能覆盖新状态。缺 revision、缺正文、重复文件与重复 ID 均拒绝，并验证原状态对象不变 | 更新前完整校验；仅最新且未取消的请求允许安装；失败保留旧状态 |

`src/content/wiki/schema.ts` 的 `readerSnapshotSchema` 是唯一读者载荷契约。`server/snapshot.ts` 的 `readReaderSnapshot` 同时供在线 API 和 `scripts/wiki/reader-plugin.ts` 使用。构建不再分别读取可能过期的 registry 与另一份正文 glob，也不另建一套内容 hash 算法；原有 registry 派生物继续服务其他工具。

刷新操作可手动重试。失败提示明确当前内容未更新；发布后刷新若尚未确认，不显示读取成功。`server/reader-build.test.ts` 从构建读者和服务端两侧核对同一版本、完整目录、元数据与正文。该集成测试放在服务端测试层，避免浏览器类型配置引入 Node 文件系统依赖。

## 本轮实际验证

```text
修复前浏览器用例：1 failed
  Expected: 构建版本 17a712287d5b
  Received: 构建快照

pnpm check
  Test Files 60 passed
  Tests 502 passed
  类型 / 依赖 / 内容 / wiki lint 通过

pnpm build
  built in 2.77s

node node_modules/vite/bin/vite.js preview --port 4173 --strictPort
pnpm test:e2e tests/wiki.spec.ts tests/evidence.spec.ts tests/raw-source.spec.ts tests/wiki-review.spec.ts tests/wiki-reader.spec.ts --project chromium
  25 passed (38.7s)

pnpm wiki:eval
  prepared-only; verifiedEvidence: 6; modelCalls: 0; costUsd: 0
  knowledgeRevision: 17a712287d5b255b4d3c3ddbac610a5e79a1298cbbfdd39f4013043f4cb73ec8
```

生产预览的 HTML 实际加载 `assets/index-mWSkGk2x.js`，没有开发热更新客户端。浏览器覆盖断网构建页、手动重试、缓存页重新进入、保存 / 批准 / 驳回、发布后续聊、正文 / 图 / 来源角标和原文查看。问答与编译模型使用固定输出；原文查看用例的模拟 API 也已更新为携带显式版本的完整载荷，不把模拟版本当真实知识版本。

截图保存在 `test-results/wiki-reader-offline-reader-9f699-uild-snapshot-and-can-retry-chromium/wiki-reader-offline.png` 和 `test-results/wiki-review-returning-to-a-f055c-hed-content-and-its-version-chromium/wiki-reader-cached.png`。缓存场景截图已实际查看，版本、断网提示、正文与两个操作按钮清晰可见。

检查日志保留在 `tools/wiki-runtime/reader-{check,build,e2e}.log`。Biome 的既有 1 warning / 2 infos 保留。新增构建插件引入的共享读取链使 Vite 输出未来 native config loader 的无扩展名导入兼容提示；当前默认加载器下测试、构建与预览均通过，没有屏蔽提示或改动全项目导入方式。

## 范围与剩余状态

- 正式 19 页与知识 revision 未变化；本轮只修改读取和验证地基，不改变知识事实。
- 离线精确版本与在线刷新一致性已验证；真实模型隔离行为、保存后事实正确性改善、总费用汇总仍未验证或交付。M1a / M1b 不勾选。
- 开发服务器的 wiki 文件变化会使虚拟快照失效并重新加载。生产验收不依赖该机制；开发监听的新增 / 删除文件场景本轮未单独验收。
- 本轮没有新增 F002 / F003 验收项；F001 / F004 获得读者基础改进，四个 feature 仍无整体完成项。完整状态只看各 feature，避免重复维护百分比。

下一步仍是小样本真实复问与来源支撑核对；费用预算未确定时，可继续完善确定性的来源记录和维护能力。待用户决定：真实模型验收的新增调用总预算；本轮已交付部分不依赖该答复。
