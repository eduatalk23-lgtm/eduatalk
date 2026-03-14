'use client';

import { useState, useTransition } from 'react';
import { createFlexibleContent } from '@/lib/domains/admin-plan/actions/flexibleContent';
import {
  createPlanFromContent,
  createPlanFromContentWithScheduler,
} from '@/lib/domains/admin-plan/actions/createPlanFromContent';
import { cn } from '@/lib/cn';
import type { ContentType, RangeType } from '@/lib/domains/admin-plan/types';
import { usePlanToast } from './PlanToast';

interface AddContentModalProps {
  studentId: string;
  tenantId: string;
  targetDate: string;
  /** 캘린더 ID */
  calendarId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

type DistributionMode = 'today' | 'period';

export function AddContentModal({
  studentId,
  tenantId,
  targetDate,
  calendarId,
  onClose,
  onSuccess,
}: AddContentModalProps) {
  const [isPending, startTransition] = useTransition();
  const { showToast } = usePlanToast();

  // 콘텐츠 유형
  const [contentType, setContentType] = useState<ContentType>('book');

  // 과목 정보
  const [curriculum, setCurriculum] = useState('2022 개정');
  const [subjectArea, setSubjectArea] = useState('');
  const [subject, setSubject] = useState('');

  // 콘텐츠 정보
  const [title, setTitle] = useState('');
  const [linkMaster, setLinkMaster] = useState(false);

  // 범위 정보
  const [rangeType, setRangeType] = useState<RangeType>('page');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [customRange, setCustomRange] = useState('');
  const [totalVolume, setTotalVolume] = useState('');

  // 배치 방식
  const [distributionMode, setDistributionMode] = useState<DistributionMode>('today');
  const [periodStart, setPeriodStart] = useState(targetDate);
  const [periodEnd, setPeriodEnd] = useState('');

  // 스케줄러 옵션 (today 모드 전용)
  const [useScheduler, setUseScheduler] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      showToast('콘텐츠 제목을 입력하세요', 'warning');
      return;
    }

    // 기간 배치 시 종료일 필수
    if (distributionMode === 'period' && !periodEnd) {
      showToast('종료 날짜를 선택하세요', 'warning');
      return;
    }

