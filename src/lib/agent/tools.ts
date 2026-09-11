import type { ToolName } from "./types";

export const TOOL_DEFS: {
  name: ToolName;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}[] = [
  {
    name: "list_roots",
    description:
      "Диски, тома и избранные папки этого компьютера (Дом, Документы, Скриншоты, Загрузки, Workspace). Вызови первым, если не знаешь, где искать.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "tree",
    description:
      "Компактное дерево папки (глубина 2). Не сканирует весь диск — укажи конкретный путь.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Абсолютный путь, например /home или C:/Users" },
        depth: { type: "string", description: "Глубина, по умолчанию 2" },
      },
      required: [],
    },
  },
  {
    name: "list_dir",
    description: "Список файлов и папок в каталоге. Абсолютный путь ОС.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Путь, /workspace или C:/Users/Name/Desktop" },
      },
      required: ["path"],
    },
  },
  {
    name: "read_file",
    description:
      "Прочитать текстовый файл или открыть изображение (скриншот, png/jpg) — картинка прикрепится к контексту.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Абсолютный путь к файлу" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Создать или перезаписать текстовый файл. Родители создаются сами.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Абсолютный путь" },
        content: { type: "string", description: "Полное содержимое" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "mkdir",
    description: "Создать папку (и родителей, если нужно).",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Путь новой папки" },
      },
      required: ["path"],
    },
  },
  {
    name: "delete_path",
    description: "Удалить файл или папку целиком. Необратимо.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Что удалить" },
      },
      required: ["path"],
    },
  },
  {
    name: "copy_path",
    description: "Скопировать файл или папку.",
    parameters: {
      type: "object",
      properties: {
        src: { type: "string", description: "Откуда" },
        dest: { type: "string", description: "Куда" },
      },
      required: ["src", "dest"],
    },
  },
  {
    name: "move_path",
    description: "Перенести или переименовать.",
    parameters: {
      type: "object",
      properties: {
        src: { type: "string", description: "Откуда" },
        dest: { type: "string", description: "Куда" },
      },
      required: ["src", "dest"],
    },
  },
  {
    name: "unpack_archive",
    description: "Распаковать .zip в папку назначения.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Путь к .zip" },
        dest: { type: "string", description: "Куда распаковать. Пусто — рядом, без .zip" },
      },
      required: ["path"],
    },
  },
  {
    name: "pack_archive",
    description: "Упаковать файл или папку в .zip.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Что паковать" },
        dest: { type: "string", description: "Путь к новому .zip" },
      },
      required: ["path"],
    },
  },
  {
    name: "search_files",
    description: "Поиск по именам и текстовому содержимому. Не лезет в node_modules/.git/proc.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Строка поиска" },
        path: { type: "string", description: "Где искать, по умолчанию домашняя папка" },
      },
      required: ["query"],
    },
  },
];

export function openaiTools() {
  return TOOL_DEFS.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export function toolLabel(name: string): string {
  const map: Record<string, string> = {
    list_roots: "диски",
    tree: "дерево",
    list_dir: "список",
    read_file: "чтение",
    write_file: "запись",
    mkdir: "папка",
    delete_path: "удаление",
    copy_path: "копия",
    move_path: "перенос",
    unpack_archive: "распаковка",
    pack_archive: "архив",
    search_files: "поиск",
  };
  return map[name] ?? name;
}
