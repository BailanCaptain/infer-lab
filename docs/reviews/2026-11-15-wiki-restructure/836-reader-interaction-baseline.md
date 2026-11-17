# 045 既定阅读交互项：浏览器复现基线

对应唯一方案 §3.3 P3-2 / 包 4 的 `ReaderResizeHandle` 与 `directoryOpen`。这是当前导航 UI 短轮之后的剩余项证据，不增加新的产品范围或手机视觉验收要求。

root 使用生产应用的隔离三页样本构建，随机临时端口、Chromium、阻断全部 API，执行 `%TEMP%/infra-wiki-review-20261115/836-reader-interaction-baseline.mjs`，结果 `836-reader-interaction-stable-red.json`；浏览器与服务均已关闭。

1. **P3：非调整键也写入宽度偏好**。1440×900 下聚焦“调整目录与正文宽度”分隔条，按 `a`，实际调用 `localStorage.setItem('infra-reader-directory-width', '240')`；未调整却持久化默认宽度。`ArrowRight` 正常从 240 调为 256 并保存，作为对照已通过。根因为 `ReaderResizeHandle.tsx` 的 `onKeyUp={finish}` 不筛选按键，也不确认发生了有效调整。
2. **P3：窄窗口打开目录状态跨桌面断点残留**。同一桌面浏览器从 1440 缩为 1000，目录起初关闭；手动打开后等待 toggle/React 状态提交，再放宽到 1440，随后缩回 1000，目录仍自动打开。对应 `open={desktop || directoryOpen}` 与不清理窄窗状态的实现。应按既定方案在跨回桌面时复位窄窗抽屉状态，且保持桌面目录常驻和手动分组展开状态。

第一版探针没有等待原生 details toggle 事件，导致该事件恰在放宽窗口后被桌面条件忽略，不作为第二项的证据。稳定版在手动打开后等待状态提交，记录 `manuallyOpenedNarrow=true`、`desktopOpen=true`、`returnNarrowOpen=true`，错误数为 0。

这两项仍为 P3；无需中断正在实现的旧 URL/聊天导航短轮，但须在框架整体收口前按原计划处理。不要为了消除空写而破坏箭头调整、拖拽结束保存、双击复位和存储不可用时的阅读能力。
