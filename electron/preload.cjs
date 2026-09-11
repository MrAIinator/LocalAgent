"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("localAgent", {
  isElectron: true,
  version: "0.1_beta",
  fs: {
    hostInfo: () => ipcRenderer.invoke("fs:hostInfo"),
    listRoots: () => ipcRenderer.invoke("fs:listRoots"),
    listDir: (p) => ipcRenderer.invoke("fs:listDir", p),
    readFile: (p) => ipcRenderer.invoke("fs:readFile", p),
    writeFile: (p, content) => ipcRenderer.invoke("fs:writeFile", p, content),
    writeBytes: (p, b64) => ipcRenderer.invoke("fs:writeBytes", p, b64),
    mkdir: (p) => ipcRenderer.invoke("fs:mkdir", p),
    deletePath: (p) => ipcRenderer.invoke("fs:deletePath", p),
    copyPath: (src, dest) => ipcRenderer.invoke("fs:copyPath", src, dest),
    movePath: (src, dest) => ipcRenderer.invoke("fs:movePath", src, dest),
    unpackArchive: (p, dest) => ipcRenderer.invoke("fs:unpackArchive", p, dest),
    packArchive: (p, dest) => ipcRenderer.invoke("fs:packArchive", p, dest),
    tree: (p, depth) => ipcRenderer.invoke("fs:tree", p, depth),
    searchFiles: (q, p) => ipcRenderer.invoke("fs:searchFiles", q, p),
    ensurePlayground: () => ipcRenderer.invoke("fs:ensurePlayground"),
    exec: (call) => ipcRenderer.invoke("fs:exec", call),
  },
  window: {
    minimize: () => ipcRenderer.invoke("win:minimize"),
    maximize: () => ipcRenderer.invoke("win:maximize"),
    close: () => ipcRenderer.invoke("win:close"),
  },
});
