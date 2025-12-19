"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { sendCampInvitationsAction } from "@/app/(admin)/actions/campTemplateActions";
import { useToast } from "@/components/ui/ToastProvider";
import { filterStudents, extractUniqueGrades, extractUniqueClasses, type Student, type StudentFilter } from "@/lib/utils/studentFilterUtils";

type StudentInvitationFormProps = {
  templateId: string;
  templateStatus?: "draft" | "active" | "archived";
  onInvitationSent?: () => void;
};

export function StudentInvitationForm({ templateId, templateStatus, onInvitationSent }: StudentInvitationFormProps) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<StudentFilter>({
    search: "",
    grade: "",
    class: "",
    isActive: "all",
  });
  const [loading, setLoading] = useState(true);

  // 학생 목록 로드 (useCallback으로 메모이제이션)
  const loadStudents = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      
      // 1. 모든 학생 목록 조회
      const { data: allStudents, error: studentsError } = await supabase
        .from("students")
        .select("id, name, grade, class, division, phone, mother_phone, father_phone, is_active")
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

  // 필터링된 학생 목록 (공통 유틸리티 함수 사용)
  const filteredStudents = filterStudents(students, filter);
  
  // 고유 학년 목록 추출
  const uniqueGrades = extractUniqueGrades(students);
  
  // 고유 반 목록 추출
  const uniqueClasses = extractUniqueClasses(students);

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
    // 활성 상태가 아니면 초대 발송 불가
    if (templateStatus !== "active") {
      const statusMessage = 
        templateStatus === "archived" 
          ? "보관된 템플릿에는 초대를 발송할 수 없습니다."
          : templateStatus === "draft"
          ? "초안 상태의 템플릿에는 초대를 발송할 수 없습니다. 템플릿을 활성화한 후 초대를 발송해주세요."
          : "활성 상태의 템플릿만 초대를 발송할 수 있습니다.";
      toast.showError(statusMessage);
      return;
    }
    
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

  const isActive = templateStatus === "active";
  const isDisabled = !isActive;

  if (loading) {
    return <div className="text-sm text-gray-700">학생 목록을 불러오는 중...</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 활성 상태가 아닐 때 안내 메시지 */}
      {!isActive && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">
            {templateStatus === "draft" 
              ? "⚠️ 초안 상태의 템플릿입니다. 템플릿을 활성화한 후 초대를 발송할 수 있습니다."
              : templateStatus === "archived"
              ? "⚠️ 보관된 템플릿입니다. 활성화된 템플릿만 초대를 발송할 수 있습니다."
              : "⚠️ 활성 상태의 템플릿만 초대를 발송할 수 있습니다."}
          </p>
        </div>
      )}

      {/* 필터 및 선택 */}
      <div className="flex flex-col gap-3">
        {/* 검색 필터 */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="이름, 전화번호, 학년, 반 검색..."
            value={filter.search || ""}
            onChange={(e) => setFilter((prev) => ({ ...prev, search: e.target.value }))}
            disabled={isDisabled}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
          />
          <button
            type="button"
            onClick={handleSelectAll}
            disabled={isDisabled}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
          >
            {selectedStudentIds.size === filteredStudents.length ? "전체 해제" : "전체 선택"}
          </button>
        </div>
        
        {/* 고급 필터 (학년, 반) */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="filter-grade" className="block text-sm font-medium text-gray-700 mb-1">
              학년
            </label>
            <select
              id="filter-grade"
              value={filter.grade || ""}
              onChange={(e) => setFilter((prev) => ({ ...prev, grade: e.target.value || undefined }))}
              disabled={isDisabled}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="">전체</option>
              {uniqueGrades.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}학년
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="filter-class" className="block text-sm font-medium text-gray-700 mb-1">
              반
            </label>
            <select
              id="filter-class"
              value={filter.class || ""}
              onChange={(e) => setFilter((prev) => ({ ...prev, class: e.target.value || undefined }))}
              disabled={isDisabled}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="">전체</option>
              {uniqueClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}반
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 선택된 학생 수 */}
        {selectedStudentIds.size > 0 && (
          <div className="text-sm text-gray-800">
            {selectedStudentIds.size}명 선택됨
          </div>
        )}
      </div>

      {/* 학생 목록 */}
      <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-200">
        {filteredStudents.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-700">
            {filter.search || filter.grade || filter.class ? "필터 조건에 맞는 학생이 없습니다." : "학생이 없습니다."}
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
                  disabled={isDisabled}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{student.name}</div>
                  <div className="text-xs text-gray-700">
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
          disabled={isPending || selectedStudentIds.size === 0 || isDisabled}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
        >
          {isPending ? "발송 중..." : `초대 발송 (${selectedStudentIds.size}명)`}
        </button>
      </div>
    </div>
  );
}

