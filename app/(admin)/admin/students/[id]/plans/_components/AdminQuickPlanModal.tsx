'use client';

/**
 * Admin Quick Plan Modal
 *
 * @deprecated Since v2.0.0. Use `UnifiedPlanAddModal` with `initialMode="quick"` instead.
 * This component will be removed in v3.0.0.
 *
 * 관리자가 학생을 대신하여 빠르게 플랜을 생성하는 모달
 * - planGroupId 없이도 새 그룹을 만들면서 플랜 생성
 * - createQuickPlanForStudent Server Action 사용
 */

import { useState, useTransition } from 'react';
import { createQuickPlanForStudent } from '@/lib/domains/plan/actions/contentPlanGroup/quickCreate';
import { cn } from '@/lib/cn';
import { usePlanToast } from './PlanToast';
import { Zap, X } from 'lucide-react';

interface AdminQuickPlanModalProps {
  studentId: string;
  tenantId: string;
  studentName: string;
  targetDate: string;
  /** 플래너 ID (필수) - 플랜 그룹 생성 시 연결 */
  plannerId: string;
  onClose: () => void;
  onSuccess: () => void;
}

// 자유 학습 유형 (DB CHECK 제약조건과 일치해야 함)
const FREE_LEARNING_TYPES = [
  { value: 'free', label: '자유 학습' },
  { value: 'review', label: '복습' },
  { value: 'practice', label: '연습/문제풀이' },
  { value: 'reading', label: '독서' },
  { value: 'video', label: '영상 시청' },
  { value: 'assignment', label: '과제' },
] as const;

export function AdminQuickPlanModal({
  studentId,
  tenantId,
  studentName,
  targetDate,
  plannerId,
  onClose,
  onSuccess,
}: AdminQuickPlanModalProps) {
  const [isPending, startTransition] = useTransition();
  const { showToast } = usePlanToast();

  const [title, setTitle] = useState('');
  const [planDate, setPlanDate] = useState(targetDate);
  const [estimatedMinutes, setEstimatedMinutes] = useState('30');
  const [freeLearningType, setFreeLearningType] = useState<string>('free');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!title.trim()) {
      setValidationError('제목을 입력하세요');
      return;
    }

    startTransition(async () => {
      const result = await createQuickPlanForStudent({
        studentId,
        tenantId,
        plannerId,
        title: title.trim(),
        planDate,
        estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : 30,
        isFreeLearning: true,
        freeLearningType,
        containerType: 'daily',
      });

      if (!result.success) {
        showToast('빠른 플랜 생성 실패: ' + result.error, 'error');
        return;
      }

      showToast(`${studentName}님의 플랜이 추가되었습니다.`, 'success');
      onSuccess();
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={cn(
          'bg-white rounded-xl w-full max-w-md shadow-xl',
          isPending && 'opacity-50 pointer-events-none'
        )}
      >
        {/* 헤더 */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Zap className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold">빠른 플랜 추가</h2>
              <p className="text-sm text-gray-500">{studentName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-4">
            {/* 검증 오류 표시 */}
            {validationError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {validationError}
              </div>
            )}

            {/* 제목 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                제목 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="예: 수학 문제집 풀기"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                className={cn(
                  'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent',
                  validationError && !title.trim() && 'border-red-500'
                )}
                required
                autoFocus
              />
            </div>

            {/* 학습 유형 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                학습 유형
              </label>
              <div className="grid grid-cols-4 gap-2">
                {FREE_LEARNING_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFreeLearningType(type.value)}
                    className={cn(
                      'px-3 py-2 text-sm border rounded-lg transition-colors',
                      freeLearningType === type.value
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 날짜 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                날짜
              </label>
              <input
                type="date"
                value={planDate}
                onChange={(e) => setPlanDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>

            {/* 예상 소요시간 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                예상 소요시간
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(e.target.value)}
                  className="w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  min="5"
                  max="480"
                />
                <span className="text-gray-500">분</span>
                <div className="flex gap-1 ml-2">
                  {[15, 30, 60, 90].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setEstimatedMinutes(String(mins))}
                      className={cn(
                        'px-2 py-1 text-xs rounded border',
                        estimatedMinutes === String(mins)
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-gray-200 hover:bg-gray-50'
                      )}
                    >
                      {mins}분
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 푸터 */}
          <div className="p-4 border-t flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 text-sm text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {isPending ? '추가 중...' : '빠르게 추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
