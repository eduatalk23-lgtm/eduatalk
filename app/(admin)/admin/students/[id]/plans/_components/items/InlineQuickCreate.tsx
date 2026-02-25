'use client';

import { memo, useState, useTransition, useRef, useEffect, useCallback } from 'react';
import { createCalendarEventAction } from '@/lib/domains/admin-plan/actions/calendarEvents';
import { type EmptySlot } from '@/lib/domains/admin-plan/utils/emptySlotCalculation';
import { RecurrenceSelector } from './RecurrenceSelector';
import { formatDurationKo, timeToMinutes, minutesToTime } from '../utils/timeGridUtils';
import { TimePickerDropdown } from './TimePickerDropdown';
import { cn } from '@/lib/cn';
import { Loader2, X, Clock, Shield, Calendar as CalendarIcon, Coffee } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useToast } from '@/components/ui/ToastProvider';
import { SUPPORTED_SUBJECT_CATEGORIES } from '@/lib/domains/plan/llm/actions/coldStart/types';

interface InlineQuickCreateProps {
  slot: EmptySlot;
  studentId: string;
  tenantId: string;
  /** 캘린더 ID */
  calendarId?: string;
  planDate: string;
  planGroupId?: string | null;
  onSuccess: (createdInfo?: { planId: string; startTime: string }) => void;
  onClose: () => void;
  onOpenFullModal: (slot: EmptySlot) => void;
  onPlaceUnfinished?: (slot: EmptySlot) => void;
  onPlaceFromWeekly?: (slot: EmptySlot) => void;
  initialMode?: 'allDay' | 'timed';
  /** 캘린더 설정의 기본 이벤트 시간 (분) */
  defaultEstimatedMinutes?: number | null;
  /** 캘린더 설정의 기본 알림 (분 단위 배열) */
  defaultReminderMinutes?: number[] | null;
}

