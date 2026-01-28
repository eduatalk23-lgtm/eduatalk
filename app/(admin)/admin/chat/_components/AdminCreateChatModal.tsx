"use client";

/**
 * AdminCreateChatModal - 관리자용 새 채팅 시작 모달
 *
 * 학생 목록에서 선택하여 1:1 채팅 또는 그룹 채팅을 시작합니다.
 * 같은 테넌트 내 관리자/컨설턴트와 팀 채팅도 가능합니다.
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
import { Loader2, MessageSquare, Search, Users, UserCog } from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";

interface AdminCreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  basePath: string;
  /** 위젯 내에서 채팅방 생성 후 이동할 때 사용 (없으면 router.push) */
  onRoomCreated?: (roomId: string) => void;
}

interface Student {
  id: string;
  name: string;
  grade: number | null;
  school_type: string | null;
  school_name: string | null;
  phone: string | null;
}

/** 학년 표시 변환 (예: HIGH + 2 → "고2") */
function formatGradeDisplay(
  schoolType: string | null,
  grade: number | null
): string {
  if (!grade) return "-";

  const prefix: Record<string, string> = {
    ELEMENTARY: "초",
    MIDDLE: "중",
    HIGH: "고",
  };

  const p = schoolType ? prefix[schoolType] : null;
  return p ? `${p}${grade}` : `${grade}학년`;
}

interface TeamMember {
  id: string;
  name: string;
  role: "admin" | "consultant";
}

type ChatTabId = "direct" | "group" | "team";

const CHAT_TABS: Tab[] = [
  { id: "direct", label: "1:1 채팅" },
  { id: "group", label: "그룹 채팅" },
  { id: "team", label: "팀 채팅" },
];

