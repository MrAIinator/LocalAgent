"use strict";

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const os = require("os");
const JSZip = require("jszip");

const APP_VERSION = "0.1_beta";
const MAX_LIST = 700;
const MAX_READ = 14_000;
const MAX_IMAGE = 2_800_000;
const MAX_WRITE_B64 = 12_000_000;
const MAX_TREE = 120;
const MAX_SEARCH_WALK = 500;
const MAX_SEARCH_HITS = 40;

const BLOCKED = ["/proc", "/sys", "/dev"];
const SKIP_NAMES = new Set([
  "proc",
  "sys",
  "dev",
  "node_modules",
  ".git",
  ".cache",
  "lost+found",
  "$Recycle.Bin",
  "System Volume Information",
  "Recovery",
]);

const TEXT_EXT = new Set([
  "txt","md","json","js","ts","tsx","jsx","css","html","xml","yml","yaml","toml",
  "ini","csv","log","py","rs","go","java","c","h","cpp","sh","env","svg","map",
  "gitignore","conf","cfg","sql","rb","php","vue","svelte","kt","swift","r",
  "pl","lua","bat","ps1","zsh","fish","editorconfig","dockerfile","makefile",
]);

const IMAGE_EXT = new Set(["png","jpg","jpeg","gif","webp","bmp","avif"]);
const ARCHIVE_EXT = new Set(["zip", "tar", "tgz", "gz", "7z", "rar", "bz2"]);

function toUi(p) {
  const resolved = path.resolve(p);
  let n = resolved.replace(/\\/g, "/");
  if (/^[A-Za-z]:$/.test(n)) n += "/";
  if (/^[A-Za-z]:$/.test(resolved)) n = resolved.replace(/\\/g, "/") + "/";
  return n;
}

