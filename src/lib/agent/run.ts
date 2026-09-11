import { uid } from "@/lib/utils";
import { compactRoots, systemPrompt } from "./prompt";
import { extractToolCallsFromText } from "./parse";
import { grokStep } from "./grok";
import { openaiTools } from "./tools";
import { grokBlocked, parseIntent, summarizeTools } from "./fallback";
import type {
  AgentEvent,
  ApiMessage,
  Settings,
  ToolCall,
  ToolResult,
} from "./types";
import { execTool } from "@/lib/fs/workspace";
import type { HostInfo, RootsPayload } from "@/lib/fs/host";

const MAX_ROUNDS = 8;
let grokDown = false;

type RunOpts = {
  userText: string;
  screenDataUrl?: string | null;
  settings: Settings;
  info: HostInfo | null;
  roots: RootsPayload | null;
  confirm: (call: ToolCall) => Promise<boolean>;
  onEvent: (e: AgentEvent) => void;
  onFsChange?: () => void;
  signal?: AbortSignal;
};

export type RunResult = {
  text: string;
  tools: ToolResult[];
};

function slim(messages: ApiMessage[]): ApiMessage[] {
  return messages.map((m, i) => {
    if (i < messages.length - 2 && Array.isArray(m.content)) {
      const text = m.content
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("\n");
      return { ...m, content: text + " [изображение скрыто]" };
    }
    return m;
  });
}

async function localStep(
  settings: Settings,
  messages: ApiMessage[],
  system: string,
  signal?: AbortSignal,
): Promise<
  | { ok: true; kind: "text"; text: string }
  | {
      ok: true;
      kind: "tools";
      text: string;
      calls: { id: string; name: string; args: Record<string, unknown> }[];
    }
  | { ok: false; error: string }
> {
  const url = settings.localUrl.replace(/\/+$/, "") + "/chat/completions";
  const body = {
    model: settings.localModel || "local-model",
    messages: [{ role: "system", content: system }, ...messages],
    tools: openaiTools(),
    tool_choice: "auto",
    temperature: 0.2,
    max_tokens: 1200,
  };
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(settings.localKey
          ? { Authorization: `Bearer ${settings.localKey}` }
          : {}),
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `Не достучался до ${url}. ${msg}.`,
    };
  }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: `Локальная модель ${res.status}: ${t.slice(0, 220)}` };
  }
  const json = (await res.json()) as {
    choices?: {
      message?: {
        content?: string | null;
        tool_calls?: {
          id: string;
          function: { name: string; arguments: string };
        }[];
      };
    }[];
  };
  const msg = json.choices?.[0]?.message;
  if (!msg) return { ok: false, error: "Пустой ответ локальной модели" };
  const native = msg.tool_calls ?? [];
  if (native.length) {
    return {
      ok: true,
      kind: "tools",
      text: msg.content ?? "",
      calls: native.map((c) => {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(c.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          args = {};
        }
        return { id: c.id, name: c.function.name, args };
      }),
    };
  }
  const text = msg.content ?? "";
  const parsed = extractToolCallsFromText(text);
  if (parsed.calls.length) {
    return {
      ok: true,
      kind: "tools",
      text: parsed.remainder,
      calls: parsed.calls,
    };
  }
  return { ok: true, kind: "text", text };
}

async function runCalls(
  calls: ToolCall[],
  opts: RunOpts,
  tools: ToolResult[],
  messages: ApiMessage[],
) {
  for (const call of calls) {
    if (opts.signal?.aborted) throw new Error("Остановлено");
    if (call.name === "delete_path" && opts.settings.confirmDestructive) {
      const allowed = await opts.confirm(call);
      if (!allowed) {
        const denied: ToolResult = {
          id: call.id,
          name: call.name,
          args: call.args,
          ok: false,
          result: "Пользователь отменил удаление",
        };
        tools.push(denied);
        opts.onEvent({ type: "tool", result: denied });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.name,
          content: denied.result,
        });
        continue;
      }
    }
    const executed = await execTool(call);
    if (
      call.name === "write_file" ||
      call.name === "mkdir" ||
      call.name === "delete_path" ||
      call.name === "copy_path" ||
      call.name === "move_path" ||
      call.name === "unpack_archive" ||
      call.name === "pack_archive"
    ) {
      opts.onFsChange?.();
    }
    const result: ToolResult = {
      id: call.id,
      name: call.name,
      args: call.args,
      ok: executed.ok,
      result: executed.result,
    };
    tools.push(result);
    opts.onEvent({ type: "tool", result });
    const contentParts: ApiMessage["content"] = executed.image
      ? [
          { type: "text", text: executed.result },
          {
            type: "image_url",
            image_url: { url: executed.image, detail: "low" },
          },
        ]
      : executed.result;
    messages.push({
      role: "tool",
      tool_call_id: call.id,
      name: call.name,
      content: typeof contentParts === "string" ? contentParts : executed.result,
    });
    if (executed.image) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: `Изображение из файла ${String(call.args.path ?? "")}` },
          {
            type: "image_url",
            image_url: { url: executed.image, detail: "low" },
          },
        ],
      });
    }
  }
}

