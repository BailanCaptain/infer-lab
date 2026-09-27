import { describe, expect, it } from "vitest";
import { isNumericResult, parseCalc, parseCalcFence, splitExpr, textFenceAsCalc } from "./calc";

describe("```calc 围栏：一行一条算式", () => {
  it("标签 = 表达式 = 结果；结果后面的比较单独拆出来，仍是算式的一部分", () => {
    const rows = parseCalc(
      "MLA 一层一块 = 640 token × 1024 B（512 维 × 2 B） = 655,360 B\n" +
        "KDA 一层一份状态 = 36,864 B 卷积 + 524,288 B 递推 = 561,152 B   ≤ 655,360 B\n",
    );
    expect(rows).toEqual([
      {
        kind: "eq",
        label: "MLA 一层一块",
        steps: ["640 token × 1024 B（512 维 × 2 B）"],
        result: "655,360 B",
        resultOp: "=",
        rel: "",
        note: "",
      },
      {
        kind: "eq",
        label: "KDA 一层一份状态",
        steps: ["36,864 B 卷积 + 524,288 B 递推"],
        result: "561,152 B",
        resultOp: "=",
        rel: "≤ 655,360 B",
        note: "",
      },
    ]);
  });

  it("全角括号、全角逗号后面是说明，去掉外层标点；比较和说明可以同时有；没有中间步骤也行", () => {
    const [a, b, c, d] = parseCalc(
      "每块号 = 12 × (655,360 + 40,960) B = 8,355,840 B ≈ 7.969 MiB（每张卡）\n" +
        "每卡每层权重 = 18 × 6144 × 4096 × 1 B = 432 MiB（int8）\n" +
        "42 层 = 17.72 GiB，占主干 45 层权重的 88%\n" +
        "每卡嵌入权重 = 19360 × 4096 × 2 B = 151.25 MiB（BF16：16 位浮点，每个数 2 字节）",
    );
    expect(a).toMatchObject({ result: "8,355,840 B", rel: "≈ 7.969 MiB", note: "每张卡" });
    expect(b).toMatchObject({ result: "432 MiB", rel: "", note: "int8" });
    expect(c).toMatchObject({
      label: "42 层",
      steps: [],
      result: "17.72 GiB",
      note: "占主干 45 层权重的 88%",
    });
    expect(d).toMatchObject({ result: "151.25 MiB", note: "BF16：16 位浮点，每个数 2 字节" });
  });

  it("等号两边没有空白不拆；多于一步的中间步骤按顺序保留", () => {
    const [row] = parseCalc("折合每 token = 8,355,840 B ÷ 640 = 12 层 × (1024 + 64) B = 13,056 B");
    expect(row).toMatchObject({ steps: ["8,355,840 B ÷ 640", "12 层 × (1024 + 64) B"], result: "13,056 B" });
    expect(parseCalc("r=DP 编号")).toEqual([{ kind: "text", text: "r=DP 编号" }]);
  });

  it("以 = 开头的续行接到上一条，上一条的结果（连同比较和说明）退成中间步骤；空行分组，首尾空行不留", () => {
    const rows = parseCalc("\nMLA 一层一块 = 640 token × 1024 B（每层）\n  = 655,360 B\n\n\n说明文字\n\n");
    expect(rows).toEqual([
      {
        kind: "eq",
        label: "MLA 一层一块",
        steps: ["640 token × 1024 B（每层）"],
        result: "655,360 B",
        resultOp: "=",
        rel: "",
        note: "",
      },
      { kind: "gap" },
      { kind: "text", text: "说明文字" },
    ]);
  });

  it("只有数字结果才加粗：形状、文字结果照常排", () => {
    for (const t of ["655,360 B", "18", "17.72 GiB", "≈ 101 万"]) expect(isNumericResult(t), t).toBe(true);
    for (const t of ["input_ids [4] → [4, 4096]", "TP8 内按元素相加", "[p₀, p₁]"]) {
      expect(isNumericResult(t), t).toBe(false);
    }
  });

  it("结果本身还是算式、后面跟着 ≈ 数：近似数才是结果，算式退成中间步骤", () => {
    const [a, b] = parseCalc("能存 = 3,855 × 640 ≈ 2.47 M token\n每块号 = 8,355,840 B ≈ 7.969 MiB");
    expect(a).toMatchObject({ steps: ["3,855 × 640"], result: "2.47 M token", resultOp: "≈", rel: "" });
    // 结果是一个数时，≈ 只是换算，仍跟在结果后面
    expect(b).toMatchObject({ steps: [], result: "8,355,840 B", resultOp: "=", rel: "≈ 7.969 MiB" });
  });
});

