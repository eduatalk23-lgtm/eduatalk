"use client";

/**
 * ProfileCardPopup - 프로필 카드 팝업
 *
 * 채팅방에서 아바타 클릭 시, 또는 멤버 탭에서 멤버 클릭 시 표시되는 프로필 카드입니다.
 *
 * 데스크톱: 클릭 위치 근처에 위치 기반 팝업 (팝오버 안에서도 자연스러움)
 * 모바일: 하단 시트 (바텀시트)
 *
 * viewerType에 따라 액션 버튼이 달라집니다:
 * - Admin → 학생: [1:1 채팅] [상담] [학부모 포함]
 * - Admin → 팀/학부모: [1:1 채팅]
 * - Student → 팀: [1:1 채팅]
 * - Student → 학부모: (액션 없음)
 * - Parent → 팀: [1:1 채팅]
 */

import { memo, useCallback, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { lockScroll, unlockScroll } from "@/lib/utils/scrollLock";
import { useToast } from "@/components/ui/ToastProvider";
import { Avatar } from "@/components/atoms/Avatar";
import { MessageSquare, X, Loader2, BookOpen, Users } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ChatUserType } from "@/lib/domains/chat/types";
import type { LinkedParentInfo } from "@/lib/domains/chat/actions/members-list";

/** 프로필 카드에 표시할 데이터 */
export interface ProfileCardData {
  userId: string;
  userType: ChatUserType;
  name: string;
  profileImageUrl?: string | null;
  schoolName?: string | null;
  gradeDisplay?: string | null;
  /** 연결 학부모 (학생 프로필에서 admin이 볼 때) */
  linkedParents?: LinkedParentInfo[];
}

/** 역할 라벨 */
const roleLabels: Record<ChatUserType, string> = {
  student: "학생",
  admin: "관리자",
  parent: "학부모",
};

/** 역할 색상 */
const roleColors: Record<ChatUserType, string> = {
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  student: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  parent: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

/** 관계 라벨 */
const relationLabels: Record<string, string> = {
  father: "아버지",
  mother: "어머니",
  guardian: "보호자",
  other: "기타",
};

interface ProfileCardPopupProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ProfileCardData | null;
  /** 클릭 위치 (있으면 데스크톱 팝업, 없으면 모바일 바텀시트) */
  position?: { x: number; y: number } | null;
  currentUserId?: string;
  basePath?: string;
  /** 현재 보고 있는 사용자의 유형 (액션 버튼 결정용) */
  viewerType?: ChatUserType;
  /** 채팅방 이동 콜백 (플로팅 컨텍스트에서 패널 내 이동용). 없으면 router.push 사용 */
  onNavigateToRoom?: (roomId: string) => void;
}

// ============================================
// 역할별 액션 버튼 결정 (Hook)
// ============================================

interface ProfileAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  handler: () => void;
  variant: "primary" | "secondary";
}

function getProfileActions(
  viewerType: ChatUserType | undefined,
  profile: ProfileCardData | null,
  isMe: boolean,
  handlers: {
    onDirectChat: () => void;
    onConsultingChat: () => void;
    onParentGroupChat: () => void;
  }
): ProfileAction[] {
  if (!profile || isMe) return [];

  const actions: ProfileAction[] = [];

  if (!viewerType) {
    // viewerType 없으면 기존 동작 (1:1 채팅만)
    actions.push({
      id: "direct",
      label: "1:1 채팅",
      icon: MessageSquare,
      handler: handlers.onDirectChat,
      variant: "primary",
    });
    return actions;
  }

  // Admin이 보는 경우
  if (viewerType === "admin") {
    actions.push({
      id: "direct",
      label: "1:1 채팅",
      icon: MessageSquare,
      handler: handlers.onDirectChat,
      variant: "primary",
    });

    if (profile.userType === "student") {
      actions.push({
        id: "consulting",
        label: "상담",
        icon: BookOpen,
        handler: handlers.onConsultingChat,
        variant: "secondary",
      });

      if (profile.linkedParents && profile.linkedParents.length > 0) {
        actions.push({
          id: "parent-group",
          label: "학부모 포함",
          icon: Users,
          handler: handlers.onParentGroupChat,
          variant: "secondary",
        });
      }
    }
    return actions;
  }

  // Student이 보는 경우
  if (viewerType === "student") {
    if (profile.userType === "admin") {
      actions.push({
        id: "direct",
        label: "1:1 채팅",
        icon: MessageSquare,
        handler: handlers.onDirectChat,
        variant: "primary",
      });
    }
    // 학부모는 액션 없음 (보기만)
    return actions;
  }

  // Parent이 보는 경우
  if (viewerType === "parent") {
    if (profile.userType === "admin") {
      actions.push({
        id: "direct",
        label: "1:1 채팅",
        icon: MessageSquare,
        handler: handlers.onDirectChat,
        variant: "primary",
      });
    }
    // 자녀는 액션 없음 (보기만)
    return actions;
  }

  return actions;
}

