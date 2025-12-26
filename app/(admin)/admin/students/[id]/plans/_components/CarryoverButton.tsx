'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import {
  getCarryoverPreview,
  runCarryoverForStudent,
} from '@/lib/domains/admin-plan/actions';

interface CarryoverButtonProps {
  studentId: string;
  tenantId: string;
  onSuccess: () => void;
}

interface PreviewPlan {
  id: string;
  planDate: string;
  title: string;
  subject: string | null;
  remainingVolume: number;
  currentCarryoverCount: number;
}

export function CarryoverButton({
  studentId,
  tenantId,
  onSuccess,
}: CarryoverButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<{
    incompleteCount: number;
    plans: PreviewPlan[];
  } | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    processedCount: number;
  } | null>(null);

  const handleOpenModal = async () => {
    setIsOpen(true);
    setResult(null);

    startTransition(async () => {
      const res = await getCarryoverPreview({ studentId, tenantId });
      if (res.success && res.data) {
        setPreview(res.data);
      }
    });
  };

  const handleRunCarryover = async () => {
    startTransition(async () => {
      const res = await runCarryoverForStudent({ studentId, tenantId });
      if (res.success && res.data) {
        setResult({
          success: true,
          processedCount: res.data.processedCount,
        });
        // 미리보기 초기화
        setPreview(null);
      } else {
        setResult({
          success: false,
          processedCount: 0,
        });
      }
    });
  };

  const handleClose = () => {
    setIsOpen(false);
    setPreview(null);
    setResult(null);
    if (result?.success) {
      onSuccess();
    }
  };

  return (
    <>
      <button
        onClick={handleOpenModal}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition-colors"
      >
        <span>↩️</span>
        <span>미완료 이월 처리</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className={cn(
              'bg-white rounded-lg w-full max-w-md max-h-[80vh] overflow-hidden',
              isPending && 'opacity-50 pointer-events-none'
            )}
          >
            {/* 헤더 */}
            <div className="px-4 py-3 border-b">
              <h2 className="text-lg font-bold">미완료 플랜 이월</h2>
              <p className="text-sm text-gray-500">
                어제까지 완료되지 않은 플랜을 Unfinished로 이동합니다
              </p>
            </div>

            {/* 내용 */}
            <div className="p-4 overflow-y-auto max-h-[50vh]">
              {result ? (
                // 결과 표시
                <div
                  className={cn(
                    'text-center py-8',
                    result.success ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {result.success ? (
                    <>
                      <div className="text-4xl mb-2">✅</div>
                      <div className="font-medium">
                        {result.processedCount}개 플랜이 이월되었습니다
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-4xl mb-2">❌</div>
                      <div className="font-medium">이월 처리에 실패했습니다</div>
                    </>
                  )}
                </div>
              ) : preview ? (
                preview.incompleteCount === 0 ? (
                  // 이월할 플랜 없음
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">🎉</div>
                    <div>이월할 미완료 플랜이 없습니다</div>
                  </div>
                ) : (
                  // 미리보기 표시
                  <div className="space-y-4">
                    <div className="bg-amber-50 rounded-lg p-3">
                      <div className="font-medium text-amber-800">
                        {preview.incompleteCount}개의 미완료 플랜
                      </div>
                      <div className="text-sm text-amber-600">
                        아래 플랜들이 Unfinished로 이동됩니다
                      </div>
                    </div>

                    <div className="space-y-2">
                      {preview.plans.map((plan) => (
                        <div
                          key={plan.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500">
                                {formatDate(plan.planDate)}
                              </span>
                              <span className="font-medium truncate">
                                {plan.title}
                              </span>
                            </div>
                            {plan.subject && (
                              <div className="text-xs text-gray-500">
                                {plan.subject}
                              </div>
                            )}
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <div className="text-sm font-medium">
                              {plan.remainingVolume}p
                            </div>
                            {plan.currentCarryoverCount > 0 && (
                              <div className="text-xs text-amber-600">
                                {plan.currentCarryoverCount}회 이월
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ) : (
                // 로딩
                <div className="animate-pulse space-y-3">
                  <div className="h-16 bg-gray-200 rounded-lg" />
                  <div className="h-12 bg-gray-100 rounded" />
                  <div className="h-12 bg-gray-100 rounded" />
                </div>
              )}
            </div>

            {/* 푸터 */}
            <div className="px-4 py-3 border-t flex justify-end gap-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                {result ? '닫기' : '취소'}
              </button>
              {preview && preview.incompleteCount > 0 && !result && (
                <button
                  onClick={handleRunCarryover}
                  disabled={isPending}
                  className="px-4 py-2 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
                >
                  {isPending ? '처리 중...' : '이월 실행'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}
