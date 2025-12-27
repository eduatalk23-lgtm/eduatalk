'use client';

import { useEffect, useState, useTransition, useMemo, useRef } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/cn';
import {
  logVolumeAdjusted,
  logVolumeRedistributed,
  generateCorrelationId,
} from '@/lib/domains/admin-plan/actions';
import { usePlanToast } from './PlanToast';
import { validateVolumeRange } from '@/lib/domains/admin-plan/validation';
import { createTransactionContext } from '@/lib/supabase/transaction';

interface RedistributeModalProps {
  planId: string;
  studentId: string;
  tenantId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface PlanInfo {
  id: string;
  content_title: string | null;
  content_subject: string | null;
  content_id: string | null;
  custom_title: string | null;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  plan_group_id: string | null;
  plan_date: string;
}

interface AffectedPlan {
  id: string;
  plan_date: string;
  original_start: number;
  original_end: number;
  new_start: number;
  new_end: number;
  change: number;
}

type RedistributeMode = 'auto' | 'manual' | 'weekly';

export function RedistributeModal({
  planId,
  studentId,
  tenantId,
  onClose,
  onSuccess,
}: RedistributeModalProps) {
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { showToast } = usePlanToast();

  // 볼륨 조정
  const [newStart, setNewStart] = useState(0);
  const [newEnd, setNewEnd] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  // debounce를 위한 ref와 state
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedValues, setDebouncedValues] = useState({ start: 0, end: 0 });

