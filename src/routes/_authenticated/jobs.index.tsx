import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteJob, listJobs } from "@/lib/jobs.functions";

const jobsQuery = queryOptions({
  queryKey: ["jobs"],
  queryFn: () => listJobs(),
});

export const Route = createFileRoute("/_authenticated/jobs/")({
  head: () => ({
    meta: [
      { title: "Job descriptions — SkillMatch AI" },
      { name: "description", content: "Manage the roles you're screening for and review the AI-extracted requirement breakdown." },
      { property: "og:title", content: "Job descriptions — SkillMatch AI" },
      { property: "og:description", content: "Manage the roles you're screening for and their extracted requirements." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(jobsQuery),
  pendingComponent: () => (
    <AppShell>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    </AppShell>
  ),
  errorComponent: ({ error }) => (
    <AppShell>
      <p className="text-sm text-danger">Couldn't load job descriptions: {error.message}</p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <p className="text-sm text-muted-foreground">Nothing here.</p>
    </AppShell>
  ),
  component: JobsPage,
});

function JobsPage() {
  const { data } = useSuspenseQuery(jobsQuery);
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: (id: string) => deleteJob({ data: { id } }),
    onSuccess: async () => {
      toast.success("Job description deleted");
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Job descriptions</h1>
          <p className="mt-1 text-sm text-muted-foreground">Each role holds its own candidate pool and ranking.</p>
        </div>
        <Button asChild>
          <Link to="/jobs/new">
            <Plus className="size-4" />
            New job description
          </Link>
        </Button>
      </div>

      {data.length === 0 ? (
        <div className="card-surface mt-8 flex flex-col items-center gap-3 p-12 text-center">
          <h2 className="text-base font-semibold">No roles yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Paste a job description and SkillMatch AI extracts the required skills, experience level and education
            requirement so you can sanity-check them before uploading resumes.
          </p>
          <Button asChild className="mt-2">
            <Link to="/jobs/new">Create your first job description</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {data.map((job, index) => (
              <motion.article
                key={job.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ delay: index * 0.04, duration: 0.22 }}
                whileHover={{ scale: 1.02 }}
                className="card-surface flex flex-col p-5 transition-shadow hover:shadow-[var(--shadow-elevated)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold leading-tight">{job.title}</h2>
                    <p className="text-xs text-muted-foreground">{job.company ?? "No company set"}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete job description"
                    onClick={() => remove.mutate(job.id)}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>

                <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{job.role_summary ?? "—"}</p>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {job.required_skills.slice(0, 4).map((skill) => (
                    <Badge key={skill} variant="secondary" className="font-normal">
                      {skill}
                    </Badge>
                  ))}
                  {job.required_skills.length > 4 ? (
                    <Badge variant="outline" className="font-normal">
                      +{job.required_skills.length - 4}
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="size-4" />
                    {job.candidate_count} candidates · {job.shortlisted_count} shortlisted
                  </span>
                  <Link
                    to="/jobs/$jobId"
                    params={{ jobId: job.id }}
                    className="flex items-center gap-1 font-medium text-primary"
                  >
                    Open
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      )}
    </AppShell>
  );
}
