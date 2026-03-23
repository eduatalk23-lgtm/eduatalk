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
import { format, parseISO, addDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useToast } from '@/components/ui/ToastProvider';
import { SUPPORTED_SUBJECT_CATEGORIES } from '@/lib/domains/plan/llm/actions/coldStart/types';
import { formatRRuleToKorean } from '@/lib/domains/calendar/rrule';
import { useAdminPlanBasic } from '../context/AdminPlanBasicContext';

/** Quick-Create 탭 (Google Calendar 패턴: Event | Task | Appointment) */
type QuickCreateTab = 'event' | 'study' | 'consultation';

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
  onOpenFullModal: (slot: EmptySlot, formData?: { title?: string; description?: string; label?: string; subject?: string; rrule?: string | null }) => void;
  onOpenConsultationModal?: (slot: EmptySlot, extra?: { studentId?: string; sessionType?: string; consultationMode?: string; title?: string; description?: string; meetingLink?: string; visitor?: string }) => void;
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
  studentId,
  tenantId,
  calendarId,
  calendarName,
  calendarColorHex,
  planDate,
  onSuccess,
  onClose,
  onOpenFullModal,
  onOpenConsultationModal,
  onPlaceUnfinished,
  onPlaceFromWeekly,
  initialMode = 'timed',
  defaultEstimatedMinutes,
  defaultReminderMinutes,
}: InlineQuickCreateProps) {
  const toast = useToast();
  const { viewMode, currentUserId } = useAdminPlanBasic();
  const isAdminMode = viewMode === 'admin' || viewMode === 'personal';

  // ── 탭 상태 ──
  const [activeTab, setActiveTab] = useState<QuickCreateTab>('event');

  // ── 공통 상태 ──
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // ── 일정/학습 전용 상태 ──
  const [subject, setSubject] = useState('');
  const [mode, setMode] = useState<'allDay' | 'timed'>(initialMode);
  const [selectedLabel, setSelectedLabel] = useState('학습');
  const isStudy = activeTab === 'study';
  const isTask = activeTab === 'study' ? true : getDefaultIsTask(selectedLabel);
  const [rrule, setRrule] = useState<string | null>(null);
  const [timeExpanded, setTimeExpanded] = useState(false);

  // ── 시간 상태 ──
  const isAllDaySlot = slot.startTime === '00:00' && slot.endTime === '23:59';
  const durationMin = defaultEstimatedMinutes ?? 60;
  const defaultStart = isAllDaySlot ? '09:00' : slot.startTime;
  const defaultEnd = isAllDaySlot
    ? minutesToTime(timeToMinutes('09:00') + durationMin)
    : slot.endTime;
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(defaultEnd);
  const [startDate, setStartDate] = useState(planDate);
  const [endDate, setEndDate] = useState(planDate);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const isMultiDay = endDate !== startDate;
  const computedMinutes = isMultiDay
    ? Math.round((new Date(`${endDate}T${endTime}:00Z`).getTime() - new Date(`${startDate}T${startTime}:00Z`).getTime()) / 60000)
    : timeToMinutes(endTime) - timeToMinutes(startTime);

  // 탭 전환 시 제목 기본값 설정
  const handleTabChange = useCallback((tab: QuickCreateTab) => {
    if (tab === 'consultation') {
      // 상담 탭: 바로 Full Form(EventEditModal consultation 모드)으로 진입
      if (onOpenConsultationModal) {
        onOpenConsultationModal(slot);
        onClose();
        return;
      }
      // fallback: 핸들러 없으면 무시
      return;
    }
    setActiveTab(tab);
    setTitleError(null);
    if (tab === 'study') {
      setSelectedLabel('학습');
      if (!title.trim()) setTitle('');
    } else {
      setSelectedLabel('일반');
    }
  }, [title, onOpenConsultationModal, slot, onClose]);

  const handleStartTimeChange = useCallback((newStart: string) => {
    const currentDuration = timeToMinutes(endTime) - timeToMinutes(startTime);
    const duration = currentDuration > 0 ? currentDuration : 60;
    const newEndMin = Math.min(timeToMinutes(newStart) + duration, 24 * 60 - 15);
    setStartTime(newStart);
    setEndTime(minutesToTime(newEndMin));
  }, [startTime, endTime]);

  // GCal 패턴: end ≤ start on same date → endDate 다음날로 자동 변경
  const handleEndTimeChange = useCallback((newEnd: string) => {
    setEndTime(newEnd);
    if (!isMultiDay && timeToMinutes(newEnd) <= timeToMinutes(startTime)) {
      try {
        const nextDay = format(addDays(parseISO(startDate), 1), 'yyyy-MM-dd');
        setEndDate(nextDay);
      } catch { /* ignore */ }
    }
  }, [startTime, isMultiDay, startDate]);

  const handleAddTime = useCallback(() => {
    setStartTime(defaultStart);
    setEndTime(defaultEnd);
    setMode('timed');
  }, [defaultStart, defaultEnd]);

  // ── 저장 핸들러 ──
  const handleSubmit = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError('제목을 입력해주세요');
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
          planDate: startDate,
          endDate: isMultiDay ? endDate : undefined,
          startTime: mode === 'allDay' ? undefined : startTime,
          endTime: mode === 'allDay' ? undefined : endTime,
          isAllDay: mode === 'allDay',
          subject: isStudy ? (subject || undefined) : undefined,
          rrule: rrule ?? undefined,
          eventType: isStudy ? 'study' : 'custom',
          label: isStudy ? '학습' : selectedLabel,
          isTask,
          containerType: 'daily',
          estimatedMinutes: isStudy && mode !== 'allDay' && computedMinutes > 0 ? computedMinutes : undefined,
          reminderMinutes: defaultReminderMinutes?.[0] ?? undefined,
        });
        toast.showSuccess(rrule ? '반복 이벤트가 생성되었습니다' : `${isStudy ? '학습' : selectedLabel} 일정이 생성되었습니다`);
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

  // ── 탭 정의 ──
  // 상담 탭: onOpenConsultationModal이 있을 때만 표시 (클릭 시 바로 Full Form 진입)
  const tabs: { key: QuickCreateTab; label: string; adminOnly?: boolean }[] = [
    { key: 'event', label: '일정' },
    { key: 'study', label: '학습' },
    ...(onOpenConsultationModal ? [{ key: 'consultation' as const, label: '상담', adminOnly: true }] : []),
  ];

  return (
    <div className="w-full max-w-[448px]">
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

      {/* 탭 (Google Calendar 패턴: Event | Task | Appointment) */}
      <div className="px-5 flex gap-1 border-b border-[rgb(var(--color-secondary-100))]">
        {tabs
          .filter((t) => !t.adminOnly || isAdminMode)
          .map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => handleTabChange(t.key)}
              className={cn(
                'px-3 py-2 text-sm font-medium transition-colors relative',
                activeTab === t.key
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
              )}
            >
              {t.label}
              {activeTab === t.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
          ))}
      </div>

      {/* 빠른 생성 폼 */}
      <div className="px-5 pt-3 pb-3 space-y-3">
        {/* 제목 입력 */}
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
        {titleError && <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">{titleError}</p>}

        {/* ── 일정 탭: 라벨 프리셋 ── */}
        {activeTab === 'event' && (
          <div className="flex flex-wrap gap-1.5">
            {LABEL_PRESETS.filter((p) => p.label !== '학습').map((preset) => {
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
        )}

        {/* ── 학습 탭: 과목 선택 ── */}
        {activeTab === 'study' && (
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

        {/* 날짜/시간 + 반복 */}
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
                  {format(parseISO(startDate), 'M월 d일 (EEE)', { locale: ko })}
                  {mode === 'allDay' ? (
                    <span className="ml-2 text-[var(--text-secondary)]">종일</span>
                  ) : (
                    <>
                      <span className="ml-2">{formatTimeKoAmPm(startTime)}</span>
                      <span className="text-[var(--text-tertiary)]"> – </span>
                      {isMultiDay && (
                        <span className="text-xs text-[var(--text-tertiary)]">
                          {format(parseISO(endDate), 'M/d', { locale: ko })}{' '}
                        </span>
                      )}
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
              /* ── 펼친 상태 / 상담 탭 (항상 펼침) ── */
              <div className="flex flex-col gap-1.5">
                {/* [시작날짜] [시작시간] – [종료시간] [종료날짜] [duration] — 상세 페이지와 동일 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      const v = e.target.value;
                      setStartDate(v);
                      if (endDate < v) setEndDate(v);
                    }}
                    disabled={isPending}
                    className="rounded-md border border-[rgb(var(--color-secondary-300))] bg-transparent px-2 py-1.5 text-sm text-[var(--text-primary)] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {mode === 'timed' && (
                    <>
                      <TimePickerDropdown
                        value={startTime}
                        onChange={handleStartTimeChange}
                        disabled={isPending}
                      />
                      <span className="text-[var(--text-tertiary)] text-sm shrink-0">–</span>
                      <TimePickerDropdown
                        value={endTime}
                        onChange={handleEndTimeChange}
                        referenceTime={startTime}
                        disabled={isPending}
                      />
                    </>
                  )}
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v >= startDate) setEndDate(v);
                    }}
                    min={startDate}
                    disabled={isPending}
                    className="rounded-md border border-[rgb(var(--color-secondary-300))] bg-transparent px-2 py-1.5 text-sm text-[var(--text-primary)] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {mode === 'timed' && computedMinutes > 0 && (
                    <span className="text-sm text-[var(--text-tertiary)] whitespace-nowrap shrink-0">
                      {formatDurationKo(computedMinutes)}
                    </span>
                  )}
                </div>

                {/* 종일 + 반복 — 상세 페이지와 동일한 크기/간격 */}
                <div className="flex items-center gap-3 flex-nowrap">
                <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
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
                    className="h-4 w-4 rounded border-[rgb(var(--color-secondary-300))] text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-[var(--text-secondary)] whitespace-nowrap">종일</span>
                </label>

                <RecurrenceSelector
                  value={rrule}
                  onChange={setRrule}
                  eventDate={startDate}
                  disabled={isPending}
                />
                </div>
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
          <span className="text-xs text-[var(--text-secondary)] truncate">
            {calendarName || '캘린더'}
          </span>
        </div>

        {/* 옵션 더보기 + 저장 */}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              onOpenFullModal(slot, {
                title: title.trim() || undefined,
                description: description.trim() || undefined,
                label: isStudy ? '학습' : selectedLabel,
                subject: isStudy ? (subject || undefined) : undefined,
                rrule,
              });
              onClose();
            }}
            className="px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))] rounded-full transition-colors"
          >
            옵션 더보기
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              isPending
              || !title.trim()
              || (mode === 'timed' && computedMinutes <= 0)
            }
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
