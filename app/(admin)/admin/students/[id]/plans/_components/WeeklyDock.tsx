'use client';

import { useEffect, useState, useTransition } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/cn';
import { DroppableContainer, DraggablePlanItem } from './dnd';
import { BulkRedistributeModal } from './BulkRedistributeModal';

interface WeeklyDockProps {
  studentId: string;
  tenantId: string;
  selectedDate: string;
  onRedistribute: (planId: string) => void;
  onEdit?: (planId: string) => void;
  onReorder?: () => void;
  onRefresh: () => void;
}

interface WeeklyPlan {
  id: string;
  content_title: string | null;
  content_subject: string | null;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  status: string | null;
  custom_title: string | null;
  custom_range_display: string | null;
  plan_group_id: string | null;
}

interface AdHocPlan {
  id: string;
  title: string;
  status: string;
  estimated_minutes: number | null;
}

export function WeeklyDock({
  studentId,
  tenantId,
  selectedDate,
  onRedistribute,
  onEdit,
  onReorder,
  onRefresh,
}: WeeklyDockProps) {
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [adHocPlans, setAdHocPlans] = useState<AdHocPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // 선택 관련 상태
  const [selectedPlans, setSelectedPlans] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);

  // 주간 범위 계산
  const getWeekRange = (dateStr: string) => {
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
  };

  useEffect(() => {
    async function fetchWeekly() {
      setIsLoading(true);
      const supabase = createSupabaseBrowserClient();
      const weekRange = getWeekRange(selectedDate);

      // Weekly 플랜 조회
      const { data: planData } = await supabase
        .from('student_plan')
        .select(`
          id,
          content_title,
          content_subject,
          planned_start_page_or_time,
          planned_end_page_or_time,
          status,
          custom_title,
          custom_range_display,
          plan_group_id
        `)
        .eq('student_id', studentId)
        .eq('container_type', 'weekly')
        .eq('is_active', true)
        .gte('plan_date', weekRange.start)
        .lte('plan_date', weekRange.end)
        .order('created_at', { ascending: true });

      // Weekly Ad-hoc 플랜
      const { data: adHocData } = await supabase
        .from('ad_hoc_plans')
        .select('id, title, status, estimated_minutes')
        .eq('student_id', studentId)
        .eq('container_type', 'weekly')
        .gte('plan_date', weekRange.start)
        .lte('plan_date', weekRange.end)
        .order('created_at', { ascending: true });

      setPlans(planData ?? []);
      setAdHocPlans(adHocData ?? []);
      setIsLoading(false);
    }

    fetchWeekly();
  }, [studentId, selectedDate]);

  const handleMoveToDaily = async (planId: string, targetDate: string) => {
    const supabase = createSupabaseBrowserClient();

    startTransition(async () => {
      await supabase
        .from('student_plan')
        .update({
          container_type: 'daily',
          plan_date: targetDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', planId);

      onRefresh();
    });
  };

  const handleDelete = async (planId: string, isAdHoc = false) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    const supabase = createSupabaseBrowserClient();

    startTransition(async () => {
      if (isAdHoc) {
        await supabase.from('ad_hoc_plans').delete().eq('id', planId);
      } else {
        await supabase
          .from('student_plan')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', planId);
      }

      onRefresh();
    });
  };

  // 선택 관련 핸들러
  const handleToggleSelect = (planId: string) => {
    setSelectedPlans((prev) => {
      const next = new Set(prev);
      if (next.has(planId)) {
        next.delete(planId);
      } else {
        next.add(planId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const uncompletedPlans = plans.filter((p) => p.status !== 'completed');
    if (selectedPlans.size === uncompletedPlans.length) {
      setSelectedPlans(new Set());
    } else {
      setSelectedPlans(new Set(uncompletedPlans.map((p) => p.id)));
    }
  };

  const handleBulkRedistribute = () => {
    if (selectedPlans.size > 0) {
      setShowBulkModal(true);
    }
  };

  const handleBulkSuccess = () => {
    setShowBulkModal(false);
    setSelectedPlans(new Set());
    onRefresh();
  };

  const weekRange = getWeekRange(selectedDate);
  const formatWeekRange = () => {
    const start = new Date(weekRange.start + 'T00:00:00');
    const end = new Date(weekRange.end + 'T00:00:00');
    return `${start.getMonth() + 1}/${start.getDate()} ~ ${end.getMonth() + 1}/${end.getDate()}`;
  };

  const totalCount = plans.length + adHocPlans.length;

  return (
    <DroppableContainer id="weekly">
      <div
        className={cn(
          'bg-green-50 rounded-lg border border-green-200 overflow-hidden',
          isPending && 'opacity-50 pointer-events-none'
        )}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-green-200">
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <span className="font-medium text-green-700">Weekly Dock</span>
            <span className="text-sm text-gray-600">{formatWeekRange()}</span>
            {totalCount > 0 && (
              <span className="text-sm text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                {totalCount}개
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {plans.filter((p) => p.status !== 'completed').length > 0 && (
              <button
                onClick={handleSelectAll}
                className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
              >
                {selectedPlans.size === plans.filter((p) => p.status !== 'completed').length
                  ? '전체 해제'
                  : '전체 선택'}
              </button>
            )}
            {selectedPlans.size > 0 && (
              <button
                onClick={handleBulkRedistribute}
                className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded-md hover:bg-amber-600"
              >
                일괄 작업 ({selectedPlans.size})
              </button>
            )}
            {onReorder && plans.length > 1 && (
              <button
                onClick={onReorder}
                className="px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
                title="순서 변경"
              >
                ↕️
              </button>
            )}
            <span className="text-xs text-gray-500">
              드래그하여 Daily로 이동
            </span>
          </div>
        </div>

        {/* 플랜 목록 */}
        <div className="p-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-green-100 rounded animate-pulse" />
              ))}
            </div>
          ) : totalCount === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>이번 주 Weekly Dock이 비어있습니다</p>
              <p className="text-sm mt-1">Daily에서 플랜을 이동하거나 추가하세요</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {/* 일반 플랜 */}
              {plans.map((plan) => {
                const rangeDisplay = plan.custom_range_display ??
                  (plan.planned_start_page_or_time && plan.planned_end_page_or_time
                    ? `p.${plan.planned_start_page_or_time}-${plan.planned_end_page_or_time}`
                    : undefined);

                return (
                  <DraggablePlanItem
                    key={plan.id}
                    id={plan.id}
                    type="plan"
                    containerId="weekly"
                    title={plan.custom_title ?? plan.content_title ?? '제목 없음'}
                    subject={plan.content_subject ?? undefined}
                    range={rangeDisplay}
                    disabled={plan.status === 'completed'}
                  >
                    <div
                      className={cn(
                        'flex flex-col gap-2 bg-white rounded-lg p-3 border',
                        plan.status === 'completed'
                          ? 'border-green-300 bg-green-50/50'
                          : selectedPlans.has(plan.id)
                            ? 'border-amber-300 bg-amber-50'
                            : 'border-green-100 hover:border-green-300'
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {/* 선택 체크박스 */}
                        {plan.status !== 'completed' && (
                          <input
                            type="checkbox"
                            checked={selectedPlans.has(plan.id)}
                            onChange={() => handleToggleSelect(plan.id)}
                            className="w-4 h-4 mt-0.5 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div
                            className={cn(
                              'font-medium text-sm truncate',
                              plan.status === 'completed' && 'line-through text-gray-500'
                            )}
                          >
                            {plan.custom_title ?? plan.content_title ?? '제목 없음'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {plan.content_subject && <span>{plan.content_subject} · </span>}
                            {rangeDisplay}
                          </div>
                        </div>
                      </div>

                      {/* 액션 */}
                      {plan.status !== 'completed' && (
                        <div className="flex items-center gap-1 pt-1 border-t border-gray-100">
                          <button
                            onClick={() => handleMoveToDaily(plan.id, selectedDate)}
                            className="flex-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            오늘로
                          </button>
                          <button
                            onClick={() => onRedistribute(plan.id)}
                            className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                          >
                            볼륨
                          </button>
                          {onEdit && (
                            <button
                              onClick={() => onEdit(plan.id)}
                              className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                              title="플랜 수정"
                            >
                              수정
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(plan.id)}
                            className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </div>
                  </DraggablePlanItem>
                );
              })}

              {/* Ad-hoc 플랜 */}
              {adHocPlans.map((adHoc) => (
                <DraggablePlanItem
                  key={adHoc.id}
                  id={adHoc.id}
                  type="adhoc"
                  containerId="weekly"
                  title={adHoc.title}
                  range={adHoc.estimated_minutes ? `약 ${adHoc.estimated_minutes}분` : undefined}
                  disabled={adHoc.status === 'completed'}
                >
                  <div
                    className={cn(
                      'flex flex-col gap-2 bg-white rounded-lg p-3 border',
                      adHoc.status === 'completed'
                        ? 'border-green-300 bg-green-50/50'
                        : 'border-purple-100'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded shrink-0">
                        단발성
                      </span>
                      <div className="flex-1 min-w-0">
                        <div
                          className={cn(
                            'font-medium text-sm truncate',
                            adHoc.status === 'completed' && 'line-through text-gray-500'
                          )}
                        >
                          {adHoc.title}
                        </div>
                        {adHoc.estimated_minutes && (
                          <div className="text-xs text-gray-500">
                            약 {adHoc.estimated_minutes}분
                          </div>
                        )}
                      </div>
                    </div>

                    {adHoc.status !== 'completed' && (
                      <div className="flex justify-end pt-1 border-t border-gray-100">
                        <button
                          onClick={() => handleDelete(adHoc.id, true)}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                        >
                          삭제
                        </button>
                      </div>
                    )}
                  </div>
                </DraggablePlanItem>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 일괄 작업 모달 */}
      {showBulkModal && (
        <BulkRedistributeModal
          planIds={Array.from(selectedPlans)}
          studentId={studentId}
          tenantId={tenantId}
          onClose={() => setShowBulkModal(false)}
          onSuccess={handleBulkSuccess}
        />
      )}
    </DroppableContainer>
  );
}
