#!/usr/bin/env python3
"""Local Colab session lifecycle driver with detached background worker polling and guaranteed VM teardown."""

from __future__ import annotations

import argparse
import base64
import binascii
import codecs
from collections import Counter
import contextlib
from dataclasses import dataclass
import hashlib
import json
import math
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from typing import Any


DEFAULT_CMD_TIMEOUT_SEC = 120.0
DEFAULT_NEW_TIMEOUT_SEC = 240.0
DEFAULT_EXEC_TIMEOUT_SEC = 60.0
DEFAULT_TRANSFER_TIMEOUT_SEC = 600.0
DEFAULT_JOB_TIMEOUT_SEC = 14400.0
DEFAULT_DRAIN_TIMEOUT_SEC = 180.0
DEFAULT_TEARDOWN_TIMEOUT_SEC = 120.0

_WINDOWS_DRIVE_RE = re.compile(r"^[A-Za-z]:[\\/]")
_GPU_NAME_RE = re.compile(r"^[A-Za-z0-9_-]+$")
_SESSION_TOKEN_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]*")

_GPU_ADMISSION_LINE_RE = re.compile(
    r"^(?:"
    r"\[INFERLAB_ADMISSION\]\s*(?:INCOMPATIBLE|REJECTED)\s*:.*|"
    r"(?:RuntimeError|torch\.(?:cuda\.)?OutOfMemoryError|MemoryError)\s*:\s*.*"
    r"(?:no cuda gpu detected|below the hard minimum|vram\s+[0-9.]+\s*gib\s+is\s+below|"
    r"<\s*[0-9.]+\s*gib\s+minimum|insufficient\s+(?:gpu\s+)?vram|"
    r"cuda driver version is insufficient|nvidia-smi has failed|found no nvidia driver)|"
    r"NVIDIA-SMI has failed\b.*|"
    r"Failed to initialize NVML\b.*"
    r")",
    re.IGNORECASE,
)


class GpuIncompatibleError(RuntimeError):
    """Raised when the allocated Colab VM fails GPU/VRAM admission and should trigger fallback."""


class JobInterruptedError(RuntimeError):
    """Raised when SIGINT or SIGTERM requests bounded shutdown and VM teardown."""


@dataclass(frozen=True)
class GpuTierSpec:
    raw: str
    gpu: str
    high_mem: bool


def _is_exact_int(val: Any) -> bool:
    return isinstance(val, int) and not isinstance(val, bool)


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


def safe_print(msg: str) -> None:
    try:
        print(msg, flush=True)
    except UnicodeEncodeError:
        enc = getattr(sys.stdout, "encoding", None) or "ascii"
        safe_txt = msg.encode(enc, errors="replace").decode(enc, errors="replace")
        try:
            print(safe_txt, flush=True)
        except (BrokenPipeError, OSError):
            _silence_broken_stdout()
        except UnicodeEncodeError:
            pass
    except (BrokenPipeError, OSError):
        _silence_broken_stdout()


def _remaining_timeout(requested: float, deadline: float | None, *, now: float | None = None) -> float:
    if not math.isfinite(requested) or requested <= 0:
        raise ValueError(f"Timeout must be finite and positive, got {requested}")
    if deadline is None:
        return requested
    if not math.isfinite(deadline):
        raise ValueError(f"Deadline must be finite, got {deadline}")
    cur = time.monotonic() if now is None else now
    rem = deadline - cur
    if rem <= 0:
        raise TimeoutError("Monotonic deadline exceeded before running command")
    return min(requested, rem)


def _create_win_job() -> int | None:
    if sys.platform != "win32":
        return None
    try:
        import ctypes
        from ctypes import wintypes

        k32 = ctypes.WinDLL("kernel32", use_last_error=True)
        k32.CreateJobObjectW.restype = wintypes.HANDLE
        k32.CreateJobObjectW.argtypes = [wintypes.LPVOID, wintypes.LPCWSTR]
        job = k32.CreateJobObjectW(None, None)
        return int(job) if job else None
    except Exception:
        return None


def _assign_win_job(job: int | None, proc: subprocess.Popen[str]) -> bool:
    if sys.platform != "win32" or not job:
        return False
    try:
        import ctypes
        from ctypes import wintypes

        handle = getattr(proc, "_handle", None)
        if not handle:
            return False
        k32 = ctypes.WinDLL("kernel32", use_last_error=True)
        k32.AssignProcessToJobObject.restype = wintypes.BOOL
        k32.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
        return bool(k32.AssignProcessToJobObject(wintypes.HANDLE(job), wintypes.HANDLE(int(handle))))
    except Exception:
        return False


def _resume_win_process_threads(pid: int) -> int:
    if sys.platform != "win32" or pid <= 0:
        return 0
    try:
        import ctypes
        from ctypes import wintypes

        TH32CS_SNAPTHREAD = 0x00000004
        THREAD_SUSPEND_RESUME = 0x0002

        class THREADENTRY32(ctypes.Structure):
            _fields_ = [
                ("dwSize", wintypes.DWORD),
                ("cntUsage", wintypes.DWORD),
                ("th32ThreadID", wintypes.DWORD),
                ("th32OwnerProcessID", wintypes.DWORD),
                ("tpBasePri", wintypes.LONG),
                ("tpDeltaPri", wintypes.LONG),
                ("dwFlags", wintypes.DWORD),
            ]

        k32 = ctypes.WinDLL("kernel32", use_last_error=True)
        k32.CreateToolhelp32Snapshot.restype = wintypes.HANDLE
        k32.CreateToolhelp32Snapshot.argtypes = [wintypes.DWORD, wintypes.DWORD]
        k32.Thread32First.restype = wintypes.BOOL
        k32.Thread32First.argtypes = [wintypes.HANDLE, ctypes.POINTER(THREADENTRY32)]
        k32.Thread32Next.restype = wintypes.BOOL
        k32.Thread32Next.argtypes = [wintypes.HANDLE, ctypes.POINTER(THREADENTRY32)]
        k32.OpenThread.restype = wintypes.HANDLE
        k32.OpenThread.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        k32.ResumeThread.restype = wintypes.DWORD
        k32.ResumeThread.argtypes = [wintypes.HANDLE]
        k32.CloseHandle.restype = wintypes.BOOL
        k32.CloseHandle.argtypes = [wintypes.HANDLE]

        snap = k32.CreateToolhelp32Snapshot(TH32CS_SNAPTHREAD, 0)
        if not snap or int(snap) in (-1, 0xFFFFFFFF, 0xFFFFFFFFFFFFFFFF):
            return 0
        resumed = 0
        try:
            te = THREADENTRY32()
            te.dwSize = ctypes.sizeof(THREADENTRY32)
            ok = k32.Thread32First(snap, ctypes.byref(te))
            while ok:
                if te.th32OwnerProcessID == pid:
                    ht = k32.OpenThread(THREAD_SUSPEND_RESUME, False, te.th32ThreadID)
                    if ht:
                        try:
                            prev_cnt = k32.ResumeThread(ht)
                            if int(prev_cnt) != 0xFFFFFFFF:
                                resumed += 1
                        finally:
                            k32.CloseHandle(ht)
                ok = k32.Thread32Next(snap, ctypes.byref(te))
        finally:
            k32.CloseHandle(snap)
        return resumed
    except Exception:
        return 0


def _close_win_job(job: int | None) -> None:
    if sys.platform != "win32" or not job:
        return
    try:
        import ctypes
        from ctypes import wintypes

        k32 = ctypes.WinDLL("kernel32", use_last_error=True)
        k32.CloseHandle.restype = wintypes.BOOL
        k32.CloseHandle.argtypes = [wintypes.HANDLE]
        k32.CloseHandle(wintypes.HANDLE(job))
    except Exception:
        pass


def _terminate_process_tree(proc: subprocess.Popen[str], win_job: int | None = None) -> None:
    try:
        if sys.platform != "win32":
            os.killpg(proc.pid, signal.SIGKILL)
        else:
            if win_job:
                try:
                    import ctypes
                    from ctypes import wintypes

                    k32 = ctypes.WinDLL("kernel32", use_last_error=True)
                    k32.TerminateJobObject.restype = wintypes.BOOL
                    k32.TerminateJobObject.argtypes = [wintypes.HANDLE, wintypes.UINT]
                    k32.TerminateJobObject(wintypes.HANDLE(win_job), 1)
                except Exception:
                    pass
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=3.0,
                check=False,
            )
    except Exception:
        pass
    try:
        proc.kill()
    except OSError:
        pass


def run_cmd(
    cmd: list[str],
    check: bool = True,
    capture: bool = False,
    env: dict[str, str] | None = None,
    stdin_text: str | None = None,
    timeout: float = DEFAULT_CMD_TIMEOUT_SEC,
    deadline: float | None = None,
    interrupt_poll: Callable[[], None] | None = None,
) -> subprocess.CompletedProcess[str]:
    cmd_start = time.monotonic()
    eff_timeout = _remaining_timeout(timeout, deadline, now=cmd_start)
    cmd_deadline = cmd_start + eff_timeout
    if deadline is not None:
        cmd_deadline = min(cmd_deadline, deadline)
    if not capture:
        safe_print(f"[driver] $ {' '.join(cmd)}")
    popen_kwargs: dict[str, Any] = {
        "stdin": subprocess.PIPE if stdin_text is not None else subprocess.DEVNULL,
        "stdout": subprocess.PIPE,
        "stderr": subprocess.PIPE if capture else subprocess.STDOUT,
        "bufsize": 0,
        "env": env,
    }
    win_job = _create_win_job()
    CREATE_SUSPENDED = 0x00000004
    if sys.platform != "win32":
        popen_kwargs["start_new_session"] = True
    else:
        if win_job is None:
            raise RuntimeError("Failed to create Windows Job Object for child containment")
        cflags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0) | CREATE_SUSPENDED
        popen_kwargs["creationflags"] = cflags

    proc: subprocess.Popen[str] | None = None
    out_chunks: list[bytes] = []
    err_chunks: list[bytes] = []
    out_tail: list[bytes] = [b""]
    out_thread: threading.Thread | None = None
    err_thread: threading.Thread | None = None
    writer_thread: threading.Thread | None = None
    stdin_pipe: Any = None
    started_suspended = sys.platform == "win32"

    def _drain_pipe(pipe: Any, sink: list[bytes], *, stream_live: bool = False) -> None:
        line_buf = b""
        flushed_partial = False
        try:
            fd = pipe.fileno()
            while True:
                blk = os.read(fd, 65536)
                if not blk:
                    break
                if stream_live:
                    out_tail[0] = (out_tail[0] + blk)[-65536:]
                    line_buf += blk
                    while b"\n" in line_buf:
                        ln_b, line_buf = line_buf.split(b"\n", 1)
                        ln_clean = ln_b.rstrip(b"\r")
                        if flushed_partial and not ln_clean:
                            flushed_partial = False
                            continue
                        flushed_partial = False
                        safe_print(ln_clean.decode("utf-8", errors="replace"))
                    while len(line_buf) >= 65536:
                        cut = 65536
                        lead_idx = cut - 1
                        while lead_idx > cut - 4 and lead_idx > 0 and (line_buf[lead_idx] & 0xC0) == 0x80:
                            lead_idx -= 1
                        b0 = line_buf[lead_idx]
                        if (b0 & 0x80) == 0:
                            seq_len = 1
                        elif (b0 & 0xE0) == 0xC0:
                            seq_len = 2
                        elif (b0 & 0xF0) == 0xE0:
                            seq_len = 3
                        elif (b0 & 0xF8) == 0xF0:
                            seq_len = 4
                        else:
                            seq_len = 1
                        if lead_idx + seq_len > cut and lead_idx > 0:
                            cut = lead_idx
                        chunk_b, line_buf = line_buf[:cut], line_buf[cut:]
                        safe_print(chunk_b.rstrip(b"\r").decode("utf-8", errors="replace"))
                        flushed_partial = True
                else:
                    sink.append(blk)
            if stream_live and line_buf:
                safe_print(line_buf.rstrip(b"\r").decode("utf-8", errors="replace"))
        except OSError:
            pass

    try:
        try:
            proc = subprocess.Popen(cmd, **popen_kwargs)
            if started_suspended:
                if not _assign_win_job(win_job, proc):
                    raise RuntimeError(f"Failed to assign Windows Job Object to child PID {proc.pid}")
                if _resume_win_process_threads(proc.pid) <= 0:
                    raise RuntimeError(f"Failed to resume suspended Windows child PID {proc.pid}")

            if proc.stdout is not None:
                out_thread = threading.Thread(
                    target=_drain_pipe,
                    args=(proc.stdout, out_chunks),
                    kwargs={"stream_live": not capture},
                    daemon=True,
                )
                out_thread.start()
            if proc.stderr is not None:
                err_thread = threading.Thread(target=_drain_pipe, args=(proc.stderr, err_chunks), daemon=True)
                err_thread.start()

            stdin_pipe = proc.stdin
            if stdin_text is not None and stdin_pipe is not None:
                proc.stdin = None
                stdin_bytes = stdin_text.encode("utf-8", errors="replace")

                def _feed_stdin() -> None:
                    try:
                        mv = memoryview(stdin_bytes)
                        fd = stdin_pipe.fileno()
                        pos = 0
                        while pos < len(mv):
                            written = os.write(fd, mv[pos : pos + 65536])
                            if written <= 0:
                                break
                            pos += written
                    except OSError:
                        pass
                    finally:
                        try:
                            stdin_pipe.close()
                        except OSError:
                            pass

                writer_thread = threading.Thread(target=_feed_stdin, daemon=True)
                writer_thread.start()

            while True:
                if interrupt_poll is not None:
                    if proc.poll() is not None:
                        break
                    interrupt_poll()
                rem = cmd_deadline - time.monotonic()
                if rem <= 0:
                    raise subprocess.TimeoutExpired(cmd=cmd, timeout=eff_timeout)
                wait_slice = min(rem, 0.25) if interrupt_poll is not None else rem
                try:
                    proc.wait(timeout=wait_slice)
                    break
                except subprocess.TimeoutExpired as te:
                    if interrupt_poll is not None and cmd_deadline - time.monotonic() > 0:
                        continue
                    raise subprocess.TimeoutExpired(cmd=cmd, timeout=eff_timeout) from te

            for th in (out_thread, err_thread):
                if th is not None:
                    rem = max(0.0, cmd_deadline - time.monotonic())
                    th.join(timeout=rem)
                    if th.is_alive():
                        raise subprocess.TimeoutExpired(cmd=cmd, timeout=eff_timeout)
            if writer_thread is not None:
                writer_thread.join(timeout=min(0.5, max(0.0, cmd_deadline - time.monotonic())))
        except BaseException as exc:
            if proc is not None:
                _terminate_process_tree(proc, win_job=win_job)
                try:
                    proc.wait(timeout=0.5)
                except Exception:
                    pass
            for th in (out_thread, err_thread, writer_thread):
                if th is not None:
                    th.join(timeout=0.25)
            if proc is not None:
                for pipe, th in ((proc.stdout, out_thread), (proc.stderr, err_thread)):
                    if pipe is not None and (th is None or not th.is_alive()):
                        try:
                            pipe.close()
                        except OSError:
                            pass
            if stdin_pipe is not None and (writer_thread is None or not writer_thread.is_alive()):
                try:
                    stdin_pipe.close()
                except OSError:
                    pass
            rem_out = (b"".join(out_chunks) if capture else out_tail[0]).decode("utf-8", errors="replace")
            rem_err = b"".join(err_chunks).decode("utf-8", errors="replace")
            if isinstance(exc, subprocess.TimeoutExpired):
                raise subprocess.TimeoutExpired(
                    cmd=cmd,
                    timeout=eff_timeout,
                    output=rem_out,
                    stderr=rem_err,
                ) from exc
            raise

        for pipe in (proc.stdout, proc.stderr):
            if pipe is not None:
                try:
                    pipe.close()
                except OSError:
                    pass
    finally:
        _close_win_job(win_job)

    stdout_str = b"".join(out_chunks).decode("utf-8", errors="replace") if capture else ""
    stderr_str = b"".join(err_chunks).decode("utf-8", errors="replace") if capture else ""
    diag_out = stdout_str if capture else out_tail[0].decode("utf-8", errors="replace")
    res = subprocess.CompletedProcess(
        args=cmd,
        returncode=int(proc.returncode or 0),
        stdout=stdout_str,
        stderr=stderr_str,
    )
    if check and res.returncode != 0:
        raise subprocess.CalledProcessError(
            res.returncode, cmd, output=diag_out, stderr=stderr_str
        )
    return res


