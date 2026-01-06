'use client';

import { useState, useTransition, useCallback, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { createFlexibleContent } from '@/lib/domains/admin-plan/actions/flexibleContent';
import { createPlanFromContent } from '@/lib/domains/admin-plan/actions/createPlanFromContent';
import { usePlanToast } from '../PlanToast';
import { Step1ContentInfo, Step2RangeSettings, Step3Distribution } from './steps';
import {
  type AddContentWizardData,
  type AddContentWizardProps,
  STEP_TITLES,
  STEP_DESCRIPTIONS,
  initialWizardData,
} from './types';

const TOTAL_STEPS = 3;

export function AddContentWizard({
  studentId,
  tenantId,
  targetDate,
  onClose,
  onSuccess,
}: AddContentWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<AddContentWizardData>(() => initialWizardData(targetDate));
  const [isPending, startTransition] = useTransition();
  const { showToast } = usePlanToast();

  // 데이터 업데이트 핸들러
  const handleDataChange = useCallback((updates: Partial<AddContentWizardData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

  // 단계 유효성 검사
  const validateStep = useCallback(
    (step: number): { valid: boolean; message?: string } => {
      switch (step) {
        case 1:
          if (!data.title.trim()) {
            return { valid: false, message: '콘텐츠 제목을 입력하세요' };
          }
          return { valid: true };
        case 2:
          // 범위는 선택사항이므로 항상 유효
          return { valid: true };
        case 3:
          if (data.distributionMode === 'period' && !data.periodEnd) {
            return { valid: false, message: '종료 날짜를 선택하세요' };
          }
          return { valid: true };
        default:
          return { valid: true };
      }
    },
    [data]
  );

  // 다음 단계로 이동
  const handleNext = useCallback(() => {
    const validation = validateStep(currentStep);
    if (!validation.valid) {
      showToast(validation.message || '입력값을 확인하세요', 'warning');
      return;
    }
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep, validateStep, showToast]);

  // 이전 단계로 이동
  const handlePrev = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  // 제출 핸들러
  const handleSubmit = useCallback(() => {
    const validation = validateStep(currentStep);
    if (!validation.valid) {
      showToast(validation.message || '입력값을 확인하세요', 'warning');
      return;
    }

    startTransition(async () => {
      // 1. 유연한 콘텐츠 생성
      const contentResult = await createFlexibleContent({
        tenant_id: tenantId,
        content_type: data.contentType,
        title: data.title.trim(),
        curriculum: data.curriculum || null,
        subject_area: data.subjectArea || null,
        subject: data.subject || null,
        range_type: data.rangeType,
        range_start: data.rangeType === 'custom' ? data.customRange : data.rangeStart || null,
        range_end: data.rangeType === 'custom' ? null : data.rangeEnd || null,
        total_volume: data.totalVolume ? Number(data.totalVolume) : null,
        student_id: studentId,
      });

      if (!contentResult.success || !contentResult.data) {
        showToast('콘텐츠 생성 실패: ' + contentResult.error, 'error');
        return;
      }

      // 2. 배치 방식에 따른 플랜 생성
      const planResult = await createPlanFromContent({
        flexibleContentId: contentResult.data.id,
        contentTitle: data.title.trim(),
        contentSubject: data.subject || data.subjectArea || null,
        rangeStart:
          data.rangeType !== 'custom' && data.rangeStart ? Number(data.rangeStart) : null,
        rangeEnd: data.rangeType !== 'custom' && data.rangeEnd ? Number(data.rangeEnd) : null,
        customRangeDisplay: data.rangeType === 'custom' ? data.customRange : null,
        totalVolume: data.totalVolume ? Number(data.totalVolume) : null,
        distributionMode: data.distributionMode,
        targetDate: data.distributionMode === 'period' ? data.periodStart : targetDate,
        periodEndDate: data.distributionMode === 'period' ? data.periodEnd : undefined,
        studentId,
        tenantId,
      });

      if (!planResult.success) {
        showToast('플랜 생성 실패: ' + planResult.error, 'error');
        return;
      }

      const modeLabel =
        data.distributionMode === 'today'
          ? 'Daily'
          : data.distributionMode === 'weekly'
            ? 'Weekly'
            : '기간';
      showToast(`${modeLabel}에 ${planResult.data?.createdCount || 1}개 플랜 추가됨`, 'success');
      onSuccess();
    });
  }, [currentStep, data, studentId, tenantId, targetDate, validateStep, showToast, onSuccess]);

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // 현재 단계 렌더링
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1ContentInfo data={data} onChange={handleDataChange} />;
      case 2:
        return <Step2RangeSettings data={data} onChange={handleDataChange} />;
      case 3:
        return <Step3Distribution data={data} onChange={handleDataChange} targetDate={targetDate} />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={cn(
          'bg-white rounded-xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-xl',
          isPending && 'opacity-70 pointer-events-none'
        )}
      >
        {/* 헤더 */}
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">콘텐츠 추가</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Step {currentStep}/{TOTAL_STEPS}: {STEP_TITLES[currentStep]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 진행 인디케이터 */}
        <div className="px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((step) => (
              <div key={step} className="flex items-center">
                <button
                  type="button"
                  onClick={() => step < currentStep && setCurrentStep(step)}
                  disabled={step > currentStep}
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                    step === currentStep
                      ? 'bg-blue-600 text-white'
                      : step < currentStep
                        ? 'bg-blue-100 text-blue-600 hover:bg-blue-200 cursor-pointer'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  )}
                >
                  {step}
                </button>
                {step < TOTAL_STEPS && (
                  <div
                    className={cn(
                      'w-12 h-0.5 mx-1',
                      step < currentStep ? 'bg-blue-400' : 'bg-gray-200'
                    )}
                  />
                )}
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600 mt-2">{STEP_DESCRIPTIONS[currentStep]}</p>
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-y-auto p-4">{renderStep()}</div>

        {/* 푸터 */}
        <div className="p-4 border-t flex items-center justify-between bg-gray-50">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentStep === 1 || isPending}
            className={cn(
              'flex items-center gap-1 px-4 py-2 text-sm rounded-lg transition-colors',
              currentStep === 1
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-200'
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            이전
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            >
              취소
            </button>
            {currentStep < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={isPending}
                className="flex items-center gap-1 px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                다음
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  '생성하기'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
