"use strict";

const { spawn, spawnSync } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

const root = path.join(__dirname, "..");
process.chdir(root);

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function run(cmd, args) {
  console.log(">", cmd, args.join(" "));
  return spawnSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    cwd: root,
    env: process.env,
  });
}

function waitFor(url, ms) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(true);
      });
      req.on("error", () => {
        if (Date.now() - start > ms) {
          reject(new Error("UI did not start in " + ms / 1000 + "s"));
        } else setTimeout(tick, 500);
      });
      req.setTimeout(1500, () => req.destroy());
    };
    tick();
  });
}

async function main() {
  console.log("LocalAgent 0.1_beta launcher");

  if (!exists(path.join(root, "node_modules", "vite", "bin", "vite.js"))) {
    console.log("Installing npm packages...");
    const r = run("npm", ["install", "--include=dev", "--no-fund", "--no-audit"]);
    if (r.status) process.exit(r.status || 1);
  }

  const electronExe = path.join(root, "node_modules", "electron", "dist", "electron.exe");
  const electronBin = path.join(root, "node_modules", "electron", "dist", "electron");
  const electronInstall = path.join(root, "node_modules", "electron", "install.js");
  if (!exists(electronExe) && !exists(electronBin) && exists(electronInstall)) {
    console.log("Downloading Electron binary...");
    run(process.execPath, [electronInstall]);
  }

  const viteJs = path.join(root, "node_modules", "vite", "bin", "vite.js");
  if (!exists(viteJs)) {
    console.error("vite is missing after npm install.");
    process.exit(1);
  }

  const env = { ...process.env, ELECTRON_START_URL: "http://127.0.0.1:8080" };

  let already = false;
  try {
    already = await new Promise((resolve) => {
      const req = http.get("http://127.0.0.1:8080/", (res) => {
        res.resume();
        resolve(true);
      });
      req.on("error", () => resolve(false));
      req.setTimeout(600, () => {
        req.destroy();
        resolve(false);
      });
    });
  } catch {
    already = false;
  }

  let server = null;
  if (!already) {
    console.log("Starting UI server...");
    server = spawn(process.execPath, [viteJs, "--host", "127.0.0.1", "--port", "8080"], {
      stdio: "inherit",
      cwd: root,
      env,
      shell: false,
    });
    server.on("error", (err) => {
      console.error("vite failed:", err.message);
    });
    await waitFor("http://127.0.0.1:8080/", 180000);
  }

  const electronCli = path.join(root, "node_modules", "electron", "cli.js");
  if (!exists(electronCli)) {
    console.error("Electron CLI missing.");
    process.exit(1);
  }

  console.log("Opening window...");
  const el = spawn(process.execPath, [electronCli, path.join(root, "electron", "main.cjs")], {
    stdio: "inherit",
    cwd: root,
    env,
    shell: false,
  });

  const shutdown = () => {
    try {
      el.kill();
    } catch {}
    if (server) {
      try {
        server.kill();
      } catch {}
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  el.on("exit", (code) => {
    if (server) {
      try {
        server.kill();
      } catch {}
    }
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
