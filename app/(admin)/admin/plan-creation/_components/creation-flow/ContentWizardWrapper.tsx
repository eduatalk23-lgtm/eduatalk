"use client";

/**
 * ContentWizard 배치 래퍼 컴포넌트
 *
 * 여러 학생의 기존 플랜 그룹에 콘텐츠를 추가
 * 콘텐츠 선택 후 각 학생의 플랜 그룹에 배분
 */

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, borderInput } from "@/lib/utils/darkMode";
import {
  BookPlus,
  Search,
  ArrowLeft,
  ArrowRight,
  Play,
  Settings,
  Check,
} from "lucide-react";
import type { StudentListRow } from "@/app/(admin)/admin/students/_components/types";
import type { CreationResult } from "../../_context/types";
import type { BatchItemResult } from "../../_types";
import { useBatchProcessor } from "../../_hooks";
import { ProgressTracker } from "../progress";
import { addBatchContents, type BatchStudentInput, type ContentInfo } from "../../_actions";

interface ContentWizardWrapperProps {
  selectedStudents: StudentListRow[];
  isOpen: boolean;
  onClose: () => void;
  onComplete: (results: CreationResult[]) => void;
}

// 콘텐츠 추가 설정 타입
interface ContentSettings {
  selectedContentIds: string[];
  distributionStrategy: "even" | "front-loaded" | "back-loaded";
  searchQuery: string;
}

// 임시 콘텐츠 데이터 (Phase 3에서 실제 API 연동)
interface ContentItem {
  id: string;
  title: string;
  subject: string;
  duration: number;
}

const MOCK_CONTENTS: ContentItem[] = [
  { id: "c1", title: "수학 - 방정식 풀이", subject: "수학", duration: 45 },
  { id: "c2", title: "영어 - 문법 기초", subject: "영어", duration: 30 },
  { id: "c3", title: "국어 - 독해력 향상", subject: "국어", duration: 40 },
  { id: "c4", title: "과학 - 물리 기본", subject: "과학", duration: 50 },
  { id: "c5", title: "사회 - 역사 탐구", subject: "사회", duration: 35 },
  { id: "c6", title: "수학 - 함수 이해", subject: "수학", duration: 45 },
  { id: "c7", title: "영어 - 독해 연습", subject: "영어", duration: 40 },
  { id: "c8", title: "국어 - 작문 기초", subject: "국어", duration: 35 },
];

const DISTRIBUTION_OPTIONS = [
  { value: "even", label: "균등 배분", description: "모든 날에 동일하게 배분" },
  { value: "front-loaded", label: "앞부분 집중", description: "초반에 더 많이 배치" },
  { value: "back-loaded", label: "뒷부분 집중", description: "후반에 더 많이 배치" },
] as const;

type WrapperStep = "content-selection" | "settings" | "confirm" | "processing" | "complete";

