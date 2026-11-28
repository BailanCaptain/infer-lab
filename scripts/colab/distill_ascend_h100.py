#!/usr/bin/env python3
"""Colab H100 80GB / G4 96GB / A100 distiller: Qwen/Qwen3.8-27B with explicit thinking.

Reads /content/dual_raw_corpus.jsonl, runs Qwen/Qwen3.8-27B (BF16 full precision on >=65 GiB VRAM;
hard-errors if VRAM < 38 GiB) with enable_thinking=True and max_new_tokens=1536 via vLLM offline
engine (with rock-solid Transformers AutoModelForImageTextToText/AutoModelForCausalLM fallback),
strictly verifies verbatim root/cascade lines (rejecting title copies), checkpoints every 24 items,
clusters into 20-25 candidate fault families, and writes:
  - /content/distilled_ascend_dual.json
  - /content/candidate_fault_families.md
"""

from __future__ import annotations

import os

os.environ["HF_HUB_DISABLE_IMPLICIT_TOKEN"] = "1"
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
os.environ["TQDM_DISABLE"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

import argparse
from collections import Counter, defaultdict
import gc
import hashlib
import importlib
import inspect
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
from typing import Any
from urllib.parse import urlparse
import uuid

try:
    import torch  # type: ignore[import-not-found]
except ImportError:
    torch = None  # type: ignore[assignment]

PRIMARY_MODEL_ID = "Qwen/Qwen3.8-27B"
FALLBACK_FP8_MODEL_ID = "Qwen/Qwen3.8-27B-FP8"
FALLBACK_32B_MODEL_ID = "Qwen/Qwen3-32B"
NORMALIZER_SCHEMA_VERSION = "f6-v3"

MIN_VRAM_GIB = 38.0
BF16_FULL_VRAM_GIB = 65.0
MAX_MODEL_LEN = 8192

REQUIRED_MODEL_JSON_KEYS: frozenset[str] = frozenset(
    {
        "verbatim_root_line",
        "error_codes",
        "fault_domain",
        "subsystem",
        "root_cause_confirmed",
        "root_cause_zh",
        "same_code_trap_zh",
        "colloquial_queries_zh",
        "forensic_chain_zh",
    }
)

_LINE_BREAK_RE = re.compile(r"\r\n|[\r\n\v\f\x85\u2028\u2029]")
_ANY_LINE_BREAK_RE = re.compile(r"[\r\n\v\f\x85\u2028\u2029]")


_JS_TRIM_RE = re.compile(
    r"^[\t\n\v\f\r \xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+"
    r"|[\t\n\v\f\r \xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+$"
)


def _js_trim(s: str) -> str:
    """Trim exact ECMAScript WhiteSpace + LineTerminator + U+FEFF (100% parity with JS String.prototype.trim)."""
    if not s:
        return ""
    return _JS_TRIM_RE.sub("", s)
_ERROR_CODE_TOKEN_RE = re.compile(
    r"^(?:"
    r"-?[0-9]{1,12}|"
    r"0x[0-9a-f]+|"
    r"retcode=0x[0-9a-f]+|"
    r"http[ \t]*[0-9]{3}|"
    r"e[a-z0-9][0-9]{4}|"
    r"err[0-9]{4,6}|"
    r"(?:acl|aclnn|hccl|hcomm|rt|ge|fe|drv|ts|tsd|cuda|nccl|npu)_(?:e|err|error)_[a-z0-9_]+|"
    r"(?:el|ee|ez|ei|ej|em|ew)_[a-z0-9_]+|"
    r"sig[a-z0-9]+|"
    r"e[a-z]{3,15}"
    r")$",
    re.IGNORECASE | re.ASCII,
)
_UPPER_ERROR_MACRO_RE = re.compile(r"^(?:[a-z][a-z0-9_]*::)?[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$")
_ERROR_MACRO_HINT_RE = re.compile(
    r"(?:^|_)(?:ERR|ERROR|FAIL|FAILED|FAULT|INVALID|TIMEOUT|NULLPTR|OOM|OOB|OVERFLOW|"
    r"UNSUPPORTED|MISMATCH|ABORT|DENIED|BUSY|EMPTY|FULL|RANGE|PERM|PARAM|PARAMS|STATUS|"
    r"BAD|NOTFOUND|UNAVAILABLE)(?:_|$)"
)
_POSIX_ERR_CODES: frozenset[str] = frozenset(
    {
        "EINVAL",
        "ENOMEM",
        "ENOENT",
        "EACCES",
        "EAGAIN",
        "EBUSY",
        "ECONNREFUSED",
        "ECONNRESET",
        "EADDRINUSE",
        "ETIMEDOUT",
        "EHOSTUNREACH",
        "ENETUNREACH",
        "EPIPE",
        "EIO",
        "EFAULT",
        "ERANGE",
        "EPERM",
        "SIGSEGV",
        "SIGABRT",
        "SIGKILL",
        "SIGBUS",
        "SIGTERM",
    }
)

DEFAULT_INPUT_JSONL = "/content/dual_raw_corpus.jsonl"
DEFAULT_OUT_JSON = "/content/distilled_ascend_dual.json"
DEFAULT_OUT_MD = "/content/candidate_fault_families.md"

VALID_FAULT_DOMAINS: tuple[str, ...] = (
    "hccl-link-net",
    "hccl-wait-cascade",
    "torchair-ge-compile",
    "moe-mc2-quant",
    "cann-aicore-smmu",
    "cann-opapi-aclnn",
    "cann-driver-env",
    "pd-mooncake",
    "memory-oom",
    "other",
)

# Compatible with scripts/wiki/verify-distilled-ascend.ts
VALID_SUBSYSTEMS: tuple[str, ...] = (
    "cann-aicore",
    "cann-aiv-timeout",
    "aclnn-op-param",
    "cann-opapi-symbol",
    "hccl-comm",
    "zmq-port-gloo",
    "aclgraph-capture",
    "mooncake-pd",
    "memory-oom",
    "other",
)

DOMAIN_TO_SUBSYSTEM: dict[str, str] = {
    "hccl-link-net": "hccl-comm",
    "hccl-wait-cascade": "hccl-comm",
    "torchair-ge-compile": "aclgraph-capture",
    "moe-mc2-quant": "aclnn-op-param",
    "cann-aicore-smmu": "cann-aicore",
    "cann-opapi-aclnn": "aclnn-op-param",
    "cann-driver-env": "cann-opapi-symbol",
    "pd-mooncake": "mooncake-pd",
    "memory-oom": "memory-oom",
    "other": "other",
}

SYSTEM_PROMPT = """你是昇腾 NPU 大模型推理与全栈算子（vLLM-Ascend / vLLM / torch_npu / TorchAir / ModelSlim / CANN Runtime / HCCL / aclnn）故障取证专家。
请先在思维链中完成根因交叉取证（区分首错与次生级联超时、结合关联 PR/MR 代码 diff 验证真实触发机理与修复点、识别同码异因陷阱），然后在 </think> 之后输出且仅输出一个严格合法的 JSON 对象（不要用 markdown 代码块包裹，不要在 JSON 后附加说明）。

硬性取证约束：
1. verbatim_root_line 必须是「正文摘录」或「评论区摘录」中的逐字连续子串（100% 原样摘录真实报错日志/堆栈/plog/错误码行）。绝对禁止复制或截取「标题」充当 verbatim_root_line！如果正文与评论中确实没有任何具体报错日志行，填 ""。
2. verbatim_cascade_lines 只能从正文与评论摘录次生/连带超时或退出日志行，同样不得复制标题，无则 []。
3. error_codes 仅填原文中真实出现的错误码（如 507015 / 161002 / EI0006 / EZ9999 / 0x26 等），严禁臆造或照抄示例！
4. pr_fix_mechanism_zh 若提供了关联 PR/MR 代码 diff，必须基于 diff 说明改了什么代码逻辑修复根因；若无 diff 但评论给出了修复机制则概括之，否则留空 ""。
5. forensic_chain_zh 必须给出 120-320 字中文三段式取证推理链，严格包含全部三个段标：[1.时序与表象剥离] ... [2.底层根因机理] ... [3.PR/MR代码分支核验] ...

严格 JSON 字段契约：
{
  "verbatim_root_line": "正文或评论中逐字原样摘录的最关键首错日志单行（绝不可抄标题）",
  "verbatim_cascade_lines": ["正文或评论中逐字原样摘录的次生/级联报错行，无则 []"],
  "error_codes": ["仅填原文真实出现的错误码列表，无则 []"],
  "fault_domain": "只能取以下之一: hccl-link-net | hccl-wait-cascade | torchair-ge-compile | moe-mc2-quant | cann-aicore-smmu | cann-opapi-aclnn | cann-driver-env | pd-mooncake | memory-oom | other",
  "subsystem": "只能取以下之一: cann-aicore | cann-aiv-timeout | aclnn-op-param | cann-opapi-symbol | hccl-comm | zmq-port-gloo | aclgraph-capture | mooncake-pd | memory-oom | other",
  "hardware_soc": "原文提到的芯片如 910B / A2 / A3 / 310P / unknown",
  "topology": "原文提到的并行或部署形态如 TP4 / DP2+EP8 / 1P1D / single / unknown",
  "root_cause_confirmed": true或false,
  "root_cause_zh": "100字以内中文精准总结触发条件与底层机制根因",
  "pr_fix_mechanism_zh": "100字以内基于PR/MR代码diff或评论说明具体修复机制（未知留空）",
  "fix_or_workaround_zh": "80字以内升级版本、修复思路或临时规避参数（未知留空）",
  "fix_pr_refs": ["owner/repo#123 或 gitcode:owner/repo!123 格式，仅填明确修复或关联该问题的PR/MR"],
  "fix_pr_numbers": [整数PR/MR号列表，仅填明确修复该问题的编号，不确定则 []],
  "same_code_trap_zh": "一句话点破该错误码或症状最容易混淆的同码异因场景",
  "colloquial_queries_zh": ["3条真实一线工程师不贴完整堆栈时的中文口语排障搜索词，每条严格10-28字"],
  "forensic_chain_zh": "120-320字中文三段式取证链：[1.时序与表象剥离] ... [2.底层根因机理] ... [3.PR/MR代码分支核验] ..."
}"""

FALLBACK_LOG_LINE_PATTERNS: list[tuple[int, re.Pattern[str]]] = [
    (
        10,
        re.compile(
            r"(?:\[ERROR\][ \t]*(?:RUNTIME|HCCL|ASCENDCL|OPAPI|GE|FE|AICPU|TSD|DRV|KERNEL|ATB|TORCHAIR)|"
            r"CheckSmmuFault|aicore exception|aiv exception|Notify wait execute timeout|"
            r"NPU function error:|c10_npu::acl::|retCode=0x[0-9a-fA-F]+)",
            re.IGNORECASE | re.ASCII,
        ),
    ),
    (
        8,
        re.compile(
            r"(?:\b(?:5070[0-9]{2}|1070[0-9]{2}|1610[0-9]{2}|2070[0-9]{2}|5000[0-9]{2}|5610[0-9]{2}|"
            r"E[EZIJLMW][0-9]{4}|E[1-9][0-9]{4}|ACL_ERROR_[A-Z0-9_]+|HCCL_E_[A-Z0-9_]+)\b|"
            r"NPU out of memory|libopapi\.so|aclnn[A-Z][A-Za-z0-9_]+.*(?:fail|error|invalid|status|161002))",
            re.IGNORECASE | re.ASCII,
        ),
    ),
    (
        6,
        re.compile(
            r"(?:(?:RuntimeError|ValueError|AssertionError|KeyError|TypeError|AttributeError|"
            r"IndexError|OSError|ImportError|MemoryError|NotImplementedError|TimeoutError|"
            r"ZMQError|OutOfMemoryError|DistBackendError|ProcessRaisedException)[ \t]*:|"
            r"Segmentation fault|SIGSEGV|SIGABRT|Address already in use|core dumped|"
            r"errCode[ \t]*[=:][ \t]*[0-9]+|error code is [0-9]+)",
            re.IGNORECASE | re.ASCII,
        ),
    ),
    (
        4,
        re.compile(
            r"(?:Traceback \(most recent call last\):|ERROR[ \t]+[0-9]{2}-[0-9]{2}[ \t]+[0-9]{2}:[0-9]{2}:[0-9]{2}|"
            r"failed with error|call aclnn|Exception:)",
            re.IGNORECASE | re.ASCII,
        ),
    ),
]

PRIMARY_SYMBOL_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("CheckSmmuFault/0x26", re.compile(r"CheckSmmuFault|retCode=0x26|SMMU|DDR address out of range", re.I | re.A)),
    ("EI0002/NotifyWaitTimeout", re.compile(r"EI0002|Notify wait|HCCL_EXEC_TIMEOUT", re.I | re.A)),
    ("EI0006/EJ0001/HCCL-Link", re.compile(r"EI0006|EJ000\d|EI000[1345789]|Getting socket times out|LinkEstablish|RaSocket|HCCL_IF_IP|ranktable|RoCE|RDMA", re.I | re.A)),
    ("ZMQ/TCPStore/Port", re.compile(r"ZMQError|Address already in use|TCPStore|Gloo|ECONNREFUSED", re.I | re.A)),
    ("507015/AICore-Sync", re.compile(r"\b507015\b|aicore exception|AclrtSynchronizeStreamWithTimeout", re.I | re.A)),
    ("507034/507035/AIV-Timeout", re.compile(r"\b(?:507034|507035|507018)\b|aiv exception", re.I | re.A)),
    ("161002/aclnn-Param", re.compile(r"\b(?:161002|161001|561000)\b|GetWorkspaceSize", re.I | re.A)),
    ("libopapi/EL0004/Symbol", re.compile(r"libopapi\.so|EL0004|undefined symbol|libascendcl\.so", re.I | re.A)),
    ("EZ9999/EZ1001/InnerErr", re.compile(r"\b(?:EZ9999|EZ1001|EZ300\d)\b", re.I | re.A)),
    ("107030/207003/Runtime", re.compile(r"\b(?:107030|107002|207003|507008|500001|500002)\b|ACL_ERROR_", re.I | re.A)),
    ("ACLGraph/TorchAir-Capture", re.compile(r"capture_model|FULL_DECODE_ONLY|PIECEWISE|aclgraph|torchair|npugraph_ex", re.I | re.A)),
    ("MC2/MoeDistribute", re.compile(r"\bmc2\b|MoeDistribute|DispatchFFNCombine|FusedMoE|fused_moe|alltoallv", re.I | re.A)),
    ("GroupedMatmul/Quant", re.compile(r"GroupedMatmul|w8a8|w4a8|modelslim|quant|mxfp4|mxfp8|per_token", re.I | re.A)),
    ("FlashAttn/MlaProlog", re.compile(r"MlaProlog|FlashAttentionScore|FusedInferAttentionScore|PagedAttention|ChunkGatedDeltaRule", re.I | re.A)),
    ("Mooncake/PD-KVTransfer", re.compile(r"mooncake|kv_transfer_config|kv_connector|1p1d|disagg|llm_datadist|transfer_engine", re.I | re.A)),
    ("NPU-OOM/207001", re.compile(r"NPU out of memory|OutOfMemoryError|\b(?:207001|507011)\b|exit code 137|NPUCachingAllocator", re.I | re.A)),
]


def _extract_url_host_ecosystem(url_str: str) -> str | None:
    """Strictly parse URL scheme & hostname via urllib.parse.urlparse (never match query/path substrings)."""
    s = (url_str or "").strip()
    if not s or re.search(r"\s", s):
        return None
    try:
        parsed = urlparse(s)
        port = parsed.port
    except ValueError:
        return None
    if parsed.scheme.lower() not in ("http", "https"):
        return None
    if parsed.username is not None or parsed.password is not None or port is not None:
        return None
    host = (parsed.hostname or "").lower()
    if host in ("github.com", "www.github.com"):
        return "github"
    if host in ("gitcode.com", "www.gitcode.com"):
        return "gitcode"
    return None


def infer_ecosystem(it: dict[str, Any]) -> str:
    """Infer ecosystem from parsed URL host first before explicit field, key, or repo-owner fallback."""
    url_eco = _extract_url_host_ecosystem(str(it.get("url") or ""))
    if url_eco is not None:
        return url_eco
    explicit = str(it.get("ecosystem") or "").strip().lower()
    if explicit in ("github", "gitcode"):
        return explicit
    key = str(it.get("key") or "").strip().lower()
    if key.startswith("gitcode:"):
        return "gitcode"
    if key.startswith("github:"):
        return "github"
    repo = str(it.get("repo") or "").strip()
    owner = repo.split("/", 1)[0].lower() if "/" in repo else ""
    if owner in ("cann", "ascend"):
        return "gitcode"
    return "github"


def _parse_strict_bool(val: Any) -> bool:
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.strip().lower() == "true"
    return False


_SHORTHAND_REPO_ALIASES: dict[str, tuple[str, str]] = {
    "vllm": ("github", "vllm-project/vllm"),
    "vllm-ascend": ("github", "vllm-project/vllm-ascend"),
}


def _coerce_model_list(val: Any) -> list[Any]:
    """Safely coerce a general model JSON list field: wrap str/int scalars, ignore bool/float/dict/None."""
    if val is None or isinstance(val, (bool, float, dict)):
        return []
    if isinstance(val, list):
        return val
    if isinstance(val, tuple):
        return list(val)
    if isinstance(val, (str, int)):
        return [val]
    return []


def _coerce_citation_list(val: Any) -> list[Any]:
    """Coerce model citation fields, preserving non-empty dicts/floats as unresolved evidence."""
    if val is None or isinstance(val, bool):
        return []
    if isinstance(val, dict):
        return [val] if val else []
    if isinstance(val, list):
        return val
    if isinstance(val, tuple):
        return list(val)
    if isinstance(val, (str, int, float)):
        return [val]
    return []


def _format_canonical_ref(eco: str, repo: str, num: int, default_eco: str) -> str:
    if eco == "gitcode":
        return f"gitcode:{repo}!{num}"
    owner = repo.split("/", 1)[0].lower() if "/" in repo else ""
    if default_eco == "gitcode" or owner in ("ascend", "cann"):
        return f"github:{repo}#{num}"
    return f"{repo}#{num}"


def _parse_url_identity(url_str: str) -> tuple[str, str, int] | None:
    s = (url_str or "").strip()
    if not s or re.search(r"\s", s):
        return None
    if re.search(r"https?://", s[8:], re.I):
        return None
    eco = _extract_url_host_ecosystem(s)
    if eco is None:
        return None
    try:
        parsed = urlparse(s)
    except ValueError:
        return None
    path = parsed.path or ""
    if eco == "github":
        m = re.match(r"^/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)/pull/(\d+)(?:/(?:files|commits|checks)?)?/?$", path, re.I)
        if m:
            num = int(m.group(2))
            return ("github", m.group(1), num) if num > 0 else None
        return None
    if eco == "gitcode":
        m = re.match(
            r"^/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)/(?:pull|merge_requests)/(\d+)(?:/(?:diffs|commits)?)?/?$",
            path,
            re.I,
        )
        if m:
            num = int(m.group(2))
            return ("gitcode", m.group(1), num) if num > 0 else None
        return None
    return None


def _parse_pr_ref(
    raw: Any,
    default_eco: str,
    default_repo: str,
    explicit_url: str = "",
) -> tuple[str, str, int, str] | None:
    """Parse PR/MR ref into (ecosystem, repo, number, canonical_ref) without cross-repo or delimiter spoofing."""
    explicit_url_clean = (explicit_url or "").strip()
    url_id = _parse_url_identity(explicit_url_clean) if explicit_url_clean else None
    if explicit_url_clean and url_id is None:
        return None
    url_eco = url_id[0] if url_id else None

    def _validate_and_pack(
        eco: str,
        repo: str,
        num: int,
        is_bare: bool,
    ) -> tuple[str, str, int, str] | None:
        if num <= 0:
            return None
        if url_id is not None:
            u_eco, u_repo, u_num = url_id
            if is_bare:
                if num != u_num:
                    return None
                eco, repo = u_eco, u_repo
            else:
                if eco != u_eco or repo.lower() != u_repo.lower() or num != u_num:
                    return None
        return (eco, repo, num, _format_canonical_ref(eco, repo, num, default_eco))

    if raw is None or isinstance(raw, (bool, dict, list, tuple, float)):
        return None

    if isinstance(raw, int):
        eco = url_eco or default_eco
        return _validate_and_pack(eco, default_repo, raw, is_bare=True)

    s = str(raw).strip()
    if not s:
        return None

    direct_url = _parse_url_identity(s)
    if direct_url is not None:
        u_eco, u_repo, u_num = direct_url
        return _validate_and_pack(u_eco, u_repo, u_num, is_bare=False)

    gh_pref_m = re.match(r"^github:([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)#(\d+)$", s, re.I)
    if gh_pref_m:
        return _validate_and_pack("github", gh_pref_m.group(1), int(gh_pref_m.group(2)), is_bare=False)

    gc_pref_m = re.match(r"^gitcode:([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)[!#](\d+)$", s, re.I)
    if gc_pref_m:
        return _validate_and_pack("gitcode", gc_pref_m.group(1), int(gc_pref_m.group(2)), is_bare=False)

    bang_m = re.match(r"^([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)!(\d+)$", s)
    if bang_m:
        if url_eco == "github":
            return None
        return _validate_and_pack("gitcode", bang_m.group(1), int(bang_m.group(2)), is_bare=False)

    hash_m = re.match(r"^([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)#(\d+)$", s)
    if hash_m:
        repo, num = hash_m.group(1), int(hash_m.group(2))
        if url_eco:
            eco = url_eco
        elif repo.lower() == default_repo.lower():
            eco = default_eco
        else:
            owner = repo.split("/", 1)[0].lower()
            eco = "gitcode" if owner in ("cann", "ascend") else "github"
        return _validate_and_pack(eco, repo, num, is_bare=False)

    short_m = re.match(r"^([A-Za-z0-9_.-]+)([#!])(\d+)$", s)
    if short_m:
        alias, delim, num = short_m.group(1).lower(), short_m.group(2), int(short_m.group(3))
        if alias in _SHORTHAND_REPO_ALIASES:
            eco, repo = _SHORTHAND_REPO_ALIASES[alias]
            if delim == "!" and eco == "github":
                return None
            return _validate_and_pack(eco, repo, num, is_bare=False)

    bare_m = re.match(r"^([#!]?)(\d+)$", s)
    if bare_m:
        delim, num = bare_m.group(1), int(bare_m.group(2))
        eco = url_eco or default_eco
        # Never fabricate a GitHub same-repo PR ref from GitCode/GitLab MR `!N` syntax
        if delim == "!" and eco != "gitcode":
            return None
        return _validate_and_pack(eco, default_repo, num, is_bare=True)

    return None


