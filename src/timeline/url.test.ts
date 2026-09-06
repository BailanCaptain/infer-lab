import { describe, expect, it } from "vitest";
import { formatLabQuery, parseLabQuery, readHashQuery, replaceHashQuery, withHashQuery } from "./url";

describe("URL 参数", () => {
  it("解析 ch/step/layer/nofx；nofx 接受 1 与 true", () => {
    expect(parseLabQuery("?ch=03&step=L0.attn.q&layer=hardware&nofx=1")).toEqual({
      ch: "03",
      step: "L0.attn.q",
      layer: "hardware",
      nofx: true,
    });
    expect(parseLabQuery(new URLSearchParams("nofx=true"))).toEqual({ nofx: true });
    expect(parseLabQuery("")).toEqual({ nofx: false });
  });
  it("不认识的 layer 与 nofx 值被忽略", () => {
    expect(parseLabQuery("?layer=3d&nofx=yes")).toEqual({ nofx: false });
    expect(parseLabQuery("?layer=&step=")).toEqual({ nofx: false });
  });
  it("格式化保留无关参数，nofx=false 时删掉键；与解析互逆", () => {
    const base = new URLSearchParams("?tab=values&nofx=1&step=old");
    const out = formatLabQuery({ ch: "03", step: "L0.ln1", layer: "both", nofx: false }, base);
    expect(out.get("tab")).toBe("values");
    expect(out.has("nofx")).toBe(false);
    expect(out.get("step")).toBe("L0.ln1");
    expect(parseLabQuery(out)).toEqual({ ch: "03", step: "L0.ln1", layer: "both", nofx: false });
    const q = { ch: "spike-c", step: "L0.attn.scores", layer: "model" as const, nofx: true };
    expect(parseLabQuery(formatLabQuery(q))).toEqual(q);
  });
  it("step id 里的点号原样保留", () => {
    expect(formatLabQuery({ step: "L0.mlp.down", nofx: false }).toString()).toBe("step=L0.mlp.down");
  });
  it("hash 路由：从 #/path?… 读查询串，写回时保留路径", () => {
    expect(readHashQuery("#/dev/spike-c?step=L0.ln1&nofx=1").get("step")).toBe("L0.ln1");
    expect(readHashQuery("#/dev/spike-c").toString()).toBe("");
    expect(readHashQuery("").toString()).toBe("");
    expect(withHashQuery("#/dev/spike-c?old=1", new URLSearchParams("step=L0.ln1"))).toBe(
      "#/dev/spike-c?step=L0.ln1",
    );
    expect(withHashQuery("#/dev/spike-c", new URLSearchParams())).toBe("#/dev/spike-c");
    expect(withHashQuery("", new URLSearchParams("a=1"))).toBe("#/?a=1");
  });
  it("replaceHashQuery 用 replaceState 写整条 URL，未变化时不写", () => {
    const calls: string[] = [];
    const win = {
      location: { pathname: "/infra/", search: "?v=2", hash: "#/dev/spike-c?step=embed.gather" },
      history: {
        state: { idx: 3 },
        replaceState(_s: unknown, _u: string, url: string) {
          calls.push(url);
        },
      },
    };
    replaceHashQuery(new URLSearchParams("step=embed.gather"), win);
    expect(calls).toEqual([]);
    replaceHashQuery(new URLSearchParams("step=L0.ln1&layer=model"), win);
    expect(calls).toEqual(["/infra/?v=2#/dev/spike-c?step=L0.ln1&layer=model"]);
  });
});
