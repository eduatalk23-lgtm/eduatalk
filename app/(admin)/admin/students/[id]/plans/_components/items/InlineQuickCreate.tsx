'use client';

import { memo, useState, useTransition, useRef, useEffect, useCallback } from 'react';
import { createCalendarEventAction } from '@/lib/domains/admin-plan/actions/calendarEvents';
import { type EmptySlot } from '@/lib/domains/admin-plan/utils/emptySlotCalculation';
import { RecurrenceSelector } from './RecurrenceSelector';
import { formatDurationKo, timeToMinutes, minutesToTime, formatTimeKoAmPm } from '../utils/timeGridUtils';
import { TimePickerDropdown } from './TimePickerDropdown';
import { cn } from '@/lib/cn';
import { LABEL_PRESETS, getDefaultIsTask } from '@/lib/domains/calendar/labelPresets';
import { Loader2, X, Clock, Calendar, FileText, Video, MapPin, Users, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useToast } from '@/components/ui/ToastProvider';
import { SUPPORTED_SUBJECT_CATEGORIES } from '@/lib/domains/plan/llm/actions/coldStart/types';
import { formatRRuleToKorean } from '@/lib/domains/calendar/rrule';
import { useAdminPlanBasic } from '../context/AdminPlanBasicContext';

/** Quick-Create 탭 (Google Calendar 패턴: Event | Task | Appointment) */
type QuickCreateTab = 'event' | 'study' | 'consultation';

