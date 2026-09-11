export type ProviderKind = "grok" | "ollama" | "lmstudio" | "custom";

export type Settings = {
  provider: ProviderKind;
  localUrl: string;
  localModel: string;
  localKey: string;
  confirmDestructive: boolean;
  attachScreen: boolean;
  voiceChat: boolean;
  speakReplies: boolean;
  voiceLang: string;
};

export const DEFAULT_SETTINGS: Settings = {
  provider: "grok",
  localUrl: "http://127.0.0.1:11434/v1",
  localModel: "qwen2.5:7b",
  localKey: "",
  confirmDestructive: true,
  attachScreen: false,
  voiceChat: false,
  speakReplies: true,
  voiceLang: "ru-RU",
};

export const PROVIDER_PRESETS: Record<
  Exclude<ProviderKind, "grok">
  ,
  { label: string; url: string; model: string; hint: string }
> = {
  ollama: {
    label: "Ollama",
    url: "http://127.0.0.1:11434/v1",
    model: "qwen2.5:7b",
    hint: "Electron ходит на localhost без CORS. В браузере задай OLLAMA_ORIGINS=*.",
  },
  lmstudio: {
    label: "LM Studio",
    url: "http://127.0.0.1:1234/v1",
    model: "local-model",
    hint: "LM Studio → Developer → Server → Start. В Electron CORS не нужен.",
  },
  custom: {
    label: "Свой endpoint",
    url: "http://127.0.0.1:8080/v1",
    model: "local-model",
    hint: "Любой OpenAI-совместимый /v1/chat/completions.",
  },
};

export type ToolName =
  | "list_dir"
  | "list_roots"
  | "read_file"
  | "write_file"
  | "mkdir"
  | "delete_path"
  | "copy_path"
  | "move_path"
  | "unpack_archive"
  | "pack_archive"
  | "search_files"
  | "tree";

export type ToolCall = {
  id: string;
  name: ToolName | string;
  args: Record<string, unknown>;
};

export type ToolResult = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  ok: boolean;
  result: string;
};

export type ChatRole = "system" | "user" | "assistant" | "tool";

export type TextPart = { type: "text"; text: string };
export type ImagePart = {
  type: "image_url";
  image_url: { url: string; detail?: "low" | "high" | "auto" };
};
export type ContentPart = TextPart | ImagePart;

export type ApiMessage = {
  role: ChatRole;
  content: string | ContentPart[] | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
};

export type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: string | null;
  tools?: ToolResult[];
  createdAt: number;
};

export type AgentEvent =
  | { type: "status"; text: string }
  | { type: "tool"; result: ToolResult }
  | { type: "text"; text: string }
  | { type: "error"; error: string };

export const DESTRUCTIVE_TOOLS = new Set(["delete_path"]);

export const APP_NAME = "LocalAgent";
export const APP_VERSION = "0.1_beta";
