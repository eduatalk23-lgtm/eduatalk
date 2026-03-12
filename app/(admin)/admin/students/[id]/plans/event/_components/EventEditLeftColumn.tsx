'use client';

import { Bell, FileText, BookOpen, Tag, Calendar, Plus, X, User, MapPin, Video, Users, Search } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useFloating, offset, flip, shift, autoUpdate } from '@floating-ui/react';
import { GCAL_CORE_COLORS, COLORS_BY_FAMILY, getEventColor } from '../../_components/utils/eventColors';
import { REMINDER_PRESETS } from '@/lib/domains/calendar/reminders';
import { SUPPORTED_SUBJECT_CATEGORIES } from '@/lib/domains/plan/llm/actions/coldStart/types';
import { cn } from '@/lib/cn';
import { LABEL_PRESETS, getPresetForLabel } from '@/lib/domains/calendar/labelPresets';
import { CONSULTATION_MODES } from '@/lib/domains/consulting/types';
import type { ConsultationMode } from '@/lib/domains/consulting/types';
import type { ConsultationPanelData } from '@/lib/domains/consulting/actions/fetchConsultationData';
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
  /** 엔티티 타입 (상담 모드에서 다른 UI 렌더링) */
  entityType?: 'event' | 'consultation';
  /** 상담 데이터 (consultants, enrollments, phoneAvailability) */
  consultationData?: ConsultationPanelData | null;
}

const inputCls = 'rounded-lg border border-[rgb(var(--color-secondary-300))] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

/** 알림 프리셋에서 값이 있는 것만 (선택 드롭다운용) */
const REMINDER_OPTIONS = REMINDER_PRESETS.filter((p) => p.value != null) as { label: string; value: number }[];

export function EventEditLeftColumn({ form, setField, setLabel, calendars, entityType = 'event', consultationData }: EventEditLeftColumnProps) {
  const isConsultation = entityType === 'consultation';
  const addReminder = (minutes: number) => {
    if (form.reminderMinutes.includes(minutes)) return;
    setField('reminderMinutes', [...form.reminderMinutes, minutes].sort((a, b) => a - b));
  };

  const removeReminder = (minutes: number) => {
    setField('reminderMinutes', form.reminderMinutes.filter((m) => m !== minutes));
  };

  // 추가할 수 있는 알림 옵션 (이미 추가된 것 제외)
  const availableReminders = REMINDER_OPTIONS.filter((p) => !form.reminderMinutes.includes(p.value));

  // 상담 모드: 전용 UI
  if (isConsultation) {
    const consultants = consultationData?.consultants ?? [];
    const enrollments = consultationData?.enrollments ?? [];
    const programOptions = enrollments.map((e) => e.program_name);

    return (
      <div className="flex flex-col gap-4">
        {/* 상담 대상 학생 (personal mode에서 선택 가능) */}
        <Section icon={<Search className="h-5 w-5" />}>
          <ConsultationStudentSearch
            value={form.consultationStudentId}
            initialName={form.consultationStudentName}
            onChange={(id, name) => {
              setField('consultationStudentId', id);
              setField('consultationStudentName', name ?? null);
            }}
          />
        </Section>

        {/* 담당 컨설턴트 */}
        <Section icon={<User className="h-5 w-5" />}>
          <select
            value={form.consultantId ?? ''}
            onChange={(e) => setField('consultantId', e.target.value || null)}
            className={cn(inputCls, 'w-full')}
          >
            <option value="">컨설턴트 선택</option>
            {consultants.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Section>

        {/* 프로그램명 */}
        <Section icon={<BookOpen className="h-5 w-5" />}>
          <div className="flex flex-col gap-1">
            <input
              list="program-options"
              type="text"
              value={form.programName}
              onChange={(e) => setField('programName', e.target.value)}
              placeholder="프로그램 선택 또는 입력"
              className={cn(inputCls, 'w-full')}
            />
            <datalist id="program-options">
              {programOptions.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            {form.programName && (
              <p className="text-xs text-[var(--text-tertiary)]">
                알림톡 상담유형: &quot;{form.programName}&quot;
              </p>
            )}
          </div>
        </Section>

        {/* 상담 방식 (대면/원격) + 장소/링크 */}
        <Section icon={<MapPin className="h-5 w-5" />}>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {CONSULTATION_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setField('consultationMode', m)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors',
                    form.consultationMode === m
                      ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                      : 'border-[rgb(var(--color-secondary-200))] text-[var(--text-tertiary)] hover:border-[rgb(var(--color-secondary-300))]',
                  )}
                >
                  {m === '대면' ? <MapPin className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                  {m}
                </button>
              ))}
            </div>
            {form.consultationMode === '대면' ? (
              <input
                type="text"
                value={form.consultationLocation}
                onChange={(e) => setField('consultationLocation', e.target.value)}
                placeholder="미입력 시 학원 주소 사용"
                className={cn(inputCls, 'w-full')}
              />
            ) : (
              <input
                type="url"
                value={form.meetingLink}
                onChange={(e) => setField('meetingLink', e.target.value)}
                placeholder="https://zoom.us/j/..."
                className={cn(inputCls, 'w-full')}
              />
            )}
          </div>
        </Section>

        {/* 방문 상담자 */}
        <Section icon={<Users className="h-5 w-5" />}>
          <input
            type="text"
            value={form.visitor}
            onChange={(e) => setField('visitor', e.target.value)}
            placeholder="학생 & 학부모"
            className={cn(inputCls, 'w-full')}
          />
        </Section>

        {/* 메모 */}
        <Section icon={<FileText className="h-5 w-5" />}>
          <textarea
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="상담 내용/목적"
            rows={4}
            className={cn(inputCls, 'w-full placeholder:text-[var(--text-tertiary)] resize-none')}
          />
        </Section>
      </div>
    );
  }

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
// Consultation Student Search (inline)
// ============================================

