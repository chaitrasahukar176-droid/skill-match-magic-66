import { createServerFn } from "@tanstack/react-start";

export const DEMO_EMAIL = "demo@skillmatch.ai";
export const DEMO_PASSWORD = "skillmatch-demo";

/**
 * Makes sure a ready-to-use demo recruiter account exists and has data.
 * Idempotent: safe to call on every "Try the demo" click.
 */
export const ensureDemoAccount = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1. Find or create the demo auth user (email pre-confirmed).
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  let demoUser = list?.users.find((u) => u.email?.toLowerCase() === DEMO_EMAIL);

  if (!demoUser) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { demo: true },
    });
    if (error || !data.user) throw new Error(error?.message ?? "Could not create the demo account");
    demoUser = data.user;
  } else {
    // Keep the password predictable even if it was changed.
    await supabaseAdmin.auth.admin.updateUserById(demoUser.id, { password: DEMO_PASSWORD });
  }

  const demoUserId = demoUser.id;

  // 2. Already populated? Nothing else to do.
  const { count } = await supabaseAdmin
    .from("job_descriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", demoUserId);

  if ((count ?? 0) > 0) return { email: DEMO_EMAIL, password: DEMO_PASSWORD };

  // 3. Copy the seeded showcase data from any other account that has some.
  const { data: sourceJobs } = await supabaseAdmin
    .from("job_descriptions")
    .select("*")
    .neq("user_id", demoUserId)
    .order("created_at", { ascending: true })
    .limit(3);

  if (sourceJobs?.length) {
    for (const job of sourceJobs) {
      const { data: newJob, error: jobError } = await supabaseAdmin
        .from("job_descriptions")
        .insert({
          user_id: demoUserId,
          title: job.title,
          company: job.company,
          raw_text: job.raw_text,
          role_summary: job.role_summary,
          required_skills: job.required_skills,
          preferred_skills: job.preferred_skills,
          min_experience_years: job.min_experience_years,
          education_requirement: job.education_requirement,
        })
        .select("id")
        .single();
      if (jobError || !newJob) continue;

      const { data: sourceCandidates } = await supabaseAdmin
        .from("candidates")
        .select("*")
        .eq("job_description_id", job.id);

      for (const candidate of sourceCandidates ?? []) {
        const { data: newCandidate } = await supabaseAdmin
          .from("candidates")
          .insert({
            user_id: demoUserId,
            job_description_id: newJob.id,
            file_path: candidate.file_path,
            file_name: candidate.file_name,
            full_name: candidate.full_name,
            email: candidate.email,
            phone: candidate.phone,
            status: candidate.status,
            raw_text: candidate.raw_text,
            parsed_skills: candidate.parsed_skills,
            parsed_experience: candidate.parsed_experience,
            parsed_education: candidate.parsed_education,
            total_experience_years: candidate.total_experience_years,
          })
          .select("id")
          .single();
        if (!newCandidate) continue;

        const { data: sourceMatch } = await supabaseAdmin
          .from("match_results")
          .select("*")
          .eq("candidate_id", candidate.id)
          .maybeSingle();

        if (sourceMatch) {
          await supabaseAdmin.from("match_results").insert({
            job_description_id: newJob.id,
            candidate_id: newCandidate.id,
            overall_score: sourceMatch.overall_score,
            keyword_score: sourceMatch.keyword_score,
            semantic_score: sourceMatch.semantic_score,
            matched_skills: sourceMatch.matched_skills,
            missing_skills: sourceMatch.missing_skills,
            strengths: sourceMatch.strengths,
            concerns: sourceMatch.concerns,
            ai_summary: sourceMatch.ai_summary,
            rank: sourceMatch.rank,
          });
        }
      }
    }
  }

  return { email: DEMO_EMAIL, password: DEMO_PASSWORD };
});
