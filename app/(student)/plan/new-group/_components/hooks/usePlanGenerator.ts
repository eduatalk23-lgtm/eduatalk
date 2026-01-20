/**
 * usePlanGenerator - 플랜 생성 훅
 *
 * Payload 생성 및 플랜 생성 API 호출을 담당합니다.
 *
 * Phase 3.1: 여러 콘텐츠 → 여러 plan_group 생성 지원
 * - Planner 자동 생성 (ensurePlanner)
 * - 각 콘텐츠별 단일 plan_group 생성 (createMultiplePlanGroups)
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
import { isErrorResult } from "@/lib/errors";
import {
  createPlanGroupAction,
  updatePlanGroupDraftAction,
  updatePlanGroupStatus,
  getOrCreateDefaultPlannerAction,
} from "@/lib/domains/plan";
import { generatePlansFromGroupAction } from "@/lib/domains/plan";
import { continueCampStepsForAdmin } from "@/lib/domains/camp/actions";
import { submitCampParticipation } from "@/lib/domains/camp";
import { usePlanPayloadBuilder, type SingleContentPayload } from "./usePlanPayloadBuilder";
import { validatePeriod } from "../utils/validationUtils";
import { planGeneratorLogger } from "../utils/wizardLogger";

type UsePlanGeneratorProps = {
  wizardData: WizardData;
  draftGroupId: string | null;
  setValidationErrors: (errors: string[]) => void;
  isCampMode: boolean;
  isTemplateMode?: boolean; // 템플릿 모드 여부
  campInvitationId?: string;
  initialData?: {
    templateId?: string;
    groupId?: string;
    studentId?: string;
    student_id?: string;
  };
  isAdminContinueMode: boolean;
  isAdminMode: boolean;
  currentStep: number;
};

/**
 * Phase 3.1: 여러 plan_group 생성 결과
 */
export type MultipleGroupsCreationResult = {
  plannerId: string;
  groupIds: string[];
  totalCount: number;
};

/**
 * Phase 3.1: 진행 상태 콜백
 */
export type ProgressCallback = (current: number, total: number, phase: string) => void;

