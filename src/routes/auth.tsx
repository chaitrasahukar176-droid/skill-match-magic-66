import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Loader2, PlayCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_EMAIL, DEMO_PASSWORD, ensureDemoAccount } from "@/lib/demo.functions";


export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Recruiter sign in — SkillMatch AI" },
      { name: "description", content: "Sign in to screen resumes against your job descriptions with explainable AI match scores." },
      { property: "og:title", content: "Recruiter sign in — SkillMatch AI" },
      { property: "og:description", content: "Sign in to SkillMatch AI to rank candidates against any job description." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const prepareDemo = useServerFn(ensureDemoAccount);

  const startDemo = async () => {
    setDemoLoading(true);
    try {
      // Fast path: the demo account already exists, so sign straight in.
      // Works on any host (Vercel included) with only the publishable key.
      const { error } = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });

      if (error) {
        // Fallback: provision/repair the demo account server-side, then retry.
        const creds = await prepareDemo();
        const retry = await supabase.auth.signInWithPassword({
          email: creds.email,
          password: creds.password,
        });
        if (retry.error) throw retry.error;
      }

      toast.success("Signed in to the demo workspace");
      navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the demo");
    } finally {
      setDemoLoading(false);
    }
  };


  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        toast.success("Account created — you're signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) navigate({ to: "/dashboard" });
      else toast.info("Check your inbox to confirm your email, then sign in.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute -top-32 left-1/2 size-[34rem] -translate-x-1/2 rounded-full bg-gradient-brand opacity-15 blur-3xl" />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="card-surface relative w-full max-w-sm p-7"
      >
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">SkillMatch AI</h1>
            <p className="text-xs text-muted-foreground">Recruiter workspace</p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="recruiter@company.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button type="button" variant="secondary" className="w-full" onClick={startDemo} disabled={demoLoading}>
          {demoLoading ? <Loader2 className="size-4 animate-spin" /> : <PlayCircle className="size-4" />}
          Explore the demo workspace
        </Button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          One click — no signup. Loads sample job descriptions and ranked candidates.
        </p>


        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-5 w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {mode === "signin" ? "No account yet? Create the recruiter account" : "Already have an account? Sign in"}
        </button>
      </motion.div>
    </div>
  );
}
