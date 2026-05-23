type PrismaClientLike = unknown;
type PrismaModule = {
  PrismaClient: new () => PrismaClientLike;
};

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientLike;
};

export async function getDb() {
  if (!globalForPrisma.prisma) {
    const prismaModule = (await import("@prisma/client")) as unknown as PrismaModule;
    globalForPrisma.prisma = new prismaModule.PrismaClient();
  }

  return globalForPrisma.prisma;
}
