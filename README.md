# Runner Bot v2 — пошагово для новичка

Это готовый проект на **JS**, который открывает игру внутри **Telegram Mini App**.

Стек:
- Node.js
- Express
- Grammy
- PostgreSQL
- HTML/CSS/JS Canvas
- Railway
- GitHub

## Что уже есть
- команда `/start`
- команда `/runner`
- команда `/toprunner`
- мини-игра внутри Telegram
- сохранение рекорда в Postgres
- топ игроков
- защита от совсем простого накручивания результата
- интерфейс v2: стартовый экран, game over, рекорд, место в топе

---

# 1. Что нужно установить заранее

На компьютер:
1. **Node.js 20+**
2. **Git**
3. Аккаунт в **GitHub**
4. Аккаунт в **Railway**
5. Telegram аккаунт

Проверка в терминале:

```bash
node -v
npm -v
git --version
```

Если команды работают — всё ок.

---

# 2. Создай бота в Telegram

1. Открой Telegram.
2. Найди `@BotFather`.
3. Отправь команду `/newbot`.
4. Введи имя бота.
5. Введи username бота, который заканчивается на `bot`.
6. BotFather пришлёт тебе **BOT_TOKEN**.

Сохрани токен. Он понадобится дальше.

Пример:

```env
BOT_TOKEN=123456:ABC-EXAMPLE
```

---

# 3. Подготовь проект локально

## Вариант A — если у тебя уже есть архив

1. Распакуй проект.
2. Открой папку в VS Code.
3. В терминале выполни:

```bash
npm install
```

## Вариант B — если проект уже в GitHub

```bash
git clone <твой_репозиторий>
cd runner-bot-js-v2
npm install
```

---

# 4. Настрой `.env`

В корне проекта есть файл `.env.example`.

Сделай копию и назови её `.env`.

Пример содержимого:

```env
BOT_TOKEN=ВСТАВЬ_СЮДА_ТОКЕН_БОТА
APP_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/runner
WEBHOOK_SECRET=my-super-secret-string
NODE_ENV=development
PORT=3000
```

## Что значит каждая переменная
- `BOT_TOKEN` — токен из BotFather
- `APP_URL` — адрес сайта с игрой
- `DATABASE_URL` — строка подключения к PostgreSQL
- `WEBHOOK_SECRET` — любая длинная случайная строка
- `NODE_ENV` — `development` локально, `production` на Railway
- `PORT` — порт сервера

---

# 5. Быстрый локальный запуск

Если у тебя уже есть PostgreSQL локально, просто укажи свою строку подключения в `.env`.

Потом запусти:

```bash
npm run dev
```

Если всё хорошо, увидишь что-то вроде:

```bash
Bot polling started
Server listening on port 3000
```

Проверь в браузере:
- `http://localhost:3000/`
- `http://localhost:3000/api/health`
- `http://localhost:3000/webapp/index.html`

---

# 6. Если локального Postgres нет

Самый простой путь — **не мучиться локально** и сразу деплоить в Railway.

Это нормальный путь для новичка.

---

# 7. Как залить проект в GitHub

Если у тебя ещё нет репозитория:

```bash
git init
git add .
git commit -m "runner v2"
```

Потом создай пустой репозиторий на GitHub и привяжи его:

```bash
git remote add origin https://github.com/USERNAME/REPO.git
git branch -M main
git push -u origin main
```

> Важно: файл `.env` не пушь в GitHub.
> Пушить нужно только `.env.example`.

---

# 8. Как развернуть на Railway — по шагам

## Шаг 1. Создай проект
1. Зайди в Railway.
2. Нажми **New Project**.
3. Выбери **Deploy from GitHub repo**.
4. Выбери свой репозиторий.

## Шаг 2. Добавь базу данных
1. Внутри проекта Railway нажми **New**.
2. Выбери **Database** → **PostgreSQL**.
3. Railway сам создаст Postgres.

## Шаг 3. Возьми публичный домен приложения
1. Открой сервис с Node.js приложением.
2. Перейди в **Settings**.
3. Нажми **Generate Domain**.
4. Railway создаст адрес вроде:

```text
https://my-runner-bot-production.up.railway.app
```

Сохрани этот адрес. Это и будет твой `APP_URL`.

## Шаг 4. Пропиши переменные окружения
В сервисе приложения открой **Variables** и добавь:

```env
BOT_TOKEN=твой_токен_бота
APP_URL=https://твой-домен.up.railway.app
WEBHOOK_SECRET=любая-длинная-случайная-строка
NODE_ENV=production
PORT=3000
```

