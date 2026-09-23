import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  commandLineLength,
  promptFileArgs,
  resolveClaudeCommand,
  spawnClaude,
  WINDOWS_COMMAND_LINE_LIMIT,
} from "./claude-cli";

describe("resolveClaudeCommand", () => {
  it("顺序：CLAUDE_CLI 环境变量 → ~/.local/bin/claude(.exe) → 裸 claude（shell）", () => {
    expect(resolveClaudeCommand({ CLAUDE_CLI: "C:/x/claude.exe" }, () => true)).toEqual({
      command: "C:/x/claude.exe",
      shell: false,
    });
    expect(
      resolveClaudeCommand({ USERPROFILE: "C:/Users/me" }, (p) => p.endsWith("claude.exe"), "win32"),
    ).toEqual({
      command: "C:/Users/me/.local/bin/claude.exe",
      shell: false,
    });
    expect(resolveClaudeCommand({ HOME: "/home/me" }, (p) => p.endsWith("/claude"), "linux")).toEqual({
      command: "/home/me/.local/bin/claude",
      shell: false,
    });
    expect(resolveClaudeCommand({}, () => false)).toEqual({ command: "claude", shell: true });
  });
});

// 2026-09-23 实遇：问答把 HANDBOOK 两节 + 整份索引当 --append-system-prompt 的参数传，系统提示词 42,930 字符，
// 整条命令行 43,394 字符，超过 Windows 的 32,767；进程起不来，还把共享预算账本暂停了。
describe("长提示词不走命令行", () => {
  const request = (args: string[]) => ({
    id: "t",
    cwd: tmpdir(),
    args,
    stdin: "",
    timeoutMs: 5_000,
    allowedWrites: [],
  });
  // 不存在的程序：测试里绝不会真的起模型
  const missing = { command: join(tmpdir(), "no-such-claude-binary-20260923.exe"), shell: false };

  it("系统提示词写进临时文件、参数换成读文件的版本，命令行回到上限以内", () => {
    const dir = mkdtempSync(join(tmpdir(), "prompt-args-"));
    try {
      const system = "规则".repeat(21_500);
      const args = ["-p", "--append-system-prompt", system, "--tools", "", "--system-prompt", "受限规则"];
      const moved = promptFileArgs(args, dir);
      expect(moved.args).toEqual([
        "-p",
        "--append-system-prompt-file",
        moved.files[0],
        "--tools",
        "",
        "--system-prompt-file",
        moved.files[1],
      ]);
      expect(readFileSync(moved.files[0]!, "utf8")).toBe(system);
      expect(readFileSync(moved.files[1]!, "utf8")).toBe("受限规则");
      expect(commandLineLength("C:/x/claude.exe", args)).toBeGreaterThan(WINDOWS_COMMAND_LINE_LIMIT);
      expect(commandLineLength("C:/x/claude.exe", moved.args)).toBeLessThan(1_000);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("命令行仍然超长时不启动进程，按零费用返回，不让账本以为花了钱却不知道多少", async () => {
    const result = await spawnClaude(
      request(["-p", "--add-dir", "x".repeat(40_000)]),
      () => undefined,
      missing,
    );
    expect(result).toMatchObject({ ok: false, exitCode: null, costUsd: 0 });
    expect(result.reason).toMatch(/命令行/);
  });

  it("程序根本没起来（找不到可执行文件）也按零费用返回", async () => {
    const result = await spawnClaude(request(["-p"]), () => undefined, missing);
    expect(result).toMatchObject({ ok: false, exitCode: null, costUsd: 0 });
    expect(result.reason).toMatch(/spawn-error/);
  });
});
