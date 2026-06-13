# API

Стартовый backend для новой веб-системы строительной компании.

## Что уже подготовлено

- `Express` сервер
- `TypeScript` конфигурация
- `Prisma` схема под базовые сущности
- базовый health-check

## Структура

- `src/server.ts` - запуск сервера
- `src/app.ts` - настройка приложения
- `src/routes` - API роуты
- `src/lib/prisma.ts` - Prisma client
- `prisma/schema.prisma` - схема базы данных

## Как запустить после установки зависимостей

1. Создать `.env` на основе `.env.example`
2. Установить зависимости:

```powershell
npm install
```

3. Сгенерировать Prisma client:

```powershell
npx prisma generate
```

4. Запустить dev-сервер:

```powershell
npm run dev
```
