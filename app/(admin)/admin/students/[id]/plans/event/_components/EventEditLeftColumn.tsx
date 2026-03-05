'use client';

import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Clock, Bell, Palette, AlignLeft, BookOpen, Calendar as CalendarIcon, Tag, CheckSquare } from 'lucide-react';
import { TimePickerDropdown } from '../../_components/items/TimePickerDropdown';
import { RecurrenceSelector } from '../../_components/items/RecurrenceSelector';
import { useState } from 'react';
import { EVENT_COLOR_PALETTE, isValidHexColor } from '../../_components/utils/eventColors';
import { REMINDER_PRESETS } from '@/lib/domains/calendar/reminders';
import { SUPPORTED_SUBJECT_CATEGORIES } from '@/lib/domains/plan/llm/actions/coldStart/types';
import { cn } from '@/lib/cn';
import { LABEL_PRESETS, getPresetForLabel } from '@/lib/domains/calendar/labelPresets';
import type { EventEditFormState } from './useEventEditForm';

interface EventEditLeftColumnProps {
  form: EventEditFormState;
  setField: <K extends keyof EventEditFormState>(key: K, value: EventEditFormState[K]) => void;
  setLabel: (newLabel: string) => void;
}

export function EventEditLeftColumn({ form, setField, setLabel }: EventEditLeftColumnProps) {
  const dateDisplay = (() => {
    try {
      return format(parseISO(form.date), 'M/d (E)', { locale: ko });
    } catch {
      return form.date;
    }
  })();

  return (
    <div className="flex flex-col gap-6">
      {/* Title */}
      <div>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setField('title', e.target.value)}
          placeholder="제목 추가"
          className="w-full border-0 border-b-2 border-gray-200 bg-transparent px-1 pb-2 text-xl font-medium text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-0"
          autoFocus
        />
      </div>

      {/* Label Preset */}
      <Section icon={<Tag className="h-5 w-5" />} label="일정 유형">
        <LabelPresetSelector value={form.label} onChange={setLabel} />
      </Section>

      {/* Task Toggle */}
      <Section icon={<CheckSquare className="h-5 w-5" />} label="태스크">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.isTask}
            onChange={(e) => setField('isTask', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">
            태스크로 관리 {form.isTask ? '(완료 체크 가능)' : '(일정만 표시)'}
          </span>
        </label>
      </Section>

      {/* Date & Time */}
      <Section icon={<Clock className="h-5 w-5" />} label="날짜/시간">
        <div className="flex flex-col gap-3">
          {/* Date */}
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={form.date}
              onChange={(e) => setField('date', e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <span className="text-sm text-gray-600">{dateDisplay}</span>
          </div>

          {/* All day toggle */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isAllDay}
              onChange={(e) => setField('isAllDay', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">종일</span>
          </label>

          {/* Time pickers (hidden when all-day) */}
          {!form.isAllDay && (
            <div className="flex items-center gap-2">
              <TimePickerDropdown
                value={form.startTime}
                onChange={(t) => setField('startTime', t)}
                label="시작"
              />
              <span className="text-gray-400">—</span>
              <TimePickerDropdown
                value={form.endTime}
                onChange={(t) => setField('endTime', t)}
                referenceTime={form.startTime}
                minTime={form.startTime}
                label="종료"
              />
            </div>
          )}

          {/* Recurrence */}
          <RecurrenceSelector
            value={form.rrule}
            onChange={(rrule) => setField('rrule', rrule)}
            eventDate={form.date}
          />
        </div>
      </Section>

      {/* Subject (study only) */}
      {form.hasStudyData && (
        <Section icon={<BookOpen className="h-5 w-5" />} label="과목">
          <select
            value={form.subject}
            onChange={(e) => setField('subject', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">선택 안함</option>
            {SUPPORTED_SUBJECT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </Section>
      )}

      {/* Color */}
      <ColorPickerSection color={form.color} setField={setField} />

      {/* Reminder */}
      <Section icon={<Bell className="h-5 w-5" />} label="알림">
        <select
          value={form.reminderMinutes ?? ''}
          onChange={(e) => setField('reminderMinutes', e.target.value ? Number(e.target.value) : null)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          {REMINDER_PRESETS.map((p) => (
            <option key={p.label} value={p.value ?? ''}>
              {p.label}
            </option>
          ))}
        </select>
      </Section>

      {/* Status (edit mode) */}
      <Section icon={<CalendarIcon className="h-5 w-5" />} label="상태">
        <select
          value={form.status}
          onChange={(e) => setField('status', e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="confirmed">대기중</option>
          <option value="tentative">진행중</option>
          <option value="completed">완료</option>
          <option value="cancelled">취소됨</option>
        </select>
      </Section>

      {/* Description */}
      <Section icon={<AlignLeft className="h-5 w-5" />} label="설명">
        <textarea
          value={form.description}
          onChange={(e) => setField('description', e.target.value)}
          placeholder="설명 추가"
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
        />
      </Section>
    </div>
  );
}

// ============================================
// Color picker with 24 colors + hex input
// ============================================

function ColorPickerSection({
  color,
  setField,
}: {
  color: string | null;
  setField: (field: 'color', value: string | null) => void;
}) {
  const [hexInput, setHexInput] = useState('');
  const [showHexInput, setShowHexInput] = useState(false);

  // 현재 색상이 커스텀 hex인지 확인
  const isCustomHex = color !== null && color.startsWith('#');

  const handleHexSubmit = () => {
    const hex = hexInput.startsWith('#') ? hexInput : `#${hexInput}`;
    if (isValidHexColor(hex)) {
      setField('color', hex);
      setShowHexInput(false);
    }
  };

  return (
    <Section icon={<Palette className="h-5 w-5" />} label="색상">
      <div className="flex flex-wrap gap-1.5">
        {/* Auto (null) */}
        <button
          type="button"
          onClick={() => setField('color', null)}
          className={cn(
            'h-6 w-6 rounded-full border-2 transition-all',
            'bg-gradient-to-br from-blue-400 to-purple-400',
            color === null ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105',
          )}
          title="자동 (과목 기반)"
        />
        {EVENT_COLOR_PALETTE.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setField('color', c.key)}
            className={cn(
              'h-6 w-6 rounded-full border-2 transition-all',
              color === c.key ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105',
            )}
            style={{ backgroundColor: c.hex }}
            title={c.label}
          />
        ))}
        {/* Custom hex button */}
        <button
          type="button"
          onClick={() => setShowHexInput(!showHexInput)}
          className={cn(
            'h-6 w-6 rounded-full border-2 transition-all text-[9px] font-bold',
            isCustomHex
              ? 'border-gray-800 scale-110'
              : 'border-gray-300 hover:border-gray-500 hover:scale-105',
          )}
          style={isCustomHex ? { backgroundColor: color } : undefined}
          title="커스텀 색상"
        >
          {!isCustomHex && '+'}
        </button>
      </div>
      {/* Hex input row */}
      {showHexInput && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleHexSubmit()}
            placeholder="#ff5733"
            maxLength={7}
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm font-mono focus:border-blue-400 focus:outline-none"
          />
          <input
            type="color"
            value={hexInput || '#3b82f6'}
            onChange={(e) => {
              setHexInput(e.target.value);
              setField('color', e.target.value);
            }}
            className="h-7 w-7 cursor-pointer rounded border-0 p-0"
            title="색상 선택"
          />
          <button
            type="button"
            onClick={handleHexSubmit}
            disabled={!isValidHexColor(hexInput.startsWith('#') ? hexInput : `#${hexInput}`)}
            className="rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            적용
          </button>
        </div>
      )}
    </Section>
  );
}

// ============================================
// Label Preset Selector
// ============================================

function LabelPresetSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (label: string) => void;
}) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customText, setCustomText] = useState('');

  const isCustom = !getPresetForLabel(value) && value !== '';

  const handleCustomSubmit = () => {
    const trimmed = customText.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setShowCustomInput(false);
    setCustomText('');
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {LABEL_PRESETS.map((preset) => {
          const isActive = value === preset.label;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => { onChange(preset.label); setShowCustomInput(false); }}
              className={cn(
                'px-3 py-1.5 text-xs rounded-full border transition-colors',
                isActive
                  ? 'font-medium border-transparent text-white'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300',
              )}
              style={isActive ? { backgroundColor: preset.defaultColor } : undefined}
            >
              {preset.label}
            </button>
          );
        })}
        {/* 커스텀 라벨 버튼 */}
        <button
          type="button"
          onClick={() => setShowCustomInput(!showCustomInput)}
          className={cn(
            'px-3 py-1.5 text-xs rounded-full border transition-colors',
            isCustom
              ? 'font-medium bg-gray-700 border-transparent text-white'
              : 'border-dashed border-gray-300 text-gray-500 hover:border-gray-400',
          )}
        >
          {isCustom ? value : '+ 직접 입력'}
        </button>
      </div>
      {showCustomInput && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
            placeholder="라벨 입력..."
            className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            autoFocus
          />
          <button
            type="button"
            onClick={handleCustomSubmit}
            disabled={!customText.trim()}
            className="rounded-md bg-blue-500 px-2.5 py-1 text-xs text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            적용
          </button>
        </div>
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
