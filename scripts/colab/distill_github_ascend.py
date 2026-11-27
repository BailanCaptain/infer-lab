#!/usr/bin/env python3
"""Colab H100/A100 worker: Mine closed vllm-ascend & torch_npu GitHub issues and distill structured plog/fault signatures."""

from __future__ import annotations

import os

os.environ["HF_HUB_DISABLE_IMPLICIT_TOKEN"] = "1"
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
os.environ["TQDM_DISABLE"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

import hashlib
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from typing import Any

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

HIGH_VRAM_MODEL_ID = "Qwen/Qwen3-14B"
MID_VRAM_MODEL_ID = "Qwen/Qwen3-8B"
STD_VRAM_MODEL_ID = "Qwen/Qwen3-1.7B"
OUT_PATH = "/content/distilled_ascend_github.json"

SEARCH_QUERIES = [
    'repo:vllm-project/vllm-ascend is:issue is:closed ("507015" OR "507034" OR "507035" OR "161002" OR "107030")',
    'repo:vllm-project/vllm-ascend is:issue is:closed ("retCode=0x26" OR "CheckSmmuFault" OR "aicore exception" OR "EZ9999" OR "EL0004")',
    'repo:vllm-project/vllm-ascend is:issue is:closed ("EI0006" OR "Notify wait execute timeout" OR "ZMQError: Address already in use")',
    'repo:vllm-project/vllm-ascend is:issue is:closed ("libopapi.so" OR "aclnn" OR "MlaProlog" OR "ChunkGatedDeltaRule" OR "slice_scatter")',
    'repo:vllm-project/vllm-ascend is:issue is:closed ("capture_model" OR "FULL_DECODE_ONLY" OR "Mooncake" OR "kv_transfer_config")',
    'repo:Ascend/pytorch is:issue is:closed ("507015" OR "507034" OR "EZ9999" OR "aicore exception" OR "161002")',
]

SIGNAL_RE = re.compile(
    r"(?:507015|507034|507035|161002|107030|207003|EZ9999|EI0006|EL0004|EJ0001|"
    r"retCode=0x[0-9a-fA-F]+|CheckSmmuFault|aicore exception|libopapi\.so|"
    r"aclnn[A-Za-z0-9_]+|ZMQError|Address already in use|NPU out of memory|"
    r"ACL_ERROR_[A-Z0-9_]+|RuntimeError:|ValueError:|AssertionError:)",
    re.IGNORECASE,
)

FULL_PR_URL_RE = re.compile(r"https://github\.com/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)/pull/(\d{2,6})\b")
SAME_REPO_PR_RE = re.compile(r"(?<![A-Za-z0-9_./-])#(\d{3,6})\b")


def extract_candidate_prs(default_repo: str, text: str) -> list[str]:
    refs: set[str] = set()
    for owner_repo, num in FULL_PR_URL_RE.findall(text):
        refs.add(f"{owner_repo}#{int(num)}")
    for num in SAME_REPO_PR_RE.findall(text):
        refs.add(f"{default_repo}#{int(num)}")
    return sorted(refs)[:8]


def log(msg: str) -> None:
    print(f"[distill] {msg}", file=sys.stderr, flush=True)


def gh_get(url: str) -> tuple[Any | None, int]:
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "infer-lab-ascend-distiller/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            return json.loads(resp.read().decode("utf-8")), resp.status
    except urllib.error.HTTPError as e:
        log(f"HTTP {e.code} on {url}")
        return None, e.code
    except Exception as e:
        log(f"Net error on {url}: {e}")
        return None, 0


def mine_github_issues(max_issues: int = 48, max_comment_fetches: int = 32) -> list[dict[str, Any]]:
    by_key: dict[str, dict[str, Any]] = {}
    for idx, q in enumerate(SEARCH_QUERIES):
        encoded = urllib.parse.quote(q)
        url = f"https://api.github.com/search/issues?q={encoded}&sort=updated&order=desc&per_page=40"
        data, status = gh_get(url)
        if status == 403 and idx > 0:
            log("Search rate limit hit early; proceeding with collected items.")
            break
        items = (data or {}).get("items") or []
        log(f"Query {idx + 1}/{len(SEARCH_QUERIES)} returned {len(items)} items")
        for it in items:
            if "pull_request" in it:
                continue
            body = (it.get("body") or "").strip()
            if len(body) < 160 or not SIGNAL_RE.search(body):
                continue
            html_url = it.get("html_url") or ""
            repo = "vllm-project/vllm-ascend" if "vllm-ascend" in html_url else "Ascend/pytorch"
            key = f"{repo}#{it['number']}"
            if key not in by_key:
                matches = set(m.upper() for m in SIGNAL_RE.findall(body))
                by_key[key] = {
                    "key": key,
                    "repo": repo,
                    "number": it["number"],
                    "url": html_url,
                    "title": (it.get("title") or "").strip(),
                    "closed_at": it.get("closed_at"),
                    "comments_count": int(it.get("comments") or 0),
                    "comments_url": it.get("comments_url"),
                    "body": body[:7500],
                    "body_truncated": len(body) > 7500,
                    "signal_score": len(matches) + (2 if int(it.get("comments") or 0) > 0 else 0),
                }
        time.sleep(1.2)

    ranked = sorted(by_key.values(), key=lambda x: (-x["signal_score"], -x["comments_count"], -x["number"]))
    selected = ranked[:max_issues]
    log(f"Selected {len(selected)} high-signal closed issues (from {len(by_key)} unique)")

    fetched_comments = 0
    stop_comment_fetches = False
    for item in selected:
        item["comments_text"] = ""
        body_truncated = bool(item.get("body_truncated"))
        fetched_all_comments = item["comments_count"] == 0
        comments_truncated = False
        if (
            not stop_comment_fetches
            and item["comments_count"] > 0
            and item["comments_url"]
            and fetched_comments < max_comment_fetches
        ):
            cdata, cstatus = gh_get(f"{item['comments_url']}?per_page=15")
            fetched_comments += 1
            if isinstance(cdata, list):
                snippets = []
                for c in cdata:
                    user = ((c.get("user") or {}).get("login") or "user")
                    cbody = (c.get("body") or "").strip()
                    if len(cbody) > 1200:
                        comments_truncated = True
                    if cbody:
                        snippets.append(f"[{user}]: {cbody[:1200]}")
                joined_comments = "\n".join(snippets)
                if len(joined_comments) > 4500:
                    comments_truncated = True
                item["comments_text"] = joined_comments[:4500]
                fetched_all_comments = len(cdata) >= item["comments_count"]
            elif cstatus == 403:
                log("Core API rate limit reached during comments; keeping remaining issue bodies intact.")
                stop_comment_fetches = True
            time.sleep(0.5)

        item["comments_complete"] = bool(
            fetched_all_comments and not body_truncated and not comments_truncated
        )
        full_raw = f"{item['title']}\n{item['body']}\n{item['comments_text']}"
        item["raw_sha256"] = hashlib.sha256(full_raw.encode("utf-8")).hexdigest()
        item["candidate_prs"] = extract_candidate_prs(item["repo"], full_raw)

    return selected


SYSTEM_PROMPT = """你是昇腾 NPU 大模型推理（vLLM-Ascend / CANN / torch_npu）故障取证蒸馏专家。
请严格根据给定的 GitHub Issue 原文与评论，输出且仅输出一个合法的 JSON 对象（不要输出 markdown 代码块包裹，不要编造原文不存在的日志行）。
JSON 字段契约：
{
  "verbatim_root_line": "从原文逐字原样摘录的最关键首错日志单行（必须100%是原文子串；若无则空字符串）",
  "verbatim_cascade_lines": ["从原文逐字原样摘录的次生/连带超时或退出日志行，无则 []"],
  "error_codes": ["提取出现的错误码，如 507015, 507034, 161002, 0x26, EZ9999, EI0006, 137 等"],
  "subsystem": "只能取以下之一: cann-aicore | cann-aiv-timeout | aclnn-op-param | cann-opapi-symbol | hccl-comm | zmq-port-gloo | aclgraph-capture | mooncake-pd | memory-oom | other",
  "hardware_soc": "原文提到的芯片如 910B / A2 / A3 / 310P / unknown",
  "topology": "原文提到的并行或部署形态如 TP4 / DP2+EP8 / PD分离 / single / unknown",
  "root_cause_confirmed": true或false（评论或正文是否明确了根因或修复PR）,
  "root_cause_zh": "80字以内中文总结触发条件与机制根因（未确认则如实写仅报告症状及现象）",
  "fix_or_workaround_zh": "60字以内修复PR思路或临时规避参数（未知则留空）",
  "fix_pr_numbers": [整数PR号列表，仅填明确修复或关联该问题的PR，不确定则 []],
  "colloquial_queries_zh": ["模拟3条真实工程师不贴完整堆栈时的中文口语搜索词，每条10-28字"],
  "same_code_trap_zh": "一句话说明该报错码/表象容易和哪种同码异因场景混淆"
}"""


def extract_json_obj(text: str) -> dict[str, Any] | None:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        return json.loads(text[start : end + 1])
    except Exception:
        return None


def main() -> None:
    t0 = time.time()
    gpu_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"
    vram_gib = (
        round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 2)
        if torch.cuda.is_available()
        else 0.0
    )
    log(f"Runtime GPU: {gpu_name} ({vram_gib} GiB VRAM), torch={torch.__version__}")

    issues = mine_github_issues(max_issues=42, max_comment_fetches=30)
    if not issues:
        raise RuntimeError("Zero GitHub issues mined; aborting.")

    cc_major = torch.cuda.get_device_capability(0)[0] if torch.cuda.is_available() else 0
    model_id = (
        HIGH_VRAM_MODEL_ID
        if vram_gib >= 32.0
        else MID_VRAM_MODEL_ID
        if vram_gib >= 20.0
        else STD_VRAM_MODEL_ID
    )
    dtype = torch.bfloat16 if cc_major >= 8 else torch.float16
    batch_size = 6 if vram_gib >= 32.0 else (8 if model_id == STD_VRAM_MODEL_ID else 4)
    log(f"Loading teacher model {model_id} in {dtype} (cc={cc_major}.x, batch={batch_size})...")
    tokenizer = AutoTokenizer.from_pretrained(model_id, padding_side="left")
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token_id = tokenizer.eos_token_id
    model = AutoModelForCausalLM.from_pretrained(
        model_id,
        dtype=dtype,
        low_cpu_mem_usage=True,
        device_map="auto",
    )
    model.eval()
    log(f"Model loaded in {time.time() - t0:.1f}s. Starting batched distillation...")

    results: list[dict[str, Any]] = []
    for b_start in range(0, len(issues), batch_size):
        batch = issues[b_start : b_start + batch_size]
        prompts = []
        for it in batch:
            user_msg = (
                f"仓库: {it['repo']} #{it['number']}\n"
                f"标题: {it['title']}\n"
                f"正文摘录:\n{it['body'][:4800]}\n\n"
                f"评论区摘录 (完整={it['comments_complete']}):\n{it['comments_text'][:2600]}"
            )
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ]
            try:
                rendered = tokenizer.apply_chat_template(
                    messages, tokenize=False, add_generation_prompt=True, enable_thinking=False
                )
            except TypeError:
                rendered = tokenizer.apply_chat_template(
                    messages, tokenize=False, add_generation_prompt=True
                )
            prompts.append(rendered)

        enc = tokenizer(prompts, return_tensors="pt", padding=True, truncation=True, max_length=3584).to(
            model.device
        )
        with torch.no_grad():
            gen = model.generate(
                **enc,
                max_new_tokens=360,
                do_sample=False,
                pad_token_id=tokenizer.pad_token_id,
            )
        in_len = enc["input_ids"].shape[1]
        for it, seq in zip(batch, gen):
            raw_out = tokenizer.decode(seq[in_len:], skip_special_tokens=True)
            parsed = extract_json_obj(raw_out) or {}
            haystack = f"{it['title']}\n{it['body']}\n{it['comments_text']}"
            root_line = (parsed.get("verbatim_root_line") or "").strip()
            root_verified = bool(root_line and root_line in haystack)
            cascades = [
                c.strip()
                for c in (parsed.get("verbatim_cascade_lines") or [])
                if isinstance(c, str) and c.strip() and c.strip() in haystack
            ]
            results.append(
                {
                    "key": it["key"],
                    "repo": it["repo"],
                    "number": it["number"],
                    "url": it["url"],
                    "title": it["title"],
                    "closed_at": it["closed_at"],
                    "comments_complete": it["comments_complete"],
                    "raw_sha256": it["raw_sha256"],
                    "candidate_prs": it["candidate_prs"],
                    "verbatim_root_line": root_line,
                    "verbatim_root_verified": root_verified,
                    "verbatim_cascade_lines": cascades,
                    "distilled": parsed,
                }
            )
        del enc, gen
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        log(f"Distilled {min(b_start + batch_size, len(issues))}/{len(issues)} issues ({time.time() - t0:.1f}s)")

    payload = {
        "schemaVersion": 1,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "teacherModel": model_id,
        "dtype": str(dtype),
        "gpu": gpu_name,
        "vramGiB": vram_gib,
        "elapsedSec": round(time.time() - t0, 2),
        "totalIssues": len(results),
        "verbatimVerifiedCount": sum(1 for r in results if r["verbatim_root_verified"]),
        "items": results,
    }
    out_bytes = (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    with open(OUT_PATH, "wb") as fp:
        fp.write(out_bytes)
    sha = hashlib.sha256(out_bytes).hexdigest()
    log(f"Saved {OUT_PATH} ({len(out_bytes)} bytes, sha256={sha[:16]}...)")
    print(json.dumps({"status": "ok", "outPath": OUT_PATH, "sha256": sha, "count": len(results)}))


if __name__ == "__main__":
    main()
