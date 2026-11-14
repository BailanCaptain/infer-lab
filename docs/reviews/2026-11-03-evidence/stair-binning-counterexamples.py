"""Run unchanged CPU statistics methods extracted from the fixed upstream source.

This audits documentation arithmetic; it does not execute serving or NPU paths.
Run from the repository root with Python and NumPy installed.
"""
import ast
import json
import subprocess
import types

import numpy as np

PIN = "4d1412d102c16669af3ec73174fc5f8b359b56d9"
SOURCE = "vllm_ascend/distributed/eplb/policy/stair.py"
source = subprocess.check_output(
    ["git", "-C", "tools/repos/vllm-ascend", "show", f"{PIN}:{SOURCE}"]
).decode()
tree = ast.parse(source)
policy_class = next(
    node for node in tree.body
    if isinstance(node, ast.ClassDef) and node.name == "StairEplbPolicy"
)
methods = {
    "compress_load_window", "weighted_moments",
    "placement_replica_counts", "placement_imbalance",
}
policy_class.body = [
    node for node in policy_class.body
    if isinstance(node, ast.FunctionDef) and node.name in methods
]
policy_class.bases = []
namespace = {
    "np": np,
    "PlacementImbalance": lambda mean_ratio, p95_ratio: types.SimpleNamespace(
        mean_ratio=mean_ratio, p95_ratio=p95_ratio
    ),
}
exec(compile(ast.fix_missing_locations(ast.Module(
    body=[policy_class], type_ignores=[]
)), f"{PIN}:{SOURCE}", "exec"), namespace)
policy = namespace["StairEplbPolicy"]

balance_input = np.array([[[1000, 0]], [[1, 1]], [[1, 1]], [[1, 1]]], dtype=float)
balance_results = []
for max_bins in (4, 2):
    means, counts = policy.compress_load_window(balance_input, max_bins)
    imbalance = policy.placement_imbalance(means[:, 0], counts, np.array([[0], [1]]))
    balance_results.append({
        "max_bins": max_bins, "means": means[:, 0].tolist(),
        "counts": counts.tolist(), "mean_ratio": imbalance.mean_ratio,
        "balance": 1 / imbalance.mean_ratio,
    })
assert balance_results[1]["balance"] < balance_results[0]["balance"]

variance_input = np.array([0, 0, 0, 10, 0, 0, 0, 0], dtype=float).reshape(-1, 1, 1)
variance_results = []
for max_bins in (6, 5):
    means, counts = policy.compress_load_window(variance_input, max_bins)
    _, variance, _ = policy.weighted_moments(means[:, 0], counts)
    variance_results.append({
        "max_bins": max_bins, "means": means[:, 0].tolist(),
        "counts": counts.tolist(), "variance": float(variance[0]),
    })
assert variance_results[1]["variance"] > variance_results[0]["variance"]
print(json.dumps({
    "source": f"vllm-ascend@{PIN}:{SOURCE}",
    "balance_input": balance_input[:, 0].tolist(),
    "balance_results": balance_results,
    "variance_input": variance_input[:, 0, 0].tolist(),
    "variance_results": variance_results,
    "npu_execution": False,
}, indent=2))
