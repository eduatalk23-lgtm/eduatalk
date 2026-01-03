'use client';

import { Calendar, BookOpen, Video, Wand2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { SelectedContent, PlanPurpose } from '../types';

interface Step3ReviewCreateProps {
  periodStart: string;
  periodEnd: string;
  name: string;
  planPurpose: PlanPurpose;
  selectedContents: SelectedContent[];
  skipContents: boolean;
  generateAIPlan: boolean;
  isSubmitting: boolean;
  error: string | null;
  onSetGenerateAI: (generate: boolean) => void;
  onSubmit: () => void;
}

export function Step3ReviewCreate({
  periodStart,
  periodEnd,
  name,
  planPurpose,
  selectedContents,
  skipContents,
  generateAIPlan,
  isSubmitting,
  error,
  onSetGenerateAI,
  onSubmit,
}: Step3ReviewCreateProps) {
  // 기간 계산
  const getDaysDiff = () => {
    if (!periodStart || !periodEnd) return 0;
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getPurposeLabel = (purpose: PlanPurpose) => {
    if (!purpose) return '없음';
    return purpose; // '내신대비', '모의고사', '수능', '기타'
  };

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
        <h4 className="text-sm font-semibold text-gray-900">플랜 요약</h4>

        {/* 기간 */}
        <div className="flex items-start gap-3">
          <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-900">학습 기간</p>
            <p className="text-sm text-gray-600">
              {formatDate(periodStart)} ~ {formatDate(periodEnd)}
              <span className="ml-2 text-gray-400">({getDaysDiff()}일)</span>
            </p>
          </div>
        </div>

        {/* 이름 */}
        {name && (
          <div className="flex items-start gap-3">
            <div className="h-5 w-5 flex items-center justify-center text-gray-400">
              <span className="text-sm">📝</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">플랜 이름</p>
              <p className="text-sm text-gray-600">{name}</p>
            </div>
          </div>
        )}

        {/* 목적 */}
        {planPurpose && (
          <div className="flex items-start gap-3">
            <div className="h-5 w-5 flex items-center justify-center text-gray-400">
              <span className="text-sm">🎯</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">학습 목적</p>
              <p className="text-sm text-gray-600">{getPurposeLabel(planPurpose)}</p>
            </div>
          </div>
        )}

        {/* 콘텐츠 */}
        <div className="flex items-start gap-3">
          <BookOpen className="h-5 w-5 text-gray-400 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">
              선택된 콘텐츠
              {skipContents && (
                <span className="ml-2 text-xs text-gray-400">(건너뛰기)</span>
              )}
            </p>
            {selectedContents.length === 0 ? (
              <p className="text-sm text-gray-500">
                {skipContents
                  ? '콘텐츠 없이 플랜 그룹을 생성합니다.'
                  : '선택된 콘텐츠가 없습니다.'}
              </p>
            ) : (
              <ul className="mt-1 space-y-1">
                {selectedContents.map((content) => (
                  <li
                    key={content.contentId}
                    className="flex items-center gap-2 text-sm text-gray-600"
                  >
                    {content.contentType === 'book' ? (
                      <BookOpen className="h-3.5 w-3.5 text-gray-400" />
                    ) : (
                      <Video className="h-3.5 w-3.5 text-gray-400" />
                    )}
                    <span className="truncate">{content.title}</span>
                    <span className="text-gray-400">
                      ({content.startRange}-{content.endRange})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* AI 플랜 생성 옵션 */}
      <div
        className={cn(
          'rounded-lg border p-4 transition',
          generateAIPlan
            ? 'border-purple-300 bg-purple-50'
            : 'border-gray-200 bg-white'
        )}
      >
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={generateAIPlan}
            onChange={(e) => onSetGenerateAI(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-gray-900">
                AI 플랜 생성
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              플랜 그룹 생성 후 AI가 자동으로 학습 일정을 생성합니다.
            </p>
          </div>
        </label>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 생성 버튼 */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting}
        className={cn(
          'w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition',
          isSubmitting
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'
        )}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            생성 중...
          </>
        ) : (
          <>
            플랜 그룹 생성
            {generateAIPlan && ' + AI 생성'}
          </>
        )}
      </button>
    </div>
  );
}
