import type { DiagnosisTabData } from "@/lib/domains/student-record/types";
import { MAJOR_RECOMMENDED_COURSES } from "@/lib/domains/student-record/constants";

const STRENGTH_LABELS: Record<string, string> = {
  strong: "강",
  moderate: "중",
  weak: "약",
};

interface DiagnosisSectionProps {
  diagnosisData: DiagnosisTabData;
}

export function DiagnosisSection({ diagnosisData }: DiagnosisSectionProps) {
  const { aiDiagnosis, consultantDiagnosis, courseAdequacy } = diagnosisData;

  const diagnosis = consultantDiagnosis ?? aiDiagnosis;
  const source = consultantDiagnosis ? "컨설턴트" : "AI";
  const hasData = diagnosis || courseAdequacy;

  // 추천 전공
  const recommendedMajors: string[] =
    (consultantDiagnosis?.recommended_majors ?? aiDiagnosis?.recommended_majors) || [];

  return (
    <section className="print-break-before">
      <h2 className="border-b-2 border-gray-800 pb-2 text-xl font-bold text-gray-900">
        종합 진단
      </h2>

      {!hasData ? (
        <p className="pt-4 text-sm text-gray-500">진단 데이터가 없습니다.</p>
      ) : (
        <div className="space-y-6 pt-4">
          {/* 종합 소견 */}
          {diagnosis && (
            <div className="print-avoid-break">
              <h3 className="text-sm font-semibold text-gray-700">
                종합 소견{" "}
                <span className="font-normal text-gray-400">({source})</span>
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
                          <p className="text-[10px] font-medium text-blue-600">
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
                          <p className="text-[10px] font-medium text-purple-600">
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
                <p className="whitespace-pre-wrap pt-3 text-sm leading-relaxed text-gray-600">
                  {diagnosis.strategy_notes}
                </p>
              )}
            </div>
          )}

          {/* 교과 이수 적합도 */}
          {courseAdequacy && (
            <div className="print-avoid-break">
              <h3 className="text-sm font-semibold text-gray-700">
                교과 이수 적합도
              </h3>
              <div className="flex items-center gap-3 pt-2">
                <span className="text-2xl font-bold text-gray-900">
                  {courseAdequacy.score}점
                </span>
                <span className="text-sm text-gray-500">
                  / 100 ({courseAdequacy.majorCategory})
                </span>
              </div>

              {/* 이수율 + 과목 수 */}
              <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-gray-600">
                <p>
                  일반선택 이수율:{" "}
                  {(courseAdequacy.generalRate * 100).toFixed(0)}%
                </p>
                <p>
                  진로선택 이수율:{" "}
                  {(courseAdequacy.careerRate * 100).toFixed(0)}%
                </p>
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

              {/* 미이수 */}
              {courseAdequacy.notTaken.length > 0 && (
                <div className="pt-1">
                  <p className="text-xs font-medium text-orange-600">
                    미이수 추천 과목 ({courseAdequacy.notTaken.length})
                  </p>
                  <p className="text-xs text-gray-600">
                    {courseAdequacy.notTaken.join(", ")}
                  </p>
                </div>
              )}

              {/* 학교 미개설 */}
              {courseAdequacy.notOffered.length > 0 && (
                <div className="pt-1">
                  <p className="text-xs font-medium text-gray-400">
                    학교 미개설 ({courseAdequacy.notOffered.length})
                  </p>
                  <p className="text-xs text-gray-400">
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
