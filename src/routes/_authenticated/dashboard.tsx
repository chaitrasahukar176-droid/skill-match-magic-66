import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { BriefcaseBusiness, FileText, Gauge, Plus, Star } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboardStats } from "@/lib/jobs.functions";

const statsQuery = queryOptions({
  queryKey: ["dashboard-stats"],
  queryFn: () => getDashboardStats(),
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Screening overview — SkillMatch AI" },
      { name: "description", content: "Track job descriptions, screened resumes and average match scores at a glance." },
      { property: "og:title", content: "Screening overview — SkillMatch AI" },
      { property: "og:description", content: "Track job descriptions, screened resumes and average match scores." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(statsQuery),
  pendingComponent: () => (
    <AppShell>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </AppShell>
  ),
  errorComponent: ({ error }) => (
    <AppShell>
      <p className="text-sm text-danger">Couldn't load your overview: {error.message}</p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <p className="text-sm text-muted-foreground">Nothing here.</p>
    </AppShell>
  ),
  component: DashboardPage,
});

function DashboardPage() {
  const { data } = useSuspenseQuery(statsQuery);

  const cards = [
    { label: "Job descriptions", value: data.jobCount, icon: BriefcaseBusiness },
    { label: "Resumes screened", value: data.candidateCount, icon: FileText },
    { label: "Shortlisted", value: data.shortlistedCount, icon: Star },
    { label: "Avg. score (7 days)", value: data.avgScoreThisWeek ?? "—", icon: Gauge },
  ];

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Screening overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your first-pass shortlist engine — every score is backed by matched skills and a written rationale.
          </p>
        </div>
        <Button asChild>
          <Link to="/jobs/new">
            <Plus className="size-4" />
            New job description
          </Link>
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.25 }}
            whileHover={{ scale: 1.02 }}
            className="card-surface p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.label}</span>
              <card.icon className="size-4 text-primary" />
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums">{card.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="card-surface p-5">
          <h2 className="text-sm font-semibold">Recent job descriptions</h2>
          {data.recentJobs.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No job descriptions yet. Create one to start screening resumes.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {data.recentJobs.map((job) => (
                <li key={job.id} className="py-2.5">
                  <Link
                    to="/jobs/$jobId"
                    params={{ jobId: job.id }}
                    className="flex items-center justify-between text-sm transition-colors hover:text-primary"
                  >
                    <span className="font-medium">{job.title}</span>
                    <span className="text-xs text-muted-foreground">{job.company ?? "—"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-surface p-5">
          <h2 className="text-sm font-semibold">Recent activity</h2>
          {data.recentCandidates.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Uploaded resumes will appear here.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {data.recentCandidates.map((candidate) => (
                <li key={candidate.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-medium">{candidate.full_name ?? "Processing resume…"}</span>
                  <span className="text-xs capitalize text-muted-foreground">{candidate.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
