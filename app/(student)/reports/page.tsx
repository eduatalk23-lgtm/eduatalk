import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { collectReportData } from "./_utils";
import { ReportView } from "./_components/ReportView";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const period = (params.period === "monthly" ? "monthly" : "weekly") as "weekly" | "monthly";

  // 리포트 데이터 수집
  const reportData = await collectReportData(supabase, user.id, period);

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold text-gray-900">학습 리포트</h1>
          <p className="text-sm text-gray-500">
            주간/월간 학습 성과를 요약한 리포트를 한눈에 확인할 수 있습니다.
          </p>
        </div>

        {/* 탭 */}
        <div className="flex gap-2 border-b border-gray-200">
          <Link
            href="/reports?period=weekly"
            className={`rounded-t border px-4 py-2 text-sm font-medium transition ${
              period === "weekly"
                ? "border-b-white border-gray-300 bg-white text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            주간 리포트
          </Link>
          <Link
            href="/reports?period=monthly"
            className={`rounded-t border px-4 py-2 text-sm font-medium transition ${
              period === "monthly"
                ? "border-b-white border-gray-300 bg-white text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            월간 리포트
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href={period === "weekly" ? "/report/weekly" : "/report/monthly"}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              상세 리포트 보기 →
            </Link>
          </div>
        </div>

        <ReportView data={reportData} />
      </div>
    </section>
  );
}

