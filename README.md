# S3 UI

Простой десктопный (Linux) UI для управления файлами в S3-совместимом хранилище
(AWS S3, MinIO, Yandex Object Storage, Cloudflare R2 и т.п.).

Приложение на **Electron + Nuxt 4**. Все обращения к S3 (`@aws-sdk/client-s3`) выполняются
в main-процессе Node.js — поэтому **не требуется настройка CORS** на бакете, а креды никуда
не отправляются. Renderer (Nuxt) ходит в S3 только через безопасный IPC-мост (`window.s3Api`).

## Возможности

- Профили подключения: добавление/редактирование/удаление, переключение, тест соединения.
  Секреты хранятся локально и **шифруются системным хранилищем ключей ОС** (libsecret на Linux)
  через Electron `safeStorage`.
- Файловый менеджер: навигация по «папкам» (префиксы + `Delimiter`), хлебные крошки,
  режимы список/сетка, пагинация, фильтр по имени.
- Загрузка: drag-and-drop и выбор через диалог, прогресс, multipart для больших файлов,
  подтверждение перезаписи.
- Скачивание: одиночное («Сохранить как») и групповое (в выбранную папку).
- Создание папок, переименование/перемещение (copy + delete), удаление одиночное/массовое,
  рекурсивное удаление папок.
- Предпросмотр изображений, PDF и текстовых/код-файлов.
- Информация об объекте (размер, тип, ETag, дата, метаданные) в боковой панели.
- Presigned-ссылка (1 час) в буфер обмена.
- Множественный выбор (checkbox, shift-click), горячие клавиши: `Delete`, `Ctrl/Cmd+A`, `Escape`.
- Тёмная/светлая тема.

## Архитектура

```
electron/        main-процесс (Node): S3-операции, стор профилей, IPC
  main.ts        окно, кастомный протокол app:// для статики, меню
  preload.ts     contextBridge → window.s3Api
  ipc.ts         IPC-хендлеры (обёртка с человекочитаемыми ошибками)
  s3.ts          обёртка над @aws-sdk/client-s3
  store.ts       профили в userData + шифрование через safeStorage
shared/types.ts  общий контракт main ↔ renderer
app/             renderer (Nuxt 4 SPA): pages, components, composables, stores
scripts/         сборка electron через esbuild (main/preload бандлятся, AWS SDK инлайнится)
```

## Разработка

```bash
npm install
npm run dev        # Nuxt на :3000 + Electron с hot-reload
```

## Сборка

```bash
npm run build        # nuxt generate (.output/public) + бандл electron (dist-electron)
npm start            # запустить собранное приложение (прод, без dev-сервера)
```

## Упаковка в .deb (и AppImage)

```bash
npm run dist:linux   # → dist/s3-ui_<version>_amd64.deb и dist/S3 UI-<version>.AppImage
```

Установка:

```bash
sudo dpkg -i dist/s3-ui_0.1.0_amd64.deb
sudo apt-get -f install   # доустановить зависимости при необходимости (libsecret-1-0)
```

Пакет ставится в `/opt/S3 UI`, добавляет ярлык в меню приложений и иконку.

## Примечания

- Для MinIO укажите `Endpoint` (напр. `http://localhost:9000`) и включите **Path-style URL**.
- `safeStorage` требует доступного keyring в системе (GNOME Keyring / KWallet). Если он
  недоступен, секреты сохранятся в base64 — приложение работает, но защита слабее.
