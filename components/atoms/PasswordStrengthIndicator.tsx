"use client";

import { memo, useMemo } from "react";
import { cn } from "@/lib/cn";
import { Check, X } from "lucide-react";

export type PasswordStrength = "empty" | "weak" | "fair" | "good" | "strong";

export interface PasswordStrengthResult {
  strength: PasswordStrength;
  score: number; // 0-4
  label: string;
  checks: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
  };
}

export function calculatePasswordStrength(password: string): PasswordStrengthResult {
  const checks = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  };

  if (password.length === 0) {
    return { strength: "empty", score: 0, label: "", checks };
  }

  const passedChecks = Object.values(checks).filter(Boolean).length;

  if (passedChecks <= 1) {
    return { strength: "weak", score: 1, label: "취약", checks };
  }
  if (passedChecks === 2) {
    return { strength: "fair", score: 2, label: "보통", checks };
  }
  if (passedChecks === 3 || passedChecks === 4) {
    return { strength: "good", score: 3, label: "양호", checks };
  }
  return { strength: "strong", score: 4, label: "강력", checks };
}

const strengthColors: Record<PasswordStrength, string> = {
  empty: "bg-neutral-200 dark:bg-neutral-700",
  weak: "bg-red-500",
  fair: "bg-orange-500",
  good: "bg-yellow-500",
  strong: "bg-green-500",
};

const strengthTextColors: Record<PasswordStrength, string> = {
  empty: "text-neutral-400",
  weak: "text-red-600 dark:text-red-400",
  fair: "text-orange-600 dark:text-orange-400",
  good: "text-yellow-600 dark:text-yellow-400",
  strong: "text-green-600 dark:text-green-400",
};

export interface PasswordStrengthIndicatorProps {
  password: string;
  showChecklist?: boolean;
  className?: string;
}

const PasswordStrengthIndicator = memo(function PasswordStrengthIndicator({
  password,
  showChecklist = false,
  className,
}: PasswordStrengthIndicatorProps) {
  const result = useMemo(() => calculatePasswordStrength(password), [password]);

  if (result.strength === "empty") {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* 강도 바 */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {[1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors duration-200",
                level <= result.score
                  ? strengthColors[result.strength]
                  : "bg-neutral-200 dark:bg-neutral-700"
              )}
            />
          ))}
        </div>
        <span
          className={cn(
            "text-xs font-medium",
            strengthTextColors[result.strength]
          )}
        >
          {result.label}
        </span>
      </div>

      {/* 체크리스트 */}
      {showChecklist && (
        <ul className="space-y-1 text-xs">
          <CheckItem passed={result.checks.minLength}>
            8자 이상
          </CheckItem>
          <CheckItem passed={result.checks.hasUppercase}>
            영문 대문자 포함
          </CheckItem>
          <CheckItem passed={result.checks.hasLowercase}>
            영문 소문자 포함
          </CheckItem>
          <CheckItem passed={result.checks.hasNumber}>
            숫자 포함
          </CheckItem>
          <CheckItem passed={result.checks.hasSpecial}>
            특수문자 포함
          </CheckItem>
        </ul>
      )}
    </div>
  );
});

function CheckItem({
  passed,
  children,
}: {
  passed: boolean;
  children: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-1.5 transition-colors",
        passed
          ? "text-green-600 dark:text-green-400"
          : "text-neutral-400 dark:text-neutral-500"
      )}
    >
      {passed ? (
        <Check className="h-3 w-3" />
      ) : (
        <X className="h-3 w-3" />
      )}
      {children}
    </li>
  );
}

export default PasswordStrengthIndicator;
