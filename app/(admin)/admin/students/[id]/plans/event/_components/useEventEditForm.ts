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
import type { EventType } from '@/lib/domains/calendar/types';
import { extractTimeHHMM, extractDateYMD } from '@/lib/domains/calendar/adapters';

// ============================================
// Types
// ============================================

export type ManualEventType = 'study' | 'focus_time' | 'custom' | 'break';

export interface EventEditFormState {
  title: string;
  description: string;
  color: string | null;
  date: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  rrule: string | null;
  reminderMinutes: number | null;
  eventType: ManualEventType;
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
}

interface UseEventEditFormOptions {
  mode: 'new' | 'edit';
  studentId: string;
  eventId?: string;
  calendarId?: string;
  // Initial values for new mode (from searchParams)
  initialDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  initialSubject?: string;
  initialEventType?: ManualEventType;
  returnPath: string;
  instanceDate?: string;
  /** 모달 모드: 저장/삭제 성공 후 콜백 (있으면 router.push 대신 호출) */
  onSuccessModal?: () => void;
}

export interface UseEventEditFormReturn {
  form: EventEditFormState;
  setField: <K extends keyof EventEditFormState>(key: K, value: EventEditFormState[K]) => void;
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
  return {
    title: '',
    description: '',
    color: null,
    date: opts.initialDate ?? today,
    startTime: opts.initialStartTime ?? '09:00',
    endTime: opts.initialEndTime ?? '10:00',
    isAllDay: false,
    rrule: null,
    reminderMinutes: null,
    eventType: opts.initialEventType ?? 'study',
    subject: opts.initialSubject ?? '',
    status: 'confirmed',
    containerType: 'daily',
    plannedStartPage: null,
    plannedEndPage: null,
    estimatedMinutes: null,
    contentTitle: null,
    contentType: null,
  };
}

function eventDataToForm(data: CalendarEventEditData): EventEditFormState {
  const date = parseDateFromTimestamp(data.start_at, data.start_date);
  return {
    title: data.title,
    description: data.description ?? '',
    color: data.color,
    date,
    startTime: parseTimeFromTimestamp(data.start_at),
    endTime: parseTimeFromTimestamp(data.end_at),
    isAllDay: data.is_all_day ?? false,
    rrule: data.rrule,
    reminderMinutes: data.reminder_minutes?.[0] ?? null,
    eventType: (['study', 'focus_time', 'custom', 'break'].includes(data.event_type)
      ? data.event_type as ManualEventType
      : 'custom'),
    subject: data.subject_category ?? '',
    status: data.status,
    containerType: data.container_type ?? 'daily',
    plannedStartPage: data.planned_start_page,
    plannedEndPage: data.planned_end_page,
    estimatedMinutes: data.estimated_minutes,
    contentTitle: data.content_title,
    contentType: data.content_type,
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
      } else {
        toast.showError(result.error ?? '이벤트를 불러올 수 없습니다.');
        if (opts.onSuccessModal) opts.onSuccessModal();
        else router.back();
      }
      setIsLoading(false);
    })();

    return () => { cancelled = true; };
  }, [opts.mode, opts.eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const setField = useCallback(<K extends keyof EventEditFormState>(key: K, value: EventEditFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
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
    if (form.isAllDay !== initialForm.isAllDay) updates.is_all_day = form.isAllDay;
    if (form.rrule !== initialForm.rrule) updates.rrule = form.rrule;
    if (form.status !== initialForm.status) updates.status = form.status;
    if (form.containerType !== initialForm.containerType) updates.container_type = form.containerType;
    if (form.eventType !== initialForm.eventType) {
      updates.event_type = form.eventType;
      // 비학습 타입 전환 시 event_subtype 설정
      if (form.eventType === 'focus_time') updates.event_subtype = '집중 학습';
      else if (form.eventType === 'break') updates.event_subtype = '휴식';
      else if (form.eventType === 'custom') updates.event_subtype = null;
      else updates.event_subtype = form.subject || null;
    }
    // study 타입일 때만 학습 관련 필드 diff
    if (form.eventType === 'study') {
      if (form.subject !== initialForm.subject) updates.subject_category = form.subject || null;
      if (form.plannedStartPage !== initialForm.plannedStartPage) updates.planned_start_page = form.plannedStartPage;
      if (form.plannedEndPage !== initialForm.plannedEndPage) updates.planned_end_page = form.plannedEndPage;
      if (form.estimatedMinutes !== initialForm.estimatedMinutes) updates.estimated_minutes = form.estimatedMinutes;
    }

    // Reminder: convert single value to array
    const newReminder = form.reminderMinutes;
    const oldReminder = initialForm.reminderMinutes;
    if (newReminder !== oldReminder) {
      updates.reminder_minutes = newReminder != null ? [newReminder] : null;
    }

    // Time changes
    if (form.date !== initialForm.date || form.startTime !== initialForm.startTime || form.endTime !== initialForm.endTime) {
      if (form.isAllDay) {
        updates.start_date = form.date;
        updates.end_date = form.date;
        updates.start_at = null;
        updates.end_at = null;
      } else {
        updates.start_at = `${form.date}T${form.startTime}:00+09:00`;
        updates.end_at = `${form.date}T${form.endTime}:00+09:00`;
        updates.start_date = null;
        updates.end_date = null;
      }
    }

    return updates;
  }, [form, initialForm]);

  const handleSave = useCallback(async () => {
    if (!form.title.trim()) {
      toast.showError('제목을 입력해주세요.');
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
          // createCalendarEventAction throws on error
          const isStudy = form.eventType === 'study';
          const { eventId } = await createCalendarEventAction({
            calendarId: opts.calendarId!,
            title: form.title.trim(),
            planDate: form.date,
            startTime: form.isAllDay ? undefined : form.startTime,
            endTime: form.isAllDay ? undefined : form.endTime,
            isAllDay: form.isAllDay,
            subject: isStudy ? (form.subject || undefined) : undefined,
            subjectCategory: isStudy ? (form.subject || undefined) : undefined,
            rrule: form.rrule,
            eventType: form.eventType as EventType,
            eventSubtype: form.eventType === 'focus_time' ? '집중 학습'
              : form.eventType === 'break' ? '휴식'
              : form.eventType === 'custom' ? '일반'
              : undefined,
            containerType: form.containerType,
            color: form.color ?? undefined,
            reminderMinutes: form.reminderMinutes,
            description: form.description || undefined,
            estimatedMinutes: isStudy ? form.estimatedMinutes : undefined,
          });

          // Update study-specific fields not handled by create
          if (isStudy) {
            const extraUpdates: CalendarEventFullUpdate = {};
            if (form.plannedStartPage != null) extraUpdates.planned_start_page = form.plannedStartPage;
            if (form.plannedEndPage != null) extraUpdates.planned_end_page = form.plannedEndPage;
            if (Object.keys(extraUpdates).length > 0) {
              await updateCalendarEventFull(eventId, extraUpdates);
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
  }, [form, opts, isRecurring, buildUpdates, router, toast]);

  const handleDelete = useCallback(async () => {
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
  }, [isRecurring, opts, router, toast]);

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
  };
}
