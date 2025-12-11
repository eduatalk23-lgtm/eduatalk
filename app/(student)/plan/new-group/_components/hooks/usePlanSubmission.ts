
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { WizardData, WizardStep } from "../PlanGroupWizard";
import {
  toPlanGroupError,
  PlanGroupError,
  PlanGroupErrorCodes,
  ErrorUserMessages,
} from "@/lib/errors/planGroupErrors";
import {
  savePlanGroupDraftAction,
  updatePlanGroupDraftAction,
  createPlanGroupAction,
  updatePlanGroupStatus,
} from "@/app/(student)/actions/planGroupActions";
import { usePlanPayloadBuilder } from "./usePlanPayloadBuilder";

type UsePlanSubmissionProps = {
  wizardData: WizardData;
  draftGroupId: string | null;
  setDraftGroupId: (id: string) => void;
  currentStep: WizardStep;
  setCurrentStep: (step: WizardStep) => void;
  setValidationErrors: (errors: string[]) => void;
  isCampMode: boolean;
  campInvitationId?: string;
  initialData?: any;
  isAdminContinueMode: boolean;
  isAdminMode: boolean;
  onSaveRequest?: (saveFn: () => Promise<void>) => void;
};

export function usePlanSubmission({
  wizardData,
  draftGroupId,
  setDraftGroupId,
  currentStep,
  setCurrentStep,
  setValidationErrors,
  isCampMode,
  campInvitationId,
  initialData,
  isAdminContinueMode,
  isAdminMode,
}: UsePlanSubmissionProps) {
  const router = useRouter();
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Payload Builder Hook
  const { build: buildPayload } = usePlanPayloadBuilder(wizardData, {
    validateOnBuild: true,
  });

  /* -------------------------------------------------------------------------- */
  /*                             Draft Save Logic                               */
  /* -------------------------------------------------------------------------- */
  const executeSave = useCallback(
    async (silent: boolean = false) => {
      try {
        setValidationErrors([]);
        
        let creationData;
        try {
           creationData = buildPayload();
        } catch (err: any) {
           console.error("Payload Build Error", err);
           const msg = err instanceof PlanGroupError ? err.userMessage : err.message || "데이터 변환 중 오류가 발생했습니다.";
           setValidationErrors([msg]);
           if (!silent) toast.showError(msg);
           return;
        }

        // 캠프 모드/Draft 모드 특수 처리 (usePlanPayloadBuilder에서 처리했지만 안전장치)
        if (isCampMode) {
          creationData.block_set_id = null;
          if (campInvitationId) creationData.camp_invitation_id = campInvitationId;
          if (initialData?.templateId) creationData.camp_template_id = initialData.templateId;
          creationData.plan_type = "camp";
        }

        if (draftGroupId) {
          await updatePlanGroupDraftAction(draftGroupId, creationData);
          if (!silent) toast.showSuccess("저장되었습니다.");
        } else {
          const result = await savePlanGroupDraftAction(creationData);
          if (result?.groupId) {
            setDraftGroupId(result.groupId);
            if (!silent) toast.showSuccess("저장되었습니다.");
          } else {
            throw new PlanGroupError(
              "Draft 생성 결과가 없습니다.",
              PlanGroupErrorCodes.DRAFT_SAVE_FAILED,
              "임시 저장에 실패했습니다. 다시 시도해주세요.",
              true
            );
          }
        }
      } catch (error) {
        console.error("[usePlanSubmission] 임시 저장 실패:", error);
        const planGroupError = toPlanGroupError(error, PlanGroupErrorCodes.DRAFT_SAVE_FAILED);
        if (!silent) {
          setValidationErrors([planGroupError.userMessage]);
          toast.showError(planGroupError.userMessage);
        }
      }
    },
    [
      buildPayload,
      draftGroupId,
      setDraftGroupId,
      setValidationErrors,
      toast,
      isCampMode,
      campInvitationId,
      initialData,
    ]
  );

  /* -------------------------------------------------------------------------- */
  /*                             Final Submit Logic                             */
  /* -------------------------------------------------------------------------- */
  const handleSubmit = useCallback(
    async (generatePlans: boolean = true) => {
      if (isSubmitting) return;
      setIsSubmitting(true);
      setValidationErrors([]);

      try {
        // 1. Payload Build
        let creationData;
        try {
            creationData = buildPayload();
        } catch (err: any) {
            console.error("Payload Build Error (Submit)", err);
            const msg = err instanceof PlanGroupError ? err.userMessage : err.message || "데이터 변환 오류";
            setValidationErrors([msg]);
            toast.showError(msg);
            setIsSubmitting(false);
            return;
        }

        // 2. Camp Mode Overrides
        if (isCampMode) {
            creationData.block_set_id = null;
            if (campInvitationId) creationData.camp_invitation_id = campInvitationId;
            if (initialData?.templateId) creationData.camp_template_id = initialData.templateId;
            creationData.plan_type = "camp";
        }
        
        let finalGroupId: string;

        // 3. Create or Update Plan Group
        if (draftGroupId) {
          await updatePlanGroupDraftAction(draftGroupId, creationData);
          finalGroupId = draftGroupId;
        } else {
          // 캠프 모드 Step 4에서 제출 시 콘텐츠 검증 건너뛰기
          const skipContentValidation = isCampMode && currentStep === 4 && !isAdminContinueMode;
          const result = await createPlanGroupAction(creationData, { skipContentValidation });
          
          if (!result?.groupId) {
            throw new PlanGroupError(
              "플랜 그룹 생성 실패",
              PlanGroupErrorCodes.PLAN_GROUP_CREATE_FAILED,
              ErrorUserMessages[PlanGroupErrorCodes.PLAN_GROUP_CREATE_FAILED]
            );
          }
          finalGroupId = result.groupId;
        }

        // 4. Update Status to 'saved'
        try {
          await updatePlanGroupStatus(finalGroupId, "saved");
        } catch (error) {
          console.warn("[usePlanSubmission] Status update failed", error);
        }

        // 5. Handle Step Transitions (Create drafts only)
        if (currentStep === 4 && !generatePlans) { // Step 4 -> 5
             setDraftGroupId(finalGroupId);
             setCurrentStep(5);
             return;
        }
        if (currentStep === 5) { // Step 5 -> 6
            setDraftGroupId(finalGroupId);
            setCurrentStep(6);
            toast.showSuccess("저장되었습니다. 다음 단계에서 플랜을 생성합니다.");
            return;
        }
        if (currentStep === 6) { // Step 6 -> 7
            setDraftGroupId(finalGroupId);
            setCurrentStep(7);
            toast.showSuccess("저장되었습니다. 다음 단계에서 플랜을 생성합니다.");
            return;
        }

        // 6. Plan Generation (Generate Real Plans)
        if (generatePlans) {
             // 캠프 남은 단계 진행 (관리자)
             if (isAdminContinueMode && initialData?.templateId) {
                 const { continueCampStepsForAdmin } = await import("@/app/(admin)/actions/campTemplateActions");
                 await continueCampStepsForAdmin(
                     draftGroupId || (initialData?.groupId as string),
                     wizardData,
                     currentStep
                 );
                 toast.showSuccess("플랜이 생성되었습니다.");
                 window.location.href = `/admin/camp-templates/${initialData.templateId}/participants`;
                 return;
             }

             // 캠프 참여 제출 (학생)
             if (campInvitationId && !isAdminMode) {
                 const { submitCampParticipation } = await import("@/app/(student)/actions/campActions");
                 const result = await submitCampParticipation(campInvitationId, wizardData);
                 if (result.success && result.groupId) {
                     toast.showSuccess("캠프 참여가 완료되었습니다.");
                     const targetPath = result.invitationId 
                        ? `/camp/${result.invitationId}/submitted`
                        : `/plan/group/${result.groupId}`;
                     router.push(targetPath, { scroll: true });
                 } else {
                     throw new Error(result.error || "캠프 참여 실패");
                 }
                 return;
             }
             
             // 일반 플랜 생성
             // 이곳에서 생성 로직이 더 복잡하게 얽혀있었으나, 원래 로직이 Step 7에서 호출되기도 하고 여기서 호출되기도 함.
             // 이 함수는 'handleSubmit'으로 버튼 클릭 시 호출됨.
             // Step 7 진입 전에 생성하는 경우 (Step 6 -> 7 전 단계 완료 시)
             
             // ... 원래 코드에서는 Step 7 ScheduleResult 컴포넌트가 마운트되면서 생성을 트리거하거나,
             // 버튼 클릭으로 생성을 트리거함.
             // 여기서는 단순히 groupId를 반환하고 끝내는 게 아니라 실제 생성 액션을 호출해야 할 수도 있음.
             // 하지만 기존 로직을 보면 Step 7 컴포넌트 내부에서 onComplete 등으로 처리하기도 함.
             
             // 다만, "플랜 생성" 버튼을 눌렀을 때의 동작은:
             // 1. draft 저장
             // 2. generatePlansFromGroupAction 호출 (또는 이에 준하는 동작)
             // 
             // 기존 PlanGroupWizard.handleSubmit을 보면:
             // isAdminContinueMode 여부 등에 따라 분기 처리됨.
             // 일반적인 경우:
             // Step 7은 결과 화면일 뿐, 실제 생성은 이전 단계 완료시 일어남 ??
             // 아니면 Step 7에서 useEffect로?
             
             // PlanGroupWizard.tsx:1159~ 확인해보면,
             // generatePlans === true 이면
             // handleGeneratePlans()를 호출함.
             
             if (!isAdminContinueMode && !campInvitationId) {
                 // 일반 플랜 생성
                 const { generatePlansFromGroupAction } = await import("@/app/(student)/actions/plan-groups/plans");
                 // this action throws on error, so if we get here, it succeeded.
                 const result = await generatePlansFromGroupAction(finalGroupId);
                 toast.showSuccess(`플랜이 생성되었습니다. (총 ${result.count}개)`);
                 router.push(`/plan/group/${finalGroupId}`, { scroll: true });
             }
        }

      } catch (error) {
        console.error("[usePlanSubmission] Submit failed", error);
        const planGroupError = toPlanGroupError(error, PlanGroupErrorCodes.PLAN_GENERATION_FAILED);
        setValidationErrors([planGroupError.userMessage]);
        toast.showError(planGroupError.userMessage);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      isSubmitting, 
      buildPayload, 
      isCampMode, 
      campInvitationId, 
      initialData, 
      draftGroupId, 
      currentStep, 
      isAdminContinueMode, 
      isAdminMode, 
      setDraftGroupId, 
      setCurrentStep, 
      toast, 
      setValidationErrors, 
      wizardData, 
      router
    ]
  );
  
  return {
    isSubmitting,
    executeSave,
    handleSubmit
  };
}
