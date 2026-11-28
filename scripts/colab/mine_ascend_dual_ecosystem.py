#!/usr/bin/env python3
"""Dual-ecosystem Ascend fault corpus miner (GitHub + GitCode, 0 GPU, pure Python 3 stdlib).

Mines 310-360 deduplicated, high-signal closed bug issues with real error logs / CANN plog /
HCCL / TorchAir / ModelSlim / aclnn / MC2 signals, resolution comments, and associated merged
PR/MR code diffs (<=120 lines) from:
  - GitHub: vllm-project/vllm-ascend (~140-170) + vllm-project/vllm Ascend/NPU (~20-30),
    using local git clones for zero-API-call PR diff & fix-link extraction.
  - GitCode (api.gitcode.com/api/v5): 9 Huawei Ascend/CANN repos (~150-190).
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import datetime
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import threading
import time
from typing import Any
import urllib.error
import urllib.parse
import urllib.request
import uuid

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT_JSONL = str(
    REPO_ROOT / "tools" / "wiki-runtime" / "colab-distill" / "dual_raw_corpus.jsonl"
)
DEFAULT_OUT_SUMMARY = str(
    REPO_ROOT / "tools" / "wiki-runtime" / "colab-distill" / "dual_mining_summary.json"
)
DEFAULT_VLLM_ASCEND_REPO = str(REPO_ROOT / "tools" / "repos" / "vllm-ascend")
DEFAULT_VLLM_REPO = str(REPO_ROOT / "tools" / "repos" / "vllm")

GITCODE_REPOS: list[tuple[str, int, int]] = [
    # (owner/repo, target_quota, max_pages_100)
    ("Ascend/pytorch", 32, 6),
    ("Ascend/op-plugin", 20, 5),
    ("Ascend/torchair", 22, 6),
    ("Ascend/MindStudio-ModelSlim", 14, 5),
    ("cann/runtime", 20, 6),
    ("cann/ops-transformer", 20, 6),
    ("cann/ops-nn", 16, 5),
    ("cann/ops-math", 12, 4),
    ("cann/hccl", 22, 6),
]

TARGET_DOMAINS: tuple[str, ...] = (
    "hccl-link-net",
    "hccl-wait-cascade",
    "torchair-ge-compile",
    "moe-mc2-quant",
    "cann-aicore-smmu",
    "cann-opapi-aclnn",
    "cann-driver-env",
    "pd-mooncake",
    "memory-oom",
)

# GitHub Search API enforces a strict maximum of 5 boolean operators (AND/OR/NOT) per query.
# Keep every query at <= 4 OR operators so we never hit HTTP 422.
GITHUB_ASCEND_SEARCH_QUERIES: list[tuple[str, str]] = [
    (
        "cann-aicore-smmu",
        'repo:vllm-project/vllm-ascend is:issue is:closed ("507015" OR "507034" OR "507035" OR "CheckSmmuFault" OR "aicore exception")',
    ),
    (
        "cann-aicore-smmu",
        'repo:vllm-project/vllm-ascend is:issue is:closed ("retCode=0x26" OR "EZ9999" OR "507018" OR "107030" OR "SMMU")',
    ),
    (
        "cann-opapi-aclnn",
        'repo:vllm-project/vllm-ascend is:issue is:closed ("161002" OR "aclnn" OR "libopapi.so" OR "MlaProlog" OR "EL0004")',
    ),
    (
        "cann-opapi-aclnn",
        'repo:vllm-project/vllm-ascend is:issue is:closed ("GetWorkspaceSize" OR "FlashAttentionScore" OR "ChunkGatedDeltaRule" OR "slice_scatter" OR "561000")',
    ),
    (
        "hccl-wait-cascade",
        'repo:vllm-project/vllm-ascend is:issue is:closed ("EI0002" OR "Notify wait" OR "HCCL_EXEC_TIMEOUT" OR "AclrtSynchronizeStreamWithTimeout" OR "watchdog")',
    ),
    (
        "hccl-link-net",
        'repo:vllm-project/vllm-ascend is:issue is:closed ("EI0006" OR "EJ0001" OR "ZMQError" OR "Address already in use" OR "TCPStore")',
    ),
    (
        "torchair-ge-compile",
        'repo:vllm-project/vllm-ascend is:issue is:closed ("torchair" OR "aclgraph" OR "capture_model" OR "FULL_DECODE_ONLY" OR "PIECEWISE")',
    ),
    (
        "torchair-ge-compile",
        'repo:vllm-project/vllm-ascend is:issue is:closed ("torch.compile" OR "npugraph_ex" OR "NpuFxCompiler" OR "dynamo")',
    ),
    (
        "moe-mc2-quant",
        'repo:vllm-project/vllm-ascend is:issue is:closed ("mc2" OR "MoeDistribute" OR "GroupedMatmul" OR "FusedMoE" OR "alltoall")',
    ),
    (
        "moe-mc2-quant",
        'repo:vllm-project/vllm-ascend is:issue is:closed ("w8a8" OR "w4a8" OR "modelslim" OR "ep_size" OR "quantization")',
    ),
    (
        "pd-mooncake",
        'repo:vllm-project/vllm-ascend is:issue is:closed ("mooncake" OR "kv_transfer_config" OR "kv_connector" OR "1p1d" OR "disagg")',
    ),
    (
        "memory-oom",
        'repo:vllm-project/vllm-ascend is:issue is:closed ("NPU out of memory" OR "OutOfMemoryError" OR "207001" OR "507011" OR "OOM")',
    ),
    (
        "memory-oom",
        'repo:vllm-project/vllm-ascend is:issue is:closed ("gpu_memory_utilization" OR "KV cache" OR "NPUCachingAllocator" OR "exit code 137")',
    ),
    (
        "cann-driver-env",
        'repo:vllm-project/vllm-ascend is:issue is:closed ("207003" OR "ACL_ERROR" OR "libascendcl" OR "ascend-toolkit" OR "ImportError")',
    ),
    (
        "cann-aicore-smmu",
        'repo:vllm-project/vllm-ascend is:issue is:closed label:bug ("Traceback" OR "RuntimeError" OR "AssertionError" OR "ValueError")',
    ),
]

GITHUB_VLLM_SEARCH_QUERIES: list[tuple[str, str]] = [
    (
        "cann-driver-env",
        'repo:vllm-project/vllm is:issue is:closed ("vllm-ascend" OR "torch_npu" OR "Ascend" OR "910B") RuntimeError',
    ),
    (
        "cann-driver-env",
        'repo:vllm-project/vllm is:issue is:closed ("vllm-ascend" OR "torch_npu" OR "Ascend") ("Traceback" OR "Error")',
    ),
    (
        "hccl-link-net",
        'repo:vllm-project/vllm is:issue is:closed ("NPU" OR "HCCL" OR "CANN" OR "aclnn") Traceback',
    ),
    (
        "pd-mooncake",
        'repo:vllm-project/vllm is:issue is:closed ("mooncake" OR "ascend" OR "torch_npu") Error',
    ),
    (
        "memory-oom",
        'repo:vllm-project/vllm is:issue is:closed ("NPU" OR "Ascend" OR "torch_npu") ("OOM" OR "memory")',
    ),
]

# Non-bug filter patterns (title / issue_type / labels)
NON_BUG_TITLE_RE = re.compile(
    r"(?:\[\s*(?:RFC|Feature|Feat|Doc|Docs|Documentation|Requirement|Roadmap|Announcement|"
    r"Proposal|Enhancement|Chore|CI|Test|Benchmark|Release|Misc|Support|Discussion|Question)"
    r"(?:\s*[|/][^]]*)?\s*\]|"
    r"^(?:RFC|Feature|Docs?|Documentation|Requirement|Roadmap|Chore)\s*[:：]|"
    r"(?:需求建议|文档反馈|文档问题|功能需求|特性需求|错别字|资料反馈|需求反馈)|"
    r"^\s*补充.*(?:说明|文档|注释|限制))",
    re.IGNORECASE,
)

NON_BUG_LABELS = {
    "documentation",
    "doc",
    "docs",
    "enhancement",
    "feature",
    "feature-request",
    "rfc",
    "roadmap",
    "question",
    "invalid",
    "duplicate",
    "wontfix",
    "requirement",
    "sig/doc",
    "kind/documentation",
    "kind/feature",
    "kind/requirement",
}

BUG_LABELS = {
    "bug",
    "bug-report",
    "kind/bug",
    "type/bug",
    "defect",
    "crash",
    "regression",
}

BOT_USERS = {
    "github-actions[bot]",
    "stale[bot]",
    "dependabot[bot]",
    "codecov[bot]",
    "mergify[bot]",
    "cla-bot",
    "vllm-bot",
    "torch-npu-bot",
    "torchnpu-bot",
    "ascend-robot",
    "ascend-ci-bot",
    "mindspore-ci-bot",
    "openeuler-ci-bot",
    "gitcode-bot",
    "cann-robot",
    "huawei-ci-bot",
}

# Concrete Ascend / CANN / HCCL / Python / C++ fault patterns (ASCII digits only)
ERROR_CODE_RE = re.compile(
    r"\b(?:5070[0-9]{2}|1070[0-9]{2}|1610[0-9]{2}|2070[0-9]{2}|5000[0-9]{2}|5610[0-9]{2}|"
    r"E[EZIJLMW][0-9]{4}|E[1-9][0-9]{4}|"
    r"retCode=0x[0-9a-fA-F]+|0x2[56aA]|"
    r"ACL_ERROR_[A-Z0-9_]+|HCCL_E_[A-Z0-9_]+|DRV_ERROR_[A-Z0-9_]+|"
    r"ERR[0-9]{5})\b"
)

PLOG_OR_TRACE_RE = re.compile(
    r"(?:\[ERROR\]\s*(?:RUNTIME|HCCL|ASCENDCL|OPAPI|GE|FE|AICPU|TSD|DRV|IDEDD|TBE|CCE|"
    r"PROFILING|ACL|APP|KERNEL|ATB|TORCHAIR|LCCL|MS)\b|"
    r"Traceback \(most recent call last\):|"
    r"(?:RuntimeError|ValueError|AssertionError|KeyError|TypeError|AttributeError|"
    r"IndexError|OSError|ImportError|MemoryError|NotImplementedError|TimeoutError|"
    r"ZMQError|OutOfMemoryError|SystemError|ModuleNotFoundError|FileNotFoundError|"
    r"CalledProcessError|ChildFailedError|DistBackendError|ProcessRaisedException)"
    r"\s*:?\s*\S{6,}|"
    r"CheckSmmuFault|aicore exception|aiv exception|Notify wait execute timeout|"
    r"NPU out of memory|NPU function error:|c10_npu::acl::|torch_npu/csrc/|"
    r"aclnn[A-Z][A-Za-z0-9_]+.*(?:fail|error|invalid|not support|status|161002|561000|EZ)|"
    r"libopapi\.so|libascendcl\.so|libhccl\.so|errCode\s*[=:]\s*[0-9]+|"
    r"error code is [0-9]{4,6}|Segmentation fault|SIGSEGV|SIGABRT|SIGBUS|core dumped|"
    r"Address already in use|Connection refused|ECONNREFUSED|exit code 137|"
    r"FAILED.*(?:error|exception|timeout|oom))",
    re.IGNORECASE,
)

# Line-level verifier: ensures body/comments actually contain a concrete root log line
CONCRETE_LOG_LINE_RE = re.compile(
    r"(?:\[ERROR\]|Traceback \(most recent call last\):|"
    r"(?:RuntimeError|ValueError|AssertionError|KeyError|TypeError|AttributeError|"
    r"IndexError|OSError|ImportError|MemoryError|NotImplementedError|TimeoutError|"
    r"ZMQError|OutOfMemoryError|DistBackendError|ProcessRaisedException|Exception)\s*:|"
    r"\b(?:E[EZIJLMW][0-9]{4}|E[1-9][0-9]{4}|5070[0-9]{2}|1070[0-9]{2}|1610[0-9]{2}|2070[0-9]{2}|5000[0-9]{2}|5610[0-9]{2})\b|"
    r"\bretCode=0x[0-9a-fA-F]+\b|CheckSmmuFault|aicore exception|Notify wait|NPU out of memory|"
    r"NPU function error|ACL_ERROR_|HCCL_E_|aclnn[A-Z][A-Za-z0-9_]+|libopapi\.so|"
    r"errCode\s*[=:]|error code is [0-9]+\b|Segmentation fault|SIGSEGV|SIGABRT|Address already in use|"
    r"core dumped|failed with error|call aclnn|ERROR\s+[0-9]{2}-[0-9]{2}\s+[0-9]{2}:[0-9]{2}:[0-9]{2})",
    re.IGNORECASE,
)


DOMAIN_RULES: list[tuple[str, re.Pattern[str], int]] = [
    (
        "pd-mooncake",
        re.compile(
            r"(?:mooncake|kv_transfer_config|kv_connector|1p1d|pd\s*分离|disagg(?:regated)?|"
            r"llm_datadist|transfer_engine|kv_cache_transfer|metaserver|mf_store|prefill.*decode.*kv)",
            re.IGNORECASE,
        ),
        4,
    ),
    (
        "hccl-wait-cascade",
        re.compile(
            r"(?:EI0002|Notify wait|HCCL_EXEC_TIMEOUT|AclrtSynchronizeStreamWithTimeout|"
            r"allreduce.*(?:timeout|hang|卡死)|allgather.*(?:timeout|hang|卡死)|"
            r"hccl.*(?:timeout|hang|wait|卡死|超时)|watchdog.*timeout|507035|heartbeat.*timeout)",
            re.IGNORECASE,
        ),
        4,
    ),
    (
        "hccl-link-net",
        re.compile(
            r"(?:EJ000\d|EI000[13456789]|HCCL_IF_IP|HCCL_SOCKET_IFNAME|HCCL_BUFFSIZE|ranktable|"
            r"\bRoCE\b|\bRDMA\b|ZMQError|Address already in use|TCPStore|\bGloo\b|ECONNREFUSED|"
            r"hcclCommInit|hccl.*(?:link|socket|port|tls|rdma|nic|connect|init|comm)|"
            r"cann/hccl|libhccl\.so)",
            re.IGNORECASE,
        ),
        3,
    ),
    (
        "torchair-ge-compile",
        re.compile(
            r"(?:torchair|aclgraph|capture_model|FULL_DECODE_ONLY|PIECEWISE|npugraph_ex|"
            r"torch\.compile|NpuFxCompiler|dynamo|E[1-8]\d{4}|EZ300\d|ge_graph|ge::|graph_mode|"
            r"Ascend/torchair|compile_config|static_kernel|cudagraph.*npu)",
            re.IGNORECASE,
        ),
        4,
    ),
    (
        "moe-mc2-quant",
        re.compile(
            r"(?:\bmc2\b|MoeDistribute|DispatchFFNCombine|GroupedMatmul|FusedMoE|fused_moe|"
            r"modelslim|MindStudio-ModelSlim|w8a8|w4a8|w4a16|mxfp4|mxfp8|quant_method|"
            r"quantization|ep_size|alltoallv|deep_ep|per_token|per_channel|anti_outlier|smoothquant)",
            re.IGNORECASE,
        ),
        3,
    ),
    (
        "cann-aicore-smmu",
        re.compile(
            r"(?:507015|507034|507018|107030|retCode=0x[0-9a-fA-F]+|CheckSmmuFault|"
            r"aicore exception|aicore error|aiv exception|\bMTE\b|DDR address out of range|"
            r"EZ9999|507001|507014|\bsmmu\b|vector core|cube core|\btbe\b|\bcce\b|kernel.*(?:abort|trap|fault))",
            re.IGNORECASE,
        ),
        3,
    ),
    (
        "cann-opapi-aclnn",
        re.compile(
            r"(?:161002|161001|561000|aclnn[A-Z][A-Za-z0-9_]*|libopapi\.so|GetWorkspaceSize|"
            r"MlaProlog|ChunkGatedDeltaRule|FlashAttentionScore|FusedInferAttentionScore|"
            r"PagedAttention|slice_scatter|EL0004|EZ1001|op-plugin|ops-transformer|ops-nn|"
            r"ops-math|undefined symbol.*aclnn|aclnnStatus)",
            re.IGNORECASE,
        ),
        3,
    ),
    (
        "memory-oom",
        re.compile(
            r"(?:NPU out of memory|OutOfMemoryError|207001|507011|ACL_ERROR_RT_MEMORY_ALLOCATION|"
            r"memory allocation failed|gpu_memory_utilization|NPUCachingAllocator|"
            r"exit code 137|SIGKILL|\bOOM\b|out of memory|HBM.*(?:full|oom|insufficient|不足)|"
            r"KV cache.*(?:memory|blocks|oom))",
            re.IGNORECASE,
        ),
        3,
    ),
    (
        "cann-driver-env",
        re.compile(
            r"(?:207003|507008|500001|500002|ACL_ERROR_|ascend-toolkit|libascendcl\.so|"
            r"tsdaemon|drvHdc|hdcd|ASCEND_RT_VISIBLE_DEVICES|NPU_VISIBLE_DEVICES|"
            r"cann/runtime|driver.*version|firmware|\bABI\b|ImportError|OSError.*lib|dlopen|"
            r"soc_version|torch_npu.*version|CANN.*version)",
            re.IGNORECASE,
        ),
        2,
    ),
]

GITHUB_PR_URL_RE = re.compile(
    r"https://github\.com/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)/pull/([0-9]{1,8})\b"
)
GITHUB_ISSUE_URL_RE = re.compile(
    r"https://github\.com/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)/issues/([0-9]{1,8})\b"
)
GITHUB_QUALIFIED_REF_RE = re.compile(
    r"(?<![A-Za-z0-9_./:-])([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)#([0-9]{1,8})\b"
)
GITHUB_UPSTREAM_VLLM_RE = re.compile(
    r"\b(?:upstream\s+)?vllm(?!-ascend)\s+(?:pr|pull\s+request)\s*#?([0-9]{1,8})\b",
    re.IGNORECASE,
)
GITHUB_VLLM_ASCEND_RE = re.compile(
    r"\bvllm-ascend\s+(?:pr|pull\s+request)\s*#?([0-9]{1,8})\b",
    re.IGNORECASE,
)
GITHUB_SAME_REF_RE = re.compile(r"(?<![A-Za-z0-9_./:-])#([0-9]{1,8})\b")

GITCODE_MR_URL_RE = re.compile(
    r"https://gitcode\.com/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)/(?:merge_requests|pull)/([0-9]{1,8})\b"
)
GITCODE_ISSUE_URL_RE = re.compile(
    r"https://gitcode\.com/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)/issues/([0-9]{1,8})\b"
)
GITCODE_QUALIFIED_BANG_RE = re.compile(
    r"(?<![A-Za-z0-9_./-])(?:gitcode:)?([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)!([0-9]{1,8})\b",
    re.IGNORECASE,
)
GITCODE_BANG_REF_RE = re.compile(r"(?<![A-Za-z0-9_./:-])!([0-9]{1,8})\b")

NON_FIX_CONTEXT_RE = re.compile(
    r"(?:\b(?:not|never|no|does\s+not|doesn['’]?t|did\s+not|didn['’]?t|won['’]?t|cannot|can['’]?t|"
    r"has\s+not|hasn['’]?t|have\s+not|haven['’]?t|is\s+not|isn['’]?t|was\s+not|wasn['’]?t|"
    r"should\s+not|without|instead\s+of|rather\s+than)\s+"
    r"(?:fix(?:es|ed|ing)?|close[sd]?|resolve[sd]?|address(?:es|ed)?|work|by|from|in|via)?|"
    r"\b(?:failed\s+to\s+(?:fix|resolve|address)|did\s+not\s+work|didn['’]?t\s+work|"
    r"still\s+fail(?:s|ing)?|not\s+(?:a\s+)?fix|not\s+fixed|not\s+resolved|"
    r"unrelated(?:\s+to)?|separate\s+unresolved|still\s+broken|unresolved|"
    r"not\s+related|duplicate\s+of|dup\s+of|superseded\s+by|similar\s+to|see\s+also|"
    r"introduced\s+(?:by|in)|caused\s+(?:by|in)|regression\s+(?:from|in|by|since)|"
    r"regressed\s+(?:by|in|from)|broken\s+(?:by|in)|started\s+(?:with|in|after|since)|"
    r"repro(?:duced|duces)?\s+(?:in|with|on|after)|triggered\s+by|since\s+(?:pr|mr|#))\b|"
    r"(?:未修复|未解决|不是|并非|无关|未能|没有修复|不能解决|无效|引入|导致))",
    re.IGNORECASE,
)
CLAUSE_BOUNDARY_RE = re.compile(r"[,;\n]|(?<!\w)\.(?!\w)|\.\s|\b(?:but|however|instead|whereas|yet)\b", re.IGNORECASE)
AFFIRMATIVE_REF_CONTEXT_RE = re.compile(
    r"(?:\b(?:fix(?:es|ed|ing)?|close[sd]?|resolve[sd]?|merged(?:\s+(?:in|via|by))?|"
    r"addressed(?:\s+(?:in|by))?|patched(?:\s+(?:in|by))?|reappl(?:y|ied))\b|已修复|已解决|合入|修复)",
    re.IGNORECASE,
)
NON_PR_BARE_PREFIX_RE = re.compile(
    r"(?:\b(?:rank|device|card|npu|gpu|step|line|epoch|thread|worker|core|pid|tid|stream|layer)\s*$)",
    re.IGNORECASE,
)

CODE_EXTS = {
    ".py", ".cpp", ".cc", ".cxx", ".c", ".h", ".hpp", ".hh",
    ".cu", ".cuh", ".cmake", ".sh", ".yaml", ".yml", ".toml",
    ".ts", ".tsx", ".go", ".rs",
}
SKIP_DIFF_EXTS = {
    ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg",
    ".pdf", ".lock", ".jsonl", ".bin", ".pt", ".safetensors",
}

RESOLUTION_HINT_RE = re.compile(
    r"(?:\b(?:fix(?:ed|es)?|resolv(?:ed|es)|merged(?:\s+(?:in|via|pr|mr))?|addressed|workaround|bypass|"
    r"root\s+cause|upgrad(?:ed|ing)\s+to|downgrad(?:ed|ing)\s+to)\b|"
    r"\b(?:set|export)\s+[A-Z0-9_]+=|"
    r"\b(?:use|add|pass|try|switch\s+to|enable|disable)\s+--[a-z0-9-]+|"
    r"\b(?:fixed|resolved|merged|closed)\s+(?:in|by|via)\s+(?:pr|mr|commit|patch|https?://\S+|(?:#|!)[0-9]{1,8})\b|"
    r"已修复|已解决|合入|规避|根因|定位到|升级到)",
    re.IGNORECASE,
)
NEGATED_RESOLUTION_CLAUSE_RE = re.compile(
    r"(?:\b(?:not|never|still\s+not|no|cannot|can['’]?t|doesn['’]?t|does\s+not|didn['’]?t|did\s+not|"
    r"isn['’]?t|is\s+not|wasn['’]?t|was\s+not|haven['’]?t|hasn['’]?t|won['’]?t|"
    r"not\s+sure(?:\s+if)?|maybe|might|possibly|perhaps|wonder(?:ing)?\s+if|whether|"
    r"still\s+under\s+review|under\s+review|still\s+pending|pending\s+review|"
    r"still\s+(?:collecting|investigating|reproducing|hanging|occurs?|happens?|crash(?:es|ing)?|fails?|hits?)|"
    r"same\s+(?:crash|error|issue)\s+(?:still\s+)?(?:occurs?|happens?)|"
    r"introduc(?:es?|ed)\s+(?:the\s+)?regression|caus(?:es?|ed|ing)\s+(?:the\s+)?(?:bug|crash|error|regression)|"
    r"not\s+successful|unsuccessful|failed\s+to\s+(?:fix|resolve|work)|"
    r"did\s+not\s+work|didn['’]?t\s+work|not\s+resolved|unresolved|not\s+fixed|"
    r"still\s+broken|not\s+merged|unmerged)\b|"
    r"(?:未|没有|还没|仍未|暂未|无法|不能|不确定|可能|也许|好像|是否|待合入|未修复|未解决|无效|失败))",
    re.IGNORECASE,
)
SPECULATIVE_CLAUSE_RE = re.compile(
    r"(?:[?？]\s*$|\b(?:maybe|possibly|perhaps|"
    r"(?:may|might|could)\s+(?:have\s+)?(?:(?:also|already|just|still|even|potentially|probably)\s+)?"
    r"(?:be|been|fix(?:ed)?|resolv(?:e|ed)?|help(?:ed)?|address(?:ed)?|clos(?:e|ed)?|avoid(?:ed)?|workaround|work(?:ed)?)|"
    r"could\s+it\s+be|not\s+sure|any\s+idea|"
    r"has\s+anyone|is\s+this\s+fixed|did\s+this\s+fix|does\s+this\s+fix|can\s+someone)\b|"
    r"(?:请问|是否已修复|是不是|有没有人|不确定是否|难道))",
    re.IGNORECASE,
)


def validate_repo_item_url(
    url: Any,
    expected_host: str,
    expected_repo: str,
    expected_kind: str,
    expected_num: int,
) -> str | None:
    if not isinstance(url, str):
        return None
    raw = url.strip()
    if not raw:
        return None
    try:
        p = urllib.parse.urlparse(raw)
    except ValueError:
        return None
    if p.scheme.lower() != "https" or (p.netloc or "").lower() != expected_host.lower():
        return None
    if p.username or p.password:
        return None
    m = re.fullmatch(
        rf"/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)/{re.escape(expected_kind)}/([0-9]{{1,9}})/?",
        p.path or "",
    )
    if not m:
        return None
    repo_slug, num_str = m.group(1), m.group(2)
    if repo_slug.lower() != expected_repo.lower():
        return None
    if int(num_str) != expected_num:
        return None
    return f"https://{expected_host.lower()}/{expected_repo}/{expected_kind}/{expected_num}"


def parse_strict_positive_int(val: Any) -> int | None:
    if isinstance(val, bool) or val is None:
        return None
    if isinstance(val, int):
        return val if val > 0 else None
    if isinstance(val, float):
        return None
    if isinstance(val, str):
        s = val.strip()
        if s.isascii() and s.isdigit() and len(s) <= 18:
            n = int(s)
            return n if n > 0 else None
    return None


def parse_strict_nonneg_int(val: Any, default: int = 0) -> int:
    if isinstance(val, bool) or val is None:
        return default
    if isinstance(val, int):
        return val if val >= 0 else default
    if isinstance(val, float):
        return default
    if isinstance(val, str):
        s = val.strip()
        if s.isascii() and s.isdigit() and len(s) <= 18:
            return int(s)
    return default


def _clause_before(text: str, pos: int, max_lookback: int = 100) -> str:
    window_start = max(0, pos - max_lookback)
    window = text[window_start:pos]
    last_boundary = 0
    for m in CLAUSE_BOUNDARY_RE.finditer(window):
        last_boundary = m.end()
    return window[last_boundary:]


def _clause_after(text: str, end: int, max_lookahead: int = 100) -> str:
    window = text[end : min(len(text), end + max_lookahead)]
    # Stop before parenthetical side-notes about another ref, e.g. "(not #11)"
    window = re.sub(r"\([^)]*(?:#[0-9]|![0-9])[^)]*\)", " ", window)
    rm = CLAUSE_BOUNDARY_RE.search(window)
    return window[: rm.start()] if rm else window


def _full_clause_at(text: str, start: int, end: int) -> str:
    return f"{_clause_before(text, start, max_lookback=120)}{text[start:end]}{_clause_after(text, end, max_lookahead=120)}"


def _safe_urlparse(raw_url: str) -> urllib.parse.ParseResult | None:
    try:
        return urllib.parse.urlparse(raw_url)
    except ValueError:
        return None


_TENTATIVE_CUE_CORE = (
    r"(?:\b(?:after|before|while|when|during|upon|from)\s+"
    r"(?:trying|tried|testing|tested|attempting|attempted|checking|checked|"
    r"investigating|investigated|debugging|debugged|reproducing|reproduced|"
    r"troubleshooting|troubleshot|analyzing|analyzed|diagnosing|diagnosed|"
    r"suspecting|suspected|inspecting|inspected|reviewing|reviewed|"
    r"exploring|explored|comparing|compared|bisecting|bisected|"
    r"reverting|reverted|removing|removed|replacing|replaced|using|running)|"
    r"\b(?:trying|tried|attempting|attempted|testing|tested|checking|checked|"
    r"investigating|investigated|debugging|debugged|reproducing|reproduced|"
    r"troubleshooting|troubleshot|analyzing|analyzed|diagnosing|diagnosed|"
    r"suspecting|suspected|inspecting|inspected|comparing|compared|"
    r"bisecting|bisected|replacing|replaced|"
    r"(?:the\s+)?(?:culprit|root\s+cause|offending(?:\s+(?:pr|mr|commit|patch|change))?|"
    r"breaking(?:\s+(?:pr|mr|commit|patch|change))?|triggering(?:\s+(?:pr|mr|commit|patch|change))?|"
    r"regress(?:ing|ion)(?:\s+(?:pr|mr|commit|patch|change))?)\s+"
    r"(?:was|is|were|seems\s+to\s+be|appears\s+to\s+be|turned\s+out\s+to\s+be)|"
    r"looking\s+at|looking\s+into|related\s+to|similar\s+to|mentioned\s+in|"
    r"triggered\s+by|introduced\s+in|caused\s+by|instead\s+of|rather\s+than|"
    r"unlike|contrary\s+to|compared\s+(?:to|with)|except(?:\s+for)?|excluding))"
)
_TENTATIVE_TARGET_LEADIN = (
    r"(?:(?:(?:the|a|an|this|that)\s+)?(?:(?:crash|bug|issue|error|failure|oom|hang|regression|"
    r"problem|symptom|case|behavior|repro|change|patch|fix|work|pr|mr|pull|commit)\s+"
    r"(?:in|from|of|on|with|for|at)|pr|mr|pull|patch|issue|commit|#)\s*)?"
)
_TENTATIVE_PRE_REF_RE = re.compile(
    rf"(?:{_TENTATIVE_CUE_CORE}\s+{_TENTATIVE_TARGET_LEADIN}$)",
    re.IGNORECASE,
)
_TENTATIVE_COORD_PRE_REF_RE = re.compile(
    rf"(?:{_TENTATIVE_CUE_CORE}\s+(?:"
    r"(?:[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)?(?:#|!)[0-9]{1,8}|https?://\S+|"
    r"\bas\s+well\s+as\b|"
    r"\b(?:the|a|an|this|that|pr|mr|pull|patch|issue|commit|crash|bug|error|failure|oom|hang|"
    r"regression|problem|symptom|case|behavior|repro|in|from|of|on|with|for|at|"
    r"and|or|nor|plus|both|either|neither)\b|"
    r"[,&+/():\s]"
    r")*$)",
    re.IGNORECASE,
)
_TENTATIVE_CUE_RE = re.compile(_TENTATIVE_CUE_CORE, re.IGNORECASE)
_ANY_REF_TOKEN_RE = re.compile(
    r"(?:[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)?(?:#|!)[0-9]{1,8}|https?://\S+"
)
_WITHOUT_EXTRA_CUE_RE = re.compile(
    r"\bwithout\s+(?:affecting|breaking|changing|touching|needing|using|modifying)\b",
    re.IGNORECASE,
)


_POST_REF_NON_FIX_RE = re.compile(
    r"^\s*(?:[:,;-]\s*)?(?:"
    r"broke\b|breaks\b|is\s+broken\b|remains?\s+(?:broken|unfixed|unresolved|open)\b|"
    r"still\s+(?:reproduc(?:ible|es|ing)|persists?|broken|fails?|failing|crashes?|crashing|occurs?|happens?|hangs?|unfixed|unresolved)\b|"
    r"(?:is|was|remains?|looks?)\s+(?:still\s+)?(?:not\s+fixed|not\s+resolved|unfixed|unresolved|reproduc(?:ible|ed)|broken|unrelated|failing)\b|"
    r"caused\b|causes\b|introduced\b|introduces\b|triggered\b|triggers\b|regressed\b|"
    r"failed\s+to\s+(?:fix|resolve|address)\b|"
    r"(?:did|does|will|would|could|should|can|has|have|is|was)\s+not\s+(?:fix|resolve|address|work)\b|"
    r"(?:didn['’]?t|doesn['’]?t|won['’]?t|can['’]?t|couldn['’]?t|shouldn['’]?t|hasn['’]?t|haven['’]?t|isn['’]?t|wasn['’]?t)\s+(?:fix|resolve|address|work)\b|"
    r"not\s+(?:a\s+)?fix\b|did\s+not\s+work\b|didn['’]?t\s+work\b|"
    r"(?:is|was)\s+(?:the\s+|a\s+|an\s+)?(?:culprit|cause|root\s+cause|regression|bug|problem|issue|offender|offending(?:\s+(?:pr|mr|commit|patch|change))?)\b"
    r")",
    re.IGNORECASE,
)


def _match_is_negated(text: str, start: int, end: int) -> bool:
    clause_before = _clause_before(text, start, max_lookback=100)
    if NON_FIX_CONTEXT_RE.search(clause_before):
        return True
    aff_matches = list(AFFIRMATIVE_REF_CONTEXT_RE.finditer(clause_before))
    tail_after_aff = clause_before[aff_matches[-1].end() :] if aff_matches else clause_before
    if _TENTATIVE_COORD_PRE_REF_RE.search(tail_after_aff):
        return True
    if aff_matches:
        cue_m = _TENTATIVE_CUE_RE.search(tail_after_aff) or _WITHOUT_EXTRA_CUE_RE.search(tail_after_aff)
        if cue_m and _ANY_REF_TOKEN_RE.search(tail_after_aff[: cue_m.start()]):
            return True
    pre_tail = re.split(r"(?:#|!)[0-9]{1,8}|https?://\S+", clause_before)[-1]
    if _TENTATIVE_PRE_REF_RE.search(pre_tail):
        return True
    clause_after = _clause_after(text, end, max_lookahead=100)
    if _POST_REF_NON_FIX_RE.match(clause_after):
        return True
    return bool(NON_FIX_CONTEXT_RE.search(clause_after))


def _has_affirmative_resolution_hint(text: str) -> bool:
    for m in RESOLUTION_HINT_RE.finditer(text):
        clause = _full_clause_at(text, m.start(), m.end()).strip()
        if SPECULATIVE_CLAUSE_RE.search(clause):
            continue
        if NEGATED_RESOLUTION_CLAUSE_RE.search(clause):
            continue
        return True
    return False


def log(msg: str) -> None:
    err = getattr(sys, "stderr", None)
    if err is None or getattr(err, "closed", False):
        return
    line = f"[dual-miner] {msg}"
    try:
        print(line, file=err, flush=True)
    except UnicodeEncodeError:
        enc = getattr(err, "encoding", None) or "ascii"
        safe_ln = line.encode(enc, errors="replace").decode(enc, errors="replace")
        try:
            print(safe_ln, file=err, flush=True)
        except (BrokenPipeError, OSError, ValueError, UnicodeEncodeError):
            pass
    except (BrokenPipeError, OSError, ValueError):
        pass


def validate_github_api_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.netloc.lower() != "api.github.com":
        raise ValueError(f"Refusing to send GitHub credentials to non-API URL: {url!r}")
    return url


class _SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Strip Authorization when redirecting to a different host or non-HTTPS URL."""

    def redirect_request(self, req: urllib.request.Request, fp: Any, code: int, msg: str, headers: Any, newurl: str) -> urllib.request.Request | None:
        new_req = super().redirect_request(req, fp, code, msg, headers, newurl)
        if new_req is None:
            return None
        old_p = urllib.parse.urlparse(req.full_url)
        new_p = urllib.parse.urlparse(new_req.full_url)
        if new_p.scheme.lower() != "https" or new_p.netloc.lower() != old_p.netloc.lower():
            for hkey in list(new_req.headers.keys()):
                if hkey.lower() == "authorization":
                    del new_req.headers[hkey]
            for hkey in list(new_req.unredirected_hdrs.keys()):
                if hkey.lower() == "authorization":
                    del new_req.unredirected_hdrs[hkey]
        return new_req


