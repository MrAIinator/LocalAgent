function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("`") && part.endsWith("`") && part.length >= 2 ? (
          <code
            key={i}
            className="rounded-xs bg-elevated px-1 py-px font-mono text-[0.85em] text-fg"
          >
            {part.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function RichText({ text }: { text: string }) {
  const chunks = text.split(/```[\w]*\n?([\s\S]*?)```/g);
  return (
    <div className="space-y-2 text-sm leading-relaxed text-fg">
      {chunks.map((chunk, i) =>
        i % 2 === 1 ? (
          <pre
            key={i}
            className="overflow-x-auto rounded-md bg-elevated p-3 font-mono text-xs text-fg shadow-[var(--shadow-border)]"
          >
            {chunk.replace(/\n$/, "")}
          </pre>
        ) : (
          <div key={i} className="whitespace-pre-wrap">
            {chunk.split("\n").map((line, li) => (
              <p key={li}>
                <Inline text={line} />
              </p>
            ))}
          </div>
        ),
      )}
    </div>
  );
}
