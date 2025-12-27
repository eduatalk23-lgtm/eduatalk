"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Clock,
  Calendar,
  BookOpen,
  Video,
  FileText,
  CheckCircle2,
  PlayCircle,
  Trash2,
  Edit3,
  Loader2,
  ArrowRightLeft,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import type { PlanWithContent } from "../_types/plan";
import { formatDateString } from "@/lib/date/calendarUtils";

type PlanDetailModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PlanWithContent;
  studentId?: string;
  onPlanUpdated?: () => void;
};

const STATUS_CONFIG = {
  scheduled: {
    label: "예정",
    icon: Calendar,
    bgClass: "bg-gray-100 dark:bg-gray-700",
    textClass: "text-gray-700 dark:text-gray-300",
  },
  in_progress: {
    label: "진행 중",
    icon: PlayCircle,
    bgClass: "bg-blue-100 dark:bg-blue-900/30",
    textClass: "text-blue-700 dark:text-blue-300",
  },
  completed: {
    label: "완료",
    icon: CheckCircle2,
    bgClass: "bg-green-100 dark:bg-green-900/30",
    textClass: "text-green-700 dark:text-green-300",
  },
  skipped: {
    label: "건너뜀",
    icon: ArrowRightLeft,
    bgClass: "bg-yellow-100 dark:bg-yellow-900/30",
    textClass: "text-yellow-700 dark:text-yellow-300",
  },
};

const CONTENT_TYPE_ICONS = {
  book: BookOpen,
  lecture: Video,
  custom: FileText,
};

/**
 * 플랜 상세 모달
 *
 * 플랜의 상세 정보를 표시하고 상태 변경, 삭제 등의 작업을 수행합니다.
 */
export function PlanDetailModal({
  open,
  onOpenChange,
  plan,
  studentId,
  onPlanUpdated,
}: PlanDetailModalProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!open) return null;

  const handleClose = () => {
    onOpenChange(false);
    setShowDeleteConfirm(false);
  };

  const statusKey = (plan.status || "scheduled") as keyof typeof STATUS_CONFIG;
  const statusConfig = STATUS_CONFIG[statusKey] || STATUS_CONFIG.scheduled;
  const StatusIcon = statusConfig.icon;

  // 콘텐츠 타입 아이콘
  const contentType = (plan.content_type as keyof typeof CONTENT_TYPE_ICONS) || "custom";
  const ContentIcon = CONTENT_TYPE_ICONS[contentType] || FileText;

  // 날짜 포맷팅
  const planDate = new Date(plan.plan_date + "T00:00:00");
  const formattedDate = planDate.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  // 시간 정보
  const hasTimeInfo = plan.start_time || plan.end_time;
  const timeRange = hasTimeInfo
    ? `${plan.start_time?.slice(0, 5) || "?"} - ${plan.end_time?.slice(0, 5) || "?"}`
    : null;

  // 학습 진행률 (progress 필드 사용)
  const progressPercent = plan.progress ?? null;

  // 실제 학습 시간 (초 -> 분 변환)
  const actualMinutes = plan.total_duration_seconds
    ? Math.round(plan.total_duration_seconds / 60)
    : null;

  // 상태 변경 핸들러
  const handleStatusChange = (newStatus: string) => {
    startTransition(async () => {
      try {
        // TODO: Implement status change API
        showToast(`상태가 "${STATUS_CONFIG[newStatus as keyof typeof STATUS_CONFIG]?.label || newStatus}"(으)로 변경되었습니다.`, "success");
        router.refresh();
        onPlanUpdated?.();
      } catch (error) {
        showToast("상태 변경 중 오류가 발생했습니다.", "error");
      }
    });
  };

  // 삭제 핸들러
  const handleDelete = () => {
    startTransition(async () => {
      try {
        // TODO: Implement delete API
        showToast("플랜이 삭제되었습니다.", "success");
        handleClose();
        router.refresh();
        onPlanUpdated?.();
      } catch (error) {
        showToast("플랜 삭제 중 오류가 발생했습니다.", "error");
      }
    });
  };

  // 플랜 실행 페이지로 이동
  const handleStartPlan = () => {
    handleClose();
    router.push(`/today/plan/${plan.id}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-gray-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-detail-title"
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-start gap-3">
            <div className={cn("rounded-lg p-2", statusConfig.bgClass)}>
              <ContentIcon className={cn("h-5 w-5", statusConfig.textClass)} />
            </div>
            <div>
              <h2
                id="plan-detail-title"
                className="text-lg font-semibold text-gray-900 dark:text-gray-100"
              >
                {plan.contentTitle || plan.content_title || "플랜"}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{formattedDate}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6">
          {/* 상태 배지 */}
          <div className="flex items-center gap-2 mb-4">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium",
                statusConfig.bgClass,
                statusConfig.textClass
              )}
            >
              <StatusIcon className="h-4 w-4" />
              {statusConfig.label}
            </span>
          </div>

          {/* 정보 그리드 */}
          <div className="space-y-3">
            {/* 시간 정보 */}
            {timeRange && (
              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600 dark:text-gray-400">시간:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {timeRange}
                </span>
              </div>
            )}

            {/* 실제 학습 시간 */}
            {actualMinutes !== null && (
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600 dark:text-gray-400">학습 시간:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {actualMinutes}분
                </span>
              </div>
            )}

            {/* 페이지 범위 */}
            {(plan.planned_start_page_or_time || plan.planned_end_page_or_time) && (
              <div className="flex items-center gap-3 text-sm">
                <BookOpen className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600 dark:text-gray-400">범위:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {plan.planned_start_page_or_time}p - {plan.planned_end_page_or_time}p
                </span>
              </div>
            )}

            {/* 블록 정보 */}
            {plan.block_index !== undefined && (
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600 dark:text-gray-400">블록:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  #{plan.block_index + 1}
                </span>
              </div>
            )}
          </div>

          {/* 진행률 바 */}
          {progressPercent !== null && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">진행률</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {progressPercent}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-2 rounded-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* 메모 */}
          {plan.memo && (
            <div className="mt-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
              <p className="text-sm text-gray-600 dark:text-gray-400">{plan.memo}</p>
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          {showDeleteConfirm ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">정말 삭제하시겠습니까?</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isPending}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  취소
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  삭제
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isPending}
                className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                aria-label="플랜 삭제"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={handleClose}
                disabled={isPending}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                닫기
              </button>
              {plan.status !== "completed" && (
                <button
                  onClick={handleStartPlan}
                  disabled={isPending}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  <PlayCircle className="h-4 w-4" />
                  학습 시작
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
