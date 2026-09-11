"use strict";

const { app, BrowserWindow, ipcMain, shell, desktopCapturer } = require("electron");
const path = require("path");
const http = require("http");
const ops = require("./fs-host.cjs");

let win = null;

app.setName("LocalAgent");
app.commandLine.appendSwitch("enable-speech-dispatcher");
app.commandLine.appendSwitch("enable-features", "WebSpeechAPI,MediaFoundationVideoCapture");

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0a0b0c",
    title: "LocalAgent 0.1_beta",
    autoHideMenuBar: true,
    frame: false,
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  const startUrl = process.env.ELECTRON_START_URL || "http://127.0.0.1:8080";
  void win.loadURL(startUrl);
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  const allow = new Set([
    "media",
    "display-capture",
    "mediaKeySystem",
    "audioCapture",
    "videoCapture",
    "clipboard-sanitized-write",
    "notifications",
  ]);

  win.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(allow.has(permission) || permission === "media");
  });
  win.webContents.session.setPermissionCheckHandler((_wc, permission) => {
    return allow.has(permission) || permission === "media" || permission === "display-capture";
  });

  try {
    win.webContents.session.setDisplayMediaRequestHandler(
      (_req, callback) => {
        desktopCapturer
          .getSources({ types: ["screen", "window"] })
          .then((sources) => {
            callback({ video: sources[0] });
          })
          .catch(() => callback({ video: undefined }));
      },
      { useSystemPicker: true },
    );
  } catch {
    /* older electron */
  }
}

function ping(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

app.whenReady().then(async () => {
  const url = process.env.ELECTRON_START_URL || "http://127.0.0.1:8080";
  const up = await ping(url);
  if (!up) {
    console.warn("UI не на " + url + " — запускай LocalAgent.bat / electron/launch.cjs");
  }
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("fs:hostInfo", () => ops.hostInfo());
ipcMain.handle("fs:listRoots", () => ops.listRoots());
ipcMain.handle("fs:listDir", (_e, p) => ops.listDir(p));
ipcMain.handle("fs:readFile", (_e, p) => ops.readFile(p));
ipcMain.handle("fs:writeFile", (_e, p, content) => ops.writeFile(p, content));
ipcMain.handle("fs:writeBytes", (_e, p, b64) => ops.writeBytes(p, b64));
ipcMain.handle("fs:mkdir", (_e, p) => ops.mkdir(p));
ipcMain.handle("fs:deletePath", (_e, p) => ops.deletePath(p));
ipcMain.handle("fs:copyPath", (_e, src, dest) => ops.copyPath(src, dest));
ipcMain.handle("fs:movePath", (_e, src, dest) => ops.movePath(src, dest));
ipcMain.handle("fs:unpackArchive", (_e, p, dest) => ops.unpackArchive(p, dest));
ipcMain.handle("fs:packArchive", (_e, p, dest) => ops.packArchive(p, dest));
ipcMain.handle("fs:tree", (_e, p, depth) => ops.tree(p, depth));
ipcMain.handle("fs:searchFiles", (_e, q, p) => ops.searchFiles(q, p));
ipcMain.handle("fs:ensurePlayground", () => ops.ensurePlayground());
ipcMain.handle("fs:exec", (_e, call) => ops.exec(call));

ipcMain.handle("win:minimize", () => win?.minimize());
ipcMain.handle("win:maximize", () => {
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});
ipcMain.handle("win:close", () => win?.close());