export async function runAgent(opts: RunOpts): Promise<RunResult> {
  const { settings, onEvent, signal } = opts;
  const tools: ToolResult[] = [];
  const home = opts.info?.home || "/";

  const system = systemPrompt({
    info: opts.info,
    screenOn: Boolean(opts.screenDataUrl) || settings.attachScreen,
    voiceOn: settings.voiceChat,
    rootsPreview: opts.roots ? compactRoots(opts.roots) : "",
  });

  const userContent: ApiMessage["content"] = opts.screenDataUrl
    ? [
        { type: "text", text: opts.userText },
        {
          type: "image_url",
          image_url: { url: opts.screenDataUrl, detail: "low" },
        },
      ]
    : opts.userText;

  const messages: ApiMessage[] = [{ role: "user", content: userContent }];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (signal?.aborted) throw new Error("Остановлено");
    onEvent({
      type: "status",
      text: round === 0 ? "думаю" : "ещё шаг",
    });

    const payload = slim(messages);
    const skipGrok = settings.provider === "grok" && grokDown;
    const step = skipGrok
      ? { ok: false as const, error: "Grok сейчас недоступен" }
      : settings.provider === "grok"
        ? await grokStep({ data: { messages: payload, system } })
        : await localStep(settings, payload, system, signal);

    if (!step.ok && grokBlocked(step.error)) grokDown = true;

    if (!step.ok) {
      const localCalls =
        grokBlocked(step.error) || settings.provider !== "grok"
          ? parseIntent(opts.userText, home)
          : null;
      if (localCalls?.length) {
        onEvent({ type: "status", text: "прямые команды" });
        await runCalls(localCalls, opts, tools, messages);
        const note =
          settings.provider === "grok"
            ? "Grok сейчас без кредитов — сделал по команде. Для свободного языка подключи Ollama или LM Studio в настройках."
            : undefined;
        const text = summarizeTools(tools, note);
        onEvent({ type: "text", text });
        return { text, tools };
      }
      onEvent({ type: "error", error: step.error });
      return { text: "", tools };
    }

    if (step.kind === "text") {
      onEvent({ type: "text", text: step.text });
      return { text: step.text, tools };
    }

    const parsedCalls: ToolCall[] = step.calls.map((c) => {
      let args: Record<string, unknown> = {};
      if ("args" in c && c.args && typeof c.args === "object") {
        args = c.args as Record<string, unknown>;
      } else if ("arguments" in c && typeof (c as { arguments?: string }).arguments === "string") {
        try {
          args = JSON.parse((c as { arguments: string }).arguments || "{}") as Record<
            string,
            unknown
          >;
        } catch {
          args = {};
        }
      }
      return { id: c.id || uid(), name: c.name, args };
    });

    const assistantToolCalls = parsedCalls.map((c) => ({
      id: c.id,
      type: "function" as const,
      function: { name: c.name, arguments: JSON.stringify(c.args ?? {}) },
    }));
    messages.push({
      role: "assistant",
      content: step.text || null,
      tool_calls: assistantToolCalls,
    });

    await runCalls(parsedCalls, opts, tools, messages);
  }

  const fallback = "Дошёл до лимита шагов. Скажи, что сделать дальше.";
  onEvent({ type: "text", text: fallback });
  return { text: fallback, tools };
}

export async function probeLocal(settings: Settings): Promise<string> {
  const base = settings.localUrl.replace(/\/+$/, "");
  try {
    const res = await fetch(base + "/models", {
      headers: settings.localKey
        ? { Authorization: `Bearer ${settings.localKey}` }
        : {},
    });
    if (!res.ok) return `Сервер ответил ${res.status}`;
    const json = (await res.json()) as {
      data?: { id: string }[];
    };
    const ids = (json.data ?? []).map((m) => m.id).slice(0, 8);
    return ids.length
      ? `На связи. Модели: ${ids.join(", ")}`
      : "На связи, список моделей пуст — укажи имя вручную.";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Нет связи: ${msg}`;
  }
}
