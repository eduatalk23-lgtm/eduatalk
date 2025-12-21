"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { getActivePlanGroups } from "@/app/(student)/actions/planGroupActions";
import { PlanGroupActivationDialog } from "./PlanGroupActivationDialog";
import { useToast } from "@/components/ui/ToastProvider";
import { PlanWizardProvider, usePlanWizard } from "./_context/PlanWizardContext";
import {
  createPlanGroupAction,
  savePlanGroupDraftAction,
  updatePlanGroupDraftAction,
  updatePlanGroupAction,
  generatePlansFromGroupAction,
  updatePlanGroupStatus,
  checkPlansExistAction,
} from "@/app/(student)/actions/planGroupActions";
import { updateCampTemplateAction } from "@/app/(admin)/actions/campTemplateActions";
import { PlanGroupCreationData } from "@/lib/types/plan";
import { WizardValidator } from "@/lib/validation/wizardValidator";
import { PlanValidator } from "@/lib/validation/planValidator";
import { validateDataConsistency } from "@/lib/utils/planGroupDataSync";
import { useWizardValidation } from "./hooks/useWizardValidation";
import { usePlanSubmission } from "./hooks/usePlanSubmission";
import { useWizardScroll } from "./hooks/useWizardScroll";
import { PlanGroupError, toPlanGroupError, isRecoverableError, PlanGroupErrorCodes } from "@/lib/errors/planGroupErrors";
import type { SchedulerOptions } from "@/lib/types/plan";
import { createWizardMode, isLastStep as checkIsLastStep, shouldSubmitAtStep4, shouldSaveOnlyWithoutPlanGeneration, canGoBack } from "./utils/modeUtils";
import { BasePlanWizard } from "./BasePlanWizard";
import { PlanWizardDebugger } from "./debug/PlanWizardDebugger";
import { useBlockSets } from "@/lib/hooks/useBlockSets";
import { useStudentContents } from "@/lib/hooks/useStudentContents";
import { planGroupsQueryOptions } from "@/lib/query-options/planGroups";

// WizardData 타입을 스키마에서 import (타입 정의 통합)
import type { WizardData, TemplateLockedFields } from "@/lib/schemas/planWizardSchema";

