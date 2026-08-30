import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma.js";

const habitInput = z.object({
  label: z.string().min(1),
  hint: z.string().optional(),
});

const toggleInput = z.object({
  habitId: z.string(),
  date: z.string(), // ISO date, e.g. "2026-08-30"
  done: z.boolean(),
});

// All routes here require auth (registered with { prefix, preHandler } in server.ts).
export default async function habitRoutes(app: FastifyInstance) {
  // GET /habits — list this user's habits (replaces habits-list-v1)
  app.get("/habits", async (req) => {
    return prisma.habit.findMany({
      where: { userId: req.userId, archived: false },
      orderBy: { sortOrder: "asc" },
    });
  });

  // POST /habits — add a custom habit
  app.post("/habits", async (req, reply) => {
    const parsed = habitInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const habit = await prisma.habit.create({
      data: { ...parsed.data, userId: req.userId },
    });
    return reply.code(201).send(habit);
  });

  // PATCH /habits/:id — edit label/hint
  app.patch("/habits/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = habitInput.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const habit = await prisma.habit.updateMany({
      where: { id, userId: req.userId },
      data: parsed.data,
    });
    if (habit.count === 0) return reply.code(404).send({ error: "not_found" });
    return reply.send({ ok: true });
  });

  // DELETE /habits/:id — soft delete (archive), keeps historical logs intact
  app.delete("/habits/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const result = await prisma.habit.updateMany({
      where: { id, userId: req.userId },
      data: { archived: true },
    });
    if (result.count === 0) return reply.code(404).send({ error: "not_found" });
    return reply.send({ ok: true });
  });

  // GET /habits/log?from=YYYY-MM-DD&to=YYYY-MM-DD — day-by-day completion (replaces habit-log-v1)
  app.get("/habits/log", async (req) => {
    const { from, to } = req.query as { from?: string; to?: string };
    return prisma.habitLog.findMany({
      where: {
        userId: req.userId,
        ...(from && to ? { date: { gte: new Date(from), lte: new Date(to) } } : {}),
      },
      orderBy: { date: "desc" },
    });
  });

  // PUT /habits/log — toggle a habit's done state for a given day
  app.put("/habits/log", async (req, reply) => {
    const parsed = toggleInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { habitId, date, done } = parsed.data;

    const log = await prisma.habitLog.upsert({
      where: { habitId_date: { habitId, date: new Date(date) } },
      update: { done },
      create: { habitId, userId: req.userId, date: new Date(date), done },
    });
    return reply.send(log);
  });
}
