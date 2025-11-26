"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { sendCampInvitationsAction } from "@/app/(admin)/actions/campTemplateActions";
import { useToast } from "@/components/ui/ToastProvider";

type StudentInvitationFormProps = {
  templateId: string;
  onInvitationSent?: () => void;
};

type Student = {
  id: string;
  name: string;
  grade: string;
  class: string;
};

export function StudentInvitationForm({ templateId, onInvitationSent }: StudentInvitationFormProps) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // 학생 목록 로드 (useCallback으로 메모이제이션)
  const loadStudents = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      
      // 1. 모든 학생 목록 조회
      const { data: allStudents, error: studentsError } = await supabase
        .from("students")
        .select("id, name, grade, class")
        .order("name", { ascending: true })
        .limit(100);

      if (studentsError) {
        console.error("학생 목록 조회 실패:", studentsError);
        toast.showError("학생 목록을 불러오는데 실패했습니다.");
        return;
      }

      // 2. 이미 초대된 학생 ID 조회
      const { data: invitations, error: invitationsError } = await supabase
        .from("camp_invitations")
        .select("student_id")
        .eq("camp_template_id", templateId);

      if (invitationsError) {
        console.error("초대 목록 조회 실패:", invitationsError);
        // 초대 목록 조회 실패해도 학생 목록은 표시
      }

      // 3. 이미 초대된 학생 ID Set 생성
      const invitedStudentIds = new Set(
        (invitations || []).map((inv) => inv.student_id)
      );

      // 4. 이미 초대되지 않은 학생만 필터링
      const availableStudents = (allStudents || []).filter(
        (student) => !invitedStudentIds.has(student.id)
      );

      setStudents(availableStudents);
    } catch (error) {
      console.error("학생 목록 로드 실패:", error);
      toast.showError("학생 목록을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [templateId, toast]);

  // 초기 로드
  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // 검색 필터링
  const filteredStudents = students.filter((student) =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleStudent = (studentId: string) => {
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

  const handleSelectAll = () => {
    if (selectedStudentIds.size === filteredStudents.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(filteredStudents.map((s) => s.id)));
    }
  };

  const handleSendInvitations = () => {
    if (selectedStudentIds.size === 0) {
      toast.showError("최소 1명 이상의 학생을 선택해주세요.");
      return;
    }

    // 선택된 학생 ID를 미리 저장 (비동기 처리 중 값이 변경될 수 있음)
    const sentStudentIds = Array.from(selectedStudentIds);

    startTransition(async () => {
      try {
        const result = await sendCampInvitationsAction(
          templateId,
          sentStudentIds
        );

        if (result.success) {
          toast.showSuccess(
            `${result.count || sentStudentIds.length}명의 학생에게 초대를 발송했습니다.`
          );
          
          // 선택 초기화
          setSelectedStudentIds(new Set());
          
          // 초대된 학생을 목록에서 즉시 제거 (UI 반응성 향상, 추가 로딩 없음)
          setStudents((prevStudents) =>
            prevStudents.filter((student) => !sentStudentIds.includes(student.id))
          );
          
          // 상위 컴포넌트에 알림 (초대 목록 새로고침은 상위 컴포넌트에서 처리)
          onInvitationSent?.();
        } else {
          toast.showError(result.error || "초대 발송에 실패했습니다.");
        }
      } catch (error) {
        console.error("초대 발송 실패:", error);
        toast.showError(
          error instanceof Error ? error.message : "초대 발송에 실패했습니다."
        );
      }
    });
  };

  if (loading) {
    return <div className="text-sm text-gray-500">학생 목록을 불러오는 중...</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 검색 및 선택 */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="학생명 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={handleSelectAll}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            {selectedStudentIds.size === filteredStudents.length ? "전체 해제" : "전체 선택"}
          </button>
        </div>

        {/* 선택된 학생 수 */}
        {selectedStudentIds.size > 0 && (
          <div className="text-sm text-gray-600">
            {selectedStudentIds.size}명 선택됨
          </div>
        )}
      </div>

      {/* 학생 목록 */}
      <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-200">
        {filteredStudents.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            {searchQuery ? "검색 결과가 없습니다." : "학생이 없습니다."}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredStudents.map((student) => (
              <label
                key={student.id}
                className="flex cursor-pointer items-center gap-3 p-3 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selectedStudentIds.has(student.id)}
                  onChange={() => handleToggleStudent(student.id)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{student.name}</div>
                  <div className="text-xs text-gray-500">
                    {student.grade}학년 {student.class}반
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 발송 버튼 */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSendInvitations}
          disabled={isPending || selectedStudentIds.size === 0}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
        >
          {isPending ? "발송 중..." : `초대 발송 (${selectedStudentIds.size}명)`}
        </button>
      </div>
    </div>
  );
}