setattr(run_cmd, "_supports_interrupt_poll", True)


def parse_gpu_specs(gpus_arg: str) -> list[GpuTierSpec]:
    if not gpus_arg or not gpus_arg.strip():
        raise ValueError("--gpus must specify at least one GPU tier")
    parts_raw = [g.strip() for g in gpus_arg.split(",")]
    if any(not p for p in parts_raw):
        raise ValueError(f"Malformed --gpus list {gpus_arg!r}: empty GPU tier entry")
    specs: list[GpuTierSpec] = []
    for item in parts_raw:
        parts = item.split(":")
        if len(parts) > 2:
            raise ValueError(
                f"Malformed GPU tier spec {item!r}: expected '<GPU>' or '<GPU>:hm'"
            )
        gpu = parts[0].strip()
        if not gpu or not _GPU_NAME_RE.fullmatch(gpu):
            raise ValueError(f"Invalid GPU name {gpu!r} in tier spec {item!r}")
        high_mem = False
        if len(parts) == 2:
            mod = parts[1].strip().lower()
            if mod not in ("hm", "high-mem"):
                raise ValueError(
                    f"Unsupported GPU modifier {parts[1]!r} in tier spec {item!r}; "
                    "expected 'hm' or 'high-mem'"
                )
            high_mem = True
        specs.append(GpuTierSpec(raw=item, gpu=gpu, high_mem=high_mem))
    return specs


def split_upload_pair(pair: str) -> tuple[str, str]:
    raw = pair.strip()
    if not raw:
        raise ValueError("Empty --upload pair")
    if _WINDOWS_DRIVE_RE.match(raw):
        prefix, rest = raw[:2], raw[2:]
        if rest.count(":") != 1:
            raise ValueError(
                f"Ambiguous --upload pair {pair!r}: expected '<local_path>:<remote_path>' "
                "with no extra ':' inside paths"
            )
        local_rest, remote_p = rest.split(":", 1)
        local_p = prefix + local_rest
    else:
        if raw.count(":") != 1:
            raise ValueError(
                f"Ambiguous --upload pair {pair!r}: expected '<local_path>:<remote_path>' "
                "with no extra ':' inside paths"
            )
        local_p, remote_p = raw.split(":", 1)
    local_p = local_p.strip()
    remote_p = remote_p.strip()
    if not local_p or not remote_p:
        raise ValueError(f"Invalid --upload pair {pair!r}: local and remote paths must be non-empty")
    if not remote_p.startswith("/") or _WINDOWS_DRIVE_RE.match(remote_p):
        raise ValueError(
            f"Invalid remote path {remote_p!r} in --upload {pair!r}: must be a POSIX path starting with '/'"
        )
    return local_p, remote_p


def split_download_pair(pair: str) -> tuple[str, str]:
    raw = pair.strip()
    if not raw:
        raise ValueError("Empty --download pair")
    if ":" not in raw:
        raise ValueError(f"Invalid --download pair {pair!r}: expected '<remote_path>:<local_path>'")
    remote_p, local_p = raw.split(":", 1)
    remote_p = remote_p.strip()
    local_p = local_p.strip()
    if not remote_p or not local_p:
        raise ValueError(f"Invalid --download pair {pair!r}: remote and local paths must be non-empty")
    if not remote_p.startswith("/") or _WINDOWS_DRIVE_RE.match(remote_p):
        raise ValueError(
            f"Invalid remote path {remote_p!r} in --download {pair!r}: must be a POSIX path starting with '/'"
        )
    local_rest = local_p[2:] if _WINDOWS_DRIVE_RE.match(local_p) else local_p
    if ":" in local_rest:
        raise ValueError(
            f"Ambiguous local path {local_p!r} in --download {pair!r}: unexpected ':' character"
        )
    return remote_p, local_p


_WIN_RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL", "CONIN$", "CONOUT$",
    *{f"COM{s}" for s in "0123456789\u00b9\u00b2\u00b3"},
    *{f"LPT{s}" for s in "0123456789\u00b9\u00b2\u00b3"},
}


def validate_inputs(
    workers: list[str],
    gpus_arg: str,
    uploads: list[str],
    downloads: list[str],
    cmd_timeout: float,
    new_timeout: float,
    exec_timeout: float,
    transfer_timeout: float,
    job_timeout: float,
    drain_timeout: float,
    teardown_timeout: float,
    poll_interval: float = 12.0,
    min_vram_gib: float = 0.0,
) -> tuple[list[GpuTierSpec], list[tuple[str, str]], list[tuple[str, str]]]:
    for name, val in (
        ("--cmd-timeout-sec", cmd_timeout),
        ("--new-timeout-sec", new_timeout),
        ("--exec-timeout-sec", exec_timeout),
        ("--transfer-timeout-sec", transfer_timeout),
        ("--job-timeout-sec", job_timeout),
        ("--drain-timeout-sec", drain_timeout),
        ("--teardown-timeout-sec", teardown_timeout),
        ("--poll-interval-sec", poll_interval),
    ):
        if not math.isfinite(val) or val <= 0:
            raise ValueError(f"{name} must be finite and > 0, got {val}")
    if not math.isfinite(min_vram_gib) or min_vram_gib < 0:
        raise ValueError(f"--min-vram-gib must be finite and >= 0, got {min_vram_gib}")

    gpu_specs = parse_gpu_specs(gpus_arg)
    for w in workers:
        wp = Path(w)
        if not wp.is_file():
            raise FileNotFoundError(f"Worker script not found or not a file: {w}")

    parsed_uploads = [split_upload_pair(p) for p in uploads]
    seen_upload_parts: list[tuple[tuple[str, ...], str]] = []
    for local_p, remote_p in parsed_uploads:
        lp = Path(local_p)
        if not lp.is_file():
            raise FileNotFoundError(f"Upload source must exist and be a regular file: {local_p}")
        import posixpath

        norm_remote = posixpath.normpath(remote_p)
        r_parts = tuple(seg for seg in norm_remote.strip("/").split("/") if seg)
        for prev_parts, prev_remote in seen_upload_parts:
            if r_parts == prev_parts:
                raise ValueError(f"Duplicate remote upload destination: {remote_p}")
            shorter, longer = (
                (r_parts, prev_parts) if len(r_parts) <= len(prev_parts) else (prev_parts, r_parts)
            )
            if longer[: len(shorter)] == shorter:
                raise ValueError(
                    f"Conflicting ancestor/descendant remote upload destinations: {prev_remote!r} vs {remote_p!r}"
                )
        seen_upload_parts.append((r_parts, remote_p))

    def _max_comp_len(path_str: str) -> int:
        if sys.platform != "win32":
            cur = Path(os.path.abspath(path_str))
            while cur != cur.parent and not cur.exists():
                cur = cur.parent
            if hasattr(os, "pathconf") and cur.exists():
                try:
                    val = int(os.pathconf(str(cur), "PC_NAME_MAX"))
                    if val > 0:
                        return val
                except (OSError, ValueError):
                    pass
            return 255
        try:
            import ctypes
            from ctypes import wintypes

            abs_p = os.path.abspath(path_str)
            drive, _ = os.path.splitdrive(abs_p)
            if drive:
                root = drive if drive.endswith("\\") else f"{drive}\\"
            else:
                cwd_drive, _ = os.path.splitdrive(os.path.abspath("."))
                root = f"{cwd_drive}\\" if cwd_drive else "C:\\"
            max_comp = wintypes.DWORD(0)
            flags = wintypes.DWORD(0)
            ok = ctypes.windll.kernel32.GetVolumeInformationW(
                ctypes.c_wchar_p(root),
                None,
                0,
                None,
                ctypes.byref(max_comp),
                ctypes.byref(flags),
                None,
                0,
            )
            if ok and max_comp.value > 0:
                return int(max_comp.value)
        except Exception:
            pass
        return 255

    def _fs_comp_len(name: str) -> int:
        if sys.platform == "win32":
            return len(name.encode("utf-16-le")) // 2
        return max(len(name), len(name.encode("utf-8", errors="replace")))

    parsed_downloads = [split_download_pair(p) for p in downloads]
    seen_dests: list[tuple[tuple[str, ...], str]] = []
    for _, local_p in parsed_downloads:
        dp = Path(local_p)
        comp_limit = _max_comp_len(local_p)
        for part in dp.parts:
            if part in (dp.anchor, "\\", "/", ".", ".."):
                continue
            if _fs_comp_len(part) > comp_limit:
                raise ValueError(
                    f"Download destination path component exceeds filesystem limit ({comp_limit}): {local_p}"
                )
        if sys.platform == "win32":
            if any(ord(ch) < 32 for ch in local_p):
                raise ValueError(f"Download destination contains control characters on Windows: {local_p!r}")
            rest = local_p[2:] if _WINDOWS_DRIVE_RE.match(local_p) else local_p
            if any(ch in rest for ch in '<>:"|?*'):
                raise ValueError(f"Download destination contains illegal Windows filename characters: {local_p}")
            dp_is_res = getattr(dp, "is_reserved", None)
            if callable(dp_is_res) and dp_is_res():
                raise ValueError(f"Download destination uses reserved Windows device name: {local_p}")
            for part in dp.parts:
                if part in (dp.anchor, "\\", "/", ".", ".."):
                    continue
                part_is_res = getattr(Path(part), "is_reserved", None)
                if callable(part_is_res) and part_is_res():
                    raise ValueError(f"Download destination uses reserved Windows device name: {local_p}")
                if part != part.rstrip(" ."):
                    raise ValueError(f"Download destination has trailing space/dot on Windows: {local_p}")
                stem = part.split(".", 1)[0].rstrip(" .").upper()
                if stem in _WIN_RESERVED_NAMES:
                    raise ValueError(f"Download destination uses reserved Windows device name: {local_p}")
        if dp.exists() and dp.is_dir():
            raise IsADirectoryError(f"Download destination is an existing directory: {local_p}")
        for anc in dp.parents:
            if anc.exists() and not anc.is_dir():
                raise NotADirectoryError(f"Download destination has non-directory ancestor {anc}: {local_p}")
        norm_parts = tuple(os.path.normcase(p) for p in Path(os.path.realpath(local_p)).parts)
        for prev_parts, prev_raw in seen_dests:
            if norm_parts == prev_parts:
                raise ValueError(f"Duplicate local download destination: {local_p}")
            shorter, longer = (
                (norm_parts, prev_parts) if len(norm_parts) <= len(prev_parts) else (prev_parts, norm_parts)
            )
            if longer[: len(shorter)] == shorter:
                raise ValueError(
                    f"Conflicting ancestor/descendant local download destinations: {prev_raw!r} vs {local_p!r}"
                )
        seen_dests.append((norm_parts, local_p))

    return gpu_specs, parsed_uploads, parsed_downloads


class SessionRegistry:
    """Persists instance-owned Colab sessions locally before allocation attempts."""

    def __init__(self, run_id: str, state_dir: Path | None = None) -> None:
        base_dir = state_dir or (Path(tempfile.gettempdir()) / "inferlab_colab_sessions")
        base_dir.mkdir(parents=True, exist_ok=True)
        self.path = base_dir / f"run-{run_id}.json"
        self.run_id = run_id
        self.records: dict[str, dict[str, Any]] = {}
        self._flush()

    def _flush(self) -> None:
        payload = {
            "run_id": self.run_id,
            "pid": os.getpid(),
            "updated_at": time.time(),
            "sessions": list(self.records.values()),
        }
        tmp = self.path.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        tmp.replace(self.path)

    def mark(self, session_name: str, status: str, gpu_spec: str = "", note: str = "") -> None:
        rec = self.records.get(session_name, {"session": session_name, "gpu": gpu_spec})
        rec["status"] = status
        if gpu_spec:
            rec["gpu"] = gpu_spec
        if note:
            rec["note"] = note
        rec["updated_at"] = time.time()
        self.records[session_name] = rec
        self._flush()

    def cleanup_if_all_released(self) -> None:
        active_statuses = {
            "creating",
            "active",
            "maybe_created",
            "absent_after_new_error",
            "stop_failed",
            "ambiguous_ownership",
        }
        if any(r.get("status") in active_statuses for r in self.records.values()):
            return
        try:
            self.path.unlink(missing_ok=True)
        except OSError:
            pass


_HEADER_WORDS = {"session", "name", "alias", "endpoint", "id", "gpu", "accelerator", "status", "state", "runtime", "machine", "type", "uptime"}
_STATUS_NOISE_WORDS = _HEADER_WORDS | {
    "running", "active", "stopped", "creating", "ready", "idle", "offline", "online",
    "true", "false", "yes", "no", "none", "null", "high-mem", "hm",
    "h100", "a100", "g4", "l4", "t4", "v100", "p100", "k80", "gpu", "cpu", "tpu",
    "warning", "warn", "error", "err", "info", "debug", "note", "retrying", "retry",
    "request", "unavailable", "connecting", "fetching", "loading",
}
_DURATION_TOKEN_RE = re.compile(
    r"\b(?:\d+(?::\d{2})+|\d+d\s*\d+h\d{1,2}m(?:\d{1,2}s)?|\d+h\d{1,2}m(?:\d{1,2}s)?|\d+m\d{1,2}s|\d+(?:\.\d+)?s)\b",
    re.IGNORECASE,
)
_PROSE_LOG_LINE_RE = re.compile(r"^(?:\[?(?:warning|warn|error|err|info|debug|note|hint)\]?\s*:)", re.IGNORECASE)
_UNNAMED_CELL_RE = re.compile(r"(?:^|[\s|])\[?\?\]?(?:$|[\s|])")
_NO_SESSIONS_BANNER_RE = re.compile(r"^no\s+active\s+(?:colab\s+)?sessions?\.?$|^no\s+sessions?\.?$", re.IGNORECASE)
_TERMINAL_EXC_LINE_RE = re.compile(
    r"^(?:"
    r"(?:[A-Za-z_][A-Za-z0-9_.]*\.)?(?=[A-Za-z_])[A-Za-z0-9_]*(?:Error|Exception|Exit|Interrupt|Timeout|Fault|Cancelled|Abort|Failure|Warning)"
    r"|(?:[A-Za-z_][A-Za-z0-9_]*\.)+[A-Z][A-Za-z0-9_]*"
    r"|(?:[A-Za-z_][A-Za-z0-9_]*\.)*[A-Z][a-z0-9_]+(?:[A-Z][A-Za-z0-9_]*)+"
    r"|StopIteration|StopAsyncIteration|Warning"
    r")\b(?::|\s*$)"
)
_BENIGN_CAPITAL_LOG_PREFIXES = frozenset(
    {
        "Info", "Note", "Hint", "Output", "Log", "Status", "Debug", "Trace",
        "Stdout", "Stderr", "Progress", "Step", "Epoch", "Device", "Using",
        "Loaded", "Saved", "Downloading", "Uploading", "Summary", "Result",
        "Config", "Args", "Memory", "GPU", "CPU", "NPU", "CUDA", "Traceback",
    }
)
_SINGLE_CAP_EXC_RE = re.compile(r"^([A-Z][A-Za-z0-9_]*)(?::|\s*$)")


