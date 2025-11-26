import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateAllRiskIndices, saveRiskAnalysis } from "./_utils";
import { RiskIndexList } from "./_components/RiskIndexList";
import { RecalculateButton } from "./_components/RecalculateButton";

type AnalysisRow = {
  id: string;
  subject: string | null;
  risk_score: number | null;
  recent_grade_trend: number | null;
  consistency_score: number | null;
  mastery_estimate: number | null;
  updated_at: string | null;
};

export default async function AnalysisPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 저장된 분석 데이터 조회
  const selectAnalysis = () =>
    supabase
      .from("student_analysis")
      .select(
        "id,subject,risk_score,recent_grade_trend,consistency_score,mastery_estimate,updated_at"
      )
      .order("risk_score", { ascending: false });

  let { data: savedAnalyses, error } = await selectAnalysis().eq(
    "student_id",
    user.id
  );

  if (error && error.code === "42703") {
    ({ data: savedAnalyses, error } = await selectAnalysis());
  }

  // 에러가 있어도 계속 진행 (테이블이 없을 수 있음)
  if (error && error.code !== "PGRST116") {
    console.error("[analysis] 분석 데이터 조회 실패", error);
  }

  const analyses =
    (savedAnalyses as AnalysisRow[] | null) ?? [];

  // 저장된 데이터가 없으면 실시간 계산
  let riskAnalyses = analyses.map((a) => ({
    subject: a.subject ?? "",
    risk_score: a.risk_score ?? 0,
    recent_grade_trend: a.recent_grade_trend ?? 0,
    consistency_score: a.consistency_score ?? 100,
    mastery_estimate: a.mastery_estimate ?? 0,
    recent3AvgGrade: 0,
    gradeChange: 0,
    scoreVariance: 0,
    improvementRate: 0,
  }));

  if (riskAnalyses.length === 0) {
    // 실시간 계산
    try {
      const calculated = await calculateAllRiskIndices(supabase, user.id);
      riskAnalyses = calculated;
      // 백그라운드에서 저장 시도
      saveRiskAnalysis(supabase, user.id, calculated).catch(console.error);
    } catch (error) {
      console.error("[analysis] 실시간 계산 실패", error);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">취약 과목 분석</h1>
          <p className="mt-1 text-sm text-gray-500">
            성적 데이터를 기반으로 취약 과목의 Risk Index를 분석합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <RecalculateButton />
          <Link
            href="/scores"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            성적 관리
          </Link>
        </div>
      </div>

      {riskAnalyses.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-lg text-gray-500 mb-4">
            분석할 성적 데이터가 없습니다.
          </p>
          <Link
            href="/scores/dashboard"
            className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            성적 관리로 이동
          </Link>
        </div>
      ) : (
        <RiskIndexList analyses={riskAnalyses} />
      )}
    </section>
  );
}

