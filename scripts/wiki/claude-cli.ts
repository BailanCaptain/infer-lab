/**
 * spawn 本机 claude CLI 跑一次 -p。prompt 走 stdin（Windows argv 上限 32 KB），
 * stdout 按行解析 stream-json，超时用 taskkill /T /F 杀整树。
 * Windows 处理借自 Multi-Agent runtime/claude-command.ts 与 base-runtime.ts。
 */
import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import {
  type AgentEvent,
  type AgentRequest,
  type AgentResult,
  parseStreamJsonLine,
  type RunAgent,
} from "./ingest";
import { trackModels } from "./model-use";

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

/**
 * Windows 上一条命令行（程序路径 + 全部参数）最多 32,767 个字符（CreateProcess）。跨平台统一按它算：
 * 长内容一律走标准输入或文件。2026-09-23 实遇：问答把 HANDBOOK 两节 + 整份索引当参数传，
 * 整条命令行 43,394 字符，进程起不来，还把共享预算账本暂停了。
 */
export const WINDOWS_COMMAND_LINE_LIMIT = 32_767;

const PROMPT_FILE_FLAGS: Record<string, string> = {
  "--append-system-prompt": "--append-system-prompt-file",
  "--system-prompt": "--system-prompt-file",
};

/** 把系统提示词参数写进 dir 下的文件，换成 claude 读文件的同名参数；其余参数原样保留 */
export function promptFileArgs(args: string[], dir: string): { args: string[]; files: string[] } {
  const out = [...args];
  const files: string[] = [];
  for (let i = 0; i < out.length - 1; i++) {
    const flag = PROMPT_FILE_FLAGS[out[i]!];
    if (!flag) continue;
    const file = join(dir, `prompt-${randomUUID()}.md`);
    writeFileSync(file, out[i + 1]!, "utf8");
    out[i] = flag;
    out[i + 1] = file;
    files.push(file);
    i++;
  }
  return { args: out, files };
}

/** 按 Windows 的引号规则估算整条命令行的长度（与 formatDryRun 同一套引号） */
export function commandLineLength(command: string, args: string[]): number {
  const quote = (s: string) => (s === "" || /[\s"]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s);
  return [command, ...args].map(quote).join(" ").length;
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
 * 实际作答模型由这里统一认（见 model-use.ts），所有付费调用的结果里都带上，调用方不必各写一份。
 */
export function spawnClaude(
  req: AgentRequest,
  onLine: (line: string) => LineOutcome | undefined,
  cmd: ClaudeCommand = resolveClaudeCommand(),
): Promise<AgentResult> {
  return new Promise<AgentResult>((resolve) => {
    // 进程没起来就没有花钱：按零费用返回，共享预算账本不能因此以「费用未知」暂停
    const notStarted = (reason: string): AgentResult => ({
      id: req.id,
      ok: false,
      exitCode: null,
      costUsd: 0,
      reason,
      stderrTail: "",
    });
    const promptDir = mkdtempSync(join(tmpdir(), "claude-prompt-"));
    const cleanup = () => rmSync(promptDir, { recursive: true, force: true });
    const { args } = promptFileArgs(req.args, promptDir);
    const length = commandLineLength(cmd.command, args);
    if (length > WINDOWS_COMMAND_LINE_LIMIT) {
      cleanup();
      resolve(
        notStarted(`命令行 ${length} 字符，超过 Windows 上限 ${WINDOWS_COMMAND_LINE_LIMIT}；未启动模型`),
      );
      return;
    }
    let child: ChildProcess & { stdin: NonNullable<ChildProcess["stdin"]> };
    try {
      child = spawn(cmd.command, args, {
        cwd: req.cwd,
        shell: cmd.shell,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      }) as typeof child;
    } catch (error) {
      cleanup();
      resolve(notStarted(`spawn-error: ${error instanceof Error ? error.message : String(error)}`));
      return;
    }
    let sessionId: string | undefined;
    let costUsd: number | undefined;
    let isError = false;
    const models = trackModels();
    let stderr = "";
    let inputError: string | undefined;
    // Authentication/configuration failures can exit while the evidence prompt is still being written.
    child.stdin.on("error", (err) => {
      inputError = `stdin-error: ${err.message}`;
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid) killTree(child.pid);
    }, req.timeoutMs);

    createInterface({ input: child.stdout! }).on("line", (line) => {
      models.observe(line);
      const out = onLine(line);
      if (!out) return;
      if (out.isError !== undefined) isError = out.isError;
      if (out.sessionId !== undefined) sessionId = out.sessionId;
      if (out.costUsd !== undefined) costUsd = out.costUsd;
    });
    child.stderr!.on("data", (d: Buffer) => {
      stderr = (stderr + d.toString()).slice(-2000);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      cleanup();
      // 没有 pid = 进程根本没起来（例如找不到可执行文件），没有花钱；有 pid 的错误费用未知，交给账本处理
      if (child.pid === undefined) resolve(notStarted(`spawn-error: ${err.message}`));
      else {
        const used = models.result();
        resolve({
          id: req.id,
          ok: false,
          exitCode: null,
          reason: `spawn-error: ${err.message}`,
          stderrTail: stderr,
          ...(used ? { models: used } : {}),
        });
      }
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      cleanup();
      const base: AgentResult = { id: req.id, ok: false, exitCode: code, stderrTail: stderr };
      if (sessionId) base.sessionId = sessionId;
      if (costUsd !== undefined) base.costUsd = costUsd;
      const used = models.result();
      if (used) base.models = used;
      if (timedOut) resolve({ ...base, reason: `timeout ${req.timeoutMs}ms` });
      else if (code !== 0) resolve({ ...base, reason: `exit ${code}` });
      else if (inputError) resolve({ ...base, reason: inputError });
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
