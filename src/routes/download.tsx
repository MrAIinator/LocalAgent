import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Download } from "lucide-react";
import { AgentMark } from "@/components/hand/mark";
import { Button } from "@/components/ui/button";
import { APP_VERSION } from "@/lib/agent/types";

const ZIP = "/LocalAgent-0.1_beta.zip";

export const Route = createFileRoute("/download")({ component: DownloadPage });

function DownloadPage() {
  useEffect(() => {
    const a = document.createElement("a");
    a.href = ZIP;
    a.download = "LocalAgent-0.1_beta.zip";
    a.click();
  }, []);

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-fg">
      <div className="hand-grid pointer-events-none absolute inset-0 opacity-70" />
      <div className="relative z-10 flex max-w-md flex-col items-start gap-6">
        <AgentMark className="size-10" />
        <div className="space-y-3">
          <p className="font-mono text-[10px] tracking-[0.18em] text-subtle uppercase">
            LocalAgent {APP_VERSION}
          </p>
          <h1 className="font-display text-3xl font-medium tracking-tight">
            Сборка для ПК
          </h1>
          <p className="text-sm leading-relaxed text-muted">
            Electron-агент: диски, файлы, архивы, скриншоты, экран и голос.
            Распакуй архив и запусти LocalAgent.bat. Нужен Node.js 20+.
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => {
            const a = document.createElement("a");
            a.href = ZIP;
            a.download = "LocalAgent-0.1_beta.zip";
            a.click();
          }}
        >
          <Download className="size-4" />
          Скачать LocalAgent-0.1_beta.zip
        </Button>
        <a href="/" className="text-xs text-subtle hover:text-fg">
          Открыть превью
        </a>
      </div>
    </main>
  );
}
