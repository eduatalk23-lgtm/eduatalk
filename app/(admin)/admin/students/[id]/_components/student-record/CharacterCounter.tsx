"use client";

import { cn } from "@/lib/cn";
import { countNeisBytes, detectNeisInvalidChars } from "@/lib/domains/student-record";

type CharacterCounterProps = {
  content: string;
  charLimit: number;
  className?: string;
};

export function CharacterCounter({ content, charLimit, className }: CharacterCounterProps) {
  const charCount = content.length;
  const byteCount = countNeisBytes(content);
  const byteLimit = charLimit * 3;
  const invalidChars = detectNeisInvalidChars(content);
  const ratio = charCount / charLimit;

  return (
    <div className={cn("flex flex-col items-end gap-0.5", className)}>
      <span
        className={cn(
          "text-xs tabular-nums",
          ratio < 0.8 && "text-emerald-600 dark:text-emerald-400",
          ratio >= 0.8 && ratio < 1 && "text-amber-600 dark:text-amber-400",
          ratio >= 1 && "text-red-600 dark:text-red-400 font-medium",
        )}
      >
        {charCount}/{charLimit}자
        {byteCount > byteLimit && (
          <span className="ml-1">({byteCount}/{byteLimit}B 초과)</span>
        )}
      </span>
      {invalidChars.length > 0 && (
        <span className="text-xs text-red-600 dark:text-red-400">
          입력 불가 문자 포함 ({invalidChars.length}개)
        </span>
      )}
    </div>
  );
}
