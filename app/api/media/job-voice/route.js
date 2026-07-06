import { apiLimits, assertBusinessFeature, getAuthenticatedSupabase, jsonError, limitText, recordUsageEvent, sanitizeFileName } from "../../_shared";

const jobVoiceBucket = "job_voice_notes";

function getVoiceExtension(mimeType) {
  if (mimeType?.includes("mp4")) return "m4a";
  if (mimeType?.includes("mpeg")) return "mp3";
  return "webm";
}

export async function POST(request) {
  const { supabase, user, error } = await getAuthenticatedSupabase(request, 20);
  if (error) return error;

  const formData = await request.formData();
  const businessId = formData.get("business_id");
  const jobId = formData.get("job_id");
  const transcript = limitText(formData.get("transcript"));
  const replaceExisting = formData.get("replace_existing") === "true";
  const file = formData.get("voice");

  if (!businessId || !jobId) return jsonError("Business and job are required.");
  if (!file && !transcript) return Response.json({ savedCount: 0 });

  const { error: entitlementError } = await assertBusinessFeature(supabase, businessId, "voice");
  if (entitlementError) return entitlementError;

  if (replaceExisting) {
    const { error: deleteError } = await supabase.from("job_voice_notes").delete().eq("job_id", jobId).eq("business_id", businessId);
    if (deleteError) return jsonError(`Could not replace old voice notes: ${deleteError.message}`, 400);
  }

  if (!file || typeof file !== "object" || !("size" in file)) {
    const { error: insertError } = await supabase.from("job_voice_notes").insert({
      business_id: businessId,
      job_id: jobId,
      transcript,
      file_name: null,
      storage_path: null,
    });
    if (insertError) return jsonError(`Voice metadata failed: ${insertError.message}`, 400);
    await recordUsageEvent(supabase, {
      businessId,
      userId: user.id,
      eventType: "voice_uploaded",
      jobId,
      metadata: { transcript_only: true },
    });
    return Response.json({ savedCount: 1 });
  }

  if (!file.type?.startsWith("audio/")) return jsonError("Voice note must be an audio file.", 415);
  if (file.size > apiLimits.maxVoiceSizeBytes) return jsonError("Voice recording is larger than 25 MB.", 413);

  const extension = getVoiceExtension(file.type);
  const fileName = sanitizeFileName(file.name || `voice-note-${Date.now()}.${extension}`);
  const storagePath = `${businessId}/${jobId}/${Date.now()}-${fileName || `voice-note.${extension}`}`;
  const { error: uploadError } = await supabase.storage.from(jobVoiceBucket).upload(storagePath, file, {
    cacheControl: "3600",
    contentType: file.type || "audio/webm",
    upsert: false,
  });

  if (uploadError) return jsonError(`Voice upload failed: ${uploadError.message}`, 400);

  const { error: insertError } = await supabase.from("job_voice_notes").insert({
    business_id: businessId,
    job_id: jobId,
    transcript,
    file_name: fileName,
    storage_path: storagePath,
  });

  if (insertError) return jsonError(`Voice metadata failed: ${insertError.message}`, 400);

  await recordUsageEvent(supabase, {
    businessId,
    userId: user.id,
    eventType: "voice_uploaded",
    jobId,
    metadata: { transcript_only: false },
  });

  return Response.json({ savedCount: 1 });
}
