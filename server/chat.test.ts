import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadHandbook } from "../scripts/wiki/handbook";
import { buildChatRequest, claimsOffline, parseChatLine, sseFrame } from "./chat";

const hb = { reading: "READING-SLICE", citable: "CITABLE-SLICE", query: "QUERY-SLICE" };
const ctx = { wikiRoot: "C:/w/wiki", timeoutMs: 60_000 };
const systemOf = (req: { args: string[] }) => req.args[req.args.indexOf("--append-system-prompt") + 1]!;

describe("问答拿到的手册", () => {
  it.each(["claude", "codex"] as const)("%s 只注入完整的读页、来源与查询切片各一次", (provider) => {
    const handbook = loadHandbook(join(process.cwd(), "wiki"));
    const req = buildChatRequest({ message: "x" }, handbook, { ...ctx, provider });
    const system = provider === "codex" ? req.stdin : systemOf(req);
    expect(system).toContain("### 读页约定");
    expect(system).toContain("### 可引来源");
    expect(system).toContain("## 查询");
    // 写页规则（2026-09-23 前问答整片拿到约 1.55 万字）
    expect(system).not.toContain("#### 教学页的推荐写法");
    expect(system).not.toContain("### 图");
    expect(system).not.toContain("coverage-assessment");
    let overhead = system;
    for (const key of ["reading", "citable", "query"] as const) {
      const slice = handbook[key].trim();
      expect(system.split(slice), key).toHaveLength(2);
      overhead = overhead.replace(slice, "");
    }
    // 来源白名单可以增长；限制拼装开销，不能把合法来源增长当成写页规则泄漏。
    expect(overhead.length).toBeLessThan(1000);
    for (const key of ["pageFormat", "extract", "integrate", "coverage", "lint"] as const)
      expect(system, key).not.toContain(handbook[key].trim());
  });
  it.each(["claude", "codex"] as const)("%s 隔离未授权的手册切片，即使传入完整手册", (provider) => {
    const excluded = {
      pageFormat: "WRITE-PAGE-FORMAT-ONLY",
      extract: "EXTRACT-ONLY",
      integrate: "INTEGRATE-ONLY",
      coverage: "COVERAGE-ASSESSMENT-ONLY",
      lint: "LINT-ONLY",
    };
    const req = buildChatRequest({ message: "x" }, { ...hb, ...excluded }, { ...ctx, provider });
    const system = provider === "codex" ? req.stdin : systemOf(req);
    for (const marker of Object.values(hb)) expect(system.split(marker)).toHaveLength(2);
    for (const marker of Object.values(excluded)) expect(system).not.toContain(marker);
  });
  it("长度以讲清为准，并照顾初学者", () => {
    const system = systemOf(
      buildChatRequest({ message: "x" }, loadHandbook(join(process.cwd(), "wiki")), ctx),
    );
    expect(system).not.toContain("不超过 400 字");
    expect(system).toContain("初学者");
  });
});

describe("parseChatLine", () => {
  it("从 stream_event 的 text_delta 取增量", () => {
    const line = JSON.stringify({
      type: "stream_event",
      event: { type: "content_block_delta", delta: { type: "text_delta", text: "KV " } },
    });
    expect(parseChatLine(line)).toEqual({ kind: "text", text: "KV " });
  });

  it("忽略 assistant 信封里的整段文本，避免与增量重复", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "text", text: "KV Cache 是……" }] },
    });
    expect(parseChatLine(line)).toBeNull();
  });

  it("工具调用转成 tool 事件，让前端能显示正在查哪一页", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        content: [{ type: "tool_use", name: "Read", input: { file_path: "concepts/kv-cache.md" } }],
      },
    });
    expect(parseChatLine(line)).toEqual({ kind: "tool", name: "Read", target: "concepts/kv-cache.md" });
  });

  it("result 带回 sessionId 供多轮续聊", () => {
    const line = JSON.stringify({ type: "result", is_error: false, session_id: "s-1", total_cost_usd: 0.01 });
    expect(parseChatLine(line)).toEqual({ kind: "result", isError: false, sessionId: "s-1", costUsd: 0.01 });
  });

  it("非 JSON 与无关事件返回 null", () => {
    expect(parseChatLine("not json")).toBeNull();
    expect(parseChatLine(JSON.stringify({ type: "system" }))).toBeNull();
    expect(parseChatLine("null")).toBeNull();
  });
  it("malformed envelopes are ignored instead of crashing or completing a turn", () => {
    for (const value of [
      { type: "assistant", message: { content: "invalid" } },
      { type: "assistant", message: { content: [null] } },
      { type: "result" },
    ])
      expect(parseChatLine(JSON.stringify(value))).toBeNull();
  });
});

