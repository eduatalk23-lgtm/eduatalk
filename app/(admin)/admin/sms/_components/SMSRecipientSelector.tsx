"use client";

import { useState, useMemo } from "react";
import Label from "@/components/atoms/Label";
import Input from "@/components/atoms/Input";
import Select from "@/components/atoms/Select";
import Button from "@/components/atoms/Button";

type Student = {
  id: string;
  name: string | null;
  grade?: string | null;
  class?: string | null;
  parent_contact: string | null;
  is_active?: boolean | null;
};

type SMSRecipientSelectorProps = {
  students: Student[];
  selectedStudentIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
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
}: SMSRecipientSelectorProps) {
  const [filter, setFilter] = useState<StudentFilter>({
    search: "",
    grade: "",
    class: "",
    isActive: "all",
    hasParentContact: "yes", // 기본값: 학부모 연락처가 있는 학생만
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
        const phoneMatch = student.parent_contact?.includes(filter.search);
        if (!nameMatch && !phoneMatch) return false;
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

      // 학부모 연락처 필터
      if (filter.hasParentContact === "yes" && !student.parent_contact) {
        return false;
      }
      if (filter.hasParentContact === "no" && student.parent_contact) {
        return false;
      }

      return true;
    });
  }, [students, filter]);

  // 필터링된 학생 중 선택 가능한 학생 (학부모 연락처가 있는 학생)
  const selectableStudents = useMemo(() => {
    return filteredStudents.filter((s) => s.parent_contact);
  }, [filteredStudents]);

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
    <div className="space-y-4">
      {/* 필터 섹션 */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">발송 대상자 필터</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
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

          <div>
            <Label htmlFor="filter-contact">학부모 연락처</Label>
            <Select
              id="filter-contact"
              value={filter.hasParentContact}
              onChange={(e) =>
                setFilter((prev) => ({ ...prev, hasParentContact: e.target.value }))
              }
            >
              <option value="all">전체</option>
              <option value="yes">있음</option>
              <option value="no">없음</option>
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
          <span className="ml-2 text-gray-500">
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
                    {student.parent_contact && (
                      <span className="ml-2">{student.parent_contact}</span>
                    )}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 필터링된 학생 중 연락처가 없는 학생 안내 */}
      {filteredStudents.length > selectableStudents.length && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
          학부모 연락처가 없는 학생 {filteredStudents.length - selectableStudents.length}명은
          선택할 수 없습니다.
        </div>
      )}
    </div>
  );
}