def _is_terminal_exception_line(sline: str) -> bool:
    if _TERMINAL_EXC_LINE_RE.match(sline):
        return True
    m = _SINGLE_CAP_EXC_RE.match(sline)
    return bool(m and m.group(1) not in _BENIGN_CAPITAL_LOG_PREFIXES)


def _parse_session_snapshot(raw_text: str) -> tuple[set[str], list[str], int]:
    """Return (named_sessions, canonical_row_fingerprints, unnamed_endpoint_count)."""
    names: set[str] = set()
    fingerprints: list[str] = []
    unnamed_count = 0
    stripped = raw_text.strip()
    if not stripped:
        return names, fingerprints, unnamed_count
    if stripped[0] in "[{":
        try:
            parsed = json.loads(stripped)
        except (json.JSONDecodeError, RecursionError, MemoryError, TypeError, ValueError) as exc:
            raise ValueError(f"Malformed JSON session listing: {exc}") from exc
        if isinstance(parsed, list):
            items: Any = parsed
        elif isinstance(parsed, dict) and ("sessions" in parsed or "assignments" in parsed):
            items = parsed.get("sessions") if "sessions" in parsed else parsed.get("assignments")
        else:
            raise ValueError(f"Unrecognized JSON session listing schema: {type(parsed).__name__}")
        if not isinstance(items, list):
            raise ValueError(f"Expected list in JSON session listing, got {type(items).__name__}")
        for entry in items:
            if isinstance(entry, str) and entry.strip():
                s = entry.strip()
                if s in ("?", "[?]", "-", "<unnamed>"):
                    unnamed_count += 1
                    fingerprints.append(f"unnamed:{s}")
                else:
                    names.add(s)
                    fingerprints.append(f"str:{s}")
            elif isinstance(entry, dict):
                alias = ""
                for key in ("name", "session", "session_name", "alias"):
                    v = entry.get(key)
                    if isinstance(v, str) and v.strip() and v.strip() not in ("?", "[?]", "-"):
                        alias = v.strip()
                        names.add(alias)
                endpoint = ""
                for key in ("endpoint", "id"):
                    v = entry.get(key)
                    if isinstance(v, str) and v.strip() and v.strip() not in ("?", "[?]", "-"):
                        endpoint = v.strip()
                        names.add(endpoint)
                if not alias:
                    unnamed_count += 1
                fingerprints.append(f"row:{alias}|{endpoint}")
            else:
                raise ValueError(f"Unexpected entry type in JSON session listing: {type(entry).__name__}")
        return names, fingerprints, unnamed_count
    for line in stripped.splitlines():
        sline = line.strip()
        if not sline or set(sline) <= set("-_=+| "):
            continue
        if _NO_SESSIONS_BANNER_RE.match(sline) or _PROSE_LOG_LINE_RE.match(sline):
            continue
        low_words = [w.strip("|:,") for w in sline.lower().split()]
        if sum(1 for w in low_words if w in _HEADER_WORDS) >= 2 and not any(
            w.startswith(("inferlab-", "m-s-")) for w in low_words
        ):
            continue
        no_dur = _DURATION_TOKEN_RE.sub("<TIME>", sline)
        row_tokens = _SESSION_TOKEN_RE.findall(no_dur)
        row_ids: list[str] = []
        for tok in row_tokens:
            if tok == "TIME":
                continue
            low_t = tok.lower()
            if low_t in _STATUS_NOISE_WORDS or tok.isdigit():
                continue
            names.add(tok)
            row_ids.append(tok)
        has_unnamed = bool(_UNNAMED_CELL_RE.search(no_dur))
        if has_unnamed:
            unnamed_count += 1
        if row_ids:
            fingerprints.append("ids:" + "|".join(sorted(set(row_ids))))
        elif has_unnamed:
            fingerprints.append(f"unnamed:{' '.join(no_dur.split())}")
        else:
            fingerprints.append(f"line:{' '.join(no_dur.split())}")
    return names, fingerprints, unnamed_count


def _parse_session_names(raw_text: str) -> set[str]:
    names, _, _ = _parse_session_snapshot(raw_text)
    return names


def list_remote_sessions(
    colab: str,
    timeout: float,
    deadline: float | None = None,
    *,
    on_observed: Any = None,
    interrupt_guard: Any = None,
    interrupt_poll: Any = None,
) -> tuple[bool, set[str], str]:
    subcommands = ("sessions", "list")
    last_out = ""
    for idx, subcmd in enumerate(subcommands):
        guard_ctx = (
            interrupt_guard() if interrupt_guard is not None else contextlib.nullcontext()
        )
        with guard_ctx:
            try:
                rc_kw: dict[str, Any] = {}
                if interrupt_poll is not None and getattr(run_cmd, "_supports_interrupt_poll", False) is True:
                    rc_kw["interrupt_poll"] = interrupt_poll
                res = run_cmd(
                    [colab, "--auth=oauth2", subcmd],
                    check=False,
                    capture=True,
                    timeout=timeout,
                    deadline=deadline,
                    **rc_kw,
                )
            except JobInterruptedError:
                raise
            except Exception as exc:
                last_out = f"{type(exc).__name__}: {exc}"
                continue
            stdout_txt = res.stdout or ""
            combined = f"{stdout_txt}\n{res.stderr or ''}".strip()
            last_out = combined
            if res.returncode == 0:
                try:
                    names = _parse_session_names(stdout_txt)
                except (ValueError, RecursionError, MemoryError, TypeError) as exc:
                    return False, set(), f"{exc}: {stdout_txt[:200]}"
                if on_observed is not None:
                    on_observed(names)
                return True, names, stdout_txt
        low = combined.lower()
        if idx == 0 and (
            "invalid choice" in low
            or "unknown command" in low
            or "unrecognized arguments" in low
            or "no such command" in low
        ):
            continue
        return False, set(), combined
    return False, set(), last_out


setattr(list_remote_sessions, "_supports_on_observed", True)
setattr(list_remote_sessions, "_supports_interrupt_guard", True)
setattr(list_remote_sessions, "_supports_interrupt_poll", True)


def stop_remote_session(
    colab: str,
    session_name: str,
    timeout: float,
    teardown_deadline: float,
    max_attempts: int = 3,
) -> tuple[bool, str]:
    last_err = ""
    for attempt in range(max_attempts):
        rem = teardown_deadline - time.monotonic()
        if rem <= 0:
            last_err = last_err or f"Teardown deadline exceeded before stopping {session_name}"
            break
        try:
            res = run_cmd(
                [colab, "--auth=oauth2", "stop", "-s", session_name],
                check=False,
                capture=True,
                timeout=min(timeout, rem),
                deadline=teardown_deadline,
            )
            if res.returncode == 0:
                return True, ""
            last_err = (res.stderr or res.stdout or f"rc={res.returncode}").strip()
        except JobInterruptedError:
            raise
        except (OSError, RuntimeError, ValueError, subprocess.TimeoutExpired, TimeoutError) as exc:
            last_err = f"{type(exc).__name__}: {exc}"
        if attempt + 1 < max_attempts:
            rem_sleep = min(2.0 * (attempt + 1), max(0.0, teardown_deadline - time.monotonic()))
            if rem_sleep > 0:
                time.sleep(rem_sleep)
    return False, last_err or f"Failed to stop {session_name}"


_PROC_START_HELPER = """
def _proc_start(pid, allow_zombie=False, raise_perm=False):
    if not isinstance(pid, int) or isinstance(pid, bool) or pid <= 0:
        return None
    if sys.platform == "win32":
        import ctypes
        k32 = ctypes.WinDLL("kernel32", use_last_error=True)
        k32.OpenProcess.restype = ctypes.c_void_p
        k32.OpenProcess.argtypes = [ctypes.c_uint32, ctypes.c_int, ctypes.c_uint32]
        k32.GetExitCodeProcess.restype = ctypes.c_int
        k32.GetExitCodeProcess.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_uint32)]
        k32.GetProcessTimes.restype = ctypes.c_int
        k32.GetProcessTimes.argtypes = [
            ctypes.c_void_p,
            ctypes.POINTER(ctypes.c_uint64),
            ctypes.POINTER(ctypes.c_uint64),
            ctypes.POINTER(ctypes.c_uint64),
            ctypes.POINTER(ctypes.c_uint64),
        ]
        k32.CloseHandle.restype = ctypes.c_int
        k32.CloseHandle.argtypes = [ctypes.c_void_p]
        h = k32.OpenProcess(0x1000, 0, int(pid))
        if not h:
            return None
        try:
            if not allow_zombie:
                code = ctypes.c_uint32(0)
                if not k32.GetExitCodeProcess(h, ctypes.byref(code)) or code.value != 259:
                    return None
            c, e, k, u = ctypes.c_uint64(0), ctypes.c_uint64(0), ctypes.c_uint64(0), ctypes.c_uint64(0)
            if not k32.GetProcessTimes(h, ctypes.byref(c), ctypes.byref(e), ctypes.byref(k), ctypes.byref(u)):
                return None
            return str(c.value)
        finally:
            k32.CloseHandle(h)
    kill_perm = False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return None
    except PermissionError:
        kill_perm = True
    except OSError:
        return None
    proc_stat = pathlib.Path(f"/proc/{pid}/stat")
    last_perm = None
    for attempt in range(3):
        try:
            if not proc_stat.exists():
                if attempt < 2:
                    time.sleep(0.05)
                    continue
                if raise_perm and kill_perm:
                    raise PermissionError(f"permission denied probing /proc/{pid}/stat")
                return None
            st = proc_stat.read_text(encoding="utf-8", errors="replace")
            rp = st.rfind(")")
            fields = st[rp + 2 :].split() if rp != -1 else []
            if len(fields) >= 20:
                if not allow_zombie and fields[0] in ("Z", "X", "x"):
                    return None
                return fields[19]
            if not allow_zombie and fields and fields[0] in ("Z", "X", "x"):
                return None
        except PermissionError as exc:
            last_perm = exc
            if attempt < 2:
                time.sleep(0.05)
                continue
            if raise_perm:
                raise
            return None
        except OSError:
            if attempt < 2:
                time.sleep(0.05)
                continue
            return None
    if raise_perm and (last_perm is not None or kill_perm):
        raise PermissionError(str(last_perm or f"permission denied probing pid {pid}"))
    return None
""".strip()


def _build_launch_snippet(
    remote_py: str,
    remote_runner: str,
    remote_log: str,
    remote_rc: str,
    remote_pid: str,
    remote_launch_err: str,
    launch_nonce: str,
    remote_admission: str = "",
) -> str:
    runner_code = (
        "import json, os, pathlib, signal, subprocess, sys\n"
        f"nonce = {launch_nonce!r}\n"
        f"rc_path = pathlib.Path({remote_rc!r})\n"
        f"rc_tmp = pathlib.Path({remote_rc + '.tmp'!r})\n"
        f"adm_path = pathlib.Path({remote_admission!r}) if {remote_admission!r} else None\n"
        "child_proc = None\n"
        "def _read_adm():\n"
        "    if adm_path and adm_path.exists():\n"
        "        try:\n"
        "            d = json.loads(adm_path.read_text(encoding='utf-8', errors='replace'))\n"
        "            if isinstance(d, dict) and d.get('nonce') == nonce:\n"
        "                return d\n"
        "        except Exception:\n"
        "            pass\n"
        "    return None\n"
        "def _write_rc(code, err=None):\n"
        "    payload = {'nonce': nonce, 'rc': int(code), 'pid': os.getpid()}\n"
        "    if err:\n"
        "        payload['spawn_error'] = str(err)\n"
        "    adm = _read_adm()\n"
        "    if adm is not None:\n"
        "        payload['admission'] = adm\n"
        "    rc_tmp.write_text(json.dumps(payload), encoding='utf-8')\n"
        "    rc_tmp.replace(rc_path)\n"
        "def _handle_sig(signum, _frame):\n"
        "    if child_proc is not None and child_proc.poll() is None:\n"
        "        try:\n"
        "            child_proc.terminate()\n"
        "        except OSError:\n"
        "            pass\n"
        "    _write_rc(-int(signum), f'Terminated by signal {signum}')\n"
        "    raise SystemExit(128 + int(signum))\n"
        "for sig in (signal.SIGTERM, signal.SIGINT):\n"
        "    try:\n"
        "        signal.signal(sig, _handle_sig)\n"
        "    except Exception:\n"
        "        pass\n"
        "rc_val = -1\n"
        "spawn_err = None\n"
        "try:\n"
        "    child_env = dict(os.environ)\n"
        "    child_env['INFERLAB_LAUNCH_NONCE'] = nonce\n"
        "    if adm_path:\n"
        "        child_env['INFERLAB_ADMISSION_FILE'] = str(adm_path)\n"
        f"    with open({remote_log!r}, 'w', encoding='utf-8') as logf:\n"
        f"        child_proc = subprocess.Popen([sys.executable, '-u', {remote_py!r}], stdin=subprocess.DEVNULL, stdout=logf, stderr=subprocess.STDOUT, env=child_env)\n"
        "        rc_val = int(child_proc.wait())\n"
        "except Exception as exc:\n"
        "    spawn_err = repr(exc)\n"
        "    rc_val = -1\n"
        "finally:\n"
        "    if not rc_path.exists():\n"
        "        _write_rc(rc_val, spawn_err)\n"
    )
    unlink_list = [remote_rc, remote_rc + ".tmp", remote_pid, remote_pid + ".tmp", remote_log, remote_launch_err]
    if remote_admission:
        unlink_list.append(remote_admission)
    return f"""
import json, os, pathlib, subprocess, sys, time
{_PROC_START_HELPER}
pathlib.Path({remote_runner!r}).write_text({runner_code!r}, encoding="utf-8")
for _p in {tuple(unlink_list)!r}:
    pathlib.Path(_p).unlink(missing_ok=True)
err_fh = open({remote_launch_err!r}, "w", encoding="utf-8")
try:
    launch_env = dict(os.environ)
    launch_env["INFERLAB_LAUNCH_NONCE"] = {launch_nonce!r}
    p = subprocess.Popen(
        [sys.executable, {remote_runner!r}],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=err_fh,
        close_fds=True,
        start_new_session=True,
        env=launch_env,
    )
finally:
    err_fh.close()
start_id = _proc_start(p.pid, allow_zombie=True)
try:
    pgid = os.getpgid(p.pid) if (sys.platform != "win32" and hasattr(os, "getpgid")) else p.pid
except OSError:
    pgid = p.pid
time.sleep(0.15)
early_rc = p.poll()
rc_valid = False
if pathlib.Path({remote_rc!r}).exists():
    try:
        rc_doc = json.loads(pathlib.Path({remote_rc!r}).read_text(encoding="utf-8", errors="replace"))
        rc_valid = isinstance(rc_doc, dict) and rc_doc.get("nonce") == {launch_nonce!r}
    except Exception:
        rc_valid = False
if early_rc is not None and not rc_valid:
    err_txt = ""
    try:
        err_txt = pathlib.Path({remote_launch_err!r}).read_text(encoding="utf-8", errors="replace").strip()
    except OSError:
        pass
    print("LAUNCH_FAILED:" + json.dumps({{"nonce": {launch_nonce!r}, "rc": early_rc, "stderr": err_txt[-2000:]}}))
    sys.exit(1)
meta = {{"nonce": {launch_nonce!r}, "pid": p.pid, "pgid": pgid, "start": start_id, "fast_exit": bool(early_rc is not None and rc_valid), "runner": {remote_runner!r}}}
tmp_pid = pathlib.Path({remote_pid + '.tmp'!r})
tmp_pid.write_text(json.dumps(meta), encoding="utf-8")
tmp_pid.replace({remote_pid!r})
print("LAUNCHED_META:" + json.dumps(meta))
print("LAUNCHED_OK")
""".strip()


