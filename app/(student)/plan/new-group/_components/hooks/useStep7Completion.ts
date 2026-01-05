/**
 * useStep7Completion - Step 7 완료 처리 훅
 *
 * Phase 3 코드 구조 개선: 훅 추출
 * PlanGroupWizard에서 Step 7 완료 로직을 분리하여 코드 가독성과 유지보수성을 향상시킵니다.
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/ToastProvider";
import {
  getActivePlanGroups,
  updatePlanGroupStatus,
  checkPlansExistAction,
} from "@/lib/domains/plan";
import {
  toPlanGroupError,
  PlanGroupErrorCodes,
  getErrorInfo,
  type PlanGroupError,
  type PlanGroupErrorCode,
} from "@/lib/errors/planGroupErrors";
import { wizardLogger } from "../utils/wizardLogger";
import type { StructuredError } from "../_context/reducers/validationReducer";

type UseStep7CompletionProps = {
  /** 플랜 그룹 ID */
  draftGroupId: string | null;
  /** 관리자 continue 모드 여부 */
  isAdminContinueMode: boolean;
  /** 구조화된 에러 설정 함수 (ErrorWithGuide용) */
  setStructuredErrors: (errors: StructuredError[]) => void;
};

type UseStep7CompletionReturn = {
  /** Step 7 완료 핸들러 */
  handleStep7Complete: () => Promise<void>;
  /** 활성화 다이얼로그 열림 여부 */
  activationDialogOpen: boolean;
  /** 활성화 다이얼로그 열림 상태 설정 */
  setActivationDialogOpen: (open: boolean) => void;
  /** 활성 플랜 그룹 이름 목록 */
  activeGroupNames: string[];
};

/**
 * useStep7Completion 훅
 *
 * Step 7에서 완료 버튼 클릭 시의 로직을 중앙화합니다.
 * - 관리자 continue 모드: 플랜 확인 후 상태 업데이트 및 관리자 페이지로 이동
 * - 일반 모드: 활성 그룹 확인 후 활성화 다이얼로그 표시 또는 직접 활성화
 */
