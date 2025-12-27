"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Clock, BookOpen, Video, FileText, Loader2 } from "lucide-react";
import { createStudentAdHocPlan } from "@/lib/domains/admin-plan/actions/adHocPlan";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/cn";

type QuickAddPlanModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string; // YYYY-MM-DD
  studentId: string;
  tenantId: string | null;
  onSuccess?: () => void;
};

type ContentType = "book" | "lecture" | "custom";

const CONTENT_TYPE_OPTIONS: { type: ContentType; label: string; icon: typeof BookOpen }[] = [
  { type: "book", label: "교재", icon: BookOpen },
  { type: "lecture", label: "강의", icon: Video },
  { type: "custom", label: "기타", icon: FileText },
];

const ESTIMATED_MINUTES_OPTIONS = [15, 30, 45, 60, 90, 120];

/**
 * 빠른 플랜 추가 모달
 *
 * 캘린더에서 날짜를 클릭했을 때 간단하게 플랜을 추가할 수 있습니다.
 */
export function QuickAddPlanModal({
  open,
  onOpenChange,
  date,
  studentId,
  tenantId,
  onSuccess,
}: QuickAddPlanModalProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<ContentType>("book");
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [description, setDescription] = useState("");

  const handleClose = () => {
    onOpenChange(false);
    // 폼 초기화
    setTitle("");
    setContentType("book");
    setEstimatedMinutes(30);
    setDescription("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      showToast("제목을 입력해주세요.", "error");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createStudentAdHocPlan({
          student_id: studentId,
          tenant_id: tenantId ?? "",
          title: title.trim(),
          description: description.trim() || undefined,
          plan_date: date,
          estimated_minutes: estimatedMinutes,
          container_type: "daily", // 기본값: daily
        });

        if (result.success) {
          showToast("플랜이 추가되었습니다!", "success");
          handleClose();
          router.refresh();
          onSuccess?.();
        } else {
          showToast(result.error || "플랜 추가에 실패했습니다.", "error");
        }
      } catch (error) {
        showToast("플랜 추가 중 오류가 발생했습니다.", "error");
      }
    });
  };

  if (!open) return null;

  // 날짜 포맷팅
  const dateObj = new Date(date + "T00:00:00");
  const formattedDate = dateObj.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl dark:bg-gray-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-title"
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            <h2 id="quick-add-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              빠른 플랜 추가
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{formattedDate}</p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex flex-col gap-4">
            {/* 제목 */}
            <div>
              <label htmlFor="plan-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                제목 <span className="text-red-500">*</span>
              </label>
              <input
                id="plan-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 수학 개념원리 3단원"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                required
                autoFocus
              />
            </div>

            {/* 콘텐츠 유형 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                유형
              </label>
              <div className="flex gap-2">
                {CONTENT_TYPE_OPTIONS.map(({ type, label, icon: Icon }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setContentType(type)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors",
                      contentType === type
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                        : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 예상 학습 시간 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <Clock className="inline h-4 w-4 mr-1" />
                예상 시간
              </label>
              <div className="flex flex-wrap gap-2">
                {ESTIMATED_MINUTES_OPTIONS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => setEstimatedMinutes(minutes)}
                    className={cn(
                      "rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-colors",
                      estimatedMinutes === minutes
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                        : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
                    )}
                  >
                    {minutes}분
                  </button>
                ))}
              </div>
            </div>

            {/* 설명 (선택) */}
            <div>
              <label htmlFor="plan-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                메모 <span className="text-gray-400">(선택)</span>
              </label>
              <textarea
                id="plan-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="추가 메모..."
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 resize-none"
              />
            </div>
          </div>

          {/* 버튼 */}
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isPending}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isPending || !title.trim()}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  추가 중...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  플랜 추가
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