describe("buildChatRequest", () => {
  it("passes a CCR route as one model argument while keeping the isolated chat profile", () => {
    const model = "openrouter,qwen/qwen3-coder:free";
    const req = buildChatRequest({ message: "x" }, hb, { ...ctx, provider: "claude", model });
    expect(req.args[req.args.indexOf("--model") + 1]).toBe(model);
    expect(req.args).toContain("--safe-mode");
    expect(req.args[req.args.indexOf("--setting-sources") + 1]).toBe("");
  });
  it.each(["claude", "codex"] as const)("%s 保留现场问题，不把所有提问预设为学习者提问", (provider) => {
    const question = "服务启动失败，先收集哪些证据？";
    const req = buildChatRequest({ message: question }, hb, { ...ctx, provider });
    expect(req.stdin).toContain(`用户的问题：${question}`);
    expect(req.stdin).not.toContain("学习者的问题：");
    const instructions = provider === "codex" ? req.stdin : systemOf(req);
    expect(instructions.split(hb.query)).toHaveLength(2);
  });

  it("引用导航只提供页面链接，不额外诱导模型复制源码角标", () => {
    const req = buildChatRequest(
      {
        message: "读写 KV 使用什么映射？",
        citationGuide: [
          {
            pageLink: "[Block Table](concepts/block-table.md)",
            sourceLinks: ["[C6](concepts/block-table.md)"],
          },
        ],
      },
      hb,
      ctx,
    );
    expect(req.stdin).toContain("[Block Table](concepts/block-table.md)");
    expect(req.stdin).not.toContain("[C6]");
    expect(req.stdin).not.toContain("sourceLinks");
    expect(req.args[req.args.indexOf("--append-system-prompt") + 1]).toContain(hb.query);
  });

  it("离线对照禁联网、固定模型和额度，且不持久化会话", () => {
    const req = buildChatRequest({ message: "control" }, hb, {
      ...ctx,
      control: { model: "claude-sonnet-4-6", maxCostUsd: 0.1 },
    });
    expect(req.args[req.args.indexOf("--tools") + 1]).toBe("Read,Grep,Glob");
    expect(req.args[req.args.indexOf("--model") + 1]).toBe("claude-sonnet-4-6");
    expect(req.args[req.args.indexOf("--max-budget-usd") + 1]).toBe("0.1");
    expect(req.args).toContain("--no-session-persistence");
    const denied = req.args.slice(req.args.indexOf("--disallowedTools") + 1);
    expect(denied).toContain("WebSearch");
    expect(denied).toContain("WebFetch");
    expect(req.args[req.args.indexOf("--append-system-prompt") + 1]).toContain("离线对照");
  });

  it("配置了问答模型（chatModel）就用 --model 固定它；没配置走 CLI 默认模型", () => {
    const pinned = buildChatRequest({ message: "q" }, hb, { ...ctx, model: "claude-fable-5-1" });
    expect(pinned.args[pinned.args.indexOf("--model") + 1]).toBe("claude-fable-5-1");
    expect(pinned.args).not.toContain("--no-session-persistence");
    expect(buildChatRequest({ message: "q" }, hb, ctx).args).not.toContain("--model");
    expect(buildChatRequest({ message: "q" }, hb, { ...ctx, model: "claude-opus-5-5[1m]" }).args).toContain(
      "claude-opus-5-5[1m]",
    );
    for (const model of ["", " ", "--tools", "a b", "x;rm"])
      expect(() => buildChatRequest({ message: "q" }, hb, { ...ctx, model })).toThrow(/模型/);
  });

  it("离线对照拒绝复用旧会话、历史问题和无效额度", () => {
    const control = { model: "claude-sonnet-4-6", maxCostUsd: 0.1 };
    for (const input of [
      { message: "x", sessionId: "old" },
      { message: "x", previousQuestions: ["old"] },
    ])
      expect(() => buildChatRequest(input, hb, { ...ctx, control })).toThrow();
    for (const maxCostUsd of [0, -1, NaN, Infinity])
      expect(() =>
        buildChatRequest({ message: "x" }, hb, {
          ...ctx,
          control: { ...control, maxCostUsd },
        }),
      ).toThrow();
    expect(() =>
      buildChatRequest({ message: "x" }, hb, {
        ...ctx,
        control: { ...control, model: " " },
      }),
    ).toThrow();
  });

  it("把图扩展的 via 写进 prompt，agent 能区分直接命中和邻居", () => {
    const req = buildChatRequest(
      {
        message: "alpha",
        hits: [
          { id: "beta", title: "Beta", summary: "s", evidence: "C", score: 10, how: "related", via: "alpha" },
        ],
      },
      hb,
      ctx,
    );
    expect(req.stdin).toContain("由 alpha 的关系扩展");
  });
  it("cwd 是 wiki/，系统提示 = 读页约定 + 可引来源 + 查询 + 去 index.md 里搜的说明，不再塞整份索引", () => {
    // 2026-09-23：整份 index.md 每页约 228 字符，库越大系统提示越长；模型在快照里本来就能 Grep 它
    const req = buildChatRequest({ message: "KV Cache 是什么" }, hb, ctx);
    expect(req.cwd).toBe("C:/w/wiki");
    const sys = req.args[req.args.indexOf("--append-system-prompt") + 1] ?? "";
    expect(sys.indexOf(hb.reading)).toBeLessThan(sys.indexOf(hb.citable));
    expect(sys.indexOf(hb.citable)).toBeLessThan(sys.indexOf(hb.query));
    expect(sys.startsWith(hb.reading)).toBe(true);
    expect(sys).toContain("用 Grep 在 index.md 里搜");
    expect(sys).not.toContain("列出了当前全部页面");
  });

  it("只给只读工具；写类工具一律禁掉", () => {
    const req = buildChatRequest({ message: "x" }, hb, ctx);
    const allowed = req.args.slice(
      req.args.indexOf("--allowedTools") + 1,
      req.args.indexOf("--disallowedTools"),
    );
    expect(allowed).toEqual(["Read", "Grep", "Glob", "WebFetch", "WebSearch"]);
    const disallowed = req.args.slice(req.args.indexOf("--disallowedTools") + 1);
    for (const t of ["Write", "Edit", "Bash"]) {
      expect(disallowed).toContain(t);
    }
  });

  it("联网工具进白名单，不只是没进黑名单", () => {
    // `--allowedTools` 在 -p 模式下是白名单：只从黑名单拿掉不够，实测会被拒
    // （Claude requested permissions to use WebFetch, but you haven't granted it yet.）
    const req = buildChatRequest({ message: "x" }, hb, ctx);
    const allowed = req.args.slice(
      req.args.indexOf("--allowedTools") + 1,
      req.args.indexOf("--disallowedTools"),
    );
    const disallowed = req.args.slice(req.args.indexOf("--disallowedTools") + 1);
    for (const t of ["WebFetch", "WebSearch"]) {
      expect(allowed).toContain(t);
      expect(disallowed).not.toContain(t);
    }
  });

  it("提问走 stdin，不进 argv（Windows argv 有 32KB 上限）", () => {
    const req = buildChatRequest({ message: "很长的问题".repeat(100) }, hb, ctx);
    expect(req.stdin).toContain("很长的问题");
    expect(req.args.join(" ")).not.toContain("很长的问题");
  });

  it("带 sessionId 时加 --resume 续聊", () => {
    const req = buildChatRequest({ message: "那它多大", sessionId: "s-1" }, hb, ctx);
    expect(req.args[req.args.indexOf("--resume") + 1]).toBe("s-1");
  });

  it("不带 sessionId 时没有 --resume", () => {
    expect(buildChatRequest({ message: "x" }, hb, ctx).args).not.toContain("--resume");
  });

  it("检索到的候选页写进 stdin，给 agent 指路", () => {
    const req = buildChatRequest(
      {
        message: "KV Cache 是什么",
        hits: [{ id: "kv-cache", title: "KV Cache", summary: "s", evidence: "C", score: 1000, how: "exact" }],
      },
      hb,
      ctx,
    );
    expect(req.stdin).toContain("kv-cache");
  });

  it("聊天不允许写文件，allowedWrites 为空", () => {
    expect(buildChatRequest({ message: "x" }, hb, ctx).allowedWrites).toEqual([]);
  });
});

