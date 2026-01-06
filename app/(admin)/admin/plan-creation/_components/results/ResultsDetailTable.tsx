"use client";

/**
 * 결과 상세 테이블 컴포넌트
 * 학생별 생성 결과를 테이블 형태로 표시
 * 부분 실패 시 개별 재시도 기능 지원
 */

import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, borderInput } from "@/lib/utils/darkMode";
import { CheckCircle2, XCircle, SkipForward, ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import type { CreationResult } from "../../_context/types";

interface ResultsDetailTableProps {
  results: CreationResult[];
  onRetry?: (studentId: string) => void;
}

const statusConfig = {
  success: {
    icon: CheckCircle2,
    label: "성공",
    className: "text-emerald-600 dark:text-emerald-400",
    bgClassName: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  error: {
    icon: XCircle,
    label: "실패",
    className: "text-red-600 dark:text-red-400",
    bgClassName: "bg-red-50 dark:bg-red-900/20",
  },
  skipped: {
    icon: SkipForward,
    label: "스킵",
    className: "text-amber-600 dark:text-amber-400",
    bgClassName: "bg-amber-50 dark:bg-amber-900/20",
  },
};

export function ResultsDetailTable({ results, onRetry }: ResultsDetailTableProps) {
  return (
    <div className={cn("overflow-hidden rounded-lg border", borderInput)}>
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800/50">
            <th
              className={cn(
                "px-4 py-3 text-left text-sm font-medium",
                textSecondary
              )}
            >
              학생명
            </th>
            <th
              className={cn(
                "px-4 py-3 text-left text-sm font-medium",
                textSecondary
              )}
            >
              상태
            </th>
            <th
              className={cn(
                "px-4 py-3 text-left text-sm font-medium",
                textSecondary
              )}
            >
              메시지
            </th>
            <th
              className={cn(
                "px-4 py-3 text-right text-sm font-medium",
                textSecondary
              )}
            >
              액션
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {results.map((result) => {
            const config = statusConfig[result.status];
            const Icon = config.icon;

            return (
              <tr
                key={result.studentId}
                className={cn(
                  "transition-colors",
                  config.bgClassName,
                  "hover:bg-opacity-70"
                )}
              >
                <td className={cn("px-4 py-3 font-medium", textPrimary)}>
                  {result.studentName}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", config.className)} />
                    <span className={cn("text-sm font-medium", config.className)}>
                      {config.label}
                    </span>
                  </div>
                </td>
                <td className={cn("px-4 py-3 text-sm", textSecondary)}>
                  {result.message || "-"}
                </td>
                <td className="px-4 py-3 text-right">
                  {result.status === "success" && result.planGroupId && (
                    <Link
                      href={`/admin/students/${result.studentId}/plans`}
                      className={cn(
                        "inline-flex items-center gap-1 text-sm font-medium",
                        "text-purple-600 hover:text-purple-700",
                        "dark:text-purple-400 dark:hover:text-purple-300"
                      )}
                    >
                      플랜 보기
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                  {result.status === "error" && onRetry && (
                    <button
                      className={cn(
                        "inline-flex items-center gap-1 text-sm font-medium transition",
                        "text-red-600 hover:text-red-700",
                        "dark:text-red-400 dark:hover:text-red-300",
                        "hover:bg-red-50 dark:hover:bg-red-900/20 rounded px-2 py-1"
                      )}
                      onClick={() => onRetry(result.studentId)}
                    >
                      <RefreshCw className="h-3 w-3" />
                      재시도
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {results.length === 0 && (
        <div className={cn("py-12 text-center", textSecondary)}>
          결과가 없습니다
        </div>
      )}
    </div>
  );
}
