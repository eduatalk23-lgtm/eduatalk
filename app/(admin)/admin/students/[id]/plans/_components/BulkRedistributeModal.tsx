'use client';

import { useEffect, useState, useTransition } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/cn';
import {
  logVolumeRedistributed,
  logPlanDeleted,
  generateCorrelationId,
} from '@/lib/domains/admin-plan/actions';
import { adminBulkUpdatePlans, type StudentPlanUpdateInput } from '@/lib/domains/admin-plan/actions/editPlan';
import { copyPlansToDate } from '@/lib/domains/admin-plan/actions/copyPlan';
import {
  getStudentPlanGroups,
  movePlansToGroup,
  type PlanGroupInfo,
} from '@/lib/domains/admin-plan/actions/moveToGroup';
import { createPlanTemplate } from '@/lib/domains/admin-plan/actions/planTemplates';
import type { PlanStatus, ContainerType } from '@/lib/domains/admin-plan/types';

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

type BulkAction = 'move_to_daily' | 'move_to_weekly' | 'delete' | 'bulk_edit' | 'copy' | 'move_to_group' | 'save_as_template';

const STATUS_OPTIONS: { value: PlanStatus; label: string }[] = [
  { value: 'pending', label: '대기중' },
  { value: 'in_progress', label: '진행중' },
  { value: 'completed', label: '완료' },
  { value: 'skipped', label: '건너뜀' },
  { value: 'cancelled', label: '취소됨' },
];

