/**
 * usePlanSubmission - 플랜 제출 로직 훅
 *
 * 플랜 그룹 생성 및 플랜 생성 로직을 통합 관리합니다.
 * 저장 성공 시 dirty 상태를 리셋하여 이탈 방지 로직과 연동됩니다.
 *
 * A3 개선: 제출 진행 상태 추적 (SubmissionPhase)
 * A4 개선: 오토세이브 기능 추가
 */

import { useCallback, useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { WizardData, WizardStep } from "../PlanGroupWizard";
import { validatePeriod } from "../utils/validationUtils";
import { usePlanDraft } from "./usePlanDraft";
import { usePlanGenerator } from "./usePlanGenerator";
import { useWizardNavigation } from "./useWizardNavigation";
import { useAutoSave, type AutoSaveStatus } from "./useAutoSave";
import {
  toPlanGroupError,
  PlanGroupErrorCodes,
} from "@/lib/errors/planGroupErrors";
import type { SubmissionPhase } from "../_ui/SubmissionProgress";
import { WIZARD_STEPS, TIMING } from "../constants/wizardConstants";

/**
 * usePlanSubmission Props
 */
type UsePlanSubmissionProps = {
  wizardData: WizardData;
  draftGroupId: string | null;
  setDraftGroupId: (id: string) => void;
  currentStep: WizardStep;
  setCurrentStep: (step: WizardStep) => void;
  setValidationErrors: (errors: string[]) => void;
  campInvitationId?: string;
  initialData?: {
    templateId?: string;
    groupId?: string;
    student_id?: string;
    studentId?: string;
  };
  /** 초기 위저드 데이터 (오토세이브 변경 감지용) */
  initialWizardData?: WizardData | null;
  onSaveRequest?: (saveFn: () => Promise<void>) => void;
  mode: {
    isCampMode: boolean;
    isTemplateMode: boolean;
    isAdminMode: boolean;
    isAdminContinueMode: boolean;
    isEditMode: boolean;
  };
  /** 저장 성공 시 콜백 (dirty 상태 리셋용) */
  onSaveSuccess?: () => void;
  /** 오토세이브 활성화 여부 (기본값 true) */
  autoSaveEnabled?: boolean;
};

/**
 * usePlanSubmission 훅
 * 
 * 플랜 그룹 생성 및 플랜 생성 로직을 제공합니다.
 * 
 * @param props 위저드 데이터 및 설정
 * @returns 제출 함수 및 상태
 */
export function usePlanSubmission({
  wizardData,
  draftGroupId,
  setDraftGroupId,
  currentStep,
  setCurrentStep,
  setValidationErrors,
  campInvitationId,
  initialData,
  initialWizardData,
  mode,
  onSaveSuccess,
  autoSaveEnabled = true,
}: UsePlanSubmissionProps) {
  const toast = useToast();

  // 분리된 훅들 사용
  const { saveDraft, isSaving } = usePlanDraft({
    wizardData,
    draftGroupId,
    setDraftGroupId,
    setValidationErrors,
    isCampMode: mode.isCampMode,
    isTemplateMode: mode.isTemplateMode,
    campInvitationId,
    initialData,
    onSaveSuccess, // 저장 성공 시 콜백 전달
  });

  const { generatePlans, createOrUpdatePlanGroup, isGenerating } = usePlanGenerator({
    wizardData,
    draftGroupId,
    setValidationErrors,
    isCampMode: mode.isCampMode,
    isTemplateMode: mode.isTemplateMode,
    campInvitationId,
    initialData,
    isAdminContinueMode: mode.isAdminContinueMode,
    isAdminMode: mode.isAdminMode,
    currentStep,
  });

  const { goNext, goToStep } = useWizardNavigation({
    currentStep,
    setCurrentStep,
    draftGroupId,
    mode,
  });

  // A4 개선: 오토세이브 훅
  // - 템플릿 모드에서는 비활성화 (별도 저장 로직 사용)
  // - draftGroupId가 없으면 (신규) 비활성화 (명시적 저장 필요)
  const {
    status: autoSaveStatus,
    lastSavedAt: autoSaveLastSavedAt,
    isSaving: isAutoSaving,
  } = useAutoSave({
    data: wizardData,
    initialData: initialWizardData,
    draftGroupId,
    saveFn: saveDraft,
    options: {
      enabled: autoSaveEnabled && !mode.isTemplateMode,
      debounceMs: TIMING.AUTO_SAVE_DEBOUNCE_MS,
      savedStatusDurationMs: TIMING.SAVED_STATUS_DURATION_MS,
    },
  });

  const isSubmitting = isSaving || isGenerating || isAutoSaving;

  // A3 개선: 제출 진행 단계 추적
  const [submissionPhase, setSubmissionPhase] = useState<SubmissionPhase>("idle");
  const [submissionError, setSubmissionError] = useState<string | undefined>(undefined);

  /* -------------------------------------------------------------------------- */
  /*                             Draft Save Logic                               */
  /* -------------------------------------------------------------------------- */
  const executeSave = useCallback(
    async (silent: boolean = false) => {
      await saveDraft(silent);
    },
    [saveDraft]
  );

  /* -------------------------------------------------------------------------- */
  /*                             Final Submit Logic                             */
  /* -------------------------------------------------------------------------- */
  const handleSubmit = useCallback(
    async (generatePlansFlag: boolean = true) => {
      if (isSubmitting) return;
      setValidationErrors([]);
      setSubmissionError(undefined);

      try {
        // A3 개선: 검증 단계 시작
        setSubmissionPhase("validating");

        // 0. 기간 검증 (동기, 빠름)
        const periodValidation = validatePeriod(wizardData, mode.isCampMode);
        if (!periodValidation.isValid && periodValidation.error) {
          setValidationErrors([periodValidation.error]);
          setSubmissionPhase("error");
          setSubmissionError(periodValidation.error);
          return;
        }

        // 템플릿 모드일 때는 플랜 그룹 생성을 건너뛰고 다음 단계로만 이동
        if (mode.isTemplateMode) {
          setSubmissionPhase("idle");
          goNext();
          return;
        }

        // 낙관적 UI 업데이트: Step 전환이 필요한 경우 먼저 UI 전환 후 백그라운드 저장
        const needsOptimisticUpdate =
          (currentStep === WIZARD_STEPS.CONTENT_SELECTION && !generatePlansFlag) ||
          currentStep === WIZARD_STEPS.RECOMMENDED_CONTENT ||
          (currentStep === WIZARD_STEPS.FINAL_REVIEW && !generatePlansFlag);

        if (needsOptimisticUpdate) {
          // 1. 먼저 다음 단계로 UI 전환 (즉각적인 반응)
          const nextStep: WizardStep =
            currentStep === WIZARD_STEPS.CONTENT_SELECTION
              ? WIZARD_STEPS.RECOMMENDED_CONTENT as WizardStep
              : currentStep === WIZARD_STEPS.RECOMMENDED_CONTENT
              ? WIZARD_STEPS.FINAL_REVIEW as WizardStep
              : WIZARD_STEPS.RESULT as WizardStep;
          setSubmissionPhase("idle"); // 낙관적 업데이트에서는 진행 표시 숨김
          goToStep(nextStep);

          // 2. 백그라운드에서 저장 (에러 시 토스트로 알림)
          createOrUpdatePlanGroup()
            .then((finalGroupId) => {
              setDraftGroupId(finalGroupId);
            })
            .catch((error) => {
              console.error("[usePlanSubmission] Background save failed", error);
              const planGroupError = toPlanGroupError(
                error,
                PlanGroupErrorCodes.UNKNOWN_ERROR
              );
              // 사용자에게 명확한 에러 메시지 표시
              toast.showError(planGroupError.userMessage);
              setValidationErrors([planGroupError.userMessage]);
            });
          return;
        }

        // A3 개선: 플랜 그룹 생성 단계
        setSubmissionPhase("creating_group");

        // 플랜 생성이 필요한 경우: 기존 동기 방식 유지
        // 1. Create or Update Plan Group
        const finalGroupId = await createOrUpdatePlanGroup();
        setDraftGroupId(finalGroupId);

        // 2. Plan Generation (Generate Real Plans)
        if (generatePlansFlag) {
          // A3 개선: 플랜 생성 단계
          setSubmissionPhase("generating_plans");

          await generatePlans(finalGroupId);

          // A3 개선: 마무리 단계
          setSubmissionPhase("finalizing");

          // 캠프 모드(학생)일 때는 generatePlans 내부에서 제출 완료 페이지로 이동하므로
          // Step 7로 이동하지 않음
          if (!mode.isCampMode) {
            // 플랜 생성 후 결과 확인 단계로 이동 (리다이렉트는 Step 7 완료 버튼에서 처리)
            setSubmissionPhase("completed");
            goToStep(WIZARD_STEPS.RESULT as WizardStep);
          } else {
            // 캠프 모드일 때는 generatePlans 내부에서 router.push로 이동
            setSubmissionPhase("completed");
          }
        } else {
          setSubmissionPhase("idle");
          goNext();
        }
      } catch (error) {
        console.error("[usePlanSubmission] Submit failed", error);
        const planGroupError = toPlanGroupError(
          error,
          PlanGroupErrorCodes.UNKNOWN_ERROR
        );
        // A3 개선: 에러 단계
        setSubmissionPhase("error");
        setSubmissionError(planGroupError.userMessage);
        // 사용자에게 명확한 에러 메시지 표시
        toast.showError(planGroupError.userMessage);
        setValidationErrors([planGroupError.userMessage]);
      }
    },
    [
      isSubmitting,
      wizardData,
      createOrUpdatePlanGroup,
      generatePlans,
      currentStep,
      setDraftGroupId,
      goToStep,
      goNext,
      setValidationErrors,
      toast,
      mode.isTemplateMode,
      mode.isCampMode,
    ]
  );
  
  // A3 개선: 에러 상태 리셋 함수
  const resetSubmissionPhase = useCallback(() => {
    setSubmissionPhase("idle");
    setSubmissionError(undefined);
  }, []);

  return {
    isSubmitting,
    executeSave,
    handleSubmit,
    // A3 개선: 제출 진행 상태
    submissionPhase,
    submissionError,
    resetSubmissionPhase,
    // A4 개선: 오토세이브 상태
    autoSaveStatus,
    autoSaveLastSavedAt,
  };
}

// 타입 내보내기
export type { AutoSaveStatus };
