import { expect, it } from "vitest";
import { scanSources } from "./scan";
import { withoutLocations } from "./sync";

it("follows a nested user dictionary passed to an old-style config constructor", () => {
  const rows = scanSources({
    "ascend_config.py": `class WeightPrefetchConfig:
    prefetch_ratio: dict = {}
class AscendConfig:
    def __init__(self, vllm_config):
        additional_config = vllm_config.additional_config or {}
        weight_prefetch_config = additional_config.get("weight_prefetch_config", {})
        self.weight_prefetch_config = WeightPrefetchConfig(weight_prefetch_config)
`,
  });
  expect(rows.find((p) => p.name === "prefetch_ratio")?.json_path).toBe(
    'additional_config["weight_prefetch_config"]["prefetch_ratio"]',
  );
});

it("does not classify ClassVar constants as configurable dataclass fields", () => {
  const rows = scanSources({
    "config.py":
      'class DynamicSpecConfig:\n    SUPPORTED_METHODS: ClassVar[tuple[str, ...]] = ("dspark",)\n    OPTIONS: typing.ClassVar[int] = 2\n    method: str = "dspark"\n',
  });
  expect(rows.map((row) => row.name)).toEqual(["method"]);
});

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
  // 够不着的类也不再谎称自己挂在 additional_config 下：路径以类名起头
  expect(rows.find((p) => p.name === "rank")?.json_path).toBe('WeightSwitchConfig["rank"]');
  expect(rows.find((p) => p.name === "size")?.json_path).toBe('additional_config["size"]');
});

const MAIN_STYLE_ROOT = `@config
class AscendConfig:
    enable_kvpp: bool = False
    sparse_kv_offload_config: Any = dataclasses.field(kw_only=True)
    kvpp_config: KVPPConfig = dataclasses.field(default_factory=KVPPConfig, kw_only=True)
    pd_tp_ratio: int = 1

@config
class SparseKVOffloadConfig:
    use_fused_overlap: bool = False

@config
class KVPPConfig:
    size: int = 1
    @classmethod
    def from_vllm_config(cls, vllm_config):
        return cls(size=2 if vllm_config.additional_config.get("enable_kvpp") else 1)

def init_ascend_config(vllm_config):
    additional_config = vllm_config.additional_config
    sparse_kv = SparseKVOffloadConfig.from_additional_config(
        vllm_config, additional_config.get("sparse_kv_offload_config", {})
    )
    kvpp_config = KVPPConfig.from_vllm_config(vllm_config)
    dump_config_path = AscendConfig._resolve_dump_config_path(additional_config)
    _NON_USER_INPUT_KEYS = {
        "sparse_kv_offload_config",
        "enable_kvpp",
        "kvpp_config",
        "pd_tp_ratio",
    }
    kwargs = {k: v for k, v in additional_config.items() if k not in _NON_USER_INPUT_KEYS}
    return AscendConfig(
        sparse_kv_offload_config=sparse_kv, kvpp_config=kvpp_config, dump_config_path=dump_config_path, **kwargs
    )
`;

it("字段注解写成 Any、靠工厂函数把子配置传进根配置时，子配置的字段仍然挂在那个字段名下面", () => {
  // 2026-09-21 实遇：main 上 sparse_kv_offload_config 的注解是 Any，use_fused_overlap 被推成了顶层键
  const rows = scanSources({ "vllm_ascend/ascend_config.py": MAIN_STYLE_ROOT });
  expect(rows.find((p) => p.name === "use_fused_overlap")?.json_path).toBe(
    'additional_config["sparse_kv_offload_config"]["use_fused_overlap"]',
  );
  // 根配置自己的类方法算出来的值（dump_config_path）不是子配置：不能把整棵树挂到它下面
  expect(rows.filter((p) => p.json_path.includes('"dump_config_path"]['))).toEqual([]);
  // 注解已经点名的那条路不受影响，也不会重复出两行
  expect(rows.filter((p) => p.name === "size").map((p) => p.json_path)).toEqual([
    'additional_config["kvpp_config"]["size"]',
  ]);
});

