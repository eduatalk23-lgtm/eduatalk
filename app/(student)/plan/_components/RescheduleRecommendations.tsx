/**
 * 재조정 추천 컴포넌트
 * 
 * 재조정이 필요한 플랜 그룹을 추천하고 원클릭 재조정을 제공합니다.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { detectRescheduleNeeds } from "@/lib/reschedule/patternAnalyzer";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/ToastProvider";
import { AlertCircle, ArrowRight, RefreshCw } from "lucide-react";
import type { RescheduleRecommendation } from "@/lib/reschedule/patternAnalyzer";

type RescheduleRecommendationsProps = {
  studentId: string;
};

export function RescheduleRecommendations({
  studentId,
}: RescheduleRecommendationsProps) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<
    RescheduleRecommendation[]
  >([]);

  useEffect(() => {
    loadRecommendations();
  }, [studentId]);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      const supabase = createSupabaseClient();
      const recs = await detectRescheduleNeeds(supabase, studentId);
      setRecommendations(recs);
    } catch (error) {
      console.error("[RescheduleRecommendations] 추천 로드 실패:", error);
      toast.showError("추천을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickReschedule = (groupId: string) => {
    router.push(`/plan/group/${groupId}/reschedule`);
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-2 text-sm text-gray-600">추천을 분석하는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return null; // 추천이 없으면 표시하지 않음
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-50 border-red-200";
      case "medium":
        return "bg-yellow-50 border-yellow-200";
      case "low":
        return "bg-blue-50 border-blue-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high":
        return "높음";
      case "medium":
        return "보통";
      case "low":
        return "낮음";
      default:
        return priority;
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            재조정 추천
          </h3>
        </div>
        <button
          onClick={loadRecommendations}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <p className="mb-4 text-sm text-gray-600">
        다음 플랜 그룹의 재조정을 권장합니다.
      </p>

      <div className="space-y-3">
        {recommendations.map((rec) => (
          <div
            key={rec.groupId}
            className={`rounded-lg border p-4 ${getPriorityColor(rec.priority)}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {rec.groupName || "이름 없음"}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      rec.priority === "high"
                        ? "bg-red-100 text-red-700"
                        : rec.priority === "medium"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {getPriorityLabel(rec.priority)}
                  </span>
                </div>
                <p className="mb-2 text-sm text-gray-700">{rec.reason}</p>
                <div className="text-xs text-gray-600">
                  영향받는 플랜: {rec.estimatedImpact.plansAffected}개
                </div>
              </div>
              <div className="ml-4 flex items-center gap-2">
                <Link
                  href={`/plan/group/${rec.groupId}`}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  상세 보기
                </Link>
                <button
                  onClick={() => handleQuickReschedule(rec.groupId)}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  재조정
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

