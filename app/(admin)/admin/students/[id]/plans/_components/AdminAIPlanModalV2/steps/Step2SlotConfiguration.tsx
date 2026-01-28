'use client';

import { useState, useMemo } from 'react';
import { Sparkles, BookOpen, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAIPlanModalActions, useAIPlanModalSelectors } from '../context/AIPlanModalContext';
import type { ContentSlot, AIConfig, ExistingContentConfig, RangeConfig } from '@/lib/domains/admin-plan/types/aiPlanSlot';
import { SUPPORTED_SUBJECT_CATEGORIES, SUBJECTS_BY_CATEGORY, type SubjectCategory, type DifficultyLevel } from '@/lib/domains/plan/llm/actions/coldStart/types';
import { MasterContentSearchModal } from '../../admin-wizard/steps/_components/MasterContentSearchModal';
import type { SelectedContent } from '../../admin-wizard/_context/types';

interface Step2SlotConfigurationProps {
  studentId: string;
  tenantId: string;
}

export function Step2SlotConfiguration({ studentId, tenantId }: Step2SlotConfigurationProps) {
  const { slots } = useAIPlanModalSelectors();
  const { addSlot, removeSlot, setAIConfig, setExistingContent, setRangeConfig } = useAIPlanModalActions();

  // 마스터 콘텐츠 검색 모달 상태
  const [isMasterSearchOpen, setIsMasterSearchOpen] = useState(false);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);

  // 이미 추가된 콘텐츠 ID Set (중복 방지용)
  const existingContentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const slot of slots) {
      if (slot.existingContent?.contentId) {
        ids.add(slot.existingContent.contentId);
      }
    }
    return ids;
  }, [slots]);

  function openMasterSearch(slotId: string) {
    setActiveSlotId(slotId);
    setIsMasterSearchOpen(true);
  }

  function handleMasterContentSelected(content: SelectedContent) {
    if (!activeSlotId) return;

    // SelectedContent → ExistingContentConfig 매핑
    // MasterContentSearchModal은 book/lecture만 반환하므로 안전한 캐스팅
    const existingConfig: ExistingContentConfig = {
      contentId: content.contentId,
      contentType: content.contentType as "book" | "lecture",
      title: content.title,
      totalRange: content.totalRange,
      subjectCategory: content.subjectCategory,
      subject: content.subject,
    };

    // RangeConfig 설정 (모달에서 범위 선택됨)
    const rangeConfig: RangeConfig = {
      startRange: content.startRange,
      endRange: content.endRange,
    };

    setExistingContent(activeSlotId, existingConfig);
    setRangeConfig(activeSlotId, rangeConfig);

    // 모달 닫기
    setIsMasterSearchOpen(false);
    setActiveSlotId(null);
  }

  return (
    <div className="space-y-6">
      {/* 슬롯 추가 버튼 */}
      <div className="flex gap-3">
        <button
          onClick={() => addSlot('ai_recommendation')}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-purple-300 rounded-lg text-purple-600 hover:bg-purple-50 hover:border-purple-400 transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          <span className="font-medium">AI 추천 추가</span>
        </button>
        <button
          onClick={() => addSlot('existing_content')}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition-colors"
        >
          <BookOpen className="h-4 w-4" />
          <span className="font-medium">기존 콘텐츠 추가</span>
        </button>
      </div>

      {/* 슬롯 목록 */}
      {slots.length > 0 ? (
        <div className="space-y-3">
          {slots.map((slot, index) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              index={index}
              onRemove={() => removeSlot(slot.id)}
              onUpdateAIConfig={(config) => setAIConfig(slot.id, config)}
              onOpenMasterSearch={() => openMasterSearch(slot.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
          <p className="text-gray-500">슬롯을 추가하여 학습 콘텐츠를 구성하세요.</p>
          <p className="text-sm text-gray-400 mt-1">AI 추천 또는 기존 콘텐츠를 추가할 수 있습니다.</p>
        </div>
      )}

      {/* 슬롯 요약 */}
      {slots.length > 0 && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">총 {slots.length}개 슬롯</span>
            <div className="flex gap-4 text-gray-500">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-purple-500" />
                AI 추천: {slots.filter(s => s.type === 'ai_recommendation').length}개
              </span>
              <span className="flex items-center gap-1">
                <BookOpen className="h-3 w-3 text-blue-500" />
                기존: {slots.filter(s => s.type === 'existing_content').length}개
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 마스터 콘텐츠 검색 모달 */}
      <MasterContentSearchModal
        open={isMasterSearchOpen}
        onClose={() => {
          setIsMasterSearchOpen(false);
          setActiveSlotId(null);
        }}
        onSelect={handleMasterContentSelected}
        studentId={studentId}
        tenantId={tenantId}
        existingContentIds={existingContentIds}
        skipStudentCopy
      />
    </div>
  );
}

// ============================================================================
// 슬롯 카드 컴포넌트
// ============================================================================

interface SlotCardProps {
  slot: ContentSlot;
  index: number;
  onRemove: () => void;
  onUpdateAIConfig: (config: AIConfig) => void;
  onOpenMasterSearch: () => void;
}

function SlotCard({
  slot,
  index,
  onRemove,
  onUpdateAIConfig,
  onOpenMasterSearch,
}: SlotCardProps) {
  const isAI = slot.type === 'ai_recommendation';

  return (
    <div className={cn(
      'border-2 rounded-lg p-4 transition-colors',
      isAI ? 'border-purple-200 bg-purple-50/50' : 'border-blue-200 bg-blue-50/50'
    )}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 bg-gray-200 rounded text-xs font-medium text-gray-600">
            #{index + 1}
          </div>
          <div className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
            isAI ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
          )}>
            {isAI ? <Sparkles className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />}
            {isAI ? 'AI 추천' : '기존 콘텐츠'}
          </div>
        </div>
        <button
          onClick={onRemove}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
          title="슬롯 삭제"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* AI 추천 설정 */}
      {isAI && slot.aiConfig && (
        <AIConfigForm
          slotId={slot.id}
          config={slot.aiConfig}
          onChange={onUpdateAIConfig}
        />
      )}

      {/* 기존 콘텐츠 선택 */}
      {!isAI && (
        <ExistingContentDisplay
          selectedContent={slot.existingContent}
          rangeConfig={slot.rangeConfig}
          onOpenMasterSearch={onOpenMasterSearch}
        />
      )}
    </div>
  );
}

