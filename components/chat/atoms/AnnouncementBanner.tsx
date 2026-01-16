"use client";

/**
 * AnnouncementBanner - 채팅방 공지 배너
 *
 * 채팅방 상단에 공지를 표시합니다.
 * 클릭하면 전체 공지를 볼 수 있고, 권한이 있으면 편집/삭제 가능.
 */

import { memo, useState } from "react";
import { cn } from "@/lib/cn";
import { Megaphone, X, ChevronDown, ChevronUp, Edit2 } from "lucide-react";
import type { AnnouncementInfo } from "@/lib/domains/chat/types";

interface AnnouncementBannerProps {
  /** 공지 정보 */
  announcement: AnnouncementInfo;
  /** 공지 설정/삭제 권한 여부 */
  canEdit: boolean;
  /** 공지 편집 버튼 클릭 */
  onEdit?: () => void;
  /** 공지 삭제 버튼 클릭 */
  onDelete?: () => void;
}

function AnnouncementBannerComponent({
  announcement,
  canEdit,
  onEdit,
  onDelete,
}: AnnouncementBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 공지 내용이 길면 축약 표시
  const isLongContent = announcement.content.length > 100;
  const displayContent = isExpanded
    ? announcement.content
    : announcement.content.slice(0, 100) + (isLongContent ? "..." : "");

  return (
    <div className="bg-warning-50 dark:bg-warning-900/20 border-b border-warning-200 dark:border-warning-900/30">
      <div className="flex items-start gap-2 px-4 py-2">
        <Megaphone className="w-4 h-4 text-warning-600 dark:text-warning-400 flex-shrink-0 mt-0.5" />

        <div className="flex-1 min-w-0">
          {/* 공지 내용 */}
          <div
            className={cn(
              "text-sm text-text-primary whitespace-pre-wrap break-words",
              !isExpanded && isLongContent && "cursor-pointer"
            )}
            onClick={() => isLongContent && setIsExpanded(!isExpanded)}
          >
            {displayContent}
          </div>

          {/* 작성자 + 시간 */}
          <div className="flex items-center gap-2 mt-1 text-xs text-text-tertiary">
            <span>{announcement.authorName}</span>
            <span>·</span>
            <span>
              {new Date(announcement.createdAt).toLocaleDateString("ko-KR", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>

        {/* 액션 버튼들 */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* 펼침/접기 버튼 (긴 내용일 때만) */}
          {isLongContent && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-warning-100 dark:hover:bg-warning-900/30 rounded transition-colors"
              aria-label={isExpanded ? "접기" : "펼치기"}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-text-tertiary" />
              ) : (
                <ChevronDown className="w-4 h-4 text-text-tertiary" />
              )}
            </button>
          )}

          {/* 편집 버튼 (권한 있을 때) */}
          {canEdit && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="p-1 hover:bg-warning-100 dark:hover:bg-warning-900/30 rounded transition-colors"
              aria-label="공지 편집"
            >
              <Edit2 className="w-3.5 h-3.5 text-text-tertiary hover:text-primary" />
            </button>
          )}

          {/* 삭제 버튼 (권한 있을 때) */}
          {canEdit && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-1 hover:bg-warning-100 dark:hover:bg-warning-900/30 rounded transition-colors"
              aria-label="공지 삭제"
            >
              <X className="w-3.5 h-3.5 text-text-tertiary hover:text-error" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export const AnnouncementBanner = memo(AnnouncementBannerComponent);