describe("现有 ```text 算式块直接当算式排", () => {
  it("靠空格对齐的等式：去掉对齐空白，拆出比较和说明", () => {
    const rows = textFenceAsCalc(
      "MLA 一层一块    = 640 token × 1024 B（512 维 × 2 B） = 655,360 B\n" +
        "KDA 一层一份状态 = 36,864 B 卷积 + 524,288 B 递推  = 561,152 B   ≤ 655,360 B",
    );
    expect(rows).toEqual([
      {
        kind: "eq",
        label: "MLA 一层一块",
        steps: ["640 token × 1024 B（512 维 × 2 B）"],
        result: "655,360 B",
        resultOp: "=",
        rel: "",
        note: "",
      },
      {
        kind: "eq",
        label: "KDA 一层一份状态",
        steps: ["36,864 B 卷积 + 524,288 B 递推"],
        result: "561,152 B",
        resultOp: "=",
        rel: "≤ 655,360 B",
        note: "",
      },
    ]);
  });

  it("标签后隔一段空白的是第一步；结果后隔一段空白、不以运算符开头的是说明；括号里的空白不算列", () => {
    const [a, b, c, d] =
      textFenceAsCalc(
        "卷积状态   3072 × 6 × 2 B        = 36,864 B     6 = 卷积宽度 4 − 1 + 候选 3\n" +
          "input_ids       = [p₀, p₁, p₂, p₃]        int32 [4]\n" +
          "positions  = [ 6,   7,   8,   9]     位置 6、7 覆盖上一圈写错的两格\n" +
          "token 预算     = 8192        R1 需要 4       → 给 4",
      ) ?? [];
    expect(a).toMatchObject({
      label: "卷积状态",
      steps: ["3072 × 6 × 2 B"],
      result: "36,864 B",
      note: "6 = 卷积宽度 4 − 1 + 候选 3",
    });
    expect(b).toMatchObject({ label: "input_ids", result: "[p₀, p₁, p₂, p₃]", note: "int32 [4]" });
    expect(c).toMatchObject({ result: "[ 6, 7, 8, 9]", note: "位置 6、7 覆盖上一圈写错的两格" });
    expect(d).toMatchObject({ result: "8192", note: "R1 需要 4 → 给 4" });
  });

  it("以 = 开头的缩进续行接上一条；近似结果照样提成结果", () => {
    const rows = textFenceAsCalc(
      "每块字节 = 12 × 655,360（MLA 主 cache）+ 12 × 40,960（索引器压缩 cache）\n" +
        "         = 8,355,840 B = 7.969 MiB\n" +
        "能存                      = 3,855 × 640          ≈ 2.47 M token",
    );
    expect(rows?.[0]).toMatchObject({
      steps: ["12 × 655,360（MLA 主 cache）+ 12 × 40,960（索引器压缩 cache）", "8,355,840 B"],
      result: "7.969 MiB",
    });
    expect(rows?.[1]).toMatchObject({ steps: ["3,855 × 640"], result: "2.47 M token", resultOp: "≈" });
  });

  it("先写数、再把数拆开的：拆开那一步挪到前面，推导停在数上", () => {
    const [row] =
      textFenceAsCalc("折合每 token = 8,355,840 B ÷ 640          = 13,056 B = 12 层 × (1024 + 64) B") ?? [];
    expect(row).toMatchObject({ steps: ["8,355,840 B ÷ 640", "12 层 × (1024 + 64) B"], result: "13,056 B" });
  });

  it("有一行不是「标签 = …」、或是缩进的非续行，整块照旧当代码块", () => {
    expect(
      textFenceAsCalc("每卡每次最多 ceil(128 ÷ 8) = 16 个 token\n判断用的是两台机器里较大的那个"),
    ).toBeNull();
    expect(textFenceAsCalc("gate_up_proj  [4, 4096] × [4096, 3072] → [4, 3072]")).toBeNull();
    expect(textFenceAsCalc("第 1 遍  token 输入 = d₁\n         隐藏输入   = [4, 4096]")).toBeNull();
    expect(textFenceAsCalc("vllm serve GLM --tensor-parallel-size 8")).toBeNull();
  });
});

