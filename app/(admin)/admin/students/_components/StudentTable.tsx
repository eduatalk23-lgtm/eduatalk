"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  bgSurface,
  textPrimary,
  textMuted,
  textTertiary,
  divideDefaultVar,
  tableRowBase,
  tableCellBase,
  tableHeaderBase,
  getGrayBgClasses,
  getStatusBadgeColorClasses,
  getIndigoTextClasses,
  borderInput,
} from "@/lib/utils/darkMode";
import type { StudentListRow } from "./types";

type StudentTableProps = {
  students: StudentListRow[];
  isAdmin: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (checked: boolean) => void;
};

export function StudentTable({
  students,
  isAdmin,
  selectedIds,
  onToggleSelect,
  onSelectAll,
}: StudentTableProps) {
  const allSelected = students.length > 0 && students.every((s) => selectedIds.has(s.id));
  const someSelected = students.some((s) => selectedIds.has(s.id));

  return (
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
                onChange={(e) => onSelectAll(e.target.checked)}
                className={cn(
                  "h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500",
                  borderInput
                )}
              />
            </th>
            <th className={tableHeaderBase}>이름</th>
            <th className={tableHeaderBase}>성별</th>
            <th className={tableHeaderBase}>구분</th>
            <th className={tableHeaderBase}>학교</th>
            <th className={tableHeaderBase}>학년</th>
            <th className={tableHeaderBase}>학생 연락처</th>
            <th className={tableHeaderBase}>모 연락처</th>
            <th className={tableHeaderBase}>부 연락처</th>
            <th className={tableHeaderBase}>계정</th>
            <th className={tableHeaderBase}>상태</th>
          </tr>
        </thead>
        <tbody className={cn("divide-y", divideDefaultVar, bgSurface)}>
          {students.map((student) => {
            const isSelected = selectedIds.has(student.id);
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
                    onChange={() => onToggleSelect(student.id)}
                    className={cn(
                      "h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500",
                      borderInput
                    )}
                  />
                </td>
                <td className={cn(tableCellBase, "font-medium", textPrimary)}>
                  <Link
                    href={`/admin/students/${student.id}`}
                    className={cn(
                      getIndigoTextClasses("link"),
                      "hover:underline"
                    )}
                  >
                    {student.name ?? "이름 없음"}
                  </Link>
                </td>
                <td className={cn(tableCellBase, textMuted)}>
                  {student.gender ?? "-"}
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
                          : student.division === "졸업"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                      )}
                    >
                      {student.division}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td className={cn(tableCellBase, textMuted)}>
                  {student.schoolName}
                </td>
                <td className={cn(tableCellBase, textMuted)}>
                  {student.grade ?? "-"}
                </td>
                <td className={cn(tableCellBase, textMuted)}>
                  {student.phone ?? "-"}
                </td>
                <td className={cn(tableCellBase, textMuted)}>
                  {student.mother_phone ?? "-"}
                </td>
                <td className={cn(tableCellBase, textMuted)}>
                  {student.father_phone ?? "-"}
                </td>
                <td className={cn(tableCellBase, textMuted)}>
                  {student.email ?? "-"}
                </td>
                <td className={cn(tableCellBase, textMuted)}>
                  {student.is_active === false ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-1 text-xs font-semibold",
                        getStatusBadgeColorClasses("error")
                      )}
                    >
                      비활성화
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "rounded-full px-2 py-1 text-xs font-semibold",
                        getStatusBadgeColorClasses("active")
                      )}
                    >
                      활성
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

