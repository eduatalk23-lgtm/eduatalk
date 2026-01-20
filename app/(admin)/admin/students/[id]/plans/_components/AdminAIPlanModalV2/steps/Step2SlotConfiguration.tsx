'use client';

import { useState, useEffect } from 'react';
import { Sparkles, BookOpen, Trash2, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAIPlanModalActions, useAIPlanModalSelectors } from '../context/AIPlanModalContext';
import type { ContentSlot, AIConfig, ExistingContentConfig } from '@/lib/domains/admin-plan/types/aiPlanSlot';
import { SUPPORTED_SUBJECT_CATEGORIES, SUBJECTS_BY_CATEGORY, type SubjectCategory, type DifficultyLevel } from '@/lib/domains/plan/llm/actions/coldStart/types';
import { getFlexibleContents } from '@/lib/domains/admin-plan/actions';
import { searchMasterBooks } from '@/lib/data/contentMasters/books';
import { searchMasterLectures } from '@/lib/data/contentMasters/lectures';

interface Step2SlotConfigurationProps {
  studentId: string;
  tenantId: string;
}

interface SelectableContent {
  id: string;
  title: string;
  subject: string;
  subjectCategory: string;
  contentType: 'book' | 'lecture';
  totalRange?: number;
}

export function Step2SlotConfiguration({ studentId, tenantId }: Step2SlotConfigurationProps) {
  const { slots } = useAIPlanModalSelectors();
  const { addSlot, removeSlot, setAIConfig, setExistingContent } = useAIPlanModalActions();

  // 기존 콘텐츠 관련 상태
  const [existingContents, setExistingContents] = useState<SelectableContent[]>([]);
  const [isLoadingContents, setIsLoadingContents] = useState(false);
  const [contentSearchQuery, setContentSearchQuery] = useState('');
  const [selectingSlotId, setSelectingSlotId] = useState<string | null>(null);

  // 기존 콘텐츠 로드
  useEffect(() => {
    const hasExistingSlot = slots.some(s => s.type === 'existing_content');
    if (hasExistingSlot && existingContents.length === 0) {
      loadExistingContents();
    }
  }, [slots]);

  async function loadExistingContents() {
    try {
      setIsLoadingContents(true);

      const [flexibleResult, booksResult, lecturesResult] = await Promise.all([
        getFlexibleContents({ student_id: studentId }),
        searchMasterBooks({ tenantId, limit: 50 }),
        searchMasterLectures({ tenantId, limit: 50 }),
      ]);

      const contents: SelectableContent[] = [];

      // Flexible contents
      if (flexibleResult.success && flexibleResult.data?.data) {
        flexibleResult.data.data.forEach((fc: {
          id: string;
          title?: string | null;
          subject?: string | null;
          subject_area?: string | null;
          content_type?: string | null;
          total_pages?: number | null;
          total_episodes?: number | null;
        }) => {
          contents.push({
            id: fc.id,
            title: fc.title || '제목 없음',
            subject: fc.subject || '',
            subjectCategory: fc.subject_area || '',
            contentType: fc.content_type === 'lecture' ? 'lecture' : 'book',
            totalRange: fc.total_pages || fc.total_episodes || undefined,
          });
        });
      }

      // Master books
      if (booksResult.data) {
        booksResult.data.forEach((book: {
          id: string;
          title: string;
          subject?: string | null;
          subject_category?: string | null;
          total_pages?: number | null;
        }) => {
          contents.push({
            id: book.id,
            title: book.title,
            subject: book.subject || '',
            subjectCategory: book.subject_category || '',
            contentType: 'book',
            totalRange: book.total_pages || undefined,
          });
        });
      }

      // Master lectures
      if (lecturesResult.data) {
        lecturesResult.data.forEach((lecture: {
          id: string;
          title: string;
          subject?: string | null;
          subject_category?: string | null;
          total_episodes?: number | null;
        }) => {
          contents.push({
            id: lecture.id,
            title: lecture.title,
            subject: lecture.subject || '',
            subjectCategory: lecture.subject_category || '',
            contentType: 'lecture',
            totalRange: lecture.total_episodes || undefined,
          });
        });
      }

      setExistingContents(contents);
    } catch (err) {
      console.error('Failed to load contents:', err);
    } finally {
      setIsLoadingContents(false);
    }
  }

  const filteredContents = existingContents.filter(content => {
    if (!contentSearchQuery) return true;
    const query = contentSearchQuery.toLowerCase();
    return (
      content.title.toLowerCase().includes(query) ||
      content.subject.toLowerCase().includes(query) ||
      content.subjectCategory.toLowerCase().includes(query)
    );
  });

  function handleSelectExistingContent(slotId: string, content: SelectableContent) {
    const existingConfig: ExistingContentConfig = {
      contentId: content.id,
      contentType: content.contentType,
      title: content.title,
      totalRange: content.totalRange ?? 100,
      subjectCategory: content.subjectCategory,
      subject: content.subject,
    };
    setExistingContent(slotId, existingConfig);
    setSelectingSlotId(null);
    setContentSearchQuery('');
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
              onSelectContent={() => setSelectingSlotId(slot.id)}
              isSelectingContent={selectingSlotId === slot.id}
              filteredContents={filteredContents}
              contentSearchQuery={contentSearchQuery}
              onSearchChange={setContentSearchQuery}
              onContentSelect={(content) => handleSelectExistingContent(slot.id, content)}
              isLoadingContents={isLoadingContents}
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
  onSelectContent: () => void;
  isSelectingContent: boolean;
  filteredContents: SelectableContent[];
  contentSearchQuery: string;
  onSearchChange: (query: string) => void;
  onContentSelect: (content: SelectableContent) => void;
  isLoadingContents: boolean;
}

function SlotCard({
  slot,
  index,
  onRemove,
  onUpdateAIConfig,
  onSelectContent,
  isSelectingContent,
  filteredContents,
  contentSearchQuery,
  onSearchChange,
  onContentSelect,
  isLoadingContents,
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
          config={slot.aiConfig}
          onChange={onUpdateAIConfig}
        />
      )}

      {/* 기존 콘텐츠 선택 */}
      {!isAI && (
        <ExistingContentSelector
          selectedContent={slot.existingContent}
          onSelectClick={onSelectContent}
          isSelecting={isSelectingContent}
          filteredContents={filteredContents}
          searchQuery={contentSearchQuery}
          onSearchChange={onSearchChange}
          onContentSelect={onContentSelect}
          isLoading={isLoadingContents}
        />
      )}
    </div>
  );
}

