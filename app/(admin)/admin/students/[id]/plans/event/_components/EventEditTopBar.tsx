'use client';

import { X, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { TimePickerDropdown } from '../../_components/items/TimePickerDropdown';
import { RecurrenceSelector } from '../../_components/items/RecurrenceSelector';
import { formatDurationKo, timeToMinutes } from '../../_components/utils/timeGridUtils';

/** 날짜/시간 행의 컨트롤 공용 스타일 — TimePicker와 높이·폰트 통일 */
const controlCls = 'rounded-md border border-[rgb(var(--color-secondary-300))] bg-transparent px-2 py-1.5 text-sm text-[var(--text-primary)] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

interface EventEditTopBarProps {
  mode: 'new' | 'edit';
  isDirty: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
  /** 제목 입력 (editable mode) */
  title?: string;
  onTitleChange?: (value: string) => void;
  /** 고정 헤더 텍스트 (title input 대신 표시) */
  heading?: string;
  /** 날짜/시간 필드 (editable mode) */
  dateTime?: {
    date: string;
    endDate: string;
    startTime: string;
    endTime: string;
    isAllDay: boolean;
    rrule: string | null;
    onDateChange: (v: string) => void;
    onEndDateChange: (v: string) => void;
    onStartTimeChange: (v: string) => void;
    onEndTimeChange: (v: string) => void;
    onAllDayChange: (v: boolean) => void;
    onRruleChange: (v: string | null) => void;
    /** 상담 모드: 종일/반복 UI 숨김 */
    hideAllDayAndRecurrence?: boolean;
  };
}

/** multi-day 이벤트의 총 소요시간 계산 (분) — 타임존 무관 순수 차이 */
function computeMultiDayDuration(
  startDate: string,
  endDate: string,
  startTime: string,
  endTime: string,
): number {
  try {
    // UTC 고정으로 로컬 타임존 영향 제거
    const start = new Date(`${startDate}T${startTime}:00Z`);
    const end = new Date(`${endDate}T${endTime}:00Z`);
    const diff = Math.round((end.getTime() - start.getTime()) / 60000);
    return diff > 0 ? diff : 0;
  } catch {
    return 0;
  }
}

export function EventEditTopBar({
  mode,
  isDirty,
  isSaving,
  isDeleting,
  onClose,
  onSave,
  onDelete,
  title,
  onTitleChange,
  heading,
  dateTime,
}: EventEditTopBarProps) {
  const isMultiDay = dateTime ? dateTime.date !== dateTime.endDate : false;

  const durationMinutes = dateTime && !dateTime.isAllDay
    ? isMultiDay
      ? computeMultiDayDuration(dateTime.date, dateTime.endDate, dateTime.startTime, dateTime.endTime)
      : timeToMinutes(dateTime.endTime) - timeToMinutes(dateTime.startTime)
    : 0;

  return (
    <div className="sticky top-0 z-10 bg-[var(--background)]">
      {/* Row 1: [X] [제목 input ___________] [삭제] [저장] */}
      <div className="max-w-5xl px-4 sm:px-6 lg:px-8 flex items-center gap-2 py-2">
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full p-1.5 text-[var(--text-tertiary)] hover:bg-[rgb(var(--color-secondary-100))] transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-label="닫기"
        >
          <X className="h-5 w-5" />
        </button>

        {/* 제목 — GCal style: 밑줄만 있는 깔끔한 인풋 */}
        {onTitleChange ? (
          <input
            type="text"
            value={title ?? ''}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="제목 추가"
            className="flex-1 min-w-0 border-0 border-b-2 border-[rgb(var(--color-secondary-200))] bg-transparent px-1 py-1.5 text-xl font-normal text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-blue-500 transition-colors"
            autoFocus
          />
        ) : heading ? (
          <h1 className="flex-1 min-w-0 px-1 py-1.5 text-xl font-semibold text-[var(--text-primary)]">
            {heading}
          </h1>
        ) : (
          <div className="flex-1" />
        )}

        {mode === 'edit' && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting || isSaving}
            className={cn(
              'shrink-0 flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 disabled:opacity-50',
            )}
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            <span className="hidden sm:inline">삭제</span>
          </button>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || isDeleting || (!isDirty && mode === 'edit')}
          className={cn(
            'shrink-0 flex items-center gap-1.5 rounded-full px-5 py-1.5 text-sm font-medium transition-colors',
            'bg-blue-600 text-white hover:bg-blue-700',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          저장
        </button>
      </div>

      {/* Row 2~3: 날짜/시간 + 종일/반복 */}
      {dateTime && (
        <div className="max-w-5xl px-4 sm:px-6 lg:px-8 flex gap-2 pb-2.5">
          {/* X 버튼과 같은 폭의 spacer → 제목 텍스트와 정렬 */}
          <div className="w-8 shrink-0" />
          <div className="flex flex-col gap-1.5">
            {/* GCal: [시작날짜] [시작시간] – [종료시간] [종료날짜?] [duration] */}
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={dateTime.date}
                onChange={(e) => dateTime.onDateChange(e.target.value)}
                className={controlCls}
              />
              {!dateTime.isAllDay && (
                <>
                  <TimePickerDropdown
                    value={dateTime.startTime}
                    onChange={dateTime.onStartTimeChange}
                    label="시작"
                  />
                  <span className="text-[var(--text-tertiary)] text-sm">–</span>
                  <TimePickerDropdown
                    value={dateTime.endTime}
                    onChange={dateTime.onEndTimeChange}
                    referenceTime={dateTime.startTime}
                    label="종료"
                  />
                </>
              )}
              {/* 종료 날짜: 시작과 다를 때만 표시 (GCal 패턴) */}
              {isMultiDay && (
                <input
                  type="date"
                  value={dateTime.endDate}
                  onChange={(e) => dateTime.onEndDateChange(e.target.value)}
                  min={dateTime.date}
                  className={controlCls}
                />
              )}
              {!dateTime.isAllDay && durationMinutes > 0 && (
                <span className="text-sm text-[var(--text-tertiary)] shrink-0">
                  {formatDurationKo(durationMinutes)}
                </span>
              )}
            </div>

            {/* 종일 + 반복 — 상담 모드에서는 숨김 */}
            {!dateTime.hideAllDayAndRecurrence && (
              <div className="flex items-center gap-3 flex-nowrap">
                <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={dateTime.isAllDay}
                    onChange={(e) => dateTime.onAllDayChange(e.target.checked)}
                    className="h-4 w-4 rounded border-[rgb(var(--color-secondary-300))] text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-[var(--text-secondary)] whitespace-nowrap">종일</span>
                </label>
                <RecurrenceSelector
                  value={dateTime.rrule}
                  onChange={dateTime.onRruleChange}
                  eventDate={dateTime.date}
                />
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
