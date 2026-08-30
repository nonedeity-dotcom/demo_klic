# No Burnout — архитектура

Разложено на два независимых проекта из одного демо-файла `no-burnout-app.jsx`.

```
no-burnout/
├── backend/     Node.js + TypeScript + Fastify + Prisma + PostgreSQL
└── mobile-app/  React Native + Expo + TypeScript
```

## Почему так

- Один язык (TypeScript) на фронте и бэке — общие типы (`src/types.ts` на клиенте
  соответствует моделям в `backend/prisma/schema.prisma`), меньше context-switching.
- Бэкенд нужен ради двух вещей: **аккаунт + синк между устройствами** и
  **серверная логика напоминаний** («напомни, если не отметил привычку к 21:00») —
  это невозможно сделать только локальными уведомлениями на устройстве.
- Каждый `window.storage`-ключ из демо стал таблицей в Postgres:

  | Было (localStorage/window.storage) | Стало (Prisma-модель)   |
  |---|---|
  | `habit-log-v1`           | `HabitLog`            |
  | `habits-list-v1`         | `Habit`                |
  | `triggers-v1` / `triggers-list-v1` | `TriggerLog` / `Trigger` |
  | `energy-log-v1`          | `EnergyLog`            |
  | `timer-stats-v1`         | `FocusSession`         |
  | `daily-question-v1`      | `DailyQuestion`        |
  | `celebrated-milestones-v1` | `CelebratedMilestone` |
  | — (не было) | `PushToken`, `ReminderSetting` — новое, для пушей |

## Backend: запуск

```bash
cd backend
cp .env.example .env        # укажи свою DATABASE_URL и JWT_SECRET
npm install
npx prisma migrate dev      # создаёт таблицы в Postgres
npm run dev                 # API на http://localhost:3000

# отдельным процессом — воркер, который шлёт пуш-напоминания
npm run cron:reminders
```

Нужен запущенный PostgreSQL (`docker run -p 5432:5432 -e POSTGRES_PASSWORD=pass postgres` — самый быстрый способ для локальной разработки).

## Mobile app: запуск

```bash
cd mobile-app
npm install
# в app.json → extra.apiUrl укажи адрес бэкенда (для теста на телефоне — не localhost,
# а IP твоего компьютера в локальной сети, либо задеплой backend и укажи его URL)
npx expo start
```

Дальше — отсканировать QR в приложении Expo Go (для быстрой разработки) или собрать
dev-build через `eas build` (обязательно для пушей — Expo Go пуши не поддерживает
с SDK 51+, нужен собственный dev client).

## Что уже перенесено из демо

**Backend** — все эндпоинты: auth (register/login), habits + habit log (toggle,
CRUD), triggers, energy grid, focus sessions, daily question, плюс новое —
push-токены и cron, который раз в минуту проверяет время напоминания каждого
пользователя в его таймзоне и шлёт push через Expo Push API, если привычки за
день не выполнены.

**Mobile app** — все 6 вкладок демо стали настоящими нативными экранами
(`src/screens/*`), навигация — `@react-navigation/bottom-tabs`, данные —
`@tanstack/react-query` вместо `useState`+`useEffect`+`window.storage`
(даёт кэш, оптимистичные обновления, рефетч при возврате в приложение).
Экран логина — новый, его в демо не было.

## Что осталось доделать (за пределами этого скаффолда)

- Огонёк-стрик (`FlameIcon`/`flameColor`) и анимации (`TwoCurves`, конфетти при
  66 днях) — логика цвета/градиента 1:1 переносится, но SVG/анимации на
  `react-native-svg` + `react-native-reanimated` нужно дорисовать отдельно.
- Экран настройки времени напоминания (`ReminderSetting`) — эндпоинт на бэке есть
  (`PUT /push/reminder`), экран в мобильном приложении не создан.
- Обработка истёкшего JWT (refresh-токены) — сейчас токен просто живёт 30 дней.
- EAS Build конфиг для сборки под TestFlight/Play Store.
