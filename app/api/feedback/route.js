import { getAuthenticatedSupabase, jsonError, limitText } from "../_shared";

const allowedRatings = new Set(["blocked", "hard", "ok", "good"]);

export async function POST(request) {
  const { supabase, user, error } = await getAuthenticatedSupabase(request, 20);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return jsonError("Invalid feedback payload.");
  if (!body.business_id) return jsonError("Business is required.");

  const message = limitText(body.message);
  if (!message || message.length < 5) return jsonError("Add a few words before sending feedback.");

  const payload = {
    business_id: body.business_id,
    user_id: user.id,
    job_id: body.job_id || null,
    quote_id: body.quote_id || null,
    rating: allowedRatings.has(body.rating) ? body.rating : "ok",
    message,
    page_path: limitText(body.page_path, "/"),
    user_agent: limitText(body.user_agent),
    metadata: {
      client_name: limitText(body.client_name),
      trade_type: limitText(body.trade_type),
      quote_number: limitText(body.quote_number),
    },
  };

  const { data: feedback, error: feedbackError } = await supabase.from("pilot_feedback").insert(payload).select().single();
  if (feedbackError) return jsonError(`Could not save feedback: ${feedbackError.message}`, 400);

  return Response.json({ feedback });
}
