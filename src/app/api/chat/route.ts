import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chatMessage, conversation } from "@/lib/schema";
import { getOpenAIKey } from "@/lib/ai-config";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatInput = { conversationId?: string; messages?: Array<{ role: "user" | "assistant"; content: string }> };

async function saveTurn(userId: string, conversationId: string, userText: string, assistantText: string) {
  const userCreatedAt = new Date();
  await db.insert(chatMessage).values([
    { id: `${crypto.randomUUID()}-user`, userId, conversationId, role: "user", content: userText, createdAt: userCreatedAt },
    { id: crypto.randomUUID(), userId, conversationId, role: "assistant", content: assistantText, createdAt: new Date(userCreatedAt.getTime() + 1) },
  ]);
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET) {
    return Response.json({ error: "Configure DATABASE_URL and BETTER_AUTH_SECRET in .env.local first." }, { status: 503 });
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Sign in to use chat." }, { status: 401 });

  let messages: NonNullable<ChatInput["messages"]>;
  let conversationId: string;
  try {
    const body = await request.json() as ChatInput;
    if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length > 100 || body.messages.some((m) => !["user", "assistant"].includes(m.role) || typeof m.content !== "string" || m.content.length > 20_000)) throw new Error();
    messages = body.messages;
    conversationId = body.conversationId && /^[a-zA-Z0-9_-]{8,80}$/.test(body.conversationId) ? body.conversationId : crypto.randomUUID();
  } catch {
    return Response.json({ error: "Invalid chat messages." }, { status: 400 });
  }

  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
  if (!latestUserMessage) return Response.json({ error: "A user message is required." }, { status: 400 });
  const selectedModel = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const [existingConversation] = await db.select({ id: conversation.id, userId: conversation.userId })
    .from(conversation).where(eq(conversation.id, conversationId)).limit(1);
  if (existingConversation && existingConversation.userId !== session.user.id) {
    return Response.json({ error: "This conversation does not belong to your account." }, { status: 403 });
  }
  if (existingConversation) {
    await db.update(conversation).set({ updatedAt: new Date() })
      .where(and(eq(conversation.id, conversationId), eq(conversation.userId, session.user.id)));
  } else {
    await db.insert(conversation).values({ id: conversationId, userId: session.user.id, title: latestUserMessage.content.slice(0, 100) });
  }

  const apiKey = getOpenAIKey();
  if (!apiKey) {
    const error = "Your OpenAI API key isn't configured, so I can't reach the AI service yet. Add OPENAI_API_KEY to .env.local when you have a working API key, then restart the app.";
    await saveTurn(session.user.id, conversationId, latestUserMessage.content, error);
    return Response.json({ error, conversationId }, { status: 503 });
  }

  try {
    const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    const assistantInstructions = [
      "You are Thinkwell AI Pro, the AI assistant in the Thinkwell app.",
      "If someone asks who you are or what your name is, say: ‘I’m Thinkwell AI Pro, your AI assistant in Thinkwell. How can I help?’",
      "If someone asks who owns, created, or developed Thinkwell or Thinkwell AI Pro, say: ‘Thinkwell was developed by Abdimali Ali.’",
      "Be clear and helpful. Do not claim to be a human. If asked which AI model or provider is powering you, answer honestly based on what you know; do not guess."
    ].join(" ");
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: selectedModel, temperature: 0.7, messages: [{ role: "system", content: assistantInstructions }, ...messages], stream: true }),
      cache: "no-store",
    });
    if (!upstream.ok) {
      const responseBody = await upstream.json().catch(() => null) as { error?: { code?: string; type?: string; message?: string } } | null;
      const code = `${responseBody?.error?.code || ""} ${responseBody?.error?.type || ""}`.toLowerCase();
      let error: string;
      if (upstream.status === 401 || upstream.status === 403 || code.includes("invalid_api_key")) {
        error = "Your OpenAI API key isn't reaching the service or isn't valid. Check OPENAI_API_KEY in .env.local.";
      } else if (upstream.status === 429 || code.includes("quota") || code.includes("billing")) {
        error = "Your API key reached the AI service, but it has no API credits or available quota. ChatGPT free access doesn't automatically include API credits; check API billing or credits for this key.";
      } else {
        error = `The AI service returned an error (${upstream.status}). Check that your API key, model, and API URL are valid.`;
      }
      await saveTurn(session.user.id, conversationId, latestUserMessage.content, error);
      return Response.json({ error, conversationId }, { status: upstream.status });
    }
    if (!upstream.body) return Response.json({ error: "The AI service did not return a stream." }, { status: 502 });

    const messageId = crypto.randomUUID();
    let answer = "";
    let pending = "";
    const decoder = new TextDecoder();
    const collect = (text: string) => {
      pending += text;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const delta = JSON.parse(data).choices?.[0]?.delta?.content;
          if (typeof delta === "string") answer += delta;
        } catch {}
      }
    };
    const transform = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        collect(decoder.decode(chunk, { stream: true }));
        controller.enqueue(chunk);
      },
      async flush() {
        collect(decoder.decode());
        collect("\n");
        if (answer) {
          const userCreatedAt = new Date();
          await db.insert(chatMessage).values([
            { id: `${messageId}-user`, userId: session.user.id, conversationId, role: "user", content: latestUserMessage.content, createdAt: userCreatedAt },
            { id: messageId, userId: session.user.id, conversationId, role: "assistant", content: answer, createdAt: new Date(userCreatedAt.getTime() + 1) },
          ]);
        }
      },
    });
    return new Response(upstream.body.pipeThrough(transform), { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no", "X-Message-Id": messageId } });
  } catch {
    const error = "I couldn't reach the AI service. Check your connection, OPENAI_BASE_URL, and API key settings.";
    try { await saveTurn(session.user.id, conversationId, latestUserMessage.content, error); } catch {}
    return Response.json({ error, conversationId }, { status: 502 });
  }
}
