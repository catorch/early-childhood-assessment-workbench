import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations"
  },
  datasource: {
    // Schema operations must bypass Neon's pooled endpoint. Runtime traffic uses
    // DATABASE_URL through the Neon driver adapter instead.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"]
  }
});
