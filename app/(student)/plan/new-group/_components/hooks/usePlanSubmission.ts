/**
 * usePlanSubmission - 플랜 제출 로직 훅
 * 
 * 플랜 그룹 생성 및 플랜 생성 로직을 통합 관리합니다.
 * 저장 성공 시 dirty 상태를 리셋하여 이탈 방지 로직과 연동됩니다.
 */

import { useCallback } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { WizardData, WizardStep } from "../PlanGroupWizard";
import { usePlanValidator } from "./usePlanValidator";
import { usePlanDraft } from "./usePlanDraft";
import { usePlanGenerator } from "./usePlanGenerator";
import { useWizardNavigation } from "./useWizardNavigation";
import {
  toPlanGroupError,
  PlanGroupErrorCodes,
} from "@/lib/errors/planGroupErrors";

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
  mode,
  onSaveSuccess,
}: UsePlanSubmissionProps) {
  const toast = useToast();
  
  // 분리된 훅들 사용
  const { validatePeriod } = usePlanValidator({
    wizardData,
    currentStep,
    isTemplateMode: mode.isTemplateMode,
    isCampMode: mode.isCampMode,
  });

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

  const isSubmitting = isSaving || isGenerating;

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

      try {
        // 0. 기간 검증 (동기, 빠름)
        const periodValidation = validatePeriod();
        if (!periodValidation.isValid && periodValidation.error) {
          setValidationErrors([periodValidation.error]);
          return;
        }

        // 템플릿 모드일 때는 플랜 그룹 생성을 건너뛰고 다음 단계로만 이동
        if (mode.isTemplateMode) {
          goNext();
          return;
        }

        // 낙관적 UI 업데이트: Step 전환이 필요한 경우 먼저 UI 전환 후 백그라운드 저장
        const needsOptimisticUpdate =
          (currentStep === 4 && !generatePlansFlag) ||
          currentStep === 5 ||
          (currentStep === 6 && !generatePlansFlag);

        if (needsOptimisticUpdate) {
          // 1. 먼저 다음 단계로 UI 전환 (즉각적인 반응)
          const nextStep: WizardStep = currentStep === 4 ? 5 : currentStep === 5 ? 6 : 7;
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

        // 플랜 생성이 필요한 경우: 기존 동기 방식 유지
        // 1. Create or Update Plan Group
        const finalGroupId = await createOrUpdatePlanGroup();
        setDraftGroupId(finalGroupId);

        // 2. Plan Generation (Generate Real Plans)
        if (generatePlansFlag) {
          await generatePlans(finalGroupId);
          // 플랜 생성 후 Step 7로 이동 (리다이렉트는 Step 7 완료 버튼에서 처리)
          goToStep(7);
        } else {
          goNext();
        }
      } catch (error) {
        console.error("[usePlanSubmission] Submit failed", error);
        const planGroupError = toPlanGroupError(
          error,
          PlanGroupErrorCodes.UNKNOWN_ERROR
        );
        // 사용자에게 명확한 에러 메시지 표시
        toast.showError(planGroupError.userMessage);
        setValidationErrors([planGroupError.userMessage]);
      }
    },
    [
      isSubmitting,
      validatePeriod,
      createOrUpdatePlanGroup,
      generatePlans,
      currentStep,
      setDraftGroupId,
      goToStep,
      goNext,
      setValidationErrors,
      toast,
      mode.isTemplateMode,
    ]
  );
  
  return {
    isSubmitting,
    executeSave,
    handleSubmit
  };
}