def _build_kill_runner_snippet(
    expected_pid: int | None,
    expected_pgid: int | None,
    expected_start: str | None,
    expected_nonce: str,
    remote_pid: str,
) -> str:
    return f"""
import json, os, pathlib, signal, sys, time
{_PROC_START_HELPER}
pid_p = pathlib.Path({remote_pid!r})
target_pid = {expected_pid!r}
target_pgid = {expected_pgid!r}
exp_pgid = {expected_pgid!r}
exp_start = {expected_start!r}
exp_nonce = {expected_nonce!r}
if pid_p.exists():
    try:
        meta = json.loads(pid_p.read_text(encoding="utf-8", errors="replace"))
        if isinstance(meta, dict) and meta.get("nonce") == exp_nonce:
            if not target_pid and isinstance(meta.get("pid"), int) and not isinstance(meta.get("pid"), bool):
                target_pid = meta["pid"]
            if target_pgid is None and isinstance(meta.get("pgid"), int) and not isinstance(meta.get("pgid"), bool):
                target_pgid = meta["pgid"]
            if not exp_start and meta.get("start"):
                exp_start = str(meta["start"])
    except Exception:
        pass
def _sweep_nonce_descendants():
    killed = 0
    sweep_errs = []
    if not exp_nonce or not os.path.isdir("/proc"):
        return 0, []
    marker = ("INFERLAB_LAUNCH_NONCE=" + str(exp_nonce)).encode("ascii", "ignore")
    my_pid = os.getpid()
    targets = []
    for entry in os.listdir("/proc"):
        if not entry.isdigit():
            continue
        dpid = int(entry)
        if dpid <= 1 or dpid == my_pid:
            continue
        try:
            raw_env = pathlib.Path(f"/proc/{{dpid}}/environ").read_bytes()
        except OSError:
            continue
        if marker in raw_env.split(b"\\x00"):
            d_start = _proc_start(dpid, allow_zombie=False)
            if d_start is not None:
                targets.append((dpid, str(d_start)))
    pidfd_open_fn = getattr(os, "pidfd_open", None)
    pidfd_send_fn = getattr(signal, "pidfd_send_signal", None)
    pidfd_close_fn = getattr(os, "close", None)
    use_pidfd = callable(pidfd_open_fn) and callable(pidfd_send_fn) and callable(pidfd_close_fn)
    if not use_pidfd:
        return 0, []
    sigkilled_wait = []
    held_pfds = []
    try:
        for dpid, saved_start in targets:
            pfd = None
            try:
                try:
                    pfd = pidfd_open_fn(dpid)
                except ProcessLookupError:
                    continue
                except OSError as p_exc:
                    if getattr(p_exc, "errno", None) == getattr(__import__("errno"), "ENOSYS", 38):
                        use_pidfd = False
                        break
                    sweep_errs.append(f"descendant {{dpid}} pidfd_open: {{p_exc}}")
                    continue
                cur_env = pathlib.Path(f"/proc/{{dpid}}/environ").read_bytes()
                if marker not in cur_env.split(b"\\x00"):
                    pidfd_close_fn(pfd)
                    continue
                if str(_proc_start(dpid, allow_zombie=False) or "") != saved_start:
                    pidfd_close_fn(pfd)
                    continue
                try:
                    pidfd_send_fn(pfd, signal.SIGTERM)
                except ProcessLookupError:
                    pidfd_close_fn(pfd)
                    continue
                killed += 1
                held_pfds.append(pfd)
                sigkilled_wait.append((dpid, saved_start, pfd))
            except OSError as exc:
                sweep_errs.append(f"descendant {{dpid}} SIGTERM: {{exc}}")
                if pfd is not None:
                    try:
                        pidfd_close_fn(pfd)
                    except OSError:
                        pass
        if sigkilled_wait:
            time.sleep(0.3)
            for _dpid, _saved_start, pfd in sigkilled_wait:
                try:
                    pidfd_send_fn(pfd, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                except OSError as exc:
                    sweep_errs.append(f"descendant {{_dpid}} SIGKILL: {{exc}}")
    finally:
        for pfd in held_pfds:
            try:
                pidfd_close_fn(pfd)
            except OSError:
                pass
    return killed, sweep_errs
if not target_pid or not exp_start:
    swept, sw_errs = _sweep_nonce_descendants()
    if sw_errs:
        print("KILL_ERR:" + "; ".join(sw_errs))
        sys.exit(1)
    if swept:
        print("KILLED_DESCENDANTS:" + str(swept))
        sys.exit(0)
    print("KILL_SKIPPED:missing_identity")
    sys.exit(1)
pidfd_open_fn = getattr(os, "pidfd_open", None)
pidfd_send_fn = getattr(signal, "pidfd_send_signal", None)
pidfd_close_fn = getattr(os, "close", None)
if not (callable(pidfd_open_fn) and callable(pidfd_send_fn) and callable(pidfd_close_fn)):
    print("KILL_SKIPPED:pidfd_unavailable")
    sys.exit(1)
t_pfd = None
try:
    try:
        t_pfd = pidfd_open_fn(int(target_pid))
    except ProcessLookupError:
        swept, sw_errs = _sweep_nonce_descendants()
        if sw_errs:
            print("KILL_ERR:" + "; ".join(sw_errs))
            sys.exit(1)
        print("KILLED_DESCENDANTS:" + str(swept) if swept else "ALREADY_EXITED")
        sys.exit(0)
    except OSError as p_exc:
        if getattr(p_exc, "errno", None) == getattr(__import__("errno"), "ENOSYS", 38):
            print("KILL_SKIPPED:pidfd_unavailable")
            sys.exit(1)
        print("KILL_ERR:" + str(p_exc))
        sys.exit(1)
    try:
        cur_start = _proc_start(int(target_pid), allow_zombie=True, raise_perm=True)
    except PermissionError as p_exc:
        print("KILL_ERR:" + str(p_exc))
        sys.exit(1)
    if cur_start is None:
        swept, sw_errs = _sweep_nonce_descendants()
        if sw_errs:
            print("KILL_ERR:" + "; ".join(sw_errs))
            sys.exit(1)
        print("KILLED_DESCENDANTS:" + str(swept) if swept else "ALREADY_EXITED")
        sys.exit(0)
    if str(cur_start) != str(exp_start):
        swept, sw_errs = _sweep_nonce_descendants()
        if sw_errs:
            print("KILL_ERR:" + "; ".join(sw_errs))
            sys.exit(1)
        if swept:
            print("KILLED_DESCENDANTS:" + str(swept))
            sys.exit(0)
        print("KILL_SKIPPED:identity_mismatch")
        sys.exit(1)
    safe_pgid = None
    if sys.platform != "win32" and hasattr(os, "getpgid"):
        try:
            live_pgid = os.getpgid(int(target_pid))
            own_pgid = os.getpgid(os.getpid())
            if live_pgid != own_pgid and (
                live_pgid == int(target_pid)
                or (exp_pgid is not None and live_pgid == int(exp_pgid))
            ):
                safe_pgid = live_pgid
        except OSError:
            safe_pgid = None
    if sys.platform != "win32" and safe_pgid:
        grp_pfds = []
        grp_open_errs = []
        try:
            if os.path.isdir("/proc"):
                my_pid = os.getpid()
                for entry in os.listdir("/proc"):
                    if not entry.isdigit():
                        continue
                    mpid = int(entry)
                    if mpid <= 1 or mpid == my_pid or mpid == int(target_pid):
                        continue
                    mpfd = None
                    try:
                        m_start = _proc_start(mpid, allow_zombie=False)
                        if m_start is None or os.getpgid(mpid) != int(safe_pgid):
                            continue
                        try:
                            mpfd = pidfd_open_fn(mpid)
                        except ProcessLookupError:
                            continue
                        except OSError as p_exc:
                            if getattr(p_exc, "errno", None) == getattr(__import__("errno"), "ENOSYS", 38):
                                raise
                            grp_open_errs.append(f"group {{mpid}} pidfd_open: {{p_exc}}")
                            continue
                        if str(_proc_start(mpid, allow_zombie=False) or "") != str(m_start) or os.getpgid(mpid) != int(safe_pgid):
                            pidfd_close_fn(mpfd)
                            continue
                        grp_pfds.append(mpfd)
                    except OSError as exc:
                        if getattr(exc, "errno", None) == getattr(__import__("errno"), "ENOSYS", 38):
                            raise
                        if mpfd is not None:
                            try:
                                pidfd_close_fn(mpfd)
                            except OSError:
                                pass
            for gfd in [t_pfd] + grp_pfds:
                try:
                    pidfd_send_fn(gfd, signal.SIGTERM)
                except ProcessLookupError:
                    pass
            time.sleep(0.5)
            still_same_group = False
            try:
                cur_live_start = _proc_start(int(target_pid), allow_zombie=False)
                still_same_group = (
                    cur_live_start is not None
                    and str(cur_live_start) == str(exp_start)
                    and os.getpgid(int(target_pid)) == int(safe_pgid)
                )
            except OSError:
                still_same_group = False
            kill_errs = list(grp_open_errs)
            if still_same_group:
                try:
                    pidfd_send_fn(t_pfd, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                except OSError as exc:
                    kill_errs.append(f"target SIGKILL: {{exc}}")
            for gfd in grp_pfds:
                try:
                    pidfd_send_fn(gfd, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                except OSError as exc:
                    kill_errs.append(f"group SIGKILL: {{exc}}")
            _, sw_errs = _sweep_nonce_descendants()
            kill_errs.extend(sw_errs)
            if kill_errs:
                print("KILL_ERR:" + "; ".join(kill_errs))
                sys.exit(1)
            print("KILLED_PGID")
        except OSError as exc:
            print("KILL_ERR:" + str(exc))
            sys.exit(1)
        finally:
            for gfd in grp_pfds:
                try:
                    pidfd_close_fn(gfd)
                except OSError:
                    pass
    elif target_pid:
        try:
            pidfd_send_fn(t_pfd, signal.SIGTERM)
            time.sleep(0.3)
            kill_errs = []
            try:
                pidfd_send_fn(t_pfd, signal.SIGKILL)
            except ProcessLookupError:
                pass
            except OSError as exc:
                kill_errs.append(f"target SIGKILL: {{exc}}")
            _, sw_errs = _sweep_nonce_descendants()
            kill_errs.extend(sw_errs)
            if kill_errs:
                print("KILL_ERR:" + "; ".join(kill_errs))
                sys.exit(1)
            print("KILLED_PID")
        except ProcessLookupError:
            swept, sw_errs = _sweep_nonce_descendants()
            if sw_errs:
                print("KILL_ERR:" + "; ".join(sw_errs))
                sys.exit(1)
            print("KILLED_DESCENDANTS:" + str(swept) if swept else "ALREADY_EXITED")
        except OSError as exc:
            print("KILL_ERR:" + str(exc))
            sys.exit(1)
finally:
    if t_pfd is not None:
        try:
            pidfd_close_fn(t_pfd)
        except OSError:
            pass
""".strip()


def _build_poll_snippet(
    remote_log: str,
    remote_rc: str,
    remote_pid: str,
    remote_launch_err: str,
    offset: int,
    expected_nonce: str,
    expected_pid: int | None = None,
    expected_start: str | None = None,
    remote_admission: str = "",
    expected_runner: str = "",
) -> str:
    return f"""
import base64, hashlib, json, os, pathlib, sys, time
log_p = pathlib.Path({remote_log!r})
rc_p = pathlib.Path({remote_rc!r})
pid_p = pathlib.Path({remote_pid!r})
lerr_p = pathlib.Path({remote_launch_err!r})
adm_p = pathlib.Path({remote_admission!r}) if {remote_admission!r} else None
exp_nonce = {expected_nonce!r}
exp_pid = {expected_pid!r}
exp_start = {expected_start!r}
exp_runner = {expected_runner!r}
{_PROC_START_HELPER}
def _read_rc():
    for _attempt in range(2):
        if not rc_p.exists():
            return None, None, None
        try:
            raw = rc_p.read_text(encoding="utf-8", errors="replace").strip()
            if not raw:
                return None, None, None
            data = json.loads(raw)
            if not isinstance(data, dict) or data.get("nonce") != exp_nonce:
                return None, None, None
            rc_val = data.get("rc")
            if not isinstance(rc_val, int) or isinstance(rc_val, bool):
                return None, None, None
            return rc_val, data.get("spawn_error"), data.get("admission")
        except (ValueError, json.JSONDecodeError):
            return None, None, None
        except OSError:
            time.sleep(0.05)
    return None, None, None
def _runner_alive():
    meta = None
    for _attempt in range(3):
        if not pid_p.exists():
            time.sleep(0.03)
            continue
        try:
            raw = pid_p.read_text(encoding="utf-8", errors="replace").strip()
            if not raw or not raw.startswith("{{"):
                break
            parsed = json.loads(raw)
            if not isinstance(parsed, dict) or parsed.get("nonce") != exp_nonce:
                return False
            meta = parsed
            break
        except (ValueError, json.JSONDecodeError):
            break
        except OSError:
            time.sleep(0.05)
    if meta is not None:
        pid_val = meta.get("pid")
        if not isinstance(pid_val, int) or isinstance(pid_val, bool) or pid_val <= 0:
            return False
        start_val = meta.get("start")
        runner_path = str(meta.get("runner") or exp_runner or "")
        if not start_val:
            return False
        if exp_pid is not None and pid_val != int(exp_pid):
            return False
        if exp_start is not None and str(start_val) != str(exp_start):
            return False
    elif isinstance(exp_pid, int) and exp_pid > 0 and exp_start:
        pid_val = int(exp_pid)
        start_val = str(exp_start)
        runner_path = str(exp_runner or "")
    else:
        return False
    cur_start = _proc_start(pid_val, allow_zombie=False)
    if cur_start is None or str(cur_start) != str(start_val):
        return False
    if runner_path and sys.platform != "win32":
        cmdline_p = pathlib.Path(f"/proc/{{pid_val}}/cmdline")
        if cmdline_p.exists():
            try:
                argv = [
                    tok.decode("utf-8", "replace")
                    for tok in cmdline_p.read_bytes().split(b"\\x00")
                    if tok
                ]
                if argv and runner_path not in argv:
                    return False
            except OSError:
                pass
    return True
rc, spawn_err, adm_obj = _read_rc()
runner_dead = False
if rc is None:
    if not _runner_alive():
        rc, spawn_err, _adm2 = _read_rc()
        adm_obj = _adm2
        if rc is None:
            runner_dead = True
if adm_obj is None and adm_p and adm_p.exists():
    try:
        _ad = json.loads(adm_p.read_text(encoding="utf-8", errors="replace"))
        if isinstance(_ad, dict) and _ad.get("nonce") == exp_nonce:
            adm_obj = _ad
    except Exception:
        pass
launch_err = ""
if runner_dead and lerr_p.exists():
    try:
        launch_err = lerr_p.read_text(encoding="utf-8", errors="replace").strip()[-1000:]
    except OSError:
        pass
chunk_size = 524288 if (rc is not None or runner_dead) else 65536
log_truncated = False
log_id = ""
head_hash = ""
if log_p.exists():
    try:
        st = log_p.stat()
        log_id = f"{{st.st_dev}}:{{st.st_ino}}"
    except OSError:
        log_id = ""
    with log_p.open("rb") as f:
        f.seek(0, 2)
        total = f.tell()
        if total >= 256:
            f.seek(0)
            head_hash = hashlib.sha256(f.read(256)).hexdigest()
        if total < {offset}:
            log_truncated = True
            chunk = b""
        elif {offset} < total:
            to_read = min(chunk_size, total - {offset})
            f.seek({offset})
            chunk = f.read(to_read)
        else:
            chunk = b""
else:
    total = 0
    if {offset} > 0:
        log_truncated = True
    chunk = b""
new_off = {offset} + len(chunk)
print("POLL_JSON:" + json.dumps({{
    "off": new_off,
    "total": total,
    "rc": rc,
    "runner_dead": runner_dead,
    "truncated": log_truncated,
    "log_id": log_id,
    "head_hash": head_hash,
    "spawn_error": spawn_err,
    "launch_err": launch_err,
    "admission": adm_obj,
    "b64": base64.b64encode(chunk).decode("ascii"),
}}))
""".strip()


