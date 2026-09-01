import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        jobId: z.string().uuid(),
        filePath: z.string().min(1),
        fileName: z.string().min(1).max(300),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: candidate, error } = await context.supabase
      .from("candidates")
      .insert({
        user_id: context.userId,
        job_description_id: data.jobId,
        file_path: data.filePath,
        file_name: data.fileName,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: candidate.id };
  });

export const setCandidateStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        candidateId: z.string().uuid(),
        status: z.enum(["shortlisted", "rejected", "analyzed"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("candidates")
      .update({ status: data.status })
      .eq("id", data.candidateId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ candidateId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: candidate } = await context.supabase
      .from("candidates")
      .select("file_path")
      .eq("id", data.candidateId)
      .maybeSingle();
    if (candidate?.file_path) {
      await context.supabase.storage.from("resumes").remove([candidate.file_path]);
    }
    const { error } = await context.supabase.from("candidates").delete().eq("id", data.candidateId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Full pipeline for one resume: extract text -> parse with the LLM ->
 * deterministic keyword score + LLM semantic score -> persist match result and re-rank.
 */
export const processCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ candidateId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { extractDocumentText } = await import("./text-extract.server");
    const matching = await import("./matching.server");

    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select("*")
      .eq("id", data.candidateId)
      .maybeSingle();
    if (candidateError) throw new Error(candidateError.message);
    if (!candidate) throw new Error("Candidate not found.");

    const { data: job, error: jobError } = await supabase
      .from("job_descriptions")
      .select("*")
      .eq("id", candidate.job_description_id)
      .maybeSingle();
    if (jobError) throw new Error(jobError.message);
    if (!job) throw new Error("Job description not found.");

    await supabase.from("candidates").update({ status: "processing", error_message: null }).eq("id", candidate.id);

    try {
      let rawText = candidate.raw_text ?? "";
      if (!rawText) {
        const { data: file, error: downloadError } = await supabase.storage
          .from("resumes")
          .download(candidate.file_path);
        if (downloadError || !file) throw new Error(downloadError?.message ?? "Could not download the resume file.");
        rawText = await extractDocumentText(await file.arrayBuffer(), candidate.file_name ?? candidate.file_path);
      }

      const parsed = await matching.parseResume(rawText);

      await supabase
        .from("candidates")
        .update({
          raw_text: rawText,
          full_name: parsed.full_name ?? candidate.file_name ?? "Unknown candidate",
          email: parsed.email,
          phone: parsed.phone,
          parsed_skills: parsed.skills,
          parsed_education: parsed.education,
          parsed_experience: parsed.experience,
          total_experience_years: parsed.total_experience_years,
        })
        .eq("id", candidate.id);

      const jd: matching.ParsedJd = {
        required_skills: job.required_skills ?? [],
        preferred_skills: job.preferred_skills ?? [],
        min_experience_years: job.min_experience_years === null ? null : Number(job.min_experience_years),
        education_requirement: job.education_requirement,
        role_summary: job.role_summary,
      };

      const keyword = matching.keywordScore(jd.required_skills, parsed.skills, rawText);
      const semantic = await matching.semanticMatch(jd, parsed, rawText);
      const overall = matching.overallScore(keyword.score, semantic.semantic_score);

      const matchedSkills = Array.from(new Set([...keyword.matched, ...semantic.matched_skills]));
      const missingSkills = semantic.missing_skills.length ? semantic.missing_skills : keyword.missing;

      const { error: upsertError } = await supabase.from("match_results").upsert(
        {
          candidate_id: candidate.id,
          job_description_id: job.id,
          overall_score: overall,
          keyword_score: keyword.score,
          semantic_score: semantic.semantic_score,
          matched_skills: matchedSkills,
          missing_skills: missingSkills,
          ai_summary: semantic.rationale,
          strengths: semantic.strength,
          concerns: semantic.concern,
        },
        { onConflict: "candidate_id,job_description_id" },
      );
      if (upsertError) throw new Error(upsertError.message);

      const keepStatus = candidate.status === "shortlisted" || candidate.status === "rejected";
      await supabase
        .from("candidates")
        .update({ status: keepStatus ? candidate.status : "analyzed", error_message: null })
        .eq("id", candidate.id);

      // Re-rank every analyzed candidate for this job.
      const { data: ranked } = await supabase
        .from("match_results")
        .select("id, overall_score")
        .eq("job_description_id", job.id)
        .order("overall_score", { ascending: false });
      if (ranked) {
        await Promise.all(
          ranked.map((row, index) => supabase.from("match_results").update({ rank: index + 1 }).eq("id", row.id)),
        );
      }

      return { ok: true, overall_score: overall };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analysis failed — needs manual review.";
      console.error(`[processCandidate] ${candidate.id}: ${message}`);
      await supabase.from("candidates").update({ status: "failed", error_message: message }).eq("id", candidate.id);
      return { ok: false, error: message };
    }
  });
