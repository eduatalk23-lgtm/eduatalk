"use client";

/**
 * 배치 액션 툴바
 *
 * 선택된 플랜에 대한 일괄 작업 버튼 제공
 * - 일괄 날짜 이동
 * - 일괄 상태 변경
 * - 일괄 삭제
 */

import { useState, useTransition, useCallback } from "react";
import {
  X,
  CheckSquare,
  Calendar,
  CheckCircle2,
  Clock,
  Trash2,
  ChevronDown,
  ArrowRight,
  Loader2,
  SkipForward,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmDialog } from "@/components/ui/Dialog";
import type { CalendarPlan } from "./_types/adminCalendar";
import type { PlanStatus } from "@/lib/domains/admin-plan/types";

interface BatchActionsToolbarProps {
  /** 선택된 플랜 목록 */
  selectedPlans: CalendarPlan[];
  /** 선택 개수 */
  selectedCount: number;
  /** 선택 해제 */
  onClearSelection: () => void;
  /** 전체 선택 */
  onSelectAll: () => void;
  /** 선택 모드 종료 */
  onExitSelectionMode: () => void;
  /** 배치 작업 완료 후 새로고침 */
  onRefresh: () => void;
  /** 학생 ID */
  studentId: string;
  /** 테넌트 ID */
  tenantId: string;
  /** 전체 플랜 개수 */
  totalPlans: number;
}

const STATUS_OPTIONS: { value: PlanStatus; label: string; icon: typeof CheckCircle2 }[] = [
  { value: "pending", label: "대기중", icon: Clock },
  { value: "in_progress", label: "진행중", icon: Clock },
  { value: "completed", label: "완료", icon: CheckCircle2 },
  { value: "skipped", label: "건너뜀", icon: SkipForward },
  { value: "cancelled", label: "취소됨", icon: XCircle },
];