def _build_gpu_probe_snippet() -> str:
    return """
import json, shutil, subprocess
out = {"has_gpu": False, "name": "", "vram_gib": 0.0, "source": "none"}
nvsmi = shutil.which("nvidia-smi")
if nvsmi:
    r = subprocess.run(
        [nvsmi, "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
        capture_output=True, text=True, check=False, timeout=15
    )
    if r.returncode == 0 and r.stdout.strip():
        line = r.stdout.strip().splitlines()[0]
        parts = [p.strip() for p in line.split(",")]
        if len(parts) >= 2:
            try:
                mib = float(parts[1])
                out = {"has_gpu": True, "name": parts[0], "vram_gib": mib / 1024.0, "source": "nvidia-smi"}
            except ValueError:
                pass
if not out["has_gpu"]:
    try:
        import torch
        if torch.cuda.is_available():
            props = torch.cuda.get_device_properties(0)
            out = {
                "has_gpu": True,
                "name": torch.cuda.get_device_name(0),
                "vram_gib": float(props.total_memory) / (1024 ** 3),
                "source": "torch.cuda",
            }
    except Exception:
        pass
print("GPU_PROBE:" + json.dumps(out))
""".strip()


def _build_remote_file_meta_snippet(remote_path: str) -> str:
    return f"""
import hashlib, json, pathlib
p = pathlib.Path({remote_path!r})
if not p.is_file():
    print("REMOTE_META:" + json.dumps({{"exists": False, "size": 0, "sha256": ""}}))
else:
    h = hashlib.sha256()
    size = 0
    with p.open("rb") as f:
        while True:
            blk = f.read(1048576)
            if not blk:
                break
            h.update(blk)
            size += len(blk)
    print("REMOTE_META:" + json.dumps({{"exists": True, "size": size, "sha256": h.hexdigest()}}))
""".strip()


def parse_and_validate_poll_state(
    state: Any, prev_offset: int
) -> tuple[int, int, int | None, bool, bool, bytes, str, str, str, str, dict[str, Any] | None]:
    if not isinstance(state, dict):
        raise ValueError("POLL_JSON payload is not a JSON object")
    required = ("off", "total", "rc", "runner_dead", "b64")
    for key in required:
        if key not in state:
            raise ValueError(f"POLL_JSON missing required field {key!r}")

    new_off = state["off"]
    total = state["total"]
    rc = state["rc"]
    runner_dead = state["runner_dead"]
    b64_text = state["b64"]
    truncated = state.get("truncated", False)

    if not _is_exact_int(new_off) or new_off < 0:
        raise ValueError(f"POLL_JSON 'off' must be a non-negative int, got {new_off!r}")
    if not _is_exact_int(total) or total < 0:
        raise ValueError(f"POLL_JSON 'total' must be a non-negative int, got {total!r}")
    if rc is not None and not _is_exact_int(rc):
        raise ValueError(f"POLL_JSON 'rc' must be int or null, got {rc!r}")
    if not isinstance(runner_dead, bool):
        raise ValueError(f"POLL_JSON 'runner_dead' must be bool, got {runner_dead!r}")
    if rc is not None and runner_dead:
        raise ValueError(
            f"POLL_JSON contradictory terminal state: rc={rc!r} cannot coexist with runner_dead=True"
        )
    if not isinstance(truncated, bool):
        raise ValueError(f"POLL_JSON 'truncated' must be bool, got {truncated!r}")
    if not isinstance(b64_text, str):
        raise ValueError(f"POLL_JSON 'b64' must be str, got {type(b64_text).__name__}")

    try:
        raw_bytes = base64.b64decode(b64_text.encode("ascii"), validate=True)
    except (binascii.Error, ValueError, UnicodeEncodeError) as exc:
        raise ValueError(f"Invalid base64 payload in POLL_JSON: {exc}") from exc

    if new_off != prev_offset + len(raw_bytes):
        raise ValueError(
            f"POLL_JSON offset mismatch: new_off={new_off} != prev_offset({prev_offset}) + len(raw)({len(raw_bytes)})"
        )
    if not truncated and (new_off < prev_offset or new_off > total):
        raise ValueError(
            f"POLL_JSON inconsistent offset/total bounds: prev={prev_offset}, off={new_off}, total={total}"
        )

    spawn_err = str(state.get("spawn_error") or "")
    launch_err = str(state.get("launch_err") or "")
    log_id = str(state.get("log_id") or "")
    head_hash = str(state.get("head_hash") or "")
    admission = state.get("admission") if isinstance(state.get("admission"), dict) else None
    is_truncated = truncated or (total < prev_offset)
    return new_off, total, rc, runner_dead, is_truncated, raw_bytes, spawn_err, launch_err, log_id, head_hash, admission


def classify_gpu_admission_error(text: str) -> str | None:
    for line in (text or "").splitlines():
        m = _GPU_ADMISSION_LINE_RE.search(line)
        if m:
            return line.strip()[:200]
    return None


def preflight_gpu_vram(
    colab: str,
    session_name: str,
    min_vram_gib: float,
    exec_timeout: float,
    deadline: float,
) -> dict[str, Any]:
    res = run_cmd(
        [colab, "--auth=oauth2", "exec", "-s", session_name, "--timeout", "30"],
        check=False,
        capture=True,
        stdin_text=_build_gpu_probe_snippet(),
        timeout=exec_timeout,
        deadline=deadline,
    )
    if res.returncode != 0:
        raise RuntimeError(
            f"GPU preflight probe failed on {session_name} (rc={res.returncode}): "
            f"{(res.stderr or res.stdout or '').strip()}"
        )
    probe_line = next(
        (ln for ln in (res.stdout or "").splitlines() if ln.startswith("GPU_PROBE:")),
        None,
    )
    if not probe_line:
        raise RuntimeError(f"GPU preflight probe produced no GPU_PROBE line on {session_name}")
    info = json.loads(probe_line[len("GPU_PROBE:") :])
    if not isinstance(info, dict):
        raise RuntimeError("GPU_PROBE payload is not a JSON object")
    has_gpu_val = info.get("has_gpu")
    vram_raw = info.get("vram_gib")
    if (
        not isinstance(has_gpu_val, bool)
        or isinstance(vram_raw, bool)
        or not isinstance(vram_raw, (int, float))
        or not math.isfinite(float(vram_raw))
        or float(vram_raw) < 0.0
    ):
        raise RuntimeError(f"Malformed GPU_PROBE payload on {session_name}: {info!r}")
    safe_print(
        f"[driver] GPU preflight on {session_name}: has_gpu={has_gpu_val} "
        f"name={info.get('name')!r} vram={vram_raw} GiB ({info.get('source')})"
    )
    if min_vram_gib > 0:
        if not has_gpu_val:
            raise GpuIncompatibleError(
                f"No CUDA GPU detected on {session_name} (required >= {min_vram_gib:.1f} GiB)"
            )
        vram = float(vram_raw)
        if vram < min_vram_gib:
            raise GpuIncompatibleError(
                f"Allocated GPU {info.get('name')!r} has {vram:.2f} GiB VRAM (< {min_vram_gib:.1f} GiB minimum)"
            )
    return info


def run_detached_worker(
    colab: str,
    session_name: str,
    run_id: str,
    idx: int,
    local_script: str,
    *,
    exec_timeout: float,
    transfer_timeout: float,
    job_deadline: float,
    drain_timeout: float,
    poll_interval: float = 12.0,
    shutdown_check: Any = None,
    active_worker_hook: Any = None,
) -> None:
    def _check_abort() -> None:
        if shutdown_check is not None:
            shutdown_check()
        if time.monotonic() >= job_deadline:
            raise TimeoutError(f"Overall job deadline exceeded before/during worker #{idx} ({local_script})")

    _check_abort()
    remote_py = f"/content/_worker_{run_id}_{idx}.py"
    remote_runner = f"/content/_runner_{run_id}_{idx}.py"
    remote_log = f"/content/_worker_{run_id}_{idx}.log"
    remote_rc = f"/content/_worker_{run_id}_{idx}.rc"
    remote_pid = f"/content/_worker_{run_id}_{idx}.pid"
    remote_launch_err = f"/content/_worker_{run_id}_{idx}.launch.err"
    remote_admission = f"/content/_worker_{run_id}_{idx}.admission.json"
    launch_nonce = uuid.uuid4().hex

    run_cmd(
        [colab, "--auth=oauth2", "upload", "-s", session_name, local_script, remote_py],
        timeout=transfer_timeout,
        deadline=job_deadline,
    )

    _check_abort()
    worker_confirmed_exited = False
    if active_worker_hook is not None:
        active_worker_hook(
            {
                "pid": None,
                "pgid": None,
                "start": None,
                "nonce": launch_nonce,
                "remote_pid": remote_pid,
            }
        )

    try:
        launch_snippet = _build_launch_snippet(
            remote_py=remote_py,
            remote_runner=remote_runner,
            remote_log=remote_log,
            remote_rc=remote_rc,
            remote_pid=remote_pid,
            remote_launch_err=remote_launch_err,
            launch_nonce=launch_nonce,
            remote_admission=remote_admission,
        )
        cli_launch_timeout = int(max(5.0, _remaining_timeout(exec_timeout, job_deadline)))
        launch_res = run_cmd(
            [colab, "--auth=oauth2", "exec", "-s", session_name, "--timeout", str(cli_launch_timeout)],
            check=False,
            capture=True,
            stdin_text=launch_snippet,
            timeout=exec_timeout,
            deadline=job_deadline,
        )

        out_lines = (launch_res.stdout or "").splitlines()
        failed_line = next((ln for ln in out_lines if ln.startswith("LAUNCH_FAILED:")), None)
        if failed_line:
            worker_confirmed_exited = True
            raise RuntimeError(
                f"Remote runner spawn failed for worker #{idx} ({local_script}): {failed_line[len('LAUNCH_FAILED:'):]}"
            )

        has_ok = any(ln.strip() == "LAUNCHED_OK" for ln in out_lines)
        meta_line = next((ln for ln in out_lines if ln.startswith("LAUNCHED_META:")), None)
        if launch_res.returncode != 0 or not has_ok or not meta_line:
            raise RuntimeError(
                f"Worker #{idx} ({local_script}) launch failed on {session_name} "
                f"(rc={launch_res.returncode}, has_ok={has_ok}, has_meta={bool(meta_line)}): "
                f"{(launch_res.stderr or launch_res.stdout or '').strip()}"
            )

        try:
            launch_meta = json.loads(meta_line[len("LAUNCHED_META:") :])
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Malformed LAUNCHED_META JSON on {session_name}: {meta_line}") from exc

        if not isinstance(launch_meta, dict) or launch_meta.get("nonce") != launch_nonce:
            raise RuntimeError(f"LAUNCHED_META nonce mismatch on {session_name}: {launch_meta!r}")
        expected_pid = launch_meta.get("pid")
        if not _is_exact_int(expected_pid) or expected_pid <= 0:
            raise RuntimeError(f"Invalid LAUNCHED_META pid on {session_name}: {launch_meta!r}")
        expected_pgid = launch_meta.get("pgid") if _is_exact_int(launch_meta.get("pgid")) else expected_pid
        expected_start = str(launch_meta.get("start") or "").strip() or None
        fast_exit = bool(launch_meta.get("fast_exit"))
        if not expected_start and not fast_exit:
            raise RuntimeError(f"Missing LAUNCHED_META start timestamp on {session_name}: {launch_meta!r}")

        if active_worker_hook is not None:
            active_worker_hook(
                {
                    "pid": expected_pid,
                    "pgid": expected_pgid,
                    "start": expected_start,
                    "nonce": launch_nonce,
                    "remote_pid": remote_pid,
                }
            )

        safe_print(f"[driver] Detached worker #{idx} ({local_script}) running on {session_name}; polling logs...")

        offset = 0
        max_seen_total = 0
        consecutive_poll_errors = 0
        last_rc: int | None = None
        dead_observed = False
        frozen_total: int | None = None
        drain_deadline: float | None = None
        prev_log_id: str | None = None
        prev_head_hash: str | None = None
        last_admission: dict[str, Any] | None = None
        line_buf = ""
        line_long_discarded = False
        tail_lines: list[str] = []
        utf8_decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")

        def _push_tail_line(ln: str) -> None:
            if ln.strip():
                tail_lines.append(ln[:512])
                if len(tail_lines) > 24:
                    del tail_lines[:-24]

        def _scan_lines_for_admission(chunk_text: str, final: bool = False) -> None:
            nonlocal line_buf, line_long_discarded
            pos = 0
            n = len(chunk_text)
            while pos < n:
                nl_idx = chunk_text.find("\n", pos)
                if nl_idx == -1:
                    seg = chunk_text[pos:]
                    if not line_long_discarded:
                        if len(line_buf) + len(seg) <= 512:
                            line_buf += seg
                        else:
                            cand = line_buf + seg[: max(0, 512 - len(line_buf))]
                            line_buf = ""
                            line_long_discarded = True
                            _push_tail_line(cand)
                    pos = n
                else:
                    seg = chunk_text[pos:nl_idx]
                    if not line_long_discarded:
                        _push_tail_line(line_buf + seg)
                    line_buf = ""
                    line_long_discarded = False
                    pos = nl_idx + 1
            if final and line_buf and not line_long_discarded:
                _push_tail_line(line_buf)
                line_buf = ""

        def _write_worker_stream(s: str, *, final: bool = False) -> None:
            _scan_lines_for_admission(s, final=final)
            if not s:
                return
            try:
                sys.stdout.write(s)
                sys.stdout.flush()
            except UnicodeEncodeError:
                enc = getattr(sys.stdout, "encoding", None) or "ascii"
                safe_s = s.encode(enc, errors="replace").decode(enc, errors="replace")
                try:
                    sys.stdout.write(safe_s)
                    sys.stdout.flush()
                except (BrokenPipeError, OSError):
                    _silence_broken_stdout()
            except (BrokenPipeError, OSError):
                _silence_broken_stdout()

        def _sleep_or_abort(sec: float, deadline: float | None = None) -> None:
            end_t = time.monotonic() + max(0.0, sec)
            if deadline is not None:
                end_t = min(end_t, deadline)
            while True:
                _check_abort()
                rem = end_t - time.monotonic()
                if rem <= 0:
                    return
                time.sleep(min(0.25, rem))
        first_poll = True
        while True:
            _check_abort()
            draining = (last_rc is not None) or dead_observed
            cur_deadline = min(job_deadline, drain_deadline) if (draining and drain_deadline is not None) else job_deadline
            if not draining:
                if first_poll:
                    first_poll = False
                    if time.monotonic() >= job_deadline:
                        raise TimeoutError(f"Overall job deadline exceeded before/during worker #{idx} ({local_script})")
                else:
                    rem_job = job_deadline - time.monotonic()
                    if rem_job <= 0:
                        raise TimeoutError(f"Overall job deadline exceeded during worker #{idx} ({local_script})")
                    if rem_job > 1.5:
                        _sleep_or_abort(min(poll_interval, max(0.05, rem_job - 1.5)), cur_deadline)
                    else:
                        _sleep_or_abort(min(0.25, rem_job * 0.5), cur_deadline)
            else:
                if time.monotonic() >= cur_deadline:
                    _write_worker_stream(utf8_decoder.decode(b"", final=True), final=True)
                    raise RuntimeError(
                        f"Log drain/job deadline exceeded for worker #{idx} ({local_script}) at offset {offset}"
                    )

            poll_snippet = _build_poll_snippet(
                remote_log=remote_log,
                remote_rc=remote_rc,
                remote_pid=remote_pid,
                remote_launch_err=remote_launch_err,
                offset=offset,
                expected_nonce=launch_nonce,
                expected_pid=expected_pid,
                expected_start=expected_start,
                remote_admission=remote_admission,
                expected_runner=remote_runner,
            )
            cli_poll_timeout = int(max(5.0, _remaining_timeout(exec_timeout, cur_deadline)))
            try:
                res = run_cmd(
                    [colab, "--auth=oauth2", "exec", "-s", session_name, "--timeout", str(cli_poll_timeout)],
                    check=False,
                    capture=True,
                    stdin_text=poll_snippet,
                    timeout=exec_timeout,
                    deadline=cur_deadline,
                )
            except (subprocess.TimeoutExpired, OSError) as exc:
                consecutive_poll_errors += 1
                safe_print(f"[driver] Poll command error ({consecutive_poll_errors}/5): {exc}")
                if consecutive_poll_errors >= 5:
                    raise RuntimeError(f"Lost polling access to {session_name}: {exc}") from exc
                if draining:
                    _sleep_or_abort(2.0, cur_deadline)
                continue

            if res.returncode != 0:
                consecutive_poll_errors += 1
                safe_print(f"[driver] Transient poll error ({consecutive_poll_errors}/5), retrying...")
                if consecutive_poll_errors >= 5:
                    raise RuntimeError(f"Lost polling access to {session_name}: {res.stderr or res.stdout}")
                if draining:
                    _sleep_or_abort(2.0, cur_deadline)
                continue

            marker_line = next(
                (ln for ln in (res.stdout or "").splitlines() if ln.startswith("POLL_JSON:")),
                None,
            )
            if not marker_line:
                consecutive_poll_errors += 1
                safe_print(f"[driver] Missing POLL_JSON marker ({consecutive_poll_errors}/5), retrying...")
                if consecutive_poll_errors >= 5:
                    raise RuntimeError(
                        f"Repeated empty/malformed poll output on {session_name}: {res.stderr or res.stdout}"
                    )
                if draining:
                    _sleep_or_abort(2.0, cur_deadline)
                continue

            try:
                raw_state = json.loads(marker_line[len("POLL_JSON:") :])
                (
                    new_off,
                    total,
                    polled_rc,
                    runner_dead,
                    truncated,
                    raw_bytes,
                    spawn_err,
                    launch_err,
                    log_id,
                    head_hash,
                    admission,
                ) = parse_and_validate_poll_state(raw_state, offset)
            except (json.JSONDecodeError, RecursionError, MemoryError, TypeError, ValueError) as exc:
                consecutive_poll_errors += 1
                safe_print(f"[driver] Invalid POLL_JSON ({consecutive_poll_errors}/5): {exc}")
                if consecutive_poll_errors >= 5:
                    raise RuntimeError(
                        f"Repeated invalid POLL_JSON on {session_name}: {marker_line}"
                    ) from exc
                if draining:
                    _sleep_or_abort(2.0, cur_deadline)
                continue

            if truncated or total < max_seen_total:
                _write_worker_stream(utf8_decoder.decode(b"", final=True), final=True)
                raise RuntimeError(
                    f"Remote log {remote_log} on {session_name} shrank/replaced (total={total}, max_seen={max_seen_total}, offset={offset})"
                )
            max_seen_total = max(max_seen_total, total)
            if prev_log_id is None:
                if log_id:
                    prev_log_id = log_id
            elif log_id and log_id != prev_log_id:
                _write_worker_stream(utf8_decoder.decode(b"", final=True), final=True)
                raise RuntimeError(
                    f"Remote log {remote_log} on {session_name} changed inode ({prev_log_id} -> {log_id})"
                )
            if prev_head_hash is None:
                if head_hash:
                    prev_head_hash = head_hash
            elif head_hash and head_hash != prev_head_hash:
                _write_worker_stream(utf8_decoder.decode(b"", final=True), final=True)
                raise RuntimeError(
                    f"Remote log {remote_log} on {session_name} header digest changed (file rewritten in place)"
                )

            if raw_bytes:
                _write_worker_stream(utf8_decoder.decode(raw_bytes, final=False))

            if isinstance(admission, dict) and admission.get("nonce") == launch_nonce:
                last_admission = admission
            else:
                last_admission = None

            prev_offset = offset
            offset = new_off

            if runner_dead and polled_rc is None:
                if not dead_observed:
                    dead_observed = True
                    if frozen_total is None:
                        frozen_total = total
                    drain_deadline = min(job_deadline, time.monotonic() + drain_timeout)
                if offset >= (frozen_total or 0):
                    _write_worker_stream(utf8_decoder.decode(b"", final=True), final=True)
                    detail_parts = [
                        f"Remote runner for worker #{idx} ({local_script}) died unexpectedly without writing {remote_rc}"
                    ]
                    if launch_err:
                        detail_parts.append(f"runner stderr: {launch_err}")
                    raise RuntimeError("; ".join(detail_parts))
                if offset <= prev_offset:
                    consecutive_poll_errors += 1
                    safe_print(
                        f"[driver] Dead-runner log drain stalled at {offset}/{frozen_total} ({consecutive_poll_errors}/5)..."
                    )
                    if consecutive_poll_errors >= 5:
                        raise RuntimeError(
                            f"Log drain stalled after runner died for worker #{idx} ({local_script}) at {offset}/{frozen_total}"
                        )
                    _sleep_or_abort(2.0, min(job_deadline, drain_deadline) if drain_deadline is not None else cur_deadline)
                    continue
                consecutive_poll_errors = 0
                continue

            if polled_rc is not None:
                if last_rc is None:
                    last_rc = polled_rc
                    if frozen_total is None:
                        frozen_total = total
                    drain_deadline = min(job_deadline, time.monotonic() + drain_timeout)
                elif polled_rc != last_rc:
                    _write_worker_stream(utf8_decoder.decode(b"", final=True), final=True)
                    raise RuntimeError(
                        f"Contradictory terminal exit code on {session_name} for worker #{idx}: saw rc={last_rc}, then rc={polled_rc}"
                    )
                target_total = frozen_total if frozen_total is not None else total
                if offset >= target_total:
                    _write_worker_stream(utf8_decoder.decode(b"", final=True), final=True)
                    if last_rc != 0:
                        if last_admission is not None and (
                            last_admission.get("incompatible") is True
                            or str(last_admission.get("status") or "").lower() in ("incompatible", "rejected")
                        ):
                            reason = str(last_admission.get("reason") or last_admission)
                            raise GpuIncompatibleError(
                                f"Worker #{idx} ({local_script}) failed structured GPU/VRAM admission ({reason}, rc={last_rc})"
                            )
                        terminal_admission: str | None = None
                        for tline in reversed(tail_lines):
                            sline = tline.strip()
                            if not sline:
                                continue
                            adm = classify_gpu_admission_error(sline)
                            if adm:
                                terminal_admission = adm
                            break
                        if terminal_admission:
                            raise GpuIncompatibleError(
                                f"Worker #{idx} ({local_script}) failed GPU/VRAM admission ({terminal_admission}, rc={last_rc})"
                            )
                        msg = f"Worker {local_script} exited with non-zero code {last_rc}"
                        if spawn_err:
                            msg += f" ({spawn_err})"
                        raise RuntimeError(msg)
                    worker_confirmed_exited = True
                    safe_print(f"[driver] Worker #{idx} ({local_script}) completed cleanly (rc=0).")
                    return
                if offset <= prev_offset:
                    consecutive_poll_errors += 1
                    safe_print(
                        f"[driver] Log drain stalled at offset {offset}/{target_total} ({consecutive_poll_errors}/5), retrying..."
                    )
                    if consecutive_poll_errors >= 5:
                        raise RuntimeError(
                            f"Log drain stalled for completed worker #{idx} ({local_script}) at {offset}/{target_total}"
                        )
                    _sleep_or_abort(2.0, min(job_deadline, drain_deadline) if drain_deadline is not None else cur_deadline)
                    continue

            consecutive_poll_errors = 0
    finally:
        if worker_confirmed_exited and active_worker_hook is not None:
            active_worker_hook(None)