_SAFE_OPENER = urllib.request.build_opener(_SafeRedirectHandler())


def _headers_for_url(url: str, headers: dict[str, str]) -> dict[str, str]:
    parsed = urllib.parse.urlparse(url)
    is_gh_api = parsed.scheme.lower() == "https" and parsed.netloc.lower() == "api.github.com"
    if is_gh_api:
        return dict(headers)
    return {k: v for k, v in headers.items() if k.lower() != "authorization"}


def _read_bounded_response(resp: Any, max_bytes: int) -> bytes:
    """Read HTTP response body in chunks up to max_bytes to bound memory."""
    chunks: list[bytes] = []
    total = 0
    while total < max_bytes:
        blk = resp.read(min(65536, max_bytes - total))
        if not blk:
            break
        chunks.append(blk)
        total += len(blk)
    return b"".join(chunks)


def http_get_json(
    url: str,
    headers: dict[str, str],
    timeout: int = 25,
    retries: int = 2,
    max_bytes: int = 16 * 1024 * 1024,
) -> tuple[Any | None, int, dict[str, str]]:
    last_status = 0
    last_hdrs: dict[str, str] = {}
    safe_hdrs = _headers_for_url(url, headers)
    for attempt in range(retries + 1):
        req = urllib.request.Request(url, headers=safe_hdrs)
        try:
            with _SAFE_OPENER.open(req, timeout=timeout) as resp:
                hdrs = {k.lower(): v for k, v in resp.headers.items()}
                raw_bytes = _read_bounded_response(resp, max_bytes + 1)
                if len(raw_bytes) > max_bytes:
                    raise ValueError(f"JSON response exceeded {max_bytes} bytes limit")
                raw = raw_bytes.decode("utf-8", "replace")
                return json.loads(raw), resp.status, hdrs
        except urllib.error.HTTPError as e:
            last_status = e.code
            last_hdrs = {k.lower(): v for k, v in e.headers.items()}
            if e.code in (403, 404, 422):
                return None, e.code, last_hdrs
            if attempt < retries:
                time.sleep(1.5 * (attempt + 1))
        except Exception as e:
            last_status = 0
            if attempt < retries:
                time.sleep(1.5 * (attempt + 1))
            else:
                log(f"HTTP error on {_redact_url_for_log(url)[:110]}: {e}")
    return None, last_status, last_hdrs


def http_get_text(
    url: str,
    headers: dict[str, str],
    timeout: int = 25,
    max_bytes: int = 512 * 1024,
) -> tuple[str | None, int, dict[str, str]]:
    safe_hdrs = _headers_for_url(url, headers)
    req = urllib.request.Request(url, headers=safe_hdrs)
    try:
        with _SAFE_OPENER.open(req, timeout=timeout) as resp:
            hdrs = {k.lower(): v for k, v in resp.headers.items()}
            raw_bytes = _read_bounded_response(resp, max_bytes)
            return raw_bytes.decode("utf-8", "replace"), resp.status, hdrs
    except urllib.error.HTTPError as e:
        return None, e.code, {k.lower(): v for k, v in e.headers.items()}
    except Exception:
        return None, 0, {}


def is_bot_login(login: str) -> bool:
    low = (login or "").strip().lower()
    if not low or low in {"deleted-user", "deleted", "ghost"}:
        return True
    if low in BOT_USERS:
        return True
    return low.endswith("[bot]") or low.endswith("-bot") or low.endswith("-robot")


def is_non_bug_issue(title: str, labels: list[str], issue_type: str = "") -> bool:
    it_low = (issue_type or "").strip().lower()
    if it_low and any(tok in it_low for tok in ("requirement", "feature", "doc", "需求", "文档", "task")):
        if "bug" not in it_low and "缺陷" not in it_low:
            return True
    safe_labels = labels if isinstance(labels, list) else []
    lbl_low = {
        str(l.get("name") or "").strip().lower() if isinstance(l, dict) else str(l).strip().lower()
        for l in safe_labels
        if l
    }
    has_bug_label = bool(lbl_low & BUG_LABELS) or any("bug" in l for l in lbl_low)
    if NON_BUG_TITLE_RE.search(title or "") and not has_bug_label:
        return True
    if (lbl_low & NON_BUG_LABELS) and not has_bug_label:
        return True
    return False


def has_concrete_verifiable_log_line(title: str, body: str, comments_text: str) -> bool:
    title_norm = (title or "").strip()
    hay = f"{body}\n{comments_text}"
    for raw_ln in hay.split("\n"):
        ln = raw_ln.strip()
        if len(ln) < 18 or len(ln) > 600:
            continue
        if title_norm and (ln == title_norm or ln in title_norm):
            continue
        if CONCRETE_LOG_LINE_RE.search(ln):
            return True
    return False


def extract_error_codes(text: str) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    for m in ERROR_CODE_RE.findall(text):
        tok = m.strip()
        key = tok.upper()
        if key not in seen:
            seen.add(key)
            found.append(tok)
    return found[:16]


_HCCL_WAIT_CODE_RE = re.compile(r"\bEI0002\b", re.IGNORECASE)
_HCCL_LINK_CODE_RE = re.compile(r"\b(?:EI000[13456789]|EJ000[0-9])\b", re.IGNORECASE)


def classify_fault_domain(repo: str, title: str, body: str, comments_text: str) -> str:
    full_text = f"{title}\n{body}\n{comments_text}"
    has_ei0002 = bool(_HCCL_WAIT_CODE_RE.search(full_text))
    has_ei0006 = bool(_HCCL_LINK_CODE_RE.search(full_text))
    if has_ei0002 and not has_ei0006:
        return "hccl-wait-cascade"
    if has_ei0006 and not has_ei0002:
        return "hccl-link-net"

    combined = f"{repo}\n{title}\n{body[:5000]}\n{comments_text[:2500]}"
    scores: Counter[str] = Counter()
    for domain, pat, weight in DOMAIN_RULES:
        hits = pat.findall(combined)
        if hits:
            scores[domain] += weight * min(len(hits), 4)
    repo_low = repo.lower()
    if "hccl" in repo_low:
        scores["hccl-link-net"] += 2
        scores["hccl-wait-cascade"] += 1
    elif "torchair" in repo_low:
        scores["torchair-ge-compile"] += 3
    elif "modelslim" in repo_low:
        scores["moe-mc2-quant"] += 3
    elif "ops-transformer" in repo_low:
        scores["cann-opapi-aclnn"] += 2
        scores["moe-mc2-quant"] += 1
    elif "op-plugin" in repo_low or "ops-nn" in repo_low or "ops-math" in repo_low:
        scores["cann-opapi-aclnn"] += 2
    elif "cann/runtime" in repo_low:
        scores["cann-aicore-smmu"] += 1
        scores["cann-driver-env"] += 2
    if not scores:
        return "other"
    return scores.most_common(1)[0][0]


def has_substantive_human_resolution(comments: list[dict[str, Any]]) -> tuple[bool, str, bool]:
    """Filter human comments, format compact comments_text, and detect substantive resolution on retained text."""
    snippets: list[tuple[str, bool]] = []
    truncated = False
    for c in comments:
        if not isinstance(c, dict):
            continue
        user_obj = c.get("user") if isinstance(c.get("user"), dict) else {}
        user_type = str(user_obj.get("type") or "").strip().lower()
        raw_login = user_obj.get("login")
        if not isinstance(raw_login, str) or not raw_login.strip():
            raw_login = user_obj.get("name")
        login = raw_login.strip() if isinstance(raw_login, str) else ""
        raw_cbody = c.get("body")
        cbody = raw_cbody.strip() if isinstance(raw_cbody, str) else ""
        if not cbody:
            continue
        if len(cbody) > 1200:
            truncated = True
        low_login = login.lower()
        always_bot = (
            not low_login
            or low_login in {"deleted-user", "deleted", "ghost"}
            or low_login in BOT_USERS
            or low_login.endswith("[bot]")
        )
        if user_type == "bot":
            is_bot = True
        elif user_type == "user":
            is_bot = always_bot
        else:
            is_bot = is_bot_login(login)
        is_human_author = bool(login and not is_bot)
        if not login:
            display_login = "deleted-user"
            is_human_author = False
        elif is_bot:
            display_login = login if is_bot_login(login) else f"{login}[bot]"
        elif is_bot_login(login) or _is_log_header_tag(login):
            display_login = f"@{login}"
        else:
            display_login = login
        retained_body = re.sub(r"(?m)^\[", " [", cbody[:1200])
        snippet = f"[{display_login}]: {retained_body}"
        snippets.append((snippet, is_human_author))

    retained_snippets: list[tuple[str, bool]] = []
    cur_len = 0
    max_total = 4500
    for snippet, is_human in snippets:
        sep = 1 if retained_snippets else 0
        rem = max_total - cur_len - sep
        if rem <= 0:
            truncated = True
            break
        if len(snippet) > rem:
            truncated = True
            kept = snippet[:rem]
            retained_snippets.append((kept, is_human))
            cur_len += sep + len(kept)
            break
        retained_snippets.append((snippet, is_human))
        cur_len += sep + len(snippet)

    resolution_hint_chars = 0
    substantive = False
    for snippet, is_human in retained_snippets:
        if not is_human:
            continue
        body_part = snippet.split("]: ", 1)[1] if "]: " in snippet else snippet
        clean = re.sub(r"\s+", " ", body_part).strip()
        if _has_affirmative_resolution_hint(clean):
            if len(clean) >= 25:
                resolution_hint_chars += len(clean)
            if len(clean) >= 55:
                substantive = True
    if resolution_hint_chars >= 80:
        substantive = True
    joined = "\n".join(s for s, _ in retained_snippets)
    return substantive, joined, truncated


def _is_code_file(path: str) -> bool:
    p = path.lower()
    if Path(p).name in ("cmakelists.txt", "dockerfile", "makefile"):
        return True
    return Path(p).suffix in CODE_EXTS


def _is_skip_file(path: str) -> bool:
    return Path(path.lower()).suffix in SKIP_DIFF_EXTS


def _section_has_diff_hunk(lines: list[str]) -> bool:
    in_hunk = False
    for ln in lines:
        if ln.startswith("diff --git "):
            in_hunk = False
            continue
        if ln.startswith("@@ "):
            in_hunk = True
            continue
        if in_hunk and ln and ln[0] in ("+", "-"):
            return True
    return False


def _trim_unified_diff_checked(raw_diff: str, max_lines: int = 120) -> tuple[str, int, bool]:
    """Keep high-signal unified diff lines with real hunks <= max_lines, flagging truncation even if dropped."""
    if not raw_diff or not raw_diff.strip():
        return "", 0, False
    sections: list[tuple[int, str, list[str]]] = []
    cur_file = ""
    cur_lines: list[str] = []
    for ln in raw_diff.rstrip("\r\n").split("\n"):
        if ln.endswith("\r"):
            ln = ln[:-1]
        if ln.startswith("diff --git "):
            if cur_lines:
                sections.append((0, cur_file, cur_lines))
            parts = ln.split()
            cur_file = parts[-1][2:] if len(parts) >= 4 and parts[-1].startswith("b/") else ln
            cur_lines = [ln]
        else:
            cur_lines.append(ln)
    if cur_lines:
        sections.append((0, cur_file, cur_lines))

    ranked: list[tuple[int, str, list[str]]] = []
    for _, fname, lines in sections:
        if fname and _is_skip_file(fname):
            continue
        low = fname.lower()
        if any(ln.startswith("Binary files ") for ln in lines[:6]):
            continue
        if not _section_has_diff_hunk(lines):
            continue
        is_test = "test" in low or "benchmark" in low
        is_doc = low.endswith((".md", ".rst", ".txt"))
        if _is_code_file(fname) and not is_test:
            prio = 0
        elif _is_code_file(fname):
            prio = 1
        elif not is_doc:
            prio = 2
        else:
            prio = 3
        ranked.append((prio, fname, lines))

    ranked.sort(key=lambda x: x[0])
    out_lines: list[str] = []
    truncated = False
    for _, _, lines in ranked:
        if len(out_lines) >= max_lines:
            truncated = True
            break
        filtered = [
            ln
            for ln in lines
            if not ln.startswith(("index ", "old mode ", "new mode ", "similarity index "))
        ]
        remaining = max_lines - len(out_lines)
        cand = filtered if len(filtered) <= remaining else filtered[:remaining]
        if len(filtered) > remaining:
            truncated = True
        if _section_has_diff_hunk(cand):
            out_lines.extend(cand)
        if len(filtered) > remaining:
            break

    text = "\n".join(out_lines)
    if not text.strip() or not _section_has_diff_hunk(out_lines):
        return "", 0, truncated
    return text, len(out_lines), truncated


def trim_unified_diff(raw_diff: str, max_lines: int = 120) -> tuple[str, int]:
    """Keep high-signal unified diff lines with real hunks (preferring code over docs/tests), <= max_lines."""
    text, line_count, _ = _trim_unified_diff_checked(raw_diff, max_lines=max_lines)
    return text, line_count


def _mask_span(buf: list[str], start: int, end: int) -> None:
    for i in range(start, end):
        if buf[i] != "\n":
            buf[i] = " "


def _is_affirmative_fix_clause(clause: str) -> bool:
    return bool(
        AFFIRMATIVE_REF_CONTEXT_RE.search(clause)
        and not SPECULATIVE_CLAUSE_RE.search(clause)
        and not NEGATED_RESOLUTION_CLAUSE_RE.search(clause)
    )


def extract_github_pr_ref_contexts(repo: str, issue_num: int, text: str) -> list[tuple[str, bool]]:
    """Extract cross-repo & same-repo GitHub PR refs with chronological negation override and precedence ordering."""
    raw_hits: list[tuple[int, int, int, str]] = []
    buf = list(text)

    def _collect(tier: int, target_repo: str, num_val: int, start: int, end: int) -> None:
        if num_val <= 0:
            return
        if target_repo.lower() == repo.lower() and num_val == issue_num:
            return
        raw_hits.append((tier, start, end, f"{target_repo}#{num_val}"))

    for m in GITHUB_PR_URL_RE.finditer(text):
        _collect(0, m.group(1), int(m.group(2)), m.start(), m.end())
        _mask_span(buf, m.start(), m.end())

    for pat in (GITHUB_ISSUE_URL_RE, GITCODE_MR_URL_RE, GITCODE_ISSUE_URL_RE, GITCODE_QUALIFIED_BANG_RE):
        for m in pat.finditer("".join(buf)):
            _mask_span(buf, m.start(), m.end())

    masked = "".join(buf)
    for m in GITHUB_QUALIFIED_REF_RE.finditer(masked):
        _collect(1, m.group(1), int(m.group(2)), m.start(), m.end())
        _mask_span(buf, m.start(), m.end())

    masked = "".join(buf)
    for m in GITHUB_VLLM_ASCEND_RE.finditer(masked):
        _collect(2, "vllm-project/vllm-ascend", int(m.group(1)), m.start(), m.end())
        _mask_span(buf, m.start(), m.end())

    masked = "".join(buf)
    for m in GITHUB_UPSTREAM_VLLM_RE.finditer(masked):
        _collect(3, "vllm-project/vllm", int(m.group(1)), m.start(), m.end())
        _mask_span(buf, m.start(), m.end())

    masked = "".join(buf)
    for m in GITHUB_SAME_REF_RE.finditer(masked):
        prefix_ctx = masked[max(0, m.start() - 24) : m.start()]
        if NON_PR_BARE_PREFIX_RE.search(prefix_ctx):
            continue
        _collect(4, repo, int(m.group(1)), m.start(), m.end())

    state_by_key: dict[str, str] = {}
    first_rank: dict[str, tuple[int, int]] = {}
    canon_ref: dict[str, str] = {}
    for tier, start, end, ref in sorted(raw_hits, key=lambda h: (h[1], h[2], h[0])):
        kl = ref.lower()
        canon_ref.setdefault(kl, ref)
        if kl not in first_rank or (tier, start) < first_rank[kl]:
            first_rank[kl] = (tier, start)
        if _match_is_negated(text, start, end):
            state_by_key[kl] = "negated"
        elif _is_affirmative_fix_clause(_full_clause_at(text, start, end)):
            state_by_key[kl] = "affirmative"
            canon_ref[kl] = ref
        elif kl not in state_by_key:
            state_by_key[kl] = "mention"

    active = [kl for kl, st in state_by_key.items() if st != "negated"]
    active.sort(key=lambda kl: first_rank[kl])
    return [(canon_ref[kl], state_by_key[kl] == "affirmative") for kl in active[:12]]


def extract_github_pr_refs(repo: str, issue_num: int, text: str) -> list[str]:
    """Extract cross-repo & same-repo GitHub PR refs with precedence and clause-scoped negation."""
    return [r for r, _ in extract_github_pr_ref_contexts(repo, issue_num, text)]


def _scan_gitcode_mr_mentions(repo: str, text: str) -> tuple[list[tuple[str, int, bool]], set[str]]:
    """Scan GitCode MR mentions in chronological order so later disclaimers withdraw earlier affirmative claims."""
    raw_hits: list[tuple[int, int, int, str, int]] = []
    buf = list(text)

    def _collect(tier: int, target_repo: str, num_val: int, start: int, end: int) -> None:
        if num_val <= 0:
            return
        raw_hits.append((tier, start, end, target_repo, num_val))

    for m in GITCODE_MR_URL_RE.finditer(text):
        _collect(0, m.group(1), int(m.group(2)), m.start(), m.end())
        _mask_span(buf, m.start(), m.end())

    for pat in (GITCODE_ISSUE_URL_RE, GITHUB_PR_URL_RE, GITHUB_ISSUE_URL_RE):
        for m in pat.finditer("".join(buf)):
            _mask_span(buf, m.start(), m.end())

    masked = "".join(buf)
    for m in GITCODE_QUALIFIED_BANG_RE.finditer(masked):
        _collect(1, m.group(1), int(m.group(2)), m.start(), m.end())
        _mask_span(buf, m.start(), m.end())

    masked = "".join(buf)
    for m in GITCODE_BANG_REF_RE.finditer(masked):
        _collect(2, repo, int(m.group(1)), m.start(), m.end())

    state_by_key: dict[tuple[str, int], str] = {}
    first_rank: dict[tuple[str, int], tuple[int, int]] = {}
    canon_pair: dict[tuple[str, int], tuple[str, int]] = {}
    for tier, start, end, target_repo, num_val in sorted(raw_hits, key=lambda h: (h[1], h[2], h[0])):
        kl = (target_repo.lower(), num_val)
        canon_pair.setdefault(kl, (target_repo, num_val))
        if kl not in first_rank or (tier, start) < first_rank[kl]:
            first_rank[kl] = (tier, start)
        if _match_is_negated(text, start, end):
            state_by_key[kl] = "negated"
        elif _is_affirmative_fix_clause(_full_clause_at(text, start, end)):
            state_by_key[kl] = "affirmative"
            canon_pair[kl] = (target_repo, num_val)
        elif kl not in state_by_key:
            state_by_key[kl] = "mention"

    active = [kl for kl, st in state_by_key.items() if st != "negated"]
    active.sort(key=lambda kl: first_rank[kl])
    refs = [(canon_pair[kl][0], canon_pair[kl][1], state_by_key[kl] == "affirmative") for kl in active[:8]]
    disclaimed = {
        f"gitcode:{canon_pair[kl][0]}!{canon_pair[kl][1]}".lower()
        for kl, st in state_by_key.items()
        if st == "negated"
    }
    return refs, disclaimed


def extract_gitcode_mr_refs(
    repo: str, issue_num: int, text: str
) -> list[tuple[str, int, bool]]:
    """Return list of (repo, mr_num, has_affirmative_link_context) in precedence order."""
    refs, _ = _scan_gitcode_mr_mentions(repo, text)
    return refs


def extract_gitcode_disclaimed_mr_refs(repo: str, text: str) -> set[str]:
    """Extract normalized lowercase gitcode:repo!N refs whose latest disposition in text is negated/disclaimed."""
    _, disclaimed = _scan_gitcode_mr_mentions(repo, text)
    return disclaimed


def _is_self_consistent_direct_commit(dc: Any) -> bool:
    """Validate that a direct commit entry has consistent repo and SHA across ref, commit_sha, and url."""
    if not isinstance(dc, dict):
        return False
    d_ref = str(dc.get("ref") or "").strip()
    m_ref = re.fullmatch(r"([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)@([0-9a-fA-F]{7,40})", d_ref)
    if not m_ref:
        return False
    dc_repo, ref_sha = m_ref.group(1), m_ref.group(2).lower()
    raw_csha = str(dc.get("commit_sha") or "").strip()
    csha = (raw_csha or ref_sha).lower()
    if not re.fullmatch(r"[0-9a-fA-F]{7,40}", csha):
        return False
    if not (csha.startswith(ref_sha) or ref_sha.startswith(csha)):
        return False
    raw_url = str(dc.get("url") or "").strip()
    if raw_url:
        parsed_u = _safe_urlparse(raw_url)
        if (
            parsed_u is None
            or parsed_u.scheme.lower() != "https"
            or (parsed_u.netloc or "").lower() not in ("github.com", "gitcode.com")
        ):
            return False
        m_u = re.fullmatch(
            r"/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)/commit/([0-9a-fA-F]{7,40})/?",
            parsed_u.path or "",
        )
        if not m_u or m_u.group(1).lower() != dc_repo.lower():
            return False
        u_sha = m_u.group(2).lower()
        if not ((u_sha.startswith(ref_sha) or ref_sha.startswith(u_sha)) and (u_sha.startswith(csha) or csha.startswith(u_sha))):
            return False
    return True


def _redact_url_for_log(raw_url: str) -> str:
    s = (raw_url or "").strip()
    if not s:
        return ""
    scheme_sep = re.match(r"^(?:([A-Za-z][A-Za-z0-9+.-]*)://+|/{2,})", s)
    if scheme_sep:
        norm_s = s
        if scheme_sep.group(1):
            norm_s = re.sub(r"^([A-Za-z][A-Za-z0-9+.-]*)://+", r"\1://", s, count=1)
        else:
            norm_s = re.sub(r"^/{2,}", "//", s, count=1)
        try:
            p = urllib.parse.urlparse(norm_s)
            if p.netloc or "@" not in norm_s:
                host = p.hostname or ""
                if ":" in host and not host.startswith("["):
                    host = f"[{host}]"
                port = f":{p.port}" if p.port else ""
                scheme_prefix = f"{p.scheme}://" if p.scheme else "//"
                return f"{scheme_prefix}{host}{port}{p.path}"
        except ValueError:
            pass
        cleaned = re.sub(r"^([A-Za-z][A-Za-z0-9+.-]*://+|/{2,})[^/@?#]+@", r"\1", s)
        return re.sub(r"[?#].*$", "", cleaned)
    m_scheme = re.match(r"^([A-Za-z][A-Za-z0-9+.-]*:/+)([^/@?#]+)@(.+)$", s)
    if m_scheme:
        return re.sub(r"[?#].*$", "", f"{m_scheme.group(1)}{m_scheme.group(3)}")
    m_noslash = re.match(r"^(https?:)([^/@?#]+)@(.+)$", s, re.IGNORECASE)
    if m_noslash:
        return re.sub(r"[?#].*$", "", f"{m_noslash.group(1)}{m_noslash.group(3)}")
    no_qf = re.sub(r"[?#].*$", "", s)
    m_userinfo = re.match(r"^([^/?#@]+)@([^/?#]+(?:[:/].*)?)$", no_qf)
    if m_userinfo:
        user_part, rest = m_userinfo.group(1), m_userinfo.group(2)
        if user_part == "git" and ":" in rest.split("/", 1)[0]:
            return f"git@{rest}"
        return rest
    return no_qf