def _silence_broken_stdout() -> None:
    try:
        devnull_fd = os.open(os.devnull, os.O_WRONLY)
        try:
            os.dup2(devnull_fd, 1)
        finally:
            os.close(devnull_fd)
    except OSError:
        pass
    try:
        sys.stdout = open(os.devnull, "w", encoding="utf-8")  # noqa: SIM115
    except OSError:
        pass


def safe_stdout_print(msg: str) -> None:
    try:
        print(msg, flush=True)
    except (BrokenPipeError, OSError):
        _silence_broken_stdout()


def log(msg: str) -> None:
    try:
        print(f"[distill-h100] {msg}", file=sys.stderr, flush=True)
    except (BrokenPipeError, OSError):
        pass


def compute_raw_sha256(title: str, body: str, comments_text: str) -> str:
    return hashlib.sha256(f"{title}\n{body}\n{comments_text}".encode("utf-8")).hexdigest()


def load_corpus_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"Corpus JSONL not found: {path}")
    items: list[dict[str, Any]] = []
    seen_by_key: dict[str, dict[str, Any]] = {}
    with path.open("r", encoding="utf-8", newline="\n") as fp:
        for line_no, raw in enumerate(fp, 1):
            line = raw.rstrip("\r\n").strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError as e:
                raise RuntimeError(f"Invalid JSONL at {path}:{line_no}: {e}") from e
            if not isinstance(obj, dict):
                raise RuntimeError(f"Expected JSON object at {path}:{line_no}")
            key = obj.get("key")
            if not isinstance(key, str) or not key.strip():
                raise RuntimeError(f"Missing/invalid 'key' at {path}:{line_no}")
            title = obj.get("title")
            body = obj.get("body")
            comments_text = obj.get("comments_text")
            if not isinstance(title, str) or not isinstance(body, str) or (
                comments_text is not None and not isinstance(comments_text, str)
            ):
                raise RuntimeError(f"Invalid title/body/comments_text types for {key} at {path}:{line_no}")
            raw_pdl = obj.get("pr_diff_lines")
            if raw_pdl is not None and (
                not isinstance(raw_pdl, int) or isinstance(raw_pdl, bool) or raw_pdl < 0
            ):
                raise RuntimeError(f"Invalid pr_diff_lines={raw_pdl!r} for {key} at {path}:{line_no}")
            expected_sha = compute_raw_sha256(title, body, comments_text or "")
            stored_sha = obj.get("raw_sha256")
            if not isinstance(stored_sha, str) or stored_sha != expected_sha:
                raise RuntimeError(
                    f"raw_sha256 mismatch for {key} at {path}:{line_no}: "
                    f"stored={stored_sha!r}, computed={expected_sha!r}"
                )
            if key in seen_by_key:
                if seen_by_key[key] != obj:
                    raise RuntimeError(f"Conflicting duplicate corpus key {key!r} at {path}:{line_no}")
                log(f"Deduplicated identical duplicate corpus key {key!r} at {path}:{line_no}")
                continue
            seen_by_key[key] = obj
            items.append(obj)
    if not items:
        raise RuntimeError(f"Empty corpus JSONL: {path}")
    return items


def _resolve_verified_diff_source(it: dict[str, Any]) -> tuple[str, bool]:
    """Cross-check pr_diff_source_ref / has_diff against linked_merged_prs.

    Returns (source_label, is_bound_to_linked_merged_pr).
    Never invents or blindly trusts an unverified single-PR owner on multi-PR unbound diffs.
    """
    eco = infer_ecosystem(it)
    repo = str(it.get("repo") or "").strip()
    linked_prs = [p for p in (it.get("linked_merged_prs") or []) if isinstance(p, dict)]

    linked_canonical: dict[str, str] = {}
    has_diff_refs: list[str] = []
    for p in linked_prs:
        p_url = str(p.get("url") or "").strip()
        p_raw = p.get("ref") or p_url or p.get("number")
        parsed = _parse_pr_ref(p_raw, eco, repo, explicit_url=p_url)
        if parsed is not None:
            canon = parsed[3]
            linked_canonical[canon.lower()] = canon
            if _parse_strict_bool(p.get("has_diff")):
                has_diff_refs.append(canon)

    raw_src = str(it.get("pr_diff_source_ref") or "").strip()
    if raw_src:
        parsed_src = _parse_pr_ref(raw_src, eco, repo)
        if parsed_src is not None:
            canon_key = parsed_src[3].lower()
            if canon_key in linked_canonical:
                # If multiple distinct linked PRs claim has_diff, or another linked PR uniquely claims it -> unbound
                unique_has_diff_lower = {r.lower() for r in has_diff_refs}
                if len(unique_has_diff_lower) > 1:
                    return ("", False)
                if len(unique_has_diff_lower) == 1 and canon_key not in unique_has_diff_lower:
                    return ("", False)
                return (linked_canonical[canon_key], True)
            # Not in linked_merged_prs -> do not claim merged PR ownership
            return ("", False)
        # Non-PR ref such as commit ref `owner/repo@sha` -> never claim merged PR ownership
        return ("", False)

    unique_has_diff = list(dict.fromkeys(has_diff_refs))
    if len(unique_has_diff) == 1:
        return (unique_has_diff[0], True)
    return ("", False)


def build_user_prompt_with_diff_offset(
    it: dict[str, Any],
    *,
    body_limit: int = 5000,
    comments_limit: int = 2800,
    diff_limit: int = 4200,
) -> tuple[str, int]:
    """Build user prompt and return (prompt_text, diff_section_start_idx).

    `diff_section_start_idx` is the exact char offset of the producer-appended diff header line
    (starting with '\\n'), or -1 when `it` has no `pr_diff_snippet`. Passing this exact offset to
    the prompt budgeter prevents comment/body text that mimics a diff header from ever being
    mistaken for producer-supplied patch evidence.
    """
    ecosystem = infer_ecosystem(it)
    repo = it.get("repo") or ""
    num = it.get("number")
    title = _js_trim(str(it.get("title") or ""))
    body = (it.get("body") or "")[:body_limit]
    comments_text = (it.get("comments_text") or "")[:comments_limit]
    comments_complete = _parse_strict_bool(it.get("comments_complete"))
    linked_prs = [p for p in (it.get("linked_merged_prs") or []) if isinstance(p, dict)]
    pr_refs = [str(p.get("ref") or "") for p in linked_prs if p.get("ref")]
    pr_titles = [
        f"{p.get('ref')}: {p.get('title')}"
        for p in linked_prs
        if p.get("ref") and p.get("title")
    ]
    pr_diff = (it.get("pr_diff_snippet") or "")[:diff_limit]
    pr_diff_source, diff_bound = _resolve_verified_diff_source(it)
    domain_hint = it.get("fault_domain_hint") or ""
    detected_codes = [str(c) for c in (it.get("detected_error_codes") or []) if isinstance(c, str)]

    parts = [
        f"生态: {ecosystem} | 仓库: {repo} #{num}",
        f"标题（严禁复制到 verbatim_root_line）: {title}",
        f"预检测错误码: {', '.join(detected_codes) if detected_codes else '无'} | 领域初判参考: {domain_hint}",
        f"关联已合入 PR/MR: {', '.join(pr_refs) if pr_refs else '无'}",
    ]
    if pr_titles:
        parts.append("PR/MR 标题:\n" + "\n".join(pr_titles[:3]))
    parts.append(f"\n正文摘录:\n{body}")
    parts.append(f"\n评论区摘录 (完整={comments_complete}):\n{comments_text or '无'}")
    prefix = "\n".join(parts)
    if pr_diff:
        if diff_bound and pr_diff_source:
            diff_header = f"\n关联已合入 PR/MR 代码 Diff (来源={pr_diff_source}, 裁剪<=120行):"
        else:
            diff_header = (
                "\n关联代码 Diff 摘录 (未绑定单一已合入 PR/MR，请勿归属给特定已合入 PR/MR，裁剪<=120行):"
            )
        diff_start_idx = len(prefix) + 1  # points to the '\n' right before diff_header text
        return f"{prefix}\n{diff_header}\n```diff\n{pr_diff}\n```", diff_start_idx
    return prefix, -1


def build_user_prompt(
    it: dict[str, Any],
    *,
    body_limit: int = 5000,
    comments_limit: int = 2800,
    diff_limit: int = 4200,
) -> str:
    return build_user_prompt_with_diff_offset(
        it,
        body_limit=body_limit,
        comments_limit=comments_limit,
        diff_limit=diff_limit,
    )[0]


_FORENSIC_CHAIN_STAGE_RE = re.compile(
    r"\[1\.[^\]]+\]\s*\S[\s\S]{3,}?\[2\.[^\]]+\]\s*\S[\s\S]{3,}?\[3\.[^\]]+\]\s*\S[\s\S]{3,}"
)


def _is_valid_forensic_chain(val: Any) -> bool:
    """Enforce the 3-stage forensic chain contract ([1....] [2....] [3....], non-trivial length)."""
    if not isinstance(val, str):
        return False
    s = re.sub(r"\s+", " ", val).strip()
    return len(s) >= 40 and bool(_FORENSIC_CHAIN_STAGE_RE.search(s))


def _has_required_model_schema(obj: dict[str, Any]) -> bool:
    if not obj or not REQUIRED_MODEL_JSON_KEYS.issubset(obj.keys()):
        return False
    rcc = obj.get("root_cause_confirmed")
    if not isinstance(rcc, bool) and not (
        isinstance(rcc, str) and rcc.strip().lower() in ("true", "false")
    ):
        return False
    fd = obj.get("fault_domain")
    sub = obj.get("subsystem")
    if not isinstance(fd, str) or fd.strip() not in VALID_FAULT_DOMAINS:
        return False
    if not isinstance(sub, str) or sub.strip() not in VALID_SUBSYSTEMS:
        return False
    if not isinstance(obj.get("verbatim_root_line"), str):
        return False
    rc_zh = obj.get("root_cause_zh")
    if not isinstance(rc_zh, str) or not rc_zh.strip():
        return False
    if not _is_valid_forensic_chain(obj.get("forensic_chain_zh")):
        return False
    if not isinstance(obj.get("same_code_trap_zh"), str):
        return False
    err_codes = obj.get("error_codes")
    if not isinstance(err_codes, list) or not all(
        isinstance(x, str) or (isinstance(x, int) and not isinstance(x, bool)) for x in err_codes
    ):
        return False
    colloq = obj.get("colloquial_queries_zh")
    if (
        not isinstance(colloq, list)
        or len(colloq) == 0
        or not all(isinstance(x, str) and len(re.sub(r"\s+", " ", x).strip()) >= 4 for x in colloq)
    ):
        return False
    for opt_str_list in ("verbatim_cascade_lines", "fix_pr_refs", "unparsed_fix_pr_citations"):
        if opt_str_list in obj:
            val = obj[opt_str_list]
            if not isinstance(val, list) or not all(isinstance(x, str) for x in val):
                return False
    for opt_nonempty_str in ("hardware_soc", "topology"):
        if opt_nonempty_str in obj:
            val = obj[opt_nonempty_str]
            if not isinstance(val, str) or not val.strip():
                return False
    for opt_str in ("pr_fix_mechanism_zh", "fix_or_workaround_zh"):
        if opt_str in obj and not isinstance(obj[opt_str], str):
            return False
    if "fix_pr_numbers" in obj and obj["fix_pr_numbers"] is not None:
        nums = obj["fix_pr_numbers"]
        if not isinstance(nums, list) or not all(
            (isinstance(x, int) and not isinstance(x, bool) and x > 0)
            or (isinstance(x, str) and bool(re.fullmatch(r"[#!]?[1-9]\d*", x.strip())))
            for x in nums
        ):
            return False
    return True


