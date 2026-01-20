'use client';

import { X, Wand2, ChevronRight, ChevronLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { AIPlanModalProvider, useAIPlanModalActions, useAIPlanModalSelectors } from './context/AIPlanModalContext';
import { Step1PlannerSelection } from './steps/Step1PlannerSelection';
import { Step2SlotConfiguration } from './steps/Step2SlotConfiguration';
import { Step3AIRecommendation } from './steps/Step3AIRecommendation';
import { Step4GenerationResult } from './steps/Step4GenerationResult';
import type { WizardStep } from '@/lib/domains/admin-plan/types/aiPlanSlot';

// ============================================================================
// Props
// ============================================================================

export interface AdminAIPlanModalV2Props {
  studentId: string;
  tenantId: string;
  onClose: () => void;
  onSuccess: () => void;
}

// ============================================================================
// 메인 컴포넌트 (Provider 래퍼)
// ============================================================================

export function AdminAIPlanModalV2(props: AdminAIPlanModalV2Props) {
  return (
    <AIPlanModalProvider>
      <AdminAIPlanModalV2Inner {...props} />
    </AIPlanModalProvider>
  );
}

// ============================================================================
// 내부 컴포넌트
// ============================================================================

function AdminAIPlanModalV2Inner({
  studentId,
  tenantId,
  onClose,
  onSuccess,
}: AdminAIPlanModalV2Props) {
  const {
    currentStep,
    selectedPlannerId,
    slots,
    confirmedCount,
    canProceedToStep3,
    canGenerate,
    error,
    isLoading,
  } = useAIPlanModalSelectors();

  const { setStep, setError } = useAIPlanModalActions();

  // 스텝별 제목/설명
  const stepInfo: Record<WizardStep, { title: string; description: string }> = {
    1: { title: '플래너 선택', description: '플래너를 선택하세요' },
    2: { title: '슬롯 구성', description: 'AI 추천 또는 기존 콘텐츠를 추가하세요' },
    3: { title: 'AI 추천 확인', description: '추천 결과를 확인하고 설정하세요' },
    4: { title: '플랜 생성', description: '플랜을 생성합니다' },
  };

  // 다음 스텝 가능 여부
  function canProceedToNextStep(): boolean {
    switch (currentStep) {
      case 1:
        return !!selectedPlannerId;
      case 2:
        return slots.length > 0 && canProceedToStep3;
      case 3:
        return canGenerate;
      default:
        return false;
    }
  }

  // 스텝 이동
  function handleNextStep() {
    if (!canProceedToNextStep()) {
      // 에러 메시지 설정
      if (currentStep === 1 && !selectedPlannerId) {
        setError('플래너를 선택해주세요.');
      } else if (currentStep === 2 && slots.length === 0) {
        setError('최소 1개의 슬롯을 추가해주세요.');
      } else if (currentStep === 3 && !canGenerate) {
        setError('모든 슬롯을 확정해주세요.');
      }
      return;
    }
    setError(null);
    setStep((currentStep + 1) as WizardStep);
  }

  function handlePrevStep() {
    if (currentStep > 1) {
      setError(null);
      setStep((currentStep - 1) as WizardStep);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
        {/* 헤더 */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <Wand2 className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                AI 플랜 생성 V2
              </h2>
              <p className="text-sm text-gray-500">
                {stepInfo[currentStep].description}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={currentStep === 4 && isLoading}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 진행 표시기 */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {([1, 2, 3, 4] as WizardStep[]).map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium transition-colors',
                    currentStep === step
                      ? 'bg-purple-600 text-white'
                      : currentStep > step
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                  )}
                >
                  {currentStep > step ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    step
                  )}
                </div>
                {step < 4 && (
                  <ChevronRight
                    className={cn(
                      'mx-1 h-4 w-4',
                      currentStep > step ? 'text-green-500' : 'text-gray-300'
                    )}
                  />
                )}
              </div>
            ))}
            <span className="ml-3 text-sm text-gray-500">
              {stepInfo[currentStep].title}
            </span>
          </div>
        </div>

        {/* 콘텐츠 영역 */}
        <div className="p-6">
          {/* 에러 표시 */}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* 스텝별 컴포넌트 */}
          {currentStep === 1 && (
            <Step1PlannerSelection studentId={studentId} />
          )}
          {currentStep === 2 && (
            <Step2SlotConfiguration studentId={studentId} tenantId={tenantId} />
          )}
          {currentStep === 3 && (
            <Step3AIRecommendation studentId={studentId} tenantId={tenantId} />
          )}
          {currentStep === 4 && (
            <Step4GenerationResult
              studentId={studentId}
              tenantId={tenantId}
              onSuccess={onSuccess}
              onClose={onClose}
            />
          )}
        </div>

        {/* 네비게이션 버튼 (Step 4 제외) */}
        {currentStep < 4 && (
          <div className="sticky bottom-0 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-4">
            <button
              onClick={handlePrevStep}
              disabled={currentStep === 1}
              className={cn(
                'flex items-center gap-1 px-4 py-2 rounded-lg transition-colors',
                currentStep === 1
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              )}
            >
              <ChevronLeft className="h-4 w-4" />
              이전
            </button>

            <div className="flex items-center gap-4">
              {/* 슬롯 요약 (Step 2, 3) */}
              {(currentStep === 2 || currentStep === 3) && slots.length > 0 && (
                <span className="text-sm text-gray-500">
                  {currentStep === 2 && `${slots.length}개 슬롯`}
                  {currentStep === 3 && `${confirmedCount}/${slots.length}개 확정`}
                </span>
              )}

              <button
                onClick={handleNextStep}
                disabled={!canProceedToNextStep()}
                className={cn(
                  'flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-colors',
                  canProceedToNextStep()
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                )}
              >
                {currentStep === 3 ? (
                  <>
                    <Wand2 className="h-4 w-4" />
                    플랜 생성
                  </>
                ) : (
                  <>
                    다음
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminAIPlanModalV2;
