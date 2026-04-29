"use client";

/**
 * MemberList - 멤버 탭 메인 컴포넌트
 *
 * 테넌트 내 멤버를 역할별 필터와 검색으로 탐색합니다.
 * 멤버 탭 시 프로필 카드 팝업을 표시합니다.
 */

import { memo, useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { chatMembersQueryOptions } from "@/lib/query-options/chatMembers";
import type { MemberRoleFilter, MemberListItem } from "@/lib/domains/chat/actions/members-list";
import type { ChatUserType } from "@/lib/domains/chat/types";
import { ProfileCardPopup } from "../molecules/ProfileCardPopup";
import type { ProfileCardData } from "../molecules/ProfileCardPopup";
import { Avatar } from "@/components/atoms/Avatar";
import { RoleBadge, type RoleBadgeKind } from "../atoms/RoleBadge";
import { cn } from "@/lib/cn";
import { Search, X, Loader2, Users, SearchX } from "lucide-react";

const RELATION_LABELS: Record<string, string> = {
  father: "아버지",
  mother: "어머니",
  guardian: "보호자",
  other: "기타",
};

// ============================================
// 필터 라벨
// ============================================

const FILTER_LABELS: Record<string, string> = {
  all: "전체",
  team: "팀",
  student: "학생",
  parent: "학부모",
  children: "내 자녀",
};

// 역할 배지는 RoleBadge 컴포넌트(@/components/chat/atoms/RoleBadge) 사용

// ============================================
// Props
// ============================================

interface MemberListProps {
  /** 현재 사용자 ID */
  currentUserId: string;
  /** 현재 사용자 유형 */
  userType: ChatUserType;
  /** 채팅 기본 경로 */
  basePath: string;
  /** 헤더 숨기기 (탭에서 이미 "멤버"를 표시할 때) */
  hideHeader?: boolean;
  /** 채팅방 이동 콜백 (플로팅 컨텍스트에서 패널 내 이동용) */
  onNavigateToRoom?: (roomId: string) => void;
}

// ============================================
// 컴포넌트
// ============================================

function MemberListComponent({ currentUserId, userType, basePath, hideHeader = false, onNavigateToRoom }: MemberListProps) {
  const [activeFilter, setActiveFilter] = useState<MemberRoleFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [profileCard, setProfileCard] = useState<{
    profile: ProfileCardData & { linkedParents?: MemberListItem["linkedParents"] };
    position: { x: number; y: number } | null;
  } | null>(null);

  // 항상 전체 조회 (1회), 필터는 클라이언트에서 처리
  const { data, isLoading } = useQuery(chatMembersQueryOptions());

  const availableFilters = data?.availableFilters ?? ["all"];

  // 역할 필터 + 이름 검색 (클라이언트 필터링)
  const filteredMembers = useMemo(() => {
    const members = data?.members ?? [];

    // 역할 필터
    const roleFiltered = activeFilter === "all"
      ? members
      : members.filter((m) => {
          if (activeFilter === "team") return m.userType === "admin";
          if (activeFilter === "student") return m.userType === "student";
          if (activeFilter === "parent") return m.userType === "parent";
          if (activeFilter === "children") return m.userType === "student" && !!m.relation;
          return true;
        });

    // 이름 검색
    if (!searchQuery.trim()) return roleFiltered;
    const query = searchQuery.toLowerCase();
    return roleFiltered.filter((m) => m.name.toLowerCase().includes(query));
  }, [data?.members, activeFilter, searchQuery]);

  // 멤버 클릭 → 프로필 카드
  const handleMemberClick = useCallback(
    (member: MemberListItem, e: React.MouseEvent) => {
      // 자기 자신은 프로필 카드 안 띄움
      if (member.userId === currentUserId) return;

      const isDesktop = window.matchMedia("(min-width: 768px)").matches;

      setProfileCard({
        profile: {
          userId: member.userId,
          userType: member.userType,
          name: member.name,
          profileImageUrl: member.profileImageUrl,
          schoolName: member.schoolName,
          gradeDisplay: member.gradeDisplay,
          linkedParents: member.linkedParents,
        },
        position: isDesktop ? { x: e.clientX + 8, y: e.clientY - 20 } : null,
      });
    },
    [currentUserId]
  );

  const handleCloseProfile = useCallback(() => setProfileCard(null), []);

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-lg text-text-primary">멤버</h2>
          <span className="text-xs text-text-tertiary">
            {filteredMembers.length}명
          </span>
        </div>
      )}

      {/* 필터 토글 */}
      <div className="px-4 py-2 flex gap-1.5 overflow-x-auto scrollbar-hide">
        {availableFilters.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
              activeFilter === filter
                ? "bg-primary-500 text-white"
                : "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary"
            )}
          >
            {FILTER_LABELS[filter] ?? filter}
          </button>
        ))}
      </div>

      {/* 검색창 */}
      <div className="px-4 py-2">
        <div className="flex items-center gap-2 px-3 py-2 bg-bg-secondary rounded-xl">
          <Search className="w-5 h-5 text-text-tertiary flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이름 검색..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="p-1 text-text-tertiary hover:text-text-secondary"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 멤버 목록 */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {filteredMembers.length === 0 && searchQuery.trim() ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 gap-2">
            <SearchX className="w-8 h-8 text-text-tertiary" />
            <p className="text-text-secondary text-sm">검색 결과가 없습니다</p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 gap-3">
            <Users className="w-8 h-8 text-text-tertiary" />
            <p className="text-text-secondary text-sm">멤버가 없습니다</p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {filteredMembers.map((member) => (
              <MemberListItemRow
                key={`${member.userType}-${member.userId}`}
                member={member}
                isMe={member.userId === currentUserId}
                onClick={handleMemberClick}
              />
            ))}
          </ul>
        )}
      </div>

      {/* 프로필 카드 팝업 */}
      <ProfileCardPopup
        isOpen={!!profileCard}
        onClose={handleCloseProfile}
        profile={profileCard?.profile ?? null}
        position={profileCard?.position}
        currentUserId={currentUserId}
        basePath={basePath}
        viewerType={userType}
        onNavigateToRoom={onNavigateToRoom}
      />
    </div>
  );
}