describe("sseFrame", () => {
  it("拼成合法 SSE 帧", () => {
    expect(sseFrame("text", { text: "hi" })).toBe('event: text\ndata: {"text":"hi"}\n\n');
  });

  it("换行不会破坏帧结构（JSON 里被转义）", () => {
    const frame = sseFrame("text", { text: "a\nb" });
    expect(frame.split("\n\n").length).toBe(2);
    expect(frame).toContain("\\n");
  });
});

describe("系统提示写明本轮有哪些工具", () => {
  // 2026-09-23 实测：同一问题有的轮次模型说「本轮没有联网工具」、有的轮次真的去 WebFetch 了。
  // 手册只说「若本轮提供…」，让模型自己猜；提示里直接写清，并让读者在界面上看到。
  it("联网轮次：点名 WebFetch / WebSearch 可用，不许说没有联网工具", () => {
    const req = buildChatRequest({ message: "x" }, hb, ctx);
    const sys = req.args[req.args.indexOf("--append-system-prompt") + 1] ?? "";
    expect(sys).toContain("WebFetch、WebSearch 可用");
    expect(sys).toContain("不要说本轮没有联网工具");
  });
  it("离线对照：写明只有只读工具、不联网", () => {
    const req = buildChatRequest({ message: "x" }, hb, { ...ctx, control: { model: "m", maxCostUsd: 1 } });
    const sys = req.args[req.args.indexOf("--append-system-prompt") + 1] ?? "";
    expect(sys).toContain("只有 Read、Grep、Glob，不联网");
    expect(sys).not.toContain("WebFetch、WebSearch 可用");
  });
  it("回答里的「没有联网工具」这类说法能被程序认出来", () => {
    expect(claimsOffline("本轮没有联网工具，只能读快照。")).toBe(true);
    expect(claimsOffline("我这一轮只能读知识库快照，读不到上游源码。")).toBe(true);
    expect(claimsOffline("本轮联网核查工具也不可用，因此尚未核实退出原因。")).toBe(true);
    expect(claimsOffline("默认值为 1，见 [A](sources/a.md)。")).toBe(false);
  });
});
