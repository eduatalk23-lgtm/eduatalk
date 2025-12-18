export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { getStudentDivisionStats, getStudentsByDivision } from "@/lib/data/students";
import { PageHeader } from "@/components/layout/PageHeader";
import { DivisionStatsCards } from "./_components/DivisionStatsCards";
import { DivisionManagementPageClient } from "./_components/DivisionManagementPageClient";
import type { StudentDivision } from "@/lib/constants/students";

export default async function StudentDivisionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  const params = await searchParams;
  const divisionFilterParam = params.division;
  const searchQuery = params.search?.trim() ?? "";

  // division 필터 파싱
  let divisionFilter: StudentDivision | null | "all" = "all";
  if (divisionFilterParam === "null" || divisionFilterParam === "") {
    divisionFilter = null;
  } else if (divisionFilterParam && divisionFilterParam !== "all") {
    divisionFilter = divisionFilterParam as StudentDivision;
  }

  // 통계 조회
  const stats = await getStudentDivisionStats();
  const total = stats.reduce((sum, stat) => sum + stat.count, 0);

  // 학생 목록 조회
  const students = await getStudentsByDivision(
    divisionFilter === "all" ? null : divisionFilter
  );

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="학생 구분 관리"
          description="학생 구분을 관리하고 일괄 변경할 수 있습니다."
        />

        {/* 통계 카드 */}
        <DivisionStatsCards
          stats={stats}
          total={total}
          selectedDivision={divisionFilter === "all" ? undefined : divisionFilter}
        />

        {/* 필터 및 학생 목록 (클라이언트 컴포넌트) */}
        <DivisionManagementPageClient
          students={students}
          stats={stats}
          total={total}
          initialDivisionFilter={divisionFilter}
          initialSearchQuery={searchQuery}
        />
      </div>
    </div>
  );
}

