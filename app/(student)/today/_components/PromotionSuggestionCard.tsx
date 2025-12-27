"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpCircle,
  Loader2,
  ChevronRight,
  X,
  Calendar,
  Clock,
  Repeat,
} from "lucide-react";
import {
  analyzePromotionCandidates,
  promoteToRegularPlan,
  type PromotionCandidate,
} from "@/lib/domains/admin-plan/actions/adHocPlan";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";

type Props = {
  studentId: string;
  tenantId: string | null;
};

/**
 * 승격 제안 카드
 *
 * 자주 반복되는 Ad-hoc 플랜을 정규 플랜으로 승격할 것을 제안합니다.
 */
export function PromotionSuggestionCard({ studentId, tenantId }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [candidates, setCandidates] = useState<PromotionCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<PromotionCandidate | null>(null);
  const [isPending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchCandidates = async () => {
      setIsLoading(true);
      try {
        const result = await analyzePromotionCandidates(studentId);
        if (result.success && result.data) {
          // 점수 50 이상인 후보만 표시
          setCandidates(result.data.filter((c) => c.promotionScore >= 50));
        }
      } catch (error) {
        console.error("Failed to fetch promotion candidates:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCandidates();
  }, [studentId]);

  const handlePromote = (candidate: PromotionCandidate) => {
    setSelectedCandidate(candidate);
  };

  const confirmPromotion = () => {
    if (!selectedCandidate) return;

    startTransition(async () => {
      try {
        // 기본 기간 설정: 오늘부터 30일
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + 30);

        const result = await promoteToRegularPlan({
          studentId,
          tenantId: tenantId ?? "",
          candidate: selectedCandidate,
          settings: {
            name: `${selectedCandidate.contentTitle} 정규 플랜`,
            periodStart: today.toISOString().split("T")[0],
            periodEnd: endDate.toISOString().split("T")[0],
            weekdays: [0, 1, 2, 3, 4, 5, 6].slice(0, selectedCandidate.recommendedDaysPerWeek),
            dailyMinutes: selectedCandidate.averageMinutes,
          },
        });

        if (result.success) {
          showToast("정규 플랜으로 승격되었습니다!", "success");
          setCandidates((prev) =>
            prev.filter((c) => c.contentTitle !== selectedCandidate.contentTitle)
          );
          setSelectedCandidate(null);
          router.refresh();
        } else {
          showToast(result.error || "승격에 실패했습니다.", "error");
        }
      } catch (error) {
        showToast("승격 중 오류가 발생했습니다.", "error");
      }
    });
  };

  const handleDismiss = (candidate: PromotionCandidate) => {
    setDismissed((prev) => new Set([...prev, candidate.contentTitle]));
  };

  // 무시된 후보 필터링
  const visibleCandidates = candidates.filter(
    (c) => !dismissed.has(c.contentTitle)
  );

  if (isLoading) {
    return null; // 로딩 중에는 표시하지 않음
  }

  if (visibleCandidates.length === 0) {
    return null;
  }

  return (
    <>
      <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-4 dark:border-indigo-800 dark:from-indigo-900/20 dark:to-purple-900/20">
        <div className="flex items-center gap-2 mb-3">
          <ArrowUpCircle className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            정규 플랜 승격 제안
          </h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          자주 반복되는 학습 활동이 감지되었습니다. 정규 플랜으로 만들어 보세요!
        </p>

        <div className="space-y-2">
          {visibleCandidates.slice(0, 3).map((candidate) => (
            <div
              key={candidate.contentTitle}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                    {candidate.contentTitle}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                      candidate.promotionScore >= 80
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                    )}
                  >
                    {candidate.promotionScore >= 80 ? "강력 추천" : "추천"}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <Repeat className="h-3 w-3" />
                    {candidate.occurrenceCount}회 반복
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    평균 {candidate.averageMinutes}분
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    주 {candidate.recommendedDaysPerWeek}일 추천
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleDismiss(candidate)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
                  aria-label="닫기"
                >
                  <X className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handlePromote(candidate)}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  승격
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 승격 확인 모달 */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              정규 플랜으로 승격
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">{selectedCandidate.contentTitle}</span>을(를)
              정규 플랜으로 만들겠습니까?
            </p>
            <div className="mt-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">기간</span>
                  <span className="text-gray-900 dark:text-gray-100">30일</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">주간 학습일</span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {selectedCandidate.recommendedDaysPerWeek}일
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">일일 학습 시간</span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {selectedCandidate.averageMinutes}분
                  </span>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              * 생성 후 플랜 상세 페이지에서 일정을 수정할 수 있습니다.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setSelectedCandidate(null)}
                disabled={isPending}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                취소
              </button>
              <button
                onClick={confirmPromotion}
                disabled={isPending}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    처리 중...
                  </>
                ) : (
                  "승격하기"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
