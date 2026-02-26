"use client";

/**
 * MediaGallery - 채팅방 미디어/파일 갤러리
 *
 * 채팅방에서 공유된 이미지, 동영상, 파일을 탭별로 모아보는 컴포넌트.
 * ChatRoomInfo 사이드바의 "파일" 탭에서 사용.
 * 상단 검색바로 파일명 검색 지원.
 */

import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Image as ImageIcon,
  FileText,
  Film,
  Loader2,
  ImageOff,
  Search,
  X,
} from "lucide-react";
import { Tabs, TabPanel, type Tab } from "@/components/molecules/Tabs";
import type { ChatAttachment } from "@/lib/domains/chat/types";
import {
  getRoomAttachmentsAction,
  searchRoomAttachmentsAction,
  refreshAttachmentUrlsAction,
} from "@/lib/domains/chat/actions/attachments";
import { formatFileSize, getFileTypeLabel } from "@/lib/domains/chat/fileValidation";
import { cn } from "@/lib/cn";

interface MediaGalleryProps {
  roomId: string;
  onImageClick?: (attachment: ChatAttachment, allImages: ChatAttachment[]) => void;
}

type GalleryTab = "image" | "video" | "file";

const GALLERY_TABS: Tab[] = [
  { id: "image", label: "이미지", icon: <ImageIcon className="w-4 h-4" /> },
  { id: "video", label: "동영상", icon: <Film className="w-4 h-4" /> },
  { id: "file", label: "파일", icon: <FileText className="w-4 h-4" /> },
];

const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 400;

