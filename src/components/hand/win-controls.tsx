import { Minus, Square, X } from "lucide-react";
import { windowControls } from "@/lib/fs/bridge";

export function WinControls() {
  const w = windowControls();
  if (!w) return null;
  return (
    <div className="app-no-drag ml-1 flex items-center">
      <button
        type="button"
        aria-label="Свернуть"
        className="flex size-10 items-center justify-center text-muted hover:bg-elevated hover:text-fg"
        onClick={() => void w.minimize()}
      >
        <Minus className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label="Развернуть"
        className="flex size-10 items-center justify-center text-muted hover:bg-elevated hover:text-fg"
        onClick={() => void w.maximize()}
      >
        <Square className="size-3" />
      </button>
      <button
        type="button"
        aria-label="Закрыть"
        className="flex size-10 items-center justify-center text-muted hover:bg-danger/20 hover:text-danger"
        onClick={() => void w.close()}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
