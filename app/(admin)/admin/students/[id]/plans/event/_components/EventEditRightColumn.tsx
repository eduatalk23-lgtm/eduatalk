'use client';

import { BookOpen, Clock, Tag, Bell } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  SESSION_TYPE_PRESETS,
  NOTIFICATION_TARGETS,
  NOTIFICATION_TARGET_LABELS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_CHANNEL_LABELS,
  type NotificationTarget,
} from '@/lib/domains/consulting/types';
import type { ConsultationPanelData } from '@/lib/domains/consulting/actions/fetchConsultationData';
import type { EventEditFormState } from './useEventEditForm';

const inputCls = 'rounded-lg border border-[rgb(var(--color-secondary-300))] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

const PHONE_KEY_MAP: Record<NotificationTarget, 'student' | 'mother' | 'father'> = {
  student: 'student',
  mother: 'mother',
  father: 'father',
};

interface EventEditRightColumnProps {
  form: EventEditFormState;
  setField: <K extends keyof EventEditFormState>(key: K, value: EventEditFormState[K]) => void;
  /** 엔티티 타입 (상담 모드에서 다른 UI 렌더링) */
  entityType?: 'event' | 'consultation';
  /** 상담 데이터 (phoneAvailability 등) */
  consultationData?: ConsultationPanelData | null;
}

export function EventEditRightColumn({ form, setField, entityType = 'event', consultationData }: EventEditRightColumnProps) {
  // 상담 모드: 상담 유형 + 알림 대상/채널
  if (entityType === 'consultation') {
    const phoneAvailability = consultationData?.phoneAvailability ?? { student: false, mother: false, father: false };

    return (
      <div className="flex flex-col gap-4">
        {/* 상담 유형 프리셋 */}
        <Section icon={<Tag className="h-5 w-5" />}>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              {SESSION_TYPE_PRESETS.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setField('sessionType', type)}
                  className={cn(
                    'px-2.5 py-1.5 text-xs rounded-full border transition-colors',
                    form.sessionType === type
                      ? 'font-medium border-transparent text-white bg-violet-500'
                      : 'border-[rgb(var(--color-secondary-200))] text-[var(--text-tertiary)] hover:border-[rgb(var(--color-secondary-300))]',
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
            {/* 직접 입력 */}
            {!SESSION_TYPE_PRESETS.includes(form.sessionType as typeof SESSION_TYPE_PRESETS[number]) && form.sessionType && (
              <span className="text-xs text-[var(--text-tertiary)]">
                커스텀: &quot;{form.sessionType}&quot;
              </span>
            )}
          </div>
        </Section>

        {/* 알림 대상 + 채널 */}
        <Section icon={<Bell className="h-5 w-5" />}>
          <div className="flex flex-col gap-3">
            {/* 알림 대상 */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[var(--text-secondary)]">알림 대상</span>
              <div className="flex flex-wrap gap-3">
                {NOTIFICATION_TARGETS.map((target) => {
                  const hasPhone = phoneAvailability[PHONE_KEY_MAP[target]];
                  return (
                    <label
                      key={target}
                      className={cn(
                        'flex items-center gap-1.5',
                        !hasPhone && 'cursor-not-allowed opacity-50',
                      )}
                      title={!hasPhone ? '등록된 연락처가 없습니다' : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={form.notificationTargets.includes(target)}
                        disabled={!hasPhone}
                        onChange={() => {
                          const prev = form.notificationTargets;
                          setField(
                            'notificationTargets',
                            prev.includes(target)
                              ? prev.filter((t) => t !== target)
                              : [...prev, target],
                          );
                        }}
                        className="h-3.5 w-3.5 rounded border-[rgb(var(--color-secondary-300))] text-violet-600 focus:ring-violet-500 disabled:cursor-not-allowed"
                      />
                      <span className="text-xs text-[var(--text-secondary)]">
                        {NOTIFICATION_TARGET_LABELS[target]}
                      </span>
                      {!hasPhone && (
                        <span className="text-[10px] text-red-500">연락처 없음</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 발송 채널 */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[var(--text-secondary)]">발송 채널</span>
              <div className="flex gap-3">
                {NOTIFICATION_CHANNELS.map((ch) => (
                  <label key={ch} className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="notification_channel_edit"
                      checked={form.notificationChannel === ch}
                      onChange={() => setField('notificationChannel', ch)}
                      disabled={form.notificationTargets.length === 0}
                      className="h-3.5 w-3.5 border-[rgb(var(--color-secondary-300))] text-violet-600 focus:ring-violet-500 disabled:cursor-not-allowed"
                    />
                    <span className="text-xs text-[var(--text-secondary)]">
                      {NOTIFICATION_CHANNEL_LABELS[ch]}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Section>
      </div>
    );
  }

  if (!form.hasStudyData) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Page Range */}
      <Section icon={<BookOpen className="h-5 w-5" />}>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="block text-xs text-[var(--text-tertiary)] pb-1">시작 p.</label>
            <input
              type="number"
              value={form.plannedStartPage ?? ''}
              onChange={(e) => setField('plannedStartPage', e.target.value ? Number(e.target.value) : null)}
              placeholder="—"
              min={0}
              className={cn(inputCls, 'w-full')}
            />
          </div>
          <span className="pt-5 text-[var(--text-tertiary)]">~</span>
          <div className="flex-1">
            <label className="block text-xs text-[var(--text-tertiary)] pb-1">종료 p.</label>
            <input
              type="number"
              value={form.plannedEndPage ?? ''}
              onChange={(e) => setField('plannedEndPage', e.target.value ? Number(e.target.value) : null)}
              placeholder="—"
              min={0}
              className={cn(inputCls, 'w-full')}
            />
          </div>
        </div>
      </Section>

      {/* Estimated Minutes */}
      <Section icon={<Clock className="h-5 w-5" />}>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={form.estimatedMinutes ?? ''}
            onChange={(e) => setField('estimatedMinutes', e.target.value ? Number(e.target.value) : null)}
            placeholder="60"
            min={0}
            step={5}
            className={cn(inputCls, 'w-24')}
          />
          <span className="text-sm text-[var(--text-tertiary)]">분</span>
        </div>
      </Section>

      {/* Content Info (read-only when exists) */}
      {form.contentTitle && (
        <Section icon={<BookOpen className="h-5 w-5" />}>
          <div className="rounded-lg bg-[rgb(var(--color-secondary-100))] p-3">
            <p className="text-sm text-[var(--text-primary)]">{form.contentTitle}</p>
            {form.contentType && (
              <p className="text-xs text-[var(--text-tertiary)] pt-1">
                유형: {form.contentType === 'book' ? '교재' : form.contentType === 'lecture' ? '강의' : form.contentType}
              </p>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2 items-start">
      <div className="shrink-0 w-8 flex justify-center mt-1 text-[var(--text-tertiary)]">{icon}</div>
      <div className="flex-1 min-w-0 text-left">{children}</div>
    </div>
  );
}
