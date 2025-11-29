"use client";

import React, { useMemo } from "react";
import { TrendingUp, TrendingDown, CheckCircle, AlertCircle } from "lucide-react";
import { WizardData } from "../PlanGroupWizard";
import { SummaryCard } from "./SummaryCard";

/**
 * LearningVolumeSummary - 학습량 요약
 * 
 * Phase 4.3에서 구현
 * 현재 학습량과 추천 범위를 비교하여 표시
 */

export type LearningVolumeSummaryProps = {
  data: WizardData;
};

export const LearningVolumeSummary = React.memo(function LearningVolumeSummary({
  data,
}: LearningVolumeSummaryProps) {
  // 현재 학습량 계산
  const currentVolume = useMemo(() => {
    const allContents = [
      ...data.student_contents,
      ...data.recommended_contents,
    ];

    return allContents.reduce((sum, content) => {
      return sum + (content.end_range - content.start_range + 1);
    }, 0);
  }, [data.student_contents, data.recommended_contents]);

  // 추천 범위 (±20%)
  const recommendedMin = useMemo(() => {
    return Math.floor(currentVolume * 0.8);
  }, [currentVolume]);

  const recommendedMax = useMemo(() => {
    return Math.ceil(currentVolume * 1.2);
  }, [currentVolume]);

  // 상태 판정
  const status = useMemo(() => {
    if (currentVolume === 0) return "empty";
    if (currentVolume < recommendedMin) return "low";
    if (currentVolume > recommendedMax) return "high";
    return "optimal";
  }, [currentVolume, recommendedMin, recommendedMax]);

  // 차이 계산
  const difference = useMemo(() => {
    if (status === "low") {
      return recommendedMin - currentVolume;
    }
    if (status === "high") {
      return currentVolume - recommendedMax;
    }
    return 0;
  }, [status, currentVolume, recommendedMin, recommendedMax]);

  // 상태별 메시지
  const statusMessage = {
    empty: "콘텐츠를 선택해주세요",
    low: `권장 학습량보다 ${difference}페이지 부족합니다`,
    high: `권장 학습량보다 ${difference}페이지 초과했습니다`,
    optimal: "적정 학습량입니다",
  }[status];

  // 상태별 variant
  const statusVariant = {
    empty: "default",
    low: "warning",
    high: "warning",
    optimal: "success",
  }[status] as "default" | "warning" | "success";

  if (currentVolume === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-3 text-sm font-medium text-gray-900">
          학습량을 계산할 수 없습니다
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Step 3에서 콘텐츠를 선택해주세요
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          title="현재 학습량"
          value={currentVolume}
          subtitle="페이지/강"
          variant="primary"
        />
        <SummaryCard
          title="권장 최소"
          value={recommendedMin}
          subtitle="페이지/강"
          variant="default"
        />
        <SummaryCard
          title="권장 최대"
          value={recommendedMax}
          subtitle="페이지/강"
          variant="default"
        />
      </div>

      {/* 상태 표시 */}
      <div
        className={`rounded-lg border p-4 ${
          status === "optimal"
            ? "border-green-200 bg-green-50"
            : status === "empty"
            ? "border-gray-200 bg-gray-50"
            : "border-yellow-200 bg-yellow-50"
        }`}
      >
        <div className="flex items-start gap-3">
          {status === "optimal" ? (
            <CheckCircle className="h-6 w-6 flex-shrink-0 text-green-600" />
          ) : status === "low" ? (
            <TrendingDown className="h-6 w-6 flex-shrink-0 text-yellow-600" />
          ) : status === "high" ? (
            <TrendingUp className="h-6 w-6 flex-shrink-0 text-yellow-600" />
          ) : (
            <AlertCircle className="h-6 w-6 flex-shrink-0 text-gray-600" />
          )}
          
          <div className="flex-1">
            <h4
              className={`text-sm font-semibold ${
                status === "optimal"
                  ? "text-green-900"
                  : status === "empty"
                  ? "text-gray-900"
                  : "text-yellow-900"
              }`}
            >
              {status === "optimal" && "✅ 적정 학습량"}
              {status === "low" && "⚠️ 학습량 부족"}
              {status === "high" && "⚠️ 학습량 초과"}
              {status === "empty" && "ℹ️ 학습량 미설정"}
            </h4>
            <p
              className={`mt-1 text-sm ${
                status === "optimal"
                  ? "text-green-700"
                  : status === "empty"
                  ? "text-gray-700"
                  : "text-yellow-700"
              }`}
            >
              {statusMessage}
            </p>
            
            {status !== "empty" && status !== "optimal" && (
              <p
                className={`mt-2 text-xs ${
                  status === "optimal"
                    ? "text-green-600"
                    : "text-yellow-600"
                }`}
              >
                💡 Step 3으로 돌아가서 콘텐츠 범위를 조정하거나 콘텐츠를
                추가/제거해주세요.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 진행률 바 */}
      {currentVolume > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">학습량 비율</span>
            <span className="text-gray-600">
              {Math.round((currentVolume / recommendedMax) * 100)}%
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full transition-all duration-300 ${
                status === "optimal"
                  ? "bg-green-500"
                  : status === "low"
                  ? "bg-yellow-500"
                  : "bg-yellow-500"
              }`}
              style={{
                width: `${Math.min((currentVolume / recommendedMax) * 100, 100)}%`,
              }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <span>{recommendedMin}</span>
            <span>권장 범위</span>
            <span>{recommendedMax}</span>
          </div>
        </div>
      )}
    </div>
  );
});