export function AdminCreateChatModal({
  isOpen,
  onClose,
  basePath,
  onRoomCreated,
}: AdminCreateChatModalProps) {
  const router = useRouter();
  const { showToast } = useToast();

  // 공통 상태
  const [activeTab, setActiveTab] = useState<ChatTabId>("direct");
  const [searchQuery, setSearchQuery] = useState("");

  // 1:1/그룹 모드 상태 (학생 대상)
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null
  );
  const [groupName, setGroupName] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(
    new Set()
  );

  // 팀 모드 상태 (관리자 대상)
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState<
    string | null
  >(null);

  // 학생 목록 조회 (프로필 + 학교 정보 포함)
  const { data: students, isLoading: isLoadingStudents } = useQuery({
    queryKey: ["chat-available-students-with-details"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();

      // 1. 학생 기본 정보 조회
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select("id, name, grade, school_type, school_id")
        .order("name");

      if (studentsError) throw studentsError;
      if (!studentsData || studentsData.length === 0) return [];

      // 2. 학생 프로필 (연락처) 조회
      const studentIds = studentsData.map((s) => s.id);
      const { data: profilesData } = await supabase
        .from("student_profiles")
        .select("id, phone")
        .in("id", studentIds);

      // 3. 학교 정보 조회
      const schoolIds = [
        ...new Set(
          studentsData.map((s) => s.school_id).filter(Boolean) as string[]
        ),
      ];
      const { data: schoolsData } =
        schoolIds.length > 0
          ? await supabase
              .from("all_schools_view")
              .select("id, name")
              .in("id", schoolIds)
          : { data: [] };

      // 4. 데이터 병합
      const profilesMap = new Map(
        profilesData?.map((p) => [p.id, p.phone]) || []
      );
      const schoolsMap = new Map(
        schoolsData?.map((s) => [s.id, s.name]) || []
      );

      return studentsData.map((student) => ({
        id: student.id,
        name: student.name,
        grade: student.grade,
        school_type: student.school_type,
        school_name: student.school_id
          ? (schoolsMap.get(student.school_id) ?? null)
          : null,
        phone: profilesMap.get(student.id) ?? null,
      })) as Student[];
    },
    enabled: isOpen && activeTab !== "team",
  });

  // 팀 멤버(관리자) 목록 조회
  const { data: teamMembers, isLoading: isLoadingTeam } = useQuery({
    queryKey: ["chat-available-team-members"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      // 현재 사용자 정보 가져오기
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("인증이 필요합니다");

      // 현재 사용자의 tenant_id 조회
      const { data: currentAdmin, error: adminError } = await supabase
        .from("admin_users")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (adminError || !currentAdmin?.tenant_id) {
        throw new Error("테넌트 정보를 찾을 수 없습니다");
      }

      // 같은 테넌트의 관리자 목록 조회 (자신 제외)
      const { data, error } = await supabase
        .from("admin_users")
        .select("id, name, role")
        .eq("tenant_id", currentAdmin.tenant_id)
        .neq("id", user.id)
        .order("name");

      if (error) throw error;
      return data as TeamMember[];
    },
    enabled: isOpen && activeTab === "team",
  });

  // 현재 탭에 따른 로딩 상태
  const isLoading = activeTab === "team" ? isLoadingTeam : isLoadingStudents;

  // 검색 필터링 (useMemo로 성능 최적화)
  const filteredStudents = useMemo(
    () =>
      students?.filter((student) =>
        student.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [students, searchQuery]
  );

  const filteredTeamMembers = useMemo(
    () =>
      teamMembers?.filter((member) =>
        member.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [teamMembers, searchQuery]
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
    if (activeTab === "group") {
      return groupName.trim().length > 0 && selectedStudentIds.size > 0;
    }
    // team 모드
    return selectedTeamMemberId !== null;
  }, [activeTab, selectedStudentId, groupName, selectedStudentIds, selectedTeamMemberId]);

  // 채팅 시작/생성
  const startChatMutation = useMutation({
    mutationFn: async () => {
      if (activeTab === "direct") {
        // 1:1 모드 (학생): 기존 로직
        const result = await startDirectChatAction(
          selectedStudentId!,
          "student"
        );
        if (!result.success) throw new Error(result.error);
        return result.data;
      } else if (activeTab === "group") {
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
      } else {
        // 팀 모드 (관리자 간 1:1)
        const result = await startDirectChatAction(
          selectedTeamMemberId!,
          "admin"
        );
        if (!result.success) throw new Error(result.error);
        return result.data;
      }
    },
    onSuccess: (room) => {
      resetState();
      if (onRoomCreated && room?.id) {
        onRoomCreated(room.id);
      } else {
        onClose();
        router.push(`${basePath}/${room?.id}`);
      }
    },
    onError: (error) => {
      showToast(
        error instanceof Error ? error.message : "채팅 시작에 실패했습니다",
        "error"
      );
    },
  });

  const handleStartChat = () => {
    if (isSubmitEnabled) {
      startChatMutation.mutate();
    }
  };

  const resetState = () => {
    setSearchQuery("");
    setSelectedStudentId(null);
    setGroupName("");
    setSelectedStudentIds(new Set());
    setSelectedTeamMemberId(null);
    setActiveTab("direct");
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // 탭별 타이틀
  const dialogTitle = useMemo(() => {
    switch (activeTab) {
      case "direct":
        return "학생과 채팅 시작";
      case "group":
        return "그룹 채팅 만들기";
      case "team":
        return "팀원과 채팅 시작";
      default:
        return "새 대화 시작";
    }
  }, [activeTab]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && handleClose()}
      title={dialogTitle}
      size="lg"
    >
      <DialogContent>
        {/* 탭 선택 */}
        <Tabs
          tabs={CHAT_TABS}
          activeTab={activeTab}
          onChange={(tabId) => {
            setActiveTab(tabId as ChatTabId);
            setSearchQuery(""); // 탭 변경 시 검색어 초기화
          }}
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
              aria-label="그룹 이름"
              className="w-full px-4 py-2 rounded-lg bg-bg-secondary text-sm text-text-primary placeholder:text-text-tertiary border border-transparent focus:border-primary focus:outline-none"
            />
          </div>
        )}

        {/* 검색 */}
        <div
          className={cn(
            "relative",
            activeTab === "direct" || activeTab === "team" ? "pt-4" : "pt-3"
          )}
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary mt-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === "team" ? "팀원 이름 검색..." : "학생 이름 검색..."
            }
            aria-label={activeTab === "team" ? "팀원 검색" : "학생 검색"}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-bg-secondary text-sm text-text-primary placeholder:text-text-tertiary border border-transparent focus:border-primary focus:outline-none"
          />
        </div>

        {/* 선택 카운트 (그룹 모드 전용) */}
        {activeTab === "group" && selectedStudentIds.size > 0 && (
          <div className="pt-2 text-sm text-primary font-medium">
            {selectedStudentIds.size}명 선택됨
          </div>
        )}

        {/* 목록 표시 */}
        <div className="pt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
            </div>
          ) : activeTab === "team" ? (
            // 팀 멤버(관리자) 목록
            filteredTeamMembers && filteredTeamMembers.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {filteredTeamMembers.map((member) => {
                  const isSelected = selectedTeamMemberId === member.id;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => setSelectedTeamMemberId(member.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
                        isSelected
                          ? "bg-primary/10 border-2 border-primary"
                          : "hover:bg-bg-secondary border-2 border-transparent"
                      )}
                    >
                      <Avatar name={member.name} size="md" />
                      <div className="flex-1 text-left">
                        <p className="font-medium text-text-primary">
                          {member.name}
                        </p>
                        <p className="text-xs text-text-tertiary">
                          {member.role === "admin" ? "관리자" : "상담사"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-text-secondary text-sm">
                {searchQuery ? "검색 결과가 없습니다" : "팀원이 없습니다"}
              </div>
            )
          ) : // 학생 목록 (direct/group 모드)
          filteredStudents && filteredStudents.length > 0 ? (
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
                    <div className="flex-1 text-left min-w-0">
                      {/* 이름 */}
                      <p className="font-medium text-text-primary">
                        {student.name}
                      </p>
                      {/* 학교 · 학년 · 연락처 (그리드 정렬) */}
                      <div className="grid grid-cols-[1fr_40px_120px] gap-3 text-xs text-text-tertiary mt-0.5">
                        <span className="truncate">
                          {student.school_name || "-"}
                        </span>
                        <span className="text-center">
                          {formatGradeDisplay(student.school_type, student.grade)}
                        </span>
                        <span className="tabular-nums">
                          {student.phone || "-"}
                        </span>
                      </div>
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
          ) : activeTab === "group" ? (
            <Users className="w-4 h-4" />
          ) : (
            <UserCog className="w-4 h-4" />
          )}
          {activeTab === "direct"
            ? "채팅 시작"
            : activeTab === "group"
              ? "그룹 만들기"
              : "팀 채팅 시작"}
        </button>
      </DialogFooter>
    </Dialog>
  );
}