it("普通函数转发的 **kwargs 不是配置：不当疑似参数；配置类自己的 **kwargs 仍是用户键", () => {
  // 2026-09-22 实遇：`kwargs["vllm_config"]` 在 main 上出现 2396 次，一晚的队列多出 3.5 万行，
  // 三个基线里约三分之一的条目都是这类函数传参。但 v0.23 / v0.26 的编译配置类在自己的
  // __init__ 里写 `kwargs.get("fuse_muls_add", True)`，那是真的用户键（main 上已改成正式字段）。
  const rows = scanSources({
    "vllm_ascend/worker.py": `def forward(**kwargs):
    a = kwargs["vllm_config"]
    b = kwargs.get("prefix")
    c = attn_metadata_extra_kwargs["num_actual_reqs"]
    d = self.additional_config.get("real_key", 1)
    e = method_params["min_verify_tokens"]
`,
    "vllm_ascend/ascend_config.py": `class AscendCompilationConfig:
    def __init__(self, fuse_norm_quant: bool = True, **kwargs):
        self.fuse_muls_add = kwargs.get("fuse_muls_add", True)
`,
  }).filter((p) => p.form === "string-lookup");
  expect(rows.map((p) => [p.name, p.json_path])).toEqual([
    ["fuse_muls_add", 'kwargs["fuse_muls_add"]'],
    ["real_key", 'self.additional_config["real_key"]'],
    ["min_verify_tokens", 'method_params["min_verify_tokens"]'],
  ]);
});

it("同一个取值写法在一个文件里出现多次只算一条（取最靠前的一行）：夜间比对不会因取到不同的那一行而报假变更", () => {
  // 2026-09-22 实遇：v0.26 基线里 53 个身份键各有多行（`self.config["dynamic_eplb"]` 在 915 / 927 / 935 行），
  // 比对按身份键建表、同键只留最后一条，行号一挪就取到另一行，日志里 do_remote_prefill 的默认值来回翻了 14 次。
  const rows = scanSources({
    "vllm_ascend/ascend_config.py": `class AscendConfig:
    def __init__(self, config):
        if config["dynamic_eplb"]:
            config["dynamic_eplb"] = True
        x = config.get("dynamic_eplb")
`,
  }).filter((p) => p.name === "dynamic_eplb");
  expect(rows.map((p) => [p.json_path, p.line, p.default])).toEqual([
    ['config["dynamic_eplb"]', 3, "<unknown>"],
  ]);
});

it("出现位置只留前 5 处、另记总数：一个名字全库出现几千次时，队列与基线不再被位置清单撑大", () => {
  const text = `class EngineConfig:\n    batch_size: int = 4\n${Array.from({ length: 8 }, (_, i) => `x${i} = batch_size\n`).join("")}`;
  const row = scanSources({ "config.py": text }).find((p) => p.name === "batch_size");
  expect(row?.occurrences).toEqual([
    { file: "config.py", line: 2 },
    { file: "config.py", line: 3 },
    { file: "config.py", line: 4 },
    { file: "config.py", line: 5 },
    { file: "config.py", line: 6 },
  ]);
  expect(row?.occurrenceCount).toBe(9); // 定义那一行 + 8 次引用
  // 旧记录（位置全量、没有总数）与新扫描比对时仍是同一条：复核 / 生成页前的「与源码一致」检查不能因此失败
  const legacy = {
    ...row!,
    occurrences: Array.from({ length: 9 }, (_, i) => ({ file: "config.py", line: i + 2 })),
  };
  delete (legacy as { occurrenceCount?: number }).occurrenceCount;
  expect(JSON.stringify(withoutLocations(legacy))).toBe(JSON.stringify(withoutLocations(row!)));
});

it("被工厂从用户输入里剔掉、又没有任何一处从用户输入读它的键，不算用户参数；它下面的字段跟着不算", () => {
  const rows = scanSources({ "vllm_ascend/ascend_config.py": MAIN_STYLE_ROOT }).filter(
    (p) => p.form === "field",
  );
  const confidence = Object.fromEntries(rows.map((p) => [p.json_path, p.confidence]));
  expect(confidence).toMatchObject({
    // 在剔除名单里，但工厂自己从 additional_config 读它：仍是用户键
    'additional_config["enable_kvpp"]': "certain",
    'additional_config["sparse_kv_offload_config"]': "certain",
    'additional_config["sparse_kv_offload_config"]["use_fused_overlap"]': "certain",
    // 在剔除名单里，且没有任何一处读它：工厂注入 / 纯派生
    'additional_config["kvpp_config"]': "suspect",
    'additional_config["kvpp_config"]["size"]': "suspect",
    'additional_config["pd_tp_ratio"]': "suspect",
  });
});

