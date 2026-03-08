'use client';

import { BookOpen, Clock } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { EventEditFormState } from './useEventEditForm';

const inputCls = 'rounded-lg border border-[rgb(var(--color-secondary-300))] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

interface EventEditRightColumnProps {
  form: EventEditFormState;
  setField: <K extends keyof EventEditFormState>(key: K, value: EventEditFormState[K]) => void;
}

export function EventEditRightColumn({ form, setField }: EventEditRightColumnProps) {
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
