"use client";

/**
 * Step 5: 배분 설정
 *
 * Phase 3: 7단계 위저드 확장
 * - 스케줄러 옵션 설정
 * - 학생 레벨 선택
 * - 취약 과목 집중도 설정
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step5AllocationSettings
 */

import { useCallback, useMemo } from "react";
import {
  Sliders,
  BarChart3,
  TrendingUp,
  Target,
  Info,
  Zap,
  BookOpen,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useAdminWizardData } from "../_context";
import type { SchedulerOptions, SubjectType } from "../_context/types";

/**
 * Step5AllocationSettings Props
 */
interface Step5AllocationSettingsProps {
  studentId: string;
}

const STUDENT_LEVELS = [
  { value: "high", label: "상위권", description: "심화 학습에 집중" },
  { value: "medium", label: "중위권", description: "균형 잡힌 학습" },
  { value: "low", label: "하위권", description: "기초 강화에 집중" },
] as const;

const WEAK_FOCUS_LEVELS = [
  { value: "low", label: "낮음", description: "10% 추가 배분" },
  { value: "medium", label: "보통", description: "25% 추가 배분" },
  { value: "high", label: "높음", description: "40% 추가 배분" },
] as const;

const STUDY_TYPE_OPTIONS = [
  {
    value: null,
    label: "선택 안함",
    description: "콘텐츠별 설정 사용",
    icon: BookOpen,
    color: "gray",
  },
  {
    value: "strategy",
    label: "전략 학습",
    description: "새로운 내용을 주도적으로 학습",
    icon: Zap,
    color: "orange",
  },
  {
    value: "weakness",
    label: "취약 보완",
    description: "부족한 부분 집중 보완",
    icon: AlertTriangle,
    color: "blue",
  },
] as const;

const STRATEGY_DAYS_OPTIONS = [
  { value: 2, label: "주 2일", description: "여유로운 페이스" },
  { value: 3, label: "주 3일", description: "균형 잡힌 페이스" },
  { value: 4, label: "주 4일", description: "집중 학습 페이스" },
] as const;

/**
 * Step 5: 배분 설정 컴포넌트
 */
