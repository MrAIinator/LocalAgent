import { mkdirSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import JSZip from "jszip";

const ROOT = process.cwd();
const OUT_PUBLIC = join(ROOT, "public", "LocalAgent-0.1_beta.zip");
const OUT_ARTIFACT = join(ROOT, "artifacts", "LocalAgent-0.1_beta.zip");

const SKIP_DIR = new Set([
  "node_modules",
  ".git",
  ".output",
  "screenshots",
  "artifacts",
  ".nitro",
  "dist",
  "coverage",
  ".grok",
]);

const SKIP_FILE = new Set([
  "LocalAgent-0.1_beta.zip",
  ".DS_Store",
  "AGENTS.md",
  "AGENTS.project.md",
  "startup.sh",
]);

function skipPath(rel) {
  const parts = rel.split(/[\\/]/);
  if (parts.some((p) => SKIP_DIR.has(p) || p.startsWith("."))) return true;
  const base = parts[parts.length - 1] || "";
  if (SKIP_FILE.has(base)) return true;
  if (base.endsWith(".test.ts") || base.endsWith(".test.mjs") || base.endsWith(".test.js"))
    return true;
  if (rel.startsWith("migrations/")) return true;
  return false;
}

async function walk(dir, acc) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    const rel = relative(ROOT, full).split(sep).join("/");
    if (skipPath(rel)) continue;
    if (e.isDirectory()) {
      await walk(full, acc);
    } else if (e.isFile()) {
      acc.push({ full, rel });
    }
  }
}

async function main() {
  mkdirSync(join(ROOT, "public"), { recursive: true });
  mkdirSync(join(ROOT, "artifacts"), { recursive: true });

  const files = [];
  await walk(ROOT, files);
  const zip = new JSZip();
  const readme = await readFile(join(ROOT, "README-DESKTOP.md"));
  zip.file("LocalAgent-0.1_beta/README.txt", readme);
  zip.file("LocalAgent-0.1_beta/КАК_ЗАПУСТИТЬ.txt", readme);

  let count = 0;
  for (const f of files) {
    let buf = await readFile(f.full);
    if (f.rel === "package.json") {
      const pkg = JSON.parse(buf.toString("utf8"));
      pkg.name = "localagent";
      pkg.productName = "LocalAgent";
      pkg.version = "0.1.0-beta";
      pkg.private = true;
      pkg.main = "electron/main.cjs";
      pkg.scripts = {
        ...pkg.scripts,
        start: "node electron/launch.cjs",
        desktop: "node electron/launch.cjs",
      };
      pkg.devDependencies = {
        ...(pkg.devDependencies ?? {}),
        electron: "33.4.11",
      };
      buf = Buffer.from(JSON.stringify(pkg, null, 2));
    }
    zip.file("LocalAgent-0.1_beta/" + f.rel, buf);
    count += 1;
  }

  const buf = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  await writeFile(OUT_PUBLIC, buf);
  await writeFile(OUT_ARTIFACT, buf);
  console.log(
    JSON.stringify({
      files: count,
      bytes: buf.length,
      public: OUT_PUBLIC,
      artifact: OUT_ARTIFACT,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
