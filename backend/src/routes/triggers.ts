import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma.js";

const triggerInput = z.object({ label: z.string().min(1) });
const toggleInput = z.object({ triggerId: z.string(), removed: z.boolean() });

export default async function triggerRoutes(app: FastifyInstance) {
  // GET /triggers — list + removed state, one call (join, not two round trips)
  app.get("/triggers", async (req) => {
    const [list, logs] = await Promise.all([
      prisma.trigger.findMany({ where: { userId: req.userId }, orderBy: { sortOrder: "asc" } }),
      prisma.triggerLog.findMany({ where: { userId: req.userId } }),
    ]);
    const removedIds = new Set(logs.filter((l) => l.removed).map((l) => l.triggerId));
    return list.map((t) => ({ ...t, removed: removedIds.has(t.id) }));
  });

  app.post("/triggers", async (req, reply) => {
    const parsed = triggerInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const trigger = await prisma.trigger.create({ data: { ...parsed.data, userId: req.userId } });
    return reply.code(201).send(trigger);
  });

  app.patch("/triggers/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = triggerInput.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const result = await prisma.trigger.updateMany({ where: { id, userId: req.userId }, data: parsed.data });
    if (result.count === 0) return reply.code(404).send({ error: "not_found" });
    return reply.send({ ok: true });
  });

  app.delete("/triggers/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const result = await prisma.trigger.deleteMany({ where: { id, userId: req.userId } });
    if (result.count === 0) return reply.code(404).send({ error: "not_found" });
    return reply.send({ ok: true });
  });

  // PUT /triggers/toggle — mark a trigger as removed / not removed
  app.put("/triggers/toggle", async (req, reply) => {
    const parsed = toggleInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { triggerId, removed } = parsed.data;
    const log = await prisma.triggerLog.upsert({
      where: { triggerId },
      update: { removed },
      create: { triggerId, userId: req.userId, removed },
    });
    return reply.send(log);
  });
}
