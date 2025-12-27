'use client';

/**
 * 커스텀 콘텐츠 생성/수정 폼 (Phase 5: 커스텀 콘텐츠 고도화)
 */

import { useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/ToastProvider';
import {
  type CustomContent,
  type CustomContentInput,
  type RangeType,
  type DifficultyLevel,
  getRangeTypeDefaultUnit,
} from '@/lib/domains/content/types';
import {
  createEnhancedCustomContent,
  updateEnhancedCustomContent,
} from '@/lib/domains/content';

interface CustomContentFormProps {
  studentId: string;
  tenantId?: string | null;
  initialData?: CustomContent;
  onSuccess?: (content: CustomContent) => void;
  onCancel?: () => void;
  className?: string;
}

const RANGE_TYPE_OPTIONS: { value: RangeType; label: string }[] = [
  { value: 'page', label: '페이지' },
  { value: 'time', label: '시간 (분)' },
  { value: 'chapter', label: '장/챕터' },
  { value: 'unit', label: '단원' },
  { value: 'custom', label: '사용자 정의' },
];

const DIFFICULTY_OPTIONS: { value: DifficultyLevel; label: string }[] = [
  { value: 'easy', label: '쉬움' },
  { value: 'medium', label: '보통' },
  { value: 'hard', label: '어려움' },
];

const COLOR_OPTIONS = [
  { value: '#3B82F6', label: '파랑' },
  { value: '#10B981', label: '초록' },
  { value: '#F59E0B', label: '노랑' },
  { value: '#EF4444', label: '빨강' },
  { value: '#8B5CF6', label: '보라' },
  { value: '#EC4899', label: '핑크' },
  { value: '#6B7280', label: '회색' },
];

export function CustomContentForm({
  studentId,
  tenantId,
  initialData,
  onSuccess,
  onCancel,
  className,
}: CustomContentFormProps) {
  const [isPending, startTransition] = useTransition();
  const { showSuccess, showError } = useToast();

  const isEdit = !!initialData;

  // Form state
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [rangeType, setRangeType] = useState<RangeType>(initialData?.rangeType ?? 'page');
  const [rangeStart, setRangeStart] = useState<string>(initialData?.rangeStart?.toString() ?? '');
  const [rangeEnd, setRangeEnd] = useState<string>(initialData?.rangeEnd?.toString() ?? '');
  const [rangeUnit, setRangeUnit] = useState(initialData?.rangeUnit ?? '');
  const [subject, setSubject] = useState(initialData?.subject ?? '');
  const [subjectCategory, setSubjectCategory] = useState(initialData?.subjectCategory ?? '');
  const [difficulty, setDifficulty] = useState<DifficultyLevel | ''>(initialData?.difficulty ?? '');
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>(
    initialData?.estimatedMinutes?.toString() ?? ''
  );
  const [tags, setTags] = useState<string>(initialData?.tags?.join(', ') ?? '');
  const [color, setColor] = useState(initialData?.color ?? '#3B82F6');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      showError('제목을 입력해주세요.');
      return;
    }

    startTransition(async () => {
      const input: CustomContentInput = {
        studentId,
        tenantId,
        title: title.trim(),
        description: description.trim() || null,
        rangeType,
        rangeStart: rangeStart ? parseInt(rangeStart, 10) : null,
        rangeEnd: rangeEnd ? parseInt(rangeEnd, 10) : null,
        rangeUnit: rangeUnit.trim() || null,
        subject: subject.trim() || null,
        subjectCategory: subjectCategory.trim() || null,
        difficulty: difficulty || null,
        estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes, 10) : null,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : null,
        color: color || null,
      };

      let result;
      if (isEdit && initialData) {
        const { studentId: _, tenantId: __, ...updates } = input;
        result = await updateEnhancedCustomContent(initialData.id, updates);
      } else {
        result = await createEnhancedCustomContent(input);
      }

      if (!result.success) {
        showError(result.error || '저장에 실패했습니다.');
        return;
      }

      showSuccess(isEdit ? '콘텐츠가 수정되었습니다.' : '콘텐츠가 생성되었습니다.');
      onSuccess?.(result.data!);
    });
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-6', className)}>
      {/* 기본 정보 */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">기본 정보</h3>

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            제목 <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="예: 수학 문제집, 영어 단어장"
            required
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            설명
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="콘텐츠에 대한 간단한 설명"
          />
        </div>
      </div>

      {/* 범위 설정 */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">범위 설정</h3>

        <div>
          <label htmlFor="rangeType" className="block text-sm font-medium text-gray-700">
            범위 유형
          </label>
          <select
            id="rangeType"
            value={rangeType}
            onChange={(e) => {
              const newType = e.target.value as RangeType;
              setRangeType(newType);
              if (newType !== 'custom') {
                setRangeUnit('');
              }
            }}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {RANGE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="rangeStart" className="block text-sm font-medium text-gray-700">
              시작 {getRangeTypeDefaultUnit(rangeType) || rangeUnit}
            </label>
            <input
              id="rangeStart"
              type="number"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
              min="0"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="1"
            />
          </div>
          <div>
            <label htmlFor="rangeEnd" className="block text-sm font-medium text-gray-700">
              종료 {getRangeTypeDefaultUnit(rangeType) || rangeUnit}
            </label>
            <input
              id="rangeEnd"
              type="number"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
              min="0"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="100"
            />
          </div>
        </div>

        {rangeType === 'custom' && (
          <div>
            <label htmlFor="rangeUnit" className="block text-sm font-medium text-gray-700">
              사용자 정의 단위
            </label>
            <input
              id="rangeUnit"
              type="text"
              value={rangeUnit}
              onChange={(e) => setRangeUnit(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="예: 문제, 세트, 회차"
            />
          </div>
        )}
      </div>

      {/* 메타데이터 */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">메타데이터</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700">
              과목
            </label>
            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="예: 수학"
            />
          </div>
          <div>
            <label htmlFor="subjectCategory" className="block text-sm font-medium text-gray-700">
              과목 분류
            </label>
            <input
              id="subjectCategory"
              type="text"
              value={subjectCategory}
              onChange={(e) => setSubjectCategory(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="예: 수학 I"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="difficulty" className="block text-sm font-medium text-gray-700">
              난이도
            </label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as DifficultyLevel | '')}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">선택 안함</option>
              {DIFFICULTY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="estimatedMinutes" className="block text-sm font-medium text-gray-700">
              예상 소요 시간 (분)
            </label>
            <input
              id="estimatedMinutes"
              type="number"
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
              min="0"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="60"
            />
          </div>
        </div>

        <div>
          <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
            태그 (쉼표로 구분)
          </label>
          <input
            id="tags"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="예: 기출문제, 핵심정리, 복습용"
          />
        </div>
      </div>

      {/* 색상 선택 */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">색상</label>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setColor(opt.value)}
              className={cn(
                'w-8 h-8 rounded-full border-2 transition-transform',
                color === opt.value ? 'border-gray-900 scale-110' : 'border-transparent'
              )}
              style={{ backgroundColor: opt.value }}
              title={opt.label}
            />
          ))}
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            취소
          </button>
        )}
        <button
          type="submit"
          disabled={isPending || !title.trim()}
          className="px-4 py-2 text-sm text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {isPending ? '저장 중...' : isEdit ? '수정' : '생성'}
        </button>
      </div>
    </form>
  );
}