export function useStep7Completion({
  draftGroupId,
  isAdminContinueMode,
  setStructuredErrors,
}: UseStep7CompletionProps): UseStep7CompletionReturn {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [activationDialogOpen, setActivationDialogOpen] = useState(false);
  const [activeGroupNames, setActiveGroupNames] = useState<string[]>([]);

  /**
   * Step 7 완료 핸들러
   */
  const handleStep7Complete = useCallback(async () => {
    if (!draftGroupId) return;

    // 관리자 continue 모드에서는 플랜이 이미 생성되어 있으므로 상태만 업데이트하고 페이지 이동
    if (isAdminContinueMode) {
      try {
        // 플랜이 생성되어 있는지 확인
        const checkResult = await checkPlansExistAction(draftGroupId);

        if (!checkResult.hasPlans) {
          const errorCode = PlanGroupErrorCodes.PLAN_GENERATION_FAILED;
          const errorInfo = getErrorInfo(errorCode);
          toast.showError(errorInfo.message);
          setStructuredErrors([{ code: errorCode }]);
          return;
        }

        // 플랜 그룹 상태를 saved로 업데이트 (이미 Step 7 진입 시 생성됨)
        try {
          await updatePlanGroupStatus(draftGroupId, "saved");
        } catch (statusError) {
          wizardLogger.warn("상태 업데이트 실패 (무시)", { hook: "useStep7Completion", data: { error: statusError } });
        }

        toast.showSuccess("플랜 생성이 완료되었습니다.");

        // 플랜 그룹 상세 보기 페이지로 이동 (완전한 페이지 리로드)
        window.location.href = `/admin/plan-groups/${draftGroupId}`;
      } catch (error) {
        wizardLogger.error("관리자 캠프 완료 처리 실패", error, { hook: "useStep7Completion" });
        const planGroupError = toPlanGroupError(error, PlanGroupErrorCodes.UNKNOWN_ERROR);
        const errorCode = planGroupError.code as PlanGroupErrorCode;
        setStructuredErrors([{ code: errorCode, message: planGroupError.userMessage }]);
        toast.showError(planGroupError.userMessage);
      }
      return;
    }

    // 일반 모드(학생 모드)에서는 플랜이 생성되었는지 확인만 수행
    // 플랜 생성은 Step 7 진입 시 자동으로 완료되므로 여기서는 확인만
    try {
      const checkResult = await checkPlansExistAction(draftGroupId);
      if (!checkResult.hasPlans) {
        // 플랜이 없으면 에러 표시 (Step 7에서 이미 생성되어야 함)
        const errorCode = PlanGroupErrorCodes.PLAN_GENERATION_FAILED;
        toast.showError("플랜이 생성되지 않았습니다. 플랜 재생성 버튼을 클릭해주세요.");
        setStructuredErrors([{ code: errorCode }]);
        return;
      }
    } catch (error) {
      // 플랜 확인 실패는 경고만 표시하고 계속 진행 (네트워크 문제일 수 있음)
      const planGroupError = toPlanGroupError(error, PlanGroupErrorCodes.UNKNOWN_ERROR);
      wizardLogger.warn("플랜 확인 실패", { hook: "useStep7Completion", data: { message: planGroupError.userMessage } });
    }

    // 완료 버튼 클릭 시 활성화 다이얼로그 표시를 위해 다른 활성 플랜 그룹 확인
    // (자동 활성화는 하지 않음 - 사용자가 완료 버튼을 눌렀을 때만 활성화)
    let currentActiveGroupNames: string[] = [];
    try {
      const activeGroups = await getActivePlanGroups(draftGroupId);
      if (activeGroups.length > 0) {
        // 다른 활성 플랜 그룹이 있으면 이름 저장 (완료 버튼 클릭 시 다이얼로그 표시)
        currentActiveGroupNames = activeGroups.map((g) => g.name || "플랜 그룹");
        setActiveGroupNames(currentActiveGroupNames);
      }
      // 다른 활성 플랜 그룹이 없어도 자동 활성화하지 않음
      // 사용자가 완료 버튼을 눌렀을 때만 활성화됨
    } catch (error) {
      // 활성 그룹 확인 실패는 경고만 (필수가 아니므로)
      const planGroupError = toPlanGroupError(error, PlanGroupErrorCodes.UNKNOWN_ERROR);
      wizardLogger.warn("플랜 그룹 활성 그룹 확인 실패", { hook: "useStep7Completion", data: { error: planGroupError } });
    }

    // 완료 버튼을 눌렀을 때만 활성화 및 리다이렉트
    // 다른 활성 플랜 그룹이 있으면 활성화 다이얼로그 표시
    if (currentActiveGroupNames.length > 0) {
      setActivationDialogOpen(true);
    } else {
      // 다른 활성 플랜 그룹이 없으면 활성화 후 리다이렉트
      try {
        // saved 상태로 먼저 변경 시도 (이미 saved 상태면 에러 없이 성공)
        try {
          await updatePlanGroupStatus(draftGroupId, "saved");
        } catch (savedError) {
          // saved 상태 변경 실패는 무시 (이미 saved 상태일 수 있음)
          wizardLogger.warn("플랜 그룹 saved 상태 변경 실패 (무시)", { hook: "useStep7Completion", data: { error: savedError } });
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
        // 활성화 실패 시 구체적인 에러 로깅 후 리다이렉트
        const planGroupError = toPlanGroupError(statusError, PlanGroupErrorCodes.PLAN_GROUP_UPDATE_FAILED);
        wizardLogger.warn("플랜 그룹 활성화 실패", {
          hook: "useStep7Completion",
          data: {
            code: planGroupError.code,
            message: planGroupError.userMessage,
            context: planGroupError.context,
          },
        });
        // 플랜은 생성되었으므로 저장된 상태로 이동 (활성화만 실패한 경우)
        toast.showInfo("플랜이 저장되었습니다. 활성화는 상세 페이지에서 진행해주세요.");
        router.refresh(); // 캐시 갱신
        router.push(`/plan/group/${draftGroupId}`, { scroll: true });
      }
    }
  }, [draftGroupId, isAdminContinueMode, toast, setStructuredErrors, router, queryClient]);

  return {
    handleStep7Complete,
    activationDialogOpen,
    setActivationDialogOpen,
    activeGroupNames,
  };
}
