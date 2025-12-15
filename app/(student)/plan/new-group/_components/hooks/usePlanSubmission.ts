
import { useCallback } from "react";
import { WizardData, WizardStep } from "../PlanGroupWizard";
import {
  toPlanGroupError,
  PlanGroupErrorCodes,
} from "@/lib/errors/planGroupErrors";
import { usePlanValidator } from "./usePlanValidator";
import { usePlanDraft } from "./usePlanDraft";
import { usePlanGenerator } from "./usePlanGenerator";
import { useWizardNavigation } from "./useWizardNavigation";
import { shouldSubmitAtStep4, shouldSaveOnlyWithoutPlanGeneration } from "../utils/modeUtils";

type UsePlanSubmissionProps = {
  wizardData: WizardData;
  draftGroupId: string | null;
  setDraftGroupId: (id: string) => void;
  currentStep: WizardStep;
  setCurrentStep: (step: WizardStep) => void;
  setValidationErrors: (errors: string[]) => void;
  campInvitationId?: string;
  initialData?: any;
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
  const { validateStep, validatePeriod } = usePlanValidator({
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
    setDraftGroupId,
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
        // 0. 기간 검증
        const periodValidation = validatePeriod();
        if (!periodValidation.isValid && periodValidation.error) {
          setValidationErrors([periodValidation.error]);
          return;
        }

        // 1. Create or Update Plan Group
        const finalGroupId = await createOrUpdatePlanGroup();
        setDraftGroupId(finalGroupId);

        // 2. Handle Step Transitions (Create drafts only)
        if (currentStep === 4 && !generatePlansFlag) {
          // Step 4 -> 5
          goToStep(5);
          return;
        }
        if (currentStep === 5) {
          // Step 5 -> 6
          goToStep(6);
          return;
        }
        if (currentStep === 6 && !generatePlansFlag) {
          // Step 6 -> 7 (플랜 생성 없이)
          goToStep(7);
          return;
        }

        // 3. Plan Generation (Generate Real Plans)
        if (generatePlansFlag) {
          await generatePlans(finalGroupId);
          // generatePlans 내부에서 리다이렉트 처리됨
        } else {
          // 플랜 생성 없이 다음 단계로 이동
          if (currentStep === 6) {
            goToStep(7);
          } else {
            goNext();
          }
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
