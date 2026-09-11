export type { VFS, VNode, DirEntry } from "./types";
import {
  type DirEntry,
  type VFS,
  type VNode,
  baseName,
  guessMime,
  isTextMime,
  joinPath,
  normalizePath,
  parentPath,
} from "./types";

export function emptyVfs(): VFS {
  const now = Date.now();
  return {
    nodes: {
      "/": { kind: "dir", name: "/", size: 0, updatedAt: now },
    },
  };
}

export function ensureDir(vfs: VFS, path: string): VFS {
  const n = normalizePath(path);
  const nodes = { ...vfs.nodes };
  const now = Date.now();
  if (!nodes["/"]) nodes["/"] = { kind: "dir", name: "/", size: 0, updatedAt: now };
  if (n === "/") return { nodes };
  const parts = n.split("/").filter(Boolean);
  let cur = "";
  for (const part of parts) {
    cur = cur + "/" + part;
    const existing = nodes[cur];
    if (existing?.kind === "file") {
      throw new Error(`Нельзя создать папку: ${cur} — это файл`);
    }
    if (!existing) {
      nodes[cur] = { kind: "dir", name: part, size: 0, updatedAt: now };
    }
  }
  return { nodes };
}

export function writeFile(
  vfs: VFS,
  path: string,
  content: string,
  encoding: "utf8" | "base64" = "utf8",
  mime?: string,
): VFS {
  const n = normalizePath(path);
  if (n === "/") throw new Error("Нельзя записать корень");
  const parent = parentPath(n);
  let next = ensureDir(vfs, parent);
  const now = Date.now();
  const name = baseName(n);
  const size =
    encoding === "base64"
      ? Math.floor((content.length * 3) / 4)
      : new Blob([content]).size;
  next = {
    nodes: {
      ...next.nodes,
      [n]: {
        kind: "file",
        name,
        content,
        encoding,
        mime: mime ?? guessMime(name),
        size,
        updatedAt: now,
      },
    },
  };
  return next;
}

export function mkdir(vfs: VFS, path: string): VFS {
  return ensureDir(vfs, path);
}

export function exists(vfs: VFS, path: string): boolean {
  return Boolean(vfs.nodes[normalizePath(path)]);
}

export function getNode(vfs: VFS, path: string): VNode | undefined {
  return vfs.nodes[normalizePath(path)];
}

export function listDir(vfs: VFS, path: string): DirEntry[] {
  const n = normalizePath(path);
  const dir = vfs.nodes[n];
  if (!dir) throw new Error(`Нет такой папки: ${n}`);
  if (dir.kind !== "dir") throw new Error(`${n} — это файл`);
  const entries: DirEntry[] = [];
  for (const [p, node] of Object.entries(vfs.nodes)) {
    if (p === n || p === "/") continue;
    const parent = parentPath(p);
    if (parent !== n) continue;
    entries.push({
      path: p,
      name: node.name,
      kind: node.kind,
      size: node.size,
      mime: node.mime,
      updatedAt: node.updatedAt,
    });
  }
  return entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name, "ru");
  });
}

export function allNodes(
  vfs: VFS,
): { path: string; kind: "file" | "dir"; size: number }[] {
  return Object.entries(vfs.nodes).map(([path, n]) => ({
    path,
    kind: n.kind,
    size: n.size,
  }));
}

export function readFile(vfs: VFS, path: string): VNode {
  const n = normalizePath(path);
  const node = vfs.nodes[n];
  if (!node) throw new Error(`Нет файла: ${n}`);
  if (node.kind !== "file") throw new Error(`${n} — это папка`);
  return node;
}

function descendants(vfs: VFS, path: string): string[] {
  const n = normalizePath(path);
  if (n === "/") return Object.keys(vfs.nodes);
  const prefix = n + "/";
  return Object.keys(vfs.nodes).filter((p) => p === n || p.startsWith(prefix));
}

export function deletePath(vfs: VFS, path: string): VFS {
  const n = normalizePath(path);
  if (n === "/") throw new Error("Нельзя удалить корень");
  if (!vfs.nodes[n]) throw new Error(`Нет такого пути: ${n}`);
  const drop = new Set(descendants(vfs, n));
  const nodes = { ...vfs.nodes };
  for (const p of drop) delete nodes[p];
  return { nodes };
}

export function copyPath(vfs: VFS, src: string, dest: string): VFS {
  const s = normalizePath(src);
  let d = normalizePath(dest);
  const source = vfs.nodes[s];
  if (!source) throw new Error(`Нет источника: ${s}`);
  const destNode = vfs.nodes[d];
  if (destNode?.kind === "dir") {
    d = joinPath(d, baseName(s));
  }
  if (s === d) return vfs;
  if (d === "/" || d.startsWith(s + "/")) {
    throw new Error("Нельзя копировать папку саму в себя");
  }
  let next = vfs;
  const paths = descendants(vfs, s).sort();
  for (const p of paths) {
    const rel = p === s ? "" : p.slice(s.length);
    const target = d + rel;
    const node = vfs.nodes[p];
    if (node.kind === "dir") next = ensureDir(next, target);
    else
      next = writeFile(
        next,
        target,
        node.content ?? "",
        node.encoding ?? "utf8",
        node.mime,
      );
  }
  return next;
}

export function movePath(vfs: VFS, src: string, dest: string): VFS {
  const s = normalizePath(src);
  if (s === "/") throw new Error("Нельзя переместить корень");
  let next = copyPath(vfs, s, dest);
  next = deletePath(next, s);
  return next;
}

export function search(
  vfs: VFS,
  query: string,
  root = "/",
): { path: string; snippet: string }[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const prefix = normalizePath(root);
  const hits: { path: string; snippet: string }[] = [];
  for (const [path, node] of Object.entries(vfs.nodes)) {
    if (path === "/") continue;
    if (prefix !== "/" && path !== prefix && !path.startsWith(prefix + "/"))
      continue;
    const nameHit = node.name.toLowerCase().includes(q);
    let snippet = "";
    if (
      node.kind === "file" &&
      node.encoding !== "base64" &&
      isTextMime(node.mime, node.name) &&
      node.content
    ) {
      const idx = node.content.toLowerCase().indexOf(q);
      if (idx >= 0) {
        snippet = node.content.slice(Math.max(0, idx - 40), idx + q.length + 40);
      }
    }
    if (nameHit || snippet) {
      hits.push({
        path,
        snippet: snippet || (nameHit ? "имя файла" : ""),
      });
    }
    if (hits.length >= 40) break;
  }
  return hits;
}

export function importBlob(
  vfs: VFS,
  path: string,
  data: ArrayBuffer,
  mime: string,
  name: string,
): VFS {
  const bytes = new Uint8Array(data);
  if (isTextMime(mime, name) && bytes.byteLength < 512 * 1024) {
    const text = new TextDecoder().decode(bytes);
    return writeFile(vfs, path, text, "utf8", mime);
  }
  const b64 = bufferToBase64(bytes);
  return writeFile(vfs, path, b64, "base64", mime);
}

export function bufferToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