def extract_json_obj(text: str) -> dict[str, Any] | None:
    """Strictly parse one top-level non-empty JSON object with mandatory schema keys."""
    cleaned = (text or "").strip()
    if not cleaned:
        return None
    # Allow wrapping the entire response in a single fenced json block, nothing outside it
    fence_m = re.fullmatch(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
    if fence_m:
        cleaned = fence_m.group(1).strip()
    if not cleaned.startswith("{"):
        return None
    decoder = json.JSONDecoder()
    for candidate in (cleaned, re.sub(r",\s*([}\]])", r"\1", cleaned)):
        try:
            obj, end_idx = decoder.raw_decode(candidate)
        except Exception:
            continue
        if candidate[end_idx:].strip():
            continue
        if isinstance(obj, dict) and _has_required_model_schema(obj):
            return obj
    return None


def summarize_thinking(think_text: str, max_chars: int = 400) -> str:
    compact = re.sub(r"\s+", " ", (think_text or "").strip())
    if len(compact) <= max_chars:
        return compact
    # Keep opening diagnosis + closing conclusion so summary stays maximally informative
    head_len = max_chars - 145
    tail_len = 140
    return f"{compact[:head_len].rstrip()} ... {compact[-tail_len:].lstrip()}"[:max_chars]


def split_thinking_and_json(raw_out: str) -> tuple[str, dict[str, Any] | None]:
    """Parse Qwen3.8 / Qwen3 thinking output strictly outside <think>...</think>."""
    text = raw_out or ""
    tag_matches = list(re.finditer(r"</?think>", text, re.IGNORECASE))
    if not tag_matches:
        parsed = extract_json_obj(text)
        return "", parsed

    # Track tag balance; Qwen chat_template appends '<think>\n' in the prompt so a leading '</think>' closes depth=1.
    # Reject any non-whitespace content outside <think>...</think> before the final closing tag (e.g. two JSON objects).
    depth = 1 if tag_matches[0].group(0).lower() == "</think>" else 0
    if depth == 0 and text[: tag_matches[0].start()].strip():
        return summarize_thinking(re.sub(r"</?think>", " ", text, flags=re.I), max_chars=400), None
    last_close_end = -1
    for m in tag_matches:
        tag = m.group(0).lower()
        if tag == "<think>":
            if depth == 0 and last_close_end >= 0 and text[last_close_end : m.start()].strip():
                return summarize_thinking(re.sub(r"</?think>", " ", text, flags=re.I), max_chars=400), None
            depth += 1
        else:
            depth -= 1
            if depth < 0:
                return summarize_thinking(re.sub(r"</?think>", " ", text, flags=re.I), max_chars=400), None
            if depth == 0:
                last_close_end = m.end()

    if depth != 0 or last_close_end < 0:
        # Unclosed or unbalanced <think> block -> final answer missing
        return summarize_thinking(re.sub(r"</?think>", " ", text, flags=re.I), max_chars=400), None

    think_part = re.sub(r"</?think>", " ", text[:last_close_end], flags=re.I)
    answer_part = text[last_close_end:]
    parsed = extract_json_obj(answer_part)
    return summarize_thinking(think_part, max_chars=400), parsed


def _normalize_title_compare(s: str) -> str:
    cur = s.strip()
    while cur:
        nxt = re.sub(r"^(?:[>\-*+#]+\s*)+", "", cur)
        nxt = re.sub(r"^(?:\[[^\]]+\]\s*)+[:：]?\s*", "", nxt)
        nxt = re.sub(r"^(\*{1,3}|_{1,3}|~{2})(.+?)\1$", r"\2", nxt)
        nxt = nxt.strip(" \t\"'`*_~「」『』“”‘’")
        if nxt == cur:
            break
        cur = nxt
    return re.sub(r"\s+", " ", cur).strip().lower()


def _is_title_leak(candidate: str, title: str) -> bool:
    cand = _js_trim(candidate)
    t = _js_trim(title)
    if not cand or not t:
        return False
    if cand == t or cand in t:
        return True
    cand_norm = _normalize_title_compare(cand)
    t_norm = _normalize_title_compare(t)
    if cand_norm and t_norm and (cand_norm == t_norm or cand_norm in t_norm):
        return True
    return False


_NON_WS_DIAG_PUNCT_RE = re.compile(r"[:=()\[\]{}<>/\\|'`\",!?;@#$%^&*_]")
_CAMEL_IDENT_RE = re.compile(r"[a-z][A-Z]")
_CRASH_PHRASE_RE = re.compile(
    r"\b(?:segmentation fault|out of memory|core dumped|address already in use|undefined symbol)\b",
    re.IGNORECASE | re.ASCII,
)
_PRECEDING_NEGATION_EN_RE = re.compile(
    r"(?:^|[ \t,(\[\"'“‘])(?:no|not|never|without|neither|nor|didn't|did[ \t]+not|doesn't|does[ \t]+not|"
    r"won't|will[ \t]+not|cannot|can't|absent|none[ \t]+of)"
    r"(?:[ \t]+(?:any|a|an|the|such|longer|more|further|observed|see|seen|saw|trigger|triggered|"
    r"hit|raise|raised|throw|thrown|occur|occurred|report|reported|have|had))*[ \t]*[\"'`“‘(]*$",
    re.IGNORECASE | re.ASCII,
)
_PRECEDING_NEGATION_ZH_RE = re.compile(
    r"(?:没有|未出现|未见|不会报|未报|并未报|并未出现|不报|不是|并非|而非|无)[ \t]*[\"'`“‘(]*$"
)
_NEGATED_PROSE_LINE_RE = re.compile(
    r"^(?:there[ \t]+(?:is|was|were|are)[ \t]+no\b|"
    r"(?:we|i|it|this[ \t]+run)[ \t]+(?:did[ \t]+not|didn't|never)[ \t]+(?:see|hit|get|observe|encounter|reproduce)\b|"
    r"没有出现|未见|并未出现|未复现)",
    re.IGNORECASE | re.ASCII,
)


_DIAG_KEYWORD_RE = re.compile(
    r"\b(?:error|exception|failed|failure|fault|exceeds|overflow|invalid|crash(?:ed)?|"
    r"abort(?:ed)?|panic|segfault|denied|refused|unreachable|mismatch|unsupported|corrupt|"
    r"terminated|killed|assert(?:ion)?)\b",
    re.IGNORECASE | re.ASCII,
)


def _is_non_trivial_verbatim_span(cand: str, is_exact_line: bool) -> bool:
    if len(cand) < 8:
        return False
    if re.fullmatch(r"\[[A-Za-z0-9_]+\]", cand):
        return False
    has_non_ws_diag = bool(_NON_WS_DIAG_PUNCT_RE.search(cand))
    has_digit = bool(re.search(r"[0-9]", cand))
    has_camel = bool(_CAMEL_IDENT_RE.search(cand))
    has_crash = bool(_CRASH_PHRASE_RE.search(cand))
    has_diag_kw = bool(_DIAG_KEYWORD_RE.search(cand))
    is_bare_upper = bool(re.fullmatch(r"[A-Z][A-Z0-9_]{5,}", cand))
    is_exc_or_macro = bool(
        re.search(r"(?:Error|Exception|Fault|Timeout|Segfault|Abort|Panic|Assert)$", cand)
        or (
            is_bare_upper
            and _is_valid_error_code_token(cand)
            and not re.search(r"_(?:NONE|SUCCESS|OK)$", cand, re.I)
        )
    )
    if is_bare_upper and not is_exc_or_macro:
        return False
    if is_exact_line:
        if _NEGATED_PROSE_LINE_RE.search(cand):
            return False
        # Require concrete diagnostic/code/numeric/error structure even on whole lines
        # (rejects plain prose like "Only never timeout is supported")
        return has_non_ws_diag or has_digit or has_camel or has_crash or is_exc_or_macro or has_diag_kw
    # Substring spans inside a longer line must be substantial AND carry concrete diagnostic/code/numeric structure
    return len(cand) >= 12 and (has_non_ws_diag or has_digit or has_camel or has_crash)


def _is_negated_occurrence(line: str, idx: int) -> bool:
    prefix = line[:idx]
    clause_prefix = re.split(r"[.;!?\n。；！？]", prefix)[-1]
    return bool(
        _PRECEDING_NEGATION_EN_RE.search(clause_prefix) or _PRECEDING_NEGATION_ZH_RE.search(clause_prefix)
    )


def _matches_valid_substring_occurrence(line: str, cand: str) -> bool:
    start = 0
    is_word_start = bool(re.match(r"[A-Za-z0-9_]", cand[0]))
    is_word_end = bool(re.match(r"[A-Za-z0-9_]", cand[-1]))
    while True:
        idx = line.find(cand, start)
        if idx < 0:
            return False
        left_ok = not is_word_start or idx == 0 or not re.match(r"[A-Za-z0-9_]", line[idx - 1])
        end_idx = idx + len(cand)
        right_ok = not is_word_end or end_idx == len(line) or not re.match(r"[A-Za-z0-9_]", line[end_idx])
        if left_ok and right_ok and not _is_negated_occurrence(line, idx):
            return True
        start = idx + 1


def _is_single_line_in_source_field(candidate: str, body: str, comments_text: str) -> bool:
    if not candidate or _ANY_LINE_BREAK_RE.search(candidate):
        return False
    cand = _js_trim(candidate)
    if not cand:
        return False
    for field_text in (body, comments_text):
        if not field_text or cand not in field_text:
            continue
        for raw_ln in _LINE_BREAK_RE.split(field_text):
            if cand not in raw_ln:
                continue
            is_exact_line = cand == _js_trim(raw_ln)
            if not _is_non_trivial_verbatim_span(cand, is_exact_line):
                continue
            if is_exact_line or _matches_valid_substring_occurrence(raw_ln, cand):
                return True
    return False


def _is_valid_error_code_token(tok: str) -> bool:
    if not tok or len(tok) > 48 or not tok.isascii() or _ANY_LINE_BREAK_RE.search(tok):
        return False
    up = tok.upper()
    if up in ("TRUE", "FALSE", "NULL", "NONE", "UNKNOWN", "NAN"):
        return False
    if up in _POSIX_ERR_CODES:
        return True
    if _UPPER_ERROR_MACRO_RE.fullmatch(tok) and _ERROR_MACRO_HINT_RE.search(tok):
        return True
    if not _ERROR_CODE_TOKEN_RE.fullmatch(tok):
        return False
    # Pure alphabetic tokens must be known POSIX/SIG macros or prefixed symbolic codes with underscore
    if tok.isalpha():
        return up in _POSIX_ERR_CODES
    return True


def _contains_whole_error_code(code_upper: str, haystack_upper: str) -> bool:
    if not code_upper:
        return False
    prefix = r"(?<![A-Z0-9_])" if re.match(r"^[A-Z0-9_]", code_upper) else ""
    suffix = r"(?![A-Z0-9_])" if re.search(r"[A-Z0-9_]$", code_upper) else ""
    return bool(re.search(prefix + re.escape(code_upper) + suffix, haystack_upper))


_MAINTAINER_CLOSURE_RE = re.compile(
    r"^\[[^\]]+\]:[ \t]*(?:已通过|感谢反馈|关联[ \t]*(?:PR|MR)|已合入|已修复|您好|收到|经确认|确认是|(?:PR|MR)[ \t]*[#!][0-9]+)|"
    r"(?:已通过[ \t]*(?:PR|MR)[ \t]*[#!][0-9]+|通过代码走查发现|尚未在.*设备上复现|"
    r"请提供该场景的最小复现|请补充.{0,20}复现|建议补充.{0,20}复现)",
    re.ASCII,
)
_RUNTIME_LOG_MARKER_RE = re.compile(
    r"\[ERROR\]|Traceback \(most recent call last\)|RuntimeError:|ValueError:|AssertionError:|"
    r"TypeError:|KeyError:|ImportError:|NPU function error:|HCCL function error:|retCode=0x|"
    r"error code is [0-9]+|failed with error|AclNN_(?:Parameter|Inner|Check|Op|Graph|Runtime)|"
    r"free\(\): invalid pointer",
    re.IGNORECASE | re.ASCII,
)
_CJK_CHAR_RE = re.compile(r"[\u4e00-\u9fff]")
_TRAILING_COMMENT_SPLIT_RE = re.compile(r"[ \t]+(?:#[ \t]+|←[ \t]*|<-[ \t]*|//[ \t]*)", re.ASCII)
_HYPOTHETICAL_PROSE_RE = re.compile(
    r"(?:若.{0,30}(?:会触发|将触发|会引发|将引发|会导致|将导致)|"
    r"当.{0,35}时.{0,25}(?:会|将).{0,25}(?:触发|引发|导致|解引用)|"
    r"引发段错误|触发[ \t]*`?SIGSEGV`?|形成对.{0,25}拒绝服务|返回码应为|"
    r"超过系统上限时.{0,20}返回|时(?:，|,)?[ \t]*(?:应|直接)?返回[ \t]*`?(?:HCCL_E_|ACL_ERROR_|ACLNN_|EZ[0-9]{4}|1610[0-9]{2})|"
    r"应返回[ \t]*`?(?:HCCL_E_|ACL_ERROR_|ACLNN_|EZ[0-9]{4}|1610[0-9]{2})|若不一致.{0,10}返回|"
    r"该参数在算子原型中|预期应与实现一致|中文[ \t]*API[ \t]*错误码参考|头文件定义的|按内存不足排障)",
    re.ASCII,
)
_PROSE_NOT_LOG_RE = re.compile(
    r"(?:本[ \t]*Issue[ \t]*汇总|汇总合并|整改前|整改范围|换正式错误码|补负向[ \t]*UT|批量整改|批量合并|"
    r"文档声明|用例汇总|按公开文档|而非文档承诺|开展审计与整改|审计与整改|"
    r"静态命中[ \t]*[0-9]+[ \t]*条|替换为正式语义码|重复首报去重|复扫[ \t]*EZ9999|"
    r"一次故障.{0,12}(?:两个首错|只产生一条首错)|淹没根因码|"
    r"再次[ \t]*(?:执行[ \t]*)?`?OP_LOGE`?|外层包装(?:处)?.{0,20}(?:`?OP_LOGE`?|补报|不再二次上报)|"
    r"按检查语义逐处替换|符合仓内错误码规范|中英文(?:接口)?文档|资料[ \t]*[0-9]{6}[ \t]*行的|"
    r"可考虑在|固定源码|源码证据|快车道轻检|去重反向对照实验|实测摘要|"
    r"用[ \t]*mock[ \t]*模板|使用测试模板|在[ \t]*ST[ \t]*stub[ \t]*或[ \t]*UT[ \t]*中|观察缺陷组|原包.{0,20}均返回|"
    r"^[0-9]+\.[ \t]+.{0,80}返回错误码|"
    r"^(?:[-*+]|[0-9]+\.)[ \t]+`?[A-Za-z0-9_./-]+\.(?:cc|cpp|c|h|hpp|py)(?::[0-9]+)?`?[ \t]+.{0,120}(?:仍返回|定义|返回[ \t]*`?(?:HCCL_E_|ACL_ERROR_|ACLNN_))|"
    r"^[ \t]*#[ \t]*(?:修复前|修复后|修改前|修改后|期望结果|预期结果|实际结果|复现步骤|注释|说明)[:：]|"
    r"^[ \t]*[-*+][ \t]+\[`[^`]+\]`[ \t]*(?:级联|cascade|报错)?[:：]|"
    r"`[^`]+`[ \t]*→[ \t]*`[^`]+`|"
    r"^[ \t]*self\.[A-Za-z_][A-Za-z0-9_.]*[ \t]*\(|"
    r"\b(?:REPORT_INNER_ERR_MSG|OP_LOGE|HCCL_ERROR)[ \t]*\(|^[ \t]*return[ \t]+(?:HCCL_E_|ACL_ERROR_|ACLNN_)|"
    r"\b(?:negative control|without this patch)\b|"
    r"\b(?:crashes with|fails with|fails during)\b|"
    r"^On startup,[ \t]+|^[0-9]+\.[ \t]+编译运行|"
    r"\b(?:raised|returned|failed with)[ \t]+`(?:E[EZIJLMW][0-9]{4}|[1-9][0-9]{5}|[A-Z][A-Z0-9_]{3,})`|"
    r"`?OP_LOGE`?[ \t]*裸宏|裸[ \t]*`?OP_LOGE`?|无结构化错误信息|报错口径不一致|"
    r"按预定义错误码解析|头文件定义|校验失败路径统一使用|错误码全部落为|隐式向[ \t]*ErrorManager[ \t]*上报)",
    re.ASCII,
)
_CPP_LOG_MACRO_CALL_RE = re.compile(
    r"\b(?:REPORT_INNER_ERR_MSG|OP_LOG[EWDIF](?:_[A-Z0-9_]+)?|OPS_LOG_[EWDIF]|"
    r"HCCL_(?:ERROR|WARNING|INFO|DEBUG|EVENT)|ACL_LOG_(?:ERROR|WARN|INFO|EVENT)|"
    r"ASCEND_LOG[EWDIF]|GELOG[EWDIF]|CHK_PRT_RET)[ \t]*\(|"
    r"^[ \t]*return[ \t]+(?:HCCL_E_|ACL_ERROR_|ACLNN_)|"
    r'^[ \t]*"[^"]*"[ \t]*\)[ \t]*;?[ \t]*$',
    re.ASCII,
)
_PY_LOG_CALL_LINE_RE = re.compile(
    r"\b(?:warnings\.warn|logger\.(?:error|warning|warn|info|debug|exception|critical|fatal)|"
    r"logging\.(?:error|warning|warn|info|debug|exception|critical|fatal))[ \t]*\(",
    re.ASCII,
)
_PY_LOG_ARG_CONT_RE = re.compile(
    r"^[ \t]*(?:[fFrRuUbB]{0,2}[\"']|[A-Za-z_][A-Za-z0-9_]*[ \t]*=[ \t]*[fFrRuUbB]{0,2}[\"']|\)[ \t]*$)",
    re.ASCII,
)
_NARRATIVE_PROSE_OVERRIDE_RE = re.compile(
    r"\b(?:crashes with|fails with|fails during)[ \t]+`?[A-Za-z0-9_.\[]|"
    r"\b(?:raised|returned)[ \t]+`[A-Za-z0-9_]|"
    r"\b(?:was|is)[ \t]+a[ \t]+`?(?:RuntimeError|ValueError|AssertionError|KeyError|TypeError|IndexError|OSError|ImportError):|"
    r"^[ \t]*-[ \t]+Error:[ \t]+.*plog reports\b",
    re.IGNORECASE | re.ASCII,
)
_MARKDOWN_PR_OR_LINK_LIST_RE = re.compile(
    r"https?://(?:www\.)?(?:github|gitcode)\.com/[^/ \t\r\n]+/[^/ \t\r\n]+/(?:pull|merge_requests|issues|actions/runs)/[0-9]+",
    re.IGNORECASE | re.ASCII,
)


def _is_markdown_pr_or_link_list_line(line: str) -> bool:
    trimmed = _js_trim(line or "")
    if not trimmed:
        return False
    if _MARKDOWN_PR_OR_LINK_LIST_RE.search(trimmed):
        return True
    s = re.sub(r"^(?:[-*+]|[0-9]+\.)[ \t]+", "", trimmed)
    n = len(s)
    i = 0
    link_count = 0
    sep_chars = set(" \t,;|/·-—–•")
    while i < n:
        while i < n and s[i] in sep_chars:
            i += 1
        if i >= n:
            break
        if s[i] != "[":
            return False
        br_depth = 1
        k = i + 1
        while k < n and br_depth > 0:
            if s[k] == "\\" and k + 1 < n:
                k += 2
                continue
            if s[k] == "`":
                bt_start = k
                while k < n and s[k] == "`":
                    k += 1
                bt_len = k - bt_start
                # Scan for matching CommonMark backtick run of exact length bt_len
                m = k
                found_close = -1
                while m < n:
                    if s[m] == "`":
                        run_s = m
                        while m < n and s[m] == "`":
                            m += 1
                        if m - run_s == bt_len:
                            found_close = m
                            break
                    else:
                        m += 1
                if found_close >= 0:
                    k = found_close
                continue
            if s[k] == "[":
                br_depth += 1
            elif s[k] == "]":
                br_depth -= 1
            k += 1
        close_br = k - 1
        if br_depth != 0 or close_br < i + 1 or close_br + 1 >= n:
            return False
        nxt = s[close_br + 1]
        if nxt == "(":
            depth = 1
            in_quote = ""
            in_angle = False
            j = close_br + 2
            while j < n and depth > 0:
                ch = s[j]
                if ch == "\\" and j + 1 < n:
                    j += 2
                    continue
                if in_quote:
                    if ch == in_quote:
                        in_quote = ""
                elif in_angle:
                    if ch == ">":
                        in_angle = False
                else:
                    at_ws_boundary = j == close_br + 2 or s[j - 1] in (" ", "\t")
                    if ch in ('"', "'") and at_ws_boundary:
                        in_quote = ch
                    elif ch == "<" and at_ws_boundary:
                        in_angle = True
                    elif ch == "(":
                        depth += 1
                    elif ch == ")":
                        depth -= 1
                j += 1
            if depth != 0 or in_quote or in_angle:
                return False
            link_count += 1
            i = j
        elif nxt == "[":
            close_ref = s.find("]", close_br + 2)
            if close_ref < 0:
                return False
            link_count += 1
            i = close_ref + 1
        else:
            return False
    return link_count >= 1


_STRICT_LOG_LINE_START_RE = re.compile(
    r"^(?:\[(?:ERROR|WARN(?:ING)?|FATAL|CRITICAL|PID:|rank[0-9]+|HYBM)\b|"
    r"(?:ERROR|FATAL|CRITICAL)[ \t]+[0-9]|"
    r"Traceback \(most recent call last\):|"
    r"(?:RuntimeError|ValueError|AssertionError|TypeError|KeyError|ImportError|AttributeError|"
    r"IndexError|OSError|MemoryError|NotImplementedError|TimeoutError|ZMQError|OutOfMemoryError|"
    r"DistBackendError|ProcessRaisedException):|"
    r"AclNN_(?:Parameter|Inner|Check|Op|Graph|Runtime)|"
    r"NPU out of memory|NPU function error:|HCCL function error:|"
    r"E[EZIJLMW][0-9]{4}\b|E[1-9][0-9]{4}\b|Segmentation fault|free\(\): invalid pointer)",
    re.IGNORECASE | re.ASCII,
)
_FALLBACK_CODE_STMT_RE = re.compile(
    r"^(?://|return[ \t]+|if[ \t]*\(|for[ \t]*\(|while[ \t]*\(|case[ \t]+|#include\b|int[ \t]+|void[ \t]+|bool[ \t]+|const[ \t]+|"
    r"print[ \t]*\(|printf[ \t]*\(|[A-Z_][A-Z0-9_]*[ \t]*=[ \t]*[\"']|r[ \t]*=[ \t]*aclnn|`?HCCL_SUCCESS[ \t]*=|"
    r"[A-Za-z_][A-Za-z0-9_]*[ \t]*==[ \t]*[0-9]+[ \t]*\?|"
    r"(?:The[ \t]+(?:job|failure)[ \t]+|This |In the |When |After |During |Before |Note:|However,|Although |Because |While |Here |For )[a-z])|"
    r"\b(?:CHK_PRT_RET|HCOM_ERROR_CODE|ctypes\.CDLL)[ \t]*\(|"
    r"\),[ \t]*(?:HCCL_E_|ACL_ERROR_|ACLNN_)[A-Z0-9_]+[ \t]*\)[ \t]*;?$|"
    r"\b(?:there[ \t]+(?:is|was|were|are)[ \t]+no|ruled[ \t]+out)\b",
    re.ASCII,
)


def _cpp_macro_open_paren_step(
    text: str, in_block_comment: bool, is_py_call: bool = False
) -> tuple[int, bool]:
    depth = 0
    in_quote = ""
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        if in_block_comment:
            if ch == "*" and i + 1 < n and text[i + 1] == "/":
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue
        if in_quote:
            if ch == "\\" and i + 1 < n:
                i += 2
                continue
            if ch == in_quote:
                in_quote = ""
            i += 1
            continue
        if is_py_call and ch == "#":
            break
        if not is_py_call and ch == "/" and i + 1 < n:
            nxt = text[i + 1]
            if nxt == "/":
                break
            if nxt == "*":
                in_block_comment = True
                i += 2
                continue
        if ch == '"':
            in_quote = '"'
        elif ch == "'":
            is_digit_sep = (
                not is_py_call
                and i > 0
                and i + 1 < n
                and bool(re.match(r"[0-9A-Za-z]", text[i - 1]))
                and bool(re.match(r"[0-9A-Za-z]", text[i + 1]))
            )
            if not is_digit_sep:
                in_quote = "'"
        elif ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        i += 1
    return depth, in_block_comment


def _is_inside_cpp_log_macro_call(lines: list[str], idx: int) -> bool:
    if _CPP_LOG_MACRO_CALL_RE.search(lines[idx]):
        return True
    start = max(0, idx - 64)
    for p in range(idx - 1, start - 1, -1):
        prev_line = lines[p]
        if prev_line.lstrip().startswith("```"):
            break
        if re.match(r"^[ \t]*(?://|#)", prev_line):
            continue
        m = _CPP_LOG_MACRO_CALL_RE.search(prev_line)
        if m is not None and "(" in prev_line[m.start() :]:
            if "//" in prev_line[: m.start()]:
                continue
            paren_pos = prev_line.find("(", m.start())
            if paren_pos >= 0:
                depth, in_bc = _cpp_macro_open_paren_step(prev_line[paren_pos:], False)
                for q in range(p + 1, idx):
                    if lines[q].lstrip().startswith("```"):
                        depth = 0
                        break
                    if depth <= 0 and not in_bc:
                        break
                    delta, in_bc = _cpp_macro_open_paren_step(lines[q], in_bc)
                    depth += delta
                if depth > 0:
                    return True
    return False


def _is_inside_py_log_call_arg(lines: list[str], idx: int) -> bool:
    if _PY_LOG_CALL_LINE_RE.search(lines[idx]):
        return True
    if not _PY_LOG_ARG_CONT_RE.search(lines[idx]):
        return False
    start = max(0, idx - 8)
    for p in range(idx - 1, start - 1, -1):
        prev = lines[p]
        s = _js_trim(prev)
        if not s or s.startswith("```"):
            break
        if re.search(
            r"(?:UserWarning|DeprecationWarning|FutureWarning|ImportWarning):|^[ \t]*(?:\[ERROR\]|Traceback \(most recent call last\):|\(EngineCore|\[rank[0-9]+\]:)",
            s,
        ):
            break
        m = _PY_LOG_CALL_LINE_RE.search(prev)
        if m is not None and "(" in prev[m.start() :] and "#" not in prev[: m.start()]:
            depth = 0
            for q in range(p, idx):
                seg = lines[q][m.start() :] if q == p else lines[q]
                in_q = ""
                k = 0
                while k < len(seg):
                    ch = seg[k]
                    if in_q:
                        if ch == "\\" and k + 1 < len(seg):
                            k += 2
                            continue
                        if ch == in_q:
                            in_q = ""
                    elif ch == "#":
                        break
                    elif ch in ('"', "'"):
                        in_q = ch
                    elif ch == "(":
                        depth += 1
                    elif ch == ")":
                        depth -= 1
                    k += 1
                if depth <= 0:
                    break
            if depth > 0:
                return True
    return False


def _is_prose_summary_not_runtime_log(line: str) -> bool:
    trimmed = _js_trim(line or "")
    if not trimmed:
        return False
    if _MAINTAINER_CLOSURE_RE.search(trimmed):
        return True
    if _CPP_LOG_MACRO_CALL_RE.search(trimmed) or _PY_LOG_CALL_LINE_RE.search(trimmed):
        return True
    is_strict_log = bool(_STRICT_LOG_LINE_START_RE.search(trimmed))
    if not is_strict_log and _NARRATIVE_PROSE_OVERRIDE_RE.search(trimmed):
        return True
    rt_match = _RUNTIME_LOG_MARKER_RE.search(trimmed)
    if rt_match is not None:
        if len(_CJK_CHAR_RE.findall(trimmed[: rt_match.start()])) < 16:
            return False
    if re.fullmatch(r"\|.*\|", trimmed):
        return True
    if _HYPOTHETICAL_PROSE_RE.search(trimmed):
        return True
    if not is_strict_log and _PROSE_NOT_LOG_RE.search(trimmed):
        return True
    main_part = _TRAILING_COMMENT_SPLIT_RE.split(trimmed, maxsplit=1)[0]
    return len(_CJK_CHAR_RE.findall(main_part)) >= 14


def _has_non_prose_source_occurrence(candidate: str, body: str, comments_text: str) -> bool:
    if not candidate or _ANY_LINE_BREAK_RE.search(candidate):
        return False
    cand = _js_trim(candidate)
    if not cand:
        return False
    cand_rt = _RUNTIME_LOG_MARKER_RE.search(cand)
    cand_is_direct_runtime_log = (
        cand_rt is not None and len(_CJK_CHAR_RE.findall(cand[: cand_rt.start()])) < 16
    )
    for field_text in (body, comments_text):
        if not field_text or cand not in field_text:
            continue
        lines = _LINE_BREAK_RE.split(field_text)
        for line_idx, raw_ln in enumerate(lines):
            if cand not in raw_ln:
                continue
            trimmed_ln = _js_trim(raw_ln)
            is_exact_line = cand == trimmed_ln
            if not _is_non_trivial_verbatim_span(cand, is_exact_line):
                continue
            if not is_exact_line and not _matches_valid_substring_occurrence(raw_ln, cand):
                continue
            if _is_markdown_pr_or_link_list_line(trimmed_ln):
                continue
            ln_is_strict = bool(_STRICT_LOG_LINE_START_RE.search(trimmed_ln))
            if (
                _MAINTAINER_CLOSURE_RE.search(trimmed_ln)
                or _PY_LOG_CALL_LINE_RE.search(trimmed_ln)
                or (not ln_is_strict and _NARRATIVE_PROSE_OVERRIDE_RE.search(trimmed_ln))
                or _is_inside_py_log_call_arg(lines, line_idx)
                or _is_inside_cpp_log_macro_call(lines, line_idx)
            ):
                continue
            if not is_exact_line and cand_is_direct_runtime_log:
                if (
                    not re.fullmatch(r"\|.*\|", trimmed_ln)
                    and not _HYPOTHETICAL_PROSE_RE.search(trimmed_ln)
                    and (ln_is_strict or not _PROSE_NOT_LOG_RE.search(trimmed_ln))
                ):
                    return True
                continue
            if not _is_prose_summary_not_runtime_log(raw_ln):
                return True
    return False


def extract_fallback_verbatim_root_line(
    title: str,
    body: str,
    comments_text: str,
    hint_codes: list[str],
) -> str:
    """Deterministically pick the strongest exact single log line from body or comments, excluding title & PR lists."""
    best_line = ""
    best_score = -1
    hint_upper = {c.upper() for c in hint_codes if isinstance(c, str) and c.strip()}

    for field_text in (body, comments_text):
        lines = _LINE_BREAK_RE.split(field_text)
        for line_idx, raw_ln in enumerate(lines):
            ln = _js_trim(raw_ln)
            if len(ln) < 18 or len(ln) > 480:
                continue
            if ln.startswith(("```", "#", "| ", "---", "===", "http://", "https://", ">", "- ", "* ", "+ ")):
                continue
            if re.match(r"^[0-9]+\.[ \t]+", ln):
                continue
            if _FALLBACK_CODE_STMT_RE.search(ln):
                continue
            if _is_inside_py_log_call_arg(lines, line_idx) or _is_inside_cpp_log_macro_call(lines, line_idx):
                continue
            if _is_markdown_pr_or_link_list_line(ln):
                continue
            if _is_prose_summary_not_runtime_log(ln):
                continue
            main_part = _TRAILING_COMMENT_SPLIT_RE.split(ln, maxsplit=1)[0]
            if len(_CJK_CHAR_RE.findall(main_part)) >= 4 and not _STRICT_LOG_LINE_START_RE.search(ln):
                continue
            if _is_title_leak(ln, title):
                continue
            if not _is_single_line_in_source_field(ln, body, comments_text):
                continue
            score = 0
            for weight, pat in FALLBACK_LOG_LINE_PATTERNS:
                if pat.search(ln):
                    score = max(score, weight)
            if score == 0:
                continue
            ln_up = ln.upper()
            for code in hint_upper:
                if _contains_whole_error_code(code, ln_up):
                    score += 2
                    break
            if "[ERROR]" in ln or "RuntimeError:" in ln or "NPU function error:" in ln:
                score += 2
            if score > best_score:
                best_score = score
                best_line = ln
    return best_line


def verify_and_normalize_distilled(
    it: dict[str, Any],
    parsed: dict[str, Any] | None,
    thinking_summary: str,
    *,
    teacher_model: str = "",
    teacher_backend: str = "",
    teacher_dtype: str = "",
    max_new_tokens: int = 1536,
) -> dict[str, Any]:
    answer_parsed = parsed is not None
    data = dict(parsed or {})
    raw_title = it.get("title") or ""
    title = raw_title.strip()
    body = it.get("body") or ""
    comments_text = it.get("comments_text") or ""
    computed_raw_sha = compute_raw_sha256(raw_title, body, comments_text)
    stored_raw_sha = it.get("raw_sha256")
    if stored_raw_sha is not None and stored_raw_sha != computed_raw_sha:
        raise ValueError(
            f"raw_sha256 mismatch for {it.get('key')!r}: stored={stored_raw_sha!r}, computed={computed_raw_sha!r}"
        )
    full_haystack = f"{title}\n{body}\n{comments_text}"
    full_upper = full_haystack.upper()

    # 1. Ground error_codes FIRST so fallback root selection uses the exact same grounded hints as checkpoint replay!
    grounded_codes: list[str] = []
    seen_codes: set[str] = set()
    for raw_c in _coerce_model_list(data.get("error_codes")) + list(
        it.get("detected_error_codes") or []
    ):
        if raw_c is None or isinstance(raw_c, (bool, dict, list, tuple, float)):
            continue
        tok = str(raw_c).strip()
        if not _is_valid_error_code_token(tok):
            continue
        up = tok.upper()
        if up in seen_codes:
            continue
        if _contains_whole_error_code(up, full_upper):
            seen_codes.add(up)
            grounded_codes.append(tok)
    grounded_codes = grounded_codes[:12]

    # 2. Strict single-line same-field verbatim_root_line verification (HARD REJECT empty, title copy, prose, or link lists!)
    raw_root_val = data.get("verbatim_root_line")
    raw_root = _js_trim(raw_root_val) if isinstance(raw_root_val, str) else ""
    rejected_root = ""
    if (
        raw_root
        and _is_single_line_in_source_field(raw_root, body, comments_text)
        and not _is_title_leak(raw_root, title)
        and not _is_prose_summary_not_runtime_log(raw_root)
        and not _is_markdown_pr_or_link_list_line(raw_root)
        and _has_non_prose_source_occurrence(raw_root, body, comments_text)
    ):
        final_root = raw_root
        root_verified = True
        root_source = "model"
    else:
        rejected_root = raw_root
        hint_codes = list(it.get("detected_error_codes") or []) + list(grounded_codes)
        fallback = extract_fallback_verbatim_root_line(title, body, comments_text, hint_codes)
        if (
            fallback
            and _is_single_line_in_source_field(fallback, body, comments_text)
            and not _is_title_leak(fallback, title)
            and not _is_prose_summary_not_runtime_log(fallback)
            and not _is_markdown_pr_or_link_list_line(fallback)
            and _has_non_prose_source_occurrence(fallback, body, comments_text)
        ):
            final_root = fallback
            root_verified = True
            root_source = "fallback_log_extractor"
        else:
            final_root = ""
            root_verified = False
            root_source = "rejected"

    # 3. Strict verbatim_cascade_lines verification (exact single-line non-prose spans within body or comments)
    raw_cascades = _coerce_model_list(data.get("verbatim_cascade_lines"))
    verified_cascades: list[str] = []
    for c in raw_cascades:
        if not isinstance(c, str):
            continue
        cs = _js_trim(c)
        if (
            len(cs) >= 12
            and cs != final_root
            and _is_single_line_in_source_field(cs, body, comments_text)
            and not _is_title_leak(cs, title)
            and not _is_prose_summary_not_runtime_log(cs)
            and not _is_markdown_pr_or_link_list_line(cs)
            and _has_non_prose_source_occurrence(cs, body, comments_text)
            and cs not in verified_cascades
        ):
            verified_cascades.append(cs)
        if len(verified_cascades) >= 4:
            break

    # 4. Normalize fault_domain and subsystem (compatible with verify-distilled-ascend.ts)
    raw_domain = data.get("fault_domain")
    fault_domain = raw_domain.strip() if isinstance(raw_domain, str) else ""
    if fault_domain not in VALID_FAULT_DOMAINS:
        hint = str(it.get("fault_domain_hint") or "other").strip()
        fault_domain = hint if hint in VALID_FAULT_DOMAINS else "other"

    raw_sub = data.get("subsystem")
    subsystem = raw_sub.strip() if isinstance(raw_sub, str) else ""
    if subsystem not in VALID_SUBSYSTEMS:
        subsystem = DOMAIN_TO_SUBSYSTEM.get(fault_domain, "other")

    # 5. Normalize model PR/MR citations while preserving explicit ecosystems & unparseable/ambiguous evidence
    issue_eco = infer_ecosystem(it)
    issue_repo = str(it.get("repo") or "").strip()
    issue_repo_lower = issue_repo.lower()

    fix_pr_refs: list[str] = []
    seen_refs: set[str] = set()
    unparsed_fix_pr_citations: list[str] = []
    seen_unparsed: set[str] = set()
    same_repo_nums: set[int] = set()
    cross_repo_nums: set[int] = set()
    model_same_repo_explicit_nums: set[int] = set()
    model_cross_repo_nums: set[int] = set()

    def _is_bare_ref(raw_val: Any) -> bool:
        if isinstance(raw_val, int) and not isinstance(raw_val, bool):
            return True
        if isinstance(raw_val, str):
            return bool(re.match(r"^[#!]?\d+$", raw_val.strip()))
        return False

    def _record_unparsed(raw_val: Any) -> None:
        if raw_val is None or isinstance(raw_val, bool):
            return
        if isinstance(raw_val, (dict, list, tuple)):
            if not raw_val:
                return
            rs = json.dumps(raw_val, ensure_ascii=False, sort_keys=True, default=str)
        else:
            rs = str(raw_val).strip()
        if rs and rs not in seen_unparsed:
            seen_unparsed.add(rs)
            unparsed_fix_pr_citations.append(rs)

    def _record_ref_parsed(
        parsed_ref: tuple[str, str, int, str],
        from_model: bool = True,
        explicit_repo: bool = True,
    ) -> None:
        ref_eco, ref_repo, ref_num, canon = parsed_ref
        canon_key = canon.lower()
        if canon_key not in seen_refs:
            seen_refs.add(canon_key)
            fix_pr_refs.append(canon)
        if ref_eco == issue_eco and ref_repo.lower() == issue_repo_lower:
            same_repo_nums.add(ref_num)
            if from_model and explicit_repo:
                model_same_repo_explicit_nums.add(ref_num)
        else:
            cross_repo_nums.add(ref_num)
            if from_model:
                model_cross_repo_nums.add(ref_num)

    # Track linked_merged_prs and candidate_prs scopes (never emitted into model fix_pr_refs/fix_pr_numbers)
    for lp in it.get("linked_merged_prs") or []:
        if not isinstance(lp, dict):
            continue
        lp_url = str(lp.get("url") or "").strip()
        lp_raw = lp.get("ref") or lp_url or lp.get("number")
        parsed_ref = _parse_pr_ref(lp_raw, issue_eco, issue_repo, explicit_url=lp_url)
        if parsed_ref is not None:
            ref_eco, ref_repo, ref_num, _ = parsed_ref
            if ref_eco == issue_eco and ref_repo.lower() == issue_repo_lower:
                same_repo_nums.add(ref_num)
            else:
                cross_repo_nums.add(ref_num)

    for cand in it.get("candidate_prs") or []:
        parsed_cand = _parse_pr_ref(cand, issue_eco, issue_repo)
        if parsed_cand is not None and not _is_bare_ref(cand):
            ref_eco, ref_repo, ref_num, _ = parsed_cand
            if ref_eco == issue_eco and ref_repo.lower() == issue_repo_lower:
                same_repo_nums.add(ref_num)
            else:
                cross_repo_nums.add(ref_num)

    raw_model_refs = _coerce_citation_list(data.get("fix_pr_refs"))
    raw_model_nums = _coerce_citation_list(data.get("fix_pr_numbers"))

    deferred_bare_refs: list[tuple[Any, tuple[str, str, int, str]]] = []
    for r in raw_model_refs:
        if r is None or isinstance(r, bool):
            continue
        parsed_ref = _parse_pr_ref(r, issue_eco, issue_repo)
        if parsed_ref is not None:
            if _is_bare_ref(r):
                deferred_bare_refs.append((r, parsed_ref))
            else:
                _record_ref_parsed(parsed_ref, from_model=True, explicit_repo=True)
        else:
            _record_unparsed(r)

    fix_pr_numbers: list[int] = []
    seen_nums: set[int] = set()

    def _add_same_repo_num(nv: int) -> None:
        if nv > 0 and nv not in seen_nums:
            seen_nums.add(nv)
            fix_pr_numbers.append(nv)

    deferred_bare_nums: list[tuple[Any, tuple[str, str, int, str]]] = []
    for n in raw_model_nums:
        if n is None or isinstance(n, bool):
            continue
        parsed_ref = _parse_pr_ref(n, issue_eco, issue_repo)
        if parsed_ref is not None:
            if _is_bare_ref(n):
                deferred_bare_nums.append((n, parsed_ref))
            else:
                _record_ref_parsed(parsed_ref, from_model=True, explicit_repo=True)
                ref_eco, ref_repo, ref_num, _ = parsed_ref
                if ref_eco == issue_eco and ref_repo.lower() == issue_repo_lower:
                    _add_same_repo_num(ref_num)
        else:
            _record_unparsed(n)

    for raw_r, parsed_ref in deferred_bare_refs:
        _, _, ref_num, _ = parsed_ref
        if ref_num not in cross_repo_nums:
            _record_ref_parsed(parsed_ref, from_model=True, explicit_repo=False)
        elif ref_num in model_same_repo_explicit_nums and ref_num not in model_cross_repo_nums:
            _record_ref_parsed(parsed_ref, from_model=True, explicit_repo=False)
        elif (
            ref_num in model_cross_repo_nums
            and ref_num not in model_same_repo_explicit_nums
            and ref_num not in same_repo_nums
        ):
            continue
        else:
            _record_unparsed(raw_r)

    for raw_n, parsed_ref in deferred_bare_nums:
        _, _, ref_num, _ = parsed_ref
        if ref_num not in cross_repo_nums:
            _add_same_repo_num(ref_num)
            _record_ref_parsed(parsed_ref, from_model=True, explicit_repo=False)
        elif ref_num in model_same_repo_explicit_nums and ref_num not in model_cross_repo_nums:
            _add_same_repo_num(ref_num)
            _record_ref_parsed(parsed_ref, from_model=True, explicit_repo=False)
        elif (
            ref_num in model_cross_repo_nums
            and ref_num not in model_same_repo_explicit_nums
            and ref_num not in same_repo_nums
        ):
            continue
        else:
            _record_unparsed(raw_n)

    # Keep distilled.fix_pr_refs and distilled.fix_pr_numbers strictly restricted to model citations;
    # linked_merged_prs and pr_diff_source_ref are carried separately on the top-level item.

    # 6. Normalize colloquial_queries_zh (deduplicated, non-trivial >= 4 chars)
    raw_queries = _coerce_model_list(data.get("colloquial_queries_zh"))
    queries: list[str] = []
    seen_queries: set[str] = set()
    for q in raw_queries:
        if not isinstance(q, str):
            continue
        qs = re.sub(r"\s+", " ", q).strip()
        if len(qs) < 4:
            continue
        q_norm = qs.lower()
        if q_norm in seen_queries:
            continue
        seen_queries.add(q_norm)
        queries.append(qs)
        if len(queries) >= 3:
            break

    root_cause_confirmed = _parse_strict_bool(data.get("root_cause_confirmed"))
    raw_forensic_chain = data.get("forensic_chain_zh")
    forensic_chain_zh = (
        re.sub(r"\s+", " ", raw_forensic_chain).strip()
        if isinstance(raw_forensic_chain, str)
        else ""
    )
    effective_thinking_summary = (thinking_summary or "").strip() or forensic_chain_zh

    def _safe_str(val: Any, default: str = "") -> str:
        if isinstance(val, str):
            s = val.strip()
            return s if s else default
        return default

    root_cause_zh = _safe_str(data.get("root_cause_zh"), "")
    # Never mark a row answer_parsed=True if parsed payload violates _has_required_model_schema or post-normalization requirements
    schema_ok = parsed is not None and _has_required_model_schema(parsed)
    if not schema_ok or not queries or not root_cause_zh or not _is_valid_forensic_chain(forensic_chain_zh):
        answer_parsed = False

    normalized_distilled = {
        "verbatim_root_line": final_root,
        "verbatim_cascade_lines": verified_cascades,
        "error_codes": grounded_codes,
        "fault_domain": fault_domain,
        "subsystem": subsystem,
        "hardware_soc": _safe_str(data.get("hardware_soc"), "unknown"),
        "topology": _safe_str(data.get("topology"), "unknown"),
        "root_cause_confirmed": root_cause_confirmed,
        "root_cause_zh": root_cause_zh,
        "pr_fix_mechanism_zh": _safe_str(data.get("pr_fix_mechanism_zh"), ""),
        "fix_or_workaround_zh": _safe_str(data.get("fix_or_workaround_zh"), ""),
        "fix_pr_refs": fix_pr_refs,
        "fix_pr_numbers": fix_pr_numbers,
        "unparsed_fix_pr_citations": unparsed_fix_pr_citations,
        "same_code_trap_zh": _safe_str(data.get("same_code_trap_zh"), ""),
        "colloquial_queries_zh": queries,
        "forensic_chain_zh": forensic_chain_zh,
    }

    resume_sha = compute_distill_input_sha256(
        it,
        teacher_model=teacher_model,
        teacher_backend=teacher_backend,
        teacher_dtype=teacher_dtype,
        max_new_tokens=max_new_tokens,
        normalizer_version=NORMALIZER_SCHEMA_VERSION,
    )
    content_sha = compute_distill_content_sha256(it)

    raw_diff_snip = str(it.get("pr_diff_snippet") or "")
    pr_diff_docs_only = bool(raw_diff_snip.strip() and _is_docs_only_diff_snippet(raw_diff_snip))

    return {
        "key": it["key"],
        "ecosystem": issue_eco,
        "repo": it["repo"],
        "number": it["number"],
        "url": it["url"],
        "title": title,
        "closed_at": it.get("closed_at"),
        "comments_complete": _parse_strict_bool(it.get("comments_complete")),
        "raw_sha256": computed_raw_sha,
        "normalizer_version": NORMALIZER_SCHEMA_VERSION,
        "content_input_sha256": content_sha,
        "resume_input_sha256": resume_sha,
        "answer_parsed": answer_parsed,
        **(
            {"pr_diff_source_ref": str(it["pr_diff_source_ref"]).strip()}
            if str(it.get("pr_diff_source_ref") or "").strip()
            else {}
        ),
        **({"pr_diff_docs_only": True} if pr_diff_docs_only else {}),
        "candidate_prs": it.get("candidate_prs") or [],
        "linked_merged_prs": it.get("linked_merged_prs") or [],
        "pr_diff_lines": int(it.get("pr_diff_lines") or 0),
        "verbatim_root_line": final_root,
        "verbatim_root_verified": root_verified,
        "verbatim_root_source": root_source,
        **(
            {"model_verbatim_root_line_rejected": rejected_root}
            if rejected_root and root_source != "model"
            else {}
        ),
        "verbatim_cascade_lines": verified_cascades,
        "forensic_chain_zh": forensic_chain_zh,
        "thinking_summary": effective_thinking_summary,
        "distilled": normalized_distilled,
    }


def compute_distill_content_sha256(it: dict[str, Any]) -> str:
    """Content-only fingerprint (SYSTEM_PROMPT + rendered user prompt + item) for opt-in mixed-teacher resume."""
    basis = {
        "system_prompt_sha256": hashlib.sha256(SYSTEM_PROMPT.encode("utf-8")).hexdigest(),
        "prompt_sha256": hashlib.sha256(build_user_prompt(it).encode("utf-8")).hexdigest(),
        "item": it,
    }
    return hashlib.sha256(
        json.dumps(basis, sort_keys=True, ensure_ascii=False, separators=(",", ":"), default=str).encode("utf-8")
    ).hexdigest()


def compute_distill_input_sha256(
    it: dict[str, Any],
    *,
    teacher_model: str = "",
    teacher_backend: str = "",
    teacher_dtype: str = "",
    max_new_tokens: int = 1536,
    normalizer_version: str = NORMALIZER_SCHEMA_VERSION,
) -> str:
    """Fingerprint teacher config + normalizer schema + prompts + full item for airtight checkpoint invalidation."""
    basis = {
        "normalizer_version": normalizer_version,
        "teacher_model": (teacher_model or "").strip(),
        "teacher_backend": (teacher_backend or "").strip(),
        "teacher_dtype": (teacher_dtype or "").strip(),
        "max_new_tokens": int(max_new_tokens),
        "system_prompt_sha256": hashlib.sha256(SYSTEM_PROMPT.encode("utf-8")).hexdigest(),
        "prompt_sha256": hashlib.sha256(build_user_prompt(it).encode("utf-8")).hexdigest(),
        "item": it,
    }
    return hashlib.sha256(
        json.dumps(basis, sort_keys=True, ensure_ascii=False, separators=(",", ":"), default=str).encode("utf-8")
    ).hexdigest()


def validate_checkpoint_item(
    item: Any,
    corpus_item: dict[str, Any],
    *,
    expected_teacher_model: str = "",
    expected_backend: str = "",
    expected_dtype: str = "",
    expected_max_new_tokens: int = 1536,
    allow_mixed_teacher: bool = False,
) -> tuple[bool, str]:
    """Strictly validate full checkpoint row schema, types, provenance, and digest before reuse."""
    if not isinstance(item, dict):
        return False, "not a dict"
    if item.get("answer_parsed") is not True:
        return False, "answer_parsed is not True"
    if item.get("key") != corpus_item.get("key"):
        return False, "key mismatch"
    if str(item.get("repo") or "").lower() != str(corpus_item.get("repo") or "").lower():
        return False, "repo mismatch"
    if str(item.get("number")) != str(corpus_item.get("number")):
        return False, "number mismatch"
    if str(item.get("url") or "").strip() != str(corpus_item.get("url") or "").strip():
        return False, "url mismatch"
    if infer_ecosystem(item) != infer_ecosystem(corpus_item):
        return False, "ecosystem mismatch"
    if item.get("raw_sha256") != corpus_item.get("raw_sha256"):
        return False, "raw_sha256 mismatch"
    if not isinstance(item.get("title"), str) or item["title"].strip() != str(
        corpus_item.get("title") or ""
    ).strip():
        return False, "title mismatch"
    raw_pdl = item.get("pr_diff_lines")
    if not isinstance(raw_pdl, int) or isinstance(raw_pdl, bool) or raw_pdl < 0:
        return False, "pr_diff_lines not int"
    corpus_pdl = corpus_item.get("pr_diff_lines")
    if corpus_pdl is None:
        corpus_pdl_int = 0
    elif isinstance(corpus_pdl, int) and not isinstance(corpus_pdl, bool) and corpus_pdl >= 0:
        corpus_pdl_int = corpus_pdl
    else:
        return False, "corpus pr_diff_lines invalid"
    if raw_pdl != corpus_pdl_int:
        return False, "pr_diff_lines mismatch"
    if str(item.get("pr_diff_source_ref") or "").strip() != str(
        corpus_item.get("pr_diff_source_ref") or ""
    ).strip():
        return False, "pr_diff_source_ref mismatch"
    if item.get("candidate_prs") != (corpus_item.get("candidate_prs") or []):
        return False, "candidate_prs mismatch"
    if item.get("linked_merged_prs") != (corpus_item.get("linked_merged_prs") or []):
        return False, "linked_merged_prs mismatch"
    if not isinstance(item.get("comments_complete"), bool):
        return False, "comments_complete not bool"
    if item["comments_complete"] != _parse_strict_bool(corpus_item.get("comments_complete")):
        return False, "comments_complete mismatch"
    if not isinstance(item.get("verbatim_root_verified"), bool):
        return False, "verbatim_root_verified not bool"
    if item.get("verbatim_root_source") not in ("model", "fallback_log_extractor", "rejected"):
        return False, "verbatim_root_source invalid"
    if not isinstance(item.get("verbatim_root_line"), str):
        return False, "verbatim_root_line not str"
    if not isinstance(item.get("thinking_summary"), str):
        return False, "thinking_summary not str"
    top_fc = item.get("forensic_chain_zh")
    if not isinstance(top_fc, str) or not top_fc.strip():
        return False, "forensic_chain_zh missing or empty"
    casc = item.get("verbatim_cascade_lines")
    if not isinstance(casc, list) or not all(isinstance(x, str) for x in casc):
        return False, "verbatim_cascade_lines invalid"

    dist = item.get("distilled")
    if not isinstance(dist, dict):
        return False, "distilled not dict"
    for str_field in (
        "verbatim_root_line",
        "fault_domain",
        "subsystem",
        "hardware_soc",
        "topology",
        "root_cause_zh",
        "pr_fix_mechanism_zh",
        "fix_or_workaround_zh",
        "same_code_trap_zh",
        "forensic_chain_zh",
    ):
        if not isinstance(dist.get(str_field), str):
            return False, f"distilled.{str_field} not str"
    if not dist["root_cause_zh"].strip():
        return False, "distilled.root_cause_zh empty"
    if not dist["hardware_soc"].strip():
        return False, "distilled.hardware_soc empty"
    if not dist["topology"].strip():
        return False, "distilled.topology empty"
    if not _is_valid_forensic_chain(dist["forensic_chain_zh"]) or dist["forensic_chain_zh"].strip() != top_fc.strip():
        return False, "forensic_chain_zh invalid or mismatch"
    if item["verbatim_root_line"] != dist["verbatim_root_line"]:
        return False, "verbatim_root_line mismatch between item and distilled"
    if casc != dist.get("verbatim_cascade_lines"):
        return False, "verbatim_cascade_lines mismatch between item and distilled"
    if dist["fault_domain"] not in VALID_FAULT_DOMAINS:
        return False, "invalid fault_domain"
    if dist["subsystem"] not in VALID_SUBSYSTEMS:
        return False, "invalid subsystem"
    if not isinstance(dist.get("root_cause_confirmed"), bool):
        return False, "distilled.root_cause_confirmed not bool"
    for str_list_field in ("verbatim_cascade_lines", "error_codes", "fix_pr_refs"):
        val = dist.get(str_list_field)
        if not isinstance(val, list) or not all(isinstance(x, str) for x in val):
            return False, f"distilled.{str_list_field} invalid"
    if "unparsed_fix_pr_citations" in dist:
        upc = dist.get("unparsed_fix_pr_citations")
        if not isinstance(upc, list) or not all(isinstance(x, str) for x in upc):
            return False, "distilled.unparsed_fix_pr_citations invalid"
    colloq = dist.get("colloquial_queries_zh")
    if (
        not isinstance(colloq, list)
        or len(colloq) == 0
        or not all(isinstance(x, str) and len(x.strip()) >= 4 for x in colloq)
    ):
        return False, "distilled.colloquial_queries_zh invalid"
    nums = dist.get("fix_pr_numbers")
    if not isinstance(nums, list) or not all(
        isinstance(x, int) and not isinstance(x, bool) and x > 0 for x in nums
    ):
        return False, "distilled.fix_pr_numbers invalid"

    # Re-verify claimed verbatim root/cascade & error_codes against corpus_item (BOTH false-positive & false-negative!)
    raw_title = str(corpus_item.get("title") or "")
    raw_body = str(corpus_item.get("body") or "")
    raw_comments = str(corpus_item.get("comments_text") or "")
    raw_haystack_upper = f"{raw_title}\n{raw_body}\n{raw_comments}".upper()
    for code in dist["error_codes"]:
        if (
            not code
            or code != code.strip()
            or not _is_valid_error_code_token(code)
            or not _contains_whole_error_code(code.upper(), raw_haystack_upper)
        ):
            return False, f"distilled.error_codes contains ungrounded or invalid token: {code!r}"
    vrl = _js_trim(item["verbatim_root_line"])
    recomputed_root_ok = bool(
        vrl
        and _is_single_line_in_source_field(vrl, raw_body, raw_comments)
        and not _is_title_leak(vrl, raw_title)
        and not _is_prose_summary_not_runtime_log(vrl)
        and not _is_markdown_pr_or_link_list_line(vrl)
        and _has_non_prose_source_occurrence(vrl, raw_body, raw_comments)
    )
    if item["verbatim_root_verified"] != recomputed_root_ok:
        return False, "verbatim_root_verified mismatch"
    root_src = item.get("verbatim_root_source")
    if recomputed_root_ok and root_src not in ("model", "fallback_log_extractor"):
        return False, "verbatim_root_source mismatch for verified root"
    if not recomputed_root_ok and root_src != "rejected":
        return False, "verbatim_root_source mismatch for unverified root"
    if recomputed_root_ok and root_src == "fallback_log_extractor":
        hint_codes = list(corpus_item.get("detected_error_codes") or []) + [
            str(c) for c in (dist.get("error_codes") or []) if isinstance(c, str)
        ]
        expected_fb = extract_fallback_verbatim_root_line(raw_title, raw_body, raw_comments, hint_codes)
        if not expected_fb or vrl != expected_fb:
            return False, "verbatim_root_source fallback_log_extractor does not match deterministic fallback"
        rej = str(item.get("model_verbatim_root_line_rejected") or "").strip()
        if (
            rej
            and _is_single_line_in_source_field(rej, raw_body, raw_comments)
            and not _is_title_leak(rej, raw_title)
            and not _is_prose_summary_not_runtime_log(rej)
            and not _is_markdown_pr_or_link_list_line(rej)
            and _has_non_prose_source_occurrence(rej, raw_body, raw_comments)
        ):
            return False, "fallback_log_extractor claimed despite valid model_verbatim_root_line_rejected"
    elif not recomputed_root_ok and root_src == "rejected":
        hint_codes = list(corpus_item.get("detected_error_codes") or []) + [
            str(c) for c in (dist.get("error_codes") or []) if isinstance(c, str)
        ]
        expected_fb = extract_fallback_verbatim_root_line(raw_title, raw_body, raw_comments, hint_codes)
        if (
            expected_fb
            and _is_single_line_in_source_field(expected_fb, raw_body, raw_comments)
            and not _is_title_leak(expected_fb, raw_title)
            and not _is_prose_summary_not_runtime_log(expected_fb)
            and not _is_markdown_pr_or_link_list_line(expected_fb)
            and _has_non_prose_source_occurrence(expected_fb, raw_body, raw_comments)
        ):
            return False, "verbatim_root_source rejected despite deterministic fallback available"
        rej = _js_trim(str(item.get("model_verbatim_root_line_rejected") or ""))
        if (
            rej
            and _is_single_line_in_source_field(rej, raw_body, raw_comments)
            and not _is_title_leak(rej, raw_title)
            and not _is_prose_summary_not_runtime_log(rej)
            and not _is_markdown_pr_or_link_list_line(rej)
            and _has_non_prose_source_occurrence(rej, raw_body, raw_comments)
        ):
            return False, "verbatim_root_source rejected despite valid model_verbatim_root_line_rejected"
    expected_docs_diff = _is_docs_only_diff_snippet(str(corpus_item.get("pr_diff_snippet") or ""))
    if expected_docs_diff:
        if item.get("pr_diff_docs_only") is not True:
            return False, "pr_diff_docs_only missing or false for docs-only diff snippet"
    elif "pr_diff_docs_only" in item and item.get("pr_diff_docs_only") is not False:
        return False, "pr_diff_docs_only mismatch for non-docs diff snippet"
    if len(casc) > 4:
        return False, "verbatim_cascade_lines exceeds max 4"
    seen_casc: set[str] = set()
    for cl in casc:
        cs = _js_trim(cl)
        if (
            len(cs) < 12
            or (recomputed_root_ok and cs == vrl)
            or cs in seen_casc
            or not _is_single_line_in_source_field(cs, raw_body, raw_comments)
            or _is_title_leak(cs, raw_title)
            or _is_prose_summary_not_runtime_log(cs)
            or _is_markdown_pr_or_link_list_line(cs)
            or not _has_non_prose_source_occurrence(cs, raw_body, raw_comments)
        ):
            return False, "verbatim_cascade_lines failed source verification"
        seen_casc.add(cs)

    stored_fp = str(item.get("resume_input_sha256") or "")
    if not re.fullmatch(r"[0-9a-f]{64}", stored_fp):
        return False, "missing or invalid resume_input_sha256"
    if item.get("normalizer_version") != NORMALIZER_SCHEMA_VERSION:
        return False, "normalizer_version mismatch"

    expected_content = compute_distill_content_sha256(corpus_item)
    stored_content = str(item.get("content_input_sha256") or "")
    if stored_content != expected_content:
        return False, "content_input_sha256 mismatch"

    if allow_mixed_teacher:
        row_model = str(item.get("teacher_model") or "").strip()
        row_backend = str(item.get("teacher_backend") or "").strip()
        row_dtype = str(item.get("teacher_dtype") or "").strip()
        if not row_model or not row_backend or not row_dtype:
            return False, "missing teacher metadata under mixed-teacher resume"
        row_full = compute_distill_input_sha256(
            corpus_item,
            teacher_model=row_model,
            teacher_backend=row_backend,
            teacher_dtype=row_dtype,
            max_new_tokens=expected_max_new_tokens,
            normalizer_version=NORMALIZER_SCHEMA_VERSION,
        )
        if stored_fp != row_full:
            return False, "resume_input_sha256 mismatch for row teacher metadata"
        return True, "ok"

    row_model = str(item.get("teacher_model") or "").strip()
    row_backend = str(item.get("teacher_backend") or "").strip()
    row_dtype = str(item.get("teacher_dtype") or "").strip()
    if (
        row_model != (expected_teacher_model or "").strip()
        or row_backend != (expected_backend or "").strip()
        or row_dtype != (expected_dtype or "").strip()
    ):
        return False, "teacher metadata mismatch under strict resume"

    expected_fp = compute_distill_input_sha256(
        corpus_item,
        teacher_model=expected_teacher_model,
        teacher_backend=expected_backend,
        teacher_dtype=expected_dtype,
        max_new_tokens=expected_max_new_tokens,
        normalizer_version=NORMALIZER_SCHEMA_VERSION,
    )
    if stored_fp != expected_fp:
        return False, "resume_input_sha256 mismatch"
    return True, "ok"


def _clear_cuda() -> None:
    gc.collect()
    if torch is not None and torch.cuda.is_available():
        torch.cuda.empty_cache()
        try:
            torch.cuda.ipc_collect()
        except Exception:
            pass


def _render_chat_prompt(tokenizer: Any, user_msg: str) -> str:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_msg},
    ]
    for kwargs in (
        {"tokenize": False, "add_generation_prompt": True, "enable_thinking": True},
        {"tokenize": False, "add_generation_prompt": True},
    ):
        try:
            return str(tokenizer.apply_chat_template(messages, **kwargs))
        except TypeError:
            continue
    return f"<|im_start|>system\n{SYSTEM_PROMPT}<|im_end|>\n<|im_start|>user\n{user_msg}<|im_end|>\n<|im_start|>assistant\n<think>\n"


