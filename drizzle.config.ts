import { defineConfig } from "drizzle-kit";
import { readFileSync } from "node:fs";

try {
  const localEnv = readFileSync(".env.local", "utf8");
  for (const line of localEnv.split(/\r?\n/)) {
    const entry = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (entry && process.env[entry[1]] === undefined) process.env[entry[1]] = entry[2].replace(/^(['"])(.*)\1$/, "$2");
  }
} catch {}

export default defineConfig({
  schema: "./src/lib/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
