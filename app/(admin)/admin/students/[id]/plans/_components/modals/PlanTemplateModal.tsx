'use client';

import { useState, useTransition, useEffect } from 'react';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/ToastProvider';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { getTodayInTimezone } from '@/lib/utils/dateUtils';
import {
  getPlanTemplates,
  createPlanTemplate,
  applyPlanTemplate,
  deletePlanTemplate,
  updatePlanTemplate,
  duplicatePlanTemplate,
  type PlanTemplate,
  type PlanTemplateItem,
} from '@/lib/domains/admin-plan/actions/planTemplates';
import {
  VALIDATION,
  SUCCESS,
  ERROR,
  formatError,
  formatTemplateApplySuccess,
} from '@/lib/domains/admin-plan/utils/toastMessages';

interface PlanTemplateModalProps {
  studentId: string;
  planIds?: string[]; // 템플릿으로 저장할 플랜 ID들 (있으면 저장 모드)
  targetDate?: string; // 템플릿 적용 시 사용할 날짜
  planGroupId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

type Mode = 'list' | 'create' | 'apply' | 'edit';

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

  // 새 템플릿 생성/편집 폼
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // 적용할 템플릿
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [applyDate, setApplyDate] = useState(targetDate || getTodayInTimezone());
  const [showPreview, setShowPreview] = useState(false);

  // 선택된 템플릿 정보
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const templateItems = (selectedTemplate?.items ?? []) as PlanTemplateItem[];

