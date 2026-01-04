"use client";

/**
 * Calendar Floating Action Button
 *
 * 캘린더 뷰에서 빠르게 플랜을 추가할 수 있는 플로팅 버튼
 */

import { useState, useCallback } from "react";
import { Plus, Zap, Calendar } from "lucide-react";
import { QuickAddPlanModal } from "./QuickAddPlanModal";
import { cn } from "@/lib/cn";

type CalendarFloatingButtonProps = {
  studentId: string;
  tenantId: string | null;
  selectedDate?: string;
  onSuccess?: () => void;
};

export function CalendarFloatingButton({
  studentId,
  tenantId,
  selectedDate,
  onSuccess,
}: CalendarFloatingButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const targetDate = selectedDate || today;

  const handleQuickAdd = useCallback(() => {
    setShowQuickAddModal(true);
    setIsExpanded(false);
  }, []);

  const handleModalSuccess = useCallback(() => {
    setShowQuickAddModal(false);
    onSuccess?.();
  }, [onSuccess]);

  return (
    <>
      {/* 플로팅 버튼 그룹 */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col-reverse items-end gap-3">
        {/* 확장된 옵션들 */}
        {isExpanded && (
          <div className="flex flex-col-reverse gap-2 animate-in slide-in-from-bottom-2 fade-in duration-200">
            {/* 빠른 플랜 추가 */}
            <button
              onClick={handleQuickAdd}
              className={cn(
                "flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-medium",
                "shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors",
                "text-gray-700"
              )}
            >
              <Zap className="h-5 w-5 text-amber-500" />
              <span>빠른 플랜 추가</span>
            </button>

            {/* 새 플랜 그룹 */}
            <a
              href="/plan/new-group"
              className={cn(
                "flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-medium",
                "shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors",
                "text-gray-700"
              )}
            >
              <Calendar className="h-5 w-5 text-indigo-500" />
              <span>새 플랜 그룹</span>
            </a>
          </div>
        )}

        {/* 메인 FAB */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full",
            "bg-indigo-600 text-white shadow-lg hover:bg-indigo-700",
            "transition-all duration-200",
            isExpanded && "rotate-45 bg-gray-600 hover:bg-gray-700"
          )}
          aria-label={isExpanded ? "닫기" : "플랜 추가"}
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* 빠른 플랜 추가 모달 */}
      <QuickAddPlanModal
        open={showQuickAddModal}
        onOpenChange={setShowQuickAddModal}
        date={targetDate}
        studentId={studentId}
        tenantId={tenantId}
        onSuccess={handleModalSuccess}
      />
    </>
  );
}