// 타입 re-export (하위 호환성 유지)
export type { WizardData, TemplateLockedFields };

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// 기존 타입 정의는 주석 처리 (스키마에서 추론됨)
/*
export type WizardData = {
  // Step 1
  name: string;
  plan_purpose: "내신대비" | "모의고사(수능)" | "";
  scheduler_type: "1730_timetable" | "";
  scheduler_options?: {
    study_days?: number;
    review_days?: number;
  };
  period_start: string;
  period_end: string;
  target_date?: string;
  block_set_id: string;
  // Step 2
  exclusions: Array<{
    exclusion_date: string;
    exclusion_type: "휴가" | "개인사정" | "휴일지정" | "기타";
    reason?: string;
    source?: "template" | "student" | "time_management"; // 출처 구분
    is_locked?: boolean; // 템플릿에서 고정된 제외일
  }>;
  academy_schedules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string;
    subject?: string;
    travel_time?: number; // 이동시간 (분 단위, 기본값: 60분)
    source?: "template" | "student" | "time_management"; // 출처 구분
    is_locked?: boolean; // 템플릿에서 고정된 학원 일정
  }>;
  // Step 2 - 시간 설정
  time_settings?: {
    lunch_time?: {
      start: string; // "12:00"
      end: string; // "13:00"
    };
    // 1730 Timetable 전용 설정
    camp_study_hours?: {
      start: string; // "10:00"
      end: string; // "19:00"
    };
    camp_self_study_hours?: {
      start: string; // "19:00"
      end: string; // "22:00"
    };
    designated_holiday_hours?: {
      start: string; // "13:00"
      end: string; // "19:00"
    };
    // 자율학습시간 사용 가능 (학생/등록 시간블록과 조율)
    use_self_study_with_blocks?: boolean;
    // 자율학습 시간 배정 토글
    enable_self_study_for_holidays?: boolean; // 지정휴일 자율학습 시간 배정
    enable_self_study_for_study_days?: boolean; // 학습일/복습일 자율학습 시간 배정
  };
  // Step 3 - 학생 콘텐츠
  student_contents: Array<{
    content_type: "book" | "lecture";
    content_id: string;
    start_range: number;
    end_range: number;
    start_detail_id?: string | null; // 시작 범위 상세 정보 ID (book_details.id 또는 lecture_episodes.id)
    end_detail_id?: string | null; // 종료 범위 상세 정보 ID (book_details.id 또는 lecture_episodes.id)
    title?: string; // 추가: 제목 저장
    subject_category?: string; // 추가: 과목 카테고리 저장 (필수 과목 검증용)
    subject?: string; // 추가: 세부 과목 저장 (검증용)
    master_content_id?: string | null; // 추가: 마스터 콘텐츠 ID (중복 방지용)
  }>;
  // Step 4 - 추천 콘텐츠
  recommended_contents: Array<{
    content_type: "book" | "lecture";
    content_id: string;
    start_range: number;
    end_range: number;
    start_detail_id?: string | null; // 시작 범위 상세 정보 ID (book_details.id 또는 lecture_episodes.id)
    end_detail_id?: string | null; // 종료 범위 상세 정보 ID (book_details.id 또는 lecture_episodes.id)
    title?: string; // 추가: 제목 저장
    subject_category?: string; // 추가: 과목 카테고리 저장 (필수 과목 검증용)
    subject?: string; // 추가: 세부 과목 저장 (검증용)
    is_auto_recommended?: boolean; // 자동 배정 플래그
    recommendation_source?: "auto" | "admin" | "template" | null; // 자동 배정 소스
    recommendation_reason?: string | null; // 추천 사유
    recommendation_metadata?: Record<string, unknown> | null; // 추천 메타데이터
  }>;
  // Step 2.5 - 스케줄 요약 정보 (Step 3에서 학습 범위 추천에 사용)
  schedule_summary?: {
    total_days: number;
    total_study_days: number;
    total_review_days: number;
    total_study_hours: number;
    total_study_hours_학습일: number;
    total_study_hours_복습일: number;
    total_self_study_hours: number;
  };
  // Step 2.5 - 일별 스케줄 정보 (plan_groups.daily_schedule에 저장)
  daily_schedule?: Array<{
    date: string;
    day_type: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정";
    study_hours: number;
    available_time_ranges: Array<{ start: string; end: string }>;
    note: string;
    academy_schedules?: Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
      academy_name?: string;
      subject?: string;
      travel_time?: number;
    }>;
    exclusion?: {
      exclusion_date: string;
      exclusion_type: string;
      reason?: string;
    } | null;
    week_number?: number;
    time_slots?: Array<{
      type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
      start: string;
      end: string;
      label?: string;
    }>;
  }>;
  // 1730 Timetable 추가 필드
  study_review_cycle?: {
    study_days: number; // 기본값: 6
    review_days: number; // 기본값: 1
  };
  // 학생 수준 정보 (필수)
  student_level?: "high" | "medium" | "low";
  // 전략과목/취약과목 정보 (필수)
  subject_allocations?: Array<{
    subject_id: string;
    subject_name: string;
    subject_type: "strategy" | "weakness";
    weekly_days?: number; // 전략과목인 경우: 2, 3, 4
  }>;
  subject_constraints?: {
    enable_required_subjects_validation?: boolean; // 필수 과목 검증 사용 여부 (템플릿 모드에서 설정)
    required_subjects?: Array<{
      subject_group_id: string; // subject_groups 테이블 ID
      subject_category: string; // 표시용 이름 (subject_groups.name)
      min_count: number; // 최소 개수
      // 개정교육과정별 세부 과목 (선택사항)
      subjects_by_curriculum?: Array<{
        curriculum_revision_id: string;
        subject_id?: string; // subjects 테이블 ID
        subject_name?: string; // 표시용 (subjects.name)
      }>;
    }>; // 필수 교과/과목 목록 (위계 구조 + 개수)
    excluded_subjects?: string[];
    constraint_handling: "strict" | "warning" | "auto_fix";
  };
  additional_period_reallocation?: {
    period_start: string;
    period_end: string;
    type: "additional_review";
    original_period_start: string;
    original_period_end: string;
    subjects?: string[];
    review_of_review_factor?: number; // 기본값: 0.25
  };
  non_study_time_blocks?: Array<{
    type: "아침식사" | "저녁식사" | "수면" | "기타"; // "점심식사" 제거
    start_time: string; // HH:mm
    end_time: string; // HH:mm
    day_of_week?: number[]; // 0-6, 없으면 매일
    description?: string;
  }>;
  // 템플릿 고정 필드 (템플릿 모드에서만 사용)
  templateLockedFields?: TemplateLockedFields;
  // 캠프 관련 필드 (Step 7에서 사용)
  plan_type?: "individual" | "integrated" | "camp";
  camp_template_id?: string | null;
  camp_invitation_id?: string | null;
  // Step 4 - 필수 교과 설정 UI 표시 여부
  show_required_subjects_ui?: boolean;
  // Step 6 - 콘텐츠별 전략/취약 설정 (우선순위)
  content_allocations?: Array<{
    content_type: "book" | "lecture";
    content_id: string;
    subject_type: "strategy" | "weakness";
    weekly_days?: number; // 전략과목인 경우만
  }>;
  // Step 6 - 전략/취약 설정 모드 ("subject" | "content")
  allocation_mode?: "subject" | "content";
};
*/

