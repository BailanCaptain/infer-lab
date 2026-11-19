/** Common choices, not an account entitlement list; custom model IDs are supported too. */
export const CHAT_PROVIDERS = [
  "claude",
  "codex",
  "openai-compatible",
  "anthropic-compatible",
  "harness",
] as const;
export type ChatProvider = (typeof CHAT_PROVIDERS)[number];

export const DEFAULT_CODEX_MODEL = "gpt-6.1-sol";
export const DEFAULT_OPENAI_COMPAT_MODEL = "deepseek-chat";
export const DEFAULT_ANTHROPIC_COMPAT_MODEL = "deepseek-chat";
export const DEFAULT_HARNESS_MODEL = "custom-harness";

export const CHAT_MODELS: Record<ChatProvider, string[]> = {
  codex: [DEFAULT_CODEX_MODEL, "gpt-6-astra", "gpt-6-sol", "gpt-6-luna", "gpt-5.5"],
  claude: ["claude-opus-5-5", "claude-opus-5", "sonnet", "haiku", "deepseek-chat"],
  "openai-compatible": [
    DEFAULT_OPENAI_COMPAT_MODEL,
    "deepseek-reasoner",
    "qwen3-235b-a22b",
    "qwen2.5-coder-32b-instruct",
    "glm-4.7",
  ],
  "anthropic-compatible": [DEFAULT_ANTHROPIC_COMPAT_MODEL, "deepseek-reasoner", "claude-sonnet-4-5"],
  harness: [DEFAULT_HARNESS_MODEL, "deepseek-chat", "qwen3-coder"],
};

export const CHAT_PROVIDER_LABELS: Record<ChatProvider, string> = {
  codex: "Codex（GPT）",
  claude: "Claude Code（含 CCR / DeepSeek）",
  "openai-compatible": "OpenAI 兼容 API（DeepSeek / Qwen / vLLM / Ollama）",
  "anthropic-compatible": "Anthropic 兼容 API（CCR / DeepSeek /anthropic）",
  harness: "自定义 Harness 命令（stdin → stdout）",
};

export function defaultModelForProvider(provider: ChatProvider, claudeFallback: string): string {
  switch (provider) {
    case "codex":
      return DEFAULT_CODEX_MODEL;
    case "openai-compatible":
      return DEFAULT_OPENAI_COMPAT_MODEL;
    case "anthropic-compatible":
      return DEFAULT_ANTHROPIC_COMPAT_MODEL;
    case "harness":
      return DEFAULT_HARNESS_MODEL;
    case "claude":
      return claudeFallback;
  }
}
