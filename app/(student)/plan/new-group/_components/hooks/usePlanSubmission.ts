/**
 * usePlanSubmission - 플랜 제출 로직 훅
 *
 * 플랜 그룹 생성 및 플랜 생성 로직을 통합 관리합니다.
 * 저장 성공 시 dirty 상태를 리셋하여 이탈 방지 로직과 연동됩니다.
 *
 * A3 개선: 제출 진행 상태 추적 (SubmissionPhase)
 * A4 개선: 오토세이브 기능 추가
 */

import { useCallback, useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { WizardData, WizardStep } from "../PlanGroupWizard";
import { validatePeriod } from "../utils/validationUtils";
import { usePlanDraft } from "./usePlanDraft";
import { usePlanGenerator, type MultipleGroupsCreationResult } from "./usePlanGenerator";
import { useWizardNavigation } from "./useWizardNavigation";
import { useAutoSave, type AutoSaveStatus } from "./useAutoSave";
import {
  toPlanGroupError,
  PlanGroupError,
  PlanGroupErrorCodes,
  type PlanGroupErrorCode,
} from "@/lib/errors/planGroupErrors";
import type { SubmissionPhase } from "../_ui/SubmissionProgress";
import { WIZARD_STEPS, TIMING } from "../constants/wizardConstants";
import { planSubmissionLogger } from "../utils/wizardLogger";

/**
 * 제출 에러 정보 타입
 * ErrorWithGuide 컴포넌트와 통합을 위해 에러 코드 포함
 */
export type SubmissionErrorInfo = {
  message: string;
  code?: PlanGroupErrorCode;
};

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
  /** 초기 위저드 데이터 (오토세이브 변경 감지용) */
  initialWizardData?: WizardData | null;
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
  /** 오토세이브 활성화 여부 (기본값 true) */
  autoSaveEnabled?: boolean;
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
  initialWizardData,
  mode,
  onSaveSuccess,
  autoSaveEnabled = true,
}: UsePlanSubmissionProps) {
  const toast = useToast();

  // 분리된 훅들 사용
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

  const {
    generatePlans,
    createOrUpdatePlanGroup,
    isGenerating,
    // Phase 3.1: 여러 plan_group 생성 지원
    createMultiplePlanGroups,
    generatePlansForMultipleGroups,
  } = usePlanGenerator({
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

  // A4 개선: 오토세이브 훅
  // - 템플릿 모드에서는 비활성화 (별도 저장 로직 사용)
  // - draftGroupId가 없으면 (신규) 비활성화 (명시적 저장 필요)
  const {
    status: autoSaveStatus,
    lastSavedAt: autoSaveLastSavedAt,
    isSaving: isAutoSaving,
  } = useAutoSave({
    data: wizardData,
    initialData: initialWizardData,
    draftGroupId,
    saveFn: saveDraft,
    options: {
      enabled: autoSaveEnabled && !mode.isTemplateMode,
      debounceMs: TIMING.AUTO_SAVE_DEBOUNCE_MS,
      savedStatusDurationMs: TIMING.SAVED_STATUS_DURATION_MS,
    },
  });

  const isSubmitting = isSaving || isGenerating || isAutoSaving;

  // A3 개선: 제출 진행 단계 추적
  const [submissionPhase, setSubmissionPhase] = useState<SubmissionPhase>("idle");
  const [submissionError, setSubmissionError] = useState<SubmissionErrorInfo | undefined>(undefined);

  // Phase 3.1: 여러 그룹 생성 진행 상태
  const [multipleGroupsProgress, setMultipleGroupsProgress] = useState<{
    current: number;
    total: number;
    phase: string;
  } | null>(null);

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
      setSubmissionError(undefined);

      try {
        // A3 개선: 검증 단계 시작
        setSubmissionPhase("validating");

        // 0. 기간 검증 (동기, 빠름)
        const periodValidation = validatePeriod(wizardData, mode.isCampMode);
        if (!periodValidation.isValid && periodValidation.error) {
          setValidationErrors([periodValidation.error]);
          setSubmissionPhase("error");
          setSubmissionError({
            message: periodValidation.error,
            code: PlanGroupErrorCodes.VALIDATION_FAILED,
          });
          return;
        }

        // 템플릿 모드일 때는 플랜 그룹 생성을 건너뛰고 다음 단계로만 이동
        if (mode.isTemplateMode) {
          setSubmissionPhase("idle");
          goNext();
          return;
        }

        // 낙관적 UI 업데이트: Step 전환이 필요한 경우 먼저 UI 전환 후 백그라운드 저장
        const needsOptimisticUpdate =
          (currentStep === WIZARD_STEPS.CONTENT_SELECTION && !generatePlansFlag) ||
          currentStep === WIZARD_STEPS.RECOMMENDED_CONTENT ||
          (currentStep === WIZARD_STEPS.FINAL_REVIEW && !generatePlansFlag);

        if (needsOptimisticUpdate) {
          // 1. 먼저 다음 단계로 UI 전환 (즉각적인 반응)
          const nextStep: WizardStep =
            currentStep === WIZARD_STEPS.CONTENT_SELECTION
              ? WIZARD_STEPS.RECOMMENDED_CONTENT as WizardStep
              : currentStep === WIZARD_STEPS.RECOMMENDED_CONTENT
              ? WIZARD_STEPS.FINAL_REVIEW as WizardStep
              : WIZARD_STEPS.RESULT as WizardStep;
          setSubmissionPhase("idle"); // 낙관적 업데이트에서는 진행 표시 숨김
          goToStep(nextStep);

          // 2. 백그라운드에서 저장 (에러 시 토스트로 알림)
          createOrUpdatePlanGroup()
            .then((finalGroupId) => {
              setDraftGroupId(finalGroupId);
            })
            .catch((error) => {
              // 안전한 에러 메시지 추출 (Next.js Server Action 직렬화로 인한 빈 객체 처리)
              let errorMessage = "저장 중 오류가 발생했습니다.";

              if (error instanceof Error && error.message) {
                errorMessage = error.message;
              } else if (error instanceof PlanGroupError) {
                errorMessage = error.userMessage;
              } else if (error && typeof error === "object") {
                if ("message" in error && error.message) {
                  errorMessage = String(error.message);
                } else if ("error" in error && typeof error.error === "object") {
                  const nestedError = error.error as { message?: string };
                  if (nestedError.message) {
                    errorMessage = nestedError.message;
                  }
                }
              }

              planSubmissionLogger.error("Background save failed", error, {
                hook: "usePlanSubmission",
                data: {
                  extractedMessage: errorMessage,
                  errorType: error?.constructor?.name || typeof error,
                },
              });

              // 사용자에게 명확한 에러 메시지 표시
              toast.showError(errorMessage);
              setValidationErrors([errorMessage]);
            });
          return;
        }

        // A3 개선: 플랜 그룹 생성 단계
        setSubmissionPhase("creating_group");

        // 플랜 생성이 필요한 경우: 기존 동기 방식 유지
        // 1. Create or Update Plan Group
        const finalGroupId = await createOrUpdatePlanGroup();
        setDraftGroupId(finalGroupId);

        // 2. Plan Generation (Generate Real Plans)
        if (generatePlansFlag) {
          // A3 개선: 플랜 생성 단계
          setSubmissionPhase("generating_plans");

          await generatePlans(finalGroupId);

          // A3 개선: 마무리 단계
          setSubmissionPhase("finalizing");

          // 캠프 모드(학생)일 때는 generatePlans 내부에서 제출 완료 페이지로 이동하므로
          // Step 7로 이동하지 않음
          if (!mode.isCampMode) {
            // 플랜 생성 후 결과 확인 단계로 이동 (리다이렉트는 Step 7 완료 버튼에서 처리)
            setSubmissionPhase("completed");
            goToStep(WIZARD_STEPS.RESULT as WizardStep);
          } else {
            // 캠프 모드일 때는 generatePlans 내부에서 router.push로 이동
            setSubmissionPhase("completed");
          }
        } else {
          setSubmissionPhase("idle");
          goNext();
        }
      } catch (error) {
        planSubmissionLogger.error("Submit failed", error, { hook: "usePlanSubmission" });
        const planGroupError = toPlanGroupError(
          error,
          PlanGroupErrorCodes.UNKNOWN_ERROR
        );
        // A3 개선: 에러 단계
        setSubmissionPhase("error");
        setSubmissionError({
          message: planGroupError.userMessage,
          code: planGroupError.code as PlanGroupErrorCode,
        });
        // 사용자에게 명확한 에러 메시지 표시
        toast.showError(planGroupError.userMessage);
        setValidationErrors([planGroupError.userMessage]);
      }
    },
    [
      isSubmitting,
      wizardData,
      createOrUpdatePlanGroup,
      generatePlans,
      currentStep,
      setDraftGroupId,
      goToStep,
      goNext,
      setValidationErrors,
      toast,
      mode.isTemplateMode,
      mode.isCampMode,
    ]
  );
  
  // A3 개선: 에러 상태 리셋 함수
  const resetSubmissionPhase = useCallback(() => {
    setSubmissionPhase("idle");
    setSubmissionError(undefined);
    setMultipleGroupsProgress(null);
  }, []);

  /* -------------------------------------------------------------------------- */
  /*               Phase 3.1: Multiple Groups Submit Logic                      */
  /* -------------------------------------------------------------------------- */
  /**
   * Phase 3.1: 여러 단일 콘텐츠 plan_group 생성 및 플랜 생성
   *
   * 각 콘텐츠마다 별도의 plan_group을 생성하고, 동일한 Planner에 연결합니다.
   *
   * @param generatePlansFlag 플랜 생성 여부 (기본값: true)
   * @returns 생성 결과 또는 undefined (에러 시)
   */
  const handleMultipleGroupsSubmit = useCallback(
    async (generatePlansFlag: boolean = true): Promise<MultipleGroupsCreationResult | undefined> => {
      if (isSubmitting) return;
      setValidationErrors([]);
      setSubmissionError(undefined);
      setMultipleGroupsProgress(null);

      try {
        // 검증 단계
        setSubmissionPhase("validating");

        const periodValidation = validatePeriod(wizardData, mode.isCampMode);
        if (!periodValidation.isValid && periodValidation.error) {
          setValidationErrors([periodValidation.error]);
          setSubmissionPhase("error");
          setSubmissionError({
            message: periodValidation.error,
            code: PlanGroupErrorCodes.VALIDATION_FAILED,
          });
          return;
        }

        // 템플릿 모드 체크
        if (mode.isTemplateMode) {
          setSubmissionPhase("idle");
          goNext();
          return;
        }

        // 진행 상태 콜백
        const onProgress = (current: number, total: number, phase: string) => {
          setMultipleGroupsProgress({ current, total, phase });

          // 단계별 UI 상태 업데이트
          if (phase === "ensuring_planner") {
            setSubmissionPhase("ensuring_planner");
          } else if (phase === "creating_groups") {
            setSubmissionPhase("creating_groups");
          } else if (phase === "generating_plans") {
            setSubmissionPhase("generating_plans");
          } else if (phase === "finalizing") {
            setSubmissionPhase("finalizing");
          }
        };

        // 여러 plan_group 생성
        const result = await createMultiplePlanGroups(onProgress);

        planSubmissionLogger.info("Multiple groups created", {
          hook: "usePlanSubmission",
          data: {
            plannerId: result.plannerId,
            groupCount: result.totalCount,
            groupIds: result.groupIds,
          },
        });

        // 플랜 생성
        if (generatePlansFlag) {
          setSubmissionPhase("generating_plans");

          const genResult = await generatePlansForMultipleGroups(
            result.groupIds,
            onProgress
          );

          planSubmissionLogger.info("Plans generated for multiple groups", {
            hook: "usePlanSubmission",
            data: {
              totalPlans: genResult.totalPlans,
              successCount: genResult.successCount,
              failedCount: genResult.failedCount,
            },
          });

          setSubmissionPhase("finalizing");

          // 캠프 모드가 아닐 때만 결과 페이지로 이동
          if (!mode.isCampMode) {
            setSubmissionPhase("completed");
            goToStep(WIZARD_STEPS.RESULT as WizardStep);
          } else {
            setSubmissionPhase("completed");
          }
        } else {
          setSubmissionPhase("idle");
          goNext();
        }

        return result;
      } catch (error) {
        planSubmissionLogger.error("Multiple groups submit failed", error, {
          hook: "usePlanSubmission",
        });
        const planGroupError = toPlanGroupError(
          error,
          PlanGroupErrorCodes.UNKNOWN_ERROR
        );
        setSubmissionPhase("error");
        setSubmissionError({
          message: planGroupError.userMessage,
          code: planGroupError.code as PlanGroupErrorCode,
        });
        toast.showError(planGroupError.userMessage);
        setValidationErrors([planGroupError.userMessage]);
        return undefined;
      }
    },
    [
      isSubmitting,
      wizardData,
      mode.isCampMode,
      mode.isTemplateMode,
      createMultiplePlanGroups,
      generatePlansForMultipleGroups,
      setValidationErrors,
      goNext,
      goToStep,
      toast,
    ]
  );

  return {
    isSubmitting,
    executeSave,
    handleSubmit,
    // A3 개선: 제출 진행 상태
    submissionPhase,
    submissionError,
    resetSubmissionPhase,
    // A4 개선: 오토세이브 상태
    autoSaveStatus,
    autoSaveLastSavedAt,
    // Phase 3.1: 여러 plan_group 생성 지원
    handleMultipleGroupsSubmit,
    multipleGroupsProgress,
  };
}

// 타입 내보내기
export type { AutoSaveStatus };
