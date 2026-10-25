export function getOpenAIKey() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key || /^(your_api_key_here|your_key_here|replace_with_a_valid_api_key)$/i.test(key)) return undefined;
  return key;
}

export function getChatModelOptions() {
  const defaultModel = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const configured = (process.env.OPENAI_MODELS || "").split(",").map(model => model.trim()).filter(Boolean);
  return { defaultModel, models: [...new Set([defaultModel, ...configured])] };
}
