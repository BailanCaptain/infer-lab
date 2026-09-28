# gap-a5164fe10fa9184412f8（HCCL buffer）审查记录

## 修订记录

- 2026-09-28 来源修正：`vllm@0fc695fc:vllm/utils/mem_utils.py#L256-L276`（该版本文件仅 275 行，`pnpm wiki:audit` 报行号越界）改为 `#L263-L268`，对应 `after_profile.measure()` → `diff_from_create = after_profile - before_create` → `non_torch_increase = diff_from_create.non_torch_memory`，即「非 torch 增量 = after_profile − before_create」的真实出处。frontmatter 第 26 行与正文来源表第 184 行同一条引用一并改正。改后 `pnpm wiki:audit` exit 0，行号越界 0，本页 18 条来源全部有效。
