import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/lib/schema";

// Use a non-routable placeholder only during initial setup so Next can load
// its routes and render the setup screen. Database-backed routes check for the
// real environment variable before making queries.
const url = process.env.DATABASE_URL || "postgresql://setup:setup@localhost:5432/setup";
const sql = neon(url);
export const db = drizzle(sql, { schema });
