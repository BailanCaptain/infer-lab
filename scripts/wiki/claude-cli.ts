/**
 * spawn 本机 claude CLI 跑一次 -p。prompt 走 stdin（Windows argv 上限 32 KB），
 * stdout 按行解析 stream-json，超时用 taskkill /T /F 杀整树。
 * Windows 处理借自 Multi-Agent runtime/claude-command.ts 与 base-runtime.ts。
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline";
import {
  type AgentEvent,
  type AgentRequest,
  type AgentResult,
  parseStreamJsonLine,
  type RunAgent,
} from "./ingest";

export interface ClaudeCommand {
  command: string;
  shell: boolean;
}

export function resolveClaudeCommand(
  env: NodeJS.ProcessEnv = process.env,
  exists: (p: string) => boolean = existsSync,
  platform: NodeJS.Platform = process.platform,
): ClaudeCommand {
  if (env.CLAUDE_CLI && exists(env.CLAUDE_CLI)) return { command: env.CLAUDE_CLI, shell: false };
  const home = env.USERPROFILE || env.HOME || "";
  const local = `${home.replace(/\\/g, "/")}/.local/bin/claude${platform === "win32" ? ".exe" : ""}`;
  if (home && exists(local)) return { command: local, shell: false };
  return { command: "claude", shell: true };
}

export function killTree(pid: number, platform: NodeJS.Platform = process.platform): void {
  if (platform === "win32")
    spawn("taskkill", ["/pid", String(pid), "/t", "/f"], { shell: true, windowsHide: true });
  else process.kill(pid, "SIGKILL");
}

/** 行解析器认出 result 事件时返回这些字段，由管道记录下来。 */
export interface LineOutcome {
  isError?: boolean;
  sessionId?: string;
  costUsd?: number;
}

/**
 * spawn 一次 claude 并逐行喂给解析器。ingest 与问答共用这段管道：
 * 超时整树杀、stderr 只留尾部 2000、退出码与 result.is_error 归一成 AgentResult。
 * 两边的事件形状不同（问答还要文本增量），所以解析交给调用方，
 * 只要在认出 result 时把 sessionId / costUsd / isError 返回回来。
 */
export function spawnClaude(
  req: AgentRequest,
  onLine: (line: string) => LineOutcome | undefined,
): Promise<AgentResult> {
  return new Promise<AgentResult>((resolve) => {
    const cmd = resolveClaudeCommand();
    const child = spawn(cmd.command, req.args, {
      cwd: req.cwd,
      shell: cmd.shell,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let sessionId: string | undefined;
    let costUsd: number | undefined;
    let isError = false;
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid) killTree(child.pid);
    }, req.timeoutMs);

    createInterface({ input: child.stdout }).on("line", (line) => {
      const out = onLine(line);
      if (!out) return;
      if (out.isError !== undefined) isError = out.isError;
      if (out.sessionId !== undefined) sessionId = out.sessionId;
      if (out.costUsd !== undefined) costUsd = out.costUsd;
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr = (stderr + d.toString()).slice(-2000);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        id: req.id,
        ok: false,
        exitCode: null,
        reason: `spawn-error: ${err.message}`,
        stderrTail: stderr,
      });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const base: AgentResult = { id: req.id, ok: false, exitCode: code, stderrTail: stderr };
      if (sessionId) base.sessionId = sessionId;
      if (costUsd !== undefined) base.costUsd = costUsd;
      if (timedOut) resolve({ ...base, reason: `timeout ${req.timeoutMs}ms` });
      else if (code !== 0) resolve({ ...base, reason: `exit ${code}` });
      else if (isError) resolve({ ...base, reason: "result.is_error" });
      else resolve({ ...base, ok: true });
    });
    child.stdin.end(req.stdin, "utf8");
  });
}

/** ingest 用的运行器：按 ingest 的事件形状解析。 */
export const runClaude: RunAgent = (req: AgentRequest, onEvent?: (e: AgentEvent) => void) =>
  spawnClaude(req, (line) => {
    const e = parseStreamJsonLine(line);
    if (!e) return;
    onEvent?.(e);
    if (e.kind === "result") {
      return { isError: e.isError, sessionId: e.sessionId, costUsd: e.costUsd };
    }
  });

/** --dry-run 用：把一次调用打印成可复制的命令行（stdin 另起一段） */
export function formatDryRun(req: AgentRequest): string {
  const cmd = resolveClaudeCommand();
  const q = (s: string) => (/[\s"]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s);
  return [
    `cd ${req.cwd}`,
    `${cmd.command} ${req.args.map(q).join(" ")}`,
    "--- stdin ---",
    req.stdin,
    "-------------",
  ].join("\n");
}
