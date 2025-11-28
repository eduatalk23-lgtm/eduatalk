import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getActiveCurriculumRevision, getSubjectHierarchyOptimized } from "@/lib/data/subjects";
import ScoreInputLayout from "./_components/ScoreInputLayout";

export default async function ScoreInputPage() {
  // 사용자 인증 확인
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "student") {
    redirect("/login");
  }

  // 활성화된 개정교육과정 조회
  const activeCurriculum = await getActiveCurriculumRevision();
  if (!activeCurriculum) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900">
            개정교육과정 정보가 없습니다
          </h2>
          <p className="text-sm text-gray-600 mt-2">
            관리자에게 문의하세요.
          </p>
        </div>
      </div>
    );
  }

  // 교과 계층 구조 조회 (교과군 → 과목 → 과목구분)
  const hierarchy = await getSubjectHierarchyOptimized(activeCurriculum.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6 md:px-6 md:py-8">
        <div className="flex flex-col gap-6">
          {/* 헤더 */}
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
              성적 입력
            </h1>
            <p className="text-sm text-gray-600 md:text-base">
              내신 성적과 모의고사 성적을 입력하세요.
            </p>
          </div>

          {/* 성적 입력 레이아웃 */}
          <ScoreInputLayout
            studentId={currentUser.userId}
            tenantId={currentUser.tenantId || ""}
            curriculum={hierarchy.curriculumRevision}
            subjectGroups={hierarchy.subjectGroups}
            subjectTypes={hierarchy.subjectTypes}
          />
        </div>
      </div>
    </div>
  );
}

