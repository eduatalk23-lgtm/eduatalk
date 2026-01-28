'use client';

import { useEffect, useState, useRef } from 'react';
import { Loader2, CheckCircle2, AlertCircle, Sparkles, XCircle, RefreshCcw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAIPlanModalSelectors, useAIPlanModalActions } from '../context/AIPlanModalContext';
import { generateSlotBasedPlanAction } from '@/lib/domains/admin-plan/actions/generateSlotBasedPlan';
import { toConfirmedSlot } from '@/lib/domains/admin-plan/types/aiPlanSlot';

interface Step4GenerationResultProps {
  studentId: string;
  tenantId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function Step4GenerationResult({
  studentId,
  tenantId,
  onSuccess,
  onClose,
}: Step4GenerationResultProps) {
  const {
    confirmedSlots,
    selectedPlannerId,
    periodStart,
    periodEnd,
    generationResult,
  } = useAIPlanModalSelectors();
  const { setGenerationResult, setError } = useAIPlanModalActions();

  const [isGenerating, setIsGenerating] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);

  // 중복 실행 방지를 위한 ref (state와 달리 동기적으로 업데이트됨)
  const hasInitiatedRef = useRef(false);

  // 생성 자동 실행 (마운트 시 1회만 실행)
  useEffect(() => {
    // ref로 중복 실행 방지 (React.StrictMode 및 기타 재렌더링 대응)
    if (!generationResult && !isGenerating && confirmedSlots.length > 0 && !hasInitiatedRef.current) {
      hasInitiatedRef.current = true;
      handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 성공 시 자동 닫기
  useEffect(() => {
    if (generationResult?.success) {
      const timer = setTimeout(() => {
        onSuccess();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [generationResult?.success, onSuccess]);

  async function handleGenerate() {
    if (!selectedPlannerId) {
      setError('플래너가 선택되지 않았습니다.');
      return;
    }

    setIsGenerating(true);
    const startTime = Date.now();

    try {
      // 확정된 슬롯 변환
      const confirmedSlotData = confirmedSlots
        .map(slot => toConfirmedSlot(slot))
        .filter((slot): slot is NonNullable<typeof slot> => slot !== null);

      if (confirmedSlotData.length === 0) {
        throw new Error('확정된 슬롯이 없습니다.');
      }

      // 진행 상태 시뮬레이션
      const progressInterval = setInterval(() => {
        setCurrentProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      // Server Action 호출
      const result = await generateSlotBasedPlanAction({
        studentId,
        tenantId,
        plannerId: selectedPlannerId,
        periodStart,
        periodEnd,
        slots: confirmedSlotData,
      });

      clearInterval(progressInterval);
      setCurrentProgress(100);

      setGenerationResult({
        success: result.success,
        results: result.results ?? [],
        totalPlans: result.totalPlans ?? 0,
        processingTimeMs: Date.now() - startTime,
      });

      if (!result.success) {
        throw new Error(result.error || '플랜 생성에 실패했습니다.');
      }
    } catch (err) {
      console.error('Generation failed:', err);
      setError(err instanceof Error ? err.message : '플랜 생성에 실패했습니다.');
      setGenerationResult({
        success: false,
        results: [],
        totalPlans: 0,
        processingTimeMs: Date.now() - startTime,
      });
    } finally {
      setIsGenerating(false);
    }
  }

  // 생성 중
  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
        <h3 className="mt-6 text-lg font-semibold text-gray-900">플랜 생성 중...</h3>
        <p className="mt-2 text-sm text-gray-500">
          {confirmedSlots.length}개 콘텐츠에 대한 플랜을 생성하고 있습니다.
        </p>

        {/* 진행 바 */}
        <div className="w-full max-w-xs mt-6">
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 transition-all duration-300"
              style={{ width: `${currentProgress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 text-center mt-2">{currentProgress}%</p>
        </div>
      </div>
    );
  }

  // 성공
  if (generationResult?.success) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="mt-4 text-xl font-semibold text-gray-900">플랜 생성 완료!</h3>
          <p className="mt-2 text-sm text-gray-500">
            {generationResult.results.length}개 플랜 그룹, 총 {generationResult.totalPlans}개 플랜이 생성되었습니다.
          </p>
          {generationResult.processingTimeMs && (
            <p className="text-xs text-gray-400 mt-1">
              처리 시간: {(generationResult.processingTimeMs / 1000).toFixed(1)}초
            </p>
          )}
        </div>

        {/* 결과 목록 */}
        <div className="border border-gray-200 rounded-lg divide-y">
          {generationResult.results.map((result, index) => (
            <div key={result.slotId} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg',
                  result.success ? 'bg-green-100' : 'bg-red-100'
                )}>
                  {result.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
                <div>
                  <div className="font-medium text-gray-900">{result.contentTitle}</div>
                  <div className="text-xs text-gray-500">
                    {result.success
                      ? `${result.planCount}개 플랜 생성`
                      : result.error || '생성 실패'}
                  </div>
                  {result.warning && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      <span>{result.warning}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400">
          잠시 후 자동으로 닫힙니다...
        </p>
      </div>
    );
  }

  // 실패
  if (generationResult && !generationResult.success) {
    const hasResults = generationResult.results.length > 0;
    const hasPartialSuccess = hasResults && generationResult.results.some(r => r.success);
    const allFailed = hasResults && generationResult.results.every(r => !r.success);

    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">생성 실패</h3>
        <p className="mt-2 text-sm text-red-600">
          플랜 생성 중 오류가 발생했습니다.
        </p>

        {/* 결과 상세 - 부분 성공 또는 전체 실패 모두 표시 */}
        {hasResults ? (
          <div className="mt-6 w-full max-w-md">
            <p className="text-sm text-gray-600 mb-2">
              {hasPartialSuccess ? '부분 성공 결과:' : '실패 상세:'}
            </p>
            <div className="border border-gray-200 rounded-lg divide-y max-h-60 overflow-y-auto">
              {generationResult.results.map((result) => (
                <div key={result.slotId} className="p-3">
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    )}
                    <span className="text-sm text-gray-700 truncate flex-1">
                      {result.contentTitle}
                    </span>
                    <span className="text-xs text-gray-400">
                      {result.success ? `${result.planCount}개` : '실패'}
                    </span>
                  </div>
                  {/* 개별 슬롯 에러 메시지 표시 */}
                  {!result.success && result.error && (
                    <p className="mt-1 ml-6 text-xs text-red-500 break-words">
                      {result.error}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6 w-full max-w-md">
            <p className="text-sm text-red-600 text-center">
              서버에서 상세 에러 정보를 확인할 수 없습니다.
              <br />
              <span className="text-xs text-gray-500">브라우저 개발자 도구 콘솔 또는 서버 로그를 확인해주세요.</span>
            </p>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleGenerate}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
          >
            <RefreshCcw className="h-4 w-4" />
            다시 시도
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            닫기
          </button>
        </div>
      </div>
    );
  }

  // 초기 상태 (자동 실행 전)
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Sparkles className="h-12 w-12 text-purple-300" />
      <p className="mt-4 text-sm text-gray-500">플랜 생성을 시작합니다...</p>
    </div>
  );
}
