import { assertBusinessFeature, getAuthenticatedSupabase, jsonError, recordUsageEvent } from "../_shared";

export async function POST(request) {
  const { supabase, user, error } = await getAuthenticatedSupabase(request, 12);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return jsonError("Invalid AI payload.");
  if (!body.business_id) return jsonError("Business is required for AI assistance.");
  if (!body.prompt) return jsonError("Missing prompt.");

  if (String(body.prompt).length > 12000) {
    return jsonError("Prompt is too large.", 413);
  }

  const { error: entitlementError } = await assertBusinessFeature(supabase, body.business_id, "ai");
  if (entitlementError) return entitlementError;

  await recordUsageEvent(supabase, {
    businessId: body.business_id,
    userId: user.id,
    eventType: "ai_request",
    metadata: {
      prompt_length: String(body.prompt).length,
    },
  });

  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  const apiUrl = process.env.LLM_API_URL || "https://api.openai.com/v1/chat/completions";
  const model = process.env.LLM_MODEL || "gpt-4o-mini";

  if (!apiKey) {
    return Response.json({
      provider: "local-rag-only",
      text:
        "No LLM_API_KEY or OPENAI_API_KEY is configured. The app is using local RAG recommendations and has prepared this prompt for the model.\n\n" +
        body.prompt,
    });
  }

  const systemPrompt =
    body.system ||
    "You help Australian tradespeople create accurate, cautious quotes. Use retrieved context, identify uncertainty, and never invent site facts.";

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        { role: "user", content: body.prompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    return Response.json({ error: await response.text() }, { status: response.status });
  }

  const data = await response.json();
  return Response.json({
    provider: apiUrl,
    model,
    text: data.choices?.[0]?.message?.content || "The LLM returned no text.",
  });
}
