"use client";

/**
 * 레거시 PlanWizardContext 어댑터
 *
 * 기존 PlanWizardContext API를 UnifiedWizardProvider에서 사용할 수 있도록 브릿지 제공
 * 점진적 마이그레이션을 위해 기존 코드 호환성 유지
 *
 * @module lib/wizard/adapters/planWizardAdapter
 */

import { useCallback, useMemo } from "react";
import { useWizard } from "../UnifiedWizardContext";
import type { FullWizardData, FieldError, ValidationResult, WizardContextValue } from "../types";
import type { WizardData as LegacyWizardData } from "@/lib/schemas/planWizardSchema";
import { getStepsForMode } from "../stepDefinitions";

// ============================================
// 타입 정의
// ============================================

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface LegacyPlanWizardState {
  wizardData: LegacyWizardData;
  currentStep: WizardStep;
  validationErrors: string[];
  validationWarnings: string[];
  fieldErrors: Map<string, string>;
  draftGroupId: string | null;
  isSubmitting: boolean;
}

export interface LegacyPlanWizardActions {
  updateData: (updates: Partial<LegacyWizardData>) => void;
  updateDataFn: (updater: (prev: LegacyWizardData) => Partial<LegacyWizardData>) => void;
  nextStep: () => void;
  prevStep: () => void;
  setStep: (step: WizardStep) => void;
  setErrors: (errors: string[]) => void;
  setWarnings: (warnings: string[]) => void;
  setFieldError: (field: string, message: string) => void;
  clearFieldError: (field: string) => void;
  clearValidation: () => void;
  setDraftId: (id: string | null) => void;
  setSubmitting: (value: boolean) => void;
  isDirty: boolean;
  resetDirtyState: () => void;
  initialWizardData: LegacyWizardData;
}

export interface LegacyPlanWizardBridge extends LegacyPlanWizardActions {
  state: LegacyPlanWizardState;
}

// ============================================
// 데이터 변환 유틸리티
// ============================================

/**
 * FullWizardData를 LegacyWizardData로 변환
 */
export function unifiedToLegacy(data: FullWizardData): LegacyWizardData {
  return {
    name: data.basicInfo.name,
    plan_purpose: data.basicInfo.planPurpose,
    scheduler_type: data.basicInfo.schedulerType,
    scheduler_options: data.options.studyReviewCycle
      ? {
          study_days: data.options.studyReviewCycle.studyDays,
          review_days: data.options.studyReviewCycle.reviewDays,
        }
      : undefined,
    period_start: data.basicInfo.periodStart,
    period_end: data.basicInfo.periodEnd,
    target_date: data.basicInfo.targetDate,
    block_set_id: data.basicInfo.blockSetId,
    exclusions: data.schedule.exclusions.map((e) => ({
      exclusion_date: e.exclusion_date,
      exclusion_type: (e.exclusion_type === "holiday"
        ? "휴일지정"
        : e.exclusion_type === "vacation"
          ? "휴가"
          : e.exclusion_type === "custom"
            ? "개인사정"
            : "기타") as "휴가" | "개인사정" | "휴일지정" | "기타",
      reason: e.reason,
      source: e.source as "template" | "student" | "time_management" | undefined,
      is_locked: e.is_locked,
    })),
    academy_schedules: data.schedule.academySchedules.map((a) => ({
      day_of_week: a.day_of_week,
      start_time: a.start_time,
      end_time: a.end_time,
      academy_name: a.academy_name,
      subject: a.subject,
      travel_time: a.travel_time,
      source: a.source as "template" | "student" | "time_management" | undefined,
      is_locked: a.is_locked,
    })),
    time_settings: data.schedule.timeSettings
      ? {
          lunch_time: data.schedule.timeSettings.lunch_time
            ? { start: "12:00", end: "13:00" }
            : undefined,
          camp_study_hours: data.schedule.timeSettings.camp_study_hours
            ? { start: "10:00", end: "19:00" }
            : undefined,
        }
      : undefined,
    student_contents: data.contents.studentContents.map((c) => ({
      content_type: c.type,
      content_id: c.id,
      start_range: c.rangeStart || 1,
      end_range: c.rangeEnd || 1,
      title: c.name,
      subject_category: c.subjectCategory,
      subject: c.subject,
    })),
    recommended_contents: data.contents.recommendedContents.map((c) => ({
      content_type: c.type,
      content_id: c.id,
      start_range: c.rangeStart || 1,
      end_range: c.rangeEnd || 1,
      title: c.name,
      subject_category: c.subjectCategory,
      subject: c.subject,
      is_auto_recommended: c.isRecommended,
    })),
    study_review_cycle: data.options.studyReviewCycle
      ? {
          study_days: data.options.studyReviewCycle.studyDays,
          review_days: data.options.studyReviewCycle.reviewDays,
        }
      : undefined,
    student_level: data.options.studentLevel,
    plan_type: data.templateConfig?.planType as "individual" | "integrated" | "camp" | undefined,
    camp_template_id: data.templateConfig?.campTemplateId,
    camp_invitation_id: data.templateConfig?.campInvitationId,
  };
}

