import { useEffect, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";

import { cn } from "@/lib/utils";

export type ScoreTone = "high" | "medium" | "low";

export function scoreTone(score: number): ScoreTone {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

export const toneStroke: Record<ScoreTone, string> = {
  high: "var(--success)",
  medium: "var(--warning)",
  low: "var(--danger)",
};

export const toneText: Record<ScoreTone, string> = {
  high: "text-success",
  medium: "text-warning",
  low: "text-danger",
};

export const toneChip: Record<ScoreTone, string> = {
  high: "bg-success-soft text-success",
  medium: "bg-warning-soft text-warning-foreground",
  low: "bg-danger-soft text-danger",
};

interface ScoreRingProps {
  /** null renders an empty "not scored yet" ring. */
  score: number | null;
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
}

export function ScoreRing({ score, size = 84, strokeWidth = 8, label, className }: ScoreRingProps) {
  const value = score ?? 0;
  const tone = scoreTone(value);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useMotionValue(0);
  const dashOffset = useTransform(progress, (value) => circumference * (1 - value / 100));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(progress, value, { duration: 0.9, ease: "easeOut" });
    const unsubscribe = progress.on("change", (v) => setDisplay(Math.round(v)));
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [value, progress]);

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          stroke="var(--muted)"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          stroke={toneStroke[tone]}
          strokeDasharray={circumference}
          style={{ strokeDashoffset: dashOffset }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-semibold tabular-nums", toneText[tone])} style={{ fontSize: size / 3.6 }}>
          {score === null ? "–" : display}
        </span>
        {label ? <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span> : null}
      </div>
    </div>
  );
}