def streaming_sha256(path: Path, deadline: float | None = None) -> tuple[int, str]:
    h = hashlib.sha256()
    size = 0
    with path.open("rb") as f:
        while True:
            if deadline is not None and time.monotonic() >= deadline:
                raise TimeoutError(f"Hashing {path} exceeded monotonic deadline")
            blk = f.read(1048576)
            if not blk:
                break
            h.update(blk)
            size += len(blk)
    return size, h.hexdigest()


def download_file_verified(
    colab: str,
    session_name: str,
    remote_p: str,
    local_p: str,
    *,
    exec_timeout: float,
    transfer_timeout: float,
    deadline: float | None,
) -> tuple[int, str]:
    cli_exec_timeout = int(max(5.0, _remaining_timeout(exec_timeout, deadline)))
    meta_res = run_cmd(
        [colab, "--auth=oauth2", "exec", "-s", session_name, "--timeout", str(cli_exec_timeout)],
        check=False,
        capture=True,
        stdin_text=_build_remote_file_meta_snippet(remote_p),
        timeout=exec_timeout,
        deadline=deadline,
    )
    if meta_res.returncode != 0:
        raise RuntimeError(
            f"Failed to query remote metadata for {remote_p} on {session_name}: "
            f"{(meta_res.stderr or meta_res.stdout or '').strip()}"
        )
    meta_line = next(
        (ln for ln in (meta_res.stdout or "").splitlines() if ln.startswith("REMOTE_META:")),
        None,
    )
    if not meta_line:
        raise RuntimeError(f"Missing REMOTE_META output for {remote_p} on {session_name}")
    meta = json.loads(meta_line[len("REMOTE_META:") :])
    if not isinstance(meta, dict) or not meta.get("exists"):
        raise FileNotFoundError(f"Remote artifact does not exist: {remote_p} on {session_name}")
    remote_size = meta.get("size")
    remote_sha = str(meta.get("sha256") or "")
    if not _is_exact_int(remote_size) or remote_size < 0 or len(remote_sha) != 64:
        raise RuntimeError(f"Invalid REMOTE_META for {remote_p}: {meta!r}")

    dest = Path(local_p)
    dest.parent.mkdir(parents=True, exist_ok=True)
    uid8 = uuid.uuid4().hex[:8]
    cand_tmp_name = f".{dest.name}.{uid8}.tmp"
    cand_units = (
        len(cand_tmp_name.encode("utf-16-le")) // 2
        if sys.platform == "win32"
        else max(len(cand_tmp_name), len(cand_tmp_name.encode("utf-8", errors="replace")))
    )
    if cand_units > 240:
        name_hash = hashlib.sha256(dest.name.encode("utf-8")).hexdigest()[:12]
        cand_tmp_name = f".dl-{name_hash}-{uid8}.tmp"
    tmp_dest = dest.parent / cand_tmp_name
    try:
        run_cmd(
            [colab, "--auth=oauth2", "download", "-s", session_name, remote_p, str(tmp_dest)],
            timeout=transfer_timeout,
            deadline=deadline,
        )
        if not tmp_dest.is_file():
            raise FileNotFoundError(f"Download produced no local temp file for {remote_p} -> {tmp_dest}")
        local_size, local_sha = streaming_sha256(tmp_dest, deadline=deadline)
        if local_size != remote_size or local_sha != remote_sha:
            raise RuntimeError(
                f"Download verification failed for {remote_p}: "
                f"expected size={remote_size} sha256={remote_sha}, "
                f"got size={local_size} sha256={local_sha}"
            )
        tmp_dest.replace(dest)
        safe_print(f"[driver] Downloaded {local_p} ({local_size} bytes, sha256={local_sha})")
        return local_size, local_sha
    except Exception:
        tmp_dest.unlink(missing_ok=True)
        raise


def recover_artifacts(
    colab: str,
    session_name: str,
    downloads: list[tuple[str, str]],
    downloaded_ok: set[str],
    *,
    exec_timeout: float,
    transfer_timeout: float,
    teardown_deadline: float,
    reserve_stop_sec: float,
) -> list[str]:
    errors: list[str] = []
    recovery_deadline = teardown_deadline - max(0.0, reserve_stop_sec)
    for remote_p, local_p in downloads:
        if local_p in downloaded_ok:
            continue
        rem = recovery_deadline - time.monotonic()
        if rem <= 1.0:
            msg = f"Skipped recovery of {remote_p}: teardown time reserved for VM stop"
            safe_print(f"[driver] {msg}")
            errors.append(msg)
            break
        try:
            download_file_verified(
                colab,
                session_name,
                remote_p,
                local_p,
                exec_timeout=min(exec_timeout, rem),
                transfer_timeout=min(transfer_timeout, rem),
                deadline=recovery_deadline,
            )
            downloaded_ok.add(local_p)
        except Exception as exc:
            safe_print(f"[driver] Best-effort artifact recovery failed for {remote_p}: {exc}")
            errors.append(f"{remote_p}: {exc}")
    return errors


def _reconcile_after_new_attempt(
    colab: str,
    session_name: str,
    new_rc: int | None,
    *,
    before_list_ok: bool,
    before_raw: str,
    new_timed_out_or_exc: bool = False,
    cmd_timeout: float,
    deadline: float | None,
    observed_out: set[str] | None = None,
    on_observed: Any = None,
    interrupt_guard: Any = None,
    interrupt_poll: Any = None,
) -> tuple[bool, bool, bool, str]:
    """Return (should_treat_allocated, needs_stop_by_name, ambiguous_ownership, detail)."""
    if new_rc == 0:
        return True, True, False, "new_exited_0"
    if not before_list_ok:
        return False, False, True, "pre_new_listing_unavailable_ambiguous_ownership"
    obs_kw: dict[str, Any] = {}
    if getattr(list_remote_sessions, "_supports_on_observed", False) is True or (
        callable(getattr(list_remote_sessions, "side_effect", None))
        and getattr(list_remote_sessions.side_effect, "_supports_on_observed", False) is True
    ):
        obs_kw["on_observed"] = on_observed
    elif on_observed is not None and not hasattr(list_remote_sessions, "_mock_name"):
        obs_kw["on_observed"] = on_observed
    if interrupt_guard is not None and (
        getattr(list_remote_sessions, "_supports_interrupt_guard", False) is True
        or (
            callable(getattr(list_remote_sessions, "side_effect", None))
            and getattr(list_remote_sessions.side_effect, "_supports_interrupt_guard", False) is True
        )
    ):
        obs_kw["interrupt_guard"] = interrupt_guard
    if interrupt_poll is not None and (
        getattr(list_remote_sessions, "_supports_interrupt_poll", False) is True
        or (
            callable(getattr(list_remote_sessions, "side_effect", None))
            and getattr(list_remote_sessions.side_effect, "_supports_interrupt_poll", False) is True
        )
    ):
        obs_kw["interrupt_poll"] = interrupt_poll
    if on_observed is None:
        obs_kw.pop("on_observed", None)
    after_ok, after_names, after_raw = list_remote_sessions(
        colab, timeout=cmd_timeout, deadline=deadline, **obs_kw
    )
    if after_ok:
        guard_ctx = interrupt_guard() if interrupt_guard is not None else contextlib.nullcontext()
        with guard_ctx:
            if on_observed is not None and "on_observed" not in obs_kw:
                on_observed(after_names)
            if observed_out is not None:
                observed_out.update(after_names)
    if not after_ok:
        return False, False, True, f"post_new_listing_unavailable ({after_raw})"
    if session_name in after_names:
        return False, True, False, "session_present_in_remote_listing_after_new_failure"
    b_names, b_fps, b_unnamed = _parse_session_snapshot(before_raw)
    a_names, a_fps, a_unnamed = _parse_session_snapshot(after_raw)
    extra_fps = list((Counter(a_fps) - Counter(b_fps)).elements())
    extra_names = sorted(a_names - b_names)
    if a_unnamed > b_unnamed or extra_fps or extra_names:
        return (
            False,
            False,
            True,
            f"unmatched_new_endpoint_after_new_failure (unnamed {b_unnamed}->{a_unnamed}, delta={extra_fps or extra_names})",
        )
    if new_timed_out_or_exc:
        # Assignment may still materialize on Colab backend after client timeout/interrupt; check once more if time remains
        rem = (deadline - time.monotonic()) if deadline is not None else 5.0
        if rem > 1.2:
            time.sleep(min(0.6, rem * 0.25))
            a2_ok, a2_names, a2_raw = list_remote_sessions(
                colab, timeout=min(cmd_timeout, rem), deadline=deadline, **obs_kw
            )
            if a2_ok:
                guard_ctx = interrupt_guard() if interrupt_guard is not None else contextlib.nullcontext()
                with guard_ctx:
                    if on_observed is not None and "on_observed" not in obs_kw:
                        on_observed(a2_names)
                    if observed_out is not None:
                        observed_out.update(a2_names)
            if a2_ok and session_name in a2_names:
                return False, True, False, "session_materialized_after_new_timeout"
        return False, False, True, "new_timed_out_or_aborted_before_absence_proven"
    return False, False, False, "confirmed_absent_in_remote_listing"


