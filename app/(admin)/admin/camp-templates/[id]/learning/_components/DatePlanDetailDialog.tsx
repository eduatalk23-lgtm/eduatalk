"use client";

import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { useCampDatePlans } from "@/lib/hooks/useCampLearning";
import { SuspenseFallback } from "@/components/ui/LoadingSkeleton";
import { Badge } from "@/components/atoms/Badge";
import { cn } from "@/lib/cn";

type DatePlanDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  date: string | null; // YYYY-MM-DD
  studentIds?: string[];
};

/**
 * 플랜 상태별 배지 색상
 */
function getStatusBadgeVariant(
  status: "completed" | "in_progress" | "not_started"
): "success" | "warning" | "error" | "info" {
  switch (status) {
    case "completed":
      return "success";
    case "in_progress":
      return "warning";
    case "not_started":
      return "error";
    default:
      return "info";
  }
}

/**
 * 학습 시간 포맷팅 (분 → 시간:분)
 */
function formatStudyTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}시간 ${mins}분`;
  }
  return `${mins}분`;
}

/**
 * 상태 라벨
 */
const STATUS_LABELS: Record<"completed" | "in_progress" | "not_started", string> = {
  completed: "완료",
  in_progress: "진행중",
  not_started: "미시작",
};

export function DatePlanDetailDialog({
  open,
  onOpenChange,
  templateId,
  date,
  studentIds,
}: DatePlanDetailDialogProps) {
  const { data: planDetail, isLoading } = useCampDatePlans(
    templateId,
    date || "",
    studentIds,
    { enabled: open && !!date }
  );

  const formattedDate = date
    ? format(new Date(date), "yyyy년 M월 d일 (E)", { locale: ko })
    : "";

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${formattedDate} 학습 상세`}
      description={`해당 날짜의 모든 참여자 학습 플랜 정보를 확인할 수 있습니다.`}
      size="3xl"
      showCloseButton={true}
    >
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        {isLoading ? (
          <SuspenseFallback />
        ) : !planDetail || planDetail.plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              해당 날짜에 학습 플랜이 없습니다.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* 플랜 목록 */}
            <div className="flex flex-col gap-3">
              {planDetail.plans.map((plan) => (
                <div
                  key={plan.plan_id}
                  className="flex flex-col gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
                >
                  {/* 학생 이름 및 상태 */}
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      {plan.student_name}
                    </h4>
                    <Badge variant={getStatusBadgeVariant(plan.status)}>
                      {STATUS_LABELS[plan.status]}
                    </Badge>
                  </div>

                  {/* 플랜 정보 */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        콘텐츠명
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {plan.content_title || "-"}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        과목
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {plan.content_subject || "-"}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        계획 범위
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {plan.planned_range}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        완료 범위
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {plan.completed_amount !== null
                          ? `${plan.completed_amount}`
                          : "-"}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        진행률
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {plan.progress}%
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        학습 시간
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {formatStudyTime(plan.study_minutes)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 통계 요약 */}
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                총 {planDetail.plans.length}개의 학습 플랜
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

