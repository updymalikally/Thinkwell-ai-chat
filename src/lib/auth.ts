import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";

const authBaseURL = process.env.BETTER_AUTH_URL || "http://localhost:3001";
const additionalTrustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const auth = betterAuth({
  baseURL: authBaseURL,

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
    sendResetPassword: async ({ user, url }) => {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        throw new Error("RESEND_API_KEY is not configured");
      }

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || "Thinkwell <onboarding@resend.dev>",
          to: [user.email],
          subject: "Reset your Thinkwell password",
          html: `<p>We received a request to reset your Thinkwell password.</p><p><a href="${url}">Choose a new password</a></p><p>If you did not request this, you can ignore this email.</p>`,
        }),
      });

      if (!response.ok) {
        const details = await response.text();
        throw new Error(`Resend email failed (${response.status}): ${details}`);
      }
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      accessType: "offline",
      prompt: "select_account consent",
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
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

  trustedOrigins: [...new Set([
    authBaseURL,
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    ...additionalTrustedOrigins,
  ])],
});
