"use client";

/**
 * QuickPlan 배치 래퍼 컴포넌트
 *
 * 여러 학생에게 동일한 빠른 플랜(단일 학습 항목)을 추가
 * 간단한 설정으로 즉시 플랜 생성 가능
 */

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, borderInput } from "@/lib/utils/darkMode";
import {
  Zap,
  Clock,
  Users,
  ArrowLeft,
  ArrowRight,
  Play,
  Settings,
} from "lucide-react";
import type { StudentListRow } from "@/app/(admin)/admin/students/_components/types";
import type { CreationResult } from "../../_context/types";
import type { BatchItemResult } from "../../_types";
import { useBatchProcessor } from "../../_hooks";
import { ProgressTracker } from "../progress";
import { createBatchQuickPlans, type BatchStudentInput } from "../../_actions";

interface QuickPlanWrapperProps {
  selectedStudents: StudentListRow[];
  isOpen: boolean;
  onClose: () => void;
  onComplete: (results: CreationResult[]) => void;
}

// 빠른 플랜 설정 타입
interface QuickPlanSettings {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  memo: string;
}

type WrapperStep = "settings" | "confirm" | "processing" | "complete";

// 시간 옵션 생성 (30분 간격)
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? "00" : "30";
  return `${String(hour).padStart(2, "0")}:${minute}`;
});

export function QuickPlanWrapper({
  selectedStudents,
  isOpen,
  onClose,
  onComplete,
}: QuickPlanWrapperProps) {
  const [currentStep, setCurrentStep] = useState<WrapperStep>("settings");
  const [settings, setSettings] = useState<QuickPlanSettings>(() => {
    const today = new Date();
    return {
      title: "",
      date: today.toISOString().split("T")[0],
      startTime: "14:00",
      endTime: "15:00",
      memo: "",
    };
  });

  // 개별 학생 처리 함수
  const processStudent = useCallback(
    async (
      student: StudentListRow,
      sharedSettings: QuickPlanSettings | undefined,
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

        const response = await createBatchQuickPlans([studentInput], {
          title: sharedSettings.title,
          date: sharedSettings.date,
          startTime: sharedSettings.startTime,
          endTime: sharedSettings.endTime,
          memo: sharedSettings.memo || undefined,
        });

        if (!response.success || response.results.length === 0) {
          return {
            status: "error",
            message: response.error || "플랜 생성 중 오류가 발생했습니다",
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
          planId: result.planId,
          planGroupId: result.planGroupId,
        };
      } catch (err) {
        return {
          status: "error",
          message: err instanceof Error ? err.message : "플랜 생성 중 오류가 발생했습니다",
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
      strategy: "parallel", // 빠른 플랜은 병렬 처리
      parallel: { maxConcurrent: 5 },
      retry: { maxRetries: 1, retryDelayMs: 500 },
      onComplete: (finalResults) => {
        setCurrentStep("complete");
        const creationResults: CreationResult[] = finalResults.map((r) => ({
          studentId: r.studentId,
          studentName: r.studentName,
          status: r.status === "success" ? "success" : r.status === "skipped" ? "skipped" : "error",
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
    const startMinutes =
      parseInt(settings.startTime.split(":")[0]) * 60 +
      parseInt(settings.startTime.split(":")[1]);
    const endMinutes =
      parseInt(settings.endTime.split(":")[0]) * 60 +
      parseInt(settings.endTime.split(":")[1]);

    return (
      settings.title.trim().length > 0 &&
      settings.date &&
      endMinutes > startMinutes
    );
  }, [settings]);

  // 학습 시간 계산
  const studyDuration = useMemo(() => {
    const startMinutes =
      parseInt(settings.startTime.split(":")[0]) * 60 +
      parseInt(settings.startTime.split(":")[1]);
    const endMinutes =
      parseInt(settings.endTime.split(":")[0]) * 60 +
      parseInt(settings.endTime.split(":")[1]);
    return endMinutes - startMinutes;
  }, [settings.startTime, settings.endTime]);

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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
            <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className={cn("font-semibold", textPrimary)}>빠른 플랜 추가</h3>
            <p className={cn("text-sm", textSecondary)}>
              {selectedStudents.length}명의 학생에게 즉시 플랜 추가
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
          {/* 플랜 제목 */}
          <div>
            <label className={cn("mb-2 block text-sm font-medium", textPrimary)}>
              플랜 제목 *
            </label>
            <input
              type="text"
              value={settings.title}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="예: 수학 복습, 영어 단어 암기"
              className={cn(
                "w-full rounded-lg border px-4 py-2.5",
                borderInput,
                "bg-white dark:bg-gray-800",
                textPrimary,
                "focus:ring-2 focus:ring-amber-500"
              )}
            />
          </div>

          {/* 날짜 및 시간 */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={cn("mb-2 block text-sm font-medium", textPrimary)}>
                날짜 *
              </label>
              <input
                type="date"
                value={settings.date}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, date: e.target.value }))
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
                시작 시간 *
              </label>
              <select
                value={settings.startTime}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, startTime: e.target.value }))
                }
                className={cn(
                  "w-full rounded-lg border px-4 py-2.5",
                  borderInput,
                  "bg-white dark:bg-gray-800",
                  textPrimary
                )}
              >
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={cn("mb-2 block text-sm font-medium", textPrimary)}>
                종료 시간 *
              </label>
              <select
                value={settings.endTime}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, endTime: e.target.value }))
                }
                className={cn(
                  "w-full rounded-lg border px-4 py-2.5",
                  borderInput,
                  "bg-white dark:bg-gray-800",
                  textPrimary
                )}
              >
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 학습 시간 표시 */}
          {studyDuration > 0 && (
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg border p-3",
                borderInput,
                "bg-amber-50 dark:bg-amber-900/20"
              )}
            >
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className={cn("text-sm", textPrimary)}>
                학습 시간: <strong>{studyDuration}분</strong>
              </span>
            </div>
          )}

          {/* 메모 */}
          <div>
            <label className={cn("mb-2 block text-sm font-medium", textPrimary)}>
              메모 (선택)
            </label>
            <textarea
              value={settings.memo}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, memo: e.target.value }))
              }
              placeholder="학습 내용이나 목표를 입력하세요"
              rows={3}
              className={cn(
                "w-full rounded-lg border px-4 py-2.5",
                borderInput,
                "bg-white dark:bg-gray-800",
                textPrimary,
                "resize-none"
              )}
            />
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
                ? "bg-amber-600 text-white hover:bg-amber-700"
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
                <span className={textSecondary}>플랜 제목</span>
                <span className={cn("font-medium", textPrimary)}>{settings.title}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={textSecondary}>날짜</span>
                <span className={cn("font-medium", textPrimary)}>{settings.date}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={textSecondary}>시간</span>
                <span className={cn("font-medium", textPrimary)}>
                  {settings.startTime} ~ {settings.endTime} ({studyDuration}분)
                </span>
              </div>
              {settings.memo && (
                <div className="flex justify-between text-sm">
                  <span className={textSecondary}>메모</span>
                  <span className={cn("font-medium", textPrimary)}>{settings.memo}</span>
                </div>
              )}
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
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-3 font-medium text-white transition hover:bg-amber-700"
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
