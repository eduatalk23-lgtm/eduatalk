'use client';

import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { RecurringEditChoiceModal } from '../../_components/modals/RecurringEditChoiceModal';
import { useEventEditForm } from './useEventEditForm';
import { EventEditTopBar } from './EventEditTopBar';
import { EventEditLeftColumn } from './EventEditLeftColumn';
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

  const handleClose = () => {
    if (isDirty) {
      const confirmed = window.confirm('변경사항이 저장되지 않았습니다. 나가시겠습니까?');
      if (!confirmed) return;
    }
    if (onCloseModal) {
      onCloseModal();
    } else {
      router.push(returnPath);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <EventEditTopBar
        mode={mode}
        isDirty={isDirty}
        isSaving={isSaving}
        isDeleting={isDeleting}
        onClose={handleClose}
        onSave={handleSave}
        onDelete={mode === 'edit' ? handleDelete : undefined}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          {isMobile ? (
            /* Mobile: single column stack */
            <div className="flex flex-col gap-8">
              <EventEditLeftColumn form={form} setField={setField} setLabel={setLabel} />
              <EventEditRightColumn form={form} setField={setField} />
            </div>
          ) : (
            /* Desktop: 2 columns */
            <div className="flex gap-8">
              <div className="flex-[3] min-w-0">
                <EventEditLeftColumn form={form} setField={setField} setLabel={setLabel} />
              </div>
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
