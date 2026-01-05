'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/ToastProvider';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface ReorderPlansModalProps {
  studentId: string;
  targetDate: string;
  containerType: 'daily' | 'weekly' | 'unfinished';
  onClose: () => void;
  onSuccess: () => void;
}

interface PlanItem {
  id: string;
  content_title: string | null;
  custom_title: string | null;
  sequence: number | null;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
}

// 주간 범위 계산 (월요일~일요일)
function getWeekRange(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = date.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() + mondayOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return {
    start: weekStart.toISOString().split('T')[0],
    end: weekEnd.toISOString().split('T')[0],
  };
}

export function ReorderPlansModal({
  studentId,
  targetDate,
  containerType,
  onClose,
  onSuccess,
}: ReorderPlansModalProps) {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const { showSuccess, showError } = useToast();

  // 플랜 로드
  useEffect(() => {
    async function loadPlans() {
      const supabase = createSupabaseBrowserClient();

      const query = supabase
        .from('student_plan')
        .select('id, content_title, custom_title, sequence, planned_start_page_or_time, planned_end_page_or_time')
        .eq('student_id', studentId)
        .eq('is_active', true)
        .eq('container_type', containerType);

      // 컨테이너 타입별 날짜 필터링
      if (containerType === 'daily') {
        query.eq('plan_date', targetDate);
      } else if (containerType === 'weekly') {
        const weekRange = getWeekRange(targetDate);
        query.gte('plan_date', weekRange.start).lte('plan_date', weekRange.end);
      }
      // unfinished는 날짜 조건 없음

      const { data, error } = await query.order('sequence', { ascending: true });

      if (error) {
        showError('플랜 로드 실패: ' + error.message);
      } else {
        setPlans(data ?? []);
      }
      setIsLoading(false);
    }
    loadPlans();
  }, [studentId, targetDate, containerType, showError]);

  // 드래그 앤 드롭 핸들러
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newPlans = [...plans];
    const draggedItem = newPlans[draggedIndex];
    newPlans.splice(draggedIndex, 1);
    newPlans.splice(index, 0, draggedItem);
    setPlans(newPlans);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // 위/아래 버튼
  const moveUp = useCallback((index: number) => {
    if (index === 0) return;
    const newPlans = [...plans];
    [newPlans[index - 1], newPlans[index]] = [newPlans[index], newPlans[index - 1]];
    setPlans(newPlans);
  }, [plans]);

  const moveDown = useCallback((index: number) => {
    if (index === plans.length - 1) return;
    const newPlans = [...plans];
    [newPlans[index], newPlans[index + 1]] = [newPlans[index + 1], newPlans[index]];
    setPlans(newPlans);
  }, [plans]);

  // 저장
  const handleSave = () => {
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();

      // 순차적으로 sequence 업데이트
      for (let i = 0; i < plans.length; i++) {
        const { error } = await supabase
          .from('student_plan')
          .update({
            sequence: i + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', plans[i].id);

        if (error) {
          showError('순서 저장 실패: ' + error.message);
          return;
        }
      }

      showSuccess('순서가 저장되었습니다.');
      onSuccess();
    });
  };

  const containerLabel = {
    daily: 'Daily',
    weekly: 'Weekly',
    unfinished: 'Unfinished',
  }[containerType];

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-gray-200 rounded w-1/2" />
            <div className="h-12 bg-gray-200 rounded" />
            <div className="h-12 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={cn(
          'bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col',
          isPending && 'opacity-50 pointer-events-none'
        )}
      >
        {/* 헤더 */}
        <div className="p-4 border-b shrink-0">
          <h2 className="text-lg font-bold">플랜 순서 변경</h2>
          <p className="text-sm text-gray-500 mt-1">
            {containerLabel} 컨테이너의 플랜 순서를 변경합니다
          </p>
        </div>

        {/* 플랜 목록 */}
        <div className="p-4 flex-1 overflow-y-auto">
          {plans.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              플랜이 없습니다
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-gray-500 mb-2">
                드래그하거나 화살표 버튼으로 순서를 변경하세요
              </div>
              {plans.map((plan, index) => {
                const range =
                  plan.planned_start_page_or_time != null && plan.planned_end_page_or_time != null
                    ? `p.${plan.planned_start_page_or_time}-${plan.planned_end_page_or_time}`
                    : null;

                return (
                  <div
                    key={plan.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      'flex items-center gap-2 p-3 bg-white border rounded-lg cursor-move',
                      draggedIndex === index && 'border-blue-500 bg-blue-50'
                    )}
                  >
                    {/* 순서 번호 */}
                    <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-sm font-medium">
                      {index + 1}
                    </span>

                    {/* 드래그 핸들 */}
                    <span className="text-gray-400">☰</span>

                    {/* 플랜 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-sm">
                        {plan.custom_title ?? plan.content_title ?? '제목 없음'}
                      </div>
                      {range && <div className="text-xs text-gray-500">{range}</div>}
                    </div>

                    {/* 이동 버튼 */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                        className="px-1.5 py-0.5 text-xs bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveDown(index)}
                        disabled={index === plans.length - 1}
                        className="px-1.5 py-0.5 text-xs bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={plans.length === 0 || isPending}
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
          >
            {isPending ? '저장 중...' : '순서 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