const CONTAINER_OPTIONS: { value: ContainerType; label: string }[] = [
  { value: 'daily', label: 'Daily (일일)' },
  { value: 'weekly', label: 'Weekly (주간)' },
  { value: 'unfinished', label: 'Unfinished (미완료)' },
];

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
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 일괄 수정 필드
  const [editStatus, setEditStatus] = useState<{ enabled: boolean; value: PlanStatus }>({
    enabled: false,
    value: 'pending',
  });
  const [editContainer, setEditContainer] = useState<{ enabled: boolean; value: ContainerType }>({
    enabled: false,
    value: 'daily',
  });
  const [editEstimatedMinutes, setEditEstimatedMinutes] = useState<{ enabled: boolean; value: number | null }>({
    enabled: false,
    value: 30,
  });

  const hasBulkEditChanges = editStatus.enabled || editContainer.enabled || editEstimatedMinutes.enabled;

  // 복사 관련 상태
  const [copyTargetDates, setCopyTargetDates] = useState<string[]>([]);
  const [copyDateInput, setCopyDateInput] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [copyToOtherStudents, setCopyToOtherStudents] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<{ id: string; name: string }[]>([]);
  const [selectedTargetStudents, setSelectedTargetStudents] = useState<string[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  const handleAddCopyDate = () => {
    if (copyDateInput && !copyTargetDates.includes(copyDateInput)) {
      setCopyTargetDates([...copyTargetDates, copyDateInput].sort());
    }
  };

  const handleRemoveCopyDate = (date: string) => {
    setCopyTargetDates(copyTargetDates.filter((d) => d !== date));
  };

  const handleToggleTargetStudent = (targetStudentId: string) => {
    setSelectedTargetStudents((prev) =>
      prev.includes(targetStudentId)
        ? prev.filter((id) => id !== targetStudentId)
        : [...prev, targetStudentId]
    );
  };

  // 그룹 이동 관련 상태
  const [planGroups, setPlanGroups] = useState<PlanGroupInfo[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);

  // 템플릿 저장 관련 상태
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  // 그룹 이동 선택 시 그룹 목록 로드
  useEffect(() => {
    if (action === 'move_to_group' && planGroups.length === 0 && !isLoadingGroups) {
      setIsLoadingGroups(true);
      getStudentPlanGroups(studentId).then((result) => {
        if (result.success && result.data) {
          setPlanGroups(result.data);
        }
        setIsLoadingGroups(false);
      });
    }
  }, [action, studentId, planGroups.length, isLoadingGroups]);

  // 다른 학생에게 복사 선택 시 학생 목록 로드
  useEffect(() => {
    if (action === 'copy' && copyToOtherStudents && availableStudents.length === 0 && !isLoadingStudents) {
      setIsLoadingStudents(true);
      const supabase = createSupabaseBrowserClient();
      supabase
        .from('students')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
        .then(({ data }) => {
          if (data) {
            // 현재 학생 제외
            setAvailableStudents(data.filter((s) => s.id !== studentId));
          }
          setIsLoadingStudents(false);
        });
    }
  }, [action, copyToOtherStudents, studentId, availableStudents.length, isLoadingStudents]);

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

        if (!error) {
          // 이벤트 로깅 (삭제)
          for (const plan of plans) {
            await logPlanDeleted(
              tenantId,
              studentId,
              plan.id,
              {
                plan_type: 'plan',
                plan_title: plan.custom_title ?? plan.content_title ?? '제목 없음',
                reason: `일괄 삭제 (${plans.length}건)`,
              }
            );
          }
        } else {
          console.error('Failed to delete:', error);
        }
      } else if (action === 'bulk_edit') {
        // 일괄 수정
        if (!hasBulkEditChanges) {
          console.error('No changes to apply');
          return;
        }

        const updates: Partial<StudentPlanUpdateInput> = {};
        if (editStatus.enabled) {
          updates.status = editStatus.value;
        }
        if (editContainer.enabled) {
          updates.container_type = editContainer.value;
        }
        if (editEstimatedMinutes.enabled && editEstimatedMinutes.value !== null) {
          updates.estimated_minutes = editEstimatedMinutes.value;
        }

        const result = await adminBulkUpdatePlans(planIds, studentId, updates);
        if (!result.success) {
          console.error('Failed to bulk edit:', result.error);
        }
      } else if (action === 'copy') {
        // 복사
        if (copyTargetDates.length === 0) {
          console.error('No target dates selected');
          return;
        }

        // 다른 학생에게 복사 시 대상 학생 필수
        if (copyToOtherStudents && selectedTargetStudents.length === 0) {
          console.error('No target students selected');
          return;
        }

        const result = await copyPlansToDate({
          sourcePlanIds: planIds,
          targetDates: copyTargetDates,
          studentId,
          targetStudentIds: copyToOtherStudents ? selectedTargetStudents : undefined,
        });

        if (!result.success) {
          console.error('Failed to copy plans:', result.error);
        }
      } else if (action === 'move_to_group') {
        // 그룹 이동
        const result = await movePlansToGroup({
          planIds,
          targetGroupId: selectedGroupId,
          studentId,
        });

        if (!result.success) {
          console.error('Failed to move to group:', result.error);
        }
      } else if (action === 'save_as_template') {
        // 템플릿 저장
        const result = await createPlanTemplate({
          name: templateName.trim(),
          description: templateDescription.trim() || undefined,
          planIds,
          studentId,
        });

        if (!result.success) {
          console.error('Failed to save template:', result.error);
          alert(result.error || '템플릿 저장에 실패했습니다.');
          return;
        }

        alert(`템플릿 "${templateName}"이 저장되었습니다.`);
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
          'bg-white rounded-lg w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden',
          isPending && 'opacity-50 pointer-events-none'
        )}
      >
        {/* 헤더 */}
        <div className="flex-shrink-0 p-4 border-b">
          <h2 className="text-lg font-bold">일괄 작업</h2>
          <p className="text-sm text-gray-500 mt-1">
            {plans.length}개 플랜 선택됨 (총 {getTotalVolume()}p)
          </p>
        </div>

        {/* 선택된 플랜 목록 */}
        <div className="flex-shrink-0 p-4 border-b max-h-48 overflow-y-auto">
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
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
              onChange={() => {
                setAction('delete');
                setConfirmDelete(false);
              }}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-medium text-red-700">삭제</div>
              <div className="text-sm text-gray-500">
                선택한 플랜을 모두 삭제
              </div>
              {action === 'delete' && (
                <div className="mt-3 p-3 bg-red-100 rounded-lg">
                  <div className="flex items-start gap-2 text-sm text-red-800 mb-2">
                    <span className="text-base">⚠️</span>
                    <div>
                      <strong>{plans.length}개</strong>의 플랜이 삭제됩니다.
                      이 작업은 나중에 복구할 수 있습니다.
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-red-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmDelete}
                      onChange={(e) => setConfirmDelete(e.target.checked)}
                      className="rounded border-red-300 text-red-600 focus:ring-red-500"
                    />
                    삭제를 확인합니다
                  </label>
                </div>
              )}
            </div>
          </label>

          {/* 일괄 수정 */}
          <label
            className={cn(
              'flex items-start gap-3 p-3 border rounded-lg cursor-pointer',
              action === 'bulk_edit' && 'border-amber-500 bg-amber-50'
            )}
          >
            <input
              type="radio"
              checked={action === 'bulk_edit'}
              onChange={() => setAction('bulk_edit')}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-medium text-amber-700">일괄 수정</div>
              <div className="text-sm text-gray-500">
                선택한 플랜의 속성을 일괄 변경
              </div>
              {action === 'bulk_edit' && (
                <div className="mt-3 space-y-3">
                  {/* 상태 변경 */}
                  <div className="space-y-1">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editStatus.enabled}
                        onChange={(e) =>
                          setEditStatus((prev) => ({ ...prev, enabled: e.target.checked }))
                        }
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm font-medium">상태 변경</span>
                    </label>
                    {editStatus.enabled && (
                      <select
                        value={editStatus.value}
                        onChange={(e) =>
                          setEditStatus((prev) => ({ ...prev, value: e.target.value as PlanStatus }))
                        }
                        className="w-full px-3 py-1.5 border rounded-md text-sm"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* 컨테이너 변경 */}
                  <div className="space-y-1">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editContainer.enabled}
                        onChange={(e) =>
                          setEditContainer((prev) => ({ ...prev, enabled: e.target.checked }))
                        }
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm font-medium">컨테이너 변경</span>
                    </label>
                    {editContainer.enabled && (
                      <select
                        value={editContainer.value}
                        onChange={(e) =>
                          setEditContainer((prev) => ({ ...prev, value: e.target.value as ContainerType }))
                        }
                        className="w-full px-3 py-1.5 border rounded-md text-sm"
                      >
                        {CONTAINER_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* 예상 시간 변경 */}
                  <div className="space-y-1">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editEstimatedMinutes.enabled}
                        onChange={(e) =>
                          setEditEstimatedMinutes((prev) => ({
                            ...prev,
                            enabled: e.target.checked,
                          }))
                        }
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm font-medium">예상 시간 (분)</span>
                    </label>
                    {editEstimatedMinutes.enabled && (
                      <input
                        type="number"
                        value={editEstimatedMinutes.value ?? ''}
                        onChange={(e) =>
                          setEditEstimatedMinutes((prev) => ({
                            ...prev,
                            value: e.target.value ? parseInt(e.target.value, 10) : null,
                          }))
                        }
                        className="w-full px-3 py-1.5 border rounded-md text-sm"
                        min="0"
                        placeholder="30"
                      />
                    )}
                  </div>

                  {/* 미리보기 */}
                  {hasBulkEditChanges && (
                    <div className="p-2 bg-amber-100 rounded text-sm text-amber-800">
                      <div className="font-medium mb-1">변경 사항:</div>
                      <ul className="space-y-0.5">
                        {editStatus.enabled && (
                          <li>
                            상태 → {STATUS_OPTIONS.find((o) => o.value === editStatus.value)?.label}
                          </li>
                        )}
                        {editContainer.enabled && (
                          <li>
                            컨테이너 → {CONTAINER_OPTIONS.find((o) => o.value === editContainer.value)?.label}
                          </li>
                        )}
                        {editEstimatedMinutes.enabled && (
                          <li>예상 시간 → {editEstimatedMinutes.value}분</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </label>

          {/* 복사 */}
          <label
            className={cn(
              'flex items-start gap-3 p-3 border rounded-lg cursor-pointer',
              action === 'copy' && 'border-teal-500 bg-teal-50'
            )}
          >
            <input
              type="radio"
              checked={action === 'copy'}
              onChange={() => setAction('copy')}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-medium text-teal-700">복사</div>
              <div className="text-sm text-gray-500">
                선택한 플랜을 다른 날짜로 복사
              </div>
              {action === 'copy' && (
                <div className="mt-3 space-y-3">
                  {/* 날짜 입력 */}
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={copyDateInput}
                      onChange={(e) => setCopyDateInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 border rounded-md text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleAddCopyDate}
                      className="px-3 py-1.5 bg-teal-600 text-white rounded-md text-sm hover:bg-teal-700"
                    >
                      추가
                    </button>
                  </div>

                  {/* 선택된 날짜 목록 */}
                  {copyTargetDates.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {copyTargetDates.map((date) => (
                        <span
                          key={date}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-700 rounded-full text-xs"
                        >
                          {formatDate(date)}
                          <button
                            type="button"
                            onClick={() => handleRemoveCopyDate(date)}
                            className="text-teal-500 hover:text-teal-700"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 다른 학생에게 복사 옵션 */}
                  <div className="pt-2 border-t border-teal-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={copyToOtherStudents}
                        onChange={(e) => {
                          setCopyToOtherStudents(e.target.checked);
                          if (!e.target.checked) {
                            setSelectedTargetStudents([]);
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm font-medium">다른 학생에게도 복사</span>
                    </label>

                    {copyToOtherStudents && (
                      <div className="mt-2 space-y-2">
                        {isLoadingStudents ? (
                          <div className="text-sm text-gray-500 py-2">학생 목록 로딩 중...</div>
                        ) : availableStudents.length === 0 ? (
                          <div className="text-sm text-gray-500 py-2">복사 가능한 다른 학생이 없습니다.</div>
                        ) : (
                          <>
                            <div className="max-h-32 overflow-y-auto space-y-1 border rounded-md p-2">
                              {availableStudents.map((student) => (
                                <label
                                  key={student.id}
                                  className={cn(
                                    'flex items-center gap-2 p-1.5 rounded cursor-pointer text-sm hover:bg-teal-50',
                                    selectedTargetStudents.includes(student.id) && 'bg-teal-100'
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedTargetStudents.includes(student.id)}
                                    onChange={() => handleToggleTargetStudent(student.id)}
                                    className="w-3.5 h-3.5 rounded border-gray-300 text-teal-600"
                                  />
                                  <span>{student.name}</span>
                                </label>
                              ))}
                            </div>
                            {selectedTargetStudents.length > 0 && (
                              <div className="text-xs text-teal-600">
                                {selectedTargetStudents.length}명 학생 선택됨
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 미리보기 */}
                  {copyTargetDates.length > 0 && (
                    <div className="p-2 bg-teal-100 rounded text-sm text-teal-800">
                      <strong>{plans.length}</strong>개 플랜 ×{' '}
                      <strong>{copyTargetDates.length}</strong>개 날짜
                      {copyToOtherStudents && selectedTargetStudents.length > 0 && (
                        <> × <strong>{selectedTargetStudents.length}</strong>명 학생</>
                      )}
                      {' '}= <strong>
                        {plans.length * copyTargetDates.length * (copyToOtherStudents && selectedTargetStudents.length > 0 ? selectedTargetStudents.length : 1)}
                      </strong>개 새 플랜 생성
                    </div>
                  )}
                </div>
              )}
            </div>
          </label>

          {/* 그룹 이동 */}
          <label
            className={cn(
              'flex items-start gap-3 p-3 border rounded-lg cursor-pointer',
              action === 'move_to_group' && 'border-indigo-500 bg-indigo-50'
            )}
          >
            <input
              type="radio"
              checked={action === 'move_to_group'}
              onChange={() => setAction('move_to_group')}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-medium text-indigo-700">그룹 이동</div>
              <div className="text-sm text-gray-500">
                선택한 플랜을 다른 플랜 그룹으로 이동
              </div>
              {action === 'move_to_group' && (
                <div className="mt-3 space-y-2">
                  {isLoadingGroups ? (
                    <div className="text-sm text-gray-500">그룹 목록 로딩 중...</div>
                  ) : (
                    <>
                      {/* 그룹에서 제거 옵션 */}
                      <label
                        className={cn(
                          'flex items-center gap-2 p-2 border rounded cursor-pointer text-sm',
                          selectedGroupId === null && 'border-orange-400 bg-orange-50'
                        )}
                      >
                        <input
                          type="radio"
                          checked={selectedGroupId === null}
                          onChange={() => setSelectedGroupId(null)}
                          name="targetGroup"
                          className="w-3 h-3"
                        />
                        <span className="text-orange-700">그룹에서 제거</span>
                      </label>

                      {/* 그룹 목록 */}
                      {planGroups.length === 0 ? (
                        <div className="text-sm text-gray-500 py-2">
                          생성된 플랜 그룹이 없습니다.
                        </div>
                      ) : (
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {planGroups.map((group) => (
                            <label
                              key={group.id}
                              className={cn(
                                'flex items-center gap-2 p-2 border rounded cursor-pointer text-sm',
                                selectedGroupId === group.id && 'border-indigo-400 bg-indigo-50'
                              )}
                            >
                              <input
                                type="radio"
                                checked={selectedGroupId === group.id}
                                onChange={() => setSelectedGroupId(group.id)}
                                name="targetGroup"
                                className="w-3 h-3"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="truncate">{group.name}</div>
                                <div className="text-xs text-gray-500">
                                  플랜 {group.plan_count}개
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </label>

          {/* 템플릿 저장 */}
          <label
            className={cn(
              'flex items-start gap-3 p-3 border rounded-lg cursor-pointer',
              action === 'save_as_template' && 'border-violet-500 bg-violet-50'
            )}
          >
            <input
              type="radio"
              checked={action === 'save_as_template'}
              onChange={() => setAction('save_as_template')}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-medium text-violet-700">템플릿으로 저장</div>
              <div className="text-sm text-gray-500">
                선택한 플랜 구성을 템플릿으로 저장하여 재사용
              </div>
              {action === 'save_as_template' && (
                <div className="mt-3 space-y-3">
                  {/* 템플릿 이름 */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">
                      템플릿 이름 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="예: 주간 기본 학습 플랜"
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    />
                  </div>

                  {/* 템플릿 설명 */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">
                      설명 (선택)
                    </label>
                    <textarea
                      value={templateDescription}
                      onChange={(e) => setTemplateDescription(e.target.value)}
                      placeholder="템플릿에 대한 간단한 설명..."
                      rows={2}
                      className="w-full px-3 py-2 border rounded-md text-sm resize-none"
                    />
                  </div>

                  {/* 미리보기 */}
                  <div className="p-2 bg-violet-100 rounded text-sm text-violet-800">
                    <strong>{plans.length}</strong>개 플랜이 템플릿에 저장됩니다.
                    <br />
                    <span className="text-xs text-violet-600">
                      다른 학생에게 동일한 플랜 구성을 빠르게 적용할 수 있습니다.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </label>
        </div>

        {/* 푸터 */}
        <div className="flex-shrink-0 p-4 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
          >
            취소
          </button>
          <button
            onClick={handleApply}
            disabled={
              (action === 'delete' && !confirmDelete) ||
              (action === 'bulk_edit' && !hasBulkEditChanges) ||
              (action === 'copy' && copyTargetDates.length === 0) ||
              (action === 'copy' && copyToOtherStudents && selectedTargetStudents.length === 0) ||
              (action === 'save_as_template' && !templateName.trim())
            }
            className={cn(
              'px-4 py-2 text-sm text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed',
              action === 'delete'
                ? 'bg-red-600 hover:bg-red-700'
                : action === 'bulk_edit'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : action === 'copy'
                    ? 'bg-teal-600 hover:bg-teal-700'
                    : action === 'move_to_group'
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : action === 'save_as_template'
                        ? 'bg-violet-600 hover:bg-violet-700'
                        : 'bg-blue-600 hover:bg-blue-700'
            )}
          >
            {action === 'delete'
              ? '삭제'
              : action === 'bulk_edit'
                ? '수정 적용'
                : action === 'copy'
                  ? `${plans.length * copyTargetDates.length * (copyToOtherStudents && selectedTargetStudents.length > 0 ? selectedTargetStudents.length : 1)}개 플랜 복사`
                  : action === 'move_to_group'
                    ? selectedGroupId
                      ? '그룹으로 이동'
                      : '그룹에서 제거'
                    : action === 'save_as_template'
                      ? '템플릿 저장'
                      : '적용'}
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
