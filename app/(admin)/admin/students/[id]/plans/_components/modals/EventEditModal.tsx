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
    <div className="fixed inset-0 z-[9999] bg-white overflow-auto">
      <EventEditPage
        mode={state.mode}
        studentId={studentId}
        eventId={state.eventId}
        calendarId={state.calendarId}
        initialDate={state.initialDate}
        initialStartTime={state.initialStartTime}
        initialEndTime={state.initialEndTime}
        initialSubject={state.initialSubject}
        instanceDate={state.instanceDate}
        onCloseModal={onClose}
        onSuccessModal={onSuccess}
      />
    </div>,
    document.body
  );
}
