"use client";

import { cn } from "@/lib/cn";
import { CheckCircle, Circle, Trash2, StickyNote, AlertTriangle, ChevronUp, ChevronDown } from "lucide-react";
import type { CoursePlanStatus } from "@/lib/domains/student-record/course-plan/types";

interface CoursePlanCardProps {
  id: string;
  subjectName: string;
  subjectType: string | null;
  status: CoursePlanStatus;
  reason: string | null;
  isSchoolOffered: boolean | null;
  notes: string | null;
  onConfirm?: () => void;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  disabled?: boolean;
}

const STATUS_STYLES: Record<CoursePlanStatus, { bg: string; border: string; label: string }> = {
  recommended: { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800", label: "추천" },
  confirmed: { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800", label: "확정" },
  completed: { bg: "bg-gray-100 dark:bg-gray-800/30", border: "border-gray-200 dark:border-gray-700", label: "이수" },
};

const STATUS_BADGE_COLORS: Record<CoursePlanStatus, string> = {
  recommended: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  completed: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

const TYPE_BADGE_COLORS: Record<string, string> = {
  "공통": "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  "일반선택": "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
  "진로선택": "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  "융합선택": "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
};

export function CoursePlanCard({
  subjectName, subjectType, status, reason,
  isSchoolOffered, notes, onConfirm, onRemove, onMoveUp, onMoveDown, disabled,
}: CoursePlanCardProps) {
  const style = STATUS_STYLES[status];
  const isReadOnly = status === "completed" || disabled;

  return (
    <div className={cn(
      "flex items-center justify-between rounded-lg border px-3 py-2 transition-colors",
      style.bg, style.border,
      isReadOnly && "opacity-70",
    )}>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {/* 과목명 */}
        <span className="truncate text-sm font-medium text-[var(--text-primary)]">
          {subjectName}
        </span>

        {/* 과목 유형 뱃지 */}
        {subjectType && (
          <span className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
            TYPE_BADGE_COLORS[subjectType] ?? "bg-gray-100 text-gray-600",
          )}>
            {subjectType}
          </span>
        )}

        {/* 상태 뱃지 */}
        <span className={cn(
          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
          STATUS_BADGE_COLORS[status],
        )}>
          {style.label}
        </span>

        {/* 학교 개설 여부 */}
        {isSchoolOffered === true && (
          <span title="학교 개설 과목" className="text-emerald-500">
            <CheckCircle className="h-3.5 w-3.5" />
          </span>
        )}
        {isSchoolOffered === false && (
          <span title="학교 미개설" className="text-amber-500">
            <AlertTriangle className="h-3.5 w-3.5" />
          </span>
        )}

        {/* 메모 아이콘 */}
        {notes && (
          <span title={notes} className="text-[var(--text-tertiary)]">
            <StickyNote className="h-3.5 w-3.5" />
          </span>
        )}

        {/* 추천 근거 */}
        {reason && (
          <span className="hidden truncate text-xs text-[var(--text-tertiary)] sm:inline" title={reason}>
            {reason}
          </span>
        )}
      </div>

      {/* 액션 버튼 */}
      {!isReadOnly && (
        <div className="ml-2 flex shrink-0 items-center gap-1">
          {/* P2-C: 우선순위 재배치 */}
          {(onMoveUp || onMoveDown) && (
            <div className="flex flex-col">
              <button
                onClick={onMoveUp}
                disabled={!onMoveUp}
                className="rounded p-0.5 text-[var(--text-tertiary)] hover:bg-gray-100 disabled:invisible dark:hover:bg-gray-800"
                title="위로"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                onClick={onMoveDown}
                disabled={!onMoveDown}
                className="rounded p-0.5 text-[var(--text-tertiary)] hover:bg-gray-100 disabled:invisible dark:hover:bg-gray-800"
                title="아래로"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          )}
          {status === "recommended" && onConfirm && (
            <button
              onClick={onConfirm}
              className="rounded p-1 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
              title="확정"
            >
              <Circle className="h-3.5 w-3.5" />
            </button>
          )}
          {onRemove && (
            <button
              onClick={onRemove}
              className="rounded p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50"
              title="제거"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
