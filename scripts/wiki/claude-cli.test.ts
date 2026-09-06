import { describe, expect, it } from "vitest";
import { resolveClaudeCommand } from "./claude-cli";

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
