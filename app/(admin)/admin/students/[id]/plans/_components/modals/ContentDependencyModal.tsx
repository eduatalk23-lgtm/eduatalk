'use client';

/**
 * 콘텐츠 의존성(선수학습) 관리 모달
 *
 * - 특정 콘텐츠의 선수학습 관계 조회
 * - 새 의존성 추가 (드롭다운으로 콘텐츠 선택)
 * - 의존성 삭제
 * - 전역(global) vs 플랜그룹(plan_group) 스코프 선택
 */

import { useState, useEffect, useTransition } from 'react';
import { Link2, Plus, Trash2, BookOpen, Video, FileText } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  getContentDependencies,
  addContentDependency,
  removeContentDependency,
} from '@/lib/domains/content-dependency/actions';
import type {
  ContentDependency,
  ContentType,
  DependencyScope,
} from '@/lib/types/content-dependency';
import {
  VALIDATION,
  SUCCESS,
  ERROR,
  formatError,
} from '@/lib/domains/admin-plan/utils/toastMessages';
import { ModalWrapper, ModalButton } from './ModalWrapper';
import { cn } from '@/lib/cn';

interface ContentDependencyModalProps {
  /** 현재 선택된 콘텐츠 정보 */
  content: {
    contentId: string;
    contentType: 'book' | 'lecture' | 'custom';
    contentName: string;
  };
  /** 현재 플랜 그룹 ID (optional, plan_group scope 사용 시 필요) */
  planGroupId?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ContentOption {
  id: string;
  type: ContentType;
  title: string;
}

const CONTENT_TYPE_ICONS: Record<ContentType, typeof BookOpen> = {
  book: BookOpen,
  lecture: Video,
  custom: FileText,
};

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  book: '교재',
  lecture: '강의',
  custom: '커스텀',
};