// 메인 컴포넌트를 Hook 기반으로 리팩토링
function ProfileCardPopupWithActions(props: ProfileCardPopupProps) {
  const router = useRouter();
  const { showError } = useToast();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const {
    isOpen,
    onClose,
    profile,
    position,
    currentUserId,
    basePath = "/chat",
    viewerType,
    onNavigateToRoom,
  } = props;

  // Escape 키: 프로필 팝업만 닫고 상위(ChatPopover)로 전파 차단
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape, true); // capture phase
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, [isOpen, onClose]);

  const isDesktopPopup = !!position;
  const showPopup = isOpen && !!profile;

  // 팝업 열릴 때 닫기 버튼으로 포커스 이동
  useEffect(() => {
    if (isOpen) {
      // 애니메이션 완료 후 포커스
      const timer = setTimeout(() => closeButtonRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !isDesktopPopup) {
      lockScroll();
      return () => unlockScroll();
    }
  }, [isOpen, isDesktopPopup]);

  // 데스크톱 팝업 위치 보정 — scale 애니메이션 완료 후 실행
  useEffect(() => {
    const el = popupRef.current;
    if (!el || !position || !showPopup) return;

    // framer-motion animate 완료 후 정확한 크기 측정
    const raf = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const margin = 16;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let x = position.x;
      let y = position.y;

      // 수평: 우측 넘침 → 좌측으로 이동
      if (x + rect.width + margin > vw) x = vw - rect.width - margin;
      x = Math.max(margin, x);

      // 수직: 아래 공간 부족 → 클릭 위치 위로 배치
      const spaceBelow = vh - position.y;
      if (spaceBelow < rect.height + margin) {
        y = position.y - rect.height - 8;
      }
      y = Math.max(margin, Math.min(y, vh - rect.height - margin));

      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    });
    return () => cancelAnimationFrame(raf);
  }, [position, showPopup]);

  const navigateToRoom = useCallback(
    (roomId: string) => {
      onClose();
      if (onNavigateToRoom) {
        onNavigateToRoom(roomId);
      } else {
        router.push(`${basePath}/${roomId}`);
      }
    },
    [onClose, onNavigateToRoom, router, basePath]
  );

  const handleDirectChat = useCallback(async () => {
    if (!profile || loadingAction) return;
    setLoadingAction("direct");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("start_direct_chat", {
        p_target_user_id: profile.userId,
        p_target_user_type: profile.userType,
      });
      if (!error && data) {
        navigateToRoom(data.id);
      } else {
        showError(error?.message ?? "채팅방을 생성할 수 없습니다");
      }
    } catch {
      showError("채팅방 생성 중 오류가 발생했습니다");
    } finally {
      setLoadingAction(null);
    }
  }, [profile, loadingAction, navigateToRoom, showError]);

  const handleConsultingChat = useCallback(async () => {
    if (!profile || loadingAction) return;
    setLoadingAction("consulting");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("start_direct_chat", {
        p_target_user_id: profile.userId,
        p_target_user_type: profile.userType,
        p_category: "consulting",
      });
      if (!error && data) {
        navigateToRoom(data.id);
      } else {
        showError(error?.message ?? "상담 채팅방을 생성할 수 없습니다");
      }
    } catch {
      showError("상담 채팅방 생성 중 오류가 발생했습니다");
    } finally {
      setLoadingAction(null);
    }
  }, [profile, loadingAction, navigateToRoom, showError]);

  const handleParentGroupChat = useCallback(async () => {
    if (!profile || loadingAction || !profile.linkedParents?.length) return;
    setLoadingAction("parent-group");
    try {
      const memberIds = [profile.userId, ...profile.linkedParents.map((p) => p.id)];
      const memberTypes: ChatUserType[] = [
        profile.userType,
        ...profile.linkedParents.map(() => "parent" as ChatUserType),
      ];
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("create_chat_room", {
        p_type: "group",
        p_name: `${profile.name} (학부모 포함)`,
        p_member_ids: memberIds,
        p_member_types: memberTypes,
      });
      if (!error && data) {
        navigateToRoom(data.id);
      } else {
        showError(error?.message ?? "그룹 채팅방을 생성할 수 없습니다");
      }
    } catch {
      showError("그룹 채팅방 생성 중 오류가 발생했습니다");
    } finally {
      setLoadingAction(null);
    }
  }, [profile, loadingAction, navigateToRoom, showError]);

  const isMe = profile?.userId === currentUserId;

  const actions = getProfileActions(viewerType, profile, !!isMe, {
    onDirectChat: handleDirectChat,
    onConsultingChat: handleConsultingChat,
    onParentGroupChat: handleParentGroupChat,
  });

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  const studentInfo = profile
    ? [profile.schoolName, profile.gradeDisplay].filter(Boolean).join(" · ")
    : "";

  const profileContent = (compact: boolean) => {
    if (!profile) return null;
    return (
      <>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-bg-secondary transition-colors z-10"
          aria-label="닫기"
        >
          <X className={cn("text-text-tertiary", compact ? "w-4 h-4" : "w-5 h-5")} />
        </button>

        <div className={cn(
          "flex flex-col items-center",
          compact ? "pt-8 pb-3 px-4" : "pt-10 pb-4 px-6"
        )}>
          <Avatar
            src={profile.profileImageUrl}
            name={profile.name}
            size={compact ? "lg" : "xl"}
          />
          <h3 className={cn(
            "font-semibold text-text-primary",
            compact ? "mt-2 text-base" : "mt-3 text-lg"
          )}>
            {profile.name}
          </h3>
          <span className={cn(
            "mt-1 text-xs font-medium px-2.5 py-0.5 rounded-full",
            roleColors[profile.userType]
          )}>
            {roleLabels[profile.userType]}
          </span>
          {studentInfo && (
            <p className="mt-1.5 text-sm text-text-secondary">{studentInfo}</p>
          )}
        </div>

        {/* 연결 학부모 */}
        {viewerType === "admin" &&
          profile.userType === "student" &&
          profile.linkedParents &&
          profile.linkedParents.length > 0 && (
            <div className={cn(compact ? "px-4 pb-3" : "px-6 pb-4")}>
              <p className="text-xs font-medium text-text-tertiary mb-1.5">연결 학부모</p>
              <div className="space-y-1">
                {profile.linkedParents.map((parent) => (
                  <div
                    key={parent.id}
                    className="flex items-center gap-2 text-sm text-text-secondary"
                  >
                    <span className="w-1 h-1 rounded-full bg-text-tertiary flex-shrink-0" />
                    <span className="truncate">{parent.name}</span>
                    <span className="text-xs text-text-tertiary">
                      ({relationLabels[parent.relation] ?? parent.relation})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* 액션 버튼 */}
        {actions.length > 0 && (() => {
          const primaryActions = actions.filter(a => a.variant === "primary");
          const secondaryActions = actions.filter(a => a.variant === "secondary");
          return (
          <div className={cn(
            compact ? "px-4 pb-4" : "px-6 pb-6",
            actions.length >= 3 ? "flex flex-col gap-2" : "flex gap-2"
          )}>
            {actions.length >= 3 ? (
              <>
                {/* Primary 버튼 풀 너비 */}
                {primaryActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={action.handler}
                    disabled={!!loadingAction}
                    className={cn(
                      "w-full flex items-center justify-center gap-1.5",
                      compact ? "py-2 rounded-lg text-xs" : "py-2.5 rounded-xl text-sm",
                      "font-medium transition-colors",
                      "bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700",
                      loadingAction && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {loadingAction === action.id ? (
                      <Loader2 className={cn("animate-spin", compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
                    ) : (
                      <action.icon className={cn(compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
                    )}
                    <span>{action.label}</span>
                  </button>
                ))}
                {/* Secondary 버튼 나란히 */}
                <div className="flex gap-2">
                  {secondaryActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={action.handler}
                      disabled={!!loadingAction}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5",
                        compact ? "py-2 rounded-lg text-xs" : "py-2.5 rounded-xl text-sm",
                        "font-medium transition-colors",
                        "bg-bg-secondary text-text-primary hover:bg-bg-tertiary active:bg-bg-secondary",
                        loadingAction && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {loadingAction === action.id ? (
                        <Loader2 className={cn("animate-spin", compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
                      ) : (
                        <action.icon className={cn(compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
                      )}
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={action.handler}
                  disabled={!!loadingAction}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5",
                    compact ? "py-2 rounded-lg text-xs" : "py-2.5 rounded-xl text-sm",
                    "font-medium transition-colors",
                    action.variant === "primary"
                      ? "bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700"
                      : "bg-bg-secondary text-text-primary hover:bg-bg-tertiary active:bg-bg-secondary",
                    loadingAction && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {loadingAction === action.id ? (
                    <Loader2 className={cn("animate-spin", compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
                  ) : (
                    <action.icon className={cn(compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
                  )}
                  <span>{action.label}</span>
                </button>
              ))
            )}
          </div>
          );
        })()}
      </>
    );
  };

  if (typeof window === "undefined") return null;

  // ─── 데스크톱: 클릭 위치에 팝업 ───
  if (isDesktopPopup && position) {
    return createPortal(
      <AnimatePresence>
        {showPopup && (
          <>
            <motion.div
              key="desktop-backdrop"
              ref={backdropRef}
              onClick={handleBackdropClick}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-black/20"
              data-chat-overlay
              aria-hidden="true"
            />
            <motion.div
              key="desktop-popup"
              ref={popupRef}
              style={{ left: position.x, top: position.y }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "fixed z-50",
                "bg-bg-primary rounded-xl",
                "border border-border",
                "shadow-xl",
                "w-72",
                "overflow-hidden"
              )}
              role="dialog"
              aria-label={`${profile?.name ?? ""} 프로필`}
            >
              {profileContent(true)}
            </motion.div>
          </>
        )}
      </AnimatePresence>,
      document.body
    );
  }

  // ─── 모바일: 하단 시트 ───
  return createPortal(
    <AnimatePresence>
      {showPopup && (
        <>
          <motion.div
            key="mobile-backdrop"
            ref={backdropRef}
            onClick={handleBackdropClick}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-bg-overlay"
            data-chat-overlay
            aria-hidden="true"
          />
          <motion.div
            key="mobile-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={cn(
              "fixed inset-x-0 bottom-0 z-50",
              "bg-bg-primary rounded-t-2xl",
              "pb-[env(safe-area-inset-bottom)]",
              "w-full"
            )}
            role="dialog"
            aria-modal="true"
            aria-label={`${profile?.name ?? ""} 프로필`}
          >
            {/* 드래그 핸들 */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-text-tertiary/30" />
            </div>
            {profileContent(false)}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

export const ProfileCardPopup = memo(ProfileCardPopupWithActions);
