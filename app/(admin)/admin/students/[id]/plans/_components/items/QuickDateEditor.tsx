'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/ToastProvider';
import { formatDateString } from '@/lib/date/calendarUtils';

interface QuickDateEditorProps {
  planId: string;

  currentDate: string;
  onSuccess?: () => void;
  className?: string;
}

export function QuickDateEditor({
  planId,
  currentDate,
  onSuccess,
  className,
}: QuickDateEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(currentDate);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (selectedDate === currentDate) {
      setIsEditing(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const table = 'student_plan' as const;

    startTransition(async () => {
      const { error } = await supabase
        .from(table)
        .update({
          plan_date: selectedDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', planId);

      if (error) {
        showError('날짜 변경 실패: ' + error.message);
        setSelectedDate(currentDate);
      } else {
        showSuccess('날짜가 변경되었습니다.');
        onSuccess?.();
      }
      setIsEditing(false);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setSelectedDate(currentDate);
      setIsEditing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getMonth() + 1}/${date.getDate()} (${days[date.getDay()]})`;
  };

  if (isEditing) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <input
          ref={inputRef}
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          disabled={isPending}
          className="px-1 py-0.5 text-xs border rounded w-28"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className={cn(
        'text-xs text-[var(--text-tertiary)] hover:text-blue-600 dark:text-blue-400 hover:underline cursor-pointer',
        className
      )}
    >
      {formatDate(currentDate)}
    </button>
  );
}

interface QuickTimeEditorProps {
  planId: string;

  currentStartTime?: string | null;
  currentEndTime?: string | null;
  onSuccess?: () => void;
  className?: string;
}

export function QuickTimeEditor({
  planId,
  currentStartTime,
  currentEndTime,
  onSuccess,
  className,
}: QuickTimeEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [startTime, setStartTime] = useState(currentStartTime ?? '');
  const [endTime, setEndTime] = useState(currentEndTime ?? '');
  const [isPending, startTransition] = useTransition();
  const { showSuccess, showError } = useToast();

  const handleSave = async () => {
    const supabase = createSupabaseBrowserClient();
    const table = 'student_plan' as const;

    startTransition(async () => {
      const { error } = await supabase
        .from(table)
        .update({
          start_time: startTime || null,
          end_time: endTime || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', planId);

      if (error) {
        showError('시간 변경 실패: ' + error.message);
      } else {
        showSuccess('시간이 변경되었습니다.');
        onSuccess?.();
      }
      setIsEditing(false);
    });
  };

  const formatTimeRange = () => {
    if (!currentStartTime && !currentEndTime) return '시간 미설정';
    if (currentStartTime && !currentEndTime) return currentStartTime.substring(0, 5);
    if (!currentStartTime && currentEndTime) return `~${currentEndTime.substring(0, 5)}`;
    return `${currentStartTime!.substring(0, 5)} - ${currentEndTime!.substring(0, 5)}`;
  };

  if (isEditing) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          disabled={isPending}
          className="px-1 py-0.5 text-xs border rounded w-20"
          placeholder="시작"
        />
        <span className="text-xs text-[var(--text-tertiary)]">~</span>
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          disabled={isPending}
          className="px-1 py-0.5 text-xs border rounded w-20"
          placeholder="종료"
        />
        <button
          onClick={handleSave}
          disabled={isPending}
          className="px-1.5 py-0.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          ✓
        </button>
        <button
          onClick={() => {
            setStartTime(currentStartTime ?? '');
            setEndTime(currentEndTime ?? '');
            setIsEditing(false);
          }}
          className="px-1.5 py-0.5 text-xs bg-[rgb(var(--color-secondary-100))] rounded hover:bg-[rgb(var(--color-secondary-200))]"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className={cn(
        'text-xs text-[var(--text-tertiary)] hover:text-blue-600 dark:text-blue-400 hover:underline cursor-pointer',
        className
      )}
    >
      {formatTimeRange()}
    </button>
  );
}

// Date picker modal for more complex date selection
interface DatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;

  currentDate: string;
  onSuccess?: () => void;
}

export function DatePickerModal({
  isOpen,
  onClose,
  planId,
  currentDate,
  onSuccess,
}: DatePickerModalProps) {
  const [selectedDate, setSelectedDate] = useState(currentDate);
  const [keepTime, setKeepTime] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { showSuccess, showError } = useToast();

  // Quick date options - computed outside of conditional
  const today = new Date();
  const quickDates = [
    { label: '오늘', date: today },
    { label: '내일', date: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
    { label: '다음 주 월요일', date: getNextMonday(today) },
    { label: '다음 달 1일', date: getFirstDayOfNextMonth(today) },
  ];

  const handleSave = async () => {
    const supabase = createSupabaseBrowserClient();
    const table = 'student_plan' as const;

    startTransition(async () => {
      const updateData: Record<string, unknown> = {
        plan_date: selectedDate,
        updated_at: new Date().toISOString(),
      };

      if (!keepTime) {
        updateData.start_time = null;
        updateData.end_time = null;
      }

      const { error } = await supabase
        .from(table)
        .update(updateData)
        .eq('id', planId);

      if (error) {
        showError('날짜 변경 실패: ' + error.message);
      } else {
        showSuccess(`${selectedDate}로 이동되었습니다.`);
        onSuccess?.();
        onClose();
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[rgb(var(--color-secondary-50))] rounded-lg shadow-xl p-6 w-80">
        <h3 className="text-lg font-semibold mb-4">날짜 변경</h3>

        {/* Quick options */}
        <div className="flex flex-wrap gap-2 mb-4">
          {quickDates.map(({ label, date }) => (
            <button
              key={label}
              onClick={() => setSelectedDate(formatDateString(date))}
              className={cn(
                'px-3 py-1.5 text-sm rounded-full border transition-colors',
                selectedDate === formatDateString(date)
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-[rgb(var(--color-secondary-50))] text-[var(--text-secondary)] border-[rgb(var(--color-secondary-300))] hover:border-blue-500'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Calendar input */}
        <div className="mb-4">
          <label className="block text-sm text-[var(--text-secondary)] mb-1">직접 선택</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
        </div>

        {/* Keep time option */}
        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={keepTime}
              onChange={(e) => setKeepTime(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-[var(--text-secondary)]">시간 정보 유지</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))] rounded-lg"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {isPending ? '이동 중...' : '변경'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function getNextMonday(today: Date): Date {
  const d = new Date(today);
  const dayOfWeek = d.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  d.setDate(d.getDate() + daysUntilMonday);
  return d;
}

function getFirstDayOfNextMonth(today: Date): Date {
  const d = new Date(today);
  d.setMonth(d.getMonth() + 1);
  d.setDate(1);
  return d;
}
