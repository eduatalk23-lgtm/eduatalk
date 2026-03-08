'use client';

import { Bell, FileText, BookOpen, Tag, Calendar, Plus, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useFloating, offset, flip, shift, autoUpdate } from '@floating-ui/react';
import { GCAL_CORE_COLORS, COLORS_BY_FAMILY, getEventColor } from '../../_components/utils/eventColors';
import { REMINDER_PRESETS } from '@/lib/domains/calendar/reminders';
import { SUPPORTED_SUBJECT_CATEGORIES } from '@/lib/domains/plan/llm/actions/coldStart/types';
import { cn } from '@/lib/cn';
import { LABEL_PRESETS, getPresetForLabel } from '@/lib/domains/calendar/labelPresets';
import type { EventEditFormState } from './useEventEditForm';

export interface CalendarOption {
  id: string;
  summary: string;
  defaultColor: string | null;
}

interface EventEditLeftColumnProps {
  form: EventEditFormState;
  setField: <K extends keyof EventEditFormState>(key: K, value: EventEditFormState[K]) => void;
  setLabel: (newLabel: string) => void;
  /** 학생의 캘린더 목록 (캘린더 선택 드롭다운용) */
  calendars?: CalendarOption[];
}

const inputCls = 'rounded-lg border border-[rgb(var(--color-secondary-300))] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

/** 알림 프리셋에서 값이 있는 것만 (선택 드롭다운용) */
const REMINDER_OPTIONS = REMINDER_PRESETS.filter((p) => p.value != null) as { label: string; value: number }[];

export function EventEditLeftColumn({ form, setField, setLabel, calendars }: EventEditLeftColumnProps) {
  const addReminder = (minutes: number) => {
    if (form.reminderMinutes.includes(minutes)) return;
    setField('reminderMinutes', [...form.reminderMinutes, minutes].sort((a, b) => a - b));
  };

  const removeReminder = (minutes: number) => {
    setField('reminderMinutes', form.reminderMinutes.filter((m) => m !== minutes));
  };

  // 추가할 수 있는 알림 옵션 (이미 추가된 것 제외)
  const availableReminders = REMINDER_OPTIONS.filter((p) => !form.reminderMinutes.includes(p.value));

  return (
    <div className="flex flex-col gap-4">
      {/* Label Preset + Task Toggle (inline) */}
      <Section icon={<Tag className="h-5 w-5" />}>
        <LabelPresetSelector value={form.label} onChange={setLabel} />
        <label className="mt-2 flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isTask}
            onChange={(e) => setField('isTask', e.target.checked)}
            className="h-3.5 w-3.5 rounded border-[rgb(var(--color-secondary-300))] text-blue-600 focus:ring-blue-500"
          />
          <span className="text-xs text-[var(--text-tertiary)]">
            태스크로 관리 {form.isTask ? '(완료 체크 가능)' : '(일정만 표시)'}
          </span>
        </label>
      </Section>

      {/* Subject (study only) — with transition */}
      <AnimatedCollapse open={form.hasStudyData}>
        <Section icon={<BookOpen className="h-5 w-5" />}>
          <select
            value={form.subject}
            onChange={(e) => setField('subject', e.target.value)}
            className={cn(inputCls, 'w-full')}
          >
            <option value="">선택 안함</option>
            {SUPPORTED_SUBJECT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </Section>
      </AnimatedCollapse>

      {/* Calendar + Color (한 행 배치, 드롭다운) */}
      <CalendarAndColorRow
        calendarId={form.calendarId}
        calendars={calendars}
        onCalendarChange={(id) => setField('calendarId', id)}
        color={form.color}
        onColorChange={(c) => setField('color', c)}
      />

      {/* Reminder — multi-reminder with "알림 추가" pattern */}
      <Section icon={<Bell className="h-5 w-5" />}>
        <div className="flex flex-col gap-2">
          {/* 추가된 알림 목록 */}
          {form.reminderMinutes.map((m) => {
            const preset = REMINDER_OPTIONS.find((p) => p.value === m);
            return (
              <div key={m} className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-primary)]">
                  {preset?.label ?? `${m}분 전`}
                </span>
                <button
                  type="button"
                  onClick={() => removeReminder(m)}
                  className="p-0.5 rounded-full text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-50 transition-colors"
                  aria-label="알림 삭제"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}

          {/* 알림 추가 */}
          {availableReminders.length > 0 ? (
            <ReminderAdder options={availableReminders} onAdd={addReminder} />
          ) : form.reminderMinutes.length === 0 ? (
            <ReminderAdder options={REMINDER_OPTIONS} onAdd={addReminder} />
          ) : null}
        </div>
      </Section>

      {/* Description */}
      <Section icon={<FileText className="h-5 w-5" />}>
        <textarea
          value={form.description}
          onChange={(e) => setField('description', e.target.value)}
          placeholder="설명 추가"
          rows={8}
          className={cn(inputCls, 'w-full placeholder:text-[var(--text-tertiary)] resize-none')}
        />
      </Section>
    </div>
  );
}

// ============================================
// Animated Collapse (U-14)
// ============================================

function AnimatedCollapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-200 ease-in-out',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
      )}
    >
      <div className="overflow-hidden">
        {children}
      </div>
    </div>
  );
}