type ExtendedInitialData = Partial<WizardData> & {
  groupId?: string;
  templateId?: string;
  templateProgramType?: string;
  templateStatus?: string;
  _startStep?: number;
  _validationErrors?: string[];
  student_id?: string;
  contents?: WizardData["student_contents"]; // 기존 구조 호환성
};

// PlanGroupWizardProps 타입 export
export type PlanGroupWizardProps = {
  studentId?: string; // 선택: 템플릿 모드에서는 불필요, 일반 모드에서는 필수
  initialBlockSets?: Array<{ id: string; name: string }>; // 선택: 하위 호환성 유지
  initialContents?: {
    books: Array<{ id: string; title: string; subtitle?: string | null; master_content_id?: string | null }>;
    lectures: Array<{ id: string; title: string; subtitle?: string | null; master_content_id?: string | null }>;
    custom: Array<{ id: string; title: string; subtitle?: string | null }>;
  }; // 선택: 하위 호환성 유지
  initialData?: ExtendedInitialData;
  isEditMode?: boolean;
  isCampMode?: boolean;
  campInvitationId?: string;
  isTemplateMode?: boolean; // 템플릿 생성 모드 (관리자용)
  isAdminMode?: boolean; // 관리자 모드 (관리자용)
  isAdminContinueMode?: boolean; // 관리자 남은 단계 진행 모드 (1~4단계 읽기 전용, 5~7단계만 편집)
  onTemplateSave?: (wizardData: WizardData) => Promise<void>; // 템플릿 저장 콜백
  onSaveRequest?: (saveFn: () => Promise<void>) => void; // 저장 함수를 외부에 노출
};


// Step별 가중치 (진행률 계산용)
export const stepWeights: Record<WizardStep, number> = {
  1: 16.67,  // 기본 정보 (1/6)
  2: 16.67,  // 블록 및 제외일 (2/6)
  3: 16.67,  // 스케줄 확인 (3/6)
  4: 16.67,  // 콘텐츠 선택 (4/6)
  5: 16.67,  // 추천 콘텐츠 (5/6)
  6: 16.65,  // 최종 확인 (6/6)
  7: 0,      // 스케줄 결과 (완료 후)
};

/**
 * 진행률 계산 함수
 */