describe("表达式零件", () => {
  it("前后有空白的运算符、全角括号里的旁注单独成段，其余原样", () => {
    expect(splitExpr("640 token × 1024 B（512 维 × 2 B）")).toEqual([
      { kind: "text", text: "640 token" },
      { kind: "op", text: "×" },
      { kind: "text", text: "1024 B" },
      { kind: "gloss", text: "（512 维 × 2 B）" },
    ]);
    expect(splitExpr("12 × (655,360 + 40,960) B").map((p) => p.kind)).toEqual([
      "text",
      "op",
      "text",
      "op",
      "text",
    ]);
    // 没空白的不算运算符：a×b、2³⁰
    expect(splitExpr("4×4 矩阵")).toEqual([{ kind: "text", text: "4×4 矩阵" }]);
  });
});

describe("```calc 围栏的标题", () => {
  it("第一行 title: 是这组计算的名字；没写就没有标题，也不拿标签拼一个", () => {
    const withTitle = parseCalcFence("title: KV 块的大小是怎么定的\n逻辑块大小 = 128 × 5 = 640 个 token\n");
    expect(withTitle.title).toBe("KV 块的大小是怎么定的");
    expect(withTitle.rows).toHaveLength(1);
    expect(parseCalcFence("\ntitle：全角冒号也行\n块数 = 30 GiB ÷ 8,355,840 B = 3,855 块").title).toBe(
      "全角冒号也行",
    );
    const without = parseCalcFence("每卡专家数 = 288 ÷ 16 = 18");
    expect(without.title).toBe("");
    expect(without.rows[0]).toMatchObject({ label: "每卡专家数", result: "18" });
  });
});

/**
 * docs/wiki-calc-syntax.md 的每一条规则各一个例子。规则编号和文档一致。
 */