// ============================================
// MemberListItemRow
// ============================================

interface MemberListItemRowProps {
  member: MemberListItem;
  isMe: boolean;
  onClick: (member: MemberListItem, e: React.MouseEvent) => void;
}

const MemberListItemRow = memo(function MemberListItemRow({
  member,
  isMe,
  onClick,
}: MemberListItemRowProps) {
  // admin 사용자가 consultant 인 경우 별도 분기, 그 외 admin/superadmin 은 admin 으로 통일
  const roleKey: RoleBadgeKind =
    member.userType === "admin"
      ? member.adminRole === "consultant"
        ? "consultant"
        : "admin"
      : (member.userType as "student" | "parent");
  const subInfo = [member.schoolName, member.gradeDisplay].filter(Boolean).join(" · ");

  return (
    <li>
      <button
        type="button"
        onClick={(e) => onClick(member, e)}
        disabled={isMe}
        className={cn(
          "w-full flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors text-left",
          isMe ? "opacity-60 cursor-default" : "hover:bg-bg-secondary active:bg-bg-tertiary"
        )}
      >
        <Avatar
          src={member.profileImageUrl}
          name={member.name}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-text-primary truncate">
              {member.name}
            </span>
            {isMe && (
              <span className="text-3xs text-text-tertiary font-medium">(나)</span>
            )}
            <RoleBadge role={roleKey} className="text-3xs px-1.5" />
          </div>
          {(subInfo || member.relation) && (
            <p className="text-xs text-text-tertiary mt-0.5 truncate">
              {member.relation ? (RELATION_LABELS[member.relation] ?? member.relation) : subInfo}
            </p>
          )}
        </div>
      </button>
    </li>
  );
});

export const MemberList = memo(MemberListComponent);
