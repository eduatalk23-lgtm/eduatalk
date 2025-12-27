"use client";

import { useEffect, useState } from "react";
import { X, ArrowUp } from "lucide-react";
import { cn } from "@/lib/cn";
import { LevelBadge } from "./LevelBadge";

interface LevelUpAnimationProps {
  oldLevel: number;
  newLevel: number;
  onClose: () => void;
}

export function LevelUpAnimation({
  oldLevel,
  newLevel,
  onClose,
}: LevelUpAnimationProps) {
  const [phase, setPhase] = useState<"enter" | "show" | "exit">("enter");
  const [showNewLevel, setShowNewLevel] = useState(false);

  useEffect(() => {
    // Animation sequence
    const enterTimer = setTimeout(() => setPhase("show"), 100);
    const levelTimer = setTimeout(() => setShowNewLevel(true), 800);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(levelTimer);
    };
  }, []);

  const handleClose = () => {
    setPhase("exit");
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center transition-all duration-300",
        phase !== "exit" ? "bg-black/70 backdrop-blur-sm" : "bg-transparent opacity-0"
      )}
      onClick={handleClose}
    >
      <div
        className={cn(
          "relative bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 rounded-3xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden transition-all duration-500",
          phase === "show"
            ? "opacity-100 scale-100"
            : "opacity-0 scale-90"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/20 transition-colors z-10"
        >
          <X className="w-5 h-5 text-white/70" />
        </button>

        {/* Animated background particles */}
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-white/20 rounded-full animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${3 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="relative px-8 py-12 flex flex-col items-center text-center">
          {/* Header */}
          <div className="flex items-center gap-2 text-yellow-300 mb-6 animate-pulse">
            <ArrowUp className="w-6 h-6" />
            <span className="text-xl font-bold">LEVEL UP!</span>
            <ArrowUp className="w-6 h-6" />
          </div>

          {/* Level transition */}
          <div className="flex items-center gap-4 mb-6">
            <div
              className={cn(
                "transition-all duration-500",
                showNewLevel ? "opacity-30 scale-75" : "opacity-100 scale-100"
              )}
            >
              <LevelBadge level={oldLevel} size="lg" showLabel={false} />
            </div>

            <div
              className={cn(
                "text-4xl font-bold text-white transition-all duration-500",
                showNewLevel ? "opacity-100" : "opacity-0"
              )}
            >
              →
            </div>

            <div
              className={cn(
                "transition-all duration-700",
                showNewLevel
                  ? "opacity-100 scale-100 animate-bounce-in"
                  : "opacity-0 scale-50"
              )}
            >
              <div className="relative">
                <LevelBadge level={newLevel} size="lg" showLabel={false} />
                {/* Glow effect */}
                <div className="absolute inset-0 bg-yellow-400/50 rounded-full blur-xl animate-pulse" />
              </div>
            </div>
          </div>

          {/* Message */}
          <p className="text-white/90 text-lg mb-2">
            축하합니다!
          </p>
          <p className="text-white/70">
            레벨 {newLevel}에 도달했습니다
          </p>

          {/* Dismiss button */}
          <button
            onClick={handleClose}
            className="mt-8 px-8 py-3 bg-white/20 hover:bg-white/30 text-white font-medium rounded-full backdrop-blur-sm transition-all"
          >
            계속하기
          </button>
        </div>
      </div>
    </div>
  );
}
