# Anthropic 误报反馈（frontier_llm 分类器）

> 给用户的说明：在 Claude Code 终端里运行 `/feedback`，把下面英文部分粘贴进去提交；
> 或走 CLI 提示里的 <https://support.claude.com/en/articles/8106465>。
> 本文档特意**不含**触发原文——把原文贴进 Opus 5.5 会话会当场再触发一次
> （2026-09-23 我们的主会话就是这样被拦的）。原文样本 Anthropic 可凭下方 request ID
> 在服务端调取；如需我们提供，见文末。

---

## False positive report: `frontier_llm` refusal classifier flags benign LLM-inference documentation

**Environment**: Claude Code CLI 2.1.280, Windows 11, both `sdk-cli` (headless `-p` calls) and the desktop-app interactive session. Account: sunduizhang98@gmail.com.

**What we run**: a local, offline Chinese-language teaching wiki about open-source LLM inference deployment (vLLM / vLLM-Ascend on Huawei Ascend NPUs). A Q&A feature pins `claude-opus-5-5[1m]`. All content is documentation of public open-source projects: scheduler behavior, KV-cache paging, operator dispatch, config systems, citation conventions.

### Symptom

`model_refusal_fallback` events with `apiRefusalCategory: frontier_llm`. Opus 5.5 (and earlier Fable 5.1) is swapped for Opus 5 mid-session. On 2026-09-23, **8 out of 8** Q&A sessions were downgraded this way, every time on the very first user turn. The interactive desktop session investigating the issue was itself stopped by the same classifier (~15:40 UTC, 2026-09-23) the moment the probe output entered its context, and had to switch models to continue.

### Request IDs (all `[frontier_llm]`, UTC)

Opus 5.5[1m] → Opus 5, sdk-cli, 2026-09-23:

| Timestamp | Request ID |
|---|---|
| 02:28:15 | req_011CfKai4ciCQMzfXa5cL24Q |
| 03:01:08 | req_011CfKdDbfYbCcXqTMy5wpMp |
| 03:05:58 | req_011CfKdapNMtG9PbGJbEurB2 |
| 03:07:05 | req_011CfKdfiF9otXP4Jos96a8L |
| 03:08:31 | req_011CfKdmGNKyGhqTaT68pa1o |
| 03:18:22 | req_011CfKeXnhC6afmGqrhonAzP |
| 03:23:17 | req_011CfKeuZWYsZ9G3Ytghj45J |
| 03:26:42 | req_011CfKfAgVQbQMncE7A3NrUo |

Same category on Fable 5.1 → Opus 5, cli, same corpus, earlier:

| Timestamp | Request ID |
|---|---|
| 2026-09-05 19:30:02 | req_011Cekr3j59ipnacD29WmVPT |
| 2026-09-06 05:12:30 | req_011CemcT78TyJJDJcqJG7YPm |
| 2026-09-06 05:14:14 | req_011CemcbiRE7KutGivvQF6A3 |
| 2026-09-06 06:54:24 | req_011CemkFASjpdNYpHWqXVW3k |

### Systematic measurement (198 probe calls, ~$14)

We fed each document verbatim to `claude-opus-5-5[1m]` via `claude -p` (no tools, prompt: "summarize this page in 2–3 sentences") and parsed the fallback events.

- **116 documents probed; 7 flagged, 109 passed.** Every flagged document reproduced on retest (≥2/2 each). The flagged ones are all LLM-inference internals: paged-attention, operator/kernel dispatch, NPU graph mode, config system, component-responsibility overview, plus our 78 KB style handbook.
- **Delta-debugging (ddmin) on the handbook**: each of its 19 sections passes *individually*; refusal appears only in combination. The minimal refusing set is ~5 paragraphs (~1.5 KB): a **source-citation format spec** (paragraphs dense with git commit hashes, sha256 content hashes, `#L<start>-L<end>` line-range notation, repo paths) plus a **table of ~14 citable official-documentation domains** (vLLM docs, Huawei Ascend docs, gitee/gitcode mirrors, arxiv, model-card sites).
- **Threshold behavior, not keyword matching**: the minimal 5-paragraph set refused once and passed once on retest; every superset containing it refused 14/14; removing any one paragraph flips it to pass. This looks like a score hovering at the decision boundary, pushed over by the density of hash strings + domain lists on top of an LLM-infrastructure topic.

### Why we believe this is a false positive

The content is formatting conventions and domain whitelists for citing *public* documentation of open-source inference software. No model weights, no exfiltration, no malware, nothing proprietary. Our guess: hash-and-domain-dense text on an LLM topic superficially resembles material the `frontier_llm` safeguard targets.

### Impact and ask

A product pinned to Opus 5.5 silently loses it whenever the assistant reads these pages — including our own interactive debugging session. Please review the flagged requests above and tune the classifier. We can provide the exact minimal reproducing markdown on request (it is benign; we omit it here only because pasting it into an Opus 5.5 context re-triggers the block).