export function ContentDependencyModal({
  content,
  planGroupId,
  onClose,
  onSuccess,
}: ContentDependencyModalProps) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<'prerequisite' | 'dependent'>('prerequisite');
  const [dependencies, setDependencies] = useState<ContentDependency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showSuccess, showError } = useToast();

  // 콘텐츠 검색/선택용 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [availableContents, setAvailableContents] = useState<ContentOption[]>([]);
  const [selectedContentId, setSelectedContentId] = useState('');
  const [selectedScope, setSelectedScope] = useState<DependencyScope>('global');

  // 의존성 로드
  useEffect(() => {
    loadDependencies();
  }, [content.contentId, content.contentType]);

  async function loadDependencies() {
    setIsLoading(true);
    const result = await getContentDependencies(
      content.contentId,
      content.contentType as ContentType,
      planGroupId ? { planGroupId, includeGlobal: true } : undefined
    );

    if (result.success && result.data) {
      setDependencies(result.data);
    } else {
      showError(formatError(result.error, ERROR.DEPENDENCY_LOAD));
    }
    setIsLoading(false);
  }

  // 콘텐츠 검색
  useEffect(() => {
    if (searchQuery.length < 2) {
      setAvailableContents([]);
      return;
    }

    const timer = setTimeout(async () => {
      const supabase = createSupabaseBrowserClient();
      const results: ContentOption[] = [];

      // 교재 검색
      const { data: books } = await supabase
        .from('master_books')
        .select('id, title')
        .ilike('title', `%${searchQuery}%`)
        .limit(10);
      if (books) {
        results.push(...books.map((b) => ({ id: b.id, type: 'book' as ContentType, title: b.title || '' })));
      }

      // 강의 검색
      const { data: lectures } = await supabase
        .from('master_lectures')
        .select('id, title')
        .ilike('title', `%${searchQuery}%`)
        .limit(10);
      if (lectures) {
        results.push(...lectures.map((l) => ({ id: l.id, type: 'lecture' as ContentType, title: l.title || '' })));
      }

      // 커스텀 콘텐츠 검색
      const { data: customs } = await supabase
        .from('master_custom_contents')
        .select('id, title')
        .ilike('title', `%${searchQuery}%`)
        .limit(10);
      if (customs) {
        results.push(...customs.map((c) => ({ id: c.id, type: 'custom' as ContentType, title: c.title || '' })));
      }

      // 자기 자신 및 이미 등록된 의존성 제외
      const existingIds = new Set(
        dependencies.flatMap((d) => [d.prerequisiteContentId, d.dependentContentId])
      );
      existingIds.add(content.contentId);

      setAvailableContents(results.filter((r) => !existingIds.has(r.id)));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, dependencies, content.contentId]);

  // 의존성 추가
  const handleAdd = () => {
    if (!selectedContentId) {
      showError(VALIDATION.SELECT_CONTENT);
      return;
    }

    const selectedContent = availableContents.find((c) => c.id === selectedContentId);
    if (!selectedContent) return;

    startTransition(async () => {
      // activeTab에 따라 선수/의존 관계 결정
      const input =
        activeTab === 'prerequisite'
          ? {
              // 선택한 콘텐츠가 현재 콘텐츠의 선수 학습
              prerequisiteContentId: selectedContent.id,
              prerequisiteContentType: selectedContent.type,
              dependentContentId: content.contentId,
              dependentContentType: content.contentType as ContentType,
              scope: selectedScope,
              planGroupId: selectedScope === 'plan_group' ? planGroupId || undefined : undefined,
            }
          : {
              // 현재 콘텐츠가 선택한 콘텐츠의 선수 학습
              prerequisiteContentId: content.contentId,
              prerequisiteContentType: content.contentType as ContentType,
              dependentContentId: selectedContent.id,
              dependentContentType: selectedContent.type,
              scope: selectedScope,
              planGroupId: selectedScope === 'plan_group' ? planGroupId || undefined : undefined,
            };

      const result = await addContentDependency(input);

      if (result.success) {
        showSuccess(SUCCESS.DEPENDENCY_ADDED);
        setSearchQuery('');
        setSelectedContentId('');
        await loadDependencies();
        onSuccess?.();
      } else {
        showError(formatError(result.error, ERROR.DEPENDENCY_ADD));
      }
    });
  };

  // 의존성 삭제
  const handleDelete = (dependencyId: string) => {
    startTransition(async () => {
      const result = await removeContentDependency(dependencyId);

      if (result.success) {
        showSuccess(SUCCESS.DEPENDENCY_DELETED);
        await loadDependencies();
        onSuccess?.();
      } else {
        showError(formatError(result.error, ERROR.DEPENDENCY_DELETE));
      }
    });
  };

  // 필터링된 의존성
  const filteredDependencies = dependencies.filter((dep) => {
    if (activeTab === 'prerequisite') {
      // 현재 콘텐츠의 선수 학습 (dependent가 현재 콘텐츠인 것)
      return dep.dependentContentId === content.contentId;
    } else {
      // 현재 콘텐츠를 선수로 하는 것 (prerequisite가 현재 콘텐츠인 것)
      return dep.prerequisiteContentId === content.contentId;
    }
  });

  const ContentIcon = CONTENT_TYPE_ICONS[content.contentType];

  return (
    <ModalWrapper
      open={true}
      onClose={onClose}
      title="콘텐츠 의존성 관리"
      subtitle="선수학습 관계를 설정합니다"
      icon={<Link2 className="h-5 w-5" />}
      theme="purple"
      size="lg"
      loading={isPending}
      footer={
        <ModalButton variant="secondary" onClick={onClose}>
          닫기
        </ModalButton>
      }
    >
      {/* 현재 콘텐츠 정보 */}
      <div className="p-4 border-b bg-purple-50">
        <div className="flex items-center gap-2">
          <ContentIcon className="h-5 w-5 text-purple-600" />
          <span className="text-xs text-purple-600">{CONTENT_TYPE_LABELS[content.contentType]}</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mt-1">{content.contentName}</h3>
      </div>

      {/* 탭 */}
      <div className="flex border-b">
        <button
          type="button"
          onClick={() => setActiveTab('prerequisite')}
          className={cn(
            'flex-1 px-4 py-3 text-sm font-medium transition-colors',
            activeTab === 'prerequisite'
              ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          선수 콘텐츠
          <span className="ml-1 text-xs text-gray-400">
            ({filteredDependencies.length})
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('dependent')}
          className={cn(
            'flex-1 px-4 py-3 text-sm font-medium transition-colors',
            activeTab === 'dependent'
              ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          후속 콘텐츠
          <span className="ml-1 text-xs text-gray-400">
            ({dependencies.filter((d) => d.prerequisiteContentId === content.contentId).length})
          </span>
        </button>
      </div>

      {/* 콘텐츠 */}
      <div className="p-4 space-y-4">
        {/* 의존성 목록 */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">
            {activeTab === 'prerequisite'
              ? '먼저 완료해야 하는 콘텐츠'
              : '이 콘텐츠를 먼저 학습해야 하는 콘텐츠'}
          </h4>

          {isLoading ? (
            <div className="text-center py-8 text-gray-500">로딩 중...</div>
          ) : filteredDependencies.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              {activeTab === 'prerequisite'
                ? '선수 학습 콘텐츠가 없습니다'
                : '후속 콘텐츠가 없습니다'}
            </div>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {filteredDependencies.map((dep) => {
                const isPrerequisite = activeTab === 'prerequisite';
                const targetId = isPrerequisite ? dep.prerequisiteContentId : dep.dependentContentId;
                const targetType = isPrerequisite ? dep.prerequisiteContentType : dep.dependentContentType;
                const targetTitle = isPrerequisite ? dep.prerequisiteTitle : dep.dependentTitle;
                const TargetIcon = CONTENT_TYPE_ICONS[targetType];

                return (
                  <div
                    key={dep.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <TargetIcon className="h-4 w-4 text-gray-400 shrink-0" />
                      <span className="truncate">{targetTitle || targetId}</span>
                      <span
                        className={cn(
                          'text-xs px-1.5 py-0.5 rounded shrink-0',
                          dep.scope === 'global'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-700'
                        )}
                      >
                        {dep.scope === 'global' ? '전역' : '이 플랜그룹'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(dep.id)}
                      disabled={isPending}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 의존성 추가 */}
        <div className="border-t pt-4 space-y-3">
          <h4 className="text-sm font-medium text-gray-700">
            {activeTab === 'prerequisite' ? '선수 콘텐츠 추가' : '후속 콘텐츠 추가'}
          </h4>

          {/* 스코프 선택 */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedScope('global')}
              className={cn(
                'flex-1 px-3 py-2 text-sm rounded-lg border transition-colors',
                selectedScope === 'global'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              전역
            </button>
            <button
              type="button"
              onClick={() => setSelectedScope('plan_group')}
              disabled={!planGroupId}
              className={cn(
                'flex-1 px-3 py-2 text-sm rounded-lg border transition-colors',
                selectedScope === 'plan_group'
                  ? 'border-amber-500 bg-amber-50 text-amber-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                !planGroupId && 'opacity-50 cursor-not-allowed'
              )}
            >
              이 플랜그룹만
            </button>
          </div>

          {/* 콘텐츠 검색 */}
          <div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="콘텐츠 검색 (2글자 이상)"
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          {/* 검색 결과 */}
          {availableContents.length > 0 && (
            <div className="border rounded-lg max-h-32 overflow-y-auto">
              {availableContents.map((c) => {
                const Icon = CONTENT_TYPE_ICONS[c.type];
                return (
                  <button
                    key={`${c.type}-${c.id}`}
                    type="button"
                    onClick={() => setSelectedContentId(c.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors',
                      selectedContentId === c.id && 'bg-purple-50'
                    )}
                  >
                    <Icon className="h-4 w-4 text-gray-400" />
                    <span className="truncate flex-1">{c.title}</span>
                    <span className="text-xs text-gray-400">{CONTENT_TYPE_LABELS[c.type]}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 추가 버튼 */}
          <button
            type="button"
            onClick={handleAdd}
            disabled={!selectedContentId || isPending}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              selectedContentId && !isPending
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            )}
          >
            <Plus className="h-4 w-4" />
            {isPending ? '추가 중...' : '의존성 추가'}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}

export default ContentDependencyModal;
