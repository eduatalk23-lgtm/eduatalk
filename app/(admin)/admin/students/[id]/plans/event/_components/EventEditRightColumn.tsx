'use client';

import { BookOpen, Timer } from 'lucide-react';
import type { EventEditFormState } from './useEventEditForm';

interface EventEditRightColumnProps {
  form: EventEditFormState;
  setField: <K extends keyof EventEditFormState>(key: K, value: EventEditFormState[K]) => void;
}

export function EventEditRightColumn({ form, setField }: EventEditRightColumnProps) {
  if (form.eventType !== 'study') {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-gray-400">
        <BookOpen className="h-8 w-8 opacity-30" />
        <span className="text-sm">학습 타입에서만 상세 설정 가능</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page Range */}
      <Section icon={<BookOpen className="h-5 w-5" />} label="학습 범위">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-gray-500">시작 p.</label>
            <input
              type="number"
              value={form.plannedStartPage ?? ''}
              onChange={(e) => setField('plannedStartPage', e.target.value ? Number(e.target.value) : null)}
              placeholder="—"
              min={0}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <span className="mt-5 text-gray-400">~</span>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-gray-500">종료 p.</label>
            <input
              type="number"
              value={form.plannedEndPage ?? ''}
              onChange={(e) => setField('plannedEndPage', e.target.value ? Number(e.target.value) : null)}
              placeholder="—"
              min={0}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>
      </Section>

      {/* Estimated Minutes */}
      <Section icon={<Timer className="h-5 w-5" />} label="예상 시간">
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={form.estimatedMinutes ?? ''}
            onChange={(e) => setField('estimatedMinutes', e.target.value ? Number(e.target.value) : null)}
            placeholder="60"
            min={0}
            step={5}
            className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-sm text-gray-500">분</span>
        </div>
      </Section>

      {/* Content Info (read-only when exists) */}
      {form.contentTitle && (
        <Section icon={<BookOpen className="h-5 w-5" />} label="콘텐츠 정보">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-sm text-gray-700">{form.contentTitle}</p>
            {form.contentType && (
              <p className="mt-1 text-xs text-gray-500">
                유형: {form.contentType === 'book' ? '교재' : form.contentType === 'lecture' ? '강의' : form.contentType}
              </p>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

// ============================================
// Section wrapper
// ============================================

function Section({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 pt-2 text-gray-400">{icon}</div>
      <div className="flex-1">
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
          {label}
        </label>
        {children}
      </div>
    </div>
  );
}
