import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { motion } from "motion/react";
import { FileUp, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createJob } from "@/lib/jobs.functions";
import { readFileAsText } from "@/lib/client-file-text";

export const Route = createFileRoute("/_authenticated/jobs/new")({
  head: () => ({
    meta: [
      { title: "New job description — SkillMatch AI" },
      { name: "description", content: "Paste or upload a job description and let AI extract required skills, experience and education." },
      { property: "og:title", content: "New job description — SkillMatch AI" },
      { property: "og:description", content: "Paste or upload a job description and extract its requirements automatically." },
    ],
  }),
  component: NewJobPage,
});

function NewJobPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [rawText, setRawText] = useState("");
  const [reading, setReading] = useState(false);

  const create = useMutation({
    mutationFn: () => createJob({ data: { title: title || undefined, company: company || undefined, rawText } }),
    onSuccess: async (result) => {
      toast.success("Job description parsed");
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      navigate({ to: "/jobs/$jobId", params: { jobId: result.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    try {
      const text = await readFileAsText(file);
      setRawText(text);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
      toast.success("Job description text loaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't read that file");
    } finally {
      setReading(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">New job description</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste the JD (or upload a PDF/DOCX/TXT). AI extracts required skills, nice-to-haves, experience level and
          education requirement so you can review them before screening resumes.
        </p>

        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="card-surface mt-6 space-y-5 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (rawText.trim().length < 50) {
              toast.error("Add a bit more job description text (at least a few sentences).");
              return;
            }
            create.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Role title (optional)</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Senior Frontend Engineer" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company (optional)</Label>
              <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Inc." />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="jd">Job description</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={reading}>
                {reading ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
                Upload file
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                className="hidden"
                onChange={(e) => void pickFile(e.target.files?.[0])}
              />
            </div>
            <Textarea
              id="jd"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={14}
              placeholder="Paste the full job description here…"
              className="leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">{rawText.trim().length} characters</p>
          </div>

          <Button type="submit" disabled={create.isPending} className="w-full sm:w-auto">
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {create.isPending ? "Parsing requirements…" : "Parse & create"}
          </Button>
        </motion.form>
      </div>
    </AppShell>
  );
}
