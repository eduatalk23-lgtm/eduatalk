"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTransition } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";
import {
  searchParents,
  createParentStudentLink,
  type SearchableParent,
  type StudentParent,
  type ParentRelation,
} from "@/app/(admin)/actions/parentStudentLinkActions";

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
  const [isPending, startTransition] = useTransition();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 이미 연결된 학부모 ID 목록
  const existingParentIds = new Set(existingParents.map((p) => p.parentId));

  // 검색 실행
  const performSearch = useCallback(
    async (query: string) => {
      if (!query || query.trim().length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      const result = await searchParents(query.trim());

      if (result.success && result.data) {
        // 이미 연결된 학부모 필터링
        const filtered = result.data.filter(
          (parent) => !existingParentIds.has(parent.id)
        );
        setSearchResults(filtered);
      } else {
        setSearchResults([]);
        if (result.error) {
          showError(result.error);
        }
      }
      setIsSearching(false);
    },
    [existingParentIds, showError]
  );

  // Debounce 검색
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);

    debounceTimerRef.current = timer;

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, performSearch]);

  // 모달 닫을 때 초기화
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setSearchResults([]);
      setSelectedRelation("mother");
      setIsSearching(false);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    }
  }, [isOpen]);

  function handleLink(parentId: string) {
    startTransition(async () => {
      const result = await createParentStudentLink(
        studentId,
        parentId,
        selectedRelation
      );

      if (result.success) {
        showSuccess("학부모가 연결되었습니다.");
        onSuccess?.();
        onClose();
      } else {
        showError(result.error || "연결에 실패했습니다.");
      }
    });
  }

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
          {isSearching && (
            <div className="py-8 text-center text-sm text-gray-500">
              검색 중...
            </div>
          )}

          {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-500">
              검색 결과가 없습니다.
            </div>
          )}

          {!isSearching && searchResults.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">
                검색 결과 ({searchResults.length}개)
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

