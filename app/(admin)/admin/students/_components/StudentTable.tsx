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
  bgStyles,
  getIndigoTextClasses,
} from "@/lib/utils/darkMode";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import { StudentActions } from "./StudentActions";

type StudentWithStats = {
  id: string;
  name: string | null;
  grade: string | null;
  class: string | null;
  studyTimeMinutes: number;
  planCompletionRate: number;
  lastActivity: string | null;
  hasScore: boolean;
  is_active: boolean | null;
};

type StudentTableProps = {
  students: StudentWithStats[];
  isAdmin: boolean;
};

export function StudentTable({ students, isAdmin }: StudentTableProps) {
  return (
    <div className={cn("overflow-x-auto rounded-lg shadow-sm", "bg-white dark:bg-gray-900")}>
      <table className="w-full">
        <thead className={cn(getGrayBgClasses("tableHeader"))}>
          <tr>
            <th className={tableHeaderBase}>이름</th>
            <th className={tableHeaderBase}>학년</th>
            <th className={tableHeaderBase}>반</th>
            <th className={tableHeaderBase}>이번주 학습시간</th>
            <th className={tableHeaderBase}>이번주 플랜 실행률</th>
            <th className={tableHeaderBase}>최근 학습일</th>
            <th className={tableHeaderBase}>성적 입력</th>
            <th className={tableHeaderBase}>상태</th>
            <th className={tableHeaderBase}>작업</th>
          </tr>
        </thead>
        <tbody className={cn("divide-y", divideDefaultVar, bgSurface)}>
          {students.map((student) => (
            <tr key={student.id} className={tableRowBase}>
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
                {student.studyTimeMinutes}분
              </td>
              <td className={cn(tableCellBase, textMuted)}>
                <div className="flex items-center gap-2">
                  <ProgressBar
                    value={student.planCompletionRate}
                    max={100}
                    color="indigo"
                    height="sm"
                    className="w-24"
                  />
                  <span>{student.planCompletionRate}%</span>
                </div>
              </td>
              <td className={cn(tableCellBase, textMuted)}>
                {student.lastActivity
                  ? new Date(student.lastActivity).toLocaleDateString("ko-KR")
                  : "-"}
              </td>
              <td className={cn(tableCellBase, textMuted)}>
                {student.hasScore ? (
                  <span
                    className={cn(
                      "rounded-full px-2 py-1 text-xs font-semibold",
                      getStatusBadgeColorClasses("success")
                    )}
                  >
                    입력됨
                  </span>
                ) : (
                  <span
                    className={cn(
                      "rounded-full px-2 py-1 text-xs font-semibold",
                      bgStyles.gray,
                      textTertiary
                    )}
                  >
                    미입력
                  </span>
                )}
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
              <td className={cn(tableCellBase, textMuted)}>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/admin/students/${student.id}`}
                    className={getIndigoTextClasses("link")}
                  >
                    상세 보기
                  </Link>
                  <StudentActions
                    studentId={student.id}
                    studentName={student.name ?? "이름 없음"}
                    isActive={student.is_active !== false}
                    isAdmin={isAdmin}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

