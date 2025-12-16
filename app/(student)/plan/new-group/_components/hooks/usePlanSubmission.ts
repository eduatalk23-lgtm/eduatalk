import { useCallback } from "react";
import { WizardData, WizardStep } from "../PlanGroupWizard";
import { usePlanValidator } from "./usePlanValidator";
import { usePlanDraft } from "./usePlanDraft";
import { usePlanGenerator } from "./usePlanGenerator";
import { useWizardNavigation } from "./useWizardNavigation";

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
  };
  onSaveRequest?: (saveFn: () => Promise<void>) => void;
  mode: {
    isCampMode: boolean;
    isTemplateMode: boolean;
    isAdminMode: boolean;
    isAdminContinueMode: boolean;
    isEditMode: boolean;
  };
};

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
}: UsePlanSubmissionProps) {
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
    campInvitationId,
    initialData,
  });

  const { generatePlans, createOrUpdatePlanGroup, isGenerating } = usePlanGenerator({
    wizardData,
    draftGroupId,
    setValidationErrors,
    isCampMode: mode.isCampMode,
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
              // 에러는 createOrUpdatePlanGroup 내부에서 토스트로 표시됨
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
        // 에러는 각 훅에서 처리됨
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
    ]
  );
  
  return {
    isSubmitting,
    executeSave,
    handleSubmit
  };
}
