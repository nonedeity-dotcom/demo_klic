import cron from "node-cron";
import { prisma } from "../prisma.js";
import { sendExpoPush } from "./expoPush.js";

// Runs every minute, finds users whose local reminder time == current time
// in their timezone, and — if they haven't checked off at least half their
// habits today — sends a push. This is the "server-side logic" the local
// on-device scheduler can't do, since it depends on today's live habit state.
function currentHourMinuteInTz(tz: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const minute = Number(parts.find((p) => p.type === "minute")?.value);
  return { hour, minute };
}

function todayInTz(tz: string) {
  return new Date(new Date().toLocaleDateString("en-CA", { timeZone: tz })); // YYYY-MM-DD
}

async function runReminderCheck() {
  const settings = await prisma.reminderSetting.findMany({
    where: { enabled: true },
    include: { user: { include: { pushTokens: true, habits: { where: { archived: false } } } } },
  });

  const toSend: { to: string; title: string; body: string }[] = [];

  for (const setting of settings) {
    const { hour, minute } = currentHourMinuteInTz(setting.timezone);
    if (hour !== setting.hour || minute !== setting.minute) continue;

    const date = todayInTz(setting.timezone);
    const habitIds = setting.user.habits.map((h) => h.id);
    if (habitIds.length === 0) continue;

    const doneCount = await prisma.habitLog.count({
      where: { habitId: { in: habitIds }, date, done: true },
    });
    const halfway = Math.ceil(habitIds.length / 2);
    if (doneCount >= halfway) continue; // already on track, skip nagging

    for (const token of setting.user.pushTokens) {
      toSend.push({
        to: token.expoToken,
        title: "Не сбивай ритм",
        body: `Сегодня отмечено ${doneCount} из ${habitIds.length} привычек. Ещё есть время.`,
      });
    }
  }

  await sendExpoPush(toSend);
}

// Standalone entry point (`npm run cron:reminders`) — run this as a small
// separate worker process/container next to the API server.
cron.schedule("* * * * *", () => {
  runReminderCheck().catch((err) => console.error("reminder cron failed", err));
});

console.log("Reminder cron started (checks every minute).");
