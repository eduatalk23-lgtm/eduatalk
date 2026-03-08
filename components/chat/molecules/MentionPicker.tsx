"use client";

/**
 * MentionPicker - 멘션 자동완성 팝업
 *
 * ChatInput에서 @ 입력 시 표시되는 멤버 선택 목록입니다.
 */

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/atoms/Avatar";
import type { ChatRoomMemberWithUser } from "@/lib/domains/chat/types";

interface MentionPickerProps {
  /** 채팅방 멤버 목록 */
  members: ChatRoomMemberWithUser[];
  /** 검색 쿼리 (@ 뒤에 입력된 텍스트) */
  query: string;
  /** 현재 사용자 ID (목록에서 제외) */
  currentUserId: string;
  /** 멤버 선택 핸들러 */
  onSelect: (member: ChatRoomMemberWithUser) => void;
  /** 닫기 핸들러 */
  onClose: () => void;
}

function MentionPickerComponent({
  members,
  query,
  currentUserId,
  onSelect,
  onClose,
}: MentionPickerProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // 필터링: 본인 제외, 퇴장 멤버 제외, 쿼리로 필터
  const filteredMembers = members.filter((m) => {
    if (m.user_id === currentUserId) return false;
    if (m.left_at) return false;
    if (!query) return true;
    return m.user.name.toLowerCase().includes(query.toLowerCase());
  });

  // 필터 결과 변경 시 선택 인덱스 리셋
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredMembers.length]);

  // 선택된 항목으로 스크롤
  useEffect(() => {
    const items = listRef.current?.querySelectorAll("[data-mention-item]");
    items?.[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // 키보드 네비게이션
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (filteredMembers.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredMembers.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        const selected = filteredMembers[selectedIndex];
        if (selected) onSelect(selected);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [filteredMembers, selectedIndex, onSelect, onClose]);

  const handleClick = useCallback(
    (member: ChatRoomMemberWithUser) => {
      onSelect(member);
    },
    [onSelect]
  );

  if (filteredMembers.length === 0) {
    return null;
  }

  return (
    <div
      ref={listRef}
      className={cn(
        "absolute bottom-full left-0 right-0 mb-1 z-20",
        "bg-bg-primary border border-border rounded-xl shadow-lg",
        "max-h-[200px] overflow-y-auto",
        "animate-in fade-in slide-in-from-bottom-2 duration-150"
      )}
      role="listbox"
      aria-label="멘션할 멤버 선택"
    >
      <div className="py-1">
        {filteredMembers.map((member, index) => (
          <button
            key={`${member.user_id}_${member.user_type}`}
            type="button"
            data-mention-item
            onClick={() => handleClick(member)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 text-left",
              "hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors",
              index === selectedIndex && "bg-secondary-100 dark:bg-secondary-800 ring-2 ring-inset ring-primary/30"
            )}
            role="option"
            aria-selected={index === selectedIndex}
          >
            <Avatar
              src={member.user.profileImageUrl}
              name={member.user.name}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {member.user.name}
              </p>
              {member.user.gradeDisplay && (
                <p className="text-xs text-text-tertiary truncate">
                  {member.user.gradeDisplay}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export const MentionPicker = memo(MentionPickerComponent);