class LocalGitIndex:
    """Zero-API-call PR->commit and issue->fixing-PR index over verified merged remote refs."""

    PR_SUBJ_SUFFIX_RE = re.compile(r"\(#([0-9]{1,6})\)\s*$")
    MERGE_PR_SUBJ_RE = re.compile(r"^Merge pull request #([0-9]{1,6})\b", re.IGNORECASE)
    CHERRY_PICK_RE = re.compile(
        r"\[Cherry-pick\]|\(cherry picked from|\(from\s+#([0-9]{1,6})\)",
        re.IGNORECASE,
    )
    REVERT_SUBJ_RE = re.compile(r"^(?:\[revert\]\s*:?\s*)?(?:revert|reapply)\b", re.IGNORECASE)
    RE_REVERT_SUBJ_RE = re.compile(
        r'^(?:\[revert\]\s*:?\s*)?(?:reapply\b|revert\s+"?(?:\[revert\]\s*:?\s*)?revert\b)',
        re.IGNORECASE,
    )
    REVERT_COMMIT_BODY_RE = re.compile(
        r"(?:This reverts commit|Merge commit:\s*`?)\s*([0-9a-f]{7,40})\b",
        re.IGNORECASE,
    )
    FIX_LOCAL_ISSUE_RE = re.compile(
        r"\b(?:fix(?:es|ed)?|close[sd]?|resolve[sd]?)\s*:?\s*#([0-9]{1,6})\b",
        re.IGNORECASE,
    )
    FIX_QUALIFIED_ISSUE_RE = re.compile(
        r"\b(?:fix(?:es|ed)?|close[sd]?|resolve[sd]?)\s*:?\s*"
        r"([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)#([0-9]{1,6})\b",
        re.IGNORECASE,
    )
    FIX_URL_ISSUE_RE = re.compile(
        r"\b(?:fix(?:es|ed)?|close[sd]?|resolve[sd]?)\s*:?\s*"
        r"https://github\.com/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)/issues/([0-9]{1,6})\b",
        re.IGNORECASE,
    )
    REMOTE_TARGET_REF_RE = re.compile(
        r"^origin/(?:main|master|releases?/.+|v\d+\.\d+(?:\.\d+)?(?:rc\d*|a\d*|b\d*)?)$",
        re.IGNORECASE,
    )
    TRUNK_REF_RE = re.compile(r"^origin/(?:main|master)$", re.IGNORECASE)
    OID_RE = re.compile(r"^[0-9a-f]{40}$")

    def __init__(self, repo_slug: str, repo_path: str, expected_host: str = "github.com") -> None:
        self.repo_slug = repo_slug
        self.repo_path = Path(repo_path)
        self.expected_host = expected_host.lower()
        self.available = (self.repo_path / ".git").exists()
        self.identity_error = ""
        self.git_errors: list[str] = []
        self.merged_refs: list[str] = []
        self.trunk_refs: list[str] = []
        self.ref_oids: dict[str, str] = {}
        self.pr_to_commits: dict[int, list[dict[str, Any]]] = defaultdict(list)
        self.pr_to_commit: dict[int, tuple[str, str]] = {}
        self.issue_to_commits: dict[tuple[str, int], list[tuple[int, str, str]]] = defaultdict(list)
        self._diff_cache: dict[tuple[str, int], tuple[str, int]] = {}
        self._reverts_by_ref: dict[str, list[tuple[str, str, int]]] = defaultdict(list)
        self._reverted_shas_by_ref: dict[str, set[str]] = defaultdict(set)
        self._revert_patch_ids_cache: dict[str, dict[str, list[tuple[str, int]]]] = {}
        self._commit_patch_id_cache: dict[str, str] = {}
        self._is_reverted_cache: dict[tuple[str, str], bool] = {}
        self._reverted_pr_cache: dict[int, bool] = {}
        self._raw_issue_hits: dict[tuple[str, int], list[tuple[int, str, str, str, bool]]] = defaultdict(list)
        self._verified_issue_cache: dict[tuple[str, int], list[tuple[int, str, str]]] = {}

        if self.available:
            if not self._verify_remote_identity():
                self.available = False
            else:
                self.merged_refs = self._resolve_merged_refs()
                if not self.merged_refs:
                    self.available = False
                else:
                    self._build_index()

    @staticmethod
    def _parse_remote_host_and_slug(url: str) -> tuple[str, str] | None:
        raw = (url or "").strip()
        if not raw:
            return None
        if raw.startswith(("http://", "https://", "ssh://")):
            try:
                p = urllib.parse.urlparse(raw)
            except ValueError:
                return None
            host = (p.hostname or "").lower()
            path = (p.path or "").strip("/")
            if path.endswith(".git"):
                path = path[:-4]
            if not host or path.count("/") != 1:
                return None
            return host, path
        m_ssh = re.match(r"^(?:[^@:/]+@)?([^:/?#]+):([^?#]+?)(?:\.git)?/?$", raw, re.IGNORECASE)
        if m_ssh:
            host = m_ssh.group(1).lower()
            path = m_ssh.group(2).strip("/")
            if path.count("/") == 1:
                return host, path
        return None

    @classmethod
    def _parse_remote_slug(cls, url: str) -> str | None:
        parsed = cls._parse_remote_host_and_slug(url)
        return parsed[1] if parsed else None

    def _verify_remote_identity(self) -> bool:
        try:
            res = subprocess.run(
                ["git", "-C", str(self.repo_path), "remote", "get-url", "origin"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                check=False,
                timeout=15.0,
            )
        except (subprocess.TimeoutExpired, OSError) as exc:
            self.identity_error = f"Failed reading 'origin' remote on {self.repo_path}: {exc}"
            log(f"Warning: {self.identity_error}; disabling local git attribution")
            return False
        if res.returncode != 0:
            self.identity_error = f"Missing 'origin' remote on {self.repo_path}"
            log(f"Warning: {self.identity_error}; disabling local git attribution")
            return False
        parsed = self._parse_remote_host_and_slug(res.stdout)
        safe_raw = _redact_url_for_log(res.stdout)
        if (
            not parsed
            or parsed[0] != self.expected_host
            or parsed[1].lower() != self.repo_slug.lower()
        ):
            self.identity_error = (
                f"Remote origin mismatch on {self.repo_path}: expected {self.expected_host}/{self.repo_slug!r}, "
                f"got {safe_raw!r}"
            )
            log(f"Warning: {self.identity_error}; disabling local git attribution")
            return False
        return True

    def _resolve_merged_refs(self) -> list[str]:
        try:
            res = subprocess.run(
                [
                    "git",
                    "-C",
                    str(self.repo_path),
                    "for-each-ref",
                    "--format=%(refname:short)\t%(objectname)",
                    "refs/remotes/origin",
                ],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                check=False,
                timeout=30.0,
            )
        except (subprocess.TimeoutExpired, OSError) as exc:
            self.identity_error = f"git for-each-ref failed on {self.repo_path}: {exc}"
            return []
        if res.returncode != 0:
            self.identity_error = f"git for-each-ref failed on {self.repo_path}"
            return []
        trunk: list[str] = []
        releases: list[str] = []
        for raw_ln in (res.stdout or "").split("\n"):
            ln = raw_ln.strip()
            if not ln or "\t" not in ln:
                continue
            ref, oid = ln.split("\t", 1)
            ref = ref.strip()
            oid = oid.strip().lower()
            if not self.OID_RE.fullmatch(oid):
                continue
            if not self.REMOTE_TARGET_REF_RE.match(ref):
                continue
            self.ref_oids[ref] = oid
            if self.TRUNK_REF_RE.match(ref):
                if ref not in trunk:
                    trunk.append(ref)
            else:
                if ref not in releases:
                    releases.append(ref)
        self.trunk_refs = trunk
        ordered = trunk + sorted(releases, reverse=True)
        if not ordered:
            self.identity_error = f"No trusted origin/* target refs found on {self.repo_path}"
            log(f"Warning: {self.identity_error}; disabling local git attribution")
        return ordered

    @classmethod
    def _classify_revert_subject(cls, subj: str) -> tuple[bool, bool]:
        """Return (is_revert_or_reapply, is_negative_revert) preserving parity across nested Reverts/Reapply."""
        s = subj.strip()
        if not cls.REVERT_SUBJ_RE.match(s):
            return False, False
        depth = 0
        pos = 0
        tok_re = re.compile(
            r'\s*(?:\[revert\]\s*:?\s*|\\*["\'“”‘’]\s*)*(reapply|revert)\b',
            re.IGNORECASE,
        )
        while True:
            m = tok_re.match(s, pos)
            if not m:
                break
            word = m.group(1).lower()
            depth += 2 if word == "reapply" else 1
            pos = m.end()
        return True, (depth % 2 == 1)

    @classmethod
    def _extract_pr_from_subject(cls, subj: str) -> int:
        m_pr = cls.PR_SUBJ_SUFFIX_RE.search(subj)
        if m_pr:
            return int(m_pr.group(1))
        m_merge = cls.MERGE_PR_SUBJ_RE.search(subj)
        if m_merge:
            return int(m_merge.group(1))
        return 0

    @staticmethod
    def _run_git_bounded(
        cmd: list[str],
        *,
        max_bytes: int = 8 * 1024 * 1024,
        stdin_bytes: bytes | None = None,
        timeout: float = 30.0,
    ) -> tuple[int, bytes, bytes, bool]:
        """Run git streaming bounded stdout with real wall-clock timeout and concurrent stderr/stdin draining."""
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE if stdin_bytes is not None else subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        chunks: list[bytes] = []
        err_chunks: list[bytes] = []
        total = 0
        err_total = 0
        truncated_stream = False
        timed_out = False

        def _drain_stdout() -> None:
            nonlocal total, truncated_stream
            try:
                assert proc.stdout is not None
                while True:
                    need = max_bytes - total
                    if need <= 0:
                        truncated_stream = True
                        try:
                            proc.kill()
                        except OSError:
                            pass
                        break
                    blk = proc.stdout.read(min(65536, need))
                    if not blk:
                        break
                    chunks.append(blk)
                    total += len(blk)
                    if total >= max_bytes:
                        extra = proc.stdout.read(1)
                        if extra:
                            truncated_stream = True
                            try:
                                proc.kill()
                            except OSError:
                                pass
                        break
            except OSError:
                pass

        def _drain_stderr() -> None:
            nonlocal err_total
            try:
                assert proc.stderr is not None
                while True:
                    blk = proc.stderr.read(4096)
                    if not blk:
                        break
                    if err_total < 16384:
                        keep = blk[: 16384 - err_total]
                        err_chunks.append(keep)
                        err_total += len(keep)
            except OSError:
                pass

        def _feed_stdin() -> None:
            try:
                if proc.stdin is not None and stdin_bytes is not None:
                    proc.stdin.write(stdin_bytes)
                    proc.stdin.flush()
            except OSError:
                pass
            finally:
                if proc.stdin is not None:
                    try:
                        proc.stdin.close()
                    except OSError:
                        pass

        out_th = threading.Thread(target=_drain_stdout, daemon=True)
        err_th = threading.Thread(target=_drain_stderr, daemon=True)
        out_th.start()
        err_th.start()
        in_th: threading.Thread | None = None
        if stdin_bytes is not None:
            in_th = threading.Thread(target=_feed_stdin, daemon=True)
            in_th.start()

        try:
            try:
                proc.wait(timeout=max(0.05, float(timeout)))
            except subprocess.TimeoutExpired:
                timed_out = True
                try:
                    proc.kill()
                except OSError:
                    pass
                try:
                    proc.wait(timeout=2.0)
                except subprocess.TimeoutExpired:
                    pass
            out_th.join(timeout=1.5)
            err_th.join(timeout=1.5)
            if in_th is not None:
                in_th.join(timeout=1.0)
        finally:
            if proc.stdout is not None and not out_th.is_alive():
                try:
                    proc.stdout.close()
                except OSError:
                    pass
            if proc.stderr is not None and not err_th.is_alive():
                try:
                    proc.stderr.close()
                except OSError:
                    pass
        rc_val = 124 if timed_out else int(proc.returncode or 0)
        err_bytes = b"".join(err_chunks)
        if timed_out and b"timed out" not in err_bytes.lower():
            err_bytes = (err_bytes + b"\ngit command timed out").strip()
        return rc_val, b"".join(chunks), err_bytes, truncated_stream

    def _get_commit_patch_id(self, sha: str) -> str | None:
        if sha in self._commit_patch_id_cache:
            return self._commit_patch_id_cache[sha]
        rc_show, show_out, show_err, trunc = self._run_git_bounded(
            ["git", "-C", str(self.repo_path), "show", "--first-parent", "-m", sha, "--format="],
            max_bytes=8 * 1024 * 1024,
        )
        if trunc:
            self.git_errors.append(f"git show --first-parent -m {sha} exceeded 8 MiB bound")
            return None
        if rc_show != 0:
            self.git_errors.append(
                f"git show --first-parent -m {sha} failed ({rc_show}): "
                f"{show_err.decode('utf-8', 'replace')[:160]}"
            )
            return None
        if not show_out:
            self._commit_patch_id_cache[sha] = ""
            return ""
        rc_id, id_out, id_err, _ = self._run_git_bounded(
            ["git", "-C", str(self.repo_path), "patch-id", "--stable"],
            max_bytes=65536,
            stdin_bytes=show_out,
        )
        if rc_id != 0:
            self.git_errors.append(
                f"git patch-id failed for {sha} ({rc_id}): "
                f"{id_err.decode('utf-8', 'replace')[:160]}"
            )
            return None
        out = id_out.decode("utf-8", "replace").strip().split()
        pid = out[0] if out else ""
        self._commit_patch_id_cache[sha] = pid
        return pid

    def _get_reverse_revert_patch_ids(self, ref: str) -> tuple[dict[str, list[tuple[str, int]]], bool]:
        if ref in self._revert_patch_ids_cache:
            return self._revert_patch_ids_cache[ref], True
        mapping: dict[str, list[tuple[str, int]]] = defaultdict(list)
        all_ok = True
        for rev_sha, _, rev_idx in self._reverts_by_ref.get(ref, []):
            if rev_sha in self._reverted_shas_by_ref.get(ref, set()):
                continue
            rc_diff, diff_out, diff_err, trunc = self._run_git_bounded(
                ["git", "-C", str(self.repo_path), "diff", rev_sha, f"{rev_sha}^1"],
                max_bytes=8 * 1024 * 1024,
            )
            if trunc or rc_diff != 0:
                all_ok = False
                self.git_errors.append(
                    f"git diff {rev_sha} {rev_sha}^1 failed (rc={rc_diff}, trunc={trunc}): "
                    f"{diff_err.decode('utf-8', 'replace')[:160]}"
                )
                continue
            if not diff_out:
                continue
            rc_id, id_out, id_err, _ = self._run_git_bounded(
                ["git", "-C", str(self.repo_path), "patch-id", "--stable"],
                max_bytes=65536,
                stdin_bytes=diff_out,
            )
            if rc_id != 0:
                all_ok = False
                self.git_errors.append(
                    f"git patch-id failed for revert {rev_sha} ({rc_id}): "
                    f"{id_err.decode('utf-8', 'replace')[:160]}"
                )
                continue
            out = id_out.decode("utf-8", "replace").strip().split()
            if out:
                mapping[out[0]].append((rev_sha, rev_idx))
        if all_ok:
            self._revert_patch_ids_cache[ref] = mapping
        return mapping, all_ok

    def is_commit_reverted(self, sha: str, ref: str) -> bool:
        norm_sha = (sha or "").strip().lower()
        if not re.fullmatch(r"[0-9a-f]{7,40}", norm_sha):
            return False
        key = (norm_sha, ref)
        if key in self._is_reverted_cache:
            return self._is_reverted_cache[key]
        reverted_shas = self._reverted_shas_by_ref.get(ref, set())
        if norm_sha[:12] in reverted_shas or any(
            r_sha.startswith(norm_sha) or norm_sha.startswith(r_sha)
            for r_sha in reverted_shas
        ):
            self._is_reverted_cache[key] = True
            return True
        revs = self._reverts_by_ref.get(ref, [])
        reliable = True
        if revs:
            pid = self._get_commit_patch_id(norm_sha)
            if pid is None:
                reliable = False
            elif pid:
                rev_map, map_ok = self._get_reverse_revert_patch_ids(ref)
                if not map_ok:
                    reliable = False
                for rev_sha, _ in rev_map.get(pid, []):
                    try:
                        anc = subprocess.run(
                            ["git", "-C", str(self.repo_path), "merge-base", "--is-ancestor", norm_sha, rev_sha],
                            capture_output=True,
                            check=False,
                            timeout=15.0,
                        )
                    except (subprocess.TimeoutExpired, OSError) as exc:
                        reliable = False
                        self.git_errors.append(
                            f"git merge-base --is-ancestor {norm_sha} {rev_sha} failed: {exc}"
                        )
                        continue
                    if anc.returncode == 0:
                        self._is_reverted_cache[key] = True
                        return True
                    if anc.returncode != 1:
                        reliable = False
                        self.git_errors.append(
                            f"git merge-base --is-ancestor {sha} {rev_sha} failed ({anc.returncode}): "
                            f"{anc.stderr.decode('utf-8', 'replace')[:160]}"
                        )
        if reliable:
            self._is_reverted_cache[key] = False
        return False

    def _scan_git_log_batch(
        self,
        include_refs: list[str],
        exclude_refs: list[str],
        is_trunk: bool,
        raw_issue_hits: dict[tuple[str, int], list[tuple[int, str, str, str, bool]]],
    ) -> None:
        if not include_refs:
            return
        oid_to_ref: dict[str, str] = {}
        include_oids: list[str] = []
        for r in include_refs:
            oid = self.ref_oids.get(r)
            if oid and oid not in oid_to_ref:
                oid_to_ref[oid] = r
                include_oids.append(oid)
        exclude_oids: list[str] = []
        seen_excl: set[str] = set()
        for r in exclude_refs:
            oid = self.ref_oids.get(r)
            if oid and oid not in seen_excl:
                seen_excl.add(oid)
                exclude_oids.append(oid)
        include_oids = [oid for oid in include_oids if oid not in seen_excl]
        if not include_oids:
            return

        cmd = [
            "git",
            "-C",
            str(self.repo_path),
            "log",
            "--source",
            *include_oids,
        ]
        if exclude_oids:
            cmd.extend(["--not", *exclude_oids])
        cmd.append("--format=%H\x1f%S\x1f%s\x1f%b\x1e")
        try:
            res = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                check=False,
                timeout=120.0,
            )
        except (subprocess.TimeoutExpired, OSError) as exc:
            err_msg = f"git log failed on {self.repo_path}: {exc}"
            self.git_errors.append(err_msg)
            log(f"Warning: {err_msg}")
            self.available = False
            return
        if res.returncode != 0:
            err_msg = f"git log failed on {self.repo_path}: {res.stderr[:200]}"
            self.git_errors.append(err_msg)
            log(f"Warning: {err_msg}")
            self.available = False
            return

        seen_commit_per_branch: set[tuple[str, str]] = set()
        reverted_targets_by_ref: dict[str, set[str]] = defaultdict(set)
        cancelled_reverts_by_ref: dict[str, set[str]] = defaultdict(set)

        for idx_pos, rec in enumerate(res.stdout.split("\x1e")):
            if not rec.strip():
                continue
            parts = rec.split("\x1f")
            if len(parts) < 4:
                continue
            sha, src_tok, subj, body = parts[0].strip(), parts[1].strip().lower(), parts[2].strip(), parts[3]
            ref = oid_to_ref.get(src_tok, oid_to_ref[include_oids[0]])
            if (ref, sha) in seen_commit_per_branch:
                continue
            seen_commit_per_branch.add((ref, sha))

            is_revert, is_negative_revert = self._classify_revert_subject(subj)
            if is_revert:
                cancelled = cancelled_reverts_by_ref[ref]
                rev_targets = reverted_targets_by_ref[ref]
                sha_l = sha.lower()
                if (
                    sha_l[:12] not in cancelled
                    and sha_l not in cancelled
                    and sha_l[:12] not in rev_targets
                    and sha_l not in rev_targets
                ):
                    if is_negative_revert:
                        self._reverts_by_ref[ref].append((sha, subj, idx_pos))
                        for m_rev in self.REVERT_COMMIT_BODY_RE.finditer(body):
                            target_sha = m_rev.group(1).lower()
                            rev_targets.add(target_sha)
                            rev_targets.add(target_sha[:12])
                    else:
                        for m_rev in self.REVERT_COMMIT_BODY_RE.finditer(body):
                            target_sha = m_rev.group(1).lower()
                            cancelled.add(target_sha)
                            cancelled.add(target_sha[:12])
                else:
                    self._reverted_shas_by_ref[ref].add(sha_l)
                    self._reverted_shas_by_ref[ref].add(sha_l[:12])

            subj_for_pr = re.sub(r'"[^"]*"', " ", subj) if is_negative_revert else subj
            pr_num = self._extract_pr_from_subject(subj_for_pr)
            is_cp = bool(self.CHERRY_PICK_RE.search(f"{subj}\n{body}"))
            if pr_num:
                self.pr_to_commits[pr_num].append(
                    {
                        "sha": sha,
                        "subj": subj,
                        "ref": ref,
                        "is_trunk": is_trunk,
                        "is_canonical": is_trunk and not is_cp,
                        "is_cherry_pick": is_cp,
                    }
                )

            if is_negative_revert:
                body_cleaned = "\n".join(
                    ln
                    for ln in body.splitlines()
                    if not re.match(r"^\s*this\s+reverts\s+(?:commit|pr|pull\s+request)\b", ln, re.IGNORECASE)
                )
                combined = body_cleaned
            else:
                combined = f"{subj}\n{body}"
            linked_issues: set[tuple[str, int]] = set()
            for m in self.FIX_URL_ISSUE_RE.finditer(combined):
                if _match_is_negated(combined, m.start(), m.end()):
                    continue
                if SPECULATIVE_CLAUSE_RE.search(_full_clause_at(combined, m.start(), m.end())):
                    continue
                slug, num_str = m.group(1).lower(), m.group(2)
                inum = int(num_str)
                if inum > 0 and not (slug == self.repo_slug.lower() and inum == pr_num):
                    linked_issues.add((slug, inum))
            for m in self.FIX_QUALIFIED_ISSUE_RE.finditer(combined):
                if _match_is_negated(combined, m.start(), m.end()):
                    continue
                if SPECULATIVE_CLAUSE_RE.search(_full_clause_at(combined, m.start(), m.end())):
                    continue
                slug, num_str = m.group(1).lower(), m.group(2)
                inum = int(num_str)
                if inum > 0 and not (slug == self.repo_slug.lower() and inum == pr_num):
                    linked_issues.add((slug, inum))
            for m in self.FIX_LOCAL_ISSUE_RE.finditer(combined):
                if _match_is_negated(combined, m.start(), m.end()):
                    continue
                if SPECULATIVE_CLAUSE_RE.search(_full_clause_at(combined, m.start(), m.end())):
                    continue
                inum = int(m.group(1))
                if inum > 0 and inum != pr_num:
                    linked_issues.add((self.repo_slug.lower(), inum))

            for key_issue in linked_issues:
                raw_issue_hits[key_issue].append((pr_num, sha, subj, ref, is_negative_revert))

        for r_name, targets in reverted_targets_by_ref.items():
            self._reverted_shas_by_ref[r_name].update(targets)

    def _build_index(self) -> None:
        raw_issue_hits: dict[tuple[str, int], list[tuple[int, str, str, str, bool]]] = defaultdict(list)
        release_refs = [r for r in self.merged_refs if r not in self.trunk_refs]
        self._scan_git_log_batch(self.trunk_refs, [], True, raw_issue_hits)
        for rel in release_refs:
            self._scan_git_log_batch([rel], self.trunk_refs, False, raw_issue_hits)
        self._raw_issue_hits = raw_issue_hits

        eager_patch_check = len(self.pr_to_commits) <= 200
        for pr_num, cands in self.pr_to_commits.items():
            cands.sort(key=lambda c: (0 if c["is_canonical"] else (1 if not c["is_cherry_pick"] else 2)))
            for c in cands:
                sha_l = c["sha"].lower()
                rev_set = self._reverted_shas_by_ref.get(c["ref"], set())
                if sha_l in rev_set or sha_l[:12] in rev_set:
                    continue
                if eager_patch_check and self.is_commit_reverted(c["sha"], c["ref"]):
                    continue
                self.pr_to_commit[pr_num] = (c["sha"], c["subj"])
                break

        for issue_key, hits in raw_issue_hits.items():
            seen_sha: set[str] = set()
            seen_pr: set[int] = set()
            for pr_num, sha, subj, ref, _is_revert in hits:
                if pr_num > 0:
                    if pr_num in seen_pr:
                        continue
                    canon = self.pr_to_commit.get(pr_num)
                    if canon is None:
                        continue
                    use_sha, use_subj = canon
                    seen_pr.add(pr_num)
                else:
                    sha_l = sha.lower()
                    rev_set = self._reverted_shas_by_ref.get(ref, set())
                    if sha_l in rev_set or sha_l[:12] in rev_set:
                        continue
                    if eager_patch_check and self.is_commit_reverted(sha, ref):
                        continue
                    use_sha, use_subj = sha, subj
                if use_sha in seen_sha:
                    continue
                seen_sha.add(use_sha)
                self.issue_to_commits[issue_key].append((pr_num, use_sha, use_subj))

        log(
            f"Indexed local clone {self.repo_slug} (refs={self.merged_refs[:4]}): "
            f"{len(self.pr_to_commit)} PRs, {len(self.issue_to_commits)} directly linked issues"
        )

    def verify_commit_for_pr(self, sha: str, pr_num: int) -> tuple[bool, bool]:
        """Return (verified_belongs_to_pr_on_trusted_ref, contradicted_by_other_pr)."""
        if not self.available or not sha or pr_num <= 0:
            return False, False
        clean_sha = sha.strip()
        if not re.fullmatch(r"[0-9a-fA-F]{7,40}", clean_sha):
            return False, True
        try:
            res = subprocess.run(
                ["git", "-C", str(self.repo_path), "show", "-s", "--format=%H\x1f%s", clean_sha],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                check=False,
                timeout=15.0,
            )
        except (subprocess.TimeoutExpired, OSError) as exc:
            self.git_errors.append(f"git show {clean_sha} failed verifying PR #{pr_num}: {exc}")
            return False, False
        if res.returncode != 0:
            self.git_errors.append(
                f"git show {clean_sha} failed verifying PR #{pr_num} ({res.returncode}): {(res.stderr or '')[:160]}"
            )
            return False, False
        if "\x1f" not in (res.stdout or ""):
            return False, False
        full_sha, subj = res.stdout.strip().split("\x1f", 1)
        full_sha = full_sha.strip()
        subj_pr = self._extract_pr_from_subject(subj.strip())
        if subj_pr > 0 and subj_pr != pr_num:
            return False, True
        if subj_pr != pr_num:
            return False, False
        for oid in self.ref_oids.values():
            try:
                anc = subprocess.run(
                    ["git", "-C", str(self.repo_path), "merge-base", "--is-ancestor", full_sha, oid],
                    capture_output=True,
                    check=False,
                    timeout=15.0,
                )
            except (subprocess.TimeoutExpired, OSError) as exc:
                self.git_errors.append(f"git merge-base failed verifying {full_sha}: {exc}")
                return False, False
            if anc.returncode == 0:
                return True, False
            if anc.returncode != 1:
                self.git_errors.append(
                    f"git merge-base failed verifying {full_sha} ({anc.returncode})"
                )
                return False, False
        if self.ref_oids:
            return False, True
        return False, False

    def is_trusted_commit(self, sha: str) -> bool:
        """Verify sha exists on a verified merged remote ref and is not reverted."""
        if not self.available or not sha:
            return False
        clean_sha = sha.strip()
        if not re.fullmatch(r"[0-9a-fA-F]{7,40}", clean_sha):
            return False
        try:
            res = subprocess.run(
                ["git", "-C", str(self.repo_path), "rev-parse", "--verify", f"{clean_sha}^{{commit}}"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                check=False,
                timeout=15.0,
            )
        except (subprocess.TimeoutExpired, OSError) as exc:
            self.git_errors.append(f"git rev-parse {clean_sha} failed: {exc}")
            return False
        if res.returncode != 0:
            return False
        full_sha = (res.stdout or "").strip()
        if not re.fullmatch(r"[0-9a-fA-F]{40}", full_sha):
            return False
        for mref, oid in self.ref_oids.items():
            try:
                anc = subprocess.run(
                    ["git", "-C", str(self.repo_path), "merge-base", "--is-ancestor", full_sha, oid],
                    capture_output=True,
                    check=False,
                    timeout=15.0,
                )
            except (subprocess.TimeoutExpired, OSError) as exc:
                self.git_errors.append(f"git merge-base failed verifying {full_sha}: {exc}")
                return False
            if anc.returncode == 0:
                return not self.is_commit_reverted(full_sha, mref)
        return False

    def get_diff_for_sha_checked(
        self, sha: str, max_lines: int = 120, max_bytes: int = 2 * 1024 * 1024
    ) -> tuple[str, int, bool]:
        """Fetch commit diff and also report whether the git stream or line limit truncated the diff."""
        if not self.available or not sha:
            return "", 0, False
        clean_sha = sha.strip()
        if not re.fullmatch(r"[0-9a-fA-F]{7,40}", clean_sha):
            return "", 0, False
        ck = (clean_sha, max_lines, max_bytes)
        if ck in self._diff_cache:
            cached = self._diff_cache[ck]
            if len(cached) == 3:
                return cached[0], cached[1], bool(cached[2])
            cached_t, cached_l = cached
            was_t = bool(max_lines > 0 and cached_l >= max_lines)
            return cached_t, cached_l, was_t
        rc, raw_out, raw_err, truncated_stream = self._run_git_bounded(
            [
                "git",
                "-C",
                str(self.repo_path),
                "show",
                "--first-parent",
                "-m",
                clean_sha,
                "--unified=2",
                "--no-color",
                "--format=",
            ],
            max_bytes=max_bytes,
        )
        if not truncated_stream and rc != 0:
            self.git_errors.append(
                f"git show {clean_sha} failed on {self.repo_path}: {raw_err.decode('utf-8', 'replace')[:200]}"
            )
            return "", 0, False
        out_text = raw_out.decode("utf-8", "replace")
        if truncated_stream and "\n" in out_text:
            out_text = out_text.rsplit("\n", 1)[0]
        if not out_text.strip():
            res_empty = ("", 0, bool(truncated_stream))
            self._diff_cache[ck] = res_empty
            return res_empty
        eff_max = max_lines if max_lines > 0 else 10**9
        trimmed_text, trimmed_len, line_trunc = _trim_unified_diff_checked(out_text, max_lines=eff_max)
        was_trunc = bool(truncated_stream or (max_lines > 0 and line_trunc))
        res_full = (trimmed_text, trimmed_len, was_trunc)
        self._diff_cache[ck] = res_full
        return res_full

    def get_diff_for_sha(self, sha: str, max_lines: int = 120, max_bytes: int = 2 * 1024 * 1024) -> tuple[str, int]:
        dtext, dlen, _ = self.get_diff_for_sha_checked(sha, max_lines=max_lines, max_bytes=max_bytes)
        return dtext, dlen

    def resolve_pr_commit(self, pr_num: int) -> tuple[str, str] | None:
        if not self.available or pr_num <= 0:
            return None
        cands = self.pr_to_commits.get(pr_num)
        if not cands:
            return None
        for c in cands:
            if not self.is_commit_reverted(c["sha"], c["ref"]):
                hit = (c["sha"], c["subj"])
                self.pr_to_commit[pr_num] = hit
                self._reverted_pr_cache[pr_num] = False
                return hit
        self.pr_to_commit.pop(pr_num, None)
        self._reverted_pr_cache[pr_num] = True
        return None

    def is_pr_reverted(self, pr_num: int) -> bool:
        if not self.available or pr_num <= 0:
            return False
        if pr_num in self._reverted_pr_cache:
            return self._reverted_pr_cache[pr_num]
        if pr_num not in self.pr_to_commits:
            return False
        is_rev = self.resolve_pr_commit(pr_num) is None
        self._reverted_pr_cache[pr_num] = is_rev
        return is_rev

    def get_issue_commits(self, issue_num: int, issue_repo: str | None = None) -> list[tuple[int, str, str]]:
        if not self.available or issue_num <= 0:
            return []
        issue_key = ((issue_repo or self.repo_slug).lower(), issue_num)
        if issue_key in self._verified_issue_cache:
            return self._verified_issue_cache[issue_key]
        hits = self._raw_issue_hits.get(issue_key, [])
        verified: list[tuple[int, str, str]] = []
        seen_sha: set[str] = set()
        seen_pr: set[int] = set()
        for pr_num, sha, subj, ref, _is_revert in hits:
            if pr_num > 0:
                if pr_num in seen_pr:
                    continue
                if self.is_pr_reverted(pr_num):
                    continue
                canon = self.resolve_pr_commit(pr_num)
                if canon is not None:
                    use_sha, use_subj = canon
                else:
                    if self.is_commit_reverted(sha, ref):
                        continue
                    use_sha, use_subj = sha, subj
                seen_pr.add(pr_num)
            else:
                if self.is_commit_reverted(sha, ref):
                    continue
                use_sha, use_subj = sha, subj
            if use_sha in seen_sha:
                continue
            seen_sha.add(use_sha)
            verified.append((pr_num, use_sha, use_subj))
        self._verified_issue_cache[issue_key] = verified
        return verified


def _enforce_single_diff_owner(item: dict[str, Any], owner_ref: str | None) -> None:
    linked = item.get("linked_merged_prs")
    if not isinstance(linked, list):
        item.pop("pr_diff_source_ref", None)
        return
    if not owner_ref:
        item.pop("pr_diff_source_ref", None)
        for lp in linked:
            if isinstance(lp, dict):
                lp.pop("has_diff", None)
        return
    matched_once = False
    for lp in linked:
        if not isinstance(lp, dict):
            continue
        if str(lp.get("ref") or "").strip() == owner_ref and not matched_once:
            lp["has_diff"] = True
            matched_once = True
        else:
            lp.pop("has_diff", None)
    if matched_once:
        item["pr_diff_source_ref"] = owner_ref
        item.pop("pr_diff_source_unbound", None)
    else:
        item.pop("pr_diff_source_ref", None)


def _migrate_direct_commit_entries(item: dict[str, Any]) -> None:
    """Move any legacy repo@sha direct-commit entries out of linked_merged_prs into linked_direct_commits."""
    linked = item.get("linked_merged_prs")
    if not isinstance(linked, list):
        return
    kept_prs: list[dict[str, Any]] = []
    raw_direct = item.get("linked_direct_commits")
    direct: list[dict[str, Any]] = [
        dict(dc)
        for dc in (raw_direct if isinstance(raw_direct, list) else [])
        if _is_self_consistent_direct_commit(dc)
    ]
    seen_direct = {str(dc.get("ref") or "").strip() for dc in direct if str(dc.get("ref") or "").strip()}
    for lp in linked:
        if not isinstance(lp, dict):
            continue
        ref = str(lp.get("ref") or "").strip()
        if "@" in ref:
            if ref not in seen_direct:
                dc_entry = dict(lp)
                dc_entry.pop("has_diff", None)
                if _is_self_consistent_direct_commit(dc_entry):
                    seen_direct.add(ref)
                    direct.append(dc_entry)
        else:
            kept_prs.append(lp)
    item["linked_merged_prs"] = kept_prs
    if direct:
        item["linked_direct_commits"] = direct[:4]
    else:
        item.pop("linked_direct_commits", None)


_DIFF_GIT_RE = re.compile(r'^diff --git (?:"a/[^"]+"|a/\S+)\s+(?:"(b/[^"]+)"|(b/\S+))\s*$')
_HUNK_HDR_RE = re.compile(r"^@@\s[^@]*@@\s*(.*)$")


def _extract_file_hunk_seqs(lines: list[str]) -> dict[str, list[tuple[str, list[str]]]]:
    """Extract ordered (func_ctx, hunk_lines) hunks grouped by target file header, preserving context lines."""
    seqs: dict[str, list[tuple[str, list[str]]]] = {}
    cur_file = ""
    in_hunk = False
    cur_ctx = ""
    cur_hunk: list[str] = []

    def _flush_hunk() -> None:
        nonlocal cur_hunk, cur_ctx
        if cur_hunk and any(hl.startswith(("+", "-")) for hl in cur_hunk):
            seqs.setdefault(cur_file, []).append((cur_ctx, cur_hunk))
        cur_hunk = []
        cur_ctx = ""

    for ln in lines:
        if ln.startswith("diff --git "):
            _flush_hunk()
            in_hunk = False
            m_dg = _DIFF_GIT_RE.match(ln)
            if m_dg:
                cur_file = m_dg.group(1) or m_dg.group(2) or ""
            elif " b/" in ln:
                cur_file = "b/" + ln.split(" b/", 1)[1].strip().strip('"')
            else:
                cur_file = ""
        elif ln.startswith("+++ ") and not in_hunk and not cur_file:
            cand = ln[4:].strip().strip('"')
            if cand and cand != "/dev/null":
                cur_file = cand if cand.startswith("b/") else f"b/{cand.lstrip('a/')}"
        elif ln.startswith("--- ") and not in_hunk and not cur_file:
            cand = ln[4:].strip().strip('"')
            if cand and cand != "/dev/null":
                cur_file = f"b/{cand[2:]}" if cand.startswith("a/") else cand
        elif ln.startswith("@@ "):
            _flush_hunk()
            in_hunk = True
            m_hdr = _HUNK_HDR_RE.match(ln)
            cur_ctx = m_hdr.group(1).strip() if m_hdr else ""
        elif in_hunk and (ln.startswith(" ") or ln.startswith("+") or ln.startswith("-") or ln.startswith("\\ ")):
            cur_hunk.append(ln)
    _flush_hunk()
    return seqs


_CTX_HDR_LINE_RE = re.compile(
    r"^(?:(?:async\s+)?def\s+|(?:async\s+)?function\s+|class\s+|func\s+|fn\s+|struct\s+|enum\s+|trait\s+|impl\s+|namespace\s+)"
)
_CPP_ATTR_PREFIX = (
    r"(?:(?:\[\[[^\]]*\]\]|__attribute__\s*\(\([^)]*\)\)|__declspec\s*\([^)]*\)|"
    r"extern\s+\"C(?:\+\+)?\")\s*)*"
)
_CPP_FUNC_DEF_RE = re.compile(
    rf"^{_CPP_ATTR_PREFIX}(?:template\s*<[^>]*>\s*{_CPP_ATTR_PREFIX})?"
    r"(?!if\b|for\b|while\b|switch\b|catch\b|else\b|return\b|case\b|sizeof\b|alignof\b|decltype\b|typeof\b)"
    r"(?:(?:[A-Za-z_~][\w:~<>.*&\s\[\]]*?\s+[*&]*)|[A-Za-z_~][\w~]*::)"
    r"(?:operator\s*[^\s(]+|[A-Za-z_~]\w*)\s*"
    r"\([^;{}]*\)\s*"
    r"(?:const|volatile|noexcept(?:\([^)]*\))?|override|final|mutable|&{1,2}|->\s*[^;{]+|\s)*"
    r"\{?\s*$"
)


def _is_ctx_boundary_line(line: str) -> bool:
    s = re.sub(r"\s+", " ", line.strip())
    if not s or s.endswith(";"):
        return False
    return bool(_CTX_HDR_LINE_RE.match(s) or _CPP_FUNC_DEF_RE.match(s))


def _coalesce_preceding_for_boundaries(preceding: list[str]) -> list[str]:
    out: list[str] = []
    buf: list[str] = []
    for s in preceding:
        if not s:
            if buf:
                out.append(re.sub(r"\s+", " ", " ".join(buf)))
                buf.clear()
            continue
        if s.startswith(("#", "//", "/*")) or s.endswith(";"):
            if buf:
                out.append(re.sub(r"\s+", " ", " ".join(buf)))
                buf.clear()
            out.append(s)
            continue
        buf.append(s)
        joined = re.sub(r"\s+", " ", " ".join(buf))
        if _CTX_HDR_LINE_RE.match(joined) or _CPP_FUNC_DEF_RE.match(joined):
            out.append(joined)
            buf.clear()
        elif "{" in s or "}" in s or len(buf) >= 6:
            out.append(joined)
            buf.clear()
    if buf:
        out.append(re.sub(r"\s+", " ", " ".join(buf)))
    return out


def _hunk_matches(
    needle_hunk: tuple[str, list[str]],
    cand_hunk: tuple[str, list[str]],
) -> bool:
    n_ctx, n_lines = needle_hunk
    c_ctx, c_lines = cand_hunk
    if not n_lines or len(n_lines) > len(c_lines):
        return False
    norm_n_ctx = re.sub(r"\s+", " ", n_ctx.strip())
    norm_c_ctx = re.sub(r"\s+", " ", c_ctx.strip())
    for i in range(len(c_lines) - len(n_lines) + 1):
        if c_lines[i : i + len(n_lines)] != n_lines:
            continue
        # Preserve EOF-newline distinction: a stored line ending with LF must not match an EOF no-newline line
        if (
            not n_lines[-1].startswith("\\ ")
            and i + len(n_lines) < len(c_lines)
            and c_lines[i + len(n_lines)].startswith("\\ ")
        ):
            continue
        if not norm_n_ctx:
            return True
        preceding = [re.sub(r"\s+", " ", ln[1:].strip()) for ln in c_lines[:i] if ln[:1] in (" ", "+", "-")]
        if norm_n_ctx in preceding:
            last_pos = len(preceding) - 1 - preceding[::-1].index(norm_n_ctx)
            if not any(_is_ctx_boundary_line(s) for s in _coalesce_preceding_for_boundaries(preceding[last_pos + 1 :])):
                return True
        elif norm_c_ctx == norm_n_ctx:
            if not any(_is_ctx_boundary_line(s) for s in _coalesce_preceding_for_boundaries(preceding)):
                return True
    return False


def _file_hunks_match_in_order(
    needle_hunks: list[tuple[str, list[str]]],
    hay_hunks: list[tuple[str, list[str]]],
) -> bool:
    pos = 0
    for nh in needle_hunks:
        matched = False
        while pos < len(hay_hunks):
            ch = hay_hunks[pos]
            pos += 1
            if _hunk_matches(nh, ch):
                matched = True
                break
        if not matched:
            return False
    return True


def _match_ordered_diff(
    snip_seqs: dict[str, list[tuple[str, list[str]]]],
    dtext: str,
) -> bool:
    """Return True iff every file's hunks match distinct candidate hunks in order with context intact."""
    if not snip_seqs:
        return False
    d_seqs = _extract_file_hunk_seqs(dtext.split("\n"))
    for fkey, needle_hunks in snip_seqs.items():
        if not needle_hunks:
            continue
        if fkey:
            hay_hunks = d_seqs.get(fkey)
            if not hay_hunks or not _file_hunks_match_in_order(needle_hunks, hay_hunks):
                return False
        else:
            if not any(_file_hunks_match_in_order(needle_hunks, hay_hunks) for hay_hunks in d_seqs.values()):
                return False
    return True


_GITCODE_MR_REF_RE = re.compile(r"^gitcode:([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)!([0-9]{1,9})$")


def _is_valid_gitcode_linked_pr(lp: Any) -> bool:
    if not isinstance(lp, dict):
        return False
    ref = lp.get("ref")
    if not isinstance(ref, str):
        return False
    m_ref = _GITCODE_MR_REF_RE.fullmatch(ref.strip())
    if not m_ref:
        return False
    ref_repo, ref_num_s = m_ref.group(1), m_ref.group(2)
    ref_num = int(ref_num_s)
    if parse_strict_positive_int(lp.get("number")) != ref_num:
        return False
    url = lp.get("url")
    if not isinstance(url, str) or not url.strip():
        return False
    return (
        validate_repo_item_url(url, "gitcode.com", ref_repo, "merge_requests", ref_num) is not None
        or validate_repo_item_url(url, "gitcode.com", ref_repo, "pull", ref_num) is not None
    )


_GITHUB_PR_REF_RE = re.compile(r"^([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)#([0-9]{1,9})$")


def _is_valid_github_linked_pr(lp: Any) -> bool:
    if not isinstance(lp, dict):
        return False
    ref = lp.get("ref")
    if not isinstance(ref, str):
        return False
    m_ref = _GITHUB_PR_REF_RE.fullmatch(ref.strip())
    if not m_ref:
        return False
    ref_repo, ref_num_s = m_ref.group(1), m_ref.group(2)
    ref_num = int(ref_num_s)
    lp_num_raw = lp.get("number")
    if lp_num_raw is not None and parse_strict_positive_int(lp_num_raw) != ref_num:
        return False
    url = lp.get("url")
    if url is not None and str(url).strip():
        if validate_repo_item_url(url, "github.com", ref_repo, "pull", ref_num) is None:
            return False
    return True


_VALID_SHA_HEX_RE = re.compile(r"^[0-9a-fA-F]{7,40}$")


def _get_local_index(
    local_indexes: dict[str, LocalGitIndex] | None, repo: str
) -> LocalGitIndex | None:
    if not local_indexes or not repo:
        return None
    direct = local_indexes.get(repo)
    if direct is not None:
        return direct
    repo_l = repo.strip().lower()
    for k, v in local_indexes.items():
        if str(k).strip().lower() == repo_l:
            return v
    return None


def _set_unbound_diff_fields(item: dict[str, Any], snippet: str, line_count: int) -> None:
    """Keep unattributed patches out of prompt-facing pr_diff_snippet while preserving auditability."""
    item["pr_diff_snippet"] = ""
    item["pr_diff_lines"] = 0
    item["unbound_pr_diff_snippet"] = snippet
    item["unbound_pr_diff_lines"] = line_count
    item["pr_diff_source_unbound"] = True


def _clear_unbound_diff_fields(item: dict[str, Any]) -> None:
    item.pop("unbound_pr_diff_snippet", None)
    item.pop("unbound_pr_diff_lines", None)
    item.pop("pr_diff_source_unbound", None)


def rebind_diff_provenance(
    item: dict[str, Any],
    local_indexes: dict[str, LocalGitIndex],
) -> tuple[dict[str, Any], str]:
    """Deterministically bind pr_diff_source_ref and linked_merged_prs[*].has_diff without altering text/raw_sha256."""
    _migrate_direct_commit_entries(item)
    raw_bound_snip = str(item.get("pr_diff_snippet") or "")
    raw_unbound_snip = str(item.get("unbound_pr_diff_snippet") or "")
    snippet = raw_bound_snip or raw_unbound_snip
    preserved_archived = ""
    preserved_archived_lines = 0
    if raw_bound_snip.strip() and raw_unbound_snip.strip() and raw_unbound_snip != raw_bound_snip:
        u_lines = raw_unbound_snip.split("\n")
        if _section_has_diff_hunk(u_lines):
            u_seqs = _extract_file_hunk_seqs(u_lines)
            if not u_seqs or not _match_ordered_diff(u_seqs, raw_bound_snip):
                preserved_archived = raw_unbound_snip
                preserved_archived_lines = (
                    parse_strict_nonneg_int(item.get("unbound_pr_diff_lines"), 0) or len(u_lines)
                )
    linked = item.get("linked_merged_prs") or []
    if item.get("ecosystem") == "gitcode" and isinstance(linked, list):
        linked = [lp for lp in linked if _is_valid_gitcode_linked_pr(lp)]
        item["linked_merged_prs"] = linked
    elif item.get("ecosystem") == "github" and isinstance(linked, list):
        linked = [lp for lp in linked if _is_valid_github_linked_pr(lp)]
        if local_indexes:
            filtered_gh: list[dict[str, Any]] = []
            for lp in linked:
                l_ref = str(lp.get("ref") or "").strip()
                l_sha = str(lp.get("commit_sha") or "").strip()
                if "#" in l_ref:
                    l_repo, l_pr_s = l_ref.rsplit("#", 1)
                    l_pr_num = (
                        parse_strict_positive_int(lp.get("number"))
                        or parse_strict_positive_int(l_pr_s)
                    )
                    l_idx = _get_local_index(local_indexes, l_repo)
                    if l_idx and l_idx.available:
                        if l_pr_num and l_idx.is_pr_reverted(l_pr_num):
                            continue
                        if (
                            re.fullmatch(r"[0-9a-f]{7,40}", l_sha.lower())
                            and (not l_pr_num or l_idx.resolve_pr_commit(l_pr_num) is None)
                            and any(
                                l_idx.is_commit_reverted(l_sha, mref) for mref in l_idx.merged_refs
                            )
                        ):
                            continue
                filtered_gh.append(lp)
            linked = filtered_gh
        item["linked_merged_prs"] = linked

    if not snippet.strip() or not _section_has_diff_hunk(snippet.split("\n")):
        if preserved_archived and _section_has_diff_hunk(preserved_archived.split("\n")):
            snippet = preserved_archived
            preserved_archived = ""
            preserved_archived_lines = 0
        else:
            status = "no_diff" if not snippet.strip() else "empty_header_only_cleared"
            item["pr_diff_snippet"] = ""
            item["pr_diff_lines"] = 0
            _enforce_single_diff_owner(item, None)
            _clear_unbound_diff_fields(item)
            return item, status

    lines = snippet.split("\n")
    existing_ref = str(item.get("pr_diff_source_ref") or "").strip()
    if "@" in existing_ref:
        existing_ref = ""
    valid_refs_lower = {
        str(lp.get("ref") or "").strip().lower(): str(lp.get("ref") or "").strip()
        for lp in linked
        if isinstance(lp, dict) and lp.get("ref")
    }
    valid_refs = set(valid_refs_lower.values())

    def _restore_archived_unbound() -> None:
        if preserved_archived:
            item["unbound_pr_diff_snippet"] = preserved_archived
            item["unbound_pr_diff_lines"] = preserved_archived_lines

    def _mark_snippet_unbound(status: str) -> tuple[dict[str, Any], str]:
        _enforce_single_diff_owner(item, None)
        combined = snippet
        combined_lines = len(lines)
        if preserved_archived and preserved_archived.strip():
            arch_seqs = _extract_file_hunk_seqs(preserved_archived.split("\n"))
            if not arch_seqs or not _match_ordered_diff(arch_seqs, snippet):
                combined = f"{snippet.rstrip(chr(10))}\n{preserved_archived}"
                combined_lines = len(combined.split("\n"))
        _set_unbound_diff_fields(item, combined, combined_lines)
        return item, status

    if item.get("ecosystem") == "github":
        matched_entries: list[str] = []
        hunk_matched_entries: list[str] = []
        matched_sha_by_ref: dict[str, str] = {}
        verified_contradicted: set[str] = set()
        reverted_refs: set[str] = set()
        uncheckable_candidates: set[str] = set()
        snip_seqs = _extract_file_hunk_seqs(lines)
        full_scan_lines = max(50000, len(lines) * 20)
        full_scan_bytes = max(8 * 1024 * 1024, len(snippet.encode("utf-8")) * 16)
        for lp in linked:
            if not isinstance(lp, dict):
                continue
            ref = str(lp.get("ref") or "").strip()
            if not ref or "#" not in ref:
                continue
            ref_repo, pr_s = ref.rsplit("#", 1)
            ref_idx = _get_local_index(local_indexes, ref_repo)
            if not ref_idx or not ref_idx.available:
                uncheckable_candidates.add(ref)
                continue
            err_before = len(ref_idx.git_errors)
            pr_num = parse_strict_positive_int(pr_s)
            if pr_num is None:
                verified_contradicted.add(ref)
                continue
            lp_num_raw = lp.get("number")
            if lp_num_raw is not None and parse_strict_positive_int(lp_num_raw) != pr_num:
                verified_contradicted.add(ref)
                continue
            if ref_idx.is_pr_reverted(pr_num):
                reverted_refs.add(ref)
                continue
            sha = str(lp.get("commit_sha") or "").strip()
            hit = ref_idx.resolve_pr_commit(pr_num)
            ref_matched = False
            ref_hunk_matched = False
            ref_was_trunc = False
            ref_git_err = False
            matched_cand_sha = ""
            matched_cand_exact = False

            def _eval_cand_sha(cand_sha: str) -> None:
                nonlocal ref_matched, ref_hunk_matched, ref_was_trunc, ref_git_err, matched_cand_sha, matched_cand_exact
                dtext_full, _, was_trunc = ref_idx.get_diff_for_sha_checked(
                    cand_sha, max_lines=full_scan_lines, max_bytes=full_scan_bytes
                )
                if len(ref_idx.git_errors) > err_before:
                    ref_git_err = True
                    return
                if was_trunc:
                    ref_was_trunc = True
                    return
                if not dtext_full:
                    return
                trimmed_120, _ = trim_unified_diff(dtext_full, max_lines=max(120, len(lines)))
                if dtext_full == snippet or (
                    trimmed_120 == snippet and (not snip_seqs or _match_ordered_diff(snip_seqs, dtext_full))
                ):
                    ref_matched = True
                    matched_cand_sha = cand_sha
                    matched_cand_exact = True
                    return
                if snip_seqs and _match_ordered_diff(snip_seqs, dtext_full):
                    ref_hunk_matched = True
                    if not matched_cand_exact:
                        matched_cand_sha = cand_sha

            if hit:
                _eval_cand_sha(hit[0])
                if (
                    not ref_git_err
                    and not ref_matched
                    and sha
                    and (
                        not _VALID_SHA_HEX_RE.fullmatch(sha)
                        or not (hit[0].lower().startswith(sha.lower()) or sha.lower().startswith(hit[0].lower()))
                    )
                ):
                    if ref_idx.is_trusted_commit(sha):
                        v_pr, c_pr = ref_idx.verify_commit_for_pr(sha, pr_num)
                        if len(ref_idx.git_errors) > err_before:
                            ref_git_err = True
                        elif v_pr and not c_pr:
                            _eval_cand_sha(sha)
                    elif len(ref_idx.git_errors) > err_before:
                        ref_git_err = True
            elif sha:
                verified_pr, contradicted_pr = ref_idx.verify_commit_for_pr(sha, pr_num)
                if len(ref_idx.git_errors) > err_before:
                    uncheckable_candidates.add(ref)
                    verified_contradicted.add(ref)
                    continue
                if contradicted_pr or not verified_pr or any(
                    ref_idx.is_commit_reverted(sha, mref) for mref in ref_idx.merged_refs
                ):
                    verified_contradicted.add(ref)
                    continue
                _eval_cand_sha(sha)
            else:
                uncheckable_candidates.add(ref)
                continue

            if ref_git_err:
                uncheckable_candidates.add(ref)
                verified_contradicted.add(ref)
            elif ref_matched:
                matched_entries.append(ref)
                if matched_cand_sha:
                    matched_sha_by_ref[ref] = matched_cand_sha
            elif ref_hunk_matched:
                hunk_matched_entries.append(ref)
                if matched_cand_sha:
                    matched_sha_by_ref[ref] = matched_cand_sha
            elif ref_was_trunc:
                uncheckable_candidates.add(ref)
            else:
                verified_contradicted.add(ref)

        distinct_refs = list(dict.fromkeys(matched_entries + hunk_matched_entries))
        if len(distinct_refs) == 1:
            winner = distinct_refs[0]
            if any(u != winner for u in uncheckable_candidates):
                return _mark_snippet_unbound("unbound_github_unverified_candidates")
            win_sha = matched_sha_by_ref.get(winner, "")
            if win_sha:
                for lp in linked:
                    if isinstance(lp, dict) and str(lp.get("ref") or "").strip() == winner:
                        cur_sha = str(lp.get("commit_sha") or "").strip()
                        if (
                            not _VALID_SHA_HEX_RE.fullmatch(cur_sha)
                            or not (
                                win_sha.lower().startswith(cur_sha.lower())
                                or cur_sha.lower().startswith(win_sha.lower())
                            )
                        ):
                            lp["commit_sha"] = win_sha[:12]
            item["pr_diff_snippet"] = snippet
            item["pr_diff_lines"] = len(lines)
            _clear_unbound_diff_fields(item)
            _restore_archived_unbound()
            _enforce_single_diff_owner(item, winner)
            return item, "matched_local_git_unique"
        if len(distinct_refs) > 1:
            return _mark_snippet_unbound("unbound_github_ambiguous_multi_pr")
        existing_canon = valid_refs_lower.get(existing_ref.lower(), "") if existing_ref else ""
        reverted_lower = {r.lower() for r in reverted_refs}
        contradicted_lower = {r.lower() for r in verified_contradicted}
        if (
            existing_canon
            and existing_canon.lower() not in reverted_lower
            and existing_canon.lower() not in contradicted_lower
        ):
            item["pr_diff_snippet"] = snippet
            item["pr_diff_lines"] = len(lines)
            _clear_unbound_diff_fields(item)
            _restore_archived_unbound()
            _enforce_single_diff_owner(item, existing_canon)
            return item, "kept_existing_valid_ref"
        return _mark_snippet_unbound("unbound_github")

    # GitCode ecosystem: only keep recorded provenance with validated MR identity
    existing_canon_gc = valid_refs_lower.get(existing_ref.lower(), "") if existing_ref else ""
    if existing_canon_gc:
        item["pr_diff_snippet"] = snippet
        item["pr_diff_lines"] = len(lines)
        _clear_unbound_diff_fields(item)
        _restore_archived_unbound()
        _enforce_single_diff_owner(item, existing_canon_gc)
        return item, "kept_existing_valid_ref"
    return _mark_snippet_unbound("unbound_gitcode_multi_mr" if len(valid_refs) > 1 else "unbound_gitcode")


ALLOWED_GITHUB_REPOS = frozenset({"vllm-project/vllm-ascend", "vllm-project/vllm"})
_CACHED_COMMENT_HEADER_RE = re.compile(r"^\[([^\[\]]+(?:\[bot\])?)\]:\s*(.*)$")
_LOG_HEADER_TAGS = frozenset(
    {
        "info", "warn", "warning", "error", "err", "debug", "trace", "fatal",
        "critical", "stdout", "stderr", "log", "hccl", "runtime", "acl", "torch_npu", "worker", "server",
        "distributed", "nccl", "c10d", "gloo", "ddp", "fsdp", "deepspeed", "megatron",
        "mindspore", "aclrt", "tbe", "traceback", "exception", "setup", "teardown",
        "init", "cleanup", "launcher", "scheduler", "coordinator", "controller",
        "monitor", "watchdog", "profiler", "executor", "allocator", "dispatcher",
        "backend", "frontend", "ray", "cuda", "triton", "cann", "ascend", "npu",
        "vllm", "torch", "system", "output", "note", "hint", "crash", "summary", "status",
    }
)
_UPPER_LOG_HEADER_TAGS = frozenset(
    {
        "NOTE", "HINT", "OUTPUT", "ASCEND", "NPU", "CANN", "VLLM", "TORCH", "SYSTEM",
        "SCHEDULER", "ENGINE", "EXECUTOR", "WORKER", "ALLOCATOR", "DISPATCHER",
        "CONTROLLER", "COORDINATOR", "MONITOR", "WATCHDOG", "PROFILER",
        "BACKEND", "FRONTEND", "RAY", "NCCL", "CUDA", "TRITON",
    }
)
_LOG_PREFIX_RE = re.compile(
    r"^(?:"
    r"(?:rank|worker|npu|gpu|cpu|device|dev|node|host|pid|tid|proc|thread|"
    r"step|epoch|stage|card|chip|core|die|port|stream|task|job|slot|"
    r"worker_rank|local_rank|world_size|master|slave|server|client|"
    r"engine|scheduler|runner|dist|ddp|tp|pp|dp|ep|cp|sp|id)"
    r"(?:[\s_:=#-]*\d+(?:[\s/:,-]+\d+|\s+(?:of|/)\s*\d+)*|\s*\[[^\]]*\])"
    r"|\d+(?:[\s/:.-]+\d+)*"
    r")$",
    re.IGNORECASE,
)
_LOG_MODULE_TAG_RE = re.compile(
    r"^(?:torch|torch_npu|vllm|vllm_ascend|mindspore|hccl|cann|acl|aclrt|"
    r"dist|c10d|nccl|triton|cuda|npu|ray|deepspeed|megatron|runtime|"
    r"engine|worker|executor|scheduler)(?:[./:_][a-z0-9_-]+)+$",
    re.IGNORECASE,
)


def _is_log_header_tag(tag: str) -> bool:
    t = (tag or "").strip()
    if not t:
        return True
    if any(ch.isspace() for ch in t) or any(ch in t for ch in ("=", ",", ":", "/", "\\")):
        return True
    if t.lower() in _LOG_HEADER_TAGS or t in _UPPER_LOG_HEADER_TAGS:
        return True
    if _LOG_PREFIX_RE.match(t) or _LOG_MODULE_TAG_RE.match(t):
        return True
    return False


def _is_always_bot_login(login: str) -> bool:
    low = (login or "").strip().lower()
    if not low or low in {"deleted-user", "deleted", "ghost"}:
        return True
    if low in BOT_USERS:
        return True
    return low.endswith("[bot]")


def _validate_cached_human_resolution(comments_text: str) -> bool:
    """Re-verify cached [author]: body comments enforcing non-bot authorship and substantive resolution length."""
    if not (comments_text or "").strip():
        return False
    entries: list[tuple[str, str]] = []
    cur_author = ""
    cur_lines: list[str] = []
    for raw_ln in comments_text.split("\n"):
        m = _CACHED_COMMENT_HEADER_RE.match(raw_ln)
        hdr_tag = m.group(1).strip() if m else ""
        is_at_author = bool(
            hdr_tag.startswith("@")
            and len(hdr_tag) > 1
            and not _is_always_bot_login(hdr_tag[1:])
        )
        is_plain_author = bool(
            hdr_tag
            and not hdr_tag.startswith("@")
            and not _is_log_header_tag(hdr_tag)
        )
        if m and (is_at_author or is_plain_author):
            if cur_author and cur_lines:
                entries.append((cur_author, "\n".join(cur_lines)))
            cur_author = hdr_tag
            cur_lines = [m.group(2)]
        elif cur_author:
            cur_lines.append(raw_ln)
    if cur_author and cur_lines:
        entries.append((cur_author, "\n".join(cur_lines)))
    if not entries:
        return False
    resolution_hint_chars = 0
    for hdr, body_part in entries:
        if hdr.startswith("@"):
            if _is_always_bot_login(hdr[1:]):
                continue
        elif is_bot_login(hdr):
            continue
        clean = re.sub(r"\s+", " ", body_part).strip()
        if _has_affirmative_resolution_hint(clean):
            if len(clean) >= 55:
                return True
            if len(clean) >= 25:
                resolution_hint_chars += len(clean)
    return resolution_hint_chars >= 80


class GitHubMiner:
    def __init__(
        self,
        token: str,
        local_indexes: dict[str, LocalGitIndex],
        wait_for_core_reset: bool = True,
        max_core_wait_sec: int = 1000,
        allowed_repos: set[str] | frozenset[str] | None = None,
    ) -> None:
        self.token = token.strip()
        self.local_indexes = local_indexes
        self.wait_for_core_reset = wait_for_core_reset
        self.max_core_wait_sec = max_core_wait_sec
        self.allowed_repos = {r.lower() for r in (allowed_repos or ALLOWED_GITHUB_REPOS)}
        self.core_remaining = 60
        self.core_reset = 0
        self.search_remaining = 10
        self.search_reset = 0
        self.notes: list[str] = []
        self.search_requests = 0
        self.search_failures = 0
        self.rest_failures = 0
        self.comment_failures = 0
        self.fallback_failures = 0

    def _headers(self, accept: str = "application/vnd.github+json") -> dict[str, str]:
        hdrs = {
            "Accept": accept,
            "User-Agent": "infer-lab-dual-miner/2.0",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self.token:
            hdrs["Authorization"] = f"Bearer {self.token}"
        return hdrs

    def refresh_rate_limits(self) -> None:
        data, st, _ = http_get_json("https://api.github.com/rate_limit", self._headers())
        if st == 200:
            if not isinstance(data, dict):
                self.rest_failures += 1
                return
            res = data.get("resources")
            if not isinstance(res, dict):
                self.rest_failures += 1
                return
            core = res.get("core")
            srch = res.get("search")
            if not isinstance(core, dict) or not isinstance(srch, dict):
                self.rest_failures += 1
                return
            self.core_remaining = parse_strict_nonneg_int(core.get("remaining"), self.core_remaining)
            self.core_reset = parse_strict_nonneg_int(core.get("reset"), 0)
            self.search_remaining = parse_strict_nonneg_int(srch.get("remaining"), self.search_remaining)
            self.search_reset = parse_strict_nonneg_int(srch.get("reset"), 0)
            log(
                f"GitHub rate limits: core={self.core_remaining} (reset in "
                f"{max(0, self.core_reset - int(time.time()))}s), "
                f"search={self.search_remaining} (reset in "
                f"{max(0, self.search_reset - int(time.time()))}s)"
            )

    def _gh_core_get(self, url: str) -> tuple[Any | None, int]:
        validate_github_api_url(url)
        if self.core_remaining <= 1:
            wait = self.core_reset - int(time.time()) + 3
            if wait > 0 and self.wait_for_core_reset and wait <= self.max_core_wait_sec:
                log(f"GitHub core quota exhausted; waiting {wait}s for rate-limit reset...")
                time.sleep(wait)
                self.refresh_rate_limits()
            elif wait <= 0:
                self.refresh_rate_limits()
        if self.core_remaining <= 0:
            return None, 403
        data, st, hdrs = http_get_json(url, self._headers())
        if "x-ratelimit-remaining" in hdrs:
            self.core_remaining = parse_strict_nonneg_int(hdrs["x-ratelimit-remaining"], self.core_remaining)
        if "x-ratelimit-reset" in hdrs:
            self.core_reset = parse_strict_nonneg_int(hdrs["x-ratelimit-reset"], self.core_reset)
        return data, st

    def _gh_search_get(self, url: str) -> tuple[Any | None, int]:
        validate_github_api_url(url)
        if self.search_remaining <= 1:
            wait = max(3, self.search_reset - int(time.time()) + 2)
            if wait <= 75:
                log(f"GitHub search bucket cooling down {wait}s...")
                time.sleep(wait)
        data, st, hdrs = http_get_json(url, self._headers())
        if "x-ratelimit-remaining" in hdrs:
            self.search_remaining = parse_strict_nonneg_int(hdrs["x-ratelimit-remaining"], self.search_remaining)
        if "x-ratelimit-reset" in hdrs:
            self.search_reset = parse_strict_nonneg_int(hdrs["x-ratelimit-reset"], self.search_reset)
        if st == 403:
            wait = max(5, min(68, self.search_reset - int(time.time()) + 2))
            log(f"GitHub search 403; sleeping {wait}s and retrying once...")
            time.sleep(wait)
            data, st, hdrs = http_get_json(url, self._headers())
            if "x-ratelimit-remaining" in hdrs:
                self.search_remaining = parse_strict_nonneg_int(hdrs["x-ratelimit-remaining"], self.search_remaining)
            if "x-ratelimit-reset" in hdrs:
                self.search_reset = parse_strict_nonneg_int(hdrs["x-ratelimit-reset"], self.search_reset)
        return data, st

    def _extract_candidate_prs(self, repo: str, issue_num: int, text: str) -> list[str]:
        return extract_github_pr_refs(repo, issue_num, text)

    @staticmethod
    def _is_valid_gh_issue_payload(
        it: Any, *, repo: str, expected_num: int | None = None
    ) -> bool:
        if not isinstance(it, dict) or "pull_request" in it:
            return False
        num = parse_strict_positive_int(it.get("number"))
        if num is None or (expected_num is not None and num != expected_num):
            return False
        state = it.get("state")
        if not isinstance(state, str) or state.strip().lower() not in ("open", "closed"):
            return False
        if not isinstance(it.get("title"), str):
            return False
        if "body" not in it or (it["body"] is not None and not isinstance(it["body"], str)):
            return False
        if parse_strict_nonneg_int(it.get("comments"), -1) < 0:
            return False
        raw_labels = it.get("labels")
        if raw_labels is not None and not isinstance(raw_labels, list):
            return False
        raw_html_url = it.get("html_url")
        if raw_html_url:
            if validate_repo_item_url(raw_html_url, "github.com", repo, "issues", num) is None:
                return False
        return True

    def _record_raw_issue(
        self,
        pool: dict[str, dict[str, Any]],
        repo: str,
        it: dict[str, Any],
    ) -> bool:
        if not isinstance(it, dict) or "pull_request" in it:
            return False
        num = parse_strict_positive_int(it.get("number"))
        if num is None:
            return False
        key = f"{repo}#{num}"
        if not self._is_valid_gh_issue_payload(it, repo=repo, expected_num=num):
            log(f"Ignoring incomplete/malformed GitHub issue payload for {key}")
            return False
        if str(it["state"]).strip().lower() != "closed":
            pool.pop(key, None)
            return True
        raw_html_url = it.get("html_url")
        canonical_url = f"https://github.com/{repo}/issues/{num}"
        if raw_html_url:
            validated = validate_repo_item_url(raw_html_url, "github.com", repo, "issues", num)
            if validated is None:
                log(
                    f"Quarantining mismatched/invalid GitHub issue url={_redact_url_for_log(str(raw_html_url))!r} vs {repo}#{num}"
                )
                return False
            canonical_url = validated
        title = str(it.get("title") or "").strip()
        body = str(it.get("body") or "").strip()
        labels = [str(l.get("name") or "") for l in (it.get("labels") or []) if isinstance(l, dict)]
        fresh_comments_count = parse_strict_nonneg_int(it.get("comments"), 0)
        fresh_body = body[:7500]
        fresh_body_truncated = len(body) > 7500
        canonical_comments_url = f"https://api.github.com/repos/{repo}/issues/{num}/comments"

        if key in pool:
            existing = pool[key]
            if not existing.get("_from_cache"):
                return True
            old_comments_count = parse_strict_nonneg_int(existing.get("comments_count"), 0)
            old_title = str(existing.get("title") or "")
            old_body = str(existing.get("body") or "")
            existing["title"] = title if "title" in it else existing["title"]
            existing["body"] = fresh_body if "body" in it else existing["body"]
            existing["_raw_full_body"] = body if "body" in it else existing.get("_raw_full_body", existing["body"])
            existing["body_truncated"] = fresh_body_truncated
            existing["labels"] = labels
            existing["state"] = "closed"
            existing["created_at"] = it.get("created_at") or existing.get("created_at")
            existing["closed_at"] = it.get("closed_at") or existing.get("closed_at")
            existing["url"] = canonical_url
            existing["comments_url"] = canonical_comments_url
            existing["comments_count"] = fresh_comments_count
            if is_non_bug_issue(existing["title"], existing["labels"]):
                pool.pop(key, None)
                return True
            metadata_changed = (
                fresh_comments_count != old_comments_count
                or existing["title"] != old_title
                or existing["body"] != old_body
                or (
                    it.get("updated_at") is not None
                    and it.get("updated_at") != existing.get("updated_at")
                )
            )
            if fresh_comments_count == 0:
                existing["comments_text"] = ""
                existing["_raw_comments_full"] = ""
                existing["has_human_resolution_comment"] = False
                existing["comments_complete"] = not fresh_body_truncated
                existing["_needs_comment_refresh"] = False
            else:
                if metadata_changed or not existing.get("comments_text"):
                    existing["comments_text"] = ""
                    existing["_raw_comments_full"] = ""
                    existing["has_human_resolution_comment"] = False
                    existing["comments_complete"] = False
                    existing["_needs_comment_refresh"] = True
                elif not existing.get("comments_complete") or fresh_body_truncated:
                    existing["comments_complete"] = False
                    existing["_needs_comment_refresh"] = True
            if it.get("updated_at") is not None:
                existing["updated_at"] = it.get("updated_at")
            existing["_metadata_unchanged"] = not metadata_changed
            existing["_from_cache"] = False
            existing["_fresh_metadata"] = True
            return True

        if is_non_bug_issue(title, labels):
            return False
        if len(fresh_body) < 140:
            return False
        if not (ERROR_CODE_RE.search(fresh_body) or PLOG_OR_TRACE_RE.search(fresh_body)):
            return False
        if not has_concrete_verifiable_log_line(title, fresh_body, ""):
            return False
        pool[key] = {
            "key": key,
            "ecosystem": "github",
            "repo": repo,
            "number": num,
            "url": canonical_url,
            "title": title,
            "state": "closed",
            "created_at": it.get("created_at"),
            "updated_at": it.get("updated_at"),
            "closed_at": it.get("closed_at"),
            "labels": labels,
            "comments_count": fresh_comments_count,
            "comments_url": canonical_comments_url,
            "body": fresh_body,
            "_raw_full_body": body,
            "body_truncated": fresh_body_truncated,
            "comments_text": "",
            "_raw_comments_full": "",
            "comments_complete": fresh_comments_count == 0 and not fresh_body_truncated,
            "has_human_resolution_comment": False,
            "_fresh_metadata": True,
        }
        return True

    def _attach_local_prs(self, item: dict[str, Any]) -> None:
        repo = item["repo"]
        num = int(item["number"])
        raw_body = str(item.get("_raw_full_body") or item["body"])
        raw_comments = str(item.get("_raw_comments_full") or item["comments_text"])
        full_text = f"{item['title']}\n{raw_body}\n{raw_comments}"
        still_pure_cache = bool(
            item.get("_from_cache")
            and not item.get("_fresh_metadata")
            and not item.get("_comments_refreshed")
        )
        raw_cand_prs = item.get("candidate_prs")
        prev_candidate_prs = [
            str(r).strip()
            for r in (raw_cand_prs if isinstance(raw_cand_prs, list) else [])
            if str(r or "").strip()
        ]
        raw_prev_linked = item.get("linked_merged_prs")
        prev_linked = [
            dict(lp)
            for lp in (raw_prev_linked if isinstance(raw_prev_linked, list) else [])
            if isinstance(lp, dict)
        ]
        raw_prev_dc = item.get("linked_direct_commits")
        prev_direct_commits = [
            dict(dc)
            for dc in (raw_prev_dc if isinstance(raw_prev_dc, list) else [])
            if isinstance(dc, dict)
        ]
        raw_bound_diff = str(item.get("pr_diff_snippet") or "")
        raw_unbound_diff = str(item.get("unbound_pr_diff_snippet") or "")
        prev_diff_snippet = raw_bound_diff or raw_unbound_diff
        prev_diff_lines = parse_strict_nonneg_int(
            item.get("pr_diff_lines") if raw_bound_diff else item.get("unbound_pr_diff_lines"),
            0,
        )
        if prev_diff_snippet and prev_diff_lines <= 0:
            prev_diff_lines = len(prev_diff_snippet.split("\n"))
        prev_diff_source_ref = str(item.get("pr_diff_source_ref") or "").strip()

        pr_ref_contexts = extract_github_pr_ref_contexts(repo, num, full_text)
        candidate_prs = [r for r, _ in pr_ref_contexts]
        pr_affirmative: dict[str, bool] = {r: aff for r, aff in pr_ref_contexts}
        pr_affirmative_l: dict[str, bool] = {r.lower(): aff for r, aff in pr_ref_contexts}
        cited_set = set(candidate_prs)
        cited_set_l = {r.lower() for r in candidate_prs}
        linked: list[dict[str, Any]] = []
        direct_commits: list[dict[str, Any]] = []
        seen_refs: set[str] = set()
        seen_refs_l: set[str] = set()
        reverted_refs: set[str] = set()
        reverted_refs_l: set[str] = set()
        idx = _get_local_index(self.local_indexes, repo)

        # 1. Direct reverse index across ALL local git clones (including cross-repo Fixes other/repo#issue)
        ordered_indexes: list[LocalGitIndex] = []
        if idx is not None:
            ordered_indexes.append(idx)
        for c_idx in self.local_indexes.values():
            if c_idx is not idx:
                ordered_indexes.append(c_idx)

        for c_idx in ordered_indexes:
            if not c_idx.available:
                continue
            src_repo = c_idx.repo_slug
            for pr_num, sha, subj in c_idx.get_issue_commits(num, issue_repo=repo)[:4]:
                if pr_num > 0:
                    ref = f"{src_repo}#{pr_num}"
                    if ref.lower() not in seen_refs_l:
                        seen_refs.add(ref)
                        seen_refs_l.add(ref.lower())
                        cited_set.add(ref)
                        cited_set_l.add(ref.lower())
                        if ref not in candidate_prs:
                            candidate_prs.insert(0, ref)
                        linked.append(
                            {
                                "ref": ref,
                                "number": pr_num,
                                "title": subj,
                                "url": f"https://github.com/{src_repo}/pull/{pr_num}",
                                "source": "local_git_fix_ref",
                                "commit_sha": sha[:12],
                            }
                        )
                else:
                    direct_ref = f"{src_repo}@{sha[:8]}"
                    if direct_ref.lower() not in seen_refs_l:
                        seen_refs.add(direct_ref)
                        seen_refs_l.add(direct_ref.lower())
                        direct_commits.append(
                            {
                                "ref": direct_ref,
                                "title": subj,
                                "url": f"https://github.com/{src_repo}/commit/{sha}",
                                "source": "local_git_direct_commit",
                                "commit_sha": sha[:12],
                            }
                        )

        allow_text_pr_linking = not (
            not item.get("_comments_refreshed")
            and (
                (
                    parse_strict_nonneg_int(item.get("comments_count"), 0) > 0
                    and not item.get("comments_complete")
                )
                or (bool(item.get("body_truncated")) and not item.get("_raw_full_body"))
            )
        )

        # 2. Candidate PR refs affirmatively linking to this fix, verified against local git clone
        if allow_text_pr_linking:
            for ref in candidate_prs:
                if "#" not in ref or ref.lower() in seen_refs_l:
                    continue
                if not pr_affirmative_l.get(ref.lower(), False):
                    continue
                ref_repo, pr_s = ref.rsplit("#", 1)
                pr_num = parse_strict_positive_int(pr_s)
                if pr_num is None:
                    continue
                ref_idx = _get_local_index(self.local_indexes, ref_repo)
                if ref_idx and ref_idx.available:
                    if ref_idx.is_pr_reverted(pr_num):
                        reverted_refs.add(ref)
                        reverted_refs_l.add(ref.lower())
                        continue
                    hit = ref_idx.resolve_pr_commit(pr_num)
                    if hit:
                        sha, subj = hit
                        seen_refs.add(ref)
                        seen_refs_l.add(ref.lower())
                        linked.append(
                            {
                                "ref": ref,
                                "number": pr_num,
                                "title": subj,
                                "url": f"https://github.com/{ref_repo}/pull/{pr_num}",
                                "source": "local_git_pr_ref",
                                "commit_sha": sha[:12],
                            }
                        )

        diff_text = ""
        diff_lines = 0
        diff_source_ref = ""
        diff_entry_idx = -1
        for idx_e, entry in enumerate(linked):
            sha = entry.get("commit_sha") or ""
            ref = entry.get("ref") or ""
            ref_repo = ref.split("#")[0] if ref else repo
            ref_idx = _get_local_index(self.local_indexes, ref_repo) or idx
            if ref_idx and ref_idx.available and sha:
                dtext, dlen = ref_idx.get_diff_for_sha(sha, max_lines=120)
                if dtext:
                    diff_text, diff_lines = dtext, dlen
                    diff_source_ref = ref
                    entry["has_diff"] = True
                    diff_entry_idx = idx_e
                    break

        def _valid_cached_direct_commit(dc: dict[str, Any]) -> bool:
            if not _is_self_consistent_direct_commit(dc):
                return False
            d_ref = str(dc.get("ref") or "").strip()
            dc_repo, _, dc_sha = d_ref.partition("@")
            csha = str(dc.get("commit_sha") or dc_sha).strip()
            dc_idx = _get_local_index(self.local_indexes, dc_repo)
            if not (dc_idx and dc_idx.available):
                return False
            csha_l = csha.lower()
            if not dc_idx.is_trusted_commit(csha):
                return False
            if any(dc_idx.is_commit_reverted(csha, mref) for mref in dc_idx.merged_refs):
                return False
            issue_hits = dc_idx.get_issue_commits(num, issue_repo=repo)
            if not any(
                s.lower().startswith(csha_l) or csha_l.startswith(s.lower())
                for _pr, s, _subj in issue_hits
            ):
                return False
            return True

        # Merge cached links ONLY when still cited affirmatively OR item is offline-unchanged, and NEVER if reverted
        if still_pure_cache:
            for prev_ref in prev_candidate_prs:
                if prev_ref not in candidate_prs:
                    candidate_prs.append(prev_ref)
            for prev_dc in prev_direct_commits:
                d_ref = str(prev_dc.get("ref") or "").strip()
                if d_ref and d_ref.lower() not in seen_refs_l and _valid_cached_direct_commit(prev_dc):
                    seen_refs.add(d_ref)
                    seen_refs_l.add(d_ref.lower())
                    direct_commits.append(prev_dc)

        linked_by_ref: dict[str, dict[str, Any]] = {
            str(entry.get("ref") or "").strip(): entry
            for entry in linked
            if str(entry.get("ref") or "").strip()
        }
        linked_by_ref_l: dict[str, dict[str, Any]] = {
            k.lower(): v for k, v in linked_by_ref.items()
        }
        retained_prev_refs: set[str] = set()
        for prev_lp in prev_linked:
            p_ref = str(prev_lp.get("ref") or "").strip()
            if not p_ref:
                continue
            if "@" in p_ref:
                if still_pure_cache and p_ref.lower() not in seen_refs_l and _valid_cached_direct_commit(prev_lp):
                    seen_refs.add(p_ref)
                    seen_refs_l.add(p_ref.lower())
                    cp_dc = dict(prev_lp)
                    cp_dc.pop("has_diff", None)
                    direct_commits.append(cp_dc)
                continue
            if p_ref.lower() in reverted_refs_l:
                continue
            if "#" in p_ref:
                pr_repo, pr_s = p_ref.rsplit("#", 1)
                pr_num = parse_strict_positive_int(prev_lp.get("number")) or parse_strict_positive_int(pr_s)
                ref_idx = _get_local_index(self.local_indexes, pr_repo)
                if ref_idx and ref_idx.available and pr_num and ref_idx.is_pr_reverted(pr_num):
                    continue
            still_valid_ref = still_pure_cache or (
                p_ref.lower() in cited_set_l and pr_affirmative_l.get(p_ref.lower(), False)
            )
            if not still_valid_ref:
                continue
            retained_prev_refs.add(p_ref)
            if p_ref.lower() in linked_by_ref_l:
                target = linked_by_ref_l[p_ref.lower()]
                for field_k, field_v in prev_lp.items():
                    if field_k == "has_diff":
                        continue
                    if field_v not in (None, "") and not target.get(field_k):
                        target[field_k] = field_v
                continue
            merged_entry = dict(prev_lp)
            merged_entry.pop("has_diff", None)
            seen_refs.add(p_ref)
            linked_by_ref[p_ref] = merged_entry
            if p_ref not in candidate_prs:
                candidate_prs.append(p_ref)
            linked.append(merged_entry)

        # Preserve cached diff when still_pure_cache, explicit owner survived, or unchanged refresh kept unbound/legacy-unowned archived diff
        prev_was_unbound = bool(
            item.get("_prev_was_unbound")
            or (raw_unbound_diff.strip() and not raw_bound_diff.strip())
            or (raw_bound_diff.strip() and not prev_diff_source_ref)
        )
        preserve_unbound_cached = bool(prev_was_unbound and item.get("_metadata_unchanged"))
        cand_archive = ""
        cand_archive_lines = 0
        if raw_unbound_diff.strip() and (raw_bound_diff.strip() or item.get("_metadata_unchanged")):
            cand_archive = raw_unbound_diff
            cand_archive_lines = parse_strict_nonneg_int(item.get("unbound_pr_diff_lines"), 0) or len(
                cand_archive.split("\n")
            )
        elif preserve_unbound_cached and prev_diff_snippet:
            cand_archive = prev_diff_snippet
            cand_archive_lines = prev_diff_lines or len(cand_archive.split("\n"))
        if not diff_text and prev_diff_snippet and _section_has_diff_hunk(prev_diff_snippet.split("\n")):
            active_refs_l = {
                str(e.get("ref") or "").strip().lower(): str(e.get("ref") or "").strip()
                for e in linked
                if e.get("ref")
            }
            valid_cached_owner = ""
            if (
                prev_diff_source_ref
                and prev_diff_source_ref.lower() in active_refs_l
                and prev_diff_source_ref.lower() not in reverted_refs_l
            ):
                cand_canon_owner = active_refs_l[prev_diff_source_ref.lower()]
                owner_repo, _, pr_s = cand_canon_owner.partition("#")
                owner_idx = _get_local_index(self.local_indexes, owner_repo)
                owner_num = parse_strict_positive_int(pr_s)
                if owner_idx and owner_idx.available and owner_num and owner_idx.is_pr_reverted(owner_num):
                    valid_cached_owner = ""
                else:
                    valid_cached_owner = cand_canon_owner
            if valid_cached_owner or still_pure_cache or preserve_unbound_cached:
                diff_text = prev_diff_snippet
                diff_lines = prev_diff_lines
                diff_source_ref = valid_cached_owner
                if valid_cached_owner:
                    for idx_e, entry in enumerate(linked):
                        if str(entry.get("ref") or "").strip().lower() == valid_cached_owner.lower():
                            diff_entry_idx = idx_e
                            break

        archived_unbound = ""
        archived_unbound_lines = 0
        if diff_text and diff_source_ref and cand_archive and cand_archive != diff_text:
            ca_lines = cand_archive.split("\n")
            if _section_has_diff_hunk(ca_lines):
                ca_seqs = _extract_file_hunk_seqs(ca_lines)
                if not ca_seqs or not _match_ordered_diff(ca_seqs, diff_text):
                    archived_unbound = cand_archive
                    archived_unbound_lines = cand_archive_lines or len(ca_lines)

        retained_linked: list[dict[str, Any]] = []
        retained_indices: set[int] = set()
        new_added = 0
        for idx_e, entry in enumerate(linked):
            e_ref = str(entry.get("ref") or "").strip()
            is_cached = e_ref in retained_prev_refs
            is_diff_src = idx_e == diff_entry_idx
            if is_cached or is_diff_src:
                retained_linked.append(entry)
                retained_indices.add(idx_e)
            elif len(retained_linked) < 4 and new_added < 4:
                retained_linked.append(entry)
                retained_indices.add(idx_e)
                new_added += 1
        if diff_entry_idx >= 0 and diff_entry_idx not in retained_indices and linked:
            retained_linked.append(linked[diff_entry_idx])

        item["candidate_prs"] = candidate_prs[: max(10, len(prev_candidate_prs))] if still_pure_cache else candidate_prs[:12]
        item["linked_merged_prs"] = retained_linked
        if direct_commits:
            item["linked_direct_commits"] = direct_commits[:4]
        else:
            item.pop("linked_direct_commits", None)
        item["pr_diff_snippet"] = diff_text
        item["pr_diff_lines"] = diff_lines
        _enforce_single_diff_owner(item, diff_source_ref or None)
        if diff_text and not diff_source_ref:
            rebind_diff_provenance(item, self.local_indexes)
        else:
            _clear_unbound_diff_fields(item)
            if archived_unbound:
                item["unbound_pr_diff_snippet"] = archived_unbound
                item["unbound_pr_diff_lines"] = archived_unbound_lines

    def _fallback_fetch_github_pr_diff(self, item: dict[str, Any]) -> None:
        if item.get("pr_diff_snippet") or self.core_remaining < 8:
            return
        full_text = (
            f"{item['title']}\n{item.get('_raw_full_body') or item['body']}\n"
            f"{item.get('_raw_comments_full') or item['comments_text']}"
        )
        pr_refs = [
            r
            for r, aff in extract_github_pr_ref_contexts(item["repo"], int(item["number"]), full_text)
            if aff
        ]
        for ref in pr_refs[:2]:
            if "#" not in ref:
                continue
            owner_repo, pr_s = ref.rsplit("#", 1)
            if owner_repo.lower() not in self.allowed_repos:
                continue
            pr_num = parse_strict_positive_int(pr_s)
            if pr_num is None:
                continue
            ref_idx = _get_local_index(self.local_indexes, owner_repo)
            if ref_idx and ref_idx.available and ref_idx.is_pr_reverted(pr_num):
                continue
            pr_url = validate_github_api_url(f"https://api.github.com/repos/{owner_repo}/pulls/{pr_num}")
            pr_data, st = self._gh_core_get(pr_url)
            if st != 200 or not isinstance(pr_data, dict):
                if st not in (404, 422):
                    self.fallback_failures += 1
                continue
            if parse_strict_positive_int(pr_data.get("number")) != pr_num:
                if "message" in pr_data or not pr_data.get("html_url"):
                    self.fallback_failures += 1
                continue
            base_obj = pr_data.get("base")
            if "base" in pr_data and base_obj is not None and not isinstance(base_obj, dict):
                self.fallback_failures += 1
                continue
            base_repo_obj = base_obj.get("repo") if isinstance(base_obj, dict) else None
            if (
                isinstance(base_obj, dict)
                and "repo" in base_obj
                and base_repo_obj is not None
                and not isinstance(base_repo_obj, dict)
            ):
                self.fallback_failures += 1
                continue
            head_obj = pr_data.get("head")
            if "head" in pr_data and head_obj is not None and not isinstance(head_obj, dict):
                self.fallback_failures += 1
                continue
            if pr_data.get("private") is True or (
                isinstance(base_repo_obj, dict) and base_repo_obj.get("private") is True
            ):
                continue
            if isinstance(base_repo_obj, dict):
                base_full = str(base_repo_obj.get("full_name") or "").strip()
                if base_full and base_full.lower() != owner_repo.lower():
                    self.fallback_failures += 1
                    continue
            merged_at_val = pr_data.get("merged_at")
            if not isinstance(merged_at_val, str) or not re.fullmatch(
                r"\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):?[0-5]\d))?",
                merged_at_val.strip(),
            ):
                continue
            _m_s = merged_at_val.strip()
            try:
                if len(_m_s) == 10:
                    datetime.date.fromisoformat(_m_s)
                else:
                    _m_iso = _m_s[:-1] + "+00:00" if _m_s.endswith("Z") else _m_s
                    _m_iso = re.sub(r"([+-]\d{2})(\d{2})$", r"\1:\2", _m_iso)
                    datetime.datetime.fromisoformat(_m_iso)
            except ValueError:
                continue
            raw_html = pr_data.get("html_url")
            canonical_pr_url = f"https://github.com/{owner_repo}/pull/{pr_num}"
            if "html_url" in pr_data:
                validated = validate_repo_item_url(raw_html, "github.com", owner_repo, "pull", pr_num)
                if validated is None:
                    continue
                canonical_pr_url = validated
            if not any(x.get("ref") == ref for x in item["linked_merged_prs"]):
                item["linked_merged_prs"].append(
                    {
                        "ref": ref,
                        "number": pr_num,
                        "title": str(pr_data.get("title") or "").strip(),
                        "url": canonical_pr_url,
                        "source": "github_api",
                        "commit_sha": str(pr_data.get("merge_commit_sha") or "")[:12],
                        "merged_at": pr_data.get("merged_at"),
                    }
                )
            diff_raw, dst, hdrs = http_get_text(
                validate_github_api_url(pr_url),
                self._headers(accept="application/vnd.github.v3.diff"),
            )
            if "x-ratelimit-remaining" in hdrs:
                self.core_remaining = parse_strict_nonneg_int(hdrs["x-ratelimit-remaining"], self.core_remaining)
            if dst not in (200, 404, 422):
                self.fallback_failures += 1
            if dst == 200 and diff_raw:
                dtext, dlen = trim_unified_diff(diff_raw, max_lines=120)
                if dtext and dlen > 0:
                    prev_unb = str(item.get("unbound_pr_diff_snippet") or "")
                    prev_unb_lines = parse_strict_nonneg_int(item.get("unbound_pr_diff_lines"), 0)
                    item["pr_diff_snippet"] = dtext
                    item["pr_diff_lines"] = dlen
                    _clear_unbound_diff_fields(item)
                    if (
                        item.get("_prev_was_unbound")
                        and item.get("_metadata_unchanged")
                        and prev_unb.strip()
                        and prev_unb != dtext
                    ):
                        ca_lines = prev_unb.split("\n")
                        if _section_has_diff_hunk(ca_lines):
                            ca_seqs = _extract_file_hunk_seqs(ca_lines)
                            if not ca_seqs or not _match_ordered_diff(ca_seqs, dtext):
                                item["unbound_pr_diff_snippet"] = prev_unb
                                item["unbound_pr_diff_lines"] = prev_unb_lines or len(ca_lines)
                    _enforce_single_diff_owner(item, ref)
                    return

    def _score_github_candidate(self, item: dict[str, Any]) -> tuple[int, int, int]:
        full = f"{item['title']}\n{item['body']}\n{item['comments_text']}"
        codes = extract_error_codes(full)
        score = 0
        if item.get("pr_diff_snippet"):
            score += 6
        elif item.get("linked_merged_prs") or item.get("linked_direct_commits"):
            score += 4
        if item.get("has_human_resolution_comment"):
            score += 3
        if codes:
            score += 3 + min(len(codes), 3)
        if PLOG_OR_TRACE_RE.search(item["body"]):
            score += 2
        if has_concrete_verifiable_log_line(item["title"], item["body"], item["comments_text"]):
            score += 2
        return (score, item["comments_count"], int(item["number"]))

    def _fetch_all_issue_comments(
        self, repo: str, num: int, expected_count: int, max_pages: int = 20
    ) -> tuple[list[dict[str, Any]], bool, bool, int]:
        all_comments: list[dict[str, Any]] = []
        fetch_ok = False
        complete_pages = False
        requests_used = 0
        for page in range(1, max(1, max_pages) + 1):
            if self.core_remaining <= 2:
                complete_pages = False
                break
            url = validate_github_api_url(
                f"https://api.github.com/repos/{repo}/issues/{num}/comments?per_page=100&page={page}"
            )
            requests_used += 1
            cdata, cst = self._gh_core_get(url)
            if cst == 200 and isinstance(cdata, list):
                if any(
                    not isinstance(c, dict)
                    or "body" not in c
                    or (c["body"] is not None and not isinstance(c["body"], str))
                    for c in cdata
                ):
                    return all_comments, False, False, requests_used
                fetch_ok = True
                all_comments.extend(c for c in cdata if isinstance(c, dict))
                if len(cdata) < 100:
                    complete_pages = True
                    break
            elif cst == 403:
                return all_comments, False, False, requests_used
            else:
                return all_comments, False, False, requests_used
        return all_comments, fetch_ok, complete_pages, requests_used


    def mine(
        self,
        target_ascend: int = 155,
        target_vllm: int = 25,
        cached_by_key: dict[str, dict[str, Any]] | None = None,
    ) -> list[dict[str, Any]]:
        self.refresh_rate_limits()
        pool: dict[str, dict[str, Any]] = {}

        for k, prev in (cached_by_key or {}).items():
            if prev.get("ecosystem") != "github":
                continue
            c_repo = str(prev.get("repo") or "").strip()
            if c_repo.lower() not in self.allowed_repos:
                continue
            c_num = parse_strict_positive_int(prev.get("number"))
            if not c_repo or c_num is None or str(prev.get("key") or "") != f"{c_repo}#{c_num}":
                continue
            if str(prev.get("state") or "").lower() != "closed":
                continue
            canonical_url = validate_repo_item_url(prev.get("url"), "github.com", c_repo, "issues", c_num)
            if prev.get("url") and canonical_url is None:
                continue
            raw_bound = str(prev.get("pr_diff_snippet") or "")
            raw_unbound = str(prev.get("unbound_pr_diff_snippet") or "")
            prev_diff_snippet = raw_bound or raw_unbound
            prev_diff_src = str(prev.get("pr_diff_source_ref") or "").strip()
            prev_was_unbound = bool(
                (raw_unbound.strip() and not raw_bound.strip())
                or (raw_bound.strip() and not prev_diff_src)
            )
            prev_diff_lines = parse_strict_nonneg_int(prev.get("pr_diff_lines"), 0)
            if prev_diff_snippet and prev_diff_lines <= 0:
                prev_diff_lines = len(prev_diff_snippet.split("\n"))
            prev_ctext = str(prev.get("comments_text") or "")
            raw_res_flag = prev.get("has_human_resolution_comment")
            if isinstance(raw_res_flag, bool):
                prev_has_res = bool(raw_res_flag and _validate_cached_human_resolution(prev_ctext))
            else:
                prev_has_res = _validate_cached_human_resolution(prev_ctext)
            pool[k] = {
                "key": k,
                "ecosystem": "github",
                "repo": c_repo,
                "number": c_num,
                "url": canonical_url or f"https://github.com/{c_repo}/issues/{c_num}",
                "title": str(prev.get("title") or ""),
                "state": "closed",
                "created_at": prev.get("created_at"),
                "updated_at": prev.get("updated_at"),
                "closed_at": prev.get("closed_at"),
                "state_verified_at": prev.get("state_verified_at") or prev.get("updated_at") or prev.get("closed_at"),
                "labels": (
                    [
                        str(l.get("name") or "") if isinstance(l, dict) else str(l)
                        for l in prev["labels"]
                        if l
                    ]
                    if isinstance(prev.get("labels"), list)
                    else []
                ),
                "comments_count": parse_strict_nonneg_int(prev.get("comments_count"), 0),
                "comments_url": f"https://api.github.com/repos/{c_repo}/issues/{c_num}/comments",
                "body": str(prev.get("body") or "")[:7500],
                "body_truncated": len(str(prev.get("body") or "")) > 7500,
                "comments_text": prev_ctext,
                "comments_complete": prev.get("comments_complete") is True,
                "has_human_resolution_comment": prev_has_res,
                "_from_cache": True,
                "_fresh_metadata": False,
                "_metadata_unchanged": False,
                "_prev_was_unbound": prev_was_unbound,
                "_comments_refreshed": False,
                "_needs_comment_refresh": False,
                "candidate_prs": (
                    list(prev["candidate_prs"])
                    if isinstance(prev.get("candidate_prs"), list)
                    else []
                ),
                "linked_merged_prs": (
                    [dict(lp) for lp in prev["linked_merged_prs"] if isinstance(lp, dict)]
                    if isinstance(prev.get("linked_merged_prs"), list)
                    else []
                ),
                **(
                    {"linked_direct_commits": [dict(dc) for dc in prev["linked_direct_commits"] if isinstance(dc, dict)]}
                    if isinstance(prev.get("linked_direct_commits"), list) and prev["linked_direct_commits"]
                    else {}
                ),
                "pr_diff_snippet": prev_diff_snippet,
                "pr_diff_lines": prev_diff_lines,
                **(
                    {
                        "unbound_pr_diff_snippet": raw_unbound,
                        "unbound_pr_diff_lines": parse_strict_nonneg_int(
                            prev.get("unbound_pr_diff_lines"), 0
                        )
                        or len(raw_unbound.split("\n")),
                    }
                    if raw_bound.strip() and raw_unbound.strip() and raw_unbound != raw_bound
                    else {}
                ),
                **(
                    {"pr_diff_source_ref": str(prev["pr_diff_source_ref"]).strip()}
                    if str(prev.get("pr_diff_source_ref") or "").strip()
                    else {}
                ),
            }

        log("Mining GitHub vllm-ascend & vllm closed issues via stratified search (per_page=100)...")
        for repo_name, queries in (
            ("vllm-project/vllm-ascend", GITHUB_ASCEND_SEARCH_QUERIES),
            ("vllm-project/vllm", GITHUB_VLLM_SEARCH_QUERIES),
        ):
            for domain_hint, q in queries:
                encoded = urllib.parse.quote(q)
                url = (
                    f"https://api.github.com/search/issues?q={encoded}"
                    "&sort=updated&order=desc&per_page=100"
                )
                self.search_requests += 1
                data, st = self._gh_search_get(url)
                if (
                    st != 200
                    or not isinstance(data, dict)
                    or data.get("incomplete_results") is True
                    or not isinstance(data.get("items"), list)
                ):
                    self.search_failures += 1
                items = (data or {}).get("items") or [] if (isinstance(data, dict) and isinstance(data.get("items"), list)) else []
                log(f"  GH search [{repo_name}/{domain_hint}] status={st} returned={len(items)}")
                for it in items:
                    self._record_raw_issue(pool, repo_name, it)
                time.sleep(0.8)

        self.refresh_rate_limits()
        max_rest_pages = 8 if self.token else 3
        if self.core_remaining <= 5 and self.wait_for_core_reset:
            wait = self.core_reset - int(time.time()) + 3
            if 0 < wait <= self.max_core_wait_sec:
                log(f"Waiting {wait}s for GitHub core rate-limit reset before REST issues + comments...")
                time.sleep(wait)
                self.refresh_rate_limits()

        if self.core_remaining >= 8:
            for page in range(1, max_rest_pages + 1):
                if self.core_remaining <= (35 if not self.token else 10):
                    break
                url = (
                    "https://api.github.com/repos/vllm-project/vllm-ascend/issues"
                    f"?state=closed&per_page=100&page={page}"
                )
                data, st = self._gh_core_get(url)
                if st != 200 or not isinstance(data, list):
                    self.rest_failures += 1
                    log(f"  GH REST issues page {page} failed/malformed (status={st}, type={type(data).__name__})")
                    break
                if not data:
                    log(f"  GH REST issues page {page} stopped (empty page)")
                    break
                before = len(pool)
                for it in data:
                    self._record_raw_issue(pool, "vllm-project/vllm-ascend", it)
                log(
                    f"  GH REST [vllm-ascend] page={page} raw={len(data)} "
                    f"new_qualified={len(pool) - before} core_rem={self.core_remaining}"
                )
                time.sleep(0.25)
        else:
            self.notes.append(
                f"Skipped REST /issues pagination (core_remaining={self.core_remaining}); "
                "relied on /search/issues + local git clone index."
            )

        # Re-check cached issues omitted from closed search/REST results when authenticated quota allows
        if self.token and self.core_remaining >= 20:
            stale_rechecks = 0
            for k in list(pool):
                if self.core_remaining < 18 or stale_rechecks >= 40:
                    break
                it_obj = pool[k]
                if not (it_obj.get("_from_cache") and not it_obj.get("_fresh_metadata")):
                    continue
                stale_rechecks += 1
                chk_url = validate_github_api_url(
                    f"https://api.github.com/repos/{it_obj['repo']}/issues/{it_obj['number']}"
                )
                chk_data, chk_st = self._gh_core_get(chk_url)
                if (
                    chk_st == 200
                    and self._is_valid_gh_issue_payload(
                        chk_data,
                        repo=it_obj["repo"],
                        expected_num=int(it_obj["number"]),
                    )
                ):
                    if not self._record_raw_issue(pool, it_obj["repo"], chk_data):
                        self.rest_failures += 1
                elif chk_st == 404:
                    pool.pop(k, None)
                else:
                    self.rest_failures += 1

        log(f"GitHub raw bug-with-log pool size: {len(pool)}")

        for item in pool.values():
            if item.get("_fresh_metadata"):
                item["state_verified_at"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
                item["observation_stale"] = False
            else:
                item["observation_stale"] = True
            self._attach_local_prs(item)

        all_items = list(pool.values())
        for it in all_items:
            it["fault_domain_hint"] = classify_fault_domain(
                it["repo"], it["title"], it["body"], it["comments_text"]
            )

        comment_budget = max(
            0,
            min(260, self.core_remaining - 20) if self.token else (self.core_remaining - 2),
        )
        need_comments = [
            it
            for it in all_items
            if it["comments_count"] > 0
            and (not it["comments_text"] or it.get("_needs_comment_refresh"))
            and has_concrete_verifiable_log_line(it["title"], it["body"], "")
        ]
        need_comments.sort(
            key=lambda x: (
                0 if not (x.get("linked_merged_prs") or x.get("linked_direct_commits")) else 1,
                0 if x["repo"] == "vllm-project/vllm" else 1,
                -len(extract_error_codes(x["body"])),
                -min(x["comments_count"], 10),
                -int(x["number"]),
            )
        )

        vllm_need = [x for x in need_comments if x["repo"] == "vllm-project/vllm"]
        ascend_need = [x for x in need_comments if x["repo"] == "vllm-project/vllm-ascend"]
        vllm_cap = min(comment_budget, max(comment_budget // 3, min(18, comment_budget)))
        vllm_slots = min(len(vllm_need), vllm_cap)
        ascend_slots = max(0, comment_budget - vllm_slots)
        comment_queue = vllm_need[:vllm_slots] + ascend_need[:ascend_slots]
        log(
            f"Fetching GitHub comments for up to {len(comment_queue)} issues "
            f"(budget={comment_budget}, core_rem={self.core_remaining})..."
        )

        fetched = 0
        for item in comment_queue:
            if comment_budget <= 0 or self.core_remaining <= 2:
                log("Stopping GitHub comment fetches to preserve budget/rate limit.")
                break
            cdata, ok, complete_pages, reqs_used = self._fetch_all_issue_comments(
                item["repo"],
                int(item["number"]),
                int(item["comments_count"]),
                max_pages=min(20, max(1, comment_budget)),
            )
            comment_budget = max(0, comment_budget - reqs_used)
            fetched += 1
            if ok:
                comments_actually_complete = bool(
                    complete_pages
                    and len(cdata) >= item["comments_count"]
                )
                if not comments_actually_complete:
                    self.comment_failures += 1
                    item["_comments_refreshed"] = False
                    item["comments_complete"] = False
                    if cdata:
                        substantive, ctext, ctrunc = has_substantive_human_resolution(cdata)
                        item["comments_text"] = ctext
                        item["_raw_comments_full"] = "\n".join(
                            str(c.get("body") or "") for c in cdata if isinstance(c, dict)
                        )
                        item["has_human_resolution_comment"] = substantive
                else:
                    substantive, ctext, ctrunc = has_substantive_human_resolution(cdata)
                    item["comments_text"] = ctext
                    item["_raw_comments_full"] = "\n".join(
                        str(c.get("body") or "") for c in cdata if isinstance(c, dict)
                    )
                    item["has_human_resolution_comment"] = substantive
                    item["comments_complete"] = bool(
                        not item.get("body_truncated")
                        and not ctrunc
                    )
                    item["_comments_refreshed"] = True
                item["_needs_comment_refresh"] = False
                self._attach_local_prs(item)
                if (
                    comments_actually_complete
                    and not item.get("pr_diff_snippet")
                    and self.token
                    and self.core_remaining >= 8
                ):
                    self._fallback_fetch_github_pr_diff(item)
            else:
                self.comment_failures += 1
                if self.core_remaining <= 2:
                    break
            time.sleep(0.15)
        log(f"Fetched comments for {fetched} GitHub issues (core_rem={self.core_remaining})")

        if self.token and self.core_remaining >= 8:
            for item in all_items:
                if self.core_remaining < 8:
                    break
                if (
                    not item.get("_comments_refreshed")
                    and (
                        (
                            parse_strict_nonneg_int(item.get("comments_count"), 0) > 0
                            and not item.get("comments_complete")
                        )
                        or (bool(item.get("body_truncated")) and not item.get("_raw_full_body"))
                    )
                ):
                    continue
                if not item.get("pr_diff_snippet") and any(
                    aff
                    for _, aff in extract_github_pr_ref_contexts(
                        item["repo"],
                        int(item["number"]),
                        (
                            f"{item['title']}\n{item.get('_raw_full_body') or item['body']}\n"
                            f"{item.get('_raw_comments_full') or item['comments_text']}"
                        ),
                    )
                ):
                    self._fallback_fetch_github_pr_diff(item)

        qualified: list[dict[str, Any]] = []
        for item in all_items:
            if is_non_bug_issue(item["title"], item.get("labels") or []):
                continue
            if not has_concrete_verifiable_log_line(
                item["title"], item["body"], item["comments_text"]
            ):
                continue
            rebind_diff_provenance(item, self.local_indexes)
            has_linked_pr = bool(item.get("linked_merged_prs"))
            has_direct_commits = bool(item.get("linked_direct_commits"))
            has_resolution_comment = bool(item.get("has_human_resolution_comment"))
            if not (has_linked_pr or has_direct_commits or has_resolution_comment):
                continue
            full_raw = f"{item['title']}\n{item['body']}\n{item['comments_text']}"
            item["raw_sha256"] = hashlib.sha256(full_raw.encode("utf-8")).hexdigest()
            item["detected_error_codes"] = extract_error_codes(full_raw)
            item["fault_domain_hint"] = classify_fault_domain(
                item["repo"], item["title"], item["body"], item["comments_text"]
            )
            item["signal_score"] = self._score_github_candidate(item)[0]
            qualified.append(item)

        gh_ascend = [x for x in qualified if x["repo"] == "vllm-project/vllm-ascend"]
        gh_vllm = [x for x in qualified if x["repo"] == "vllm-project/vllm"]
        log(
            f"GitHub qualified after hard filter: vllm-ascend={len(gh_ascend)}, "
            f"vllm={len(gh_vllm)}"
        )

        selected_ascend = stratified_select(gh_ascend, target_ascend)
        selected_vllm = stratified_select(gh_vllm, target_vllm)
        return selected_ascend + selected_vllm


class GitCodeMiner:
    BASE = "https://api.gitcode.com/api/v5"

    def __init__(self) -> None:
        self.headers = {
            "Accept": "application/json",
            "User-Agent": "infer-lab-dual-miner/2.0",
        }
        self._pr_diff_cache: dict[tuple[str, int, int], tuple[str, int]] = {}
        self.repo_failures: list[str] = []
        self.repos_succeeded = 0
        self.enrichment_failures = 0
        self.disqualified_keys: set[str] = set()
        self.fresh_observations_by_key: dict[str, dict[str, Any]] = {}
        self.repo_floors: dict[tuple[str, str], int] | None = None

    def _fetch_mr_diff(self, repo: str, pr_num: int, max_lines: int = 120) -> tuple[str, int]:
        cache_key = (repo, pr_num, max_lines)
        if cache_key in self._pr_diff_cache:
            return self._pr_diff_cache[cache_key]
        raw_chunks: list[str] = []
        raw_bytes = 0
        raw_lines = 0
        max_raw_bytes = 256 * 1024
        max_raw_lines = max(360, max_lines * 4)
        for page in range(1, 11):
            url = f"{self.BASE}/repos/{repo}/pulls/{pr_num}/files?per_page=100&page={page}"
            files, st, _ = http_get_json(url, self.headers, timeout=20, retries=1)
            if st in (404, 422):
                if page == 1:
                    self._pr_diff_cache[cache_key] = ("", 0)
                    return "", 0
                break
            if st != 200 or not isinstance(files, list):
                # Do NOT cache transient HTTP errors (0, 429, 5xx)
                self.enrichment_failures += 1
                return "", 0
            for fobj in files:
                if not isinstance(fobj, dict):
                    continue
                fname = str(fobj.get("filename") or "")
                if not _is_code_file(fname):
                    continue
                patch_obj = fobj.get("patch")
                diff_body = ""
                if isinstance(patch_obj, dict):
                    diff_body = str(patch_obj.get("diff") or "")
                elif isinstance(patch_obj, str):
                    diff_body = patch_obj
                if not diff_body.strip():
                    continue
                chunk = f"diff --git a/{fname} b/{fname}\n--- a/{fname}\n+++ b/{fname}\n{diff_body}"
                budget_bytes = max_raw_bytes - raw_bytes - (1 if raw_chunks else 0)
                if budget_bytes <= 0:
                    break
                chunk_bytes = chunk.encode("utf-8", errors="replace")
                if len(chunk_bytes) > budget_bytes:
                    kept_lines: list[str] = []
                    used_b = 0
                    for cln in chunk.splitlines():
                        cln_b = len(cln.encode("utf-8", errors="replace")) + (1 if kept_lines else 0)
                        if used_b + cln_b > budget_bytes:
                            break
                        kept_lines.append(cln)
                        used_b += cln_b
                    if not kept_lines:
                        break
                    chunk = "\n".join(kept_lines)
                    chunk_bytes = chunk.encode("utf-8", errors="replace")
                raw_chunks.append(chunk)
                raw_bytes += len(chunk_bytes) + (1 if len(raw_chunks) > 1 else 0)
                raw_lines += chunk.count("\n") + 1
                if raw_bytes >= max_raw_bytes or raw_lines >= max_raw_lines:
                    break
            if raw_bytes >= max_raw_bytes or raw_lines >= max_raw_lines or len(files) < 100:
                break
        if not raw_chunks:
            self._pr_diff_cache[cache_key] = ("", 0)
            return "", 0
        trimmed = trim_unified_diff("\n".join(raw_chunks), max_lines=max_lines)
        self._pr_diff_cache[cache_key] = trimmed
        return trimmed

    def _extract_mr_refs(self, repo: str, issue_num: int, text: str) -> list[tuple[str, int, bool]]:
        return extract_gitcode_mr_refs(repo, issue_num, text)

    @staticmethod
    def _validate_mr_identity(
        pr_obj: dict[str, Any],
        default_repo: str,
        expected_repo: str | None = None,
        expected_num: int | None = None,
    ) -> tuple[str, int, str] | None:
        pnum = parse_strict_positive_int(pr_obj.get("number"))
        if pnum is None:
            return None
        if expected_num is not None and pnum != expected_num:
            log(f"Quarantining GitCode MR number mismatch: expected !{expected_num}, got {pnum}")
            return None

        html_url = str(pr_obj.get("html_url") or "").strip()
        base_obj = pr_obj.get("base")
        base_repo_obj = base_obj.get("repo") if isinstance(base_obj, dict) else None
        base_repo = (
            str(base_repo_obj.get("full_name") or "").strip()
            if isinstance(base_repo_obj, dict)
            else ""
        )

        url_repo = ""
        url_kind = "merge_requests"
        if html_url:
            safe_url = _redact_url_for_log(html_url)
            try:
                p = urllib.parse.urlparse(html_url)
            except ValueError:
                log(f"Quarantining GitCode MR with unparseable html_url={safe_url!r}")
                return None
            if p.scheme.lower() != "https" or (p.netloc or "").lower() != "gitcode.com" or p.username or p.password:
                log(f"Quarantining GitCode MR with invalid html_url={safe_url!r}")
                return None
            m_path = re.fullmatch(
                r"/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)/(merge_requests|pull)/([0-9]{1,9})/?",
                p.path or "",
            )
            if not m_path:
                log(f"Quarantining GitCode MR with invalid html_url path={safe_url!r}")
                return None
            url_repo = m_path.group(1)
            url_kind = m_path.group(2)
            url_num = int(m_path.group(3))
            if url_num != pnum:
                log(f"Quarantining GitCode MR mismatch: number={pnum} vs html_url={safe_url!r}")
                return None

        pr_repo = url_repo or base_repo or default_repo
        if base_repo and url_repo and base_repo.lower() != url_repo.lower():
            log(f"Quarantining GitCode MR repo mismatch: base={base_repo!r} vs html_url={url_repo!r}")
            return None
        if expected_repo and pr_repo.lower() != expected_repo.lower():
            log(f"Quarantining GitCode MR repo mismatch: expected={expected_repo!r}, got={pr_repo!r}")
            return None

        canonical_url = f"https://gitcode.com/{pr_repo}/{url_kind}/{pnum}"
        return pr_repo, pnum, canonical_url

    def _fetch_all_issue_comments(
        self, repo: str, num_str: str, expected_count: int, max_pages: int = 20
    ) -> tuple[list[dict[str, Any]], bool, bool]:
        all_comments: list[dict[str, Any]] = []
        fetch_ok = False
        complete_pages = False
        for page in range(1, max(1, max_pages) + 1):
            cdata, cst, _ = http_get_json(
                f"{self.BASE}/repos/{repo}/issues/{num_str}/comments?per_page=100&page={page}",
                self.headers,
                timeout=20,
                retries=1,
            )
            if cst == 200 and isinstance(cdata, list):
                if any(
                    not isinstance(c, dict)
                    or "body" not in c
                    or (c["body"] is not None and not isinstance(c["body"], str))
                    for c in cdata
                ):
                    return all_comments, False, False
                fetch_ok = True
                all_comments.extend(c for c in cdata if isinstance(c, dict))
                if len(cdata) < 100:
                    complete_pages = True
                    break
            else:
                return all_comments, False, False
        return all_comments, fetch_ok, complete_pages

    @staticmethod
    def _mr_references_issue(
        pr_obj: dict[str, Any], repo: str, issue_num: int, mr_repo: str | None = None
    ) -> bool:
        txt = f"{pr_obj.get('title') or ''}\n{pr_obj.get('body') or ''}"
        same_repo = (mr_repo or repo).lower() == repo.lower()
        for m in re.finditer(rf"(?<![A-Za-z0-9_./:-]){re.escape(repo)}#{issue_num}\b", txt, re.IGNORECASE):
            if not _match_is_negated(txt, m.start(), m.end()) and _is_affirmative_fix_clause(
                _full_clause_at(txt, m.start(), m.end())
            ):
                return True
        if same_repo:
            for m in re.finditer(rf"(?<![A-Za-z0-9_./:-])#{issue_num}\b", txt):
                if not _match_is_negated(txt, m.start(), m.end()) and _is_affirmative_fix_clause(
                    _full_clause_at(txt, m.start(), m.end())
                ):
                    return True
        for m in GITCODE_ISSUE_URL_RE.finditer(txt):
            if m.group(1).lower() == repo.lower() and int(m.group(2)) == issue_num:
                if not _match_is_negated(txt, m.start(), m.end()) and _is_affirmative_fix_clause(
                    _full_clause_at(txt, m.start(), m.end())
                ):
                    return True
        return False

    @staticmethod
    def _mr_explicitly_disclaims_issue(
        pr_obj: dict[str, Any], repo: str, issue_num: int, mr_repo: str | None = None
    ) -> bool:
        """Return True if the latest chronological reference to this issue in MR title/body explicitly negates/disclaims fixing it."""
        txt = f"{pr_obj.get('title') or ''}\n{pr_obj.get('body') or ''}"
        same_repo = (mr_repo or repo).lower() == repo.lower()
        hits: list[tuple[int, int]] = []
        for m in re.finditer(rf"(?<![A-Za-z0-9_./:-]){re.escape(repo)}#{issue_num}\b", txt, re.IGNORECASE):
            hits.append((m.start(), m.end()))
        if same_repo:
            for m in re.finditer(rf"(?<![A-Za-z0-9_./:-])#{issue_num}\b", txt):
                hits.append((m.start(), m.end()))
        for m in GITCODE_ISSUE_URL_RE.finditer(txt):
            if m.group(1).lower() == repo.lower() and int(m.group(2)) == issue_num:
                hits.append((m.start(), m.end()))
        latest_state = ""
        for start, end in sorted(hits):
            if _match_is_negated(txt, start, end):
                latest_state = "negated"
            elif _is_affirmative_fix_clause(_full_clause_at(txt, start, end)):
                latest_state = "affirmative"
            elif not latest_state:
                latest_state = "mention"
        return latest_state == "negated"

    def _mine_repo(self, repo: str, quota: int, max_pages: int) -> list[dict[str, Any]]:
        candidates: list[dict[str, Any]] = []
        seen_nums: set[int] = set()
        page1_ok = False
        for page in range(1, max_pages + 1):
            url = f"{self.BASE}/repos/{repo}/issues?state=closed&per_page=100&page={page}"
            data, st, _ = http_get_json(url, self.headers, timeout=25, retries=2)
            if st != 200 or not isinstance(data, list):
                log(f"  GitCode [{repo}] page={page} failed (status={st})")
                self.repo_failures.append(
                    f"{repo}:status={st}" if page == 1 else f"{repo}:page={page}:status={st}"
                )
                break
            if page == 1:
                page1_ok = True
            if not data:
                break
            for it in data:
                if not isinstance(it, dict):
                    continue
                num_val = parse_strict_positive_int(it.get("number"))
                if num_val is None or num_val in seen_nums:
                    continue
                item_key = f"gitcode:{repo}#{num_val}"
                st_val = it.get("state")
                title_val = it.get("title")
                raw_labels = it.get("labels")
                has_valid_body = "body" in it and (it["body"] is None or isinstance(it["body"], str))
                raw_comments_val = it.get("comments")
                bad_comments = (
                    "comments" not in it
                    or raw_comments_val is None
                    or parse_strict_nonneg_int(raw_comments_val, -1) < 0
                )
                if (
                    not isinstance(st_val, str)
                    or st_val.strip().lower() not in ("open", "closed")
                    or not isinstance(title_val, str)
                    or not has_valid_body
                    or (raw_labels is not None and not isinstance(raw_labels, list))
                    or bad_comments
                ):
                    log(f"Ignoring incomplete/malformed GitCode issue payload for {item_key}")
                    self.repo_failures.append(f"{repo}:malformed_issue:{num_val}")
                    continue
                raw_html_url = it.get("html_url")
                canonical_issue_url = f"https://gitcode.com/{repo}/issues/{num_val}"
                if raw_html_url is not None and raw_html_url != "":
                    validated = validate_repo_item_url(raw_html_url, "gitcode.com", repo, "issues", num_val)
                    if validated is None:
                        log(
                            f"Quarantining mismatched/invalid GitCode issue url={_redact_url_for_log(str(raw_html_url))!r} vs {repo}#{num_val}"
                        )
                        self.repo_failures.append(f"{repo}:mismatched_issue_url:{num_val}")
                        continue
                    canonical_issue_url = validated
                if st_val.strip().lower() != "closed":
                    self.disqualified_keys.add(item_key)
                    continue
                seen_nums.add(num_val)
                title = title_val.strip()
                raw_body = str(it.get("body") or "").strip()
                issue_type = str(it.get("issue_type") or "")
                labels = [
                    str(l.get("name") or "")
                    for l in (raw_labels or [])
                    if isinstance(l, dict)
                ]
                if is_non_bug_issue(title, labels, issue_type=issue_type):
                    self.disqualified_keys.add(item_key)
                    continue
                fresh_body = raw_body[:7500]
                body_truncated = len(raw_body) > 7500
                if len(fresh_body) < 140:
                    self.disqualified_keys.add(item_key)
                    continue
                if not (ERROR_CODE_RE.search(fresh_body) or PLOG_OR_TRACE_RE.search(fresh_body)):
                    self.disqualified_keys.add(item_key)
                    continue
                if not has_concrete_verifiable_log_line(title, fresh_body, ""):
                    self.disqualified_keys.add(item_key)
                    continue
                comments_cnt = parse_strict_nonneg_int(raw_comments_val, 0)
                codes = extract_error_codes(f"{title}\n{fresh_body}")
                pre_score = (
                    (3 if codes else 0)
                    + min(len(codes), 3)
                    + (2 if PLOG_OR_TRACE_RE.search(fresh_body) else 0)
                    + (2 if comments_cnt > 0 else 0)
                )
                candidates.append(
                    {
                        "key": item_key,
                        "ecosystem": "gitcode",
                        "repo": repo,
                        "number": num_val,
                        "num_str": str(num_val),
                        "url": canonical_issue_url,
                        "title": title,
                        "state": "closed",
                        "created_at": it.get("created_at"),
                        "updated_at": it.get("updated_at"),
                        "closed_at": it.get("finished_at") or it.get("updated_at"),
                        "labels": labels,
                        "comments_count": comments_cnt,
                        "body": fresh_body,
                        "_raw_full_body": raw_body,
                        "body_truncated": body_truncated,
                        "pre_score": pre_score,
                    }
                )
            time.sleep(0.15)
            if len(candidates) >= quota * 3 + 12:
                break

        if page1_ok:
            self.repos_succeeded += 1

        candidates.sort(key=lambda x: (-x["pre_score"], -x["comments_count"], -len(x["body"])))
        inspect_limit = min(len(candidates), max(quota * 2 + 12, 32))
        log(
            f"  GitCode [{repo}] scanned={len(seen_nums)} pre_qualified={len(candidates)} "
            f"enriching_top={inspect_limit}"
        )

        qualified: list[dict[str, Any]] = []
        for item in candidates[:inspect_limit]:
            num_str = item["num_str"]
            num_int = int(item["number"])
            comments_text = ""
            raw_comments_full = ""
            substantive_comment = False
            comment_fetch_ok = item["comments_count"] == 0
            comment_fetch_complete = item["comments_count"] == 0
            comments_complete = item["comments_count"] == 0 and not item["body_truncated"]
            ctrunc = False
            if item["comments_count"] > 0:
                cdata, cok, complete_pages = self._fetch_all_issue_comments(repo, num_str, item["comments_count"])
                if cok:
                    comment_fetch_ok = True
                    substantive_comment, comments_text, ctrunc = has_substantive_human_resolution(cdata)
                    raw_comments_full = "\n".join(
                        str(c.get("body") or "") for c in cdata if isinstance(c, dict)
                    )
                    comment_fetch_complete = bool(
                        complete_pages and len(cdata) >= item["comments_count"]
                    )
                    if not comment_fetch_complete:
                        self.enrichment_failures += 1
                    comments_complete = bool(
                        comment_fetch_complete
                        and not item["body_truncated"]
                        and not ctrunc
                    )
                else:
                    comment_fetch_ok = False
                    comment_fetch_complete = False
                    self.enrichment_failures += 1
                time.sleep(0.08)

            linked_prs: list[dict[str, Any]] = []
            seen_refs: set[str] = set()
            rejected_mr_refs: set[str] = set()
            mr_conflict_or_err = False
            pr_list, pst, _ = http_get_json(
                f"{self.BASE}/repos/{repo}/issues/{num_str}/pull_requests",
                self.headers,
                timeout=20,
                retries=1,
            )
            linked_prs_authoritative = pst == 200 and isinstance(pr_list, list)
            if pst not in (200, 404) or (pst == 200 and not isinstance(pr_list, list)):
                self.enrichment_failures += 1
                mr_conflict_or_err = True
            if linked_prs_authoritative:
                for pr in pr_list:
                    if not isinstance(pr, dict):
                        self.enrichment_failures += 1
                        mr_conflict_or_err = True
                        continue
                    raw_pnum = parse_strict_positive_int(pr.get("number"))
                    raw_base = pr.get("base")
                    raw_base_repo_obj = raw_base.get("repo") if isinstance(raw_base, dict) else None
                    raw_base_repo = (
                        str(raw_base_repo_obj.get("full_name") or "").strip()
                        if isinstance(raw_base_repo_obj, dict)
                        else ""
                    )
                    raw_state = pr.get("state")
                    valid_mr_state = (
                        isinstance(raw_state, str)
                        and raw_state.strip().lower() in ("open", "opened", "closed", "merged")
                    )
                    is_merged_mr = valid_mr_state and raw_state.strip().lower() == "merged"
                    ident = self._validate_mr_identity(pr, default_repo=repo)
                    if not valid_mr_state or ident is None or not is_merged_mr:
                        if not valid_mr_state or ident is None:
                            self.enrichment_failures += 1
                            mr_conflict_or_err = True
                        rej_repos = {r for r in (repo, raw_base_repo) if r}
                        rej_nums: set[int] = set()
                        if raw_pnum is not None:
                            rej_nums.add(raw_pnum)
                        raw_hu = str(pr.get("html_url") or "")
                        parsed_hu = _safe_urlparse(raw_hu) if raw_hu else None
                        m_hu = (
                            re.search(
                                r"/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)/(?:merge_requests|pull)/([0-9]{1,9})/?$",
                                parsed_hu.path or "",
                            )
                            if parsed_hu is not None
                            else None
                        )
                        if m_hu:
                            rej_repos.add(m_hu.group(1))
                            rej_nums.add(int(m_hu.group(2)))
                        for rr in rej_repos:
                            for rn in rej_nums:
                                rejected_mr_refs.add(f"gitcode:{rr}!{rn}")
                        continue
                    pr_repo, pnum_int, canonical_url = ident
                    ref = f"gitcode:{pr_repo}!{pnum_int}"
                    if self._mr_explicitly_disclaims_issue(pr, repo, num_int, mr_repo=pr_repo):
                        rejected_mr_refs.add(ref)
                        continue
                    if ref not in seen_refs:
                        seen_refs.add(ref)
                        linked_prs.append(
                            {
                                "ref": ref,
                                "number": pnum_int,
                                "title": str(pr.get("title") or "").strip(),
                                "url": canonical_url,
                                "source": "gitcode_linked_pr",
                                "commit_sha": "",
                            }
                        )
                if rejected_mr_refs and linked_prs:
                    rej_official_l = {r.lower() for r in rejected_mr_refs}
                    conflicted_l = {
                        str(lp.get("ref") or "").strip().lower()
                        for lp in linked_prs
                        if str(lp.get("ref") or "").strip().lower() in rej_official_l
                    }
                    if conflicted_l:
                        linked_prs = [
                            lp
                            for lp in linked_prs
                            if str(lp.get("ref") or "").strip().lower() not in conflicted_l
                        ]
                        seen_refs = {str(lp.get("ref") or "").strip() for lp in linked_prs if lp.get("ref")}
                        self.enrichment_failures += 1
                        mr_conflict_or_err = True
            time.sleep(0.08)

            full_text = f"{item['title']}\n{item['body']}\n{comments_text}"
            disclaimers_text = (
                f"{item['title']}\n{item.get('_raw_full_body') or item['body']}\n"
                f"{raw_comments_full or comments_text}"
            )
            mr_refs = self._extract_mr_refs(repo, num_int, disclaimers_text)
            disclaimed_mr_refs = extract_gitcode_disclaimed_mr_refs(repo, disclaimers_text)
            active_mr_lower = {f"gitcode:{mr_repo}!{mr_num}".lower() for mr_repo, mr_num, _ in mr_refs}
            for disc_ref in disclaimed_mr_refs - active_mr_lower:
                rejected_mr_refs.add(disc_ref)
            rejected_lower = {r.lower() for r in rejected_mr_refs}
            if rejected_lower and linked_prs:
                linked_prs = [
                    lp
                    for lp in linked_prs
                    if str(lp.get("ref") or "").strip().lower() not in rejected_lower
                ]
                seen_refs = {str(lp.get("ref") or "").strip() for lp in linked_prs if lp.get("ref")}
            candidate_prs = [p["ref"] for p in linked_prs]
            had_official_linked = bool(linked_prs)
            for mr_repo, mr_num, is_affirmative in mr_refs:
                ref = f"gitcode:{mr_repo}!{mr_num}"
                if ref not in candidate_prs:
                    candidate_prs.append(ref)
                if (
                    not had_official_linked
                    and not linked_prs_authoritative
                    and len(linked_prs) < 4
                    and ref not in seen_refs
                    and ref.lower() not in rejected_lower
                ):
                    pr_obj, mst, _ = http_get_json(
                        f"{self.BASE}/repos/{mr_repo}/pulls/{mr_num}",
                        self.headers,
                        timeout=15,
                        retries=0,
                    )
                    if mst not in (200, 404, 422) or (mst == 200 and not isinstance(pr_obj, dict)):
                        self.enrichment_failures += 1
                        mr_conflict_or_err = True
                        continue
                    if mst in (404, 422):
                        rejected_mr_refs.add(ref)
                        rejected_lower.add(ref.lower())
                        continue
                    if str(pr_obj.get("state") or "").lower() != "merged":
                        rejected_mr_refs.add(ref)
                        rejected_lower.add(ref.lower())
                        continue
                    ident = self._validate_mr_identity(
                        pr_obj, default_repo=mr_repo, expected_repo=mr_repo, expected_num=mr_num
                    )
                    if ident is None:
                        rejected_mr_refs.add(ref)
                        rejected_lower.add(ref.lower())
                        continue
                    if self._mr_explicitly_disclaims_issue(pr_obj, repo, num_int, mr_repo=mr_repo):
                        rejected_mr_refs.add(ref)
                        rejected_lower.add(ref.lower())
                        continue
                    if not (is_affirmative or self._mr_references_issue(pr_obj, repo, num_int, mr_repo=mr_repo)):
                        rejected_mr_refs.add(ref)
                        rejected_lower.add(ref.lower())
                        continue
                    pr_repo, pnum_int, canonical_url = ident
                    seen_refs.add(ref)
                    linked_prs.append(
                        {
                            "ref": ref,
                            "number": pnum_int,
                            "title": str(pr_obj.get("title") or "").strip(),
                            "url": canonical_url,
                            "source": "gitcode_text_ref_pr",
                            "commit_sha": "",
                        }
                    )

            if not (linked_prs or substantive_comment):
                if comment_fetch_ok and comment_fetch_complete:
                    if linked_prs_authoritative and not mr_conflict_or_err and not item["body_truncated"]:
                        self.disqualified_keys.add(item["key"])
                    elif not linked_prs_authoritative:
                        self.fresh_observations_by_key[item["key"]] = {
                            "key": item["key"],
                            "ecosystem": "gitcode",
                            "repo": repo,
                            "number": num_int,
                            "url": item["url"],
                            "title": item["title"],
                            "state": "closed",
                            "updated_at": item.get("updated_at"),
                            "comments_count": item["comments_count"],
                            "body": item["body"],
                            "comments_text": comments_text,
                            "comments_complete": comments_complete,
                            "_comment_fetch_ok": True,
                            "has_human_resolution_comment": False,
                            "candidate_prs": candidate_prs[:10],
                            "linked_merged_prs": [],
                            "_linked_prs_authoritative": False,
                            **(
                                {"_rejected_mr_refs": sorted(rejected_mr_refs)}
                                if rejected_mr_refs
                                else {}
                            ),
                        }
                continue
            if not has_concrete_verifiable_log_line(item["title"], item["body"], comments_text):
                self.disqualified_keys.add(item["key"])
                continue

            diff_text = ""
            diff_lines = 0
            diff_source_ref = ""
            for pr_entry in linked_prs[:2]:
                ref_repo = pr_entry["ref"].replace("gitcode:", "").split("!")[0]
                dtext, dlen = self._fetch_mr_diff(ref_repo, int(pr_entry["number"]), max_lines=120)
                if dtext and dlen > 0:
                    diff_text, diff_lines = dtext, dlen
                    diff_source_ref = pr_entry["ref"]
                    break

            codes = extract_error_codes(full_text)
            domain = classify_fault_domain(repo, item["title"], item["body"], comments_text)
            sig_score = (
                (6 if diff_text else (4 if linked_prs else 0))
                + (3 if substantive_comment else 0)
                + (3 + min(len(codes), 3) if codes else 0)
                + (2 if PLOG_OR_TRACE_RE.search(item["body"]) else 0)
            )
            item["comments_text"] = comments_text
            item["comments_complete"] = comments_complete
            item["_comment_fetch_ok"] = comment_fetch_ok
            item["has_human_resolution_comment"] = substantive_comment
            item["candidate_prs"] = candidate_prs[:10]
            item["linked_merged_prs"] = linked_prs[:4]
            item["_linked_prs_authoritative"] = linked_prs_authoritative
            if rejected_mr_refs:
                item["_rejected_mr_refs"] = sorted(rejected_mr_refs)
            item["pr_diff_snippet"] = diff_text
            item["pr_diff_lines"] = diff_lines
            _enforce_single_diff_owner(item, diff_source_ref or None)
            item["state_verified_at"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            item["observation_stale"] = False
            item["detected_error_codes"] = codes
            item["fault_domain_hint"] = domain
            item["signal_score"] = sig_score
            item["raw_sha256"] = hashlib.sha256(full_text.encode("utf-8")).hexdigest()
            qualified.append(item)
            if len(qualified) >= quota + 8:
                break

        log(
            f"  GitCode [{repo}] qualified={len(qualified)} "
            f"(with_diff={sum(1 for x in qualified if x['pr_diff_snippet'])})"
        )
        return qualified

    def mine(
        self,
        target_total: int = 165,
        *,
        repo_floors: dict[tuple[str, str], int] | None = None,
    ) -> list[dict[str, Any]]:
        raw_floors = repo_floors if repo_floors is not None else self.repo_floors
        norm_floors = (
            {
                (str(e).strip().lower(), str(r).strip().lower()): int(v)
                for (e, r), v in raw_floors.items()
                if int(v) > 0
            }
            if raw_floors
            else None
        )
        all_qualified: list[dict[str, Any]] = []
        per_repo_selected: list[dict[str, Any]] = []
        spillover: list[dict[str, Any]] = []
        seen_keys: set[str] = set()
        seen_shas: set[str] = set()

        for repo, quota, max_pages in GITCODE_REPOS:
            req_floor = norm_floors.get(("gitcode", repo.lower()), 0) if norm_floors else 0
            eff_quota = max(quota, req_floor)
            q_items = self._mine_repo(repo, quota=eff_quota, max_pages=max_pages)
            q_items.sort(
                key=lambda x: (
                    -int(x["signal_score"]),
                    -int(bool(x["pr_diff_snippet"])),
                    -int(x["comments_count"]),
                    str(x.get("key") or ""),
                )
            )
            q_items = [
                it
                for it in _dedup_raw_candidates(q_items)
                if (
                    str(it.get("key") or "").strip().lower() not in seen_keys
                    and _record_content_sha(it) not in seen_shas
                )
            ]
            chosen_r = q_items[:eff_quota]
            for it in chosen_r:
                k_l = str(it.get("key") or "").strip().lower()
                if k_l:
                    seen_keys.add(k_l)
                seen_shas.add(_record_content_sha(it))
            per_repo_selected.extend(chosen_r)
            spillover.extend(q_items[eff_quota:])
            all_qualified.extend(q_items)

        spillover = [
            it
            for it in _dedup_raw_candidates(spillover)
            if (
                str(it.get("key") or "").strip().lower() not in seen_keys
                and _record_content_sha(it) not in seen_shas
            )
        ]

        if len(per_repo_selected) < target_total and spillover:
            need = target_total - len(per_repo_selected)
            per_repo_selected.extend(stratified_select(spillover, need))
        elif len(per_repo_selected) > target_total:
            per_repo_selected = stratified_select(
                per_repo_selected,
                target_total,
                repo_floors=norm_floors,
            )

        log(
            f"GitCode total qualified={len(all_qualified)}, selected={len(per_repo_selected)} "
            f"(with_diff={sum(1 for x in per_repo_selected if x['pr_diff_snippet'])})"
        )
        return per_repo_selected


def _record_content_sha(item: dict[str, Any]) -> str:
    title = str(item.get("title") or "")
    body = str(item.get("body") or "")
    comments_text = str(item.get("comments_text") or "")
    return hashlib.sha256(f"{title}\n{body}\n{comments_text}".encode("utf-8")).hexdigest()


def _dedup_raw_candidates(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: list[dict[str, Any]] = []
    seen_keys: set[str] = set()
    seen_shas: set[str] = set()
    for it in items:
        key_l = str(it.get("key") or "").strip().lower()
        c_sha = _record_content_sha(it)
        if (key_l and key_l in seen_keys) or c_sha in seen_shas:
            continue
        if key_l:
            seen_keys.add(key_l)
        seen_shas.add(c_sha)
        deduped.append(it)
    return deduped


def stratified_select(
    items: list[dict[str, Any]],
    limit: int,
    *,
    repo_floors: dict[tuple[str, str], int] | None = None,
) -> list[dict[str, Any]]:
    """Select up to `limit` items preserving feasible per-repo coverage and balanced domain distribution."""
    if limit <= 0:
        return []
    items = _dedup_raw_candidates(
        sorted(
            items,
            key=lambda x: (
                -int(x.get("signal_score", 0)),
                -int(bool(x.get("pr_diff_snippet"))),
                -int(x.get("comments_count", 0)),
                1 if x.get("observation_stale") else 0,
                str(x.get("key") or ""),
            ),
        )
    )
    if len(items) <= limit:
        return items
    domain_rank = {dom: idx for idx, dom in enumerate(list(TARGET_DOMAINS) + ["other"])}
    selected: list[dict[str, Any]] = []
    chosen_ids: set[int] = set()
    sel_dom: Counter[str] = Counter()
    sel_repo: Counter[tuple[str, str]] = Counter()

    # Reserve feasible per-repo minimums first so stratified selection cannot drop required repos
    avail_repos = sorted(
        {
            (str(it.get("ecosystem") or "").strip().lower(), str(it.get("repo") or "").strip().lower())
            for it in items
            if it.get("repo")
        }
    )
    norm_floors = (
        {
            (str(e).strip().lower(), str(r).strip().lower()): int(v)
            for (e, r), v in repo_floors.items()
        }
        if repo_floors is not None
        else None
    )
    eff_floors: dict[tuple[str, str], int] = {}
    if norm_floors is not None:
        for rk in avail_repos:
            req = int(norm_floors.get(rk, 0))
            if req > 0:
                eff_floors[rk] = req
    elif len(avail_repos) > 1 and limit >= len(avail_repos):
        for rk in avail_repos:
            eff_floors[rk] = 1

    if eff_floors:
        repo_order = sorted(eff_floors)
        while len(selected) < limit:
            progressed = False
            for rk in repo_order:
                if sel_repo[rk] >= eff_floors[rk]:
                    continue
                pool = [
                    it
                    for it in items
                    if id(it) not in chosen_ids
                    and (str(it.get("ecosystem") or "").strip().lower(), str(it.get("repo") or "").strip().lower()) == rk
                ]
                if not pool:
                    continue
                has_tgt_dom = any((it.get("fault_domain_hint") or "other") in TARGET_DOMAINS for it in pool)
                best = min(
                    pool,
                    key=lambda x: (
                        1 if (has_tgt_dom and (x.get("fault_domain_hint") or "other") not in TARGET_DOMAINS) else 0,
                        sel_dom[x.get("fault_domain_hint") or "other"],
                        domain_rank.get(x.get("fault_domain_hint") or "other", len(domain_rank)),
                        -int(x.get("signal_score", 0)),
                        -int(bool(x.get("pr_diff_snippet"))),
                        -int(x.get("comments_count", 0)),
                        str(x.get("key") or ""),
                    ),
                )
                chosen_ids.add(id(best))
                selected.append(best)
                sel_dom[best.get("fault_domain_hint") or "other"] += 1
                sel_repo[rk] += 1
                progressed = True
                if len(selected) >= limit:
                    break
            if not progressed:
                break

    buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for it in items:
        if id(it) in chosen_ids:
            continue
        dom = it.get("fault_domain_hint") or "other"
        buckets[dom].append(it)
    for dom in buckets:
        buckets[dom].sort(
            key=lambda x: (
                -int(x.get("signal_score", 0)),
                -int(bool(x.get("pr_diff_snippet"))),
                -int(x.get("comments_count", 0)),
            )
        )

    domain_order = list(TARGET_DOMAINS) + ["other"]
    while len(selected) < limit:
        progressed = False
        for dom in domain_order:
            if dom == "other" and any(buckets[d] for d in TARGET_DOMAINS):
                continue
            if buckets[dom]:
                selected.append(buckets[dom].pop(0))
                progressed = True
                if len(selected) >= limit:
                    break
        if not progressed:
            break
    return selected


def finalize_record(item: dict[str, Any]) -> dict[str, Any]:
    title = item["title"]
    body = item["body"]
    comments_text = item.get("comments_text") or ""
    raw_sha256 = hashlib.sha256(f"{title}\n{body}\n{comments_text}".encode("utf-8")).hexdigest()
    diff_snippet = str(item.get("pr_diff_snippet") or "")
    diff_lines = parse_strict_nonneg_int(item.get("pr_diff_lines"), 0)
    if diff_snippet and not _section_has_diff_hunk(diff_snippet.split("\n")):
        diff_snippet = ""
        diff_lines = 0
    unbound_snippet = str(item.get("unbound_pr_diff_snippet") or "")
    unbound_lines = parse_strict_nonneg_int(item.get("unbound_pr_diff_lines"), 0)
    if unbound_snippet and not _section_has_diff_hunk(unbound_snippet.split("\n")):
        unbound_snippet = ""
        unbound_lines = 0
    raw_linked_prs = item.get("linked_merged_prs")
    linked_prs = [
        dict(lp)
        for lp in (raw_linked_prs if isinstance(raw_linked_prs, list) else [])
        if isinstance(lp, dict) and "@" not in str(lp.get("ref") or "")
    ]
    valid_lp_refs = {str(lp.get("ref") or "").strip() for lp in linked_prs if lp.get("ref")}
    source_ref = str(item.get("pr_diff_source_ref") or "").strip()
    if diff_snippet and (not source_ref or source_ref not in valid_lp_refs):
        if not unbound_snippet:
            unbound_snippet = diff_snippet
            unbound_lines = diff_lines or len(diff_snippet.split("\n"))
        diff_snippet = ""
        diff_lines = 0
        source_ref = ""
    elif not diff_snippet:
        source_ref = ""
    elif not diff_lines:
        diff_lines = len(diff_snippet.split("\n"))
    if unbound_snippet and not unbound_lines:
        unbound_lines = len(unbound_snippet.split("\n"))

    raw_direct_commits = item.get("linked_direct_commits")
    valid_direct_commits = [
        dict(dc)
        for dc in (raw_direct_commits if isinstance(raw_direct_commits, list) else [])
        if _is_self_consistent_direct_commit(dc)
    ]

    rec: dict[str, Any] = {
        "key": item["key"],
        "ecosystem": item["ecosystem"],
        "repo": item["repo"],
        "number": item["number"],
        "url": item["url"],
        "title": title,
        "state": "closed",
        "created_at": item.get("created_at"),
        **(
            {"updated_at": item["updated_at"]}
            if item.get("updated_at") is not None
            else {}
        ),
        "closed_at": item.get("closed_at"),
        **(
            {"state_verified_at": str(item["state_verified_at"])}
            if item.get("state_verified_at")
            else {}
        ),
        "observation_stale": bool(item.get("observation_stale", False)),
        "labels": (
            [str(l.get("name") or "") if isinstance(l, dict) else str(l) for l in item["labels"] if l]
            if isinstance(item.get("labels"), list)
            else []
        ),
        "comments_count": parse_strict_nonneg_int(item.get("comments_count"), 0),
        "comments_complete": bool(item.get("comments_complete")),
        "body": body,
        "comments_text": comments_text,
        "raw_sha256": raw_sha256,
        "fault_domain_hint": item.get("fault_domain_hint") or "other",
        "detected_error_codes": (
            list(item["detected_error_codes"])
            if isinstance(item.get("detected_error_codes"), list)
            else []
        ),
        "signal_score": parse_strict_nonneg_int(item.get("signal_score"), 0),
        "has_human_resolution_comment": bool(item.get("has_human_resolution_comment")),
        "candidate_prs": (
            list(item["candidate_prs"])
            if isinstance(item.get("candidate_prs"), list)
            else []
        ),
        "linked_merged_prs": linked_prs,
        **(
            {"linked_direct_commits": valid_direct_commits[:4]}
            if valid_direct_commits
            else {}
        ),
        "pr_diff_snippet": diff_snippet,
        "pr_diff_lines": diff_lines,
        **(
            {"pr_diff_source_ref": source_ref}
            if diff_snippet and source_ref
            else {}
        ),
        **(
            {
                "unbound_pr_diff_snippet": unbound_snippet,
                "unbound_pr_diff_lines": unbound_lines,
                **({"pr_diff_source_unbound": True} if not diff_snippet else {}),
            }
            if unbound_snippet
            else {}
        ),
    }
    _enforce_single_diff_owner(rec, source_ref or None)
    return rec


def _strict_json_pairs_hook(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    obj: dict[str, Any] = {}
    for k, v in pairs:
        if k in obj:
            raise ValueError(f"Duplicate JSON object key {k!r}")
        obj[k] = v
    return obj


def _reject_json_constant(const: str) -> Any:
    raise ValueError(f"Invalid non-standard JSON constant {const!r}")


def _reject_nonfinite_float(const: str) -> float:
    val = float(const)
    if not math.isfinite(val):
        raise ValueError(f"Non-finite JSON float literal {const!r}")
    return val


def load_jsonl_strict(path: Path) -> list[dict[str, Any]]:
    """Load JSONL splitting strictly on '\\n' (preserving U+2028/U+2029) and fail hard on corruption."""
    raw = path.read_text(encoding="utf-8")
    records: list[dict[str, Any]] = []
    seen_keys: set[str] = set()
    for line_no, raw_ln in enumerate(raw.split("\n"), start=1):
        if not raw_ln.strip():
            continue
        try:
            rec = json.loads(
                raw_ln,
                object_pairs_hook=_strict_json_pairs_hook,
                parse_constant=_reject_json_constant,
                parse_float=_reject_nonfinite_float,
            )
        except (json.JSONDecodeError, ValueError) as exc:
            raise RuntimeError(f"Corrupt JSONL at {path}:{line_no}: {exc}") from exc
        raw_key = rec.get("key") if isinstance(rec, dict) else None
        if not isinstance(rec, dict) or not isinstance(raw_key, str) or not raw_key.strip():
            raise RuntimeError(f"Invalid JSONL record missing valid string 'key' at {path}:{line_no}")
        k = raw_key.strip()
        if k in seen_keys:
            raise RuntimeError(f"Duplicate JSONL record key {k!r} at {path}:{line_no}")
        seen_keys.add(k)
        records.append(rec)
    return records


def _unique_tmp_path(target: Path) -> Path:
    return target.with_name(f".{target.name}.{os.getpid()}.{uuid.uuid4().hex[:8]}.tmp")


def _canonical_path_key(path: Path) -> str:
    return os.path.normcase(os.path.realpath(str(path)))


def _try_lock_fd(fd: int) -> bool:
    if os.name == "nt":
        import msvcrt

        try:
            os.lseek(fd, 0, os.SEEK_SET)
            msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
            return True
        except OSError:
            return False
    else:
        import fcntl

        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return True
        except OSError:
            return False


def _unlock_fd(fd: int) -> None:
    if os.name == "nt":
        import msvcrt

        try:
            os.lseek(fd, 0, os.SEEK_SET)
            msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
        except OSError:
            pass
    else:
        import fcntl

        try:
            fcntl.flock(fd, fcntl.LOCK_UN)
        except OSError:
            pass


def _acquire_path_lock(lock_path: Path, timeout_sec: float = 30.0):
    from contextlib import contextmanager

    @contextmanager
    def _mgr():
        lock_path.parent.mkdir(parents=True, exist_ok=True)
        fd = os.open(str(lock_path), os.O_CREAT | os.O_RDWR, 0o666)
        acquired = False
        deadline = time.monotonic() + timeout_sec
        try:
            while True:
                if _try_lock_fd(fd):
                    acquired = True
                    break
                if time.monotonic() >= deadline:
                    raise TimeoutError(f"Timed out acquiring lock {lock_path} after {timeout_sec}s")
                time.sleep(0.05)
            yield
        finally:
            if acquired:
                _unlock_fd(fd)
            try:
                os.close(fd)
            except OSError:
                pass

    return _mgr()


_RESERVED_SIDECAR_RE = re.compile(r"\.(?:lock|manifest\.json|gen-[0-9a-f]{12})$", re.IGNORECASE)


def _acquire_path_locks(lock_paths: list[Path], timeout_sec: float = 30.0):
    from contextlib import ExitStack, contextmanager

    ordered: list[Path] = []
    seen_keys: set[str] = set()
    for lp in sorted(lock_paths, key=_canonical_path_key):
        k = _canonical_path_key(lp)
        if k not in seen_keys:
            seen_keys.add(k)
            ordered.append(lp)

    @contextmanager
    def _mgr():
        with ExitStack() as stack:
            for lp in ordered:
                stack.enter_context(_acquire_path_lock(lp, timeout_sec=timeout_sec))
            yield

    return _mgr()


def _prune_old_generations(
    parent: Path,
    prefix: str,
    keep: int = 2,
    extra_manifest_dirs: tuple[Path, ...] = (),
) -> None:
    gen_pat = re.compile(rf"^{re.escape(prefix)}[0-9a-f]{{12}}$")
    protected_names: set[str] = set()
    for mdir in (parent, *extra_manifest_dirs):
        try:
            for mf in mdir.glob(".*.manifest.json"):
                try:
                    mdoc = json.loads(mf.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError, RecursionError, MemoryError, TypeError, ValueError):
                    continue
                if isinstance(mdoc, dict):
                    for k in ("primarySnapshot", "secondarySnapshot"):
                        v = mdoc.get(k)
                        if isinstance(v, str) and v.strip():
                            protected_names.add(Path(v).name)
        except OSError:
            pass
    try:
        matches = sorted(
            (p for p in parent.iterdir() if gen_pat.match(p.name)),
            key=lambda p: (p.stat().st_mtime, p.name),
            reverse=True,
        )
    except OSError:
        return
    for old_p in matches[keep:]:
        if old_p.name in protected_names:
            continue
        try:
            old_p.unlink(missing_ok=True)
        except OSError:
            pass


def _atomic_replace(src: Path, dst: Path) -> None:
    """Replace dst with src, retrying brief Windows AV/indexer sharing violations (WinError 5/32)."""
    for attempt in range(6):
        try:
            src.replace(dst)
            return
        except PermissionError as exc:
            if os.name == "nt" and getattr(exc, "winerror", None) in (5, 32) and attempt < 5:
                time.sleep(0.015 * (attempt + 1))
                continue
            raise


def _atomic_write_pair(
    primary_path: Path,
    primary_bytes: bytes,
    secondary_path: Path,
    secondary_bytes: Any,
    before_write_locked: Any = None,
    protected_input_paths: tuple[Path, ...] = (),
) -> None:
    """Publish two related outputs atomically under sorted cross-process locks with dual rollback & manifest."""
    if _canonical_path_key(primary_path) == _canonical_path_key(secondary_path):
        raise ValueError(f"Atomic pair targets must be distinct: {primary_path}")
    protected_keys = {_canonical_path_key(p) for p in protected_input_paths}
    if (
        _canonical_path_key(primary_path) in protected_keys
        or _canonical_path_key(secondary_path) in protected_keys
    ):
        raise ValueError(
            f"Atomic output path must not collide with protected input path: {primary_path}, {secondary_path}"
        )
    for target_p in (primary_path, secondary_path):
        if _RESERVED_SIDECAR_RE.search(target_p.name) or target_p.name.startswith(".") and (
            target_p.name.endswith(".manifest.json") or ".gen-" in target_p.name or target_p.name.endswith(".lock")
        ):
            raise ValueError(f"Output path collides with reserved atomic sidecar naming: {target_p}")
    primary_path.parent.mkdir(parents=True, exist_ok=True)
    secondary_path.parent.mkdir(parents=True, exist_ok=True)
    lock_primary = primary_path.with_name(f".{primary_path.name}.lock")
    lock_secondary = secondary_path.with_name(f".{secondary_path.name}.lock")
    gen_id = uuid.uuid4().hex[:12]
    snap_primary = primary_path.with_name(f".{primary_path.name}.gen-{gen_id}")
    snap_secondary = secondary_path.with_name(f".{secondary_path.name}.gen-{gen_id}")
    manifest_path = primary_path.with_name(f".{primary_path.name}.manifest.json")
    sec_manifest_path: Path | None = None
    if _canonical_path_key(primary_path.parent) != _canonical_path_key(secondary_path.parent):
        p_hash = hashlib.sha256(_canonical_path_key(primary_path).encode("utf-8")).hexdigest()[:8]
        sec_manifest_path = secondary_path.with_name(f".{secondary_path.name}.{p_hash}.manifest.json")
    for sidecar in (
        lock_primary,
        lock_secondary,
        snap_primary,
        snap_secondary,
        manifest_path,
        *( [sec_manifest_path] if sec_manifest_path is not None else [] ),
    ):
        sk = _canonical_path_key(sidecar)
        if sk in (_canonical_path_key(primary_path), _canonical_path_key(secondary_path)) or sk in protected_keys:
            raise ValueError(f"Requested path collides with internal atomic sidecar: {sidecar}")
    manifest_tmp = _unique_tmp_path(manifest_path)
    sec_manifest_tmp = _unique_tmp_path(sec_manifest_path) if sec_manifest_path is not None else None

    with _acquire_path_locks([lock_primary, lock_secondary]):
        if before_write_locked is not None:
            before_write_locked()
        sec_bytes: bytes = secondary_bytes() if callable(secondary_bytes) else secondary_bytes
        tmp_primary = _unique_tmp_path(primary_path)
        tmp_secondary = _unique_tmp_path(secondary_path)
        bak_primary: Path | None = None
        bak_secondary: Path | None = None
        bak_manifest: Path | None = None
        bak_sec_manifest: Path | None = None
        existed_primary = primary_path.exists()
        existed_secondary = secondary_path.exists()
        existed_manifest = manifest_path.exists()
        existed_sec_manifest = sec_manifest_path is not None and sec_manifest_path.exists()
        attempt_primary = False
        attempt_secondary = False
        attempt_manifest = False
        attempt_sec_manifest = False
        committed = False
        try:
            tmp_primary.write_bytes(primary_bytes)
            tmp_secondary.write_bytes(sec_bytes)
            snap_primary.write_bytes(primary_bytes)
            snap_secondary.write_bytes(sec_bytes)
            if existed_primary:
                bak_primary = _unique_tmp_path(primary_path)
                bak_primary.write_bytes(primary_path.read_bytes())
            if existed_secondary:
                bak_secondary = _unique_tmp_path(secondary_path)
                bak_secondary.write_bytes(secondary_path.read_bytes())
            if existed_manifest:
                bak_manifest = _unique_tmp_path(manifest_path)
                bak_manifest.write_bytes(manifest_path.read_bytes())
            if existed_sec_manifest and sec_manifest_path is not None:
                bak_sec_manifest = _unique_tmp_path(sec_manifest_path)
                bak_sec_manifest.write_bytes(sec_manifest_path.read_bytes())
            manifest_bytes = json.dumps(
                {
                    "generation": gen_id,
                    "primaryPath": os.path.abspath(str(primary_path)),
                    "primarySnapshot": os.path.abspath(str(snap_primary)),
                    "primarySha256": hashlib.sha256(primary_bytes).hexdigest(),
                    "secondaryPath": os.path.abspath(str(secondary_path)),
                    "secondarySnapshot": os.path.abspath(str(snap_secondary)),
                    "secondarySha256": hashlib.sha256(sec_bytes).hexdigest(),
                },
                ensure_ascii=False,
                indent=2,
                allow_nan=False,
            ).encode("utf-8")
            manifest_tmp.write_bytes(manifest_bytes)
            if sec_manifest_path is not None and sec_manifest_tmp is not None:
                sec_manifest_tmp.write_bytes(manifest_bytes)

            attempt_primary = True
            _atomic_replace(tmp_primary, primary_path)
            attempt_secondary = True
            _atomic_replace(tmp_secondary, secondary_path)
            attempt_manifest = True
            _atomic_replace(manifest_tmp, manifest_path)
            if sec_manifest_path is not None and sec_manifest_tmp is not None:
                attempt_sec_manifest = True
                _atomic_replace(sec_manifest_tmp, sec_manifest_path)
            committed = True
        except BaseException as exc:
            rollback_errors: list[str] = []
            need_rb_sec_man = attempt_sec_manifest and sec_manifest_tmp is not None and not sec_manifest_tmp.exists()
            need_rb_man = attempt_manifest and not manifest_tmp.exists()
            need_rb_sec = attempt_secondary and not tmp_secondary.exists()
            need_rb_pri = attempt_primary and not tmp_primary.exists()
            if not committed:
                if need_rb_sec_man and sec_manifest_path is not None:
                    if bak_sec_manifest is not None and bak_sec_manifest.exists():
                        try:
                            _atomic_replace(bak_sec_manifest, sec_manifest_path)
                        except OSError as rb_exc:
                            rollback_errors.append(f"restore {sec_manifest_path}: {rb_exc}")
                    elif not existed_sec_manifest:
                        try:
                            sec_manifest_path.unlink(missing_ok=True)
                        except OSError as rb_exc:
                            rollback_errors.append(f"unlink {sec_manifest_path}: {rb_exc}")
                if need_rb_man:
                    if bak_manifest is not None and bak_manifest.exists():
                        try:
                            _atomic_replace(bak_manifest, manifest_path)
                        except OSError as rb_exc:
                            rollback_errors.append(f"restore {manifest_path}: {rb_exc}")
                    elif not existed_manifest:
                        try:
                            manifest_path.unlink(missing_ok=True)
                        except OSError as rb_exc:
                            rollback_errors.append(f"unlink {manifest_path}: {rb_exc}")
                if need_rb_sec:
                    if bak_secondary is not None and bak_secondary.exists():
                        try:
                            _atomic_replace(bak_secondary, secondary_path)
                        except OSError as rb_exc:
                            rollback_errors.append(f"restore {secondary_path}: {rb_exc}")
                    elif not existed_secondary:
                        try:
                            secondary_path.unlink(missing_ok=True)
                        except OSError as rb_exc:
                            rollback_errors.append(f"unlink {secondary_path}: {rb_exc}")
                if need_rb_pri:
                    if bak_primary is not None and bak_primary.exists():
                        try:
                            _atomic_replace(bak_primary, primary_path)
                        except OSError as rb_exc:
                            rollback_errors.append(f"restore {primary_path}: {rb_exc}")
                    elif not existed_primary:
                        try:
                            primary_path.unlink(missing_ok=True)
                        except OSError as rb_exc:
                            rollback_errors.append(f"unlink {primary_path}: {rb_exc}")
                if not rollback_errors:
                    snap_primary.unlink(missing_ok=True)
                    snap_secondary.unlink(missing_ok=True)
            tmp_primary.unlink(missing_ok=True)
            tmp_secondary.unlink(missing_ok=True)
            manifest_tmp.unlink(missing_ok=True)
            if sec_manifest_tmp is not None:
                sec_manifest_tmp.unlink(missing_ok=True)
            if not rollback_errors:
                if bak_primary is not None and not need_rb_pri:
                    bak_primary.unlink(missing_ok=True)
                if bak_secondary is not None and not need_rb_sec:
                    bak_secondary.unlink(missing_ok=True)
                if bak_manifest is not None and not need_rb_man:
                    bak_manifest.unlink(missing_ok=True)
                if bak_sec_manifest is not None and not need_rb_sec_man:
                    bak_sec_manifest.unlink(missing_ok=True)
            if rollback_errors:
                raise RuntimeError(
                    f"Atomic publish failed ({exc!r}) AND rollback failed ({'; '.join(rollback_errors)})"
                ) from exc
            raise
        try:
            if bak_primary is not None:
                bak_primary.unlink(missing_ok=True)
            if bak_secondary is not None:
                bak_secondary.unlink(missing_ok=True)
            if bak_manifest is not None:
                bak_manifest.unlink(missing_ok=True)
            if bak_sec_manifest is not None:
                bak_sec_manifest.unlink(missing_ok=True)
            _prune_old_generations(
                primary_path.parent,
                f".{primary_path.name}.gen-",
                keep=2,
                extra_manifest_dirs=(secondary_path.parent,),
            )
            _prune_old_generations(
                secondary_path.parent,
                f".{secondary_path.name}.gen-",
                keep=2,
                extra_manifest_dirs=(primary_path.parent,),
            )
        except Exception:
            pass


class _SiblingSummaryOwnershipConflict(Exception):
    pass


def _inspect_summary_owner_conflict(cand_path: Path, expected_out_k: str) -> str | None:
    """Return conflicting path or reason if unreadable, non-dict, corpus-record, duplicate-keyed, invalid, relative-owned, missing-owner, or foreign-owned."""
    if not cand_path.exists():
        return None
    try:
        cand_data = json.loads(
            cand_path.read_text(encoding="utf-8"),
            object_pairs_hook=_strict_json_pairs_hook,
            parse_constant=_reject_json_constant,
            parse_float=_reject_nonfinite_float,
        )
    except (OSError, json.JSONDecodeError, RecursionError, MemoryError, TypeError, ValueError) as exc:
        return f"unreadable/corrupt summary ({type(exc).__name__})"
    if not isinstance(cand_data, dict):
        return f"unexpected summary JSON type ({type(cand_data).__name__})"
    if "key" in cand_data:
        return "unexpected JSONL corpus record (contains 'key')"
    owners: list[str] = []
    for key_name in ("jsonlPath", "outPath"):
        raw_val = cand_data.get(key_name)
        if raw_val is None or raw_val == "":
            continue
        if not isinstance(raw_val, str):
            return f"invalid {key_name} owner type ({type(raw_val).__name__})"
        raw_p = raw_val.strip()
        if not raw_p:
            continue
        if "\x00" in raw_p:
            return f"invalid {key_name} path (embedded NUL byte)"
        try:
            p_obj = Path(raw_p)
            if not p_obj.is_absolute():
                return f"ambiguous relative {key_name}: {raw_p!r}"
            cand_k = _canonical_path_key(p_obj)
        except (OSError, ValueError) as exc:
            return f"invalid {key_name} path ({type(exc).__name__})"
        if cand_k != expected_out_k:
            return raw_p
        owners.append(raw_p)
    if not owners:
        return "summary missing explicit owner path (jsonlPath/outPath)"
    return None


def repair_provenance_only(
    in_jsonl: str,
    out_jsonl: str,
    vllm_ascend_repo: str,
    vllm_repo: str,
    summary_out: str | None = None,
    allow_partial: bool = False,
) -> dict[str, Any]:
    """Deterministically backfill pr_diff_source_ref and has_diff without altering text fields or raw_sha256."""
    in_path = Path(in_jsonl)
    out_path = Path(out_jsonl)
    in_k = _canonical_path_key(in_path)
    out_k = _canonical_path_key(out_path)

    def _in_collides_with_output_sidecar(cand_sum: Path) -> bool:
        in_p_key = _canonical_path_key(in_path.parent)
        in_name = in_path.name
        checks = [
            out_path.with_name(f".{out_path.name}.lock"),
            cand_sum.with_name(f".{cand_sum.name}.lock"),
            out_path.with_name(f".{out_path.name}.manifest.json"),
        ]
        if _canonical_path_key(out_path.parent) != _canonical_path_key(cand_sum.parent):
            p_hash = hashlib.sha256(out_k.encode("utf-8")).hexdigest()[:8]
            checks.append(cand_sum.with_name(f".{cand_sum.name}.{p_hash}.manifest.json"))
        if in_k in {_canonical_path_key(c) for c in checks}:
            return True
        for target_p in (out_path, cand_sum):
            if in_p_key == _canonical_path_key(target_p.parent) and re.fullmatch(
                rf"\.{re.escape(target_p.name)}\.gen-[0-9a-f]{{12}}", in_name, re.IGNORECASE
            ):
                return True
        return False

    def _valid_distinct_summary_cand(cand_path: Path) -> bool:
        return (
            len({in_k, out_k, _canonical_path_key(cand_path)}) == 3
            and not _in_collides_with_output_sidecar(cand_path)
        )

    auto_candidates: list[Path] = []
    if summary_out is not None:
        paired_summary_path = Path(summary_out)
    else:
        cand_prov = out_path.with_suffix(".provenance.json")
        cand_jsonl_prov = out_path.with_name(f"{out_path.name}.provenance.json")
        if out_k == _canonical_path_key(Path(DEFAULT_OUT_JSONL)):
            raw_cands = [Path(DEFAULT_OUT_SUMMARY), cand_prov, cand_jsonl_prov]
        else:
            cand_summary = out_path.with_name(f"{out_path.stem}.summary.json")
            raw_cands = []
            if cand_summary.exists() and _inspect_summary_owner_conflict(cand_summary, out_k) is None:
                raw_cands.append(cand_summary)
            raw_cands.extend([cand_prov, cand_jsonl_prov])
        seen_ck: set[str] = set()
        for cp in raw_cands:
            ck = _canonical_path_key(cp)
            if ck in seen_ck or not _valid_distinct_summary_cand(cp):
                continue
            seen_ck.add(ck)
            auto_candidates.append(cp)
        paired_summary_path = next(
            (cp for cp in auto_candidates if _inspect_summary_owner_conflict(cp, out_k) is None),
            auto_candidates[0] if auto_candidates else cand_jsonl_prov,
        )

    sum_k = _canonical_path_key(paired_summary_path)
    if len({in_k, out_k, sum_k}) < 3 or _in_collides_with_output_sidecar(paired_summary_path):
        raise ValueError(
            f"Input JSONL, output JSONL, and provenance summary (with sidecars) must all be distinct: "
            f"in={in_path}, out={out_path}, summary={paired_summary_path}"
        )

    initial_in_sha256 = hashlib.sha256(in_path.read_bytes()).hexdigest()
    initial_out_existed = out_path.exists()
    initial_out_sha256 = hashlib.sha256(out_path.read_bytes()).hexdigest() if initial_out_existed else None
    rows = load_jsonl_strict(in_path)
    if hashlib.sha256(in_path.read_bytes()).hexdigest() != initial_in_sha256:
        raise RuntimeError(
            f"Concurrent modification detected on input {in_path} while loading; refusing to overwrite."
        )
    local_indexes = {
        "vllm-project/vllm-ascend": LocalGitIndex("vllm-project/vllm-ascend", vllm_ascend_repo),
        "vllm-project/vllm": LocalGitIndex("vllm-project/vllm", vllm_repo),
    }
    if not allow_partial:
        for repo_slug, repo_arg in (
            ("vllm-project/vllm-ascend", vllm_ascend_repo),
            ("vllm-project/vllm", vllm_repo),
        ):
            idx_obj = local_indexes[repo_slug]
            if Path(repo_arg).exists() and (not idx_obj.available or idx_obj.git_errors):
                raise RuntimeError(
                    f"Local git index error for {repo_slug} at {repo_arg}: "
                    f"identity_error={idx_obj.identity_error!r}, git_errors={idx_obj.git_errors[:2]!r} "
                    "(pass --allow-partial to override)."
                )

    status_counts: Counter[str] = Counter()
    repaired_rows: list[dict[str, Any]] = []
    for row in rows:
        rec = dict(row)
        raw_row_lps = row.get("linked_merged_prs")
        rec["linked_merged_prs"] = [
            dict(lp)
            for lp in (raw_row_lps if isinstance(raw_row_lps, list) else [])
            if isinstance(lp, dict)
        ]
        orig_guard = (rec.get("title"), rec.get("body"), rec.get("comments_text"), rec.get("raw_sha256"))
        _, status = rebind_diff_provenance(rec, local_indexes)
        status_counts[status] += 1
        if (rec.get("title"), rec.get("body"), rec.get("comments_text"), rec.get("raw_sha256")) != orig_guard:
            raise AssertionError(f"Provenance repair mutated immutable text/hash on {rec.get('key')}")
        repaired_rows.append(rec)

    if not allow_partial:
        for idx_obj in local_indexes.values():
            if idx_obj.git_errors:
                raise RuntimeError(
                    f"Provenance repair hit git errors on {idx_obj.repo_slug}: {idx_obj.git_errors[:2]!r} "
                    "(pass --allow-partial to override)."
                )

    jsonl_bytes = ("\n".join(json.dumps(r, ensure_ascii=False, allow_nan=False) for r in repaired_rows) + "\n").encode("utf-8")
    out_sha = hashlib.sha256(jsonl_bytes).hexdigest()
    bound_cnt = sum(1 for r in repaired_rows if r.get("pr_diff_source_ref"))
    unbound_cnt = sum(1 for r in repaired_rows if r.get("pr_diff_source_unbound"))
    with_diff_cnt = sum(1 for r in repaired_rows if r.get("pr_diff_snippet"))
    with_unbound_cnt = sum(1 for r in repaired_rows if r.get("unbound_pr_diff_snippet"))
    by_eco = Counter(str(r.get("ecosystem") or "") for r in repaired_rows if r.get("ecosystem"))
    by_repo = Counter(str(r.get("repo") or "") for r in repaired_rows if r.get("repo"))
    by_domain = Counter(str(r.get("fault_domain_hint") or "other") for r in repaired_rows)

    def _build_prov_summary(target_sum: Path, *, check_ownership: bool) -> tuple[dict[str, Any], bytes]:
        in_path_abs = os.path.abspath(str(in_path))
        out_path_abs = os.path.abspath(str(out_path))
        base: dict[str, Any] = {
            "mode": "repair_provenance_only",
            "inPath": in_path_abs,
            "outPath": out_path_abs,
            "totalItems": len(repaired_rows),
            "byEcosystem": dict(sorted(by_eco.items())),
            "byRepo": dict(sorted(by_repo.items())),
            "byFaultDomain": dict(sorted(by_domain.items())),
            "withDiffCount": with_diff_cnt,
            "withUnboundPrDiffCount": with_unbound_cnt,
            "boundDiffCount": bound_cnt,
            "unboundDiffCount": unbound_cnt,
            "statusCounts": dict(sorted(status_counts.items())),
            "outSha256": out_sha,
        }
        if target_sum.exists():
            conflict_p = _inspect_summary_owner_conflict(target_sum, out_k)
            if check_ownership and conflict_p:
                raise _SiblingSummaryOwnershipConflict(conflict_p)
            existing_sum: Any = None
            if not conflict_p:
                try:
                    existing_sum = json.loads(
                        target_sum.read_text(encoding="utf-8"),
                        object_pairs_hook=_strict_json_pairs_hook,
                        parse_constant=_reject_json_constant,
                        parse_float=_reject_nonfinite_float,
                    )
                except (OSError, json.JSONDecodeError, RecursionError, MemoryError, TypeError, ValueError):
                    existing_sum = None
            if isinstance(existing_sum, dict) and not conflict_p and existing_sum.get("mode") != "repair_provenance_only":
                merged_sum = dict(existing_sum)
                merged_sum.update(
                    {
                        "jsonlPath": out_path_abs,
                        "totalItems": len(repaired_rows),
                        "jsonlBytes": len(jsonl_bytes),
                        "jsonlSha256": out_sha,
                        "byEcosystem": dict(sorted(by_eco.items())),
                        "byRepo": dict(sorted(by_repo.items())),
                        "byFaultDomain": dict(sorted(by_domain.items())),
                        "withPrDiffCount": with_diff_cnt,
                        "withUnboundPrDiffCount": with_unbound_cnt,
                        "staleObservationCount": sum(1 for r in repaired_rows if r.get("observation_stale")),
                        "withLinkedMergedPrCount": sum(1 for r in repaired_rows if r.get("linked_merged_prs")),
                        "withLinkedDirectCommitCount": sum(1 for r in repaired_rows if r.get("linked_direct_commits")),
                        "withHumanResolutionCommentCount": sum(
                            1 for r in repaired_rows if r.get("has_human_resolution_comment")
                        ),
                        "withConcreteErrorCodeCount": sum(
                            1 for r in repaired_rows if r.get("detected_error_codes")
                        ),
                        "boundDiffCount": bound_cnt,
                        "unboundDiffCount": unbound_cnt,
                        "provenanceRepairStatusCounts": dict(sorted(status_counts.items())),
                    }
                )
                base = merged_sum
        return base, (json.dumps(base, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")

    attempt_cands = (
        [paired_summary_path]
        if summary_out is not None
        else auto_candidates[auto_candidates.index(paired_summary_path) :]
    )
    last_conflict: _SiblingSummaryOwnershipConflict | None = None
    for cand_sum_path in attempt_cands:
        if len({in_k, out_k, _canonical_path_key(cand_sum_path)}) < 3:
            continue
        if _in_collides_with_output_sidecar(cand_sum_path):
            if summary_out is not None:
                raise ValueError(
                    f"Input JSONL {in_path} collides with atomic output sidecar for {out_path} / {cand_sum_path}"
                )
            continue
        holder: dict[str, Any] = {}

        def _check_summary_locked(target_path: Path = cand_sum_path, out_holder: dict[str, Any] = holder) -> None:
            if not in_path.exists() or hashlib.sha256(in_path.read_bytes()).hexdigest() != initial_in_sha256:
                raise RuntimeError(
                    f"Concurrent modification detected on input {in_path} during provenance repair; refusing to overwrite."
                )
            cur_out_exists = out_path.exists()
            if initial_out_existed:
                if not cur_out_exists or hashlib.sha256(out_path.read_bytes()).hexdigest() != initial_out_sha256:
                    raise RuntimeError(
                        f"Concurrent modification detected on {out_path} during provenance repair; refusing to overwrite newer commit."
                    )
            elif cur_out_exists:
                raise RuntimeError(
                    f"Concurrent modification detected: {out_path} was created by another run during provenance repair; refusing to overwrite."
                )
            fresh_sum, fresh_bytes = _build_prov_summary(
                target_path,
                check_ownership=(summary_out is None),
            )
            out_holder["summary"] = fresh_sum
            out_holder["bytes"] = fresh_bytes

        try:
            _atomic_write_pair(
                out_path,
                jsonl_bytes,
                cand_sum_path,
                lambda h=holder: h["bytes"],
                before_write_locked=_check_summary_locked,
                protected_input_paths=(in_path,),
            )
            return holder["summary"]
        except _SiblingSummaryOwnershipConflict as exc:
            last_conflict = exc
            continue
    raise RuntimeError(
        f"Refusing to overwrite sibling provenance summary owned by another corpus: {last_conflict}"
    )


def _revalidate_gitcode_item(item: dict[str, Any]) -> dict[str, Any] | None:
    if str(item.get("state") or "").lower() != "closed":
        return None
    repo = str(item.get("repo") or "").strip()
    num = parse_strict_positive_int(item.get("number"))
    if not repo or num is None or str(item.get("key") or "") != f"gitcode:{repo}#{num}":
        return None
    canonical_url = validate_repo_item_url(item.get("url"), "gitcode.com", repo, "issues", num)
    if item.get("url") and canonical_url is None:
        return None
    title = str(item.get("title") or "").strip()
    body = str(item.get("body") or "")[:7500]
    if len(body) < 140:
        return None
    comments_text = str(item.get("comments_text") or "")
    raw_labels = item.get("labels")
    labels = (
        [str(l.get("name") or "") if isinstance(l, dict) else str(l) for l in raw_labels if l]
        if isinstance(raw_labels, list)
        else []
    )
    if is_non_bug_issue(title, labels):
        return None
    if not has_concrete_verifiable_log_line(title, body, comments_text):
        return None
    item = dict(item)
    item.pop("_comment_fetch_ok", None)
    item.pop("_linked_prs_authoritative", None)
    item.pop("_rejected_mr_refs", None)
    item["number"] = num
    item["url"] = canonical_url or f"https://gitcode.com/{repo}/issues/{num}"
    item["state"] = "closed"
    item["labels"] = labels
    item["body"] = body
    raw_res = item.get("has_human_resolution_comment")
    valid_res = _validate_cached_human_resolution(comments_text)
    if isinstance(raw_res, bool):
        item["has_human_resolution_comment"] = bool(raw_res and valid_res)
    else:
        item["has_human_resolution_comment"] = valid_res
    item.pop("linked_direct_commits", None)
    full_text = f"{title}\n{body}\n{comments_text}"
    codes = extract_error_codes(full_text)
    domain = classify_fault_domain(repo, title, body, comments_text)
    raw_linked = item.get("linked_merged_prs")
    linked = [
        dict(lp)
        for lp in (raw_linked if isinstance(raw_linked, list) else [])
        if _is_valid_gitcode_linked_pr(lp)
    ]
    diff_snippet = str(item.get("pr_diff_snippet") or "")
    if diff_snippet and not _section_has_diff_hunk(diff_snippet.split("\n")):
        diff_snippet = ""
    item["linked_merged_prs"] = linked
    item["pr_diff_snippet"] = diff_snippet
    item["pr_diff_lines"] = len(diff_snippet.split("\n")) if diff_snippet else 0
    rebind_diff_provenance(item, {})
    diff_snippet = str(item.get("pr_diff_snippet") or "")
    if "observation_stale" not in item:
        item["observation_stale"] = True
    if not (
        item.get("linked_merged_prs")
        or item.get("has_human_resolution_comment")
    ):
        return None
    item["detected_error_codes"] = codes
    item["fault_domain_hint"] = domain
    item["signal_score"] = (
        (6 if diff_snippet else (4 if item.get("linked_merged_prs") else 0))
        + (3 if item.get("has_human_resolution_comment") else 0)
        + (3 + min(len(codes), 3) if codes else 0)
        + (2 if PLOG_OR_TRACE_RE.search(body) else 0)
    )
    return item


def _merge_gitcode_reused_rows(
    cached_gc: list[dict[str, Any]],
    fresh_gc: list[dict[str, Any]],
    target_gitcode: int,
    disqualified_keys: set[str] | None = None,
    fresh_observations_by_key: dict[str, dict[str, Any]] | None = None,
    repo_floors: dict[tuple[str, str], int] | None = None,
) -> list[dict[str, Any]]:
    merged_by_key: dict[str, dict[str, Any]] = {}
    disq_lower = {str(k).strip().lower() for k in (disqualified_keys or set()) if str(k).strip()}
    for rec in cached_gc:
        k = str(rec.get("key") or "")
        kl = k.lower()
        if kl and kl not in disq_lower:
            c_copy = dict(rec)
            c_copy["observation_stale"] = True
            merged_by_key[kl] = c_copy
    fresh_keys_l = {
        str(r.get("key") or "").strip().lower()
        for r in fresh_gc
        if str(r.get("key") or "").strip()
    }
    obs_rows = [
        obs
        for k, obs in (fresh_observations_by_key or {}).items()
        if k and k.lower() not in fresh_keys_l and k.lower() in merged_by_key
    ]
    for rec in list(fresh_gc) + obs_rows:
        k = str(rec.get("key") or "")
        kl = k.lower()
        if not kl:
            continue
        prev = merged_by_key.get(kl)
        if prev is None:
            merged_by_key[kl] = rec
            continue
        merged = dict(rec)
        merged["observation_stale"] = False
        # Preserve cached comments ONLY if fresh scrape failed to retrieve comments and metadata matches
        same_updated = merged.get("updated_at") is not None and merged.get("updated_at") == prev.get("updated_at")
        same_cnt = parse_strict_nonneg_int(merged.get("comments_count"), 0) == parse_strict_nonneg_int(
            prev.get("comments_count"), -1
        )
        if (
            not merged.get("_comment_fetch_ok", True)
            and parse_strict_nonneg_int(merged.get("comments_count"), 0) > 0
            and not merged.get("comments_text")
            and prev.get("comments_text")
            and same_updated
            and same_cnt
        ):
            merged["comments_text"] = prev["comments_text"]
            merged["comments_complete"] = prev.get("comments_complete") is True
            merged["has_human_resolution_comment"] = bool(
                prev.get("has_human_resolution_comment") is True
                and _validate_cached_human_resolution(str(prev.get("comments_text") or ""))
            )

        fresh_text = f"{merged.get('title') or ''}\n{merged.get('body') or ''}\n{merged.get('comments_text') or ''}"
        mr_refs_info = extract_gitcode_mr_refs(
            str(merged.get("repo") or ""),
            int(merged.get("number") or 0),
            fresh_text,
        )
        cited_mr_refs = {f"gitcode:{mr_repo}!{mr_num}" for mr_repo, mr_num, _ in mr_refs_info}
        affirmative_mr_refs = {f"gitcode:{mr_repo}!{mr_num}" for mr_repo, mr_num, aff in mr_refs_info if aff}
        affirmative_mr_refs_lower = {r.lower() for r in affirmative_mr_refs}
        disclaimed_only_lower = (
            extract_gitcode_disclaimed_mr_refs(str(merged.get("repo") or ""), fresh_text)
            - affirmative_mr_refs_lower
        )
        raw_prev_lp = prev.get("linked_merged_prs")
        prev_linked = [
            dict(lp)
            for lp in (raw_prev_lp if isinstance(raw_prev_lp, list) else [])
            if _is_valid_gitcode_linked_pr(lp)
        ]
        raw_fresh_lp = merged.get("linked_merged_prs")
        fresh_linked = [
            dict(lp)
            for lp in (raw_fresh_lp if isinstance(raw_fresh_lp, list) else [])
            if _is_valid_gitcode_linked_pr(lp)
        ]
        links_authoritative = bool(merged.get("_linked_prs_authoritative"))
        rejected_refs_lower = {
            str(r).strip().lower() for r in (merged.get("_rejected_mr_refs") or []) if str(r).strip()
        }
        blocked_refs_lower = rejected_refs_lower | disclaimed_only_lower
        if not links_authoritative and blocked_refs_lower:
            fresh_linked = [
                lp for lp in fresh_linked if str(lp.get("ref") or "").strip().lower() not in blocked_refs_lower
            ]
        fresh_by_ref_l = {
            str(lp.get("ref") or "").strip().lower(): lp
            for lp in fresh_linked
            if str(lp.get("ref") or "").strip()
        }
        for p_lp in prev_linked:
            p_ref = str(p_lp.get("ref") or "").strip()
            if not p_ref or p_ref.lower() in blocked_refs_lower:
                continue
            if links_authoritative:
                still_valid = (p_lp.get("source") != "gitcode_linked_pr") and (
                    p_ref.lower() in affirmative_mr_refs_lower
                )
            else:
                still_valid = (p_lp.get("source") == "gitcode_linked_pr") or (
                    p_ref.lower() in affirmative_mr_refs_lower
                )
            if not still_valid:
                continue
            if p_ref.lower() in fresh_by_ref_l:
                tgt = fresh_by_ref_l[p_ref.lower()]
                for fk, fv in p_lp.items():
                    if fk == "has_diff":
                        continue
                    if fv not in (None, "") and not tgt.get(fk):
                        tgt[fk] = fv
            else:
                cp_lp = dict(p_lp)
                cp_lp.pop("has_diff", None)
                fresh_linked.append(cp_lp)
        merged["linked_merged_prs"] = fresh_linked

        raw_cands = merged.get("candidate_prs")
        fresh_cands = [
            str(c) for c in (raw_cands if isinstance(raw_cands, list) else []) if c
        ]
        for ref_c in sorted(cited_mr_refs):
            if ref_c not in fresh_cands:
                fresh_cands.append(ref_c)
        merged["candidate_prs"] = fresh_cands[:10]

        prev_bound = str(prev.get("pr_diff_snippet") or "")
        prev_unbound = str(prev.get("unbound_pr_diff_snippet") or "")
        prev_diff = prev_bound or prev_unbound
        archived_gc_unbound = ""
        archived_gc_unbound_lines = 0
        if same_updated and prev_unbound.strip():
            archived_gc_unbound = prev_unbound
            archived_gc_unbound_lines = (
                parse_strict_nonneg_int(prev.get("unbound_pr_diff_lines"), 0)
                or len(prev_unbound.split("\n"))
            )
        elif (
            same_updated
            and prev_bound.strip()
            and not str(prev.get("pr_diff_source_ref") or "").strip()
        ):
            archived_gc_unbound = prev_bound
            archived_gc_unbound_lines = (
                parse_strict_nonneg_int(prev.get("pr_diff_lines"), 0)
                or len(prev_bound.split("\n"))
            )
        if not merged.get("pr_diff_snippet") and prev_diff:
            active_refs_lower = {
                str(lp.get("ref") or "").strip().lower(): str(lp.get("ref") or "").strip()
                for lp in fresh_linked
                if lp.get("ref")
            }
            p_src = str(prev.get("pr_diff_source_ref") or "").strip()
            if p_src and p_src.lower() not in blocked_refs_lower and p_src.lower() in active_refs_lower:
                merged["pr_diff_snippet"] = prev_diff
                merged["pr_diff_lines"] = len(prev_diff.split("\n"))
                merged["pr_diff_source_ref"] = active_refs_lower[p_src.lower()]
                _clear_unbound_diff_fields(merged)
            elif same_updated and (not p_src or p_src.lower() not in blocked_refs_lower):
                _set_unbound_diff_fields(merged, prev_diff, len(prev_diff.split("\n")))
        if archived_gc_unbound and _section_has_diff_hunk(archived_gc_unbound.split("\n")):
            if merged.get("pr_diff_snippet"):
                if archived_gc_unbound != merged.get("pr_diff_snippet"):
                    ca_seqs = _extract_file_hunk_seqs(archived_gc_unbound.split("\n"))
                    if not ca_seqs or not _match_ordered_diff(ca_seqs, str(merged["pr_diff_snippet"])):
                        merged["unbound_pr_diff_snippet"] = archived_gc_unbound
                        merged["unbound_pr_diff_lines"] = archived_gc_unbound_lines
            elif same_updated:
                cur_u = str(merged.get("unbound_pr_diff_snippet") or "")
                if not cur_u.strip():
                    _set_unbound_diff_fields(merged, archived_gc_unbound, archived_gc_unbound_lines)
                elif cur_u != archived_gc_unbound:
                    arch_seqs = _extract_file_hunk_seqs(archived_gc_unbound.split("\n"))
                    if not arch_seqs or not _match_ordered_diff(arch_seqs, cur_u):
                        comb_u = f"{cur_u.rstrip(chr(10))}\n{archived_gc_unbound}"
                        _set_unbound_diff_fields(merged, comb_u, len(comb_u.split("\n")))
        rebind_diff_provenance(merged, {})
        merged_by_key[kl] = merged

    revalidated = _dedup_raw_candidates(
        sorted(
            (
                r
                for r in (_revalidate_gitcode_item(v) for v in merged_by_key.values())
                if r is not None
            ),
            key=lambda x: (
                -int(x.get("signal_score", 0)),
                -int(bool(x.get("pr_diff_snippet"))),
                -int(x.get("comments_count", 0)),
                1 if x.get("observation_stale") else 0,
                str(x.get("key") or ""),
            ),
        )
    )
    if len(revalidated) > target_gitcode:
        return stratified_select(revalidated, target_gitcode, repo_floors=repo_floors)
    return revalidated


def _compute_coverage_floors(
    locked_rows: list[dict[str, Any]],
    *,
    target_github_ascend: int,
    target_github_vllm: int,
    target_gitcode: int,
    max_total: int,
) -> tuple[dict[str, int], dict[tuple[str, str], int]]:
    gh_target = target_github_ascend + target_github_vllm
    l_eco = Counter(str(r.get("ecosystem") or "").strip().lower() for r in locked_rows)
    l_gh_repo = Counter(
        str(r.get("repo") or "").strip().lower()
        for r in locked_rows
        if str(r.get("ecosystem") or "").strip().lower() == "github"
    )
    l_gc_repo = Counter(
        str(r.get("repo") or "").strip().lower()
        for r in locked_rows
        if str(r.get("ecosystem") or "").strip().lower() == "gitcode"
    )
    active_ecos = sum(
        1
        for eco_name, eco_tgt in (("github", gh_target), ("gitcode", target_gitcode))
        if eco_tgt > 0 and l_eco.get(eco_name, 0) > 0
    )
    active_gh_repos = [
        (slug.lower(), tgt)
        for slug, tgt in (
            ("vllm-project/vllm-ascend", target_github_ascend),
            ("vllm-project/vllm", target_github_vllm),
        )
        if tgt > 0 and l_gh_repo.get(slug.lower(), 0) > 0
    ]
    active_gc_repos = (
        [(r, c) for r, c in l_gc_repo.items() if r and c > 0]
        if target_gitcode > 0 and l_eco.get("gitcode", 0) > 0
        else []
    )
    total_active_repos = len(active_gh_repos) + len(active_gc_repos)
    allow_eco_min1 = max_total >= active_ecos
    allow_repo_min1 = max_total >= total_active_repos
    scale = min(1.0, max_total / max(1, gh_target + target_gitcode))

    eco_floors: dict[str, int] = {}
    repo_floors: dict[tuple[str, str], int] = {}
    if gh_target > 0 and l_eco.get("github", 0) > 0:
        floor_gh = int(0.5 * min(l_eco["github"], gh_target) * scale)
        if allow_eco_min1:
            floor_gh = max(1, floor_gh)
        if floor_gh > 0:
            eco_floors["github"] = floor_gh
    effective_gh_cap = min(gh_target, max_total)
    for repo_slug, repo_tgt in active_gh_repos:
        floor_r = int(0.5 * min(l_gh_repo[repo_slug], repo_tgt) * scale)
        if allow_repo_min1 and effective_gh_cap >= len(active_gh_repos):
            floor_r = max(1, floor_r)
        if floor_r > 0:
            repo_floors[("github", repo_slug)] = floor_r

    if target_gitcode > 0 and l_eco.get("gitcode", 0) > 0:
        floor_gc = int(0.5 * min(l_eco["gitcode"], target_gitcode) * scale)
        if allow_eco_min1:
            floor_gc = max(1, floor_gc)
        if floor_gc > 0:
            eco_floors["gitcode"] = floor_gc
        effective_gc_cap = min(target_gitcode, max_total)
        gc_scale = scale * min(1.0, effective_gc_cap / max(1, l_eco["gitcode"]))
        for gc_repo, gc_prev in active_gc_repos:
            floor_gc_r = int(0.5 * gc_prev * gc_scale)
            if allow_repo_min1 and effective_gc_cap >= len(active_gc_repos) and gc_prev >= 1:
                floor_gc_r = max(1, floor_gc_r)
            if floor_gc_r > 0:
                repo_floors[("gitcode", gc_repo)] = floor_gc_r
    return eco_floors, repo_floors


def _select_with_coverage_floors(
    items: list[dict[str, Any]],
    limit: int,
    *,
    existing_rows: list[dict[str, Any]],
    target_github_ascend: int,
    target_github_vllm: int,
    target_gitcode: int,
    allow_partial: bool,
) -> list[dict[str, Any]]:
    """Select up to `limit` items preserving ecosystem/repo coverage floors while balancing domains."""
    if limit <= 0:
        return []
    items = _dedup_raw_candidates(items)
    if len(items) <= limit:
        return list(items)

    gh_target = target_github_ascend + target_github_vllm
    if existing_rows and not allow_partial:
        eco_floors, repo_floors = _compute_coverage_floors(
            existing_rows,
            target_github_ascend=target_github_ascend,
            target_github_vllm=target_github_vllm,
            target_gitcode=target_gitcode,
            max_total=limit,
        )
    else:
        eco_floors = {}
        repo_floors = {}
        avail_ecos = [
            e
            for e, tgt in (("github", gh_target), ("gitcode", target_gitcode))
            if tgt > 0 and any(str(it.get("ecosystem") or "").strip().lower() == e for it in items)
        ]
        if limit >= len(avail_ecos):
            for e in avail_ecos:
                eco_floors[e] = 1

    domain_rank = {dom: idx for idx, dom in enumerate(list(TARGET_DOMAINS) + ["other"])}
    selected: list[dict[str, Any]] = []
    chosen_ids: set[int] = set()
    sel_dom: Counter[str] = Counter()
    sel_eco: Counter[str] = Counter()
    sel_repo: Counter[tuple[str, str]] = Counter()

    def _pick_best(pool: list[dict[str, Any]]) -> dict[str, Any] | None:
        if not pool:
            return None
        has_target_dom = any((it.get("fault_domain_hint") or "other") in TARGET_DOMAINS for it in pool)
        best = min(
            pool,
            key=lambda x: (
                1 if (has_target_dom and (x.get("fault_domain_hint") or "other") not in TARGET_DOMAINS) else 0,
                sel_dom[x.get("fault_domain_hint") or "other"],
                domain_rank.get(x.get("fault_domain_hint") or "other", len(domain_rank)),
                -int(x.get("signal_score", 0)),
                -int(bool(x.get("pr_diff_snippet"))),
                -int(x.get("comments_count", 0)),
                str(x.get("key") or ""),
            ),
        )
        chosen_ids.add(id(best))
        selected.append(best)
        dom = best.get("fault_domain_hint") or "other"
        eco = str(best.get("ecosystem") or "").strip().lower()
        repo_k = (eco, str(best.get("repo") or "").strip().lower())
        sel_dom[dom] += 1
        sel_eco[eco] += 1
        sel_repo[repo_k] += 1
        return best

    # 1. Satisfy repo coverage floors first (also increments parent ecosystem counts)
    repo_order = sorted(repo_floors)
    while len(selected) < limit:
        progressed = False
        for rk in repo_order:
            if sel_repo[rk] >= repo_floors[rk]:
                continue
            cand_pool = [
                it
                for it in items
                if id(it) not in chosen_ids
                and (str(it.get("ecosystem") or "").strip().lower(), str(it.get("repo") or "").strip().lower()) == rk
            ]
            if cand_pool and _pick_best(cand_pool) is not None:
                progressed = True
                if len(selected) >= limit:
                    break
        if not progressed:
            break

    # 2. Satisfy ecosystem coverage floors
    eco_order = ["github", "gitcode"]
    while len(selected) < limit:
        progressed = False
        for ek in eco_order:
            if sel_eco[ek] >= eco_floors.get(ek, 0):
                continue
            cand_pool = [
                it for it in items if id(it) not in chosen_ids and str(it.get("ecosystem") or "").strip().lower() == ek
            ]
            if cand_pool and _pick_best(cand_pool) is not None:
                progressed = True
                if len(selected) >= limit:
                    break
        if not progressed:
            break

    # 3. Fill remaining slots with domain-stratified global priority
    while len(selected) < limit:
        cand_pool = [it for it in items if id(it) not in chosen_ids]
        if not cand_pool or _pick_best(cand_pool) is None:
            break
    return selected


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Mine 310-360 closed Ascend bug issues + PR diffs across GitHub and GitCode."
    )
    parser.add_argument("--out-jsonl", default=DEFAULT_OUT_JSONL)
    parser.add_argument("--out-summary", default=None)
    parser.add_argument("--vllm-ascend-repo", default=DEFAULT_VLLM_ASCEND_REPO)
    parser.add_argument("--vllm-repo", default=DEFAULT_VLLM_REPO)
    parser.add_argument("--target-github-ascend", type=int, default=155)
    parser.add_argument("--target-github-vllm", type=int, default=25)
    parser.add_argument("--target-gitcode", type=int, default=165)
    parser.add_argument("--max-total", type=int, default=355)
    parser.add_argument(
        "--wait-for-core-reset",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Wait for GitHub core rate-limit reset if core quota is nearly exhausted.",
    )
    parser.add_argument("--max-core-wait-sec", type=int, default=1000)
    parser.add_argument(
        "--reuse-existing",
        action="store_true",
        help="Reuse already-mined GitCode records and cached GitHub comments from existing --out-jsonl.",
    )
    parser.add_argument(
        "--allow-partial",
        action="store_true",
        help="Allow writing output even if one ecosystem or repo enrichment scrape failed partially.",
    )
    parser.add_argument(
        "--repair-provenance-only",
        nargs=2,
        metavar=("IN_JSONL", "OUT_JSONL"),
        help="Deterministically backfill pr_diff_source_ref & has_diff using local git repos without altering text or raw_sha256.",
    )
    args = parser.parse_args()

    if args.repair_provenance_only:
        in_p, out_p = args.repair_provenance_only
        summary = repair_provenance_only(
            in_p,
            out_p,
            vllm_ascend_repo=args.vllm_ascend_repo,
            vllm_repo=args.vllm_repo,
            summary_out=args.out_summary,
            allow_partial=args.allow_partial,
        )
        safe_stdout_print(json.dumps(summary, ensure_ascii=False, indent=2, allow_nan=False))
        return

    out_jsonl = Path(args.out_jsonl)
    out_k = _canonical_path_key(out_jsonl)
    summary_cands: list[Path]
    if args.out_summary is not None:
        out_summary = Path(args.out_summary)
        summary_cands = [out_summary]
    else:
        raw_cands = (
            [
                Path(DEFAULT_OUT_SUMMARY),
                out_jsonl.with_name(f"{out_jsonl.name}.summary.json"),
                out_jsonl.with_name(f"{out_jsonl.name}.run-summary.json"),
            ]
            if out_k == _canonical_path_key(Path(DEFAULT_OUT_JSONL))
            else [
                out_jsonl.with_name(f"{out_jsonl.stem}.summary.json"),
                out_jsonl.with_name(f"{out_jsonl.name}.summary.json"),
                out_jsonl.with_name(f"{out_jsonl.name}.run-summary.json"),
            ]
        )
        seen_sc: set[str] = set()
        summary_cands = []
        for sc in raw_cands:
            sk = _canonical_path_key(sc)
            if sk == out_k or sk in seen_sc:
                continue
            seen_sc.add(sk)
            summary_cands.append(sc)
        out_summary = next(
            (sc for sc in summary_cands if _inspect_summary_owner_conflict(sc, out_k) is None),
            summary_cands[0],
        )
    if _canonical_path_key(out_jsonl) == _canonical_path_key(out_summary):
        raise ValueError(f"--out-jsonl and --out-summary must be distinct paths: {out_jsonl}")
    if (
        args.target_github_ascend < 0
        or args.target_github_vllm < 0
        or args.target_gitcode < 0
        or args.max_total <= 0
    ):
        raise ValueError("Target counts must be >= 0 and --max-total must be > 0")

    t0 = time.time()
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN") or ""
    log(f"Starting dual-ecosystem mining (GITHUB_TOKEN={'set' if token else 'unset'})...")

    existing_rows: list[dict[str, Any]] = []
    initial_out_existed = False
    initial_out_sha256: str | None = None
    if out_jsonl.exists():
        try:
            initial_out_raw = out_jsonl.read_bytes()
            initial_out_existed = True
            initial_out_sha256 = hashlib.sha256(initial_out_raw).hexdigest()
            existing_rows = load_jsonl_strict(out_jsonl)
        except Exception as exc:
            if not args.allow_partial:
                raise RuntimeError(
                    f"Existing corpus {out_jsonl} is corrupt ({exc}); refusing to overwrite without --allow-partial."
                ) from exc
            if args.reuse_existing:
                raise
            log(f"Warning: ignoring corrupt existing corpus {out_jsonl} (--allow-partial): {exc}")
            existing_rows = []

    cached_by_key: dict[str, dict[str, Any]] = {}
    if args.reuse_existing and existing_rows:
        for rec in existing_rows:
            cached_by_key[str(rec["key"])] = rec
        log(f"Loaded {len(cached_by_key)} cached records from {out_jsonl}")

    prev_eco_counts = Counter(str(r.get("ecosystem") or "") for r in existing_rows)

    local_indexes = {
        "vllm-project/vllm-ascend": LocalGitIndex(
            "vllm-project/vllm-ascend", args.vllm_ascend_repo
        ),
        "vllm-project/vllm": LocalGitIndex("vllm-project/vllm", args.vllm_repo),
    }
    if not args.allow_partial:
        for repo_slug, repo_arg in (
            ("vllm-project/vllm-ascend", args.vllm_ascend_repo),
            ("vllm-project/vllm", args.vllm_repo),
        ):
            idx_obj = local_indexes[repo_slug]
            if Path(repo_arg).exists() and (not idx_obj.available or idx_obj.git_errors):
                raise RuntimeError(
                    f"Local git index error for {repo_slug} at {repo_arg}: "
                    f"identity_error={idx_obj.identity_error!r}, git_errors={idx_obj.git_errors[:2]!r} "
                    "(pass --allow-partial to override)."
                )

    cached_gc = [v for v in cached_by_key.values() if v.get("ecosystem") == "gitcode"]
    gc_miner = GitCodeMiner()
    locked_gc_repo_floors: dict[tuple[str, str], int] | None = None
    if existing_rows and not args.allow_partial:
        _, locked_repo_floors = _compute_coverage_floors(
            existing_rows,
            target_github_ascend=args.target_github_ascend,
            target_github_vllm=args.target_github_vllm,
            target_gitcode=args.target_gitcode,
            max_total=args.max_total,
        )
        locked_gc_repo_floors = {
            rk: fl for rk, fl in locked_repo_floors.items() if rk[0] == "gitcode"
        } or None
    used_gc_cache_only = False
    reval_gc = (
        [r for r in (_revalidate_gitcode_item(v) for v in cached_gc) if r is not None]
        if (args.reuse_existing and cached_gc)
        else []
    )
    if args.reuse_existing and len(reval_gc) >= args.target_gitcode and args.target_gitcode > 0:
        log(f"Reusing {len(reval_gc)} qualified cached GitCode items from {out_jsonl}")
        gc_items = stratified_select(reval_gc, args.target_gitcode, repo_floors=locked_gc_repo_floors)
        for gc_row in gc_items:
            gc_row["observation_stale"] = True
        used_gc_cache_only = True
    elif args.target_gitcode > 0:
        gc_miner.repo_floors = locked_gc_repo_floors
        fresh_gc = gc_miner.mine(target_total=args.target_gitcode)
        if (
            gc_miner.repos_succeeded == 0
            or gc_miner.repo_failures
            or gc_miner.enrichment_failures > 0
        ) and not args.allow_partial:
            raise RuntimeError(
                f"GitCode scrape incomplete (repos_succeeded={gc_miner.repos_succeeded}, "
                f"repo_failures={gc_miner.repo_failures}, enrichment_failures={gc_miner.enrichment_failures}); "
                "refusing to overwrite corpus (pass --allow-partial to override)."
            )
        if args.reuse_existing and cached_gc:
            gc_items = _merge_gitcode_reused_rows(
                cached_gc,
                fresh_gc,
                args.target_gitcode,
                disqualified_keys=gc_miner.disqualified_keys,
                fresh_observations_by_key=gc_miner.fresh_observations_by_key,
                repo_floors=locked_gc_repo_floors,
            )
        else:
            gc_items = fresh_gc
    else:
        gc_items = []

    gh_miner = GitHubMiner(
        token=token,
        local_indexes=local_indexes,
        wait_for_core_reset=args.wait_for_core_reset,
        max_core_wait_sec=args.max_core_wait_sec,
    )
    gh_target = args.target_github_ascend + args.target_github_vllm
    if gh_target > 0:
        gh_items = gh_miner.mine(
            target_ascend=args.target_github_ascend,
            target_vllm=args.target_github_vllm,
            cached_by_key=cached_by_key if args.reuse_existing else None,
        )
        if (
            gh_miner.search_failures > 0
            or gh_miner.rest_failures > 0
            or gh_miner.comment_failures > 0
            or gh_miner.fallback_failures > 0
        ) and not args.allow_partial:
            raise RuntimeError(
                f"GitHub scrape had HTTP failures (search={gh_miner.search_failures}, rest={gh_miner.rest_failures}, "
                f"comments={gh_miner.comment_failures}, pr_fallback={gh_miner.fallback_failures}); "
                "refusing to overwrite corpus (pass --allow-partial to override)."
            )
        if not args.allow_partial:
            for idx_obj in local_indexes.values():
                if idx_obj.git_errors:
                    raise RuntimeError(
                        f"GitHub mining hit local git command errors on {idx_obj.repo_slug}: "
                        f"{idx_obj.git_errors[:2]!r} (pass --allow-partial to override)."
                    )
    else:
        gh_items = []

    combined_raw = gh_items + gc_items
    deduped: list[dict[str, Any]] = []
    seen_keys: set[str] = set()
    seen_shas: set[str] = set()
    for it in combined_raw:
        rec = finalize_record(it)
        if rec["key"] in seen_keys or rec["raw_sha256"] in seen_shas:
            continue
        seen_keys.add(rec["key"])
        seen_shas.add(rec["raw_sha256"])
        deduped.append(rec)

    if len(deduped) > args.max_total:
        deduped = _select_with_coverage_floors(
            deduped,
            args.max_total,
            existing_rows=existing_rows,
            target_github_ascend=args.target_github_ascend,
            target_github_vllm=args.target_github_vllm,
            target_gitcode=args.target_gitcode,
            allow_partial=args.allow_partial,
        )

    if not deduped:
        raise RuntimeError(
            "Dual-ecosystem mining yielded 0 qualified records; refusing to overwrite existing corpus."
        )

    post_eco_counts = Counter(str(r.get("ecosystem") or "").strip().lower() for r in deduped)
    post_eco_repo_counts = Counter(
        (str(r.get("ecosystem") or "").strip().lower(), str(r.get("repo") or "").strip().lower())
        for r in deduped
    )

    def _verify_coverage_locked(target_sum_path: Path) -> None:
        if args.out_summary is None:
            conflict_p = _inspect_summary_owner_conflict(target_sum_path, out_k)
            if conflict_p:
                raise _SiblingSummaryOwnershipConflict(conflict_p)
        cur_exists = out_jsonl.exists()
        if initial_out_existed:
            if not cur_exists:
                raise RuntimeError(
                    f"Concurrent modification detected: {out_jsonl} disappeared under lock; refusing to overwrite."
                )
            if hashlib.sha256(out_jsonl.read_bytes()).hexdigest() != initial_out_sha256:
                raise RuntimeError(
                    f"Concurrent modification detected on {out_jsonl} since mining began; refusing to overwrite newer commit."
                )
        elif cur_exists:
            raise RuntimeError(
                f"Concurrent modification detected: {out_jsonl} was created by another run while mining; refusing to overwrite."
            )
        if args.allow_partial:
            return
        locked_rows = list(existing_rows)
        if out_jsonl.exists():
            locked_rows = load_jsonl_strict(out_jsonl)
        if not locked_rows:
            return
        eco_floors, repo_floors = _compute_coverage_floors(
            locked_rows,
            target_github_ascend=args.target_github_ascend,
            target_github_vllm=args.target_github_vllm,
            target_gitcode=args.target_gitcode,
            max_total=args.max_total,
        )
        floor_gh = eco_floors.get("github", 0)
        if floor_gh > 0 and post_eco_counts.get("github", 0) < floor_gh:
            raise RuntimeError(
                f"GitHub coverage dropped sharply ({post_eco_counts.get('github', 0)} < floor {floor_gh}); "
                "refusing to overwrite corpus (pass --allow-partial to override)."
            )
        for (eco_slug, repo_slug), floor_r in sorted(repo_floors.items()):
            if eco_slug == "github" and post_eco_repo_counts.get((eco_slug, repo_slug), 0) < floor_r:
                raise RuntimeError(
                    f"GitHub repo {repo_slug} coverage dropped sharply "
                    f"({post_eco_repo_counts.get((eco_slug, repo_slug), 0)} < floor {floor_r}); "
                    "refusing to overwrite corpus (pass --allow-partial to override)."
                )
        floor_gc = eco_floors.get("gitcode", 0)
        if floor_gc > 0 and post_eco_counts.get("gitcode", 0) < floor_gc:
            raise RuntimeError(
                f"GitCode coverage dropped sharply ({post_eco_counts.get('gitcode', 0)} < floor {floor_gc}); "
                "refusing to overwrite corpus (pass --allow-partial to override)."
            )
        for (eco_slug, repo_slug), floor_gc_r in sorted(repo_floors.items()):
            if eco_slug == "gitcode" and post_eco_repo_counts.get((eco_slug, repo_slug), 0) < floor_gc_r:
                raise RuntimeError(
                    f"GitCode repo {repo_slug} coverage dropped sharply "
                    f"({post_eco_repo_counts.get((eco_slug, repo_slug), 0)} < floor {floor_gc_r}); "
                    "refusing to overwrite corpus (pass --allow-partial to override)."
                )

    lines = [json.dumps(rec, ensure_ascii=False, allow_nan=False) for rec in deduped]
    jsonl_bytes = ("\n".join(lines) + "\n").encode("utf-8")
    jsonl_sha = hashlib.sha256(jsonl_bytes).hexdigest()

    by_ecosystem = Counter(r["ecosystem"] for r in deduped)
    by_repo = Counter(r["repo"] for r in deduped)
    by_domain = Counter(r["fault_domain_hint"] for r in deduped)
    summary = {
        "schemaVersion": 2,
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        ),
        "elapsedSec": round(time.time() - t0, 2),
        "totalItems": len(deduped),
        "jsonlPath": os.path.abspath(str(out_jsonl)),
        "jsonlBytes": len(jsonl_bytes),
        "jsonlSha256": jsonl_sha,
        "byEcosystem": dict(sorted(by_ecosystem.items())),
        "byRepo": dict(sorted(by_repo.items())),
        "byFaultDomain": dict(sorted(by_domain.items())),
        "withPrDiffCount": sum(1 for r in deduped if r["pr_diff_snippet"]),
        "withUnboundPrDiffCount": sum(1 for r in deduped if r.get("unbound_pr_diff_snippet")),
        "staleObservationCount": sum(1 for r in deduped if r.get("observation_stale")),
        "withLinkedMergedPrCount": sum(1 for r in deduped if r["linked_merged_prs"]),
        "withLinkedDirectCommitCount": sum(1 for r in deduped if r.get("linked_direct_commits")),
        "withHumanResolutionCommentCount": sum(
            1 for r in deduped if r["has_human_resolution_comment"]
        ),
        "withConcreteErrorCodeCount": sum(1 for r in deduped if r["detected_error_codes"]),
        "rateLimitNotes": gh_miner.notes,
        "gitcodeUsedCacheOnly": used_gc_cache_only,
        "gitcodeRepoFailures": gc_miner.repo_failures,
        "gitcodeEnrichmentFailures": gc_miner.enrichment_failures,
        "githubSearchFailures": gh_miner.search_failures,
        "githubRestFailures": gh_miner.rest_failures,
        "githubCommentFailures": gh_miner.comment_failures,
        "githubFallbackFailures": gh_miner.fallback_failures,
    }
    summary_bytes = (json.dumps(summary, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")
    attempt_sums = (
        [out_summary]
        if args.out_summary is not None
        else summary_cands[summary_cands.index(out_summary) :]
    )
    last_sum_conflict: _SiblingSummaryOwnershipConflict | None = None
    published_summary: Path | None = None
    for cand_sum in attempt_sums:
        if _canonical_path_key(cand_sum) == out_k:
            continue
        try:
            _atomic_write_pair(
                out_jsonl,
                jsonl_bytes,
                cand_sum,
                summary_bytes,
                before_write_locked=lambda cs=cand_sum: _verify_coverage_locked(cs),
            )
            published_summary = cand_sum
            break
        except _SiblingSummaryOwnershipConflict as exc:
            last_sum_conflict = exc
            continue
    if published_summary is None:
        raise RuntimeError(
            f"Refusing to overwrite summary owned by another corpus: {last_sum_conflict}"
        )

    log(
        f"Wrote {len(deduped)} items to {out_jsonl} ({len(jsonl_bytes)} bytes, "
        f"with_pr_diff={summary['withPrDiffCount']}, elapsed={summary['elapsedSec']}s)"
    )
    safe_stdout_print(summary_bytes.decode("utf-8").rstrip("\n"))


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
    out = getattr(sys, "stdout", None)
    if out is None or getattr(out, "closed", False):
        return
    try:
        print(msg, flush=True)
    except UnicodeEncodeError:
        enc = getattr(out, "encoding", None) or "ascii"
        safe_msg = msg.encode(enc, errors="replace").decode(enc, errors="replace")
        try:
            print(safe_msg, flush=True)
        except UnicodeEncodeError:
            try:
                print(msg.encode("ascii", errors="replace").decode("ascii"), flush=True)
            except (BrokenPipeError, OSError, ValueError):
                _silence_broken_stdout()
        except (BrokenPipeError, OSError, ValueError):
            _silence_broken_stdout()
    except (BrokenPipeError, OSError, ValueError):
        _silence_broken_stdout()


if __name__ == "__main__":
    main()
    out = getattr(sys, "stdout", None)
    if out is not None and not getattr(out, "closed", False):
        try:
            out.flush()
        except (BrokenPipeError, OSError, ValueError):
            _silence_broken_stdout()
