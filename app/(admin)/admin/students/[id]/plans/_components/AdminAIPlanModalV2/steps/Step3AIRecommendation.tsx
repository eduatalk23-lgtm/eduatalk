'use client';

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertCircle, Sparkles, BookOpen, ChevronDown, ChevronUp, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAIPlanModalActions, useAIPlanModalSelectors } from '../context/AIPlanModalContext';
import { useAIRecommendation } from '../hooks/useAIRecommendation';
import type { ContentSlot, RecommendedContent, RangeConfig, SubjectClassification, StrategicConfig } from '@/lib/domains/admin-plan/types/aiPlanSlot';
import { canConfirmSlot } from '@/lib/domains/admin-plan/types/aiPlanSlot';

interface Step3AIRecommendationProps {
  studentId: string;
  tenantId: string;
}

export function Step3AIRecommendation({ studentId: _studentId, tenantId: _tenantId }: Step3AIRecommendationProps) {
  // studentId와 tenantId는 향후 기능 확장을 위해 예약됨
  void _studentId;
  void _tenantId;
  const { slots, confirmedCount, totalStrategicDays } = useAIPlanModalSelectors();
  const { executeAllRecommendations, executeSingleRecommendation, isExecuting, progress } = useAIRecommendation();

  // AI 추천 자동 실행 (스텝 진입 시)
  const aiSlots = slots.filter(s => s.type === 'ai_recommendation');
  const pendingAISlots = aiSlots.filter(s => s.status === 'configuring');

  useEffect(() => {
    if (pendingAISlots.length > 0 && !isExecuting) {
      executeAllRecommendations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      {/* 진행 상태 바 */}
      {isExecuting && (
        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-purple-700">
              AI 추천 진행 중... ({progress.current}/{progress.total})
            </span>
            <span className="text-xs text-purple-500">
              {progress.waitingForRateLimit && '(Rate limit 대기 중...)'}
            </span>
          </div>
          <div className="w-full h-2 bg-purple-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 transition-all duration-300"
              style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* 슬롯 목록 */}
      <div className="space-y-4">
        {slots.map((slot, index) => (
          <SlotConfigCard
            key={slot.id}
            slot={slot}
            index={index}
            onRetry={executeSingleRecommendation}
          />
        ))}
      </div>

      {/* 요약 */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-purple-600">{confirmedCount}/{slots.length}</div>
            <div className="text-xs text-gray-500">확정됨</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {slots.filter(s => s.subjectClassification === 'strategic').length}개
            </div>
            <div className="text-xs text-gray-500">전략 과목</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">
              {slots.filter(s => s.subjectClassification === 'weakness').length}개
            </div>
            <div className="text-xs text-gray-500">취약 과목</div>
          </div>
        </div>
        {totalStrategicDays > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200 text-center text-sm text-gray-600">
            전략 과목 주간 배정: 총 {totalStrategicDays}일
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 슬롯 설정 카드
// ============================================================================

interface SlotConfigCardProps {
  slot: ContentSlot;
  index: number;
  onRetry: (slotId: string) => Promise<void>;
}

function SlotConfigCard({ slot, index, onRetry }: SlotConfigCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const { selectRecommendation, setRangeConfig, setSubjectClassification, setStrategicConfig, confirmSlot, removeSlot } = useAIPlanModalActions();

  async function handleRetry() {
    setIsRetrying(true);
    try {
      await onRetry(slot.id);
    } finally {
      setIsRetrying(false);
    }
  }

  const isAI = slot.type === 'ai_recommendation';
  const isLoading = slot.status === 'loading';
  const hasError = slot.status === 'error';
  const isConfirmed = slot.status === 'confirmed';

  // 콘텐츠 정보 가져오기
  const contentInfo = isAI
    ? slot.aiResult?.selectedContent
    : slot.existingContent;

  const contentTitle = isAI
    ? (slot.aiResult?.selectedContent?.title ?? slot.aiConfig?.subjectCategory ?? '설정 중')
    : (slot.existingContent?.title ?? '미선택');

  const totalRange = contentInfo
    ? ('totalRange' in contentInfo ? contentInfo.totalRange : 0)
    : 0;

  const canConfirm = canConfirmSlot(slot);

  function handleConfirm() {
    if (canConfirm) {
      confirmSlot(slot.id);
    }
  }

  return (
    <div className={cn(
      'border-2 rounded-lg overflow-hidden transition-colors',
      isConfirmed && 'border-green-300 bg-green-50/50',
      isLoading && 'border-purple-300 bg-purple-50/50',
      hasError && 'border-red-300 bg-red-50/50',
      !isConfirmed && !isLoading && !hasError && (isAI ? 'border-purple-200' : 'border-blue-200')
    )}>
      {/* 헤더 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50/50"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-lg text-sm font-bold text-gray-600">
            #{index + 1}
          </div>
          <div>
            <div className="flex items-center gap-2">
              {isAI ? <Sparkles className="h-4 w-4 text-purple-500" /> : <BookOpen className="h-4 w-4 text-blue-500" />}
              <span className="font-medium text-gray-900">{contentTitle}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {isLoading && (
                <span className="flex items-center gap-1 text-xs text-purple-600">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  AI 추천 검색 중...
                </span>
              )}
              {hasError && (
                <span className="flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  {slot.errorMessage || '오류 발생'}
                </span>
              )}
              {isConfirmed && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  확정됨
                </span>
              )}
            </div>
          </div>
        </div>
        {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
      </button>

      {/* 에러 상태: 재시도/삭제 버튼 */}
      {isExpanded && hasError && (
        <div className="px-4 pb-4 pt-4 border-t border-red-100">
          <p className="text-sm text-red-600 mb-3">{slot.errorMessage || '오류가 발생했습니다.'}</p>
          <div className="flex gap-2">
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="flex-1 px-3 py-2 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
            >
              <RefreshCw className={cn('h-4 w-4', isRetrying && 'animate-spin')} />
              {isRetrying ? '재시도 중...' : '다시 시도'}
            </button>
            <button
              onClick={() => removeSlot(slot.id)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-1"
            >
              <Trash2 className="h-4 w-4" />
              삭제
            </button>
          </div>
        </div>
      )}

      {/* 내용 */}
      {isExpanded && !isLoading && !hasError && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
          {/* AI 추천 결과 선택 */}
          {isAI && slot.aiResult?.recommendations && slot.aiResult.recommendations.length > 0 && (
            <div className="pt-4">
              <label className="block text-xs font-medium text-gray-600 mb-2">콘텐츠 선택</label>
              <div className="space-y-2">
                {slot.aiResult.recommendations.slice(0, 3).map((rec) => (
                  <RecommendationOption
                    key={rec.tempId}
                    recommendation={rec}
                    isSelected={slot.aiResult?.selectedContent?.tempId === rec.tempId}
                    onSelect={() => selectRecommendation(slot.id, rec)}
                  />
                ))}
              </div>
              {slot.aiResult.stats?.usedFallback && (
                <p className="text-xs text-amber-600 mt-2">
                  * DB 캐시 결과 (Rate limit 우회)
                </p>
              )}
            </div>
          )}

          {/* 범위 설정 */}
          {(contentInfo || slot.rangeConfig) && (
            <RangeConfigForm
              config={slot.rangeConfig}
              totalRange={totalRange}
              contentType={isAI ? slot.aiResult?.selectedContent?.contentType : slot.existingContent?.contentType}
              onChange={(config) => setRangeConfig(slot.id, config)}
            />
          )}

          {/* 과목 분류 */}
          <SubjectClassificationForm
            classification={slot.subjectClassification}
            strategicConfig={slot.strategicConfig}
            onChange={(classification) => setSubjectClassification(slot.id, classification)}
            onStrategicChange={(config) => setStrategicConfig(slot.id, config)}
          />

          {/* 확정 버튼 */}
          {!isConfirmed && (
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className={cn(
                'w-full py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2',
                canConfirm
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )}
            >
              <CheckCircle2 className="h-4 w-4" />
              확정
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AI 추천 옵션
// ============================================================================

interface RecommendationOptionProps {
  recommendation: RecommendedContent;
  isSelected: boolean;
  onSelect: () => void;
}

function RecommendationOption({ recommendation, isSelected, onSelect }: RecommendationOptionProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full p-3 rounded-lg border-2 text-left transition-all',
        isSelected
          ? 'border-purple-500 bg-purple-50'
          : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/30'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 truncate">{recommendation.title}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {recommendation.author && `${recommendation.author} · `}
            {recommendation.totalRange}{recommendation.contentType === 'book' ? 'p' : '강'}
          </div>
          <div className="text-xs text-purple-600 mt-1">
            {recommendation.reason}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-2">
          <span className={cn(
            'px-2 py-0.5 rounded-full text-xs font-medium',
            recommendation.matchScore >= 90 ? 'bg-green-100 text-green-700' :
            recommendation.matchScore >= 80 ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-700'
          )}>
            {recommendation.matchScore}%
          </span>
          <div className={cn(
            'w-5 h-5 rounded-full border-2 flex items-center justify-center',
            isSelected ? 'border-purple-500 bg-purple-500' : 'border-gray-300'
          )}>
            {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
          </div>
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// 범위 설정 폼
// ============================================================================

interface RangeConfigFormProps {
  config?: RangeConfig;
  totalRange: number;
  contentType?: 'book' | 'lecture';
  onChange: (config: RangeConfig) => void;
}

function RangeConfigForm({ config, totalRange, contentType, onChange }: RangeConfigFormProps) {
  const unit = contentType === 'lecture' ? '강' : '페이지';
  const startRange = config?.startRange ?? 1;
  const endRange = config?.endRange ?? totalRange;
  const rangeAmount = endRange - startRange + 1;

  return (
    <div className="pt-4 border-t border-gray-100">
      <label className="block text-xs font-medium text-gray-600 mb-2">
        학습 범위
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={startRange}
          onChange={(e) => onChange({
            startRange: Math.max(1, Math.min(Number(e.target.value), endRange)),
            endRange,
          })}
          min={1}
          max={endRange}
          className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded-md text-center"
        />
        <span className="text-gray-400">~</span>
        <input
          type="number"
          value={endRange}
          onChange={(e) => onChange({
            startRange,
            endRange: Math.max(startRange, Math.min(Number(e.target.value), totalRange)),
          })}
          min={startRange}
          max={totalRange}
          className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded-md text-center"
        />
        <span className="text-sm text-gray-500">/ {totalRange}{unit}</span>
        <span className="text-xs text-purple-600 ml-2">
          ({rangeAmount}{unit} 학습)
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// 과목 분류 폼
// ============================================================================

interface SubjectClassificationFormProps {
  classification?: SubjectClassification;
  strategicConfig?: StrategicConfig;
  onChange: (classification: SubjectClassification) => void;
  onStrategicChange: (config: StrategicConfig) => void;
}

function SubjectClassificationForm({
  classification,
  strategicConfig,
  onChange,
  onStrategicChange,
}: SubjectClassificationFormProps) {
  return (
    <div className="pt-4 border-t border-gray-100">
      <label className="block text-xs font-medium text-gray-600 mb-2">과목 분류</label>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="classification"
            checked={classification === 'strategic'}
            onChange={() => onChange('strategic')}
            className="text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">전략 과목</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="classification"
            checked={classification === 'weakness'}
            onChange={() => onChange('weakness')}
            className="text-orange-600 focus:ring-orange-500"
          />
          <span className="text-sm text-gray-700">취약 과목</span>
        </label>
      </div>

      {/* 전략 과목 주간 배정일 */}
      {classification === 'strategic' && (
        <div className="mt-3 flex items-center gap-2">
          <label className="text-xs text-gray-600">주간 배정일:</label>
          <select
            value={strategicConfig?.weeklyDays ?? 3}
            onChange={(e) => onStrategicChange({ weeklyDays: Number(e.target.value) as 2 | 3 | 4 })}
            className="px-2 py-1 text-sm border border-gray-300 rounded-md"
          >
            <option value={2}>2일</option>
            <option value={3}>3일</option>
            <option value={4}>4일</option>
          </select>
        </div>
      )}
    </div>
  );
}
