'use client';

import { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/Dialog';
import Button from '@/components/atoms/Button';
import Label from '@/components/atoms/Label';
import Input from '@/components/atoms/Input';
import {
  buildCustomRRule,
  parseCustomRRule,
  formatRRuleToKorean,
  type CustomRRuleParams,
} from '@/lib/domains/calendar/rrule';
import { cn } from '@/lib/cn';

// ============================================
// Types
// ============================================

interface CustomRecurrenceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (rrule: string) => void;
  /** 편집 시 기존 RRULE (파싱해서 초기값으로 사용) */
  initialRRule?: string | null;
  /** 이벤트 날짜 (MONTHLY 기본값 계산용) */
  eventDate?: string;
}

// ============================================
// Constants
// ============================================

const FREQ_OPTIONS = [
  { value: 'DAILY' as const, label: '일' },
  { value: 'WEEKLY' as const, label: '주' },
  { value: 'MONTHLY' as const, label: '개월' },
  { value: 'YEARLY' as const, label: '년' },
];

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

const SETPOS_OPTIONS = [
  { value: 1, label: '첫째' },
  { value: 2, label: '둘째' },
  { value: 3, label: '셋째' },
  { value: 4, label: '넷째' },
  { value: -1, label: '마지막' },
];

/** freq별 COUNT 상한 */
const COUNT_MAX_BY_FREQ: Record<string, number> = {
  DAILY: 365,
  WEEKLY: 104,
  MONTHLY: 60,
  YEARLY: 10,
};

// ============================================
// Helpers
// ============================================

function getDateInfo(dateStr?: string) {
  const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  const dayOfWeek = d.getDay();           // 0=일
  const dayOfMonth = d.getDate();         // 1~31
  // N번째 요일 계산
  const weekOfMonth = Math.ceil(dayOfMonth / 7); // 1~5
  return { dayOfWeek, dayOfMonth, weekOfMonth };
}

// ============================================
// Component
// ============================================

