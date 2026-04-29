import type { DiagnosisTabData, RoadmapItem } from "@/lib/domains/student-record/types";
import { COMPETENCY_ITEMS, COMPETENCY_AREA_LABELS } from "@/lib/domains/student-record/constants";
import { PRIORITY_LABELS, STATUS_LABELS } from "../constants";
import { StrategyMatrix } from "../../student-record/shared/StrategyMatrix";
import { Target } from "lucide-react";
import { cn } from "@/lib/cn";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { SectionActionSummary } from "./SectionActionSummary";
import { BADGE, TYPO } from "@/lib/design-tokens/report";

// target_area → 관련 역량 영역 매핑
const AREA_TO_COMPETENCY_AREA: Record<string, string> = {
  setek: "academic",
  personal_setek: "academic",
  score: "academic",
  changche: "community",
  club: "community",
  autonomy: "community",
  career: "career",
  reading: "academic",
  haengteuk: "community",
  general: "academic",
};

// target_area → 관련 로드맵 영역 매핑
const AREA_TO_ROADMAP_AREA: Record<string, string[]> = {
  setek: ["setek", "personal_setek"],
  personal_setek: ["setek", "personal_setek"],
  changche: ["autonomy", "club", "career"],
  score: ["course_selection"],
  career: ["career"],
  community: ["autonomy", "volunteer"],
  reading: ["reading"],
  haengteuk: ["autonomy"],
  general: [],
};

const ROADMAP_AREA_LABELS: Record<string, string> = {
  setek: "세특",
  personal_setek: "개인세특",
  autonomy: "자율·자치",
  club: "동아리",
  career: "진로",
  reading: "독서",
  course_selection: "교과선택",
  competition: "대회",
  external: "외부활동",
  volunteer: "봉사",
  general: "기타",
};

const ROADMAP_STATUS_LABELS: Record<string, string> = {
  planning: "예정",
  confirmed: "확정",
  in_progress: "진행중",
  completed: "완료",
};

interface StrategySectionProps {
  diagnosisData: DiagnosisTabData;
  roadmapItems?: RoadmapItem[];
}