type UsePlanGeneratorReturn = {
  generatePlans: (groupId: string) => Promise<void>;
  createOrUpdatePlanGroup: () => Promise<string>;
  isGenerating: boolean;
  /** Phase 3.1: Planner 확보 (없으면 자동 생성) */
  ensurePlanner: () => Promise<string>;
  /** Phase 3.1: 여러 단일 콘텐츠 plan_group 생성 */
  createMultiplePlanGroups: (
    onProgress?: ProgressCallback
  ) => Promise<MultipleGroupsCreationResult>;
  /** Phase 3.1: 여러 plan_group에 대해 플랜 생성 */
  generatePlansForMultipleGroups: (
    groupIds: string[],
    onProgress?: ProgressCallback
  ) => Promise<{ totalPlans: number; successCount: number; failedCount: number }>;
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
  setValidationErrors,
  isCampMode,
  isTemplateMode = false,
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
  const {
    build: buildPayload,
    buildSingleContentPayloads,
  } = usePlanPayloadBuilder(wizardData, {
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
      planGeneratorLogger.error("Payload 빌드 실패", err, { hook: "usePlanGenerator" });
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
      const updateResult = await updatePlanGroupDraftAction(draftGroupId, creationData);

      // 에러 결과 체크 (Server Action이 throw 대신 에러 객체 반환)
      if (isErrorResult(updateResult)) {
        throw new PlanGroupError(
          updateResult.error.message,
          PlanGroupErrorCodes.DRAFT_UPDATE_FAILED,
          updateResult.error.message,
          true
        );
      }
      finalGroupId = draftGroupId;
    } else {
      // 템플릿 모드일 때는 플랜 그룹을 생성하지 않음
      if (isTemplateMode) {
        throw new Error("템플릿 모드에서는 플랜 그룹을 생성할 수 없습니다.");
      }

      // 캠프 모드 Step 4에서 제출 시 콘텐츠 검증 건너뛰기
      const skipContentValidation = isCampMode && currentStep === 4 && !isAdminContinueMode;
      
      // 관리자 모드일 때는 studentId를 옵션으로 전달
      const options: { skipContentValidation?: boolean; studentId?: string | null } = {
        skipContentValidation,
      };
      
      // 관리자 모드이고 initialData에 studentId가 있으면 전달
      if (isAdminMode && initialData?.studentId) {
        options.studentId = initialData.studentId;
      } else if (isAdminMode && initialData?.student_id) {
        options.studentId = initialData.student_id;
      }
      
      const result = await createPlanGroupAction(creationData, options);

      // 에러 결과 체크 (Server Action이 throw 대신 에러 객체 반환)
      if (isErrorResult(result)) {
        throw new PlanGroupError(
          result.error.message,
          PlanGroupErrorCodes.PLAN_GROUP_CREATE_FAILED,
          result.error.message
        );
      }

      if (!result?.groupId) {
        throw new PlanGroupError(
          "플랜 그룹 생성 실패",
          PlanGroupErrorCodes.PLAN_GROUP_CREATE_FAILED,
          ErrorUserMessages[PlanGroupErrorCodes.PLAN_GROUP_CREATE_FAILED]
        );
      }
      finalGroupId = result.groupId;
    }

    // Note: updatePlanGroupStatus("saved") 호출 제거
    // - createPlanGroupAction/updatePlanGroupDraftAction 내부에서 이미 상태 관리됨
    // - 별도 네트워크 요청으로 인한 지연 방지

    return finalGroupId;
  }, [
    wizardData,
    isCampMode,
    isTemplateMode,
    isAdminMode,
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
          // 플랜 생성 전 상태를 "saved"로 변경 (필수: generatePlansFromGroupAction은 saved/active 상태만 허용)
          await updatePlanGroupStatus(groupId, "saved");
          const result = await generatePlansFromGroupAction(groupId);
          toast.showSuccess(`플랜이 생성되었습니다. (총 ${result.count}개)`);
          // 리다이렉트 제거 - Step 7로 이동하도록 상위에서 처리
          // Step 7에서 완료 버튼을 눌렀을 때만 상세보기 페이지로 이동
        }
      } catch (error) {
        planGeneratorLogger.error("플랜 생성 실패", error, { hook: "usePlanGenerator" });
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

  /**
   * Phase 3.1: Planner 확보 (없으면 자동 생성)
   *
   * 학생에게 기본 Planner가 없으면 자동으로 생성합니다.
   *
   * @returns Planner ID
   */
  const ensurePlanner = useCallback(async (): Promise<string> => {
    try {
      // 관리자 모드일 때는 studentId 전달
      const options: { studentId?: string } = {};
      if (isAdminMode && initialData?.studentId) {
        options.studentId = initialData.studentId;
      } else if (isAdminMode && initialData?.student_id) {
        options.studentId = initialData.student_id;
      }

      // 기간 정보 및 스케줄러 옵션을 추가
      const plannerOptions = {
        ...options,
        periodStart: wizardData.period_start,
        periodEnd: wizardData.period_end,
        name: `${wizardData.name || "학습"} 플래너`,
        schedulerOptions: wizardData.scheduler_options,
      };

      const result = await getOrCreateDefaultPlannerAction(plannerOptions);

      if (isErrorResult(result)) {
        throw new PlanGroupError(
          result.error.message,
          PlanGroupErrorCodes.PLAN_GROUP_CREATE_FAILED,
          "플래너 생성에 실패했습니다."
        );
      }

      planGeneratorLogger.info(
        `Planner ${result.isNew ? "created" : "found"}: ${result.plannerId}`,
        { hook: "usePlanGenerator", data: { plannerName: result.plannerName } }
      );

      return result.plannerId;
    } catch (error) {
      planGeneratorLogger.error("Planner 확보 실패", error, { hook: "usePlanGenerator" });
      const planGroupError = toPlanGroupError(
        error,
        PlanGroupErrorCodes.PLAN_GROUP_CREATE_FAILED
      );
      setValidationErrors([planGroupError.userMessage]);
      toast.showError(planGroupError.userMessage);
      throw error;
    }
  }, [isAdminMode, initialData, wizardData, setValidationErrors, toast]);

  /**
   * Phase 3.1: 여러 단일 콘텐츠 plan_group 생성
   *
   * 각 콘텐츠별로 별도의 plan_group을 생성하고, 모두 동일한 Planner에 연결합니다.
   *
   * @param onProgress 진행 상태 콜백
   * @returns 생성 결과 (plannerId, groupIds, totalCount)
   */
  const createMultiplePlanGroups = useCallback(
    async (
      onProgress?: ProgressCallback
    ): Promise<MultipleGroupsCreationResult> => {
      // 기간 검증
      const periodValidation = validatePeriod(wizardData, isCampMode);
      if (!periodValidation.isValid && periodValidation.error) {
        setValidationErrors([periodValidation.error]);
        toast.showError(periodValidation.error);
        throw new Error(periodValidation.error);
      }

      // 템플릿 모드 검증
      if (isTemplateMode) {
        throw new Error("템플릿 모드에서는 플랜 그룹을 생성할 수 없습니다.");
      }

      // 단일 콘텐츠 페이로드 빌드
      let payloads: SingleContentPayload[];
      try {
        payloads = buildSingleContentPayloads();
      } catch (err: unknown) {
        planGeneratorLogger.error("Payload 빌드 실패", err, { hook: "usePlanGenerator" });
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

      if (payloads.length === 0) {
        throw new PlanGroupError(
          "콘텐츠가 선택되지 않았습니다.",
          PlanGroupErrorCodes.VALIDATION_FAILED,
          "최소 1개 이상의 콘텐츠를 선택해주세요."
        );
      }

      const total = payloads.length;
      onProgress?.(0, total, "ensuring_planner");

      // 1. Planner 확보
      const plannerId = await ensurePlanner();
      onProgress?.(0, total, "creating_groups");

      // 2. 각 콘텐츠별 plan_group 생성
      const groupIds: string[] = [];

      // 관리자 모드 옵션 설정
      const options: { skipContentValidation?: boolean; studentId?: string | null } = {
        skipContentValidation: false,
      };
      if (isAdminMode && initialData?.studentId) {
        options.studentId = initialData.studentId;
      } else if (isAdminMode && initialData?.student_id) {
        options.studentId = initialData.student_id;
      }

      for (let i = 0; i < payloads.length; i++) {
        const payload = payloads[i];
        onProgress?.(i, total, "creating_groups");

        // Planner ID 연결
        const dataWithPlanner = {
          ...payload,
          planner_id: plannerId,
        };

        // Camp Mode Overrides (해당되는 경우)
        if (isCampMode) {
          dataWithPlanner.block_set_id = null;
          if (campInvitationId) dataWithPlanner.camp_invitation_id = campInvitationId;
          if (initialData?.templateId) dataWithPlanner.camp_template_id = initialData.templateId;
          dataWithPlanner.plan_type = "camp";
        }

        const result = await createPlanGroupAction(dataWithPlanner, options);

        if (isErrorResult(result)) {
          planGeneratorLogger.error(
            `Plan group ${i + 1}/${total} 생성 실패`,
            result.error,
            { hook: "usePlanGenerator", data: { contentId: payload.single_content_id } }
          );
          throw new PlanGroupError(
            result.error.message,
            PlanGroupErrorCodes.PLAN_GROUP_CREATE_FAILED,
            `${payload.name || payload.contentTitle} 생성에 실패했습니다.`
          );
        }

        if (!result?.groupId) {
          throw new PlanGroupError(
            "플랜 그룹 생성 실패",
            PlanGroupErrorCodes.PLAN_GROUP_CREATE_FAILED,
            ErrorUserMessages[PlanGroupErrorCodes.PLAN_GROUP_CREATE_FAILED]
          );
        }

        groupIds.push(result.groupId);
        planGeneratorLogger.info(`Plan group ${i + 1}/${total} created: ${result.groupId}`, {
          hook: "usePlanGenerator",
          data: { contentTitle: payload.contentTitle },
        });
      }

      onProgress?.(total, total, "completed");

      return {
        plannerId,
        groupIds,
        totalCount: groupIds.length,
      };
    },
    [
      wizardData,
      isCampMode,
      isTemplateMode,
      isAdminMode,
      buildSingleContentPayloads,
      ensurePlanner,
      campInvitationId,
      initialData,
      setValidationErrors,
      toast,
    ]
  );

  /**
   * Phase 3.1: 여러 plan_group에 대해 플랜 생성
   *
   * @param groupIds 플랜 그룹 ID 배열
   * @param onProgress 진행 상태 콜백
   * @returns 생성 결과
   */
  const generatePlansForMultipleGroups = useCallback(
    async (
      groupIds: string[],
      onProgress?: ProgressCallback
    ): Promise<{ totalPlans: number; successCount: number; failedCount: number }> => {
      setIsGenerating(true);
      let totalPlans = 0;
      let successCount = 0;
      let failedCount = 0;

      try {
        const total = groupIds.length;

        for (let i = 0; i < groupIds.length; i++) {
          const groupId = groupIds[i];
          onProgress?.(i, total, "generating_plans");

          try {
            // 상태를 "saved"로 변경
            await updatePlanGroupStatus(groupId, "saved");

            // 플랜 생성
            const result = await generatePlansFromGroupAction(groupId);
            totalPlans += result.count;
            successCount++;

            planGeneratorLogger.info(
              `Plans generated for group ${i + 1}/${total}: ${result.count} plans`,
              { hook: "usePlanGenerator", data: { groupId } }
            );
          } catch (error) {
            failedCount++;
            planGeneratorLogger.error(
              `Plan generation failed for group ${i + 1}/${total}`,
              error,
              { hook: "usePlanGenerator", data: { groupId } }
            );
            // 개별 실패는 계속 진행 (전체 중단하지 않음)
          }
        }

        onProgress?.(total, total, "finalizing");

        if (successCount > 0) {
          toast.showSuccess(
            `플랜이 생성되었습니다. (${successCount}개 그룹, 총 ${totalPlans}개 플랜)`
          );
        }

        if (failedCount > 0) {
          toast.showError(`${failedCount}개 그룹에서 플랜 생성에 실패했습니다.`);
        }

        return { totalPlans, successCount, failedCount };
      } catch (error) {
        planGeneratorLogger.error("Multiple groups plan generation failed", error, {
          hook: "usePlanGenerator",
        });
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
    [toast, setValidationErrors]
  );

  return {
    generatePlans,
    createOrUpdatePlanGroup,
    isGenerating,
    // Phase 3.1
    ensurePlanner,
    createMultiplePlanGroups,
    generatePlansForMultipleGroups,
  };
}

