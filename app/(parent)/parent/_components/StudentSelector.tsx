"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { LinkedStudent } from "../../_utils";

type StudentSelectorProps = {
  students: LinkedStudent[];
  selectedStudentId: string;
};

function getRelationLabel(relation: string): string {
  switch (relation) {
    case "father":
      return "아버지";
    case "mother":
      return "어머니";
    case "guardian":
      return "후견인";
    default:
      return "보호자";
  }
}

export function StudentSelector({
  students,
  selectedStudentId,
}: StudentSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const studentId = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    params.set("studentId", studentId);
    // 현재 경로 유지
    router.push(`${pathname}?${params.toString()}`);
  };

  if (students.length === 0) {
    return null;
  }

  // 1명인 경우 - 단순 표시
  if (students.length === 1) {
    const student = students[0];
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">자녀:</span>
          <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {student.name || "이름 없음"}
          </span>
          {student.grade && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              ({student.grade}학년 {student.class}반)
            </span>
          )}
        </div>
      </div>
    );
  }

  // 여러 명인 경우 - 형제자매 표시와 함께 선택
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      {/* 헤더 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="h-5 w-5 text-blue-600 dark:text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            자녀 {students.length}명
          </span>
        </div>
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          형제자매
        </span>
      </div>

      {/* 선택 드롭다운 */}
      <label className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">현재 조회 중:</span>
        <select
          value={selectedStudentId}
          onChange={handleChange}
          className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        >
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name || "이름 없음"}
              {student.grade && ` (${student.grade}학년 ${student.class}반)`}
            </option>
          ))}
        </select>
      </label>

      {/* 자녀 카드 목록 (접힌 상태에서는 숨김 처리 가능 - 간소화를 위해 항상 표시) */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {students.map((student) => (
          <button
            key={student.id}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("studentId", student.id);
              router.push(`${pathname}?${params.toString()}`);
            }}
            className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${
              selectedStudentId === student.id
                ? "border-blue-500 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/30"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-700"
            }`}
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                selectedStudentId === student.id
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
              }`}
            >
              {student.name?.charAt(0) || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`truncate font-medium ${
                  selectedStudentId === student.id
                    ? "text-blue-900 dark:text-blue-100"
                    : "text-gray-900 dark:text-gray-100"
                }`}
              >
                {student.name || "이름 없음"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {student.grade ? `${student.grade}학년` : ""}
                {student.class ? ` ${student.class}반` : ""}
                {student.relation && ` · ${getRelationLabel(student.relation)}`}
              </p>
            </div>
            {selectedStudentId === student.id && (
              <svg
                className="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