function MediaGalleryComponent({ roomId, onImageClick }: MediaGalleryProps) {
  const [activeTab, setActiveTab] = useState<GalleryTab>("image");

  // 일반 탭 데이터
  const [items, setItems] = useState<Record<GalleryTab, ChatAttachment[]>>({
    image: [],
    video: [],
    file: [],
  });
  const [hasMore, setHasMore] = useState<Record<GalleryTab, boolean>>({
    image: true,
    video: true,
    file: true,
  });
  const [loading, setLoading] = useState<Record<GalleryTab, boolean>>({
    image: false,
    video: false,
    file: false,
  });
  const [initialLoaded, setInitialLoaded] = useState<Record<GalleryTab, boolean>>({
    image: false,
    video: false,
    file: false,
  });

  // 검색 상태
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ChatAttachment[]>([]);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const latestSearchRef = useRef("");

  const isSearchMode = searchQuery.trim().length > 0;

  // ============================================
  // 일반 탭 로드
  // ============================================

  // ref로 상태 추적 (useCallback deps 안정화)
  const loadingRef = useRef(loading);
  loadingRef.current = loading;
  const initialLoadedRef = useRef(initialLoaded);
  initialLoadedRef.current = initialLoaded;

  const loadAttachments = useCallback(
    async (tab: GalleryTab, cursor?: string) => {
      if (loadingRef.current[tab] || (!cursor && initialLoadedRef.current[tab])) return;

      setLoading((prev) => ({ ...prev, [tab]: true }));

      try {
        const queryOptions: {
          attachmentType?: string;
          attachmentTypes?: string[];
          limit: number;
          cursor?: string;
        } = { limit: PAGE_SIZE, cursor };

        if (tab === "file") {
          queryOptions.attachmentTypes = ["audio", "file"];
        } else {
          queryOptions.attachmentType = tab;
        }

        const result = await getRoomAttachmentsAction(roomId, queryOptions);

        if (result.success && result.data) {
          setItems((prev) => ({
            ...prev,
            [tab]: cursor
              ? [...prev[tab], ...result.data!.attachments]
              : result.data!.attachments,
          }));
          setHasMore((prev) => ({ ...prev, [tab]: result.data!.hasMore }));
        }
      } catch (err) {
        console.error("[MediaGallery] Load error:", err);
      } finally {
        setLoading((prev) => ({ ...prev, [tab]: false }));
        setInitialLoaded((prev) => ({ ...prev, [tab]: true }));
      }
    },
    [roomId]
  );

  useEffect(() => {
    if (!isSearchMode && !initialLoaded[activeTab]) {
      loadAttachments(activeTab);
    }
  }, [activeTab, initialLoaded, loadAttachments, isSearchMode]);

  // ============================================
  // 검색
  // ============================================

  const executeSearch = useCallback(
    async (query: string, cursor?: string) => {
      if (query.length === 0) return;

      setSearchLoading(true);
      latestSearchRef.current = query;

      try {
        const result = await searchRoomAttachmentsAction(roomId, query, {
          limit: PAGE_SIZE,
          cursor,
        });

        // 검색어가 바뀌었으면 결과 무시
        if (latestSearchRef.current !== query) return;

        if (result.success && result.data) {
          setSearchResults((prev) =>
            cursor ? [...prev, ...result.data!.attachments] : result.data!.attachments
          );
          setSearchHasMore(result.data.hasMore);
        }
      } catch (err) {
        console.error("[MediaGallery] Search error:", err);
      } finally {
        setSearchLoading(false);
      }
    },
    [roomId]
  );

  const handleLoadMore = useCallback(() => {
    if (isSearchMode) {
      // 검색 더보기
      const lastItem = searchResults[searchResults.length - 1];
      if (lastItem) {
        executeSearch(searchQuery.trim(), lastItem.created_at);
      }
      return;
    }
    const tabItems = items[activeTab];
    const lastItem = tabItems[tabItems.length - 1];
    if (lastItem) {
      loadAttachments(activeTab, lastItem.created_at);
    }
  }, [isSearchMode, searchQuery, searchResults, activeTab, items, loadAttachments, executeSearch]);

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId as GalleryTab);
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);

      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }

      const trimmed = value.trim();
      if (trimmed.length === 0) {
        setSearchResults([]);
        setSearchHasMore(false);
        return;
      }

      searchTimerRef.current = setTimeout(() => {
        executeSearch(trimmed);
      }, SEARCH_DEBOUNCE_MS);
    },
    [executeSearch]
  );

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchResults([]);
    setSearchHasMore(false);
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
  }, []);

  // cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  // ============================================
  // 렌더링
  // ============================================

  return (
    <div className="flex flex-col h-full">
      {/* 검색 입력 */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="파일명으로 검색..."
          className={cn(
            "w-full pl-9 pr-8 py-2 text-sm rounded-lg",
            "bg-bg-secondary border border-transparent",
            "focus:border-primary focus:outline-none",
            "text-text-primary placeholder:text-text-tertiary"
          )}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={handleClearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-bg-tertiary"
            aria-label="검색 초기화"
          >
            <X className="w-4 h-4 text-text-tertiary" />
          </button>
        )}
      </div>

      {/* 검색 모드 */}
      {isSearchMode ? (
        <SearchResults
          attachments={searchResults}
          loading={searchLoading}
          hasMore={searchHasMore}
          onLoadMore={handleLoadMore}
          onImageClick={onImageClick}
          query={searchQuery.trim()}
        />
      ) : (
        <>
          <Tabs
            tabs={GALLERY_TABS}
            activeTab={activeTab}
            onChange={handleTabChange}
            variant="line"
            size="sm"
            fullWidth
          />

          <TabPanel
            tabId="image"
            activeTab={activeTab}
            className="flex-1 overflow-y-auto pt-3"
          >
            <ImageGallery
              attachments={items.image}
              loading={loading.image}
              hasMore={hasMore.image}
              onLoadMore={handleLoadMore}
              onImageClick={onImageClick}
            />
          </TabPanel>

          <TabPanel
            tabId="video"
            activeTab={activeTab}
            className="flex-1 overflow-y-auto pt-3"
          >
            <VideoGallery
              attachments={items.video}
              loading={loading.video}
              hasMore={hasMore.video}
              onLoadMore={handleLoadMore}
            />
          </TabPanel>

          <TabPanel
            tabId="file"
            activeTab={activeTab}
            className="flex-1 overflow-y-auto pt-3"
          >
            <FileGallery
              attachments={items.file}
              loading={loading.file}
              hasMore={hasMore.file}
              onLoadMore={handleLoadMore}
            />
          </TabPanel>
        </>
      )}
    </div>
  );
}

