'use client';

import { useState, useTransition, memo } from 'react';
import { cn } from '@/lib/cn';
import { DraggablePlanItem } from '../dnd';
import { QuickCompleteButton, InlineVolumeEditor } from '../QuickActions';
import { useToast } from '@/components/ui/ToastProvider';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { MoreVertical, Calendar, Edit3, Copy, Trash2, ArrowRight, RefreshCw, FolderInput, ToggleLeft, AlertTriangle, ChevronRight, Check, Circle, XCircle } from 'lucide-react';
import { getTodayInTimezone } from '@/lib/utils/dateUtils';
import { formatPlanLearningAmount } from '@/lib/utils/planFormatting';
import { movePlanToContainer, deletePlan, updatePlanStatus } from '@/lib/domains/plan/actions/dock';
import type { ConflictInfo } from '@/lib/domains/admin-plan/utils/conflictDetection';
import type { PlanStatus } from '@/lib/types/plan';

/** 빠른 상태 변경 옵션 (이진 완료 기준) */
const QUICK_STATUS_OPTIONS: Array<{
  status: PlanStatus;
  label: string;
  icon: typeof Check;
  colorClass: string;
}> = [
  { status: 'pending', label: '미완료', icon: Circle, colorClass: 'text-gray-500' },
  { status: 'completed', label: '완료', icon: Check, colorClass: 'text-green-500' },
  { status: 'cancelled', label: '취소', icon: XCircle, colorClass: 'text-red-500' },
];

export type PlanItemType = 'plan' | 'adhoc';
export type ContainerType = 'daily' | 'weekly' | 'unfinished';

export type TimeSlotType = "study" | "self_study" | null;

export interface PlanItemData {
  id: string;
  type: PlanItemType;
  title: string;
  subject?: string;
  /** 콘텐츠 타입 (book/lecture/custom) - 범위 표시 형식 결정에 사용 */
  contentType?: 'book' | 'lecture' | 'custom' | string;
  pageRangeStart?: number | null;
  pageRangeEnd?: number | null;
  completedAmount?: number | null;
  progress?: number | null;
  status: PlanStatus;
  isCompleted: boolean;
  customTitle?: string | null;
  customRangeDisplay?: string | null;
  estimatedMinutes?: number | null;
  planDate?: string;
  startTime?: string | null;
  endTime?: string | null;
  carryoverCount?: number;
  carryoverFromDate?: string | null;
  planGroupId?: string | null;
  /** Phase 4: 시간대 유형 (학습시간/자율학습시간) */
  timeSlotType?: TimeSlotType;
  /** Phase 4: 배치 사유 */
  allocationReason?: string | null;
}

interface PlanItemCardProps {
  plan: PlanItemData;
  container: ContainerType;
  variant?: 'default' | 'compact' | 'grid';
  showProgress?: boolean;
  showTime?: boolean;
  showCarryover?: boolean;
  showActions?: boolean;
  selectable?: boolean;
  isSelected?: boolean;
  /** 시간 충돌 정보 (optional, DailyDock에서만 전달) */
  conflictInfo?: ConflictInfo;
  onSelect?: (id: string) => void;
  onMoveToDaily?: (id: string, date?: string) => void;
  onMoveToWeekly?: (id: string) => void;
  onMoveToUnfinished?: (id: string) => void;
  onRedistribute?: (id: string) => void;
  onDelete?: (id: string, isAdHoc?: boolean) => void;
  onEditDate?: (id: string) => void;
  onEdit?: (id: string) => void;
  onCopy?: (id: string) => void;
  onMoveToGroup?: (id: string) => void;
  onStatusChange?: (id: string, currentStatus: PlanStatus, title: string) => void;
  /** 빠른 상태 변경 콜백 (서브메뉴에서 직접 상태 변경 시 사용) */
  onQuickStatusUpdate?: (id: string, newStatus: PlanStatus) => Promise<void>;
  onRefresh?: () => void;
}

