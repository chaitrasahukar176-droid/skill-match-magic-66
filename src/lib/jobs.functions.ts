import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createJobSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  company: z.string().trim().max(200).optional(),
  rawText: z.string().trim().min(50, "Paste at least a few sentences of the job description."),
});

export const listJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("job_descriptions")
      .select("id, title, company, role_summary, required_skills, preferred_skills, min_experience_years, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: candidates, error: candidateError } = await context.supabase
      .from("candidates")
      .select("id, job_description_id, status");
    if (candidateError) throw new Error(candidateError.message);

    return (data ?? []).map((job) => {
      const rows = (candidates ?? []).filter((c) => c.job_description_id === job.id);
      return {
        ...job,
        candidate_count: rows.length,
        shortlisted_count: rows.filter((c) => c.status === "shortlisted").length,
      };
    });
  });

export const getJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: job, error } = await context.supabase
      .from("job_descriptions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!job) return null;

    const { data: candidates, error: candidateError } = await context.supabase
      .from("candidates")
      .select("*")
      .eq("job_description_id", data.id)
      .order("created_at", { ascending: true });
    if (candidateError) throw new Error(candidateError.message);

    const { data: results, error: resultError } = await context.supabase
      .from("match_results")
      .select("*")
      .eq("job_description_id", data.id);
    if (resultError) throw new Error(resultError.message);

    return {
      job,
      candidates: (candidates ?? []).map((candidate) => ({
        ...candidate,
        match: (results ?? []).find((r) => r.candidate_id === candidate.id) ?? null,
      })),
    };
  });

export const createJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createJobSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { parseJobDescription } = await import("./matching.server");
    const parsed = await parseJobDescription(data.rawText);

    const { data: job, error } = await context.supabase
      .from("job_descriptions")
      .insert({
        user_id: context.userId,
        title: data.title || parsed.title || "Untitled role",
        company: data.company || parsed.company || null,
        raw_text: data.rawText,
        role_summary: parsed.role_summary,
        required_skills: parsed.required_skills,
        preferred_skills: parsed.preferred_skills,
        min_experience_years: parsed.min_experience_years,
        education_requirement: parsed.education_requirement,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: job.id };
  });

export const deleteJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("job_descriptions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: jobs, error: jobError }, { data: candidates, error: candidateError }, { data: results, error: resultError }] =
      await Promise.all([
        context.supabase.from("job_descriptions").select("id, title, company, created_at").order("created_at", { ascending: false }),
        context.supabase.from("candidates").select("id, full_name, status, created_at, job_description_id").order("created_at", { ascending: false }),
        context.supabase.from("match_results").select("overall_score, created_at"),
      ]);
    if (jobError) throw new Error(jobError.message);
    if (candidateError) throw new Error(candidateError.message);
    if (resultError) throw new Error(resultError.message);

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekScores = (results ?? []).filter((r) => new Date(r.created_at).getTime() >= weekAgo).map((r) => Number(r.overall_score));
    const avgWeek = weekScores.length
      ? Math.round(weekScores.reduce((sum, n) => sum + n, 0) / weekScores.length)
      : null;

    return {
      jobCount: (jobs ?? []).length,
      candidateCount: (candidates ?? []).length,
      shortlistedCount: (candidates ?? []).filter((c) => c.status === "shortlisted").length,
      avgScoreThisWeek: avgWeek,
      recentJobs: (jobs ?? []).slice(0, 5),
      recentCandidates: (candidates ?? []).slice(0, 8),
    };
  });
