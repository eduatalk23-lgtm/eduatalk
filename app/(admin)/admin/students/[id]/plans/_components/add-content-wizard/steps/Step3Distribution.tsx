'use client';

import { cn } from '@/lib/cn';
import type { AddContentWizardData, DistributionMode } from '../types';
import { Calendar, CalendarDays, CalendarRange, CheckCircle } from 'lucide-react';

interface Step3DistributionProps {
  data: AddContentWizardData;
  onChange: (updates: Partial<AddContentWizardData>) => void;
  targetDate: string;
}

const DISTRIBUTION_OPTIONS: {
  mode: DistributionMode;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    mode: 'today',
    label: '오늘만 추가',
    description: 'Daily Dock에 단일 플랜으로 추가합니다',
    icon: <Calendar className="h-5 w-5" />,
  },
  {
    mode: 'period',
    label: '기간에 걸쳐 분배',
    description: '지정한 기간 동안 학습량을 균등 분배합니다',
    icon: <CalendarRange className="h-5 w-5" />,
  },
  {
    mode: 'weekly',
    label: 'Weekly Dock에 추가',
    description: '유동적인 주간 플랜으로 추가합니다',
    icon: <CalendarDays className="h-5 w-5" />,
  },
];

export function Step3Distribution({ data, onChange, targetDate }: Step3DistributionProps) {
  return (
    <div className="space-y-6">
      {/* 배치 방식 선택 */}
      <div className="space-y-3">
        {DISTRIBUTION_OPTIONS.map(({ mode, label, description, icon }) => (
          <div
            key={mode}
            className={cn(
              'w-full border rounded-lg transition-colors',
              data.distributionMode === mode
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            )}
          >
            <button
              type="button"
              onClick={() => onChange({ distributionMode: mode })}
              className="w-full flex items-start gap-4 p-4 text-left"
            >
              <div
                className={cn(
                  'p-2 rounded-lg',
                  data.distributionMode === mode ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                )}
              >
                {icon}
              </div>
              <div className="flex-1">
                <div
                  className={cn(
                    'font-medium',
                    data.distributionMode === mode ? 'text-blue-700' : 'text-gray-700'
                  )}
                >
                  {label}
                </div>
                <div className="text-sm text-gray-500 mt-0.5">{description}</div>
              </div>
              {data.distributionMode === mode && (
                <CheckCircle className="h-5 w-5 text-blue-500 flex-shrink-0" />
              )}
            </button>
            {/* today 모드에서만 스케줄러 옵션 표시 */}
            {mode === 'today' && data.distributionMode === 'today' && (
              <div className="px-4 pb-4">
                <label
                  className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={data.useScheduler}
                    onChange={(e) => onChange({ useScheduler: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  자동 시간 배정 (기존 플랜 고려)
                </label>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 기간 설정 (period 모드일 때만) */}
      {data.distributionMode === 'period' && (
        <div className="p-4 bg-gray-50 rounded-lg space-y-4">
          <label className="block text-sm font-medium text-gray-700">학습 기간 설정</label>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">시작일</label>
              <input
                type="date"
                value={data.periodStart}
                onChange={(e) => onChange({ periodStart: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <span className="text-gray-400 mt-5">~</span>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">종료일</label>
              <input
                type="date"
                value={data.periodEnd}
                onChange={(e) => onChange({ periodEnd: e.target.value })}
                min={data.periodStart}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          {data.periodStart && data.periodEnd && (
            <div className="text-sm text-gray-600">
              {(() => {
                const start = new Date(data.periodStart);
                const end = new Date(data.periodEnd);
                const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                return `총 ${days}일간 학습`;
              })()}
            </div>
          )}
        </div>
      )}

      {/* 요약 정보 */}
      <div className="p-4 border border-gray-200 rounded-lg bg-white">
        <h4 className="text-sm font-medium text-gray-700 mb-3">생성 요약</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">콘텐츠</span>
            <span className="font-medium text-gray-700">{data.title || '(제목 없음)'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">유형</span>
            <span className="font-medium text-gray-700">
              {data.contentType === 'book' && '교재'}
              {data.contentType === 'lecture' && '강의'}
              {data.contentType === 'custom' && '커스텀'}
            </span>
          </div>
          {data.subjectArea && (
            <div className="flex justify-between">
              <span className="text-gray-500">과목</span>
              <span className="font-medium text-gray-700">
                {data.subject || data.subjectArea}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">범위</span>
            <span className="font-medium text-gray-700">
              {data.rangeType !== 'custom'
                ? `${data.rangeStart || '?'} ~ ${data.rangeEnd || '?'}`
                : data.customRange || '미지정'}
            </span>
          </div>
          {data.totalVolume && (
            <div className="flex justify-between">
              <span className="text-gray-500">예상 볼륨</span>
              <span className="font-medium text-gray-700">{data.totalVolume}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t">
            <span className="text-gray-500">배치 방식</span>
            <span className="font-medium text-blue-600">
              {data.distributionMode === 'today' && `${targetDate} (오늘)`}
              {data.distributionMode === 'period' &&
                `${data.periodStart} ~ ${data.periodEnd || '?'}`}
              {data.distributionMode === 'weekly' && 'Weekly Dock'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
