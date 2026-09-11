import { type VFS, emptyVfs, writeFile, ensureDir } from "./virtual";

const NOTES = `# Заметки

HAND — локальный файловый агент.

Что умеет:
- копировать, удалять, создавать, переносить файлы
- править текст
- распаковывать zip
- смотреть экран, если включить захват в шапке

Попробуй попросить:
1. Создай в Документах файл план.txt с тремя задачами
2. Скопируй заметки.md в Черновики
3. Распакуй Архивы/pack.zip в Проекты
`;

const LIST = `купить хлеб
проверить Ollama
починить наушники
прочитать главу
`;

const LETTER = `Привет.

Черновик письма. Агент может его дописать или перенести куда скажешь.

—
`;

const HTML = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>Демо-сайт</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <main>
      <h1>Демо</h1>
      <p>Маленький файл, чтобы было что править.</p>
      <script src="app.js"></script>
    </main>
  </body>
</html>
`;

const CSS = `body {
  margin: 0;
  font-family: Georgia, serif;
  background: #111;
  color: #eee;
}
main { padding: 48px; }
`;

const JS = `console.log("demo app ready");
`;

const README = `HAND workspace
==============

Это демо-пространство. Подключи свою папку ПК кнопкой в шапке —
агент будет работать уже с реальными файлами.

Локальный ИИ: настройки → Ollama или LM Studio.
`;

const PACK_ZIP_B64 =
  "UEsDBAoAAAAAAByeKF3w6r0zawAAAGsAAAAKAAAAcmVhZG1lLnR4dNCt0YLQviDQtNC10LzQvi3QsNGA0YXQuNCyIEhBTkQuCtCf0L7Qv9GA0L7RgdC4INCw0LPQtdC90YLQsDog0YDQsNGB0L/QsNC60YPQuSBwYWNrLnppcCDQsiDQn9GA0L7QtdC60YLRiy4KUEsDBAoAAAgAAByeKF0AAAAAAAAAAAAAAAANABYA0LLQvdGD0YLRgNC4L3VwEgABx92amdCy0L3Rg9GC0YDQuC9QSwMECgAACAAAHJ4oXR7bb+JEAAAARAAAAB4AJwDQstC90YPRgtGA0Lgv0LTQsNC90L3Ri9C1Lmpzb251cCMAATaSfTvQstC90YPRgtGA0Lgv0LTQsNC90L3Ri9C1Lmpzb257CiAgIm9rIjogdHJ1ZSwKICAiaXRlbXMiOiBbCiAgICAiYWxwaGEiLAogICAgImJldGEiCiAgXSwKICAibiI6IDcKfVBLAQIUAAoAAAAAAByeKF3w6r0zawAAAGsAAAAKAAAAAAAAAAAAAAAAAAAAAAByZWFkbWUudHh0UEsBAhQACgAACAAAHJ4oXQAAAAAAAAAAAAAAAA0AFgAAAAAAAAAQAAAAkwAAANCy0L3Rg9GC0YDQuC91cBIAAcfdmpnQstC90YPRgtGA0LgvUEsBAhQACgAACAAAHJ4oXR7bb+JEAAAARAAAAB4AJwAAAAAAAAAAAAAA1AAAANCy0L3Rg9GC0YDQuC/QtNCw0L3QvdGL0LUuanNvbnVwIwABNpJ9O9Cy0L3Rg9GC0YDQuC/QtNCw0L3QvdGL0LUuanNvblBLBQYAAAAAAwADAPwAAAB7AQAAAAA=";

export function seedVfsSync(): VFS {
  let vfs = emptyVfs();
  const dirs = [
    "/Документы",
    "/Проекты",
    "/Проекты/сайт",
    "/Архивы",
    "/Черновики",
  ];
  for (const d of dirs) vfs = ensureDir(vfs, d);
  vfs = writeFile(vfs, "/README.txt", README);
  vfs = writeFile(vfs, "/Документы/заметки.md", NOTES);
  vfs = writeFile(vfs, "/Документы/список.txt", LIST);
  vfs = writeFile(vfs, "/Черновики/письмо.txt", LETTER);
  vfs = writeFile(vfs, "/Проекты/сайт/index.html", HTML);
  vfs = writeFile(vfs, "/Проекты/сайт/styles.css", CSS);
  vfs = writeFile(vfs, "/Проекты/сайт/app.js", JS);
  vfs = writeFile(
    vfs,
    "/Архивы/pack.zip",
    PACK_ZIP_B64,
    "base64",
    "application/zip",
  );
  return vfs;
}

export async function seedVfs(): Promise<VFS> {
  return seedVfsSync();
}
