import { createServerFn } from "@tanstack/react-start";

export const transcribeAudio = createServerFn({ method: "POST" })
  .validator((input: { audio: string; mime: string }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "no-key" };

    const buf = Buffer.from(data.audio, "base64");
    if (!buf.length) return { ok: false as const, error: "empty" };
    if (buf.length > 8_000_000) return { ok: false as const, error: "too-big" };

    const mime = data.mime || "audio/webm";
    const ext = mime.includes("mp4")
      ? "mp4"
      : mime.includes("mpeg") || mime.includes("mp3")
        ? "mp3"
        : mime.includes("ogg")
          ? "ogg"
          : mime.includes("wav")
            ? "wav"
            : "webm";
    const file = new File([buf], `speech.${ext}`, { type: mime });

    async function post(url: string, extra?: Record<string, string>) {
      const form = new FormData();
      form.append("file", file, file.name);
      if (extra) {
        for (const [k, v] of Object.entries(extra)) form.append(k, v);
      }
      return fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
    }

    let res = await post("https://api.x.ai/v1/stt");
    if (res.status === 404 || res.status === 405) {
      res = await post("https://api.x.ai/v1/audio/transcriptions", {
        model: "whisper-1",
      });
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false as const,
        error: `stt ${res.status}${body ? `: ${body.slice(0, 140)}` : ""}`,
      };
    }
    const json = (await res.json()) as { text?: string };
    const text = (json.text ?? "").trim();
    if (!text) return { ok: false as const, error: "empty" };
    return { ok: true as const, text };
  });
