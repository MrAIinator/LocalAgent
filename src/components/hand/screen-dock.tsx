import { useEffect, useRef, useState } from "react";
import { Monitor, MonitorOff } from "lucide-react";
import { onStream } from "@/lib/screen/capture";

export function ScreenDock({
  enabled,
  error,
}: {
  enabled: boolean;
  error: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    return onStream((stream) => {
      const el = videoRef.current;
      setLive(Boolean(stream));
      if (el) {
        el.srcObject = stream;
        if (stream) void el.play().catch(() => undefined);
      }
    });
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-fg/10 px-4 py-3">
        {enabled && live ? (
          <Monitor className="size-3.5 text-fg" />
        ) : (
          <MonitorOff className="size-3.5 text-muted" />
        )}
        <div>
          <p className="text-sm text-fg">Экран</p>
          <p className="text-xs text-subtle">
            {enabled && live
              ? "агент видит этот кадр при каждом запросе"
              : "выключен — кнопка в шапке"}
          </p>
        </div>
        {enabled && live && (
          <span className="ml-auto size-1.5 rounded-full bg-ok" />
        )}
      </div>
      <div className="relative min-h-0 flex-1 bg-elevated">
        <video
          ref={videoRef}
          className="absolute inset-0 size-full object-contain"
          muted
          playsInline
          autoPlay
        />
        {(!enabled || !live) && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <p className="text-sm text-muted">
              {error
                ? error
                : "Нажми «Экран» в шапке, выбери окно или весь дисплей. Выключить можно той же кнопкой."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
