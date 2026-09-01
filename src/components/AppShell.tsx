import { Link, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { BriefcaseBusiness, LayoutDashboard, LogOut, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/jobs", label: "Job descriptions", icon: BriefcaseBusiness },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground">
              <Sparkles className="size-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">SkillMatch AI</span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 sm:flex">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                activeProps={{ className: "bg-accent text-accent-foreground font-medium" }}
              >
                <span className="flex items-center gap-2">
                  <item.icon className="size-4" />
                  {item.label}
                </span>
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
        <nav className="flex gap-1 border-t border-border/70 px-4 py-2 sm:hidden">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex-1 rounded-lg px-3 py-2 text-center text-sm text-muted-foreground"
              activeProps={{ className: "bg-accent text-accent-foreground font-medium" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="mx-auto max-w-7xl px-4 py-8 sm:px-6"
      >
        {children}
      </motion.main>
    </div>
  );
}
