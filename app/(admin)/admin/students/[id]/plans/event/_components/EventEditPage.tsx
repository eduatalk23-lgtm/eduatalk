'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { studentCalendarsQueryOptions } from '@/lib/query-options/calendarEvents';
import { RecurringEditChoiceModal } from '../../_components/modals/RecurringEditChoiceModal';
import { useEventEditForm } from './useEventEditForm';
import { EventEditTopBar } from './EventEditTopBar';
import { EventEditLeftColumn, type CalendarOption } from './EventEditLeftColumn';
import { EventEditRightColumn } from './EventEditRightColumn';

interface EventEditPageProps {
  mode: 'new' | 'edit';
  studentId: string;
  eventId?: string;
  calendarId?: string;
  initialDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  initialSubject?: string;
  instanceDate?: string;
  /** 모달 모드: 닫기 콜백 (있으면 router.push 대신 호출) */
  onCloseModal?: () => void;
  /** 모달 모드: 저장/삭제 성공 후 콜백 */
  onSuccessModal?: () => void;
}

export function EventEditPage({
  mode,
  studentId,
  eventId,
  calendarId,
  initialDate,
  initialStartTime,
  initialEndTime,
  initialSubject,
  instanceDate,
  onCloseModal,
  onSuccessModal,
}: EventEditPageProps) {
  const router = useRouter();
  const isMobile = useIsMobile();

  // 캘린더 목록 조회 (캘린더 선택 드롭다운용)
  const { data: allCalendars = [] } = useQuery({
    ...studentCalendarsQueryOptions(studentId),
    enabled: !!studentId,
  });
  const calendarOptions: CalendarOption[] = allCalendars.map((c) => ({
    id: c.id,
    summary: c.summary ?? '캘린더',
    defaultColor: c.default_color ?? null,
  }));

  const returnPath = calendarId
    ? `/admin/students/${studentId}/plans/calendar/${calendarId}`
    : `/admin/students/${studentId}/plans`;

  const {
    form,
    setField,
    setLabel,
    isDirty,
    isLoading,
    isSaving,
    isDeleting,
    handleSave,
    handleDelete,
    needsRecurringScope,
    handleRecurringScopeSelect,
    cancelRecurringScope,
  } = useEventEditForm({
    mode,
    studentId,
    eventId,
    calendarId,
    initialDate,
    initialStartTime,
    initialEndTime,
    initialSubject,
    returnPath,
    instanceDate,
    onSuccessModal,
  });

  const handleClose = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm('변경사항이 저장되지 않았습니다. 나가시겠습니까?');
      if (!confirmed) return;
    }
    if (onCloseModal) {
      onCloseModal();
    } else {
      router.push(returnPath);
    }
  }, [isDirty, onCloseModal, router, returnPath]);

  // U-12: Cmd+Enter → save, Esc → close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleSave, handleClose]);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[rgb(var(--background))]">
      <EventEditTopBar
        mode={mode}
        isDirty={isDirty}
        isSaving={isSaving}
        isDeleting={isDeleting}
        onClose={handleClose}
        onSave={handleSave}
        onDelete={mode === 'edit' ? handleDelete : undefined}
        title={form.title}
        onTitleChange={(v) => setField('title', v)}
        dateTime={{
          date: form.date,
          endDate: form.endDate,
          startTime: form.startTime,
          endTime: form.endTime,
          isAllDay: form.isAllDay,
          rrule: form.rrule,
          onDateChange: (v) => setField('date', v),
          onEndDateChange: (v) => setField('endDate', v),
          onStartTimeChange: (v) => setField('startTime', v),
          onEndTimeChange: (v) => setField('endTime', v),
          onAllDayChange: (v) => setField('isAllDay', v),
          onRruleChange: (v) => setField('rrule', v),
        }}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl px-4 py-4 sm:px-6 lg:px-8">
          {isMobile ? (
            /* Mobile: single column */
            <div className="flex flex-col gap-5">
              <EventEditLeftColumn form={form} setField={setField} setLabel={setLabel} calendars={calendarOptions} />
              <EventEditRightColumn form={form} setField={setField} />
            </div>
          ) : (
            /* Desktop: 2 columns — GCal 비율 */
            <div className="flex gap-6">
              <div className="flex-[3] min-w-0">
                <EventEditLeftColumn form={form} setField={setField} setLabel={setLabel} calendars={calendarOptions} />
              </div>
              {form.hasStudyData && (
                <div className="w-px bg-[rgb(var(--color-secondary-200))]" />
              )}
              <div className="flex-[2] min-w-0">
                <EventEditRightColumn form={form} setField={setField} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recurring scope modal */}
      {needsRecurringScope && (
        <RecurringEditChoiceModal
          isOpen
          onClose={cancelRecurringScope}
          mode={needsRecurringScope === 'save' ? 'edit' : 'delete'}
          onSelect={handleRecurringScopeSelect}
        />
      )}
    </div>
  );
}