/**
 * LegacyWizardData를 FullWizardData로 변환
 */
export function legacyToUnified(
  data: LegacyWizardData,
  currentStepId: string = "basic-info"
): FullWizardData {
  const now = new Date().toISOString();

  return {
    mode: data.plan_type === "camp" ? "template" : "full",
    currentStepId,
    visitedSteps: [currentStepId],
    meta: {
      createdAt: now,
      updatedAt: now,
      isDirty: false,
    },
    basicInfo: {
      name: data.name || "",
      planPurpose: data.plan_purpose || "",
      periodStart: data.period_start || "",
      periodEnd: data.period_end || "",
      targetDate: data.target_date,
      blockSetId: data.block_set_id || "",
      schedulerType: data.scheduler_type || "",
    },
    schedule: {
      exclusions: (data.exclusions || []).map((e) => ({
        exclusion_date: e.exclusion_date,
        exclusion_type: (e.exclusion_type === "휴일지정"
          ? "holiday"
          : e.exclusion_type === "휴가"
            ? "vacation"
            : e.exclusion_type === "개인사정"
              ? "custom"
              : "custom") as "holiday" | "vacation" | "custom" | "temple",
        reason: e.reason,
        source: e.source as "user" | "system" | "admin" | "template" | undefined,
        is_locked: e.is_locked,
      })),
      academySchedules: (data.academy_schedules || []).map((a) => ({
        day_of_week: a.day_of_week,
        start_time: a.start_time,
        end_time: a.end_time,
        academy_name: a.academy_name,
        subject: a.subject,
        travel_time: a.travel_time,
        source: a.source as "user" | "system" | "admin" | "template" | undefined,
        is_locked: a.is_locked,
      })),
      timeSettings: data.time_settings
        ? {
            lunch_time: data.time_settings.lunch_time?.start,
            camp_study_hours: data.time_settings.camp_study_hours ? 9 : undefined,
            morning_start: data.time_settings.camp_study_hours?.start,
            evening_end: data.time_settings.camp_study_hours?.end,
          }
        : undefined,
    },
    contents: {
      studentContents: (data.student_contents || []).map((c) => ({
        id: c.content_id,
        type: c.content_type,
        name: c.title || "",
        subject: c.subject,
        subjectCategory: c.subject_category,
        rangeStart: c.start_range,
        rangeEnd: c.end_range,
      })),
      recommendedContents: (data.recommended_contents || []).map((c) => ({
        id: c.content_id,
        type: c.content_type,
        name: c.title || "",
        subject: c.subject,
        subjectCategory: c.subject_category,
        rangeStart: c.start_range,
        rangeEnd: c.end_range,
        isRecommended: c.is_auto_recommended,
      })),
    },
    options: {
      studyReviewCycle: data.study_review_cycle
        ? {
            studyDays: data.study_review_cycle.study_days,
            reviewDays: data.study_review_cycle.review_days,
          }
        : undefined,
      studentLevel: data.student_level,
    },
    templateConfig: data.plan_type
      ? {
          planType: data.plan_type as "normal" | "camp",
          campTemplateId: data.camp_template_id || undefined,
          campInvitationId: data.camp_invitation_id || undefined,
        }
      : undefined,
  };
}

/**
 * 단계 ID를 숫자로 변환
 */
function stepIdToNumber(stepId: string): WizardStep {
  const stepMap: Record<string, WizardStep> = {
    "basic-info": 1,
    "schedule-settings": 2,
    "schedule-preview": 3,
    "content-selection": 4,
    "recommended-content": 5,
    "final-review": 6,
    result: 7,
  };
  return stepMap[stepId] || 1;
}

/**
 * 숫자를 단계 ID로 변환
 */
function stepNumberToId(step: WizardStep): string {
  const idMap: Record<WizardStep, string> = {
    1: "basic-info",
    2: "schedule-settings",
    3: "schedule-preview",
    4: "content-selection",
    5: "recommended-content",
    6: "final-review",
    7: "result",
  };
  return idMap[step];
}

// ============================================
// 레거시 브릿지 훅
// ============================================

/**
 * useLegacyPlanWizardBridge
 *
 * UnifiedWizardProvider에서 기존 PlanWizardContext API를 사용할 수 있도록 하는 어댑터 훅
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { state, updateData, nextStep } = useLegacyPlanWizardBridge();
 *
 *   // 기존 코드와 동일하게 사용
 *   updateData({ name: "새 플랜" });
 * }
 * ```
 */
