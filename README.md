# LocalAgent 0.1_beta

Десктопный ИИ-агент для Windows. Electron-окно на твоём ПК.

## Скачать

**Прямая ссылка:**

https://github.com/MrAIinator/LocalAgent/releases/download/0.1_beta/LocalAgent-0.1_beta.zip

Релиз: https://github.com/MrAIinator/LocalAgent/releases/tag/0.1_beta

Распакуй архив, открой папку `LocalAgent-0.1_beta`, запусти `LocalAgent.bat`.
Нужен [Node.js 20+](https://nodejs.org). Первый запуск ставит зависимости и Electron (1–3 минуты).

## Что умеет

Видит диски, папки, скриншоты и архивы этого компьютера.
Копирует, удаляет, создаёт, переносит, правит, пакует zip.
Экран — кнопка в шапке, можно выключить.
Голос — микрофон (скажи команду) и голосовой чат (слушаю → отвечаю вслух).

## Локальная модель

Настройки → Ollama (`http://127.0.0.1:11434/v1`) или LM Studio (`http://127.0.0.1:1234/v1`).
В Electron CORS не нужен.

```bash
ollama pull qwen2.5:7b
```

Версия 0.1_beta.