def _budget_user_message_preserve_head_and_diff(
    tokenizer: Any,
    user_msg: str,
    max_prompt_tokens: int,
    *,
    diff_start_idx: int | None = None,
) -> str:
    """Budget prompt tokens below max_prompt_tokens while preserving opening metadata and trailing PR diff."""
    rendered = _render_chat_prompt(tokenizer, user_msg)
    first_encode_ok = False
    try:
        tok_ids = tokenizer.encode(rendered, add_special_tokens=False)
        first_encode_ok = True
        if len(tok_ids) <= max_prompt_tokens:
            return rendered
    except Exception:
        pass

    # Compute fixed overhead of system prompt + chat template wrapper
    empty_rendered = _render_chat_prompt(tokenizer, "")
    try:
        overhead = len(tokenizer.encode(empty_rendered, add_special_tokens=False))
    except Exception as exc:
        raise ValueError(
            f"Unable to encode empty chat prompt while budgeting max_prompt_tokens={max_prompt_tokens}: {exc}"
        ) from exc

    if overhead > max_prompt_tokens:
        raise ValueError(
            f"Chat template + system prompt overhead ({overhead} tokens) exceeds max_prompt_tokens={max_prompt_tokens}"
        )

    # If the initial encode failed transiently, re-check rendered length before truncating (NEVER skip budgeting!)
    if not first_encode_ok:
        try:
            if len(tokenizer.encode(rendered, add_special_tokens=False)) <= max_prompt_tokens:
                return rendered
        except Exception as exc:
            raise ValueError(
                f"Unable to encode rendered prompt while budgeting max_prompt_tokens={max_prompt_tokens}: {exc}"
            ) from exc

    def _rendered_len(candidate_msg: str) -> int:
        return len(tokenizer.encode(_render_chat_prompt(tokenizer, candidate_msg), add_special_tokens=False))

    def _fit_by_chars(candidate_msg: str) -> str:
        lo, hi = 0, len(candidate_msg)
        best = empty_rendered
        while lo <= hi:
            mid = (lo + hi) // 2
            trial = _render_chat_prompt(tokenizer, candidate_msg[:mid])
            if len(tokenizer.encode(trial, add_special_tokens=False)) <= max_prompt_tokens:
                best = trial
                lo = mid + 1
            else:
                hi = mid - 1
        if len(tokenizer.encode(best, add_special_tokens=False)) > max_prompt_tokens:
            raise ValueError(
                f"Unable to fit rendered prompt within max_prompt_tokens={max_prompt_tokens}"
            )
        return best

    # Locate producer-injected PR diff offset BEFORE raw encoding so char fallback preserves head + diff too!
    marker = "\n... [中间正文按 token 预算裁剪，保留开头与尾部 PR Diff] ...\n"
    diff_fence_idx = -1
    hdr_line_start = -1
    diff_prefix_block = ""
    if diff_start_idx is not None:
        if 0 <= diff_start_idx < len(user_msg):
            fence_after = user_msg.find("\n```diff\n", diff_start_idx)
            if fence_after >= 0:
                hdr_line_start = diff_start_idx
                diff_fence_idx = fence_after
                diff_header_line = user_msg[diff_start_idx:fence_after].strip()
                if diff_header_line:
                    diff_prefix_block = f"\n{diff_header_line}\n```diff\n"
    else:
        comments_hdr_pos = user_msg.rfind("\n评论区摘录 (完整=")
        trimmed_msg_end = user_msg.rstrip()
        ends_with_closing_fence = trimmed_msg_end.endswith("\n```")
        if ends_with_closing_fence:
            for hdr_marker in ("\n关联已合入 PR/MR 代码 Diff (", "\n关联代码 Diff 摘录 ("):
                search_end = len(trimmed_msg_end)
                while search_end > max(0, comments_hdr_pos):
                    pos = trimmed_msg_end.rfind(hdr_marker, max(0, comments_hdr_pos), search_end)
                    if pos < 0:
                        break
                    fence_after = trimmed_msg_end.find("\n```diff\n", pos)
                    if fence_after >= 0 and "\n" not in trimmed_msg_end[pos + 1 : fence_after]:
                        inner = trimmed_msg_end[fence_after + len("\n```diff\n") : -len("\n```")]
                        if "\n```\n" not in inner and pos > hdr_line_start:
                            hdr_line_start = pos
                            diff_fence_idx = fence_after
                            diff_header_line = trimmed_msg_end[pos + 1 : fence_after].strip()
                            diff_prefix_block = f"\n{diff_header_line}\n```diff\n"
                        break
                    search_end = pos
        if diff_fence_idx < 0 and ends_with_closing_fence:
            cand_fence = trimmed_msg_end.rfind("\n```diff\n", max(0, comments_hdr_pos))
            if cand_fence >= 0:
                inner = trimmed_msg_end[cand_fence + len("\n```diff\n") : -len("\n```")]
                if "\n```\n" not in inner:
                    diff_fence_idx = cand_fence
                    hdr_line_start = trimmed_msg_end.rfind("\n", 0, diff_fence_idx)
                    diff_header_line = trimmed_msg_end[hdr_line_start + 1 : diff_fence_idx].strip()
                    if diff_header_line:
                        diff_prefix_block = f"\n{diff_header_line}\n```diff\n"

    def _fit_head_and_diff_by_chars() -> str:
        if diff_fence_idx < 0:
            return _fit_by_chars(user_msg)
        before_diff = user_msg[:hdr_line_start] if hdr_line_start >= 0 else ""
        diff_body = user_msg[diff_fence_idx + len("\n```diff\n") :]
        eff_prefix = diff_prefix_block or "\n```diff\n"
        first_hdr_line = before_diff.split("\n", 1)[0].rstrip()
        avail_total = max(0, max_prompt_tokens - overhead)
        eff_marker = marker
        marker_cost = _rendered_len(eff_marker) - overhead
        if (
            avail_total < 512
            or marker_cost > max(8, int(avail_total * 0.15))
            or _rendered_len(f"{first_hdr_line}{eff_marker}{eff_prefix}") + 64 > max_prompt_tokens
        ):
            eff_marker = "\n...\n"
        if _rendered_len(f"{first_hdr_line}{eff_marker}{eff_prefix}") + 16 > max_prompt_tokens:
            if _rendered_len(f"{first_hdr_line}{eff_marker}\n```diff\n") + 16 <= max_prompt_tokens:
                eff_prefix = "\n```diff\n"
        if _rendered_len(f"{eff_marker}{eff_prefix}") + 8 > max_prompt_tokens:
            eff_prefix = "\n```diff\n"
            eff_marker = "\n...\n"
        if _rendered_len(f"{eff_marker}{eff_prefix}") >= max_prompt_tokens:
            return _fit_by_chars(user_msg)
        # Fast path: if complete head + marker + complete diff already fit, keep BOTH intact!
        full_combined = f"{before_diff.rstrip()}{eff_marker}{eff_prefix}{diff_body.lstrip()}"
        if _rendered_len(full_combined) <= max_prompt_tokens:
            return _render_chat_prompt(tokenizer, full_combined)
        base_len = _rendered_len(f"{eff_marker}{eff_prefix}")
        avail = max(0, max_prompt_tokens - base_len)
        # Keep the complete issue header line + complete diff whenever both fit inside avail!
        diff_stripped = diff_body.lstrip()
        full_diff_len = _rendered_len(f"{eff_marker}{eff_prefix}{diff_stripped}") - base_len
        head_stripped = before_diff.rstrip()
        full_head_len = _rendered_len(f"{head_stripped}{eff_marker}{eff_prefix}") - base_len
        min_hdr_len = max(0, _rendered_len(f"{first_hdr_line}{eff_marker}{eff_prefix}") - base_len)
        if full_diff_len <= avail - min_hdr_len or (avail < min_hdr_len and full_diff_len <= int(avail * 0.65)):
            best_tail = diff_stripped
        else:
            head_target = min(full_head_len, max(min_hdr_len, int(avail * 0.45)))
            diff_share = max(1, avail - head_target)
            diff_cap = base_len + diff_share
            lo, hi = 0, len(diff_stripped)
            best_tail = ""
            while lo <= hi:
                mid = (lo + hi) // 2
                cand_tail = diff_stripped[:mid]
                if _rendered_len(f"{eff_marker}{eff_prefix}{cand_tail}") <= diff_cap:
                    best_tail = cand_tail
                    lo = mid + 1
                else:
                    hi = mid - 1
        suffix = f"{eff_marker}{eff_prefix}{best_tail}"
        lo, hi = 0, len(before_diff)
        best_msg = suffix
        while lo <= hi:
            mid = (lo + hi) // 2
            cand_msg = f"{before_diff[:mid].rstrip()}{suffix}" if mid > 0 else suffix
            if _rendered_len(cand_msg) <= max_prompt_tokens:
                best_msg = cand_msg
                lo = mid + 1
            else:
                hi = mid - 1
        out = _render_chat_prompt(tokenizer, best_msg)
        if len(tokenizer.encode(out, add_special_tokens=False)) > max_prompt_tokens:
            return _fit_by_chars(best_msg)
        return out

    try:
        user_ids = tokenizer.encode(user_msg, add_special_tokens=False)
    except Exception:
        return _fit_head_and_diff_by_chars()

    budget = max(0, max_prompt_tokens - overhead)

    def _fit_to_max_prompt(candidate_msg: str) -> str:
        out = _render_chat_prompt(tokenizer, candidate_msg)
        if len(tokenizer.encode(out, add_special_tokens=False)) <= max_prompt_tokens:
            return out
        try:
            cand_ids = tokenizer.encode(candidate_msg, add_special_tokens=False)
        except Exception:
            return _fit_by_chars(candidate_msg)
        lo, hi = 0, len(cand_ids)
        best = empty_rendered
        while lo <= hi:
            mid = (lo + hi) // 2
            trial = _render_chat_prompt(
                tokenizer, tokenizer.decode(cand_ids[:mid], skip_special_tokens=True)
            )
            if len(tokenizer.encode(trial, add_special_tokens=False)) <= max_prompt_tokens:
                best = trial
                lo = mid + 1
            else:
                hi = mid - 1
        if len(tokenizer.encode(best, add_special_tokens=False)) > max_prompt_tokens:
            raise ValueError(
                f"Unable to fit rendered prompt within max_prompt_tokens={max_prompt_tokens}"
            )
        return best

    try:
        marker_ids = tokenizer.encode(marker, add_special_tokens=False)
        diff_prefix_ids = (
            tokenizer.encode(diff_prefix_block, add_special_tokens=False) if diff_prefix_block else []
        )
    except Exception:
        marker_ids = []
        diff_prefix_ids = []

    if diff_prefix_block and diff_fence_idx >= 0 and budget > len(marker_ids) + len(diff_prefix_ids) + 16:
        diff_body_text = user_msg[diff_fence_idx + len("\n```diff\n") :]
        before_diff_text = user_msg[:hdr_line_start] if hdr_line_start >= 0 else ""
        try:
            head_all_ids = tokenizer.encode(before_diff_text, add_special_tokens=False)
            diff_all_ids = tokenizer.encode(diff_body_text, add_special_tokens=False)
            avail = max(0, budget - len(marker_ids) - len(diff_prefix_ids))
            tail_budget = min(len(diff_all_ids), int(avail * 0.45))
            head_budget = max(0, avail - tail_budget)
            head_text = tokenizer.decode(head_all_ids[:head_budget], skip_special_tokens=True)
            tail_text = tokenizer.decode(diff_all_ids[-tail_budget:], skip_special_tokens=True) if tail_budget > 0 else ""
            trimmed_msg = f"{head_text.rstrip()}{marker}{diff_prefix_block}{tail_text.lstrip()}"
            return _fit_to_max_prompt(trimmed_msg)
        except Exception:
            pass

    if diff_fence_idx >= 0 and budget > len(marker_ids) + 16:
        avail = max(0, budget - len(marker_ids))
        tail_budget = int(avail * 0.45)
        head_budget = max(0, avail - tail_budget)
        head_text = tokenizer.decode(user_ids[:head_budget], skip_special_tokens=True)
        tail_text = tokenizer.decode(user_ids[-tail_budget:], skip_special_tokens=True) if tail_budget > 0 else ""
        trimmed_msg = f"{head_text.rstrip()}{marker}{tail_text.lstrip()}"
        return _fit_to_max_prompt(trimmed_msg)

    # No producer PR diff exists (or budget too tight for marker+diff): truncate strictly from the end!
    no_diff_marker = "\n... [超长正文与评论按 token 预算尾部截断，本 Issue 无关联 PR Diff] ...\n"
    try:
        no_diff_marker_ids = tokenizer.encode(no_diff_marker, add_special_tokens=False)
    except Exception:
        no_diff_marker_ids = []
    if budget > len(no_diff_marker_ids):
        head_only_budget = max(0, budget - len(no_diff_marker_ids))
        head_text = tokenizer.decode(user_ids[:head_only_budget], skip_special_tokens=True)
        trimmed_msg = f"{head_text.rstrip()}{no_diff_marker}"
        return _fit_to_max_prompt(trimmed_msg)
    head_text = tokenizer.decode(user_ids[:budget], skip_special_tokens=True) if budget > 0 else ""
    return _fit_to_max_prompt(head_text.rstrip())


