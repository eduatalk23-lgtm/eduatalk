"use client";

/**
 * AddContentWizard - 기존 캘린더(플랜 그룹)에 콘텐츠 추가 위저드
 *
 * 캘린더 전용(is_calendar_only=true) 또는 콘텐츠가 없는 플랜 그룹에
 * 콘텐츠를 추가하고 플랜을 생성하는 4단계 위저드
 */

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import type { PlanGroup, PlanExclusion, AcademySchedule, RangeUnit } from "@/lib/types/plan";
import { addContentToExistingPlanGroup } from "@/lib/domains/plan/actions";
import type { AddContentToCalendarOnlyInput } from "@/lib/domains/plan/actions";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";

import { ContentSelectionStep } from "@/app/(student)/plan/content-add/[templateId]/_components/ContentSelectionStep";
import { RangeSettingStep } from "@/app/(student)/plan/content-add/[templateId]/_components/RangeSettingStep";
import { StudyTypeStep } from "@/app/(student)/plan/content-add/[templateId]/_components/StudyTypeStep";

// ============================================
// 타입 정의
// ============================================

interface WizardData {
  content: {
    id: string;
    type: "book" | "lecture" | "custom";
    name: string;
    totalUnits?: number;
    subject?: string;
    subjectCategory?: string;
    masterContentId?: string;
  } | null;
  range: {
    start: number;
    end: number;
    unit: RangeUnit;
  } | null;
  studyType: {
    type: "strategy" | "weakness";
    daysPerWeek?: 2 | 3 | 4;
    reviewEnabled?: boolean;
  } | null;
}

interface AddContentWizardProps {
  groupId: string;
  group: PlanGroup;
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
}

const STEPS = [
  { id: "content-selection", title: "콘텐츠 선택" },
  { id: "range-setting", title: "범위 설정" },
  { id: "study-type", title: "학습 유형" },
  { id: "preview", title: "확인" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

// ============================================
// 메인 컴포넌트
// ============================================

export function AddContentWizard({
  groupId,
  group,
  exclusions,
  academySchedules,
}: AddContentWizardProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 위저드 상태
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [data, setData] = useState<WizardData>({
    content: null,
    range: null,
    studyType: null,
  });

  const currentStep = STEPS[currentStepIndex];

  // 데이터 업데이트
  const updateData = useCallback((updates: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

  // 다음 스텝
  const nextStep = useCallback(() => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [currentStepIndex]);

  // 이전 스텝
  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  // 콘텐츠 선택
  const handleContentSelect = useCallback(
    (content: WizardData["content"]) => {
      if (content) {
        updateData({ content });
        nextStep();
      }
    },
    [updateData, nextStep]
  );

  // 범위 설정
  const handleRangeSet = useCallback(
    (range: WizardData["range"]) => {
      if (range) {
        updateData({ range });
        nextStep();
      }
    },
    [updateData, nextStep]
  );

  // 학습 유형 선택
  const handleStudyTypeSelect = useCallback(
    (studyType: WizardData["studyType"]) => {
      if (studyType) {
        updateData({ studyType });
        nextStep();
      }
    },
    [updateData, nextStep]
  );

  // 플랜 생성
  const handleCreate = useCallback(() => {
    if (!data.content || !data.range || !data.studyType) {
      showError("모든 정보를 입력해주세요.");
      return;
    }

    const input: AddContentToCalendarOnlyInput = {
      planGroupId: groupId,
      content: {
        id: data.content.id,
        type: data.content.type,
        name: data.content.name,
        totalUnits: data.content.totalUnits,
        subject: data.content.subject,
        subjectCategory: data.content.subjectCategory,
        masterContentId: data.content.masterContentId,
      },
      range: data.range,
      studyType: data.studyType,
    };

    startTransition(async () => {
      setIsSubmitting(true);
      try {
        const result = await addContentToExistingPlanGroup(input);

        if (result.success) {
          showSuccess(
            `${result.summary?.totalPlans || 0}개의 플랜이 생성되었습니다!`
          );
          router.push(`/plan/group/${groupId}`);
        } else {
          showError(result.error ?? "플랜 생성에 실패했습니다.");
        }
      } catch (error) {
        console.error("[AddContentWizard] 플랜 생성 실패:", error);
        showError(
          error instanceof Error ? error.message : "플랜 생성에 실패했습니다."
        );
      } finally {
        setIsSubmitting(false);
      }
    });
  }, [data, groupId, router, showSuccess, showError]);

  // 프로그레스 바
  const renderProgress = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;

          return (
            <div key={step.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    isCompleted
                      ? "bg-green-600 text-white"
                      : isCurrent
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                <span
                  className={`mt-2 text-xs font-medium ${
                    isCurrent ? "text-blue-600" : "text-gray-500"
                  }`}
                >
                  {step.title}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`mx-2 h-0.5 flex-1 ${
                    isCompleted ? "bg-green-600" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // 미리보기 단계 렌더링
  const renderPreviewStep = () => {
    if (!data.content || !data.range || !data.studyType) {
      return null;
    }

    const studyTypeLabels = {
      strategy: "전략 학습",
      weakness: "취약점 보완",
    };

    const unitLabels: Record<RangeUnit, string> = {
      page: "페이지",
      chapter: "챕터",
      episode: "회차",
      unit: "단원",
      day: "일차",
    };

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">플랜 생성 확인</h2>
          <p className="mt-1 text-sm text-gray-600">
            입력한 정보를 확인하고 플랜을 생성합니다.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">요약</h3>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">콘텐츠</dt>
              <dd className="mt-1 text-base font-semibold text-gray-900">
                {data.content.name}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">학습 범위</dt>
              <dd className="mt-1 text-base font-semibold text-gray-900">
                {data.range.start} ~ {data.range.end}{" "}
                {unitLabels[data.range.unit]}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">학습 유형</dt>
              <dd className="mt-1 text-base font-semibold text-gray-900">
                {studyTypeLabels[data.studyType.type]}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">학습 기간</dt>
              <dd className="mt-1 text-base font-semibold text-gray-900">
                {group.period_start && group.period_end
                  ? `${new Date(group.period_start).toLocaleDateString("ko-KR")} ~ ${new Date(group.period_end).toLocaleDateString("ko-KR")}`
                  : "미설정"}
              </dd>
            </div>
          </dl>
        </div>

        {/* 제외일 정보 */}
        {exclusions.length > 0 && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-sm text-yellow-800">
              <strong>참고:</strong> {exclusions.length}개의 제외일이
              설정되어 있습니다. 해당 날짜에는 플랜이 생성되지 않습니다.
            </p>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex justify-between">
          <button
            type="button"
            onClick={prevStep}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            이전
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isPending || isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending || isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                생성 중...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                플랜 생성
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 프로그레스 */}
      {renderProgress()}

      {/* 스텝 내용 */}
      <div className="min-h-[400px]">
        {currentStep.id === "content-selection" && (
          <ContentSelectionStep
            onSelect={handleContentSelect}
            selectedContent={data.content}
          />
        )}
        {currentStep.id === "range-setting" && data.content && (
          <RangeSettingStep
            content={data.content}
            onSet={handleRangeSet}
            onBack={prevStep}
            selectedRange={data.range}
          />
        )}
        {currentStep.id === "study-type" && (
          <StudyTypeStep
            onSelect={handleStudyTypeSelect}
            onBack={prevStep}
            selectedStudyType={data.studyType}
          />
        )}
        {currentStep.id === "preview" && renderPreviewStep()}
      </div>
    </div>
  );
}
