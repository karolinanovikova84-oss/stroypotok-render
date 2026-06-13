# Render deploy for StroyPotok

Эта папка подготовлена для выгрузки системы «СтройПоток» на Render.

## Состав

- `api` - backend Express + Prisma;
- `web` - frontend Next.js;
- `render.yaml` - Blueprint Render, который создает:
  - `stroypotok-api`;
  - `stroypotok-web`;
  - `stroypotok-db`.

## Важное про бесплатный тариф

Render Free подходит для демонстрации диплома:

- web-сервисы могут засыпать после простоя и просыпаться не сразу;
- бесплатная PostgreSQL-база имеет лимит 1 GB;
- бесплатная PostgreSQL-база истекает через 30 дней.

Для защиты этого достаточно. Для постоянной эксплуатации базу лучше перевести на платный тариф или вынести в Neon/Supabase.

## Как загрузить

Render не работает с обычной загрузкой zip как Amvera. Нужен Git-репозиторий.

1. Создай новый репозиторий GitHub, например `stroypotok-render`.
2. Загрузи в него содержимое папки `render_deploy`, не саму папку, а именно файлы внутри:
   - `render.yaml`;
   - папку `api`;
   - папку `web`.
3. В Render нажми `New` -> `Blueprint`.
4. Подключи созданный GitHub-репозиторий.
5. Render прочитает `render.yaml` и предложит создать `stroypotok-api`, `stroypotok-web` и `stroypotok-db`.
6. Запусти `Deploy Blueprint`.

## Проверка после деплоя

Сначала проверь API:

```text
https://stroypotok-api.onrender.com/health
```

Должен вернуться JSON со статусом `ok`.

Потом открой frontend:

```text
https://stroypotok-web.onrender.com
```

Если frontend открылся, но не видит backend, проверь фактический адрес API в Render. Если он отличается от `https://stroypotok-api.onrender.com`, то в сервисе `stroypotok-web` нужно заменить переменную:

```text
NEXT_PUBLIC_API_URL=https://фактический-api-url.onrender.com
```

После изменения переменной нужно redeploy frontend.

## Демо-вход

При каждом деплое backend выполняет миграции Prisma и seed-скрипт в build-команде. Это сделано специально для бесплатного тарифа Render, потому что `preDeployCommand` доступен не для всех free web-сервисов.

```text
npx prisma migrate deploy && npm run seed:demo
```

Пароль для демо-пользователей:

```text
demo123
```

Основные телефоны из seed:

```text
+7 900 000-00-01 - администратор
+7 900 000-00-02 - координатор
+7 900 000-00-03 - прораб
+7 900 000-00-04 - рабочий
+7 900 000-00-05 - клиент
```

## Что нужно передать Codex, чтобы я выгрузил сам

Нужен один из вариантов:

- ссылка на GitHub-репозиторий, куда ты уже загрузил `render_deploy`, и доступ на запись;
- или новый пустой GitHub-репозиторий, в который я могу сделать push;
- или ты сам подключаешь репозиторий в Render, а мне присылаешь скрин/логи, если что-то упадет.

Пароль от Render присылать не надо.
