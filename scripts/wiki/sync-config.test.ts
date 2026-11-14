import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { readSyncConfig } from "./sync";

const dir = () => mkdtempSync(join(tmpdir(), "wiki-sync-config-"));

it("只有共享配置时照原样解析", () => {
  const d = dir();
  writeFileSync(join(d, "sync.config.json"), JSON.stringify({ maxNewParamPages: 10 }));
  expect(readSyncConfig(join(d, "sync.config.json"))).toMatchObject({ maxNewParamPages: 10, maxTasks: 0 });
  expect(readSyncConfig(join(d, "sync.config.json")).python).toBeUndefined();
});

it("carries the machine-specific Codex executable into the shared model selection", () => {
  const d = dir();
  writeFileSync(
    join(d, "sync.config.local.json"),
    JSON.stringify({ chatProvider: "codex", codexCli: process.execPath }),
  );
  expect(readSyncConfig(join(d, "sync.config.json")).codexCli).toBe(process.execPath);
});

it("旁边的 sync.config.local.json 盖在共享配置上——本机的解释器路径放那里，不进仓库", () => {
  const d = dir();
  writeFileSync(join(d, "sync.config.json"), JSON.stringify({ maxNewParamPages: 10 }));
  writeFileSync(join(d, "sync.config.local.json"), JSON.stringify({ python: "C:/envs/wiki/python.exe" }));
  expect(readSyncConfig(join(d, "sync.config.json"))).toMatchObject({
    maxNewParamPages: 10,
    python: "C:/envs/wiki/python.exe",
  });
});

it("本机覆盖文件同样过 schema：写了不认识的键就报错，不会悄悄带进去", () => {
  const d = dir();
  writeFileSync(join(d, "sync.config.json"), "{}");
  writeFileSync(join(d, "sync.config.local.json"), JSON.stringify({ pyhton: "typo" }));
  expect(() => readSyncConfig(join(d, "sync.config.json"))).toThrow();
});

it("问答模型 chatModel 可以写在本机覆盖里；不像模型名的值直接报错", () => {
  const d = dir();
  writeFileSync(join(d, "sync.config.json"), "{}");
  expect(readSyncConfig(join(d, "sync.config.json")).chatModel).toBeUndefined();
  writeFileSync(join(d, "sync.config.local.json"), JSON.stringify({ chatModel: "claude-fable-5-1" }));
  expect(readSyncConfig(join(d, "sync.config.json")).chatModel).toBe("claude-fable-5-1");
  writeFileSync(
    join(d, "sync.config.local.json"),
    JSON.stringify({ chatProvider: "claude", chatModel: "openrouter,qwen/qwen3-coder:free" }),
  );
  expect(readSyncConfig(join(d, "sync.config.json"))).toMatchObject({
    chatProvider: "claude",
    chatModel: "openrouter,qwen/qwen3-coder:free",
  });
  writeFileSync(join(d, "sync.config.local.json"), JSON.stringify({ chatModel: "--tools x" }));
  expect(() => readSyncConfig(join(d, "sync.config.json"))).toThrow();
});
