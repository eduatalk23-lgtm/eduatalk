/**
 * usePlanGenerator - 플랜 생성 훅
 * 
 * Payload 생성 및 플랜 생성 API 호출을 담당합니다.
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { WizardData } from "../PlanGroupWizard";
import {
  toPlanGroupError,
  PlanGroupError,
  PlanGroupErrorCodes,
  ErrorUserMessages,
} from "@/lib/errors/planGroupErrors";
import {
  createPlanGroupAction,
  updatePlanGroupStatus,
} from "@/app/(student)/actions/planGroupActions";
import { usePlanPayloadBuilder } from "./usePlanPayloadBuilder";
import { validatePeriod } from "../utils/validationUtils";

type UsePlanGeneratorProps = {
  wizardData: WizardData;
  draftGroupId: string | null;
  setDraftGroupId: (id: string) => void;
  setValidationErrors: (errors: string[]) => void;
  isCampMode: boolean;
  campInvitationId?: string;
  initialData?: any;
  isAdminContinueMode: boolean;
  isAdminMode: boolean;
  currentStep: number;
};

type UsePlanGeneratorReturn = {
  generatePlans: (groupId: string) => Promise<void>;
  createOrUpdatePlanGroup: () => Promise<string>;
  isGenerating: boolean;
};

/**
 * usePlanGenerator 훅
 * 
 * 플랜 생성 로직을 제공합니다.
 * 
 * @param props 위저드 데이터 및 설정
 * @returns 플랜 생성 함수 및 상태
 */
export function usePlanGenerator({
  wizardData,
  draftGroupId,
  setDraftGroupId,
  setValidationErrors,
  isCampMode,
  campInvitationId,
  initialData,
  isAdminContinueMode,
  isAdminMode,
  currentStep,
}: UsePlanGeneratorProps): UsePlanGeneratorReturn {
  const router = useRouter();
  const toast = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  // Payload Builder Hook
  const { build: buildPayload } = usePlanPayloadBuilder(wizardData, {
    validateOnBuild: true,
    isCampMode,
  });

  /**
   * 플랜 그룹 생성 또는 업데이트
   * 
   * @returns 생성된 그룹 ID
   */
  const createOrUpdatePlanGroup = useCallback(async (): Promise<string> => {
    // 기간 검증: 공통 검증 함수 사용
    const periodValidation = validatePeriod(wizardData, isCampMode);
    if (!periodValidation.isValid && periodValidation.error) {
      setValidationErrors([periodValidation.error]);
      toast.showError(periodValidation.error);
      throw new Error(periodValidation.error);
    }

    // Payload Build
    let creationData;
    try {
      creationData = buildPayload();
    } catch (err: unknown) {
      console.error("Payload Build Error (Submit)", err);
      const msg =
        err instanceof PlanGroupError
          ? err.userMessage
          : err instanceof Error
          ? err.message
          : "데이터 변환 오류";
      setValidationErrors([msg]);
      toast.showError(msg);
      throw new Error(msg);
    }

    // Camp Mode Overrides
    if (isCampMode) {
      creationData.block_set_id = null;
      if (campInvitationId) creationData.camp_invitation_id = campInvitationId;
      if (initialData?.templateId) creationData.camp_template_id = initialData.templateId;
      creationData.plan_type = "camp";
    }

    let finalGroupId: string;

    // Create or Update Plan Group
    if (draftGroupId) {
      const { updatePlanGroupDraftAction } = await import("@/app/(student)/actions/planGroupActions");
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

    // Update Status to 'saved'
    try {
      await updatePlanGroupStatus(finalGroupId, "saved");
    } catch (error) {
      console.warn("[usePlanGenerator] Status update failed", error);
    }

    return finalGroupId;
  }, [
    wizardData,
    isCampMode,
    buildPayload,
    draftGroupId,
    campInvitationId,
    initialData,
    currentStep,
    isAdminContinueMode,
    setValidationErrors,
    toast,
  ]);

  /**
   * 플랜 생성 실행
   * 
   * @param groupId 플랜 그룹 ID
   */
  const generatePlans = useCallback(
    async (groupId: string) => {
      setIsGenerating(true);
      try {
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
        if (!isAdminContinueMode && !campInvitationId) {
          const { generatePlansFromGroupAction } = await import("@/app/(student)/actions/plan-groups/plans");
          const result = await generatePlansFromGroupAction(groupId);
          toast.showSuccess(`플랜이 생성되었습니다. (총 ${result.count}개)`);
          router.push(`/plan/group/${groupId}`, { scroll: true });
        }
      } catch (error) {
        console.error("[usePlanGenerator] 플랜 생성 실패:", error);
        const planGroupError = toPlanGroupError(
          error,
          PlanGroupErrorCodes.PLAN_GENERATION_FAILED
        );
        setValidationErrors([planGroupError.userMessage]);
        toast.showError(planGroupError.userMessage);
        throw error;
      } finally {
        setIsGenerating(false);
      }
    },
    [
      isAdminContinueMode,
      initialData,
      draftGroupId,
      wizardData,
      currentStep,
      campInvitationId,
      isAdminMode,
      toast,
      router,
      setValidationErrors,
    ]
  );

  return {
    generatePlans,
    createOrUpdatePlanGroup,
    isGenerating,
  };
}

