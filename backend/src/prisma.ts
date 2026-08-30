import { PrismaClient } from "@prisma/client";

// Singleton so dev hot-reload (tsx watch) doesn't open a new pool every save.
export const prisma = new PrismaClient();
