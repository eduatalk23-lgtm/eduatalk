import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getInternalScoresByTerm, getMockScoresByPeriod } from "@/lib/data/scoreDetails";
import { SectionHeader } from "@/components/ui/SectionHeader";
import AnalysisLayout from "./_components/AnalysisLayout";
import { getContainerClass } from "@/lib/constants/layout";

export default async function ScoreAnalysisPage() {
  // 사용자 인증 확인
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "student") {
    redirect("/login");
  }

  const studentId = currentUser.userId;
  const tenantId = currentUser.tenantId;

  // tenantId가 없으면 학생 설정 페이지로 리다이렉트
  if (!tenantId) {
    redirect("/student-setup");
  }

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
      <div className={getContainerClass("DASHBOARD", "md")}>
        <div className="flex flex-col gap-6">
          {/* 헤더 */}
          <SectionHeader
            level="h1"
            title="성적 상세 분석"
            description="내신과 모의고사 성적을 심층 분석합니다."
          />

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

