'use client';

import { useState, useCallback, useMemo } from 'react';
import type { ConsultationMode } from '@/lib/domains/consulting/types';

export type EventEditEntityType = 'event' | 'consultation';

export interface EventEditModalState {
  isOpen: boolean;
  mode: 'new' | 'edit';
  /** 엔티티 타입: 일정/학습 vs 상담 (GCal 패턴: 탭 선택 후 Full Edit 진입) */
  entityType: EventEditEntityType;
  eventId?: string;
  calendarId?: string;
  initialDate?: string;
  /** 종료 날짜 (multi-day 이벤트) */
  initialEndDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  initialSubject?: string;
  /** 라벨 초기값 (QuickCreate에서 전달) */
  initialLabel?: string;
  instanceDate?: string;
  /** 상담 전용: 대상 학생 ID (personal mode에서 전달) */
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
  /** 반복 규칙 초기값 */
  initialRrule?: string | null;
}

const CLOSED_STATE: EventEditModalState = { isOpen: false, mode: 'new', entityType: 'event' };

interface OpenNewParams {
  calendarId?: string;
  date?: string;
  /** 종료 날짜 (multi-day 이벤트) */
  endDate?: string;
  startTime?: string;
  endTime?: string;
  subject?: string;
  /** 라벨 초기값 */
  label?: string;
  /** 상담 모드로 열기 */
  entityType?: EventEditEntityType;
  /** 상담 전용 초기값 */
  consultationStudentId?: string;
  consultationSessionType?: string;
  consultationMode?: ConsultationMode;
  /** QuickCreate에서 전달된 초기값 */
  title?: string;
  description?: string;
  meetingLink?: string;
  visitor?: string;
  /** 반복 규칙 */
  rrule?: string | null;
}

interface OpenEditParams {
  eventId: string;
  calendarId?: string;
  instanceDate?: string;
  /** 편집 시 엔티티 타입 (상담 이벤트 클릭 시) */
  entityType?: EventEditEntityType;
}

export function useEventEditModal() {
  const [state, setState] = useState<EventEditModalState>(CLOSED_STATE);

  const openNew = useCallback((params: OpenNewParams) => {
    setState({
      isOpen: true,
      mode: 'new',
      entityType: params.entityType ?? 'event',
      calendarId: params.calendarId,
      initialDate: params.date,
      initialEndDate: params.endDate,
      initialStartTime: params.startTime,
      initialEndTime: params.endTime,
      initialSubject: params.subject,
      initialLabel: params.label,
      consultationStudentId: params.consultationStudentId,
      consultationSessionType: params.consultationSessionType,
      consultationMode: params.consultationMode,
      initialTitle: params.title,
      initialDescription: params.description,
      initialMeetingLink: params.meetingLink,
      initialVisitor: params.visitor,
      initialRrule: params.rrule,
    });
  }, []);

  const openEdit = useCallback((params: OpenEditParams) => {
    setState({
      isOpen: true,
      mode: 'edit',
      entityType: params.entityType ?? 'event',
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
