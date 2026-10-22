import { headers } from "next/headers";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chatMessage, conversation, messageFeedback } from "@/lib/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET) {
    return Response.json({ error: "Configure DATABASE_URL and BETTER_AUTH_SECRET in .env.local first." }, { status: 503 });
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Sign in to view chat history." }, { status: 401 });
  const conversationId = new URL(request.url).searchParams.get("id");
  if (conversationId) {
    const [ownedConversation] = await db.select({ id: conversation.id }).from(conversation)
      .where(and(eq(conversation.id, conversationId), eq(conversation.userId, session.user.id))).limit(1);
    if (!ownedConversation) return Response.json({ error: "Conversation not found." }, { status: 404 });
    try {
      const messages = await db.select({ id: chatMessage.id, role: chatMessage.role, content: chatMessage.content, feedback: messageFeedback.rating, createdAt: chatMessage.createdAt })
        .from(chatMessage).leftJoin(messageFeedback, and(eq(messageFeedback.messageId, chatMessage.id), eq(messageFeedback.userId, session.user.id)))
        .where(eq(chatMessage.conversationId, conversationId)).orderBy(chatMessage.createdAt);
      return Response.json({ messages });
    } catch {
      // Older databases may not have the optional feedback table yet. History should still open.
      const messages = await db.select({ id: chatMessage.id, role: chatMessage.role, content: chatMessage.content, createdAt: chatMessage.createdAt })
        .from(chatMessage).where(eq(chatMessage.conversationId, conversationId)).orderBy(chatMessage.createdAt);
      return Response.json({ messages: messages.map(message => ({ ...message, feedback: null })) });
    }
  }
  const conversations = await db.select({ id: conversation.id, title: conversation.title, updatedAt: conversation.updatedAt })
    .from(conversation).where(eq(conversation.userId, session.user.id)).orderBy(desc(conversation.updatedAt)).limit(100);
  return Response.json({ conversations });
}
