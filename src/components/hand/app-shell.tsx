import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FolderOpen,
  MessageSquare,
  Mic,
  Monitor,
  MonitorOff,
  Eye,
  Settings as SettingsIcon,
  Trash2,
  Volume2,
} from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AgentMark } from "./mark";
import { Chat } from "./chat";
import { FileTree } from "./file-tree";
import { FilePreview } from "./file-preview";
import { ScreenDock } from "./screen-dock";
import { SettingsPanel } from "./settings-panel";
import { WinControls } from "./win-controls";
import { useAgent } from "@/store/agent";
import { grokAvailable } from "@/lib/agent/grok";
import { runAgent } from "@/lib/agent/run";
import { APP_VERSION, type ToolCall, type UiMessage } from "@/lib/agent/types";
import { uid, cn } from "@/lib/utils";
import { grabFrame, startCapture, stopCapture } from "@/lib/screen/capture";
import { isElectron, bridgeWriteBytes, bridgeWriteFile } from "@/lib/fs/bridge";
import { bufToB64, hostJoin, hostParent } from "@/lib/fs/paths";
import { isTextMime } from "@/lib/fs/types";
import {
  blobToB64,
  createMicRecorder,
  createRecognizer,
  micCaptureSupported,
  speechSupported,
  voiceInputSupported,
} from "@/lib/voice/stt";
import { transcribeAudio } from "@/lib/voice/transcribe";
import { speakReply, stopSpeech } from "@/lib/voice/tts";

