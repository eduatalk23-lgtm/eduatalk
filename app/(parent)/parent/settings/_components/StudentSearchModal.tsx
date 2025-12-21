"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";
import {
  searchStudentsForLink,
  createLinkRequest,
  type SearchableStudent,
  type ParentRelation,
} from "@/app/(parent)/actions/parentStudentLinkRequestActions";
import { useServerAction } from "@/lib/hooks/useServerAction";
import { isSuccessResponse, isErrorResponse } from "@/lib/types/actionResponse";

type StudentSearchModalProps = {
  isOpen: boolean;
  onClose: () => void;
  parentId: string;
  onSuccess?: () => void;
};

export function StudentSearchModal({
  isOpen,
  onClose,
  parentId,
  onSuccess,
}: StudentSearchModalProps) {
  const { showSuccess, showError } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchableStudent[]>([]);
  const [selectedRelation, setSelectedRelation] = useState<ParentRelation>("mother");
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { execute: executeCreateLink, isPending } = useServerAction(createLinkRequest, {
    onSuccess: () => {
      showSuccess("연결 요청이 생성되었습니다.");
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      showError(error);
    },
  });

  // 검색 실행
  const performSearch = useCallback(
    async (query: string) => {
      if (!query || query.trim().length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      const result = await searchStudentsForLink(query.trim(), parentId);

      if (isSuccessResponse(result) && result.data) {
        setSearchResults(result.data);
      } else if (isErrorResponse(result)) {
        setSearchResults([]);
        if (result.error) {
          showError(result.error);
        }
      }
      setIsSearching(false);
    },
    [parentId, showError]
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

  function handleRequest(studentId: string) {
    executeCreateLink(studentId, parentId, selectedRelation);
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={onClose}
      title="학생 검색 및 연결 요청"
      maxWidth="lg"
    >
      <DialogContent>
        <div className="flex flex-col gap-4">
          {/* 검색 입력 */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="student-search"
              className="block text-sm font-medium text-gray-700"
            >
              이름으로 검색
            </label>
            <input
              id="student-search"
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
              className="block text-sm font-medium text-gray-700"
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
            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium text-gray-700">
                검색 결과 ({searchResults.length}개)
              </div>
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                {searchResults.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 transition hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {student.name || "이름 없음"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {student.grade && student.class
                          ? `${student.grade}학년 ${student.class}반`
                          : student.grade
                          ? `${student.grade}학년`
                          : "-"}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRequest(student.id)}
                      disabled={isPending}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed"
                    >
                      {isPending ? "요청 중..." : "연결 요청"}
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

