export type FileEncoding = "utf8" | "base64";

export type VNode = {
  kind: "file" | "dir";
  name: string;
  encoding?: FileEncoding;
  content?: string;
  mime?: string;
  size: number;
  updatedAt: number;
};

export type VFS = {
  nodes: Record<string, VNode>;
};

export type DirEntry = {
  path: string;
  name: string;
  kind: "file" | "dir";
  size: number;
  mime?: string;
  updatedAt: number;
};

export type WorkspaceMode = "demo" | "native";

export function normalizePath(input: string): string {
  const raw = input.trim() || "/";
  const parts = raw.replace(/\\/g, "/").split("/").filter((p) => p && p !== ".");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "..") out.pop();
    else out.push(part);
  }
  return "/" + out.join("/");
}

export function parentPath(path: string): string {
  const n = normalizePath(path);
  if (n === "/") return "/";
  const i = n.lastIndexOf("/");
  return i <= 0 ? "/" : n.slice(0, i);
}

export function baseName(path: string): string {
  const n = normalizePath(path);
  if (n === "/") return "/";
  return n.slice(n.lastIndexOf("/") + 1);
}

export function joinPath(dir: string, name: string): string {
  const d = normalizePath(dir);
  const clean = name.replace(/^\/+/, "");
  return d === "/" ? `/${clean}` : `${d}/${clean}`;
}

export function isTextMime(mime?: string, name?: string): boolean {
  if (mime?.startsWith("text/")) return true;
  if (
    mime &&
    [
      "application/json",
      "application/javascript",
      "application/xml",
      "application/x-sh",
    ].includes(mime)
  ) {
    return true;
  }
  const ext = (name ?? "").split(".").pop()?.toLowerCase();
  return [
    "txt",
    "md",
    "json",
    "js",
    "ts",
    "tsx",
    "jsx",
    "css",
    "html",
    "xml",
    "yml",
    "yaml",
    "toml",
    "ini",
    "csv",
    "log",
    "py",
    "rs",
    "go",
    "java",
    "c",
    "h",
    "cpp",
    "sh",
    "env",
    "svg",
    "gitignore",
    "map",
  ].includes(ext ?? "");
}

export function guessMime(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
    html: "text/html",
    css: "text/css",
    js: "text/javascript",
    ts: "text/typescript",
    tsx: "text/typescript",
    jsx: "text/javascript",
    zip: "application/zip",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
  };
  return map[ext] ?? "application/octet-stream";
}

export function isArchive(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".zip");
}
