import { createServerFn } from "@tanstack/react-start";
import { openaiTools } from "./tools";
import type { ApiMessage } from "./types";

export type StepInput = {
  messages: ApiMessage[];
  system: string;
};

export type ToolCallDto = {
  id: string;
  name: string;
  arguments: string;
};

export type StepOutput =
  | { ok: true; kind: "text"; text: string }
  | { ok: true; kind: "tools"; text: string; calls: ToolCallDto[] }
  | { ok: false; error: string };

export const grokAvailable = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ available: boolean }> => {
    return { available: Boolean(process.env.XAI_API_KEY) };
  },
);

export const grokStep = createServerFn({ method: "POST" })
  .validator((input: StepInput) => input)
  .handler(async ({ data }): Promise<StepOutput> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return {
        ok: false,
        error: "Grok сейчас недоступен. Подключи локальную модель в настройках.",
      };
    }

    const messages: ApiMessage[] = [
      { role: "system", content: data.system },
      ...data.messages.slice(-24),
    ];

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        messages,
        tools: openaiTools(),
        tool_choice: "auto",
        temperature: 0.2,
        max_tokens: 1600,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        error: `xAI ответил ${res.status}${body ? `: ${body.slice(0, 180)}` : ""}`,
      };
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
    if (!msg) return { ok: false, error: "Пустой ответ модели" };

    const calls = msg.tool_calls ?? [];
    if (calls.length) {
      return {
        ok: true,
        kind: "tools",
        text: msg.content ?? "",
        calls: calls.map((c) => ({
          id: c.id,
          name: c.function.name,
          arguments: c.function.arguments || "{}",
        })),
      };
    }

    return { ok: true, kind: "text", text: msg.content ?? "" };
  });
