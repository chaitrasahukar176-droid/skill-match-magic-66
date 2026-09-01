import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { BrainCircuit, FileStack, ListOrdered, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SkillMatch AI — AI resume screening for recruiters" },
      {
        name: "description",
        content:
          "Parse job descriptions, bulk-upload resumes and get a ranked shortlist with explainable keyword and semantic match scores.",
      },
      { property: "og:title", content: "SkillMatch AI — AI resume screening for recruiters" },
      {
        property: "og:description",
        content: "Ranked shortlists with explainable match scores, built from your job description and resume pile.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: BrainCircuit,
    title: "JD parsing that you can audit",
    body: "Paste a job description and see the extracted required skills, nice-to-haves, experience bar and education requirement before screening starts.",
  },
  {
    icon: FileStack,
    title: "Bulk resume intake",
    body: "Drop dozens of PDFs and DOCX files at once. Text extraction, structured parsing and scoring run per file with clear per-file errors.",
  },
  {
    icon: ListOrdered,
    title: "Explainable ranking",
    body: "Every score splits into deterministic keyword overlap and AI semantic fit, with matched skills, gaps, strengths and concerns.",
  },
  {
    icon: ShieldCheck,
    title: "Your data stays yours",
    body: "Resumes live in a private bucket and every row is scoped to your account with row-level security.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <BrainCircuit className="size-4" />
          </span>
          SkillMatch AI
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="py-16 sm:py-24">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-3xl"
          >
            <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              AI resume screening
            </span>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">
              Stop reading 300 resumes. Read the top 10.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
              SkillMatch AI reads your job description, screens every resume you upload, and hands you a ranked
              shortlist where each score comes with the reasoning behind it.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">Start screening free</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/auth">I already have an account</Link>
              </Button>
            </div>
          </motion.div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {features.map((feature, index) => (
            <motion.article
              key={feature.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: index * 0.05, duration: 0.28 }}
              className="card-surface p-6"
            >
              <feature.icon className="size-5 text-primary" />
              <h2 className="mt-4 text-base font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
            </motion.article>
          ))}
        </section>
      </main>
    </div>
  );
}
