"use client";

import React, { useState, useTransition, useCallback } from "react";
import { cn } from "@/lib/cn";
import { Sparkles, ChevronDown, Check, Loader2 } from "lucide-react";
import type { ContentSlot } from "@/lib/types/content-selection";
import {
  recommendSlotsAction,
  getAvailablePresetsAction,
  recommendSlotsFromPresetAction,
  type GradeLevel,
  type PlanPurpose,
  type StudyIntensity,
} from "@/lib/domains/plan/actions/slotRecommendation";

// ============================================================================
// 타입 정의
// ============================================================================

type SlotRecommendationDropdownProps = {
  onApply: (slots: ContentSlot[]) => void;
  planPurpose?: string;
  className?: string;
};

// ============================================================================
// 상수
// ============================================================================

const GRADE_OPTIONS: { value: GradeLevel; label: string }[] = [
  { value: "middle_1", label: "중1" },
  { value: "middle_2", label: "중2" },
  { value: "middle_3", label: "중3" },
  { value: "high_1", label: "고1" },
  { value: "high_2", label: "고2" },
  { value: "high_3", label: "고3" },
  { value: "n_su", label: "N수생" },
];

const PURPOSE_OPTIONS: { value: PlanPurpose; label: string }[] = [
  { value: "수능대비", label: "수능대비" },
  { value: "내신대비", label: "내신대비" },
  { value: "기초학습", label: "기초학습" },
  { value: "심화학습", label: "심화학습" },
  { value: "복습", label: "복습" },
  { value: "방학특강", label: "방학특강" },
];

const INTENSITY_OPTIONS: { value: StudyIntensity; label: string; desc: string }[] = [
  { value: "light", label: "가볍게", desc: "4개 슬롯" },
  { value: "normal", label: "보통", desc: "6개 슬롯" },
  { value: "intensive", label: "집중", desc: "9개 슬롯" },
];

// ============================================================================
// 컴포넌트
// ============================================================================

export function SlotRecommendationDropdown({
  onApply,
  planPurpose,
  className,
}: SlotRecommendationDropdownProps) {
  // 상태
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [isPending, startTransition] = useTransition();

  // 커스텀 추천 설정
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>("high_2");
  const [purpose, setPurpose] = useState<PlanPurpose>(
    (planPurpose as PlanPurpose) || "수능대비"
  );
  const [intensity, setIntensity] = useState<StudyIntensity>("normal");

  // 프리셋 목록
  const [presets, setPresets] = useState<{ key: string; name: string }[]>([]);
  const [presetsLoaded, setPresetsLoaded] = useState(false);

  // 프리셋 로드
  const loadPresets = useCallback(() => {
    if (presetsLoaded) return;

    startTransition(async () => {
      const result = await getAvailablePresetsAction();
      if (result.success && result.presets) {
        setPresets(result.presets);
      }
      setPresetsLoaded(true);
    });
  }, [presetsLoaded]);

  // 프리셋 적용
  const handleApplyPreset = useCallback(
    (presetKey: string) => {
      startTransition(async () => {
        const result = await recommendSlotsFromPresetAction(presetKey);
        if (result.success && result.result) {
          onApply(result.result.slots);
          setIsOpen(false);
        }
      });
    },
    [onApply]
  );

  // 커스텀 추천 적용
  const handleApplyCustom = useCallback(() => {
    startTransition(async () => {
      const result = await recommendSlotsAction(
        {
          gradeLevel,
          planPurpose: purpose,
          studyIntensity: intensity,
        },
        {
          includeReview: true,
          includeTest: false,
        }
      );
      if (result.success && result.result) {
        onApply(result.result.slots);
        setIsOpen(false);
      }
    });
  }, [gradeLevel, purpose, intensity, onApply]);

  // 드롭다운 열기
  const handleOpen = useCallback(() => {
    setIsOpen(true);
    loadPresets();
  }, [loadPresets]);

  return (
    <div className={cn("relative", className)}>
      {/* 트리거 버튼 */}
      <button
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : handleOpen())}
        disabled={isPending}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 text-base font-medium transition-colors md:py-2.5 md:text-sm",
          "border-purple-200 bg-purple-50 text-purple-700 active:bg-purple-100 md:hover:bg-purple-100",
          isPending && "cursor-wait opacity-70"
        )}
      >
        {isPending ? (
          <Loader2 className="h-5 w-5 animate-spin md:h-4 md:w-4" />
        ) : (
          <Sparkles className="h-5 w-5 md:h-4 md:w-4" />
        )}
        AI 추천
        <ChevronDown
          className={cn(
            "ml-auto h-5 w-5 transition-transform md:h-4 md:w-4",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* 드롭다운 메뉴 */}
      {isOpen && (
        <>
          {/* 배경 클릭 시 닫기 */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute bottom-full left-0 z-20 mb-1 w-full min-w-[280px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
            {/* 탭 */}
            <div className="flex border-b border-gray-100">
              <button
                type="button"
                onClick={() => setMode("preset")}
                className={cn(
                  "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
                  mode === "preset"
                    ? "bg-purple-50 text-purple-700"
                    : "text-gray-600 hover:bg-gray-50"
                )}
              >
                빠른 추천
              </button>
              <button
                type="button"
                onClick={() => setMode("custom")}
                className={cn(
                  "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
                  mode === "custom"
                    ? "bg-purple-50 text-purple-700"
                    : "text-gray-600 hover:bg-gray-50"
                )}
              >
                맞춤 설정
              </button>
            </div>

            {/* 프리셋 모드 */}
            {mode === "preset" && (
              <div className="max-h-64 overflow-y-auto p-2">
                {presets.length === 0 && !presetsLoaded ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : presets.length === 0 ? (
                  <div className="py-4 text-center text-sm text-gray-500">
                    사용 가능한 프리셋이 없습니다
                  </div>
                ) : (
                  <div className="space-y-1">
                    {presets.map((preset) => (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => handleApplyPreset(preset.key)}
                        disabled={isPending}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm hover:bg-purple-50 active:bg-purple-100 disabled:opacity-50"
                      >
                        <Sparkles className="h-4 w-4 flex-shrink-0 text-purple-500" />
                        <span className="flex-1">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 커스텀 모드 */}
            {mode === "custom" && (
              <div className="space-y-4 p-4">
                {/* 학년 선택 */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">
                    학년
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {GRADE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setGradeLevel(option.value)}
                        className={cn(
                          "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                          gradeLevel === option.value
                            ? "bg-purple-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 목적 선택 */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">
                    학습 목적
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PURPOSE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setPurpose(option.value)}
                        className={cn(
                          "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                          purpose === option.value
                            ? "bg-purple-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 학습 강도 선택 */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">
                    학습 강도
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {INTENSITY_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setIntensity(option.value)}
                        className={cn(
                          "flex flex-col items-center rounded-md px-2 py-2 text-xs transition-colors",
                          intensity === option.value
                            ? "bg-purple-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        )}
                      >
                        <span className="font-medium">{option.label}</span>
                        <span className="mt-0.5 opacity-70">{option.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 적용 버튼 */}
                <button
                  type="button"
                  onClick={handleApplyCustom}
                  disabled={isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  추천 적용
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
