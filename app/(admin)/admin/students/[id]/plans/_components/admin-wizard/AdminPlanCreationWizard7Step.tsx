"use client";

/**
 * AdminPlanCreationWizard7Step - 7단계 플랜 생성 위저드
 *
 * Phase 3: 7단계 위저드 확장
 * - 4-Layer Context 패턴 사용
 * - 7개 Step 컴포넌트 통합
 * - 자동 저장 지원
 * - 에러 바운더리 적용
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/admin-wizard/AdminPlanCreationWizard7Step
 */

import { useEffect, useCallback, useMemo, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  AdminWizardProvider,
  useAdminWizardData,
  useAdminWizardStep,
  useAdminWizardValidation,
} from "./_context";
import type { AdminPlanCreationWizardProps, WizardStep } from "./_context/types";
import { AdminStepErrorBoundary } from "./common/AdminStepErrorBoundary";
import { AutoSaveIndicator } from "./common/AutoSaveIndicator";
import { useAdminAutoSave } from "./hooks/useAdminAutoSave";

// Step 컴포넌트 import
import { Step1BasicInfo } from "./steps/Step1BasicInfo";
import { Step2TimeSettings } from "./steps/Step2TimeSettings";
import { Step3SchedulePreview } from "./steps/Step3SchedulePreview";
import { Step4ContentSelection } from "./steps/Step4ContentSelection";
import { Step5AllocationSettings } from "./steps/Step5AllocationSettings";
import { Step6FinalReview } from "./steps/Step6FinalReview";
import { Step7GenerateResult } from "./steps/Step7GenerateResult";

// Server action import
import { createPlanGroupAction } from "@/lib/domains/plan/actions/plan-groups/create";
import { updatePlanGroupDraftAction } from "@/lib/domains/plan/actions/plan-groups/update";
import type { PlanGroupCreationData } from "@/lib/types/plan";
import { getPlannerAction } from "@/lib/domains/admin-plan/actions";
import type { ExclusionSchedule, AcademySchedule } from "./_context/types";

// ============================================
// 상수
// ============================================

const STEP_TITLES: Record<WizardStep, string> = {
  1: "기본 정보",
  2: "시간 설정",
  3: "스케줄 미리보기",
  4: "콘텐츠 선택",
  5: "배분 설정",
  6: "최종 검토",
  7: "생성 및 결과",
};

const STEP_DESCRIPTIONS: Record<WizardStep, string> = {
  1: "플랜 이름, 기간, 목적을 설정합니다",
  2: "학원 스케줄과 제외 일정을 설정합니다",
  3: "생성될 스케줄을 미리 확인합니다",
  4: "학습할 콘텐츠를 선택합니다",
  5: "콘텐츠 배분 방식을 설정합니다",
  6: "최종 설정을 검토합니다",
  7: "플랜을 생성합니다",
};

// ============================================
// 내부 위저드 컴포넌트
// ============================================

interface WizardInnerProps {
  studentId: string;
  tenantId: string;
  studentName: string;
  /** 플래너 ID (플랜 그룹 생성 시 연결) */
  plannerId?: string;
  onClose: () => void;
  onSuccess: (groupId: string, generateAI: boolean) => void;
}

