"use client";

/**
 * ChatRoomInfo - 채팅방 정보 사이드바
 *
 * 채팅방 참여자 목록, 초대, 나가기 기능을 제공합니다.
 */

import { memo, useCallback, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { SlideOverPanel } from "@/components/layouts/SlideOver";
import { Avatar } from "@/components/atoms/Avatar";
import { Skeleton } from "@/components/atoms/Skeleton";
import { leaveChatRoomAction } from "@/lib/domains/chat/actions";
import type { ChatRoom, ChatRoomMemberWithUser, ChatMemberRole } from "@/lib/domains/chat/types";
import { cn } from "@/lib/cn";
import { UserPlus, LogOut, Crown, Shield, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { InviteMemberModal } from "./InviteMemberModal";

interface ChatRoomInfoProps {
  /** 사이드바 열림 상태 */
  isOpen: boolean;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 채팅방 ID */
  roomId: string;
  /** 현재 사용자 ID */
  userId: string;
  /** 채팅방 정보 */
  room?: ChatRoom;
  /** 멤버 목록 */
  members?: ChatRoomMemberWithUser[];
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 채팅 목록 경로 (기본값: /chat) */
  basePath?: string;
}

/** 역할별 배지 텍스트 */
const roleBadges: Record<ChatMemberRole, { text: string; icon: typeof Crown }> = {
  owner: { text: "방장", icon: Crown },
  admin: { text: "관리자", icon: Shield },
  member: { text: "", icon: Crown },
};

function ChatRoomInfoComponent({
  isOpen,
  onClose,
  roomId,
  userId,
  room,
  members,
  isLoading = false,
  basePath = "/chat",
}: ChatRoomInfoProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  // 초대 모달 상태
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  // 나가기 로딩 상태 (중복 클릭 방지)
  const [isLeaving, setIsLeaving] = useState(false);

  // 활성 멤버만 필터링 (left_at === null)
  const activeMembers = members?.filter((m) => m.left_at === null) ?? [];
  const memberCount = activeMembers.length;

  // 기존 멤버 ID 목록 (초대 모달에서 필터링용)
  const existingMemberIds = useMemo(
    () => activeMembers.map((m) => m.user_id),
    [activeMembers]
  );

  // 채팅방 나가기 핸들러
  const handleLeaveRoom = useCallback(async () => {
    const confirmed = window.confirm("채팅방을 나가시겠습니까?");
    if (!confirmed) return;

    setIsLeaving(true);
    try {
      const result = await leaveChatRoomAction(roomId);
      if (result.success) {
        // 캐시 정리 (백그라운드에서 진행)
        queryClient.invalidateQueries({ queryKey: ["chat-rooms"] });
        queryClient.removeQueries({ queryKey: ["chat-messages", roomId] });
        queryClient.removeQueries({ queryKey: ["chat-room", roomId] });

        // 성공 메시지 표시
        showSuccess("채팅방을 나갔습니다.");

        // 채팅 목록으로 이동 (replace로 뒤로가기 방지)
        // onClose() 호출 제거 - 페이지가 이동하므로 불필요
        router.replace(basePath);
      } else {
        showError(result.error ?? "채팅방 나가기 실패");
        setIsLeaving(false);
      }
    } catch {
      showError("채팅방 나가기 중 오류가 발생했습니다.");
      setIsLeaving(false);
    }
  }, [roomId, basePath, router, showSuccess, showError, queryClient]);

  // 초대 버튼 핸들러
  const handleInvite = useCallback(() => {
    setIsInviteModalOpen(true);
  }, []);

  // 사이드바 Footer
  const footer = (
    <button
      type="button"
      onClick={handleLeaveRoom}
      disabled={isLeaving}
      className={cn(
        "flex items-center justify-center gap-2 w-full",
        "py-3 rounded-lg",
        "text-red-600 dark:text-red-400",
        "hover:bg-red-50 dark:hover:bg-red-950/30",
        "transition-colors",
        isLeaving && "opacity-50 cursor-not-allowed"
      )}
    >
      {isLeaving ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <LogOut className="w-5 h-5" />
      )}
      <span className="font-medium">{isLeaving ? "나가는 중..." : "채팅방 나가기"}</span>
    </button>
  );

  return (
    <SlideOverPanel
      isOpen={isOpen}
      onClose={onClose}
      id="chat-room-info"
      title="채팅방 정보"
      size="sm"
      footer={footer}
    >
      {/* 로딩 상태 */}
      {isLoading ? (
        <div className="space-y-4">
          {/* 섹션 헤더 스켈레톤 */}
          <Skeleton variant="text" className="h-5 w-24" />

          {/* 멤버 스켈레톤 */}
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Skeleton variant="circular" width={40} height={40} />
                <Skeleton variant="text" className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 참여자 섹션 */}
          <section>
            <h3 className="text-sm font-medium text-text-secondary mb-3">
              참여자 ({memberCount}명)
            </h3>

            <ul className="space-y-1">
              {activeMembers.map((member) => {
                const isMe = member.user_id === userId;
                const roleInfo = roleBadges[member.role];

                return (
                  <li
                    key={member.id}
                    className={cn(
                      "flex items-center gap-3 py-2 px-2 rounded-lg",
                      "hover:bg-bg-secondary transition-colors"
                    )}
                  >
                    <Avatar
                      src={member.user.profileImageUrl}
                      name={member.user.name}
                      size="md"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary truncate">
                          {member.user.name}
                        </span>

                        {/* 나 배지 */}
                        {isMe && (
                          <span className="text-xs text-text-tertiary">(나)</span>
                        )}
                      </div>
                    </div>

                    {/* 역할 배지 */}
                    {member.role !== "member" && (
                      <div
                        className={cn(
                          "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                          member.role === "owner"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        )}
                      >
                        <roleInfo.icon className="w-3 h-3" />
                        <span>{roleInfo.text}</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {/* 초대 버튼 (그룹채팅만) */}
          {room?.type === "group" && (
            <button
              type="button"
              onClick={handleInvite}
              className={cn(
                "flex items-center justify-center gap-2 w-full",
                "py-3 rounded-lg border border-border",
                "text-text-secondary",
                "hover:bg-bg-secondary hover:text-text-primary",
                "transition-colors"
              )}
            >
              <UserPlus className="w-5 h-5" />
              <span className="font-medium">초대하기</span>
            </button>
          )}
        </div>
      )}

      {/* 멤버 초대 모달 */}
      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        roomId={roomId}
        existingMemberIds={existingMemberIds}
      />
    </SlideOverPanel>
  );
}

export const ChatRoomInfo = memo(ChatRoomInfoComponent);
export default ChatRoomInfo;
