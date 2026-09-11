import { create } from "zustand";
import {
  DEFAULT_SETTINGS,
  type Settings,
  type UiMessage,
} from "@/lib/agent/types";
import type { HostEntry, HostInfo, RootsPayload } from "@/lib/fs/host";
import {
  bridgeEnsurePlayground,
  bridgeListDir,
  bridgeListRoots,
} from "@/lib/fs/bridge";

const KEY = "localagent.v0.1";

type PersistShape = {
  settings: Settings;
  messages: UiMessage[];
};

type AgentState = {
  settings: Settings;
  messages: UiMessage[];
  info: HostInfo | null;
  roots: RootsPayload | null;
  listings: Record<string, HostEntry[]>;
  selectedPath: string | null;
  expanded: Record<string, boolean>;
  running: boolean;
  status: string | null;
  mobileTab: "chat" | "files" | "look";
  grokOk: boolean | null;
  listening: boolean;
  speaking: boolean;
  playground: { dir: string; zip: string } | null;
  hydrate: () => Promise<void>;
  refreshRoots: () => Promise<void>;
  loadDir: (path: string) => Promise<void>;
  invalidate: (path?: string) => Promise<void>;
  setSettings: (p: Partial<Settings>) => void;
  setSelected: (path: string | null) => void;
  toggleExpanded: (path: string) => void;
  addMessage: (m: UiMessage) => void;
  patchLastAssistant: (p: Partial<UiMessage>) => void;
  setRunning: (v: boolean, status?: string | null) => void;
  setMobileTab: (t: AgentState["mobileTab"]) => void;
  setGrokOk: (v: boolean) => void;
  setListening: (v: boolean) => void;
  setSpeaking: (v: boolean) => void;
  clearChat: () => void;
};

function load(): PersistShape | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistShape;
  } catch {
    return null;
  }
}

function save(state: AgentState) {
  if (typeof window === "undefined") return;
  const slim: PersistShape = {
    settings: state.settings,
    messages: state.messages.slice(-40).map((m) => ({
      ...m,
      image: m.image ? "[media]" : null,
    })),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(slim));
  } catch {
    /* quota */
  }
}

export const useAgent = create<AgentState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  messages: [],
  info: null,
  roots: null,
  listings: {},
  selectedPath: null,
  expanded: {},
  running: false,
  status: null,
  mobileTab: "chat",
  grokOk: null,
  listening: false,
  speaking: false,
  playground: null,

  hydrate: async () => {
    const saved = load();
    if (saved) {
      set({
        settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) },
        messages: (saved.messages ?? []).map((m) =>
          m.image === "[media]" ? { ...m, image: null } : m,
        ),
      });
    }
    try {
      const [roots, playground] = await Promise.all([
        bridgeListRoots(),
        bridgeEnsurePlayground().catch(() => null),
      ]);
      const expanded: Record<string, boolean> = {};
      for (const f of roots.favorites) expanded[f.path] = false;
      const shot =
        roots.favorites.find((f) => /скрин|screen/i.test(f.name)) ??
        roots.favorites.find((f) => f.name === "Workspace") ??
        roots.favorites[0] ??
        null;
      set({
        info: roots.info,
        roots,
        playground,
        expanded: { ...expanded, ...(shot ? { [shot.path]: true } : {}) },
        selectedPath: shot?.path ?? roots.info.home,
      });
      if (shot) await get().loadDir(shot.path);
    } catch (err) {
      console.error(err);
    }
  },

  refreshRoots: async () => {
    const roots = await bridgeListRoots();
    set({ info: roots.info, roots });
  },

  loadDir: async (path: string) => {
    try {
      const listed = await bridgeListDir(path);
      set({ listings: { ...get().listings, [path]: listed.entries } });
    } catch {
      set({ listings: { ...get().listings, [path]: [] } });
    }
  },

  invalidate: async (path?: string) => {
    const st = get();
    if (path && st.listings[path]) await get().loadDir(path);
    else {
      const open = Object.keys(st.listings);
      await Promise.all(open.map((p) => get().loadDir(p)));
    }
    await get().refreshRoots();
  },

  setSettings: (p) => {
    set({ settings: { ...get().settings, ...p } });
    save(get());
  },

  setSelected: (path) => set({ selectedPath: path }),

  toggleExpanded: (path) => {
    const next = !get().expanded[path];
    set({ expanded: { ...get().expanded, [path]: next } });
    if (next && !get().listings[path]) void get().loadDir(path);
  },

  addMessage: (m) => {
    set({ messages: [...get().messages, m] });
    save(get());
  },

  patchLastAssistant: (p) => {
    const messages = [...get().messages];
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        messages[i] = { ...messages[i], ...p };
        break;
      }
    }
    set({ messages });
    save(get());
  },

  setRunning: (v, status = null) => set({ running: v, status }),
  setMobileTab: (t) => set({ mobileTab: t }),
  setGrokOk: (v) => set({ grokOk: v }),
  setListening: (v) => set({ listening: v }),
  setSpeaking: (v) => set({ speaking: v }),
  clearChat: () => {
    set({ messages: [] });
    save(get());
  },
}));
