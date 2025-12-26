"use client";

import { useState, useMemo } from "react";
import type { RangeUnit } from "@/lib/types/plan";
import type { WizardData } from "./ContentAddWizard";

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
  const totalUnits = content.totalUnits ?? 100;
  const [start, setStart] = useState(selectedRange?.start ?? 1);
  const [end, setEnd] = useState(selectedRange?.end ?? totalUnits);
  const [unit, setUnit] = useState<RangeUnit>(selectedRange?.unit ?? "page");

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
      {content.totalUnits && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            총 {content.totalUnits}
            {content.type === "lecture" ? "회" : "페이지"}
          </p>
        </div>
      )}

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
      {content.totalUnits && (
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