function ConsultationStudentSearch({
  value,
  initialName,
  onChange,
}: {
  value: string | null;
  /** edit 모드에서 DB에서 resolve된 학생명 */
  initialName?: string | null;
  onChange: (id: string | null, name?: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; name: string }[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(initialName ?? null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // initialName이 외부에서 변경되면 동기화
  useEffect(() => {
    if (initialName && !selectedName) {
      setSelectedName(initialName);
    }
  }, [initialName]); // eslint-disable-line react-hooks/exhaustive-deps

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setIsSearching(false); return; }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/students/search?q=${encodeURIComponent(q)}&type=all&isActive=true&limit=20`);
      if (!res.ok) { setResults([]); return; }
      const data = await res.json();
      setResults(data.success && data.data?.students
        ? data.data.students.map((s: { id: string; name: string | null }) => ({ id: s.id, name: s.name ?? '이름 없음' }))
        : []);
    } catch (err) {
      console.warn('학생 검색 실패:', err);
      setResults([]);
    } finally { setIsSearching(false); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.trim()) {
      timerRef.current = setTimeout(() => { if (!cancelled) doSearch(query); }, 300);
    } else {
      setResults([]);
    }
    return () => { cancelled = true; if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, doSearch]);

  const handleSelect = (student: { id: string; name: string }) => {
    onChange(student.id, student.name);
    setSelectedName(student.name);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        placeholder={selectedName ? `${selectedName}` : '학생 검색...'}
        className={cn(inputCls, 'w-full', selectedName && !query && 'text-[var(--text-primary)]')}
      />
      {selectedName && !query && (
        <button
          type="button"
          onClick={() => { onChange(null, undefined); setSelectedName(null); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-[var(--text-tertiary)] hover:text-red-500"
          aria-label="학생 선택 해제"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {isOpen && (query.trim() || isSearching) && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-[rgb(var(--color-secondary-200))] bg-[rgb(var(--color-secondary-50))] shadow-lg">
            {isSearching ? (
              <div className="p-3 text-center text-xs text-[var(--text-tertiary)]">검색 중...</div>
            ) : results.length === 0 ? (
              <div className="p-3 text-center text-xs text-[var(--text-tertiary)]">검색 결과 없음</div>
            ) : (
              <ul>
                {results.map((s) => (
                  <li
                    key={s.id}
                    onClick={() => handleSelect(s)}
                    className={cn(
                      'px-3 py-2 text-sm cursor-pointer hover:bg-[rgb(var(--color-secondary-100))] text-[var(--text-primary)]',
                      value === s.id && 'bg-blue-50 dark:bg-blue-950/20',
                    )}
                  >
                    {s.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
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