function calculateProgress(currentStep: WizardStep, wizardData: WizardData, isTemplateMode: boolean = false): number {
  let progress = 0;

  // 완료된 Step들의 가중치 합산
  for (let step = 1; step < currentStep; step++) {
    // 템플릿 모드일 때 Step 5, 6, 7 제외 (1, 2, 3, 4만)
    if (isTemplateMode && (step === 5 || step === 6 || step === 7)) {
      continue;
    }
    progress += stepWeights[step as WizardStep];
  }

  // 현재 Step의 부분 완료도 계산
  // 템플릿 모드일 때 Step 5, 6, 7은 가중치 0으로 처리
  const currentStepWeight = (isTemplateMode && (currentStep === 5 || currentStep === 6 || currentStep === 7)) ? 0 : stepWeights[currentStep];
  let currentStepProgress = 0;

  switch (currentStep) {
    case 1:
      // 기본 정보: name, plan_purpose, scheduler_type, period, block_set_id
      let step1Count = 0;
      let step1Total = 5;
      if (wizardData.name && wizardData.name.trim() !== "") step1Count++;
      // 템플릿 모드에서 학생 입력 허용이 체크되어 있으면 plan_purpose는 선택사항
      const isPlanPurposeOptional = isTemplateMode && wizardData.templateLockedFields?.step1?.allow_student_plan_purpose === true;
      if (isPlanPurposeOptional) {
        step1Total = 4; // plan_purpose 제외
      } else {
        if (wizardData.plan_purpose) step1Count++;
      }
      if (wizardData.scheduler_type) step1Count++;
      if (wizardData.period_start && wizardData.period_end) step1Count++;
      if (wizardData.block_set_id) step1Count++;
      currentStepProgress = (step1Count / step1Total) * currentStepWeight;
      break;
    case 2:
      // 블록 및 제외일: 항상 완료로 간주 (선택사항)
      currentStepProgress = currentStepWeight;
      break;
    case 3:
      // 스케줄 확인: 항상 완료로 간주 (확인만 하는 단계)
      currentStepProgress = currentStepWeight;
      break;
    case 4:
      // 콘텐츠 선택: student_contents 또는 recommended_contents가 있으면 완료
      const hasAnyContent = wizardData.student_contents.length > 0 || wizardData.recommended_contents.length > 0;
      currentStepProgress = hasAnyContent ? currentStepWeight : 0;
      break;
    case 5:
      // 추천 콘텐츠: 항상 완료 (선택사항)
      currentStepProgress = currentStepWeight;
      break;
    case 6:
      // 최종 확인: 항상 완료
      currentStepProgress = currentStepWeight;
      break;
    case 7:
      // 스케줄 결과: 항상 완료
      currentStepProgress = currentStepWeight;
      break;
  }

  progress += currentStepProgress;

  return Math.min(progress, 100);
}

/**
 * 데이터베이스에서 읽은 plan_purpose를 UI 형식으로 변환
 * 기존 데이터 호환성: "수능" 또는 "모의고사"는 "모의고사(수능)"으로 변환
 * 새 데이터: "내신대비", "모의고사(수능)"은 그대로 사용
 */
function denormalizePlanPurpose(purpose: string | null | undefined): "" | "내신대비" | "모의고사(수능)" {
  if (!purpose) return "";
  // 기존 데이터 호환성: "수능" 또는 "모의고사"는 "모의고사(수능)"으로 변환
  if (purpose === "수능" || purpose === "모의고사") return "모의고사(수능)";
  // 새 데이터: "내신대비", "모의고사(수능)"은 그대로 사용
  if (purpose === "내신대비" || purpose === "모의고사(수능)") return purpose as "내신대비" | "모의고사(수능)";
  return "";
}

/**
 * PlanGroupWizard 내부 컴포넌트
 * PlanWizardProvider 내부에서 사용되며, usePlanWizard 훅을 통해 상태에 접근합니다.
 */
