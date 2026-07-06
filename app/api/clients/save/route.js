import { getAuthenticatedSupabase, jsonError, limitText } from "../../_shared";

export async function POST(request) {
  const { supabase, error } = await getAuthenticatedSupabase(request, 30);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return jsonError("Invalid client payload.");

  if (!body.business_id) return jsonError("Business is required.");
  if (!limitText(body.name)) return jsonError("Client name is required.");

  const payload = {
    business_id: body.business_id,
    name: limitText(body.name),
    phone: limitText(body.phone),
    email: limitText(body.email),
    address: limitText(body.address),
    notes: limitText(body.notes),
  };

  const requestBuilder = body.client_id
    ? supabase.from("clients").update(payload).eq("client_id", body.client_id).eq("business_id", body.business_id)
    : supabase.from("clients").insert(payload);

  const { data, error: saveError } = await requestBuilder.select().single();
  if (saveError) return jsonError(`Could not save client: ${saveError.message}`, 400);

  return Response.json({ client: data });
}