function toFs(p) {
  if (!p) return path.sep;
  const n = String(p).trim().replace(/\\/g, "/");
  if (process.platform === "win32") {
    if (/^[A-Za-z]:\/?$/.test(n)) return n.slice(0, 2) + "\\";
    return n.replace(/\//g, "\\");
  }
  return n.startsWith("/") ? n : "/" + n;
}

function isBlocked(fsPath) {
  const ui = toUi(fsPath);
  return BLOCKED.some((b) => ui === b || ui.startsWith(b + "/"));
}

function extOf(name) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function guessMime(name) {
  const ext = extOf(name);
  const map = {
    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
    html: "text/html",
    css: "text/css",
    js: "text/javascript",
    ts: "text/typescript",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    zip: "application/zip",
    pdf: "application/pdf",
    bmp: "image/bmp",
  };
  return map[ext] || "application/octet-stream";
}

function isTextName(name, mime) {
  if (mime && mime.startsWith("text/")) return true;
  if (mime && ["application/json", "application/javascript", "application/xml"].includes(mime))
    return true;
  return TEXT_EXT.has(extOf(name));
}

function isImageName(name) {
  return IMAGE_EXT.has(extOf(name));
}

function isArchiveName(name) {
  return ARCHIVE_EXT.has(extOf(name));
}

function clip(text) {
  if (text.length <= MAX_READ) return text;
  return text.slice(0, MAX_READ) + `\n… обрезано, всего ${text.length} символов`;
}

function entryOf(fsPath, dirent, stat) {
  const name = dirent ? dirent.name : path.basename(fsPath);
  const kind = dirent
    ? dirent.isDirectory()
      ? "dir"
      : "file"
    : stat.isDirectory()
      ? "dir"
      : "file";
  const size = stat && kind === "file" ? stat.size : 0;
  return {
    path: toUi(fsPath),
    name: name || toUi(fsPath),
    kind,
    size,
    mime: kind === "file" ? guessMime(name) : undefined,
    mtime: stat ? stat.mtimeMs : undefined,
    image: kind === "file" && isImageName(name),
    archive: kind === "file" && isArchiveName(name),
  };
}

async function hostInfo() {
  const ifaces = os.networkInterfaces();
  void ifaces;
  return {
    version: APP_VERSION,
    os: process.platform,
    arch: process.arch,
    home: toUi(os.homedir()),
    hostname: os.hostname(),
    tmp: toUi(os.tmpdir()),
    cwd: toUi(process.cwd()),
    user: os.userInfo().username,
  };
}

function winDrives() {
  const out = [];
  if (process.platform !== "win32") return out;
  for (let i = 65; i <= 90; i++) {
    const letter = String.fromCharCode(i);
    const root = letter + ":\\";
    try {
      if (fs.existsSync(root)) {
        out.push({
          path: letter + ":/",
          name: letter + ":",
          kind: "drive",
          size: 0,
        });
      }
    } catch {
      /* ignore */
    }
  }
  return out;
}

function linuxRoots() {
  const out = [];
  if (process.platform === "win32") return out;
  out.push({ path: "/", name: "Linux /", kind: "drive", size: 0 });
  for (const extra of ["/mnt", "/media", "/run/media"]) {
    try {
      if (fs.existsSync(extra)) {
        const kids = fs.readdirSync(extra);
        if (kids.length) {
          out.push({
            path: extra,
            name: extra,
            kind: "dir",
            size: 0,
          });
        }
      }
    } catch {
      /* ignore */
    }
  }
  return out;
}

function favoriteCandidates() {
  const home = os.homedir();
  const up = process.env.USERPROFILE || home;
  const list = [
    { path: home, name: "Дом" },
    { path: path.join(os.tmpdir(), "localagent"), name: "Playground" },
    { path: "/workspace", name: "Workspace" },
    { path: path.join("/workspace", "screenshots"), name: "Скриншоты" },
    { path: path.join(home, "Pictures", "Screenshots"), name: "Screenshots" },
    { path: path.join(home, "Pictures"), name: "Pictures" },
    { path: path.join(home, "Изображения", "Скриншоты"), name: "Скриншоты" },
    { path: path.join(home, "Изображения"), name: "Изображения" },
    { path: path.join(home, "Desktop"), name: "Рабочий стол" },
    { path: path.join(home, "Documents"), name: "Документы" },
    { path: path.join(home, "Downloads"), name: "Загрузки" },
    { path: os.tmpdir(), name: "Temp" },
    { path: path.join(up, "Desktop"), name: "Рабочий стол" },
    { path: path.join(up, "Documents"), name: "Документы" },
    { path: path.join(up, "Downloads"), name: "Загрузки" },
    { path: path.join(up, "Pictures"), name: "Изображения" },
    { path: path.join(up, "Pictures", "Screenshots"), name: "Скриншоты" },
    { path: path.join(up, "Videos", "Captures"), name: "Captures" },
    { path: path.join(home, "Videos"), name: "Видео" },
    { path: path.join(up, "Videos"), name: "Видео" },
  ];
  const seen = new Set();
  const out = [];
  for (const c of list) {
    try {
      if (!c.path || !fs.existsSync(c.path)) continue;
      const ui = toUi(c.path);
      if (seen.has(ui)) continue;
      seen.add(ui);
      const st = fs.statSync(c.path);
      if (!st.isDirectory()) continue;
      out.push({
        path: ui,
        name: c.name,
        kind: "dir",
        size: 0,
        favorite: true,
      });
    } catch {
      /* ignore */
    }
  }
  return out;
}

async function listRoots() {
  const info = await hostInfo();
  const drives = process.platform === "win32" ? winDrives() : linuxRoots();
  const favorites = favoriteCandidates();
  return { info, drives, favorites };
}

async function listDir(rawPath) {
  const fsPath = toFs(rawPath || "/");
  if (isBlocked(fsPath)) throw new Error("Системный путь закрыт: " + toUi(fsPath));
  const names = await fsp.readdir(fsPath, { withFileTypes: true });
  const out = [];
  for (const d of names) {
    if (out.length >= MAX_LIST) break;
    if (SKIP_NAMES.has(d.name) && (toUi(fsPath) === "/" || /[A-Za-z]:\/$/.test(toUi(fsPath)))) {
      continue;
    }
    const full = path.join(fsPath, d.name);
    if (isBlocked(full)) continue;
    let st = null;
    try {
      st = await fsp.stat(full);
    } catch {
      continue;
    }
    out.push(entryOf(full, d, st));
  }
  out.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "dir" || a.kind === "drive" ? -1 : 1;
    return a.name.localeCompare(b.name, "ru");
  });
  return { path: toUi(fsPath), truncated: names.length > MAX_LIST, entries: out };
}

async function readFile(rawPath) {
  const fsPath = toFs(rawPath);
  if (isBlocked(fsPath)) throw new Error("Системный путь закрыт");
  const st = await fsp.stat(fsPath);
  if (st.isDirectory()) throw new Error("Это папка, не файл");
  const name = path.basename(fsPath);
  const mime = guessMime(name);
  if (isImageName(name) && st.size <= MAX_IMAGE) {
    const buf = await fsp.readFile(fsPath);
    return {
      kind: "image",
      path: toUi(fsPath),
      mime,
      size: st.size,
      text: "",
      binary: true,
      dataUrl: `data:${mime};base64,${buf.toString("base64")}`,
    };
  }
  if (isTextName(name, mime) && st.size < 4_000_000) {
    const text = await fsp.readFile(fsPath, "utf8");
    return {
      kind: "text",
      path: toUi(fsPath),
      mime,
      size: st.size,
      text,
      binary: false,
    };
  }
  return {
    kind: "binary",
    path: toUi(fsPath),
    mime,
    size: st.size,
    text: "",
    binary: true,
    archive: isArchiveName(name),
  };
}

