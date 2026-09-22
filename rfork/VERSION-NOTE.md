# RFork 原始补丁的版本关系

用户提供的两份材料：

- [patch1–6 的归档提交](https://github.com/yangsonglin13/vllm-ascend/commit/2db39b67174fb430210f9774ddaa60772b3d6780)
- [patch7 的归档提交](https://github.com/yangsonglin13/vllm-ascend/commit/7b1a690b359197c9a3462cae2411bfbfe1ec349a)

`patches/` 保存这些提交里的原始补丁字节。第七份原名以 `0001-` 开头，仅本地文件名改为 `0007-`；文件内容没有改写。

## 归档提交与实现提交不是同一个东西

| 材料 | 归档提交 | 补丁对应的实现终点 |
|---|---|---|
| patch1–6 | `2db39b67174fb430210f9774ddaa60772b3d6780` | `7ddcfca9291fe9336a1ab8f9064d0dd819ddb2a4` |
| patch7 | `7b1a690b359197c9a3462cae2411bfbfe1ec349a` | `3284850b42f94934dfe6909ed6f1c4c145a7f69c` |

第一组的基线是 `f2f74a16c3c50a76f4349d807918e83edec1e35c`。两条实现历史在 patch3 `395a59cba61377e40327bee2a2ce5a605f306500` 后分叉：

```text
f2f74a16 → b5445840 (1) → 54081fd7 (2) → 395a59cb (3)
  ├─ 3aa0ee8f (4) → ac2be61b (5) → 7ddcfca9 (6) → 2db39b67 (存补丁)
  └─ 4c3016fe     → 996d9bd0     → 09b8eeae     → 3284850b (7) → 7b1a690b (存补丁)
```

因此“patch1–6 原件 + patch7 原件”并不等于第二条历史的完整代码。不能只按编号推断累积版本，也不能把第二条历史的全部变化都归因于 patch7。

## 2026-09-21 的实际核对

在独立、干净的 `7ddcfca9` 工作树执行：

```text
git apply --check ../../../rfork/patches/0007-fix-rfork-stabilize-seed-transfer-across-instances.patch

error: tests/ut/model_loader/rfork/test_seed_server_cleanup_isolated.py: No such file or directory
error: tests/ut/model_loader/rfork/test_tensor_safety_isolated.py: No such file or directory
error: patch failed: vllm_ascend/model_loader/rfork/tensor_layout.py:112
error: vllm_ascend/model_loader/rfork/tensor_layout.py: patch does not apply
```

`git diff --stat 7ddcfca9 09b8eeae` 显示 18 个文件不同（3080 行增加、185 行删除），包括租约文档、隔离测试、Session、Planner client、张量采集与回退清理。它们是两个固定提交之间的差异，不是社区 main 的最新状态。

这份记录保留原材料的身份；选定维护基线后，应在维护清单中单独登记需要的衔接差异，不修改原始七份补丁来掩盖分叉。

用户随后确认以 `3284850b42f94934dfe6909ed6f1c4c145a7f69c` 的完整代码为工作版基线。实际衔接 diff 在 `reconciliation/`，精确身份与哈希在 `manifest.json`。`pnpm rfork:verify --git` 已验证完整重放结果的 tree 为 `62d2fd3482fa732ac751bb7cc3d7c892e5646814`，与该实现提交完全一致。
