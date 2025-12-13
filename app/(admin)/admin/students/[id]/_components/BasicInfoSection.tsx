"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { StudentActions } from "../../_components/StudentActions";
import { updateStudentClass } from "@/app/(admin)/actions/studentManagementActions";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { Pencil } from "lucide-react";

type Student = {
  id: string;
  name?: string | null;
  grade?: string | null;
  class?: string | null;
  birth_date?: string | null;
  is_active?: boolean | null;
};

type BasicInfoSectionProps = {
  student: Student;
  isAdmin: boolean;
};

export function BasicInfoSection({
  student: initialStudent,
  isAdmin,
}: BasicInfoSectionProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();
  const [editingClass, setEditingClass] = useState(false);
  const [classValue, setClassValue] = useState(initialStudent.class || "");
  const [student, setStudent] = useState(initialStudent);
  const inputRef = useRef<HTMLInputElement>(null);

  // 학생 정보가 업데이트되면 로컬 상태도 업데이트
  useEffect(() => {
    setStudent(initialStudent);
    if (!editingClass) {
      setClassValue(initialStudent.class || "");
    }
  }, [initialStudent.id, initialStudent.class, editingClass]);

  // 편집 모드 진입 시 자동 포커스
  useEffect(() => {
    if (editingClass && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingClass]);

  async function handleUpdateClass() {
    // 값이 변경되지 않았으면 저장하지 않음
    if (classValue === (student.class || "")) {
      setEditingClass(false);
      return;
    }

    startTransition(async () => {
      const result = await updateStudentClass(student.id, classValue || null);

      if (result.success) {
        setEditingClass(false);
        showSuccess("반 정보가 변경되었습니다.");
        // 서버 상태 새로고침
        router.refresh();
      } else {
        showError(result.error || "반 정보 변경에 실패했습니다.");
      }
    });
  }

  function handleCancelEdit() {
    setEditingClass(false);
    setClassValue(student.class || "");
  }

  function handleStartEdit() {
    if (!isAdmin) return;
    setEditingClass(true);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isPending) {
        handleUpdateClass();
      }
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (!isPending) {
        handleCancelEdit();
      }
    }
  }

  // 값이 변경되었는지 확인
  const hasChanges = classValue !== (student.class || "");

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">기본 정보</h2>
        <StudentActions
          studentId={student.id}
          studentName={student.name ?? "이름 없음"}
          isActive={student.is_active !== false}
          isAdmin={isAdmin}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <div className="text-sm text-gray-500">이름</div>
          <div className="text-lg font-medium text-gray-900">
            {student.name ?? "-"}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-sm text-gray-500">학년</div>
          <div className="text-lg font-medium text-gray-900">
            {student.grade ?? "-"}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">반</div>
            {isAdmin && !editingClass && (
              <button
                onClick={handleStartEdit}
                className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                title="반 정보 수정"
              >
                <Pencil className="h-3 w-3" />
                수정
              </button>
            )}
          </div>
          {editingClass ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={classValue}
                onChange={(e) => setClassValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="반 번호"
                disabled={isPending}
                className="w-24 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-lg font-medium text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-100 disabled:border-gray-300"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleUpdateClass}
                  disabled={isPending || !hasChanges}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed"
                >
                  {isPending ? "저장 중..." : "저장"}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={isPending}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  취소
                </button>
              </div>
              <div className="text-xs text-gray-500">
                Enter: 저장, Esc: 취소
              </div>
            </div>
          ) : (
            <div className="text-lg font-medium text-gray-900">
              {student.class ?? "-"}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-sm text-gray-500">생년월일</div>
          <div className="text-lg font-medium text-gray-900">
            {student.birth_date
              ? new Date(student.birth_date).toLocaleDateString("ko-KR")
              : "-"}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-sm text-gray-500">계정 상태</div>
          <div>
            {student.is_active === false ? (
              <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-800">
                비활성화
              </span>
            ) : (
              <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
                활성
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
