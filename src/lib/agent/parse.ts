import { uid } from "@/lib/utils";
import type { ToolCall } from "./types";

const KNOWN = new Set([
  "list_dir",
  "read_file",
  "write_file",
  "mkdir",
  "delete_path",
  "copy_path",
  "move_path",
  "unpack_archive",
  "search_files",
  "tree",
]);

function coerce(obj: unknown): ToolCall | null {
  if (!obj || typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;
  const name = String(rec.name ?? rec.tool ?? rec.function ?? "");
  if (!name || !KNOWN.has(name)) return null;
  const argsRaw = rec.args ?? rec.arguments ?? rec.parameters ?? {};
  let args: Record<string, unknown> = {};
  if (typeof argsRaw === "string") {
    try {
      args = JSON.parse(argsRaw) as Record<string, unknown>;
    } catch {
      args = { path: argsRaw };
    }
  } else if (argsRaw && typeof argsRaw === "object") {
    args = argsRaw as Record<string, unknown>;
  }
  return { id: uid(), name, args };
}

export function extractToolCallsFromText(text: string): {
  calls: ToolCall[];
  remainder: string;
} {
  const calls: ToolCall[] = [];
  let remainder = text;

  const patterns: RegExp[] = [
    /```action\s*([\s\S]*?)```/gi,
    /```json\s*([\s\S]*?)```/gi,
    /<tool_call>\s*([\s\S]*?)<\/tool_call>/gi,
    /<action(?:\s+name="([^"]+)")?\s*>([\s\S]*?)<\/action>/gi,
  ];

  for (const re of patterns) {
    remainder = remainder.replace(re, (full, a, b) => {
      const body = typeof b === "string" && b.length ? b : a;
      const nameAttr = typeof b === "string" && a && a !== body ? String(a) : "";
      try {
        const parsed: unknown = JSON.parse(String(body).trim());
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const c = coerce(item);
            if (c) calls.push(c);
          }
          return "";
        }
        const withName = nameAttr
          ? { ...(parsed as object), name: nameAttr }
          : parsed;
        const c = coerce(withName);
        if (c) {
          calls.push(c);
          return "";
        }
      } catch {
        /* ignore */
      }
      return full;
    });
  }

  // Bare JSON object/array in the whole reply
  if (calls.length === 0) {
    const trimmed = text.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of items) {
          const c = coerce(item);
          if (c) calls.push(c);
        }
        if (calls.length) remainder = "";
      } catch {
        /* ignore */
      }
    }
  }

  return { calls, remainder: remainder.trim() };
}
