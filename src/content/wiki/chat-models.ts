/** Common choices, not an account entitlement list; custom model IDs are supported too. */
export const DEFAULT_CODEX_MODEL = "gpt-6.1-sol";
export const CHAT_MODELS: Record<"codex" | "claude", string[]> = {
  codex: [DEFAULT_CODEX_MODEL, "gpt-6-astra", "gpt-6-sol", "gpt-6-luna", "gpt-5.5"],
  claude: ["claude-opus-5-5", "claude-opus-5", "sonnet", "haiku"],
};