it("recognizes **kwargs-unpacked __init__ constructor fields without treating container dicts as fields", () => {
  const rows = scanSources({
    "vllm_ascend/ascend_config.py": `class AscendConfig:
    def __init__(self, vllm_config: "VllmConfig"):
        self.vllm_config = vllm_config
        additional_config = vllm_config.additional_config or {}
        ascend_compilation_config = additional_config.get("ascend_compilation_config", {})
        self.ascend_compilation_config = AscendCompilationConfig(**ascend_compilation_config)
        self.profiling_chunk_config = ProfilingChunkConfig(additional_config.get("profiling_chunk_config"))

class ProfilingChunkConfig:
    def __init__(self, config: dict | None = None):
        self.enabled = bool((config or {}).get("enabled", False))

class AscendCompilationConfig:
    def __init__(
        self,
        enable_npugraph_ex: bool = True,
        enable_static_kernel: bool = False,
        enable_super_kernel: bool | None = None,
        **kwargs,
    ):
        if enable_super_kernel is None:
            enable_super_kernel = enable_static_kernel
        self.enable_npugraph_ex = enable_npugraph_ex
        self.enable_static_kernel = enable_static_kernel
        self.enable_super_kernel = enable_super_kernel
        self.fuse_muls_add = kwargs.get("fuse_muls_add", True)
`,
  });
  const fields = rows.filter((p) => p.form === "field");
  expect(fields.map((p) => [p.class, p.name, p.type, p.default, p.json_path, p.confidence])).toEqual([
    [
      "AscendCompilationConfig",
      "enable_npugraph_ex",
      "bool",
      "True",
      'additional_config["ascend_compilation_config"]["enable_npugraph_ex"]',
      "certain",
    ],
    [
      "AscendCompilationConfig",
      "enable_static_kernel",
      "bool",
      "False",
      'additional_config["ascend_compilation_config"]["enable_static_kernel"]',
      "certain",
    ],
    [
      "AscendCompilationConfig",
      "enable_super_kernel",
      "bool | None",
      "None",
      'additional_config["ascend_compilation_config"]["enable_super_kernel"]',
      "certain",
    ],
  ]);
  expect(fields.find((p) => p.name === "enable_super_kernel")?.constraints).toEqual([
    "if enable_super_kernel is None:\n    enable_super_kernel = enable_static_kernel",
  ]);
});

it("deduplicates nested if blocks inside validators when the enclosing if already covers the field", () => {
  const rows = scanSources({
    "vllm_ascend/ascend_config.py": `@config
class AscendCompilationConfig:
    enable_static_kernel: bool = False
    enable_super_kernel: bool = False
    def _default_super_kernel(cls, data):
        if isinstance(data, ArgsKwargs):
            kw = dict(data.kwargs or {})
            if "enable_super_kernel" not in kw and "enable_static_kernel" in kw:
                kw["enable_super_kernel"] = kw["enable_static_kernel"]
            return ArgsKwargs(data.args, kw)
        if isinstance(data, dict):
            if "enable_super_kernel" not in data and "enable_static_kernel" in data:
                data = dict(data)
                data["enable_super_kernel"] = data["enable_static_kernel"]
        return data
`,
  });
  const constraints = rows.find((p) => p.name === "enable_super_kernel")?.constraints ?? [];
  expect(constraints).toHaveLength(2);
  expect(constraints[0]).toMatch(/^if isinstance\(data, ArgsKwargs\):/);
  expect(constraints[1]).toMatch(/^if isinstance\(data, dict\):/);
});

it("aligns __init__ positional defaults accurately across positional-only '/' boundaries", () => {
  const rows = scanSources({
    "vllm_ascend/ascend_config.py": `class AscendConfig:
    def __init__(self, vllm_config: "VllmConfig"):
        additional_config = vllm_config.additional_config or {}
        self.normal = NormalChildConfig(**additional_config.get("normal", {}))
        self.self_posonly = SelfPosOnlyChildConfig(**additional_config.get("self_posonly", {}))
        self.first_posonly = FirstPosOnlyChildConfig(**additional_config.get("first_posonly", {}))

class NormalChildConfig:
    def __init__(self, first: bool = True, second: int = 7, **kwargs):
        self.first = first
        self.second = second

class SelfPosOnlyChildConfig:
    def __init__(self, /, first: bool = True, second: int = 7, **kwargs):
        self.first = first
        self.second = second

class FirstPosOnlyChildConfig:
    def __init__(self, first: bool = True, /, second: int = 7, **kwargs):
        self.first = first
        self.second = second
`,
  });
  const fields = rows
    .filter((p) => p.form === "field")
    .map((p) => [p.class, p.name, p.type, p.default, p.json_path]);
  expect(fields).toEqual([
    ["NormalChildConfig", "first", "bool", "True", 'additional_config["normal"]["first"]'],
    ["NormalChildConfig", "second", "int", "7", 'additional_config["normal"]["second"]'],
    ["SelfPosOnlyChildConfig", "first", "bool", "True", 'additional_config["self_posonly"]["first"]'],
    ["SelfPosOnlyChildConfig", "second", "int", "7", 'additional_config["self_posonly"]["second"]'],
    ["FirstPosOnlyChildConfig", "first", "bool", "True", 'additional_config["first_posonly"]["first"]'],
    ["FirstPosOnlyChildConfig", "second", "int", "7", 'additional_config["first_posonly"]["second"]'],
  ]);
});