export function StrategySection({ diagnosisData, roadmapItems = [] }: StrategySectionProps) {
  const { strategies, aiDiagnosis, consultantDiagnosis } = diagnosisData;
  const diagnosis = consultantDiagnosis ?? aiDiagnosis;
  const weaknesses = (diagnosis?.weaknesses as string[]) ?? [];

  // 약점 역량 (B- 이하) 수집
  const allScores = [...diagnosisData.competencyScores.consultant, ...diagnosisData.competencyScores.ai];
  const weakCompetencies = new Map<string, { label: string; grade: string; area: string }>();
  for (const score of allScores) {
    if (["B-", "C"].includes(score.grade_value) && !weakCompetencies.has(score.competency_item)) {
      const item = COMPETENCY_ITEMS.find((i) => i.code === score.competency_item);
      if (item) {
        weakCompetencies.set(score.competency_item, {
          label: item.label,
          grade: score.grade_value,
          area: item.area,
        });
      }
    }
  }

  // 전략의 target_area와 관련된 약점 매칭
  function findRelatedWeakness(targetArea: string | null): { text: string; competency?: { label: string; grade: string } } | null {
    if (!targetArea) return null;

    // 1. target_area → 역량 영역 매칭으로 약점 역량 찾기
    const compArea = AREA_TO_COMPETENCY_AREA[targetArea];
    if (compArea) {
      for (const [, info] of weakCompetencies) {
        if (info.area === compArea) {
          return { text: "", competency: info };
        }
      }
    }

    // 2. weaknesses 텍스트에서 target_area 키워드 매칭
    const areaKeywords: Record<string, string[]> = {
      setek: ["세특", "교과", "수업"],
      changche: ["창체", "동아리", "봉사"],
      career: ["진로", "전공"],
      reading: ["독서", "독후"],
      score: ["성적", "등급", "내신"],
      haengteuk: ["행특", "행동", "태도"],
    };
    const keywords = areaKeywords[targetArea] ?? [];
    for (const w of weaknesses) {
      if (keywords.some((kw) => w.includes(kw))) {
        return { text: w };
      }
    }

    return null;
  }

  return (
    <section className="print-break-before">
      <ReportSectionHeader icon={Target} title="보완 전략" subtitle="우선순위 매트릭스 + 실행 계획" />

      {strategies.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm text-text-tertiary">보완 전략이 아직 수립되지 않았습니다.</p>
          <p className="mt-1 text-xs text-text-tertiary">종합 진단 후 AI 전략 제안을 활용하여 보완 전략을 등록하세요.</p>
        </div>
      ) : (
        <>
        {/* P1-4: 우선순위 × 영역 매트릭스 */}
        <StrategyMatrix strategies={strategies} />

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-secondary">
              <th className="px-3 py-2 text-left font-medium text-text-primary">
                우선순위
              </th>
              <th className="px-3 py-2 text-left font-medium text-text-primary">
                영역
              </th>
              <th className="px-3 py-2 text-left font-medium text-text-primary">
                내용
              </th>
              <th className="px-3 py-2 text-left font-medium text-text-primary">
                진단 근거
              </th>
              <th className="px-3 py-2 text-left font-medium text-text-primary">
                관련 액션
              </th>
              <th className="px-3 py-2 text-center font-medium text-text-primary">
                상태
              </th>
            </tr>
          </thead>
          <tbody>
            {strategies.map((s) => {
              const related = findRelatedWeakness(s.target_area);
              const relatedRoadmapAreas = AREA_TO_ROADMAP_AREA[s.target_area] ?? [];
              const relatedActions = roadmapItems.filter(
                (r) =>
                  relatedRoadmapAreas.includes(r.area) && r.status !== "completed",
              );
              return (
                <tr key={s.id} className="border-b border-border">
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                        s.priority === "critical"
                          ? "bg-red-100 text-red-700"
                          : s.priority === "high"
                            ? "bg-amber-100 text-amber-700"
                            : s.priority === "medium"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-bg-tertiary text-text-secondary"
                      }`}
                    >
                      {PRIORITY_LABELS[s.priority ?? ""] ?? "-"}
                    </span>
                  </td>
                  <td className="px-3 py-2">{s.target_area ?? "-"}</td>
                  <td className="px-3 py-2">{s.strategy_content}</td>
                  <td className="px-3 py-2">
                    {related ? (
                      <div className="space-y-0.5">
                        {related.competency && (
                          <span className="inline-block rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700">
                            {related.competency.label} {related.competency.grade}
                          </span>
                        )}
                        {related.text && (
                          <p className="text-xs leading-tight text-text-tertiary">
                            {related.text.slice(0, 60)}{related.text.length > 60 ? "…" : ""}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-text-disabled">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {relatedActions.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {relatedActions.slice(0, 2).map((r) => (
                          <span key={r.id} className="flex items-center gap-1 flex-wrap">
                            <span
                              className={cn(
                                "shrink-0 rounded px-1.5 py-0.5",
                                TYPO.label,
                                BADGE.gray,
                              )}
                            >
                              {ROADMAP_AREA_LABELS[r.area] ?? r.area}
                            </span>
                            <span className="text-xs text-[var(--text-primary)] flex-1 min-w-0">
                              {r.plan_content.slice(0, 30)}
                              {r.plan_content.length > 30 ? "…" : ""}
                            </span>
                            <span className="text-xs text-[var(--text-tertiary)] shrink-0">
                              ({ROADMAP_STATUS_LABELS[r.status] ?? r.status})
                            </span>
                          </span>
                        ))}
                        {relatedActions.length > 2 && (
                          <span className="text-xs text-[var(--text-tertiary)]">
                            +{relatedActions.length - 2}건 더
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-text-disabled">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs ${
                      s.status === "done"
                        ? "font-semibold text-green-600"
                        : s.status === "in_progress"
                          ? "text-blue-600"
                          : "text-text-tertiary"
                    }`}>
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* 가장 시급한 전략 액션 요약 */}
        {(() => {
          const urgentStrategy = strategies.find(
            (s) => (s.priority === "critical" || s.priority === "high") && s.status !== "done",
          );
          if (!urgentStrategy) return null;
          return (
            <SectionActionSummary
              actions={[
                `가장 시급한 전략: ${urgentStrategy.strategy_content}`,
              ]}
            />
          );
        })()}
        </>
      )}
    </section>
  );
}

// StrategyMatrix는 shared 컴포넌트에서 import (위 참조)
