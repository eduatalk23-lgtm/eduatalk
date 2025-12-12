"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTransition } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";

type SearchModalProps<T> = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  searchPlaceholder: string;
  searchLabel: string;
  searchFn: (query: string) => Promise<{ success: boolean; data?: T[]; error?: string }>;
  renderResult: (item: T, onSelect: (item: T) => void, isPending: boolean) => React.ReactNode;
  onSelect: (item: T) => Promise<{ success: boolean; error?: string }>;
  relationOptions?: { value: string; label: string }[];
  onRelationChange?: (relation: string) => void;
  selectedRelation?: string;
  successMessage?: string;
  onSuccess?: () => void;
  filterExisting?: (item: T) => boolean;
};

export function SearchModal<T extends { id: string }>({
  isOpen,
  onClose,
  title,
  searchPlaceholder,
  searchLabel,
  searchFn,
  renderResult,
  onSelect,
  relationOptions,
  onRelationChange,
  selectedRelation,
  successMessage,
  onSuccess,
  filterExisting,
}: SearchModalProps<T>) {
  const { showSuccess, showError } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<T[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPending, startTransition] = useTransition();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 검색 실행
  const performSearch = useCallback(
    async (query: string) => {
      if (!query || query.trim().length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      const result = await searchFn(query.trim());

      if (result.success && result.data) {
        // 기존 항목 필터링 (있는 경우)
        const filtered = filterExisting
          ? result.data.filter(filterExisting)
          : result.data;
        setSearchResults(filtered);
      } else {
        setSearchResults([]);
        if (result.error) {
          showError(result.error);
        }
      }
      setIsSearching(false);
    },
    [searchFn, filterExisting, showError]
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
      setIsSearching(false);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    }
  }, [isOpen]);

  function handleSelect(item: T) {
    startTransition(async () => {
      const result = await onSelect(item);

      if (result.success) {
        if (successMessage) {
          showSuccess(successMessage);
        }
        onSuccess?.();
        onClose();
      } else {
        showError(result.error || "처리에 실패했습니다.");
      }
    });
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={onClose}
      title={title}
      maxWidth="lg"
    >
      <DialogContent>
        <div className="space-y-4">
          {/* 검색 입력 */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="search-input"
              className="block text-sm font-medium text-gray-700"
            >
              {searchLabel}
            </label>
            <input
              id="search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            {searchQuery.length > 0 && searchQuery.length < 2 && (
              <p className="text-xs text-gray-500">
                최소 2글자 이상 입력해주세요.
              </p>
            )}
          </div>

          {/* 관계 선택 */}
          {relationOptions && onRelationChange && selectedRelation && (
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
                onChange={(e) => onRelationChange(e.target.value)}
                disabled={isPending}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-100"
              >
                {relationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

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
                {searchResults.map((item) => renderResult(item, handleSelect, isPending))}
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

