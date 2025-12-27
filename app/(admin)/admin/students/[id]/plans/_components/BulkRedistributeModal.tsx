'use client';

import { useEffect, useState, useTransition } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/cn';
import {
  logVolumeRedistributed,
  generateCorrelationId,
} from '@/lib/domains/admin-plan/actions';

interface BulkRedistributeModalProps {
  planIds: string[];
  studentId: string;
  tenantId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface PlanInfo {
  id: string;
  content_title: string | null;
  custom_title: string | null;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  plan_group_id: string | null;
  plan_date: string;
}

type BulkAction = 'move_to_daily' | 'move_to_weekly' | 'delete';

export function BulkRedistributeModal({
  planIds,
  studentId,
  tenantId,
  onClose,
  onSuccess,
}: BulkRedistributeModalProps) {
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // 일괄 작업 모드
  const [action, setAction] = useState<BulkAction>('move_to_daily');
  const [targetDate, setTargetDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  useEffect(() => {
    async function fetchPlans() {
      const supabase = createSupabaseBrowserClient();

      const { data, error } = await supabase
        .from('student_plan')
        .select(`
          id,
          content_title,
          custom_title,
          planned_start_page_or_time,
          planned_end_page_or_time,
          plan_group_id,
          plan_date
        `)
        .in('id', planIds);

      if (!error && data) {
        setPlans(data);
      }
      setIsLoading(false);
    }

    fetchPlans();
  }, [planIds]);

  const handleApply = async () => {
    const supabase = createSupabaseBrowserClient();
    const correlationId = await generateCorrelationId();

    startTransition(async () => {
      if (action === 'move_to_daily') {
        // Daily로 일괄 이동
        const { error } = await supabase
          .from('student_plan')
          .update({
            container_type: 'daily',
            plan_date: targetDate,
            updated_at: new Date().toISOString(),
          })
          .in('id', planIds);

        if (!error) {
          // 이벤트 로깅
          for (const plan of plans) {
            if (plan.plan_group_id) {
              await logVolumeRedistributed(
                tenantId,
                studentId,
                plan.plan_group_id,
                {
                  mode: 'bulk_move',
                  total_redistributed: 0,
                  affected_dates: [targetDate],
                  changes: [{
                    plan_id: plan.id,
                    date: targetDate,
                    original: 0,
                    new: 0,
                  }],
                },
                undefined,
                correlationId
              );
            }
          }
        }
      } else if (action === 'move_to_weekly') {
        // Weekly로 일괄 이동
        const { error } = await supabase
          .from('student_plan')
          .update({
            container_type: 'weekly',
            updated_at: new Date().toISOString(),
          })
          .in('id', planIds);

        if (error) {
          console.error('Failed to move to weekly:', error);
        }
      } else if (action === 'delete') {
        // 일괄 삭제 (soft delete)
        const { error } = await supabase
          .from('student_plan')
          .update({
            is_active: false,
            updated_at: new Date().toISOString(),
          })
          .in('id', planIds);

        if (error) {
          console.error('Failed to delete:', error);
        }
      }

      onSuccess();
    });
  };

  const getTotalVolume = (): number => {
    return plans.reduce((sum, plan) => {
      const volume =
        (plan.planned_end_page_or_time ?? 0) -
        (plan.planned_start_page_or_time ?? 0);
      return sum + volume;
    }, 0);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/2" />
            <div className="h-20 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={cn(
          'bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden',
          isPending && 'opacity-50 pointer-events-none'
        )}
      >
        {/* 헤더 */}
        <div className="p-4 border-b">
          <h2 className="text-lg font-bold">일괄 작업</h2>
          <p className="text-sm text-gray-500 mt-1">
            {plans.length}개 플랜 선택됨 (총 {getTotalVolume()}p)
          </p>
        </div>

        {/* 선택된 플랜 목록 */}
        <div className="p-4 border-b max-h-48 overflow-y-auto">
          <div className="text-sm font-medium text-gray-700 mb-2">
            선택된 플랜
          </div>
          <div className="space-y-2">
            {plans.map((plan) => {
              const volume =
                (plan.planned_end_page_or_time ?? 0) -
                (plan.planned_start_page_or_time ?? 0);

              return (
                <div
                  key={plan.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {plan.custom_title ?? plan.content_title ?? '제목 없음'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(plan.plan_date)}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">{volume}p</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 작업 선택 */}
        <div className="p-4 space-y-3">
          <div className="text-sm font-medium text-gray-700 mb-2">
            실행할 작업
          </div>

          {/* Daily로 이동 */}
          <label
            className={cn(
              'flex items-start gap-3 p-3 border rounded-lg cursor-pointer',
              action === 'move_to_daily' && 'border-blue-500 bg-blue-50'
            )}
          >
            <input
              type="radio"
              checked={action === 'move_to_daily'}
              onChange={() => setAction('move_to_daily')}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-medium">Daily로 이동</div>
              <div className="text-sm text-gray-500">
                선택한 날짜의 일일 플랜으로 이동
              </div>
              {action === 'move_to_daily' && (
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="mt-2 px-3 py-1.5 border rounded text-sm"
                />
              )}
            </div>
          </label>

          {/* Weekly로 이동 */}
          <label
            className={cn(
              'flex items-start gap-3 p-3 border rounded-lg cursor-pointer',
              action === 'move_to_weekly' && 'border-green-500 bg-green-50'
            )}
          >
            <input
              type="radio"
              checked={action === 'move_to_weekly'}
              onChange={() => setAction('move_to_weekly')}
              className="mt-1"
            />
            <div>
              <div className="font-medium">Weekly로 이동</div>
              <div className="text-sm text-gray-500">
                주간 유동 플랜으로 이동
              </div>
            </div>
          </label>

          {/* 삭제 */}
          <label
            className={cn(
              'flex items-start gap-3 p-3 border rounded-lg cursor-pointer',
              action === 'delete' && 'border-red-500 bg-red-50'
            )}
          >
            <input
              type="radio"
              checked={action === 'delete'}
              onChange={() => setAction('delete')}
              className="mt-1"
            />
            <div>
              <div className="font-medium text-red-700">삭제</div>
              <div className="text-sm text-gray-500">
                선택한 플랜을 모두 삭제
              </div>
            </div>
          </label>
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
          >
            취소
          </button>
          <button
            onClick={handleApply}
            className={cn(
              'px-4 py-2 text-sm text-white rounded-md',
              action === 'delete'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            )}
          >
            {action === 'delete' ? '삭제' : '적용'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}
