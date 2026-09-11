import { create } from "zustand";
import {
  DEFAULT_SETTINGS,
  type Settings,
  type UiMessage,
} from "@/lib/agent/types";
import { type VFS } from "@/lib/fs/types";
import { seedVfs, seedVfsSync } from "@/lib/fs/seed";

const KEY = "hand.v1";

type PersistShape = {
  settings: Settings;
  vfs: VFS;
  messages: UiMessage[];
};

type HandState = {
  hydrated: boolean;
  settings: Settings;
  vfs: VFS;
  messages: UiMessage[];
  mode: "demo" | "native";
  nativeName: string | null;
  selectedPath: string | null;
  expanded: Record<string, boolean>;
  running: boolean;
  status: string | null;
  mobileTab: "chat" | "files" | "look";
  grokOk: boolean | null;
  hydrate: () => Promise<void>;
  setSettings: (p: Partial<Settings>) => void;
  setVfs: (vfs: VFS) => void;
  setMode: (mode: "demo" | "native", name?: string | null) => void;
  setSelected: (path: string | null) => void;
  toggleExpanded: (path: string) => void;
  addMessage: (m: UiMessage) => void;
  patchLastAssistant: (p: Partial<UiMessage>) => void;
  setRunning: (v: boolean, status?: string | null) => void;
  setMobileTab: (t: HandState["mobileTab"]) => void;
  setGrokOk: (v: boolean) => void;
  resetDemo: () => Promise<void>;
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

function save(state: HandState) {
  if (typeof window === "undefined") return;
  const slim: PersistShape = {
    settings: state.settings,
    vfs: state.vfs,
    messages: state.messages.slice(-40).map((m) => ({
      ...m,
      image: m.image ? "[screen]" : null,
    })),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(slim));
  } catch {
    /* quota */
  }
}

export const useHand = create<HandState>((set, get) => ({
  hydrated: true,
  settings: DEFAULT_SETTINGS,
  vfs: seedVfsSync(),
  messages: [],
  mode: "demo",
  nativeName: null,
  selectedPath: "/Документы/заметки.md",
  expanded: { "/": true, "/Документы": true, "/Проекты": true, "/Архивы": true },
  running: false,
  status: null,
  mobileTab: "chat",
  grokOk: null,

  hydrate: async () => {
    const saved = load();
    if (saved?.vfs?.nodes) {
      set({
        hydrated: true,
        settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) },
        vfs: saved.vfs,
        messages: (saved.messages ?? []).map((m) =>
          m.image === "[screen]" ? { ...m, image: null } : m,
        ),
      });
      return;
    }
    set({
      hydrated: true,
      vfs: seedVfsSync(),
    });
    const vfs = await seedVfs();
    set({ vfs });
    save(get());
  },

  setSettings: (p) => {
    set({ settings: { ...get().settings, ...p } });
    save(get());
  },

  setVfs: (vfs) => {
    set({ vfs });
    save(get());
  },

  setMode: (mode, name = null) => set({ mode, nativeName: name }),

  setSelected: (path) => set({ selectedPath: path }),

  toggleExpanded: (path) =>
    set({ expanded: { ...get().expanded, [path]: !get().expanded[path] } }),

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

  resetDemo: async () => {
    const vfs = await seedVfs();
    set({
      vfs,
      mode: "demo",
      nativeName: null,
      selectedPath: "/Документы/заметки.md",
      expanded: {
        "/": true,
        "/Документы": true,
        "/Проекты": true,
        "/Архивы": true,
      },
    });
    save(get());
  },

  clearChat: () => {
    set({ messages: [] });
    save(get());
  },
}));
