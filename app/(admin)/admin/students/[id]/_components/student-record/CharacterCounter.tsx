"use client";

import { cn } from "@/lib/cn";
import { countNeisBytes, detectNeisInvalidChars } from "@/lib/domains/student-record";
import type { ForbiddenExpressionResult } from "@/lib/domains/student-record";

type CharacterCounterProps = {
  content: string;
  charLimit: number;
  className?: string;
  forbiddenResult?: ForbiddenExpressionResult | null;
};

/**
 * NEIS 바이트 기준 글자수 카운터
 *
 * NEIS "500자" = 1,500B 제한. 한글 3B, 영문/공백 1B, 줄바꿈 2B.
 * 영문/공백이 많으면 500자 넘어도 제한 이내일 수 있다.
 */
export function CharacterCounter({ content, charLimit, className, forbiddenResult }: CharacterCounterProps) {
  const charCount = content.length;
  const byteCount = countNeisBytes(content);
  const byteLimit = charLimit * 3;
  const invalidChars = detectNeisInvalidChars(content);
  const ratio = byteCount / byteLimit;

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
        {byteCount.toLocaleString()}/{byteLimit.toLocaleString()}B
        <span className="ml-1 opacity-70">({charCount}자)</span>
        {ratio >= 1 && <span className="ml-1">초과</span>}
      </span>
      {invalidChars.length > 0 && (
        <span className="text-xs text-red-600 dark:text-red-400">
          입력 불가 문자 포함 ({invalidChars.length}개)
        </span>
      )}
      {forbiddenResult?.errorCount ? (
        <span className="text-xs font-medium text-red-600 dark:text-red-400">
          금지 표현 {forbiddenResult.errorCount}건
        </span>
      ) : null}
      {forbiddenResult?.warningCount ? (
        <span className="text-xs text-amber-600 dark:text-amber-400">
          주의 표현 {forbiddenResult.warningCount}건
        </span>
      ) : null}
    </div>
  );
}
