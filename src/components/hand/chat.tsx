import { useEffect, useRef } from "react";
import { ArrowUp, Loader2, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { RichText } from "./rich-text";
import type { ToolResult, UiMessage } from "@/lib/agent/types";
import { toolLabel } from "@/lib/agent/tools";
import { cn, formatTime } from "@/lib/utils";

const SUGGESTS = [
  "Покажи диски и избранные папки",
  "Что лежит в /workspace",
  "Найди скриншоты",
  "Создай /tmp/localagent/план.txt с тремя задачами",
  "Распакуй /tmp/localagent/pack.zip",
];

function ToolChip({ t }: { t: ToolResult }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] shadow-[var(--shadow-border)]",
        t.ok ? "text-muted" : "text-danger",
      )}
    >
      <span className={cn("size-1.5 rounded-full", t.ok ? "bg-ok" : "bg-danger")} />
      {toolLabel(t.name)}
    </span>
  );
}

function Bubble({ m }: { m: UiMessage }) {
  const mine = m.role === "user";
  return (
    <article className={cn("flex flex-col gap-2", mine ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[min(100%,42rem)] rounded-lg px-3.5 py-3",
          mine
            ? "bg-accent text-accent-fg"
            : "bg-elevated text-fg shadow-[var(--shadow-border)]",
        )}
      >
        {m.image && (
          <img
            src={m.image}
            alt="кадр"
            className="mb-2 max-h-36 rounded-sm object-cover outline outline-1 -outline-offset-1 outline-fg/10"
          />
        )}
        {mine ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>
        ) : m.content ? (
          <RichText text={m.content} />
        ) : (
          <p className="text-sm text-muted">…</p>
        )}
      </div>
      {m.tools && m.tools.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {m.tools.map((t) => (
            <ToolChip key={t.id} t={t} />
          ))}
        </div>
      )}
      <time className="font-mono text-[10px] text-subtle tabular-nums">
        {formatTime(m.createdAt)}
      </time>
    </article>
  );
}

export function Chat({
  messages,
  running,
  status,
  value,
  onChange,
  onSend,
  listening,
  onMic,
  speechOk: _speechOk,
  suggests = SUGGESTS,
}: {
  messages: UiMessage[];
  running: boolean;
  status: string | null;
  value: string;
  onChange: (v: string) => void;
  onSend: (text?: string) => void;
  screenOn?: boolean;
  listening: boolean;
  onMic: () => void;
  speechOk: boolean;
  suggests?: string[];
}) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, running, status]);

  const chips = suggests;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        {messages.length === 0 ? (
          <div className="mx-auto flex max-w-lg flex-col gap-6 pt-6 sm:pt-16">
            <div className="space-y-3">
              <p className="text-xs font-medium tracking-[0.18em] text-subtle uppercase">
                LocalAgent 0.1_beta
              </p>
              <h2 className="font-display text-2xl font-medium tracking-tight text-fg">
                Скажи или напиши, что сделать с файлами.
              </h2>
              <p className="max-w-prose text-sm leading-relaxed text-muted">
                Вижу диски, папки, скриншоты и архивы этого компьютера. Копировать,
                удалить, создать, перенести, править, распаковать. Экран и голос —
                кнопками в шапке.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {chips.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSend(s)}
                  className="rounded-full px-3 py-2 text-left text-xs text-muted shadow-[var(--shadow-border)] transition-[box-shadow,color] duration-(--motion-quick) ease-(--ease-out) hover:text-fg hover:shadow-[var(--shadow-border-hover)]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-5">
            {messages.map((m) => (
              <Bubble key={m.id} m={m} />
            ))}
            {running && (
              <p className="shimmer text-sm text-muted">{status || "работаю"}</p>
            )}
          </div>
        )}
      </div>
      <form
        className="border-t border-fg/10 p-3 sm:p-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
      >
        <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-xl bg-elevated p-2 shadow-[var(--shadow-border)]">
          <Button
            type="button"
            size="icon"
            variant={listening ? "primary" : "ghost"}
            aria-label={listening ? "Стоп" : "Голос"}
            aria-pressed={listening}
            onClick={onMic}
            title="Голосовой ввод"
          >
            {listening ? <Square className="size-3.5" /> : <Mic className="size-4" />}
          </Button>
          {listening && (
            <div className="voice-bars mb-2.5" aria-hidden>
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          )}
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={listening ? "слушаю…" : "Скопируй, удали, создай, перенеси…"}
            rows={1}
            className="min-h-11 flex-1 border-0 bg-transparent px-3 py-2.5 shadow-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={running || !value.trim()}
            aria-label="Отправить"
          >
            {running ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