const containerColors = {
  daily: {
    border: 'border-gray-200',
    borderCompleted: 'border-gray-200 bg-green-50/30',
  },
  weekly: {
    border: 'border-gray-200 hover:border-gray-300',
    borderCompleted: 'border-gray-200 bg-green-50/30',
  },
  unfinished: {
    border: 'border-gray-200',
    borderCompleted: 'border-gray-200 bg-green-50/30',
  },
};

/**
 * 좌측 상태 보더 색상 결정
 * - 기본: pending=gray, completed=green
 * - 이월 오버라이드: 1회=yellow, 2회=orange, 3회+=red
 */
function getLeftBorderColor(isCompleted: boolean, carryoverCount: number = 0): string {
  // 완료 상태는 항상 green
  if (isCompleted) {
    return 'border-l-4 border-l-green-400';
  }

  // 이월 횟수에 따른 오버라이드 (pending 상태일 때만)
  if (carryoverCount >= 3) {
    return 'border-l-4 border-l-red-500';
  }
  if (carryoverCount === 2) {
    return 'border-l-4 border-l-orange-400';
  }
  if (carryoverCount === 1) {
    return 'border-l-4 border-l-yellow-400';
  }

  // 기본 pending 상태
  return 'border-l-4 border-l-gray-300';
}

/**
 * Phase 4: 시간대 유형별 색상 스타일
 */
const timeSlotColors = {
  study: {
    badge: 'bg-green-100 text-green-700',
    label: '학습',
  },
  self_study: {
    badge: 'bg-teal-100 text-teal-700',
    label: '자율학습',
  },
};

/**
 * PlanItemCard - 플랜 아이템 카드 컴포넌트
 *
 * React.memo로 감싸서 props가 변경되지 않으면 리렌더링을 방지합니다.
 * 리스트에서 다수의 카드가 렌더링되므로 메모이제이션 효과가 큽니다.
 */
