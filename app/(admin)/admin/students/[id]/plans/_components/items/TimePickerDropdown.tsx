'use client';

import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatTimeKoAmPm, formatDurationKo, timeToMinutes } from '../utils/timeGridUtils';

interface TimePickerDropdownProps {
  value: string;             // "HH:mm"
  onChange: (time: string) => void;
  referenceTime?: string;    // 종료 picker: 시작 시간 기준 소요시간 표시
  minTime?: string;          // 최소 시간 (종료 picker: startTime 이후만)
  label?: string;            // "시작" | "종료"
  disabled?: boolean;
}

/** 00:00~23:45 까지 15분 간격 96개 시간 옵션 생성 */
function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

export const TimePickerDropdown = memo(function TimePickerDropdown({
  value,
  onChange,
  referenceTime,
  minTime,
  label,
  disabled,
}: TimePickerDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // 열릴 때 선택된 항목으로 스크롤
  useEffect(() => {
    if (open && selectedRef.current && listRef.current) {
      selectedRef.current.scrollIntoView({ block: 'center' });
    }
  }, [open]);

  // 외부 클릭으로 닫기
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // ESC로 닫기
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
  }, []);

  const minMinutes = minTime ? timeToMinutes(minTime) : undefined;
  const refMinutes = referenceTime ? timeToMinutes(referenceTime) : undefined;

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex items-center gap-1 px-2 py-1.5 text-sm border rounded-md transition-colors min-w-[5.5rem] whitespace-nowrap',
          'hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          open ? 'border-blue-400 ring-2 ring-blue-400' : 'border-[rgb(var(--color-secondary-300))]',
        )}
      >
        <span className="flex-1 text-left tabular-nums">{formatTimeKoAmPm(value)}</span>
        <ChevronDown className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />
      </button>

      {open && (
        <div
          ref={listRef}
          className="absolute left-0 top-full mt-1 w-52 max-h-48 overflow-y-auto bg-[rgb(var(--color-secondary-50))] border border-[rgb(var(--color-secondary-200))] rounded-lg shadow-lg z-50"
        >
          {TIME_OPTIONS.map((time) => {
            const timeMin = timeToMinutes(time);
            const isDisabled = minMinutes != null && timeMin <= minMinutes;
            const isSelected = time === value;

            // 소요 시간 표시 (종료 picker)
            let durationLabel = '';
            if (refMinutes != null && timeMin > refMinutes) {
              durationLabel = formatDurationKo(timeMin - refMinutes);
            }

            return (
              <button
                key={time}
                ref={isSelected ? selectedRef : undefined}
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  onChange(time);
                  setOpen(false);
                }}
                className={cn(
                  'w-full px-3 py-1.5 text-left text-sm flex items-center justify-between transition-colors',
                  isSelected
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-[var(--text-primary)] hover:bg-[rgb(var(--color-secondary-100))]',
                  isDisabled && 'opacity-30 cursor-not-allowed',
                )}
              >
                <span className="tabular-nums">{formatTimeKoAmPm(time)}</span>
                {durationLabel && (
                  <span className="text-xs text-[var(--text-tertiary)] ml-2">({durationLabel})</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});