// ============================================
// Reminder Adder (U-7)
// ============================================

function ReminderAdder({
  options,
  onAdd,
}: {
  options: { label: string; value: number }[];
  onAdd: (minutes: number) => void;
}) {
  const [showSelect, setShowSelect] = useState(false);

  if (!showSelect) {
    return (
      <button
        type="button"
        onClick={() => setShowSelect(true)}
        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 transition-colors w-fit"
      >
        <Plus className="h-3.5 w-3.5" />
        알림 추가
      </button>
    );
  }

  return (
    <select
      autoFocus
      className={cn(inputCls, 'w-full')}
      defaultValue=""
      onChange={(e) => {
        if (e.target.value) {
          onAdd(Number(e.target.value));
        }
        setShowSelect(false);
      }}
      onBlur={() => setShowSelect(false)}
    >
      <option value="" disabled>알림 선택...</option>
      {options.map((p) => (
        <option key={p.value} value={p.value}>{p.label}</option>
      ))}
    </select>
  );
}

// ============================================
// Calendar + Color (한 행, 드롭다운)
// ============================================

function CalendarAndColorRow({
  calendarId,
  calendars,
  onCalendarChange,
  color,
  onColorChange,
}: {
  calendarId: string | null;
  calendars?: CalendarOption[];
  onCalendarChange: (id: string) => void;
  color: string | null;
  onColorChange: (c: string | null) => void;
}) {
  const selectedColorEntry = color ? getEventColor(color) : null;
  const colorHex = selectedColorEntry?.hex ?? color ?? undefined;

  return (
    <Section icon={<Calendar className="h-5 w-5" />}>
      <div className="flex items-center gap-2">
        {/* 캘린더 드롭다운 */}
        {calendars && calendars.length > 1 ? (
          <select
            value={calendarId ?? ''}
            onChange={(e) => onCalendarChange(e.target.value)}
            className={cn(inputCls, 'flex-1 min-w-0 truncate')}
          >
            {calendars.map((cal) => (
              <option key={cal.id} value={cal.id}>{cal.summary}</option>
            ))}
          </select>
        ) : (
          <span className="flex-1 min-w-0 truncate text-sm text-[var(--text-secondary)]">
            {calendars?.[0]?.summary ?? '캘린더'}
          </span>
        )}

        {/* 색상 드롭다운 */}
        <ColorDropdown color={color} colorHex={colorHex} onChange={onColorChange} />
      </div>
    </Section>
  );
}

