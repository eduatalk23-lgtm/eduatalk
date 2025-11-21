export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getLinkedStudents, canAccessStudent } from "../../_utils";
import { fetchAllScores, calculateSubjectGradeHistory } from "@/app/(student)/scores/dashboard/_utils";
import { StudentSelector } from "../_components/StudentSelector";
import Link from "next/link";

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function ParentScoresPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { userId, role } = await getCurrentUserRole();

  if (!userId || role !== "parent") {
    redirect("/login");
  }

  // 연결된 학생 목록 조회
  const linkedStudents = await getLinkedStudents(supabase, userId);

  if (linkedStudents.length === 0) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-8 text-center">
          <h2 className="text-xl font-semibold text-yellow-900 mb-2">
            연결된 자녀가 없습니다
          </h2>
        </div>
      </section>
    );
  }

  // 선택된 학생 ID
  const selectedStudentId =
    params.studentId || linkedStudents[0]?.id || null;

  if (!selectedStudentId) {
    redirect("/parent/scores");
  }

  // 접근 권한 확인
  const hasAccess = await canAccessStudent(
    supabase,
    userId,
    selectedStudentId
  );

  if (!hasAccess) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <h2 className="text-xl font-semibold text-red-900 mb-2">
            접근 권한이 없습니다
          </h2>
        </div>
      </section>
    );
  }

  // 학생 정보 조회
  const { data: student } = await supabase
    .from("students")
    .select("id, name, grade, class")
    .eq("id", selectedStudentId)
    .maybeSingle();

  // 성적 조회
  const allScores = await fetchAllScores(supabase, selectedStudentId);
  const subjectHistories = calculateSubjectGradeHistory(allScores);

  // 최근 성적 (최근 10개)
  const recentScores = allScores
    .filter((s) => s.grade !== null)
    .sort((a, b) => {
      const dateA = a.test_date ? new Date(a.test_date).getTime() : 0;
      const dateB = b.test_date ? new Date(b.test_date).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 10);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">성적 현황</h1>
          <p className="mt-1 text-sm text-gray-500">
            자녀의 내신 및 모의고사 성적을 확인하세요
          </p>
        </div>
        <Link
          href="/parent/dashboard"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          대시보드로 돌아가기
        </Link>
      </div>

      {/* 학생 선택 */}
      <div className="mb-6">
        <StudentSelector
          students={linkedStudents}
          selectedStudentId={selectedStudentId}
        />
      </div>

      {allScores.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">등록된 성적이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 최근 성적 변화 */}
          {recentScores.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                최근 성적 변화
              </h2>
              <div className="space-y-3">
                {recentScores.map((score, index) => {
                  const prevScore =
                    index < recentScores.length - 1
                      ? recentScores[index + 1]
                      : null;
                  const gradeChange =
                    prevScore &&
                    score.grade !== null &&
                    prevScore.grade !== null
                      ? score.grade - prevScore.grade
                      : null;

                  return (
                    <div
                      key={score.id}
                      className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-4"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base font-semibold text-gray-900">
                            {score.course_detail || score.course || "과목"}
                          </span>
                          {score.test_date && (
                            <span className="text-xs text-gray-500">
                              ({new Date(score.test_date).toLocaleDateString("ko-KR")})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {score.semester && <span>{score.semester}</span>}
                          {score.score_type_detail && (
                            <span>• {score.score_type_detail}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {score.grade !== null && (
                          <span className="text-xl font-bold text-indigo-600">
                            {score.grade}등급
                          </span>
                        )}
                        {gradeChange !== null && gradeChange !== 0 && (
                          <span
                            className={`text-sm font-semibold ${
                              gradeChange < 0
                                ? "text-green-600"
                                : gradeChange > 0
                                ? "text-red-600"
                                : "text-gray-600"
                            }`}
                          >
                            {gradeChange < 0 ? "↑" : "↓"} {Math.abs(gradeChange)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 과목별 등급 변화 그래프 */}
          {subjectHistories.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                과목별 등급 변화
              </h2>
              <div className="space-y-4">
                {subjectHistories.map((history) => (
                  <div key={`${history.course}:${history.course_detail}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-base font-semibold text-gray-900">
                        {history.course_detail} ({history.course})
                      </span>
                      {history.history.length > 0 && (
                        <span className="text-sm text-gray-600">
                          최신: {history.history[history.history.length - 1].grade}등급
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {history.history.map((h, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col items-center rounded border border-gray-200 bg-gray-50 px-3 py-2"
                        >
                          <span className="text-xs text-gray-500 mb-1">
                            {new Date(h.test_date).toLocaleDateString("ko-KR", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span className="text-lg font-bold text-indigo-600">
                            {h.grade}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 성적 요약 텍스트 */}
          {allScores.length > 0 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
              <h3 className="text-base font-semibold text-blue-900 mb-2">
                성적 요약
              </h3>
              <p className="text-sm text-blue-700">
                총 {allScores.length}개의 성적이 등록되어 있습니다. 최근 성적 변화를
                확인하여 학습 계획을 조정하시기 바랍니다.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

