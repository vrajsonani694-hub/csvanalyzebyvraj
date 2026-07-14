import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent?: "primary" | "accent" | "success" | "warning" | "destructive";
  delay?: number;
}

const accentMap = {
  primary: "from-primary/25 to-primary/5 text-primary",
  accent: "from-accent/25 to-accent/5 text-accent",
  success: "from-success/25 to-success/5 text-success",
  warning: "from-warning/25 to-warning/5 text-warning",
  destructive: "from-destructive/25 to-destructive/5 text-destructive",
};

export function StatCard({ label, value, hint, icon: Icon, accent = "primary", delay = 0 }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: "easeOut" }}
      className="relative overflow-hidden rounded-xl border bg-card p-5 shadow-soft"
    >
      <div className={cn("absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br blur-2xl", accentMap[accent])} />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br", accentMap[accent])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}
