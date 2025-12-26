/**
 * useWizardStepHandlers - 위저드 단계 핸들러 훅
 *
 * Phase 3 코드 구조 개선: 훅 추출
 * PlanGroupWizard에서 단계 네비게이션 로직을 분리하여 코드 가독성과 유지보수성을 향상시킵니다.
 */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import type { WizardStep, WizardData, ExtendedInitialData } from "../PlanGroupWizard";
import {
  type WizardMode,
  canGoBack,
  shouldSubmitAtStep4,
  shouldSaveOnlyWithoutPlanGeneration,
} from "../utils/modeUtils";

type UseWizardStepHandlersProps = {
  // 현재 상태
  currentStep: WizardStep;
  isDirty: boolean;
  draftGroupId: string | null;

  // 모드 정보
  mode: WizardMode;
  isTemplateMode: boolean;
  isEditMode: boolean;
  isCampMode: boolean;
  campInvitationId?: string;
  initialData?: ExtendedInitialData;

  // 네비게이션 함수
  nextStep: () => void;
  prevStep: () => void;
  setStep: (step: WizardStep) => void;

  // 검증 함수
  validateStep: (step: WizardStep) => boolean;

  // 제출 함수
  handleSubmit: (generatePlans?: boolean) => Promise<void>;
  handleSaveDraft: (silent?: boolean) => Promise<void>;

  // 스크롤 함수
  handleValidationFailed: () => void;
};

type UseWizardStepHandlersReturn = {
  /** 다음 단계로 이동 */
  handleNext: () => Promise<void>;
  /** 이전 단계로 이동 */
  handleBack: () => void;
  /** 취소 버튼 핸들러 */
  handleCancel: () => void;
};

/**
 * useWizardStepHandlers 훅
 *
 * 위저드의 단계 네비게이션 로직을 중앙화합니다.
 * - handleNext: 다음 단계로 이동 (검증, 저장, 제출 포함)
 * - handleBack: 이전 단계로 이동
 * - handleCancel: 취소 (변경 사항 확인 포함)
 */
export function useWizardStepHandlers({
  currentStep,
  isDirty,
  draftGroupId,
  mode,
  isTemplateMode,
  isEditMode,
  isCampMode,
  campInvitationId,
  initialData,
  nextStep,
  prevStep,
  setStep,
  validateStep,
  handleSubmit,
  handleSaveDraft,
  handleValidationFailed,
}: UseWizardStepHandlersProps): UseWizardStepHandlersReturn {
  const router = useRouter();

  /**
   * 다음 단계로 이동
   *
   * 현재 단계에 따라 검증, 저장, 제출을 수행합니다.
   */
  const handleNext = useCallback(async () => {
    // Step 3 (스케줄 미리보기)에서는 검증 로직 건너뛰기
    if (currentStep !== 3) {
      if (!validateStep(currentStep)) {
        // 검증 실패 시 오류 필드로 스크롤하도록 예약
        handleValidationFailed();
        return;
      }
    }

    // isAdminContinueMode일 때 Step 3에서 Step 4로 이동 가능하도록 추가
    if (mode.isAdminContinueMode && currentStep === 3) {
      setStep(4);
      return;
    }

    // 템플릿 모드일 때 Step 4에서 템플릿 저장
    if (shouldSubmitAtStep4(mode) && currentStep === 4) {
      // 템플릿 모드일 때는 handleSaveDraft를 호출하여 onTemplateSave 콜백 실행
      if (isTemplateMode) {
        await handleSaveDraft(false);
        return;
      }
      // 캠프 모드일 때는 기존 로직 사용
      await handleSubmit();
      return;
    }

    // Step 5 (학습범위 점검)에서 다음 버튼 클릭 시
    if (currentStep === 5) {
      // 템플릿 모드가 아닐 때만 handleSubmit 호출
      if (!isTemplateMode) {
        // 일반 모드: 데이터만 저장 후 Step 6으로 이동 (플랜 생성은 Step 6 → Step 7 전환 시)
        // 캠프 모드: 데이터만 저장 후 Step 6으로 이동 (플랜 생성은 Step 7에서)
        await handleSubmit(shouldSaveOnlyWithoutPlanGeneration(mode) ? false : false);
      }
      return;
    }

    // Step 6 (최종 확인)에서 다음 버튼 클릭 시
    if (currentStep === 6) {
      // 템플릿 모드가 아닐 때만 handleSubmit 호출
      if (!isTemplateMode) {
        // 관리자 continue 모드: 데이터만 저장 후 Step 7로 이동
        // 일반 모드: 플랜 생성 후 Step 7로 이동
        await handleSubmit(shouldSaveOnlyWithoutPlanGeneration(mode) ? false : true);
      }
      return;
    }

    if (currentStep < 5) {
      if (currentStep === 4) {
        // 템플릿 모드나 캠프 모드가 아닐 때만 Step 4에서 데이터만 저장하고 Step 5로 이동
        // 템플릿 모드나 캠프 모드일 때는 위에서 이미 handleSubmit()이 호출됨
        if (!shouldSubmitAtStep4(mode)) {
          // Step 4에서는 데이터만 저장하고 Step 5로 이동 (플랜 생성은 Step 5에서)
          // handleSubmit 내부에서 setCurrentStep(5)를 호출하므로 여기서는 호출만 함
          await handleSubmit(false); // 플랜 생성하지 않음
          return; // handleSubmit 내부에서 단계 이동 처리
        }
      } else {
        nextStep();
      }
    }
  }, [
    currentStep,
    validateStep,
    mode,
    handleSubmit,
    handleSaveDraft,
    isTemplateMode,
    setStep,
    nextStep,
    handleValidationFailed,
  ]);

  /**
   * 이전 단계로 이동
   */
  const handleBack = useCallback(() => {
    if (canGoBack(currentStep, mode)) {
      prevStep();
    }
  }, [currentStep, mode, prevStep]);

  /**
   * 취소 핸들러
   *
   * 변경 사항이 있으면 확인 후 적절한 페이지로 이동합니다.
   */
  const handleCancel = useCallback(() => {
    // 변경 사항이 있으면 확인
    if (isDirty) {
      if (!confirm("변경사항이 저장되지 않을 수 있습니다. 정말 나가시겠습니까?")) {
        return;
      }
    }

    // 관리자 모드일 때는 캠프 템플릿 참여자 목록으로 이동
    if (mode.isAdminMode || mode.isAdminContinueMode) {
      const templateId = initialData?.templateId;
      if (templateId) {
        router.push(`/admin/camp-templates/${templateId}/participants`, { scroll: true });
        return;
      }
    }

    // 캠프 모드일 때는 캠프 참여 페이지로 이동
    if (isCampMode && campInvitationId) {
      router.push(`/camp/${campInvitationId}`, { scroll: true });
      return;
    }

    // 일반 모드일 때는 기존 로직 사용
    router.push(
      isEditMode && draftGroupId ? `/plan/group/${draftGroupId}` : "/plan",
      { scroll: true }
    );
  }, [
    isDirty,
    mode,
    initialData,
    router,
    isEditMode,
    draftGroupId,
    isCampMode,
    campInvitationId,
  ]);

  return {
    handleNext,
    handleBack,
    handleCancel,
  };
}