function WizardInner({
  studentId,
  tenantId,
  studentName,
  plannerId,
  onClose,
  onSuccess,
}: WizardInnerProps) {
  const {
    wizardData,
    isSubmitting,
    error,
    draftGroupId,
    createdGroupId,
    isDirty,
    setSubmitting,
    setError,
    setDraftId,
    setCreatedGroupId,
    resetDirtyState,
    updateData,
  } = useAdminWizardData();

  const { currentStep, totalSteps, nextStep, prevStep, canGoNext, canGoPrev } =
    useAdminWizardStep();

  const { hasErrors, validationErrors, clearValidation } = useAdminWizardValidation();

  // ============================================
  // 플래너 자동 로드 (plannerId가 제공된 경우)
  // ============================================

  const plannerLoadedRef = useRef(false);
  const [isPlannerLoading, setIsPlannerLoading] = useState(false);

  useEffect(() => {
    if (!plannerId || plannerLoadedRef.current) return;

    const plannerIdToLoad = plannerId; // TypeScript closure를 위해 변수에 저장

    async function loadPlannerData() {
      setIsPlannerLoading(true);
      try {
        const planner = await getPlannerAction(plannerIdToLoad, true);
        if (!planner) {
          console.warn("[WizardInner] 플래너를 찾을 수 없음:", plannerIdToLoad);
          setIsPlannerLoading(false);
          return;
        }

        // 플래너 설정을 wizardData에 자동 채우기
        const autoFillData: Partial<typeof wizardData> = {
          plannerId: plannerIdToLoad,
          periodStart: planner.periodStart,
          periodEnd: planner.periodEnd,
          blockSetId: planner.blockSetId ?? undefined,
          studyHours: planner.studyHours ?? null,
          selfStudyHours: planner.selfStudyHours ?? null,
          lunchTime: planner.lunchTime ?? null,
          nonStudyTimeBlocks: planner.nonStudyTimeBlocks ?? [],
        };

        // 스케줄러 타입 자동 채우기
        if (planner.defaultSchedulerType) {
          autoFillData.schedulerType = planner.defaultSchedulerType as "1730_timetable" | "custom" | "";
        }

        // 제외일 매핑
        if (planner.exclusions && planner.exclusions.length > 0) {
          const mapExclusionType = (type: string): "holiday" | "event" | "personal" => {
            switch (type) {
              case "휴일지정": return "holiday";
              case "개인사정": return "personal";
              default: return "event";
            }
          };
          const plannerExclusions: ExclusionSchedule[] = planner.exclusions.map((e) => ({
            exclusion_date: e.exclusionDate,
            exclusion_type: mapExclusionType(e.exclusionType),
            reason: e.reason ?? undefined,
            source: "planner",
            is_locked: true,
          }));
          autoFillData.exclusions = plannerExclusions;
        }

        // 학원 일정 매핑
        if (planner.academySchedules && planner.academySchedules.length > 0) {
          const plannerAcademySchedules: AcademySchedule[] = planner.academySchedules.map((s) => ({
            academy_name: s.academyName ?? "학원",
            day_of_week: s.dayOfWeek,
            start_time: s.startTime,
            end_time: s.endTime,
            subject: s.subject ?? undefined,
            travel_time: s.travelTime ?? 60,
            source: "planner",
            is_locked: true,
          }));
          autoFillData.academySchedules = plannerAcademySchedules;
        }

        // 스케줄러 옵션
        if (planner.defaultSchedulerOptions) {
          const opts = planner.defaultSchedulerOptions as Record<string, number>;
          autoFillData.schedulerOptions = {
            study_days: opts.study_days ?? 6,
            review_days: opts.review_days ?? 1,
          };
        }

        updateData(autoFillData);
        plannerLoadedRef.current = true;
        console.log("[WizardInner] 플래너 데이터 자동 로드 완료:", plannerIdToLoad);
      } catch (err) {
        console.error("[WizardInner] 플래너 로드 실패:", err);
      } finally {
        setIsPlannerLoading(false);
      }
    }

    loadPlannerData();
  }, [plannerId, updateData]);

  // ============================================
  // 자동 저장
  // ============================================

  const handleAutoSave = useCallback(async () => {
    try {
      const {
        name,
        planPurpose,
        periodStart,
        periodEnd,
        selectedContents,
        skipContents,
        exclusions,
        academySchedules,
        schedulerType,
        blockSetId,
        schedulerOptions,
      } = wizardData;

      // 최소 기간 정보가 없으면 저장하지 않음
      if (!periodStart || !periodEnd) {
        console.log("[AutoSave] 기간 정보 없음, 저장 스킵");
        return;
      }

      // content_allocations 생성
      const contentAllocations = skipContents
        ? []
        : selectedContents
            .filter((c) => c.subjectType !== null)
            .map((c) => ({
              content_type: c.contentType as "book" | "lecture",
              content_id: c.contentId,
              subject_type: c.subjectType as "strategy" | "weakness",
              weekly_days: c.subjectType === "strategy" && c.weeklyDays ? c.weeklyDays : undefined,
            }));

      // schedulerOptions에 content_allocations 병합
      const enhancedSchedulerOptions = {
        ...schedulerOptions,
        content_allocations: contentAllocations.length > 0 ? contentAllocations : undefined,
      };

      // PlanGroupCreationData 구성
      const planGroupData: Partial<PlanGroupCreationData> = {
        name: name || `Draft-${new Date().toISOString().split("T")[0]}`,
        plan_purpose: (planPurpose as "내신대비" | "모의고사" | "수능" | "") || "내신대비",
        scheduler_type: schedulerType === "custom" ? "1730_timetable" : (schedulerType || "1730_timetable"),
        period_start: periodStart,
        period_end: periodEnd,
        block_set_id: blockSetId || null,
        planner_id: plannerId || null,
        scheduler_options: enhancedSchedulerOptions,
        contents: skipContents
          ? []
          : selectedContents.map((c, index) => ({
              content_type: c.contentType as "book" | "lecture",
              content_id: c.contentId,
              master_content_id: null,
              start_range: c.startRange,
              end_range: c.endRange,
              start_detail_id: null,
              end_detail_id: null,
              display_order: index,
            })),
        exclusions: exclusions.map((e) => ({
          exclusion_date: e.exclusion_date,
          exclusion_type: e.exclusion_type === "holiday" ? "휴일지정"
            : e.exclusion_type === "personal" ? "개인사정"
            : "기타" as const,
          reason: e.reason || undefined,
        })),
        academy_schedules: academySchedules.map((s) => ({
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          academy_name: s.academy_name || undefined,
          subject: s.subject || undefined,
        })),
      };

      if (draftGroupId) {
        // 기존 draft 업데이트
        console.log("[AutoSave] draft 업데이트:", draftGroupId);
        await updatePlanGroupDraftAction(draftGroupId, planGroupData);
      } else {
        // 새 draft 생성
        console.log("[AutoSave] 새 draft 생성");
        const result = await createPlanGroupAction(planGroupData as PlanGroupCreationData, {
          skipContentValidation: true,
          studentId: studentId,
        });

        // 성공 시 draftId 저장
        if ("groupId" in result && result.groupId) {
          console.log("[AutoSave] draft 생성 완료:", result.groupId);
          setDraftId(result.groupId);
        }
      }

      resetDirtyState();
    } catch (err) {
      console.error("[AutoSave] 자동저장 실패:", err);
      // 자동저장 실패는 무시 (사용자에게 에러 표시하지 않음)
    }
  }, [wizardData, draftGroupId, studentId, plannerId, setDraftId, resetDirtyState]);

  const { status: autoSaveStatus, lastSavedAt } = useAdminAutoSave({
    data: wizardData,
    initialData: null,
    draftGroupId: draftGroupId,
    saveFn: handleAutoSave,
    options: { enabled: isDirty && !isSubmitting },
  });

  // ============================================
  // ESC 키 핸들러
  // ============================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isSubmitting]);

  // ============================================
  // Step 유효성 검사
  // ============================================

  const isStepValid = useMemo(() => {
    const { periodStart, periodEnd, selectedContents, skipContents } = wizardData;

    switch (currentStep) {
      case 1: {
        // 기본 정보: 기간 필수
        if (!periodStart || !periodEnd) return false;
        const start = new Date(periodStart);
        const end = new Date(periodEnd);
        const diff = Math.ceil(
          (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        );
        return diff > 0 && diff <= 365;
      }
      case 2:
        // 시간 설정: 항상 valid (선택사항)
        return true;
      case 3:
        // 스케줄 미리보기: 항상 valid (확인용)
        return true;
      case 4:
        // 콘텐츠 선택: skipContents이거나 콘텐츠 선택됨
        return skipContents || selectedContents.length > 0;
      case 5:
        // 배분 설정: 항상 valid
        return true;
      case 6:
        // 최종 검토: 항상 valid
        return true;
      case 7:
        // 생성 단계: 별도 검증
        return true;
      default:
        return true;
    }
  }, [currentStep, wizardData]);

  // ============================================
  // 다음 단계로 이동
  // ============================================

  const handleNext = useCallback(() => {
    if (!isStepValid) {
      setError("필수 정보를 확인해주세요.");
      return;
    }
    clearValidation();
    nextStep();
  }, [isStepValid, setError, clearValidation, nextStep]);

  // ============================================
  // 제출 핸들러
  // ============================================

  const handleSubmit = useCallback(async () => {
    if (hasErrors) {
      setError("입력 값에 오류가 있습니다. 이전 단계를 확인해주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const {
        name,
        planPurpose,
        periodStart,
        periodEnd,
        selectedContents,
        skipContents,
        exclusions,
        academySchedules,
        schedulerType,
        blockSetId,
        schedulerOptions,
        // 플래너에서 상속된 시간 설정
        studyHours,
        selfStudyHours,
        lunchTime,
        nonStudyTimeBlocks,
      } = wizardData;

      // content_allocations 생성
      const contentAllocations = skipContents
        ? []
        : selectedContents
            .filter((c) => c.subjectType !== null)
            .map((c) => ({
              content_type: c.contentType as "book" | "lecture",
              content_id: c.contentId,
              subject_type: c.subjectType as "strategy" | "weakness",
              weekly_days: c.subjectType === "strategy" && c.weeklyDays ? c.weeklyDays : undefined,
            }));

      // schedulerOptions에 content_allocations 병합
      const enhancedSchedulerOptions = {
        ...schedulerOptions,
        content_allocations: contentAllocations.length > 0 ? contentAllocations : undefined,
      };

      // PlanGroupCreationData 구성
      const planGroupData: PlanGroupCreationData = {
        name: name || null,
        plan_purpose: (planPurpose as "내신대비" | "모의고사" | "수능" | "") || "내신대비",
        scheduler_type: schedulerType === "custom" ? "1730_timetable" : (schedulerType || "1730_timetable"),
        period_start: periodStart,
        period_end: periodEnd,
        block_set_id: blockSetId || null,
        planner_id: plannerId || null,
        scheduler_options: enhancedSchedulerOptions,
        contents: skipContents
          ? []
          : selectedContents.map((c, index) => ({
              content_type: c.contentType as "book" | "lecture",
              content_id: c.contentId,
              master_content_id: null,
              start_range: c.startRange,
              end_range: c.endRange,
              start_detail_id: null,
              end_detail_id: null,
              display_order: index,
            })),
        exclusions: exclusions.map((e) => ({
          exclusion_date: e.exclusion_date,
          exclusion_type: e.exclusion_type === "holiday" ? "휴일지정"
            : e.exclusion_type === "personal" ? "개인사정"
            : "기타" as const,
          reason: e.reason || undefined,
        })),
        academy_schedules: academySchedules.map((s) => ({
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          academy_name: s.academy_name || undefined,
          subject: s.subject || undefined,
        })),
        // 플래너에서 상속된 시간 설정 (플래너 선택 시 자동 채워짐)
        study_hours: studyHours || null,
        self_study_hours: selfStudyHours || null,
        lunch_time: lunchTime || null,
        non_study_time_blocks: nonStudyTimeBlocks || null,
      };

      let groupId: string;

      if (draftGroupId) {
        // 기존 draft가 있으면 업데이트
        console.log("[AdminWizard] 기존 draft 업데이트:", draftGroupId);
        await updatePlanGroupDraftAction(draftGroupId, planGroupData);
        groupId = draftGroupId;
      } else {
        // 새 플랜 그룹 생성
        const result = await createPlanGroupAction(planGroupData, {
          skipContentValidation: true,
          studentId: studentId,
        });

        // 에러 확인
        if ("success" in result && result.success === false) {
          setError(result.error?.message || "플랜 그룹 생성에 실패했습니다.");
          setSubmitting(false);
          return;
        }

        groupId = (result as { groupId: string }).groupId;
      }

      // 성공 시
      setCreatedGroupId(groupId);
      setSubmitting(false);
      onSuccess(groupId, wizardData.generateAIPlan);
    } catch (err) {
      console.error("[AdminWizard] 생성 실패:", err);
      setError("플랜 그룹 생성 중 오류가 발생했습니다.");
      setSubmitting(false);
    }
  }, [
    hasErrors,
    wizardData,
    studentId,
    plannerId,
    draftGroupId,
    setSubmitting,
    setError,
    setCreatedGroupId,
    onSuccess,
  ]);

  // ============================================
  // Step 컴포넌트 렌더링
  // ============================================

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1BasicInfo studentId={studentId} error={error} />;
      case 2:
        return <Step2TimeSettings studentId={studentId} />;
      case 3:
        return <Step3SchedulePreview studentId={studentId} />;
      case 4:
        return <Step4ContentSelection studentId={studentId} tenantId={tenantId} />;
      case 5:
        return <Step5AllocationSettings studentId={studentId} />;
      case 6:
        return <Step6FinalReview studentName={studentName} />;
      case 7:
        return (
          <Step7GenerateResult
            studentId={studentId}
            tenantId={tenantId}
            studentName={studentName}
            onSubmit={handleSubmit}
            onSuccess={onSuccess}
            onClose={onClose}
          />
        );
      default:
        return null;
    }
  };

  // ============================================
  // 렌더링
  // ============================================

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="admin-wizard">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl" data-testid="admin-wizard-modal">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              플랜 그룹 생성
            </h2>
            <p className="text-sm text-gray-500">{studentName}</p>
          </div>
          <div className="flex items-center gap-3">
            <AutoSaveIndicator status={autoSaveStatus} lastSavedAt={lastSavedAt} />
            <button
              onClick={onClose}
              disabled={isSubmitting}
              data-testid="cancel-button"
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 스텝 인디케이터 */}
        <div className="flex items-center justify-center gap-1 border-b border-gray-100 px-6 py-3" data-testid="step-indicator">
          {([1, 2, 3, 4, 5, 6, 7] as WizardStep[]).map((step) => (
            <div key={step} className="flex items-center">
              <div
                data-step={step}
                data-completed={currentStep > step}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition",
                  currentStep === step
                    ? "bg-blue-600 text-white"
                    : currentStep > step
                      ? "bg-blue-100 text-blue-600"
                      : "bg-gray-100 text-gray-400"
                )}
              >
                {currentStep > step ? (
                  <Check className="h-4 w-4" />
                ) : (
                  step
                )}
              </div>
              {step < 7 && (
                <div
                  className={cn(
                    "mx-1 h-0.5 w-4 transition",
                    currentStep > step ? "bg-blue-300" : "bg-gray-200"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* 스텝 제목 */}
        <div className="px-6 py-2 text-center">
          <span className="text-sm font-medium text-gray-700">
            {STEP_TITLES[currentStep]}
          </span>
          <p className="text-xs text-gray-500">
            {STEP_DESCRIPTIONS[currentStep]}
          </p>
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <AdminStepErrorBoundary stepName={STEP_TITLES[currentStep]}>
            {renderStep()}
          </AdminStepErrorBoundary>
        </div>

        {/* 에러 메시지 (글로벌) */}
        {error && currentStep !== 7 && (
          <div className="mx-6 mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* 네비게이션 (Step 7 제외) */}
        {currentStep < 7 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={prevStep}
              disabled={!canGoPrev || isSubmitting}
              data-testid="prev-button"
              className={cn(
                "flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium transition",
                !canGoPrev || isSubmitting
                  ? "cursor-not-allowed text-gray-300"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <ChevronLeft className="h-4 w-4" />
              이전
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!isStepValid || isSubmitting}
              data-testid="next-button"
              className={cn(
                "flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium transition",
                !isStepValid || isSubmitting
                  ? "cursor-not-allowed bg-gray-300 text-gray-500"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              )}
            >
              다음
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// 메인 컴포넌트 (Provider 래핑)
// ============================================

export function AdminPlanCreationWizard7Step({
  studentId,
  tenantId,
  studentName,
  plannerId,
  onClose,
  onSuccess,
}: AdminPlanCreationWizardProps) {
  // plannerId가 제공되면 initialData로 전달하고, Step 2부터 시작
  const initialData = plannerId ? { plannerId } : undefined;
  const initialStep = plannerId ? 2 : 1;

  return (
    <AdminWizardProvider initialData={initialData} initialStep={initialStep}>
      <WizardInner
        studentId={studentId}
        tenantId={tenantId}
        studentName={studentName}
        plannerId={plannerId}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </AdminWizardProvider>
  );
}
