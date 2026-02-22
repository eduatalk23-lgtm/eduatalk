"use client";

import { cn } from "@/lib/utils";

type GlassCardProps = {
  children: React.ReactNode;
  className?: string;
};

export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/20 bg-white/60 p-8 shadow-xl backdrop-blur-xl animate-fade-in-up",
        "supports-[backdrop-filter]:bg-white/60",
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-50" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
