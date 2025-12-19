/**
 * usePlanDraft - 임시 저장 로직 훅
 * 
 * 자동/수동 임시 저장 로직을 담당합니다.
 */

import { useState, useCallback } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { WizardData } from "../PlanGroupWizard";
import {
  toPlanGroupError,
  PlanGroupError,
  PlanGroupErrorCodes,
} from "@/lib/errors/planGroupErrors";
import {
  savePlanGroupDraftAction,
  updatePlanGroupDraftAction,
} from "@/app/(student)/actions/planGroupActions";
import { usePlanPayloadBuilder } from "./usePlanPayloadBuilder";
import { validatePeriod } from "../utils/validationUtils";

type UsePlanDraftProps = {
  wizardData: WizardData;
  draftGroupId: string | null;
  setDraftGroupId: (id: string) => void;
  setValidationErrors: (errors: string[]) => void;
  isCampMode: boolean;
  campInvitationId?: string;
  initialData?: any;
};

type UsePlanDraftReturn = {
  saveDraft: (silent?: boolean) => Promise<void>;
  isSaving: boolean;
};

/**
 * usePlanDraft 훅
 * 
 * 임시 저장 로직을 제공합니다.
 * 
 * @param props 위저드 데이터 및 설정
 * @returns 저장 함수 및 상태
 */
export function usePlanDraft({
  wizardData,
  draftGroupId,
  setDraftGroupId,
  setValidationErrors,
  isCampMode,
  campInvitationId,
  initialData,
}: UsePlanDraftProps): UsePlanDraftReturn {
  const toast = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // Payload Builder Hook
  const { build: buildPayload } = usePlanPayloadBuilder(wizardData, {
    validateOnBuild: true,
    isCampMode,
  });

  /**
   * 임시 저장 실행
   * 
   * @param silent 조용한 모드 (토스트 메시지 표시 안 함)
   */
  const saveDraft = useCallback(
    async (silent: boolean = false) => {
      setIsSaving(true);
      try {
        setValidationErrors([]);

        // 기간 검증: 공통 검증 함수 사용
        const periodValidation = validatePeriod(wizardData, isCampMode);
        if (!periodValidation.isValid && periodValidation.error) {
          setValidationErrors([periodValidation.error]);
          if (!silent) toast.showError(periodValidation.error);
          return;
        }

        let creationData;
        try {
          creationData = buildPayload();
        } catch (err: unknown) {
          console.error("Payload Build Error", err);
          const msg =
            err instanceof PlanGroupError
              ? err.userMessage
              : err instanceof Error
              ? err.message
              : "데이터 변환 중 오류가 발생했습니다.";
          setValidationErrors([msg]);
          if (!silent) toast.showError(msg);
          return;
        }

        // 캠프 모드/Draft 모드 특수 처리
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
          // 관리자 모드일 때는 draftGroupId를 옵션으로 전달 (기존 그룹에서 student_id 조회용)
          // initialData에 student_id 또는 studentId가 있으면 그것을 사용
          // initialData에 groupId가 있으면 그것을 draftGroupId로 사용
          const studentId = initialData?.student_id || initialData?.studentId;
          const groupIdFromInitialData = initialData?.groupId;
          const options = studentId
            ? { studentId }
            : groupIdFromInitialData
            ? { draftGroupId: groupIdFromInitialData }
            : draftGroupId
            ? { draftGroupId }
            : undefined;

          const result = await savePlanGroupDraftAction(creationData, options);
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
        console.error("[usePlanDraft] 임시 저장 실패:", error);
        const planGroupError = toPlanGroupError(
          error,
          PlanGroupErrorCodes.DRAFT_SAVE_FAILED
        );
        if (!silent) {
          setValidationErrors([planGroupError.userMessage]);
          toast.showError(planGroupError.userMessage);
        }
      } finally {
        setIsSaving(false);
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
      wizardData,
    ]
  );

  return {
    saveDraft,
    isSaving,
  };
}

