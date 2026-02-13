"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { SubjectGroup, SubjectType } from "@/lib/data/subjects";
import InternalScoreInput from "./InternalScoreInput";
import MockScoreInput from "./MockScoreInput";

type CurriculumHierarchy = {
  curriculum: {
    id: string;
    name: string;
    year: number | null;
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

type ScoreInputLayoutProps = {
  studentId: string;
  tenantId: string;
  curriculumOptions: CurriculumHierarchy[];
};

type ScoreType = "internal" | "mock";

export default function ScoreInputLayout({
  studentId,
  tenantId,
  curriculumOptions,
}: ScoreInputLayoutProps) {
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get("tab");

  const [scoreType, setScoreType] = useState<ScoreType>(() => {
    return tabParam === "mock" ? "mock" : "internal";
  });

  // 교육과정 선택: 기본값은 첫 번째 (최신순 정렬됨)
  const [selectedCurriculumId, setSelectedCurriculumId] = useState(
    curriculumOptions[0]?.curriculum.id ?? ""
  );

  const selected = curriculumOptions.find(
    (o) => o.curriculum.id === selectedCurriculumId
  ) ?? curriculumOptions[0];

  // 쿼리 파라미터 변경 시 탭 전환
  useEffect(() => {
    if (tabParam === "internal") setScoreType("internal");
    else if (tabParam === "mock") setScoreType("mock");
  }, [tabParam]);

  return (
    <div className="flex flex-col gap-6">
      {/* 교육과정 선택 (2개 이상일 때만 표시) */}
      {curriculumOptions.length > 1 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">교육과정</label>
          <div className="flex rounded-lg bg-gray-100 p-1">
            {curriculumOptions.map((option) => (
              <button
                key={option.curriculum.id}
                type="button"
                onClick={() => setSelectedCurriculumId(option.curriculum.id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  selectedCurriculumId === option.curriculum.id
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {option.curriculum.name}
              </button>
            ))}
          </div>
        </div>
      )}

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
          key={selected.curriculum.id}
          studentId={studentId}
          tenantId={tenantId}
          curriculumRevisionId={selected.curriculum.id}
          curriculumYear={selected.curriculum.year}
          subjectGroups={selected.subjectGroups}
          subjectTypes={selected.subjectTypes}
        />
      ) : (
        <MockScoreInput
          studentId={studentId}
          tenantId={tenantId}
          subjectGroups={selected.subjectGroups}
        />
      )}
    </div>
  );
}