def _probe_transformers_config_subprocess(model_id: str) -> tuple[bool, str]:
    probe_code = (
        "import sys; from transformers import AutoConfig; "
        "AutoConfig.from_pretrained(sys.argv[1])"
    )
    proc = subprocess.run(
        [sys.executable, "-c", probe_code, model_id],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=90,
    )
    if proc.returncode == 0:
        return True, ""
    return False, (proc.stderr or proc.stdout or f"exit {proc.returncode}").strip()


def _ensure_transformers_supports_model(model_id: str) -> None:
    already_imported = "transformers" in sys.modules
    if not already_imported:
        ok, err_str = _probe_transformers_config_subprocess(model_id)
        if ok:
            return
    else:
        from transformers import AutoConfig

        try:
            AutoConfig.from_pretrained(model_id)
            return
        except Exception as first_err:
            err_str = str(first_err)

    if "qwen3_5" not in err_str.lower() and "unrecognized" not in err_str.lower():
        raise RuntimeError(f"AutoConfig probe failed for {model_id}: {err_str[:240]}")

    log(
        f"Installed transformers does not recognize {model_id} ({err_str[:160]}); "
        "upgrading transformers + accelerate + huggingface_hub..."
    )
    subprocess.run(
        [
            sys.executable,
            "-m",
            "pip",
            "install",
            "-q",
            "-U",
            "transformers",
            "accelerate",
            "huggingface_hub",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=True,
        timeout=240,
    )
    if already_imported:
        raise RuntimeError(
            f"Upgraded transformers to support {model_id}, but 'transformers' was already imported in this "
            "Python process (existing imported class references would remain stale). "
            "Restart Python and re-run distill_ascend_h100.py."
        )
    importlib.invalidate_caches()
    ok_after, err_after = _probe_transformers_config_subprocess(model_id)
    if not ok_after:
        raise RuntimeError(f"Upgraded transformers still failed to recognize {model_id}: {err_after[:240]}")
    log("Upgraded transformers successfully recognizes model config.")


def _supported_vllm_llm_kwargs(llm_cls: Any) -> set[str]:
    """Detect supported LLM.__init__ kwargs even when LLM.__init__ forwards via **kwargs to EngineArgs."""
    supported: set[str] = set()
    has_var_kw = False
    try:
        sig_params = inspect.signature(llm_cls.__init__).parameters
        supported.update(sig_params.keys())
        has_var_kw = any(p.kind == inspect.Parameter.VAR_KEYWORD for p in sig_params.values())
    except Exception:
        pass
    if has_var_kw:
        try:
            from vllm.engine.arg_utils import EngineArgs

            supported.update(inspect.signature(EngineArgs.__init__).parameters.keys())
            supported.update(getattr(EngineArgs, "__dataclass_fields__", {}).keys())
        except Exception:
            pass
    return supported


class VllmEngine:
    def __init__(self, model_id: str, max_new_tokens: int = 1536, max_model_len: int = MAX_MODEL_LEN) -> None:
        from transformers import AutoConfig, AutoTokenizer
        from vllm import LLM, SamplingParams

        if max_new_tokens < 64 or max_new_tokens > max_model_len - 1024:
            raise ValueError(
                f"max_new_tokens={max_new_tokens} out of bounds for max_model_len={max_model_len} "
                f"(must be in [64, {max_model_len - 1024}])"
            )
        self.model_id = model_id
        self.backend_name = "vllm"
        self.max_new_tokens = max_new_tokens
        self.max_model_len = max_model_len
        self.max_prompt_tokens = max_model_len - max_new_tokens - 64

        cfg = AutoConfig.from_pretrained(model_id)
        quant_cfg = getattr(cfg, "quantization_config", None)
        is_fp8 = "FP8" in model_id.upper() or (
            isinstance(quant_cfg, dict) and "fp8" in str(quant_cfg.get("quant_method", "")).lower()
        )
        self.dtype_str = "fp8" if is_fp8 else "bfloat16"
        vllm_dtype_arg = "auto" if is_fp8 else "bfloat16"

        archs = list(getattr(cfg, "architectures", None) or [])
        is_vlm = getattr(cfg, "model_type", "") == "qwen3_5" or any(
            "ForConditionalGeneration" in a for a in archs
        )
        self.tokenizer = AutoTokenizer.from_pretrained(model_id)

        llm_kwargs: dict[str, Any] = {
            "model": model_id,
            "dtype": vllm_dtype_arg,
            "max_model_len": max_model_len,
            "gpu_memory_utilization": 0.92,
            "trust_remote_code": False,
        }
        supported_kw = _supported_vllm_llm_kwargs(LLM)
        if is_vlm:
            if "language_model_only" in supported_kw:
                llm_kwargs["language_model_only"] = True
            elif "limit_mm_per_prompt" in supported_kw:
                llm_kwargs["limit_mm_per_prompt"] = {"image": 0, "video": 0}

        log(f"Initializing vLLM offline LLM({model_id}, kwargs={llm_kwargs})...")
        try:
            self.llm: Any = LLM(**llm_kwargs)
        except TypeError:
            llm_kwargs.pop("language_model_only", None)
            llm_kwargs.pop("limit_mm_per_prompt", None)
            self.llm = LLM(**llm_kwargs)

        self.sampling_params = SamplingParams(
            temperature=0.6,
            top_p=0.95,
            top_k=20,
            max_tokens=max_new_tokens,
            seed=42,
        )

    def generate_batch(
        self,
        user_messages: list[str],
        diff_start_indices: list[int] | None = None,
    ) -> list[str]:
        prompts = [
            _budget_user_message_preserve_head_and_diff(
                self.tokenizer,
                msg,
                self.max_prompt_tokens,
                diff_start_idx=(diff_start_indices[i] if diff_start_indices is not None else None),
            )
            for i, msg in enumerate(user_messages)
        ]
        outputs = self.llm.generate(prompts, self.sampling_params, use_tqdm=False)
        texts: list[str] = []
        for out in outputs:
            if out.outputs:
                texts.append(out.outputs[0].text)
            else:
                texts.append("")
        return texts

    def close(self) -> None:
        llm_ref = getattr(self, "llm", None)
        self.llm = None
        if llm_ref is not None:
            try:
                engine = getattr(llm_ref, "llm_engine", None)
                if engine is not None and hasattr(engine, "shutdown"):
                    engine.shutdown()
            except Exception:
                pass
            del llm_ref
        try:
            from vllm.distributed.parallel_state import destroy_model_parallel

            destroy_model_parallel()
        except Exception:
            pass
        _clear_cuda()


class TransformersEngine:
    def __init__(
        self,
        model_id: str,
        vram_gib: float,
        max_new_tokens: int = 1536,
        max_model_len: int = MAX_MODEL_LEN,
    ) -> None:
        import transformers
        from transformers import AutoConfig, AutoTokenizer

        if max_new_tokens < 64 or max_new_tokens > max_model_len - 1024:
            raise ValueError(
                f"max_new_tokens={max_new_tokens} out of bounds for max_model_len={max_model_len} "
                f"(must be in [64, {max_model_len - 1024}])"
            )
        self.model_id = model_id
        self.backend_name = f"transformers-{transformers.__version__}"
        self.max_new_tokens = max_new_tokens
        self.max_model_len = max_model_len
        self.max_prompt_tokens = min(6144, max_model_len - max_new_tokens - 64)
        self.dtype = torch.bfloat16
        self.batch_size = 14 if vram_gib >= 88.0 else (10 if vram_gib >= 75.0 else 4)
        torch.backends.cuda.matmul.allow_tf32 = True

        cfg = AutoConfig.from_pretrained(model_id)
        quant_cfg = getattr(cfg, "quantization_config", None)
        is_fp8 = "FP8" in model_id.upper() or (
            isinstance(quant_cfg, dict) and "fp8" in str(quant_cfg.get("quant_method", "")).lower()
        )
        self.dtype_str = "fp8" if is_fp8 else "bfloat16"

        archs = list(getattr(cfg, "architectures", None) or [])
        model_type = str(getattr(cfg, "model_type", "") or "")
        is_vlm = model_type == "qwen3_5" or any(
            "ForConditionalGeneration" in a for a in archs
        )
        log(
            f"Loading {model_id} via Transformers (model_type={model_type}, "
            f"archs={archs}, is_vlm={is_vlm}, dtype={self.dtype_str}, batch={self.batch_size})..."
        )

        self.tokenizer = AutoTokenizer.from_pretrained(model_id, padding_side="left")
        if self.tokenizer.pad_token_id is None:
            self.tokenizer.pad_token_id = self.tokenizer.eos_token_id

        loader_cls: Any = None
        if is_vlm:
            loader_cls = getattr(transformers, "AutoModelForImageTextToText", None)
            if loader_cls is None:
                loader_cls = getattr(transformers, "Qwen3_5ForConditionalGeneration", None)
            if loader_cls is None:
                loader_cls = getattr(transformers, "AutoModelForVision2Seq", None)
        if loader_cls is None:
            loader_cls = getattr(transformers, "AutoModelForCausalLM")

        load_kwargs: dict[str, Any] = {
            "low_cpu_mem_usage": True,
            "device_map": "auto",
            "attn_implementation": "sdpa",
        }
        if not is_fp8:
            load_kwargs["torch_dtype"] = self.dtype

        try:
            self.model: Any = loader_cls.from_pretrained(model_id, **load_kwargs)
        except TypeError:
            if "torch_dtype" in load_kwargs:
                load_kwargs["dtype"] = load_kwargs.pop("torch_dtype")
            self.model = loader_cls.from_pretrained(model_id, **load_kwargs)
        self.model.eval()

    def generate_batch(
        self,
        user_messages: list[str],
        diff_start_indices: list[int] | None = None,
    ) -> list[str]:
        all_outputs: list[str] = []
        for start in range(0, len(user_messages), self.batch_size):
            chunk = user_messages[start : start + self.batch_size]
            chunk_offsets = (
                diff_start_indices[start : start + self.batch_size]
                if diff_start_indices is not None
                else None
            )
            prompts = [
                _budget_user_message_preserve_head_and_diff(
                    self.tokenizer,
                    msg,
                    self.max_prompt_tokens,
                    diff_start_idx=(chunk_offsets[i] if chunk_offsets is not None else None),
                )
                for i, msg in enumerate(chunk)
            ]
            enc = self.tokenizer(
                prompts,
                return_tensors="pt",
                padding=True,
                truncation=False,
            )
            target_device = next(self.model.parameters()).device
            enc = {k: v.to(target_device) for k, v in enc.items()}
            with torch.no_grad():
                gen = self.model.generate(
                    **enc,
                    max_new_tokens=self.max_new_tokens,
                    do_sample=True,
                    temperature=0.6,
                    top_p=0.95,
                    top_k=20,
                    pad_token_id=self.tokenizer.pad_token_id,
                )
            in_len = enc["input_ids"].shape[1]
            for seq in gen:
                all_outputs.append(
                    self.tokenizer.decode(seq[in_len:], skip_special_tokens=True)
                )
            del enc, gen
            _clear_cuda()
        return all_outputs

    def close(self) -> None:
        model_ref = getattr(self, "model", None)
        self.model = None
        if model_ref is not None:
            del model_ref
        _clear_cuda()


def _vllm_importable(try_install: bool) -> bool:
    try:
        import vllm  # noqa: F401

        return True
    except Exception:
        if not try_install:
            return False
    # Never let pip reinstall/downgrade torch inside a live CUDA process; probe compatibility first.
    if torch is None:
        return False
    torch_base = str(getattr(torch, "__version__", "")).split("+")[0]
    if not torch_base:
        return False
    constraint_path = Path(tempfile.gettempdir()) / f"_torch_constraint_{os.getpid()}.txt"
    try:
        constraint_path.write_text(f"torch=={torch_base}\n", encoding="utf-8")
        log(
            f"vllm not preinstalled; probing binary wheel compatible with torch=={torch_base} "
            "(timeout=150s)..."
        )
        res = subprocess.run(
            [
                sys.executable,
                "-m",
                "pip",
                "install",
                "-q",
                "--prefer-binary",
                "-c",
                str(constraint_path),
                "vllm",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
            timeout=150,
        )
        if res.returncode == 0:
            probe = subprocess.run(
                [sys.executable, "-c", "import torch, vllm; from vllm import LLM, SamplingParams"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace",
                check=False,
                timeout=30,
            )
            if probe.returncode == 0:
                import vllm  # noqa: F401

                log(f"vllm {getattr(vllm, '__version__', 'unknown')} installed and verified.")
                return True
        log("Compatible binary vllm wheel unavailable; using rock-solid Transformers fallback.")
    except Exception as e:
        log(f"vllm install skipped/failed ({e}); using rock-solid Transformers fallback.")
    finally:
        constraint_path.unlink(missing_ok=True)
    return False


def select_model_candidates(vram_gib: float, explicit_model: str | None = None) -> list[str]:
    """Select teacher models strictly bounded by available VRAM (never attempt 54-61 GiB BF16 on <65 GiB)."""
    if vram_gib < MIN_VRAM_GIB:
        raise RuntimeError(
            f"GPU VRAM {vram_gib:.2f} GiB is below the hard minimum {MIN_VRAM_GIB:.1f} GiB! "
            "Refusing to silently fall back to a small model. Allocate H100/G4/A100."
        )
    if explicit_model:
        m = explicit_model.strip()
        if vram_gib < BF16_FULL_VRAM_GIB and "FP8" not in m.upper():
            raise RuntimeError(
                f"Requested non-FP8 model {m!r} requires >= {BF16_FULL_VRAM_GIB:.1f} GiB VRAM, "
                f"but only {vram_gib:.2f} GiB is available."
            )
        return [m]
    if vram_gib >= BF16_FULL_VRAM_GIB:
        return [PRIMARY_MODEL_ID, FALLBACK_FP8_MODEL_ID, FALLBACK_32B_MODEL_ID]
    # 38-64.9 GiB (e.g., A100-40GB / 39.5 GiB): FP8 ONLY — never attempt BF16 27B/32B (~54-61 GiB)
    return [FALLBACK_FP8_MODEL_ID]


def load_teacher_engine(
    vram_gib: float,
    allow_vllm: bool = True,
    try_install_vllm: bool = False,
    max_new_tokens: int = 1536,
    explicit_model: str | None = None,
) -> VllmEngine | TransformersEngine:
    model_candidates = select_model_candidates(vram_gib, explicit_model=explicit_model)

    has_vllm = allow_vllm and _vllm_importable(try_install=try_install_vllm)
    errors: list[str] = []

    for model_id in model_candidates:
        try:
            _ensure_transformers_supports_model(model_id)
        except Exception as e:
            msg = f"Config check failed for {model_id}: {e}"
            log(msg)
            errors.append(msg)
            continue

        if has_vllm:
            eng_vllm: VllmEngine | None = None
            try:
                eng_vllm = VllmEngine(model_id=model_id, max_new_tokens=max_new_tokens)
                return eng_vllm
            except Exception as e:
                msg = f"vLLM load failed for {model_id}: {e}"
                log(msg + " -> falling back to Transformers.")
                errors.append(msg)
                if eng_vllm is not None:
                    eng_vllm.close()
                eng_vllm = None
                _clear_cuda()

        eng_tf: TransformersEngine | None = None
        try:
            eng_tf = TransformersEngine(
                model_id=model_id,
                vram_gib=vram_gib,
                max_new_tokens=max_new_tokens,
            )
            return eng_tf
        except Exception as e:
            msg = f"Transformers load failed for {model_id}: {e}"
            log(msg)
            errors.append(msg)
            if eng_tf is not None:
                eng_tf.close()
            eng_tf = None
            _clear_cuda()

    raise RuntimeError(
        "All teacher model candidates failed to load:\n- " + "\n- ".join(errors)
    )


def _infer_primary_symbol(item: dict[str, Any]) -> str:
    dist = item.get("distilled") or {}
    codes = [str(c).strip() for c in (dist.get("error_codes") or []) if str(c).strip()]
    search_blob = "\n".join(
        [
            " ".join(codes),
            str(item.get("verbatim_root_line") or ""),
            str(item.get("title") or ""),
            str(dist.get("root_cause_zh") or ""),
            str(dist.get("pr_fix_mechanism_zh") or ""),
        ]
    )
    for sym_name, pat in PRIMARY_SYMBOL_PATTERNS:
        if pat.search(search_blob):
            return sym_name
    if codes:
        return codes[0].upper()
    # Extract concrete aclnn* or Python exception symbol if present (ASCII \b matches JS RegExp!)
    aclnn_m = re.search(r"\b(aclnn[A-Z][A-Za-z0-9_]{3,32})\b", search_blob, re.A)
    if aclnn_m:
        return aclnn_m.group(1)
    exc_m = re.search(
        r"\b(RuntimeError|ValueError|AssertionError|KeyError|TypeError|AttributeError|"
        r"OSError|ImportError|TimeoutError|OutOfMemoryError|ZMQError|Segmentation fault)\b",
        search_blob,
        re.A,
    )
    if exc_m:
        return exc_m.group(1)
    return "general"


def cluster_fault_families(
    items: list[dict[str, Any]],
    min_families: int = 20,
    max_families: int = 25,
) -> list[dict[str, Any]]:
    """Cluster distilled items by (fault_domain, primary_code_or_symbol) into 20-25 families."""
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for it in items:
        dist = it.get("distilled") or {}
        domain = str(dist.get("fault_domain") or "other")
        sym = _infer_primary_symbol(it)
        grouped[(domain, sym)].append(it)

    def _cluster_rank(entry: tuple[tuple[str, str], list[dict[str, Any]]]) -> tuple[int, int, int]:
        _, members = entry
        with_diff = sum(1 for m in members if int(m.get("pr_diff_lines") or 0) > 0)
        confirmed = sum(
            1
            for m in members
            if _parse_strict_bool((m.get("distilled") or {}).get("root_cause_confirmed"))
        )
        return (len(members), with_diff, confirmed)

    # If fewer than min_families and we have large buckets, split the largest *validly* splittable bucket
    # (never early-break just because the single largest bucket has skewed repo counts!).
    while len(grouped) < min_families:
        candidates_ordered = sorted(
            (
                (k, v)
                for k, v in grouped.items()
                if len(v) >= 8 and len({m.get("repo") for m in v}) >= 2
            ),
            key=lambda kv: -len(kv[1]),
        )
        split_done = False
        for (dom, sym), members in candidates_ordered:
            by_repo: dict[str, list[dict[str, Any]]] = defaultdict(list)
            for m in members:
                by_repo[str(m.get("repo") or "other")].append(m)
            top_repos = sorted(by_repo.items(), key=lambda kv: -len(kv[1]))
            if len(top_repos) < 2:
                continue
            r0_name, r0_items = top_repos[0]
            if len(r0_items) < 3 or len(members) - len(r0_items) < 3:
                continue
            short_r0 = r0_name.split("/")[-1]
            k_left = (dom, f"{sym} ({short_r0})")
            k_right = (dom, f"{sym} (ecosystem)")
            if k_left in grouped or k_right in grouped:
                continue
            del grouped[(dom, sym)]
            grouped[k_left] = r0_items
            grouped[k_right] = [m for _, lst in top_repos[1:] for m in lst]
            split_done = True
            break
        if not split_done:
            break

    merged_symbols_by_key: dict[tuple[str, str], list[str]] = defaultdict(list)
    # If more than max_families, keep top families ensuring every present fault_domain gets coverage
    if len(grouped) > max_families:
        ordered = sorted(grouped.items(), key=_cluster_rank, reverse=True)
        kept_keys: list[tuple[str, str]] = []
        seen_domains: set[str] = set()
        # Pass 1: best cluster per fault_domain
        for key, _ in ordered:
            dom = key[0]
            if dom not in seen_domains:
                seen_domains.add(dom)
                kept_keys.append(key)
        # Pass 2: fill remaining slots up to max_families by rank
        for key, _ in ordered:
            if len(kept_keys) >= max_families:
                break
            if key not in kept_keys:
                kept_keys.append(key)
        kept_set = set(kept_keys)
        merged_groups: dict[tuple[str, str], list[dict[str, Any]]] = {
            k: list(grouped[k]) for k in kept_keys
        }
        # Re-home dropped small clusters into their domain's largest kept cluster and record merged symbols
        domain_primary: dict[str, tuple[str, str]] = {}
        for k in kept_keys:
            if k[0] not in domain_primary:
                domain_primary[k[0]] = k
        for key, members in ordered:
            if key in kept_set:
                continue
            target = domain_primary.get(key[0]) or kept_keys[0]
            merged_groups[target].extend(members)
            if key[1] != target[1] and key[1] not in merged_symbols_by_key[target]:
                merged_symbols_by_key[target].append(key[1])
        grouped = merged_groups

    # Build rich family summaries
    final_ordered = sorted(grouped.items(), key=_cluster_rank, reverse=True)
    families: list[dict[str, Any]] = []
    for idx, ((domain, sym), members) in enumerate(final_ordered, 1):
        members_sorted = sorted(
            members,
            key=lambda m: (
                -int(bool(m.get("verbatim_root_verified"))),
                -int(int(m.get("pr_diff_lines") or 0) > 0),
                -int(_parse_strict_bool((m.get("distilled") or {}).get("root_cause_confirmed"))),
                -len(str((m.get("distilled") or {}).get("pr_fix_mechanism_zh") or "")),
            ),
        )
        subsys_counts = Counter(
            str((m.get("distilled") or {}).get("subsystem") or "other") for m in members_sorted
        )
        eco_counts = Counter(infer_ecosystem(m) for m in members_sorted)
        repo_counts = Counter(str(m.get("repo") or "") for m in members_sorted)
        code_counts = Counter(
            c
            for m in members_sorted
            for c in ((m.get("distilled") or {}).get("error_codes") or [])
        )

        reps = members_sorted[:4]
        rep_issues = []
        for m in reps:
            verified_fix_refs = _extract_verified_fix_refs(m)
            cited_refs = [
                str(r).strip()
                for r in ((m.get("distilled") or {}).get("fix_pr_refs") or [])
                if str(r).strip()
            ]
            rep_issues.append(
                {
                    "key": m["key"],
                    "repo": m["repo"],
                    "url": m["url"],
                    "title": m["title"],
                    "verbatim_root_line": m.get("verbatim_root_line") or "",
                    "verbatim_root_verified": bool(m.get("verbatim_root_verified")),
                    "verified_fix_pr_refs": verified_fix_refs,
                    "cited_pr_refs": cited_refs,
                    "fix_pr_refs": verified_fix_refs,
                    "root_cause_zh": (m.get("distilled") or {}).get("root_cause_zh") or "",
                    "pr_fix_mechanism_zh": (m.get("distilled") or {}).get("pr_fix_mechanism_zh") or "",
                    "fix_or_workaround_zh": (m.get("distilled") or {}).get("fix_or_workaround_zh") or "",
                    "same_code_trap_zh": (m.get("distilled") or {}).get("same_code_trap_zh") or "",
                    "forensic_chain_zh": str(
                        m.get("forensic_chain_zh")
                        or (m.get("distilled") or {}).get("forensic_chain_zh")
                        or ""
                    ).strip(),
                    "thinking_summary": m.get("thinking_summary") or "",
                }
            )

        traps = [
            str((m.get("distilled") or {}).get("same_code_trap_zh") or "").strip()
            for m in members_sorted
            if str((m.get("distilled") or {}).get("same_code_trap_zh") or "").strip()
        ]
        queries: list[str] = []
        for m in members_sorted:
            for q in (m.get("distilled") or {}).get("colloquial_queries_zh") or []:
                qs = str(q).strip()
                if qs and qs not in queries:
                    queries.append(qs)
                if len(queries) >= 6:
                    break
            if len(queries) >= 6:
                break

        merged_syms = merged_symbols_by_key.get((domain, sym), [])
        families.append(
            {
                "familyId": f"FAM-{idx:02d}",
                "faultDomain": domain,
                "primarySymbol": sym,
                **({"mergedSymbols": merged_syms} if merged_syms else {}),
                "dominantSubsystem": subsys_counts.most_common(1)[0][0] if subsys_counts else "other",
                "count": len(members_sorted),
                "verifiedRootCount": sum(1 for m in members_sorted if m.get("verbatim_root_verified")),
                "confirmedRootCauseCount": sum(
                    1
                    for m in members_sorted
                    if _parse_strict_bool((m.get("distilled") or {}).get("root_cause_confirmed"))
                ),
                "withPrDiffCount": sum(
                    1 for m in members_sorted if int(m.get("pr_diff_lines") or 0) > 0
                ),
                "ecosystems": dict(eco_counts),
                "repos": dict(repo_counts.most_common(6)),
                "topErrorCodes": [c for c, _ in code_counts.most_common(8)],
                "sameCodeTraps": list(dict.fromkeys(traps))[:3],
                "colloquialQueries": queries[:5],
                "representatives": rep_issues,
                "memberKeys": [m["key"] for m in members_sorted],
            }
        )
    return families


_MENTION_ONLY_LINK_SOURCES: frozenset[str] = frozenset(
    {"local_git_pr_ref", "gitcode_text_ref_pr", "github_api"}
)


def _unquote_git_path(raw: str) -> str:
    """Decode Git C-quoted diff paths including octal UTF-8 escapes like \"b/docs/\\347\\224\\250\\346\\263\\225.md\"."""
    s = raw.strip()
    if len(s) >= 2 and s[0] == '"' and s[-1] == '"':
        inner = s[1:-1]
        buf = bytearray()
        i = 0
        n = len(inner)
        esc_map = {"a": 7, "b": 8, "f": 12, "n": 10, "r": 13, "t": 9, "v": 11, "\\": 92, '"': 34}
        while i < n:
            ch = inner[i]
            if ch == "\\" and i + 1 < n:
                nxt = inner[i + 1]
                if "0" <= nxt <= "7":
                    j = i + 1
                    while j < min(n, i + 4) and "0" <= inner[j] <= "7":
                        j += 1
                    buf.append(int(inner[i + 1 : j], 8) & 0xFF)
                    i = j
                    continue
                if nxt in esc_map:
                    buf.append(esc_map[nxt])
                    i += 2
                    continue
                buf.extend(nxt.encode("utf-8"))
                i += 2
                continue
            buf.extend(ch.encode("utf-8"))
            i += 1
        s = buf.decode("utf-8", errors="replace")
    if s.startswith(("a/", "b/")):
        s = s[2:]
    return s.strip()


def _extract_git_diff_header_paths(line: str, allow_header: bool) -> list[str]:
    m_qq = re.match(r'^diff --git ("(?:\\.|[^"\\])*") ("(?:\\.|[^"\\])*")$', line)
    if m_qq:
        return [_unquote_git_path(m_qq.group(1)), _unquote_git_path(m_qq.group(2))]
    m_qu = re.match(r'^diff --git ("(?:\\.|[^"\\])*") b/(.+)$', line)
    if m_qu:
        return [_unquote_git_path(m_qu.group(1)), m_qu.group(2).strip()]
    m_uq = re.match(r'^diff --git a/(.+?) ("(?:\\.|[^"\\])*")$', line)
    if m_uq:
        return [m_uq.group(1).strip(), _unquote_git_path(m_uq.group(2))]
    m_uu = re.match(r"^diff --git a/(.+?) b/(.+)$", line)
    if m_uu:
        return [m_uu.group(1).strip(), m_uu.group(2).strip()]
    if allow_header:
        m_pq = re.match(r'^(?:\+\+\+|---) ("(?:\\.|[^"\\])*")(?:\t.*|\s+\d{4}-\d{2}-\d{2}\s+.*)?$', line)
        if m_pq:
            return [_unquote_git_path(m_pq.group(1))]
        m_pu = re.match(r"^(?:\+\+\+|---) (?:[ab]/)?([^\t\r\n]+?)(?:\t.*|\s+\d{4}-\d{2}-\d{2}\s+.*)?$", line)
        if m_pu:
            return [m_pu.group(1).strip()]
    return []


def _is_docs_only_diff_snippet(snippet: str) -> bool:
    s = (snippet or "").strip()
    if not s:
        return False
    paths: list[str] = []
    old_rem = 0
    new_rem = 0
    hunk_re = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")
    for ln in _LINE_BREAK_RE.split(s):
        if ln.startswith("diff --git "):
            old_rem = 0
            new_rem = 0
            paths.extend(_extract_git_diff_header_paths(ln, True))
            continue
        hm = hunk_re.match(ln)
        if hm:
            old_rem = int(hm.group(2)) if hm.group(2) is not None else 1
            new_rem = int(hm.group(4)) if hm.group(4) is not None else 1
            continue
        if old_rem > 0 or new_rem > 0:
            if ln.startswith("\\ No newline"):
                continue
            if ln.startswith("-"):
                old_rem = max(0, old_rem - 1)
                continue
            if ln.startswith("+"):
                new_rem = max(0, new_rem - 1)
                continue
            if ln.startswith(" ") or ln == "":
                old_rem = max(0, old_rem - 1)
                new_rem = max(0, new_rem - 1)
                continue
            old_rem = 0
            new_rem = 0
        paths.extend(_extract_git_diff_header_paths(ln, True))
    uniq = sorted({p for p in paths if p and p != "/dev/null"})
    if not uniq:
        return False
    return all(
        re.search(r"(?:^|/)docs?/", p, re.I)
        or re.search(r"\.(?:md|mdx|rst)$", p, re.I)
        or re.search(r"(?:^|/)(?:readme|changelog|releasenote|license)(?:\.(?:md|mdx|rst))?$", p, re.I)
        for p in uniq
    )


def _is_docs_only_pr_title(title: str) -> bool:
    t = (title or "").strip()
    if not t:
        return False
    if re.match(r"^(?:\[[^\]]+\]\s*)*docs?(?:\([^)]*\))?\s*[:：]", t, re.I):
        return True
    if re.match(r"^(?:\[[^\]]+\]\s*)*\[docs?(?:umentation)?\]", t, re.I) and not re.search(
        r"\[(?:bugfix|fix|feat|perf|core)\]", t, re.I
    ):
        return True
    if re.match(r"^(?:文档|更新资料|补充.*文档|修正.*文档|新增.*文档|错误码参考|接口文档|参数文档)", t):
        return True
    if re.search(r"\b(?:api\s+support\s+(?:status|documentation)|update\s+docs?)\b", t, re.I):
        return True
    return False


def _extract_verified_fix_refs(item: dict[str, Any]) -> list[str]:
    """Return ONLY merged, non-docs-only, deterministically corroborated fix PR/MR refs.

    Mirrors scripts/wiki/verify-distilled-ascend.ts:partitionItemProvenance exactly so
    distilled_ascend_dual.json, candidate_fault_families.md, and verified_audit_report.json
    never disagree on verified fix status.
    """
    eco = infer_ecosystem(item)
    repo = str(item.get("repo") or "").strip()
    issue_repo_lower = repo.lower()
    linked_prs = [p for p in (item.get("linked_merged_prs") or []) if isinstance(p, dict)]
    if not linked_prs:
        return []

    linked_by_canon: dict[str, tuple[str, dict[str, Any]]] = {}
    same_repo_nums: set[int] = set()
    cross_repo_nums: set[int] = set()
    model_same_repo_explicit_nums: set[int] = set()
    model_cross_repo_nums: set[int] = set()

    def _track_scope(parsed: tuple[str, str, int, str], from_model: bool, explicit_repo: bool, allow_bare: bool) -> None:
        if not explicit_repo and not allow_bare:
            return
        ref_eco, ref_repo, ref_num, _ = parsed
        if ref_eco == eco and ref_repo.lower() == issue_repo_lower:
            same_repo_nums.add(ref_num)
            if from_model:
                model_same_repo_explicit_nums.add(ref_num)
        else:
            cross_repo_nums.add(ref_num)
            if from_model:
                model_cross_repo_nums.add(ref_num)

    def _is_bare_input(raw_val: Any) -> bool:
        if isinstance(raw_val, int) and not isinstance(raw_val, bool):
            return True
        if isinstance(raw_val, str):
            return bool(re.match(r"^[#!]?\d+$", raw_val.strip()))
        return False

    for lp in linked_prs:
        lp_url = str(lp.get("url") or "").strip()
        lp_raw = lp.get("ref") or lp_url or lp.get("number")
        parsed = _parse_pr_ref(lp_raw, eco, repo, explicit_url=lp_url)
        if parsed is not None:
            linked_by_canon[parsed[3].lower()] = (parsed[3], lp)
            _track_scope(parsed, False, not _is_bare_input(lp_raw) or bool(lp_url), True)

    for cand in item.get("candidate_prs") or []:
        parsed = _parse_pr_ref(cand, eco, repo)
        if parsed is not None:
            _track_scope(parsed, False, not _is_bare_input(cand), False)

    dist = item.get("distilled") or {}
    root_cause_confirmed = _parse_strict_bool(dist.get("root_cause_confirmed"))
    persisted_unparsed = sum(
        1
        for x in (dist.get("unparsed_fix_pr_citations") or [])
        if x is not None and not isinstance(x, bool) and str(x).strip()
    )

    model_cited_canonical: set[str] = set()
    unparsed_model_citations = 0
    deferred_bare: list[tuple[str, str, int, str]] = []
    for raw_val in list(dist.get("fix_pr_refs") or []) + list(dist.get("fix_pr_numbers") or []):
        if raw_val is None or isinstance(raw_val, bool):
            continue
        if isinstance(raw_val, str) and not raw_val.strip():
            continue
        if not isinstance(raw_val, (str, int)):
            if raw_val:
                unparsed_model_citations += 1
            continue
        parsed = _parse_pr_ref(raw_val, eco, repo)
        if parsed is None:
            unparsed_model_citations += 1
            continue
        explicit = not _is_bare_input(raw_val)
        if explicit:
            _track_scope(parsed, True, True, False)
            model_cited_canonical.add(parsed[3].lower())
        else:
            deferred_bare.append(parsed)

    def _bare_same_repo_allowed(num: int) -> bool:
        if num not in cross_repo_nums:
            return True
        return num in model_same_repo_explicit_nums and num not in model_cross_repo_nums

    for parsed in deferred_bare:
        num = parsed[2]
        if _bare_same_repo_allowed(num):
            model_cited_canonical.add(parsed[3].lower())
        elif num in model_cross_repo_nums and num not in model_same_repo_explicit_nums and num not in same_repo_nums:
            continue
        else:
            unparsed_model_citations += 1

    diff_lines = int(item.get("pr_diff_lines") or 0)
    has_diff_snippet = diff_lines > 0
    diff_source, diff_bound = _resolve_verified_diff_source(item) if has_diff_snippet else ("", False)
    diff_source_lower = diff_source.lower() if (diff_bound and diff_source) else ""

    raw_diff_snippet = str(item.get("pr_diff_snippet") or "")
    raw_snippet_is_docs_only = _parse_strict_bool(item.get("pr_diff_docs_only")) or _is_docs_only_diff_snippet(
        raw_diff_snippet
    )
    verified: list[str] = []
    for canon_lower, (canon, lp) in linked_by_canon.items():
        is_docs_only = _parse_strict_bool(lp.get("docs_only")) or _is_docs_only_pr_title(
            str(lp.get("title") or "")
        )
        if is_docs_only:
            continue
        diff_snippet_is_docs_only = diff_source_lower == canon_lower and (
            _parse_strict_bool(lp.get("diff_excerpt_docs_only")) or raw_snippet_is_docs_only
        )
        src = str(lp.get("source") or "").strip().lower()
        is_mention_only = src != "" and src in _MENTION_ONLY_LINK_SOURCES
        diff_ownership_compatible = (not has_diff_snippet) or (
            diff_source_lower == canon_lower and not diff_snippet_is_docs_only
        )
        has_verified_fix_diff = (
            diff_source_lower == canon_lower and not is_mention_only and not diff_snippet_is_docs_only
        )
        has_unambiguous_model_fix = (
            canon_lower in model_cited_canonical
            and root_cause_confirmed
            and len(model_cited_canonical) == 1
            and unparsed_model_citations == 0
            and persisted_unparsed == 0
            and diff_ownership_compatible
        )
        if has_verified_fix_diff or has_unambiguous_model_fix:
            verified.append(canon)
    return verified


def _md_escape_table(val: Any) -> str:
    """Escape Markdown table backslashes, pipes, and line breaks cleanly (remark-gfm safe)."""
    s = re.sub(r"[\r\n\v\f\x85\u2028\u2029]+", " ", str(val or "")).strip()
    return s.replace("\\", "\\\\").replace("|", "\\|")


def _md_code_cell(val: Any) -> str:
    s = _md_escape_table(val).replace("`", "'")
    return f"`{s}`"


def render_candidate_families_md(
    payload: dict[str, Any],
    families: list[dict[str, Any]],
) -> str:
    items = payload.get("items") or []
    eco_counts = Counter(infer_ecosystem(i) for i in items)
    domain_counts = Counter(
        str((i.get("distilled") or {}).get("fault_domain") or "other") for i in items
    )

    lines: list[str] = [
        "# Ascend Dual-Ecosystem Candidate Fault Families Report",
        "",
        "## Run Summary",
        "",
        "| Metric | Value |",
        "| --- | --- |",
        f"| Generated At (UTC) | {_md_code_cell(payload['generatedAt'])} |",
        f"| Teacher Model | {_md_code_cell(payload['teacherModel'])} ({_md_code_cell(payload['backend'])}, {_md_code_cell(payload['dtype'])}) |",
        f"| GPU / VRAM | {_md_code_cell(payload['gpu'])} ({payload['vramGiB']} GiB) |",
        f"| Elapsed | {payload['elapsedSec']} s |",
        f"| Total Distilled Issues | **{payload['totalIssues']}** (GitHub: {eco_counts.get('github', 0)}, GitCode: {eco_counts.get('gitcode', 0)}) |",
        f"| Verbatim Root Verified | **{payload['verbatimVerifiedCount']}/{payload['totalIssues']}** (model: {payload['modelVerbatimVerifiedCount']}, fallback: {payload['fallbackVerbatimVerifiedCount']}) |",
        f"| Forensic Chain Present | **{payload.get('forensicChainPresentCount', 0)}/{payload['totalIssues']}** |",
        f"| Candidate Fault Families | **{len(families)}** |",
        "",
        "### Domain Distribution",
        "",
        "| Fault Domain | Issues |",
        "| --- | ---: |",
    ]
    for dom, cnt in domain_counts.most_common():
        lines.append(f"| {_md_code_cell(dom)} | {cnt} |")

    lines.extend(
        [
            "",
            "## Family Index",
            "",
            "| ID | Fault Domain | Primary Code / Symbol | Subsystem | Issues | PR Diffs | Ecosystems | Top Error Codes |",
            "| --- | --- | --- | --- | ---: | ---: | --- | --- |",
        ]
    )
    for fam in families:
        eco_str = _md_escape_table(", ".join(f"{k}:{v}" for k, v in sorted(fam["ecosystems"].items())))
        codes_str = ", ".join(_md_code_cell(c) for c in fam["topErrorCodes"][:5]) or "-"
        sym_display = fam["primarySymbol"]
        if fam.get("mergedSymbols"):
            sym_display = f"{sym_display} (+{len(fam['mergedSymbols'])})"
        lines.append(
            f"| {_md_escape_table(fam['familyId'])} | {_md_code_cell(fam['faultDomain'])} | {_md_code_cell(sym_display)} | "
            f"{_md_code_cell(fam['dominantSubsystem'])} | {fam['count']} | {fam['withPrDiffCount']} | "
            f"{eco_str} | {codes_str} |"
        )

    lines.append("")
    for fam in families:
        lines.extend(
            [
                "---",
                f"## {fam['familyId']}: `{fam['faultDomain']}` / `{fam['primarySymbol']}` ({fam['count']} issues)",
                "",
                f"- **Subsystem**: `{fam['dominantSubsystem']}` | **Verified Root Lines**: {fam['verifiedRootCount']}/{fam['count']} | "
                f"**Confirmed Root Causes**: {fam['confirmedRootCauseCount']}/{fam['count']} | **With PR/MR Diffs**: {fam['withPrDiffCount']}",
                f"- **Repos**: {', '.join(f'`{r}` ({c})' for r, c in fam['repos'].items())}",
                f"- **Top Error Codes**: {', '.join(f'`{c}`' for c in fam['topErrorCodes']) or 'None'}",
            ]
        )
        if fam.get("mergedSymbols"):
            lines.append(
                "- **Merged Overflow Symbols**: "
                + ", ".join(f"`{s}`" for s in fam["mergedSymbols"])
            )
        if fam["sameCodeTraps"]:
            lines.append("- **同码异因陷阱 (`same_code_trap_zh`)**:")
            for trap in fam["sameCodeTraps"]:
                lines.append(f"  - {trap}")
        if fam["colloquialQueries"]:
            lines.append(
                "- **典型口语排障检索词**: "
                + " / ".join(f"`{q}`" for q in fam["colloquialQueries"])
            )
        lines.append("")
        lines.append("### Representative Issues, Verbatim Root Lines & PR Mechanisms")
        lines.append("")
        for rep in fam["representatives"]:
            verified_refs = list(rep.get("verified_fix_pr_refs") or [])
            cited_refs = list(rep.get("cited_pr_refs") or [])
            if not verified_refs and not cited_refs and rep.get("fix_pr_refs"):
                cited_refs = list(rep["fix_pr_refs"])
            verified_lower = {str(r).lower() for r in verified_refs}
            extra_cited = [r for r in cited_refs if str(r).lower() not in verified_lower]
            safe_title = _md_escape_table(rep["title"])
            lines.append(f"#### [{rep['key']}]({rep['url']}) — {safe_title}")
            if verified_refs:
                pr_str = ", ".join(f"`{r}`" for r in verified_refs[:3])
                lines.append(f"- **Verified Fix PR/MR**: {pr_str}")
                if extra_cited:
                    cited_str = ", ".join(f"`{r}`" for r in extra_cited[:3])
                    lines.append(f"- **Additional Cited / Candidate PR/MR (unconfirmed)**: {cited_str}")
            elif cited_refs:
                pr_str = ", ".join(f"`{r}`" for r in cited_refs[:3])
                lines.append(f"- **Cited / Candidate PR/MR (unconfirmed)**: {pr_str}")
            else:
                lines.append("- **Verified Fix PR/MR**: N/A")
            if rep["verbatim_root_line"]:
                lines.append(f"- **Verbatim Root Line** (`verified={rep['verbatim_root_verified']}`):")
                fence = "~~~~" if "```" in rep["verbatim_root_line"] else "```"
                lines.append(f"{fence}text")
                lines.append(rep["verbatim_root_line"])
                lines.append(fence)
            if rep["root_cause_zh"]:
                lines.append(f"- **Root Cause**: {rep['root_cause_zh']}")
            if rep["pr_fix_mechanism_zh"]:
                lines.append(f"- **PR Fix Mechanism**: {rep['pr_fix_mechanism_zh']}")
            if rep["fix_or_workaround_zh"]:
                lines.append(f"- **Fix / Workaround**: {rep['fix_or_workaround_zh']}")
            rep_forensic = str(rep.get("forensic_chain_zh") or "").strip()
            if rep_forensic:
                lines.append(f"- **Forensic Chain (3-Step)**: {rep_forensic}")
            if rep["thinking_summary"] and str(rep["thinking_summary"]).strip() != rep_forensic:
                lines.append(f"- **`<think>` Highlight**: {rep['thinking_summary']}")
            lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def _atomic_write_bytes(target: Path, data: bytes) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_name(f".{target.name}.{os.getpid()}.{uuid.uuid4().hex[:8]}.tmp")
    try:
        tmp.write_bytes(data)
        tmp.replace(target)
    except Exception:
        tmp.unlink(missing_ok=True)
        raise


def save_outputs(
    out_json: Path,
    out_md: Path,
    results: list[dict[str, Any]],
    meta: dict[str, Any],
    write_md: bool = True,
) -> tuple[dict[str, Any], str]:
    families = cluster_fault_families(results) if write_md and results else []
    models_used = sorted(
        {
            str(r.get("teacher_model") or "").strip()
            for r in results
            if str(r.get("teacher_model") or "").strip()
        }
    )
    tuple_counts: Counter[tuple[str, str, str]] = Counter()
    for r in results:
        tm = str(r.get("teacher_model") or "").strip()
        tb = str(r.get("teacher_backend") or "").strip()
        td = str(r.get("teacher_dtype") or "").strip()
        if tm:
            tuple_counts[(tm, tb, td)] += 1
    hdr_model = str(meta.get("teacherModel") or "").strip()
    hdr_backend = str(meta.get("backend") or "").strip()
    hdr_dtype = str(meta.get("dtype") or "").strip()
    if tuple_counts and (hdr_model, hdr_backend, hdr_dtype) not in tuple_counts:
        hdr_model, hdr_backend, hdr_dtype = tuple_counts.most_common(1)[0][0]
    if not models_used and hdr_model:
        models_used = [hdr_model]
    elapsed_sec = (
        meta["elapsedSec"]
        if meta.get("preserveElapsed") and meta.get("elapsedSec") is not None
        else round(time.time() - meta["t0"], 2)
    )
    failed_count = sum(1 for r in results if r.get("answer_parsed") is not True)
    expected_total = int(meta.get("expectedTotalIssues", len(results)))
    status = "ok" if failed_count == 0 and len(results) == expected_total else "incomplete"
    payload = {
        "schemaVersion": 2,
        "normalizerVersion": NORMALIZER_SCHEMA_VERSION,
        "status": status,
        "generatedAt": (
            meta["generatedAt"]
            if meta.get("preserveGeneratedAt") and meta.get("generatedAt")
            else time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        ),
        "teacherModel": hdr_model,
        "teacherModelsUsed": models_used,
        "backend": hdr_backend,
        "dtype": hdr_dtype,
        "gpu": meta["gpu"],
        "vramGiB": meta["vramGiB"],
        "maxNewTokens": int(meta.get("maxNewTokens", 1536)),
        "elapsedSec": elapsed_sec,
        "totalIssues": len(results),
        "expectedTotalIssues": expected_total,
        "failedCount": failed_count,
        "verbatimVerifiedCount": sum(1 for r in results if r.get("verbatim_root_verified")),
        "modelVerbatimVerifiedCount": sum(
            1 for r in results if r.get("verbatim_root_source") == "model"
        ),
        "fallbackVerbatimVerifiedCount": sum(
            1 for r in results if r.get("verbatim_root_source") == "fallback_log_extractor"
        ),
        "forensicChainPresentCount": sum(
            1
            for r in results
            if _is_valid_forensic_chain(
                r.get("forensic_chain_zh")
                or (r.get("distilled") or {}).get("forensic_chain_zh")
                or ""
            )
        ),
        "familyCount": len(families),
        "families": families,
        "items": results,
    }
    out_bytes = (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    _atomic_write_bytes(out_json, out_bytes)
    sha = hashlib.sha256(out_bytes).hexdigest()

    if write_md and results:
        md_text = render_candidate_families_md(payload, families)
        _atomic_write_bytes(out_md, md_text.encode("utf-8"))

    return payload, sha


def _load_raw_checkpoint_candidates(
    paths: list[Path],
) -> tuple[dict[str, dict[str, Any]], dict[str, Any] | None]:
    """Read candidate checkpoint rows from existing files, discarding duplicate/conflicting keys."""
    merged: dict[str, dict[str, Any]] = {}
    last_payload: dict[str, Any] | None = None
    for path in paths:
        if not path.exists():
            continue
        try:
            prev = json.loads(path.read_text(encoding="utf-8"))
        except Exception as e:
            log(f"Ignoring unreadable existing checkpoint {path} ({e})")
            continue
        if not isinstance(prev, dict) or not isinstance(prev.get("items"), list):
            log(f"Ignoring malformed checkpoint structure at {path}")
            continue
        last_payload = prev
        prev_model = str(prev.get("teacherModel") or "").strip()
        prev_backend = str(prev.get("backend") or "").strip()
        prev_dtype = str(prev.get("dtype") or "").strip()
        prev_norm = str(prev.get("normalizerVersion") or "").strip()

        seen_in_file: dict[str, dict[str, Any]] = {}
        conflicted_keys: set[str] = set()
        for item in prev["items"]:
            if not isinstance(item, dict):
                continue
            k = str(item.get("key") or "").strip()
            if not k:
                continue
            reused = dict(item)
            if not reused.get("teacher_model") and prev_model:
                reused["teacher_model"] = prev_model
            if not reused.get("teacher_backend") and prev_backend:
                reused["teacher_backend"] = prev_backend
            if not reused.get("teacher_dtype") and prev_dtype:
                reused["teacher_dtype"] = prev_dtype
            if not reused.get("normalizer_version") and prev_norm:
                reused["normalizer_version"] = prev_norm
            if k in seen_in_file:
                if seen_in_file[k] != reused:
                    conflicted_keys.add(k)
                continue
            seen_in_file[k] = reused

        for k in conflicted_keys:
            seen_in_file.pop(k, None)
            merged.pop(k, None)
            log(f"Discarded conflicting duplicate checkpoint key {k!r} in {path}")
        merged.update(seen_in_file)
    return merged, last_payload


def _normalize_fs_path_for_alias(p: Path) -> str:
    raw = str(p.resolve())
    if os.name == "nt":
        if raw.startswith("\\\\?\\UNC\\"):
            raw = "\\\\" + raw[8:]
        elif raw.startswith("\\\\?\\") or raw.startswith("\\\\.\\"):
            raw = raw[4:]
        raw = os.path.normcase(os.path.normpath(raw))
    return raw


def _validate_output_paths(
    input_path: Path,
    out_json: Path,
    out_md: Path,
    ckpt_path: Path,
) -> None:
    # Protect sibling dual_mining_summary.json across ALL three directory interpretations:
    # 1) direct input_path.parent (preserves POSIX directory symlinks before `..`),
    # 2) lexical abspath parent, and 3) fully resolved target file parent!
    direct_parent_summary = input_path.parent / "dual_mining_summary.json"
    lexical_summary = Path(os.path.abspath(str(input_path))).parent / "dual_mining_summary.json"
    resolved_summary = input_path.resolve().parent / "dual_mining_summary.json"
    readonly_flags = {
        "--input",
        "dual_mining_summary.json (parent)",
        "dual_mining_summary.json (lexical)",
        "dual_mining_summary.json (resolved)",
    }
    entries = [
        ("--input", input_path),
        ("dual_mining_summary.json (parent)", direct_parent_summary),
        ("dual_mining_summary.json (lexical)", lexical_summary),
        ("dual_mining_summary.json (resolved)", resolved_summary),
        ("--out-json", out_json),
        ("--out-md", out_md),
        ("--checkpoint", ckpt_path),
    ]
    for i, (flag_a, path_a) in enumerate(entries):
        norm_a = _normalize_fs_path_for_alias(path_a)
        for flag_b, path_b in entries[i + 1 :]:
            # Read-only evidence inputs never conflict with each other; guard outputs/checkpoints against all inputs & each other
            if flag_a in readonly_flags and flag_b in readonly_flags:
                continue
            norm_b = _normalize_fs_path_for_alias(path_b)
            is_same = norm_a == norm_b
            if not is_same and path_a.exists() and path_b.exists():
                try:
                    is_same = os.path.samefile(path_a, path_b)
                except OSError:
                    is_same = False
            if is_same:
                raise ValueError(f"Aliased file paths not allowed ({flag_a}, {flag_b} -> {path_a.resolve()})")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Colab H100/G4/A100 Qwen3.8-27B distiller with explicit thinking and family clustering."
    )
    parser.add_argument("--input", default=DEFAULT_INPUT_JSONL)
    parser.add_argument("--out-json", default=DEFAULT_OUT_JSON)
    parser.add_argument("--out-md", default=DEFAULT_OUT_MD)
    parser.add_argument(
        "--checkpoint",
        default="",
        help="Separate intermediate checkpoint JSON path (defaults to <out-json>.checkpoint.json).",
    )
    parser.add_argument("--checkpoint-every", type=int, default=24)
    parser.add_argument("--max-new-tokens", type=int, default=1536)
    parser.add_argument("--model", default="", help="Optional explicit teacher model ID.")
    parser.add_argument("--no-vllm", action="store_true", help="Force Transformers backend directly.")
    parser.add_argument(
        "--allow-mixed-teacher-resume",
        action="store_true",
        help="Explicitly allow reusing schema-valid checkpoint rows from a different teacher model/backend.",
    )
    parser.add_argument(
        "--try-install-vllm",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Attempt torch-pinned binary wheel install of vllm if not preinstalled.",
    )
    args = parser.parse_args()

    if args.checkpoint_every < 1:
        parser.error("--checkpoint-every must be >= 1")
    if args.max_new_tokens < 64 or args.max_new_tokens > MAX_MODEL_LEN - 1024:
        parser.error(
            f"--max-new-tokens must be between 64 and {MAX_MODEL_LEN - 1024} "
            f"(MAX_MODEL_LEN={MAX_MODEL_LEN})"
        )

    t0 = time.time()
    input_path = Path(args.input)
    out_json = Path(args.out_json)
    out_md = Path(args.out_md)
    ckpt_path = (
        Path(args.checkpoint)
        if args.checkpoint.strip()
        else out_json.with_name(f"{out_json.stem}.checkpoint.json")
    )
    _validate_output_paths(input_path, out_json, out_md, ckpt_path)

    corpus = load_corpus_jsonl(input_path)
    corpus_by_key = {it["key"]: it for it in corpus}
    log(f"Loaded {len(corpus)} dual-ecosystem corpus items from {args.input}")

    raw_ckpt_rows, prev_payload = _load_raw_checkpoint_candidates([out_json, ckpt_path])
    done_by_key: dict[str, dict[str, Any]] = {}

    if args.allow_mixed_teacher_resume:
        for k, row in raw_ckpt_rows.items():
            corpus_item = corpus_by_key.get(k)
            if corpus_item is None:
                continue
            ok, reason = validate_checkpoint_item(
                row,
                corpus_item,
                expected_max_new_tokens=args.max_new_tokens,
                allow_mixed_teacher=True,
            )
            if ok:
                done_by_key[k] = row
            else:
                log(f"Skipped invalid checkpoint item {k}: {reason}")
        if done_by_key:
            log(f"Loaded {len(done_by_key)} schema-valid checkpoint items (mixed-teacher resume enabled)")
        pending = [it for it in corpus if it["key"] not in done_by_key]
        if len(pending) == 0:
            prev_meta = prev_payload or {}
            final_results = [done_by_key[it["key"]] for it in corpus]
            inferred_model = str(prev_meta.get("teacherModel") or "").strip() or str(
                final_results[0].get("teacher_model") or "unknown"
            )
            meta = {
                "teacherModel": inferred_model,
                "backend": str(
                    prev_meta.get("backend")
                    or final_results[0].get("teacher_backend")
                    or "checkpoint"
                ),
                "dtype": str(
                    prev_meta.get("dtype")
                    or final_results[0].get("teacher_dtype")
                    or "unknown"
                ),
                "gpu": str(prev_meta.get("gpu") or "checkpoint-resume"),
                "vramGiB": float(prev_meta.get("vramGiB") or 0.0),
                "maxNewTokens": int(args.max_new_tokens),
                "elapsedSec": prev_meta.get("elapsedSec"),
                "preserveElapsed": prev_meta.get("elapsedSec") is not None,
                "generatedAt": prev_meta.get("generatedAt"),
                "preserveGeneratedAt": bool(prev_meta.get("generatedAt")),
                "expectedTotalIssues": len(corpus),
                "t0": t0,
            }
            payload, sha = save_outputs(out_json, out_md, final_results, meta, write_md=True)
            if payload["status"] == "ok":
                ckpt_path.unlink(missing_ok=True)
            safe_stdout_print(
                json.dumps(
                    {
                        "status": payload["status"],
                        "resumedNoPending": True,
                        "outJson": str(out_json),
                        "outMd": str(out_md),
                        "sha256": sha,
                        "teacherModel": payload["teacherModel"],
                        "teacherModelsUsed": payload["teacherModelsUsed"],
                        "backend": payload["backend"],
                        "totalIssues": payload["totalIssues"],
                        "failedCount": payload["failedCount"],
                        "verbatimVerifiedCount": payload["verbatimVerifiedCount"],
                        "familyCount": payload["familyCount"],
                    },
                    ensure_ascii=False,
                )
            )
            if payload["status"] != "ok":
                sys.exit(1)
            return

    if torch is None or not torch.cuda.is_available():
        raise RuntimeError(
            "No CUDA GPU detected! distill_ascend_h100.py requires >=38 GiB VRAM (H100/G4/A100). "
            "Pass --allow-mixed-teacher-resume only when intentionally finalizing a complete checkpoint."
        )
    gpu_name = torch.cuda.get_device_name(0)
    raw_vram_gib = torch.cuda.get_device_properties(0).total_memory / (1024**3)
    free_vram_gib = raw_vram_gib
    try:
        free_bytes, _ = torch.cuda.mem_get_info(0)
        free_vram_gib = free_bytes / (1024**3)
    except Exception:
        pass
    effective_vram_gib = min(raw_vram_gib, free_vram_gib)
    vram_gib = round(effective_vram_gib, 2)
    log(
        f"Runtime GPU: {gpu_name} (total={raw_vram_gib:.2f} GiB, free={free_vram_gib:.2f} GiB, "
        f"effective={effective_vram_gib:.2f} GiB), torch={torch.__version__}"
    )
    if effective_vram_gib < MIN_VRAM_GIB:
        raise RuntimeError(
            f"Detected {gpu_name} with {effective_vram_gib:.2f} GiB available VRAM "
            f"(total={raw_vram_gib:.2f} GiB, free={free_vram_gib:.2f} GiB < {MIN_VRAM_GIB} GiB minimum). "
            "Aborting so we never silently run a tiny model."
        )

    # Check if strict same-teacher resume already covers 100% of corpus for this GPU's EXACT primary model/backend/dtype
    if not args.allow_mixed_teacher_resume and raw_ckpt_rows:
        ordered_candidates = select_model_candidates(effective_vram_gib, explicit_model=args.model or None)
        primary_model = ordered_candidates[0] if ordered_candidates else ""
        expected_dtype = "fp8" if "FP8" in primary_model.upper() else "bfloat16"
        expected_live_backend = ""
        if args.no_vllm:
            try:
                import transformers as _tf

                expected_live_backend = f"transformers-{_tf.__version__}"
            except Exception:
                expected_live_backend = ""
        else:
            import importlib.util

            if importlib.util.find_spec("vllm") is not None or args.try_install_vllm:
                expected_live_backend = "vllm"
            else:
                try:
                    import transformers as _tf

                    expected_live_backend = f"transformers-{_tf.__version__}"
                except Exception:
                    expected_live_backend = ""

        distinct_triples = {
            (
                str(r.get("teacher_model") or "").strip(),
                str(r.get("teacher_backend") or "").strip(),
                str(r.get("teacher_dtype") or "").strip(),
            )
            for k, r in raw_ckpt_rows.items()
            if k in corpus_by_key
        }
        if len(distinct_triples) == 1 and primary_model and expected_live_backend:
            cand_model, cand_backend, cand_dtype = next(iter(distinct_triples))
            if (
                cand_model == primary_model
                and cand_backend == expected_live_backend
                and cand_dtype == expected_dtype
            ):
                strict_done: dict[str, dict[str, Any]] = {}
                for k, row in raw_ckpt_rows.items():
                    ci = corpus_by_key.get(k)
                    if ci is None:
                        continue
                    ok, _ = validate_checkpoint_item(
                        row,
                        ci,
                        expected_teacher_model=cand_model,
                        expected_backend=cand_backend,
                        expected_dtype=cand_dtype,
                        expected_max_new_tokens=args.max_new_tokens,
                        allow_mixed_teacher=False,
                    )
                    if ok:
                        strict_done[k] = row
                if len(strict_done) == len(corpus):
                    prev_meta = prev_payload or {}
                    final_results = [strict_done[it["key"]] for it in corpus]
                    meta = {
                        "teacherModel": cand_model,
                        "backend": cand_backend,
                        "dtype": cand_dtype,
                        "gpu": str(prev_meta.get("gpu") or gpu_name),
                        "vramGiB": float(prev_meta.get("vramGiB") or vram_gib),
                        "maxNewTokens": int(args.max_new_tokens),
                        "elapsedSec": prev_meta.get("elapsedSec"),
                        "preserveElapsed": prev_meta.get("elapsedSec") is not None,
                        "generatedAt": prev_meta.get("generatedAt"),
                        "preserveGeneratedAt": bool(prev_meta.get("generatedAt")),
                        "expectedTotalIssues": len(corpus),
                        "t0": t0,
                    }
                    payload, sha = save_outputs(out_json, out_md, final_results, meta, write_md=True)
                    if payload["status"] == "ok":
                        ckpt_path.unlink(missing_ok=True)
                    safe_stdout_print(
                        json.dumps(
                            {
                                "status": payload["status"],
                                "resumedNoPending": True,
                                "outJson": str(out_json),
                                "outMd": str(out_md),
                                "sha256": sha,
                                "teacherModel": payload["teacherModel"],
                                "teacherModelsUsed": payload["teacherModelsUsed"],
                                "backend": payload["backend"],
                                "totalIssues": payload["totalIssues"],
                                "failedCount": payload["failedCount"],
                                "verbatimVerifiedCount": payload["verbatimVerifiedCount"],
                                "familyCount": payload["familyCount"],
                            },
                            ensure_ascii=False,
                        )
                    )
                    if payload["status"] != "ok":
                        sys.exit(1)
                    return

    engine = load_teacher_engine(
        vram_gib=effective_vram_gib,
        allow_vllm=not args.no_vllm,
        try_install_vllm=args.try_install_vllm,
        max_new_tokens=args.max_new_tokens,
        explicit_model=args.model or None,
    )

    def _refresh_done_for_engine(active_engine: VllmEngine | TransformersEngine) -> None:
        if args.allow_mixed_teacher_resume:
            return
        done_by_key.clear()
        for k, row in raw_ckpt_rows.items():
            ci = corpus_by_key.get(k)
            if ci is None:
                continue
            ok, _ = validate_checkpoint_item(
                row,
                ci,
                expected_teacher_model=active_engine.model_id,
                expected_backend=active_engine.backend_name,
                expected_dtype=active_engine.dtype_str,
                expected_max_new_tokens=args.max_new_tokens,
                allow_mixed_teacher=False,
            )
            if ok:
                done_by_key[k] = row

    _refresh_done_for_engine(engine)
    pending = [it for it in corpus if it["key"] not in done_by_key]
    log(
        f"Teacher engine ready: model={engine.model_id}, backend={engine.backend_name}, "
        f"dtype={engine.dtype_str}, pending={len(pending)}/{len(corpus)} ({time.time() - t0:.1f}s)"
    )

    meta: dict[str, Any] = {
        "teacherModel": engine.model_id,
        "backend": engine.backend_name,
        "dtype": engine.dtype_str,
        "gpu": gpu_name,
        "vramGiB": vram_gib,
        "maxNewTokens": int(args.max_new_tokens),
        "expectedTotalIssues": len(corpus),
        "t0": t0,
    }

    chunk_size = int(args.checkpoint_every)
    start = 0
    while start < len(pending):
        chunk = pending[start : start + chunk_size]
        prompt_pairs = [build_user_prompt_with_diff_offset(it) for it in chunk]
        user_msgs = [p[0] for p in prompt_pairs]
        diff_offsets = [p[1] for p in prompt_pairs]
        fallback_model = ""
        fallback_err_msg = ""
        try:
            raw_outputs = engine.generate_batch(user_msgs, diff_start_indices=diff_offsets)
        except Exception as gen_err:
            if start == 0 and isinstance(engine, VllmEngine):
                fallback_model = engine.model_id
                fallback_err_msg = str(gen_err)
                engine.close()
                engine = None  # type: ignore[assignment]
            else:
                raise

        if fallback_model:
            # Exception handler has fully exited so traceback frames & GPU allocations are released before fallback load
            _clear_cuda()
            log(
                f"First-batch vLLM generation failed ({fallback_err_msg}); closed vLLM and "
                f"falling back to TransformersEngine({fallback_model})..."
            )
            engine = TransformersEngine(
                model_id=fallback_model,
                vram_gib=effective_vram_gib,
                max_new_tokens=args.max_new_tokens,
            )
            meta["teacherModel"] = engine.model_id
            meta["backend"] = engine.backend_name
            meta["dtype"] = engine.dtype_str
            if not args.allow_mixed_teacher_resume:
                _refresh_done_for_engine(engine)
                pending = [it for it in corpus if it["key"] not in done_by_key]
                log(
                    f"Recomputed strict resume queue after backend fallback: "
                    f"pending={len(pending)}/{len(corpus)} for backend={engine.backend_name}"
                )
            start = 0
            continue

        if len(raw_outputs) != len(chunk):
            raise RuntimeError(
                f"Engine output count mismatch: expected {len(chunk)}, got {len(raw_outputs)}"
            )

        parsed_pairs: list[tuple[dict[str, Any], str, dict[str, Any] | None]] = []
        retry_indices: list[int] = []
        for idx, (it, raw_out) in enumerate(zip(chunk, raw_outputs, strict=True)):
            think_summary, parsed = split_thinking_and_json(raw_out)
            parsed_pairs.append((it, think_summary, parsed))
            if parsed is None:
                retry_indices.append(idx)

        if retry_indices:
            retry_msgs = [user_msgs[i] for i in retry_indices]
            retry_offsets = [diff_offsets[i] for i in retry_indices]
            retry_outputs = engine.generate_batch(retry_msgs, diff_start_indices=retry_offsets)
            if len(retry_outputs) != len(retry_indices):
                raise RuntimeError(
                    f"Retry output count mismatch: expected {len(retry_indices)}, got {len(retry_outputs)}"
                )
            for i, retry_out in zip(retry_indices, retry_outputs, strict=True):
                r_think, r_parsed = split_thinking_and_json(retry_out)
                if r_parsed is not None:
                    parsed_pairs[i] = (parsed_pairs[i][0], r_think, r_parsed)

        for it, think_summary, parsed in parsed_pairs:
            rec = verify_and_normalize_distilled(
                it,
                parsed,
                think_summary,
                teacher_model=engine.model_id,
                teacher_backend=engine.backend_name,
                teacher_dtype=engine.dtype_str,
                max_new_tokens=args.max_new_tokens,
            )
            rec["teacher_model"] = engine.model_id
            rec["teacher_backend"] = engine.backend_name
            rec["teacher_dtype"] = engine.dtype_str
            done_by_key[it["key"]] = rec

        is_final_chunk = start + chunk_size >= len(pending)
        if not is_final_chunk:
            ordered_so_far = [done_by_key[it["key"]] for it in corpus if it["key"] in done_by_key]
            _, ckpt_sha = save_outputs(
                ckpt_path,
                out_md,
                ordered_so_far,
                meta,
                write_md=False,
            )
            ver_cnt = sum(1 for r in ordered_so_far if r.get("verbatim_root_verified"))
            log(
                f"Checkpoint {len(ordered_so_far)}/{len(corpus)} saved to {ckpt_path} "
                f"(verbatim_verified={ver_cnt}/{len(ordered_so_far)}, "
                f"sha256={ckpt_sha[:12]}..., elapsed={time.time() - t0:.1f}s)"
            )
        start += chunk_size

    final_results = [done_by_key[it["key"]] for it in corpus if it["key"] in done_by_key]
    payload, sha = save_outputs(out_json, out_md, final_results, meta, write_md=True)
    if payload["status"] == "ok":
        ckpt_path.unlink(missing_ok=True)
    log(
        f"Completed distillation ({payload['status']}): {payload['totalIssues']}/{len(corpus)} items, "
        f"failed={payload['failedCount']}, {payload['verbatimVerifiedCount']} verbatim verified, "
        f"{payload['familyCount']} candidate families. Saved {out_json} & {out_md}."
    )
    safe_stdout_print(
        json.dumps(
            {
                "status": payload["status"],
                "outJson": str(out_json),
                "outMd": str(out_md),
                "sha256": sha,
                "teacherModel": payload["teacherModel"],
                "teacherModelsUsed": payload["teacherModelsUsed"],
                "backend": payload["backend"],
                "totalIssues": payload["totalIssues"],
                "failedCount": payload["failedCount"],
                "verbatimVerifiedCount": payload["verbatimVerifiedCount"],
                "familyCount": payload["familyCount"],
            },
            ensure_ascii=False,
        )
    )
    if payload["status"] != "ok":
        sys.exit(1)


if __name__ == "__main__":
    main()
    try:
        sys.stdout.flush()
    except (BrokenPipeError, OSError):
        _silence_broken_stdout()
