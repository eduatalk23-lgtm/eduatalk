'use client';

import { memo } from 'react';
import { cn } from '@/lib/cn';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import {
  MoreVertical,
  Calendar,
  Edit3,
  Copy,
  Trash2,
  ArrowRight,
  RefreshCw,
  FolderInput,
  ToggleLeft,
  ChevronRight,
  Check,
  Circle,
  XCircle,
} from 'lucide-react';
import type { PlanStatus } from '@/lib/types/plan';
import type { ContainerType, PlanItemData } from './PlanItemCard';

/** 빠른 상태 변경 옵션 */
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

interface StatusChangeSubmenuProps {
  currentStatus: PlanStatus;
  onStatusChange: (status: PlanStatus) => void;
  onDetailedStatusChange?: () => void;
}

/**
 * 상태 변경 서브메뉴 컴포넌트
 * Compact/Default variant에서 공통으로 사용
 */
export const StatusChangeSubmenu = memo(function StatusChangeSubmenu({
  currentStatus,
  onStatusChange,
  onDetailedStatusChange,
}: StatusChangeSubmenuProps) {
  return (
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
            const isCurrentStatus = currentStatus === option.status;
            return (
              <button
                key={option.status}
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(option.status);
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
          {onDetailedStatusChange && (
            <>
              <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDetailedStatusChange();
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
  );
});

interface PlanActionMenuProps {
  /** 플랜 ID - 콜백에 전달할 식별자 */
  planId: string;
  plan: PlanItemData;
  container: ContainerType;
  isAdHoc: boolean;
  variant?: 'compact' | 'default';
  /** 콜백들은 planId를 인자로 받음 - 부모에서 메모이제이션된 함수 전달 가능 */
  onMoveToDaily?: (id: string) => void;
  onMoveToWeekly?: (id: string) => void;
  onRedistribute?: (id: string) => void;
  onEdit?: (id: string) => void;
  onEditDate?: (id: string) => void;
  onCopy?: (id: string) => void;
  onMoveToGroup?: (id: string) => void;
  onStatusChange?: (status: PlanStatus) => void;
  onDetailedStatusChange?: () => void;
  onDelete: () => void;
}

/**
 * 플랜 액션 드롭다운 메뉴 컴포넌트
 * Compact/Default variant의 공통 드롭다운 메뉴를 추출
 */
export const PlanActionMenu = memo(function PlanActionMenu({
  planId,
  plan,
  container,
  isAdHoc,
  variant = 'default',
  onMoveToDaily,
  onMoveToWeekly,
  onRedistribute,
  onEdit,
  onEditDate,
  onCopy,
  onMoveToGroup,
  onStatusChange,
  onDetailedStatusChange,
  onDelete,
}: PlanActionMenuProps) {
  const isCompact = variant === 'compact';
  const minWidth = isCompact ? 'min-w-[160px]' : 'min-w-[180px]';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          'rounded hover:bg-gray-100',
          isCompact ? 'p-1' : 'p-1.5'
        )}
        title="더보기"
      >
        <MoreVertical className="w-4 h-4 text-gray-500" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" className={minWidth}>
        {/* 컨테이너 이동 옵션 */}
        {container !== 'weekly' && onMoveToWeekly && (
          <DropdownMenu.Item onClick={() => onMoveToWeekly(planId)}>
            <ArrowRight className="w-4 h-4 mr-2" />
            주간 플랜으로 이동
          </DropdownMenu.Item>
        )}
        {isCompact && container !== 'daily' && container !== 'weekly' && onMoveToDaily && (
          <DropdownMenu.Item onClick={() => onMoveToDaily(planId)}>
            <ArrowRight className="w-4 h-4 mr-2" />
            오늘 플랜으로 이동
          </DropdownMenu.Item>
        )}

        {/* 볼륨 재분배 */}
        {!isAdHoc && onRedistribute && (
          <DropdownMenu.Item onClick={() => onRedistribute(planId)}>
            <RefreshCw className="w-4 h-4 mr-2" />
            볼륨 재분배
          </DropdownMenu.Item>
        )}

        {(onMoveToWeekly || onRedistribute) && <DropdownMenu.Separator />}

        {/* 수정 */}
        {!isAdHoc && onEdit && (
          <DropdownMenu.Item onClick={() => onEdit(planId)}>
            <Edit3 className="w-4 h-4 mr-2" />
            수정
          </DropdownMenu.Item>
        )}

        {/* 상태 변경 서브메뉴 */}
        {!isAdHoc && onStatusChange && (
          <StatusChangeSubmenu
            currentStatus={plan.status}
            onStatusChange={onStatusChange}
            onDetailedStatusChange={onDetailedStatusChange}
          />
        )}

        {/* 날짜 변경 (default variant only) */}
        {!isCompact && onEditDate && (
          <DropdownMenu.Item onClick={() => onEditDate(planId)}>
            <Calendar className="w-4 h-4 mr-2" />
            날짜 변경
          </DropdownMenu.Item>
        )}

        {/* 복사 */}
        {onCopy && (
          <DropdownMenu.Item onClick={() => onCopy(planId)}>
            <Copy className="w-4 h-4 mr-2" />
            복사
          </DropdownMenu.Item>
        )}

        {/* 그룹 이동 */}
        {!isAdHoc && onMoveToGroup && (
          <DropdownMenu.Item onClick={() => onMoveToGroup(planId)}>
            <FolderInput className="w-4 h-4 mr-2" />
            그룹 이동
          </DropdownMenu.Item>
        )}

        <DropdownMenu.Separator />

        {/* 삭제 */}
        <DropdownMenu.Item
          onClick={onDelete}
          className="text-red-600 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          삭제
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
});