// ============================================
// 검색 결과 (모든 타입 통합)
// ============================================

function SearchResults({
  attachments,
  loading,
  hasMore,
  onLoadMore,
  onImageClick,
  query,
}: {
  attachments: ChatAttachment[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onImageClick?: (attachment: ChatAttachment, allImages: ChatAttachment[]) => void;
  query: string;
}) {
  if (!loading && attachments.length === 0) {
    return (
      <EmptyState text={`"${query}"에 대한 검색 결과가 없습니다.`} />
    );
  }

  const images = attachments.filter((a) => a.attachment_type === "image");

  return (
    <div className="space-y-1 pt-2">
      {attachments.map((att) => {
        if (att.attachment_type === "image") {
          return (
            <button
              key={att.id}
              type="button"
              onClick={() => onImageClick?.(att, images)}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg",
                "hover:bg-bg-secondary transition-colors text-left"
              )}
            >
              <div className="w-10 h-10 rounded-lg bg-bg-secondary flex items-center justify-center flex-shrink-0 overflow-hidden">
                <SearchImageThumb attachment={att} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">{att.file_name}</p>
                <p className="text-xs text-text-tertiary">
                  이미지 · {formatFileSize(att.file_size)}
                </p>
              </div>
            </button>
          );
        }

        return (
          <button
            key={att.id}
            type="button"
            onClick={() => window.open(att.public_url, "_blank", "noopener")}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg",
              "hover:bg-bg-secondary transition-colors text-left"
            )}
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              {att.attachment_type === "video" ? (
                <Film className="w-5 h-5 text-primary" />
              ) : (
                <FileText className="w-5 h-5 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-primary truncate">{att.file_name}</p>
              <p className="text-xs text-text-tertiary">
                {getFileTypeLabel(att.mime_type)} · {formatFileSize(att.file_size)}
              </p>
            </div>
          </button>
        );
      })}
      <LoadMoreButton loading={loading} hasMore={hasMore} onLoadMore={onLoadMore} />
    </div>
  );
}

/** 검색 결과 이미지 썸네일 */
function SearchImageThumb({ attachment }: { attachment: ChatAttachment }) {
  const [src, setSrc] = useState(attachment.thumbnail_url ?? attachment.public_url);
  const [failed, setFailed] = useState(false);
  const refreshAttempted = useRef(false);

  const handleError = useCallback(async () => {
    if (refreshAttempted.current) {
      setFailed(true);
      return;
    }
    refreshAttempted.current = true;
    const result = await refreshAttachmentUrlsAction([attachment.id]);
    if (result.success && result.data?.[attachment.id]) {
      const refreshed = result.data[attachment.id];
      setSrc(refreshed.thumbnailUrl ?? refreshed.publicUrl);
    } else {
      setFailed(true);
    }
  }, [attachment.id]);

  if (failed) {
    return <ImageOff className="w-5 h-5 text-text-tertiary" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={attachment.file_name}
      className="w-full h-full object-cover"
      loading="lazy"
      onError={handleError}
    />
  );
}

// ============================================
// 탭별 갤러리 컴포넌트
// ============================================

