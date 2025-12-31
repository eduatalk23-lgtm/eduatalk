/**
 * usePlanDraft - 임시 저장 로직 훅
 * 
 * 자동/수동 임시 저장 로직을 담당합니다.
 */

import { useState, useCallback } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import type { WizardData } from "../PlanGroupWizard";
import {
  toPlanGroupError,
  PlanGroupError,
  PlanGroupErrorCodes,
} from "@/lib/errors/planGroupErrors";
import {
  savePlanGroupDraftAction,
  updatePlanGroupDraftAction,
} from "@/lib/domains/plan";
import { usePlanPayloadBuilder } from "./usePlanPayloadBuilder";
import { validatePeriod } from "../utils/validationUtils";

/**
 * 초기 데이터 타입 (템플릿 또는 기존 그룹에서 로드된 데이터)
 */
type InitialData = Partial<WizardData> & {
  templateId?: string;
  student_id?: string;
  studentId?: string;
  groupId?: string;
  templateProgramType?: string;
  templateStatus?: string;
  _startStep?: number;
  _validationErrors?: string[];
  contents?: WizardData["student_contents"];
};

type UsePlanDraftProps = {
  wizardData: WizardData;
  draftGroupId: string | null;
  setDraftGroupId: (id: string) => void;
  setValidationErrors: (errors: string[]) => void;
  isCampMode: boolean;
  isTemplateMode?: boolean; // 템플릿 모드 여부
  campInvitationId?: string;
  initialData?: InitialData;
  onSaveSuccess?: () => void; // 저장 성공 시 콜백 (dirty 상태 리셋용)
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
  isTemplateMode = false,
  campInvitationId,
  initialData,
  onSaveSuccess,
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
      // 템플릿 모드일 때는 임시 저장을 건너뛰기 (템플릿은 별도 저장 로직 사용)
      if (isTemplateMode) {
        if (!silent) {
          toast.showInfo("템플릿 모드에서는 저장 버튼을 사용해주세요.");
        }
        return;
      }

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
          // 저장 성공 시 콜백 호출 (dirty 상태 리셋)
          onSaveSuccess?.();
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
            // 저장 성공 시 콜백 호출 (dirty 상태 리셋)
            onSaveSuccess?.();
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
      isTemplateMode,
      campInvitationId,
      initialData,
      wizardData,
      onSaveSuccess,
    ]
  );

  return {
    saveDraft,
    isSaving,
  };
}

