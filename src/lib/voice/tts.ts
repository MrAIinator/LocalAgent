import { createServerFn } from "@tanstack/react-start";

export const speakGrok = createServerFn({ method: "POST" })
  .validator((input: { text: string; lang?: string }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "no-key" };
    const text = data.text.replace(/\s+/g, " ").trim().slice(0, 900);
    if (!text) return { ok: false as const, error: "empty" };
    const lang = (data.lang || "ru-RU").toLowerCase().startsWith("ru") ? "ru" : "en";

    const res = await fetch("https://api.x.ai/v1/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ text, voice_id: "eve", language: lang }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false as const,
        error: `tts ${res.status}${body ? `: ${body.slice(0, 120)}` : ""}`,
      };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type") || "audio/mpeg";
    return { ok: true as const, mime, audio: buf.toString("base64") };
  });

let current: HTMLAudioElement | SpeechSynthesisUtterance | null = null;

export function stopSpeech() {
  if (typeof window === "undefined") return;
  if (current instanceof HTMLAudioElement) {
    current.pause();
    current.src = "";
  }
  window.speechSynthesis?.cancel();
  current = null;
}

function localSpeak(text: string, lang: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve();
      return;
    }
    const u = new SpeechSynthesisUtterance(text.slice(0, 900));
    u.lang = lang || "ru-RU";
    const voices = window.speechSynthesis.getVoices();
    const want = (lang || "ru").slice(0, 2).toLowerCase();
    const match =
      voices.find((v) => v.lang.toLowerCase().startsWith(want)) ||
      voices.find((v) => v.lang.toLowerCase().startsWith("ru"));
    if (match) u.voice = match;
    u.rate = 1.02;
    u.onend = () => {
      current = null;
      resolve();
    };
    u.onerror = () => {
      current = null;
      resolve();
    };
    current = u;
    window.speechSynthesis.speak(u);
  });
}

export async function speakReply(text: string, lang: string): Promise<void> {
  stopSpeech();
  const clean = text.replace(/```[\s\S]*?```/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return;
  try {
    const r = await speakGrok({ data: { text: clean, lang } });
    if (r.ok) {
      const url = `data:${r.mime};base64,${r.audio}`;
      const audio = new Audio(url);
      current = audio;
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          current = null;
          resolve();
        };
        audio.onerror = () => reject(new Error("audio"));
        void audio.play();
      });
      return;
    }
  } catch {
    /* fallback */
  }
  await localSpeak(clean, lang);
}
