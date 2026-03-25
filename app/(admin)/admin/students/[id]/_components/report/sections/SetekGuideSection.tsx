import { COMPETENCY_ITEMS } from "@/lib/domains/student-record/constants";
import { EmptyState } from "../EmptyState";
import { Compass } from "lucide-react";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { ReportMarkdown } from "../ReportMarkdown";

interface GuideItem {
  subjectName: string;
  competencyFocus?: string[];
  keywords?: string[];
  direction?: string;
  cautions?: string;
  teacherPoints?: string[];
}

interface SetekGuideSectionProps {
  guides: Array<{
    id: string;
    summary_title: string;
    summary_sections: unknown;
    status: string;
    created_at: string;
  }>;
}

function parseGuideItems(sections: unknown): GuideItem[] {
  if (!sections || typeof sections !== "object") return [];
  // summary_sections 구조: { guides: GuideItem[], overallDirection?: string }
  const obj = sections as Record<string, unknown>;
  if (Array.isArray(obj.guides)) return obj.guides as GuideItem[];
  if (Array.isArray(sections)) return sections as GuideItem[];
  return [];
}

function getCompetencyLabel(code: string): string {
  return COMPETENCY_ITEMS.find((i) => i.code === code)?.label ?? code;
}

export function SetekGuideSection({ guides }: SetekGuideSectionProps) {
  // 최신 가이드 사용 (confirmed > draft 우선, 없으면 최신 생성)
  const sorted = [...guides].sort((a, b) => {
    if (a.status === "confirmed" && b.status !== "confirmed") return -1;
    if (b.status === "confirmed" && a.status !== "confirmed") return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const latest = sorted[0];

  if (!latest) {
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

  const items = parseGuideItems(latest.summary_sections);
  const overallDirection = (latest.summary_sections as Record<string, unknown>)?.overallDirection as string | undefined;

  if (items.length === 0) return null;

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
        {items.map((item, idx) => (
          <div key={idx} className="rounded-lg border border-gray-300 p-3 shadow-sm print-avoid-break">
            {/* 과목명 + 역량 포커스 */}
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900">{item.subjectName}</h3>
              {item.competencyFocus?.map((code) => (
                <span
                  key={code}
                  className="inline-block rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
                >
                  {getCompetencyLabel(code)}
                </span>
              ))}
            </div>

            {/* 키워드 */}
            {item.keywords && item.keywords.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {item.keywords.map((kw, ki) => (
                  <span key={ki} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                    {kw}
                  </span>
                ))}
              </div>
            )}

            {/* 방향 */}
            {item.direction && (
              <ReportMarkdown className="mt-2">{item.direction}</ReportMarkdown>
            )}

            {/* 주의사항 */}
            {item.cautions && (
              <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5">
                <p className="text-xs font-semibold text-amber-700">주의사항</p>
                <p className="text-xs text-amber-800">{item.cautions}</p>
              </div>
            )}

            {/* 교사 포인트 */}
            {item.teacherPoints && item.teacherPoints.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-semibold text-gray-500">교사 포인트</p>
                <ul className="mt-0.5 list-disc pl-4">
                  {item.teacherPoints.map((tp, ti) => (
                    <li key={ti} className="text-xs text-gray-600">{tp}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