export function CustomRecurrenceDialog({
  isOpen,
  onClose,
  onConfirm,
  initialRRule,
  eventDate,
}: CustomRecurrenceDialogProps) {
  const dateInfo = useMemo(() => getDateInfo(eventDate), [eventDate]);

  // 초기값: 기존 RRULE 파싱 또는 기본값
  const initial = useMemo(() => {
    if (initialRRule) {
      const parsed = parseCustomRRule(initialRRule);
      if (parsed) return parsed;
    }
    return null;
  }, [initialRRule]);

  const [freq, setFreq] = useState<CustomRRuleParams['freq']>(initial?.freq ?? 'WEEKLY');
  const [interval, setInterval] = useState(initial?.interval ?? 1);
  const [byDay, setByDay] = useState<number[]>(initial?.byDay ?? [dateInfo.dayOfWeek]);
  const [monthlyMode, setMonthlyMode] = useState<'dayOfMonth' | 'dayOfWeek'>(
    initial?.monthlyMode ?? 'dayOfMonth',
  );
  const [byMonthDay, setByMonthDay] = useState(initial?.byMonthDay ?? dateInfo.dayOfMonth);
  const [bySetPos, setBySetPos] = useState(initial?.bySetPos ?? dateInfo.weekOfMonth);
  const [byDayForMonthly, setByDayForMonthly] = useState(
    initial?.byDayForMonthly ?? dateInfo.dayOfWeek,
  );
  const [endMode, setEndMode] = useState<'never' | 'count' | 'until'>(initial?.endMode ?? 'never');
  const [count, setCount] = useState(initial?.count ?? 10);
  const [until, setUntil] = useState(initial?.until ?? '');

  const countMax = COUNT_MAX_BY_FREQ[freq] ?? 999;

  // freq 변경 시 count를 새 상한으로 클램핑
  const handleFreqChange = useCallback((newFreq: CustomRRuleParams['freq']) => {
    setFreq(newFreq);
    const newMax = COUNT_MAX_BY_FREQ[newFreq] ?? 999;
    setCount((prev) => Math.min(prev, newMax));
  }, []);

  // 미리보기 RRULE
  const previewRRule = useMemo(() => {
    return buildCustomRRule({
      freq,
      interval,
      byDay: freq === 'WEEKLY' ? byDay : undefined,
      monthlyMode: freq === 'MONTHLY' ? monthlyMode : undefined,
      byMonthDay: freq === 'MONTHLY' && monthlyMode === 'dayOfMonth' ? byMonthDay : undefined,
      bySetPos: freq === 'MONTHLY' && monthlyMode === 'dayOfWeek' ? bySetPos : undefined,
      byDayForMonthly: freq === 'MONTHLY' && monthlyMode === 'dayOfWeek' ? byDayForMonthly : undefined,
      endMode,
      count: endMode === 'count' ? count : undefined,
      until: endMode === 'until' ? until : undefined,
    });
  }, [freq, interval, byDay, monthlyMode, byMonthDay, bySetPos, byDayForMonthly, endMode, count, until]);

  const previewText = useMemo(() => formatRRuleToKorean(previewRRule), [previewRRule]);

  const toggleDay = useCallback((day: number) => {
    setByDay((prev) => {
      if (prev.includes(day)) {
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== day);
      }
      return [...prev, day].sort((a, b) => a - b);
    });
  }, []);

  const handleConfirm = () => {
    onConfirm(previewRRule);
    onClose();
  };

  // Validation
  const untilBeforeStart = endMode === 'until' && until && eventDate && until < eventDate;
  const isValid = (() => {
    if (freq === 'WEEKLY' && byDay.length === 0) return false;
    if (endMode === 'until' && !until) return false;
    if (untilBeforeStart) return false;
    if (endMode === 'count' && (!count || count < 1)) return false;
    return true;
  })();

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="사용자 지정 반복"
      maxWidth="sm"
    >
      <DialogContent>
        <div className="flex flex-col gap-5">
          {/* 반복 주기 */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm">반복 주기</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">매</span>
              <Input
                type="number"
                min={1}
                max={99}
                value={interval}
                onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-16 text-center"
                inputSize="sm"
              />
              <select
                value={freq}
                onChange={(e) => handleFreqChange(e.target.value as CustomRRuleParams['freq'])}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                {FREQ_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <span className="text-sm text-gray-600">마다</span>
            </div>
          </div>

          {/* WEEKLY: 요일 피커 */}
          {freq === 'WEEKLY' && (
            <div className="flex flex-col gap-2">
              <Label className="text-sm">반복 요일</Label>
              <div className="flex gap-1">
                {DAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={cn(
                      'w-9 h-9 rounded-full text-xs font-medium transition-colors',
                      byDay.includes(i)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* MONTHLY: dayOfMonth vs dayOfWeek */}
          {freq === 'MONTHLY' && (
            <div className="flex flex-col gap-3">
              <Label className="text-sm">반복 기준</Label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="monthlyMode"
                  checked={monthlyMode === 'dayOfMonth'}
                  onChange={() => setMonthlyMode('dayOfMonth')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm">
                  매월{' '}
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={byMonthDay}
                    onChange={(e) => setByMonthDay(Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 1)))}
                    className="w-14 text-center mx-1 inline-block"
                    inputSize="sm"
                    disabled={monthlyMode !== 'dayOfMonth'}
                  />
                  일
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="monthlyMode"
                  checked={monthlyMode === 'dayOfWeek'}
                  onChange={() => setMonthlyMode('dayOfWeek')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm flex items-center gap-1">
                  매월
                  <select
                    value={bySetPos}
                    onChange={(e) => setBySetPos(parseInt(e.target.value, 10))}
                    disabled={monthlyMode !== 'dayOfWeek'}
                    className="mx-1 px-2 py-1 text-sm rounded border border-gray-300 bg-white disabled:opacity-50"
                  >
                    {SETPOS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <select
                    value={byDayForMonthly}
                    onChange={(e) => setByDayForMonthly(parseInt(e.target.value, 10))}
                    disabled={monthlyMode !== 'dayOfWeek'}
                    className="px-2 py-1 text-sm rounded border border-gray-300 bg-white disabled:opacity-50"
                  >
                    {DAY_LABELS.map((label, i) => (
                      <option key={i} value={i}>{label}요일</option>
                    ))}
                  </select>
                </span>
              </label>
            </div>
          )}

          {/* 종료 조건 */}
          <div className="flex flex-col gap-3">
            <Label className="text-sm">종료</Label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="endMode"
                checked={endMode === 'never'}
                onChange={() => setEndMode('never')}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm">안 함</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="endMode"
                checked={endMode === 'until'}
                onChange={() => setEndMode('until')}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm flex items-center gap-1">
                날짜:
                <Input
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                  disabled={endMode !== 'until'}
                  className="ml-1"
                  inputSize="sm"
                  min={eventDate}
                />
              </span>
              {untilBeforeStart && (
                <p className="text-xs text-red-500 ml-6">종료 날짜는 시작 날짜 이후여야 합니다</p>
              )}
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="endMode"
                checked={endMode === 'count'}
                onChange={() => setEndMode('count')}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm flex items-center gap-1">
                반복 횟수:
                <Input
                  type="number"
                  min={1}
                  max={countMax}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Math.min(countMax, parseInt(e.target.value, 10) || 1)))}
                  className="w-16 text-center mx-1"
                  inputSize="sm"
                  disabled={endMode !== 'count'}
                />
                회 후
              </span>
            </label>
          </div>

          {/* 미리보기 */}
          {previewText && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
              <div className="text-xs text-gray-500 mb-0.5">미리보기</div>
              <div className="text-sm font-medium text-gray-800">{previewText}</div>
            </div>
          )}
        </div>
      </DialogContent>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} size="md">
          취소
        </Button>
        <Button variant="primary" onClick={handleConfirm} disabled={!isValid} size="md">
          완료
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
