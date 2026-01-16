"use client";

/**
 * AdminCreateChatModal - 관리자용 새 채팅 시작 모달
 *
 * 학생 목록에서 선택하여 1:1 채팅 또는 그룹 채팅을 시작합니다.
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { Avatar } from "@/components/atoms/Avatar";
import { Tabs, type Tab } from "@/components/molecules/Tabs";
import Checkbox from "@/components/atoms/Checkbox";
import {
  startDirectChatAction,
  createChatRoomAction,
} from "@/lib/domains/chat/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Loader2, MessageSquare, Search, Users } from "lucide-react";
import { cn } from "@/lib/cn";

interface AdminCreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  basePath: string;
}

interface Student {
  id: string;
  name: string;
}

const CHAT_TABS: Tab[] = [
  { id: "direct", label: "1:1 채팅" },
  { id: "group", label: "그룹 채팅" },
];

export function AdminCreateChatModal({
  isOpen,
  onClose,
  basePath,
}: AdminCreateChatModalProps) {
  const router = useRouter();

  // 1:1 모드 상태
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");

  // 그룹 모드 상태
  const [activeTab, setActiveTab] = useState<"direct" | "group">("direct");
  const [groupName, setGroupName] = useState("");
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

  // 검색 필터링
  const filteredStudents = students?.filter((student) =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 그룹 모드 선택 토글
  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  // 유효성 검사
  const isSubmitEnabled = useMemo(() => {
    if (activeTab === "direct") {
      return selectedStudentId !== null;
    }
    return groupName.trim().length > 0 && selectedStudentIds.size > 0;
  }, [activeTab, selectedStudentId, groupName, selectedStudentIds]);

  // 채팅 시작/생성
  const startChatMutation = useMutation({
    mutationFn: async () => {
      if (activeTab === "direct") {
        // 1:1 모드: 기존 로직
        const result = await startDirectChatAction(selectedStudentId!, "student");
        if (!result.success) throw new Error(result.error);
        return result.data;
      } else {
        // 그룹 모드: 새 로직
        const memberIds = Array.from(selectedStudentIds);
        const result = await createChatRoomAction({
          type: "group",
          name: groupName.trim(),
          memberIds,
          memberTypes: memberIds.map(() => "student"),
        });
        if (!result.success) throw new Error(result.error);
        return result.data;
      }
    },
    onSuccess: (room) => {
      handleClose();
      router.push(`${basePath}/${room?.id}`);
    },
  });

  const handleStartChat = () => {
    if (isSubmitEnabled) {
      startChatMutation.mutate();
    }
  };

  const handleClose = () => {
    setSearchQuery("");
    setSelectedStudentId(null);
    setGroupName("");
    setSelectedStudentIds(new Set());
    setActiveTab("direct");
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && handleClose()}
      title={activeTab === "direct" ? "학생과 채팅 시작" : "그룹 채팅 만들기"}
      size="md"
    >
      <DialogContent>
        {/* 탭 선택 */}
        <Tabs
          tabs={CHAT_TABS}
          activeTab={activeTab}
          onChange={(tabId) => setActiveTab(tabId as "direct" | "group")}
          variant="pill"
          fullWidth
        />

        {/* 그룹 이름 입력 (그룹 모드 전용) */}
        {activeTab === "group" && (
          <div className="pt-4">
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="그룹 이름 입력 (필수)"
              className="w-full px-4 py-2 rounded-lg bg-bg-secondary text-sm text-text-primary placeholder:text-text-tertiary border border-transparent focus:border-primary focus:outline-none"
            />
          </div>
        )}

        {/* 검색 */}
        <div className={cn("relative", activeTab === "direct" ? "pt-4" : "pt-3")}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary mt-[8px]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="학생 이름 검색..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-bg-secondary text-sm text-text-primary placeholder:text-text-tertiary border border-transparent focus:border-primary focus:outline-none"
          />
        </div>

        {/* 선택 카운트 (그룹 모드 전용) */}
        {activeTab === "group" && selectedStudentIds.size > 0 && (
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
                const isSelectedDirect = selectedStudentId === student.id;
                const isSelectedGroup = selectedStudentIds.has(student.id);
                const isSelected =
                  activeTab === "direct" ? isSelectedDirect : isSelectedGroup;

                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => {
                      if (activeTab === "direct") {
                        setSelectedStudentId(student.id);
                      } else {
                        toggleStudentSelection(student.id);
                      }
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
                      isSelected
                        ? "bg-primary/10 border-2 border-primary"
                        : "hover:bg-bg-secondary border-2 border-transparent"
                    )}
                  >
                    {/* 그룹 모드: 체크박스 표시 */}
                    {activeTab === "group" && (
                      <Checkbox
                        checked={isSelectedGroup}
                        onChange={() => toggleStudentSelection(student.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
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
              {searchQuery ? "검색 결과가 없습니다" : "학생이 없습니다"}
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
          onClick={handleStartChat}
          disabled={!isSubmitEnabled || startChatMutation.isPending}
          className={cn(
            "flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors",
            isSubmitEnabled && !startChatMutation.isPending
              ? "bg-primary text-white hover:bg-primary-hover"
              : "bg-bg-tertiary text-text-tertiary cursor-not-allowed"
          )}
        >
          {startChatMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : activeTab === "direct" ? (
            <MessageSquare className="w-4 h-4" />
          ) : (
            <Users className="w-4 h-4" />
          )}
          {activeTab === "direct" ? "채팅 시작" : "그룹 만들기"}
        </button>
      </DialogFooter>
    </Dialog>
  );
}
