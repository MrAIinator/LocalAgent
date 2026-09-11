import { useEffect, useState } from "react";
import { FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { formatBytes } from "@/lib/utils";
import { execTool, readPreview } from "@/lib/fs/workspace";
import type { ReadPayload } from "@/lib/fs/host";

export function FilePreview({
  path,
  onChanged,
}: {
  path: string | null;
  onChanged: () => void;
}) {
  const [file, setFile] = useState<ReadPayload | null>(null);
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setDirty(false);
    setError(null);
    if (!path) {
      setFile(null);
      setText("");
      return;
    }
    void (async () => {
      try {
        const p = await readPreview(path);
        if (!alive) return;
        setFile(p);
        setText(p.text);
        setDirty(false);
      } catch (err) {
        if (!alive) return;
        setFile(null);
        setText("");
        setError(err instanceof Error ? err.message : "Не открылось");
      }
    })();
    return () => {
      alive = false;
    };
  }, [path]);

  if (!path) {
    return (
      <div className="flex h-full flex-col items-start justify-center px-5 text-muted">
        <p className="text-sm">Выбери файл слева — откроется здесь.</p>
      </div>
    );
  }

  const name = path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);

  async function save() {
    if (!path) return;
    setSaving(true);
    await execTool({
      id: "manual-write",
      name: "write_file",
      args: { path, content: text },
    });
    setDirty(false);
    setSaving(false);
    onChanged();
  }

  async function unpack() {
    if (!path) return;
    await execTool({
      id: "manual-unzip",
      name: "unpack_archive",
      args: { path },
    });
    onChanged();
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-fg/10 px-4 py-3">
        {file?.kind === "image" ? (
          <ImageIcon className="size-3.5 text-muted" />
        ) : (
          <FileText className="size-3.5 text-muted" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-xs text-fg">{name}</p>
          <p className="truncate font-mono text-[10px] text-subtle">{path}</p>
        </div>
        {file && (
          <span className="font-mono text-[10px] text-subtle tabular-nums">
            {formatBytes(file.size)}
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {error && <p className="px-2 text-sm text-danger">{error}</p>}
        {file?.kind === "image" && file.dataUrl && (
          <img
            src={file.dataUrl}
            alt={name}
            className="mx-auto max-h-full max-w-full rounded-md object-contain"
          />
        )}
        {file?.kind === "binary" && (
          <div className="flex h-full flex-col items-start justify-center gap-3 px-2">
            <p className="text-sm text-muted">
              Бинарный файл
              {file.mime ? ` · ${file.mime}` : ""}.
            </p>
            {file.archive && /\.zip$/i.test(path) && (
              <Button size="sm" variant="secondary" onClick={() => void unpack()}>
                Распаковать zip
              </Button>
            )}
            {file.archive && !/\.zip$/i.test(path) && (
              <p className="text-xs text-subtle">Распаковка в 0.1_beta только для .zip</p>
            )}
          </div>
        )}
        {file?.kind === "text" && (
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setDirty(true);
            }}
            className="h-full min-h-[180px] rounded-lg font-mono text-xs leading-relaxed"
            spellCheck={false}
          />
        )}
      </div>
      {file?.kind === "text" && (
        <div className="flex items-center justify-between gap-2 border-t border-fg/10 px-3 py-2">
          <span className="text-xs text-subtle">
            {dirty ? "не сохранено" : "сохранено"}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={!dirty || saving}
            onClick={() => void save()}
          >
            Сохранить
          </Button>
        </div>
      )}
    </div>
  );
}
