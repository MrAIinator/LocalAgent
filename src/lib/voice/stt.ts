export type SpeechEngine = {
  supported: boolean;
  start: () => void;
  stop: () => void;
};

type RecCtor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: {
    resultIndex: number;
    results: { isFinal: boolean; 0: { transcript: string } }[];
  }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function Ctor(): RecCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecCtor;
    webkitSpeechRecognition?: RecCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function speechSupported(): boolean {
  return Boolean(Ctor());
}

export function micCaptureSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined"
  );
}

export function voiceInputSupported(): boolean {
  return micCaptureSupported() || speechSupported();
}

export function createRecognizer(opts: {
  lang: string;
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (msg: string) => void;
  onEnd: () => void;
}): SpeechEngine {
  const Rec = Ctor();
  if (!Rec) {
    return {
      supported: false,
      start: () => opts.onError("Голосовой ввод недоступен в этом окне"),
      stop: () => undefined,
    };
  }
  const RecClass = Rec;
  let rec: InstanceType<RecCtor> | null = null;
  let active = false;

  function attach() {
    rec = new RecClass();
    rec.lang = opts.lang || "ru-RU";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (ev) => {
      let finalText = "";
      let partial = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0]?.transcript ?? "";
        if (ev.results[i].isFinal) finalText += t;
        else partial += t;
      }
      if (partial) opts.onPartial(partial);
      if (finalText) opts.onFinal(finalText.trim());
    };
    rec.onerror = (ev) => {
      if (ev.error === "no-speech" || ev.error === "aborted") return;
      opts.onError(
        ev.error === "not-allowed"
          ? "Нет доступа к микрофону"
          : `Распознавание: ${ev.error}`,
      );
    };
    rec.onend = () => {
      active = false;
      opts.onEnd();
    };
  }

  return {
    supported: true,
    start: () => {
      if (active) return;
      attach();
      try {
        rec?.start();
        active = true;
      } catch (err) {
        opts.onError(err instanceof Error ? err.message : "Не удалось начать запись");
      }
    },
    stop: () => {
      try {
        rec?.stop();
      } catch {
        /* ignore */
      }
      active = false;
    },
  };
}

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m));
}

export function createMicRecorder(): {
  supported: boolean;
  start: () => Promise<void>;
  stop: () => Promise<Blob | null>;
} {
  let stream: MediaStream | null = null;
  let rec: MediaRecorder | null = null;
  let chunks: Blob[] = [];

  function release() {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    rec = null;
  }

  return {
    supported: micCaptureSupported(),
    start: async () => {
      release();
      chunks = [];
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const mime = pickMime();
      rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.start(250);
    },
    stop: () =>
      new Promise((resolve) => {
        const current = rec;
        if (!current || current.state === "inactive") {
          release();
          resolve(null);
          return;
        }
        current.onstop = () => {
          const blob = new Blob(chunks, { type: current.mimeType || "audio/webm" });
          release();
          resolve(blob.size > 0 ? blob : null);
        };
        try {
          current.stop();
        } catch {
          release();
          resolve(null);
        }
      }),
  };
}

export async function blobToB64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}