    startTransition(async () => {
      // 1. 유연한 콘텐츠 생성
      const contentResult = await createFlexibleContent({
        tenant_id: tenantId,
        content_type: contentType,
        title: title.trim(),
        curriculum: curriculum || null,
        subject_area: subjectArea || null,
        subject: subject || null,
        range_type: rangeType,
        range_start: rangeType === 'custom' ? customRange : rangeStart || null,
        range_end: rangeType === 'custom' ? null : rangeEnd || null,
        total_volume: totalVolume ? Number(totalVolume) : null,
        student_id: studentId,
      });

      if (!contentResult.success || !contentResult.data) {
        showToast('콘텐츠 생성 실패: ' + contentResult.error, 'error');
        return;
      }

      // 2. 배치 방식에 따른 플랜 생성
      // period 모드: 스케줄러 활용 (기존 타임라인 고려)
      // today/weekly 모드: 기존 로직 유지
      const planInput = {
        flexibleContentId: contentResult.data.id,
        contentTitle: title.trim(),
        contentSubject: subject || subjectArea || null,
        rangeStart: rangeType !== 'custom' && rangeStart ? Number(rangeStart) : null,
        rangeEnd: rangeType !== 'custom' && rangeEnd ? Number(rangeEnd) : null,
        customRangeDisplay: rangeType === 'custom' ? customRange : null,
        totalVolume: totalVolume ? Number(totalVolume) : null,
        distributionMode,
        targetDate: distributionMode === 'period' ? periodStart : targetDate,
        periodEndDate: distributionMode === 'period' ? periodEnd : undefined,
        studentId,
        tenantId,
        calendarId,
        // today 모드에서만 스케줄러 옵션 전달
        useScheduler: distributionMode === 'today' ? useScheduler : false,
      };

      const planResult =
        distributionMode === 'period'
          ? await createPlanFromContentWithScheduler(planInput)
          : await createPlanFromContent(planInput);

      if (!planResult.success) {
        showToast('플랜 생성 실패: ' + planResult.error, 'error');
        return;
      }

      const modeLabel = distributionMode === 'today' ? 'Daily' : '기간';
      showToast(`${modeLabel}에 ${planResult.data?.createdCount || 1}개 플랜 추가됨`, 'success');
      onSuccess();
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={cn(
          'bg-white dark:bg-[rgb(var(--color-secondary-50))] rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto',
          isPending && 'opacity-50 pointer-events-none'
        )}
      >
        {/* 헤더 */}
        <div className="p-4 border-b sticky top-0 bg-white dark:bg-[rgb(var(--color-secondary-50))]">
          <h2 className="text-lg font-bold">콘텐츠 추가</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-6">
            {/* 콘텐츠 유형 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                콘텐츠 유형
              </label>
              <div className="flex gap-3">
                {(['book', 'lecture', 'custom'] as ContentType[]).map((type) => (
                  <label
                    key={type}
                    className={cn(
                      'flex-1 py-2 px-3 text-center border rounded-lg cursor-pointer',
                      contentType === type
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:border-gray-600'
                    )}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      checked={contentType === type}
                      onChange={() => setContentType(type)}
                    />
                    {type === 'book' && '📚 교재'}
                    {type === 'lecture' && '🎬 강의'}
                    {type === 'custom' && '📝 커스텀'}
                  </label>
                ))}
              </div>
            </div>

            {/* 과목 정보 */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                과목 정보
              </label>
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={curriculum}
                  onChange={(e) => setCurriculum(e.target.value)}
                  className="px-3 py-2 border rounded-md text-sm"
                >
                  <option value="">개정과정</option>
                  <option value="2022 개정">2022 개정</option>
                  <option value="2015 개정">2015 개정</option>
                </select>
                <select
                  value={subjectArea}
                  onChange={(e) => setSubjectArea(e.target.value)}
                  className="px-3 py-2 border rounded-md text-sm"
                >
                  <option value="">교과</option>
                  <option value="국어">국어</option>
                  <option value="수학">수학</option>
                  <option value="영어">영어</option>
                  <option value="과학">과학</option>
                  <option value="사회">사회</option>
                </select>
                <input
                  type="text"
                  placeholder="과목명"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="px-3 py-2 border rounded-md text-sm"
                />
              </div>
            </div>

            {/* 콘텐츠 정보 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                콘텐츠 제목 <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="예: 개념원리 수학1"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                required
              />

              <label className="flex items-center gap-2 mt-3 text-sm text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={linkMaster}
                  onChange={(e) => setLinkMaster(e.target.checked)}
                />
                마스터 콘텐츠 연결 (선택)
              </label>
            </div>

            {/* 범위 지정 */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                범위 지정
              </label>

              {/* 범위 유형 */}
              <div className="flex gap-2 flex-wrap">
                {(['page', 'chapter', 'lecture_num', 'custom'] as RangeType[]).map(
                  (type) => (
                    <label
                      key={type}
                      className={cn(
                        'px-3 py-1.5 text-sm border rounded-full cursor-pointer',
                        rangeType === type
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700'
                          : 'border-gray-200 dark:border-gray-700'
                      )}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        checked={rangeType === type}
                        onChange={() => setRangeType(type)}
                      />
                      {type === 'page' && '페이지'}
                      {type === 'chapter' && '챕터'}
                      {type === 'lecture_num' && '강의번호'}
                      {type === 'custom' && '자유입력'}
                    </label>
                  )
                )}
              </div>

              {/* 범위 입력 */}
              {rangeType !== 'custom' ? (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 dark:text-gray-400 text-sm">시작:</span>
                  <input
                    type="text"
                    placeholder="1"
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                    className="w-20 px-3 py-2 border rounded-md text-sm"
                  />
                  <span className="text-gray-500 dark:text-gray-400 text-sm">종료:</span>
                  <input
                    type="text"
                    placeholder="50"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                    className="w-20 px-3 py-2 border rounded-md text-sm"
                  />
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="예: 1단원 ~ 3단원"
                  value={customRange}
                  onChange={(e) => setCustomRange(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              )}

              {/* 예상 볼륨 */}
              <div className="flex items-center gap-2">
                <span className="text-gray-500 dark:text-gray-400 text-sm">예상 볼륨:</span>
                <input
                  type="number"
                  placeholder="50"
                  value={totalVolume}
                  onChange={(e) => setTotalVolume(e.target.value)}
                  className="w-20 px-3 py-2 border rounded-md text-sm"
                />
                <span className="text-gray-400 dark:text-gray-500 text-sm">(일일 학습량 계산용)</span>
              </div>
            </div>

            {/* 배치 방식 */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                배치 방식
              </label>

              <label
                className={cn(
                  'flex items-center gap-3 p-3 border rounded-lg cursor-pointer',
                  distributionMode === 'today' && 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                )}
              >
                <input
                  type="radio"
                  checked={distributionMode === 'today'}
                  onChange={() => setDistributionMode('today')}
                />
                <div className="flex-1">
                  <div className="font-medium">오늘만 추가 (Daily Dock)</div>
                  {/* today 모드에서만 스케줄러 옵션 표시 */}
                  {distributionMode === 'today' && (
                    <label
                      className="flex items-center gap-2 mt-2 text-sm text-gray-600 dark:text-gray-400"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={useScheduler}
                        onChange={(e) => setUseScheduler(e.target.checked)}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      자동 시간 배정 (기존 플랜 고려)
                    </label>
                  )}
                </div>
              </label>

              <label
                className={cn(
                  'flex items-center gap-3 p-3 border rounded-lg cursor-pointer',
                  distributionMode === 'period' && 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                )}
              >
                <input
                  type="radio"
                  checked={distributionMode === 'period'}
                  onChange={() => setDistributionMode('period')}
                />
                <div className="flex-1">
                  <div className="font-medium">기간에 걸쳐 분배</div>
                  {distributionMode === 'period' && (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="date"
                        value={periodStart}
                        onChange={(e) => setPeriodStart(e.target.value)}
                        className="px-2 py-1 border rounded text-sm"
                      />
                      <span>~</span>
                      <input
                        type="date"
                        value={periodEnd}
                        onChange={(e) => setPeriodEnd(e.target.value)}
                        className="px-2 py-1 border rounded text-sm"
                      />
                    </div>
                  )}
                </div>
              </label>

            </div>
          </div>

          {/* 푸터 */}
          <div className="p-4 border-t flex justify-end gap-2 sticky bottom-0 bg-white dark:bg-[rgb(var(--color-secondary-50))]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 rounded-md"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md"
            >
              추가
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
