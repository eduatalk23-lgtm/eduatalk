import { EmptyState } from "../EmptyState";
import { FileText } from "lucide-react";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { ReportMarkdown } from "../ReportMarkdown";

interface ActivitySummarySection {
  sectionType: string;
  title: string;
  content: string;
  relatedSubjects?: string[];
}

const SECTION_LABELS: Record<string, { label: string; icon: string }> = {
  intro: { label: "총평", icon: "📋" },
  subject_setek: { label: "교과 세특", icon: "📚" },
  personal_setek: { label: "개인 세특", icon: "🔬" },
  changche: { label: "창의적 체험활동", icon: "🎯" },
  reading: { label: "독서 활동", icon: "📖" },
  haengteuk: { label: "행동특성 및 종합의견", icon: "💡" },
  growth: { label: "성장 종합", icon: "📈" },
};

interface ActivitySummaryReportSectionProps {
  summaries: Array<{
    id: string;
    summary_title: string;
    summary_sections: unknown;
    summary_text: string;
    status: string;
    target_grades: number[];
    edited_text: string | null;
    created_at: string;
  }>;
}

function parseSections(raw: unknown): ActivitySummarySection[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is ActivitySummarySection =>
      !!s && typeof s === "object" && "sectionType" in s && "content" in s,
  );
}

export function ActivitySummaryReportSection({ summaries }: ActivitySummaryReportSectionProps) {
  // 최신 confirmed > draft 우선
  const sorted = [...summaries].sort((a, b) => {
    if (a.status === "confirmed" && b.status !== "confirmed") return -1;
    if (b.status === "confirmed" && a.status !== "confirmed") return 1;
    if (a.status === "published" && b.status === "draft") return -1;
    if (b.status === "published" && a.status === "draft") return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const latest = sorted[0];

  if (!latest) {
    return (
      <section className="print-break-before">
        <ReportSectionHeader icon={FileText} title="활동 요약서" subtitle="7개 영역 AI 서술 요약" />
        <EmptyState
          title="활동 요약서가 아직 생성되지 않았습니다."
          description="AI 초기 분석 파이프라인을 실행하면 7개 영역의 활동 요약서가 자동 생성됩니다."
        />
      </section>
    );
  }

  // 컨설턴트 수정본이 있으면 단일 텍스트 사용
  if (latest.edited_text) {
    return (
      <section className="print-break-before">
        <ReportSectionHeader icon={FileText} title="활동 요약서" subtitle="7개 영역 AI 서술 요약" />
        <ReportMarkdown>{latest.edited_text}</ReportMarkdown>
      </section>
    );
  }

  // 7개 섹션 파싱
  const sections = parseSections(latest.summary_sections);
  if (sections.length === 0 && latest.summary_text) {
    return (
      <section className="print-break-before">
        <ReportSectionHeader icon={FileText} title="활동 요약서" subtitle="7개 영역 AI 서술 요약" />
        <ReportMarkdown>{latest.summary_text}</ReportMarkdown>
      </section>
    );
  }

  return (
    <section className="print-break-before">
      <ReportSectionHeader icon={FileText} title="활동 요약서" subtitle="7개 영역 AI 서술 요약" />
      {latest.target_grades.length > 0 && (
        <div className="-mt-4 mb-4">
          <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
            {latest.target_grades.sort().map((g) => `${g}학년`).join(" · ")}
          </span>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {sections.map((sec, idx) => {
          const meta = SECTION_LABELS[sec.sectionType] ?? { label: sec.title, icon: "📄" };
          return (
            <div key={idx} className="print-avoid-break">
              <div className="flex items-center gap-2">
                <span className="text-sm">{meta.icon}</span>
                <h3 className="text-sm font-semibold text-text-primary">
                  {sec.title || meta.label}
                </h3>
              </div>
              {sec.relatedSubjects && sec.relatedSubjects.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {sec.relatedSubjects.map((subj, si) => (
                    <span key={si} className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700">
                      {subj}
                    </span>
                  ))}
                </div>
              )}
              <ReportMarkdown className="mt-1">{sec.content}</ReportMarkdown>
            </div>
          );
        })}
      </div>
    </section>
  );
}
