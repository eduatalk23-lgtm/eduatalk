"use client";

import Link from "next/link";

type ScoreFilterBarProps = {
  courseFilter?: string;
  semesterFilter?: string;
  searchQuery?: string;
  courseList: string[];
  semesterList: string[];
};

export function ScoreFilterBar({
  courseFilter,
  semesterFilter,
  searchQuery,
  courseList,
  semesterList,
}: ScoreFilterBarProps) {
  return (
    <form action="/scores" method="get" className="flex flex-wrap items-end gap-4">
      <div className="flex-1 min-w-[200px]">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          교과 필터
        </label>
        <select
          name="course"
          defaultValue={courseFilter ?? ""}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
          onChange={(e) => {
            const form = e.currentTarget.form;
            if (form) {
              const semesterSelect = form.querySelector(
                'select[name="semester"]'
              ) as HTMLSelectElement;
              const searchInput = form.querySelector(
                'input[name="search"]'
              ) as HTMLInputElement;
              if (semesterSelect) {
                const hiddenSemester = document.createElement("input");
                hiddenSemester.type = "hidden";
                hiddenSemester.name = "semester";
                hiddenSemester.value = semesterSelect.value || "";
                form.appendChild(hiddenSemester);
              }
              if (searchInput) {
                const hiddenSearch = document.createElement("input");
                hiddenSearch.type = "hidden";
                hiddenSearch.name = "search";
                hiddenSearch.value = searchInput.value || "";
                form.appendChild(hiddenSearch);
              }
              form.submit();
            }
          }}
        >
          <option value="">전체</option>
          {courseList.map((course) => (
            <option key={course} value={course}>
              {course}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 min-w-[200px]">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          학기 필터
        </label>
        <select
          name="semester"
          defaultValue={semesterFilter ?? ""}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
          onChange={(e) => {
            const form = e.currentTarget.form;
            if (form) {
              const courseSelect = form.querySelector(
                'select[name="course"]'
              ) as HTMLSelectElement;
              const searchInput = form.querySelector(
                'input[name="search"]'
              ) as HTMLInputElement;
              if (courseSelect) {
                const hiddenCourse = document.createElement("input");
                hiddenCourse.type = "hidden";
                hiddenCourse.name = "course";
                hiddenCourse.value = courseSelect.value || "";
                form.appendChild(hiddenCourse);
              }
              if (searchInput) {
                const hiddenSearch = document.createElement("input");
                hiddenSearch.type = "hidden";
                hiddenSearch.name = "search";
                hiddenSearch.value = searchInput.value || "";
                form.appendChild(hiddenSearch);
              }
              form.submit();
            }
          }}
        >
          <option value="">전체</option>
          {semesterList.map((semester) => (
            <option key={semester} value={semester}>
              {semester}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 min-w-[200px]">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          검색 (과목명)
        </label>
        <input
          type="text"
          name="search"
          defaultValue={searchQuery ?? ""}
          placeholder="과목명으로 검색"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const form = e.currentTarget.form;
              if (form) {
                const courseSelect = form.querySelector(
                  'select[name="course"]'
                ) as HTMLSelectElement;
                const semesterSelect = form.querySelector(
                  'select[name="semester"]'
                ) as HTMLSelectElement;
                if (courseSelect) {
                  const hiddenCourse = document.createElement("input");
                  hiddenCourse.type = "hidden";
                  hiddenCourse.name = "course";
                  hiddenCourse.value = courseSelect.value || "";
                  form.appendChild(hiddenCourse);
                }
                if (semesterSelect) {
                  const hiddenSemester = document.createElement("input");
                  hiddenSemester.type = "hidden";
                  hiddenSemester.name = "semester";
                  hiddenSemester.value = semesterSelect.value || "";
                  form.appendChild(hiddenSemester);
                }
                form.submit();
              }
            }
          }}
        />
      </div>

      {(courseFilter || semesterFilter || searchQuery) && (
        <Link
          href="/scores"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          필터 초기화
        </Link>
      )}
    </form>
  );
}

