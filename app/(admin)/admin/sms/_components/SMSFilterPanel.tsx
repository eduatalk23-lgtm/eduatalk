"use client";

import { useCallback } from "react";
import Label from "@/components/atoms/Label";
import Input from "@/components/atoms/Input";
import Button from "@/components/atoms/Button";
import { STUDENT_DIVISIONS, type StudentDivision } from "@/lib/constants/students";

export type RecipientType = "student" | "mother" | "father";

export type SMSFilter = {
  search: string;
  grades: string[];
  divisions: (StudentDivision | null)[];
  recipientTypes: RecipientType[];
};

type SMSFilterPanelProps = {
  filter: SMSFilter;
  onFilterChange: (filter: SMSFilter) => void;
  onSearch: () => void;
  isLoading?: boolean;
};

// 학년 옵션 (1~3학년)
const GRADE_OPTIONS = ["1", "2", "3"];

// 전송 대상자 옵션
const RECIPIENT_TYPE_OPTIONS: Array<{
  value: RecipientType;
  label: string;
}> = [
  { value: "student", label: "학생" },
  { value: "mother", label: "어머니" },
  { value: "father", label: "아버지" },
];

// 구분 옵션 (상수에서 가져와서 미설정 추가)
const DIVISION_OPTIONS: Array<{ value: StudentDivision | null; label: string }> = [
  ...STUDENT_DIVISIONS,
  { value: null, label: "미설정" },
];

export default function SMSFilterPanel({
  filter,
  onFilterChange,
  onSearch,
  isLoading = false,
}: SMSFilterPanelProps) {

  // 학년 토글
  const handleGradeToggle = useCallback(
    (grade: string) => {
      const newGrades = filter.grades.includes(grade)
        ? filter.grades.filter((g) => g !== grade)
        : [...filter.grades, grade];
      onFilterChange({ ...filter, grades: newGrades });
    },
    [filter, onFilterChange]
  );

  // 구분 토글
  const handleDivisionToggle = useCallback(
    (division: StudentDivision | null) => {
      const newDivisions = filter.divisions.includes(division)
        ? filter.divisions.filter((d) => d !== division)
        : [...filter.divisions, division];
      onFilterChange({ ...filter, divisions: newDivisions });
    },
    [filter, onFilterChange]
  );

  // 전송 대상자 토글
  const handleRecipientTypeToggle = useCallback(
    (recipientType: RecipientType) => {
      const newRecipientTypes = filter.recipientTypes.includes(recipientType)
        ? filter.recipientTypes.filter((t) => t !== recipientType)
        : [...filter.recipientTypes, recipientType];
      onFilterChange({ ...filter, recipientTypes: newRecipientTypes });
    },
    [filter, onFilterChange]
  );

  // 전체 선택/해제
  const handleSelectAllGrades = useCallback(() => {
    if (filter.grades.length === GRADE_OPTIONS.length) {
      onFilterChange({ ...filter, grades: [] });
    } else {
      onFilterChange({ ...filter, grades: [...GRADE_OPTIONS] });
    }
  }, [filter, onFilterChange]);

  const handleSelectAllDivisions = useCallback(() => {
    if (filter.divisions.length === DIVISION_OPTIONS.length) {
      onFilterChange({ ...filter, divisions: [] });
    } else {
      onFilterChange({
        ...filter,
        divisions: DIVISION_OPTIONS.map((d) => d.value),
      });
    }
  }, [filter, onFilterChange]);

  const handleSelectAllRecipientTypes = useCallback(() => {
    if (filter.recipientTypes.length === RECIPIENT_TYPE_OPTIONS.length) {
      onFilterChange({ ...filter, recipientTypes: [] });
    } else {
      onFilterChange({
        ...filter,
        recipientTypes: RECIPIENT_TYPE_OPTIONS.map((t) => t.value),
      });
    }
  }, [filter, onFilterChange]);

  // 필터 초기화
  const handleReset = useCallback(() => {
    onFilterChange({
      search: "",
      grades: [],
      divisions: [],
      recipientTypes: [],
    });
  }, [onFilterChange]);

  // 선택된 필터 요약
  const selectedFiltersSummary = [
    filter.grades.length > 0 && `${filter.grades.length}개 학년`,
    filter.divisions.length > 0 && `${filter.divisions.length}개 구분`,
    filter.recipientTypes.length > 0 && `${filter.recipientTypes.length}개 대상자`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">발송 대상자 필터</h3>
        {selectedFiltersSummary && (
          <div className="text-sm text-gray-600">{selectedFiltersSummary}</div>
        )}
      </div>

      <div className="flex flex-col gap-6">
        {/* 검색 */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="filter-search">이름/전화번호 검색</Label>
          <Input
            id="filter-search"
            type="text"
            placeholder="검색..."
            value={filter.search}
            onChange={(e) =>
              onFilterChange({ ...filter, search: e.target.value })
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSearch();
              }
            }}
          />
        </div>

        {/* 학년 필터 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>학년</Label>
            <button
              type="button"
              onClick={handleSelectAllGrades}
              className="text-xs text-indigo-600 hover:text-indigo-700"
            >
              {filter.grades.length === GRADE_OPTIONS.length
                ? "전체 해제"
                : "전체 선택"}
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {GRADE_OPTIONS.map((grade) => (
              <label
                key={grade}
                className="flex cursor-pointer items-center gap-2"
              >
                <input
                  type="checkbox"
                  checked={filter.grades.includes(grade)}
                  onChange={() => handleGradeToggle(grade)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">{grade}학년</span>
              </label>
            ))}
          </div>
        </div>

        {/* 구분 필터 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>구분</Label>
            <button
              type="button"
              onClick={handleSelectAllDivisions}
              className="text-xs text-indigo-600 hover:text-indigo-700"
            >
              {filter.divisions.length === DIVISION_OPTIONS.length
                ? "전체 해제"
                : "전체 선택"}
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {DIVISION_OPTIONS.map((division) => (
              <label
                key={division.value ?? "null"}
                className="flex cursor-pointer items-center gap-2"
              >
                <input
                  type="checkbox"
                  checked={filter.divisions.includes(division.value)}
                  onChange={() => handleDivisionToggle(division.value)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">{division.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 전송 대상자 필터 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>전송 대상자 (필수)</Label>
            <button
              type="button"
              onClick={handleSelectAllRecipientTypes}
              className="text-xs text-indigo-600 hover:text-indigo-700"
            >
              {filter.recipientTypes.length === RECIPIENT_TYPE_OPTIONS.length
                ? "전체 해제"
                : "전체 선택"}
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {RECIPIENT_TYPE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2"
              >
                <input
                  type="checkbox"
                  checked={filter.recipientTypes.includes(option.value)}
                  onChange={() => handleRecipientTypeToggle(option.value)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={onSearch}
            disabled={
              isLoading || filter.recipientTypes.length === 0
            }
            className="flex-1"
          >
            {isLoading ? "조회 중..." : "조회"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={isLoading}
          >
            초기화
          </Button>
        </div>

        {/* 필수 선택 안내 */}
        {filter.recipientTypes.length === 0 && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
            전송 대상자를 최소 1개 이상 선택해주세요.
          </div>
        )}
      </div>
    </div>
  );
}