function PlanGroupWizardInner({
  studentId,
  initialBlockSets,
  initialContents,
  initialData,
  isEditMode = false,
  isCampMode = false,
  campInvitationId,
  isTemplateMode = false,
  isAdminMode = false,
  isAdminContinueMode = false,
  onTemplateSave,
  onSaveRequest,
}: PlanGroupWizardProps) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  
  // PlanWizardContext에서 상태 가져오기
  const {
    state: {
      wizardData,
      currentStep,
      validationErrors,
      validationWarnings,
      fieldErrors,
      draftGroupId,
      isSubmitting,
    },
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
    isDirty,
    resetDirtyState,
  } = usePlanWizard();

  // 모드 통합 관리
  const mode = useMemo(() => createWizardMode({
    isCampMode,
    isTemplateMode,
    isAdminMode,
    isAdminContinueMode,
    isEditMode,
  }), [isCampMode, isTemplateMode, isAdminMode, isAdminContinueMode, isEditMode]);
  
  // 블록 세트 조회 (훅 사용, initialBlockSets가 있으면 우선 사용)
  const { data: blockSetsData, isLoading: isLoadingBlockSets } = useBlockSets({
    studentId: studentId || "",
    enabled: !initialBlockSets && !!studentId, // initialBlockSets가 있거나 studentId가 없으면 훅 비활성화
  });
  
  const blockSets = useMemo(() => {
    if (initialBlockSets && initialBlockSets.length > 0) {
      return initialBlockSets;
    }
    return blockSetsData || [];
  }, [initialBlockSets, blockSetsData]);

  // 콘텐츠 목록 조회 (훅 사용, initialContents가 있으면 우선 사용)
  const { data: contentsData, isLoading: isLoadingContents } = useStudentContents({
    studentId: studentId || "",
    enabled: !initialContents && !!studentId, // initialContents가 있거나 studentId가 없으면 훅 비활성화
  });

  const contents = useMemo(() => {
    if (initialContents) {
      return initialContents;
    }
    return contentsData || { books: [], lectures: [], custom: [] };
  }, [initialContents, contentsData]);

  const templateId = initialData?.templateId;
  const templateProgramType = initialData?.templateProgramType || "기타";
  const templateStatus = initialData?.templateStatus || "draft";

  // Validation Hook
  const {
    validateStep,
    clearValidationState
  } = useWizardValidation({
    wizardData,
    isTemplateMode,
    isCampMode,
    // Context 함수들 전달 - 검증 결과를 Context에 반영
    setFieldError,
    setErrors,
    setWarnings,
    clearValidation,
  });

  // Submission Hook
  const { executeSave, handleSubmit, isSubmitting: isSubmittingFromHook } = usePlanSubmission({
      wizardData,
      draftGroupId,
      setDraftGroupId: setDraftId,
      currentStep,
      setCurrentStep: setStep,
      setValidationErrors: setErrors,
      campInvitationId,
      initialData,
      onSaveRequest,
      mode,
      onSaveSuccess: resetDirtyState, // 저장 성공 시 dirty 상태 리셋
  });

  // isSubmitting 상태 동기화
  useEffect(() => {
    setSubmitting(isSubmittingFromHook);
  }, [isSubmittingFromHook, setSubmitting]);

  // 템플릿 모드일 때는 onTemplateSave 호출, 그 외에는 executeSave 호출
  const handleSaveDraft = useCallback(
    async (silent: boolean = false) => {
      if (isTemplateMode && onTemplateSave) {
        // 템플릿 모드: onTemplateSave 콜백 호출
        try {
          await onTemplateSave(wizardData);
          // 저장 성공 시 dirty 상태 리셋
          resetDirtyState();
        } catch (error) {
          console.error("[PlanGroupWizard] Template save failed:", error);
          if (!silent) {
            toast.showError(
              error instanceof Error
                ? error.message
                : "템플릿 저장에 실패했습니다."
            );
          }
        }
      } else {
        // 일반 모드: 기존 로직 사용
        await executeSave(silent);
        // 저장 성공 시 dirty 상태 리셋 (executeSave 내부에서 처리)
      }
    },
    [isTemplateMode, onTemplateSave, wizardData, executeSave, toast, resetDirtyState]
  );
  
  // 초기 검증 에러 처리 (usePlanSubmission/validation 초기화와 충돌 방지 위해 hook 이후에 처리하거나 hook 내부로 이동 권장되지만, 우선 여기서 상태 동기화)
  useEffect(() => {
     if (initialData?._validationErrors) {
         setErrors(initialData._validationErrors);
     }
  }, [initialData, setErrors]);
  
  // Removed isPending/startTransition as usePlanSubmission handles loading state
  // const [isPending, startTransition] = useTransition();
  // const isSubmittingRef = useRef(false); 

  const [activationDialogOpen, setActivationDialogOpen] = useState(false);
  const [activeGroupNames, setActiveGroupNames] = useState<string[]>([]);

  // block_set_id 변경 추적 (자동 저장 방지용)
  const prevBlockSetIdRef = useRef<string | undefined>(wizardData.block_set_id);
  const isBlockSetIdOnlyChangeRef = useRef(false);

  // block_set_id 변경 감지 (자동 저장 방지를 위한 추적)
  useEffect(() => {
    const currentBlockSetId = wizardData.block_set_id;
    const prevBlockSetId = prevBlockSetIdRef.current;

    if (prevBlockSetId !== currentBlockSetId) {
      // block_set_id가 변경되었음을 표시
      isBlockSetIdOnlyChangeRef.current = true;
      prevBlockSetIdRef.current = currentBlockSetId;

      // 다음 렌더링 사이클에서 플래그 리셋 (다른 필드 변경과 구분)
      setTimeout(() => {
        isBlockSetIdOnlyChangeRef.current = false;
      }, 0);
    }
  }, [wizardData.block_set_id]);

  const updateWizardData = useCallback((
    updates: Partial<WizardData> | ((prev: WizardData) => Partial<WizardData>)
  ) => {
    if (typeof updates === "function") {
      updateDataFn(updates);
    } else {
      updateData(updates);
    }
  }, [updateData, updateDataFn]);

  // validateStep Logic replaced by useWizardValidation hook

  // 스크롤 관리 훅 (검증 실패 및 단계 변경 시 스크롤 통합 관리)
  const { handleValidationFailed } = useWizardScroll({
    currentStep,
    fieldErrors,
  });

  const handleNext = useCallback(() => {
    // Step 3 (스케줄 미리보기)에서는 검증 로직 건너뛰기
    if (currentStep !== 3) {
      if (!validateStep(currentStep)) {
        // 검증 실패 시 오류 필드로 스크롤하도록 예약
        handleValidationFailed();
        return;
      }
    }

    // isAdminContinueMode일 때 Step 3에서 Step 4로 이동 가능하도록 추가
    if (mode.isAdminContinueMode && currentStep === 3) {
      setStep(4);
      return;
    }

    // 템플릿 모드일 때 Step 4에서 템플릿 저장
    if (shouldSubmitAtStep4(mode) && currentStep === 4) {
      handleSubmit();
      return;
    }

    // Step 5 (학습범위 점검)에서 다음 버튼 클릭 시
    if (currentStep === 5) {
      // 일반 모드: 데이터만 저장 후 Step 6으로 이동 (플랜 생성은 Step 6 → Step 7 전환 시)
      // 캠프 모드: 데이터만 저장 후 Step 6으로 이동 (플랜 생성은 Step 7에서)
      handleSubmit(shouldSaveOnlyWithoutPlanGeneration(mode) ? false : false);
      return;
    }

    // Step 6 (최종 확인)에서 다음 버튼 클릭 시
    if (currentStep === 6) {
      // 관리자 continue 모드: 데이터만 저장 후 Step 7로 이동
      // 일반 모드: 플랜 생성 후 Step 7로 이동
      handleSubmit(shouldSaveOnlyWithoutPlanGeneration(mode) ? false : true);
      return;
    }

    if (currentStep < 5) {
      if (currentStep === 4) {
        // 템플릿 모드나 캠프 모드가 아닐 때만 Step 4에서 데이터만 저장하고 Step 5로 이동
        // 템플릿 모드나 캠프 모드일 때는 위에서 이미 handleSubmit()이 호출됨
        if (!shouldSubmitAtStep4(mode)) {
          // Step 4에서는 데이터만 저장하고 Step 5로 이동 (플랜 생성은 Step 5에서)
          // handleSubmit 내부에서 setCurrentStep(5)를 호출하므로 여기서는 호출만 함
          handleSubmit(false); // 플랜 생성하지 않음
          return; // handleSubmit 내부에서 단계 이동 처리
        }
      } else {
        nextStep();
      }
    }
  }, [currentStep, validateStep, mode, handleSubmit, setStep, nextStep, handleValidationFailed]);

  const handleBack = useCallback(() => {
    if (canGoBack(currentStep, mode)) {
      prevStep();
    }
  }, [currentStep, mode, prevStep]);

  // Step 7 완료 핸들러
  const handleStep7Complete = useCallback(async () => {
    if (!draftGroupId) return;

    // 관리자 continue 모드에서는 플랜 생성 및 페이지 이동 처리
    if (isAdminContinueMode) {
      try {
        const { continueCampStepsForAdmin } = await import("@/app/(admin)/actions/campTemplateActions");
        
        // Step 7에서 플랜 생성 및 저장
        const result = await continueCampStepsForAdmin(
          draftGroupId || (initialData?.groupId as string),
          wizardData,
          currentStep
        );

        if (result.success) {
          toast.showSuccess("플랜이 생성되었습니다.");
          // 참여자 목록 페이지로 이동
          const templateId = initialData?.templateId;
          if (templateId) {
            window.location.href = `/admin/camp-templates/${templateId}/participants`;
          } else {
            window.location.href = `/admin/camp-templates`;
          }
        } else {
          const errorMessage = result.error || "플랜 생성에 실패했습니다.";
          setErrors([errorMessage]);
          toast.showError(errorMessage);
        }
      } catch (error) {
        console.error("[PlanGroupWizard] 관리자 캠프 플랜 생성 실패:", error);
        const errorMessage = error instanceof Error ? error.message : "플랜 생성에 실패했습니다.";
        setErrors([errorMessage]);
        toast.showError(errorMessage);
      }
      return;
    }

    // 일반 모드(학생 모드)에서는 플랜이 생성되었는지 확인만 수행
    // 플랜 생성은 Step 7 진입 시 자동으로 완료되므로 여기서는 확인만
    try {
      const checkResult = await checkPlansExistAction(draftGroupId);
      if (!checkResult.hasPlans) {
        // 플랜이 없으면 경고만 표시 (Step 7에서 이미 생성되어야 함)
        alert("플랜이 생성되지 않았습니다. 플랜 재생성 버튼을 클릭하여 다시 시도해주세요.");
        return;
      }
    } catch (error) {
      // 플랜 확인 실패는 경고만 표시하고 계속 진행
      console.warn("[PlanGroupWizard] 플랜 확인 실패:", error);
    }

    // 완료 버튼 클릭 시 활성화 다이얼로그 표시를 위해 다른 활성 플랜 그룹 확인
    // (자동 활성화는 하지 않음 - 사용자가 완료 버튼을 눌렀을 때만 활성화)
    try {
      const activeGroups = await getActivePlanGroups(draftGroupId);
      if (activeGroups.length > 0) {
        // 다른 활성 플랜 그룹이 있으면 이름 저장 (완료 버튼 클릭 시 다이얼로그 표시)
        setActiveGroupNames(activeGroups.map(g => g.name || "플랜 그룹"));
      }
      // 다른 활성 플랜 그룹이 없어도 자동 활성화하지 않음
      // 사용자가 완료 버튼을 눌렀을 때만 활성화됨
    } catch (error) {
      // 활성 그룹 확인 실패는 경고만 (필수가 아니므로)
      const planGroupError = toPlanGroupError(
        error,
        PlanGroupErrorCodes.UNKNOWN_ERROR
      );
      console.warn("[PlanGroupWizard] 플랜 그룹 활성 그룹 확인 실패:", planGroupError);
    }

    // 완료 버튼을 눌렀을 때만 활성화 및 리다이렉트
    // 다른 활성 플랜 그룹이 있으면 활성화 다이얼로그 표시
    if (activeGroupNames.length > 0) {
      setActivationDialogOpen(true);
    } else {
      // 다른 활성 플랜 그룹이 없으면 활성화 후 리다이렉트
      try {
        // saved 상태로 먼저 변경 시도 (이미 saved 상태면 에러 없이 성공)
        try {
          await updatePlanGroupStatus(draftGroupId, "saved");
        } catch (savedError) {
          // saved 상태 변경 실패는 무시 (이미 saved 상태일 수 있음)
          console.warn("플랜 그룹 saved 상태 변경 실패 (무시):", savedError);
        }
        // saved 상태에서 active로 전이
        await updatePlanGroupStatus(draftGroupId, "active");
        
        // 플랜 그룹 목록 쿼리 무효화 (최신 데이터 표시)
        queryClient.invalidateQueries({
          queryKey: ["planGroups"],
        });
        
        router.refresh(); // 캐시 갱신
        router.push(`/plan/group/${draftGroupId}`, { scroll: true });
      } catch (statusError) {
        // 활성화 실패 시에도 리다이렉트 (경고만)
        console.warn("플랜 그룹 활성화 실패:", statusError);
        router.refresh(); // 캐시 갱신
        router.push(`/plan/group/${draftGroupId}`, { scroll: true });
      }
    }
  }, [draftGroupId, isAdminContinueMode, wizardData, currentStep, initialData, toast, setErrors, router]);

  // 진행률 계산
  const progress = useMemo(() => calculateProgress(currentStep, wizardData, isTemplateMode), [currentStep, wizardData, isTemplateMode]);

  // 마지막 단계 판단 (공통 유틸리티 사용)
  const isLastStep = useMemo(() => {
    return checkIsLastStep(currentStep, mode);
  }, [currentStep, mode]);

  // handleSaveDraft를 ref로 저장하여 최신 함수를 참조
  const handleSaveDraftRef = useRef(handleSaveDraft);
  useEffect(() => {
    handleSaveDraftRef.current = handleSaveDraft;
  }, [handleSaveDraft]);

  // 저장 함수를 외부에 노출 (템플릿 모드일 때만)
  useEffect(() => {
    if (isTemplateMode && onSaveRequest) {
      onSaveRequest(() => handleSaveDraftRef.current(false));
    }
  }, [isTemplateMode, onSaveRequest]);

  // 이탈 방지: beforeunload 이벤트 처리
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // 표준에 따라 메시지를 설정해야 함
      e.preventDefault();
      e.returnValue = ""; // Chrome에서는 빈 문자열이 필요
      return ""; // 일부 브라우저에서는 반환값 필요
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  // 취소 핸들러 (변경 사항 감지)
  const handleCancel = useCallback(() => {
    // 변경 사항이 있으면 확인
    if (isDirty) {
      if (!confirm("변경사항이 저장되지 않을 수 있습니다. 정말 나가시겠습니까?")) {
        return;
      }
    }
    
    // 관리자 모드일 때는 캠프 템플릿 참여자 목록으로 이동
    if (mode.isAdminMode || mode.isAdminContinueMode) {
      const templateId = initialData?.templateId;
      if (templateId) {
        router.push(`/admin/camp-templates/${templateId}/participants`, { scroll: true });
        return;
      }
    }
    // 일반 모드일 때는 기존 로직 사용
    router.push(isEditMode && draftGroupId ? `/plan/group/${draftGroupId}` : "/plan", { scroll: true });
  }, [isDirty, mode, initialData, router, isEditMode, draftGroupId]);

  return (
    <>
      <BasePlanWizard
        mode={mode}
        isTemplateMode={isTemplateMode}
        isEditMode={isEditMode}
        draftGroupId={draftGroupId}
        blockSets={blockSets}
        initialContents={contents}
        initialData={initialData}
        progress={progress}
        isSubmitting={isSubmitting}
        isLastStep={isLastStep}
        onNext={handleNext}
        onBack={handleBack}
        onSave={() => handleSaveDraft(false)}
        onComplete={handleStep7Complete}
        onCancel={handleCancel}
        onSetStep={setStep}
        onBlockSetsLoaded={() => {}} // blockSets는 useMemo로 관리되므로 콜백 불필요
      />

      {/* 플랜 그룹 활성화 다이얼로그 */}
      {draftGroupId && (
        <PlanGroupActivationDialog
          open={activationDialogOpen}
          onOpenChange={setActivationDialogOpen}
          groupId={draftGroupId}
          activeGroupNames={activeGroupNames}
        />
      )}

      {/* 디버깅 패널 (관리자 모드 또는 개발 환경에서만 표시) */}
      <PlanWizardDebugger
        isAdminMode={isAdminMode}
        isTemplateMode={isTemplateMode}
        isCampMode={isCampMode}
      />
    </>
  );
}

