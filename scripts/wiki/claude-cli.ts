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

export const runClaude: RunAgent = (req: AgentRequest, onEvent?: (e: AgentEvent) => void) =>
  new Promise<AgentResult>((resolve) => {
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
      const e = parseStreamJsonLine(line);
      if (!e) return;
      if (e.kind === "result") {
        isError = e.isError;
        sessionId = e.sessionId;
        costUsd = e.costUsd;
      }
      onEvent?.(e);
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
