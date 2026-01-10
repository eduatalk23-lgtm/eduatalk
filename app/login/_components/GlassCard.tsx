"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type GlassCardProps = {
  children: React.ReactNode;
  className?: string;
};

export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/20 bg-white/60 p-8 shadow-xl backdrop-blur-xl",
        "supports-[backdrop-filter]:bg-white/60",
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-50" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
