'use client';

import { Fragment, memo, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatTimeKoAmPm, formatDurationKo, timeToMinutes, minutesToTime } from '../utils/timeGridUtils';

interface TimePickerDropdownProps {
  value: string;             // "HH:mm"
  onChange: (time: string) => void;
  /** 종료 picker: 시작 시간 기준으로 rolling 목록 생성 + duration 표시 */
  referenceTime?: string;
  /** 시작 picker 전용: 이 시간 이전은 disabled */
  minTime?: string;
  label?: string;            // "시작" | "종료"
  disabled?: boolean;
}

/** 00:00~23:45 까지 15분 간격 96개 시간 옵션 */
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
const TOTAL_MINUTES = 24 * 60;

/**
 * GCal 종료 피커: 시작 시간 +15분부터 +23시간30분까지 rolling 순서
 */
function generateEndTimeOptions(startTime: string): Array<{
  time: string;
  durationMin: number;
  isNextDay: boolean;
}> {
  const startMin = timeToMinutes(startTime);
  const options: Array<{ time: string; durationMin: number; isNextDay: boolean }> = [];

  for (let offset = 15; offset <= TOTAL_MINUTES - 30; offset += 15) {
    const totalMin = startMin + offset;
    const wrappedMin = totalMin % TOTAL_MINUTES;
    const isNextDay = totalMin >= TOTAL_MINUTES;
    options.push({
      time: minutesToTime(wrappedMin),
      durationMin: offset,
      isNextDay,
    });
  }

  return options;
}

/** duration을 간결하게 표시 (GCal 스타일) */
function formatDurationCompact(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}:${String(m).padStart(2, '0')}`;
}

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

  const isEndPicker = referenceTime != null;

  const endOptions = useMemo(
    () => isEndPicker ? generateEndTimeOptions(referenceTime!) : null,
    [isEndPicker, referenceTime],
  );

  useEffect(() => {
    if (open && selectedRef.current && listRef.current) {
      selectedRef.current.scrollIntoView({ block: 'center' });
    }
  }, [open]);

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

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (!open || !listRef.current) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const buttons = listRef.current.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
      if (buttons.length === 0) return;
      const current = listRef.current.querySelector<HTMLButtonElement>('button:focus');
      let idx = current ? Array.from(buttons).indexOf(current) : -1;
      idx = e.key === 'ArrowDown' ? Math.min(idx + 1, buttons.length - 1) : Math.max(idx - 1, 0);
      buttons[idx]?.focus();
      buttons[idx]?.scrollIntoView({ block: 'nearest' });
    }
  }, [open]);

  const minMinutes = (!isEndPicker && minTime) ? timeToMinutes(minTime) : undefined;

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
          role="listbox"
          aria-label={label ?? (isEndPicker ? '종료 시간' : '시작 시간')}
          className={cn(
            'absolute left-0 top-full mt-1 max-h-48 overflow-y-auto bg-[rgb(var(--color-secondary-50))] border border-[rgb(var(--color-secondary-200))] rounded-lg shadow-lg z-50',
            isEndPicker ? 'w-52' : 'w-40',
          )}
        >
          {isEndPicker && endOptions ? (
            endOptions.map((opt, idx) => {
              const isSelected = opt.time === value;
              const showDivider = opt.isNextDay && idx > 0 && !endOptions[idx - 1].isNextDay;
              return (
                <Fragment key={`${opt.time}-${opt.isNextDay ? 'next' : 'same'}`}>
                  {showDivider && (
                    <div className="flex items-center gap-2 px-3 py-1 border-t border-[rgb(var(--color-secondary-200))]">
                      <span className="text-[10px] text-blue-500 font-medium">다음 날</span>
                      <div className="flex-1 border-t border-[rgb(var(--color-secondary-200))]" />
                    </div>
                  )}
                  <button
                    ref={isSelected ? selectedRef : undefined}
                    role="option"
                    aria-selected={isSelected}
                    type="button"
                    onClick={() => {
                      onChange(opt.time);
                      setOpen(false);
                    }}
                    className={cn(
                      'w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 transition-colors whitespace-nowrap',
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 font-medium'
                        : 'text-[var(--text-primary)] hover:bg-[rgb(var(--color-secondary-100))]',
                    )}
                  >
                    <span className="tabular-nums shrink-0">{formatTimeKoAmPm(opt.time)}</span>
                    <span className="text-xs text-[var(--text-tertiary)] ml-auto shrink-0">
                      {formatDurationCompact(opt.durationMin)}
                    </span>
                  </button>
                </Fragment>
              );
            })
          ) : (
            TIME_OPTIONS.map((time) => {
              const timeMin = timeToMinutes(time);
              const isDisabled = minMinutes != null && timeMin <= minMinutes;
              const isSelected = time === value;
              return (
                <button
                  key={time}
                  ref={isSelected ? selectedRef : undefined}
                  role="option"
                  aria-selected={isSelected}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    onChange(time);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full px-3 py-1.5 text-left text-sm transition-colors whitespace-nowrap',
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 font-medium'
                      : 'text-[var(--text-primary)] hover:bg-[rgb(var(--color-secondary-100))]',
                    isDisabled && 'opacity-30 cursor-not-allowed',
                  )}
                >
                  <span className="tabular-nums">{formatTimeKoAmPm(time)}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
});
