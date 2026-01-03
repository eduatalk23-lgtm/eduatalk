'use client';

import { useEffect } from 'react';
import { Calendar, FileText, Target } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { PlanPurpose } from '../types';

interface Step1BasicInfoProps {
  periodStart: string;
  periodEnd: string;
  name: string;
  planPurpose: PlanPurpose;
  onUpdatePeriod: (start: string, end: string) => void;
  onUpdateName: (name: string) => void;
  onUpdatePurpose: (purpose: PlanPurpose) => void;
  error: string | null;
}

export function Step1BasicInfo({
  periodStart,
  periodEnd,
  name,
  planPurpose,
  onUpdatePeriod,
  onUpdateName,
  onUpdatePurpose,
  error,
}: Step1BasicInfoProps) {
  // 기본값 설정: 오늘부터 30일
  useEffect(() => {
    if (!periodStart || !periodEnd) {
      const today = new Date();
      const thirtyDaysLater = new Date(today);
      thirtyDaysLater.setDate(today.getDate() + 30);

      const formatDate = (d: Date) => d.toISOString().split('T')[0];
      onUpdatePeriod(formatDate(today), formatDate(thirtyDaysLater));
    }
  }, [periodStart, periodEnd, onUpdatePeriod]);

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdatePeriod(e.target.value, periodEnd);
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdatePeriod(periodStart, e.target.value);
  };

  // 기간 계산
  const getDaysDiff = () => {
    if (!periodStart || !periodEnd) return 0;
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const daysDiff = getDaysDiff();
  const isValidPeriod = daysDiff > 0 && daysDiff <= 365;

  return (
    <div className="space-y-6">
      {/* 기간 설정 */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Calendar className="h-4 w-4" />
          학습 기간 <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={periodStart}
            onChange={handleStartChange}
            className={cn(
              'flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2',
              isValidPeriod
                ? 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
                : 'border-red-300 focus:border-red-500 focus:ring-red-200'
            )}
          />
          <span className="text-gray-500">~</span>
          <input
            type="date"
            value={periodEnd}
            onChange={handleEndChange}
            min={periodStart}
            className={cn(
              'flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2',
              isValidPeriod
                ? 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
                : 'border-red-300 focus:border-red-500 focus:ring-red-200'
            )}
          />
        </div>
        {daysDiff > 0 && (
          <p className={cn('text-sm', isValidPeriod ? 'text-gray-500' : 'text-red-500')}>
            {daysDiff}일간의 학습 계획
            {daysDiff > 365 && ' (최대 365일까지 설정 가능)'}
          </p>
        )}
        {daysDiff <= 0 && periodStart && periodEnd && (
          <p className="text-sm text-red-500">종료일은 시작일보다 이후여야 합니다.</p>
        )}
      </div>

      {/* 플랜 이름 */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <FileText className="h-4 w-4" />
          플랜 이름 <span className="text-gray-400 text-xs">(선택)</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onUpdateName(e.target.value)}
          placeholder="예: 겨울방학 학습 계획"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          maxLength={100}
        />
      </div>

      {/* 학습 목적 */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Target className="h-4 w-4" />
          학습 목적 <span className="text-gray-400 text-xs">(선택)</span>
        </label>
        <div className="grid grid-cols-4 gap-2">
          {(['', '내신대비', '모의고사', '수능'] as PlanPurpose[]).map((purpose) => (
            <button
              key={purpose || 'none'}
              type="button"
              onClick={() => onUpdatePurpose(purpose)}
              className={cn(
                'rounded-lg border px-3 py-2.5 text-sm font-medium transition',
                planPurpose === purpose
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
              )}
            >
              {purpose || '없음'}
            </button>
          ))}
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  );
}