async function writeFile(rawPath, content) {
  const fsPath = toFs(rawPath);
  if (isBlocked(fsPath)) throw new Error("Системный путь закрыт");
  await fsp.mkdir(path.dirname(fsPath), { recursive: true });
  await fsp.writeFile(fsPath, content, "utf8");
  const st = await fsp.stat(fsPath);
  return { path: toUi(fsPath), size: st.size };
}

async function writeBytes(rawPath, base64) {
  const fsPath = toFs(rawPath);
  if (isBlocked(fsPath)) throw new Error("Системный путь закрыт");
  if (!base64 || base64.length > MAX_WRITE_B64) throw new Error("Файл слишком большой");
  await fsp.mkdir(path.dirname(fsPath), { recursive: true });
  const buf = Buffer.from(base64, "base64");
  await fsp.writeFile(fsPath, buf);
  const st = await fsp.stat(fsPath);
  return { path: toUi(fsPath), size: st.size };
}

async function mkdir(rawPath) {
  const fsPath = toFs(rawPath);
  if (isBlocked(fsPath)) throw new Error("Системный путь закрыт");
  await fsp.mkdir(fsPath, { recursive: true });
  return { path: toUi(fsPath) };
}

async function deletePath(rawPath) {
  const fsPath = toFs(rawPath);
  if (isBlocked(fsPath)) throw new Error("Системный путь закрыт");
  const ui = toUi(fsPath);
  if (ui === "/" || /^[A-Za-z]:\/$/.test(ui)) throw new Error("Нельзя удалить корень диска");
  await fsp.rm(fsPath, { recursive: true, force: true });
  return { path: ui };
}

async function copyPath(src, dest) {
  const from = toFs(src);
  const to = toFs(dest);
  if (isBlocked(from) || isBlocked(to)) throw new Error("Системный путь закрыт");
  await fsp.mkdir(path.dirname(to), { recursive: true });
  await fsp.cp(from, to, { recursive: true, force: true });
  return { src: toUi(from), dest: toUi(to) };
}

async function movePath(src, dest) {
  const from = toFs(src);
  const to = toFs(dest);
  if (isBlocked(from) || isBlocked(to)) throw new Error("Системный путь закрыт");
  await fsp.mkdir(path.dirname(to), { recursive: true });
  try {
    await fsp.rename(from, to);
  } catch {
    await fsp.cp(from, to, { recursive: true, force: true });
    await fsp.rm(from, { recursive: true, force: true });
  }
  return { src: toUi(from), dest: toUi(to) };
}

async function unpackArchive(rawPath, destArg) {
  const fsPath = toFs(rawPath);
  if (isBlocked(fsPath)) throw new Error("Системный путь закрыт");
  if (!/\.zip$/i.test(path.basename(fsPath))) {
    throw new Error("Пока распаковываю только .zip (rar/7z/tar пока нельзя)");
  }
  const dest = destArg
    ? toFs(destArg)
    : fsPath.replace(/\.zip$/i, "");
  if (isBlocked(dest)) throw new Error("Системный путь закрыт");
  const buf = await fsp.readFile(fsPath);
  const zip = await JSZip.loadAsync(buf);
  let count = 0;
  const names = Object.keys(zip.files);
  for (const name of names) {
    const entry = zip.files[name];
    const rel = name.replace(/^\/+/, "");
    if (!rel) continue;
    const target = path.join(dest, rel);
    if (entry.dir) {
      await fsp.mkdir(target, { recursive: true });
      continue;
    }
    await fsp.mkdir(path.dirname(target), { recursive: true });
    const bytes = await entry.async("nodebuffer");
    await fsp.writeFile(target, bytes);
    count += 1;
  }
  return { path: toUi(fsPath), dest: toUi(dest), count };
}

