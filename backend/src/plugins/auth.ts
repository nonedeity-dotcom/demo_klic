import fp from "fastify/fp.js";
import jwt from "@fastify/jwt";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    userId: string;
  }
}

// Registers @fastify/jwt and adds an `authenticate` preHandler that routes
// can opt into. Keeps auth logic in one place instead of copy-pasted per route.
export default fp(async (app: FastifyInstance) => {
  app.register(jwt, {
    secret: process.env.JWT_SECRET || "dev-secret-change-me",
  });

  app.decorate(
    "authenticate",
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const payload = await req.jwtVerify<{ sub: string }>();
        req.userId = payload.sub;
      } catch {
        reply.code(401).send({ error: "unauthorized" });
      }
    }
  );
});
