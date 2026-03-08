'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/ToastProvider';
import { createCalendarAction } from '@/lib/domains/calendar/actions/calendars';
import { calendarEventKeys } from '@/lib/query-options/calendarEvents';
import { EVENT_COLOR_PALETTE } from '@/app/(admin)/admin/students/[id]/plans/_components/utils/eventColors';
import { EventEditTopBar } from '@/app/(admin)/admin/students/[id]/plans/event/_components/EventEditTopBar';

interface Props {
  studentId: string;
  studentName: string;
  tenantId: string;
}

export function CalendarCreatePage({ studentId, studentName, tenantId }: Props) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [isSaving, startSave] = useTransition();

  const returnPath = `/admin/students/${studentId}/plans`;

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  const isDirty =
    name.trim().length > 0 ||
    description.length > 0 ||
    selectedColor !== null;

  const handleClose = () => {
    if (isDirty) {
      const confirmed = window.confirm('변경사항이 저장되지 않았습니다. 나가시겠습니까?');
      if (!confirmed) return;
    }
    router.push(returnPath);
  };

  const handleSave = () => {
    if (!name.trim()) {
      showError('캘린더 이름을 입력해주세요.');
      return;
    }

    startSave(async () => {
      try {
        const result = await createCalendarAction({
          studentId,
          tenantId,
          summary: name.trim(),
          color: selectedColor ?? undefined,
          description: description.trim() || undefined,
        });

        await queryClient.invalidateQueries({
          queryKey: calendarEventKeys.studentCalendars(studentId),
        });

        showSuccess('캘린더가 생성되었습니다.');
        router.push(`/admin/students/${studentId}/plans/calendar/${result.calendarId}`);
      } catch {
        showError('캘린더 생성 중 오류가 발생했습니다.');
      }
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <EventEditTopBar
        mode="new"
        heading="새 캘린더"
        isDirty={isDirty}
        isSaving={isSaving}
        isDeleting={false}
        onClose={handleClose}
        onSave={handleSave}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
          {/* 학생 정보 */}
          <p className="mb-6 text-sm text-gray-500">
            {studentName} 학생의 새 캘린더를 만듭니다.
          </p>

          {/* 캘린더 이름 */}
          <div className="mb-6">
            <label htmlFor="cal-name" className="mb-1.5 block text-sm font-medium text-gray-700">
              캘린더 이름 <span className="text-red-500">*</span>
            </label>
            <input
              id="cal-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 수학 학습, 개인 일정"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* 설명 */}
          <div className="mb-6">
            <label htmlFor="cal-desc" className="mb-1.5 block text-sm font-medium text-gray-700">
              설명
            </label>
            <textarea
              id="cal-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="캘린더에 대한 간단한 설명 (선택사항)"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* 색상 선택 */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              색상
            </label>
            <div className="grid grid-cols-6 gap-2">
              {EVENT_COLOR_PALETTE.slice(0, 24).map((c) => {
                const isSelected = selectedColor === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    title={c.label}
                    onClick={() => setSelectedColor(isSelected ? null : c.key)}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110',
                      isSelected && 'ring-2 ring-offset-2 ring-gray-400',
                    )}
                    style={{ backgroundColor: c.hex }}
                  >
                    {isSelected && (
                      <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M4 8l3 3 5-5"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
            {!selectedColor && (
              <p className="mt-1.5 text-xs text-gray-400">
                선택하지 않으면 기본 색상이 적용됩니다.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