async function packArchive(rawPath, destArg) {
  const fsPath = toFs(rawPath);
  if (isBlocked(fsPath)) throw new Error("Системный путь закрыт");
  const dest = destArg
    ? toFs(destArg)
    : fsPath.replace(/\/$/, "") + ".zip";
  if (isBlocked(dest)) throw new Error("Системный путь закрыт");
  const zip = new JSZip();
  const st = await fsp.stat(fsPath);
  async function addDir(dir, prefix) {
    const items = await fsp.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      if (SKIP_NAMES.has(item.name)) continue;
      const full = path.join(dir, item.name);
      const rel = prefix ? prefix + "/" + item.name : item.name;
      if (item.isDirectory()) {
        zip.folder(rel);
        await addDir(full, rel);
      } else {
        zip.file(rel, await fsp.readFile(full));
      }
    }
  }
  if (st.isDirectory()) await addDir(fsPath, path.basename(fsPath));
  else zip.file(path.basename(fsPath), await fsp.readFile(fsPath));
  const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.writeFile(dest, out);
  return { path: toUi(dest), size: out.length };
}

async function tree(rawPath, depth = 2) {
  const start = toFs(rawPath || os.homedir());
  const out = [];
  async function walk(dir, d) {
    if (out.length >= MAX_TREE || d > depth) return;
    if (isBlocked(dir)) return;
    let items;
    try {
      items = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    items.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    for (const item of items) {
      if (out.length >= MAX_TREE) return;
      if (SKIP_NAMES.has(item.name)) continue;
      const full = path.join(dir, item.name);
      if (isBlocked(full)) continue;
      let size = 0;
      try {
        if (!item.isDirectory()) size = (await fsp.stat(full)).size;
      } catch {
        continue;
      }
      out.push({
        path: toUi(full),
        name: item.name,
        kind: item.isDirectory() ? "dir" : "file",
        size,
        image: !item.isDirectory() && isImageName(item.name),
        archive: !item.isDirectory() && isArchiveName(item.name),
      });
      if (item.isDirectory() && d < depth) await walk(full, d + 1);
    }
  }
  try {
    const st = await fsp.stat(start);
    out.push({
      path: toUi(start),
      name: path.basename(start) || toUi(start),
      kind: st.isDirectory() ? "dir" : "file",
      size: st.isFile() ? st.size : 0,
    });
    if (st.isDirectory()) await walk(start, 0);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : String(err));
  }
  return out;
}

async function searchFiles(query, rawPath) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  const start = toFs(rawPath || os.homedir());
  const hits = [];
  let walked = 0;
  async function walk(dir, d) {
    if (hits.length >= MAX_SEARCH_HITS || walked >= MAX_SEARCH_WALK || d > 6) return;
    if (isBlocked(dir)) return;
    let items;
    try {
      items = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of items) {
      if (hits.length >= MAX_SEARCH_HITS || walked >= MAX_SEARCH_WALK) return;
      if (SKIP_NAMES.has(item.name)) continue;
      const full = path.join(dir, item.name);
      walked += 1;
      const ui = toUi(full);
      const nameHit = item.name.toLowerCase().includes(q);
      if (item.isDirectory()) {
        if (nameHit) hits.push({ path: ui, snippet: "" });
        await walk(full, d + 1);
        continue;
      }
      let snippet = "";
      if (nameHit) {
        hits.push({ path: ui, snippet: "" });
        continue;
      }
      if (isTextName(item.name) && item.name.length) {
        try {
          const st = await fsp.stat(full);
          if (st.size > 0 && st.size < 400_000) {
            const text = await fsp.readFile(full, "utf8");
            const idx = text.toLowerCase().indexOf(q);
            if (idx >= 0) {
              snippet = text.slice(Math.max(0, idx - 40), idx + q.length + 40).replace(/\s+/g, " ");
              hits.push({ path: ui, snippet });
            }
          }
        } catch {
          /* ignore */
        }
      }
    }
  }
  await walk(start, 0);
  return hits;
}

async function ensurePlayground() {
  const dir = path.join(os.tmpdir(), "localagent");
  await fsp.mkdir(dir, { recursive: true });
  const note = path.join(dir, "readme.txt");
  if (!fs.existsSync(note)) {
    await fsp.writeFile(
      note,
      "LocalAgent 0.1_beta playground\nМожно создавать, копировать, удалять и паковать файлы здесь.\n",
      "utf8",
    );
  }
  const zipPath = path.join(dir, "pack.zip");
  if (!fs.existsSync(zipPath)) {
    const zip = new JSZip();
    zip.file("readme.txt", "Это демо-архив LocalAgent.\n");
    zip.file("внутри/данные.json", JSON.stringify({ ok: true, app: "LocalAgent" }, null, 2));
    const buf = await zip.generateAsync({ type: "nodebuffer" });
    await fsp.writeFile(zipPath, buf);
  }
  return { dir: toUi(dir), zip: toUi(zipPath) };
}

