'use client';

import { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAdminWizardState } from './useAdminWizardState';
import { Step1BasicInfo } from './steps/Step1BasicInfo';
import { Step2ContentSelection } from './steps/Step2ContentSelection';
import { Step3ReviewCreate } from './steps/Step3ReviewCreate';
import type { AdminPlanCreationWizardProps, WizardStep } from './types';

// Server action import
import { createPlanGroupAction } from '@/lib/domains/plan/actions/plan-groups/create';
import type { PlanGroupCreationData } from '@/lib/types/plan';

const STEP_TITLES: Record<WizardStep, string> = {
  1: '기간 및 기본정보',
  2: '콘텐츠 선택',
  3: '검토 및 생성',
};

export function AdminPlanCreationWizard({
  studentId,
  tenantId,
  studentName,
  onClose,
  onSuccess,
}: AdminPlanCreationWizardProps) {
  const {
    state,
    nextStep,
    prevStep,
    updatePeriod,
    updateName,
    updatePurpose,
    toggleContent,
    updateContentRange,
    setSkipContents,
    setGenerateAI,
    setSubmitting,
    setError,
    setCreatedGroupId,
    isStep1Valid,
  } = useAdminWizardState();

  // ESC 키 핸들러
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !state.isSubmitting) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, state.isSubmitting]);

  // 다음 단계로 이동
  const handleNext = useCallback(() => {
    if (state.currentStep === 1 && !isStep1Valid()) {
      setError('시작일과 종료일을 올바르게 설정해주세요.');
      return;
    }
    setError(null);
    nextStep();
  }, [state.currentStep, isStep1Valid, setError, nextStep]);

  // 제출 핸들러
  const handleSubmit = useCallback(async () => {
    if (!isStep1Valid()) {
      setError('필수 정보를 확인해주세요.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // PlanGroupCreationData 구성
      const planGroupData: PlanGroupCreationData = {
        name: state.name || null,
        plan_purpose: state.planPurpose || '내신대비', // 기본값 설정
        scheduler_type: '1730_timetable', // 기본 스케줄러 타입
        period_start: state.periodStart,
        period_end: state.periodEnd,
        contents: state.skipContents
          ? []
          : state.selectedContents.map((c, index) => ({
              content_type: c.contentType as 'book' | 'lecture',
              content_id: c.contentId,
              master_content_id: null,
              start_range: c.startRange,
              end_range: c.endRange,
              start_detail_id: null,
              end_detail_id: null,
              display_order: index,
            })),
        exclusions: [],
        academy_schedules: [],
      };

      const result = await createPlanGroupAction(planGroupData, {
        skipContentValidation: true, // 관리자 모드에서는 콘텐츠 검증 건너뛰기
        studentId: studentId, // 관리자 모드에서 직접 학생 ID 지정
      });

      // 에러 확인: withErrorHandlingSafe는 에러 시 { success: false, error: ... } 반환
      if ('success' in result && result.success === false) {
        setError(result.error?.message || '플랜 그룹 생성에 실패했습니다.');
        setSubmitting(false);
        return;
      }

      // 성공 시: { groupId: string } 반환
      const groupId = (result as { groupId: string }).groupId;
      setCreatedGroupId(groupId);
      setSubmitting(false);
      onSuccess(groupId, state.generateAIPlan);
    } catch (error) {
      console.error('Failed to create plan group:', error);
      setError('플랜 그룹 생성 중 오류가 발생했습니다.');
      setSubmitting(false);
    }
  }, [
    state,
    isStep1Valid,
    studentId,
    setSubmitting,
    setError,
    setCreatedGroupId,
    onSuccess,
  ]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-2xl flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">플랜 그룹 생성</h2>
            <p className="text-sm text-gray-500">{studentName}</p>
          </div>
          <button
            onClick={onClose}
            disabled={state.isSubmitting}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 스텝 인디케이터 */}
        <div className="flex items-center justify-center gap-2 border-b border-gray-100 px-6 py-3">
          {([1, 2, 3] as WizardStep[]).map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition',
                  state.currentStep === step
                    ? 'bg-blue-600 text-white'
                    : state.currentStep > step
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-400'
                )}
              >
                {step}
              </div>
              {step < 3 && (
                <div
                  className={cn(
                    'mx-2 h-0.5 w-8 transition',
                    state.currentStep > step ? 'bg-blue-300' : 'bg-gray-200'
                  )}
                />
              )}
            </div>
          ))}
        </div>
        <div className="px-6 py-2 text-center">
          <span className="text-sm font-medium text-gray-700">
            {STEP_TITLES[state.currentStep]}
          </span>
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {state.currentStep === 1 && (
            <Step1BasicInfo
              periodStart={state.periodStart}
              periodEnd={state.periodEnd}
              name={state.name}
              planPurpose={state.planPurpose}
              onUpdatePeriod={updatePeriod}
              onUpdateName={updateName}
              onUpdatePurpose={updatePurpose}
              error={state.error}
            />
          )}

          {state.currentStep === 2 && (
            <Step2ContentSelection
              studentId={studentId}
              tenantId={tenantId}
              selectedContents={state.selectedContents}
              skipContents={state.skipContents}
              onToggleContent={toggleContent}
              onUpdateRange={updateContentRange}
              onSetSkipContents={setSkipContents}
            />
          )}

          {state.currentStep === 3 && (
            <Step3ReviewCreate
              periodStart={state.periodStart}
              periodEnd={state.periodEnd}
              name={state.name}
              planPurpose={state.planPurpose}
              selectedContents={state.selectedContents}
              skipContents={state.skipContents}
              generateAIPlan={state.generateAIPlan}
              isSubmitting={state.isSubmitting}
              error={state.error}
              onSetGenerateAI={setGenerateAI}
              onSubmit={handleSubmit}
            />
          )}
        </div>

        {/* 네비게이션 (Step 3 제외) */}
        {state.currentStep < 3 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={prevStep}
              disabled={state.currentStep === 1}
              className={cn(
                'flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium transition',
                state.currentStep === 1
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <ChevronLeft className="h-4 w-4" />
              이전
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              다음
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
