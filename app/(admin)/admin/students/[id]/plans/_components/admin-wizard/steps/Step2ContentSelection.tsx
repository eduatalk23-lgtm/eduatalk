'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Video, Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/cn';
import { getStudentContentsForAdmin, type StudentContentItem } from '@/lib/domains/admin-plan/actions';
import type { SelectedContent } from '../types';

interface Step2ContentSelectionProps {
  studentId: string;
  tenantId: string;
  selectedContents: SelectedContent[];
  skipContents: boolean;
  onToggleContent: (content: SelectedContent) => void;
  onUpdateRange: (contentId: string, startRange: number, endRange: number) => void;
  onSetSkipContents: (skip: boolean) => void;
}

export function Step2ContentSelection({
  studentId,
  tenantId,
  selectedContents,
  skipContents,
  onToggleContent,
  onUpdateRange,
  onSetSkipContents,
}: Step2ContentSelectionProps) {
  const [contents, setContents] = useState<StudentContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 콘텐츠 로드 (서버 액션 사용)
  useEffect(() => {
    async function loadContents() {
      try {
        setLoading(true);
        const result = await getStudentContentsForAdmin(studentId, tenantId);

        // 에러 확인
        if ('success' in result && result.success === false) {
          console.error('Failed to load contents:', result.error);
          return;
        }

        // 성공 시: { contents: StudentContentItem[] }
        const data = result as { contents: StudentContentItem[] };
        setContents(data.contents);
      } catch (error) {
        console.error('Failed to load contents:', error);
      } finally {
        setLoading(false);
      }
    }

    loadContents();
  }, [studentId, tenantId]);

  const isSelected = (contentId: string) =>
    selectedContents.some((c) => c.contentId === contentId);

  const getSelectedContent = (contentId: string) =>
    selectedContents.find((c) => c.contentId === contentId);

  const handleToggle = (item: StudentContentItem) => {
    const selected = getSelectedContent(item.id);
    if (selected) {
      onToggleContent(selected);
    } else {
      onToggleContent({
        contentId: item.id,
        contentType: item.type,
        title: item.title,
        subject: item.subject ?? undefined,
        startRange: 1,
        endRange: item.totalRange,
        totalRange: item.totalRange,
      });
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">콘텐츠 로딩 중...</span>
      </div>
    );
  }

  if (contents.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-600">
          학생에게 등록된 콘텐츠가 없습니다.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          콘텐츠 없이 플랜 그룹을 생성하고, 나중에 콘텐츠를 추가할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 선택 현황 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          선택: <span className="font-medium text-gray-900">{selectedContents.length}</span>/9개
        </p>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={skipContents}
            onChange={(e) => onSetSkipContents(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600"
          />
          콘텐츠 선택 건너뛰기
        </label>
      </div>

      {/* 콘텐츠 목록 */}
      <div className={cn('space-y-2', skipContents && 'opacity-50 pointer-events-none')}>
        {contents.map((item) => {
          const selected = isSelected(item.id);
          const selectedContent = getSelectedContent(item.id);
          const isExpanded = expandedId === item.id && selected;

          return (
            <div
              key={item.id}
              className={cn(
                'rounded-lg border transition',
                selected
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              )}
            >
              {/* 메인 행 */}
              <div className="flex items-center gap-3 p-3">
                <button
                  type="button"
                  onClick={() => handleToggle(item)}
                  disabled={!selected && selectedContents.length >= 9}
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded border transition',
                    selected
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : 'border-gray-300 bg-white',
                    !selected && selectedContents.length >= 9 && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {selected && <Check className="h-3 w-3" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {item.type === 'book' ? (
                      <BookOpen className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Video className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="truncate text-sm font-medium text-gray-900">
                      {item.title}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                    <span>{item.type === 'book' ? '교재' : '강의'}</span>
                    {item.subject && (
                      <>
                        <span>·</span>
                        <span>{item.subject}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>
                      {item.type === 'book'
                        ? `${item.totalRange}페이지`
                        : `${item.totalRange}강`}
                    </span>
                  </div>
                </div>

                {selected && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(item.id)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>

              {/* 범위 설정 (확장) */}
              {isExpanded && selectedContent && (
                <div className="border-t border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-gray-600">범위:</label>
                    <input
                      type="number"
                      value={selectedContent.startRange}
                      onChange={(e) =>
                        onUpdateRange(
                          item.id,
                          Math.max(1, parseInt(e.target.value) || 1),
                          selectedContent.endRange
                        )
                      }
                      min={1}
                      max={selectedContent.endRange}
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                    <span className="text-gray-500">~</span>
                    <input
                      type="number"
                      value={selectedContent.endRange}
                      onChange={(e) =>
                        onUpdateRange(
                          item.id,
                          selectedContent.startRange,
                          Math.min(item.totalRange, parseInt(e.target.value) || item.totalRange)
                        )
                      }
                      min={selectedContent.startRange}
                      max={item.totalRange}
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                    <span className="text-xs text-gray-500">
                      / {item.totalRange}
                      {item.type === 'book' ? '페이지' : '강'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedContents.length >= 9 && (
        <p className="text-sm text-amber-600">
          최대 9개의 콘텐츠를 선택할 수 있습니다.
        </p>
      )}
    </div>
  );
}
