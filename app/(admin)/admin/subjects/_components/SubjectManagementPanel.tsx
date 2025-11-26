"use client";

import { useState } from "react";
import SubjectTable from "./SubjectTable";
import SubjectTypeTable from "./SubjectTypeTable";

type SubjectManagementPanelProps = {
  curriculumRevisionId: string;
  selectedGroupId: string | null;
};

export default function SubjectManagementPanel({
  curriculumRevisionId,
  selectedGroupId,
}: SubjectManagementPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* 과목 목록 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">과목</h2>
        {selectedGroupId ? (
          <SubjectTable
            subjectGroupId={selectedGroupId}
            curriculumRevisionId={curriculumRevisionId}
          />
        ) : (
          <div className="py-8 text-center text-sm text-gray-500">
            왼쪽에서 교과를 선택해주세요.
          </div>
        )}
      </div>

      {/* 과목구분 목록 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">과목구분</h2>
        <SubjectTypeTable curriculumRevisionId={curriculumRevisionId} />
      </div>
    </div>
  );
}

