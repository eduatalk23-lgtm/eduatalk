"use client";

/**
 * ParentCreateChatModal - 학부모 새 채팅 시작 모달
 *
 * 자녀에게 배정된 관리자/컨설턴트 목록에서 선택하여 1:1 채팅을 시작합니다.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { Avatar } from "@/components/atoms/Avatar";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { chatKeys } from "@/lib/domains/chat/queryKeys";
import { Loader2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/cn";

interface ParentCreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  basePath: string;
  onRoomCreated?: (roomId: string) => void;
  /** 사이드 패널 토픽 연동용 (학부모 모달에서는 미사용) */
  defaultTopic?: string | null;
}

interface AdminUser {
  id: string;
  role: string;
  name: string;
  profile_image_url: string | null;
}

export function ParentCreateChatModal({
  isOpen,
  onClose,
  basePath,
  onRoomCreated,
}: ParentCreateChatModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);

  // 자녀의 tenant에 속한 관리자/컨설턴트 목록 조회 (RPC 단일 JOIN: 2 RTT → 1 RTT)
  const { data: admins, isLoading } = useQuery({
    queryKey: ["parent-chat-available-admins"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();

      const { data, error } = await supabase.rpc("get_parent_accessible_admins");

      if (error) throw error;
      return (data ?? []) as AdminUser[];
    },
    enabled: isOpen,
  });

  // 채팅 시작
  const startChatMutation = useMutation({
    mutationFn: async (adminId: string) => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("start_direct_chat", {
        p_target_user_id: adminId,
        p_target_user_type: "admin",
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (room) => {
      // 채팅방 목록 즉시 갱신 (네비게이션과 병렬 실행)
      void queryClient.invalidateQueries({ queryKey: chatKeys.rooms() });
      setSelectedAdminId(null);
      if (onRoomCreated && room?.id) {
        onRoomCreated(room.id);
      } else {
        onClose();
        router.push(`${basePath}/${room?.id}`);
      }
    },
  });

  const handleStartChat = () => {
    if (selectedAdminId) {
      startChatMutation.mutate(selectedAdminId);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="새 채팅 시작"
      description="대화할 상담사/관리자를 선택하세요"
      size="md"
    >
      <DialogContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
          </div>
        ) : admins && admins.length > 0 ? (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {admins.map((admin) => (
              <button
                key={admin.id}
                type="button"
                onClick={() => setSelectedAdminId(admin.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                  selectedAdminId === admin.id
                    ? "bg-primary-50 dark:bg-primary-900/30 border-2 border-primary"
                    : "hover:bg-secondary-100 dark:hover:bg-secondary-800 border-2 border-transparent"
                )}
              >
                <Avatar
                  name={admin.name}
                  src={admin.profile_image_url ?? undefined}
                  size="md"
                />
                <div className="flex-1 text-left">
                  <p className="font-medium text-text-primary">
                    {admin.name}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {admin.role === "admin" ? "학원 관리자" : "학습 상담사"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-text-secondary text-sm">
            대화할 수 있는 관리자가 없습니다
          </div>
        )}
      </DialogContent>

      <DialogFooter>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-bg-secondary active:bg-bg-tertiary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleStartChat}
          disabled={!selectedAdminId || startChatMutation.isPending}
          className={cn(
            "flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
            selectedAdminId && !startChatMutation.isPending
              ? "bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700"
              : "bg-secondary-200 dark:bg-secondary-700 text-text-tertiary cursor-not-allowed"
          )}
        >
          {startChatMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <MessageSquare className="w-4 h-4" />
          )}
          채팅 시작
        </button>
      </DialogFooter>
    </Dialog>
  );
}
