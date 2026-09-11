import {
  Archive,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  HardDrive,
  Image as ImageIcon,
} from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import type { HostEntry } from "@/lib/fs/host";

function Glyph({ node, open }: { node: HostEntry; open?: boolean }) {
  if (node.kind === "drive")
    return <HardDrive className="size-3.5 shrink-0 text-fg" />;
  if (node.kind === "dir") {
    return open ? (
      <FolderOpen className="size-3.5 shrink-0 text-fg" />
    ) : (
      <Folder className="size-3.5 shrink-0 text-muted" />
    );
  }
  if (node.archive) return <Archive className="size-3.5 shrink-0 text-muted" />;
  if (node.image) return <ImageIcon className="size-3.5 shrink-0 text-muted" />;
  return <FileText className="size-3.5 shrink-0 text-muted" />;
}

function Row({
  node,
  depth,
  listings,
  expanded,
  selected,
  onToggle,
  onSelect,
}: {
  node: HostEntry;
  depth: number;
  listings: Record<string, HostEntry[]>;
  expanded: Record<string, boolean>;
  selected: string | null;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}) {
  const open = Boolean(expanded[node.path]);
  const kids = node.kind === "file" ? [] : (listings[node.path] ?? []);
  const active = selected === node.path;
  const isDir = node.kind !== "file";

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          onSelect(node.path);
          if (isDir) onToggle(node.path);
        }}
        className={cn(
          "flex h-8 w-full items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-sm px-1.5 text-left text-sm transition-colors duration-(--motion-quick) ease-(--ease-out)",
          active ? "bg-elevated text-fg" : "text-muted hover:bg-elevated/70 hover:text-fg",
        )}
        style={{ paddingLeft: 6 + depth * 12 }}
      >
        {isDir ? (
          <ChevronRight
            className={cn(
              "size-3.5 shrink-0 transition-transform duration-(--motion-quick) ease-(--ease-out)",
              open && "rotate-90",
            )}
          />
        ) : (
          <span className="w-3.5" />
        )}
        <Glyph node={node} open={open} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs">
          {node.name}
        </span>
        {node.kind === "file" && node.size > 0 && (
          <span className="shrink-0 font-mono text-[10px] text-subtle tabular-nums">
            {formatBytes(node.size)}
          </span>
        )}
      </button>
      {isDir && open
        ? kids.map((k) => (
            <Row
              key={k.path}
              node={k}
              depth={depth + 1}
              listings={listings}
              expanded={expanded}
              selected={selected}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))
        : null}
    </div>
  );
}

export function FileTree({
  drives,
  favorites,
  listings,
  expanded,
  selected,
  onToggle,
  onSelect,
}: {
  drives: HostEntry[];
  favorites: HostEntry[];
  listings: Record<string, HostEntry[]>;
  expanded: Record<string, boolean>;
  selected: string | null;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}) {
  return (
    <div className="py-2">
      {favorites.length > 0 && (
        <section className="mb-3">
          <p className="px-3 pb-1 text-[10px] font-medium tracking-[0.16em] text-subtle uppercase">
            Избранное
          </p>
          {favorites.map((n) => (
            <Row
              key={"fav-" + n.path + n.name}
              node={n}
              depth={0}
              listings={listings}
              expanded={expanded}
              selected={selected}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </section>
      )}
      <section>
        <p className="px-3 pb-1 text-[10px] font-medium tracking-[0.16em] text-subtle uppercase">
          Этот компьютер
        </p>
        {drives.length === 0 && favorites.length === 0 ? (
          <p className="px-3 py-6 text-sm text-muted">читаю диски…</p>
        ) : (
          drives.map((n) => (
            <Row
              key={n.path}
              node={n}
              depth={0}
              listings={listings}
              expanded={expanded}
              selected={selected}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))
        )}
      </section>
    </div>
  );
}
