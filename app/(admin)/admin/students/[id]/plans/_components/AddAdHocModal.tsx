'use client';

import { useState, useTransition } from 'react';
import { createAdHocPlan } from '@/lib/domains/admin-plan/actions/adHocPlan';
import { cn } from '@/lib/cn';
import { usePlanToast } from './PlanToast';

interface AddAdHocModalProps {
  studentId: string;
  tenantId: string;
  planGroupId: string; // 캘린더 아키텍처 필수
  targetDate: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddAdHocModal({
  studentId,
  tenantId,
  planGroupId,
  targetDate,
  onClose,
  onSuccess,
}: AddAdHocModalProps) {
  const [isPending, startTransition] = useTransition();
  const { showToast } = usePlanToast();

  const [title, setTitle] = useState('');
  const [planDate, setPlanDate] = useState(targetDate);
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [description, setDescription] = useState('');
  const [linkContent, setLinkContent] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!title.trim()) {
      setValidationError('제목을 입력하세요');
      return;
    }

    startTransition(async () => {
      const result = await createAdHocPlan({
        tenant_id: tenantId,
        student_id: studentId,
        plan_group_id: planGroupId,
        plan_date: planDate,
        title: title.trim(),
        description: description.trim() || null,
        estimated_minutes: estimatedMinutes ? Number(estimatedMinutes) : null,
        container_type: 'daily',
      });

      if (!result.success) {
        showToast('단발성 플랜 생성 실패: ' + result.error, 'error');
        return;
      }

      showToast('단발성 플랜이 추가되었습니다.', 'success');
      onSuccess();
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={cn(
          'bg-white rounded-lg w-full max-w-md',
          isPending && 'opacity-50 pointer-events-none'
        )}
      >
        {/* 헤더 */}
        <div className="p-4 border-b">
          <h2 className="text-lg font-bold">단발성 플랜 추가</h2>
          <p className="text-sm text-gray-500 mt-1">
            한 번만 수행할 학습 항목을 추가합니다
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-4">
            {/* 검증 오류 표시 */}
            {validationError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
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
                placeholder="예: 내일 특강 준비"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                className={cn(
                  'w-full px-3 py-2 border rounded-md',
                  validationError && !title.trim() && 'border-red-500'
                )}
                required
              />
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
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            {/* 예상 소요시간 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                예상 소요시간 (분)
              </label>
              <input
                type="number"
                placeholder="60"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                min="1"
              />
            </div>

            {/* 콘텐츠 연결 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                콘텐츠 연결 (선택)
              </label>
              <div className="space-y-2">
                <label
                  className={cn(
                    'flex items-center gap-3 p-3 border rounded-lg cursor-pointer',
                    !linkContent && 'border-blue-500 bg-blue-50'
                  )}
                >
                  <input
                    type="radio"
                    checked={!linkContent}
                    onChange={() => setLinkContent(false)}
                  />
                  <span>없음 (자유 학습)</span>
                </label>
                <label
                  className={cn(
                    'flex items-center gap-3 p-3 border rounded-lg cursor-pointer',
                    linkContent && 'border-blue-500 bg-blue-50'
                  )}
                >
                  <input
                    type="radio"
                    checked={linkContent}
                    onChange={() => setLinkContent(true)}
                  />
                  <span>콘텐츠 연결</span>
                </label>
                {linkContent && (
                  <div className="ml-6">
                    <input
                      type="text"
                      placeholder="콘텐츠 검색..."
                      className="w-full px-3 py-2 border rounded-md text-sm"
                      disabled
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      (콘텐츠 검색 기능 준비 중)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 메모 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                메모
              </label>
              <textarea
                placeholder="학습 관련 메모..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border rounded-md resize-none"
                rows={3}
              />
            </div>
          </div>

          {/* 푸터 */}
          <div className="p-4 border-t flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm text-white bg-purple-600 hover:bg-purple-700 rounded-md"
            >
              추가
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
