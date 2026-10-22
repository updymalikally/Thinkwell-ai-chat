import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chatMessage, conversation } from "@/lib/schema";
import { getOpenAIKey } from "@/lib/ai-config";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImageInput = { prompt?: string; conversationId?: string };

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET) {
    return Response.json({ error: "Set up the app's database and sign-in settings first." }, { status: 503 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Sign in to create an image." }, { status: 401 });

  let prompt: string;
  let conversationId: string;
  let model: string;
  try {
    const body = await request.json() as ImageInput;
    prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt || prompt.length > 4000) throw new Error();
    model = process.env.OPENAI_IMAGE_MODEL || "bytedance-seed/seedream-4.5";
    conversationId = body.conversationId && /^[a-zA-Z0-9_-]{8,80}$/.test(body.conversationId) ? body.conversationId : crypto.randomUUID();
  } catch {
    return Response.json({ error: "Enter an image description under 4,000 characters." }, { status: 400 });
  }

  const [existing] = await db.select({ id: conversation.id, userId: conversation.userId })
    .from(conversation).where(eq(conversation.id, conversationId)).limit(1);
  if (existing && existing.userId !== session.user.id) {
    return Response.json({ error: "This conversation does not belong to your account." }, { status: 403 });
  }
  if (existing) {
    await db.update(conversation).set({ updatedAt: new Date() })
      .where(and(eq(conversation.id, conversationId), eq(conversation.userId, session.user.id)));
  } else {
    await db.insert(conversation).values({ id: conversationId, userId: session.user.id, title: prompt.slice(0, 100) });
  }

  const apiKey = getOpenAIKey();
  if (!apiKey) return Response.json({ error: "Add your OpenRouter API key to .env.local, then restart the app." }, { status: 503 });

  try {
    const baseUrl = (process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
    const upstream = await fetch(`${baseUrl}/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt }),
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });
    const result = await upstream.json().catch(() => null) as {
      data?: Array<{ b64_json?: string; media_type?: string }>;
      error?: { message?: string };
    } | null;
    if (!upstream.ok) {
      const error = upstream.status === 402
        ? "OpenRouter needs available credits for image generation. Check your balance, then try again."
        : result?.error?.message || `Image generation failed (${upstream.status}). Check your OpenRouter model and credits.`;
      return Response.json({ error }, { status: upstream.status });
    }

    const image = result?.data?.[0];
    if (!image?.b64_json) return Response.json({ error: "The image service returned no image. Please try again." }, { status: 502 });

    const mediaType = image.media_type?.startsWith("image/") ? image.media_type : "image/png";
    const assistantText = "Created an image from your description.";
    const createdAt = new Date();
    await db.insert(chatMessage).values([
      { id: `${crypto.randomUUID()}-user`, userId: session.user.id, conversationId, role: "user", content: prompt, createdAt },
      { id: crypto.randomUUID(), userId: session.user.id, conversationId, role: "assistant", content: assistantText, createdAt: new Date(createdAt.getTime() + 1) },
    ]);
    return Response.json({ image: `data:${mediaType};base64,${image.b64_json}`, conversationId });
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "Image creation took too long. Please try again."
      : "Could not reach OpenRouter. Check your connection and try again.";
    return Response.json({ error: message }, { status: 502 });
  }
}