export function ContentWizardWrapper({
  selectedStudents,
  isOpen,
  onClose,
  onComplete,
}: ContentWizardWrapperProps) {
  const [currentStep, setCurrentStep] = useState<WrapperStep>("content-selection");
  const [settings, setSettings] = useState<ContentSettings>({
    selectedContentIds: [],
    distributionStrategy: "even",
    searchQuery: "",
  });

  // 개별 학생 처리 함수
  const processStudent = useCallback(
    async (
      student: StudentListRow,
      sharedSettings: ContentSettings | undefined,
      signal: AbortSignal
    ): Promise<Omit<BatchItemResult, "studentId" | "studentName">> => {
      if (!sharedSettings || sharedSettings.selectedContentIds.length === 0) {
        return { status: "error", message: "선택된 콘텐츠가 없습니다" };
      }

      try {
        // 선택된 콘텐츠 정보 준비
        const contentsToAdd: ContentInfo[] = sharedSettings.selectedContentIds
          .map((id): ContentInfo | null => {
            const content = MOCK_CONTENTS.find((c) => c.id === id);
            if (!content) return null;
            return {
              id: content.id,
              title: content.title,
              contentType: "book", // 기본값: book
              estimatedMinutes: content.duration,
            };
          })
          .filter((c): c is ContentInfo => c !== null);

        if (contentsToAdd.length === 0) {
          return { status: "error", message: "유효한 콘텐츠가 없습니다" };
        }

        // 개별 학생에 대해 배치 API 호출 (1명씩 처리)
        const studentInput: BatchStudentInput = {
          studentId: student.id,
          studentName: student.name ?? "",
        };

        const response = await addBatchContents(
          [studentInput],
          {
            contentIds: sharedSettings.selectedContentIds,
            distributionStrategy: sharedSettings.distributionStrategy,
          },
          contentsToAdd
        );

        if (!response.success || response.results.length === 0) {
          return {
            status: "error",
            message: response.error || "콘텐츠 추가 중 오류가 발생했습니다",
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
          message: err instanceof Error ? err.message : "콘텐츠 추가 중 오류가 발생했습니다",
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

  // 필터링된 콘텐츠
  const filteredContents = useMemo(() => {
    if (!settings.searchQuery.trim()) return MOCK_CONTENTS;
    const query = settings.searchQuery.toLowerCase();
    return MOCK_CONTENTS.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        c.subject.toLowerCase().includes(query)
    );
  }, [settings.searchQuery]);

  // 선택된 콘텐츠 목록
  const selectedContents = useMemo(() => {
    return MOCK_CONTENTS.filter((c) =>
      settings.selectedContentIds.includes(c.id)
    );
  }, [settings.selectedContentIds]);

  // 콘텐츠 선택 토글
  const toggleContent = useCallback((contentId: string) => {
    setSettings((prev) => ({
      ...prev,
      selectedContentIds: prev.selectedContentIds.includes(contentId)
        ? prev.selectedContentIds.filter((id) => id !== contentId)
        : [...prev.selectedContentIds, contentId],
    }));
  }, []);

  // 설정 유효성 검사
  const isSettingsValid = useMemo(() => {
    return settings.selectedContentIds.length > 0;
  }, [settings.selectedContentIds]);

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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <BookPlus className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className={cn("font-semibold", textPrimary)}>콘텐츠 추가 위저드</h3>
            <p className={cn("text-sm", textSecondary)}>
              {selectedStudents.length}명의 학생에게 콘텐츠 추가
            </p>
          </div>
        </div>

        {currentStep === "content-selection" && (
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

      {/* 콘텐츠 선택 단계 */}
      {currentStep === "content-selection" && (
        <div className="space-y-4">
          {/* 검색 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={settings.searchQuery}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, searchQuery: e.target.value }))
              }
              placeholder="콘텐츠 검색..."
              className={cn(
                "w-full rounded-lg border py-2.5 pl-10 pr-4",
                borderInput,
                "bg-white dark:bg-gray-800",
                textPrimary
              )}
            />
          </div>

          {/* 선택된 콘텐츠 요약 */}
          {settings.selectedContentIds.length > 0 && (
            <div
              className={cn(
                "rounded-lg border p-3",
                borderInput,
                "bg-emerald-50 dark:bg-emerald-900/20"
              )}
            >
              <span className={cn("text-sm font-medium", textPrimary)}>
                {settings.selectedContentIds.length}개 콘텐츠 선택됨
              </span>
            </div>
          )}

          {/* 콘텐츠 목록 */}
          <div className="max-h-[300px] space-y-2 overflow-y-auto">
            {filteredContents.map((content) => {
              const isSelected = settings.selectedContentIds.includes(content.id);
              return (
                <button
                  key={content.id}
                  onClick={() => toggleContent(content.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border p-3 transition",
                    isSelected
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                      : cn(borderInput, "hover:bg-gray-50 dark:hover:bg-gray-800/50")
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded border",
                        isSelected
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : borderInput
                      )}
                    >
                      {isSelected && <Check className="h-4 w-4" />}
                    </div>
                    <div className="text-left">
                      <div className={cn("font-medium", textPrimary)}>
                        {content.title}
                      </div>
                      <div className={cn("text-xs", textSecondary)}>
                        {content.subject} · {content.duration}분
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 다음 버튼 */}
          <button
            onClick={() => setCurrentStep("settings")}
            disabled={!isSettingsValid}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium transition",
              isSettingsValid
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
            )}
          >
            다음
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 배분 설정 단계 */}
      {currentStep === "settings" && (
        <div className="space-y-6">
          <div>
            <label className={cn("mb-3 block text-sm font-medium", textPrimary)}>
              배분 전략
            </label>
            <div className="space-y-2">
              {DISTRIBUTION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      distributionStrategy: option.value,
                    }))
                  }
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border p-4 transition",
                    settings.distributionStrategy === option.value
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                      : cn(borderInput, "hover:bg-gray-50 dark:hover:bg-gray-800/50")
                  )}
                >
                  <div className="text-left">
                    <div className={cn("font-medium", textPrimary)}>
                      {option.label}
                    </div>
                    <div className={cn("text-sm", textSecondary)}>
                      {option.description}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border",
                      settings.distributionStrategy === option.value
                        ? "border-emerald-500 bg-emerald-500"
                        : borderInput
                    )}
                  >
                    {settings.distributionStrategy === option.value && (
                      <div className="h-2 w-2 rounded-full bg-white" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 선택된 콘텐츠 목록 */}
          <div
            className={cn(
              "rounded-lg border p-4",
              borderInput,
              "bg-gray-50 dark:bg-gray-800/30"
            )}
          >
            <h4 className={cn("mb-3 text-sm font-medium", textPrimary)}>
              선택된 콘텐츠 ({selectedContents.length}개)
            </h4>
            <div className="space-y-2">
              {selectedContents.map((content) => (
                <div
                  key={content.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className={textPrimary}>{content.title}</span>
                  <span className={textSecondary}>{content.duration}분</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setCurrentStep("content-selection")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 font-medium transition",
                borderInput,
                textPrimary,
                "hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
            >
              <ArrowLeft className="h-4 w-4" />
              콘텐츠 수정
            </button>
            <button
              onClick={() => setCurrentStep("confirm")}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white transition hover:bg-emerald-700"
            >
              다음
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
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
            <h4 className={cn("mb-4 font-medium", textPrimary)}>추가 내용 확인</h4>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className={textSecondary}>선택된 콘텐츠</span>
                <span className={cn("font-medium", textPrimary)}>
                  {selectedContents.length}개
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={textSecondary}>총 학습 시간</span>
                <span className={cn("font-medium", textPrimary)}>
                  {selectedContents.reduce((sum, c) => sum + c.duration, 0)}분
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={textSecondary}>배분 전략</span>
                <span className={cn("font-medium", textPrimary)}>
                  {DISTRIBUTION_OPTIONS.find(
                    (o) => o.value === settings.distributionStrategy
                  )?.label}
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
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white transition hover:bg-emerald-700"
            >
              <Play className="h-4 w-4" />
              추가 시작
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
