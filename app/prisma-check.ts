import { PrismaClient } from "@prisma/client"; const p = new PrismaClient(); p.organizationSettings.findMany();
