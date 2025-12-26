'use client';

import { useEffect, useState, useTransition } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/cn';
import { DroppableContainer, DraggablePlanItem } from './dnd';
import { QuickCompleteButton, InlineVolumeEditor, QuickProgressInput } from './QuickActions';
import { usePlanToast } from './PlanToast';

interface DailyDockProps {
  studentId: string;
  tenantId: string;
  selectedDate: string;
  onAddContent: () => void;
  onAddAdHoc: () => void;
  onRedistribute: (planId: string) => void;
  onRefresh: () => void;
}

interface DailyPlan {
  id: string;
  content_title: string | null;
  content_subject: string | null;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  completed_start_page_or_time: number | null;
  completed_end_page_or_time: number | null;
  status: string | null;
  is_completed: boolean;
  custom_title: string | null;
  custom_range_display: string | null;
  sequence: number | null;
}

interface AdHocPlan {
  id: string;
  title: string;
  status: string;
  estimated_minutes: number | null;
}

export function DailyDock({
  studentId,
  tenantId,
  selectedDate,
  onAddContent,
  onAddAdHoc,
  onRedistribute,
  onRefresh,
}: DailyDockProps) {
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [adHocPlans, setAdHocPlans] = useState<AdHocPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { showToast } = usePlanToast();

  useEffect(() => {
    async function fetchDaily() {
      setIsLoading(true);
      const supabase = createSupabaseBrowserClient();

      // 일반 플랜
      const { data: planData } = await supabase
        .from('student_plan')
        .select(`
          id,
          content_title,
          content_subject,
          planned_start_page_or_time,
          planned_end_page_or_time,
          completed_start_page_or_time,
          completed_end_page_or_time,
          status,
          is_completed,
          custom_title,
          custom_range_display,
          sequence
        `)
        .eq('student_id', studentId)
        .eq('plan_date', selectedDate)
        .eq('container_type', 'daily')
        .eq('is_active', true)
        .order('sequence', { ascending: true });

      // Ad-hoc 플랜
      const { data: adHocData } = await supabase
        .from('ad_hoc_plans')
        .select('id, title, status, estimated_minutes')
        .eq('student_id', studentId)
        .eq('plan_date', selectedDate)
        .eq('container_type', 'daily')
        .order('created_at', { ascending: true });

      setPlans(planData ?? []);
      setAdHocPlans(adHocData ?? []);
      setIsLoading(false);
    }

    fetchDaily();
  }, [studentId, selectedDate]);

  const handleMoveToWeekly = async (planId: string) => {
    const supabase = createSupabaseBrowserClient();

    startTransition(async () => {
      const { error } = await supabase
        .from('student_plan')
        .update({
          container_type: 'weekly',
          updated_at: new Date().toISOString(),
        })
        .eq('id', planId);

      if (error) {
        showToast('Weekly 이동 실패: ' + error.message, 'error');
        return;
      }

      showToast('Weekly Dock으로 이동했습니다.', 'success');
      onRefresh();
    });
  };

  const handleDelete = async (planId: string, isAdHoc = false) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    const supabase = createSupabaseBrowserClient();

    startTransition(async () => {
      let error;
      if (isAdHoc) {
        const result = await supabase.from('ad_hoc_plans').delete().eq('id', planId);
        error = result.error;
      } else {
        const result = await supabase
          .from('student_plan')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', planId);
        error = result.error;
      }

      if (error) {
        showToast('삭제 실패: ' + error.message, 'error');
        return;
      }

      showToast('플랜이 삭제되었습니다.', 'success');
      onRefresh();
    });
  };

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}월 ${day}일 (${days[date.getDay()]})`;
  };

  const totalCount = plans.length + adHocPlans.length;
  const completedCount =
    plans.filter((p) => p.status === 'completed').length +
    adHocPlans.filter((p) => p.status === 'completed').length;

  return (
    <DroppableContainer id="daily">
      <div
        className={cn(
          'bg-blue-50 rounded-lg border border-blue-200 overflow-hidden',
          isPending && 'opacity-50 pointer-events-none'
        )}
      >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-blue-200">
        <div className="flex items-center gap-2">
          <span className="text-lg">📦</span>
          <span className="font-medium text-blue-700">Daily Dock</span>
          <span className="text-sm text-gray-600">
            {formatDateDisplay(selectedDate)}
          </span>
          {totalCount > 0 && (
            <span className="text-sm text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
              {completedCount}/{totalCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onAddContent}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            + 플랜 추가
          </button>
          <button
            onClick={onAddAdHoc}
            className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            + 단발성
          </button>
        </div>
      </div>

      {/* 플랜 목록 */}
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-blue-100 rounded animate-pulse" />
            ))}
          </div>
        ) : totalCount === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>이 날짜에 플랜이 없습니다</p>
            <p className="text-sm mt-1">플랜을 추가해주세요</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* 일반 플랜 */}
            {plans.map((plan) => {
              const hasPageRange = plan.planned_start_page_or_time != null && plan.planned_end_page_or_time != null;
              const isCompleted = plan.is_completed || plan.status === 'completed';

              return (
                <DraggablePlanItem
                  key={plan.id}
                  id={plan.id}
                  type="plan"
                  containerId="daily"
                  title={plan.custom_title ?? plan.content_title ?? '제목 없음'}
                  subject={plan.content_subject ?? undefined}
                  range={hasPageRange ? `p.${plan.planned_start_page_or_time}-${plan.planned_end_page_or_time}` : undefined}
                  disabled={isCompleted}
                >
                  <div
                    className={cn(
                      'flex items-center gap-3 bg-white rounded-lg p-3 border',
                      isCompleted
                        ? 'border-green-200 bg-green-50/50'
                        : 'border-blue-100'
                    )}
                  >
                    {/* 완료 체크박스 */}
                    <QuickCompleteButton
                      planId={plan.id}
                      planType="plan"
                      isCompleted={isCompleted}
                      onSuccess={onRefresh}
                    />

                    {/* 드래그 핸들 */}
                    <span className="text-gray-400 cursor-grab">☰</span>

                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <div
                        className={cn(
                          'font-medium truncate',
                          isCompleted && 'line-through text-gray-500'
                        )}
                      >
                        {plan.custom_title ?? plan.content_title ?? '제목 없음'}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {plan.content_subject && (
                          <span className="text-gray-500">{plan.content_subject}</span>
                        )}
                        {hasPageRange && !isCompleted ? (
                          <InlineVolumeEditor
                            planId={plan.id}
                            currentStart={plan.planned_start_page_or_time!}
                            currentEnd={plan.planned_end_page_or_time!}
                            onSuccess={onRefresh}
                          />
                        ) : hasPageRange ? (
                          <span className="text-gray-500">
                            p.{plan.planned_start_page_or_time}-{plan.planned_end_page_or_time}
                          </span>
                        ) : null}
                      </div>
                      {/* 진행 상황 */}
                      {hasPageRange && !isCompleted && (
                        <div className="mt-1">
                          <QuickProgressInput
                            planId={plan.id}
                            plannedStart={plan.planned_start_page_or_time!}
                            plannedEnd={plan.planned_end_page_or_time!}
                            completedStart={plan.completed_start_page_or_time ?? 0}
                            completedEnd={plan.completed_end_page_or_time ?? 0}
                            onSuccess={onRefresh}
                          />
                        </div>
                      )}
                    </div>

                    {/* 액션 */}
                    {isCompleted ? (
                      <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                        완료
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onRedistribute(plan.id)}
                          className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                          title="볼륨 재분배"
                        >
                          재분배
                        </button>
                        <button
                          onClick={() => handleMoveToWeekly(plan.id)}
                          className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                          title="Weekly로 이동"
                        >
                          →W
                        </button>
                        <button
                          onClick={() => handleDelete(plan.id)}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                          title="삭제"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </DraggablePlanItem>
              );
            })}

            {/* Ad-hoc 플랜 */}
            {adHocPlans.map((adHoc) => {
              const isCompleted = adHoc.status === 'completed';

              return (
                <DraggablePlanItem
                  key={adHoc.id}
                  id={adHoc.id}
                  type="adhoc"
                  containerId="daily"
                  title={adHoc.title}
                  range={adHoc.estimated_minutes ? `약 ${adHoc.estimated_minutes}분` : undefined}
                  disabled={isCompleted}
                >
                  <div
                    className={cn(
                      'flex items-center gap-3 bg-white rounded-lg p-3 border',
                      isCompleted
                        ? 'border-green-200 bg-green-50/50'
                        : 'border-purple-100'
                    )}
                  >
                    {/* 완료 체크박스 */}
                    <QuickCompleteButton
                      planId={adHoc.id}
                      planType="adhoc"
                      isCompleted={isCompleted}
                      onSuccess={onRefresh}
                    />

                    <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                      단발성
                    </span>

                    <div className="flex-1 min-w-0">
                      <div
                        className={cn(
                          'font-medium truncate',
                          isCompleted && 'line-through text-gray-500'
                        )}
                      >
                        {adHoc.title}
                      </div>
                      {adHoc.estimated_minutes && (
                        <div className="text-sm text-gray-500">
                          약 {adHoc.estimated_minutes}분
                        </div>
                      )}
                    </div>

                    {isCompleted ? (
                      <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                        완료
                      </span>
                    ) : (
                      <button
                        onClick={() => handleDelete(adHoc.id, true)}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                        title="삭제"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </DraggablePlanItem>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </DroppableContainer>
  );
}
