"use client";

import { useState } from "react";
import type { SubjectGroup, SubjectType } from "@/lib/data/subjects";
import InternalScoreInput from "./InternalScoreInput";
import MockScoreInput from "./MockScoreInput";

type ScoreInputLayoutProps = {
  studentId: string;
  tenantId: string;
  curriculum: {
    id: string;
    name: string;
    year?: number | null;
  };
  subjectGroups: (SubjectGroup & {
    subjects: Array<{
      id: string;
      subject_group_id: string;
      name: string;
      subject_type_id?: string | null;
      subject_type?: string | null;
    }>;
  })[];
  subjectTypes: SubjectType[];
};

type ScoreType = "internal" | "mock";

export default function ScoreInputLayout({
  studentId,
  tenantId,
  curriculum,
  subjectGroups,
  subjectTypes,
}: ScoreInputLayoutProps) {
  const [scoreType, setScoreType] = useState<ScoreType>("internal");

  return (
    <div className="flex flex-col gap-6">
      {/* 성적 유형 선택 탭 */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setScoreType("internal")}
          className={`px-4 py-3 text-sm font-medium transition-colors ${
            scoreType === "internal"
              ? "border-b-2 border-indigo-600 text-indigo-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          내신 성적
        </button>
        <button
          onClick={() => setScoreType("mock")}
          className={`px-4 py-3 text-sm font-medium transition-colors ${
            scoreType === "mock"
              ? "border-b-2 border-indigo-600 text-indigo-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          모의고사 성적
        </button>
      </div>

      {/* 성적 입력 폼 */}
      {scoreType === "internal" ? (
        <InternalScoreInput
          studentId={studentId}
          tenantId={tenantId}
          curriculumRevisionId={curriculum.id}
          subjectGroups={subjectGroups}
          subjectTypes={subjectTypes}
        />
      ) : (
        <MockScoreInput
          studentId={studentId}
          tenantId={tenantId}
          subjectGroups={subjectGroups}
        />
      )}
    </div>
  );
}

