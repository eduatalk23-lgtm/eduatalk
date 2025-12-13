/**
 * 자동 재조정 제안 배너 컴포넌트
 * 
 * 학습 지연이 감지되면 자동으로 재조정을 제안하는 배너를 표시합니다.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, X, ChevronRight } from "lucide-react";
import { analyzeDelay } from "@/lib/reschedule/delayDetector";
import { generateRescheduleSuggestions } from "@/lib/reschedule/autoSuggester";
import type { Plan } from "@/lib/data/studentPlans";
import type { PlanContent } from "@/lib/types/plan";
import type { RescheduleSuggestion } from "@/lib/reschedule/autoSuggester";

type AutoRescheduleBannerProps = {
  groupId: string;
  plans: Plan[];
  contents: PlanContent[];
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
};

export function AutoRescheduleBanner({
  groupId,
  plans,
  contents,
  startDate,
  endDate,
}: AutoRescheduleBannerProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [suggestions, setSuggestions] = useState<RescheduleSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 지연 분석 및 제안 생성
    const delayAnalysis = analyzeDelay({
      plans,
      startDate,
      endDate,
    });

    // 지연이 없거나 낮으면 배너를 표시하지 않음
    if (
      delayAnalysis.severity === "none" ||
      delayAnalysis.severity === "low"
    ) {
      setLoading(false);
      return;
    }

    const generatedSuggestions = generateRescheduleSuggestions({
      delayAnalysis,
      contents,
      startDate,
      endDate,
    });

    setSuggestions(generatedSuggestions);
    setLoading(false);
  }, [plans, contents, startDate, endDate]);

  const handleDismiss = () => {
    setDismissed(true);
  };

  const handleApplySuggestion = (suggestion: RescheduleSuggestion) => {
    // 재조정 페이지로 이동 (제안 정보를 쿼리 파라미터로 전달)
    const params = new URLSearchParams({
      suggestion: suggestion.type,
      priority: suggestion.priority.toString(),
    });

    if (suggestion.affectedDateRange) {
      params.set("from", suggestion.affectedDateRange.from);
      params.set("to", suggestion.affectedDateRange.to);
    }

    router.push(`/plan/group/${groupId}/reschedule?${params.toString()}`);
  };

  if (loading || dismissed || suggestions.length === 0) {
    return null;
  }

  const topSuggestion = suggestions[0];

  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0" />
          <div className="flex flex-1 flex-col gap-1">
            <h3 className="font-semibold text-orange-900">
              학습 지연 감지 - 재조정 제안
            </h3>
            <p className="text-sm text-orange-800">
              {topSuggestion.description}
            </p>
            <p className="text-xs text-orange-700">
              {topSuggestion.reason}
            </p>

            {/* 추가 제안이 있으면 표시 */}
            {suggestions.length > 1 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-orange-900">
                  다른 제안 ({suggestions.length - 1}개):
                </p>
                {suggestions.slice(1, 3).map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleApplySuggestion(suggestion)}
                    className="text-left rounded-lg border border-orange-200 bg-white p-2 text-xs text-orange-800 transition hover:bg-orange-100"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{suggestion.title}</span>
                      <ChevronRight className="h-3 w-3" />
                    </div>
                    <p className="text-orange-600">{suggestion.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => handleApplySuggestion(topSuggestion)}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700"
          >
            제안 적용
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded p-1 text-orange-600 transition hover:bg-orange-100"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

