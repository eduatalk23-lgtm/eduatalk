"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { getCurriculumRevisionsAction } from "@/app/(admin)/actions/contentMetadataActions";
import CurriculumRevisionTabs from "./_components/CurriculumRevisionTabs";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";

export default function SubjectsPage() {
  const toast = useToast();
  const [revisions, setRevisions] = useState<CurriculumRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);

  useEffect(() => {
    loadRevisions();
  }, []);

  async function loadRevisions() {
    setLoading(true);
    try {
      const data = await getCurriculumRevisionsAction();
      setRevisions(data || []);
      // 첫 번째 개정교육과정을 기본으로 선택
      if (data && data.length > 0 && !selectedRevisionId) {
        setSelectedRevisionId(data[0].id);
      }
    } catch (error) {
      console.error("개정교육과정 조회 실패:", error);
      toast.showError("개정교육과정을 불러오는데 실패했습니다.");
      setRevisions([]);
    } finally {
      setLoading(false);
    }
  }

  function handleRevisionChange(revisionId: string) {
    setSelectedRevisionId(revisionId);
  }

  function handleRefresh() {
    loadRevisions();
  }

  const sortedRevisions = [...revisions].sort(
    (a, b) =>
      a.display_order - b.display_order || a.name.localeCompare(b.name)
  );

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-gray-900">교과/과목 관리</h1>
        <p className="mt-2 text-sm text-gray-500">
          개정교육과정, 교과, 과목, 과목구분을 통합 관리합니다.
        </p>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-gray-500">
          로딩 중...
        </div>
      ) : sortedRevisions.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">
            개정교육과정이 없습니다. 개정교육과정을 생성해주세요.
          </p>
        </div>
      ) : (
        <CurriculumRevisionTabs
          revisions={sortedRevisions}
          selectedRevisionId={selectedRevisionId}
          onRevisionChange={handleRevisionChange}
          onRefresh={handleRefresh}
        />
      )}
    </section>
  );
}
