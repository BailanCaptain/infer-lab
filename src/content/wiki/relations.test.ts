import { describe, expect, it } from "vitest";
import { groupRelations, neighborhood, prerequisiteRelations } from "./relations";

const rel = (
  to: string,
  kind: "builds-on" | "variant-of" | "conflicts-with" | "alternative-to",
  note = "n",
) => ({
  to,
  kind,
  note,
});
const back = (from: string, kind: string, note = "n") => ({ from, kind, note });

describe("groupRelations", () => {
  it("出边与派生入边合并，按阅读次序分组", () => {
    const g = groupRelations(
      [rel("kv-cache-spec", "builds-on", "列数由 spec 的 block_size 决定")],
      [back("paged-attention", "enables", "按块号 gather 历史 K/V")],
    );
    expect(g.map((x) => x.title)).toEqual(["先读这些", "谁用到它"]);
    expect(g[0]?.items).toEqual([{ id: "kv-cache-spec", note: "列数由 spec 的 block_size 决定" }]);
    expect(g[1]?.items).toEqual([{ id: "paged-attention", note: "按块号 gather 历史 K/V" }]);
  });

  it("对称边两头都出现时只留一条", () => {
    const g = groupRelations([rel("b", "conflicts-with")], [back("b", "conflicts-with")]);
    expect(g).toHaveLength(1);
    expect(g[0]?.items).toEqual([{ id: "b", note: "n" }]);
  });

  it("空关系返回空数组，页面就不渲染这一节", () => {
    expect(groupRelations([], [])).toEqual([]);
  });

  it("同组内按 id 排序，输出稳定", () => {
    const g = groupRelations([rel("z", "builds-on"), rel("a", "builds-on")], []);
    expect(g[0]?.items.map((x) => x.id)).toEqual(["a", "z"]);
  });

  it("每条都带 note——它就是给读者的理由", () => {
    const g = groupRelations([rel("b", "builds-on", "因为如此")], []);
    expect(g[0]?.items[0]?.note).toBe("因为如此");
  });
});

describe("neighborhood", () => {
  it("按地基 / 下游 / 同层分三桶，供问答沿图组装", () => {
    const n = neighborhood(
      [rel("kv-cache-spec", "builds-on"), rel("kv-pool", "alternative-to")],
      [back("prefix-caching", "enables"), back("sfa", "has-variant")],
    );
    expect(n.foundations.map((x) => x.id)).toEqual(["kv-cache-spec"]);
    expect(n.dependents.map((x) => x.id)).toEqual(["prefix-caching", "sfa"]);
    expect(n.siblings.map((x) => x.id)).toEqual(["kv-pool"]);
  });

  it("variant-of 算地基——先知道它属于什么，再看它自己", () => {
    const n = neighborhood([rel("attention", "variant-of")], []);
    expect(n.foundations.map((x) => x.id)).toEqual(["attention"]);
  });

  it("没有邻居时三桶都空", () => {
    expect(neighborhood([], [])).toEqual({ foundations: [], dependents: [], siblings: [] });
  });
});

describe("prerequisiteRelations", () => {
  it("仅提取出边 builds-on，保留作者声明先后顺序并按目标 id 去重", () => {
    expect(
      prerequisiteRelations([
        rel("matmul-and-weights", "builds-on", "先认识矩阵乘"),
        rel("kv-cache-quantization", "alternative-to", "历史缓存另算"),
        rel("glm-5-3-flash", "builds-on", "模型精度出处"),
        rel("matmul-and-weights", "builds-on", "重复项应忽略"),
      ]),
    ).toEqual([
      { id: "matmul-and-weights", note: "先认识矩阵乘" },
      { id: "glm-5-3-flash", note: "模型精度出处" },
    ]);
    expect(prerequisiteRelations([rel("kv-pool", "alternative-to")])).toEqual([]);
  });
});
