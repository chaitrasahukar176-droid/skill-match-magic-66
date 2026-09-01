import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ArrowLeft, Check, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { ResumeDropzone } from "@/components/ResumeDropzone";
import { ScoreRing } from "@/components/ScoreRing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getJob } from "@/lib/jobs.functions";
import { deleteCandidate, processCandidate, setCandidateStatus } from "@/lib/candidates.functions";

const jobQuery = (jobId: string) =>
  queryOptions({
    queryKey: ["job", jobId],
    queryFn: () => getJob({ data: { id: jobId } }),
  });

export const Route = createFileRoute("/_authenticated/jobs/$jobId")({
  head: () => ({
    meta: [
      { title: "Candidate ranking — SkillMatch AI" },
      { name: "description", content: "Ranked shortlist with explainable keyword and semantic match scores per candidate." },
      { property: "og:title", content: "Candidate ranking — SkillMatch AI" },
      { property: "og:description", content: "Ranked shortlist with explainable keyword and semantic match scores." },
    ],
  }),
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(jobQuery(params.jobId));
    if (!data) throw notFound();
    return null;
  },
  pendingComponent: () => (
    <AppShell>
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="mt-4 h-64 rounded-xl" />
    </AppShell>
  ),
  errorComponent: ({ error }) => (
    <AppShell>
      <p className="text-sm text-danger">Couldn't load this role: {error.message}</p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <p className="text-sm text-muted-foreground">That job description no longer exists.</p>
    </AppShell>
  ),
  component: JobDetailPage,
});

type Filter = "all" | "shortlisted" | "rejected";

function JobDetailPage() {
  const { jobId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(jobQuery(jobId));
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const status = useMutation({
    mutationFn: (vars: { candidateId: string; status: "shortlisted" | "rejected" | "analyzed" }) =>
      setCandidateStatus({ data: vars }),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  const reanalyze = useMutation({
    mutationFn: (candidateId: string) => processCandidate({ data: { candidateId } }),
    onSuccess: async (result) => {
      if (!result.ok) toast.error(result.error ?? "Analysis failed");
      else toast.success("Re-analyzed");
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (candidateId: string) => deleteCandidate({ data: { candidateId } }),
    onSuccess: async () => {
      toast.success("Candidate removed");
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!data) return null;
  const { job, candidates } = data;

  const ranked = [...candidates].sort(
    (a, b) => Number(b.match?.overall_score ?? -1) - Number(a.match?.overall_score ?? -1),
  );
  const visible = ranked.filter((candidate) => (filter === "all" ? true : candidate.status === filter));

  return (
    <AppShell>
      <Link to="/jobs" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        All job descriptions
      </Link>

      <header className="card-surface mt-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{job.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{job.company ?? "No company set"}</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <Stat label="Candidates" value={candidates.length} />
            <Stat label="Shortlisted" value={candidates.filter((c) => c.status === "shortlisted").length} />
            <Stat
              label="Min. experience"
              value={job.min_experience_years === null ? "—" : `${Number(job.min_experience_years)} yr`}
            />
          </div>
        </div>

        {job.role_summary ? <p className="mt-4 max-w-3xl text-sm leading-relaxed">{job.role_summary}</p> : null}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <SkillList title="Required skills" skills={job.required_skills} variant="default" />
          <SkillList title="Preferred skills" skills={job.preferred_skills} variant="secondary" />
        </div>
        {job.education_requirement ? (
          <p className="mt-4 text-xs text-muted-foreground">Education: {job.education_requirement}</p>
        ) : null}
      </header>

      <div className="mt-6">
        <ResumeDropzone jobId={jobId} onDone={refresh} />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Ranked shortlist</h2>
        <div className="flex gap-1.5">
          {(["all", "shortlisted", "rejected"] as Filter[]).map((value) => (
            <Button
              key={value}
              variant={filter === value ? "default" : "outline"}
              size="sm"
              className="capitalize"
              onClick={() => setFilter(value)}
            >
              {value}
            </Button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="card-surface mt-4 p-8 text-center text-sm text-muted-foreground">
          No candidates in this view yet. Upload resumes above to build the shortlist.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          <AnimatePresence mode="popLayout">
            {visible.map((candidate, index) => {
              const match = candidate.match;
              const open = expanded === candidate.id;
              return (
                <motion.li
                  key={candidate.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ delay: index * 0.03, duration: 0.2 }}
                  className="card-surface overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : candidate.id)}
                    className="flex w-full items-center gap-4 p-5 text-left"
                  >
                    <span className="w-8 text-sm font-semibold tabular-nums text-muted-foreground">#{index + 1}</span>
                    <ScoreRing score={match ? Number(match.overall_score) : null} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{candidate.full_name ?? candidate.file_name}</span>
                        <Badge variant="outline" className="font-normal capitalize">
                          {candidate.status}
                        </Badge>
                        {candidate.total_experience_years !== null ? (
                          <span className="text-xs text-muted-foreground">
                            {Number(candidate.total_experience_years)} yrs experience
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block truncate text-sm text-muted-foreground">
                        {candidate.status === "failed"
                          ? (candidate.error_message ?? "Analysis failed")
                          : (match?.ai_summary ?? "Awaiting analysis…")}
                      </span>
                    </span>
                  </button>

                  <AnimatePresence initial={false}>
                    {open ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="border-t border-border"
                      >
                        <div className="space-y-4 p-5">
                          {match ? (
                            <>
                              <div className="flex flex-wrap gap-6 text-sm">
                                <ScoreBreak label="Keyword overlap" value={match.keyword_score} />
                                <ScoreBreak label="Semantic fit" value={match.semantic_score} />
                              </div>
                              <div className="grid gap-4 sm:grid-cols-2">
                                <SkillList title="Matched skills" skills={match.matched_skills} variant="secondary" />
                                <SkillList title="Missing skills" skills={match.missing_skills} variant="outline" />
                              </div>
                              {match.strengths ? (
                                <p className="text-sm">
                                  <span className="font-medium">Strength:</span> {match.strengths}
                                </p>
                              ) : null}
                              {match.concerns ? (
                                <p className="text-sm">
                                  <span className="font-medium">Concern:</span> {match.concerns}
                                </p>
                              ) : null}
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              {candidate.error_message ?? "This resume hasn't been scored yet."}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              onClick={() => status.mutate({ candidateId: candidate.id, status: "shortlisted" })}
                            >
                              <Check className="size-4" />
                              Shortlist
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => status.mutate({ candidateId: candidate.id, status: "rejected" })}
                            >
                              <X className="size-4" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={reanalyze.isPending}
                              onClick={() => reanalyze.mutate(candidate.id)}
                            >
                              <RefreshCw className={`size-4 ${reanalyze.isPending ? "animate-spin" : ""}`} />
                              Re-analyze
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => remove.mutate(candidate.id)}>
                              <Trash2 className="size-4" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ScoreBreak({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value === null ? "—" : `${Math.round(Number(value))}%`}</p>
    </div>
  );
}

function SkillList({
  title,
  skills,
  variant,
}: {
  title: string;
  skills: string[];
  variant: "default" | "secondary" | "outline";
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {skills.length === 0 ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : (
          skills.map((skill) => (
            <Badge key={skill} variant={variant} className="font-normal">
              {skill}
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}
