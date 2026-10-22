import { getOpenAIKey } from "@/lib/ai-config";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ready: Boolean(getOpenAIKey()),
  }, { headers: { "Cache-Control": "no-store" } });
}
