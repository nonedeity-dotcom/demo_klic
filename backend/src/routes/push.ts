import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma.js";

const registerInput = z.object({
  expoToken: z.string().min(1), // e.g. "ExponentPushToken[xxxxxxxx]"
  deviceId: z.string().optional(),
  platform: z.enum(["ios", "android"]).optional(),
});

const reminderInput = z.object({
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59).default(0),
  timezone: z.string().default("UTC"),
  enabled: z.boolean().default(true),
});

export default async function pushRoutes(app: FastifyInstance) {
  // POST /push/register — call this from the app right after
  // expo-notifications getExpoPushTokenAsync() resolves.
  app.post("/push/register", async (req, reply) => {
    const parsed = registerInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const token = await prisma.pushToken.upsert({
      where: { expoToken: parsed.data.expoToken },
      update: { userId: req.userId, ...parsed.data },
      create: { userId: req.userId, ...parsed.data },
    });
    return reply.code(201).send(token);
  });

  app.delete("/push/register", async (req, reply) => {
    const { expoToken } = req.body as { expoToken: string };
    await prisma.pushToken.deleteMany({ where: { expoToken, userId: req.userId } });
    return reply.send({ ok: true });
  });

  // GET/PUT /push/reminder — "remind me at 21:00 if I haven't checked off
  // today's habits". Actual sending happens in services/reminderCron.ts.
  app.get("/push/reminder", async (req) => {
    return prisma.reminderSetting.findUnique({ where: { userId: req.userId } });
  });

  app.put("/push/reminder", async (req, reply) => {
    const parsed = reminderInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const setting = await prisma.reminderSetting.upsert({
      where: { userId: req.userId },
      update: parsed.data,
      create: { userId: req.userId, ...parsed.data },
    });
    return reply.send(setting);
  });
}
