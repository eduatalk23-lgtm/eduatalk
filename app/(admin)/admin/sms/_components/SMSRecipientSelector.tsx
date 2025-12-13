"use client";

import { useState, useMemo } from "react";
import Label from "@/components/atoms/Label";
import Input from "@/components/atoms/Input";
import Select from "@/components/atoms/Select";
import Button from "@/components/atoms/Button";

import type { RecipientType } from "./SMSSendForm";

type Student = {
  id: string;
  name: string | null;
  grade?: string | null;
  class?: string | null;
  phone: string | null;
  mother_phone: string | null;
  father_phone: string | null;
  is_active?: boolean | null;
};

type SMSRecipientSelectorProps = {
  students: Student[];
  selectedStudentIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
  recipientType?: RecipientType;
  onRecipientTypeChange?: (type: RecipientType) => void;
};

type StudentFilter = {
  search: string;
  grade: string;
  class: string;
  isActive: string; // "all" | "active" | "inactive"
  hasParentContact: string; // "all" | "yes" | "no"
};

export function SMSRecipientSelector({
  students,
  selectedStudentIds,
  onSelectionChange,
  recipientType = "mother",
  onRecipientTypeChange,
}: SMSRecipientSelectorProps) {
  const [filter, setFilter] = useState<StudentFilter>({
    search: "",
    grade: "",
    class: "",
    isActive: "all",
    hasParentContact: "all", // 모든 학생 조회 가능하도록 변경
  });

  // 고유 학년 목록 추출
  const uniqueGrades = useMemo(() => {
    const grades = new Set<string>();
    students.forEach((s) => {
      if (s.grade) grades.add(s.grade);
    });
    return Array.from(grades).sort();
  }, [students]);

  // 고유 반 목록 추출
  const uniqueClasses = useMemo(() => {
    const classes = new Set<string>();
    students.forEach((s) => {
      if (s.class) classes.add(s.class);
    });
    return Array.from(classes).sort();
  }, [students]);

  // 필터링된 학생 목록
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      // 검색 필터
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        const nameMatch = student.name?.toLowerCase().includes(searchLower);
        const phoneMatch = student.phone?.includes(filter.search);
        const motherPhoneMatch = student.mother_phone?.includes(filter.search);
        const fatherPhoneMatch = student.father_phone?.includes(filter.search);
        if (!nameMatch && !phoneMatch && !motherPhoneMatch && !fatherPhoneMatch) return false;
      }

      // 학년 필터
      if (filter.grade && student.grade !== filter.grade) {
        return false;
      }

      // 반 필터
      if (filter.class && student.class !== filter.class) {
        return false;
      }

      // 활성 상태 필터
      if (filter.isActive === "active" && student.is_active !== true) {
        return false;
      }
      if (filter.isActive === "inactive" && student.is_active !== false) {
        return false;
      }

      // 학부모 연락처 필터 (모든 학생 조회 가능하도록 변경)
      // hasParentContact 필터는 더 이상 사용하지 않음 (모든 학생 조회)

      return true;
    });
  }, [students, filter]);

  // 전송 대상자에 따라 전화번호 선택
  const getPhoneByRecipientType = (student: Student, type: RecipientType): string | null => {
    switch (type) {
      case "student":
        return student.phone;
      case "mother":
        return student.mother_phone;
      case "father":
        return student.father_phone;
      default:
        return student.mother_phone ?? student.father_phone ?? student.phone;
    }
  };

  // 필터링된 학생 중 선택 가능한 학생 (선택한 대상자 타입에 따라)
  const selectableStudents = useMemo(() => {
    return filteredStudents.filter((s) => {
      const phone = getPhoneByRecipientType(s, recipientType);
      return !!phone;
    });
  }, [filteredStudents, recipientType]);

  const handleToggleStudent = (studentId: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(studentId)) {
      next.delete(studentId);
    } else {
      next.add(studentId);
    }
    onSelectionChange(next);
  };

  const handleSelectAll = () => {
    if (selectedStudentIds.size === selectableStudents.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(selectableStudents.map((s) => s.id)));
    }
  };

  const selectedCount = selectedStudentIds.size;
  const selectableCount = selectableStudents.length;

  return (
    <div className="flex flex-col gap-4">
      {/* 필터 섹션 */}
      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">발송 대상자 필터</h3>
          {onRecipientTypeChange && (
            <div className="flex items-center gap-2">
              <Label htmlFor="bulk-recipient-type" className="text-xs text-gray-600">
                전송 대상:
              </Label>
              <Select
                id="bulk-recipient-type"
                value={recipientType}
                onChange={(e) => onRecipientTypeChange(e.target.value as RecipientType)}
                className="text-xs"
              >
                <option value="student">학생</option>
                <option value="mother">어머니</option>
                <option value="father">아버지</option>
              </Select>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <Label htmlFor="filter-search">이름/전화번호 검색</Label>
            <Input
              id="filter-search"
              type="text"
              placeholder="검색..."
              value={filter.search}
              onChange={(e) =>
                setFilter((prev) => ({ ...prev, search: e.target.value }))
              }
            />
          </div>

          <div>
            <Label htmlFor="filter-grade">학년</Label>
            <Select
              id="filter-grade"
              value={filter.grade}
              onChange={(e) =>
                setFilter((prev) => ({ ...prev, grade: e.target.value }))
              }
            >
              <option value="">전체</option>
              {uniqueGrades.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}학년
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="filter-class">반</Label>
            <Select
              id="filter-class"
              value={filter.class}
              onChange={(e) =>
                setFilter((prev) => ({ ...prev, class: e.target.value }))
              }
            >
              <option value="">전체</option>
              {uniqueClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}반
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="filter-active">활성 상태</Label>
            <Select
              id="filter-active"
              value={filter.isActive}
              onChange={(e) =>
                setFilter((prev) => ({ ...prev, isActive: e.target.value }))
              }
            >
              <option value="all">전체</option>
              <option value="active">활성</option>
              <option value="inactive">비활성</option>
            </Select>
          </div>

        </div>
      </div>

      {/* 선택 정보 및 전체 선택 버튼 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-700">
          <span className="font-medium text-gray-900">
            {selectedCount}명 선택됨
          </span>
          <span className="pl-2 text-gray-500">
            (선택 가능: {selectableCount}명)
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={selectableCount === 0}
          >
            {selectedCount === selectableCount ? "전체 해제" : "전체 선택"}
          </Button>
        </div>
      </div>

      {/* 학생 목록 */}
      <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-200">
        {selectableStudents.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            {filteredStudents.length === 0
              ? "필터 조건에 맞는 학생이 없습니다."
              : "학부모 연락처가 있는 학생이 없습니다."}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {selectableStudents.map((student) => (
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
                  <div className="text-sm font-medium text-gray-900">
                    {student.name || "이름 없음"}
                  </div>
                  <div className="text-xs text-gray-500">
                    {student.grade && student.class
                      ? `${student.grade}학년 ${student.class}반`
                      : student.grade
                      ? `${student.grade}학년`
                      : ""}
                    {(() => {
                      const phone = getPhoneByRecipientType(student, recipientType);
                      const recipientTypeLabel = 
                        recipientType === "student" ? "학생" :
                        recipientType === "mother" ? "어머니" : "아버지";
                      return phone ? (
                        <span className="pl-2">({recipientTypeLabel}) {phone}</span>
                      ) : (
                        <span className="pl-2 text-red-500">({recipientTypeLabel} 연락처 없음)</span>
                      );
                    })()}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 필터링된 학생 중 선택한 대상자 타입의 연락처가 없는 학생 안내 */}
      {filteredStudents.length > selectableStudents.length && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
          {(() => {
            const recipientTypeLabel = 
              recipientType === "student" ? "학생 본인" :
              recipientType === "mother" ? "어머니" : "아버지";
            return `${recipientTypeLabel} 연락처가 없는 학생 ${filteredStudents.length - selectableStudents.length}명은 선택할 수 없습니다.`;
          })()}
        </div>
      )}
    </div>
  );
}

