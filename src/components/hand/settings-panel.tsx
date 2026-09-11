import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  APP_VERSION,
  DEFAULT_SETTINGS,
  PROVIDER_PRESETS,
  type ProviderKind,
  type Settings,
} from "@/lib/agent/types";
import { probeLocal } from "@/lib/agent/run";
import { cn } from "@/lib/utils";
import { isElectron } from "@/lib/fs/bridge";
import { voiceInputSupported } from "@/lib/voice/stt";
import { Download } from "lucide-react";

export function SettingsPanel({
  settings,
  grokOk,
  osLabel,
  onChange,
}: {
  settings: Settings;
  grokOk: boolean | null;
  osLabel: string;
  onChange: (p: Partial<Settings>) => void;
}) {
  const [probe, setProbe] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const providers: { id: ProviderKind; label: string; note: string }[] = [
    {
      id: "grok",
      label: "Grok",
      note: grokOk === false ? "сейчас нет ключа" : "облако, видит экран",
    },
    { id: "ollama", label: "Ollama", note: "локально :11434" },
    { id: "lmstudio", label: "LM Studio", note: "локально :1234" },
    { id: "custom", label: "Свой URL", note: "OpenAI-совместимый" },
  ];

  function pick(id: ProviderKind) {
    if (id === "grok") {
      onChange({ provider: "grok" });
      return;
    }
    const preset = PROVIDER_PRESETS[id];
    onChange({
      provider: id,
      localUrl: settings.provider === id ? settings.localUrl : preset.url,
      localModel: settings.provider === id ? settings.localModel : preset.model,
    });
  }

  async function test() {
    setBusy(true);
    const msg = await probeLocal(settings);
    setProbe(msg);
    setBusy(false);
  }

  const local = settings.provider !== "grok";
  const hint =
    settings.provider !== "grok"
      ? PROVIDER_PRESETS[settings.provider].hint
      : isElectron()
        ? "Grok на сервере. Локальные модели Electron зовёт напрямую с этой машины."
        : "Grok на сервере. Локальную модель браузер зовёт напрямую — включи CORS.";

  return (
    <div className="space-y-6 text-sm">
      <p className="font-mono text-[10px] tracking-wide text-subtle uppercase">
        LocalAgent {APP_VERSION}
        {osLabel ? ` · ${osLabel}` : ""}
        {isElectron() ? " · electron" : " · host fs"}
      </p>

      <section className="space-y-3">
        <h3 className="text-xs font-medium tracking-wide text-subtle uppercase">
          Мозг
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {providers.map((p) => {
            const active = settings.provider === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => pick(p.id)}
                className={cn(
                  "rounded-md px-3 py-3 text-left shadow-[var(--shadow-border)] transition-[box-shadow,background-color] duration-(--motion-quick) ease-(--ease-out)",
                  active
                    ? "bg-accent text-accent-fg shadow-none"
                    : "bg-elevated text-fg hover:shadow-[var(--shadow-border-hover)]",
                )}
              >
                <div className="font-medium">{p.label}</div>
                <div
                  className={cn(
                    "mt-0.5 text-xs",
                    active ? "text-accent-fg/70" : "text-subtle",
                  )}
                >
                  {p.note}
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-xs leading-relaxed text-muted">{hint}</p>
      </section>

      {local && (
        <section className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs text-subtle">URL</span>
            <Input
              value={settings.localUrl}
              onChange={(e) => onChange({ localUrl: e.target.value })}
              spellCheck={false}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-subtle">Модель</span>
            <Input
              value={settings.localModel}
              onChange={(e) => onChange({ localModel: e.target.value })}
              spellCheck={false}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-subtle">Ключ (если нужен)</span>
            <Input
              value={settings.localKey}
              onChange={(e) => onChange({ localKey: e.target.value })}
              spellCheck={false}
              placeholder="lm-studio"
            />
          </label>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => void test()}>
              Проверить связь
            </Button>
            {probe && <span className="text-xs text-muted">{probe}</span>}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h3 className="text-xs font-medium tracking-wide text-subtle uppercase">
          Голос
        </h3>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-fg">Голосовой чат</p>
            <p className="text-xs text-subtle">
              {voiceInputSupported()
                ? "После ответа снова слушаю микрофон"
                : "Микрофон недоступен в этом окне"}
            </p>
          </div>
          <Switch
            checked={settings.voiceChat}
            onCheckedChange={(v) =>
              onChange({ voiceChat: v, speakReplies: v ? true : settings.speakReplies })
            }
            disabled={!voiceInputSupported()}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-fg">Озвучивать ответы</p>
            <p className="text-xs text-subtle">Голос агента после каждого хода</p>
          </div>
          <Switch
            checked={settings.speakReplies}
            onCheckedChange={(v) => onChange({ speakReplies: v })}
          />
        </div>
      </section>

      <section className="flex items-center justify-between gap-4">
        <div>
          <p className="text-fg">Спрашивать перед удалением</p>
          <p className="text-xs text-subtle">delete_path не уйдёт без тебя</p>
        </div>
        <Switch
          checked={settings.confirmDestructive}
          onCheckedChange={(v) => onChange({ confirmDestructive: v })}
        />
      </section>

      <Button variant="ghost" size="sm" onClick={() => onChange({ ...DEFAULT_SETTINGS })}>
        Сбросить настройки
      </Button>

      {!isElectron() && (
        <section className="space-y-2 rounded-md bg-elevated p-3 shadow-[var(--shadow-border)]">
          <p className="text-sm text-fg">Сборка для ПК</p>
          <p className="text-xs leading-relaxed text-muted">
            Это превью. На своём компьютере запусти Electron-сборку LocalAgent 0.1_beta —
            полный доступ к дискам, голос и локальная модель без CORS.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const a = document.createElement("a");
              a.href = "/LocalAgent-0.1_beta.zip";
              a.download = "LocalAgent-0.1_beta.zip";
              a.click();
            }}
          >
            <Download className="size-3.5" />
            Скачать LocalAgent-0.1_beta.zip
          </Button>
        </section>
      )}
    </div>
  );
}
