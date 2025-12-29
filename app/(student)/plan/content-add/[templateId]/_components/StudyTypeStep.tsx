"use client";

import { useState } from "react";
import type { StudyType } from "@/lib/types/plan";
import type { WizardData } from "./types";

interface StudyTypeStepProps {
  onSelect: (studyType: WizardData["studyType"]) => void;
  onBack: () => void;
  selectedStudyType: WizardData["studyType"];
}

export function StudyTypeStep({
  onSelect,
  onBack,
  selectedStudyType,
}: StudyTypeStepProps) {
  const [type, setType] = useState<StudyType>(
    selectedStudyType?.type ?? "weakness"
  );
  const [daysPerWeek, setDaysPerWeek] = useState<2 | 3 | 4>(
    selectedStudyType?.daysPerWeek ?? 3
  );
  const [reviewEnabled, setReviewEnabled] = useState(
    selectedStudyType?.reviewEnabled ?? false
  );

  const handleContinue = () => {
    onSelect({
      type,
      daysPerWeek: type === "strategy" ? daysPerWeek : undefined,
      reviewEnabled,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          학습 유형을 선택하세요
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          과목의 특성에 맞게 학습 빈도를 설정합니다.
        </p>
      </div>

      {/* Study Type Selection */}
      <div className="space-y-4">
        {/* Weakness Type */}
        <button
          onClick={() => setType("weakness")}
          className={`w-full text-left p-6 rounded-lg border-2 transition-all ${
            type === "weakness"
              ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
              : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                type === "weakness"
                  ? "bg-orange-500 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-500"
              }`}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                취약 과목
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                매일 학습하여 기초를 탄탄히 다집니다.
              </p>
              <div className="mt-2 inline-block px-3 py-1 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 rounded-full text-xs">
                매일 학습
              </div>
            </div>
          </div>
        </button>

        {/* Strategy Type */}
        <button
          onClick={() => setType("strategy")}
          className={`w-full text-left p-6 rounded-lg border-2 transition-all ${
            type === "strategy"
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
              : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                type === "strategy"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-500"
              }`}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                전략 과목
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                주 N일만 집중적으로 학습합니다.
              </p>
              <div className="mt-2 inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-xs">
                주 2~4일 학습
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Days Per Week (Strategy Only) */}
      {type === "strategy" && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            주당 학습일
          </label>
          <div className="flex gap-3">
            {([2, 3, 4] as const).map((days) => (
              <button
                key={days}
                onClick={() => setDaysPerWeek(days)}
                className={`flex-1 py-3 rounded-lg text-center font-medium transition-colors ${
                  daysPerWeek === days
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                }`}
              >
                주 {days}일
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Review Cycle Toggle */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              주간 복습
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              매주 학습한 내용을 복습하는 플랜을 자동 생성합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReviewEnabled(!reviewEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              reviewEnabled ? "bg-green-600" : "bg-gray-300 dark:bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                reviewEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        {reviewEnabled && (
          <p className="mt-3 text-xs text-green-600 dark:text-green-400">
            ✓ 매주 토요일에 그 주에 학습한 범위를 복습합니다.
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          이전
        </button>
        <button
          onClick={handleContinue}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          다음
        </button>
      </div>
    </div>
  );
}
