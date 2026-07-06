import { getAuthenticatedSupabase, jsonError } from "../../_shared";

const allowedStatuses = new Set(["open", "in_progress", "blocked", "done", "cancelled"]);

export async function POST(request) {
  const { supabase, user, error } = await getAuthenticatedSupabase(request, 30);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return jsonError("Invalid task status payload.");
  if (!body.business_id || !body.agent_task_id) return jsonError("Business and task are required.");
  if (!allowedStatuses.has(body.status)) return jsonError("Invalid task status.");

  const updatePayload = {
    status: body.status,
    completed_at: body.status === "done" ? new Date().toISOString() : null,
  };

  const { data: task, error: taskError } = await supabase
    .from("agent_tasks")
    .update(updatePayload)
    .eq("agent_task_id", body.agent_task_id)
    .eq("business_id", body.business_id)
    .select()
    .single();

  if (taskError) return jsonError(`Could not update task: ${taskError.message}`, 400);

  await supabase.from("agent_activity_log").insert({
    business_id: body.business_id,
    agent_task_id: body.agent_task_id,
    job_id: task.job_id,
    quote_id: task.quote_id,
    actor_user_id: user.id,
    actor_type: "user",
    action: "task_status_updated",
    details: {
      status: body.status,
    },
  });

  return Response.json({ task });
}
