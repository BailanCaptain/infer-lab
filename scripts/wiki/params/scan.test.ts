import { expect, it } from "vitest";
import { scanSources } from "./scan";

it("keeps equally named nested config classes in different modules separate", () => {
  const rows = scanSources({
    "a.py": "class ChildConfig:\n    limit: int = 1\nclass RootConfig:\n    child_a: ChildConfig = None\n",
    "b.py": "class ChildConfig:\n    limit: int = 2\nclass RootConfig:\n    child_b: ChildConfig = None\n",
  }).filter((p) => p.name === "limit");
  expect(rows.map((p) => [p.file, p.json_path])).toEqual([
    ["a.py", 'additional_config["child_a"]["limit"]'],
    ["b.py", 'additional_config["child_b"]["limit"]'],
  ]);
});

it("does not collect unrelated runtime dataclasses as configuration fields", () => {
  const rows = scanSources({
    "state.py":
      "@dataclass\nclass RunningState:\n    tokens: int = 1\n@dataclass\nclass EngineConfig:\n    batch_size: int = 4\n",
  });
  expect(rows.map((p) => p.name)).toEqual(["batch_size"]);
});

it("parses four parameter forms without executing source and preserves conditional constraints", () => {
  const files = {
    "config.py": `raise RuntimeError("MUST NOT EXECUTE")
@config
class ChildConfig:
    # Whether to enable balancing.
    enabled: bool = False
    policy: int = 0
    def validate(self):
        if self.enabled and self.policy not in [0, 1]:
            raise ValueError("policy must in [0, 1]")
        if self.policy == 1:
            self.enabled = True
@config
class RootConfig:
    child: ChildConfig = Field(default_factory=ChildConfig)
    # dspark accepts initial_verify_budget and budget_threshold
    method_params: dict[str, int] = {}
`,
    "utils.py": `count = config.method_params.get("min_verify_tokens", 1)\n`,
  };
  const rows = scanSources(files);
  expect(rows.find((p) => p.name === "enabled")).toMatchObject({
    class: "ChildConfig",
    default: "False",
    confidence: "certain",
    json_path: 'additional_config["child"]["enabled"]',
  });
  expect(rows.find((p) => p.name === "enabled")!.constraints.join("\n")).toContain("if self.policy == 1");
  expect(rows.find((p) => p.name === "policy")!.constraints.join("\n")).toContain("policy must in [0, 1]");
  expect(rows.find((p) => p.name === "budget_threshold")).toMatchObject({
    form: "dict-key",
    confidence: "suspect",
    json_path: 'additional_config["method_params"]["budget_threshold"]',
  });
  expect(rows.find((p) => p.name === "min_verify_tokens")).toMatchObject({
    form: "string-lookup",
    confidence: "suspect",
    file: "utils.py",
    line: 1,
  });
  expect(rows.find((p) => p.name === "enabled")!.comment).toContain("Whether");
});

it("does not merge same-named fields from different classes or present syntax errors as empty results", () => {
  const rows = scanSources({
    "config.py": "class AConfig:\n    size: int = 1\nclass BConfig:\n    size: int = 2\n",
  });
  expect(rows.filter((p) => p.name === "size").map((p) => p.default)).toEqual(["1", "2"]);
  expect(() => scanSources({ "broken.py": "class ???" })).toThrow(/broken.py/);
});

it("captures lookup fallback expressions and Ascend wrapper keys without executing them", () => {
  const rows = scanSources({
    "config.py": `raise RuntimeError("must not execute")
a = additional_config.get("layer_sharding", 2)
b = self._get_config_value(additional_config, "enable_matmul_allreduce", "ENV_FLAG", envs.FLAG)
`,
  });
  expect(rows.find((p) => p.name === "layer_sharding")).toMatchObject({
    default: "2",
    confidence: "suspect",
  });
  expect(rows.find((p) => p.name === "enable_matmul_allreduce")).toMatchObject({
    default: "envs.FLAG",
    json_path: 'additional_config["enable_matmul_allreduce"]',
    confidence: "suspect",
  });
});

it("parses upstream starred type subscriptions without executing the inspected module", () => {
  const rows = scanSources({
    "patch_speculative_config.py":
      'raise RuntimeError("must not execute")\nTypes = Literal[*get_args(Types), "glm5_next_mtp"]\nclass ExampleConfig:\n    enabled: bool = False\n',
  });
  expect(rows.find((p) => p.name === "enabled")).toMatchObject({ default: "False", line: 4 });
});

it("只有从 AscendConfig 够得着的配置类才算确定的参数：名字碰巧以 Config 结尾的内部数据类不算", () => {
  // 2026-09-21 实遇：`WeightSwitchConfig`（内部 dataclass：group / world_size / rank / shard_axis）和 xlite 里的
  // 一个 TypedDict 被当成 `additional_config` 的键，夜间任务据此生成了 5 个正式参数页。
  const rows = scanSources({
    "vllm_ascend/ascend_config.py": `class KVPPConfig:
    size: int = 0
class AscendConfig:
    def __init__(self, additional_config):
        self.kvpp_config = KVPPConfig()
        self.eplb_config = EplbConfig(additional_config.get("eplb_config", {}))
`,
    "vllm_ascend/eplb/config.py": `class EplbConfig:
    dynamic_eplb: bool = False
`,
    "vllm_ascend/weight_switch/linear.py": `@dataclass(frozen=True)
class WeightSwitchConfig:
    group: Any
    rank: int
`,
  }).filter((p) => p.form === "field");
  expect(Object.fromEntries(rows.map((p) => [p.name, p.confidence]))).toEqual({
    size: "certain", // 定义在根配置所在的文件里
    dynamic_eplb: "certain", // 定义在别处，但根配置所在的文件点名用了它
    group: "suspect",
    rank: "suspect",
  });
});
