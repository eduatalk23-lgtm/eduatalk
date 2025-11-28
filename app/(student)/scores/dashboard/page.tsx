/**
 * @deprecated 이 페이지는 레거시 성적 대시보드입니다.
 * 새로운 통합 성적 대시보드(/scores/dashboard/unified)로 리다이렉트됩니다.
 * 
 * 레거시 컴포넌트들:
 * - SummarySection, SemesterChartsSection, SubjectTrendSection
 * - MockExamTrendSection, CompareSection, WeakSubjectSection
 * - InsightPanel, IntegratedComparisonChart, ScoreConsistencyAnalysis
 * 
 * 새로운 대시보드는 /api/students/[id]/score-dashboard API를 사용합니다.
 * 자세한 내용은 docs/score-dashboard-frontend-implementation.md를 참조하세요.
 */
import { redirect } from "next/navigation";

export default async function ScoresDashboardPage() {
  // 통합 성적 대시보드로 리다이렉트
  redirect("/scores/dashboard/unified");
}