`DATABASE_URL` чаще всего Railway подставит сам, если Postgres подключён правильно.

Если не подставил автоматически:
1. зайди в сервис Postgres,
2. найди строку подключения,
3. вставь её как `DATABASE_URL` в сервис приложения.

---

# 9. Как понять, что деплой прошёл успешно

Открой в браузере:

```text
https://ТВОЙ_ДОМЕН/api/health
```

Если видишь примерно это:

```json
{"ok":true,"env":"production"}
```

значит сервер работает.

Потом открой:

```text
https://ТВОЙ_ДОМЕН/webapp/index.html
```

Если страница игры открывается — фронтенд работает.

---

# 10. Как проверить бота в Telegram

1. Открой своего бота.
2. Нажми `/start`.
3. Нажми кнопку **Играть в Runner**.
4. Должно открыться мини-приложение.
5. После проигрыша результат должен сохраниться.
6. Команда `/toprunner` должна показать топ игроков.

---

# 11. Что делать, если кнопка есть, а игра не открывается

Проверь по порядку:

## 1. Неправильный `APP_URL`
Он должен быть:
- с `https://`
- без пробелов
- доступен снаружи интернета

Правильно:

```env
APP_URL=https://my-runner.up.railway.app
```

Неправильно:

```env
APP_URL=my-runner.up.railway.app
APP_URL=http://my-runner.up.railway.app
```

## 2. Приложение не задеплоилось
Проверь логи в Railway.

## 3. База не подключена
Если приложение падает на старте, часто проблема в `DATABASE_URL`.

---

# 12. Что делать, если бот не отвечает

Проверь:
1. Правильный ли `BOT_TOKEN`
2. Есть ли успешный деплой
3. Работает ли `/api/health`
4. Есть ли ошибки в логах Railway

---

# 13. Структура проекта

```text
runner-bot-js-v2/
  lib/
    db.js
    telegramAuth.js
  webapp/
    index.html
    styles.css
    app.js
  .env.example
  package.json
  server.js
  README.md
```

### За что отвечает каждый файл
- `server.js` — бот, webhook, API, выдача игры
- `lib/db.js` — таблицы и сохранение результатов
- `lib/telegramAuth.js` — проверка пользователя Telegram Mini App
- `webapp/index.html` — разметка игры
- `webapp/styles.css` — стили
- `webapp/app.js` — вся логика раннера

---

# 14. Как обновлять проект после изменений

После изменения файлов:

```bash
git add .
git commit -m "update game"
git push
```

Railway сам увидит новый commit и начнёт redeploy.

---

# 15. Самая короткая схема запуска

Если совсем кратко, то порядок такой:

1. Создать бота в BotFather
2. Взять токен
3. Залить проект в GitHub
4. Подключить GitHub к Railway
5. Добавить Postgres в Railway
6. Добавить переменные `BOT_TOKEN`, `APP_URL`, `WEBHOOK_SECRET`, `NODE_ENV`
7. Убедиться, что работает `/api/health`
8. Открыть бота и нажать `/start`

---

# 16. Что уже улучшено в v2
- красивее интерфейс
- отдельный стартовый экран
- отдельный game over экран
- лучший HUD
- несколько типов препятствий
- плавнее анимация
- показывается место в топе
- простая античит-проверка на сервере

---

# 17. Что я бы сделал в v3
- настоящие PNG-спрайты персонажа
- звук прыжка и game over
- кнопка паузы
- монетки
- магазин с персонажами
- ежедневные задания
- отдельная таблица рекордов за день

---

# 18. Частые ошибки новичка

## Ошибка 1. Залили `.env` в GitHub
Так делать не надо.

## Ошибка 2. Указали `APP_URL` без `https`
Telegram Mini App должен открываться по HTTPS.

## Ошибка 3. Не подключили Postgres
Тогда результаты не будут сохраняться.

## Ошибка 4. Ждут, что Telegram сам будет хранить очки
Нет, очки нужно хранить у себя на сервере.

---

# 19. Команды для бота
- `/start`
- `/runner`
- `/toprunner`

---

# 20. Мини-чеклист перед запуском

Проверь:
- [ ] бот создан
- [ ] токен вставлен
- [ ] проект залит в GitHub
- [ ] Railway подключён
- [ ] Postgres создан
- [ ] `APP_URL` указан с `https://`
- [ ] `/api/health` открывается
- [ ] `/start` в боте работает
- [ ] игра открывается кнопкой
- [ ] результат сохраняется

