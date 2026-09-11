import {
  type DirEntry,
  baseName,
  guessMime,
  isTextMime,
  joinPath,
  normalizePath,
  parentPath,
} from "./types";

let root: FileSystemDirectoryHandle | null = null;
let rootName: string | null = null;

export function getNativeRoot(): {
  handle: FileSystemDirectoryHandle;
  name: string;
} | null {
  if (!root || !rootName) return null;
  return { handle: root, name: rootName };
}

export function clearNativeRoot() {
  root = null;
  rootName = null;
}

export function nativeSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function pickNativeFolder(): Promise<{ name: string }> {
  const handle = await window.showDirectoryPicker({ mode: "readwrite" });
  if (typeof handle.requestPermission === "function") {
    const perm = await handle.requestPermission({ mode: "readwrite" });
    if (perm !== "granted") throw new Error("Нет доступа к папке");
  }
  root = handle;
  rootName = handle.name;
  return { name: handle.name };
}

async function walkTo(
  path: string,
  create = false,
): Promise<{ dir: FileSystemDirectoryHandle; name: string }> {
  if (!root) throw new Error("Папка ПК не подключена");
  const n = normalizePath(path);
  const parts = n.split("/").filter(Boolean);
  if (parts.length === 0) return { dir: root, name: "" };
  let dir = root;
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i], { create });
  }
  return { dir, name: parts[parts.length - 1] };
}

async function iterate(
  dir: FileSystemDirectoryHandle,
): Promise<[string, FileSystemHandle][]> {
  const out: [string, FileSystemHandle][] = [];
  for await (const entry of dir.entries()) out.push(entry);
  return out;
}

export async function nativeList(path: string): Promise<DirEntry[]> {
  if (!root) throw new Error("Папка ПК не подключена");
  const n = normalizePath(path);
  let dir = root;
  if (n !== "/") {
    const parts = n.split("/").filter(Boolean);
    for (const part of parts) dir = await dir.getDirectoryHandle(part);
  }
  const entries: DirEntry[] = [];
  for (const [name, handle] of await iterate(dir)) {
    const p = n === "/" ? `/${name}` : `${n}/${name}`;
    if (handle.kind === "directory") {
      entries.push({
        path: p,
        name,
        kind: "dir",
        size: 0,
        updatedAt: Date.now(),
      });
    } else {
      const file = await (handle as FileSystemFileHandle).getFile();
      entries.push({
        path: p,
        name,
        kind: "file",
        size: file.size,
        mime: file.type || guessMime(name),
        updatedAt: file.lastModified,
      });
    }
  }
  return entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name, "ru");
  });
}

export async function nativeTree(
  max = 200,
): Promise<{ path: string; kind: "file" | "dir"; size: number }[]> {
  if (!root) throw new Error("Папка ПК не подключена");
  const out: { path: string; kind: "file" | "dir"; size: number }[] = [
    { path: "/", kind: "dir", size: 0 },
  ];
  async function walk(dir: FileSystemDirectoryHandle, prefix: string) {
    if (out.length >= max) return;
    for (const [name, handle] of await iterate(dir)) {
      if (out.length >= max) return;
      const p = prefix === "/" ? `/${name}` : `${prefix}/${name}`;
      if (handle.kind === "directory") {
        out.push({ path: p, kind: "dir", size: 0 });
        await walk(handle as FileSystemDirectoryHandle, p);
      } else {
        try {
          const file = await (handle as FileSystemFileHandle).getFile();
          out.push({ path: p, kind: "file", size: file.size });
        } catch {
          out.push({ path: p, kind: "file", size: 0 });
        }
      }
    }
  }
  await walk(root, "/");
  return out;
}

export async function nativeRead(path: string): Promise<{
  text?: string;
  binary?: ArrayBuffer;
  mime: string;
  size: number;
  name: string;
}> {
  const { dir, name } = await walkTo(path);
  const fh = await dir.getFileHandle(name);
  const file = await fh.getFile();
  const mime = file.type || guessMime(name);
  if (isTextMime(mime, name) && file.size < 400_000) {
    return { text: await file.text(), mime, size: file.size, name };
  }
  return { binary: await file.arrayBuffer(), mime, size: file.size, name };
}

export async function nativeWrite(path: string, content: string) {
  const { dir, name } = await walkTo(path, true);
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(content);
  await w.close();
}

export async function nativeWriteBytes(
  path: string,
  data: ArrayBuffer | Uint8Array,
) {
  const { dir, name } = await walkTo(path, true);
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(new Blob([data as BlobPart]));
  await w.close();
}

export async function nativeMkdir(path: string) {
  if (!root) throw new Error("Папка ПК не подключена");
  const n = normalizePath(path);
  const parts = n.split("/").filter(Boolean);
  let dir = root;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create: true });
  }
}

export async function nativeDelete(path: string) {
  const n = normalizePath(path);
  if (n === "/") throw new Error("Нельзя удалить корень");
  if (!root) throw new Error("Папка ПК не подключена");
  const parent = parentPath(n);
  const name = baseName(n);
  let dir = root;
  if (parent !== "/") {
    const parts = parent.split("/").filter(Boolean);
    for (const part of parts) dir = await dir.getDirectoryHandle(part);
  }
  await dir.removeEntry(name, { recursive: true });
}

export async function nativeCopy(src: string, dest: string) {
  const srcRead = await nativeRead(src);
  let d = normalizePath(dest);
  try {
    await nativeList(d);
    d = joinPath(d, baseName(src));
  } catch {
    /* dest is a new file path */
  }
  if (srcRead.text !== undefined) await nativeWrite(d, srcRead.text);
  else if (srcRead.binary) await nativeWriteBytes(d, srcRead.binary);
}

export async function nativeMove(src: string, dest: string) {
  await nativeCopy(src, dest);
  await nativeDelete(src);
}

export async function nativeSearch(
  query: string,
  path = "/",
): Promise<{ path: string; snippet: string }[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const tree = await nativeTree(400);
  const hits: { path: string; snippet: string }[] = [];
  const rootPrefix = normalizePath(path);
  for (const node of tree) {
    if (node.kind !== "file") continue;
    if (
      rootPrefix !== "/" &&
      node.path !== rootPrefix &&
      !node.path.startsWith(rootPrefix + "/")
    )
      continue;
    const nameHit = baseName(node.path).toLowerCase().includes(q);
    let snippet = "";
    if (isTextMime(undefined, node.path) && node.size < 200_000) {
      try {
        const r = await nativeRead(node.path);
        if (r.text) {
          const idx = r.text.toLowerCase().indexOf(q);
          if (idx >= 0)
            snippet = r.text.slice(Math.max(0, idx - 40), idx + q.length + 40);
        }
      } catch {
        /* skip */
      }
    }
    if (nameHit || snippet) {
      hits.push({ path: node.path, snippet: snippet || "имя файла" });
    }
    if (hits.length >= 30) break;
  }
  return hits;
}
