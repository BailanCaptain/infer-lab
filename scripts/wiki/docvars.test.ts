import { describe, expect, it } from "vitest";
import { expandPlaceholders, findPlaceholders, keepUsed, parseDocVars } from "./docvars";

/**
 * 上游文档里的 `{{ 变量 }}` 只有渲染后才有值，而且两个版本用的构建系统不同：
 * main 是 MkDocs（mkdocs.yml 的 extra:），v0.23.0 还是 Sphinx（conf.py 的
 * myst_substitutions）。两处都在本地仓库里，所以能离线解，不必让 agent 上网
 * ——提取 agent 的黑名单里本来就有 WebFetch。
 */

const MKDOCS = `
site_name: vLLM Ascend
extra:
  is_release: !ENV [DOCS_IS_RELEASE, false]
  rtd_version: !ENV [READTHEDOCS_VERSION, latest]
  vllm_version: v0.23.0
  vllm_ascend_version: v0.23.0
  pip_vllm_ascend_version: 0.23.0
  cann_image_tag: 9.1.0-910b-ubuntu22.04-py3.12
  main_python_version: ">= 3.10, < 3.13"
theme:
  name: material
`;

const CONF_PY = `
extensions = ["myst_parser"]
myst_substitutions = {
    "vllm_version": "v0.23.0",
    "vllm_ascend_version": "v0.23.0",
    "pip_vllm_ascend_version": "0.23.0",
    # CANN image tag paired with the vllm_ascend_version above
    "cann_image_tag": "8.2.rc1-910b-ubuntu22.04-py3.11",
}
html_theme = "sphinx_book_theme"
`;

describe("parseDocVars · MkDocs", () => {
  it("读出 extra: 块里的变量", () => {
    const vars = parseDocVars({ mkdocsYml: MKDOCS });
    expect(vars.vllm_ascend_version).toBe("v0.23.0");
    expect(vars.pip_vllm_ascend_version).toBe("0.23.0");
    expect(vars.cann_image_tag).toBe("9.1.0-910b-ubuntu22.04-py3.12");
  });

  it("带引号的值去掉引号", () => {
    expect(parseDocVars({ mkdocsYml: MKDOCS }).main_python_version).toBe(">= 3.10, < 3.13");
  });

  it("`!ENV` 的构建期变量不当成常量——它在本地没有确定值", () => {
    const vars = parseDocVars({ mkdocsYml: MKDOCS });
    expect(vars.rtd_version).toBeUndefined();
    expect(vars.is_release).toBeUndefined();
  });

  it("extra: 之后的其它顶层键不会被误读进来", () => {
    expect(parseDocVars({ mkdocsYml: MKDOCS }).name).toBeUndefined();
  });
});

describe("parseDocVars · Sphinx", () => {
  it("读出 myst_substitutions 里的变量", () => {
    const vars = parseDocVars({ confPy: CONF_PY });
    expect(vars.vllm_ascend_version).toBe("v0.23.0");
    expect(vars.cann_image_tag).toBe("8.2.rc1-910b-ubuntu22.04-py3.11");
  });

  it("注释行不被当成变量", () => {
    expect(Object.keys(parseDocVars({ confPy: CONF_PY }))).not.toContain("CANN");
  });

  it("myst_substitutions 之后的赋值不会被误读", () => {
    expect(parseDocVars({ confPy: CONF_PY }).html_theme).toBeUndefined();
  });
});

describe("parseDocVars · 两种都没有", () => {
  it("返回空表而不是抛错", () => {
    expect(parseDocVars({})).toEqual({});
  });
});

describe("findPlaceholders", () => {
  it("找出正文里的占位符，去重", () => {
    const found = findPlaceholders("装 {{ vllm_version }} 再装 {{vllm_version}} 和 {{ cann_image_tag }}");
    expect(found.sort()).toEqual(["cann_image_tag", "vllm_version"]);
  });

  it("没有占位符时返回空", () => {
    expect(findPlaceholders("pip install vllm-ascend==0.23.0")).toEqual([]);
  });
});

describe("expandPlaceholders", () => {
  const vars = { vllm_ascend_version: "v0.23.0", pip_vllm_ascend_version: "0.23.0" };

  it("展开已知变量，空格写法与紧凑写法都认", () => {
    expect(expandPlaceholders("pip install vllm-ascend=={{ pip_vllm_ascend_version }}", vars)).toBe(
      "pip install vllm-ascend==0.23.0",
    );
    expect(expandPlaceholders("v={{vllm_ascend_version}}", vars)).toBe("v=v0.23.0");
  });

  it("未知变量原样留着，不猜也不删——留着才能被 lint 抓到", () => {
    expect(expandPlaceholders("{{ unknown_var }}", vars)).toBe("{{ unknown_var }}");
  });
});

describe("keepUsed", () => {
  const vars = { vllm_version: "v0.23.0", generator: "false", cann_image_tag: "9.1.0" };

  it("只留文档里真正用到的变量", () => {
    // `extra:` 块里不全是替换变量——MkDocs Material 的 generator 是页脚开关，
    // 照单全收会把它当版本变量塞进 prompt（2026-09-11 dry-run 实见）
    const kept = keepUsed(vars, ["装 {{ vllm_version }}", "镜像 {{ cann_image_tag }}"]);
    expect(Object.keys(kept).sort()).toEqual(["cann_image_tag", "vllm_version"]);
    expect(kept.generator).toBeUndefined();
  });

  it("文档里用到但表里没有的，不会凭空造出来", () => {
    expect(keepUsed(vars, ["{{ nope }}"])).toEqual({});
  });

  it("没有文档可扫时返回空表，而不是原样全给", () => {
    expect(keepUsed(vars, [])).toEqual({});
  });
});