// ============================================================================
// AI 설정 폼
// ============================================================================

interface AIConfigFormProps {
  config: AIConfig;
  onChange: (config: AIConfig) => void;
}

function AIConfigForm({ config, onChange }: AIConfigFormProps) {
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
                name="contentType"
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
// 기존 콘텐츠 선택기
// ============================================================================

interface ExistingContentSelectorProps {
  selectedContent?: ExistingContentConfig;
  onSelectClick: () => void;
  isSelecting: boolean;
  filteredContents: SelectableContent[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onContentSelect: (content: SelectableContent) => void;
  isLoading: boolean;
}

function ExistingContentSelector({
  selectedContent,
  onSelectClick,
  isSelecting,
  filteredContents,
  searchQuery,
  onSearchChange,
  onContentSelect,
  isLoading,
}: ExistingContentSelectorProps) {
  if (selectedContent) {
    return (
      <div className="flex items-center justify-between p-3 bg-white rounded-md border border-blue-200">
        <div>
          <div className="font-medium text-gray-900">{selectedContent.title}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {selectedContent.subjectCategory}
            {selectedContent.subject && ` · ${selectedContent.subject}`}
            {selectedContent.totalRange && ` · ${selectedContent.totalRange}${selectedContent.contentType === 'book' ? '페이지' : '강'}`}
          </div>
        </div>
        <button
          onClick={onSelectClick}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          변경
        </button>
      </div>
    );
  }

  if (isSelecting) {
    return (
      <div className="space-y-2">
        {/* 검색 */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="콘텐츠 검색..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />
        </div>

        {/* 콘텐츠 목록 */}
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md divide-y">
            {filteredContents.length > 0 ? (
              filteredContents.slice(0, 20).map((content) => (
                <button
                  key={content.id}
                  onClick={() => onContentSelect(content)}
                  className="w-full p-2.5 text-left hover:bg-blue-50 transition-colors"
                >
                  <div className="font-medium text-gray-900 text-sm truncate">
                    {content.title}
                  </div>
                  <div className="text-xs text-gray-500">
                    {content.subjectCategory} · {content.contentType === 'book' ? '교재' : '강의'}
                    {content.totalRange && ` · ${content.totalRange}${content.contentType === 'book' ? 'p' : '강'}`}
                  </div>
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-sm text-gray-500">
                검색 결과가 없습니다.
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={onSelectClick}
      className="w-full p-3 border-2 border-dashed border-gray-300 rounded-md text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-colors"
    >
      콘텐츠 선택하기
    </button>
  );
}
