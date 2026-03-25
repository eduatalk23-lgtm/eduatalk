import type { DiagnosisTabData } from "@/lib/domains/student-record/types";
import { MAJOR_RECOMMENDED_COURSES } from "@/lib/domains/student-record/constants";
import { Stethoscope } from "lucide-react";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { ReportMarkdown } from "../ReportMarkdown";

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
        <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-6 text-center">
          <p className="text-sm text-gray-500">종합 진단이 아직 수행되지 않았습니다.</p>
          <p className="mt-1 text-xs text-gray-500">AI 종합 진단을 생성하면 강점/약점 분석, 추천전공, 교과이수적합도가 표시됩니다.</p>
        </div>
      ) : (
        <div className="space-y-6 pt-4">
          {/* 종합 소견 */}
          {diagnosis && (
            <div className="print-avoid-break">
              <h3 className="text-sm font-semibold text-gray-700">
                종합 소견{" "}
                <span className="font-normal text-gray-500">({source})</span>
              </h3>

              <div className="grid grid-cols-3 gap-3 pt-2 text-sm">
                <div>
                  <span className="text-xs text-gray-500">종합등급</span>
                  <p className="font-semibold">{diagnosis.overall_grade}</p>
                </div>
                {diagnosis.record_direction && (
                  <div>
                    <span className="text-xs text-gray-500">방향</span>
                    <p className="font-medium">{diagnosis.record_direction}</p>
                  </div>
                )}
                {diagnosis.direction_strength && (
                  <div>
                    <span className="text-xs text-gray-500">강도</span>
                    <p>
                      {STRENGTH_LABELS[diagnosis.direction_strength] ??
                        diagnosis.direction_strength}
                    </p>
                  </div>
                )}
              </div>

              {/* 추천 전공 */}
              {recommendedMajors.length > 0 && (
                <div className="pt-3">
                  <span className="text-xs text-gray-500">추천 전공</span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {recommendedMajors.map((m, i) => (
                      <span
                        key={i}
                        className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
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
                    <span className="text-xs text-gray-500">
                      추천 교과목 ({major})
                    </span>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      {courses.general.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-blue-600">
                            일반선택
                          </p>
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {courses.general.map((c) => (
                              <span
                                key={c}
                                className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {courses.career.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-purple-600">
                            진로선택
                          </p>
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {courses.career.map((c) => (
                              <span
                                key={c}
                                className="rounded bg-purple-50 px-1.5 py-0.5 text-[11px] text-purple-700"
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
                    <p className="text-xs font-medium text-emerald-700">강점</p>
                    <ul className="list-disc pl-4 pt-1 text-sm text-gray-700">
                      {diagnosis.strengths.map((s: string, i: number) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {diagnosis.weaknesses.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-red-600">약점</p>
                    <ul className="list-disc pl-4 pt-1 text-sm text-gray-700">
                      {diagnosis.weaknesses.map((w: string, i: number) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {diagnosis.strategy_notes && (
                <ReportMarkdown className="pt-3">{diagnosis.strategy_notes}</ReportMarkdown>
              )}
            </div>
          )}

          {/* 교과 이수 적합도 */}
          {courseAdequacy && (
            <div className="print-avoid-break">
              <h3 className="text-sm font-semibold text-gray-700">
                교과 이수 적합도
              </h3>
              <div className="flex items-center gap-4 pt-2">
                <span className={`text-2xl font-bold ${courseAdequacy.score >= 70 ? "text-emerald-600" : courseAdequacy.score >= 50 ? "text-amber-600" : "text-red-600"}`}>
                  {courseAdequacy.score}점
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{courseAdequacy.majorCategory}</span>
                    <span className="flex-1 h-2.5 overflow-hidden rounded-full bg-gray-200">
                      <span
                        className={`block h-full rounded-full transition-all ${courseAdequacy.score >= 70 ? "bg-emerald-500" : courseAdequacy.score >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${courseAdequacy.score}%` }}
                      />
                    </span>
                    <span>{courseAdequacy.score}%</span>
                  </div>
                  <div className="mt-1 flex gap-4 text-xs text-gray-500">
                    <span>일반선택 {courseAdequacy.generalRate}%</span>
                    <span>진로선택 {courseAdequacy.careerRate}%</span>
                  </div>
                </div>
              </div>

              {/* 이수율 + 과목 수 */}
              <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-gray-600">
                <p>
                  추천 과목: {courseAdequacy.totalRecommended}개 (이수 가능{" "}
                  {courseAdequacy.totalAvailable}개)
                </p>
                <p>이수 완료: {courseAdequacy.taken.length}개</p>
              </div>

              {/* 이수 과목 */}
              {courseAdequacy.taken.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-medium text-emerald-600">
                    이수 완료 ({courseAdequacy.taken.length})
                  </p>
                  <p className="text-xs text-gray-600">
                    {courseAdequacy.taken.join(", ")}
                  </p>
                </div>
              )}

              {/* 미이수 — P2-3: 수강 계획 상태 배지 */}
              {courseAdequacy.notTaken.length > 0 && (
                <div className="pt-1">
                  <p className="text-xs font-medium text-amber-600">
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
                          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs ${
                            isPlanned
                              ? "border-green-200 bg-green-50 text-green-700"
                              : "border-amber-200 bg-amber-50 text-amber-700"
                          }`}
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
                  <p className="text-xs font-medium text-gray-500">
                    학교 미개설 ({courseAdequacy.notOffered.length})
                  </p>
                  <p className="text-xs text-gray-500">
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