  // 다중 학생 적용 관련 상태
  const [applyToOtherStudents, setApplyToOtherStudents] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<{ id: string; name: string }[]>([]);
  const [selectedTargetStudents, setSelectedTargetStudents] = useState<string[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

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

  // 다른 학생에게 적용 선택 시 학생 목록 로드
  useEffect(() => {
    if (mode === 'apply' && applyToOtherStudents && availableStudents.length === 0 && !isLoadingStudents) {
      setIsLoadingStudents(true);
      const supabase = createSupabaseBrowserClient();
      supabase
        .from('students')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
        .then(({ data }) => {
          if (data) {
            // 현재 학생 제외
            setAvailableStudents(data.filter((s) => s.id !== studentId));
          }
          setIsLoadingStudents(false);
        });
    }
  }, [mode, applyToOtherStudents, studentId, availableStudents.length, isLoadingStudents]);

  const handleToggleTargetStudent = (targetStudentId: string) => {
    setSelectedTargetStudents((prev) =>
      prev.includes(targetStudentId)
        ? prev.filter((id) => id !== targetStudentId)
        : [...prev, targetStudentId]
    );
  };

  const handleCreateTemplate = () => {
    if (!templateName.trim()) {
      showError(VALIDATION.ENTER_TEMPLATE_NAME);
      return;
    }
    if (!planIds || planIds.length === 0) {
      showError(VALIDATION.NO_PLANS_TO_SAVE);
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
        showSuccess(SUCCESS.TEMPLATE_SAVED);
        onSuccess();
      } else {
        showError(formatError(result.error, ERROR.TEMPLATE_SAVE));
      }
    });
  };

  const handleApplyTemplate = () => {
    if (!selectedTemplateId) {
      showError(VALIDATION.SELECT_TEMPLATE);
      return;
    }

    // 다른 학생에게 적용 시 대상 학생 필수
    if (applyToOtherStudents && selectedTargetStudents.length === 0) {
      showError(VALIDATION.SELECT_STUDENTS);
      return;
    }

    startTransition(async () => {
      const result = await applyPlanTemplate(
        selectedTemplateId,
        studentId,
        applyDate,
        planGroupId,
        applyToOtherStudents ? selectedTargetStudents : undefined
      );

      if (result.success) {
        const { createdCount, appliedStudents } = result.data!;
        showSuccess(formatTemplateApplySuccess(createdCount, appliedStudents));
        onSuccess();
      } else {
        showError(formatError(result.error, ERROR.TEMPLATE_APPLY));
      }
    });
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (!confirm('이 템플릿을 삭제하시겠습니까?')) return;

    startTransition(async () => {
      const result = await deletePlanTemplate(templateId);
      if (result.success) {
        showSuccess(SUCCESS.TEMPLATE_DELETED);
        setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      } else {
        showError(formatError(result.error, ERROR.TEMPLATE_DELETE));
      }
    });
  };

  const handleEditTemplate = (template: PlanTemplate) => {
    setEditingTemplateId(template.id);
    setTemplateName(template.name);
    setTemplateDesc(template.description ?? '');
    setMode('edit');
  };

  const handleUpdateTemplate = () => {
    if (!editingTemplateId) return;
    if (!templateName.trim()) {
      showError(VALIDATION.ENTER_TEMPLATE_NAME);
      return;
    }

    startTransition(async () => {
      const result = await updatePlanTemplate({
        templateId: editingTemplateId,
        name: templateName,
        description: templateDesc || undefined,
      });

      if (result.success) {
        showSuccess(SUCCESS.TEMPLATE_UPDATED);
        // 로컬 상태 업데이트
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === editingTemplateId
              ? { ...t, name: templateName.trim(), description: templateDesc.trim() || null }
              : t
          )
        );
        setMode('list');
        setEditingTemplateId(null);
        setTemplateName('');
        setTemplateDesc('');
      } else {
        showError(formatError(result.error, ERROR.TEMPLATE_UPDATE));
      }
    });
  };

  const handleDuplicateTemplate = (template: PlanTemplate) => {
    startTransition(async () => {
      const result = await duplicatePlanTemplate(template.id);
      if (result.success && result.data) {
        showSuccess(SUCCESS.TEMPLATE_DUPLICATED);
        // 템플릿 목록 새로고침
        const refreshResult = await getPlanTemplates();
        if (refreshResult.success && refreshResult.data) {
          setTemplates(refreshResult.data);
        }
      } else {
        showError(formatError(result.error, ERROR.TEMPLATE_DUPLICATE));
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
        <div className="bg-white dark:bg-[rgb(var(--color-secondary-50))] rounded-lg p-6 w-full max-w-md">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={cn(
          'bg-white dark:bg-[rgb(var(--color-secondary-50))] rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col',
          isPending && 'opacity-50 pointer-events-none'
        )}
      >
        {/* 헤더 */}
        <div className="p-4 border-b shrink-0">
          <h2 className="text-lg font-bold">
            {mode === 'create'
              ? '템플릿 저장'
              : mode === 'apply'
                ? '템플릿 적용'
                : mode === 'edit'
                  ? '템플릿 편집'
                  : '플랜 템플릿'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {mode === 'create'
              ? `${planIds?.length ?? 0}개 플랜을 템플릿으로 저장`
              : mode === 'apply'
                ? '저장된 템플릿을 학생에게 적용'
                : mode === 'edit'
                  ? '템플릿 이름과 설명을 수정합니다'
                  : '템플릿을 관리하고 적용하세요'}
          </p>
        </div>

        {/* 콘텐츠 */}
        <div className="p-4 overflow-y-auto flex-1">
          {mode === 'create' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-800">
                {planIds?.length ?? 0}개의 플랜이 이 템플릿에 포함됩니다.
              </div>
            </div>
          )}

          {mode === 'edit' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
              {editingTemplateId && (() => {
                const template = templates.find((t) => t.id === editingTemplateId);
                const itemCount = (template?.items as unknown[])?.length ?? 0;
                return (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-400">
                    이 템플릿에는 {itemCount}개의 플랜이 포함되어 있습니다.
                  </div>
                );
              })()}
            </div>
          )}

          {mode === 'apply' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  템플릿 선택
                </label>
                {templates.length === 0 ? (
                  <div className="text-center py-6 text-gray-500 dark:text-gray-400">
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
                            <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                              {template.description}
                            </div>
                          )}
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            {(template.items as unknown[]).length}개 플랜 • {formatDate(template.created_at)}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* 템플릿 상세 미리보기 */}
              {selectedTemplateId && templateItems.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 text-left"
                  >
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      📋 플랜 상세 ({templateItems.length}개)
                    </span>
                    <span className="text-gray-400 dark:text-gray-500 text-sm">
                      {showPreview ? '접기 ▲' : '펼치기 ▼'}
                    </span>
                  </button>
                  {showPreview && (
                    <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                      {templateItems.map((item, idx) => (
                        <div key={idx} className="p-3 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                {item.custom_title || item.content_title || '제목 없음'}
                              </div>
                              {item.content_subject && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  {item.content_subject}
                                </div>
                              )}
                            </div>
                            <div className="shrink-0 text-right text-xs text-gray-500 dark:text-gray-400">
                              {item.planned_start_page_or_time != null && item.planned_end_page_or_time != null && (
                                <div>
                                  p.{item.planned_start_page_or_time}-{item.planned_end_page_or_time}
                                </div>
                              )}
                              {item.estimated_minutes != null && (
                                <div>{item.estimated_minutes}분</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {/* 요약 정보 */}
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400">
                        <div className="flex justify-between">
                          <span>총 플랜 수</span>
                          <span className="font-medium">{templateItems.length}개</span>
                        </div>
                        {(() => {
                          const totalMinutes = templateItems.reduce(
                            (sum, item) => sum + (item.estimated_minutes ?? 0),
                            0
                          );
                          if (totalMinutes > 0) {
                            const hours = Math.floor(totalMinutes / 60);
                            const mins = totalMinutes % 60;
                            return (
                              <div className="flex justify-between mt-1">
                                <span>총 예상 시간</span>
                                <span className="font-medium">
                                  {hours > 0 ? `${hours}시간 ` : ''}{mins > 0 ? `${mins}분` : ''}
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 다른 학생에게 적용 옵션 */}
              <div className="pt-3 border-t">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToOtherStudents}
                    onChange={(e) => {
                      setApplyToOtherStudents(e.target.checked);
                      if (!e.target.checked) {
                        setSelectedTargetStudents([]);
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm font-medium">다른 학생에게도 적용</span>
                </label>

                {applyToOtherStudents && (
                  <div className="mt-3 space-y-2">
                    {isLoadingStudents ? (
                      <div className="text-sm text-gray-500 dark:text-gray-400 py-2">학생 목록 로딩 중...</div>
                    ) : availableStudents.length === 0 ? (
                      <div className="text-sm text-gray-500 dark:text-gray-400 py-2">적용 가능한 다른 학생이 없습니다.</div>
                    ) : (
                      <>
                        <div className="max-h-32 overflow-y-auto space-y-1 border rounded-md p-2">
                          {availableStudents.map((student) => (
                            <label
                              key={student.id}
                              className={cn(
                                'flex items-center gap-2 p-1.5 rounded cursor-pointer text-sm hover:bg-purple-50',
                                selectedTargetStudents.includes(student.id) && 'bg-purple-100'
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={selectedTargetStudents.includes(student.id)}
                                onChange={() => handleToggleTargetStudent(student.id)}
                                className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-purple-600"
                              />
                              <span>{student.name}</span>
                            </label>
                          ))}
                        </div>
                        {selectedTargetStudents.length > 0 && (
                          <div className="text-xs text-purple-600">
                            {selectedTargetStudents.length}명 학생 선택됨
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* 적용 미리보기 */}
              {selectedTemplateId && (
                <div className="p-3 bg-purple-50 rounded-lg text-sm text-purple-800">
                  {(() => {
                    const template = templates.find((t) => t.id === selectedTemplateId);
                    const planCount = (template?.items as unknown[])?.length ?? 0;
                    const studentCount = applyToOtherStudents && selectedTargetStudents.length > 0
                      ? selectedTargetStudents.length
                      : 1;
                    return (
                      <>
                        <strong>{planCount}</strong>개 플랜
                        {studentCount > 1 && <> × <strong>{studentCount}</strong>명 학생</>}
                        {' '}= <strong>{planCount * studentCount}</strong>개 플랜 생성 예정
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {mode === 'list' && (
            <div className="space-y-4">
              {/* 모드 선택 버튼 */}
              <div className="flex gap-2">
                {planIds && planIds.length > 0 && (
                  <button
                    onClick={() => setMode('create')}
                    className="flex-1 px-4 py-3 border-2 border-dashed rounded-lg text-center hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800"
                  >
                    <span className="text-2xl">💾</span>
                    <div className="text-sm font-medium mt-1">템플릿으로 저장</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{planIds.length}개 플랜</div>
                  </button>
                )}
                <button
                  onClick={() => setMode('apply')}
                  className="flex-1 px-4 py-3 border-2 border-dashed rounded-lg text-center hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800"
                >
                  <span className="text-2xl">📋</span>
                  <div className="text-sm font-medium mt-1">템플릿 적용</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{templates.length}개 템플릿</div>
                </button>
              </div>

              {/* 템플릿 목록 */}
              {templates.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">저장된 템플릿</div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{template.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {(template.items as unknown[]).length}개 플랜 • {formatDate(template.created_at)}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDuplicateTemplate(template)}
                            className="px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:bg-blue-900/20 rounded"
                          >
                            복제
                          </button>
                          <button
                            onClick={() => handleEditTemplate(template)}
                            className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 rounded"
                          >
                            편집
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 rounded"
                          >
                            삭제
                          </button>
                        </div>
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
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 rounded-md"
              >
                ← 뒤로
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 rounded-md"
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
                disabled={
                  !selectedTemplateId ||
                  isPending ||
                  (applyToOtherStudents && selectedTargetStudents.length === 0)
                }
                className="px-4 py-2 text-sm text-white bg-purple-600 hover:bg-purple-700 rounded-md disabled:opacity-50"
              >
                {isPending ? '적용 중...' : applyToOtherStudents && selectedTargetStudents.length > 0
                  ? `${selectedTargetStudents.length}명에게 적용`
                  : '템플릿 적용'}
              </button>
            )}
            {mode === 'edit' && (
              <button
                onClick={handleUpdateTemplate}
                disabled={!templateName.trim() || isPending}
                className="px-4 py-2 text-sm text-white bg-purple-600 hover:bg-purple-700 rounded-md disabled:opacity-50"
              >
                {isPending ? '저장 중...' : '수정 완료'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