function str(args, key, alt) {
  const v = args[key] ?? (alt ? args[alt] : "");
  return v == null ? "" : String(v);
}

async function exec(call) {
  const args = call.args || {};
  const name = call.name;
  try {
    switch (name) {
      case "list_roots": {
        const r = await listRoots();
        const lines = [
          `ОС: ${r.info.os}  host: ${r.info.hostname}  home: ${r.info.home}`,
          "Диски:",
          ...r.drives.map((d) => `  ${d.path}  ${d.name}`),
          "Избранное:",
          ...r.favorites.map((d) => `  ${d.path}  ${d.name}`),
        ];
        return { ok: true, result: lines.join("\n"), roots: r };
      }
      case "tree": {
        const nodes = await tree(str(args, "path") || os.homedir(), Number(args.depth) || 2);
        const lines = nodes.map((n) =>
          n.kind === "dir" ? `${n.path}/` : `${n.path}  ${n.size}`,
        );
        return { ok: true, result: lines.join("\n") || "(пусто)", nodes };
      }
      case "list_dir": {
        const listed = await listDir(str(args, "path") || "/");
        const lines = listed.entries.map((e) =>
          e.kind === "dir" || e.kind === "drive"
            ? `${e.name}/`
            : `${e.name}  ${e.size}${e.image ? "  [img]" : ""}${e.archive ? "  [zip]" : ""}`,
        );
        return {
          ok: true,
          result: `${listed.path}\n${lines.join("\n") || "(пусто)"}${listed.truncated ? "\n… обрезано" : ""}`,
          listed,
        };
      }
      case "read_file": {
        const file = await readFile(str(args, "path"));
        if (file.kind === "image") {
          return {
            ok: true,
            result: `Изображение ${file.path} (${file.size} байт, ${file.mime}). Кадр прикреплён.`,
            image: file.dataUrl,
          };
        }
        if (file.binary) {
          return {
            ok: true,
            result: `Бинарный файл ${file.path} (${file.size} байт, ${file.mime}).${file.archive ? " Это zip — можно распаковать." : ""}`,
          };
        }
        return { ok: true, result: clip(file.text) };
      }
      case "write_file": {
        const r = await writeFile(str(args, "path"), String(args.content ?? ""));
        return { ok: true, result: `Записано ${r.path} (${r.size} байт)` };
      }
      case "mkdir": {
        const r = await mkdir(str(args, "path"));
        return { ok: true, result: `Папка ${r.path}` };
      }
      case "delete_path": {
        const r = await deletePath(str(args, "path"));
        return { ok: true, result: `Удалено ${r.path}` };
      }
      case "copy_path": {
        const r = await copyPath(str(args, "src") || str(args, "from"), str(args, "dest") || str(args, "to"));
        return { ok: true, result: `Скопировано ${r.src} → ${r.dest}` };
      }
      case "move_path": {
        const r = await movePath(str(args, "src") || str(args, "from"), str(args, "dest") || str(args, "to"));
        return { ok: true, result: `Перенесено ${r.src} → ${r.dest}` };
      }
      case "unpack_archive": {
        const r = await unpackArchive(str(args, "path"), str(args, "dest") || undefined);
        return { ok: true, result: `Распаковано ${r.count} файлов в ${r.dest}` };
      }
      case "pack_archive": {
        const r = await packArchive(str(args, "path"), str(args, "dest") || undefined);
        return { ok: true, result: `Архив ${r.path} (${r.size} байт)` };
      }
      case "search_files": {
        const hits = await searchFiles(str(args, "query") || str(args, "q"), str(args, "path") || undefined);
        if (!hits.length) return { ok: true, result: "Ничего не нашёл" };
        return {
          ok: true,
          result: hits
            .map((h) => `${h.path}${h.snippet ? `\n  ${h.snippet}` : ""}`)
            .join("\n"),
        };
      }
      default:
        return { ok: false, result: `Неизвестный инструмент: ${name}` };
    }
  } catch (err) {
    return { ok: false, result: err instanceof Error ? err.message : String(err) };
  }
}

module.exports = {
  APP_VERSION,
  hostInfo,
  listRoots,
  listDir,
  readFile,
  writeFile,
  writeBytes,
  mkdir,
  deletePath,
  copyPath,
  movePath,
  unpackArchive,
  packArchive,
  tree,
  searchFiles,
  ensurePlayground,
  exec,
  toUi,
  toFs,
};
