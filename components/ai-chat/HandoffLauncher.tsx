"use client";

import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Phase T-1 공용 핸드오프 런처
 *
 * 기존 GUI 페이지에서 /ai-chat 으로 진입할 때 일관된 버튼.
 * from / studentId / grade / semester / subject 필터를 URL 쿼리로
 * 전달하면 서버의 validateAndResolveHandoff 가 검증·리졸브.
 *
 * 서버 컴포넌트에서도 사용 가능(Link만 사용하므로).
 */

export type HandoffLauncherProps = {
  /** HANDOFF_SOURCES 키 (예: "scores", "admin-scores") */
  from: string;
  /** 관리자/컨설턴트 경로에서 대상 학생 ID */
  studentId?: string;
  grade?: number;
  semester?: number;
  subject?: string;
  /** 버튼 문구. 기본: "AI와 대화" */
  label?: string;
  /** 버튼 크기 variant */
  size?: "sm" | "md";
  /** 외부 classname 추가 (배치 정렬용) */
  className?: string;
};

const SIZE_CLASS: Record<NonNullable<HandoffLauncherProps["size"]>, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
};

export function HandoffLauncher({
  from,
  studentId,
  grade,
  semester,
  subject,
  label = "AI와 대화",
  size = "md",
  className,
}: HandoffLauncherProps) {
  const params = new URLSearchParams();
  params.set("from", from);
  if (studentId) params.set("studentId", studentId);
  if (grade != null) params.set("grade", String(grade));
  if (semester != null) params.set("semester", String(semester));
  if (subject) params.set("subject", subject);

  return (
    <Link
      href={`/ai-chat?${params.toString()}`}
      className={cn(
        "inline-flex items-center rounded-lg border border-zinc-200 bg-white font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800",
        SIZE_CLASS[size],
        className,
      )}
      aria-label={label}
    >
      <MessageSquareText size={size === "sm" ? 13 : 15} />
      <span>{label}</span>
    </Link>
  );
}