export const PlanItemCard = memo(function PlanItemCard({
  plan,
  container,
  variant = 'default',
  showProgress = true,
  showTime = false,
  showCarryover = false,
  showActions = true,
  selectable = false,
  isSelected = false,
  conflictInfo,
  onSelect,
  onMoveToDaily,
  onMoveToWeekly,
  onMoveToUnfinished,
  onRedistribute,
  onDelete,
  onEditDate,
  onEdit,
  onCopy,
  onMoveToGroup,
  onStatusChange,
  onQuickStatusUpdate,
  onRefresh,
}: PlanItemCardProps) {
  const [isPending, startTransition] = useTransition();
  const { showSuccess, showError } = useToast();
  const isAdHoc = plan.type === 'adhoc';
  const isCompleted = plan.isCompleted || plan.status === 'completed';
  const hasPageRange = plan.pageRangeStart != null && plan.pageRangeEnd != null;

  // 삭제 확인 모달 상태 (onDelete가 없을 때 내부에서 처리)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 범위 표시: customRangeDisplay 우선, 없으면 contentType에 따라 포맷팅
  const rangeDisplay = plan.customRangeDisplay ?? (hasPageRange
    ? formatPlanLearningAmount({
        content_type: plan.contentType || 'book',
        planned_start_page_or_time: plan.pageRangeStart!,
        planned_end_page_or_time: plan.pageRangeEnd!,
      })
    : undefined);

  const handleMoveContainer = async (targetContainer: ContainerType) => {
    startTransition(async () => {
      const result = await movePlanToContainer({
        planId: plan.id,
        targetContainer,
        isAdHoc,
        targetDate: targetContainer === 'daily' ? getTodayInTimezone() : undefined,
      });

      if (!result.success) {
        showError(result.error ?? '이동 실패');
        return;
      }

      const containerName = targetContainer === 'daily' ? 'Daily' :
                           targetContainer === 'weekly' ? 'Weekly' : 'Unfinished';
      showSuccess(`${containerName} Dock으로 이동했습니다.`);
      onRefresh?.();
    });
  };

  // 삭제 요청 (확인 모달 열기 또는 부모 콜백 호출)
  const handleDeleteRequest = () => {
    if (onDelete) {
      // 부모에서 ConfirmDialog 처리
      onDelete(plan.id, isAdHoc);
    } else {
      // 내부 ConfirmDialog 사용
      setShowDeleteConfirm(true);
    }
  };

  // 삭제 실행 (내부 ConfirmDialog에서 확인 시)
  const handleDeleteConfirm = async () => {
    startTransition(async () => {
      const result = await deletePlan({
        planId: plan.id,
        isAdHoc,
      });

      if (!result.success) {
        showError(result.error ?? '삭제 실패');
        setShowDeleteConfirm(false);
        return;
      }

      showSuccess('플랜이 삭제되었습니다.');
      setShowDeleteConfirm(false);
      onRefresh?.();
    });
  };

  /** 빠른 상태 변경 핸들러 */
  const handleQuickStatusChange = async (newStatus: PlanStatus) => {
    // 같은 상태면 무시
    if (plan.status === newStatus) return;

    // 외부 콜백이 있으면 사용
    if (onQuickStatusUpdate) {
      try {
        await onQuickStatusUpdate(plan.id, newStatus);
        showSuccess(`상태가 '${QUICK_STATUS_OPTIONS.find(o => o.status === newStatus)?.label}'(으)로 변경되었습니다.`);
      } catch (error) {
        showError('상태 변경 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
      }
      return;
    }

    // Server Action 사용
    startTransition(async () => {
      const result = await updatePlanStatus({
        planId: plan.id,
        status: newStatus,
        isAdHoc,
      });

      if (!result.success) {
        showError(result.error ?? '상태 변경 실패');
        return;
      }

      showSuccess(`상태가 '${QUICK_STATUS_OPTIONS.find(o => o.status === newStatus)?.label}'(으)로 변경되었습니다.`);
      onRefresh?.();
    });
  };

  const colors = containerColors[container];

  // Compact variant (for grid/weekly view)
  if (variant === 'compact' || variant === 'grid') {
    return (
    <>
      {/* 외부 래퍼: 선택 모드일 때 체크박스를 카드 외부에 배치 */}
      <div className="flex items-start gap-2 min-w-0">
        {/* 선택 모드 체크박스 (카드 외부) */}
        {selectable && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect?.(plan.id)}
            className="w-4 h-4 mt-3 rounded border-gray-300 shrink-0"
            onClick={(e) => e.stopPropagation()}
          />
        )}

        <DraggablePlanItem
          id={plan.id}
          type={plan.type}
          containerId={container}
          title={plan.title}
          subject={plan.subject}
          range={rangeDisplay}
          planDate={plan.planDate}
          disabled={isCompleted || isPending}
        >
          <div
            className={cn(
              'flex flex-col gap-2 bg-white rounded-lg p-3 border transition-opacity flex-1',
              getLeftBorderColor(isCompleted, plan.carryoverCount),
              isCompleted ? colors.borderCompleted : colors.border,
              isPending && 'opacity-50 pointer-events-none'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              {/* QuickComplete 버튼 (항상 표시) */}
              <QuickCompleteButton
                planId={plan.id}
                planType={isAdHoc ? 'adhoc' : 'plan'}
                isCompleted={isCompleted}
                onSuccess={onRefresh ?? (() => {})}
                size="sm"
              />

              {/* Time display for compact - 좌측 시간 블록 */}
              {showTime && plan.startTime && (
                <div className="flex flex-col items-center justify-center w-12 shrink-0 py-1 px-1 bg-blue-50 rounded border border-blue-100">
                  <span className="text-xs font-semibold text-blue-700 tabular-nums">
                    {plan.startTime.substring(0, 5)}
                  </span>
                  {plan.endTime && (
                    <span className="text-[9px] text-blue-500 tabular-nums">
                      ~{plan.endTime.substring(0, 5)}
                    </span>
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 flex-wrap mb-1">
                {isAdHoc && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                    단발성
                  </span>
                )}
                {/* Phase 4: Time slot type badge */}
                {plan.timeSlotType && timeSlotColors[plan.timeSlotType] && (
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded",
                    timeSlotColors[plan.timeSlotType].badge
                  )}>
                    {timeSlotColors[plan.timeSlotType].label}
                  </span>
                )}
              </div>
              <div
                className={cn(
                  'font-medium text-sm truncate',
                  isCompleted && 'line-through text-gray-500'
                )}
              >
                {plan.title}
              </div>
              <div className="text-xs text-gray-500">
                {plan.subject && <span>{plan.subject} · </span>}
                {rangeDisplay}
              </div>
              {/* Carryover / Dock reason indicator for compact */}
              {showCarryover && (
                plan.carryoverCount && plan.carryoverCount > 0 ? (
                  <div className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {plan.carryoverCount}회 이월됨
                  </div>
                ) : container === 'unfinished' ? (
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400" />
                    배치 대기
                  </div>
                ) : null
              )}
            </div>
          </div>

          {/* Actions */}
          {showActions && !isCompleted && (
            <div className="flex items-center justify-between pt-1 border-t border-gray-100">
              {/* 주요 액션 버튼 */}
              <div className="flex items-center gap-1">
                {container !== 'daily' && (
                  <button
                    onClick={() => onMoveToDaily?.(plan.id) ?? handleMoveContainer('daily')}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    →Daily
                  </button>
                )}
              </div>

              {/* 드롭다운 메뉴 */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger className="p-1 rounded hover:bg-gray-100">
                  <MoreVertical className="w-4 h-4 text-gray-500" />
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end" className="min-w-[160px]">
                  {container !== 'weekly' && (
                    <DropdownMenu.Item onClick={() => onMoveToWeekly?.(plan.id) ?? handleMoveContainer('weekly')}>
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Weekly로 이동
                    </DropdownMenu.Item>
                  )}
                  {container !== 'daily' && container !== 'weekly' && (
                    <DropdownMenu.Item onClick={() => onMoveToDaily?.(plan.id) ?? handleMoveContainer('daily')}>
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Daily로 이동
                    </DropdownMenu.Item>
                  )}
                  {!isAdHoc && onRedistribute && (
                    <DropdownMenu.Item onClick={() => onRedistribute(plan.id)}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      볼륨 재분배
                    </DropdownMenu.Item>
                  )}
                  <DropdownMenu.Separator />
                  {!isAdHoc && onEdit && (
                    <DropdownMenu.Item onClick={() => onEdit(plan.id)}>
                      <Edit3 className="w-4 h-4 mr-2" />
                      수정
                    </DropdownMenu.Item>
                  )}
                  {!isAdHoc && (onStatusChange || true) && (
                    <div className="relative group/status">
                      <div className="relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-4 py-2 text-body-2 outline-none transition-base text-[var(--text-secondary)] dark:text-[var(--text-primary)] hover:bg-[rgb(var(--color-secondary-50))] dark:hover:bg-[rgb(var(--color-secondary-800))]">
                        <ToggleLeft className="w-4 h-4" />
                        <span className="flex-1">상태 변경</span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                      {/* 서브메뉴 */}
                      <div className="absolute left-full top-0 ml-1 hidden group-hover/status:block z-50">
                        <div className="min-w-[140px] rounded-lg border shadow-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 py-1">
                          {QUICK_STATUS_OPTIONS.map((option) => {
                            const Icon = option.icon;
                            const isCurrentStatus = plan.status === option.status;
                            return (
                              <button
                                key={option.status}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickStatusChange(option.status);
                                }}
                                className={cn(
                                  'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700',
                                  isCurrentStatus && 'bg-gray-100 dark:bg-gray-700'
                                )}
                              >
                                <Icon className={cn('w-4 h-4', option.colorClass)} />
                                <span>{option.label}</span>
                                {isCurrentStatus && <Check className="w-3 h-3 ml-auto text-green-500" />}
                              </button>
                            );
                          })}
                          {onStatusChange && (
                            <>
                              <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStatusChange(plan.id, plan.status, plan.title);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <Edit3 className="w-4 h-4" />
                                <span>상세 변경...</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {onCopy && (
                    <DropdownMenu.Item onClick={() => onCopy(plan.id)}>
                      <Copy className="w-4 h-4 mr-2" />
                      복사
                    </DropdownMenu.Item>
                  )}
                  {!isAdHoc && onMoveToGroup && (
                    <DropdownMenu.Item onClick={() => onMoveToGroup(plan.id)}>
                      <FolderInput className="w-4 h-4 mr-2" />
                      그룹 이동
                    </DropdownMenu.Item>
                  )}
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item
                    onClick={handleDeleteRequest}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    삭제
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </div>
            )}
          </div>
        </DraggablePlanItem>
      </div>

      {/* 삭제 확인 모달 (내부 처리용 - onDelete가 없을 때만 사용) */}
      {showDeleteConfirm && (
        <ConfirmDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          title="플랜 삭제"
          description="이 플랜을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
          confirmLabel="삭제"
          cancelLabel="취소"
          variant="destructive"
          isLoading={isPending}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </>
    );
  }

  // Default variant (full)
  return (
  <>
    {/* 외부 래퍼: 선택 모드일 때 체크박스를 카드 외부에 배치 */}
    <div className="flex items-center gap-2 min-w-0">
      {/* 선택 모드 체크박스 (카드 외부) */}
      {selectable && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect?.(plan.id)}
          className="w-4 h-4 rounded border-gray-300 shrink-0"
          onClick={(e) => e.stopPropagation()}
        />
      )}

      <DraggablePlanItem
        id={plan.id}
        type={plan.type}
        containerId={container}
        title={plan.title}
        subject={plan.subject}
        range={rangeDisplay}
        planDate={plan.planDate}
        disabled={isCompleted || isPending}
      >
        <div
          className={cn(
            'flex items-center gap-3 bg-white rounded-lg p-3 border transition-all flex-1',
            getLeftBorderColor(isCompleted, plan.carryoverCount),
            isCompleted ? colors.borderCompleted : colors.border,
            isPending && 'opacity-50 pointer-events-none',
            !isCompleted && 'hover:ring-1 hover:ring-gray-300 hover:shadow-sm cursor-grab',
            // 충돌 시 주황색 테두리 (좌측 보더는 유지)
            conflictInfo && !isCompleted && 'border-t-orange-400 border-r-orange-400 border-b-orange-400 border-t-2 border-r-2 border-b-2 bg-orange-50/30'
          )}
        >
          {/* 충돌 경고 아이콘 */}
          {conflictInfo && !isCompleted && (
            <div className="relative group shrink-0">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              {/* 툴팁 */}
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50">
                <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                  {conflictInfo.message}
                </div>
                <div className="absolute left-2 top-full border-4 border-transparent border-t-gray-900" />
              </div>
            </div>
          )}

          {/* QuickComplete 버튼 (항상 표시) */}
          <QuickCompleteButton
            planId={plan.id}
            planType={isAdHoc ? 'adhoc' : 'plan'}
            isCompleted={isCompleted}
            onSuccess={onRefresh ?? (() => {})}
          />


        {/* Time display - 강화된 시간 표시 */}
        {showTime && plan.startTime && (
          <div className="flex flex-col items-center justify-center w-14 shrink-0 py-0.5 px-1.5 bg-blue-50 rounded-md border border-blue-100">
            <span className="text-sm font-semibold text-blue-700 tabular-nums">
              {plan.startTime.substring(0, 5)}
            </span>
            {plan.endTime && (
              <span className="text-[10px] text-blue-500 tabular-nums">
                ~{plan.endTime.substring(0, 5)}
              </span>
            )}
          </div>
        )}

        {/* Ad-hoc badge */}
        {isAdHoc && (
          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded shrink-0">
            단발성
          </span>
        )}

        {/* Phase 4: Time slot type badge */}
        {plan.timeSlotType && timeSlotColors[plan.timeSlotType] && (
          <span className={cn(
            "text-xs px-1.5 py-0.5 rounded shrink-0",
            timeSlotColors[plan.timeSlotType].badge
          )}>
            {timeSlotColors[plan.timeSlotType].label}
          </span>
        )}

        {/* Plan info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {/* Carryover date */}
            {showCarryover && plan.planDate && (
              <span className="text-xs text-gray-500 shrink-0">
                {formatDateShort(plan.carryoverFromDate ?? plan.planDate)}
              </span>
            )}
            <span
              className={cn(
                'font-medium truncate',
                isCompleted && 'line-through text-gray-500'
              )}
            >
              {plan.title}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {plan.subject && (
              <span className="text-gray-500">{plan.subject}</span>
            )}
            {hasPageRange && !isCompleted && onRefresh ? (
              <InlineVolumeEditor
                planId={plan.id}
                currentStart={plan.pageRangeStart!}
                currentEnd={plan.pageRangeEnd!}
                contentType={plan.contentType}
                onSuccess={onRefresh}
              />
            ) : rangeDisplay ? (
              <span className="text-gray-500">{rangeDisplay}</span>
            ) : null}
            {isAdHoc && plan.estimatedMinutes && (
              <span className="text-gray-500">약 {plan.estimatedMinutes}분</span>
            )}
          </div>
          {/* Carryover / Dock reason indicator */}
          {showCarryover && (
            plan.carryoverCount && plan.carryoverCount > 0 ? (
              <div className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                {plan.carryoverCount}회 이월됨
              </div>
            ) : container === 'unfinished' ? (
              <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400" />
                배치 대기
              </div>
            ) : null
          )}
        </div>

        {/* Actions */}
        {isCompleted ? (
          <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded shrink-0">
            완료
          </span>
        ) : showActions ? (
          <div className="flex items-center gap-1 shrink-0">
            {/* 주요 액션 버튼 (자주 사용하는 것만) */}
            {container !== 'daily' && (
              <button
                onClick={() => onMoveToDaily?.(plan.id) ?? handleMoveContainer('daily')}
                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                title="Daily로 이동"
              >
                →D
              </button>
            )}
            {container !== 'weekly' && (
              <button
                onClick={() => onMoveToWeekly?.(plan.id) ?? handleMoveContainer('weekly')}
                className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                title="Weekly로 이동"
              >
                →W
              </button>
            )}

            {/* 드롭다운 메뉴 (나머지 액션) */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger className="p-1.5 rounded hover:bg-gray-100" title="더보기">
                <MoreVertical className="w-4 h-4 text-gray-500" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end" className="min-w-[180px]">
                {!isAdHoc && onRedistribute && (
                  <DropdownMenu.Item onClick={() => onRedistribute(plan.id)}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    볼륨 재분배
                  </DropdownMenu.Item>
                )}
                {!isAdHoc && onEdit && (
                  <DropdownMenu.Item onClick={() => onEdit(plan.id)}>
                    <Edit3 className="w-4 h-4 mr-2" />
                    수정
                  </DropdownMenu.Item>
                )}
                {!isAdHoc && (onStatusChange || true) && (
                  <div className="relative group/status">
                    <div className="relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-4 py-2 text-body-2 outline-none transition-base text-[var(--text-secondary)] dark:text-[var(--text-primary)] hover:bg-[rgb(var(--color-secondary-50))] dark:hover:bg-[rgb(var(--color-secondary-800))]">
                      <ToggleLeft className="w-4 h-4" />
                      <span className="flex-1">상태 변경</span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                    {/* 서브메뉴 */}
                    <div className="absolute left-full top-0 ml-1 hidden group-hover/status:block z-50">
                      <div className="min-w-[140px] rounded-lg border shadow-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 py-1">
                        {QUICK_STATUS_OPTIONS.map((option) => {
                          const Icon = option.icon;
                          const isCurrentStatus = plan.status === option.status;
                          return (
                            <button
                              key={option.status}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickStatusChange(option.status);
                              }}
                              className={cn(
                                'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700',
                                isCurrentStatus && 'bg-gray-100 dark:bg-gray-700'
                              )}
                            >
                              <Icon className={cn('w-4 h-4', option.colorClass)} />
                              <span>{option.label}</span>
                              {isCurrentStatus && <Check className="w-3 h-3 ml-auto text-green-500" />}
                            </button>
                          );
                        })}
                        {onStatusChange && (
                          <>
                            <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onStatusChange(plan.id, plan.status, plan.title);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <Edit3 className="w-4 h-4" />
                              <span>상세 변경...</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {onEditDate && (
                  <DropdownMenu.Item onClick={() => onEditDate(plan.id)}>
                    <Calendar className="w-4 h-4 mr-2" />
                    날짜 변경
                  </DropdownMenu.Item>
                )}
                {onCopy && (
                  <DropdownMenu.Item onClick={() => onCopy(plan.id)}>
                    <Copy className="w-4 h-4 mr-2" />
                    복사
                  </DropdownMenu.Item>
                )}
                {!isAdHoc && onMoveToGroup && (
                  <DropdownMenu.Item onClick={() => onMoveToGroup(plan.id)}>
                    <FolderInput className="w-4 h-4 mr-2" />
                    그룹 이동
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Separator />
                <DropdownMenu.Item
                  onClick={handleDeleteRequest}
                  className="text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  삭제
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </div>
          ) : null}
        </div>
      </DraggablePlanItem>
    </div>

    {/* 삭제 확인 모달 (내부 처리용 - onDelete가 없을 때만 사용) */}
    {showDeleteConfirm && (
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="플랜 삭제"
        description="이 플랜을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="destructive"
        isLoading={isPending}
        onConfirm={handleDeleteConfirm}
      />
    )}
  </>
  );
});

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// Helper to convert raw plan data to PlanItemData
export function toPlanItemData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any,
  type: PlanItemType
): PlanItemData {
  if (type === 'adhoc') {
    return {
      id: raw.id,
      type: 'adhoc',
      title: raw.title,
      status: raw.status ?? 'pending',
      isCompleted: raw.status === 'completed',
      estimatedMinutes: raw.estimated_minutes,
      planDate: raw.plan_date,
      startTime: raw.start_time,
      endTime: raw.end_time,
    };
  }

  return {
    id: raw.id,
    type: 'plan',
    title: raw.custom_title ?? raw.content_title ?? '제목 없음',
    subject: raw.content_subject ?? undefined,
    contentType: raw.content_type ?? undefined, // 콘텐츠 타입 (book/lecture/custom)
    pageRangeStart: raw.planned_start_page_or_time,
    pageRangeEnd: raw.planned_end_page_or_time,
    completedAmount: raw.completed_amount,
    progress: raw.progress,
    status: raw.status ?? 'pending',
    isCompleted: raw.status === 'completed' || raw.actual_end_time != null,
    customTitle: raw.custom_title,
    customRangeDisplay: raw.custom_range_display,
    estimatedMinutes: raw.estimated_minutes, // Phase 3: 소요시간 추가
    planDate: raw.plan_date,
    startTime: raw.start_time,
    endTime: raw.end_time,
    carryoverCount: raw.carryover_count ?? 0,
    carryoverFromDate: raw.carryover_from_date,
    planGroupId: raw.plan_group_id,
    // Phase 4: 시간대 유형 시각화
    timeSlotType: raw.time_slot_type ?? null,
    allocationReason: raw.allocation_type?.reason ?? null,
  };
}
