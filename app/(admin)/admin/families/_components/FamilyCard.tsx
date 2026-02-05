import type { FamilyListItem } from "@/lib/domains/family";

type Props = {
  family: FamilyListItem;
};

export function FamilyCard({ family }: Props) {
  return (
    <div className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-700">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {family.familyName || "이름 없는 가족"}
          </h3>
          {family.primaryContactName && (
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              주 연락처: {family.primaryContactName}
            </p>
          )}
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
          <svg
            className="h-4 w-4 text-blue-600 dark:text-blue-400"
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
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-green-100 dark:bg-green-900/30">
            <svg
              className="h-3.5 w-3.5 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {family.studentCount}
            </span>
            <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
              학생
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-100 dark:bg-purple-900/30">
            <svg
              className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m3 5.197V21"
              />
            </svg>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {family.parentCount}
            </span>
            <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
              학부모
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {new Date(family.createdAt).toLocaleDateString("ko-KR")} 생성
        </span>
        <span className="text-xs font-medium text-blue-600 opacity-0 transition group-hover:opacity-100 dark:text-blue-400">
          상세보기 →
        </span>
      </div>
    </div>
  );
}
