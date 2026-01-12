"use client";

/**
 * 콘텐츠 의존성 추가 모달
 *
 * 선수학습 또는 후속학습 관계를 설정할 콘텐츠를 검색하고 추가합니다.
 */

import { useState, useEffect, useTransition } from "react";
import { X, Search, Loader2, BookOpen, Video, FileText, ArrowRight } from "lucide-react";
import { addContentDependency } from "@/lib/domains/content-dependency/actions";
import type { ContentType, DependencyScope } from "@/lib/types/content-dependency";
import { useToast } from "@/components/ui/ToastProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface AddDependencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentContentId: string;
  currentContentType: ContentType;
  currentContentTitle: string;
  planGroupId?: string;
}

interface SearchResult {
  id: string;
  title: string;
  contentType: ContentType;
  subject?: string;
}

type DependencyDirection = "prerequisite" | "dependent";

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

export function AddDependencyModal({
  isOpen,
  onClose,
  onSuccess,
  currentContentId,
  currentContentType,
  currentContentTitle,
  planGroupId,
}: AddDependencyModalProps) {
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();

  // 폼 상태
  const [direction, setDirection] = useState<DependencyDirection>("prerequisite");
  const [scope, setScope] = useState<DependencyScope>("global");
  const [note, setNote] = useState("");

  // 검색 상태
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedContent, setSelectedContent] = useState<SearchResult | null>(null);

  // 콘텐츠 검색
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const supabase = createSupabaseBrowserClient();

        // 교재, 강의 검색 (master_custom_contents는 추후 추가)
        const [booksResult, lecturesResult] = await Promise.all([
          supabase
            .from("master_books")
            .select("id, title, subject")
            .ilike("title", `%${searchQuery}%`)
            .neq("id", currentContentId)
            .eq("is_active", true)
            .limit(10),
          supabase
            .from("master_lectures")
            .select("id, title, subject")
            .ilike("title", `%${searchQuery}%`)
            .neq("id", currentContentId)
            .eq("is_active", true)
            .limit(10),
        ]);

        const results: SearchResult[] = [
          ...(booksResult.data || []).map((b) => ({
            id: b.id,
            title: b.title,
            contentType: "book" as ContentType,
            subject: b.subject || undefined,
          })),
          ...(lecturesResult.data || []).map((l) => ({
            id: l.id,
            title: l.title,
            contentType: "lecture" as ContentType,
            subject: l.subject || undefined,
          })),
        ];

        setSearchResults(results);
      } catch (error) {
        console.error("콘텐츠 검색 오류:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, currentContentId]);

  // 모달 닫힐 때 상태 초기화
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setSearchResults([]);
      setSelectedContent(null);
      setDirection("prerequisite");
      setScope("global");
      setNote("");
    }
  }, [isOpen]);

  // 의존성 추가
  const handleSubmit = async () => {
    if (!selectedContent) {
      showError("콘텐츠를 선택해주세요.");
      return;
    }

    startTransition(async () => {
      const input =
        direction === "prerequisite"
          ? {
              // 선택한 콘텐츠가 현재 콘텐츠의 선수가 됨
              prerequisiteContentId: selectedContent.id,
              prerequisiteContentType: selectedContent.contentType,
              dependentContentId: currentContentId,
              dependentContentType: currentContentType,
              scope,
              planGroupId: scope === "plan_group" ? planGroupId : undefined,
              note: note.trim() || undefined,
            }
          : {
              // 현재 콘텐츠가 선택한 콘텐츠의 선수가 됨
              prerequisiteContentId: currentContentId,
              prerequisiteContentType: currentContentType,
              dependentContentId: selectedContent.id,
              dependentContentType: selectedContent.contentType,
              scope,
              planGroupId: scope === "plan_group" ? planGroupId : undefined,
              note: note.trim() || undefined,
            };

      const result = await addContentDependency(input);

      if (result.success) {
        showSuccess("의존성이 추가되었습니다.");
        onSuccess();
      } else {
        showError(result.error || "의존성 추가에 실패했습니다.");
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 오버레이 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* 모달 */}
      <div className="relative z-10 w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">의존성 추가</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6">
          {/* 현재 콘텐츠 */}
          <div className="mb-6 rounded-lg bg-gray-50 p-4">
            <p className="text-xs font-medium text-gray-500">현재 콘텐츠</p>
            <div className="mt-1 flex items-center gap-2">
              {getContentTypeIcon(currentContentType)}
              <span className="font-medium text-gray-900">{currentContentTitle}</span>
            </div>
          </div>

          {/* 방향 선택 */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              관계 유형
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDirection("prerequisite")}
                className={`rounded-lg border p-3 text-left transition ${
                  direction === "prerequisite"
                    ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <p className="text-sm font-medium text-gray-900">선수 학습 지정</p>
                <p className="mt-1 text-xs text-gray-500">
                  선택한 콘텐츠를 먼저 학습해야 함
                </p>
              </button>
              <button
                type="button"
                onClick={() => setDirection("dependent")}
                className={`rounded-lg border p-3 text-left transition ${
                  direction === "dependent"
                    ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <p className="text-sm font-medium text-gray-900">후속 학습 지정</p>
                <p className="mt-1 text-xs text-gray-500">
                  현재 콘텐츠 학습 후 진행
                </p>
              </button>
            </div>
          </div>

          {/* 콘텐츠 검색 */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {direction === "prerequisite" ? "선수 학습 콘텐츠" : "후속 학습 콘텐츠"}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="교재 또는 강의 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
              )}
            </div>

            {/* 검색 결과 */}
            {searchResults.length > 0 && (
              <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200">
                {searchResults.map((result) => (
                  <li key={`${result.contentType}-${result.id}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedContent(result);
                        setSearchQuery("");
                        setSearchResults([]);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50"
                    >
                      <span className="text-gray-400">
                        {getContentTypeIcon(result.contentType)}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{result.title}</p>
                        {result.subject && (
                          <p className="text-xs text-gray-500">{result.subject}</p>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* 선택된 콘텐츠 */}
            {selectedContent && (
              <div className="mt-3 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  {getContentTypeIcon(selectedContent.contentType)}
                  <span className="text-sm font-medium text-gray-900">
                    {selectedContent.title}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedContent(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* 관계 미리보기 */}
          {selectedContent && (
            <div className="mb-6 rounded-lg bg-gray-50 p-4">
              <p className="mb-2 text-xs font-medium text-gray-500">관계 미리보기</p>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-gray-900">
                  {direction === "prerequisite" ? selectedContent.title : currentContentTitle}
                </span>
                <ArrowRight className="h-4 w-4 text-gray-400" />
                <span className="font-medium text-gray-900">
                  {direction === "prerequisite" ? currentContentTitle : selectedContent.title}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {direction === "prerequisite"
                  ? `"${selectedContent.title}"을(를) 먼저 학습해야 "${currentContentTitle}"을(를) 학습할 수 있습니다.`
                  : `"${currentContentTitle}"을(를) 먼저 학습해야 "${selectedContent.title}"을(를) 학습할 수 있습니다.`}
              </p>
            </div>
          )}

          {/* 범위 선택 */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              적용 범위
            </label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as DependencyScope)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="global">전역 (모든 플랜에 적용)</option>
              {planGroupId && (
                <option value="plan_group">현재 플랜 그룹에만 적용</option>
              )}
            </select>
          </div>

          {/* 메모 */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              메모 (선택)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="의존성에 대한 메모를 입력하세요"
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedContent || isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                추가 중...
              </>
            ) : (
              "의존성 추가"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
