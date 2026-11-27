#!/usr/bin/env python3
"""Local Colab session lifecycle driver with detached background worker polling and guaranteed VM teardown."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
import uuid
from pathlib import Path


def run_cmd(
    cmd: list[str],
    check: bool = True,
    capture: bool = False,
    env: dict[str, str] | None = None,
    stdin_text: str | None = None,
) -> subprocess.CompletedProcess[str]:
    if not capture:
        print(f"[driver] $ {' '.join(cmd)}", flush=True)
    return subprocess.run(
        cmd,
        input=stdin_text,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=check,
        capture_output=capture,
        env=env,
    )


def run_detached_worker(colab: str, session_name: str, idx: int, local_script: str) -> None:
    remote_py = f"/content/_worker_{idx}.py"
    remote_runner = f"/content/_runner_{idx}.py"
    remote_log = f"/content/_worker_{idx}.log"
    remote_rc = f"/content/_worker_{idx}.rc"

    run_cmd([colab, "--auth=oauth2", "upload", "-s", session_name, local_script, remote_py])

    launch_snippet = f"""
import pathlib, subprocess, sys
runner_code = '''import pathlib, subprocess, sys
with open({remote_log!r}, "w", encoding="utf-8") as logf:
    p = subprocess.run([sys.executable, "-u", {remote_py!r}], stdout=logf, stderr=subprocess.STDOUT)
pathlib.Path({remote_rc!r}).write_text(str(p.returncode), encoding="utf-8")
'''
pathlib.Path({remote_runner!r}).write_text(runner_code, encoding="utf-8")
pathlib.Path({remote_rc!r}).unlink(missing_ok=True)
subprocess.Popen([sys.executable, {remote_runner!r}], start_new_session=True)
print("LAUNCHED_OK")
""".strip()

    run_cmd(
        [colab, "--auth=oauth2", "exec", "-s", session_name, "--timeout", "30"],
        stdin_text=launch_snippet,
    )
    print(f"[driver] Detached worker #{idx} ({local_script}) running on {session_name}; polling logs...", flush=True)

    offset = 0
    consecutive_poll_errors = 0
    while True:
        time.sleep(12)
        poll_snippet = f"""
import json, pathlib
log_p = pathlib.Path({remote_log!r})
rc_p = pathlib.Path({remote_rc!r})
data = log_p.read_bytes() if log_p.exists() else b""
chunk = data[{offset}:][:65536]
new_off = {offset} + len(chunk)
rc = int(rc_p.read_text().strip()) if rc_p.exists() else None
print("POLL_JSON:" + json.dumps({{"off": new_off, "total": len(data), "rc": rc, "text": chunk.decode("utf-8", "replace")}}))
""".strip()
        res = run_cmd(
            [colab, "--auth=oauth2", "exec", "-s", session_name, "--timeout", "30"],
            check=False,
            capture=True,
            stdin_text=poll_snippet,
        )
        if res.returncode != 0:
            consecutive_poll_errors += 1
            print(f"[driver] Transient poll error ({consecutive_poll_errors}/5), retrying...", flush=True)
            if consecutive_poll_errors >= 5:
                raise RuntimeError(f"Lost polling access to {session_name}: {res.stderr or res.stdout}")
            continue

        consecutive_poll_errors = 0
        marker_line = next((ln for ln in (res.stdout or "").splitlines() if ln.startswith("POLL_JSON:")), None)
        if not marker_line:
            continue
        state = json.loads(marker_line[len("POLL_JSON:") :])
        if state["text"]:
            sys.stdout.write(state["text"])
            if not state["text"].endswith("\n"):
                sys.stdout.write("\n")
            sys.stdout.flush()
        offset = int(state["off"])
        total = int(state.get("total", offset))
        if state["rc"] is not None and offset >= total:
            if int(state["rc"]) != 0:
                raise RuntimeError(f"Worker {local_script} exited with non-zero code {state['rc']}")
            print(f"[driver] Worker #{idx} ({local_script}) completed cleanly (rc=0).", flush=True)
            return


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Python workers on Colab GPU and download artifacts safely.")
    parser.add_argument("--colab-bin", required=True, help="Path to colab executable")
    parser.add_argument("--worker", action="append", required=True, help="Local Python script(s) to run sequentially")
    parser.add_argument("--gpus", default="T4,L4,G4,A100,H100", help="Comma-separated GPU fallback order")
    parser.add_argument("--upload", action="append", default=[], help="local_path:remote_path pairs")
    parser.add_argument("--download", action="append", default=[], help="remote_path:local_path pairs")
    args = parser.parse_args()

    colab = args.colab_bin
    session_name = f"inferlab-{uuid.uuid4().hex[:6]}"
    allocated = False

    try:
        for gpu_spec in [g.strip() for g in args.gpus.split(",") if g.strip()]:
            parts = gpu_spec.split(":")
            gpu = parts[0]
            cmd = [colab, "--auth=oauth2", "new", "-s", session_name, "--gpu", gpu]
            if len(parts) > 1 and parts[1] == "hm":
                cmd.append("--high-mem")
            env = {
                **os.environ,
                "COLAB_CLI_ASSIGN_RETRIES": "4",
                "COLAB_CLI_RETRY_BACKOFF": "7",
            }
            res = run_cmd(cmd, check=False, env=env)
            if res.returncode == 0:
                allocated = True
                print(f"[driver] Allocated session {session_name} on GPU={gpu_spec}", flush=True)
                break
            print(f"[driver] GPU={gpu_spec} unavailable (rc={res.returncode}), trying fallback...", flush=True)

        if not allocated:
            raise RuntimeError(f"Could not allocate any GPU from {args.gpus}")

        for pair in args.upload:
            local_p, remote_p = pair.rsplit(":", 1)
            run_cmd([colab, "--auth=oauth2", "upload", "-s", session_name, local_p, remote_p])

        for idx, worker_script in enumerate(args.worker):
            run_detached_worker(colab, session_name, idx, worker_script)

        for pair in args.download:
            remote_p, local_p = pair.split(":", 1)
            Path(local_p).parent.mkdir(parents=True, exist_ok=True)
            run_cmd([colab, "--auth=oauth2", "download", "-s", session_name, remote_p, local_p])
            raw = Path(local_p).read_bytes()
            sha = hashlib.sha256(raw).hexdigest()
            print(f"[driver] Downloaded {local_p} ({len(raw)} bytes, sha256={sha})", flush=True)
    finally:
        if allocated:
            print(f"[driver] Releasing Colab VM session {session_name}...", flush=True)
            run_cmd([colab, "--auth=oauth2", "stop", "-s", session_name], check=False)
        run_cmd([colab, "--auth=oauth2", "usage"], check=False)


if __name__ == "__main__":
    main()
