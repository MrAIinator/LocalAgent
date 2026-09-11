let stream: MediaStream | null = null;
const listeners = new Set<(s: MediaStream | null) => void>();

function emit() {
  for (const fn of listeners) fn(stream);
}

export function onStream(fn: (s: MediaStream | null) => void): () => void {
  listeners.add(fn);
  fn(stream);
  return () => listeners.delete(fn);
}

export function getStream(): MediaStream | null {
  return stream;
}

export async function startCapture(): Promise<MediaStream> {
  if (stream) return stream;
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("Этот браузер не умеет захватывать экран");
  }
  const next = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 8 },
    audio: false,
  });
  const track = next.getVideoTracks()[0];
  if (track) {
    track.addEventListener("ended", () => {
      stopCapture();
    });
  }
  stream = next;
  emit();
  return next;
}

export function stopCapture() {
  if (!stream) return;
  for (const t of stream.getTracks()) t.stop();
  stream = null;
  emit();
}

export async function grabFrame(): Promise<string | null> {
  if (!stream) return null;
  const track = stream.getVideoTracks()[0];
  if (!track) return null;
  const video = document.createElement("video");
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  await new Promise((r) => setTimeout(r, 40));
  const w = video.videoWidth || 1280;
  const h = video.videoHeight || 720;
  const maxW = 1024;
  const scale = w > maxW ? maxW / w : 1;
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, cw, ch);
  video.pause();
  video.srcObject = null;
  return canvas.toDataURL("image/jpeg", 0.55);
}
