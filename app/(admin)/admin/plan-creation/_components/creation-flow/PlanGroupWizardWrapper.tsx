"use client";

/**
 * PlanGroupWizard 배치 래퍼 컴포넌트
 *
 * 여러 학생에게 동일한 설정으로 플랜 그룹을 생성할 수 있는 래퍼
 * 공유 설정을 먼저 구성한 후 각 학생에게 순차적으로 적용
 */

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, borderInput } from "@/lib/utils/darkMode";
import {
  Calendar,
  Clock,
  Users,
  ArrowLeft,
  ArrowRight,
  Settings,
  Play,
} from "lucide-react";
import type { StudentListRow } from "@/app/(admin)/admin/students/_components/types";
import type { CreationResult } from "../../_context/types";
import type { BatchItemResult } from "../../_types";
import { useBatchProcessor } from "../../_hooks";
import { ProgressTracker } from "../progress";
import { createBatchPlanGroups, type BatchStudentInput } from "../../_actions";

interface PlanGroupWizardWrapperProps {
  selectedStudents: StudentListRow[];
  isOpen: boolean;
  onClose: () => void;
  onComplete: (results: CreationResult[]) => void;
}

// 공유 설정 타입
interface SharedSettings {
  title: string;
  startDate: string;
  endDate: string;
  dailyStudyMinutes: number;
  daysPerWeek: number[];
  // 추가 설정은 Phase 3에서 확장
}