/**
 * PlanGroupWizard 외부 컴포넌트
 * PlanWizardProvider로 래핑하여 Context를 제공합니다.
 */
export function PlanGroupWizard(props: PlanGroupWizardProps) {
  const initialStep = props.initialData?._startStep 
    ? (props.initialData._startStep as WizardStep)
    : 1;
  
  const initialDraftId = props.initialData?.groupId || null;

  // 초기 콘텐츠 상태 처리
  const initialContentsState = useMemo(() => {
    if (props.initialData?.student_contents || props.initialData?.recommended_contents) {
      return {
        student_contents: props.initialData.student_contents || [],
        recommended_contents: props.initialData.recommended_contents || [],
      };
    }
    // 기존 구조: contents가 있으면 모두 student_contents로 처리
    if (props.initialData?.contents) {
      return {
        student_contents: props.initialData.contents,
        recommended_contents: [],
      };
    }
    return {
      student_contents: [],
      recommended_contents: [],
    };
  }, [props.initialData]);

  // 초기 데이터 준비 (PlanWizardContext의 createInitialState와 동일한 로직)
  const initialWizardData = useMemo(() => {
    const denormalizePlanPurpose = (purpose: string | null | undefined): "" | "내신대비" | "모의고사(수능)" => {
      if (!purpose) return "";
      if (purpose === "수능" || purpose === "모의고사") return "모의고사(수능)";
      if (purpose === "내신대비" || purpose === "모의고사(수능)") return purpose as "내신대비" | "모의고사(수능)";
      return "";
    };

    return {
      ...props.initialData,
      student_contents: initialContentsState.student_contents,
      recommended_contents: initialContentsState.recommended_contents,
      plan_purpose: denormalizePlanPurpose(props.initialData?.plan_purpose),
    } as Partial<WizardData>;
  }, [props.initialData, initialContentsState]);

  return (
    <PlanWizardProvider
      initialData={initialWizardData}
      initialStep={initialStep}
      initialDraftId={initialDraftId}
    >
      <PlanGroupWizardInner {...props} />
    </PlanWizardProvider>
  );
}
