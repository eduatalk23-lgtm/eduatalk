'use client';

import { useState, useTransition, useEffect } from 'react';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/ToastProvider';
import {
  getPlanTemplates,
  createPlanTemplate,
  applyPlanTemplate,
  deletePlanTemplate,
  type PlanTemplate,
} from '@/lib/domains/admin-plan/actions/planTemplates';

interface PlanTemplateModalProps {
  studentId: string;
  planIds?: string[]; // 템플릿으로 저장할 플랜 ID들 (있으면 저장 모드)
  targetDate?: string; // 템플릿 적용 시 사용할 날짜
  planGroupId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

type Mode = 'list' | 'create' | 'apply';

export function PlanTemplateModal({
  studentId,
  planIds,
  targetDate,
  planGroupId,
  onClose,
  onSuccess,
}: PlanTemplateModalProps) {
  const [mode, setMode] = useState<Mode>(planIds && planIds.length > 0 ? 'create' : 'list');
  const [templates, setTemplates] = useState<PlanTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { showSuccess, showError } = useToast();

  // 새 템플릿 생성 폼
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');

  // 적용할 템플릿
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [applyDate, setApplyDate] = useState(targetDate || new Date().toISOString().split('T')[0]);

  // 템플릿 목록 로드
  useEffect(() => {
    async function loadTemplates() {
      const result = await getPlanTemplates();
      if (result.success && result.data) {
        setTemplates(result.data);
      }
      setIsLoading(false);
    }
    loadTemplates();
  }, []);

  const handleCreateTemplate = () => {
    if (!templateName.trim()) {
      showError('템플릿 이름을 입력해주세요.');
      return;
    }
    if (!planIds || planIds.length === 0) {
      showError('저장할 플랜이 없습니다.');
      return;
    }

    startTransition(async () => {
      const result = await createPlanTemplate({
        name: templateName,
        description: templateDesc || undefined,
        planIds,
        studentId,
      });

      if (result.success) {
        showSuccess('템플릿이 저장되었습니다.');
        onSuccess();
      } else {
        showError(result.error ?? '템플릿 저장에 실패했습니다.');
      }
    });
  };

  const handleApplyTemplate = () => {
    if (!selectedTemplateId) {
      showError('적용할 템플릿을 선택해주세요.');
      return;
    }

    startTransition(async () => {
      const result = await applyPlanTemplate(
        selectedTemplateId,
        studentId,
        applyDate,
        planGroupId
      );

      if (result.success) {
        showSuccess(`${result.data?.createdCount}개 플랜이 생성되었습니다.`);
        onSuccess();
      } else {
        showError(result.error ?? '템플릿 적용에 실패했습니다.');
      }
    });
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (!confirm('이 템플릿을 삭제하시겠습니까?')) return;

    startTransition(async () => {
      const result = await deletePlanTemplate(templateId);
      if (result.success) {
        showSuccess('템플릿이 삭제되었습니다.');
        setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      } else {
        showError(result.error ?? '삭제 실패');
      }
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/2" />
            <div className="h-20 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={cn(
          'bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col',
          isPending && 'opacity-50 pointer-events-none'
        )}
      >
        {/* 헤더 */}
        <div className="p-4 border-b shrink-0">
          <h2 className="text-lg font-bold">
            {mode === 'create' ? '템플릿 저장' : mode === 'apply' ? '템플릿 적용' : '플랜 템플릿'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {mode === 'create'
              ? `${planIds?.length ?? 0}개 플랜을 템플릿으로 저장`
              : mode === 'apply'
                ? '저장된 템플릿을 학생에게 적용'
                : '템플릿을 관리하고 적용하세요'}
          </p>
        </div>

        {/* 콘텐츠 */}
        <div className="p-4 overflow-y-auto flex-1">
          {mode === 'create' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  템플릿 이름 *
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="예: 수학 기본 과정"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  설명 (선택)
                </label>
                <textarea
                  value={templateDesc}
                  onChange={(e) => setTemplateDesc(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  rows={3}
                  placeholder="템플릿에 대한 설명을 입력하세요"
                />
              </div>
              <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                {planIds?.length ?? 0}개의 플랜이 이 템플릿에 포함됩니다.
              </div>
            </div>
          )}

          {mode === 'apply' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  적용할 날짜
                </label>
                <input
                  type="date"
                  value={applyDate}
                  onChange={(e) => setApplyDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  템플릿 선택
                </label>
                {templates.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    저장된 템플릿이 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {templates.map((template) => (
                      <label
                        key={template.id}
                        className={cn(
                          'flex items-start gap-3 p-3 border rounded-lg cursor-pointer',
                          selectedTemplateId === template.id && 'border-purple-500 bg-purple-50'
                        )}
                      >
                        <input
                          type="radio"
                          checked={selectedTemplateId === template.id}
                          onChange={() => setSelectedTemplateId(template.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{template.name}</div>
                          {template.description && (
                            <div className="text-sm text-gray-500 truncate">
                              {template.description}
                            </div>
                          )}
                          <div className="text-xs text-gray-400 mt-1">
                            {(template.items as unknown[]).length}개 플랜 • {formatDate(template.created_at)}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {mode === 'list' && (
            <div className="space-y-4">
              {/* 모드 선택 버튼 */}
              <div className="flex gap-2">
                {planIds && planIds.length > 0 && (
                  <button
                    onClick={() => setMode('create')}
                    className="flex-1 px-4 py-3 border-2 border-dashed rounded-lg text-center hover:bg-gray-50"
                  >
                    <span className="text-2xl">💾</span>
                    <div className="text-sm font-medium mt-1">템플릿으로 저장</div>
                    <div className="text-xs text-gray-500">{planIds.length}개 플랜</div>
                  </button>
                )}
                <button
                  onClick={() => setMode('apply')}
                  className="flex-1 px-4 py-3 border-2 border-dashed rounded-lg text-center hover:bg-gray-50"
                >
                  <span className="text-2xl">📋</span>
                  <div className="text-sm font-medium mt-1">템플릿 적용</div>
                  <div className="text-xs text-gray-500">{templates.length}개 템플릿</div>
                </button>
              </div>

              {/* 템플릿 목록 */}
              {templates.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">저장된 템플릿</div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{template.name}</div>
                          <div className="text-xs text-gray-500">
                            {(template.items as unknown[]).length}개 플랜 • {formatDate(template.created_at)}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t flex justify-between shrink-0">
          <div>
            {mode !== 'list' && (
              <button
                onClick={() => setMode('list')}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
              >
                ← 뒤로
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
            >
              닫기
            </button>
            {mode === 'create' && (
              <button
                onClick={handleCreateTemplate}
                disabled={!templateName.trim() || isPending}
                className="px-4 py-2 text-sm text-white bg-purple-600 hover:bg-purple-700 rounded-md disabled:opacity-50"
              >
                {isPending ? '저장 중...' : '템플릿 저장'}
              </button>
            )}
            {mode === 'apply' && (
              <button
                onClick={handleApplyTemplate}
                disabled={!selectedTemplateId || isPending}
                className="px-4 py-2 text-sm text-white bg-purple-600 hover:bg-purple-700 rounded-md disabled:opacity-50"
              >
                {isPending ? '적용 중...' : '템플릿 적용'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
