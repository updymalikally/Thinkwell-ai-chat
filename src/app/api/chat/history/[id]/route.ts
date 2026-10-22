import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversation } from "@/lib/schema";

type RouteContext = { params: Promise<{ id: string }> };

async function getUser() {
  if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET) return null;
  return auth.api.getSession({ headers: await headers() });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getUser();
  if (!session) return Response.json({ error: "Sign in to delete conversations." }, { status: 401 });
  const { id } = await context.params;
  const [deleted] = await db.delete(conversation)
    .where(and(eq(conversation.id, id), eq(conversation.userId, session.user.id))).returning({ id: conversation.id });
  if (!deleted) return Response.json({ error: "Conversation not found." }, { status: 404 });
  return Response.json({ ok: true });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getUser();
  if (!session) return Response.json({ error: "Sign in to rename conversations." }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { title?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 100) : "";
  if (!title) return Response.json({ error: "Enter a conversation name." }, { status: 400 });
  const [updated] = await db.update(conversation).set({ title, updatedAt: new Date() })
    .where(and(eq(conversation.id, id), eq(conversation.userId, session.user.id)))
    .returning({ id: conversation.id, title: conversation.title, updatedAt: conversation.updatedAt });
  if (!updated) return Response.json({ error: "Conversation not found." }, { status: 404 });
  return Response.json({ conversation: updated });
}
