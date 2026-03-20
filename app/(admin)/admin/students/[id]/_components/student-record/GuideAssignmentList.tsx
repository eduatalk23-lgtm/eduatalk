"use client";

import { useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import {
  guideAssignmentsQueryOptions,
  guideCompletionRateQueryOptions,
  explorationGuideKeys,
} from "@/lib/query-options/explorationGuide";
import {
  updateAssignmentStatusAction,
  removeAssignmentAction,
} from "@/lib/domains/guide/actions/assignment";
import { GUIDE_TYPE_LABELS, ASSIGNMENT_STATUSES } from "@/lib/domains/guide";
import type { AssignmentStatus, GuideType } from "@/lib/domains/guide";

const STATUS_LABELS: Record<AssignmentStatus, string> = {
  assigned: "배정됨",
  in_progress: "진행 중",
  submitted: "제출됨",
  completed: "완료",
  cancelled: "취소",
};

const STATUS_COLORS: Record<AssignmentStatus, string> = {
  assigned: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  submitted: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-600",
};

interface GuideAssignmentListProps {
  studentId: string;
  schoolYear?: number;
  onSelectGuide: (guideId: string) => void;
}

export function GuideAssignmentList({
  studentId,
  schoolYear,
  onSelectGuide,
}: GuideAssignmentListProps) {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const { data: assignmentsRes, isLoading } = useQuery(
    guideAssignmentsQueryOptions(studentId, schoolYear),
  );
  const { data: rateRes } = useQuery(
    guideCompletionRateQueryOptions(studentId),
  );

  const assignments = assignmentsRes?.success ? assignmentsRes.data ?? [] : [];
  const rate = rateRes?.success ? rateRes.data : null;

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: explorationGuideKeys.assignments(studentId, schoolYear),
    });
    queryClient.invalidateQueries({
      queryKey: explorationGuideKeys.completionRate(studentId),
    });
  };

  function handleStatusChange(assignmentId: string, status: AssignmentStatus) {
    startTransition(async () => {
      await updateAssignmentStatusAction(assignmentId, status);
      invalidate();
    });
  }

  function handleRemove(assignmentId: string) {
    if (!confirm("이 배정을 삭제하시겠습니까?")) return;
    startTransition(async () => {
      await removeAssignmentAction(assignmentId);
      invalidate();
    });
  }

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-gray-400">불러오는 중...</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 이행률 요약 */}
      {rate && rate.total > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
          <div className="flex-1">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-xs font-medium text-gray-600">
                이행률 (기록 연결)
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {rate.rate}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(rate.rate, 100)}%` }}
              />
            </div>
          </div>
          <span className="text-xs text-gray-500">
            {rate.linked}/{rate.total}건
          </span>
        </div>
      )}

      {/* 배정 목록 */}
      {assignments.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">
          배정된 가이드가 없습니다.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {assignments.map((a) => {
            const guide = a.exploration_guides;
            return (
              <div
                key={a.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3",
                  isPending && "opacity-60",
                )}
              >
                <div
                  className="min-w-0 flex-1 cursor-pointer"
                  onClick={() => onSelectGuide(a.guide_id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-gray-900">
                      {guide?.title ?? "—"}
                    </span>
                    {guide?.guide_type && (
                      <span className="shrink-0 text-xs text-gray-400">
                        {GUIDE_TYPE_LABELS[guide.guide_type as GuideType]}
                      </span>
                    )}
                  </div>
                  {a.notes && (
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {a.notes}
                    </p>
                  )}
                </div>

                {/* 상태 변경 */}
                <select
                  value={a.status}
                  onChange={(e) =>
                    handleStatusChange(a.id, e.target.value as AssignmentStatus)
                  }
                  disabled={isPending}
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    STATUS_COLORS[a.status],
                  )}
                >
                  {ASSIGNMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>

                {/* 삭제 */}
                {a.status === "assigned" && (
                  <button
                    type="button"
                    onClick={() => handleRemove(a.id)}
                    disabled={isPending}
                    className="shrink-0 text-xs text-red-500 hover:text-red-700"
                  >
                    삭제
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
