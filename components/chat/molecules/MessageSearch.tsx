"use client";

/**
 * MessageSearch - 채팅방 내 메시지 검색 컴포넌트
 *
 * 검색어 입력 및 결과 표시
 * 검색 결과 클릭 시 해당 메시지로 스크롤
 * 페이지네이션 지원 (더 보기)
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { Search, X, Loader2 } from "lucide-react";
import { searchMessagesAction } from "@/lib/domains/chat/actions/messages";
import type { ChatMessageWithSender } from "@/lib/domains/chat/types";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

const SEARCH_PAGE_SIZE = 20;

interface MessageSearchProps {
  /** 채팅방 ID */
  roomId: string;
  /** 검색 모드 종료 */
  onClose: () => void;
  /** 검색 결과 메시지 클릭 */
  onSelectMessage: (messageId: string) => void;
}

export function MessageSearch({
  roomId,
  onClose,
  onSelectMessage,
}: MessageSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // 자동 포커스
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounce 검색어
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // 검색 쿼리 (무한 스크롤)
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["chat-search", roomId, debouncedQuery],
    queryFn: async ({ pageParam = 0 }) => {
      if (!debouncedQuery) return null;
      const result = await searchMessagesAction(roomId, debouncedQuery, {
        limit: SEARCH_PAGE_SIZE,
        offset: pageParam,
      });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage) return undefined;
      const loadedCount = allPages.reduce(
        (sum, page) => sum + (page?.messages.length ?? 0),
        0
      );
      // 더 불러올 데이터가 있으면 다음 offset 반환
      return loadedCount < lastPage.total ? loadedCount : undefined;
    },
    enabled: debouncedQuery.length > 0,
  });

  // 모든 페이지의 메시지 합치기
  const allMessages = data?.pages.flatMap((page) => page?.messages ?? []) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  // 검색어 하이라이트
  const highlightText = useCallback(
    (text: string, searchQuery: string) => {
      if (!searchQuery) return text;

      const parts = text.split(new RegExp(`(${searchQuery})`, "gi"));
      return parts.map((part, i) =>
        part.toLowerCase() === searchQuery.toLowerCase() ? (
          <mark key={i} className="bg-warning/30 text-text-primary rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      );
    },
    []
  );

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* 검색 입력창 */}
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <Search className="w-5 h-5 text-text-tertiary flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="메시지 검색..."
          className={cn(
            "flex-1 bg-transparent text-text-primary",
            "placeholder:text-text-tertiary",
            "focus:outline-none"
          )}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="p-1 text-text-tertiary hover:text-text-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-text-secondary hover:text-text-primary"
        >
          취소
        </button>
      </div>

      {/* 검색 결과 */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-8 text-error">
            검색 중 오류가 발생했습니다
          </div>
        ) : !debouncedQuery ? (
          <div className="flex items-center justify-center py-8 text-text-tertiary">
            검색어를 입력하세요
          </div>
        ) : allMessages.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-text-tertiary">
            &ldquo;{debouncedQuery}&rdquo; 검색 결과가 없습니다
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* 검색 결과 헤더 */}
            <div className="px-4 py-2 text-xs text-text-tertiary bg-bg-secondary">
              {total}개의 결과
            </div>

            {/* 결과 목록 */}
            {allMessages.map((message) => (
              <SearchResultItem
                key={message.id}
                message={message}
                query={debouncedQuery}
                highlightText={highlightText}
                onSelect={() => onSelectMessage(message.id)}
              />
            ))}

            {/* 더 보기 버튼 */}
            {hasNextPage && (
              <div className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className={cn(
                    "w-full py-2 text-sm text-primary hover:text-primary/80",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "flex items-center justify-center gap-2"
                  )}
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      불러오는 중...
                    </>
                  ) : (
                    `더 보기 (${allMessages.length}/${total})`
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface SearchResultItemProps {
  message: ChatMessageWithSender;
  query: string;
  highlightText: (text: string, query: string) => React.ReactNode;
  onSelect: () => void;
}

function SearchResultItem({
  message,
  query,
  highlightText,
  onSelect,
}: SearchResultItemProps) {
  const timeAgo = formatDistanceToNow(new Date(message.created_at), {
    addSuffix: true,
    locale: ko,
  });

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full px-4 py-3 text-left",
        "hover:bg-bg-secondary transition-colors"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-text-primary">
          {message.sender.name}
        </span>
        <span className="text-xs text-text-tertiary flex-shrink-0">
          {timeAgo}
        </span>
      </div>
      <p className="text-sm text-text-secondary line-clamp-2">
        {highlightText(message.content, query)}
      </p>
    </button>
  );
}
