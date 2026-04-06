import { redirect } from "next/navigation";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { ensureStudentPrimaryCalendar } from "@/lib/domains/calendar/helpers";
import { fetchCalendarPageData } from "@/lib/domains/admin-plan/actions/calendarPageData";
import { getCampTemplatesByIds } from "@/lib/data/campTemplates";
import { EmptyState } from "@/components/molecules/EmptyState";
import { AdminPlanManagementClient } from "@/app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagementClient";
import { PlanCalendarProviders } from "@/app/(student)/plan/calendar/PlanCalendarProviders";
import { getContainerClass } from "@/lib/constants/layout";

type CampCalendarPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/** plan group이 캠프 모드인지 판정 */
function isCampGroup(g: { planType?: string | null; campTemplateId?: string | null }) {
  return g.planType === "camp" || !!g.campTemplateId;
}

/**
 * 캠프 캘린더 페이지 (Calendar-First)
 *
 * 학생 캘린더와 동일한 AdminPlanManagementClient를 사용하되,
 * 캠프 모드 플랜 그룹만 필터링하여 표시합니다.
 */
export default async function CampCalendarPage({
  searchParams,
}: CampCalendarPageProps) {
  // 1. 인증 확인
  const { userId, role } = await getCachedUserRole();
  if (!userId || role !== "student") {
    redirect("/login");
  }

  const tenantContext = await getTenantContext();
  const tenantId = tenantContext?.tenantId || "";

  // 2. searchParams 파싱
  const resolvedParams = await searchParams;
  const dateParam =
    typeof resolvedParams.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(resolvedParams.date)
      ? resolvedParams.date
      : undefined;

  // 3. Primary Calendar 확보
  let calendarId: string;
  try {
    calendarId = await ensureStudentPrimaryCalendar(userId, tenantId);
  } catch {
    return (
      <section className={getContainerClass("LIST", "md")}>
        <EmptyState
          icon="🏕️"
          title="캘린더를 불러올 수 없습니다"
          description="선생님에게 캠프 플랜을 요청해보세요."
        />
      </section>
    );
  }

  // 4. 캘린더 데이터 조회 (Calendar-First)
  const pageData = await fetchCalendarPageData(userId, calendarId, dateParam);

  // 5. 캠프 모드 플랜 그룹만 필터링
  const campGroupCandidates = pageData.allPlanGroups.filter(isCampGroup);

  // 삭제된 템플릿의 플랜 그룹 제외 (배치 1회 조회)
  const templateIds = campGroupCandidates
    .map((g) => g.campTemplateId)
    .filter((id): id is string => !!id);
  const existingTemplates = await getCampTemplatesByIds(templateIds);
  const existingTemplateIds = new Set(existingTemplates.map((t) => t.id));
  const campGroups = campGroupCandidates.filter(
    (g) => !g.campTemplateId || existingTemplateIds.has(g.campTemplateId)
  );

  if (campGroups.length === 0) {
    return (
      <section className={getContainerClass("LIST", "md")}>
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
          <div className="mx-auto flex max-w-md flex-col gap-4">
            <div className="text-6xl">🏕️</div>
            <h3 className="text-lg font-semibold text-gray-900">
              활성화된 캠프 플랜 그룹이 없습니다
            </h3>
            <p className="text-sm text-gray-500">
              캠프 프로그램에 참여하고 플랜이 생성되면 여기서 확인할 수 있습니다.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // 6. 캠프 그룹 중 active인 것 선택
  const activeCampGroupId =
    campGroups.find((g) => g.status === "active")?.id ?? campGroups[0].id;

  return (
    <div className="h-[calc(100dvh-4rem)] flex flex-col overflow-hidden">
      <PlanCalendarProviders>
        <AdminPlanManagementClient
          studentId={userId}
          studentName="캠프 캘린더"
          tenantId={tenantId}
          initialDate={pageData.targetDate}
          activePlanGroupId={activeCampGroupId}
          allPlanGroups={campGroups}
          calendarId={calendarId}
          calendarDailySchedules={pageData.calendarDailySchedules}
          calendarExclusions={pageData.calendarExclusions}
          calendarCalculatedSchedule={pageData.calendarCalculatedSchedule}
          calendarDateTimeSlots={pageData.calendarDateTimeSlots}
          viewMode="student"
          currentUserId={userId}
          selectedCalendarSettings={pageData.calendarSettings}
        />
      </PlanCalendarProviders>
    </div>
  );
}