export function useLegacyPlanWizardBridge(): LegacyPlanWizardBridge {
  const unified = useWizard<FullWizardData>();

  // State 변환
  const state: LegacyPlanWizardState = useMemo(() => {
    const legacyData = unifiedToLegacy(unified.data);
    const currentStep = stepIdToNumber(unified.data.currentStepId);

    // 에러를 Map으로 변환
    const fieldErrors = new Map<string, string>();
    for (const error of unified.validation.errors) {
      fieldErrors.set(error.field, error.message);
    }

    return {
      wizardData: legacyData,
      currentStep,
      validationErrors: unified.validation.errors.map((e) => e.message),
      validationWarnings: unified.validation.warnings.map((e) => e.message),
      fieldErrors,
      draftGroupId: unified.data.meta.draftId || null,
      isSubmitting: unified.isSubmitting,
    };
  }, [unified.data, unified.validation, unified.isSubmitting]);

  // Actions
  const updateData = useCallback(
    (updates: Partial<LegacyWizardData>) => {
      // 레거시 데이터를 통합 형식으로 변환하여 업데이트
      const currentLegacy = unifiedToLegacy(unified.data);
      const mergedLegacy = { ...currentLegacy, ...updates };
      const newUnified = legacyToUnified(mergedLegacy, unified.data.currentStepId);

      // 필요한 필드만 업데이트
      unified.updateData({
        basicInfo: newUnified.basicInfo,
        schedule: newUnified.schedule,
        contents: newUnified.contents,
        options: newUnified.options,
      });
    },
    [unified]
  );

  const updateDataFn = useCallback(
    (updater: (prev: LegacyWizardData) => Partial<LegacyWizardData>) => {
      const currentLegacy = unifiedToLegacy(unified.data);
      const updates = updater(currentLegacy);
      updateData(updates);
    },
    [unified.data, updateData]
  );

  const nextStep = useCallback(() => {
    unified.nextStep();
  }, [unified]);

  const prevStep = useCallback(() => {
    unified.prevStep();
  }, [unified]);

  const setStep = useCallback(
    (step: WizardStep) => {
      const stepId = stepNumberToId(step);
      unified.goToStep(stepId);
    },
    [unified]
  );

  const setErrors = useCallback(
    (errors: string[]) => {
      // 통합 시스템에서는 validate 함수를 통해 에러 설정
      // 직접 설정이 필요한 경우 updateData를 통해 meta.isDirty 등을 조정
      console.warn("[LegacyAdapter] setErrors called - consider using unified validation");
    },
    []
  );

  const setWarnings = useCallback(
    (warnings: string[]) => {
      console.warn("[LegacyAdapter] setWarnings called - consider using unified validation");
    },
    []
  );

  const setFieldError = useCallback(
    (field: string, message: string) => {
      console.warn("[LegacyAdapter] setFieldError called - consider using unified validation");
    },
    []
  );

  const clearFieldError = useCallback(
    (field: string) => {
      console.warn("[LegacyAdapter] clearFieldError called - consider using unified validation");
    },
    []
  );

  const clearValidation = useCallback(() => {
    // 통합 시스템에서는 자동으로 처리됨
  }, []);

  const setDraftId = useCallback(
    (id: string | null) => {
      unified.updateData({
        meta: {
          ...unified.data.meta,
          draftId: id,
        },
      } as Partial<FullWizardData>);
    },
    [unified]
  );

  const setSubmitting = useCallback(
    (value: boolean) => {
      unified.setSubmitting(value);
    },
    [unified]
  );

  const resetDirtyState = useCallback(() => {
    unified.updateData({
      meta: {
        ...unified.data.meta,
        isDirty: false,
      },
    } as Partial<FullWizardData>);
  }, [unified]);

  const initialWizardData = useMemo(() => {
    return unifiedToLegacy(unified.data);
  }, []);

  return {
    state,
    updateData,
    updateDataFn,
    nextStep,
    prevStep,
    setStep,
    setErrors,
    setWarnings,
    setFieldError,
    clearFieldError,
    clearValidation,
    setDraftId,
    setSubmitting,
    isDirty: unified.isDirty,
    resetDirtyState,
    initialWizardData,
  };
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 현재 단계가 마지막인지 확인 (레거시 호환)
 */
export function isLastStep(step: WizardStep, mode: { isTemplateMode?: boolean; isCampMode?: boolean }): boolean {
  if (mode.isTemplateMode) {
    return step === 4; // 템플릿 모드: Step 4가 마지막
  }
  if (mode.isCampMode) {
    return step === 4; // 캠프 모드: Step 4가 마지막
  }
  return step === 7; // 일반 모드: Step 7가 마지막
}

/**
 * 진행률 계산 (레거시 호환)
 */
export function calculateProgress(
  currentStep: WizardStep,
  isTemplateMode: boolean = false
): number {
  const totalSteps = isTemplateMode ? 4 : 7;
  return Math.round((currentStep / totalSteps) * 100);
}
