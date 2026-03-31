import { cn } from "@/lib/cn";
import type { DiagnosisTabData } from "@/lib/domains/student-record/types";
import { MAJOR_RECOMMENDED_COURSES } from "@/lib/domains/student-record/constants";
import { Stethoscope } from "lucide-react";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { ReportMarkdown } from "../ReportMarkdown";
import { SectionActionSummary } from "./SectionActionSummary";
import { BADGE, CARD, SPACING, TYPO, PROGRESS } from "@/lib/design-tokens/report";

const STRENGTH_LABELS: Record<string, string> = {
  strong: "강",
  moderate: "중",
  weak: "약",
};

interface DiagnosisSectionProps {
  diagnosisData: DiagnosisTabData;
  /** P2-3: 수강 계획에 등록된 과목 이름 목록 */
  plannedSubjects?: string[];
}

export function DiagnosisSection({ diagnosisData, plannedSubjects = [] }: DiagnosisSectionProps) {
  const { aiDiagnosis, consultantDiagnosis, courseAdequacy } = diagnosisData;

  const diagnosis = consultantDiagnosis ?? aiDiagnosis;
  const source = consultantDiagnosis ? "컨설턴트" : "AI";
  const hasData = diagnosis || courseAdequacy;

  // 추천 전공
  const recommendedMajors: string[] =
    (consultantDiagnosis?.recommended_majors ?? aiDiagnosis?.recommended_majors) || [];

  return (
    <section className="print-break-before">
      <ReportSectionHeader icon={Stethoscope} title="종합 진단" subtitle="강점/약점 · 추천전공 · 교과이수적합도" />

      {!hasData ? (
        <div className="mt-4 rounded-lg border border-dashed border-[var(--border-secondary)] p-6 text-center">
          <p className={TYPO.body}>종합 진단이 아직 수행되지 않았습니다.</p>
          <p className={cn("mt-1", TYPO.caption)}>AI 종합 진단을 생성하면 강점/약점 분석, 추천전공, 교과이수적합도가 표시됩니다.</p>
        </div>
      ) : (
        <div className="space-y-6 pt-4">
          {/* 종합 소견 */}
          {diagnosis && (
            <div className="print-avoid-break">
              <h3 className={TYPO.subsectionTitle}>
                종합 소견{" "}
                <span className={cn("font-normal", TYPO.caption)}>({source})</span>
              </h3>

              <div className="grid grid-cols-3 gap-3 pt-2 text-sm">
                <div>
                  <span className={TYPO.caption}>종합등급</span>
                  <p className={cn("font-semibold", TYPO.body)}>{diagnosis.overall_grade}</p>
                </div>
                {diagnosis.record_direction && (
                  <div>
                    <span className={TYPO.caption}>방향</span>
                    <p className={cn("font-medium", TYPO.body)}>{diagnosis.record_direction}</p>
                  </div>
                )}
                {diagnosis.direction_strength && (
                  <div>
                    <span className={TYPO.caption}>강도</span>
                    <p className={TYPO.body}>
                      {STRENGTH_LABELS[diagnosis.direction_strength] ??
                        diagnosis.direction_strength}
                    </p>
                  </div>
                )}
              </div>

              {/* 추천 전공 */}
              {recommendedMajors.length > 0 && (
                <div className="pt-3">
                  <span className={TYPO.caption}>추천 전공</span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {recommendedMajors.map((m, i) => (
                      <span
                        key={i}
                        className={cn("rounded px-2 py-0.5", TYPO.label, BADGE.indigo)}
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 추천 교과목 (targetMajor 기반) */}
              {(() => {
                // targetMajor 또는 추천전공 첫번째에서 매칭
                const major =
                  diagnosisData.targetMajor ??
                  recommendedMajors[0] ??
                  null;
                const courses = major
                  ? MAJOR_RECOMMENDED_COURSES[major]
                  : null;
                if (!courses) return null;
                return (
                  <div className="pt-3">
                    <span className={TYPO.caption}>
                      추천 교과목 ({major})
                    </span>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      {courses.general.length > 0 && (
                        <div>
                          <p className={cn("font-medium text-blue-600 dark:text-blue-400", TYPO.caption)}>
                            일반선택
                          </p>
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {courses.general.map((c) => (
                              <span
                                key={c}
                                className={cn("rounded px-1.5 py-0.5", TYPO.label, BADGE.blue)}
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {courses.career.length > 0 && (
                        <div>
                          <p className={cn("font-medium text-violet-600 dark:text-violet-400", TYPO.caption)}>
                            진로선택
                          </p>
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {courses.career.map((c) => (
                              <span
                                key={c}
                                className={cn("rounded px-1.5 py-0.5", TYPO.label, BADGE.violet)}
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 강점 / 약점 */}
              <div className="grid grid-cols-2 gap-4 pt-3">
                {diagnosis.strengths.length > 0 && (
                  <div>
                    <p className={cn("font-medium text-emerald-700 dark:text-emerald-400", TYPO.caption)}>강점</p>
                    <ul className={cn("list-disc pl-4 pt-1", TYPO.body)}>
                      {diagnosis.strengths.map((s: string, i: number) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {diagnosis.weaknesses.length > 0 && (
                  <div>
                    <p className={cn("font-medium text-red-600 dark:text-red-400", TYPO.caption)}>약점</p>
                    <ul className={cn("list-disc pl-4 pt-1", TYPO.body)}>
                      {diagnosis.weaknesses.map((w: string, i: number) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* 개선 전략 */}
              {(() => {
                const improvements = diagnosis.improvements as Array<{ priority: string; area: string; gap: string; action: string; outcome: string }> | null;
                if (!Array.isArray(improvements) || improvements.length === 0) return null;
                return (
                  <div className="pt-3">
                    <p className={cn("font-medium text-blue-700 dark:text-blue-400", TYPO.caption)}>개선 전략</p>
                    <div className={cn(SPACING.itemGap, "pt-1")}>
                      {improvements.map((imp, i) => (
                        <div key={i} className="rounded border border-[var(--border-primary)] p-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "rounded px-1.5 py-0.5",
                              TYPO.label,
                              imp.priority === "높음" ? BADGE.red :
                              imp.priority === "중간" ? BADGE.amber :
                              BADGE.gray,
                            )}>{imp.priority}</span>
                            <span className={cn("font-medium", TYPO.body)}>{imp.area}</span>
                          </div>
                          {imp.gap && <p className={cn("mt-1", TYPO.caption)}>{imp.gap}</p>}
                          <p className={cn("mt-0.5 text-blue-700 dark:text-blue-400", TYPO.caption)}>{imp.action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {diagnosis.strategy_notes && (
                <ReportMarkdown className="pt-3">{diagnosis.strategy_notes}</ReportMarkdown>
              )}
            </div>
          )}

          {/* 다음 단계 액션 */}
          {(() => {
            const improvements = diagnosis?.improvements as Array<{ priority?: string; area?: string; gap?: string; action?: string; outcome?: string }> | null;
            const actionItems = Array.isArray(improvements) && improvements.length > 0
              ? improvements
                  .filter((i) => i.priority === "높음" || i.priority === "중간")
                  .slice(0, 3)
                  .map((i) => {
                    const base = `${i.area ? `[${i.area}] ` : ""}${i.action ?? i.gap ?? ""}`;
                    return i.outcome ? `${base} → ${i.outcome}` : base;
                  })
                  .filter(Boolean)
              : (diagnosis?.weaknesses as string[] | null ?? []).slice(0, 3).map((w) => `[약점] ${w} → 관련 활동 기록에서 구체적 개선 사례를 추가하세요`);
            return actionItems.length > 0 ? <SectionActionSummary actions={actionItems} /> : null;
          })()}

          {/* 교과 이수 적합도 */}
          {courseAdequacy && (
            <div className="print-avoid-break">
              <h3 className={TYPO.subsectionTitle}>
                교과 이수 적합도
              </h3>
              <div className="flex items-center gap-4 pt-2">
                <span className={`text-2xl font-bold ${courseAdequacy.score >= 70 ? "text-emerald-600 dark:text-emerald-400" : courseAdequacy.score >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                  {courseAdequacy.score}점
                </span>
                <div className="flex-1">
                  <div className={cn("flex items-center gap-2", TYPO.caption)}>
                    <span>{courseAdequacy.majorCategory}</span>
                    <span className="flex-1 h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <span
                        className={`block h-full rounded-full transition-all ${courseAdequacy.score >= 70 ? "bg-emerald-500 dark:bg-emerald-400" : courseAdequacy.score >= 50 ? "bg-amber-500 dark:bg-amber-400" : "bg-red-500 dark:bg-red-400"}`}
                        style={{ width: `${courseAdequacy.score}%` }}
                      />
                    </span>
                    <span>{courseAdequacy.score}%</span>
                  </div>
                  <div className={cn("mt-1 flex gap-4", TYPO.caption)}>
                    <span>일반선택 {courseAdequacy.generalRate}%</span>
                    <span>진로선택 {courseAdequacy.careerRate}%</span>
                  </div>
                </div>
              </div>

              {/* 이수율 + 과목 수 */}
              <div className={cn("grid grid-cols-2 gap-3 pt-2", TYPO.caption)}>
                <p>
                  추천 과목: {courseAdequacy.totalRecommended}개 (이수 가능{" "}
                  {courseAdequacy.totalAvailable}개)
                </p>
                <p>이수 완료: {courseAdequacy.taken.length}개</p>
              </div>

              {/* 이수 과목 */}
              {courseAdequacy.taken.length > 0 && (
                <div className="pt-2">
                  <p className={cn("font-medium text-emerald-600 dark:text-emerald-400", TYPO.caption)}>
                    이수 완료 ({courseAdequacy.taken.length})
                  </p>
                  <p className={TYPO.caption}>
                    {courseAdequacy.taken.join(", ")}
                  </p>
                </div>
              )}

              {/* 미이수 — P2-3: 수강 계획 상태 배지 */}
              {courseAdequacy.notTaken.length > 0 && (
                <div className="pt-1">
                  <p className={cn("font-medium text-amber-600 dark:text-amber-400", TYPO.caption)}>
                    미이수 추천 과목 ({courseAdequacy.notTaken.length})
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {courseAdequacy.notTaken.map((subj) => {
                      const isPlanned = plannedSubjects.some((p) =>
                        p === subj || p.includes(subj) || subj.includes(p),
                      );
                      return (
                        <span
                          key={subj}
                          className={cn(
                            "inline-flex items-center gap-1 rounded border px-1.5 py-0.5",
                            TYPO.label,
                            isPlanned
                              ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/20 dark:text-green-400"
                              : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-400",
                          )}
                        >
                          {subj}
                          <span className="font-semibold">
                            {isPlanned ? "✓ 수강 예정" : "미계획"}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 학교 미개설 */}
              {courseAdequacy.notOffered.length > 0 && (
                <div className="pt-1">
                  <p className={cn("font-medium", TYPO.caption)}>
                    학교 미개설 ({courseAdequacy.notOffered.length})
                  </p>
                  <p className={TYPO.caption}>
                    {courseAdequacy.notOffered.join(", ")}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
