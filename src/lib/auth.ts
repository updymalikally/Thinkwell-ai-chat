import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";

export const auth = betterAuth({
  baseURL:
    process.env.BETTER_AUTH_URL || "http://localhost:3001",

  secret:
    process.env.BETTER_AUTH_SECRET ||
    "development-only-secret-replace-before-deploy-32chars",

  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  // Validate password before email sign-up
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") {
        return;
      }

      const password = ctx.body?.password;

      const strongPassword =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#]).{8,128}$/;

      if (
        typeof password !== "string" ||
        !strongPassword.test(password)
      ) {
        throw new APIError("BAD_REQUEST", {
          message:
            "Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character (@, $, !, %, *, ?, &, or #).",
        });
      }
    }),
  },

  trustedOrigins: [
    process.env.BETTER_AUTH_URL || "http://localhost:3001",
  ],
});