setattr(_reconcile_after_new_attempt, "_supports_interrupt_guard", True)
setattr(_reconcile_after_new_attempt, "_supports_interrupt_poll", True)


def execute_job(
    args: argparse.Namespace,
    session_name_factory: Any = None,
) -> None:
    gpu_specs, parsed_uploads, parsed_downloads = validate_inputs(
        workers=args.worker,
        gpus_arg=args.gpus,
        uploads=args.upload,
        downloads=args.download,
        cmd_timeout=args.cmd_timeout_sec,
        new_timeout=args.new_timeout_sec,
        exec_timeout=args.exec_timeout_sec,
        transfer_timeout=args.transfer_timeout_sec,
        job_timeout=args.job_timeout_sec,
        drain_timeout=args.drain_timeout_sec,
        teardown_timeout=args.teardown_timeout_sec,
        poll_interval=args.poll_interval_sec,
        min_vram_gib=args.min_vram_gib,
    )

    colab = args.colab_bin
    run_id = uuid.uuid4().hex[:12]
    state_dir = Path(args.state_dir) if args.state_dir else None
    registry = SessionRegistry(run_id, state_dir=state_dir)

    created_endpoints: list[str] = []
    suspect_endpoints: dict[str, str] = {}
    ambiguous_sessions: set[str] = set()
    released_endpoints: set[str] = set()
    teardown_errors_by_sess: dict[str, str] = {}
    recovery_warnings: list[str] = []
    rejected_recovery_warnings: list[str] = []
    active_session: str | None = None
    active_worker_info: dict[str, Any] | None = None
    pending_new: tuple[str, str, bool, str] | None = None
    pending_new_res: subprocess.CompletedProcess[str] | None = None
    workers_started = False
    transfer_phase_error = False
    downloaded_ok: set[str] = set()
    primary_exc: BaseException | None = None

    in_teardown = False
    signal_defer_depth = 0
    pending_signal_name: str | None = None
    prev_handlers: dict[int, Any] = {}

    def _safe_mark(session_name: str, status: str, gpu_spec: str = "", note: str = "") -> None:
        try:
            registry.mark(session_name, status, gpu_spec=gpu_spec, note=note)
        except OSError as reg_exc:
            safe_print(f"[driver] Warning: local session registry write failed ({session_name}): {reg_exc}")

    def _check_shutdown() -> None:
        if pending_signal_name is not None:
            raise JobInterruptedError(f"Aborted by signal {pending_signal_name}")

    def _check_poll_interrupt() -> None:
        if not in_teardown:
            _check_shutdown()

    @contextlib.contextmanager
    def _defer_interrupts() -> Any:
        nonlocal signal_defer_depth
        signal_defer_depth += 1
        exited_clean = False
        try:
            yield
            exited_clean = True
        finally:
            signal_defer_depth -= 1
        if exited_clean and not in_teardown:
            _check_shutdown()

    observed_remote_sessions: set[str] = set()

    def _reconcile_observed_suspects(observed_names: set[str]) -> None:
        with _defer_interrupts():
            for s_name in list(suspect_endpoints):
                if s_name in observed_names and s_name not in released_endpoints:
                    gpu_sp = suspect_endpoints[s_name]
                    if s_name not in created_endpoints:
                        created_endpoints.append(s_name)
                    suspect_endpoints.pop(s_name, None)
                    _safe_mark(s_name, "leaked_after_new_error", gpu_spec=gpu_sp, note="appeared_in_later_listing")
                    safe_print(
                        f"[driver] Detected delayed Colab VM allocation {s_name} (GPU={gpu_sp}) in later session listing; scheduling stop."
                    )

    def _record_observed_names(names: set[str]) -> None:
        with _defer_interrupts():
            if names:
                observed_remote_sessions.update(names)
                _reconcile_observed_suspects(names)

    def _supports_flag(fn: Any, flag_attr: str) -> bool:
        if getattr(fn, flag_attr, False) is True:
            return True
        se = getattr(fn, "side_effect", None)
        wr = getattr(fn, "_mock_wraps", None)
        return (callable(se) and getattr(se, flag_attr, False) is True) or (
            callable(wr) and getattr(wr, flag_attr, False) is True
        )

    def _obs_list_kwargs() -> dict[str, Any]:
        kw: dict[str, Any] = {}
        if _supports_flag(list_remote_sessions, "_supports_on_observed"):
            kw["on_observed"] = _record_observed_names
        if _supports_flag(list_remote_sessions, "_supports_interrupt_guard"):
            kw["interrupt_guard"] = _defer_interrupts
        if _supports_flag(list_remote_sessions, "_supports_interrupt_poll"):
            kw["interrupt_poll"] = _check_poll_interrupt
        return kw

    def _reconcile_ig_kwargs() -> dict[str, Any]:
        kw: dict[str, Any] = {}
        if _supports_flag(_reconcile_after_new_attempt, "_supports_interrupt_guard"):
            kw["interrupt_guard"] = _defer_interrupts
        if _supports_flag(_reconcile_after_new_attempt, "_supports_interrupt_poll"):
            kw["interrupt_poll"] = _check_poll_interrupt
        return kw

    def _set_active_worker(info: dict[str, Any] | None) -> None:
        nonlocal active_worker_info
        active_worker_info = info

    def _on_signal(signum: int, _frame: Any) -> None:
        nonlocal pending_signal_name
        try:
            sig_name = signal.Signals(signum).name
        except ValueError:
            sig_name = f"SIG{signum}"
        if in_teardown or pending_signal_name is not None:
            return
        pending_signal_name = sig_name
        if signal_defer_depth > 0:
            return
        raise JobInterruptedError(f"Interrupted by signal {sig_name}")

    for sig in (signal.SIGINT, getattr(signal, "SIGTERM", None), getattr(signal, "SIGBREAK", None)):
        if sig is None:
            continue
        try:
            prev_handlers[sig] = signal.getsignal(sig)
            signal.signal(sig, _on_signal)
        except (ValueError, OSError):
            pass

    job_deadline = time.monotonic() + args.job_timeout_sec

    def _stop_pending_leaked_endpoints() -> None:
        for leaked_sess in list(created_endpoints):
            if leaked_sess == active_session or leaked_sess in released_endpoints:
                continue
            _check_shutdown()
            rem_job = job_deadline - time.monotonic()
            if rem_job <= 0.5:
                raise TimeoutError(
                    f"Overall job deadline exceeded before stopping leaked VM {leaked_sess}"
                )
            safe_print(f"[driver] Stopping leaked Colab VM {leaked_sess} before next GPU allocation...")
            stop_dl = min(job_deadline, time.monotonic() + args.teardown_timeout_sec)
            stop_ok, stop_err = stop_remote_session(
                colab,
                leaked_sess,
                timeout=min(args.cmd_timeout_sec, 45.0),
                teardown_deadline=stop_dl,
            )
            if stop_ok:
                released_endpoints.add(leaked_sess)
                teardown_errors_by_sess.pop(leaked_sess, None)
                _safe_mark(leaked_sess, "stopped", note="stopped_before_next_tier")
            else:
                teardown_errors_by_sess[leaked_sess] = stop_err
                _safe_mark(leaked_sess, "stop_failed", note=stop_err)
                raise RuntimeError(
                    f"Leaked VM {leaked_sess} detected before next GPU tier and stop failed: {stop_err}"
                )

    def _kill_active_remote_worker(sess_name: str, w_info: dict[str, Any], deadline: float) -> None:
        rem_kill = min(15.0, max(0.0, deadline - time.monotonic()))
        if rem_kill <= 1.0:
            return
        try:
            kres = run_cmd(
                [colab, "--auth=oauth2", "exec", "-s", sess_name, "--timeout", str(int(max(5.0, rem_kill)))],
                check=False,
                capture=True,
                stdin_text=_build_kill_runner_snippet(
                    expected_pid=w_info.get("pid"),
                    expected_pgid=w_info.get("pgid"),
                    expected_start=w_info.get("start"),
                    expected_nonce=str(w_info.get("nonce") or ""),
                    remote_pid=str(w_info.get("remote_pid") or ""),
                ),
                timeout=rem_kill,
                deadline=deadline,
            )
            kout = (kres.stdout or "").strip()
            if kres.returncode != 0 or "KILL_ERR:" in kout or "KILL_SKIPPED:" in kout:
                safe_print(
                    f"[driver] Warning: remote worker kill reported rc={kres.returncode} on {sess_name}: {kout or kres.stderr}"
                )
        except Exception as kill_exc:
            safe_print(f"[driver] Best-effort remote worker kill failed: {kill_exc}")

    try:
        try:
            last_tier_err = ""
            for spec in gpu_specs:
                _check_shutdown()
                if time.monotonic() >= job_deadline:
                    raise TimeoutError("Overall job deadline exceeded during GPU allocation")

                session_name = (
                    session_name_factory(spec)
                    if session_name_factory is not None
                    else f"inferlab-{uuid.uuid4().hex}"
                )
                before_ok, before_names, before_raw = list_remote_sessions(
                    colab, timeout=args.cmd_timeout_sec, deadline=job_deadline, **_obs_list_kwargs()
                )
                if before_ok:
                    _record_observed_names(before_names)
                if not before_ok:
                    safe_print(f"[driver] Pre-new session listing unavailable ({before_raw}); refusing unverified allocation")
                    raise RuntimeError(
                        f"Ambiguous pre-allocation state before 'new' (GPU={spec.raw}): "
                        f"pre-new session listing unavailable ({before_raw})"
                    )
                _stop_pending_leaked_endpoints()
                if session_name in before_names:
                    raise RuntimeError(
                        f"Session collision detected: {session_name!r} already exists remotely before 'new'"
                    )

                registry.mark(session_name, "creating", gpu_spec=spec.raw)
                if spec.high_mem and args.min_vram_gib > 0:
                    safe_print(f"[driver] Note: {spec.raw} increases host RAM (--high-mem), not GPU VRAM.")

                cmd = [colab, "--auth=oauth2", "new", "-s", session_name, "--gpu", spec.gpu]
                if spec.high_mem:
                    cmd.append("--high-mem")
                env = {
                    **os.environ,
                    "COLAB_CLI_ASSIGN_RETRIES": "4",
                    "COLAB_CLI_RETRY_BACKOFF": "7",
                }

                pending_new = (session_name, spec.raw, before_ok, before_raw)
                pending_new_res = None
                new_rc: int | None = None
                new_exc: BaseException | None = None
                try:
                    with _defer_interrupts():
                        rc_new_kw: dict[str, Any] = {}
                        if getattr(run_cmd, "_supports_interrupt_poll", False) is True:
                            rc_new_kw["interrupt_poll"] = _check_poll_interrupt
                        pending_new_res = run_cmd(
                            cmd,
                            check=False,
                            env=env,
                            timeout=args.new_timeout_sec,
                            deadline=job_deadline,
                            **rc_new_kw,
                        )
                        new_rc = pending_new_res.returncode
                        if new_rc == 0 and session_name not in created_endpoints:
                            created_endpoints.append(session_name)
                except JobInterruptedError:
                    raise
                except BaseException as exc:
                    new_exc = exc

                rec_deadline = time.monotonic() + min(args.cmd_timeout_sec, args.teardown_timeout_sec)
                rec_observed: set[str] = set()
                allocated_ok, needs_stop, ambiguous, detail = _reconcile_after_new_attempt(
                    colab,
                    session_name,
                    new_rc,
                    before_list_ok=before_ok,
                    before_raw=before_raw,
                    new_timed_out_or_exc=(new_exc is not None),
                    cmd_timeout=args.cmd_timeout_sec,
                    deadline=rec_deadline,
                    observed_out=rec_observed,
                    on_observed=_record_observed_names,
                    **_reconcile_ig_kwargs(),
                )
                with _defer_interrupts():
                    if rec_observed:
                        _record_observed_names(rec_observed)
                    if needs_stop and session_name not in created_endpoints:
                        created_endpoints.append(session_name)
                    if ambiguous and before_ok and not needs_stop and session_name not in created_endpoints and session_name not in released_endpoints:
                        suspect_endpoints[session_name] = spec.raw
                    if not ambiguous and not allocated_ok and not needs_stop and before_ok:
                        suspect_endpoints[session_name] = spec.raw
                    pending_new = None
                    pending_new_res = None

                if ambiguous:
                    ambiguous_sessions.add(session_name)
                    _safe_mark(session_name, "ambiguous_ownership", gpu_spec=spec.raw, note=detail)
                    err_msg = (
                        f"Ambiguous Colab VM ownership after failed 'new' for {session_name} (GPU={spec.raw}): {detail}"
                    )
                    if new_exc is not None:
                        raise RuntimeError(f"{err_msg} (cause={new_exc})") from new_exc
                    raise RuntimeError(err_msg)

                if new_exc is not None:
                    _safe_mark(
                        session_name,
                        "maybe_created" if needs_stop else "absent_after_new_error",
                        gpu_spec=spec.raw,
                        note=detail,
                    )
                    if needs_stop:
                        stop_ok, stop_err = stop_remote_session(
                            colab,
                            session_name,
                            timeout=min(args.cmd_timeout_sec, 45.0),
                            teardown_deadline=time.monotonic() + args.teardown_timeout_sec,
                        )
                        if stop_ok:
                            released_endpoints.add(session_name)
                            teardown_errors_by_sess.pop(session_name, None)
                            _safe_mark(session_name, "stopped", note=detail)
                        else:
                            teardown_errors_by_sess[session_name] = stop_err
                            _safe_mark(session_name, "stop_failed", note=stop_err)
                            raise RuntimeError(
                                f"new failed ({new_exc}) and stop failed for {session_name}: {stop_err}"
                            ) from new_exc
                    if isinstance(new_exc, subprocess.TimeoutExpired) and time.monotonic() < job_deadline:
                        last_tier_err = f"GPU={spec.raw} timed out during 'new': {new_exc}"
                        safe_print(f"[driver] {last_tier_err}; trying next fallback GPU tier...")
                        continue
                    raise new_exc

                if not allocated_ok:
                    last_tier_err = f"GPU={spec.raw} unavailable (rc={new_rc}, {detail})"
                    safe_print(f"[driver] {last_tier_err}")
                    if needs_stop:
                        _safe_mark(session_name, "leaked_after_new_error", gpu_spec=spec.raw, note=detail)
                        stop_ok, stop_err = stop_remote_session(
                            colab,
                            session_name,
                            timeout=min(args.cmd_timeout_sec, 45.0),
                            teardown_deadline=time.monotonic() + args.teardown_timeout_sec,
                        )
                        if stop_ok:
                            released_endpoints.add(session_name)
                            teardown_errors_by_sess.pop(session_name, None)
                            _safe_mark(session_name, "stopped", note=detail)
                        else:
                            teardown_errors_by_sess[session_name] = stop_err
                            _safe_mark(session_name, "stop_failed", note=stop_err)
                            raise RuntimeError(
                                f"Leaked VM {session_name} after failed 'new' (GPU={spec.raw}) and stop failed: {stop_err}"
                            )
                    else:
                        with _defer_interrupts():
                            if before_ok:
                                suspect_endpoints[session_name] = spec.raw
                            _safe_mark(session_name, "maybe_created", gpu_spec=spec.raw, note=detail)
                    safe_print(f"[driver] Trying next fallback GPU tier...")
                    continue

                with _defer_interrupts():
                    _safe_mark(session_name, "active", gpu_spec=spec.raw)
                    safe_print(f"[driver] Allocated session {session_name} on GPU={spec.raw}")
                    active_session = session_name
                    completed_workers = 0

                try:
                    if args.min_vram_gib > 0:
                        preflight_gpu_vram(
                            colab,
                            session_name,
                            min_vram_gib=args.min_vram_gib,
                            exec_timeout=args.exec_timeout_sec,
                            deadline=job_deadline,
                        )

                    for local_p, remote_p in parsed_uploads:
                        _check_shutdown()
                        run_cmd(
                            [colab, "--auth=oauth2", "upload", "-s", session_name, local_p, remote_p],
                            timeout=args.transfer_timeout_sec,
                            deadline=job_deadline,
                        )

                    workers_started = True
                    for idx, worker_script in enumerate(args.worker):
                        _check_shutdown()
                        run_detached_worker(
                            colab,
                            session_name,
                            run_id,
                            idx,
                            worker_script,
                            exec_timeout=args.exec_timeout_sec,
                            transfer_timeout=args.transfer_timeout_sec,
                            job_deadline=job_deadline,
                            drain_timeout=args.drain_timeout_sec,
                            poll_interval=args.poll_interval_sec,
                            shutdown_check=_check_shutdown,
                            active_worker_hook=_set_active_worker,
                        )
                        completed_workers += 1
                    break
                except GpuIncompatibleError as exc:
                    last_tier_err = str(exc)
                    safe_print(f"[driver] GPU={spec.raw} rejected by preflight/worker admission: {exc}")
                    tier_td_deadline = time.monotonic() + args.teardown_timeout_sec
                    if active_worker_info is not None:
                        _kill_active_remote_worker(
                            session_name,
                            active_worker_info,
                            min(tier_td_deadline, time.monotonic() + max(1.0, args.teardown_timeout_sec * 0.2)),
                        )
                        active_worker_info = None
                    if workers_started and parsed_downloads:
                        safe_print("[driver] Recovering declared artifacts before fallback VM release...")
                        tier_recovered: set[str] = set()
                        rec_errs = recover_artifacts(
                            colab,
                            session_name,
                            parsed_downloads,
                            tier_recovered,
                            exec_timeout=args.exec_timeout_sec,
                            transfer_timeout=args.transfer_timeout_sec,
                            teardown_deadline=tier_td_deadline,
                            reserve_stop_sec=max(min(args.teardown_timeout_sec * 0.5, 30.0), min(1.0, args.teardown_timeout_sec * 0.4)),
                        )
                        rejected_recovery_warnings.extend(rec_errs)
                    workers_started = False
                    stop_ok, stop_err = stop_remote_session(
                        colab,
                        session_name,
                        timeout=min(args.cmd_timeout_sec, 45.0),
                        teardown_deadline=tier_td_deadline,
                    )
                    active_session = None
                    if stop_ok:
                        released_endpoints.add(session_name)
                        teardown_errors_by_sess.pop(session_name, None)
                        _safe_mark(session_name, "stopped", note=f"gpu_incompatible: {exc}")
                        if completed_workers > 0 and not getattr(args, "allow_rerun_completed_workers", False):
                            raise RuntimeError(
                                f"GPU={spec.raw} failed GPU/VRAM admission after {completed_workers} worker(s) already completed; "
                                f"refusing duplicate re-execution on fallback VM ({exc})"
                            ) from exc
                        continue
                    teardown_errors_by_sess[session_name] = stop_err
                    _safe_mark(session_name, "stop_failed", note=stop_err)
                    raise RuntimeError(
                        f"GPU={spec.raw} failed admission ({exc}) and stop failed for {session_name}: {stop_err}"
                    ) from exc

            if active_session is None:
                raise RuntimeError(
                    f"Could not allocate a compatible GPU from {args.gpus}"
                    + (f" ({last_tier_err})" if last_tier_err else "")
                )

            for remote_p, local_p in parsed_downloads:
                _check_shutdown()
                try:
                    download_file_verified(
                        colab,
                        active_session,
                        remote_p,
                        local_p,
                        exec_timeout=args.exec_timeout_sec,
                        transfer_timeout=args.transfer_timeout_sec,
                        deadline=job_deadline,
                    )
                    downloaded_ok.add(local_p)
                except JobInterruptedError:
                    raise
                except Exception:
                    transfer_phase_error = True
                    raise
            in_teardown = True

        except BaseException as exc:
            in_teardown = True
            primary_exc = exc
        finally:
            in_teardown = True
            teardown_deadline = time.monotonic() + args.teardown_timeout_sec

            if pending_new is not None:
                p_sess, p_gpu, p_before_ok, p_before_raw = pending_new
                p_res = pending_new_res
                pending_new = None
                pending_new_res = None
                if p_res is not None and p_res.returncode == 0 and p_sess not in created_endpoints:
                    created_endpoints.append(p_sess)
                try:
                    rec_dl = min(teardown_deadline, time.monotonic() + min(args.cmd_timeout_sec, max(1.0, args.teardown_timeout_sec * 0.3)))
                    p_rec_obs: set[str] = set()
                    _, p_needs_stop, p_ambig, p_detail = _reconcile_after_new_attempt(
                        colab,
                        p_sess,
                        p_res.returncode if p_res is not None else None,
                        before_list_ok=p_before_ok,
                        before_raw=p_before_raw,
                        new_timed_out_or_exc=(p_res is None),
                        cmd_timeout=min(args.cmd_timeout_sec, 30.0),
                        deadline=rec_dl,
                        observed_out=p_rec_obs,
                        on_observed=_record_observed_names,
                        **_reconcile_ig_kwargs(),
                    )
                    if p_rec_obs:
                        _record_observed_names(p_rec_obs)
                    if p_needs_stop and p_sess not in created_endpoints:
                        created_endpoints.append(p_sess)
                    if p_ambig:
                        ambiguous_sessions.add(p_sess)
                        if p_before_ok and not p_needs_stop and p_sess not in created_endpoints and p_sess not in released_endpoints:
                            suspect_endpoints[p_sess] = p_gpu
                        _safe_mark(p_sess, "ambiguous_ownership", gpu_spec=p_gpu, note=p_detail)
                        teardown_errors_by_sess[p_sess] = p_detail
                    elif p_before_ok and not p_needs_stop:
                        suspect_endpoints[p_sess] = p_gpu
                        _safe_mark(p_sess, "maybe_created", gpu_spec=p_gpu, note=p_detail)
                except Exception as rec_exc:
                    ambiguous_sessions.add(p_sess)
                    if p_before_ok and p_sess not in created_endpoints and p_sess not in released_endpoints:
                        suspect_endpoints[p_sess] = p_gpu
                    _safe_mark(p_sess, "ambiguous_ownership", gpu_spec=p_gpu, note=str(rec_exc))
                    teardown_errors_by_sess[p_sess] = f"reconcile failed after interrupt ({rec_exc})"

            if active_session and active_session not in released_endpoints:
                if active_worker_info is not None:
                    _kill_active_remote_worker(
                        active_session,
                        active_worker_info,
                        min(teardown_deadline, time.monotonic() + max(1.0, args.teardown_timeout_sec * 0.2)),
                    )

                if workers_started and parsed_downloads and len(downloaded_ok) < len(parsed_downloads):
                    safe_print("[driver] Attempting best-effort artifact recovery before stopping VM...")
                    try:
                        rec_errs = recover_artifacts(
                            colab,
                            active_session,
                            parsed_downloads,
                            downloaded_ok,
                            exec_timeout=args.exec_timeout_sec,
                            transfer_timeout=args.transfer_timeout_sec,
                            teardown_deadline=teardown_deadline,
                            reserve_stop_sec=max(min(args.teardown_timeout_sec * 0.5, 30.0), min(1.0, args.teardown_timeout_sec * 0.4)),
                        )
                        recovery_warnings.extend(rec_errs)
                    except Exception as rec_exc:
                        msg = f"Unexpected artifact recovery error: {rec_exc}"
                        safe_print(f"[driver] {msg}")
                        recovery_warnings.append(msg)

            if suspect_endpoints and observed_remote_sessions:
                _reconcile_observed_suspects(observed_remote_sessions)

            if suspect_endpoints:
                rem_chk = teardown_deadline - time.monotonic()
                if rem_chk > 0.5:
                    try:
                        chk_ok, chk_names, _ = list_remote_sessions(
                            colab,
                            timeout=min(args.cmd_timeout_sec, max(1.0, rem_chk * 0.35)),
                            deadline=teardown_deadline,
                            **_obs_list_kwargs(),
                        )
                    except Exception as chk_exc:
                        chk_ok = False
                        chk_names = set()
                        teardown_errors_by_sess["__final_suspect_listing__"] = (
                            f"{type(chk_exc).__name__}: {chk_exc}"
                        )
                    if chk_ok:
                        _record_observed_names(chk_names)
                        for s_absent in list(suspect_endpoints):
                            g_absent = suspect_endpoints.pop(s_absent, None) or ""
                            if s_absent not in ambiguous_sessions:
                                _safe_mark(
                                    s_absent,
                                    "absent_after_new_error",
                                    gpu_spec=g_absent,
                                    note="absent_in_final_listing",
                                )
                for s_unverified, g_unverified in list(suspect_endpoints.items()):
                    _safe_mark(
                        s_unverified,
                        "maybe_created",
                        gpu_spec=g_unverified,
                        note="final_suspect_listing_unavailable_or_timed_out",
                    )
                    teardown_errors_by_sess[s_unverified] = (
                        f"unable to confirm absence of suspect session {s_unverified} in final listing"
                    )

            stop_phase_deadline = teardown_deadline
            stop_queue: list[str] = []
            if active_session and active_session not in released_endpoints:
                stop_queue.append(active_session)
            for sess in created_endpoints:
                if sess not in released_endpoints and sess not in stop_queue:
                    stop_queue.append(sess)
            for sess in stop_queue:
                if sess in released_endpoints:
                    continue
                safe_print(f"[driver] Releasing Colab VM session {sess} (allocated={active_session is not None})...")
                rem_stop_td = stop_phase_deadline - time.monotonic()
                eff_stop_dl = (
                    stop_phase_deadline
                    if rem_stop_td >= 1.5
                    else (time.monotonic() + min(args.cmd_timeout_sec, 5.0))
                )
                stop_attempts = 3 if rem_stop_td >= 1.5 else 1
                try:
                    stop_ok, stop_err = stop_remote_session(
                        colab,
                        sess,
                        timeout=min(args.cmd_timeout_sec, 45.0),
                        teardown_deadline=eff_stop_dl,
                        max_attempts=stop_attempts,
                    )
                except Exception as stop_exc:
                    stop_ok = False
                    stop_err = f"{type(stop_exc).__name__}: {stop_exc}"
                if stop_ok:
                    released_endpoints.add(sess)
                    teardown_errors_by_sess.pop(sess, None)
                    _safe_mark(sess, "stopped")
                else:
                    teardown_errors_by_sess[sess] = stop_err
                    _safe_mark(sess, "stop_failed", note=stop_err)

            rem_usage = stop_phase_deadline - time.monotonic()
            if created_endpoints and rem_usage > 5.0:
                try:
                    run_cmd(
                        [colab, "--auth=oauth2", "usage"],
                        check=False,
                        capture=True,
                        timeout=min(15.0, rem_usage),
                        deadline=stop_phase_deadline,
                    )
                except Exception:
                    pass

            try:
                registry.cleanup_if_all_released()
            except OSError as reg_exc:
                safe_print(f"[driver] Warning: local session registry cleanup failed: {reg_exc}")
    finally:
        for sig, prev in prev_handlers.items():
            try:
                signal.signal(sig, prev)
            except (ValueError, OSError):
                pass

    teardown_errors = [f"{sess}: {err}" for sess, err in teardown_errors_by_sess.items()]
    if (
        transfer_phase_error
        and primary_exc is not None
        and len(downloaded_ok) == len(parsed_downloads)
        and not recovery_warnings
        and not teardown_errors
        and not isinstance(primary_exc, JobInterruptedError)
    ):
        safe_print("[driver] Teardown recovery verified all requested downloads cleanly; clearing initial transfer error.")
        primary_exc = None
    all_recovery_warnings = rejected_recovery_warnings + recovery_warnings
    if primary_exc is not None:
        suffix_parts: list[str] = []
        if teardown_errors:
            suffix_parts.append(f"[ALSO TEARDOWN FAILED: {'; '.join(teardown_errors)}]")
        if all_recovery_warnings:
            suffix_parts.append(f"[RECOVERY WARNINGS: {'; '.join(all_recovery_warnings)}]")
        if suffix_parts:
            raise RuntimeError(f"{primary_exc} {' '.join(suffix_parts)}") from primary_exc
        raise primary_exc
    if teardown_errors:
        raise RuntimeError(f"Failed to stop Colab VM session(s): {'; '.join(teardown_errors)}")


