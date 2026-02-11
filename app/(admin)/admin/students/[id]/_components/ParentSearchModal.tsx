"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";
import {
  createParentStudentLink,
  type SearchableParent,
  type StudentParent,
  type ParentRelation,
} from "@/lib/domains/student";
import { useServerAction } from "@/lib/hooks/useServerAction";

type ParentSearchModalProps = {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  existingParents: StudentParent[];
  onSuccess?: () => void;
};

export function ParentSearchModal({
  isOpen,
  onClose,
  studentId,
  existingParents,
  onSuccess,
}: ParentSearchModalProps) {
  const { showSuccess, showError } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchableParent[]>([]);
  const [selectedRelation, setSelectedRelation] = useState<ParentRelation>("mother");
  const [isSearching, setIsSearching] = useState(false);
  const searchCounterRef = useRef(0);

  const { execute: executeLink, isPending } = useServerAction(createParentStudentLink, {
    onSuccess: () => {
      showSuccess("학부모가 연결되었습니다.");
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      showError(error);
    },
  });

  // 이미 연결된 학부모 ID 목록
  const existingParentIds = useMemo(
    () => new Set(existingParents.map((p) => p.parentId)),
    [existingParents]
  );

  // Ref로 최신 값 유지 (effect 의존성에서 제외하기 위해)
  const existingParentIdsRef = useRef(existingParentIds);
  existingParentIdsRef.current = existingParentIds;

  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;

  // Debounce + 검색을 하나의 effect로 통합 (searchQuery만 의존)
  useEffect(() => {
    const query = searchQuery.trim();

    if (query.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const currentSearch = ++searchCounterRef.current;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/parents/search?q=${encodeURIComponent(query)}`
        );
        const json = await res.json();

        // 이미 다른 검색이 시작된 경우 무시 (stale response 방지)
        if (currentSearch !== searchCounterRef.current) return;

        if (json.success && json.data) {
          const filtered = (json.data as SearchableParent[]).filter(
            (parent) => !existingParentIdsRef.current.has(parent.id)
          );
          setSearchResults(filtered);
        } else {
          setSearchResults([]);
        }
      } catch {
        if (currentSearch !== searchCounterRef.current) return;
        setSearchResults([]);
        showErrorRef.current("학부모 검색 중 오류가 발생했습니다.");
      }
      setIsSearching(false);
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // 모달 닫을 때 초기화
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setSearchResults([]);
      setSelectedRelation("mother");
      setIsSearching(false);
      searchCounterRef.current = 0;
    }
  }, [isOpen]);

  function handleLink(parentId: string) {
    executeLink(studentId, parentId, selectedRelation);
  }

  const hasQuery = searchQuery.trim().length >= 2;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={onClose}
      title="학부모 검색 및 연결"
      maxWidth="lg"
    >
      <DialogContent>
        <div className="space-y-4">
          {/* 검색 입력 */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="parent-search"
              className="text-sm font-medium text-gray-700"
            >
              이름 또는 이메일로 검색
            </label>
            <input
              id="parent-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="최소 2글자 이상 입력하세요..."
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            {searchQuery.length > 0 && searchQuery.length < 2 && (
              <p className="text-xs text-gray-500">
                최소 2글자 이상 입력해주세요.
              </p>
            )}
          </div>

          {/* 관계 선택 */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="relation-select"
              className="text-sm font-medium text-gray-700"
            >
              관계
            </label>
            <select
              id="relation-select"
              value={selectedRelation}
              onChange={(e) =>
                setSelectedRelation(e.target.value as ParentRelation)
              }
              disabled={isPending}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-100"
            >
              <option value="father">아버지</option>
              <option value="mother">어머니</option>
              <option value="guardian">보호자</option>
              <option value="other">기타</option>
            </select>
          </div>

          {/* 검색 결과 */}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                검색 결과 ({searchResults.length}개)
                {isSearching && (
                  <span className="text-xs text-gray-400">업데이트 중...</span>
                )}
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {searchResults.map((parent) => (
                  <div
                    key={parent.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 transition hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {parent.name || "이름 없음"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {parent.email || "-"}
                      </div>
                    </div>
                    <button
                      onClick={() => handleLink(parent.id)}
                      disabled={isPending}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed"
                    >
                      {isPending ? "연결 중..." : "연결"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isSearching && searchResults.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-500">
              검색 중...
            </div>
          )}

          {!isSearching && hasQuery && searchResults.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-500">
              검색 결과가 없습니다.
            </div>
          )}
        </div>
      </DialogContent>
      <DialogFooter>
        <button
          onClick={onClose}
          disabled={isPending}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
        >
          닫기
        </button>
      </DialogFooter>
    </Dialog>
  );
}
