import { getChatModelOptions, getOpenAIKey } from "@/lib/ai-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const { defaultModel, models } = getChatModelOptions();
  return Response.json({
    ready: Boolean(getOpenAIKey()),
    model: defaultModel,
    models,
  }, { headers: { "Cache-Control": "no-store" } });
}