export const InlineQuickCreate = memo(function InlineQuickCreate({
  slot,
  calendarId,
  planDate,
  onSuccess,
  onClose,
  onOpenFullModal,
  onPlaceUnfinished,
  onPlaceFromWeekly,
  initialMode = 'timed',
  defaultEstimatedMinutes,
  defaultReminderMinutes,
}: InlineQuickCreateProps) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [mode, setMode] = useState<'allDay' | 'timed'>(initialMode);
  const [eventType, setEventType] = useState<'study' | 'focus_time' | 'custom' | 'break'>('study');
  const [rrule, setRrule] = useState<string | null>(null);

  // 시간 모드 상태: 시작/종료 시간 (캘린더 설정의 기본 시간 우선, 없으면 60분)
  const durationMin = defaultEstimatedMinutes ?? 60;
  const defaultStart = slot.startTime === '00:00' && slot.endTime === '23:59' ? '09:00' : slot.startTime;
  const defaultEnd = slot.startTime === '00:00' && slot.endTime === '23:59'
    ? minutesToTime(timeToMinutes('09:00') + durationMin)
    : minutesToTime(Math.min(timeToMinutes(slot.startTime) + durationMin, timeToMinutes(slot.endTime)));
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(defaultEnd);

  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 파생 값: 소요 시간 (분)
  const computedMinutes = timeToMinutes(endTime) - timeToMinutes(startTime);

  // 시작 시간 변경 시 → 기존 duration 유지하며 종료 시간 자동 조정
  const handleStartTimeChange = useCallback((newStart: string) => {
    const currentDuration = timeToMinutes(endTime) - timeToMinutes(startTime);
    const duration = currentDuration > 0 ? currentDuration : 60;
    const newEndMin = Math.min(timeToMinutes(newStart) + duration, 24 * 60 - 15);
    setStartTime(newStart);
    setEndTime(minutesToTime(newEndMin));
  }, [startTime, endTime]);

  // 종료 시간 변경 시 → 시작보다 이전이면 자동 보정
  const handleEndTimeChange = useCallback((newEnd: string) => {
    if (timeToMinutes(newEnd) <= timeToMinutes(startTime)) {
      setEndTime(minutesToTime(timeToMinutes(startTime) + 60));
    } else {
      setEndTime(newEnd);
    }
  }, [startTime]);

  // "시간 추가" 클릭 (종일 → 시간 모드)
  const handleAddTime = useCallback(() => {
    setStartTime(defaultStart);
    setEndTime(defaultEnd);
    setMode('timed');
  }, [defaultStart, defaultEnd]);

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError('플랜 제목을 입력해주세요');
      inputRef.current?.focus();
      return;
    }
    setTitleError(null);

    if (!calendarId) return;
    startTransition(async () => {
      try {
        const { eventId } = await createCalendarEventAction({
          calendarId,
          title: trimmed,
          planDate,
          startTime: mode === 'allDay' ? undefined : startTime,
          endTime: mode === 'allDay' ? undefined : endTime,
          isAllDay: mode === 'allDay',
          subject: eventType === 'study' ? (subject || undefined) : undefined,
          eventSubtype: eventType === 'focus_time' ? '집중 학습'
            : eventType === 'break' ? '휴식'
            : eventType === 'custom' ? '일반'
            : undefined,
          rrule: rrule ?? undefined,
          eventType,
          containerType: 'daily',
          estimatedMinutes: eventType === 'study' && mode !== 'allDay' && computedMinutes > 0 ? computedMinutes : undefined,
          reminderMinutes: defaultReminderMinutes?.[0] ?? undefined,
        });
        const label = { study: '플랜', focus_time: '집중 시간', custom: '일정', break: '휴식' }[eventType] ?? '일정';
        toast.showSuccess(rrule ? '반복 이벤트가 생성되었습니다' : `${label}이 생성되었습니다`);
        onSuccess(eventId ? { planId: eventId, startTime: mode === 'allDay' ? '00:00' : startTime } : undefined);
        onClose();
      } catch (err) {
        toast.showError(err instanceof Error ? err.message : '이벤트 생성에 실패했습니다');
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="w-72">
      {/* 헤더: 날짜 + 닫기 버튼 */}
      <div className="flex items-center justify-between px-4 pt-3 pb-0">
        <span className="text-xs font-medium text-[var(--text-tertiary)]">
          {format(parseISO(planDate), 'M월 d일 (EEE)', { locale: ko })}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 -mr-1 rounded-md hover:bg-[rgb(var(--color-secondary-100))] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          aria-label="닫기"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 빠른 생성 폼 */}
      <div className="px-4 pt-2 pb-3 space-y-3">
        {/* 제목 입력 */}
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => { setTitle(e.target.value); if (titleError) setTitleError(null); }}
          onKeyDown={handleKeyDown}
          placeholder="플랜 제목 입력..."
          disabled={isPending}
          className={cn(
            'w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50',
            titleError ? 'border-red-400 focus:ring-red-400' : 'border-[rgb(var(--color-secondary-300))] focus:ring-blue-400',
          )}
        />
        {titleError && <p className="text-xs text-red-500 mt-0.5">{titleError}</p>}

        {/* 이벤트 타입 선택 */}
        <div className="grid grid-cols-2 gap-1.5">
          {([
            { value: 'study' as const, label: '학습', icon: Clock, active: 'bg-blue-50 border-blue-300 text-blue-700' },
            { value: 'focus_time' as const, label: '집중 시간', icon: Shield, active: 'bg-indigo-50 border-indigo-300 text-indigo-700' },
            { value: 'custom' as const, label: '일반 일정', icon: CalendarIcon, active: 'bg-gray-100 border-gray-400 text-gray-700' },
            { value: 'break' as const, label: '휴식', icon: Coffee, active: 'bg-green-50 border-green-300 text-green-700' },
          ]).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setEventType(opt.value)}
              disabled={isPending}
              className={cn(
                'flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md border transition-colors disabled:opacity-50',
                eventType === opt.value
                  ? `${opt.active} font-medium`
                  : 'border-[rgb(var(--color-secondary-200))] text-[var(--text-tertiary)] hover:border-[rgb(var(--color-secondary-300))]',
              )}
            >
              <opt.icon className="w-3 h-3" />
              {opt.label}
            </button>
          ))}
        </div>

        {/* 과목 선택 (학습 타입일 때만) */}
        {eventType === 'study' && (
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={isPending}
            className="w-full px-3 py-1.5 text-sm border border-[rgb(var(--color-secondary-300))] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 bg-[rgb(var(--color-secondary-50))] text-[var(--text-secondary)]"
          >
            <option value="">과목 선택 (선택사항)</option>
            {SUPPORTED_SUBJECT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        )}

        {/* 시간 설정 영역 */}
        {mode === 'allDay' ? (
          /* 종일 모드 */
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-[var(--text-secondary)]">종일</span>
            </div>
            <button
              type="button"
              onClick={handleAddTime}
              disabled={isPending}
              className="text-xs text-blue-500 hover:text-blue-700 transition-colors font-medium"
            >
              시간 추가
            </button>
          </div>
        ) : (
          /* 시간 모드 */
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TimePickerDropdown
                value={startTime}
                onChange={handleStartTimeChange}
                disabled={isPending}
              />
              <span className="text-[var(--text-tertiary)] text-sm">-</span>
              <TimePickerDropdown
                value={endTime}
                onChange={handleEndTimeChange}
                referenceTime={startTime}
                minTime={startTime}
                disabled={isPending}
              />
            </div>
            {computedMinutes > 0 && (
              <div className="text-xs text-[var(--text-tertiary)] pl-0.5">
                {formatDurationKo(computedMinutes)}
              </div>
            )}
            <button
              type="button"
              onClick={() => setMode('allDay')}
              disabled={isPending}
              className="text-xs text-[var(--text-tertiary)] hover:text-blue-600 transition-colors"
            >
              종일로 변경
            </button>
          </div>
        )}

        {/* 반복 설정 */}
        <RecurrenceSelector
          value={rrule}
          onChange={setRrule}
          eventDate={planDate}
          disabled={isPending}
        />

        {/* 빠른 생성 + 상세 설정 */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!title.trim() || isPending || (mode === 'timed' && computedMinutes <= 0)}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            빠른 생성
          </button>
          <button
            type="button"
            onClick={() => { onOpenFullModal(slot); onClose(); }}
            className="text-xs text-[var(--text-tertiary)] hover:text-blue-600 transition-colors"
          >
            상세 설정 &rarr;
          </button>
        </div>
      </div>

      {/* 구분선 + 기존 옵션 */}
      {(onPlaceUnfinished || onPlaceFromWeekly) && (
        <>
          <div className="border-t border-[rgb(var(--color-secondary-100))]" />
          <div className="py-1">
            {onPlaceUnfinished && (
              <button
                type="button"
                onClick={() => { onPlaceUnfinished(slot); onClose(); }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-[rgb(var(--color-secondary-50))] flex items-center gap-3 transition-colors"
              >
                <span className="text-amber-500">&#x1F4CB;</span>
                <span className="text-[var(--text-secondary)]">미완료 플랜 배치</span>
              </button>
            )}
            {onPlaceFromWeekly && (
              <button
                type="button"
                onClick={() => { onPlaceFromWeekly(slot); onClose(); }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-[rgb(var(--color-secondary-50))] flex items-center gap-3 transition-colors"
              >
                <span className="text-green-500">&#x1F4E6;</span>
                <span className="text-[var(--text-secondary)]">주간 플랜에서 가져오기</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
});
