import { useMemo } from "react";
import type {
  DiagnosisTabData,
  ActivityTag,
} from "@/lib/domains/student-record/types";
import {
  COMPETENCY_ITEMS,
  COMPETENCY_AREA_LABELS,
  COMPETENCY_RUBRIC_QUESTIONS,
} from "@/lib/domains/student-record/constants";
import type { CompetencyItemCode } from "@/lib/domains/student-record/types";
import { aggregateTagsByQuestion } from "@/lib/domains/student-record/rubric-matcher";

interface CompetencySectionProps {
  diagnosisData: DiagnosisTabData;
}

export function CompetencySection({ diagnosisData }: CompetencySectionProps) {
  const { competencyScores, activityTags } = diagnosisData;
  const aiScores = competencyScores.ai;
  const consultantScores = competencyScores.consultant;

  // 점수 + narrative 매핑
  const aiMap = useMemo(
    () => new Map(aiScores.map((s) => [s.competency_item, s])),
    [aiScores],
  );
  const consultantMap = useMemo(
    () => new Map(consultantScores.map((s) => [s.competency_item, s])),
    [consultantScores],
  );

  // 역량별 활동태그 집계 + evidence_summary 수집
  const tagsByItem = useMemo(() => {
    const map = new Map<
      string,
      { positive: number; negative: number; evidences: string[] }
    >();
    for (const tag of activityTags) {
      const entry = map.get(tag.competency_item) ?? {
        positive: 0,
        negative: 0,
        evidences: [],
      };
      if (tag.evaluation === "positive") entry.positive++;
      else if (tag.evaluation === "negative") entry.negative++;
      if (tag.evidence_summary) entry.evidences.push(tag.evidence_summary);
      map.set(tag.competency_item, entry);
    }
    return map;
  }, [activityTags]);

  const hasAnyData = aiScores.length > 0 || consultantScores.length > 0;
  const areas = ["academic", "career", "community"] as const;

  return (
    <section className="print-break-before">
      <h2 className="border-b-2 border-gray-800 pb-2 text-xl font-bold text-gray-900">
        정성 평가 (역량 분석)
      </h2>

      {!hasAnyData ? (
        <p className="pt-4 text-sm text-gray-500">
          역량 평가 데이터가 없습니다.
        </p>
      ) : (
        <div className="space-y-6 pt-4">
          {/* 등급 요약 테이블 */}
          <div className="print-avoid-break">
            <h3 className="text-sm font-semibold text-gray-800">
              10항목 등급 요약
            </h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-300 bg-gray-50">
                  <th className="px-3 py-1.5 text-left font-medium text-gray-700">
                    영역
                  </th>
                  <th className="px-3 py-1.5 text-left font-medium text-gray-700">
                    항목
                  </th>
                  <th className="w-16 px-2 py-1.5 text-center font-medium text-gray-700">
                    AI
                  </th>
                  <th className="w-16 px-2 py-1.5 text-center font-medium text-gray-700">
                    컨설턴트
                  </th>
                  <th className="w-20 px-2 py-1.5 text-center font-medium text-gray-700">
                    근거
                  </th>
                </tr>
              </thead>
              <tbody>
                {areas.map((area) => {
                  const items = COMPETENCY_ITEMS.filter(
                    (i) => i.area === area,
                  );
                  return items.map((item, idx) => {
                    const ai = aiMap.get(item.code);
                    const consultant = consultantMap.get(item.code);
                    const tagInfo = tagsByItem.get(item.code);
                    const hasEvidence =
                      (tagInfo?.positive ?? 0) > 0 ||
                      (tagInfo?.negative ?? 0) > 0;

                    return (
                      <tr
                        key={item.code}
                        className={
                          idx === items.length - 1
                            ? "border-b border-gray-300"
                            : "border-b border-gray-100"
                        }
                      >
                        {idx === 0 && (
                          <td
                            rowSpan={items.length}
                            className="px-3 py-1.5 align-top text-xs font-semibold text-gray-800"
                          >
                            {COMPETENCY_AREA_LABELS[area]}
                          </td>
                        )}
                        <td className="px-3 py-1.5 text-xs">{item.label}</td>
                        <td className="px-2 py-1.5 text-center">
                          <GradeBadge grade={ai?.grade_value} />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <GradeBadge grade={consultant?.grade_value} />
                        </td>
                        <td className="px-2 py-1.5 text-center text-xs">
                          {hasEvidence ? (
                            <span>
                              <span className="text-emerald-600">
                                +{tagInfo!.positive}
                              </span>
                              {tagInfo!.negative > 0 && (
                                <span className="text-red-500">
                                  {" "}
                                  -{tagInfo!.negative}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>

          {/* 항목별 상세: narrative + 루브릭 질문별 분석 그리드 */}
          {areas.map((area) => {
            const items = COMPETENCY_ITEMS.filter((i) => i.area === area);
            return (
              <div key={area} className="print-break-before">
                <h3 className="border-b border-gray-200 pb-1 text-sm font-semibold text-gray-800">
                  {COMPETENCY_AREA_LABELS[area]} 상세
                </h3>

                {items.map((item) => {
                  const ai = aiMap.get(item.code);
                  const consultant = consultantMap.get(item.code);
                  const grade = consultant?.grade_value ?? ai?.grade_value;
                  const narrative =
                    consultant?.narrative ?? ai?.narrative ?? null;

                  // 질문별 태그 집계
                  const qStats = aggregateTagsByQuestion(
                    item.code,
                    activityTags,
                  );
                  const hasAnyStats = qStats.some(
                    (s) => s.positive > 0 || s.negative > 0 || s.needsReview > 0,
                  );

                  if (!grade && !narrative && qStats.length === 0) return null;

                  return (
                    <div
                      key={item.code}
                      className="border-b border-gray-100 py-3 print-avoid-break"
                    >
                      {/* 항목명 + 등급 */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {item.label}
                        </span>
                        {grade && (
                          <span className="text-sm">
                            <GradeBadge grade={grade} />
                          </span>
                        )}
                      </div>

                      {/* narrative 해석 서술 */}
                      {narrative && (
                        <p className="pt-1 text-xs leading-relaxed text-gray-700">
                          {narrative}
                        </p>
                      )}

                      {/* 루브릭 질문별 분석 그리드 (Sheet 4 대응) */}
                      {qStats.length > 0 && (
                        <table className="w-full border-collapse pt-2 text-[11px]">
                          <thead>
                            <tr className="border-b border-gray-200 bg-gray-50">
                              <th className="px-2 py-1 text-left font-medium text-gray-500">
                                평가 기준
                              </th>
                              <th className="w-10 px-1 py-1 text-center font-medium text-emerald-600">
                                +
                              </th>
                              <th className="w-10 px-1 py-1 text-center font-medium text-red-500">
                                -
                              </th>
                              {hasAnyStats && (
                                <th className="px-2 py-1 text-left font-medium text-gray-500">
                                  근거
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {qStats.map((stat) => (
                              <tr
                                key={stat.questionIndex}
                                className="border-b border-gray-50"
                              >
                                <td className="px-2 py-1 leading-snug text-gray-600">
                                  {stat.questionText}
                                </td>
                                <td className="px-1 py-1 text-center">
                                  {stat.positive > 0 ? (
                                    <span className="text-emerald-600">
                                      {stat.positive}
                                    </span>
                                  ) : (
                                    <span className="text-gray-200">-</span>
                                  )}
                                </td>
                                <td className="px-1 py-1 text-center">
                                  {stat.negative > 0 ? (
                                    <span className="text-red-500">
                                      {stat.negative}
                                    </span>
                                  ) : (
                                    <span className="text-gray-200">-</span>
                                  )}
                                </td>
                                {hasAnyStats && (
                                  <td className="px-2 py-1 text-gray-500">
                                    {stat.evidences.length > 0
                                      ? stat.evidences[0].split("\n")[0].slice(0, 60) +
                                        (stat.evidences[0].length > 60 ? "…" : "")
                                      : ""}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function GradeBadge({ grade }: { grade?: string | null }) {
  if (!grade) return <span className="text-gray-300">-</span>;

  const colorMap: Record<string, string> = {
    "A+": "text-emerald-700 font-bold",
    "A-": "text-emerald-600 font-semibold",
    "B+": "text-blue-700 font-semibold",
    B: "text-blue-600",
    "B-": "text-blue-500",
    C: "text-orange-600",
  };

  return (
    <span className={colorMap[grade] ?? "text-gray-700"}>{grade}</span>
  );
}
