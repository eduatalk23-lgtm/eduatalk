"use client";

import { useRouter } from "next/navigation";
import { SCHOOL_SUBJECT_GROUPS, MOCK_SUBJECT_GROUPS } from "@/lib/constants/mock-exam";

type SubjectGroupTabsProps = {
  type: "school" | "mock";
  basePath: string; // 예: "/scores/school/1/1" 또는 "/scores/mock/1"
  currentSubject: string;
  additionalParams?: string[]; // 모의고사용: ["평가원"]
};

export function SubjectGroupTabs({
  type,
  basePath,
  currentSubject,
  additionalParams = [],
}: SubjectGroupTabsProps) {
  const router = useRouter();
  const subjects = type === "school" ? SCHOOL_SUBJECT_GROUPS : MOCK_SUBJECT_GROUPS;

  const buildHref = (subject: string) => {
    const encodedSubject = encodeURIComponent(subject);
    const encodedParams = additionalParams.map((p) => encodeURIComponent(p)).join("/");
    return `${basePath}/${encodedSubject}${additionalParams.length > 0 ? `/${encodedParams}` : ""}`;
  };

  return (
    <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
      {subjects.map((subject) => {
        const active = decodeURIComponent(currentSubject) === subject;
        return (
          <button
            key={subject}
            onClick={() => router.push(buildHref(subject))}
            className={`px-4 py-2 text-sm font-medium transition ${
              active
                ? "border-b-2 border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            }`}
          >
            {subject}
          </button>
        );
      })}
    </div>
  );
}

