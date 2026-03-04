'use client';

import { useState, useMemo } from 'react';
import { buildCustomRRule, formatRRuleToKorean } from '@/lib/domains/calendar/rrule';
import { CustomRecurrenceDialog } from '../modals/CustomRecurrenceDialog';

// ============================================
// Types
// ============================================

interface RecurrenceSelectorProps {
  value: string | null;
  onChange: (rrule: string | null) => void;
  eventDate: string; // YYYY-MM-DD
  disabled?: boolean;
}

// ============================================
// Helpers
// ============================================

const DAY_MAP_KO = ['일', '월', '화', '수', '목', '금', '토'];

function getPresets(eventDate: string) {
  const d = new Date(eventDate + 'T00:00:00');
  const dayOfWeek = d.getDay();
  const dayOfMonth = d.getDate();
  const month = d.getMonth() + 1;

  const weeklyRRule = buildCustomRRule({ freq: 'WEEKLY', byDay: [dayOfWeek] });
  const monthlyRRule = buildCustomRRule({ freq: 'MONTHLY', monthlyMode: 'dayOfMonth', byMonthDay: dayOfMonth });
  const yearlyRRule = buildCustomRRule({ freq: 'YEARLY' });
  const dailyRRule = buildCustomRRule({ freq: 'DAILY', endMode: 'count', count: 90 });
  const weekdayRRule = buildCustomRRule({ freq: 'WEEKLY', byDay: [1, 2, 3, 4, 5], endMode: 'count', count: 90 });

  return [
    { label: '반복 안함', rrule: null },
    { label: '매일', rrule: dailyRRule },
    { label: '주중 매일 (월~금)', rrule: weekdayRRule },
    { label: `매주 ${DAY_MAP_KO[dayOfWeek]}요일`, rrule: weeklyRRule },
    { label: `매월 ${dayOfMonth}일`, rrule: monthlyRRule },
    { label: `매년 ${month}월 ${dayOfMonth}일`, rrule: yearlyRRule },
  ];
}

// ============================================
// Component
// ============================================

export function RecurrenceSelector({
  value,
  onChange,
  eventDate,
  disabled = false,
}: RecurrenceSelectorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const presets = useMemo(() => getPresets(eventDate), [eventDate]);

  // 현재 값이 프리셋에 매칭되는지 확인
  const matchedPreset = presets.find((p) => p.rrule === value);
  const isCustom = value && !matchedPreset;

  // select value: 프리셋 매칭 시 해당 rrule, 커스텀이면 'custom'
  const selectValue = isCustom ? 'custom' : (value ?? '');

  const handleChange = (selectVal: string) => {
    if (selectVal === 'custom') {
      setDialogOpen(true);
      return;
    }
    // 프리셋 선택
    onChange(selectVal === '' ? null : selectVal);
  };

  const handleCustomConfirm = (rrule: string) => {
    onChange(rrule);
  };

  return (
    <>
      <select
        value={selectValue}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 text-sm rounded-lg border border-[rgb(var(--color-secondary-300))] bg-[rgb(var(--color-secondary-50))] focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 disabled:opacity-50"
      >
        {presets.map((preset) => (
          <option key={preset.label} value={preset.rrule ?? ''}>
            {preset.label}
          </option>
        ))}
        {isCustom && (
          <option value="custom">
            사용자 지정: {formatRRuleToKorean(value)}
          </option>
        )}
        <option value="custom">사용자 지정...</option>
      </select>

      <CustomRecurrenceDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={handleCustomConfirm}
        initialRRule={value}
        eventDate={eventDate}
      />
    </>
  );
}
