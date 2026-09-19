import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CITABLE_DOMAINS, classifySource, handbookDomains, supportsOfficialEvidence } from "./sources";

describe("classifySource", () => {
  it("repo@commit:path 形式是仓库来源", () => {
    expect(classifySource("vllm-ascend@28bf3a2e:vllm_ascend/a.py#L1-L2")).toBe("repo");
  });

  it("一级官方：项目 README 自己列的那些", () => {
    for (const u of [
      "https://docs.vllm.ai/projects/ascend/en/v0.23.0/installation.html",
      "https://www.hiascend.com/document/detail/zh/CANNCommunityEdition/910/x.html",
      "https://blog.vllm.ai/2025/05/12/hardware-plugin.html",
    ]) {
      expect(classifySource(u), u).toBe("official");
    }
  });

  it("community posts in official spaces do not acquire S merely through their domain", () => {
    for (const url of [
      "https://github.com/vllm-project/vllm-ascend/pull/11953",
      "https://github.com/vllm-project/vllm-ascend/issues/1#issuecomment-2",
      "https://discuss.vllm.ai/t/topic/1",
    ]) {
      expect(classifySource(url)).toBe("community");
      expect(supportsOfficialEvidence(classifySource(url))).toBe(false);
    }
  });

  it("昇腾在 gitee / gitcode 上的一手仓库也算官方，不是镜像", () => {
    // 源码里引了 33 次 gitee.com/ascend/*（ATB 算子库）与 43 次 gitcode 的
    // Ascend / cann 组织仓库（msmodelslim、ops-transformer），都是一手
    expect(classifySource("https://gitee.com/ascend/ascend-transformer-boost")).toBe("official");
    expect(classifySource("https://gitcode.com/Ascend/msmodelslim")).toBe("official");
    expect(classifySource("https://gitcode.com/cann/ops-transformer")).toBe("official");
  });

  it("同一站点的其它组织不算官方", () => {
    expect(classifySource("https://gitee.com/someone/fork")).toBe("unlisted");
    expect(classifySource("https://github.com/randomuser/whatever")).toBe("unlisted");
  });

  it("论文单独一档", () => {
    expect(classifySource("https://arxiv.org/abs/2309.06180")).toBe("paper");
  });

  it("生态一手：能引，但撑不起 S", () => {
    for (const u of [
      "https://pytorch.org/docs/stable/x.html",
      "https://triton-lang.org/main/x.html",
      "https://huggingface.co/Qwen/Qwen3-0.6B",
      "https://modelscope.cn/models/Qwen/Qwen3-0.6B",
    ]) {
      expect(classifySource(u), u).toBe("ecosystem");
    }
  });

  it("镜像站不可引——内容是别处的副本，要引就引原站", () => {
    for (const u of [
      "https://hf-mirror.com/Qwen/Qwen3-0.6B",
      "https://mirrors.tuna.tsinghua.edu.cn/x",
      "https://mirrors.huaweicloud.com/x",
    ]) {
      expect(classifySource(u), u).toBe("unlisted");
    }
  });

  it("AI 生成的二手知识库不可引", () => {
    // vllm-ascend 的 README 挂了 DeepWiki 徽章，但那是 AI 生成的，不是一手来源
    expect(classifySource("https://deepwiki.com/vllm-project/vllm-ascend")).toBe("unlisted");
  });

  it("博客平台与问答站不可引", () => {
    expect(classifySource("https://zhuanlan.zhihu.com/p/123")).toBe("unlisted");
    expect(classifySource("https://mp.weixin.qq.com/s/x")).toBe("unlisted");
  });

  it("子域名不能靠后缀蒙混过关", () => {
    expect(classifySource("https://arxiv.org.evil.com/abs/1")).toBe("unlisted");
    expect(classifySource("https://notdocs.vllm.ai/x")).toBe("unlisted");
  });
});

describe("HANDBOOK 与代码的白名单必须一致", () => {
  it("解析 HANDBOOK 的域名表，逐条与代码常量相等", () => {
    // 白名单要被两方看到：agent 靠 HANDBOOK（会注入 prompt）知道能引什么，
    // lint 靠代码常量执行。两份手工同步迟早漂移，所以用这个测试锁住。
    const md = readFileSync(join(process.cwd(), "wiki/HANDBOOK.md"), "utf8");
    expect(handbookDomains(md)).toEqual(CITABLE_DOMAINS);
  });
});