type WrapperStep = "settings" | "confirm" | "processing" | "complete";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export function PlanGroupWizardWrapper({
  selectedStudents,
  isOpen,
  onClose,
  onComplete,
}: PlanGroupWizardWrapperProps) {
  const [currentStep, setCurrentStep] = useState<WrapperStep>("settings");
  const [settings, setSettings] = useState<SharedSettings>(() => {
    const today = new Date();
    const thirtyDaysLater = new Date(today);
    thirtyDaysLater.setDate(today.getDate() + 30);

    return {
      title: "",
      startDate: today.toISOString().split("T")[0],
      endDate: thirtyDaysLater.toISOString().split("T")[0],
      dailyStudyMinutes: 120,
      daysPerWeek: [1, 2, 3, 4, 5], // 월~금
    };
  });

  // 개별 학생 처리 함수
  const processStudent = useCallback(
    async (
      student: StudentListRow,
      sharedSettings: SharedSettings | undefined,
      signal: AbortSignal
    ): Promise<Omit<BatchItemResult, "studentId" | "studentName">> => {
      if (!sharedSettings) {
        return { status: "error", message: "설정이 없습니다" };
      }

      try {
        // 개별 학생에 대해 배치 API 호출 (1명씩 처리)
        const studentInput: BatchStudentInput = {
          studentId: student.id,
          studentName: student.name ?? "",
        };

        const response = await createBatchPlanGroups([studentInput], {
          name: sharedSettings.title,
          startDate: sharedSettings.startDate,
          endDate: sharedSettings.endDate,
          dailyStudyMinutes: sharedSettings.dailyStudyMinutes,
          daysPerWeek: sharedSettings.daysPerWeek,
        });

        if (!response.success || response.results.length === 0) {
          return {
            status: "error",
            message: response.error || "플랜 그룹 생성 중 오류가 발생했습니다",
          };
        }

        const result = response.results[0];
        if (!result.success) {
          return {
            status: "error",
            message: result.error || result.message,
          };
        }

        return {
          status: "success",
          message: result.message,
          planGroupId: result.planGroupId,
        };
      } catch (err) {
        return {
          status: "error",
          message: err instanceof Error ? err.message : "플랜 그룹 생성 중 오류가 발생했습니다",
        };
      }
    },
    []
  );

  // 배치 처리 훅
  const {
    state: processorState,
    progress,
    results,
    start,
    pause,
    resume,
    cancel,
    retry,
  } = useBatchProcessor({
    students: selectedStudents,
    settings,
    config: {
      strategy: "sequential",
      retry: { maxRetries: 2, retryDelayMs: 1000, exponentialBackoff: true },
      onProgress: (p) => {
        // 진행 상황 업데이트
      },
      onComplete: (finalResults) => {
        setCurrentStep("complete");
        // 결과를 CreationResult 형식으로 변환
        const creationResults: CreationResult[] = finalResults.map((r) => ({
          studentId: r.studentId,
          studentName: r.studentName,
          status: r.status === "success" ? "success" : r.status === "skipped" ? "skipped" : "error",
          planGroupId: r.planGroupId,
          message: r.message,
          error: r.error?.message,
        }));
        onComplete(creationResults);
      },
    },
    processStudent,
  });

  // 설정 유효성 검사
  const isSettingsValid = useMemo(() => {
    return (
      settings.title.trim().length > 0 &&
      settings.startDate &&
      settings.endDate &&
      new Date(settings.startDate) <= new Date(settings.endDate) &&
      settings.dailyStudyMinutes > 0 &&
      settings.daysPerWeek.length > 0
    );
  }, [settings]);

  // 요일 토글
  const toggleDay = useCallback((day: number) => {
    setSettings((prev) => ({
      ...prev,
      daysPerWeek: prev.daysPerWeek.includes(day)
        ? prev.daysPerWeek.filter((d) => d !== day)
        : [...prev.daysPerWeek, day].sort(),
    }));
  }, []);

  // 처리 시작
  const handleStart = useCallback(async () => {
    setCurrentStep("processing");
    await start();
  }, [start]);

  // 닫기 처리
  const handleClose = useCallback(() => {
    if (processorState === "processing") {
      cancel();
    }
    onClose();
  }, [processorState, cancel, onClose]);

  if (!isOpen) return null;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
            <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className={cn("font-semibold", textPrimary)}>플랜 그룹 위저드</h3>
            <p className={cn("text-sm", textSecondary)}>
              {selectedStudents.length}명의 학생에게 플랜 그룹 생성
            </p>
          </div>
        </div>

        {currentStep === "settings" && (
          <button
            onClick={handleClose}
            className={cn(
              "flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition",
              borderInput,
              textSecondary,
              "hover:bg-gray-100 dark:hover:bg-gray-800"
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            뒤로
          </button>
        )}
      </div>

      {/* 설정 단계 */}
      {currentStep === "settings" && (
        <div className="space-y-6">
          {/* 플랜 그룹 제목 */}
          <div>
            <label className={cn("mb-2 block text-sm font-medium", textPrimary)}>
              플랜 그룹 이름 *
            </label>
            <input
              type="text"
              value={settings.title}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="예: 2월 학습 계획"
              className={cn(
                "w-full rounded-lg border px-4 py-2.5",
                borderInput,
                "bg-white dark:bg-gray-800",
                textPrimary,
                "focus:ring-2 focus:ring-indigo-500"
              )}
            />
          </div>

          {/* 기간 설정 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={cn("mb-2 block text-sm font-medium", textPrimary)}>
                시작일 *
              </label>
              <input
                type="date"
                value={settings.startDate}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, startDate: e.target.value }))
                }
                className={cn(
                  "w-full rounded-lg border px-4 py-2.5",
                  borderInput,
                  "bg-white dark:bg-gray-800",
                  textPrimary
                )}
              />
            </div>
            <div>
              <label className={cn("mb-2 block text-sm font-medium", textPrimary)}>
                종료일 *
              </label>
              <input
                type="date"
                value={settings.endDate}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, endDate: e.target.value }))
                }
                className={cn(
                  "w-full rounded-lg border px-4 py-2.5",
                  borderInput,
                  "bg-white dark:bg-gray-800",
                  textPrimary
                )}
              />
            </div>
          </div>

          {/* 일일 학습 시간 */}
          <div>
            <label className={cn("mb-2 block text-sm font-medium", textPrimary)}>
              일일 학습 시간 (분)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={30}
                max={300}
                step={30}
                value={settings.dailyStudyMinutes}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    dailyStudyMinutes: Number(e.target.value),
                  }))
                }
                className="flex-1"
              />
              <div
                className={cn(
                  "flex w-24 items-center justify-center rounded-lg border px-3 py-2",
                  borderInput,
                  "bg-white dark:bg-gray-800"
                )}
              >
                <Clock className="mr-2 h-4 w-4 text-gray-400" />
                <span className={textPrimary}>{settings.dailyStudyMinutes}분</span>
              </div>
            </div>
          </div>

          {/* 학습 요일 */}
          <div>
            <label className={cn("mb-2 block text-sm font-medium", textPrimary)}>
              학습 요일
            </label>
            <div className="flex gap-2">
              {DAY_LABELS.map((label, index) => (
                <button
                  key={index}
                  onClick={() => toggleDay(index)}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-medium transition",
                    settings.daysPerWeek.includes(index)
                      ? "border-indigo-500 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
                      : cn(borderInput, textSecondary, "hover:bg-gray-100 dark:hover:bg-gray-800")
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 대상 학생 요약 */}
          <div
            className={cn(
              "rounded-lg border p-4",
              borderInput,
              "bg-gray-50 dark:bg-gray-800/30"
            )}
          >
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-gray-400" />
              <span className={textSecondary}>대상 학생:</span>
              <span className={cn("font-medium", textPrimary)}>
                {selectedStudents.slice(0, 3).map((s) => s.name).join(", ")}
                {selectedStudents.length > 3 &&
                  ` 외 ${selectedStudents.length - 3}명`}
              </span>
            </div>
          </div>

          {/* 다음 버튼 */}
          <button
            onClick={() => setCurrentStep("confirm")}
            disabled={!isSettingsValid}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium transition",
              isSettingsValid
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
            )}
          >
            다음
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 확인 단계 */}
      {currentStep === "confirm" && (
        <div className="space-y-6">
          <div
            className={cn(
              "rounded-lg border p-6",
              borderInput,
              "bg-gray-50 dark:bg-gray-800/30"
            )}
          >
            <h4 className={cn("mb-4 font-medium", textPrimary)}>생성 내용 확인</h4>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className={textSecondary}>플랜 그룹 이름</span>
                <span className={cn("font-medium", textPrimary)}>{settings.title}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={textSecondary}>기간</span>
                <span className={cn("font-medium", textPrimary)}>
                  {settings.startDate} ~ {settings.endDate}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={textSecondary}>일일 학습 시간</span>
                <span className={cn("font-medium", textPrimary)}>
                  {settings.dailyStudyMinutes}분
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={textSecondary}>학습 요일</span>
                <span className={cn("font-medium", textPrimary)}>
                  {settings.daysPerWeek.map((d) => DAY_LABELS[d]).join(", ")}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={textSecondary}>대상 학생 수</span>
                <span className={cn("font-medium", textPrimary)}>
                  {selectedStudents.length}명
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setCurrentStep("settings")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 font-medium transition",
                borderInput,
                textPrimary,
                "hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
            >
              <Settings className="h-4 w-4" />
              설정 수정
            </button>
            <button
              onClick={handleStart}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white transition hover:bg-indigo-700"
            >
              <Play className="h-4 w-4" />
              생성 시작
            </button>
          </div>
        </div>
      )}

      {/* 처리 및 완료 단계 */}
      {(currentStep === "processing" || currentStep === "complete") && (
        <ProgressTracker
          state={processorState}
          progress={progress}
          onPause={pause}
          onResume={resume}
          onCancel={cancel}
          onRetry={retry}
          onComplete={handleClose}
          showControls={true}
          maxVisibleItems={5}
        />
      )}
    </div>
  );
}
