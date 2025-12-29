"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { RangeUnit } from "@/lib/types/plan";
import type { WizardData } from "./types";

interface ContentDetailsResponse {
  success: boolean;
  data?: {
    details?: unknown[];
    episodes?: unknown[];
    total_pages?: number | null;
    total_episodes?: number | null;
  };
}

interface RangeSettingStepProps {
  content: NonNullable<WizardData["content"]>;
  onSet: (range: WizardData["range"]) => void;
  onBack: () => void;
  selectedRange: WizardData["range"];
}

export function RangeSettingStep({
  content,
  onSet,
  onBack,
  selectedRange,
}: RangeSettingStepProps) {
  // 비-커스텀 콘텐츠의 경우 상세 정보 조회
  const { data: contentDetails, isLoading: isLoadingDetails } = useQuery<ContentDetailsResponse>({
    queryKey: ["content-details", content.id, content.type],
    queryFn: async () => {
      const res = await fetch(
        `/api/student-content-details?contentType=${content.type}&contentId=${content.id}`
      );
      return res.json();
    },
    enabled: !!content.id && content.type !== "custom",
    staleTime: 5 * 60 * 1000, // 5분 캐시
  });

  // 조회된 상세 정보에서 total units 가져오기
  const fetchedTotalUnits = useMemo(() => {
    if (!contentDetails?.success || !contentDetails.data) return null;
    if (content.type === "book") {
      return contentDetails.data.total_pages;
    } else if (content.type === "lecture") {
      return contentDetails.data.total_episodes;
    }
    return null;
  }, [contentDetails, content.type]);

  // totalUnits 결정: 조회된 값 > props 값 > 기본값
  const totalUnits = fetchedTotalUnits ?? content.totalUnits ?? 100;
  const [start, setStart] = useState(selectedRange?.start ?? 1);
  const [end, setEnd] = useState(selectedRange?.end ?? totalUnits);
  const [unit, setUnit] = useState<RangeUnit>(selectedRange?.unit ?? "page");

  // totalUnits가 변경되면 end 값 업데이트 (이미 선택된 범위가 없는 경우)
  useEffect(() => {
    if (!selectedRange?.end && fetchedTotalUnits) {
      setEnd(fetchedTotalUnits);
    }
  }, [fetchedTotalUnits, selectedRange?.end]);

  // Quick presets based on total units
  const presets = useMemo(() => {
    const half = Math.floor(totalUnits / 2);
    const third = Math.floor(totalUnits / 3);
    return [
      { label: "전체", start: 1, end: totalUnits },
      { label: "전반부", start: 1, end: half },
      { label: "후반부", start: half + 1, end: totalUnits },
      { label: "1/3", start: 1, end: third },
    ];
  }, [totalUnits]);

  const getUnitLabel = (u: RangeUnit) => {
    switch (u) {
      case "page":
        return "페이지";
      case "episode":
        return "회차";
      case "day":
        return "일차";
      case "chapter":
        return "단원";
      case "unit":
        return "단위";
    }
  };

  const getUnitOptions = (): RangeUnit[] => {
    if (content.type === "lecture") {
      return ["episode", "day"];
    }
    return ["page", "chapter", "unit"];
  };

  const isValid = start > 0 && end >= start;

  const handleContinue = () => {
    if (isValid) {
      onSet({ start, end, unit });
    }
  };

  const totalAmount = end - start + 1;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          학습 범위를 설정하세요
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {content.name}
          </span>
          에서 학습할 범위를 입력해주세요.
        </p>
      </div>

      {/* Total Info */}
      {isLoadingDetails && content.type !== "custom" ? (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            콘텐츠 정보 조회 중...
          </p>
        </div>
      ) : totalUnits ? (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            총 {totalUnits}
            {content.type === "lecture" ? "회" : "페이지"}
            {fetchedTotalUnits && " (서버에서 조회됨)"}
          </p>
        </div>
      ) : null}

      {/* Unit Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          단위
        </label>
        <div className="flex gap-2">
          {getUnitOptions().map((u) => (
            <button
              key={u}
              onClick={() => setUnit(u)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                unit === u
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {getUnitLabel(u)}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Presets */}
      {totalUnits > 1 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            빠른 선택
          </label>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => {
                  setStart(preset.start);
                  setEnd(preset.end);
                }}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  start === preset.start && end === preset.end
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Range Inputs */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            시작 {getUnitLabel(unit)}
          </label>
          <input
            type="number"
            min={1}
            value={start}
            onChange={(e) => setStart(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            종료 {getUnitLabel(unit)}
          </label>
          <input
            type="number"
            min={start}
            value={end}
            onChange={(e) =>
              setEnd(Math.max(start, parseInt(e.target.value) || start))
            }
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">총 분량</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {totalAmount} {getUnitLabel(unit)}
          </span>
        </div>
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
          disabled={!isValid}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          다음
        </button>
      </div>
    </div>
  );
}
