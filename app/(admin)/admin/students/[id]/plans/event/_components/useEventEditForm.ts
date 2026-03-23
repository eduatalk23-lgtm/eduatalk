'use client';

import { useState, useEffect, useCallback, useMemo, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';
import {
  getCalendarEventForEdit,
  updateCalendarEventFull,
  updateRecurringEvent,
  deleteRecurringEvent,
  deletePlan,
  type CalendarEventEditData,
  type CalendarEventFullUpdate,
  type RecurringScope,
} from '@/lib/domains/calendar/actions/calendarEventActions';
import { createCalendarEventAction } from '@/lib/domains/admin-plan/actions/calendarEvents';
import { extractTimeHHMM, extractDateYMD } from '@/lib/domains/calendar/adapters';
import { getPresetForLabel } from '@/lib/domains/calendar/labelPresets';
import { timeToMinutes } from '../../_components/utils/timeGridUtils';
import type { EventEditEntityType } from '../../_components/hooks/useEventEditModal';
import type { ConsultationMode, NotificationTarget, NotificationChannel } from '@/lib/domains/consulting/types';

// ============================================
// Types
// ============================================

/** @deprecated ManualEventType은 label + isTask + hasStudyData로 대체 */
export type ManualEventType = 'study' | 'focus_time' | 'custom' | 'break';

export interface EventEditFormState {
  title: string;
  description: string;
  color: string | null;
  /** 이벤트가 속한 캘린더 ID */
  calendarId: string | null;
  date: string;
  /** 종료 날짜 (다일 이벤트 지원, GCal 패리티) */
  endDate: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  rrule: string | null;
  reminderMinutes: number[];
  /** @deprecated label + isTask + hasStudyData 사용 */
  eventType: ManualEventType;
  label: string;
  isTask: boolean;
  hasStudyData: boolean;
  subject: string;
  status: string;
  containerType: string;
  // study data
  plannedStartPage: number | null;
  plannedEndPage: number | null;
  estimatedMinutes: number | null;
  // read-only
  contentTitle: string | null;
  contentType: string | null;
  // ── 상담 전용 필드 ──
  /** 상담 대상 학생 ID (personal mode에서 필수) */
  consultationStudentId: string | null;
  /** 상담 대상 학생명 (edit mode에서 resolve된 이름) */
  consultationStudentName: string | null;
  /** 담당 컨설턴트 ID */
  consultantId: string | null;
  /** 상담 유형 (정기상담, 학부모상담, ...) */
  sessionType: string;
  /** 프로그램명 */
  programName: string;
  /** 상담 방식 */
  consultationMode: ConsultationMode;
  /** 방문 상담자 */
  visitor: string;
  /** 참가 링크 (원격) */
  meetingLink: string;
  /** 상담 장소 (대면) */
  consultationLocation: string;
  /** 알림 대상 */
  notificationTargets: NotificationTarget[];
  /** 알림 채널 */
  notificationChannel: NotificationChannel;
}

interface UseEventEditFormOptions {
  mode: 'new' | 'edit';
  /** 엔티티 타입: 일정/학습 vs 상담 */
  entityType?: EventEditEntityType;
  studentId: string;
  eventId?: string;
  calendarId?: string;
  // Initial values for new mode (from searchParams)
  initialDate?: string;
  /** 종료 날짜 초기값 (multi-day 이벤트) */
  initialEndDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  initialSubject?: string;
  initialEventType?: ManualEventType;
  initialLabel?: string;
  initialIsTask?: boolean;
  /** 반복 규칙 초기값 */
  initialRrule?: string | null;
  returnPath: string;
  instanceDate?: string;
  /** 모달 모드: 저장/삭제 성공 후 콜백 (있으면 router.push 대신 호출) */
  onSuccessModal?: () => void;
  // ── 상담 전용 초기값 ──
  consultationStudentId?: string;
  consultationSessionType?: string;
  consultationMode?: ConsultationMode;
  // ── QuickCreate에서 전달된 초기값 ──
  initialTitle?: string;
  initialDescription?: string;
  initialMeetingLink?: string;
  initialVisitor?: string;
}

export interface UseEventEditFormReturn {
  form: EventEditFormState;
  setField: <K extends keyof EventEditFormState>(key: K, value: EventEditFormState[K]) => void;
  setLabel: (newLabel: string) => void;
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  handleSave: () => Promise<void>;
  handleDelete: () => Promise<void>;
  isRecurring: boolean;
  // Recurring event edit: need scope selection before save/delete
  needsRecurringScope: 'save' | 'delete' | null;
  handleRecurringScopeSelect: (scope: RecurringScope) => Promise<void>;
  cancelRecurringScope: () => void;
  originalData: CalendarEventEditData | null;
  /** 실제 결정된 entityType (props + 로드 데이터 auto-detect 반영) */
  resolvedEntityType: EventEditEntityType;
}

// ============================================
// Helpers
// ============================================

function parseTimeFromTimestamp(ts: string | null): string {
  return extractTimeHHMM(ts) ?? '09:00';
}

function parseDateFromTimestamp(ts: string | null, fallbackDate?: string | null): string {
  return extractDateYMD(ts) ?? fallbackDate ?? new Date().toISOString().split('T')[0];
}

function getDefaultForm(opts: UseEventEditFormOptions): EventEditFormState {
  const today = new Date().toISOString().split('T')[0];
  const isConsultation = opts.entityType === 'consultation';
  // label을 primary로 사용, initialEventType은 fallback
  const label = isConsultation ? '상담'
    : opts.initialLabel
    ?? (opts.initialEventType === 'study' ? '학습'
      : opts.initialEventType === 'focus_time' ? '집중 시간'
      : opts.initialEventType === 'break' ? '휴식'
      : '학습');
  const preset = getPresetForLabel(label);
  const hasStudyData = label === '학습';
  const eventType: ManualEventType = hasStudyData ? 'study'
    : label === '집중 시간' ? 'focus_time'
    : label === '휴식' ? 'break' : 'custom';
  const isTask = opts.initialIsTask ?? (preset?.defaultIsTask ?? false);
  return {
    title: opts.initialTitle ?? '',
    description: opts.initialDescription ?? '',
    color: null,
    calendarId: opts.calendarId ?? null,
    date: opts.initialDate ?? today,
    endDate: opts.initialEndDate ?? opts.initialDate ?? today,
    startTime: opts.initialStartTime ?? '09:00',
    endTime: opts.initialEndTime ?? '10:00',
    isAllDay: false,
    rrule: opts.initialRrule ?? null,
    reminderMinutes: [],
    eventType,
    label,
    isTask,
    hasStudyData,
    subject: opts.initialSubject ?? '',
    status: 'confirmed',
    containerType: 'daily',
    plannedStartPage: null,
    plannedEndPage: null,
    estimatedMinutes: null,
    contentTitle: null,
    contentType: null,
    // 상담 전용 필드
    consultationStudentId: opts.consultationStudentId ?? null,
    consultationStudentName: null,
    consultantId: null,
    sessionType: opts.consultationSessionType ?? '정기상담',
    programName: '',
    consultationMode: opts.consultationMode ?? '대면',
    visitor: opts.initialVisitor ?? '',
    meetingLink: opts.initialMeetingLink ?? '',
    consultationLocation: '',
    notificationTargets: [],
    notificationChannel: 'alimtalk',
  };
}

function eventDataToForm(data: CalendarEventEditData): EventEditFormState {
  const date = parseDateFromTimestamp(data.start_at, data.start_date);
  // Derive legacy eventType from new fields for backward compat
  const eventType: ManualEventType = data.has_study_data ? 'study'
    : data.label === '집중 시간' || data.label === '집중 학습' ? 'focus_time'
    : data.label === '휴식' ? 'break'
    : 'custom';

  const ced = data.consultation_event_data;

  return {
    title: data.title,
    description: data.description ?? '',
    color: data.color,
    calendarId: data.calendar_id ?? null,
    date,
    endDate: parseDateFromTimestamp(data.end_at, data.end_date) || date,
    startTime: parseTimeFromTimestamp(data.start_at),
    endTime: parseTimeFromTimestamp(data.end_at),
    isAllDay: data.is_all_day ?? false,
    rrule: data.rrule,
    reminderMinutes: data.reminder_minutes ?? [],
    eventType,
    label: data.label ?? '기타',
    isTask: data.is_task ?? false,
    hasStudyData: data.has_study_data ?? false,
    subject: data.subject_category ?? '',
    status: data.status,
    containerType: data.container_type ?? 'daily',
    plannedStartPage: data.planned_start_page,
    plannedEndPage: data.planned_end_page,
    estimatedMinutes: data.estimated_minutes,
    contentTitle: data.content_title,
    contentType: data.content_type,
    // 상담 필드 — consultation_event_data에서 채우기
    consultationStudentId: ced?.student_id ?? null,
    consultationStudentName: ced?.student_name ?? null,
    consultantId: ced?.consultant_id ?? null,
    sessionType: ced?.session_type ?? '정기상담',
    programName: ced?.program_name ?? '',
    consultationMode: (ced?.consultation_mode as ConsultationMode) ?? '대면',
    visitor: ced?.visitor ?? '',
    meetingLink: ced?.meeting_link ?? '',
    consultationLocation: '',
    notificationTargets: (ced?.notification_targets?.filter((t): t is NotificationTarget =>
      t === 'student' || t === 'mother' || t === 'father'
    )) ?? [],
    notificationChannel: 'alimtalk',
  };
}

// ============================================
// Hook
// ============================================

export function useEventEditForm(opts: UseEventEditFormOptions): UseEventEditFormReturn {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<EventEditFormState>(() => getDefaultForm(opts));
  const [originalData, setOriginalData] = useState<CalendarEventEditData | null>(null);
  const [initialForm, setInitialForm] = useState<EventEditFormState>(() => getDefaultForm(opts));
  const [isLoading, setIsLoading] = useState(opts.mode === 'edit');
  const [isSaving, startSaveTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [needsRecurringScope, setNeedsRecurringScope] = useState<'save' | 'delete' | null>(null);
  const hasMountedRef = useRef(false);
  /** 로드된 데이터 기반 auto-detected entityType (edit mode) */
  const [detectedEntityType, setDetectedEntityType] = useState<EventEditEntityType | null>(null);

  // Load event data for edit mode
  useEffect(() => {
    if (opts.mode !== 'edit' || !opts.eventId) return;
    let cancelled = false;

    (async () => {
      const result = await getCalendarEventForEdit(opts.eventId!);
      if (cancelled) return;

      if (result.success && result.data) {
        setOriginalData(result.data);
        const formData = eventDataToForm(result.data);
        setForm(formData);
        setInitialForm(formData);
        // Auto-detect consultation from loaded data
        if (result.data.event_type === 'consultation' || result.data.consultation_event_data) {
          setDetectedEntityType('consultation');
        }
      } else {
        toast.showError(result.error ?? '이벤트를 불러올 수 없습니다.');
        if (opts.onSuccessModal) opts.onSuccessModal();
        else router.back();
      }
      setIsLoading(false);
    })();

    return () => { cancelled = true; };
  }, [opts.mode, opts.eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 실제 entityType: props 우선, 로드 데이터 fallback */
  const resolvedEntityType: EventEditEntityType = opts.entityType ?? detectedEntityType ?? 'event';

  const setField = useCallback(<K extends keyof EventEditFormState>(key: K, value: EventEditFormState[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // 시작 날짜 변경 시 종료 날짜가 시작보다 이전이면 자동 조정
      if (key === 'date' && typeof value === 'string' && next.endDate < value) {
        next.endDate = value;
      }
      // 종료 날짜가 시작보다 이전이면 시작으로 보정
      if (key === 'endDate' && typeof value === 'string' && value < next.date) {
        next.endDate = next.date;
      }
      // GCal overnight auto-detect: 같은 날 + end ≤ start → endDate 다음날
      if (key === 'endTime' && typeof value === 'string' && !next.isAllDay) {
        if (next.endDate === next.date && timeToMinutes(value) <= timeToMinutes(next.startTime)) {
          const d = new Date(next.date + 'T00:00:00Z');
          d.setDate(d.getDate() + 1);
          next.endDate = d.toISOString().split('T')[0];
        }
        // 참고: endDate > date일 때 endTime > startTime이어도 리셋하지 않음
        // → 사용자가 수동으로 설정한 multi-day를 보존
      }
      return next;
    });
  }, []);

  const setLabel = useCallback((newLabel: string) => {
    setForm((prev) => {
      const preset = getPresetForLabel(newLabel);
      const hasStudyData = newLabel === '학습';
      const eventType: ManualEventType = hasStudyData ? 'study'
        : newLabel === '집중 시간' ? 'focus_time'
        : newLabel === '휴식' ? 'break' : 'custom';
      return {
        ...prev,
        label: newLabel,
        isTask: preset?.defaultIsTask ?? false,
        hasStudyData,
        color: preset ? null : prev.color,
        eventType,
        ...(hasStudyData ? {} : { subject: '', plannedStartPage: null, plannedEndPage: null, estimatedMinutes: null }),
      };
    });
  }, []);

  const isDirty = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(initialForm);
  }, [form, initialForm]);

  const isRecurring = !!(form.rrule || originalData?.recurring_event_id);

  // beforeunload guard
  useEffect(() => {
    hasMountedRef.current = true;
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Build update payload from form diff
  const buildUpdates = useCallback((): CalendarEventFullUpdate => {
    const updates: CalendarEventFullUpdate = {};
    if (form.title !== initialForm.title) updates.title = form.title;
    if (form.description !== initialForm.description) updates.description = form.description || null;
    if (form.color !== initialForm.color) updates.color = form.color;
    if (form.calendarId !== initialForm.calendarId && form.calendarId) updates.calendar_id = form.calendarId;
    if (form.isAllDay !== initialForm.isAllDay) updates.is_all_day = form.isAllDay;
    if (form.rrule !== initialForm.rrule) updates.rrule = form.rrule;
    if (form.status !== initialForm.status) updates.status = form.status;
    if (form.containerType !== initialForm.containerType) updates.container_type = form.containerType;
    if (form.label !== initialForm.label) updates.label = form.label;
    if (form.isTask !== initialForm.isTask) updates.is_task = form.isTask;
    if (form.hasStudyData !== initialForm.hasStudyData) updates.has_study_data = form.hasStudyData;
    // study 데이터가 있을 때만 학습 관련 필드 diff
    if (form.hasStudyData) {
      if (form.subject !== initialForm.subject) updates.subject_category = form.subject || null;
      if (form.plannedStartPage !== initialForm.plannedStartPage) updates.planned_start_page = form.plannedStartPage;
      if (form.plannedEndPage !== initialForm.plannedEndPage) updates.planned_end_page = form.plannedEndPage;
      if (form.estimatedMinutes !== initialForm.estimatedMinutes) updates.estimated_minutes = form.estimatedMinutes;
    }

    // Reminder: array diff
    const newReminder = form.reminderMinutes;
    const oldReminder = initialForm.reminderMinutes;
    if (JSON.stringify(newReminder) !== JSON.stringify(oldReminder)) {
      updates.reminder_minutes = newReminder.length > 0 ? newReminder : null;
    }

    // Time changes
    if (form.date !== initialForm.date || form.endDate !== initialForm.endDate || form.startTime !== initialForm.startTime || form.endTime !== initialForm.endTime) {
      if (form.isAllDay) {
        updates.start_date = form.date;
        updates.end_date = form.endDate;
        updates.start_at = null;
        updates.end_at = null;
      } else {
        updates.start_at = `${form.date}T${form.startTime}:00+09:00`;
        updates.end_at = `${form.endDate}T${form.endTime}:00+09:00`;
        updates.start_date = null;
        updates.end_date = null;
      }
    }

    return updates;
  }, [form, initialForm]);

  const handleSave = useCallback(async () => {
    const isConsultationMode = resolvedEntityType === 'consultation';

    // 상담 모드: 제목은 선택사항 (sessionType이 기본값)
    if (!isConsultationMode && !form.title.trim()) {
      toast.showError('제목을 입력해주세요.');
      return;
    }

    // 상담 모드: 전용 저장 로직
    if (isConsultationMode) {
      // 필수값 검증
      const effectiveStudentId = form.consultationStudentId || opts.consultationStudentId || opts.studentId;
      if (!effectiveStudentId) {
        toast.showError('학생을 선택해주세요.');
        return;
      }
      if (!form.consultantId) {
        toast.showError('컨설턴트를 선택해주세요.');
        return;
      }
      if (!form.programName.trim()) {
        toast.showError('프로그램을 입력해주세요.');
        return;
      }
      if (form.endTime <= form.startTime) {
        toast.showError('종료 시간은 시작 시간 이후여야 합니다.');
        return;
      }

      startSaveTransition(async () => {
        try {
          if (opts.mode === 'edit' && opts.eventId) {
            // 상담 수정
            const { updateConsultationSchedule } = await import('@/lib/domains/consulting/actions/schedule');
            const result = await updateConsultationSchedule({
              scheduleId: opts.eventId,
              studentId: effectiveStudentId,
              consultantId: form.consultantId!,
              sessionType: form.sessionType.trim() || '정기상담',
              programName: form.programName.trim(),
              scheduledDate: form.date,
              startTime: form.startTime,
              endTime: form.endTime,
              consultationMode: form.consultationMode,
              meetingLink: form.consultationMode === '원격' ? form.meetingLink.trim() || undefined : undefined,
              visitor: form.visitor.trim() || undefined,
              location: form.consultationMode === '대면' ? form.consultationLocation.trim() || undefined : undefined,
              description: form.description.trim() || undefined,
              sendNotification: form.notificationTargets.length > 0,
              notificationTargets: form.notificationTargets,
              notificationChannel: form.notificationChannel,
            });

            if (result.success) {
              toast.showSuccess('상담 일정이 수정되었습니다.');
              if (opts.onSuccessModal) opts.onSuccessModal();
              else router.push(opts.returnPath);
            } else {
              toast.showError(result.error ?? '상담 일정 수정에 실패했습니다.');
            }
          } else {
            // 상담 생성
            const { createConsultationSchedule } = await import('@/lib/domains/consulting/actions/schedule');
            const result = await createConsultationSchedule({
              studentId: effectiveStudentId,
              consultantId: form.consultantId!,
              sessionType: form.sessionType.trim() || '정기상담',
              programName: form.programName.trim(),
              scheduledDate: form.date,
              startTime: form.startTime,
              endTime: form.endTime,
              consultationMode: form.consultationMode,
              meetingLink: form.consultationMode === '원격' ? form.meetingLink.trim() || undefined : undefined,
              visitor: form.visitor.trim() || undefined,
              location: form.consultationMode === '대면' ? form.consultationLocation.trim() || undefined : undefined,
              description: form.description.trim() || undefined,
              sendNotification: form.notificationTargets.length > 0,
              notificationTargets: form.notificationTargets,
              notificationChannel: form.notificationChannel,
            });

            if (result.success) {
              toast.showSuccess('상담 일정이 생성되었습니다.');
              if (opts.onSuccessModal) opts.onSuccessModal();
              else router.push(opts.returnPath);
            } else {
              toast.showError(result.error ?? '상담 일정 생성에 실패했습니다.');
            }
          }
        } catch {
          toast.showError('상담 일정 저장 중 오류가 발생했습니다.');
        }
      });
      return;
    }

    // Recurring event: need scope selection
    if (opts.mode === 'edit' && isRecurring) {
      setNeedsRecurringScope('save');
      return;
    }

    if (opts.mode === 'new') {
      startSaveTransition(async () => {
        try {
          const effectiveCalendarId = form.calendarId || opts.calendarId;
          if (!effectiveCalendarId) {
            toast.showError('캘린더를 선택해주세요.');
            return;
          }
          const { eventId } = await createCalendarEventAction({
            calendarId: effectiveCalendarId,
            title: form.title.trim(),
            planDate: form.date,
            endDate: form.endDate !== form.date ? form.endDate : undefined,
            startTime: form.isAllDay ? undefined : form.startTime,
            endTime: form.isAllDay ? undefined : form.endTime,
            isAllDay: form.isAllDay,
            subject: form.hasStudyData ? (form.subject || undefined) : undefined,
            subjectCategory: form.hasStudyData ? (form.subject || undefined) : undefined,
            rrule: form.rrule,
            eventType: form.hasStudyData ? 'study' : 'custom', // dual-write for Stage 1
            label: form.label,
            isTask: form.isTask,
            containerType: form.containerType,
            color: form.color ?? undefined,
            reminderMinutes: form.reminderMinutes[0] ?? null,
            description: form.description || undefined,
            estimatedMinutes: form.hasStudyData ? form.estimatedMinutes : undefined,
          });

          // Update fields not handled by create action
          {
            const extraUpdates: CalendarEventFullUpdate = {};
            if (form.reminderMinutes.length > 1) {
              extraUpdates.reminder_minutes = form.reminderMinutes;
            }
            if (form.hasStudyData) {
              if (form.plannedStartPage != null) extraUpdates.planned_start_page = form.plannedStartPage;
              if (form.plannedEndPage != null) extraUpdates.planned_end_page = form.plannedEndPage;
            }
            if (Object.keys(extraUpdates).length > 0) {
              const result = await updateCalendarEventFull(eventId, extraUpdates);
              if (!result.success) {
                toast.showError(result.error ?? '일정 부가 정보 저장에 실패했습니다.');
                return;
              }
            }
          }

          toast.showSuccess('일정이 생성되었습니다.');
          if (opts.onSuccessModal) opts.onSuccessModal();
          else router.push(opts.returnPath);
        } catch {
          toast.showError('일정 생성 중 오류가 발생했습니다.');
        }
      });
    } else {
      // Non-recurring edit
      startSaveTransition(async () => {
        const updates = buildUpdates();
        const result = await updateCalendarEventFull(opts.eventId!, updates);
        if (result.success) {
          toast.showSuccess('일정이 수정되었습니다.');
          if (opts.onSuccessModal) opts.onSuccessModal();
          else router.push(opts.returnPath);
        } else {
          toast.showError(result.error ?? '수정에 실패했습니다.');
        }
      });
    }
  }, [form, opts, isRecurring, resolvedEntityType, buildUpdates, router, toast]);

  const handleDelete = useCallback(async () => {
    // 상담 이벤트: 전용 삭제 로직
    if (resolvedEntityType === 'consultation') {
      startDeleteTransition(async () => {
        try {
          const { deleteConsultationSchedule } = await import('@/lib/domains/consulting/actions/schedule');
          const result = await deleteConsultationSchedule({
            scheduleId: opts.eventId!,
            studentId: opts.studentId,
          });
          if (result.success) {
            toast.showSuccess('상담 일정이 삭제되었습니다.');
            if (opts.onSuccessModal) opts.onSuccessModal();
            else router.push(opts.returnPath);
          } else {
            toast.showError(result.error ?? '삭제에 실패했습니다.');
          }
        } catch {
          toast.showError('상담 일정 삭제 중 오류가 발생했습니다.');
        }
      });
      return;
    }

    if (isRecurring) {
      setNeedsRecurringScope('delete');
      return;
    }

    startDeleteTransition(async () => {
      const result = await deletePlan({ planId: opts.eventId! });
      if (result.success) {
        toast.showSuccess('일정이 삭제되었습니다.');
        if (opts.onSuccessModal) opts.onSuccessModal();
        else router.push(opts.returnPath);
      } else {
        toast.showError(result.error ?? '삭제에 실패했습니다.');
      }
    });
  }, [resolvedEntityType, isRecurring, opts, router, toast]);

  const handleRecurringScopeSelect = useCallback(async (scope: RecurringScope) => {
    const eventId = opts.eventId!;
    const instanceDate = opts.instanceDate ?? form.date;

    if (needsRecurringScope === 'delete') {
      startDeleteTransition(async () => {
        const result = await deleteRecurringEvent({ eventId, scope, instanceDate });
        setNeedsRecurringScope(null);
        if (result.success) {
          toast.showSuccess('일정이 삭제되었습니다.');
          if (opts.onSuccessModal) opts.onSuccessModal();
          else router.push(opts.returnPath);
        } else {
          toast.showError(result.error ?? '삭제에 실패했습니다.');
        }
      });
    } else if (needsRecurringScope === 'save') {
      startSaveTransition(async () => {
        const updates = buildUpdates();
        // Convert CalendarEventFullUpdate to Record<string, unknown> for recurring API
        const rawUpdates: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(updates)) {
          rawUpdates[key] = val;
        }
        const result = await updateRecurringEvent({ eventId, scope, instanceDate, updates: rawUpdates });
        setNeedsRecurringScope(null);
        if (result.success) {
          toast.showSuccess('일정이 수정되었습니다.');
          if (opts.onSuccessModal) opts.onSuccessModal();
          else router.push(opts.returnPath);
        } else {
          toast.showError(result.error ?? '수정에 실패했습니다.');
        }
      });
    }
  }, [opts, form.date, needsRecurringScope, buildUpdates, router, toast]);

  const cancelRecurringScope = useCallback(() => {
    setNeedsRecurringScope(null);
  }, []);

  return {
    form,
    setField,
    setLabel,
    isDirty,
    isLoading,
    isSaving,
    isDeleting,
    handleSave,
    handleDelete,
    isRecurring,
    needsRecurringScope,
    handleRecurringScopeSelect,
    cancelRecurringScope,
    originalData,
    resolvedEntityType,
  };
}
