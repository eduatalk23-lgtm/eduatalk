"use client";

/**
 * CreateChatModal - 새 채팅 시작 모달
 *
 * 관리자 목록에서 선택하여 1:1 채팅을 시작합니다.
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { Avatar } from "@/components/atoms/Avatar";
import { startDirectChatAction } from "@/lib/domains/chat/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Loader2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/cn";

interface CreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  basePath: string;
}

interface AdminUser {
  id: string;
  role: string;
  // Note: admin_users 테이블에 name 컬럼이 없어 역할로만 표시
}

export function CreateChatModal({
  isOpen,
  onClose,
  basePath,
}: CreateChatModalProps) {
  const router = useRouter();
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);

  // 관리자 목록 조회 (같은 tenant의 admin/consultant)
  const { data: admins, isLoading } = useQuery({
    queryKey: ["chat-available-admins"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("admin_users")
        .select("id, role")
        .in("role", ["admin", "consultant"]);

      if (error) throw error;
      return data as AdminUser[];
    },
    enabled: isOpen,
  });

  // 채팅 시작
  const startChatMutation = useMutation({
    mutationFn: async (adminId: string) => {
      const result = await startDirectChatAction(adminId, "admin");
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (room) => {
      onClose();
      router.push(`${basePath}/${room?.id}`);
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
                  selectedAdminId === admin.id
                    ? "bg-primary/10 border-2 border-primary"
                    : "hover:bg-bg-secondary border-2 border-transparent"
                )}
              >
                <Avatar name={admin.role} size="md" />
                <div className="flex-1 text-left">
                  <p className="font-medium text-text-primary">
                    {admin.role === "admin" ? "관리자" : "상담사"}
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
          className="flex-1 px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-bg-secondary transition-colors"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleStartChat}
          disabled={!selectedAdminId || startChatMutation.isPending}
          className={cn(
            "flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors",
            selectedAdminId && !startChatMutation.isPending
              ? "bg-primary text-white hover:bg-primary-hover"
              : "bg-bg-tertiary text-text-tertiary cursor-not-allowed"
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
