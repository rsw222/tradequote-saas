import { getAuthenticatedSupabase, jsonError } from "../../_shared";

const allowedStatuses = new Set(["draft", "sent", "accepted", "rejected", "expired"]);

export async function POST(request) {
  const { supabase, error } = await getAuthenticatedSupabase(request, 30);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return jsonError("Invalid status payload.");
  if (!body.quote_id || !body.business_id) return jsonError("Quote and business are required.");
  if (!allowedStatuses.has(body.status)) return jsonError("Invalid quote status.");

  const { data, error: updateError } = await supabase
    .from("quotes")
    .update({
      status: body.status,
      updated_at: new Date().toISOString(),
    })
    .eq("quote_id", body.quote_id)
    .eq("business_id", body.business_id)
    .select()
    .single();

  if (updateError) return jsonError(`Could not update quote status: ${updateError.message}`, 400);

  return Response.json({ quote: data });
}
