
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { ScoreTypeTabs } from "../../_components/ScoreTypeTabs";
import { DashboardSubTabs } from "../_components/DashboardSubTabs";
import { getMockScores } from "@/lib/data/studentScores";
import { getSubjectHierarchyOptimized } from "@/lib/data/subjects";
import { resolveStudentCurriculumId } from "@/lib/domains/student/resolveStudentCurriculum";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import type { MockScoreRow } from "@/lib/types/legacyScoreTypes";
import { Card } from "@/components/molecules/Card";
import { MockExamTrendSection } from "../_components/MockExamTrendSection";
import { MockSummarySection } from "./_components/MockSummarySection";
import { MockWeakSubjectSection } from "./_components/MockWeakSubjectSection";
import { MockInsightPanel } from "./_components/MockInsightPanel";
import { MockDetailedMetrics } from "./_components/MockDetailedMetrics";
import { MockExamTypeComparisonChart } from "./_components/MockExamTypeComparisonChart";
import { MockPercentileDistributionChart } from "./_components/MockPercentileDistributionChart";
import { getContainerClass } from "@/lib/constants/layout";
import { PageHeader } from "@/components/layout/PageHeader";

/**
 * exam_title에서 시험 유형 추출
 */
function extractExamType(examTitle: string): string {
  if (examTitle.includes("평가원")) return "평가원";
  if (examTitle.includes("교육청")) return "교육청";
  if (examTitle.includes("사설")) return "사설";
  return examTitle; // 기본값으로 exam_title 전체 반환
}

/**
 * exam_date에서 회차(월) 추출
 */
function extractExamRound(examDate: string): string | null {
  try {
    const date = new Date(examDate);
    const month = date.getMonth() + 1; // 0-based이므로 +1
    return `${month}월`;
  } catch {
    return null;
  }
}

/**
 * MockScore를 MockScoreRow로 변환
 */
async function transformMockScoresToRows(
  mockScores: Awaited<ReturnType<typeof getMockScores>>,
  subjectHierarchy: Awaited<ReturnType<typeof getSubjectHierarchyOptimized>>
): Promise<MockScoreRow[]> {
  // 교과군 및 과목 매핑 생성
  const subjectGroupMap = new Map<string, string>();
  const subjectMap = new Map<string, string>();

  subjectHierarchy.subjectGroups.forEach((group) => {
    subjectGroupMap.set(group.id, group.name);
    group.subjects.forEach((subject) => {
      subjectMap.set(subject.id, subject.name);
    });
  });

  return mockScores.map((score): MockScoreRow => {
    const subjectGroup = subjectGroupMap.get(score.subject_group_id) || "";
    const subjectName = subjectMap.get(score.subject_id) || null;
    const examType = extractExamType(score.exam_title);
    const examRound = score.exam_date ? extractExamRound(score.exam_date) : null;

    return {
      id: score.id,
      student_id: score.student_id,
      grade: score.grade,
      subject_group: subjectGroup,
      exam_type: examType,
      subject_name: subjectName,
      raw_score: score.raw_score,
      percentile: score.percentile,
      grade_score: score.grade_score,
      exam_round: examRound,
      created_at: score.created_at,
    };
  });
}

export default async function MockScoresDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentUser();

  if (!currentUser) redirect("/login");

  // Tenant context 조회
  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    console.error("[mock-dashboard] tenantId를 찾을 수 없습니다.");
    redirect("/login");
  }

  // 학생 교육과정 resolve
  const resolvedCurriculum = await resolveStudentCurriculumId(currentUser.userId);
  if (!resolvedCurriculum) {
    console.error("[mock-dashboard] 교육과정을 찾을 수 없습니다.");
    return (
      <section className={getContainerClass("DASHBOARD", "md")}>
        <div className="flex flex-col gap-6">
          <PageHeader
            title="모의고사 성적 대시보드"
            description="모의고사 성적을 시험 유형·회차별로 분석하고 시각화합니다."
          />
          <Card>
            <div className="p-8 text-center text-gray-600">
              교육과정 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.
            </div>
          </Card>
        </div>
      </section>
    );
  }

  // 교과/과목 계층 구조 조회
  const subjectHierarchy = await getSubjectHierarchyOptimized(resolvedCurriculum.curriculumRevisionId);

  // 모의고사 성적 조회
  const mockScoresData = await getMockScores(currentUser.userId, tenantContext.tenantId);

  // MockScore를 MockScoreRow로 변환
  const mockScores = await transformMockScoresToRows(mockScoresData, subjectHierarchy);

  return (
    <section className={getContainerClass("DASHBOARD", "md")}>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="모의고사 성적 대시보드"
          description="모의고사 성적을 시험 유형·회차별로 분석하고 시각화합니다."
        />

        {/* 탭 네비게이션 */}
        <div className="flex flex-col gap-4">
        <ScoreTypeTabs />
        <DashboardSubTabs />
      </div>

      {mockScores.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="text-6xl">📊</div>
            <div className="flex flex-col gap-2">
              <h3 className="text-xl font-semibold text-gray-900">
                등록된 모의고사 성적이 없습니다
              </h3>
              <p className="text-sm text-gray-600">
                모의고사 성적을 등록하면 대시보드가 표시됩니다.
              </p>
            </div>
            <Link
              href="/scores/mock/1/3/평가원"
              className="inline-flex items-center justify-center rounded-lg bg-purple-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-purple-700"
            >
              모의고사 성적 입력
            </Link>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {/* 모의고사 성적 요약 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-h2 text-gray-900">모의고사 성적 요약</h2>
            <MockSummarySection mockScores={mockScores} />
          </div>

          {/* 모의고사 성적 트렌드 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-h2 text-gray-900">모의고사 성적 트렌드</h2>
            <Card>
              <MockExamTrendSection mockScores={mockScores} />
            </Card>
          </div>

          {/* 상세 지표 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-h2 text-gray-900">상세 지표</h2>
            <MockDetailedMetrics mockScores={mockScores} />
          </div>

          {/* 시험 유형별 비교 및 분포 차트 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-h2 text-gray-900">시험 유형별 비교 및 분포 분석</h2>
            <Card>
              <MockExamTypeComparisonChart mockScores={mockScores} />
            </Card>
            <Card>
              <MockPercentileDistributionChart mockScores={mockScores} />
            </Card>
          </div>

          {/* 취약 과목 분석 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-h2 text-gray-900">취약 과목 분석</h2>
            <MockWeakSubjectSection mockScores={mockScores} />
          </div>

          {/* 학습 인사이트 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-h2 text-gray-900">학습 인사이트</h2>
            <MockInsightPanel mockScores={mockScores} />
          </div>
        </div>
      )}
      </div>
    </section>
  );
}