const SESSION_TYPE_OPTIONS = ['정기상담', '학부모상담', '진로상담', '성적상담', '긴급상담', '기타'] as const;

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

  // ── 상담 전용 상태 ──
  const [sessionType, setSessionType] = useState<string>('정기상담');
  const [consultationMode, setConsultationMode] = useState<'대면' | '원격'>('대면');
  const [meetingLink, setMeetingLink] = useState('');
  const [visitor, setVisitor] = useState('');

  // ── Personal 모드: 학생 검색 상태 ──
  const isPersonalMode = viewMode === 'personal';
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState<string | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState<Array<{ id: string; name: string | null; grade?: number | null; school_name?: string | null }>>([]);
  const [isStudentSearching, setIsStudentSearching] = useState(false);
  const [studentDropdownOpen, setStudentDropdownOpen] = useState(false);
  const studentSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const studentDropdownRef = useRef<HTMLDivElement>(null);

  // 학생 검색 디바운스
  useEffect(() => {
    if (!isPersonalMode) return;
    if (studentSearchTimeoutRef.current) clearTimeout(studentSearchTimeoutRef.current);

    if (studentSearchQuery.trim()) {
      studentSearchTimeoutRef.current = setTimeout(async () => {
        setIsStudentSearching(true);
        try {
          const params = new URLSearchParams({ q: studentSearchQuery.trim(), isActive: 'true', limit: '10' });
          if (tenantId) params.append('tenantId', tenantId);
          const res = await fetch(`/api/students/search?${params.toString()}`);
          if (res.ok) {
            const json = await res.json();
            setStudentSearchResults(json.data?.students ?? []);
          }
        } catch { /* ignore */ } finally {
          setIsStudentSearching(false);
        }
      }, 300);
    } else {
      setStudentSearchResults([]);
    }

    return () => { if (studentSearchTimeoutRef.current) clearTimeout(studentSearchTimeoutRef.current); };
  }, [studentSearchQuery, isPersonalMode, tenantId]);

  // 드롭다운 외부 클릭 닫기
  useEffect(() => {
    if (!studentDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (studentDropdownRef.current && !studentDropdownRef.current.contains(e.target as Node)) {
        setStudentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [studentDropdownOpen]);

  // ── 시간 상태 ──
  const isAllDaySlot = slot.startTime === '00:00' && slot.endTime === '23:59';
  const durationMin = defaultEstimatedMinutes ?? 60;
  const defaultStart = isAllDaySlot ? '09:00' : slot.startTime;
  const defaultEnd = isAllDaySlot
    ? minutesToTime(timeToMinutes('09:00') + durationMin)
    : slot.endTime;
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(defaultEnd);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const computedMinutes = timeToMinutes(endTime) - timeToMinutes(startTime);

  // 탭 전환 시 제목 기본값 설정
  const handleTabChange = useCallback((tab: QuickCreateTab) => {
    setActiveTab(tab);
    setTitleError(null);
    if (tab === 'study') {
      setSelectedLabel('학습');
      if (!title.trim()) setTitle('');
    } else if (tab === 'consultation') {
      if (!title.trim()) setTitle('');
      // 상담은 항상 시간 모드
      setMode('timed');
      // Personal 모드: 탭 전환 시 학생 선택 초기화
      if (isPersonalMode) {
        setSelectedStudentId(null);
        setSelectedStudentName(null);
        setStudentSearchQuery('');
        setStudentSearchResults([]);
      }
    } else {
      setSelectedLabel('일반');
    }
  }, [title]);

  const handleStartTimeChange = useCallback((newStart: string) => {
    const currentDuration = timeToMinutes(endTime) - timeToMinutes(startTime);
    const duration = currentDuration > 0 ? currentDuration : 60;
    const newEndMin = Math.min(timeToMinutes(newStart) + duration, 24 * 60 - 15);
    setStartTime(newStart);
    setEndTime(minutesToTime(newEndMin));
  }, [startTime, endTime]);

  const handleEndTimeChange = useCallback((newEnd: string) => {
    if (timeToMinutes(newEnd) <= timeToMinutes(startTime)) {
      setEndTime(minutesToTime(timeToMinutes(startTime) + 60));
    } else {
      setEndTime(newEnd);
    }
  }, [startTime]);

  const handleAddTime = useCallback(() => {
    setStartTime(defaultStart);
    setEndTime(defaultEnd);
    setMode('timed');
  }, [defaultStart, defaultEnd]);

  // ── 저장 핸들러 ──
  const handleSubmit = () => {
    if (activeTab === 'consultation') {
      handleConsultationSubmit();
      return;
    }

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
          planDate,
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

  const handleConsultationSubmit = () => {
    const trimmed = title.trim() || sessionType;
    if (!currentUserId) {
      toast.showError('로그인 정보를 확인해주세요');
      return;
    }

    const effectiveStudentId = isPersonalMode ? selectedStudentId : studentId;
    if (!effectiveStudentId) {
      toast.showError('학생을 선택해주세요');
      return;
    }

    startTransition(async () => {
      try {
        const { createConsultationSchedule } = await import('@/lib/domains/consulting/actions/schedule');
        const result = await createConsultationSchedule({
          studentId: effectiveStudentId,
          consultantId: currentUserId,
          sessionType,
          programName: '',
          scheduledDate: planDate,
          startTime,
          endTime,
          consultationMode,
          meetingLink: consultationMode === '원격' ? meetingLink.trim() || undefined : undefined,
          visitor: visitor.trim() || undefined,
          description: description.trim() || undefined,
          sendNotification: false,
        });
        if (result.success) {
          toast.showSuccess('상담 일정이 생성되었습니다');
          onSuccess(result.scheduleId ? { planId: result.scheduleId, startTime } : undefined);
          onClose();
        } else {
          toast.showError(result.error ?? '상담 일정 생성에 실패했습니다');
        }
      } catch (err) {
        toast.showError(err instanceof Error ? err.message : '상담 일정 생성에 실패했습니다');
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
  const tabs: { key: QuickCreateTab; label: string; adminOnly?: boolean }[] = [
    { key: 'event', label: '일정' },
    { key: 'study', label: '학습' },
    { key: 'consultation', label: '상담', adminOnly: true },
  ];

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
                  ? 'text-blue-600'
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
          placeholder={activeTab === 'consultation' ? '상담 제목 (선택)' : '제목 추가'}
          disabled={isPending}
          className={cn(
            'w-full px-1 py-2 text-lg bg-transparent border-0 border-b-2 focus:outline-none disabled:opacity-50 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
            titleError ? 'border-red-400' : 'border-[rgb(var(--color-secondary-200))] focus:border-blue-500',
          )}
        />
        {titleError && <p className="text-xs text-red-500 mt-0.5">{titleError}</p>}

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

        {/* ── 상담 탭: 상담 전용 필드 ── */}
        {activeTab === 'consultation' && (
          <div className="space-y-3">
            {/* Personal 모드: 학생 검색 */}
            {isPersonalMode && (
              <div ref={studentDropdownRef} className="relative">
                {selectedStudentId ? (
                  /* 학생 선택 완료 상태 */
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800">
                    <Users className="w-4 h-4 text-violet-500 shrink-0" />
                    <span className="text-sm font-medium text-violet-700 dark:text-violet-300 truncate flex-1">
                      {selectedStudentName}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStudentId(null);
                        setSelectedStudentName(null);
                        setStudentSearchQuery('');
                        setStudentSearchResults([]);
                      }}
                      className="p-0.5 rounded-full hover:bg-violet-100 dark:hover:bg-violet-900 text-violet-400 hover:text-violet-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  /* 학생 검색 입력 */
                  <>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[rgb(var(--color-secondary-300))] focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-400 bg-[rgb(var(--color-secondary-50))]">
                      <Search className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
                      <input
                        type="text"
                        value={studentSearchQuery}
                        onChange={(e) => { setStudentSearchQuery(e.target.value); setStudentDropdownOpen(true); }}
                        onFocus={() => setStudentDropdownOpen(true)}
                        placeholder="학생 검색..."
                        disabled={isPending}
                        className="flex-1 min-w-0 text-sm bg-transparent border-0 focus:outline-none disabled:opacity-50 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                      />
                      {isStudentSearching && <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--text-tertiary)]" />}
                    </div>
                    {/* 검색 결과 드롭다운 */}
                    {studentDropdownOpen && studentSearchQuery.trim() && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-[rgb(var(--color-secondary-900))] border border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {studentSearchResults.length > 0 ? (
                          studentSearchResults.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setSelectedStudentId(s.id);
                                setSelectedStudentName(s.name ?? '');
                                setStudentSearchQuery('');
                                setStudentDropdownOpen(false);
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-[rgb(var(--color-secondary-100))] dark:hover:bg-[rgb(var(--color-secondary-800))] flex items-center gap-2 transition-colors"
                            >
                              <span className="font-medium text-[var(--text-primary)]">{s.name}</span>
                              {(s.grade || s.school_name) && (
                                <span className="text-xs text-[var(--text-tertiary)]">
                                  {s.grade ? `${s.grade}학년` : ''}{s.grade && s.school_name ? ' · ' : ''}{s.school_name ?? ''}
                                </span>
                              )}
                            </button>
                          ))
                        ) : !isStudentSearching ? (
                          <div className="px-3 py-3 text-sm text-center text-[var(--text-tertiary)]">
                            검색 결과가 없습니다
                          </div>
                        ) : null}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* 상담 유형 */}
            <div className="flex flex-wrap gap-1.5">
              {SESSION_TYPE_OPTIONS.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSessionType(type)}
                  disabled={isPending}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-full border transition-colors disabled:opacity-50',
                    sessionType === type
                      ? 'font-medium border-transparent text-white bg-violet-500'
                      : 'border-[rgb(var(--color-secondary-200))] text-[var(--text-tertiary)] hover:border-[rgb(var(--color-secondary-300))]',
                  )}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* 상담 방식 토글 */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConsultationMode('대면')}
                disabled={isPending}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors disabled:opacity-50',
                  consultationMode === '대면'
                    ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                    : 'border-[rgb(var(--color-secondary-200))] text-[var(--text-tertiary)]',
                )}
              >
                <MapPin className="w-3.5 h-3.5" />
                대면
              </button>
              <button
                type="button"
                onClick={() => setConsultationMode('원격')}
                disabled={isPending}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors disabled:opacity-50',
                  consultationMode === '원격'
                    ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                    : 'border-[rgb(var(--color-secondary-200))] text-[var(--text-tertiary)]',
                )}
              >
                <Video className="w-3.5 h-3.5" />
                원격
              </button>
            </div>

            {/* 화상 링크 (원격 시만) */}
            {consultationMode === '원격' && (
              <input
                type="url"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="화상 회의 링크"
                disabled={isPending}
                className="w-full px-3 py-1.5 text-sm border border-[rgb(var(--color-secondary-300))] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 bg-[rgb(var(--color-secondary-50))] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
              />
            )}

            {/* 방문자 */}
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
              <input
                type="text"
                value={visitor}
                onChange={(e) => setVisitor(e.target.value)}
                placeholder="방문자 (예: 어머니)"
                disabled={isPending}
                className="flex-1 min-w-0 px-2.5 py-1.5 text-sm border border-transparent rounded-md focus:outline-none focus:border-[rgb(var(--color-secondary-300))] focus:ring-1 focus:ring-blue-400 disabled:opacity-50 bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
              />
            </div>
          </div>
        )}

        {/* 날짜/시간 + 반복 */}
        <div className="flex gap-2.5">
          <Clock className="w-4 h-4 mt-1 flex-shrink-0 text-[var(--text-tertiary)]" />

          <div className="flex-1 min-w-0">
            {!timeExpanded && activeTab !== 'consultation' ? (
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
              /* ── 펼친 상태 / 상담 탭 (항상 펼침) ── */
              <div className="space-y-2.5">
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

                {/* 종일 체크박스 + 반복 설정 — 상담 탭에서는 숨김 */}
                {activeTab !== 'consultation' && (
                  <>
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

                    <RecurrenceSelector
                      value={rrule}
                      onChange={setRrule}
                      eventDate={planDate}
                      disabled={isPending}
                    />
                  </>
                )}
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

        {/* 활성 캘린더 표시 (상담 탭: 테넌트 캘린더 표시) */}
        <div className="flex items-center gap-2 py-1">
          <Calendar className="w-4 h-4 flex-shrink-0 text-[var(--text-tertiary)]" />
          <span
            className="h-3 w-3 flex-shrink-0 rounded-sm"
            style={{ backgroundColor: activeTab === 'consultation' ? '#8e24aa' : (calendarColorHex ?? '#039be5') }}
          />
          <span className="text-xs text-[var(--text-secondary)] truncate">
            {activeTab === 'consultation' ? '상담 캘린더' : (calendarName || '캘린더')}
          </span>
        </div>

        {/* 옵션 더보기 + 저장 */}
        <div className="flex items-center justify-end gap-2">
          {(activeTab !== 'consultation' || (onOpenConsultationModal && (!isPersonalMode || selectedStudentId))) && (
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'consultation' && onOpenConsultationModal) {
                  onOpenConsultationModal(slot, {
                    studentId: isPersonalMode ? selectedStudentId ?? undefined : undefined,
                    sessionType,
                    consultationMode,
                    title: title.trim() || undefined,
                    description: description.trim() || undefined,
                    meetingLink: consultationMode === '원격' ? meetingLink.trim() || undefined : undefined,
                    visitor: visitor.trim() || undefined,
                  });
                } else {
                  onOpenFullModal(slot);
                }
                onClose();
              }}
              className="px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))] rounded-full transition-colors"
            >
              옵션 더보기
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              isPending
              || (activeTab !== 'consultation' && !title.trim())
              || (mode === 'timed' && computedMinutes <= 0)
              || (activeTab === 'consultation' && isPersonalMode && !selectedStudentId)
            }
            className="px-4 py-1.5 text-sm font-medium text-white bg-blue-500 rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            저장
          </button>
        </div>
      </div>

      {/* 추가 옵션 (미완료/주간 배치) — 일정/학습 탭만 */}
      {activeTab !== 'consultation' && (onPlaceUnfinished || onPlaceFromWeekly) && (
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
