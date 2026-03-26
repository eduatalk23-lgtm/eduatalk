import { COMPETENCY_ITEMS } from "@/lib/domains/student-record/constants";
import { EmptyState } from "../EmptyState";
import { Compass } from "lucide-react";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { ReportMarkdown } from "../ReportMarkdown";

interface SetekGuideSectionProps {
  guides: Array<{
    id: string;
    subject_id: string;
    source: string;
    status: string;
    direction: string;
    keywords: string[];
    overall_direction: string | null;
    created_at: string;
  }>;
}

function getCompetencyLabel(code: string): string {
  return COMPETENCY_ITEMS.find((i) => i.code === code)?.label ?? code;
}

export function SetekGuideSection({ guides }: SetekGuideSectionProps) {
  if (!guides || guides.length === 0) {
    return (
      <section className="print-break-before">
        <ReportSectionHeader icon={Compass} title="세특 방향 가이드" subtitle="과목별 방향 · 교사 포인트" />
        <EmptyState
          title="세특 방향 가이드가 아직 생성되지 않았습니다."
          description="AI 초기 분석 파이프라인을 실행하면 과목별 방향 가이드가 자동 생성됩니다."
        />
      </section>
    );
  }

  // overall_direction은 첫 번째 행에만 있음
  const overallDirection = guides.find((g) => g.overall_direction)?.overall_direction;

  return (
    <section className="print-break-before">
      <ReportSectionHeader icon={Compass} title="세특 방향 가이드" subtitle="과목별 방향 · 교사 포인트" />

      {/* 전체 방향 */}
      {overallDirection && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
          <p className="text-xs font-semibold text-indigo-700">전체 방향</p>
          <p className="mt-1 text-sm leading-relaxed text-violet-900">{overallDirection}</p>
        </div>
      )}

      {/* 과목별 카드 */}
      <div className="space-y-3">
        {guides.map((guide) => (
          <div key={guide.id} className="rounded-lg border border-gray-300 p-3 shadow-sm print-avoid-break">
            {/* 과목 ID + 상태 */}
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900">{guide.subject_id}</h3>
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                {guide.source === "ai" ? "🤖AI" : "👤수동"}
              </span>
            </div>

            {/* 키워드 */}
            {guide.keywords.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {guide.keywords.map((kw, ki) => (
                  <span key={ki} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                    {kw}
                  </span>
                ))}
              </div>
            )}

            {/* 방향 */}
            <ReportMarkdown className="mt-2">{guide.direction}</ReportMarkdown>
          </div>
        ))}
      </div>
    </section>
  );
}
