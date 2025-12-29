/**
 * 충돌 해결 모달
 *
 * 플랜 간 충돌을 시각화하고 해결 전략을 제안합니다.
 */

"use client";

import { useState, useMemo, useCallback } from "react";
import {
  X,
  AlertTriangle,
  AlertCircle,
  Info,
  Check,
  ChevronRight,
  Calendar,
  Clock,
  ArrowRight,
  RefreshCw,
  Trash2,
  SkipForward,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import {
  detectConflicts,
  suggestResolutions,
  summarizeConflicts,
  type Conflict,
  type ConflictType,
  type ConflictSeverity,
  type ResolutionStrategy,
  type PlanForConflict,
} from "@/lib/domains/plan/services/conflictResolver";
import type { PlanExclusion, AcademySchedule } from "@/lib/types/plan";

type ConflictResolutionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  plans: PlanForConflict[];
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
  availableDates: string[];
  onResolve?: (planId: string, action: string, toDate?: string) => Promise<void>;
  onBatchResolve?: (changes: { planId: string; action: string; toDate?: string }[]) => Promise<void>;
};

type Step = "overview" | "detail" | "preview";

const CONFLICT_TYPE_LABELS: Record<ConflictType, string> = {
  time_overlap: "시간 중복",
  excluded_date: "제외일 충돌",
  academy_conflict: "학원 일정 충돌",
  capacity_exceeded: "용량 초과",
  deadline_exceeded: "마감 초과",
};

const SEVERITY_CONFIG: Record<ConflictSeverity, { color: string; icon: typeof AlertCircle }> = {
  error: { color: "text-red-600 bg-red-50 border-red-200", icon: AlertCircle },
  warning: { color: "text-amber-600 bg-amber-50 border-amber-200", icon: AlertTriangle },
  info: { color: "text-blue-600 bg-blue-50 border-blue-200", icon: Info },
};

const STRATEGY_LABELS: Record<ResolutionStrategy, { label: string; icon: typeof ArrowRight }> = {
  skip: { label: "건너뛰기", icon: SkipForward },
  move_forward: { label: "앞으로 이동", icon: ArrowRight },
  move_backward: { label: "뒤로 이동", icon: ArrowRight },
  redistribute: { label: "재배분", icon: RefreshCw },
  split: { label: "분할", icon: RefreshCw },
  merge: { label: "병합", icon: RefreshCw },
  delete: { label: "삭제", icon: Trash2 },
};

