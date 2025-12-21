"use client";

import { useTransition } from "react";
import { signOut } from "@/app/actions/auth";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/cn";
import { layoutStyles } from "@/components/navigation/global/navStyles";

type SignOutButtonProps = {
  variant?: "default" | "icon" | "compact";
  className?: string;
};

export function SignOutButton({ 
  variant = "default",
  className 
}: SignOutButtonProps = {}) {
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      await signOut();
    });
  };

  if (variant === "icon") {
    return (
      <button
        onClick={handleSignOut}
        disabled={isPending}
        className={cn(
          "p-2 rounded-lg transition-all",
          layoutStyles.hoverBg,
          layoutStyles.textSecondary,
          layoutStyles.hoverText,
          layoutStyles.focusRing,
          "disabled:opacity-50",
          className
        )}
        aria-label="로그아웃"
      >
        <LogOut className="w-4 h-4" />
      </button>
    );
  }

  if (variant === "compact") {
    return (
      <button
        onClick={handleSignOut}
        disabled={isPending}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-body-2 transition-all",
          layoutStyles.hoverBg,
          layoutStyles.textSecondary,
          layoutStyles.hoverText,
          layoutStyles.focusRing,
          "disabled:opacity-50",
          className
        )}
        aria-label="로그아웃"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>{isPending ? "로그아웃 중..." : "로그아웃"}</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={isPending}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-body-2 font-medium transition-all",
        "border border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))]",
        layoutStyles.hoverBg,
        layoutStyles.textSecondary,
        layoutStyles.hoverText,
        layoutStyles.focusRing,
        "disabled:opacity-50",
        className
      )}
    >
      <LogOut className="w-4 h-4" />
      <span>{isPending ? "로그아웃 중..." : "로그아웃"}</span>
    </button>
  );
}

