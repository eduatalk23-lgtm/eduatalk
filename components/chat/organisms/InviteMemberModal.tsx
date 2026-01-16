"use client";

/**
 * InviteMemberModal - 그룹 채팅방 멤버 초대 모달
 *
 * 학생 목록에서 선택하여 기존 그룹 채팅방에 새 멤버를 초대합니다.
 */

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { Avatar } from "@/components/atoms/Avatar";
import Checkbox from "@/components/atoms/Checkbox";
import { inviteMembersAction } from "@/lib/domains/chat/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Loader2, Search, UserPlus } from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  existingMemberIds: string[]; // 이미 참여 중인 멤버 ID 목록
}

interface Student {
  id: string;
  name: string;
}

export function InviteMemberModal({
  isOpen,
  onClose,
  roomId,
  existingMemberIds,
}: InviteMemberModalProps) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(
    new Set()
  );

  // 학생 목록 조회
  const { data: students, isLoading } = useQuery({
    queryKey: ["chat-available-students"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("students")
        .select("id, name")
        .order("name");

      if (error) throw error;
      return data as Student[];
    },
    enabled: isOpen,
  });

  // 이미 참여 중인 멤버 제외 + 검색 필터링
  const filteredStudents = useMemo(() => {
    const existingSet = new Set(existingMemberIds);
    return students
      ?.filter((s) => !existingSet.has(s.id))
      .filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [students, existingMemberIds, searchQuery]);

  // 선택 토글
  const toggleStudentSelection = useCallback((studentId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  }, []);

  // 유효성 검사
  const isSubmitEnabled = selectedStudentIds.size > 0;

  // 초대 mutation
  const inviteMutation = useMutation({
    mutationFn: async () => {
      const memberIds = Array.from(selectedStudentIds);
      const result = await inviteMembersAction(
        roomId,
        memberIds,
        memberIds.map(() => "student")
      );
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      // 멤버 목록 새로고침
      queryClient.invalidateQueries({ queryKey: ["chat-room-members", roomId] });
      showSuccess("멤버를 초대했습니다.");
      handleClose();
    },
    onError: (error) => {
      showError(error instanceof Error ? error.message : "멤버 초대 실패");
    },
  });

  const handleInvite = () => {
    if (isSubmitEnabled) {
      inviteMutation.mutate();
    }
  };

  const handleClose = () => {
    setSearchQuery("");
    setSelectedStudentIds(new Set());
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && handleClose()}
      title="멤버 초대"
      size="md"
    >
      <DialogContent>
        {/* 검색 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="학생 이름 검색..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-bg-secondary text-sm text-text-primary placeholder:text-text-tertiary border border-transparent focus:border-primary focus:outline-none"
          />
        </div>

        {/* 선택 카운트 */}
        {selectedStudentIds.size > 0 && (
          <div className="pt-2 text-sm text-primary font-medium">
            {selectedStudentIds.size}명 선택됨
          </div>
        )}

        <div className="pt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
            </div>
          ) : filteredStudents && filteredStudents.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {filteredStudents.map((student) => {
                const isSelected = selectedStudentIds.has(student.id);

                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => toggleStudentSelection(student.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
                      isSelected
                        ? "bg-primary/10 border-2 border-primary"
                        : "hover:bg-bg-secondary border-2 border-transparent"
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onChange={() => toggleStudentSelection(student.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Avatar name={student.name} size="md" />
                    <div className="flex-1 text-left">
                      <p className="font-medium text-text-primary">
                        {student.name}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-text-secondary text-sm">
              {searchQuery
                ? "검색 결과가 없습니다"
                : existingMemberIds.length > 0 && students?.length === existingMemberIds.length
                ? "모든 학생이 이미 참여 중입니다"
                : "초대 가능한 학생이 없습니다"}
            </div>
          )}
        </div>
      </DialogContent>

      <DialogFooter>
        <button
          type="button"
          onClick={handleClose}
          className="flex-1 px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-bg-secondary transition-colors"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleInvite}
          disabled={!isSubmitEnabled || inviteMutation.isPending}
          className={cn(
            "flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors",
            isSubmitEnabled && !inviteMutation.isPending
              ? "bg-primary text-white hover:bg-primary-hover"
              : "bg-bg-tertiary text-text-tertiary cursor-not-allowed"
          )}
        >
          {inviteMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <UserPlus className="w-4 h-4" />
          )}
          초대하기
        </button>
      </DialogFooter>
    </Dialog>
  );
}
