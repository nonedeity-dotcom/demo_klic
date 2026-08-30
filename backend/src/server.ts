import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import authPlugin from "./plugins/auth.js";
import authRoutes from "./routes/auth.js";
import habitRoutes from "./routes/habits.js";
import triggerRoutes from "./routes/triggers.js";
import trackingRoutes from "./routes/tracking.js";
import pushRoutes from "./routes/push.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(authPlugin);

// Public routes (no token required)
await app.register(authRoutes);

// Everything below requires a valid JWT — registered as one group so each
// route file doesn't need to remember to add the preHandler itself.
await app.register(async (protectedApp) => {
  protectedApp.addHook("preHandler", protectedApp.authenticate);
  await protectedApp.register(habitRoutes);
  await protectedApp.register(triggerRoutes);
  await protectedApp.register(trackingRoutes);
  await protectedApp.register(pushRoutes);
});

app.get("/health", async () => ({ ok: true }));

const port = Number(process.env.PORT) || 3000;
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
