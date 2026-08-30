import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma.js";

const energyInput = z.object({
  date: z.string(),
  hour: z.number().int().min(0).max(23),
  value: z.number().int().min(0).max(10),
});

const sessionInput = z.object({
  date: z.string(),
  durationMin: z.number().int().min(1),
});

const questionInput = z.object({
  date: z.string(),
  text: z.string(),
});

// Groups the three smaller tabs (energy grid, focus sessions, daily question)
// into one routes file since each is a handful of simple endpoints.
export default async function trackingRoutes(app: FastifyInstance) {
  // --- Energy (replaces energy-log-v1) ---
  app.get("/energy", async (req) => {
    const { from, to } = req.query as { from?: string; to?: string };
    return prisma.energyLog.findMany({
      where: {
        userId: req.userId,
        ...(from && to ? { date: { gte: new Date(from), lte: new Date(to) } } : {}),
      },
    });
  });

  app.put("/energy", async (req, reply) => {
    const parsed = energyInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { date, hour, value } = parsed.data;
    const log = await prisma.energyLog.upsert({
      where: { userId_date_hour: { userId: req.userId, date: new Date(date), hour } },
      update: { value },
      create: { userId: req.userId, date: new Date(date), hour, value },
    });
    return reply.send(log);
  });

  // --- Focus sessions (replaces timer-stats-v1) ---
  app.get("/sessions", async (req) => {
    const { from, to } = req.query as { from?: string; to?: string };
    return prisma.focusSession.findMany({
      where: {
        userId: req.userId,
        ...(from && to ? { date: { gte: new Date(from), lte: new Date(to) } } : {}),
      },
      orderBy: { date: "desc" },
    });
  });

  app.post("/sessions", async (req, reply) => {
    const parsed = sessionInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const session = await prisma.focusSession.create({
      data: { ...parsed.data, date: new Date(parsed.data.date), userId: req.userId },
    });
    return reply.code(201).send(session);
  });

  // --- Daily question (replaces daily-question-v1) ---
  app.get("/question", async (req) => {
    const { from, to } = req.query as { from?: string; to?: string };
    return prisma.dailyQuestion.findMany({
      where: {
        userId: req.userId,
        ...(from && to ? { date: { gte: new Date(from), lte: new Date(to) } } : {}),
      },
      orderBy: { date: "desc" },
    });
  });

  app.put("/question", async (req, reply) => {
    const parsed = questionInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { date, text } = parsed.data;
    const q = await prisma.dailyQuestion.upsert({
      where: { userId_date: { userId: req.userId, date: new Date(date) } },
      update: { text },
      create: { userId: req.userId, date: new Date(date), text },
    });
    return reply.send(q);
  });
}