/** 이미지 그리드 갤러리 */
function ImageGallery({
  attachments,
  loading,
  hasMore,
  onLoadMore,
  onImageClick,
}: {
  attachments: ChatAttachment[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onImageClick?: (attachment: ChatAttachment, allImages: ChatAttachment[]) => void;
}) {
  if (!loading && attachments.length === 0) {
    return <EmptyState text="공유된 이미지가 없습니다." />;
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-1">
        {attachments.map((att) => (
          <GalleryImageItem
            key={att.id}
            attachment={att}
            onClick={() => onImageClick?.(att, attachments)}
          />
        ))}
      </div>
      <LoadMoreButton loading={loading} hasMore={hasMore} onLoadMore={onLoadMore} />
    </>
  );
}

/** 갤러리 이미지 아이템 (만료 시 자동 refresh) */
function GalleryImageItem({
  attachment,
  onClick,
}: {
  attachment: ChatAttachment;
  onClick: () => void;
}) {
  const [src, setSrc] = useState(attachment.thumbnail_url ?? attachment.public_url);
  const [failed, setFailed] = useState(false);
  const refreshAttempted = useRef(false);

  const handleError = useCallback(async () => {
    if (refreshAttempted.current) {
      setFailed(true);
      return;
    }
    refreshAttempted.current = true;

    const result = await refreshAttachmentUrlsAction([attachment.id]);
    if (result.success && result.data?.[attachment.id]) {
      const refreshed = result.data[attachment.id];
      setSrc(refreshed.thumbnailUrl ?? refreshed.publicUrl);
    } else {
      setFailed(true);
    }
  }, [attachment.id]);

  if (failed) {
    return (
      <div className="aspect-square bg-bg-secondary flex items-center justify-center rounded">
        <ImageOff className="w-6 h-6 text-text-tertiary" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="aspect-square overflow-hidden rounded bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-primary"
      aria-label={`이미지: ${attachment.file_name}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={attachment.file_name}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={handleError}
      />
    </button>
  );
}

/** 동영상 갤러리 */
function VideoGallery({
  attachments,
  loading,
  hasMore,
  onLoadMore,
}: {
  attachments: ChatAttachment[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}) {
  if (!loading && attachments.length === 0) {
    return <EmptyState text="공유된 동영상이 없습니다." />;
  }

  return (
    <>
      <div className="space-y-2">
        {attachments.map((att) => (
          <button
            key={att.id}
            type="button"
            onClick={() => window.open(att.public_url, "_blank", "noopener")}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg",
              "hover:bg-bg-secondary transition-colors text-left"
            )}
          >
            <div className="w-12 h-12 rounded-lg bg-bg-secondary flex items-center justify-center flex-shrink-0 overflow-hidden">
              {att.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={att.thumbnail_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <Film className="w-5 h-5 text-text-tertiary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-primary truncate">{att.file_name}</p>
              <p className="text-xs text-text-tertiary">
                {formatFileSize(att.file_size)}
              </p>
            </div>
          </button>
        ))}
      </div>
      <LoadMoreButton loading={loading} hasMore={hasMore} onLoadMore={onLoadMore} />
    </>
  );
}

/** 파일 목록 갤러리 */
function FileGallery({
  attachments,
  loading,
  hasMore,
  onLoadMore,
}: {
  attachments: ChatAttachment[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}) {
  if (!loading && attachments.length === 0) {
    return <EmptyState text="공유된 파일이 없습니다." />;
  }

  return (
    <>
      <div className="space-y-1">
        {attachments.map((att) => (
          <button
            key={att.id}
            type="button"
            onClick={() => window.open(att.public_url, "_blank", "noopener")}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg",
              "hover:bg-bg-secondary transition-colors text-left"
            )}
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-primary truncate">{att.file_name}</p>
              <p className="text-xs text-text-tertiary">
                {getFileTypeLabel(att.mime_type)} · {formatFileSize(att.file_size)}
              </p>
            </div>
          </button>
        ))}
      </div>
      <LoadMoreButton loading={loading} hasMore={hasMore} onLoadMore={onLoadMore} />
    </>
  );
}

// ============================================
// 공통 UI 컴포넌트
// ============================================

/** 빈 상태 */
function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
      <p className="text-sm">{text}</p>
    </div>
  );
}

/** 더보기 버튼 */
function LoadMoreButton({
  loading,
  hasMore,
  onLoadMore,
}: {
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (!hasMore) return null;

  return (
    <button
      type="button"
      onClick={onLoadMore}
      className="w-full py-3 text-sm text-text-secondary hover:text-text-primary transition-colors"
    >
      더보기
    </button>
  );
}

export const MediaGallery = memo(MediaGalleryComponent);
