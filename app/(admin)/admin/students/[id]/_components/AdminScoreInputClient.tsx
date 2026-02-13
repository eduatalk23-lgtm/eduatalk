"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import InternalScoreInput from "@/app/(student)/scores/input/_components/InternalScoreInput";
import type { SubjectGroup, SubjectType } from "@/lib/data/subjects";

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

type AdminScoreInputClientProps = {
  studentId: string;
  tenantId: string;
  curriculumOptions: CurriculumHierarchy[];
};

export default function AdminScoreInputClient({
  studentId,
  tenantId,
  curriculumOptions,
}: AdminScoreInputClientProps) {
  const router = useRouter();
  const [selectedCurriculumId, setSelectedCurriculumId] = useState(
    curriculumOptions[0]?.curriculum.id ?? ""
  );

  const selected = curriculumOptions.find(
    (o) => o.curriculum.id === selectedCurriculumId
  ) ?? curriculumOptions[0];

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
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

      <InternalScoreInput
        key={selected.curriculum.id}
        studentId={studentId}
        tenantId={tenantId}
        curriculumRevisionId={selected.curriculum.id}
        curriculumYear={selected.curriculum.year}
        subjectGroups={selected.subjectGroups}
        subjectTypes={selected.subjectTypes}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
