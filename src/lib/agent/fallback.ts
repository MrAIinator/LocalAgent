import { uid } from "@/lib/utils";
import type { ToolCall } from "./types";

function abs(raw: string): string {
  const t = raw.replace(/^[«"]|[»"]$/g, "").trim();
  return t;
}

function tasksFrom(rest: string): string {
  if (/тремя задачами|3 задач/i.test(rest)) {
    return ["- [ ] задача 1", "- [ ] задача 2", "- [ ] задача 3", ""].join("\n");
  }
  return rest.replace(/^(содержимым|текстом|содержанием)\s+/i, "") + (rest.endsWith("\n") ? "" : "\n");
}

export function parseIntent(text: string, home: string): ToolCall[] | null {
  const t = text.trim();

  if (/(диск|корн|том|volume|drive|этот компьютер)/i.test(t) && /(покажи|выведи|list|какие)/i.test(t)) {
    return [{ id: uid(), name: "list_roots", args: {} }];
  }

  if (/скриншот/i.test(t) && /(найди|покажи|где|папк)/i.test(t)) {
    return [
      { id: uid(), name: "list_roots", args: {} },
      { id: uid(), name: "search_files", args: { query: "screenshot", path: home } },
    ];
  }

  const lies = t.match(/^что\s+(лежит|есть)\s+в\s+(\S+)/i);
  if (lies) {
    return [{ id: uid(), name: "list_dir", args: { path: abs(lies[2]) } }];
  }

  if (
    /^(покажи|выведи|list|tree|открой дерево)/i.test(t) &&
    /(дерев|файл|папк|диск|компьютер)/i.test(t)
  ) {
    const m = t.match(/(?:в|из)\s+(\S+)/i);
    return [{ id: uid(), name: "tree", args: { path: m ? abs(m[1]) : home } }];
  }

  const unpack = t.match(/распакуй(?:\s+архив)?\s+(\S+)(?:\s+в\s+(\S+))?/i);
  if (unpack) {
    const args: Record<string, string> = { path: abs(unpack[1]) };
    if (unpack[2]) args.dest = abs(unpack[2]);
    return [{ id: uid(), name: "unpack_archive", args }];
  }

  const pack = t.match(/(?:упакуй|заархивируй|zip)\s+(\S+)(?:\s+в\s+(\S+))?/i);
  if (pack) {
    const args: Record<string, string> = { path: abs(pack[1]) };
    if (pack[2]) args.dest = abs(pack[2]);
    return [{ id: uid(), name: "pack_archive", args }];
  }

  const copy = t.match(/скопируй\s+(\S+)\s+в\s+(\S+)/i);
  if (copy) {
    return [{ id: uid(), name: "copy_path", args: { src: abs(copy[1]), dest: abs(copy[2]) } }];
  }

  const move = t.match(/(?:перенеси|переименуй|move)\s+(\S+)\s+в\s+(\S+)/i);
  if (move) {
    return [{ id: uid(), name: "move_path", args: { src: abs(move[1]), dest: abs(move[2]) } }];
  }

  const del = t.match(/удали(?:\s+файл|\s+папку)?\s+(\S+)/i);
  if (del) {
    return [{ id: uid(), name: "delete_path", args: { path: abs(del[1]) } }];
  }

  const mkdir = t.match(/создай\s+папк[уи]\s+(\S+)/i);
  if (mkdir) {
    return [{ id: uid(), name: "mkdir", args: { path: abs(mkdir[1]) } }];
  }

  const write = t.match(/создай(?:\s+файл)?\s+(\S+)\s+(?:с\s+|содержимое\s+|—\s*|:\s*)(.+)/i);
  if (write) {
    return [
      {
        id: uid(),
        name: "write_file",
        args: { path: abs(write[1]), content: tasksFrom(write[2].trim()) },
      },
    ];
  }

  const read = t.match(/(?:прочитай|открой|покажи содержимое)\s+(\S+)/i);
  if (read) {
    return [{ id: uid(), name: "read_file", args: { path: abs(read[1]) } }];
  }

  const search = t.match(/найди\s+(.+)/i);
  if (search) {
    return [{ id: uid(), name: "search_files", args: { query: search[1].trim(), path: home } }];
  }

  if (/^(покажи|list|ls|dir)\s+(\S+)/i.test(t)) {
    const m = t.match(/^(?:покажи|list|ls|dir)\s+(\S+)/i);
    if (m) return [{ id: uid(), name: "list_dir", args: { path: abs(m[1]) } }];
  }

  return null;
}

export function grokBlocked(error: string): boolean {
  return /403|credits|spending-limit|unavailable|недоступен|timeout|вовремя|AbortError/i.test(
    error,
  );
}

export function summarizeTools(
  tools: { name: string; ok: boolean; result: string }[],
  note?: string,
): string {
  const lines = tools.map((t) => (t.ok ? t.result : `не вышло: ${t.result}`));
  const body = lines.join("\n") || "Ничего не сделал.";
  return note ? `${note}\n\n${body}` : body;
}
