"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { LinkedStudent } from "../../_utils";

type StudentSelectorProps = {
  students: LinkedStudent[];
  selectedStudentId: string;
};

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

  if (students.length === 1) {
    const student = students[0];
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">자녀:</span>
          <span className="text-base font-semibold text-gray-900">
            {student.name || "이름 없음"}
          </span>
          {student.grade && (
            <span className="text-sm text-gray-500">
              ({student.grade}학년 {student.class}반)
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <label className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700">자녀 선택:</span>
        <select
          value={selectedStudentId}
          onChange={handleChange}
          className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name || "이름 없음"}
              {student.grade && ` (${student.grade}학년 ${student.class}반)`}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

