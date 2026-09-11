import { createServerFn } from "@tanstack/react-start";
import type { ToolCall } from "@/lib/agent/types";

export type HostInfo = {
  version: string;
  os: string;
  arch: string;
  home: string;
  hostname: string;
  tmp: string;
  cwd: string;
  user: string;
};

export type HostEntry = {
  path: string;
  name: string;
  kind: "file" | "dir" | "drive";
  size: number;
  mime?: string;
  mtime?: number;
  image?: boolean;
  archive?: boolean;
  favorite?: boolean;
};

export type RootsPayload = {
  info: HostInfo;
  drives: HostEntry[];
  favorites: HostEntry[];
};

export type ListPayload = {
  path: string;
  truncated: boolean;
  entries: HostEntry[];
};

export type ReadPayload = {
  kind: "text" | "image" | "binary";
  path: string;
  mime: string;
  size: number;
  text: string;
  binary: boolean;
  dataUrl?: string;
  archive?: boolean;
};

export type ExecPayload = {
  ok: boolean;
  result: string;
  image?: string;
};

async function ops() {
  const { createRequire } = await import("node:module");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const { existsSync } = await import("node:fs");
  const require = createRequire(import.meta.url);
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(process.cwd(), "electron/fs-host.cjs"),
    join(here, "../../../electron/fs-host.cjs"),
    join(here, "../../electron/fs-host.cjs"),
    join(here, "../electron/fs-host.cjs"),
    join(here, "electron/fs-host.cjs"),
  ];
  const file = candidates.find((p) => existsSync(p));
  if (!file) throw new Error("Не найден electron/fs-host.cjs");
  return require(file) as {
    hostInfo: () => Promise<HostInfo>;
    listRoots: () => Promise<RootsPayload>;
    listDir: (p: string) => Promise<ListPayload>;
    readFile: (p: string) => Promise<ReadPayload>;
    writeFile: (p: string, content: string) => Promise<{ path: string; size: number }>;
    writeBytes: (p: string, b64: string) => Promise<{ path: string; size: number }>;
    mkdir: (p: string) => Promise<{ path: string }>;
    deletePath: (p: string) => Promise<{ path: string }>;
    copyPath: (s: string, d: string) => Promise<{ src: string; dest: string }>;
    movePath: (s: string, d: string) => Promise<{ src: string; dest: string }>;
    unpackArchive: (p: string, d?: string) => Promise<{ path: string; dest: string; count: number }>;
    packArchive: (p: string, d?: string) => Promise<{ path: string; size: number }>;
    tree: (p?: string, depth?: number) => Promise<HostEntry[]>;
    searchFiles: (q: string, p?: string) => Promise<{ path: string; snippet: string }[]>;
    ensurePlayground: () => Promise<{ dir: string; zip: string }>;
    exec: (call: { name: string; args: Record<string, unknown> }) => Promise<ExecPayload>;
  };
}

export const hostInfoFn = createServerFn({ method: "POST" }).handler(async () => {
  const m = await ops();
  return m.hostInfo();
});

export const listRootsFn = createServerFn({ method: "POST" }).handler(async () => {
  const m = await ops();
  return m.listRoots();
});

export const listDirFn = createServerFn({ method: "POST" })
  .validator((input: { path: string }) => input)
  .handler(async ({ data }) => {
    const m = await ops();
    return m.listDir(data.path);
  });

export const readFileFn = createServerFn({ method: "POST" })
  .validator((input: { path: string }) => input)
  .handler(async ({ data }) => {
    const m = await ops();
    return m.readFile(data.path);
  });

export const writeFileFn = createServerFn({ method: "POST" })
  .validator((input: { path: string; content: string }) => input)
  .handler(async ({ data }) => {
    const m = await ops();
    return m.writeFile(data.path, data.content);
  });

export const writeBytesFn = createServerFn({ method: "POST" })
  .validator((input: { path: string; base64: string }) => input)
  .handler(async ({ data }) => {
    const m = await ops();
    return m.writeBytes(data.path, data.base64);
  });

export const execFn = createServerFn({ method: "POST" })
  .validator((input: { name: string; args: Record<string, unknown> }) => input)
  .handler(async ({ data }) => {
    const m = await ops();
    return m.exec(data);
  });

export const ensurePlaygroundFn = createServerFn({ method: "POST" }).handler(
  async () => {
    const m = await ops();
    return m.ensurePlayground();
  },
);

export type ToolExecInput = Pick<ToolCall, "name" | "args">;
