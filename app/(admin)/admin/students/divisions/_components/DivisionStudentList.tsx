"use client";

import { useState, useCallback } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/cn";
import {
  bgSurface,
  textPrimary,
  textMuted,
  divideDefaultVar,
  tableRowBase,
  tableCellBase,
  tableHeaderBase,
  getGrayBgClasses,
  borderInput,
} from "@/lib/utils/darkMode";
import { updateStudentDivisionAction } from "@/lib/domains/student/actions";
import { STUDENT_DIVISIONS, type StudentDivision } from "@/lib/constants/students";
import type { Student } from "@/lib/data/students";

type DivisionStudentListProps = {
  students: Student[];
  onUpdate?: () => void;
  onSelectionChange?: (selectedIds: Set<string>) => void;
};

export function DivisionStudentList({
  students,
  onUpdate,
  onSelectionChange,
}: DivisionStudentListProps) {
  const { showSuccess, showError } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  const updateSelectedIds = useCallback(
    (newIds: Set<string>) => {
      setSelectedIds(newIds);
      onSelectionChange?.(newIds);
    },
    [onSelectionChange]
  );

  const handleToggleSelect = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [setSelectedIds]
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        const newIds = new Set(students.map((s) => s.id));
        updateSelectedIds(newIds);
      } else {
        updateSelectedIds(new Set());
      }
    },
    [students, updateSelectedIds]
  );

  const handleDivisionChange = useCallback(
    async (studentId: string, division: StudentDivision | null) => {
      setUpdatingIds((prev) => new Set(prev).add(studentId));

      try {
        const result = await updateStudentDivisionAction(studentId, division);

        if (result.success) {
          showSuccess("구분이 업데이트되었습니다.");
          onUpdate?.();
        } else {
          showError(result.error || "구분 업데이트에 실패했습니다.");
        }
      } catch (error) {
        console.error("구분 업데이트 실패:", error);
        showError(
          error instanceof Error ? error.message : "구분 업데이트에 실패했습니다."
        );
      } finally {
        setUpdatingIds((prev) => {
          const next = new Set(prev);
          next.delete(studentId);
          return next;
        });
      }
    },
    [showSuccess, showError, onUpdate]
  );

  const allSelected = students.length > 0 && students.every((s) => selectedIds.has(s.id));
  const someSelected = students.some((s) => selectedIds.has(s.id));

  const selectedCount = selectedIds.size;

  return (
    <div className="flex flex-col gap-4">
      {/* 선택된 항목 정보 */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 dark:border-indigo-800 dark:bg-indigo-900/20">
          <span className={cn("text-body-2 font-semibold", "text-indigo-700 dark:text-indigo-300")}>
            {selectedCount}개 선택됨
          </span>
          <button
            type="button"
            onClick={() => updateSelectedIds(new Set())}
            className={cn(
              "text-body-2 font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
            )}
          >
            선택 해제
          </button>
        </div>
      )}

      {/* 학생 목록 테이블 */}
      <div className={cn("overflow-x-auto rounded-lg shadow-sm", "bg-white dark:bg-gray-900")}>
        <table className="w-full">
          <thead className={cn(getGrayBgClasses("tableHeader"))}>
            <tr>
              <th className={tableHeaderBase}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) {
                      input.indeterminate = someSelected && !allSelected;
                    }
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className={cn(
                    "h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500",
                    borderInput
                  )}
                />
              </th>
              <th className={tableHeaderBase}>이름</th>
              <th className={tableHeaderBase}>학년</th>
              <th className={tableHeaderBase}>반</th>
              <th className={tableHeaderBase}>현재 구분</th>
              <th className={tableHeaderBase}>구분 변경</th>
            </tr>
          </thead>
          <tbody className={cn("divide-y", divideDefaultVar, bgSurface)}>
            {students.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className={cn(tableCellBase, "text-center", textMuted)}
                >
                  학생이 없습니다.
                </td>
              </tr>
            ) : (
              students.map((student) => {
                const isSelected = selectedIds.has(student.id);
                const isUpdating = updatingIds.has(student.id);

                return (
                  <tr
                    key={student.id}
                    className={cn(
                      tableRowBase,
                      isSelected && "bg-indigo-50 dark:bg-indigo-950/20"
                    )}
                  >
                    <td className={tableCellBase}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(student.id)}
                        className={cn(
                          "h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500",
                          borderInput
                        )}
                      />
                    </td>
                    <td className={cn(tableCellBase, "font-medium", textPrimary)}>
                      {student.name ?? "이름 없음"}
                    </td>
                    <td className={cn(tableCellBase, textMuted)}>
                      {student.grade ?? "-"}
                    </td>
                    <td className={cn(tableCellBase, textMuted)}>
                      {student.class ?? "-"}
                    </td>
                    <td className={cn(tableCellBase, textMuted)}>
                      {student.division ? (
                        <span
                          className={cn(
                            "rounded-full px-2 py-1 text-xs font-semibold",
                            student.division === "고등부"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                              : student.division === "중등부"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                          )}
                        >
                          {student.division}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">미설정</span>
                      )}
                    </td>
                    <td className={tableCellBase}>
                      <select
                        value={student.division || ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          handleDivisionChange(
                            student.id,
                            value === "" ? null : (value as StudentDivision)
                          );
                        }}
                        disabled={isUpdating}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2",
                          borderInput,
                          bgSurface,
                          textPrimary,
                          "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800",
                          isUpdating && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <option value="">미설정</option>
                        {STUDENT_DIVISIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