export default function BatchActionsToolbar({
  selectedPlans,
  selectedCount,
  onClearSelection,
  onSelectAll,
  onExitSelectionMode,
  onRefresh,
  studentId,
  tenantId,
  totalPlans,
}: BatchActionsToolbarProps) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  // 드롭다운 상태
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  // 삭제 확인 다이얼로그
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 날짜 이동 입력값
  const [daysToShift, setDaysToShift] = useState<number>(0);

  // 일괄 날짜 이동
  const handleBatchDateShift = useCallback(
    (days: number) => {
      if (days === 0) {
        toast.showToast("이동할 일수를 입력해주세요.", "warning");
        return;
      }

      startTransition(async () => {
        try {
          const { batchUpdatePlanDates } = await import(
            "@/lib/domains/admin-plan/actions/batchOperations"
          );

          const result = await batchUpdatePlanDates({
            planIds: selectedPlans.map((p) => p.id),
            daysToShift: days,
            studentId,
            tenantId,
          });

          if (result.success) {
            toast.showToast(
              `${result.data?.updatedCount || selectedCount}개 플랜이 ${days > 0 ? days + "일 후" : Math.abs(days) + "일 전"}로 이동되었습니다.`,
              "success"
            );
            onClearSelection();
            onRefresh();
          } else {
            toast.showToast(result.error || "날짜 이동에 실패했습니다.", "error");
          }
        } catch (error) {
          console.error("배치 날짜 이동 오류:", error);
          toast.showToast("날짜 이동 중 오류가 발생했습니다.", "error");
        }
      });

      setShowDateDropdown(false);
      setDaysToShift(0);
    },
    [selectedPlans, selectedCount, studentId, tenantId, toast, onClearSelection, onRefresh]
  );

  // 일괄 상태 변경
  const handleBatchStatusChange = useCallback(
    (status: PlanStatus) => {
      startTransition(async () => {
        try {
          const { batchUpdatePlanStatus } = await import(
            "@/lib/domains/admin-plan/actions/batchOperations"
          );

          const result = await batchUpdatePlanStatus({
            planIds: selectedPlans.map((p) => p.id),
            status,
            studentId,
            tenantId,
          });

          if (result.success) {
            const statusLabel = STATUS_OPTIONS.find((s) => s.value === status)?.label || status;
            toast.showToast(
              `${result.data?.updatedCount || selectedCount}개 플랜이 "${statusLabel}"로 변경되었습니다.`,
              "success"
            );
            onClearSelection();
            onRefresh();
          } else {
            toast.showToast(result.error || "상태 변경에 실패했습니다.", "error");
          }
        } catch (error) {
          console.error("배치 상태 변경 오류:", error);
          toast.showToast("상태 변경 중 오류가 발생했습니다.", "error");
        }
      });

      setShowStatusDropdown(false);
    },
    [selectedPlans, selectedCount, studentId, tenantId, toast, onClearSelection, onRefresh]
  );

  // 일괄 삭제
  const handleBatchDelete = useCallback(() => {
    startTransition(async () => {
      try {
        const { batchDeletePlans } = await import(
          "@/lib/domains/admin-plan/actions/batchOperations"
        );

        const result = await batchDeletePlans({
          planIds: selectedPlans.map((p) => p.id),
          studentId,
          tenantId,
        });

        if (result.success) {
          toast.showToast(
            `${result.data?.deletedCount || selectedCount}개 플랜이 삭제되었습니다.`,
            "success"
          );
          onClearSelection();
          onRefresh();
        } else {
          toast.showToast(result.error || "삭제에 실패했습니다.", "error");
        }
      } catch (error) {
        console.error("배치 삭제 오류:", error);
        toast.showToast("삭제 중 오류가 발생했습니다.", "error");
      }
    });

    setShowDeleteConfirm(false);
  }, [selectedPlans, selectedCount, studentId, tenantId, toast, onClearSelection, onRefresh]);

  if (selectedCount === 0) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          "fixed bottom-4 left-1/2 -translate-x-1/2 z-50",
          "bg-white rounded-xl shadow-xl border border-gray-200",
          "flex items-center gap-2 px-4 py-3",
          "animate-in slide-in-from-bottom-4 duration-200"
        )}
      >
        {/* 선택 정보 */}
        <div className="flex items-center gap-2 pr-3 border-r border-gray-200">
          <CheckSquare className="w-5 h-5 text-blue-500" />
          <span className="text-sm font-medium">
            {selectedCount}개 선택됨
          </span>
          {selectedCount < totalPlans && (
            <button
              onClick={onSelectAll}
              className="text-xs text-blue-600 hover:underline"
            >
              전체 선택
            </button>
          )}
        </div>

        {/* 날짜 이동 */}
        <div className="relative">
          <button
            onClick={() => {
              setShowDateDropdown(!showDateDropdown);
              setShowStatusDropdown(false);
            }}
            disabled={isPending}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm",
              "bg-gray-100 hover:bg-gray-200 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <Calendar className="w-4 h-4" />
            날짜 이동
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {showDateDropdown && (
            <div className="absolute bottom-full mb-2 left-0 bg-white rounded-lg shadow-lg border p-3 min-w-[200px]">
              <div className="text-xs text-gray-500 mb-2">며칠 이동할까요?</div>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="number"
                  value={daysToShift}
                  onChange={(e) => setDaysToShift(parseInt(e.target.value) || 0)}
                  className="w-20 px-2 py-1 border rounded text-sm"
                  placeholder="일수"
                />
                <span className="text-sm text-gray-600">일</span>
              </div>
              <div className="flex gap-1 mb-2">
                {[-7, -1, 1, 7].map((days) => (
                  <button
                    key={days}
                    onClick={() => setDaysToShift(days)}
                    className={cn(
                      "px-2 py-1 text-xs rounded",
                      daysToShift === days
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 hover:bg-gray-200"
                    )}
                  >
                    {days > 0 ? `+${days}` : days}일
                  </button>
                ))}
              </div>
              <button
                onClick={() => handleBatchDateShift(daysToShift)}
                disabled={daysToShift === 0}
                className={cn(
                  "w-full flex items-center justify-center gap-1 px-3 py-1.5 rounded text-sm",
                  "bg-blue-500 text-white hover:bg-blue-600",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <ArrowRight className="w-3.5 h-3.5" />
                이동하기
              </button>
            </div>
          )}
        </div>

        {/* 상태 변경 */}
        <div className="relative">
          <button
            onClick={() => {
              setShowStatusDropdown(!showStatusDropdown);
              setShowDateDropdown(false);
            }}
            disabled={isPending}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm",
              "bg-gray-100 hover:bg-gray-200 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <CheckCircle2 className="w-4 h-4" />
            상태 변경
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {showStatusDropdown && (
            <div className="absolute bottom-full mb-2 left-0 bg-white rounded-lg shadow-lg border py-1 min-w-[140px]">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleBatchStatusChange(option.value)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100"
                >
                  <option.icon className="w-4 h-4" />
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 삭제 */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isPending}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm",
            "bg-red-50 text-red-600 hover:bg-red-100 transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <Trash2 className="w-4 h-4" />
          삭제
        </button>

        {/* 로딩 인디케이터 */}
        {isPending && (
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
        )}

        {/* 닫기 버튼 */}
        <button
          onClick={onExitSelectionMode}
          className="ml-2 p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          title="선택 모드 종료"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="플랜 일괄 삭제"
        description={`선택한 ${selectedCount}개의 플랜을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        cancelLabel="취소"
        onConfirm={handleBatchDelete}
        variant="destructive"
        isLoading={isPending}
      />
    </>
  );
}
