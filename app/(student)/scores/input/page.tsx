import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getAllActiveCurriculumRevisions, getSubjectHierarchyOptimized } from "@/lib/data/subjects";
import { SectionHeader } from "@/components/ui";
import ScoreInputLayout from "./_components/ScoreInputLayout";
import { getContainerClass } from "@/lib/constants/layout";

export default async function ScoreInputPage() {
  // 사용자 인증 확인
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "student") {
    redirect("/login");
  }

  // 모든 활성 교육과정 조회
  const activeCurricula = await getAllActiveCurriculumRevisions();
  if (activeCurricula.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col gap-2 text-center">
          <h2 className="text-lg font-semibold text-gray-900">
            개정교육과정 정보가 없습니다
          </h2>
          <p className="text-sm text-gray-600">
            관리자에게 문의하세요.
          </p>
        </div>
      </div>
    );
  }

  // 각 교육과정의 과목 계층 구조를 병렬 조회
  const hierarchies = await Promise.all(
    activeCurricula.map(async (c) => {
      const hierarchy = await getSubjectHierarchyOptimized(c.id);
      return {
        curriculum: { id: c.id, name: c.name, year: c.year },
        subjectGroups: hierarchy.subjectGroups,
        subjectTypes: hierarchy.subjectTypes,
      };
    })
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className={getContainerClass("DASHBOARD", "md")}>
        <div className="flex flex-col gap-6">
          {/* 헤더 */}
          <SectionHeader
            level="h1"
            title="성적 입력"
            description="내신 성적과 모의고사 성적을 입력하세요."
          />

          {/* 성적 입력 레이아웃 */}
          <ScoreInputLayout
            studentId={currentUser.userId}
            tenantId={currentUser.tenantId || ""}
            curriculumOptions={hierarchies}
          />
        </div>
      </div>
    </div>
  );
}