function ColorDropdown({
  color,
  colorHex,
  onChange,
}: {
  color: string | null;
  colorHex: string | undefined;
  onChange: (c: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showExtended, setShowExtended] = useState(false);

  const { refs, floatingStyles } = useFloating({
    placement: 'bottom-end',
    strategy: 'fixed',
    open,
    middleware: [
      offset(4),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
    ],
    whileElementsMounted: autoUpdate,
  });

  // 외부 클릭 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const reference = refs.domReference.current;
      const floating = refs.floating.current;
      if (reference?.contains(target) || floating?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, refs]);

  // 닫힐 때 확장 패널 리셋
  useEffect(() => {
    if (!open) setShowExtended(false);
  }, [open]);

  const handleSelect = (key: string | null) => {
    onChange(key);
    setOpen(false);
  };

  return (
    <div className="flex-shrink-0">
      {/* 트리거: 색상 원 + 드롭다운 화살표 */}
      <button
        ref={refs.setReference}
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(inputCls, 'flex items-center gap-1.5 px-2.5')}
      >
        <span
          className={cn(
            'h-4 w-4 rounded-full flex-shrink-0',
            !colorHex && 'bg-gradient-to-br from-blue-400 to-purple-400',
          )}
          style={colorHex ? { backgroundColor: colorHex } : undefined}
        />
        <svg className="h-4 w-4 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 드롭다운 팔레트 — Floating UI: 뷰포트 경계 자동 대응 */}
      {open && (
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          className="z-[9999] w-fit rounded-lg border border-[rgb(var(--color-secondary-200))] bg-[rgb(var(--color-secondary-50))] shadow-lg p-2"
        >
          {!showExtended ? (
            <>
              {/* 기본: GCal 코어 11색 + 캘린더 기본 (2열) */}
              <div className="grid grid-cols-2 gap-1 justify-items-center">
                {GCAL_CORE_COLORS.map((c) => (
                  <ColorCircle
                    key={c.key}
                    active={color === c.key}
                    hex={c.hex}
                    title={c.label}
                    onClick={() => handleSelect(c.key)}
                  />
                ))}
                <ColorCircle
                  active={color === null}
                  title="캘린더 색상"
                  onClick={() => handleSelect(null)}
                  className="bg-gradient-to-br from-blue-400 to-purple-400"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowExtended(true)}
                className="mt-1.5 pt-1.5 border-t border-[rgb(var(--color-secondary-100))] w-full text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors text-center"
              >
                더보기
              </button>
            </>
          ) : (
            <>
              {/* 확장: 24색 계열별 정렬 (4열 × 6행) + 캘린더 기본 */}
              <div className="grid grid-cols-4 gap-1.5 justify-items-center">
                {COLORS_BY_FAMILY.map((c) => (
                  <ColorCircle
                    key={c.key}
                    active={color === c.key}
                    hex={c.hex}
                    title={c.label}
                    onClick={() => handleSelect(c.key)}
                  />
                ))}
              </div>
              <div className="mt-1.5 pt-1.5 border-t border-[rgb(var(--color-secondary-100))] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleSelect(null)}
                  className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  <span className="size-4 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex-shrink-0" />
                  캘린더 색상
                </button>
                <button
                  type="button"
                  onClick={() => setShowExtended(false)}
                  className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  접기
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Label Preset Selector
// ============================================

/** 색상 원 (공용) */
function ColorCircle({
  active,
  hex,
  title,
  onClick,
  className: extraCls,
}: {
  active: boolean;
  hex?: string;
  title: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={title}
      title={title}
      className={cn(
        'size-5 rounded-full transition-all cursor-pointer',
        active ? 'ring-2 ring-offset-1 ring-[var(--text-primary)]' : 'hover:opacity-80 active:scale-95',
        extraCls,
      )}
      style={hex ? { backgroundColor: hex } : undefined}
    />
  );
}

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
                  : 'border-[rgb(var(--color-secondary-200))] text-[var(--text-tertiary)] hover:border-[rgb(var(--color-secondary-300))]',
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
              ? 'font-medium bg-[rgb(var(--color-secondary-700))] border-transparent text-white'
              : 'border-dashed border-[rgb(var(--color-secondary-300))] text-[var(--text-tertiary)] hover:border-[rgb(var(--color-secondary-400))]',
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
            className={cn(inputCls, 'flex-1 px-2 py-1')}
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
