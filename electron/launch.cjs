"use strict";

const { spawn, spawnSync } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

const root = path.join(__dirname, "..");
process.chdir(root);

function waitFor(url, ms) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(true);
      });
      req.on("error", () => {
        if (Date.now() - start > ms) reject(new Error("UI не поднялся за " + ms / 1000 + "с"));
        else setTimeout(tick, 600);
      });
      req.setTimeout(1500, () => req.destroy());
    };
    tick();
  });
}

function run(cmd, args, extra) {
  return spawnSync(cmd, args, {
    stdio: "inherit",
    shell: true,
    cwd: root,
    ...extra,
  });
}

async function main() {
  console.log("LocalAgent 0.1_beta");
  if (!fs.existsSync(path.join(root, "node_modules", "react"))) {
    console.log("Ставлю зависимости (первый запуск)…");
    const r = run("npm", ["install"]);
    if (r.status) process.exit(r.status || 1);
  }
  const electronCli = path.join(root, "node_modules", "electron", "cli.js");
  if (!fs.existsSync(electronCli)) {
    console.log("Ставлю Electron…");
    const r = run("npm", ["install", "electron@33.4.11", "--save-dev"]);
    if (r.status) process.exit(r.status || 1);
  }

  const env = { ...process.env, ELECTRON_START_URL: "http://127.0.0.1:8080" };
  const already = await new Promise((resolve) => {
    const req = http.get("http://127.0.0.1:8080/", (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });

  let server = null;
  if (!already) {
    server = spawn("npm", ["run", "dev"], {
      stdio: "inherit",
      shell: true,
      cwd: root,
      env,
    });
    await waitFor("http://127.0.0.1:8080/", 120000);
  }

  const el = spawn("npx", ["electron", "electron/main.cjs"], {
    stdio: "inherit",
    shell: true,
    cwd: root,
    env,
  });

  const shutdown = () => {
    try {
      el.kill();
    } catch {
      /* ignore */
    }
    if (server) {
      try {
        server.kill();
      } catch {
        /* ignore */
      }
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  el.on("exit", (code) => {
    if (server) server.kill();
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
