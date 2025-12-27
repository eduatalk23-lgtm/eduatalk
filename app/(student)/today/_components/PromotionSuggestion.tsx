"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, X, ChevronRight, Sparkles, Calendar, Clock } from "lucide-react";
import {
  type PromotionCandidate,
  promoteToRegularPlan,
} from "@/lib/domains/admin-plan/actions/adHocPlan";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/cn";

interface PromotionSuggestionProps {
  candidates: PromotionCandidate[];
  studentId: string;
  tenantId: string;
}

/**
 * 단발성 플랜 승격 제안 컴포넌트
 *
 * 반복적으로 사용되는 단발성 플랜을 감지하고
 * 정규 플랜으로 전환을 제안합니다.
 */
export function PromotionSuggestion({
  candidates,
  studentId,
  tenantId,
}: PromotionSuggestionProps) {
  const [dismissed, setDismissed] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<PromotionCandidate | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();
  const router = useRouter();

  // 승격 점수가 50 이상인 후보만 표시
  const eligibleCandidates = candidates.filter((c) => c.promotionScore >= 50);

  if (dismissed || eligibleCandidates.length === 0) {
    return null;
  }

  const topCandidate = eligibleCandidates[0];

  const handlePromote = (candidate: PromotionCandidate) => {
    setSelectedCandidate(candidate);
    setShowModal(true);
  };

  const handleConfirmPromotion = () => {
    if (!selectedCandidate) return;

    startTransition(async () => {
      // 기본 설정으로 승격
      const today = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1); // 1개월 후

      const result = await promoteToRegularPlan({
        studentId,
        tenantId,
        candidate: selectedCandidate,
        settings: {
          name: `${selectedCandidate.contentTitle} 플랜`,
          periodStart: today.toISOString().split("T")[0],
          periodEnd: endDate.toISOString().split("T")[0],
          weekdays: [1, 2, 3, 4, 5], // 평일
          dailyMinutes: selectedCandidate.averageMinutes,
        },
      });

      if (result.success && result.data) {
        showToast("정규 플랜으로 전환되었습니다!", "success");
        setShowModal(false);
        router.push(`/plan/group/${result.data.planGroupId}`);
      } else {
        showToast(`전환 실패: ${result.error}`, "error");
      }
    });
  };

  return (
    <>
      {/* 승격 제안 배너 */}
      <div className="relative overflow-hidden rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 dark:border-indigo-800 dark:from-indigo-900/20 dark:to-purple-900/20 p-4">
        {/* 닫기 버튼 */}
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-2 top-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-4">
          {/* 아이콘 */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-800">
            <Sparkles className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          </div>

          {/* 내용 */}
          <div className="flex-1 min-w-0 pr-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              정규 플랜으로 전환하시겠어요?
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium text-indigo-600 dark:text-indigo-400">
                "{topCandidate.contentTitle}"
              </span>
              을(를) {topCandidate.occurrenceCount}번 반복해서 학습하셨네요!
              정규 플랜으로 전환하면 체계적인 학습 관리가 가능해요.
            </p>

            {/* 통계 */}
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>{topCandidate.occurrenceCount}회 학습</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>평균 {topCandidate.averageMinutes}분</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                <span>주 {topCandidate.recommendedDaysPerWeek}일 권장</span>
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => handlePromote(topCandidate)}
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                정규 플랜으로 전환
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                나중에
              </button>
            </div>
          </div>
        </div>

        {/* 추가 후보가 있으면 표시 */}
        {eligibleCandidates.length > 1 && (
          <div className="mt-4 border-t border-indigo-200 dark:border-indigo-700 pt-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              다른 승격 가능한 플랜: {eligibleCandidates.length - 1}개 더
            </p>
          </div>
        )}
      </div>

      {/* 승격 확인 모달 */}
      {showModal && selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className={cn(
              "w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-800",
              isPending && "pointer-events-none opacity-50"
            )}
          >
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-800">
                  <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  정규 플랜으로 전환
                </h2>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4">
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {selectedCandidate.contentTitle}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-500 dark:text-gray-400">
                    <span>{selectedCandidate.occurrenceCount}회 학습</span>
                    <span>총 {selectedCandidate.totalMinutes}분</span>
                  </div>
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <p>
                    이 학습을 정규 플랜으로 전환하면:
                  </p>
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    <li>체계적인 일정 관리가 가능해요</li>
                    <li>진행률과 통계를 확인할 수 있어요</li>
                    <li>기존 학습 기록은 유지돼요</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-200 dark:border-gray-700 p-4">
              <button
                onClick={() => setShowModal(false)}
                disabled={isPending}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                취소
              </button>
              <button
                onClick={handleConfirmPromotion}
                disabled={isPending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-gray-400"
              >
                {isPending ? "전환 중..." : "전환하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