describe("```calc 语法规范（docs/wiki-calc-syntax.md）", () => {
  const eq = (source: string, i = 0) => {
    const row = parseCalcFence(source).rows.filter((r) => r.kind === "eq")[i];
    if (row?.kind !== "eq") throw new Error(`第 ${i} 项不是算式：${source}`);
    return row;
  };

  it("规则 1 title：第一行 `title:` 是这组计算的名字，可省", () => {
    expect(parseCalcFence("title: KV 块的大小\n块数 = 30 GiB ÷ 8,355,840 B = 3,855 块").title).toBe(
      "KV 块的大小",
    );
    expect(parseCalcFence("块数 = 30 GiB ÷ 8,355,840 B = 3,855 块").title).toBe("");
  });

  it("规则 2 一项一行：标签 = 算式 = … = 结果；等号两边要有空白", () => {
    expect(eq("折合每 token = 8,355,840 B ÷ 640 = 13,056 B")).toMatchObject({
      label: "折合每 token",
      steps: ["8,355,840 B ÷ 640"],
      result: "13,056 B",
    });
    expect(parseCalcFence("r=DP 编号").rows).toEqual([{ kind: "text", text: "r=DP 编号" }]);
  });

  it("规则 3 标签可以带括号", () => {
    expect(eq("KDA 每层每请求的状态（TP=8 之后） = 561,152 B")).toMatchObject({
      label: "KDA 每层每请求的状态（TP=8 之后）",
      steps: [],
      result: "561,152 B",
    });
    expect(eq("MLA 每 token 每层 (BF16) = 512 × 2 B = 1,024 B")).toMatchObject({
      label: "MLA 每 token 每层 (BF16)",
    });
  });

  it("规则 4 算式里可以有函数调用和嵌套括号，括号里的 = 不当分隔", () => {
    expect(eq("kernel 块数 = ceil(561,152 / (128 × 1024)) = 5")).toMatchObject({
      steps: ["ceil(561,152 / (128 × 1024))"],
      result: "5",
    });
    expect(eq("每卡上限 = min(128, max(a = 4, 8)) = 128")).toMatchObject({
      steps: ["min(128, max(a = 4, 8))"],
      result: "128",
    });
  });

  it("规则 5 近似结果：最后一段是 `算式 ≈ 数`，近似数进结果栏", () => {
    expect(eq("能存 = 3,855 × 640 ≈ 2.47 M token")).toMatchObject({
      steps: ["3,855 × 640"],
      result: "2.47 M token",
      resultOp: "≈",
    });
  });

  it("规则 6 结果后的比较（≤ ≥ ≈ < >）跟在结果下面", () => {
    expect(eq("KDA 一层一份状态 = 36,864 B + 524,288 B = 561,152 B ≤ 655,360 B")).toMatchObject({
      result: "561,152 B",
      rel: "≤ 655,360 B",
    });
  });

  it("规则 7 结果后的说明：（…）或 ，… 进行下的旁注", () => {
    expect(eq("每卡每层权重 = 18 × 6144 × 4096 × 1 B = 432 MiB（int8）")).toMatchObject({
      result: "432 MiB",
      note: "int8",
    });
    expect(eq("42 层 = 17.72 GiB，占主干 45 层权重的 88%")).toMatchObject({
      result: "17.72 GiB",
      note: "占主干 45 层权重的 88%",
    });
  });

  it("规则 8 结果只认「数 + 最多两个单位词」，后面跟着的一段话进旁注", () => {
    expect(eq("减激活峰值与非 torch 占用 = 33.40 GiB − 3.4 GiB = 30.00 GiB 可用于 KV")).toMatchObject({
      result: "30.00 GiB",
      note: "可用于 KV",
    });
    expect(eq("逻辑块大小 = 128 × 5 = 640 个 token")).toMatchObject({ result: "640 个 token", note: "" });
    expect(eq("能存 = 3,855 × 640 ≈ 2.47 M token")).toMatchObject({ result: "2.47 M token", note: "" });
  });

  it("规则 9 旁注行：`> ` 开头的一行挂到上一项下面", () => {
    const row = eq("折合每 token = 8,355,840 ÷ 640 = 13,056 B\n> 其中 MTP 层占 1,088 B");
    expect(row).toMatchObject({ result: "13,056 B", note: "其中 MTP 层占 1,088 B" });
    // 结果后已有说明时，两段用「，」接起来
    expect(eq("每块号 = 12 × 696,320 B = 8,355,840 B（每张卡）\n> 折合 7.969 MiB")).toMatchObject({
      note: "每张卡，折合 7.969 MiB",
    });
  });

  it("规则 10 续行：`= ` 开头的一行接在上一项后面", () => {
    expect(eq("每块字节 = 12 × (655,360 + 40,960)\n  = 8,355,840 B")).toMatchObject({
      steps: ["12 × (655,360 + 40,960)"],
      result: "8,355,840 B",
    });
  });

  it("规则 11 没有等号的一行是整行说明；空行分组", () => {
    expect(parseCalcFence("单卡 = 64 GiB\n\n下面按 TP8 算").rows).toEqual([
      expect.objectContaining({ kind: "eq", label: "单卡" }),
      { kind: "gap" },
      { kind: "text", text: "下面按 TP8 算" },
    ]);
  });

  it("规则 12 转义：反斜杠加任意一个字符按字面显示，不当语法（\\= \\（ \\， \\： \\> \\\\）", () => {
    expect(eq("条件 = a \\= b 时取 1 = 1")).toMatchObject({ steps: ["a = b 时取 1"], result: "1" });
    expect(eq("总数 = 2 × 3 = 6 \\（示例）")).toMatchObject({ result: "6 （示例）", note: "" });
    expect(eq("比例 = 1 \\， 2 = 3")).toMatchObject({ steps: ["1 ， 2"] });
    expect(eq("注意\\：这是标签 = 4")).toMatchObject({ label: "注意：这是标签", steps: [] });
    expect(parseCalcFence("\\> 不是旁注").rows).toEqual([{ kind: "text", text: "> 不是旁注" }]);
    expect(eq("路径 = a\\\\b = 1")).toMatchObject({ steps: ["a\\b"] });
  });

  it("规则 13 旧写法「标签：算式 = …」：冒号后面是第一步，标签末尾的冒号去掉", () => {
    expect(eq("D₁ 各约 20,000 个位置：ceil(20003 / 640) + 14 = 32 + 14 = 46 块")).toMatchObject({
      label: "D₁ 各约 20,000 个位置",
      steps: ["ceil(20003 / 640) + 14", "32 + 14"],
      result: "46 块",
    });
    expect(eq("剩下： = 3,855 − 552 − 24 = 3,279 块")).toMatchObject({ label: "剩下" });
    // 冒号后面不是算式（没有前后带空格的运算符）：冒号是标签自己的，整段照旧当标签
    expect(eq("不开 KVPP：每卡每块 = L × b")).toMatchObject({ label: "不开 KVPP：每卡每块", steps: [] });
  });

  it("规则 14 运算符：前后有空格的 × ÷ + − 才是运算符；ASCII 的 * / - 前后有空格也认", () => {
    expect(splitExpr("8192 - 48").map((p) => p.kind)).toEqual(["text", "op", "text"]);
    expect(splitExpr("20003 / 640").map((p) => p.kind)).toEqual(["text", "op", "text"]);
    // 算式后面跟 ≈ 数：ASCII 减号的算式也退成中间步骤
    expect(eq("剩下 = 8192 - 48 ≈ 8.1 K")).toMatchObject({
      steps: ["8192 - 48"],
      result: "8.1 K",
      resultOp: "≈",
    });
    // 没空格的不算：a-b、2/3、x*y
    expect(splitExpr("max-model-len 2/3").map((p) => p.kind)).toEqual(["text"]);
  });

  it("规则 15 ≈ ≤ ≥ 和 = 一样能把标签和结果连起来，结果栏前保留原来的符号", () => {
    // GPT-6 Astra 转换时碰到的：只写了约等号，整行被当成了说明
    expect(eq("42 层 ≈ 55.1 MiB")).toMatchObject({
      label: "42 层",
      steps: [],
      result: "55.1 MiB",
      resultOp: "≈",
    });
    expect(eq("每卡每次的 token ≤ 128")).toMatchObject({
      label: "每卡每次的 token",
      result: "128",
      resultOp: "≤",
    });
    expect(eq("预算外的余量 ≥ 9.6 GiB（15%）")).toMatchObject({
      result: "9.6 GiB",
      resultOp: "≥",
      note: "15%",
    });
    // 标签后用 ≈、结果本身还是算式时，照规则 5：近似数进结果栏，算式退成中间步骤
    expect(eq("每条 ≈ 399 ÷ 32 × 640 ≈ 7,980 个位置")).toMatchObject({
      label: "每条",
      steps: ["399 ÷ 32 × 640"],
      result: "7,980 个位置",
      resultOp: "≈",
    });
    // 结果后面还能跟比较：比较照规则 6 排在结果下面
    expect(eq("42 层 ≈ 55.1 MiB ≤ 64 MiB")).toMatchObject({
      result: "55.1 MiB",
      resultOp: "≈",
      rel: "≤ 64 MiB",
    });
    // 续行也可以用 ≈ 开头，等于写在上一行末尾
    expect(eq("每层合计 = 262,400 B + 524,288 B\n  ≈ 0.75 MiB")).toMatchObject({
      steps: ["262,400 B + 524,288 B"],
      result: "0.75 MiB",
      resultOp: "≈",
    });
    // 已有的规则不变：结果是一个数时，后面的 ≈ 数 仍是换算（规则 6）
    expect(eq("每块号 = 12 × 696,320 B = 8,355,840 B ≈ 7.969 MiB")).toMatchObject({
      result: "8,355,840 B",
      resultOp: "=",
      rel: "≈ 7.969 MiB",
    });
    // < > 不当连接符：「提示词 > 8192 − 48 就要切」仍是整行说明
    expect(parseCalcFence("提示词 > 8192 − 48 就要切").rows).toEqual([
      { kind: "text", text: "提示词 > 8192 − 48 就要切" },
    ]);
  });
});

