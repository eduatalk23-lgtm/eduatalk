'use client';

import { useState, useTransition } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/Dialog';
import Button from '@/components/atoms/Button';
import Label from '@/components/atoms/Label';
import Input from '@/components/atoms/Input';
import { useToast } from '@/components/ui/ToastProvider';
import { cn } from '@/lib/cn';
import {
  createNonStudyOverride,
  type OverrideType,
} from '@/lib/domains/plan/actions/nonStudyOverrides';
import type { NonStudyItem } from '@/lib/query-options/adminDock';

// ============================================
// Types
// ============================================

interface NonStudyTimeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: NonStudyItem;
  sourceIndex?: number;
  plannerId: string;
  selectedDate: string;
  onSuccess?: () => void;
  /** 드래그 드롭으로 새 시간이 지정된 경우 */
  initialStartTime?: string;
}

type ApplyScope = 'today' | 'planner';

// ============================================
// Helper: NonStudyItem.type → OverrideType
// ============================================

/**
 * NonStudyItem → OverrideType 매핑.
 *
 * non_study_time_blocks 배열 항목(sourceIndex가 존재)은 항상 'non_study_time'으로 저장해야
 * nonStudyTimeQueryOptions의 findOverride('non_study_time', i)와 일치한다.
 * 레거시 lunch_time(sourceIndex 없음)만 'lunch'로 저장한다.
 */
function mapToOverrideType(itemType: NonStudyItem['type'], sourceIndex?: number): OverrideType {
  // 학원/이동시간은 academy_schedules에서 온 것 → 'academy'
  if (itemType === '학원' || itemType === '이동시간') return 'academy';
  // sourceIndex가 있으면 non_study_time_blocks 배열 항목 (점심식사 포함) → 'non_study_time'
  if (sourceIndex !== undefined) return 'non_study_time';
  // sourceIndex가 없는 점심식사 = 레거시 lunch_time → 'lunch'
  if (itemType === '점심식사') return 'lunch';
  return 'non_study_time';
}

// ============================================
// Component
// ============================================

// 시간 문자열을 분으로 변환
function timeToMinutes(time: string): number {
  const [h, m] = time.substring(0, 5).split(':').map(Number);
  return h * 60 + m;
}

// 분을 HH:mm 형식으로 변환
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function NonStudyTimeEditModal({
  isOpen,
  onClose,
  item,
  sourceIndex,
  plannerId,
  selectedDate,
  onSuccess,
  initialStartTime,
}: NonStudyTimeEditModalProps) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  // 원본 시간 기간 계산 (분)
  const originalDuration = timeToMinutes(item.end_time) - timeToMinutes(item.start_time);

  // 초기 시간 계산: initialStartTime이 있으면 그것을 사용, 아니면 원본 시간
  const computedStartTime = initialStartTime ?? item.start_time.substring(0, 5);
  const computedEndTime = initialStartTime
    ? minutesToTime(timeToMinutes(initialStartTime) + originalDuration)
    : item.end_time.substring(0, 5);

  // Form state
  const [startTime, setStartTime] = useState(computedStartTime);
  const [endTime, setEndTime] = useState(computedEndTime);
  const [isDisabled, setIsDisabled] = useState(false);
  const [applyScope, setApplyScope] = useState<ApplyScope>('today');
  const [reason, setReason] = useState(initialStartTime ? '드래그로 시간 변경' : '');

  // 드래그로 열린 경우 표시
  const isDragTriggered = !!initialStartTime;

  // Reset form when modal opens with new item
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  // Validation
  const isValidTime = (time: string) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
  const isFormValid = isDisabled || (isValidTime(startTime) && isValidTime(endTime) && startTime < endTime);

  // Submit handler
  const handleSubmit = () => {
    if (!isFormValid) {
      toast.showError('유효한 시간을 입력해주세요.');
      return;
    }

    startTransition(async () => {
      const result = await createNonStudyOverride({
        plannerId,
        overrideDate: selectedDate,
        overrideType: mapToOverrideType(item.type, sourceIndex),
        sourceIndex,
        isDisabled,
        startTimeOverride: isDisabled ? undefined : startTime,
        endTimeOverride: isDisabled ? undefined : endTime,
        reason: reason || undefined,
        applyScope,
      });

      if (result.success) {
        const scopeLabel = applyScope === 'today' ? '오늘' : '플래너 전체';
        const actionLabel = isDisabled ? '비활성화' : '시간 변경';
        toast.showSuccess(`${item.label ?? item.type} ${actionLabel}됨 (${scopeLabel})`);
        // 모달을 먼저 닫은 후 데이터 리프레시 (중첩 transition 간섭 방지)
        onClose();
        onSuccess?.();
      } else {
        toast.showError(result.error || '저장에 실패했습니다.');
      }
    });
  };

  const overrideType = mapToOverrideType(item.type, sourceIndex);
  const isAcademy = overrideType === 'academy';

  return (
    <Dialog
      open={isOpen}
      onOpenChange={handleOpenChange}
      title={`${item.label ?? item.type} 시간 조정`}
      maxWidth="sm"
    >
      <DialogContent>
        <div className="flex flex-col gap-4">
          {/* 드래그로 시간 변경된 경우 알림 */}
          {isDragTriggered && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 p-3">
              <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                <span>드래그로 새 시간이 설정되었습니다</span>
              </div>
            </div>
          )}

          {/* 현재 시간 표시 */}
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {isDragTriggered ? '기존 설정' : '현재 설정'}
            </div>
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {item.start_time.substring(0, 5)} ~ {item.end_time.substring(0, 5)}
            </div>
          </div>

          {/* 비활성화 체크박스 */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isDisabled}
              onChange={(e) => setIsDisabled(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {isAcademy ? '오늘은 학원 휴무' : '이 시간대 비활성화'}
            </span>
          </label>

          {/* 시간 입력 (비활성화 아닐 때만) */}
          {!isDisabled && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="start-time" className="text-sm">
                  시작 시간
                </Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  inputSize="md"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="end-time" className="text-sm">
                  종료 시간
                </Label>
                <Input
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  inputSize="md"
                />
              </div>
            </div>
          )}

          {/* 적용 범위 선택 */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm">적용 범위</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setApplyScope('today')}
                className={cn(
                  'flex-1 py-2 px-3 rounded-lg border text-sm transition-colors',
                  applyScope === 'today'
                    ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                )}
              >
                오늘만
              </button>
              <button
                type="button"
                onClick={() => setApplyScope('planner')}
                className={cn(
                  'flex-1 py-2 px-3 rounded-lg border text-sm transition-colors',
                  applyScope === 'planner'
                    ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                )}
              >
                플래너 전체
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {applyScope === 'today'
                ? '이 날짜에만 변경된 시간이 적용됩니다.'
                : '플래너의 기본 설정이 변경됩니다.'}
            </p>
          </div>

          {/* 변경 사유 (오늘만일 때) */}
          {applyScope === 'today' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reason" className="text-sm">
                변경 사유 (선택)
              </Label>
              <Input
                id="reason"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="예: 병원 예약"
                inputSize="md"
              />
            </div>
          )}
        </div>
      </DialogContent>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={onClose}
          disabled={isPending}
          size="md"
        >
          취소
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!isFormValid}
          isLoading={isPending}
          size="md"
        >
          저장
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
