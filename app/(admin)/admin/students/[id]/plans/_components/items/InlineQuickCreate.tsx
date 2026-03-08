'use client';

import { memo, useState, useTransition, useRef, useEffect, useCallback } from 'react';
import { createCalendarEventAction } from '@/lib/domains/admin-plan/actions/calendarEvents';
import { type EmptySlot } from '@/lib/domains/admin-plan/utils/emptySlotCalculation';
import { RecurrenceSelector } from './RecurrenceSelector';
import { formatDurationKo, timeToMinutes, minutesToTime, formatTimeKoAmPm } from '../utils/timeGridUtils';
import { TimePickerDropdown } from './TimePickerDropdown';
import { cn } from '@/lib/cn';
import { LABEL_PRESETS, getDefaultIsTask } from '@/lib/domains/calendar/labelPresets';
import { Loader2, X, Clock, Calendar, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useToast } from '@/components/ui/ToastProvider';
import { SUPPORTED_SUBJECT_CATEGORIES } from '@/lib/domains/plan/llm/actions/coldStart/types';
import { formatRRuleToKorean } from '@/lib/domains/calendar/rrule';

interface InlineQuickCreateProps {
  slot: EmptySlot;
  studentId: string;
  tenantId: string;
  /** 활성 캘린더 ID */
  calendarId?: string;
  /** 활성 캘린더 이름 (하단 표시용) */
  calendarName?: string;
  /** 활성 캘린더 색상 hex (하단 표시용) */
  calendarColorHex?: string;
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
  calendarName,
  calendarColorHex,
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
  const [selectedLabel, setSelectedLabel] = useState('학습');
  const isStudy = selectedLabel === '학습';
  const isTask = getDefaultIsTask(selectedLabel);
  const [description, setDescription] = useState('');
  const [rrule, setRrule] = useState<string | null>(null);
  const [timeExpanded, setTimeExpanded] = useState(false);