def _make_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run Python workers on Colab GPU and download artifacts safely.")
    parser.add_argument("--colab-bin", required=True, help="Path to colab executable")
    parser.add_argument("--worker", action="append", required=True, help="Local Python script(s) to run sequentially")
    parser.add_argument(
        "--gpus",
        default="H100,G4,A100:hm,A100",
        help="Comma-separated GPU fallback order",
    )
    parser.add_argument("--upload", action="append", default=[], help="local_path:remote_path pairs")
    parser.add_argument("--download", action="append", default=[], help="remote_path:local_path pairs")
    parser.add_argument("--min-vram-gib", type=float, default=0.0, help="Optional GPU VRAM admission floor in GiB")
    parser.add_argument("--cmd-timeout-sec", type=float, default=DEFAULT_CMD_TIMEOUT_SEC)
    parser.add_argument("--new-timeout-sec", type=float, default=DEFAULT_NEW_TIMEOUT_SEC)
    parser.add_argument("--exec-timeout-sec", type=float, default=DEFAULT_EXEC_TIMEOUT_SEC)
    parser.add_argument("--transfer-timeout-sec", type=float, default=DEFAULT_TRANSFER_TIMEOUT_SEC)
    parser.add_argument("--job-timeout-sec", type=float, default=DEFAULT_JOB_TIMEOUT_SEC)
    parser.add_argument("--drain-timeout-sec", type=float, default=DEFAULT_DRAIN_TIMEOUT_SEC)
    parser.add_argument("--teardown-timeout-sec", type=float, default=DEFAULT_TEARDOWN_TIMEOUT_SEC)
    parser.add_argument("--poll-interval-sec", type=float, default=12.0)
    parser.add_argument("--state-dir", default="", help="Optional directory for local owned-session registry")
    parser.add_argument(
        "--allow-rerun-completed-workers",
        action="store_true",
        help="Allow falling back to a new GPU VM even after an earlier worker already completed cleanly.",
    )
    return parser


def main() -> None:
    parser = _make_arg_parser()
    args = parser.parse_args()
    execute_job(args)


if __name__ == "__main__":
    main()
    try:
        sys.stdout.flush()
    except (BrokenPipeError, OSError):
        _silence_broken_stdout()
