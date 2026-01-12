"use client";

/**
 * 콘텐츠 의존성(선수학습) 관리 컴포넌트
 *
 * 특정 콘텐츠의 선수학습 관계를 조회, 추가, 삭제할 수 있습니다.
 */

import { useState, useEffect, useTransition, useCallback } from "react";
import { Loader2, Plus, Trash2, BookOpen, Video, FileText } from "lucide-react";
import {
  getContentDependencies,
  removeContentDependency,
} from "@/lib/domains/content-dependency/actions";
import type { ContentDependency, ContentType } from "@/lib/types/content-dependency";
import { AddDependencyModal } from "./AddDependencyModal";
import { useToast } from "@/components/ui/ToastProvider";

interface ContentDependencyManagerProps {
  contentId: string;
  contentType: ContentType;
  contentTitle: string;
  planGroupId?: string;
}

function getContentTypeIcon(type: ContentType) {
  switch (type) {
    case "book":
      return <BookOpen className="h-4 w-4" />;
    case "lecture":
      return <Video className="h-4 w-4" />;
    case "custom":
      return <FileText className="h-4 w-4" />;
  }
}

function getContentTypeLabel(type: ContentType) {
  switch (type) {
    case "book":
      return "교재";
    case "lecture":
      return "강의";
    case "custom":
      return "커스텀";
  }
}

export function ContentDependencyManager({
  contentId,
  contentType,
  contentTitle,
  planGroupId,
}: ContentDependencyManagerProps) {
  const { showSuccess, showError } = useToast();
  const [dependencies, setDependencies] = useState<ContentDependency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // 의존성 분류
  const prerequisitesOfThis = dependencies.filter(
    (d) => d.dependentContentId === contentId
  );
  const dependentsOnThis = dependencies.filter(
    (d) => d.prerequisiteContentId === contentId
  );

  // 의존성 목록 조회
  const loadDependencies = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getContentDependencies(contentId, contentType, {
        planGroupId,
        includeGlobal: true,
      });

      if (result.success && result.data) {
        setDependencies(result.data);
      } else {
        showError(result.error || "의존성 조회에 실패했습니다.");
      }
    } catch {
      showError("의존성 조회 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [contentId, contentType, planGroupId, showError]);

  useEffect(() => {
    loadDependencies();
  }, [loadDependencies]);

  // 의존성 삭제
  const handleRemove = async (dependencyId: string) => {
    if (!confirm("이 의존성을 삭제하시겠습니까?")) return;

    startTransition(async () => {
      const result = await removeContentDependency(dependencyId);

      if (result.success) {
        showSuccess("의존성이 삭제되었습니다.");
        loadDependencies();
      } else {
        showError(result.error || "의존성 삭제에 실패했습니다.");
      }
    });
  };

  // 의존성 추가 완료 후
  const handleAddSuccess = () => {
    setIsModalOpen(false);
    loadDependencies();
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-500">의존성 정보를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">선수학습 관계</h3>
            <p className="mt-1 text-sm text-gray-500">
              이 콘텐츠의 선수학습 순서를 관리합니다.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            의존성 추가
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {/* 이 콘텐츠의 선수 학습 목록 */}
        <div className="p-6">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
              선수 학습
            </span>
            이 콘텐츠 학습 전에 완료해야 할 콘텐츠 ({prerequisitesOfThis.length})
          </h4>

          {prerequisitesOfThis.length === 0 ? (
            <p className="text-sm text-gray-500">선수 학습으로 지정된 콘텐츠가 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {prerequisitesOfThis.map((dep) => (
                <li
                  key={dep.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400">
                      {getContentTypeIcon(dep.prerequisiteContentType)}
                    </span>
                    <div>
                      <span className="font-medium text-gray-900">
                        {dep.prerequisiteTitle || "제목 없음"}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{getContentTypeLabel(dep.prerequisiteContentType)}</span>
                        <span>•</span>
                        <span className={dep.scope === "global" ? "text-blue-600" : "text-purple-600"}>
                          {dep.scope === "global" ? "전역" : "플랜 그룹"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(dep.id)}
                    disabled={isPending}
                    className="rounded p-1.5 text-gray-400 transition hover:bg-gray-200 hover:text-red-500 disabled:opacity-50"
                    title="의존성 삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 이 콘텐츠가 선수인 콘텐츠 목록 */}
        <div className="p-6">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
            <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
              후속 학습
            </span>
            이 콘텐츠를 선수로 필요로 하는 콘텐츠 ({dependentsOnThis.length})
          </h4>

          {dependentsOnThis.length === 0 ? (
            <p className="text-sm text-gray-500">이 콘텐츠를 선수로 하는 콘텐츠가 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {dependentsOnThis.map((dep) => (
                <li
                  key={dep.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400">
                      {getContentTypeIcon(dep.dependentContentType)}
                    </span>
                    <div>
                      <span className="font-medium text-gray-900">
                        {dep.dependentTitle || "제목 없음"}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{getContentTypeLabel(dep.dependentContentType)}</span>
                        <span>•</span>
                        <span className={dep.scope === "global" ? "text-blue-600" : "text-purple-600"}>
                          {dep.scope === "global" ? "전역" : "플랜 그룹"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(dep.id)}
                    disabled={isPending}
                    className="rounded p-1.5 text-gray-400 transition hover:bg-gray-200 hover:text-red-500 disabled:opacity-50"
                    title="의존성 삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 의존성 추가 모달 */}
      <AddDependencyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleAddSuccess}
        currentContentId={contentId}
        currentContentType={contentType}
        currentContentTitle={contentTitle}
        planGroupId={planGroupId}
      />
    </div>
  );
}