  // 시간 모드 상태: slot에 이미 올바른 start/end가 들어옴
  // (클릭 생성: handleGridClick이 defaultEstimatedMinutes 적용 → slot에 반영됨)
  // (드래그 생성: onDragEnd가 실제 드래그 범위 → slot에 반영됨)
  // 종일 슬롯(00:00~23:59)만 기본 duration으로 보정
  const isAllDaySlot = slot.startTime === '00:00' && slot.endTime === '23:59';
  const durationMin = defaultEstimatedMinutes ?? 60;
  const defaultStart = isAllDaySlot ? '09:00' : slot.startTime;
  const defaultEnd = isAllDaySlot
    ? minutesToTime(timeToMinutes('09:00') + durationMin)
    : slot.endTime;
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
          description: description.trim() || undefined,
          planDate,
          startTime: mode === 'allDay' ? undefined : startTime,
          endTime: mode === 'allDay' ? undefined : endTime,
          isAllDay: mode === 'allDay',
          subject: isStudy ? (subject || undefined) : undefined,
          rrule: rrule ?? undefined,
          eventType: isStudy ? 'study' : 'custom',
          label: selectedLabel,
          isTask,
          containerType: 'daily',
          estimatedMinutes: isStudy && mode !== 'allDay' && computedMinutes > 0 ? computedMinutes : undefined,
          reminderMinutes: defaultReminderMinutes?.[0] ?? undefined,
        });
        toast.showSuccess(rrule ? '반복 이벤트가 생성되었습니다' : `${selectedLabel} 일정이 생성되었습니다`);
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
    <div className="w-[448px]">
      {/* 헤더: 닫기 버튼 */}
      <div className="flex items-center justify-end px-5 pt-3 pb-0">
        <button
          type="button"
          onClick={onClose}
          className="p-1 -mr-1 rounded-full hover:bg-[rgb(var(--color-secondary-100))] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-label="닫기"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 빠른 생성 폼 */}
      <div className="px-5 pt-2 pb-3 space-y-3">
        {/* 제목 입력 (GCal underline 스타일) */}
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => { setTitle(e.target.value); if (titleError) setTitleError(null); }}
          onKeyDown={handleKeyDown}
          placeholder="제목 추가"
          disabled={isPending}
          className={cn(
            'w-full px-1 py-2 text-lg bg-transparent border-0 border-b-2 focus:outline-none disabled:opacity-50 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
            titleError ? 'border-red-400' : 'border-[rgb(var(--color-secondary-200))] focus:border-blue-500',
          )}
        />
        {titleError && <p className="text-xs text-red-500 mt-0.5">{titleError}</p>}

        {/* 라벨 프리셋 칩 */}
        <div className="flex flex-wrap gap-1.5">
          {LABEL_PRESETS.map((preset) => {
            const isActive = selectedLabel === preset.label;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => setSelectedLabel(preset.label)}
                disabled={isPending}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-full border transition-colors disabled:opacity-50',
                  isActive
                    ? 'font-medium border-transparent text-white'
                    : 'border-[rgb(var(--color-secondary-200))] text-[var(--text-tertiary)] hover:border-[rgb(var(--color-secondary-300))]',
                )}
                style={isActive ? { backgroundColor: preset.defaultColor } : undefined}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* 과목 선택 (학습일 때만) */}
        {isStudy && (
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

        {/* 날짜/시간 + 반복 (GCal 스타일) */}
        <div className="flex gap-2.5">
          <Clock className="w-4 h-4 mt-1 flex-shrink-0 text-[var(--text-tertiary)]" />

          <div className="flex-1 min-w-0">
            {!timeExpanded ? (
              /* ── 접힌 상태: 한 줄 요약 ── */
              <button
                type="button"
                onClick={() => setTimeExpanded(true)}
                disabled={isPending}
                className="w-full text-left rounded-lg px-2.5 py-1.5 -mx-1 hover:bg-[rgb(var(--color-secondary-100))] transition-colors disabled:opacity-50"
              >
                <div className="text-sm text-[var(--text-primary)]">
                  {format(parseISO(planDate), 'M월 d일 (EEE)', { locale: ko })}
                  {mode === 'allDay' ? (
                    <span className="ml-2 text-[var(--text-secondary)]">종일</span>
                  ) : (
                    <>
                      <span className="ml-2">{formatTimeKoAmPm(startTime)}</span>
                      <span className="text-[var(--text-tertiary)]"> – </span>
                      <span>{formatTimeKoAmPm(endTime)}</span>
                    </>
                  )}
                </div>
                <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
                  {mode === 'timed' && computedMinutes > 0 && (
                    <span>{formatDurationKo(computedMinutes)} · </span>
                  )}
                  {rrule ? formatRRuleToKorean(rrule) : '반복 안함'}
                </div>
              </button>
            ) : (
              /* ── 펼친 상태: GCal 칩 레이아웃 ── */
              <div className="space-y-2.5">
                {/* 날짜 · 시작시간 – 종료시간 · 소요시간 (한 줄) */}
                <div className="flex items-center gap-1.5 flex-nowrap">
                  <span className="inline-flex items-center px-2.5 py-1 text-sm rounded-md bg-[rgb(var(--color-secondary-100))] text-[var(--text-primary)] whitespace-nowrap shrink-0">
                    {format(parseISO(planDate), 'M월 d일 (EEE)', { locale: ko })}
                  </span>
                  {mode === 'timed' && (
                    <>
                      <TimePickerDropdown
                        value={startTime}
                        onChange={handleStartTimeChange}
                        disabled={isPending}
                      />
                      <span className="text-[var(--text-tertiary)] text-xs shrink-0">–</span>
                      <TimePickerDropdown
                        value={endTime}
                        onChange={handleEndTimeChange}
                        referenceTime={startTime}
                        minTime={startTime}
                        disabled={isPending}
                      />
                      {computedMinutes > 0 && (
                        <span className="text-xs text-[var(--text-tertiary)] whitespace-nowrap shrink-0">
                          {formatDurationKo(computedMinutes)}
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* 종일 체크박스 */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mode === 'allDay'}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setMode('allDay');
                      } else {
                        handleAddTime();
                      }
                    }}
                    disabled={isPending}
                    className="h-3.5 w-3.5 rounded border-[rgb(var(--color-secondary-300))] text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-[var(--text-secondary)]">종일</span>
                </label>

                {/* 반복 설정 드롭다운 */}
                <RecurrenceSelector
                  value={rrule}
                  onChange={setRrule}
                  eventDate={planDate}
                  disabled={isPending}
                />
              </div>
            )}
          </div>
        </div>

        {/* 설명 */}
        <div className="flex gap-2.5">
          <FileText className="w-4 h-4 mt-1 flex-shrink-0 text-[var(--text-tertiary)]" />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.stopPropagation(); }}
            placeholder="설명 추가"
            disabled={isPending}
            rows={2}
            className="flex-1 min-w-0 px-2.5 py-1.5 text-sm border border-transparent rounded-md focus:outline-none focus:border-[rgb(var(--color-secondary-300))] focus:ring-1 focus:ring-blue-400 disabled:opacity-50 resize-none bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
          />
        </div>

        {/* 활성 캘린더 표시 */}
        <div className="flex items-center gap-2 py-1">
          <Calendar className="w-4 h-4 flex-shrink-0 text-[var(--text-tertiary)]" />
          <span
            className="h-3 w-3 flex-shrink-0 rounded-sm"
            style={{ backgroundColor: calendarColorHex ?? '#039be5' }}
          />
          <span className="text-xs text-[var(--text-secondary)] truncate">{calendarName || '캘린더'}</span>
        </div>

        {/* 옵션 더보기 + 저장 (오른쪽 정렬) */}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => { onOpenFullModal(slot); onClose(); }}
            className="px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))] rounded-full transition-colors"
          >
            옵션 더보기
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!title.trim() || isPending || (mode === 'timed' && computedMinutes <= 0)}
            className="px-4 py-1.5 text-sm font-medium text-white bg-blue-500 rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            저장
          </button>
        </div>
      </div>

      {/* 추가 옵션 (미완료/주간 배치) */}
      {(onPlaceUnfinished || onPlaceFromWeekly) && (
        <>
          <div className="border-t border-[rgb(var(--color-secondary-100))]" />
          <div className="py-1">
            {onPlaceUnfinished && (
              <button
                type="button"
                onClick={() => { onPlaceUnfinished(slot); onClose(); }}
                className="w-full px-5 py-2 text-left text-sm hover:bg-[rgb(var(--color-secondary-100))] flex items-center gap-3 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
              >
                <span className="text-amber-500">&#x1F4CB;</span>
                <span className="text-[var(--text-secondary)]">미완료 플랜 배치</span>
              </button>
            )}
            {onPlaceFromWeekly && (
              <button
                type="button"
                onClick={() => { onPlaceFromWeekly(slot); onClose(); }}
                className="w-full px-5 py-2 text-left text-sm hover:bg-[rgb(var(--color-secondary-100))] flex items-center gap-3 transition-colors last:rounded-b-2xl"
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
