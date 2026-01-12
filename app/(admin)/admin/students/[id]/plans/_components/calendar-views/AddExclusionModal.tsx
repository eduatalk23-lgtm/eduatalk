"use client";

/**
 * 제외일 추가 모달
 *
 * 제외일 유형과 사유를 입력받아 제외일을 추가합니다.
 */

import { useState, useTransition } from "react";
import { X, CalendarOff, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";

import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import {
  addPlannerExclusionAction,
  type ExclusionType,
} from "@/lib/domains/admin-plan/actions";

// 제외일 유형 옵션
const EXCLUSION_TYPES: { value: ExclusionType; label: string; description: string }[] = [
  { value: "휴가", label: "휴가", description: "가족 여행, 휴식 등" },
  { value: "개인사정", label: "개인사정", description: "병원, 경조사 등" },
  { value: "휴일지정", label: "휴일지정", description: "공휴일, 기념일 등" },
  { value: "기타", label: "기타", description: "그 외 사유" },
];

interface AddExclusionModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  plannerId: string;
  onSuccess: () => void;
}

export default function AddExclusionModal({
  isOpen,
  onClose,
  date,
  plannerId,
  onSuccess,
}: AddExclusionModalProps) {
  const [exclusionType, setExclusionType] = useState<ExclusionType>("휴가");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  if (!isOpen) return null;

  const formattedDate = (() => {
    try {
      return format(parseISO(date), "yyyy년 M월 d일 (E)", { locale: ko });
    } catch {
      return date;
    }
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      try {
        await addPlannerExclusionAction(plannerId, {
          exclusionDate: date,
          exclusionType,
          reason: reason.trim() || undefined,
          source: "manual",
        });

        toast.showToast(`${date} 제외일이 설정되었습니다.`, "success");
        onSuccess();
        handleClose();
      } catch (error) {
        console.error("제외일 추가 오류:", error);
        toast.showToast(
          error instanceof Error ? error.message : "제외일 추가에 실패했습니다.",
          "error"
        );
      }
    });
  };

  const handleClose = () => {
    setExclusionType("휴가");
    setReason("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* 모달 */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 animate-in fade-in-0 zoom-in-95 duration-200">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <CalendarOff className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold">제외일 설정</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-md transition-colors"
            disabled={isPending}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 본문 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* 날짜 표시 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              날짜
            </label>
            <div className="px-3 py-2 bg-gray-50 rounded-md text-gray-900">
              {formattedDate}
            </div>
          </div>

          {/* 제외 유형 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              제외 유형
            </label>
            <div className="grid grid-cols-2 gap-2">
              {EXCLUSION_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setExclusionType(type.value)}
                  className={cn(
                    "flex flex-col items-start p-3 rounded-lg border-2 transition-colors",
                    exclusionType === type.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <span className={cn(
                    "font-medium text-sm",
                    exclusionType === type.value ? "text-blue-700" : "text-gray-700"
                  )}>
                    {type.label}
                  </span>
                  <span className="text-xs text-gray-500 mt-0.5">
                    {type.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 사유 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              사유 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="제외 사유를 입력하세요"
              rows={2}
              className={cn(
                "w-full px-3 py-2 border rounded-md text-sm",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                "resize-none"
              )}
              disabled={isPending}
            />
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className={cn(
                "flex-1 px-4 py-2.5 text-sm font-medium rounded-lg",
                "border border-gray-300 text-gray-700",
                "hover:bg-gray-50 transition-colors",
                "disabled:opacity-50"
              )}
              disabled={isPending}
            >
              취소
            </button>
            <button
              type="submit"
              className={cn(
                "flex-1 px-4 py-2.5 text-sm font-medium rounded-lg",
                "bg-blue-600 text-white",
                "hover:bg-blue-700 transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "flex items-center justify-center gap-2"
              )}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  처리 중...
                </>
              ) : (
                "설정"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
