'use client';

import { createPortal } from 'react-dom';
import type { EventEditModalState } from '../hooks/useEventEditModal';
import { EventEditPage } from '../../event/_components/EventEditPage';

interface EventEditModalProps {
  state: EventEditModalState;
  studentId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function EventEditModal({ state, studentId, onClose, onSuccess }: EventEditModalProps) {
  if (!state.isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-[var(--background)] overflow-auto">
      <EventEditPage
        mode={state.mode}
        entityType={state.entityType}
        studentId={studentId}
        eventId={state.eventId}
        calendarId={state.calendarId}
        initialDate={state.initialDate}
        initialEndDate={state.initialEndDate}
        initialStartTime={state.initialStartTime}
        initialEndTime={state.initialEndTime}
        initialSubject={state.initialSubject}
        initialLabel={state.initialLabel}
        initialRrule={state.initialRrule}
        instanceDate={state.instanceDate}
        consultationStudentId={state.consultationStudentId}
        consultationSessionType={state.consultationSessionType}
        consultationMode={state.consultationMode}
        initialTitle={state.initialTitle}
        initialDescription={state.initialDescription}
        initialMeetingLink={state.initialMeetingLink}
        initialVisitor={state.initialVisitor}
        onCloseModal={onClose}
        onSuccessModal={onSuccess}
      />
    </div>,
    document.body
  );
}
