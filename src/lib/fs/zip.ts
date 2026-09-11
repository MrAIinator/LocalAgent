import JSZip from "jszip";
import { isTextMime, joinPath, normalizePath } from "./types";
import {
  type VFS,
  base64ToBytes,
  bufferToBase64,
  ensureDir,
  readFile,
  writeFile,
} from "./virtual";

export async function unpackZip(
  vfs: VFS,
  zipPath: string,
  destPath?: string,
): Promise<{ vfs: VFS; count: number; dest: string }> {
  const node = readFile(vfs, zipPath);
  if (!node.content) throw new Error("Архив пустой");
  const dest =
    destPath && destPath.trim()
      ? normalizePath(destPath)
      : joinPath(
          zipPath.includes("/")
            ? zipPath.slice(0, zipPath.lastIndexOf("/")) || "/"
            : "/",
          zipPath
            .slice(zipPath.lastIndexOf("/") + 1)
            .replace(/\.zip$/i, ""),
        );

  const zip = await JSZip.loadAsync(node.content, {
    base64: node.encoding === "base64",
  });
  let next = ensureDir(vfs, dest);
  let count = 0;
  const files = Object.values(zip.files);
  for (const entry of files) {
    const rel = entry.name.replace(/^\/+/, "");
    if (!rel) continue;
    const target = joinPath(dest, rel);
    if (entry.dir) {
      next = ensureDir(next, target);
      continue;
    }
    const name = rel.split("/").pop() ?? rel;
    if (isTextMime(undefined, name)) {
      const text = await entry.async("string");
      next = writeFile(next, target, text, "utf8");
    } else {
      const buf = await entry.async("uint8array");
      next = writeFile(next, target, bufferToBase64(buf), "base64");
    }
    count += 1;
  }
  return { vfs: next, count, dest };
}

export async function makeDemoZip(): Promise<{ content: string; size: number }> {
  const zip = new JSZip();
  zip.file(
    "readme.txt",
    "Это демо-архив HAND.\nПопроси агента: распакуй pack.zip в Проекты.\n",
  );
  zip.folder("внутри")?.file(
    "данные.json",
    JSON.stringify({ ok: true, items: ["alpha", "beta"], n: 7 }, null, 2),
  );
  const content = await zip.generateAsync({ type: "base64" });
  const size = Math.floor((content.length * 3) / 4);
  return { content, size };
}

export function fileToUint8(node: {
  content?: string;
  encoding?: "utf8" | "base64";
}): Uint8Array {
  if (!node.content) return new Uint8Array();
  if (node.encoding === "base64") return base64ToBytes(node.content);
  return new TextEncoder().encode(node.content);
}
