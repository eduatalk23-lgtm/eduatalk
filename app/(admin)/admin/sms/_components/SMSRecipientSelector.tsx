"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Label from "@/components/atoms/Label";
import Input from "@/components/atoms/Input";
import Select from "@/components/atoms/Select";
import Button from "@/components/atoms/Button";
import {
  getPhoneByRecipientType,
  extractUniqueGrades,
  extractUniqueClasses,
  type Student,
  type StudentFilter,
  type RecipientType,
} from "@/lib/utils/studentFilterUtils";

import type { RecipientType as SMSRecipientType } from "./SMSFilterPanel";
import { mapStudentSearchResults, mapToStudentType } from "@/lib/utils/studentSearchMapper";
import type { StudentSearchApiResponse } from "@/lib/domains/student/types";

type SMSRecipientSelectorProps = {
  students: Student[];
  selectedStudentIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
  recipientType?: SMSRecipientType;
  onRecipientTypeChange?: (type: SMSRecipientType) => void;
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
  });

  // 검색 결과 상태 (API 호출 결과)
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [executedSearchQuery, setExecutedSearchQuery] = useState("");

  // 검색 실행 함수 (debounce 포함)
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setExecutedSearchQuery("");
      return;
    }

    setIsSearching(true);
    setExecutedSearchQuery(query.trim());

    try {
      const params = new URLSearchParams({
        q: query.trim(),
        limit: "1000", // 충분히 큰 범위
      });

      // 필터 파라미터 추가
      if (filter.grade) {
        params.append("grade", filter.grade);
      }
      if (filter.class) {
        params.append("class", filter.class);
      }
      if (filter.isActive !== "all") {
        params.append("isActive", filter.isActive === "active" ? "true" : "false");
      }

      const response = await fetch(`/api/students/search?${params.toString()}`);

      if (!response.ok) {
        throw new Error("검색에 실패했습니다.");
      }

      const result = await response.json();

      if (result.success && result.data?.students) {
        // 검색 결과를 Student 타입으로 변환
        const searchResults_ = mapToStudentType(
          mapStudentSearchResults(
            result.data.students as StudentSearchApiResponse[]
          )
        );

        setSearchResults(searchResults_);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("[SMSRecipientSelector] 검색 오류:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [filter.grade, filter.class, filter.isActive]);

  // 검색어 변경 시 debounce 처리
  useEffect(() => {
    const timer = setTimeout(() => {
      if (filter.search) {
        performSearch(filter.search);
      } else {
        setSearchResults([]);
        setExecutedSearchQuery("");
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [filter.search, performSearch]);

  // 검색어가 있으면 검색 결과 사용, 없으면 기존 students 사용
  const studentsToFilter = executedSearchQuery ? searchResults : students;

  // 고유 학년 목록 추출 (검색 결과 또는 전체 학생 목록에서)
  const uniqueGrades = useMemo(() => extractUniqueGrades(studentsToFilter), [studentsToFilter]);

  // 고유 반 목록 추출 (검색 결과 또는 전체 학생 목록에서)
  const uniqueClasses = useMemo(() => extractUniqueClasses(studentsToFilter), [studentsToFilter]);

  // 필터링된 학생 목록 (검색 결과에 추가 필터 적용)
  const filteredStudents = useMemo(() => {
    let result = studentsToFilter;

    // 검색어가 없을 때만 추가 필터 적용 (검색어가 있으면 이미 API에서 필터링됨)
    if (!executedSearchQuery) {
      // 학년 필터
      if (filter.grade) {
        result = result.filter((s) => s.grade === filter.grade);
      }

      // 반 필터
      if (filter.class) {
        result = result.filter((s) => s.class === filter.class);
      }

      // 활성 상태 필터
      if (filter.isActive === "active") {
        result = result.filter((s) => s.is_active === true);
      } else if (filter.isActive === "inactive") {
        result = result.filter((s) => s.is_active === false);
      }
    }

    return result;
  }, [studentsToFilter, filter, executedSearchQuery]);

  // 필터링된 학생 중 선택 가능한 학생 (선택한 대상자 타입에 따라)
  const selectableStudents = useMemo(() => {
    return filteredStudents.filter((s) => {
      const phone = getPhoneByRecipientType(s, recipientType as RecipientType);
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
            <div className="relative">
              <Input
                id="filter-search"
                type="text"
                placeholder="검색... (이름 또는 연락처 4자리 이상)"
                value={filter.search}
                onChange={(e) =>
                  setFilter((prev) => ({ ...prev, search: e.target.value }))
                }
                className={isSearching ? "pr-8" : ""}
              />
              {isSearching && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600"></div>
                </div>
              )}
            </div>
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
                      const phone = getPhoneByRecipientType(student, recipientType as RecipientType);
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

