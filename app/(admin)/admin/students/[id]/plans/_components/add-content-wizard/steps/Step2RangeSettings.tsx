'use client';

import { cn } from '@/lib/cn';
import type { RangeType } from '@/lib/domains/admin-plan/types';
import type { AddContentWizardData } from '../types';
import { Info } from 'lucide-react';

interface Step2RangeSettingsProps {
  data: AddContentWizardData;
  onChange: (updates: Partial<AddContentWizardData>) => void;
}

const RANGE_TYPES: { type: RangeType; label: string }[] = [
  { type: 'page', label: '페이지' },
  { type: 'chapter', label: '챕터' },
  { type: 'lecture_num', label: '강의번호' },
  { type: 'custom', label: '자유입력' },
];

export function Step2RangeSettings({ data, onChange }: Step2RangeSettingsProps) {
  return (
    <div className="space-y-6">
      {/* 범위 유형 선택 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          범위 유형
        </label>
        <div className="flex gap-2 flex-wrap">
          {RANGE_TYPES.map(({ type, label }) => (
            <button
              key={type}
              type="button"
              onClick={() => onChange({ rangeType: type })}
              className={cn(
                'px-4 py-2 text-sm border rounded-full transition-colors',
                data.rangeType === type
                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 범위 입력 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          학습 범위
        </label>
        {data.rangeType !== 'custom' ? (
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">시작</label>
              <input
                type="text"
                placeholder={data.rangeType === 'page' ? '1' : data.rangeType === 'chapter' ? '1' : '1'}
                value={data.rangeStart}
                onChange={(e) => onChange({ rangeStart: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <span className="text-gray-400 mt-5">~</span>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">종료</label>
              <input
                type="text"
                placeholder={data.rangeType === 'page' ? '50' : data.rangeType === 'chapter' ? '10' : '20'}
                value={data.rangeEnd}
                onChange={(e) => onChange({ rangeEnd: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        ) : (
          <input
            type="text"
            placeholder="예: 1단원 ~ 3단원, 미적분 전 범위"
            value={data.customRange}
            onChange={(e) => onChange({ customRange: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        )}
      </div>

      {/* 예상 볼륨 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          예상 볼륨
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            placeholder="50"
            value={data.totalVolume}
            onChange={(e) => onChange({ totalVolume: e.target.value })}
            className="w-32 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <span className="text-sm text-gray-500">
            {data.rangeType === 'page' && '페이지'}
            {data.rangeType === 'chapter' && '챕터'}
            {data.rangeType === 'lecture_num' && '강의'}
            {data.rangeType === 'custom' && '단위'}
          </span>
        </div>
        <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
          <Info className="h-3 w-3" />
          일일 학습량 계산에 사용됩니다
        </p>
      </div>

      {/* 범위 미리보기 */}
      {(data.rangeStart || data.rangeEnd || data.customRange) && (
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="text-sm font-medium text-blue-700 mb-1">범위 미리보기</div>
          <div className="text-sm text-blue-600">
            {data.rangeType !== 'custom' ? (
              <>
                {data.rangeType === 'page' && '페이지'}
                {data.rangeType === 'chapter' && '챕터'}
                {data.rangeType === 'lecture_num' && '강의'}
                {' '}
                {data.rangeStart || '?'} ~ {data.rangeEnd || '?'}
                {data.totalVolume && ` (총 ${data.totalVolume}개)`}
              </>
            ) : (
              <>
                {data.customRange || '범위 미지정'}
                {data.totalVolume && ` (총 ${data.totalVolume}개)`}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
