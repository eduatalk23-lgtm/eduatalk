'use client';

/**
 * 템플릿 선택 컴포넌트 (Phase 5: 커스텀 콘텐츠 고도화)
 */

import { useState, useEffect, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/ToastProvider';
import {
  type CustomContentTemplate,
  type CustomContent,
  getRangeTypeDefaultUnit,
  getDifficultyLabel,
} from '@/lib/domains/content/types';
import { listTemplates, createFromTemplate } from '@/lib/domains/content';

interface TemplateSelectorProps {
  studentId: string;
  tenantId?: string | null;
  onSelect?: (template: CustomContentTemplate) => void;
  onCreateFromTemplate?: (content: CustomContent) => void;
  className?: string;
}

export function TemplateSelector({
  studentId,
  tenantId,
  onSelect,
  onCreateFromTemplate,
  className,
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<CustomContentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    loadTemplates();
  }, [studentId, tenantId]);

  const loadTemplates = async () => {
    setIsLoading(true);
    const result = await listTemplates(studentId, tenantId);
    if (result.success && result.data) {
      setTemplates(result.data);
    }
    setIsLoading(false);
  };

  const handleSelect = (template: CustomContentTemplate) => {
    setSelectedId(template.id);
    onSelect?.(template);
  };

  const handleCreateFromTemplate = (template: CustomContentTemplate) => {
    startTransition(async () => {
      const result = await createFromTemplate(template.id, studentId);
      if (result.success && result.data) {
        showSuccess('템플릿에서 콘텐츠가 생성되었습니다.');
        onCreateFromTemplate?.(result.data);
      } else {
        showError(result.error || '콘텐츠 생성 실패');
      }
    });
  };

  if (isLoading) {
    return (
      <div className={cn('p-4 text-center text-gray-500', className)}>
        템플릿 로딩 중...
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className={cn('p-4 text-center text-gray-500', className)}>
        <p className="mb-2">저장된 템플릿이 없습니다.</p>
        <p className="text-sm">
          콘텐츠를 만든 후 &quot;템플릿으로 저장&quot;을 사용해 템플릿을 만들 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <h4 className="text-sm font-medium text-gray-700 mb-3">템플릿에서 시작하기</h4>
      <div className="grid gap-2">
        {templates.map((template) => (
          <div
            key={template.id}
            className={cn(
              'flex items-center gap-3 p-3 bg-white rounded-lg border cursor-pointer transition-colors',
              selectedId === template.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300',
              isPending && 'opacity-50 pointer-events-none'
            )}
            onClick={() => handleSelect(template)}
          >
            {template.defaultColor && (
              <div
                className="w-4 h-4 rounded-full shrink-0"
                style={{ backgroundColor: template.defaultColor }}
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{template.name}</div>
              <div className="text-xs text-gray-500 flex flex-wrap gap-2">
                {template.defaultSubject && <span>{template.defaultSubject}</span>}
                {template.defaultRangeType && (
                  <span>
                    {template.defaultRangeType === 'page'
                      ? '페이지'
                      : template.defaultRangeType === 'time'
                        ? '시간'
                        : template.defaultRangeType === 'chapter'
                          ? '장'
                          : template.defaultRangeType === 'unit'
                            ? '단원'
                            : template.defaultRangeUnit || '사용자 정의'}
                  </span>
                )}
                {template.defaultDifficulty && (
                  <span>{getDifficultyLabel(template.defaultDifficulty)}</span>
                )}
              </div>
              {template.description && (
                <div className="text-xs text-gray-400 mt-1 truncate">
                  {template.description}
                </div>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCreateFromTemplate(template);
              }}
              disabled={isPending}
              className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 shrink-0"
            >
              사용
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 템플릿 선택 모달
 */
interface TemplateSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  tenantId?: string | null;
  onCreateFromTemplate: (content: CustomContent) => void;
}

export function TemplateSelectorModal({
  isOpen,
  onClose,
  studentId,
  tenantId,
  onCreateFromTemplate,
}: TemplateSelectorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">템플릿 선택</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            ✕
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          <TemplateSelector
            studentId={studentId}
            tenantId={tenantId}
            onCreateFromTemplate={(content) => {
              onCreateFromTemplate(content);
              onClose();
            }}
          />
        </div>
        <div className="p-4 border-t">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