export function AppShell() {
  const store = useAgent();
  const [draft, setDraft] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmCall, setConfirmCall] = useState<ToolCall | null>(null);
  const confirmRef = useRef<(v: boolean) => void>(undefined);
  const [screenOn, setScreenOn] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [side, setSide] = useState<"file" | "screen">("file");
  const voiceFromMic = useRef(false);
  const usingRecorder = useRef(false);
  const sendRef = useRef<(text?: string, fromVoice?: boolean) => Promise<void>>(
    async () => undefined,
  );

  useEffect(() => {
    void store.hydrate();
    void grokAvailable().then((r) => store.setGrokOk(r.available));
    return () => {
      stopCapture();
      stopSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recRef = useRef<ReturnType<typeof createRecognizer> | null>(null);
  const micRef = useRef<ReturnType<typeof createMicRecorder> | null>(null);
  useEffect(() => {
    recRef.current = createRecognizer({
      lang: store.settings.voiceLang,
      onPartial: (t) => setDraft(t),
      onFinal: (t) => {
        setDraft(t);
        void sendRef.current(t, true);
      },
      onError: (msg) => {
        toast.error(msg);
        store.setListening(false);
      },
      onEnd: () => store.setListening(false),
    });
    micRef.current = createMicRecorder();
    return () => {
      recRef.current?.stop();
      void micRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.settings.voiceLang]);

  useEffect(() => {
    if (!store.listening || !usingRecorder.current) return;
    const t = window.setTimeout(() => {
      void toggleMic();
    }, 45_000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.listening]);

  const chips = useMemo(() => {
    const home = store.info?.home || "/";
    const play = store.playground?.dir || "/tmp/localagent";
    const zip = store.playground?.zip || `${play}/pack.zip`;
    const list = [
      "Покажи диски и избранные папки",
      `Что лежит в ${home}`,
      "Найди скриншоты",
      `Создай ${play}/план.txt с тремя задачами`,
      `Распакуй ${zip}`,
    ];
    if (screenOn) list.push("Что сейчас на экране?");
    return list;
  }, [store.info?.home, store.playground, screenOn]);

  async function toggleScreen() {
    if (screenOn) {
      stopCapture();
      setScreenOn(false);
      store.setSettings({ attachScreen: false });
      return;
    }
    try {
      await startCapture();
      setScreenOn(true);
      setScreenError(null);
      store.setSettings({ attachScreen: true });
      setSide("screen");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Не удалось включить захват экрана";
      setScreenError(msg);
      toast.error(msg);
    }
  }

  function askConfirm(call: ToolCall) {
    return new Promise<boolean>((resolve) => {
      confirmRef.current = resolve;
      setConfirmCall(call);
    });
  }

  function preferLiveSpeech() {
    return speechSupported() && store.grokOk === false;
  }

  async function startListening() {
    if (store.listening) return;
    setDraft("");
    if (preferLiveSpeech()) {
      usingRecorder.current = false;
      recRef.current?.start();
      store.setListening(true);
      return;
    }
    if (micCaptureSupported()) {
      usingRecorder.current = true;
      try {
        await micRef.current?.start();
        store.setListening(true);
        return;
      } catch (err) {
        usingRecorder.current = false;
        const msg =
          err instanceof Error ? err.message : "Нет доступа к микрофону";
        if (!speechSupported()) {
          toast.error(msg);
          return;
        }
      }
    }
    if (speechSupported()) {
      usingRecorder.current = false;
      recRef.current?.start();
      store.setListening(true);
      return;
    }
    toast.error("Голос недоступен. Electron / Chrome умеют.");
  }

  async function transcribeBlob(blob: Blob): Promise<string | null> {
    if (blob.size > 6_000_000) {
      toast.error("Слишком длинная запись");
      return null;
    }
    store.setRunning(true, "распознаю");
    try {
      const audio = await blobToB64(blob);
      const r = await transcribeAudio({
        data: { audio, mime: blob.type || "audio/webm" },
      });
      if (r.ok) return r.text;
      if (r.error === "no-key" && speechSupported()) {
        toast.message("Облако недоступно — скажи ещё раз, пойдёт через Chrome Speech");
        usingRecorder.current = false;
        recRef.current?.start();
        store.setListening(true);
        return null;
      }
      toast.error(r.error === "empty" ? "Тишина. Скажи ещё раз." : "Не разобрал речь");
      return null;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Распознавание не удалось");
      return null;
    } finally {
      store.setRunning(false, null);
    }
  }

  async function toggleMic() {
    if (store.speaking) {
      stopSpeech();
      store.setSpeaking(false);
    }
    if (store.listening) {
      store.setListening(false);
      if (usingRecorder.current) {
        const blob = await micRef.current?.stop();
        if (!blob) return;
        const text = await transcribeBlob(blob);
        if (text) void sendRef.current(text, true);
      } else {
        recRef.current?.stop();
      }
      return;
    }
    if (!voiceInputSupported()) {
      toast.error("Голос недоступен в этом окне. Electron / Chrome умеют.");
      return;
    }
    await startListening();
  }

  async function send(text?: string, fromVoice = false) {
    const raw = (text ?? draft).trim();
    if (!raw || store.running) return;
    if (fromVoice) voiceFromMic.current = true;
    recRef.current?.stop();
    if (usingRecorder.current) void micRef.current?.stop();
    store.setListening(false);
    setDraft("");
    let shot: string | null = null;
    if (screenOn) {
      try {
        shot = await grabFrame();
      } catch {
        shot = null;
      }
    }
    const user: UiMessage = {
      id: uid(),
      role: "user",
      content: raw,
      image: shot,
      createdAt: Date.now(),
    };
    const assistant: UiMessage = {
      id: uid(),
      role: "assistant",
      content: "",
      tools: [],
      createdAt: Date.now(),
    };
    store.addMessage(user);
    store.addMessage(assistant);
    store.setRunning(true, "думаю");
    try {
      const result = await runAgent({
        userText: raw,
        screenDataUrl: shot,
        settings: { ...store.settings, attachScreen: screenOn },
        info: store.info,
        roots: store.roots,
        confirm: askConfirm,
        onFsChange: () => void store.invalidate(),
        onEvent: (e) => {
          if (e.type === "status") store.setRunning(true, e.text);
          if (e.type === "text") store.patchLastAssistant({ content: e.text });
          if (e.type === "tool") {
            const last = useAgent.getState().messages.at(-1);
            const tools = [...(last?.tools ?? []), e.result];
            store.patchLastAssistant({ tools });
          }
          if (e.type === "error") {
            store.patchLastAssistant({ content: e.error });
          }
        },
      });
      store.patchLastAssistant({
        content: result.text,
        tools: result.tools,
      });
      if (store.settings.speakReplies && result.text) {
        store.setSpeaking(true);
        await speakReply(result.text, store.settings.voiceLang);
        store.setSpeaking(false);
      }
      if (store.settings.voiceChat && voiceFromMic.current && voiceInputSupported()) {
        await startListening();
      } else {
        voiceFromMic.current = false;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      store.patchLastAssistant({ content: msg });
    } finally {
      store.setRunning(false, null);
    }
  }

  sendRef.current = send;

  async function onDrop(files: FileList | null, destDir: string) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      const path = hostJoin(destDir, file.name);
      const buf = await file.arrayBuffer();
      if (isTextMime(file.type, file.name) && file.size < 4_000_000) {
        await bridgeWriteFile(path, new TextDecoder().decode(buf));
      } else {
        await bridgeWriteBytes(path, bufToB64(buf));
      }
    }
    await store.invalidate(destDir);
    toast.success(`Добавлено: ${files.length}`);
  }

  const dropDest = (() => {
    const p = store.selectedPath;
    if (!p) return store.info?.home || "/";
    for (const entries of Object.values(store.listings)) {
      const hit = entries.find((e) => e.path === p);
      if (hit?.kind === "file") return hostParent(p);
    }
    return p;
  })();

  const osLabel = store.info
    ? `${store.info.os}/${store.info.arch}`
    : "";

  const filesPane = (
    <section className="flex h-full min-h-0 flex-col bg-surface">
      <header className="flex items-center justify-between gap-2 border-b border-fg/10 px-3 py-3">
        <div className="min-w-0">
          <p className="text-sm text-fg">Этот компьютер</p>
          <p className="truncate font-mono text-[10px] text-subtle">
            {store.info?.hostname || "читаю диски…"}
            {store.info?.home ? ` · ${store.info.home}` : ""}
          </p>
        </div>
      </header>
      <div
        className="min-h-0 flex-1 overflow-auto"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void onDrop(e.dataTransfer.files, dropDest);
        }}
      >
        <FileTree
          drives={store.roots?.drives ?? []}
          favorites={store.roots?.favorites ?? []}
          listings={store.listings}
          expanded={store.expanded}
          selected={store.selectedPath}
          onToggle={store.toggleExpanded}
          onSelect={(p) => {
            store.setSelected(p);
            setSide("file");
          }}
        />
      </div>
      <p className="border-t border-fg/10 px-3 py-2 text-[10px] text-subtle">
        Перетащи файлы на папку — скопирую на диск
      </p>
    </section>
  );

  const lookPane = (
    <section className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex gap-1 border-b border-fg/10 p-2">
        <button
          type="button"
          onClick={() => setSide("file")}
          className={cn(
            "h-8 flex-1 rounded-sm text-xs transition-colors duration-(--motion-quick)",
            side === "file" ? "bg-elevated text-fg" : "text-muted hover:text-fg",
          )}
        >
          Файл
        </button>
        <button
          type="button"
          onClick={() => setSide("screen")}
          className={cn(
            "h-8 flex-1 rounded-sm text-xs transition-colors duration-(--motion-quick)",
            side === "screen" ? "bg-elevated text-fg" : "text-muted hover:text-fg",
          )}
        >
          Экран
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {side === "screen" ? (
          <ScreenDock enabled={screenOn} error={screenError} />
        ) : (
          <FilePreview
            path={store.selectedPath}
            onChanged={() => void store.invalidate()}
          />
        )}
      </div>
    </section>
  );

  const chatPane = (
    <div className="flex h-full flex-col bg-bg">
      <div className="flex items-center justify-end gap-1 px-3 pt-2">
        <Button variant="ghost" size="sm" onClick={store.clearChat}>
          <Trash2 className="size-3.5" />
          Очистить
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <Chat
          messages={store.messages}
          running={store.running}
          status={store.status}
          value={draft}
          onChange={setDraft}
          onSend={(t) => void send(t, false)}
          screenOn={screenOn}
          listening={store.listening}
          onMic={() => void toggleMic()}
          speechOk={voiceInputSupported()}
          suggests={chips}
        />
      </div>
    </div>
  );

  const brain =
    store.settings.provider === "grok"
      ? "Grok"
      : store.settings.localModel || store.settings.provider;

  function downloadDesktop() {
    const a = document.createElement("a");
    a.href = "/LocalAgent-0.1_beta.zip";
    a.download = "LocalAgent-0.1_beta.zip";
    a.click();
  }

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-bg text-fg">
      <div className="hand-grid pointer-events-none absolute inset-0 opacity-80" />
      <header className="app-drag relative z-10 flex h-12 shrink-0 items-center gap-2 border-b border-fg/10 bg-bg/90 px-2 backdrop-blur-sm sm:h-14 sm:px-3">
        <AgentMark className="app-no-drag size-7 shrink-0" />
        <div className="min-w-0">
          <p className="flex items-baseline gap-2 font-display text-sm font-medium tracking-tight">
            LocalAgent
            <span className="font-mono text-[10px] font-normal text-subtle">
              {APP_VERSION}
            </span>
          </p>
          <p className="hidden truncate text-[10px] text-subtle sm:block">
            {brain}
            {store.info?.hostname ? ` · ${store.info.hostname}` : ""}
            {isElectron() ? " · electron" : " · хост"}
          </p>
        </div>
        {store.listening && (
          <span className="app-no-drag hidden items-center gap-1.5 rounded-full bg-elevated px-2 py-1 text-[10px] text-fg sm:inline-flex">
            <span className="size-1.5 animate-pulse rounded-full bg-ok" />
            слушаю
          </span>
        )}
        {store.speaking && (
          <span className="app-no-drag hidden items-center gap-1.5 rounded-full bg-elevated px-2 py-1 text-[10px] text-fg sm:inline-flex">
            <Volume2 className="size-3" />
            говорю
          </span>
        )}
        <div className="app-no-drag ml-auto flex items-center gap-1">
          <Button
            variant={store.settings.voiceChat ? "primary" : "ghost"}
            size="sm"
            className="hidden sm:inline-flex"
            aria-pressed={store.settings.voiceChat}
            onClick={() => {
              const next = !store.settings.voiceChat;
              store.setSettings({ voiceChat: next, speakReplies: next ? true : store.settings.speakReplies });
              if (next && !store.listening && !store.running) void startListening();
              if (!next && store.listening) void toggleMic();
            }}
            title="Голосовой чат: слушаю → отвечаю вслух → снова слушаю"
          >
            <Volume2 className="size-3.5" />
            <span className="hidden lg:inline">Чат голосом</span>
          </Button>
          <Button
            variant={store.listening ? "primary" : "ghost"}
            size="iconSm"
            aria-label={store.listening ? "Стоп голос" : "Голос"}
            aria-pressed={store.listening}
            onClick={() => void toggleMic()}
            title="Голосовой ввод"
          >
            <Mic className="size-3.5" />
          </Button>
          <Button
            variant={screenOn ? "primary" : "secondary"}
            size="sm"
            onClick={() => void toggleScreen()}
            aria-pressed={screenOn}
          >
            {screenOn ? (
              <Monitor className="size-3.5" />
            ) : (
              <MonitorOff className="size-3.5" />
            )}
            <span className="hidden sm:inline">Экран</span>
          </Button>
          {!isElectron() && (
            <Button
              variant="secondary"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={downloadDesktop}
            >
              <Download className="size-3.5" />
              ПК
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Настройки"
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon className="size-4" />
          </Button>
          <WinControls />
        </div>
      </header>

      <div className="relative z-10 hidden min-h-0 flex-1 md:flex">
        <Group orientation="horizontal" className="h-full w-full">
          <Panel id="files" defaultSize="22%" minSize={220}>
            {filesPane}
          </Panel>
          <Separator className="w-px bg-fg/10 outline-none hover:bg-fg/25" />
          <Panel id="chat" defaultSize="50%" minSize={280}>
            {chatPane}
          </Panel>
          <Separator className="w-px bg-fg/10 outline-none hover:bg-fg/25" />
          <Panel id="look" defaultSize="28%" minSize={240}>
            {lookPane}
          </Panel>
        </Group>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col md:hidden">
        <div className="min-h-0 flex-1">
          {store.mobileTab === "files" && filesPane}
          {store.mobileTab === "chat" && chatPane}
          {store.mobileTab === "look" && lookPane}
        </div>
        <nav className="grid grid-cols-4 border-t border-fg/10 bg-surface pb-[env(safe-area-inset-bottom)]">
          {(
            [
              ["chat", MessageSquare, "Чат"],
              ["files", FolderOpen, "Файлы"],
              ["look", Eye, "Вид"],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => store.setMobileTab(id)}
              className={cn(
                "flex h-12 flex-col items-center justify-center gap-0.5 text-[10px]",
                store.mobileTab === id ? "text-fg" : "text-muted",
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void toggleMic()}
            className={cn(
              "flex h-12 flex-col items-center justify-center gap-0.5 text-[10px]",
              store.listening ? "text-fg" : "text-muted",
            )}
          >
            <Mic className="size-4" />
            Голос
          </button>
        </nav>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent title="Настройки">
          <SettingsPanel
            settings={store.settings}
            grokOk={store.grokOk}
            osLabel={osLabel}
            onChange={store.setSettings}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(confirmCall)}
        onOpenChange={(open) => {
          if (!open) {
            confirmRef.current?.(false);
            confirmRef.current = undefined;
            setConfirmCall(null);
          }
        }}
      >
        <DialogContent title="Удалить?">
          <p className="text-sm leading-relaxed text-muted">
            Агент хочет удалить{" "}
            <code className="font-mono text-fg">
              {String(confirmCall?.args.path ?? "")}
            </code>
            . Это необратимо.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                confirmRef.current?.(false);
                confirmRef.current = undefined;
                setConfirmCall(null);
              }}
            >
              Оставить
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                confirmRef.current?.(true);
                confirmRef.current = undefined;
                setConfirmCall(null);
              }}
            >
              Удалить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#191c1f",
            color: "#eef0f2",
            border: "1px solid rgba(255,255,255,0.08)",
            fontFamily: "Sora, sans-serif",
          },
        }}
      />
    </div>
  );
}
