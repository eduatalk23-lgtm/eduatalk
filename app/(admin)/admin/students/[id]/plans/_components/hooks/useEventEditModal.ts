'use client';

import { useState, useCallback, useMemo } from 'react';

export interface EventEditModalState {
  isOpen: boolean;
  mode: 'new' | 'edit';
  eventId?: string;
  calendarId?: string;
  initialDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  initialSubject?: string;
  instanceDate?: string;
}

const CLOSED_STATE: EventEditModalState = { isOpen: false, mode: 'new' };

interface OpenNewParams {
  calendarId?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  subject?: string;
}

interface OpenEditParams {
  eventId: string;
  calendarId?: string;
  instanceDate?: string;
}

export function useEventEditModal() {
  const [state, setState] = useState<EventEditModalState>(CLOSED_STATE);

  const openNew = useCallback((params: OpenNewParams) => {
    setState({
      isOpen: true,
      mode: 'new',
      calendarId: params.calendarId,
      initialDate: params.date,
      initialStartTime: params.startTime,
      initialEndTime: params.endTime,
      initialSubject: params.subject,
    });
  }, []);

  const openEdit = useCallback((params: OpenEditParams) => {
    setState({
      isOpen: true,
      mode: 'edit',
      eventId: params.eventId,
      calendarId: params.calendarId,
      instanceDate: params.instanceDate,
    });
  }, []);

  const close = useCallback(() => {
    setState(CLOSED_STATE);
  }, []);

  return useMemo(() => ({ state, openNew, openEdit, close }), [state, openNew, openEdit, close]);
}