export function Step5AllocationSettings({
  studentId,
}: Step5AllocationSettingsProps) {
  const { wizardData, updateData } = useAdminWizardData();

  const { schedulerOptions, selectedContents, skipContents, studyType, strategyDaysPerWeek } = wizardData;

  // 현재 설정 값
  const studentLevel = schedulerOptions.student_level || "medium";
  const weakSubjectFocus = schedulerOptions.weak_subject_focus || "medium";
  const studyDays = schedulerOptions.study_days || 5;
  const reviewDays = schedulerOptions.review_days || 2;

  // 플랜 그룹 학습 유형
  const handleStudyTypeChange = useCallback(
    (newStudyType: SubjectType) => {
      updateData({
        studyType: newStudyType,
        // strategy가 아닌 경우 strategyDaysPerWeek 초기화
        strategyDaysPerWeek: newStudyType === "strategy" ? (strategyDaysPerWeek ?? 3) : null,
      });
    },
    [updateData, strategyDaysPerWeek]
  );

  const handleStrategyDaysChange = useCallback(
    (days: 2 | 3 | 4) => {
      updateData({ strategyDaysPerWeek: days });
    },
    [updateData]
  );

  // 과목별 통계
  const contentStats = useMemo(() => {
    const subjects = new Map<string, { count: number; totalRange: number }>();

    for (const content of selectedContents) {
      const subject = content.subject || "기타";
      const current = subjects.get(subject) || { count: 0, totalRange: 0 };
      subjects.set(subject, {
        count: current.count + 1,
        totalRange: current.totalRange + (content.endRange - content.startRange + 1),
      });
    }

    return {
      totalContents: selectedContents.length,
      strategyCount: selectedContents.filter((c) => c.subjectType === "strategy").length,
      weaknessCount: selectedContents.filter((c) => c.subjectType === "weakness").length,
      subjectMap: subjects,
    };
  }, [selectedContents]);

  // 스케줄러 옵션 업데이트
  const handleUpdateOptions = useCallback(
    (updates: Partial<SchedulerOptions>) => {
      updateData({
        schedulerOptions: {
          ...schedulerOptions,
          ...updates,
        },
      });
    },
    [schedulerOptions, updateData]
  );

  // 콘텐츠가 없거나 건너뛴 경우
  if (skipContents || selectedContents.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
            <div>
              <p className="font-medium text-amber-800">콘텐츠가 선택되지 않았습니다</p>
              <p className="mt-1 text-sm text-amber-700">
                콘텐츠를 선택하지 않으면 기본 스케줄러 설정으로 플랜이 생성됩니다.
              </p>
            </div>
          </div>
        </div>

        {/* 기본 설정 */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-700">기본 스케줄러 설정</h3>

          {/* 학습일수 */}
          <div className="space-y-2">
            <label className="text-xs text-gray-600">주간 학습일수</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={7}
                value={studyDays}
                onChange={(e) =>
                  handleUpdateOptions({ study_days: Number(e.target.value) })
                }
                className="flex-1"
              />
              <span className="w-12 text-center text-sm font-medium text-gray-900">
                {studyDays}일
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 선택된 콘텐츠 요약 */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4" data-testid="content-summary">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
          <BarChart3 className="h-4 w-4" />
          선택된 콘텐츠 요약
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-white p-3 shadow-sm" data-testid="total-contents-stat">
            <p className="text-xs text-gray-500">전체 콘텐츠</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {contentStats.totalContents}개
            </p>
          </div>
          <div className="rounded-lg bg-white p-3 shadow-sm">
            <p className="flex items-center gap-1 text-xs text-orange-600">
              <Zap className="h-3 w-3" />
              전략 과목
            </p>
            <p className="mt-1 text-lg font-semibold text-orange-600">
              {contentStats.strategyCount}개
            </p>
          </div>
          <div className="rounded-lg bg-white p-3 shadow-sm">
            <p className="flex items-center gap-1 text-xs text-blue-600">
              <Target className="h-3 w-3" />
              취약 과목
            </p>
            <p className="mt-1 text-lg font-semibold text-blue-600">
              {contentStats.weaknessCount}개
            </p>
          </div>
        </div>
      </div>

      {/* 학생 레벨 선택 */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <TrendingUp className="h-4 w-4" />
          학생 학습 레벨
        </label>
        <div className="grid grid-cols-3 gap-3">
          {STUDENT_LEVELS.map((level) => (
            <button
              key={level.value}
              type="button"
              onClick={() => handleUpdateOptions({ student_level: level.value })}
              data-testid={`student-level-${level.value}`}
              className={cn(
                "flex flex-col items-start rounded-lg border p-3 text-left transition",
                studentLevel === level.value
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              )}
            >
              <span
                className={cn(
                  "text-sm font-medium",
                  studentLevel === level.value ? "text-blue-700" : "text-gray-900"
                )}
              >
                {level.label}
              </span>
              <span className="mt-0.5 text-xs text-gray-500">
                {level.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 취약 과목 집중도 */}
      {contentStats.weaknessCount > 0 && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Target className="h-4 w-4" />
            취약 과목 집중도
          </label>
          <div className="grid grid-cols-3 gap-3">
            {WEAK_FOCUS_LEVELS.map((level) => (
              <button
                key={level.value}
                type="button"
                onClick={() =>
                  handleUpdateOptions({ weak_subject_focus: level.value })
                }
                data-testid={`weak-focus-${level.value}`}
                className={cn(
                  "flex flex-col items-start rounded-lg border p-3 text-left transition",
                  weakSubjectFocus === level.value
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                )}
              >
                <span
                  className={cn(
                    "text-sm font-medium",
                    weakSubjectFocus === level.value
                      ? "text-blue-700"
                      : "text-gray-900"
                  )}
                >
                  {level.label}
                </span>
                <span className="mt-0.5 text-xs text-gray-500">
                  {level.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 플랜 그룹 학습 유형 */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <BookOpen className="h-4 w-4" />
          플랜 그룹 학습 유형
        </label>
        <p className="text-xs text-gray-500">
          플랜 그룹 전체에 적용될 학습 유형을 선택합니다. 선택하지 않으면 콘텐츠별 설정이 사용됩니다.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {STUDY_TYPE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = studyType === option.value;
            const colorClasses = {
              gray: {
                selected: "border-gray-500 bg-gray-50",
                text: "text-gray-700",
                icon: "text-gray-500",
              },
              orange: {
                selected: "border-orange-500 bg-orange-50",
                text: "text-orange-700",
                icon: "text-orange-500",
              },
              blue: {
                selected: "border-blue-500 bg-blue-50",
                text: "text-blue-700",
                icon: "text-blue-500",
              },
            };
            const colors = colorClasses[option.color];

            return (
              <button
                key={option.value ?? "null"}
                type="button"
                onClick={() => handleStudyTypeChange(option.value as SubjectType)}
                data-testid={`study-type-${option.value ?? "none"}`}
                className={cn(
                  "flex flex-col items-start rounded-lg border p-3 text-left transition",
                  isSelected
                    ? colors.selected
                    : "border-gray-200 bg-white hover:border-gray-300"
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", isSelected ? colors.icon : "text-gray-400")} />
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isSelected ? colors.text : "text-gray-900"
                    )}
                  >
                    {option.label}
                  </span>
                </div>
                <span className="mt-0.5 text-xs text-gray-500">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>

        {/* 전략 학습 선택 시 주간 학습일 설정 */}
        {studyType === "strategy" && (
          <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-4">
            <label className="flex items-center gap-2 text-sm font-medium text-orange-700">
              <Zap className="h-4 w-4" />
              전략 과목 주간 학습일
            </label>
            <p className="mt-1 text-xs text-orange-600">
              전략 과목을 일주일에 몇 일 학습할지 설정합니다.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {STRATEGY_DAYS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleStrategyDaysChange(option.value)}
                  data-testid={`strategy-days-${option.value}`}
                  className={cn(
                    "flex flex-col items-center rounded-lg border p-2 transition",
                    strategyDaysPerWeek === option.value
                      ? "border-orange-500 bg-white"
                      : "border-orange-200 bg-orange-50/50 hover:border-orange-300"
                  )}
                >
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      strategyDaysPerWeek === option.value
                        ? "text-orange-700"
                        : "text-orange-600"
                    )}
                  >
                    {option.label}
                  </span>
                  <span className="text-xs text-orange-500">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 학습 일수 설정 */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Sliders className="h-4 w-4" />
          주간 학습 일수
        </label>
        <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex-1">
            <p className="text-xs text-gray-500">학습일</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={7}
                value={studyDays}
                onChange={(e) =>
                  handleUpdateOptions({ study_days: Number(e.target.value) })
                }
                data-testid="study-days-slider"
                className="flex-1"
              />
              <span className="w-12 text-center text-sm font-semibold text-gray-900" data-testid="study-days-value">
                {studyDays}일
              </span>
            </div>
          </div>
          <div className="w-px self-stretch bg-gray-200" />
          <div className="flex-1">
            <p className="text-xs text-gray-500">복습 주기</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={7}
                value={reviewDays}
                onChange={(e) =>
                  handleUpdateOptions({ review_days: Number(e.target.value) })
                }
                data-testid="review-days-slider"
                className="flex-1"
              />
              <span className="w-12 text-center text-sm font-semibold text-gray-900" data-testid="review-days-value">
                {reviewDays}일
              </span>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          주 {studyDays}일 학습, {reviewDays}일 간격으로 복습 스케줄이 생성됩니다.
        </p>
      </div>

      {/* 안내 메시지 */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">배분 설정 안내</p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-blue-700">
            <li>
              학생 레벨에 따라 학습량과 난이도가 자동 조정됩니다.
            </li>
            <li>
              취약 과목 집중도가 높을수록 해당 콘텐츠에 더 많은 시간이 배분됩니다.
            </li>
            <li>
              복습 주기를 설정하면 정해진 간격으로 복습 플랜이 추가됩니다.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