describe("现有 ```text 算式块：P3 验收发现的两块", () => {
  it("并发请求「KV 块」：冒号后的算式、以运算符开头的对齐列不丢不乱", () => {
    const rows = textFenceAsCalc(
      [
        "D₁…D₁₂ 各约 20,000 个位置：ceil(20003 / 640) + 14 = 32 + 14 = 46 块      12 条共 552 块",
        "N 的第 2 步：                ceil(6003 / 640)  + 14 = 10 + 14 = 24 块",
        "剩下：                       3,855 − 552 − 24 = 3,279 块",
      ].join("\n"),
    );
    expect(rows).toEqual([
      expect.objectContaining({
        label: "D₁…D₁₂ 各约 20,000 个位置",
        steps: ["ceil(20003 / 640) + 14", "32 + 14"],
        result: "46 块",
        note: "12 条共 552 块",
      }),
      expect.objectContaining({
        label: "N 的第 2 步",
        steps: ["ceil(6003 / 640) + 14", "10 + 14"],
        result: "24 块",
      }),
      expect.objectContaining({ label: "剩下", steps: ["3,855 − 552 − 24"], result: "3,279 块" }),
    ]);
  });

  it("官方双机部署「代进一组数字」：结果后面的「可用于 KV」进旁注", () => {
    const rows = textFenceAsCalc(
      [
        "预算                      = 64 GiB × 0.85       = 54.40 GiB",
        "减激活峰值与非 torch 占用   − 3.4 GiB             = 30.00 GiB 可用于 KV",
      ].join("\n"),
    );
    expect(rows?.[1]).toMatchObject({
      label: "减激活峰值与非 torch 占用",
      result: "30.00 GiB",
      note: "可用于 KV",
    });
  });
});
