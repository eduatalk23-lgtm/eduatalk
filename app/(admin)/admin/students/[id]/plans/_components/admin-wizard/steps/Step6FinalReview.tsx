"use client";

/**
 * Step 6: 최종 검토
 *
 * Phase 3: 7단계 위저드 확장
 * - 전체 설정 요약 표시
 * - AI 플랜 생성 옵션
 * - 생성 전 최종 확인
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step6FinalReview
 */

import { useMemo, useCallback } from "react";
import {
  Calendar,
  BookOpen,
  Video,
  Clock,
  Target,
  Zap,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Edit3,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  useAdminWizardData,
  useAdminWizardStep,
  useAdminWizardValidation,
} from "../_context";
import type { WizardStep } from "../_context/types";

/**
 * Step6FinalReview Props
 */
interface Step6FinalReviewProps {
  studentName: string;
}

/**
 * Step 6: 최종 검토 컴포넌트
 */
export function Step6FinalReview({ studentName }: Step6FinalReviewProps) {
  const { wizardData, updateData } = useAdminWizardData();
  const { setStep } = useAdminWizardStep();
  const { hasErrors, validationErrors, validationWarnings } = useAdminWizardValidation();

  const {
    name,
    planPurpose,
    periodStart,
    periodEnd,
    blockSetId,
    schedulerType,
    academySchedules,
    exclusions,
    selectedContents,
    skipContents,
    schedulerOptions,
    generateAIPlan,
    aiMode,
  } = wizardData;

  // 기간 계산
  const daysDiff = useMemo(() => {
    if (!periodStart || !periodEnd) return 0;
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }, [periodStart, periodEnd]);

  // 날짜 포맷팅
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // 콘텐츠 통계
  const contentStats = useMemo(() => {
    return {
      total: selectedContents.length,
      books: selectedContents.filter((c) => c.contentType === "book").length,
      lectures: selectedContents.filter((c) => c.contentType === "lecture").length,
      strategy: selectedContents.filter((c) => c.subjectType === "strategy").length,
      weakness: selectedContents.filter((c) => c.subjectType === "weakness").length,
    };
  }, [selectedContents]);

  // AI 생성 옵션 변경
  const handleGenerateAIChange = useCallback(
    (generate: boolean) => {
      updateData({ generateAIPlan: generate });
    },
    [updateData]
  );

  // AI 모드 변경
  const handleAIModeChange = useCallback(
    (mode: "hybrid" | "ai-only") => {
      updateData({ aiMode: mode });
    },
    [updateData]
  );

  // 단계로 이동
  const goToStep = (step: WizardStep) => {
    setStep(step);
  };

  return (
    <div className="space-y-6">
      {/* 검증 오류/경고 */}
      {(hasErrors || validationWarnings.length > 0) && (
        <div className="space-y-2">
          {validationErrors.map((error, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          ))}
          {validationWarnings.map((warning, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
              <p className="text-sm text-amber-700">{warning}</p>
            </div>
          ))}
        </div>
      )}

      {/* 학생 정보 */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4" data-testid="student-info-card">
        <p className="text-sm font-medium text-blue-800">
          <span className="font-bold" data-testid="student-name">{studentName}</span> 학생을 위한 플랜을 생성합니다.
        </p>
      </div>

      {/* 요약 카드들 */}
      <div className="space-y-4">
        {/* 기본 정보 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4" data-testid="basic-info-summary">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Calendar className="h-4 w-4" />
              기본 정보
            </h4>
            <button
              type="button"
              onClick={() => goToStep(1)}
              data-testid="edit-basic-info"
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              <Edit3 className="h-3 w-3" />
              수정
            </button>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">학습 기간</span>
              <span className="font-medium text-gray-900">
                {formatDate(periodStart)} ~ {formatDate(periodEnd)}
                <span className="ml-1 text-gray-500">({daysDiff}일)</span>
              </span>
            </div>
            {name && (
              <div className="flex justify-between">
                <span className="text-gray-500">플랜 이름</span>
                <span className="font-medium text-gray-900">{name}</span>
              </div>
            )}
            {planPurpose && (
              <div className="flex justify-between">
                <span className="text-gray-500">학습 목적</span>
                <span className="font-medium text-gray-900">{planPurpose}</span>
              </div>
            )}
            {blockSetId && (
              <div className="flex justify-between">
                <span className="text-gray-500">시간표</span>
                <span className="font-medium text-gray-900">블록셋 적용됨</span>
              </div>
            )}
          </div>
        </div>

        {/* 시간 설정 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4" data-testid="time-settings-summary">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Clock className="h-4 w-4" />
              시간 설정
            </h4>
            <button
              type="button"
              onClick={() => goToStep(2)}
              data-testid="edit-time-settings"
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              <Edit3 className="h-3 w-3" />
              수정
            </button>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">스케줄러 타입</span>
              <span className="font-medium text-gray-900">
                {schedulerType === "1730_timetable"
                  ? "1730 시간표"
                  : schedulerType === "custom"
                    ? "맞춤 설정"
                    : "기본"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="flex items-center gap-1 text-gray-500">
                <Building2 className="h-3 w-3" />
                학원 스케줄
              </span>
              <span className="font-medium text-gray-900">
                {academySchedules.length}개
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">제외 일정</span>
              <span className="font-medium text-gray-900">{exclusions.length}일</span>
            </div>
          </div>
        </div>

        {/* 콘텐츠 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4" data-testid="contents-summary">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <BookOpen className="h-4 w-4" />
              콘텐츠
              {skipContents && (
                <span className="ml-1 text-xs text-gray-400">(건너뛰기)</span>
              )}
            </h4>
            <button
              type="button"
              onClick={() => goToStep(4)}
              data-testid="edit-contents"
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              <Edit3 className="h-3 w-3" />
              수정
            </button>
          </div>
          {skipContents || selectedContents.length === 0 ? (
            <p className="text-sm text-gray-500">
              콘텐츠 없이 플랜 그룹을 생성합니다.
            </p>
          ) : (
            <>
              <div className="mb-3 grid grid-cols-4 gap-2">
                <div className="rounded bg-gray-50 p-2 text-center">
                  <p className="text-lg font-semibold text-gray-900">
                    {contentStats.total}
                  </p>
                  <p className="text-xs text-gray-500">전체</p>
                </div>
                <div className="rounded bg-gray-50 p-2 text-center">
                  <p className="text-lg font-semibold text-gray-900">
                    {contentStats.books}
                  </p>
                  <p className="text-xs text-gray-500">교재</p>
                </div>
                <div className="rounded bg-orange-50 p-2 text-center">
                  <p className="text-lg font-semibold text-orange-600">
                    {contentStats.strategy}
                  </p>
                  <p className="flex items-center justify-center gap-1 text-xs text-orange-600">
                    <Zap className="h-3 w-3" />
                    전략
                  </p>
                </div>
                <div className="rounded bg-blue-50 p-2 text-center">
                  <p className="text-lg font-semibold text-blue-600">
                    {contentStats.weakness}
                  </p>
                  <p className="flex items-center justify-center gap-1 text-xs text-blue-600">
                    <Target className="h-3 w-3" />
                    취약
                  </p>
                </div>
              </div>
              <ul className="max-h-32 space-y-1 overflow-y-auto">
                {selectedContents.map((content) => (
                  <li
                    key={content.contentId}
                    className="flex items-center gap-2 text-sm text-gray-600"
                  >
                    {content.contentType === "book" ? (
                      <BookOpen className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                    ) : (
                      <Video className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                    )}
                    <span className="truncate">{content.title}</span>
                    <span className="flex-shrink-0 text-gray-400">
                      ({content.startRange}-{content.endRange})
                    </span>
                    {content.subjectType && (
                      <span
                        className={cn(
                          "flex-shrink-0 rounded px-1 py-0.5 text-xs",
                          content.subjectType === "strategy"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-blue-100 text-blue-700"
                        )}
                      >
                        {content.subjectType === "strategy" ? "전략" : "취약"}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* 배분 설정 */}
        {!skipContents && selectedContents.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4" data-testid="allocation-summary">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Sliders className="h-4 w-4" />
                배분 설정
              </h4>
              <button
                type="button"
                onClick={() => goToStep(5)}
                data-testid="edit-allocation"
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
              >
                <Edit3 className="h-3 w-3" />
                수정
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">학생 레벨</span>
                <span className="font-medium text-gray-900">
                  {schedulerOptions.student_level === "high"
                    ? "상위권"
                    : schedulerOptions.student_level === "low"
                      ? "하위권"
                      : "중위권"}
                </span>
              </div>
              {contentStats.weakness > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">취약 과목 집중도</span>
                  <span className="font-medium text-gray-900">
                    {schedulerOptions.weak_subject_focus === "high"
                      ? "높음"
                      : schedulerOptions.weak_subject_focus === "low"
                        ? "낮음"
                        : "보통"}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">주간 학습일</span>
                <span className="font-medium text-gray-900">
                  {schedulerOptions.study_days || 5}일
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">복습 주기</span>
                <span className="font-medium text-gray-900">
                  {schedulerOptions.review_days || 2}일
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI 플랜 생성 옵션 */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-900">플랜 생성 방식</h4>

        {/* AI 생성 토글 */}
        <div
          className={cn(
            "rounded-lg border p-4 transition",
            generateAIPlan
              ? "border-purple-300 bg-purple-50"
              : "border-gray-200 bg-white"
          )}
          data-testid="ai-generate-option"
        >
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={generateAIPlan}
              onChange={(e) => handleGenerateAIChange(e.target.checked)}
              data-testid="ai-generate-checkbox"
              className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-gray-900">
                  AI 플랜 생성
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                플랜 그룹 생성 후 AI가 자동으로 학습 일정을 생성합니다.
              </p>
            </div>
          </label>
        </div>

        {/* AI 모드 선택 (AI 생성 활성화 시) */}
        {generateAIPlan && (
          <div className="ml-7 space-y-2" data-testid="ai-mode-options">
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 hover:border-gray-300">
              <input
                type="radio"
                name="aiMode"
                checked={aiMode !== "ai-only"}
                onChange={() => handleAIModeChange("hybrid")}
                data-testid="ai-mode-hybrid"
                className="h-4 w-4 border-gray-300 text-purple-600"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">하이브리드 모드</p>
                <p className="text-xs text-gray-500">
                  설정한 콘텐츠와 옵션을 기반으로 AI가 플랜 생성
                </p>
              </div>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 hover:border-gray-300">
              <input
                type="radio"
                name="aiMode"
                checked={aiMode === "ai-only"}
                onChange={() => handleAIModeChange("ai-only")}
                data-testid="ai-mode-ai-only"
                className="h-4 w-4 border-gray-300 text-purple-600"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">AI 전용 모드</p>
                <p className="text-xs text-gray-500">
                  AI가 학생 데이터를 분석하여 최적의 플랜 추천
                </p>
              </div>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
