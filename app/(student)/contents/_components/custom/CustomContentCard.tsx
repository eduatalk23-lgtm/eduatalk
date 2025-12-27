'use client';

/**
 * 커스텀 콘텐츠 카드 컴포넌트 (Phase 5: 커스텀 콘텐츠 고도화)
 */

import { useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/ToastProvider';
import {
  type CustomContent,
  formatRange,
  getDifficultyLabel,
  getDifficultyColor,
} from '@/lib/domains/content/types';
import {
  archiveCustomContent,
  deleteEnhancedCustomContent,
  duplicateCustomContent,
  saveAsTemplate,
} from '@/lib/domains/content';

interface CustomContentCardProps {
  content: CustomContent;
  variant?: 'default' | 'compact' | 'list';
  showActions?: boolean;
  selectable?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onClick?: (content: CustomContent) => void;
  onEdit?: (content: CustomContent) => void;
  onRefresh?: () => void;
  className?: string;
}

export function CustomContentCard({
  content,
  variant = 'default',
  showActions = true,
  selectable = false,
  isSelected = false,
  onSelect,
  onClick,
  onEdit,
  onRefresh,
  className,
}: CustomContentCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showMenu, setShowMenu] = useState(false);
  const { showSuccess, showError } = useToast();

  const rangeDisplay = formatRange(content);
  const isArchived = content.status === 'archived';

  const handleArchive = () => {
    startTransition(async () => {
      const result = await archiveCustomContent(content.id);
      if (result.success) {
        showSuccess('콘텐츠가 보관되었습니다.');
        onRefresh?.();
      } else {
        showError(result.error || '보관 실패');
      }
      setShowMenu(false);
    });
  };

  const handleDelete = () => {
    if (!confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

    startTransition(async () => {
      const result = await deleteEnhancedCustomContent(content.id);
      if (result.success) {
        showSuccess('콘텐츠가 삭제되었습니다.');
        onRefresh?.();
      } else {
        showError(result.error || '삭제 실패');
      }
      setShowMenu(false);
    });
  };

  const handleDuplicate = () => {
    startTransition(async () => {
      const result = await duplicateCustomContent(content.id);
      if (result.success) {
        showSuccess('콘텐츠가 복제되었습니다.');
        onRefresh?.();
      } else {
        showError(result.error || '복제 실패');
      }
      setShowMenu(false);
    });
  };

  const handleSaveAsTemplate = () => {
    const name = prompt('템플릿 이름을 입력하세요:', content.title);
    if (!name) return;

    startTransition(async () => {
      const result = await saveAsTemplate(content.id, name);
      if (result.success) {
        showSuccess('템플릿으로 저장되었습니다.');
      } else {
        showError(result.error || '템플릿 저장 실패');
      }
      setShowMenu(false);
    });
  };

  // Compact variant
  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'flex items-center gap-3 p-3 bg-white rounded-lg border transition-colors cursor-pointer',
          isArchived ? 'border-gray-200 bg-gray-50' : 'border-gray-200 hover:border-blue-300',
          isSelected && 'ring-2 ring-blue-500',
          isPending && 'opacity-50 pointer-events-none',
          className
        )}
        onClick={() => onClick?.(content)}
      >
        {selectable && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect?.(content.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-gray-300"
          />
        )}
        {content.color && (
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: content.color }}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className={cn('font-medium truncate', isArchived && 'text-gray-500')}>
            {content.title}
          </div>
          <div className="text-xs text-gray-500">
            {content.subject && <span>{content.subject}</span>}
            {rangeDisplay && <span> · {rangeDisplay}</span>}
          </div>
        </div>
        {content.isTemplate && (
          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
            템플릿
          </span>
        )}
      </div>
    );
  }

  // List variant
  if (variant === 'list') {
    return (
      <div
        className={cn(
          'flex items-center gap-4 p-4 bg-white border-b transition-colors',
          isArchived ? 'bg-gray-50' : 'hover:bg-gray-50',
          isSelected && 'bg-blue-50',
          isPending && 'opacity-50 pointer-events-none',
          className
        )}
      >
        {selectable && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect?.(content.id)}
            className="w-4 h-4 rounded border-gray-300"
          />
        )}
        {content.color && (
          <div
            className="w-4 h-4 rounded-full shrink-0"
            style={{ backgroundColor: content.color }}
          />
        )}
        <div className="flex-1 min-w-0">
          <div
            className={cn('font-medium cursor-pointer hover:text-blue-600', isArchived && 'text-gray-500')}
            onClick={() => onClick?.(content)}
          >
            {content.title}
          </div>
          {content.description && (
            <div className="text-sm text-gray-500 truncate">{content.description}</div>
          )}
        </div>
        <div className="text-sm text-gray-500 w-24 text-center">{content.subject || '-'}</div>
        <div className="text-sm text-gray-500 w-24 text-center">{rangeDisplay || '-'}</div>
        {content.difficulty && (
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded w-16 text-center',
              getDifficultyColor(content.difficulty)
            )}
          >
            {getDifficultyLabel(content.difficulty)}
          </span>
        )}
        {showActions && (
          <div className="flex gap-1">
            <button
              onClick={() => onEdit?.(content)}
              className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
            >
              수정
            </button>
          </div>
        )}
      </div>
    );
  }

  // Default variant (card)
  return (
    <div
      className={cn(
        'relative bg-white rounded-xl border transition-all overflow-hidden',
        isArchived ? 'border-gray-200 bg-gray-50' : 'border-gray-200 hover:shadow-md',
        isSelected && 'ring-2 ring-blue-500',
        isPending && 'opacity-50 pointer-events-none',
        className
      )}
    >
      {/* Color bar */}
      {content.color && (
        <div className="h-1" style={{ backgroundColor: content.color }} />
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            {selectable && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onSelect?.(content.id)}
                className="w-4 h-4 rounded border-gray-300 mr-2"
              />
            )}
            <h3
              className={cn(
                'font-semibold cursor-pointer hover:text-blue-600',
                isArchived && 'text-gray-500 line-through'
              )}
              onClick={() => onClick?.(content)}
            >
              {content.title}
            </h3>
          </div>
          {showActions && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                ⋮
              </button>
              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border z-20">
                    <button
                      onClick={() => {
                        onEdit?.(content);
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      수정
                    </button>
                    <button
                      onClick={handleDuplicate}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      복제
                    </button>
                    <button
                      onClick={handleSaveAsTemplate}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      템플릿으로 저장
                    </button>
                    <hr className="my-1" />
                    <button
                      onClick={handleArchive}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      {isArchived ? '복원' : '보관'}
                    </button>
                    <button
                      onClick={handleDelete}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        {content.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{content.description}</p>
        )}

        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {content.subject && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
              {content.subject}
            </span>
          )}
          {rangeDisplay && (
            <span className="text-gray-500">{rangeDisplay}</span>
          )}
          {content.difficulty && (
            <span
              className={cn('px-2 py-0.5 rounded text-xs', getDifficultyColor(content.difficulty))}
            >
              {getDifficultyLabel(content.difficulty)}
            </span>
          )}
          {content.estimatedMinutes && (
            <span className="text-gray-500">약 {content.estimatedMinutes}분</span>
          )}
        </div>

        {/* Tags */}
        {content.tags && content.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {content.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Badges */}
        <div className="flex gap-2 mt-3">
          {content.isTemplate && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
              템플릿
            </span>
          )}
          {isArchived && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
              보관됨
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
