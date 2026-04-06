'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { studentCalendarsQueryOptions } from '@/lib/query-options/calendarEvents';
import { RecurringEditChoiceModal } from '../../_components/modals/RecurringEditChoiceModal';
import { RecurringRemoveConfirmModal } from '../../_components/modals/RecurringRemoveConfirmModal';
import { useEventEditForm } from './useEventEditForm';
import { EventEditTopBar } from './EventEditTopBar';
import { EventEditLeftColumn, type CalendarOption } from './EventEditLeftColumn';
import { EventEditRightColumn } from './EventEditRightColumn';
import type { EventEditEntityType } from '../../_components/hooks/useEventEditModal';
import type { ConsultationMode } from '@/lib/domains/consulting/types';
import { fetchConsultationData, type ConsultationPanelData } from '@/lib/domains/consulting/actions/fetchConsultationData';

interface EventEditPageProps {
  mode: 'new' | 'edit';
  /** 엔티티 타입: 일정/학습 vs 상담 */
  entityType?: EventEditEntityType;
  studentId: string;
  eventId?: string;
  calendarId?: string;
  initialDate?: string;
  /** 종료 날짜 초기값 (multi-day 이벤트) */
  initialEndDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  initialSubject?: string;
  /** 라벨 초기값 */
  initialLabel?: string;
  /** 반복 규칙 초기값 */
  initialRrule?: string | null;
  instanceDate?: string;
  /** 상담 전용: 대상 학생 ID */
  consultationStudentId?: string;
  /** 상담 전용: 상담 유형 초기값 */
  consultationSessionType?: string;
  /** 상담 전용: 상담 방식 초기값 */
  consultationMode?: ConsultationMode;
  /** QuickCreate에서 전달된 초기값 */
  initialTitle?: string;
  initialDescription?: string;
  initialMeetingLink?: string;
  initialVisitor?: string;
  /** 모달 모드: 닫기 콜백 (있으면 router.push 대신 호출) */
  onCloseModal?: () => void;
  /** 모달 모드: 저장/삭제 성공 후 콜백 */
  onSuccessModal?: () => void;
}

export function EventEditPage({
  mode,
  entityType = 'event',
  studentId,
  eventId,
  calendarId,
  initialDate,
  initialEndDate,
  initialStartTime,
  initialEndTime,
  initialSubject,
  initialLabel,
  initialRrule,
  instanceDate,
  consultationStudentId,
  consultationSessionType,
  consultationMode: initialConsultationMode,
  initialTitle,
  initialDescription,
  initialMeetingLink,
  initialVisitor,
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
    needsRecurrenceRemoveConfirm,
    handleRecurrenceRemoveConfirm,
    cancelRecurrenceRemoveConfirm,
    exceptionCount,
    resolvedEntityType,
  } = useEventEditForm({
    mode,
    entityType,
    studentId,
    eventId,
    calendarId,
    initialDate,
    initialEndDate,
    initialStartTime,
    initialEndTime,
    initialSubject,
    initialLabel,
    initialRrule,
    returnPath,
    instanceDate,
    onSuccessModal,
    // 상담 전용 초기값
    consultationStudentId,
    consultationSessionType,
    consultationMode: initialConsultationMode,
    // QuickCreate에서 전달된 초기값
    initialTitle,
    initialDescription,
    initialMeetingLink,
    initialVisitor,
  });

  const isConsultation = resolvedEntityType === 'consultation';

  // 상담 모드: 상담 데이터 fetch (consultants, enrollments, phoneAvailability)
  const [consultationData, setConsultationData] = useState<ConsultationPanelData | null>(null);
  const [isConsultationDataLoading, startConsultationLoad] = useTransition();

  // 상담 데이터 fetch를 위한 학생 ID: form.consultationStudentId → props → current studentId
  const consultationTargetStudentId = form.consultationStudentId || consultationStudentId || studentId;

  useEffect(() => {
    if (!isConsultation) return;
    startConsultationLoad(async () => {
      const data = await fetchConsultationData(consultationTargetStudentId);
      setConsultationData(data);
      // 기본 컨설턴트: 현재 로그인 사용자 (new 모드에서만, 아직 미설정 시)
      if (mode === 'new' && data.currentUserId && !form.consultantId) {
        setField('consultantId', data.currentUserId);
      }
      // 기본 알림 대상: 어머니 연락처가 있으면 자동 선택 (new 모드에서만, 아직 미설정 시)
      if (mode === 'new' && data.phoneAvailability.mother && form.notificationTargets.length === 0) {
        setField('notificationTargets', ['mother']);
      }
    });
  // consultationTargetStudentId: 학생 선택 변경 시 재로드
  // isConsultation: entityType auto-detect 후 첫 로드
  // mode: new/edit 분기에만 사용 (stable)
  // form.consultantId, form.notificationTargets: 초기값 설정 조건에만 사용하므로 의존성 제외
  }, [isConsultation, consultationTargetStudentId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
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
          isAllDay: isConsultation ? false : form.isAllDay,
          rrule: isConsultation ? null : form.rrule,
          onDateChange: (v) => setField('date', v),
          onEndDateChange: (v) => setField('endDate', v),
          onStartTimeChange: (v) => setField('startTime', v),
          onEndTimeChange: (v) => setField('endTime', v),
          onAllDayChange: isConsultation ? () => {} : (v) => setField('isAllDay', v),
          onRruleChange: isConsultation ? () => {} : (v) => setField('rrule', v),
          hideAllDayAndRecurrence: isConsultation,
        }}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl px-4 py-4 sm:px-6 lg:px-8">
          {isConsultation ? (
            <div className="relative">
              {/* 로딩 오버레이 — 컴포넌트는 유지하여 로컬 state 보존 */}
              {isConsultationDataLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center gap-3 bg-[var(--background)]/80 rounded-lg">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                  <span className="text-sm text-[var(--text-tertiary)]">상담 데이터 로딩 중...</span>
                </div>
              )}
              {isMobile ? (
                <div className="flex flex-col gap-5">
                  <EventEditLeftColumn
                    form={form}
                    setField={setField}
                    setLabel={setLabel}
                    calendars={calendarOptions}
                    entityType={resolvedEntityType}
                    consultationData={consultationData}
                  />
                  <EventEditRightColumn form={form} setField={setField} entityType={resolvedEntityType} consultationData={consultationData} />
                </div>
              ) : (
                <div className="flex gap-6">
                  <div className="flex-[3] min-w-0">
                    <EventEditLeftColumn
                      form={form}
                      setField={setField}
                      setLabel={setLabel}
                      calendars={calendarOptions}
                      entityType={resolvedEntityType}
                      consultationData={consultationData}
                    />
                  </div>
                  <div className="w-px bg-[rgb(var(--color-secondary-200))]" />
                  <div className="flex-[2] min-w-0">
                    <EventEditRightColumn form={form} setField={setField} entityType={resolvedEntityType} consultationData={consultationData} />
                  </div>
                </div>
              )}
            </div>
          ) : isMobile ? (
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

      {/* Recurrence removal confirmation modal */}
      {needsRecurrenceRemoveConfirm && (
        <RecurringRemoveConfirmModal
          isOpen
          onClose={cancelRecurrenceRemoveConfirm}
          onConfirm={handleRecurrenceRemoveConfirm}
          exceptionCount={exceptionCount}
          isProcessing={isSaving}
        />
      )}
    </div>
  );
}
