"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SubjectGroupSidebar from "./SubjectGroupSidebar";
import SubjectManagementPanel from "./SubjectManagementPanel";
import RevisionFormModal from "./RevisionFormModal";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";
import type { SubjectGroup, Subject, SubjectType } from "@/lib/data/subjects";
import { Plus } from "lucide-react";

type CurriculumRevisionTabsProps = {
  revisions: CurriculumRevision[];
  selectedRevisionId: string | null;
  onRevisionChange: (revisionId: string) => void;
  initialGroups: SubjectGroup[];
  initialSubjectsMap: Record<string, Subject[]>;
  initialSubjectTypes: SubjectType[];
};

export default function CurriculumRevisionTabs({
  revisions,
  selectedRevisionId,
  onRevisionChange,
  initialGroups,
  initialSubjectsMap,
  initialSubjectTypes,
}: CurriculumRevisionTabsProps) {
  const router = useRouter();
  const [isCreatingRevision, setIsCreatingRevision] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    initialGroups.length > 0 ? initialGroups[0].id : null
  );

  function handleCreateRevision() {
    setIsCreatingRevision(true);
  }

  function handleRevisionSuccess() {
    setIsCreatingRevision(false);
    router.refresh();
  }

  function handleRevisionCancel() {
    setIsCreatingRevision(false);
  }

  function handleGroupSelect(groupId: string | null) {
    setSelectedGroupId(groupId);
  }

  const selectedRevision = revisions.find((r) => r.id === selectedRevisionId);

  return (
    <div className="flex flex-col gap-4">
      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {revisions.map((revision) => (
            <button
              key={revision.id}
              onClick={() => onRevisionChange(revision.id)}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition ${
                selectedRevisionId === revision.id
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {revision.name}
              {!revision.is_active && (
                <span className="ml-2 text-xs text-gray-400">(비활성)</span>
              )}
            </button>
          ))}
          <button
            onClick={handleCreateRevision}
            className="ml-auto flex items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-1 py-4 text-sm font-medium text-gray-500 transition hover:border-gray-300 hover:text-gray-700"
          >
            <Plus className="h-4 w-4" />
            추가
          </button>
        </nav>
      </div>

      {/* 좌우 분할 레이아웃 (모바일에서는 세로 스택) */}
      {selectedRevision && (
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* 왼쪽: 교과 목록 사이드바 */}
          <div className="w-full lg:w-80 lg:flex-shrink-0">
            <SubjectGroupSidebar
              curriculumRevisionId={selectedRevision.id}
              selectedGroupId={selectedGroupId}
              onGroupSelect={handleGroupSelect}
              initialGroups={selectedRevisionId === revisions[0]?.id ? initialGroups : undefined}
            />
          </div>

          {/* 오른쪽: 메인 컨텐츠 영역 */}
          <div className="flex-1">
            <SubjectManagementPanel
              curriculumRevisionId={selectedRevision.id}
              selectedGroupId={selectedGroupId}
              initialSubjects={
                selectedGroupId && selectedRevisionId === revisions[0]?.id
                  ? initialSubjectsMap[selectedGroupId]
                  : undefined
              }
              initialSubjectTypes={
                selectedRevisionId === revisions[0]?.id
                  ? initialSubjectTypes
                  : undefined
              }
            />
          </div>
        </div>
      )}

      {/* 개정교육과정 생성 모달 */}
      {isCreatingRevision && (
        <RevisionFormModal
          onSuccess={handleRevisionSuccess}
          onCancel={handleRevisionCancel}
        />
      )}
    </div>
  );
}

