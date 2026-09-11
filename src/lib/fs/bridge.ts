import {
  ensurePlaygroundFn,
  execFn,
  hostInfoFn,
  listDirFn,
  listRootsFn,
  readFileFn,
  writeBytesFn,
  writeFileFn,
  type ExecPayload,
  type HostInfo,
  type ListPayload,
  type ReadPayload,
  type RootsPayload,
} from "./host";

export type { ExecPayload, HostInfo, ListPayload, ReadPayload, RootsPayload };

type ElectronBridge = {
  isElectron: boolean;
  version: string;
  fs: {
    hostInfo: () => Promise<HostInfo>;
    listRoots: () => Promise<RootsPayload>;
    listDir: (p: string) => Promise<ListPayload>;
    readFile: (p: string) => Promise<ReadPayload>;
    writeFile: (p: string, content: string) => Promise<{ path: string; size: number }>;
    writeBytes: (p: string, b64: string) => Promise<{ path: string; size: number }>;
    exec: (call: { name: string; args: Record<string, unknown> }) => Promise<ExecPayload>;
    ensurePlayground: () => Promise<{ dir: string; zip: string }>;
  };
  window?: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
  };
};

declare global {
  interface Window {
    localAgent?: ElectronBridge;
  }
}

export function isElectron(): boolean {
  return typeof window !== "undefined" && Boolean(window.localAgent?.isElectron);
}

function electron(): ElectronBridge | null {
  if (typeof window === "undefined") return null;
  return window.localAgent ?? null;
}

export async function bridgeHostInfo(): Promise<HostInfo> {
  const el = electron();
  if (el) return el.fs.hostInfo();
  return hostInfoFn();
}

export async function bridgeListRoots(): Promise<RootsPayload> {
  const el = electron();
  if (el) return el.fs.listRoots();
  return listRootsFn();
}

export async function bridgeListDir(path: string): Promise<ListPayload> {
  const el = electron();
  if (el) return el.fs.listDir(path);
  return listDirFn({ data: { path } });
}

export async function bridgeReadFile(path: string): Promise<ReadPayload> {
  const el = electron();
  if (el) return el.fs.readFile(path);
  return readFileFn({ data: { path } });
}

export async function bridgeWriteFile(path: string, content: string) {
  const el = electron();
  if (el) return el.fs.writeFile(path, content);
  return writeFileFn({ data: { path, content } });
}

export async function bridgeWriteBytes(path: string, base64: string) {
  const el = electron();
  if (el) return el.fs.writeBytes(path, base64);
  return writeBytesFn({ data: { path, base64 } });
}

export async function bridgeExec(call: {
  name: string;
  args: Record<string, unknown>;
}): Promise<ExecPayload> {
  const el = electron();
  if (el) return el.fs.exec(call);
  return execFn({ data: call });
}

export async function bridgeEnsurePlayground() {
  const el = electron();
  if (el) return el.fs.ensurePlayground();
  return ensurePlaygroundFn();
}

export function windowControls() {
  return electron()?.window ?? null;
}
