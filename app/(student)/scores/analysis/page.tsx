import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getInternalScoresByTerm, getMockScoresByPeriod } from "@/lib/data/scoreDetails";
import AnalysisLayout from "./_components/AnalysisLayout";

export default async function ScoreAnalysisPage() {
  // 사용자 인증 확인
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "student") {
    redirect("/login");
  }

  const studentId = currentUser.userId;
  const tenantId = currentUser.tenantId || "";

  // 내신 성적 조회 (전체)
  const internalScores = await getInternalScoresByTerm(studentId, tenantId);

  // 모의고사 성적 조회 (최근 1년)
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const mockScores = await getMockScoresByPeriod(
    studentId,
    tenantId,
    oneYearAgo.toISOString().split("T")[0]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6 md:px-6 md:py-8">
        <div className="flex flex-col gap-6">
          {/* 헤더 */}
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
              성적 상세 분석
            </h1>
            <p className="text-sm text-gray-600 md:text-base">
              내신과 모의고사 성적을 심층 분석합니다.
            </p>
          </div>

          {/* 분석 레이아웃 */}
          <AnalysisLayout
            studentId={studentId}
            tenantId={tenantId}
            internalScores={internalScores}
            mockScores={mockScores}
          />
        </div>
      </div>
    </div>
  );
}