// ============================================================================
// AI 설정 폼
// ============================================================================

interface AIConfigFormProps {
  slotId: string;
  config: AIConfig;
  onChange: (config: AIConfig) => void;
}

function AIConfigForm({ slotId, config, onChange }: AIConfigFormProps) {
  const subjectOptions = config.subjectCategory
    ? SUBJECTS_BY_CATEGORY[config.subjectCategory as SubjectCategory] || []
    : [];

  return (
    <div className="space-y-3">
      {/* 교과 선택 */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            교과 <span className="text-red-500">*</span>
          </label>
          <select
            value={config.subjectCategory}
            onChange={(e) => onChange({
              ...config,
              subjectCategory: e.target.value,
              subject: undefined, // 교과 변경 시 과목 초기화
            })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">선택</option>
            {SUPPORTED_SUBJECT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">세부 과목</label>
          <select
            value={config.subject || ''}
            onChange={(e) => onChange({ ...config, subject: e.target.value || undefined })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            disabled={!config.subjectCategory}
          >
            <option value="">전체</option>
            {subjectOptions.map((subj) => (
              <option key={subj} value={subj}>{subj}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">난이도</label>
          <select
            value={config.difficulty}
            onChange={(e) => onChange({ ...config, difficulty: e.target.value as DifficultyLevel })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="개념">개념</option>
            <option value="기본">기본</option>
            <option value="심화">심화</option>
          </select>
        </div>
      </div>

      {/* 콘텐츠 타입 */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">콘텐츠 유형</label>
        <div className="flex gap-4">
          {(['book', 'lecture', 'all'] as const).map((type) => (
            <label key={type} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name={`contentType-${slotId}`}
                value={type}
                checked={config.contentType === type}
                onChange={() => onChange({ ...config, contentType: type })}
                className="text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700">
                {type === 'book' ? '교재' : type === 'lecture' ? '강의' : '전체'}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 기존 콘텐츠 표시 (모달로 선택)
// ============================================================================

interface ExistingContentDisplayProps {
  selectedContent?: ExistingContentConfig;
  rangeConfig?: RangeConfig;
  onOpenMasterSearch: () => void;
}

function ExistingContentDisplay({
  selectedContent,
  rangeConfig,
  onOpenMasterSearch,
}: ExistingContentDisplayProps) {
  if (selectedContent) {
    return (
      <div className="flex items-center justify-between p-3 bg-white rounded-md border border-blue-200">
        <div>
          <div className="font-medium text-gray-900">{selectedContent.title}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {selectedContent.subjectCategory}
            {selectedContent.subject && ` · ${selectedContent.subject}`}
            {selectedContent.totalRange && ` · ${selectedContent.totalRange}${selectedContent.contentType === 'book' ? '페이지' : '강'}`}
            {rangeConfig && ` · 범위: ${rangeConfig.startRange}~${rangeConfig.endRange}`}
          </div>
        </div>
        <button
          onClick={onOpenMasterSearch}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          변경
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onOpenMasterSearch}
      className="w-full p-3 border-2 border-dashed border-gray-300 rounded-md text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-colors"
    >
      콘텐츠 선택하기
    </button>
  );
}