export function ConflictResolutionModal({
  isOpen,
  onClose,
  plans,
  exclusions,
  academySchedules,
  availableDates,
  onResolve,
  onBatchResolve,
}: ConflictResolutionModalProps) {
  const toast = useToast();
  const [currentStep, setCurrentStep] = useState<Step>("overview");
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null);
  const [selectedResolutions, setSelectedResolutions] = useState<
    Map<string, { strategy: ResolutionStrategy; targetDates?: string[] }>
  >(new Map());
  const [isProcessing, setIsProcessing] = useState(false);

  // 충돌 감지
  const conflicts = useMemo(() => {
    return detectConflicts(plans, exclusions, academySchedules, {
      checkTimeOverlap: true,
      checkExcludedDates: true,
      checkAcademyConflicts: true,
      checkCapacity: true,
      maxDailyPlans: 8,
    });
  }, [plans, exclusions, academySchedules]);

  // 충돌 요약
  const summary = useMemo(() => {
    return summarizeConflicts(conflicts);
  }, [conflicts]);

  // 선택된 충돌에 대한 해결 제안
  const resolutionOptions = useMemo(() => {
    if (!selectedConflict) return [];
    return suggestResolutions(selectedConflict, plans, availableDates);
  }, [selectedConflict, plans, availableDates]);

  // 충돌 선택 핸들러
  const handleConflictSelect = useCallback((conflict: Conflict) => {
    setSelectedConflict(conflict);
    setCurrentStep("detail");
  }, []);

  // 해결 전략 선택 핸들러
  const handleResolutionSelect = useCallback(
    (
      conflictId: string,
      strategy: ResolutionStrategy,
      targetDates?: string[]
    ) => {
      setSelectedResolutions((prev) => {
        const next = new Map(prev);
        next.set(conflictId, { strategy, targetDates });
        return next;
      });
    },
    []
  );

  // 미리보기로 이동
  const goToPreview = useCallback(() => {
    if (selectedResolutions.size === 0) {
      toast.showError("하나 이상의 해결 전략을 선택하세요.");
      return;
    }
    setCurrentStep("preview");
  }, [selectedResolutions.size, toast]);

  // 해결 적용
  const handleApplyResolutions = useCallback(async () => {
    if (!onBatchResolve && !onResolve) {
      toast.showError("해결 기능이 설정되지 않았습니다.");
      return;
    }

    setIsProcessing(true);
    try {
      const changes: { planId: string; action: string; toDate?: string }[] = [];

      selectedResolutions.forEach((resolution, conflictId) => {
        const conflict = conflicts.find((c) => c.id === conflictId);
        if (!conflict) return;

        conflict.affectedPlanIds.forEach((planId, index) => {
          changes.push({
            planId,
            action: resolution.strategy,
            toDate: resolution.targetDates?.[index % (resolution.targetDates.length || 1)],
          });
        });
      });

      if (onBatchResolve) {
        await onBatchResolve(changes);
      } else if (onResolve) {
        for (const change of changes) {
          await onResolve(change.planId, change.action, change.toDate);
        }
      }

      toast.showSuccess(`${changes.length}개 플랜에 대한 충돌이 해결되었습니다.`);
      onClose();
    } catch (error) {
      toast.showError(
        error instanceof Error ? error.message : "충돌 해결 중 오류가 발생했습니다."
      );
    } finally {
      setIsProcessing(false);
    }
  }, [
    selectedResolutions,
    conflicts,
    onBatchResolve,
    onResolve,
    toast,
    onClose,
  ]);

  // 초기화
  const handleReset = useCallback(() => {
    setSelectedConflict(null);
    setSelectedResolutions(new Map());
    setCurrentStep("overview");
  }, []);

  if (!isOpen) return null;

  // 심각도별 아이콘
  const SeverityIcon = selectedConflict
    ? SEVERITY_CONFIG[selectedConflict.severity].icon
    : AlertTriangle;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-2xl rounded-xl bg-white shadow-xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-gray-900">충돌 해결</h2>
            {conflicts.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                {conflicts.length}개 충돌
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-gray-100"
            aria-label="닫기"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* 진행 표시 */}
        <div className="border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-center gap-2">
            {(["overview", "detail", "preview"] as Step[]).map((step, index) => (
              <div key={step} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                    currentStep === step
                      ? "bg-amber-600 text-white"
                      : index < ["overview", "detail", "preview"].indexOf(currentStep)
                      ? "bg-green-100 text-green-600"
                      : "bg-gray-100 text-gray-500"
                  )}
                >
                  {index < ["overview", "detail", "preview"].indexOf(currentStep) ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs",
                    currentStep === step ? "font-medium text-gray-900" : "text-gray-500"
                  )}
                >
                  {step === "overview"
                    ? "충돌 목록"
                    : step === "detail"
                    ? "해결 선택"
                    : "미리보기"}
                </span>
                {index < 2 && <div className="h-px w-8 bg-gray-200" />}
              </div>
            ))}
          </div>
        </div>

        {/* 본문 */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {/* 충돌 없음 */}
          {conflicts.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="rounded-full bg-green-100 p-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  충돌이 없습니다
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  현재 스케줄에 충돌이 감지되지 않았습니다.
                </p>
              </div>
            </div>
          )}

          {/* 개요 단계 */}
          {currentStep === "overview" && conflicts.length > 0 && (
            <div className="flex flex-col gap-4">
              {/* 요약 카드 */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
                  <p className="text-2xl font-bold text-red-700">{summary.bySeverity.error}</p>
                  <p className="text-xs text-red-600">심각</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700">{summary.bySeverity.warning}</p>
                  <p className="text-xs text-amber-600">경고</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
                  <p className="text-2xl font-bold text-gray-700">{summary.affectedDates.length}</p>
                  <p className="text-xs text-gray-600">영향 날짜</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
                  <p className="text-2xl font-bold text-gray-700">{summary.affectedPlanCount}</p>
                  <p className="text-xs text-gray-600">영향 플랜</p>
                </div>
              </div>

              {/* 충돌 목록 */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700">충돌 목록</h3>
                {conflicts.map((conflict) => {
                  const config = SEVERITY_CONFIG[conflict.severity];
                  const Icon = config.icon;
                  const isResolved = selectedResolutions.has(conflict.id);

                  return (
                    <button
                      key={conflict.id}
                      type="button"
                      onClick={() => handleConflictSelect(conflict)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition",
                        isResolved
                          ? "border-green-300 bg-green-50"
                          : config.color,
                        "hover:shadow-sm"
                      )}
                    >
                      {isResolved ? (
                        <Check className="h-5 w-5 flex-shrink-0 text-green-600" />
                      ) : (
                        <Icon className="h-5 w-5 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium uppercase">
                            {CONFLICT_TYPE_LABELS[conflict.type]}
                          </span>
                          <span className="text-xs text-gray-500">
                            {format(parseISO(conflict.date), "M월 d일", { locale: ko })}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-gray-700">
                          {conflict.description}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 상세 단계 */}
          {currentStep === "detail" && selectedConflict && (
            <div className="flex flex-col gap-4">
              {/* 선택된 충돌 정보 */}
              <div
                className={cn(
                  "rounded-lg border p-4",
                  SEVERITY_CONFIG[selectedConflict.severity].color
                )}
              >
                <div className="flex items-start gap-3">
                  <SeverityIcon className="h-5 w-5 flex-shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {CONFLICT_TYPE_LABELS[selectedConflict.type]}
                      </span>
                      <span className="text-xs">
                        {format(parseISO(selectedConflict.date), "yyyy년 M월 d일 (E)", {
                          locale: ko,
                        })}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{selectedConflict.description}</p>
                    <p className="mt-2 text-xs text-gray-600">
                      영향받는 플랜: {selectedConflict.affectedPlanIds.length}개
                    </p>
                  </div>
                </div>
              </div>

              {/* 해결 옵션 */}
              <div>
                <h3 className="mb-3 text-sm font-semibold text-gray-700">해결 방안 선택</h3>
                <div className="space-y-2">
                  {resolutionOptions.map((option, index) => {
                    const strategyConfig = STRATEGY_LABELS[option.strategy];
                    const StrategyIcon = strategyConfig.icon;
                    const isSelected =
                      selectedResolutions.get(selectedConflict.id)?.strategy ===
                      option.strategy;

                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() =>
                          handleResolutionSelect(
                            selectedConflict.id,
                            option.strategy,
                            option.targetDates
                          )
                        }
                        className={cn(
                          "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition",
                          isSelected
                            ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        )}
                      >
                        <div
                          className={cn(
                            "rounded-full p-1.5",
                            isSelected ? "bg-blue-100" : "bg-gray-100"
                          )}
                        >
                          <StrategyIcon
                            className={cn(
                              "h-4 w-4",
                              isSelected ? "text-blue-600" : "text-gray-500"
                            )}
                          />
                        </div>
                        <div className="flex-1">
                          <p
                            className={cn(
                              "text-sm font-medium",
                              isSelected ? "text-blue-900" : "text-gray-900"
                            )}
                          >
                            {option.description}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">{option.impact}</p>
                          {option.targetDates && option.targetDates.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {option.targetDates.map((date) => (
                                <span
                                  key={date}
                                  className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                                >
                                  <Calendar className="h-3 w-3" />
                                  {format(parseISO(date), "M/d", { locale: ko })}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <Check className="h-5 w-5 flex-shrink-0 text-blue-600" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 미리보기 단계 */}
          {currentStep === "preview" && (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h4 className="mb-2 font-medium text-gray-900">적용 예정 변경사항</h4>
                <p className="text-sm text-gray-600">
                  {selectedResolutions.size}개 충돌에 대한 해결책이 적용됩니다.
                </p>
              </div>

              <div className="space-y-2">
                {Array.from(selectedResolutions.entries()).map(
                  ([conflictId, resolution]) => {
                    const conflict = conflicts.find((c) => c.id === conflictId);
                    if (!conflict) return null;

                    const strategyConfig = STRATEGY_LABELS[resolution.strategy];

                    return (
                      <div
                        key={conflictId}
                        className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3"
                      >
                        <div className="rounded-full bg-blue-100 p-1.5">
                          <Check className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {CONFLICT_TYPE_LABELS[conflict.type]} ({conflict.date})
                          </p>
                          <p className="text-xs text-gray-500">
                            전략: {strategyConfig.label}
                          </p>
                        </div>
                        <span className="text-xs text-gray-400">
                          {conflict.affectedPlanIds.length}개 플랜
                        </span>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={
              currentStep === "overview"
                ? handleReset
                : () => {
                    if (currentStep === "detail") setCurrentStep("overview");
                    else if (currentStep === "preview") setCurrentStep("detail");
                  }
            }
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            {currentStep === "overview" ? "초기화" : "이전"}
          </button>

          {conflicts.length > 0 && (
            <button
              type="button"
              onClick={
                currentStep === "overview"
                  ? () => setCurrentStep("detail")
                  : currentStep === "detail"
                  ? goToPreview
                  : handleApplyResolutions
              }
              disabled={
                (currentStep === "overview" && conflicts.length === 0) ||
                (currentStep === "detail" && !selectedResolutions.has(selectedConflict?.id || "")) ||
                (currentStep === "preview" && selectedResolutions.size === 0) ||
                isProcessing
              }
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
                isProcessing ||
                  (currentStep === "overview" && conflicts.length === 0) ||
                  (currentStep === "detail" &&
                    !selectedResolutions.has(selectedConflict?.id || "")) ||
                  (currentStep === "preview" && selectedResolutions.size === 0)
                  ? "cursor-not-allowed bg-gray-200 text-gray-500"
                  : "bg-amber-600 text-white hover:bg-amber-700"
              )}
            >
              {isProcessing ? (
                "처리 중..."
              ) : currentStep === "preview" ? (
                <>
                  변경사항 적용
                  <Check className="h-4 w-4" />
                </>
              ) : (
                <>
                  다음
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