  // debounce 적용 (300ms)
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      setDebouncedValues({ start: newStart, end: newEnd });
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [newStart, newEnd]);

  // volumeChange는 useMemo로 최적화
  const volumeChange = useMemo(() => {
    if (!plan || debouncedValues.end === 0) return 0;
    return (
      (plan.planned_end_page_or_time ?? 0) -
      (plan.planned_start_page_or_time ?? 0) -
      (debouncedValues.end - debouncedValues.start)
    );
  }, [plan, debouncedValues]);

  // 입력값 검증
  useEffect(() => {
    if (newStart === 0 && newEnd === 0) return;
    const validation = validateVolumeRange(newStart, newEnd);
    setValidationError(validation.valid ? null : validation.error ?? null);
  }, [newStart, newEnd]);

  // 재분배 모드
  const [mode, setMode] = useState<RedistributeMode>('auto');
  const [manualDate, setManualDate] = useState('');
  const [preview, setPreview] = useState<AffectedPlan[]>([]);

  useEffect(() => {
    async function fetchPlan() {
      const supabase = createSupabaseBrowserClient();

      const { data, error } = await supabase
        .from('student_plan')
        .select(`
          id,
          content_title,
          content_subject,
          content_id,
          custom_title,
          planned_start_page_or_time,
          planned_end_page_or_time,
          plan_group_id,
          plan_date
        `)
        .eq('id', planId)
        .single();

      if (!error && data) {
        setPlan(data);
        setNewStart(data.planned_start_page_or_time ?? 0);
        setNewEnd(data.planned_end_page_or_time ?? 0);
      }
      setIsLoading(false);
    }

    fetchPlan();
  }, [planId]);

  // 미리보기 계산
  useEffect(() => {
    if (!plan || volumeChange === 0 || mode !== 'auto') {
      setPreview([]);
      return;
    }

    async function calculatePreview() {
      if (!plan) return;

      const supabase = createSupabaseBrowserClient();

      // 미래 플랜 조회
      const today = new Date().toISOString().split('T')[0];
      const { data: futurePlans } = await supabase
        .from('student_plan')
        .select('id, plan_date, planned_start_page_or_time, planned_end_page_or_time')
        .eq('student_id', studentId)
        .eq('plan_group_id', plan.plan_group_id)
        .eq('is_active', true)
        .gt('plan_date', today)
        .neq('id', planId)
        .order('plan_date', { ascending: true })
        .limit(7);

      if (!futurePlans || futurePlans.length === 0) {
        setPreview([]);
        return;
      }

      // 볼륨 분배 계산
      const redistributeAmount = Math.abs(volumeChange);
      const perPlanChange = Math.ceil(redistributeAmount / futurePlans.length);
      let remaining = redistributeAmount;

      const previewPlans: AffectedPlan[] = futurePlans.map((fp) => {
        const change = Math.min(perPlanChange, remaining);
        remaining -= change;

        const originalStart = fp.planned_start_page_or_time ?? 0;
        const originalEnd = fp.planned_end_page_or_time ?? 0;

        // 감소 시 미래 플랜에 추가
        const adjustedChange = volumeChange > 0 ? change : -change;

        return {
          id: fp.id,
          plan_date: fp.plan_date,
          original_start: originalStart,
          original_end: originalEnd,
          new_start: originalStart,
          new_end: originalEnd + adjustedChange,
          change: adjustedChange,
        };
      });

      setPreview(previewPlans.filter((p) => p.change !== 0));
    }

    calculatePreview();
  }, [plan, volumeChange, mode, studentId, planId]);

  const handleApply = async () => {
    if (!plan) return;

    // 입력값 검증
    const validation = validateVolumeRange(newStart, newEnd);
    if (!validation.valid) {
      showToast(validation.error ?? '입력값이 유효하지 않습니다.', 'error');
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const correlationId = await generateCorrelationId();
    const originalVolume = (plan.planned_end_page_or_time ?? 0) - (plan.planned_start_page_or_time ?? 0);
    const newVolume = newEnd - newStart;

    startTransition(async () => {
      // 트랜잭션 컨텍스트 생성
      const tx = createTransactionContext();

      // 1. 현재 플랜 업데이트
      tx.add({
        name: 'Update current plan',
        rollbackId: planId,
        execute: async () => {
          const { error } = await supabase
            .from('student_plan')
            .update({
              planned_start_page_or_time: newStart,
              planned_end_page_or_time: newEnd,
              original_volume: originalVolume,
              updated_at: new Date().toISOString(),
            })
            .eq('id', planId);

          return { success: !error, error: error?.message };
        },
      });

      // 2. 재분배 모드에 따른 추가 작업
      if (mode === 'auto' && preview.length > 0) {
        // 미래 플랜들 업데이트
        for (const p of preview) {
          tx.add({
            name: `Update future plan ${p.id}`,
            rollbackId: p.id,
            execute: async () => {
              const { error } = await supabase
                .from('student_plan')
                .update({
                  planned_end_page_or_time: p.new_end,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', p.id);

              return { success: !error, error: error?.message };
            },
          });
        }
      } else if (mode === 'weekly') {
        // Weekly dock으로 이동 - 남은 볼륨으로 새 플랜 생성
        const remainingVolume = Math.abs(volumeChange);
        const newPlanStart = newEnd;
        const newPlanEnd = newPlanStart + remainingVolume;

        tx.add({
          name: 'Create weekly plan',
          execute: async () => {
            const { error } = await supabase.from('student_plan').insert({
              student_id: studentId,
              tenant_id: tenantId,
              plan_group_id: plan.plan_group_id,
              content_id: plan.content_id,
              content_title: plan.content_title,
              content_subject: plan.content_subject,
              custom_title: plan.custom_title,
              plan_date: plan.plan_date,
              planned_start_page_or_time: newPlanStart,
              planned_end_page_or_time: newPlanEnd,
              container_type: 'weekly',
              is_active: true,
              is_completed: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

            return { success: !error, error: error?.message };
          },
        });
      } else if (mode === 'manual' && manualDate) {
        // 특정 날짜에 새 플랜 추가
        const remainingVolume = Math.abs(volumeChange);
        const newPlanStart = newEnd;
        const newPlanEnd = newPlanStart + remainingVolume;

        tx.add({
          name: 'Create manual plan',
          execute: async () => {
            const { error } = await supabase.from('student_plan').insert({
              student_id: studentId,
              tenant_id: tenantId,
              plan_group_id: plan.plan_group_id,
              content_id: plan.content_id,
              content_title: plan.content_title,
              content_subject: plan.content_subject,
              custom_title: plan.custom_title,
              plan_date: manualDate,
              planned_start_page_or_time: newPlanStart,
              planned_end_page_or_time: newPlanEnd,
              container_type: 'daily',
              is_active: true,
              is_completed: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

            return { success: !error, error: error?.message };
          },
        });
      }

      // 트랜잭션 실행
      const txResult = await tx.commit();

      if (!txResult.success) {
        showToast(
          `재분배 중 오류 발생 (${txResult.completedCount}/${txResult.totalCount} 완료): ${txResult.error}`,
          'error'
        );
        return;
      }

      // 성공 시 이벤트 로깅
      if (plan.plan_group_id) {
        await logVolumeAdjusted(
          tenantId,
          studentId,
          plan.plan_group_id,
          {
            original_volume: originalVolume,
            new_volume: newVolume,
            affected_plans: [planId],
            reason: mode === 'auto' ? '자동 재분배' : mode === 'weekly' ? 'Weekly Dock 이동' : '수동 지정',
          }
        );

        if (mode === 'auto' && preview.length > 0) {
          await logVolumeRedistributed(
            tenantId,
            studentId,
            plan.plan_group_id,
            {
              mode: 'auto',
              total_redistributed: Math.abs(volumeChange),
              affected_dates: preview.map((p) => p.plan_date),
              changes: preview.map((p) => ({
                plan_id: p.id,
                date: p.plan_date,
                original: p.original_end - p.original_start,
                new: p.new_end - p.new_start,
              })),
            },
            undefined,
            correlationId
          );
        } else if (mode === 'weekly') {
          await logVolumeRedistributed(
            tenantId,
            studentId,
            plan.plan_group_id,
            {
              mode: 'weekly',
              total_redistributed: Math.abs(volumeChange),
              affected_dates: [],
              changes: [{
                plan_id: 'new',
                date: plan.plan_date,
                original: 0,
                new: Math.abs(volumeChange),
              }],
            },
            undefined,
            correlationId
          );
        } else if (mode === 'manual' && manualDate) {
          await logVolumeRedistributed(
            tenantId,
            studentId,
            plan.plan_group_id,
            {
              mode: 'manual',
              total_redistributed: Math.abs(volumeChange),
              affected_dates: [manualDate],
              changes: [{
                plan_id: 'new',
                date: manualDate,
                original: 0,
                new: Math.abs(volumeChange),
              }],
            },
            undefined,
            correlationId
          );
        }
      }

      showToast('볼륨 재분배가 완료되었습니다.', 'success');
      onSuccess();
    });
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

  if (!plan) {
    return null;
  }

  const originalVolume =
    (plan.planned_end_page_or_time ?? 0) - (plan.planned_start_page_or_time ?? 0);
  const newVolume = newEnd - newStart;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={cn(
          'bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto',
          isPending && 'opacity-50 pointer-events-none'
        )}
      >
        {/* 헤더 */}
        <div className="p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-bold">볼륨 조정 + 재분배</h2>
          <p className="text-sm text-gray-500 mt-1">
            {plan.content_title ?? '플랜'} 볼륨을 조정합니다
          </p>
        </div>

        {/* 내용 */}
        <div className="p-4 space-y-6">
          {/* 현재 볼륨 표시 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-2">현재 범위</div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">p.</span>
                <span className="font-mono text-lg">
                  {plan.planned_start_page_or_time}-{plan.planned_end_page_or_time}
                </span>
                <span className="text-gray-500">({originalVolume}p)</span>
              </div>
            </div>
          </div>

          {/* 새 볼륨 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              변경할 범위
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">p.</span>
              <input
                type="number"
                value={newStart}
                onChange={(e) => setNewStart(Number(e.target.value))}
                className="w-20 px-3 py-2 border rounded-md font-mono"
              />
              <span className="text-gray-500">-</span>
              <input
                type="number"
                value={newEnd}
                onChange={(e) => setNewEnd(Number(e.target.value))}
                className="w-20 px-3 py-2 border rounded-md font-mono"
              />
              <span className="text-gray-500">({newVolume}p)</span>
            </div>

            {validationError && (
              <div className="mt-2 text-sm text-red-600">
                {validationError}
              </div>
            )}

            {!validationError && volumeChange !== 0 && (
              <div
                className={cn(
                  'mt-2 text-sm',
                  volumeChange > 0 ? 'text-red-600' : 'text-green-600'
                )}
              >
                {volumeChange > 0 ? `${volumeChange}p 감소` : `${Math.abs(volumeChange)}p 증가`}
              </div>
            )}
          </div>

          {/* 재분배 옵션 */}
          {volumeChange !== 0 && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                재분배 옵션
              </label>

              {/* 자동 재분배 */}
              <label
                className={cn(
                  'flex items-start gap-3 p-3 border rounded-lg cursor-pointer',
                  mode === 'auto' && 'border-blue-500 bg-blue-50'
                )}
              >
                <input
                  type="radio"
                  checked={mode === 'auto'}
                  onChange={() => setMode('auto')}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">자동 재분배 (권장)</div>
                  <div className="text-sm text-gray-500">
                    {volumeChange > 0 ? '감소분' : '증가분'} {Math.abs(volumeChange)}p를 미래
                    플랜에 자동 분배
                  </div>
                </div>
              </label>

              {/* 미리보기 */}
              {mode === 'auto' && preview.length > 0 && (
                <div className="ml-6 bg-gray-50 rounded-lg p-3 text-sm">
                  <div className="font-medium mb-2">미리보기:</div>
                  {preview.map((p) => (
                    <div key={p.id} className="flex justify-between text-gray-600">
                      <span>{formatDate(p.plan_date)}</span>
                      <span>
                        p.{p.original_start}-{p.original_end} → p.{p.new_start}-{p.new_end}
                        <span className={p.change > 0 ? 'text-blue-600' : 'text-red-600'}>
                          {' '}
                          ({p.change > 0 ? '+' : ''}
                          {p.change}p)
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* 수동 지정 */}
              <label
                className={cn(
                  'flex items-start gap-3 p-3 border rounded-lg cursor-pointer',
                  mode === 'manual' && 'border-blue-500 bg-blue-50'
                )}
              >
                <input
                  type="radio"
                  checked={mode === 'manual'}
                  onChange={() => setMode('manual')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium">수동 지정</div>
                  <div className="text-sm text-gray-500">
                    특정 날짜에 직접 추가
                  </div>
                  {mode === 'manual' && (
                    <input
                      type="date"
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      className="mt-2 px-3 py-1.5 border rounded text-sm"
                    />
                  )}
                </div>
              </label>

              {/* Weekly Dock */}
              <label
                className={cn(
                  'flex items-start gap-3 p-3 border rounded-lg cursor-pointer',
                  mode === 'weekly' && 'border-blue-500 bg-blue-50'
                )}
              >
                <input
                  type="radio"
                  checked={mode === 'weekly'}
                  onChange={() => setMode('weekly')}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">Weekly Dock으로 이동</div>
                  <div className="text-sm text-gray-500">
                    {Math.abs(volumeChange)}p를 이번 주 유동 플랜으로 전환
                  </div>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t flex justify-end gap-2 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
          >
            취소
          </button>
          <button
            onClick={handleApply}
            disabled={volumeChange === 0 || !!validationError}
            className={cn(
              'px-4 py-2 text-sm text-white rounded-md',
              volumeChange === 0 || !!validationError
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            )}
          >
            적용
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
