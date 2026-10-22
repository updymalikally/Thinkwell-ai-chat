import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chatMessage, messageFeedback } from "@/lib/schema";

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET) {
    return Response.json({ error: "Sign-in is not configured." }, { status: 503 });
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Sign in to send feedback." }, { status: 401 });
  const body = await request.json().catch(() => null) as { messageId?: unknown; rating?: unknown } | null;
  const messageId = typeof body?.messageId === "string" ? body.messageId : "";
  const rating = body?.rating;
  if (!messageId || (rating !== "up" && rating !== "down" && rating !== null)) {
    return Response.json({ error: "Choose a valid response rating." }, { status: 400 });
  }
  const [ownedMessage] = await db.select({ id: chatMessage.id }).from(chatMessage)
    .where(and(eq(chatMessage.id, messageId), eq(chatMessage.userId, session.user.id), eq(chatMessage.role, "assistant"))).limit(1);
  if (!ownedMessage) return Response.json({ error: "That response was not found." }, { status: 404 });

  if (rating === null) {
    await db.delete(messageFeedback).where(and(eq(messageFeedback.userId, session.user.id), eq(messageFeedback.messageId, messageId)));
  } else {
    await db.insert(messageFeedback).values({ userId: session.user.id, messageId, rating })
      .onConflictDoUpdate({ target: [messageFeedback.userId, messageFeedback.messageId], set: { rating, createdAt: new Date() } });
  }
  return Response.json({ rating });
}
