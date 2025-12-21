export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getPlanGroupsForStudent,
  getPlanExclusions,
  getAcademySchedules,
} from "@/lib/data/planGroups";
import { getPlansForStudent } from "@/lib/data/studentPlans";
import { PlanCalendarView } from "./_components/PlanCalendarView";
import type { PlanExclusion, AcademySchedule } from "@/lib/types/plan";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import { formatDateString } from "@/lib/date/calendarUtils";
import { getContainerClass } from "@/lib/constants/layout";
import { enrichPlansWithContentInfo } from "@/lib/utils/calendarPageHelpers";

type PlanCalendarPageProps = {
  searchParams: Promise<{ view?: string; date?: string }>;
};

export default async function PlanCalendarPage({
  searchParams,
}: PlanCalendarPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const view =
    params.view === "week" ? "week" : params.view === "day" ? "day" : "month";

  // 테넌트 컨텍스트 조회
  const tenantContext = await requireTenantContext();

  try {
    // 활성화된 플랜 그룹 조회
    const allActivePlanGroups = await getPlanGroupsForStudent({
      studentId: user.id,
      status: "active",
    });

    // 캠프 템플릿 플랜 제외 (캠프 관련 플랜은 /camp 경로에서만 확인)
    // /today와 동일한 필터링 로직 적용: plan_type이 "camp"가 아니고, camp_template_id와 camp_invitation_id가 null인 경우만
    const activePlanGroups = allActivePlanGroups.filter(
      (group) =>
        group.plan_type !== "camp" &&
        group.camp_template_id === null &&
        group.camp_invitation_id === null
    );

    if (activePlanGroups.length === 0) {
      return (
        <section className={getContainerClass("DASHBOARD", "md")}>
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
            <div className="mx-auto flex max-w-md flex-col gap-4">
              <div className="text-6xl">📅</div>
              <h3 className="text-lg font-semibold text-gray-900">
                활성화된 플랜 그룹이 없습니다
              </h3>
              <p className="text-sm text-gray-500">
                플랜 그룹을 생성하고 활성화해주세요.
              </p>
            </div>
          </div>
        </section>
      );
    }

    // 활성 플랜 그룹의 기간 범위 계산
    // period_start와 period_end를 문자열로 변환 (YYYY-MM-DD 형식)
    const dateRanges = activePlanGroups.map((group) => {
      // Date 객체이면 문자열로 변환, 문자열이면 그대로 사용
      const startStr =
        typeof group.period_start === "string"
          ? group.period_start.slice(0, 10)
          : group.period_start
          ? String(group.period_start).slice(0, 10)
          : "";

      const endStr =
        typeof group.period_end === "string"
          ? group.period_end.slice(0, 10)
          : group.period_end
          ? String(group.period_end).slice(0, 10)
          : "";

      return {
        start: startStr,
        end: endStr,
      };
    });

    // 날짜 범위가 유효한지 확인하고 최소/최대 날짜 계산
    const validRanges = dateRanges.filter(
      (range) => range.start && range.end && range.start <= range.end
    );

    if (validRanges.length === 0) {
      // 잘못된 날짜 범위가 있는 경우 처리
      console.error("[calendar] 잘못된 날짜 범위를 가진 플랜 그룹이 있습니다.");
      // 유효하지 않은 범위가 있어도 빈 범위로 진행 (에러 UI는 catch에서 처리)
    }

    const today = formatDateString(new Date());
    
    // 날짜 비교를 위해 문자열로 변환된 날짜들만 사용
    const minDate =
      validRanges.length > 0
        ? validRanges
            .map((range) => range.start)
            .filter((date): date is string => typeof date === "string" && date.length === 10)
            .sort()[0] || today
        : today;
    
    const maxDate =
      validRanges.length > 0
        ? validRanges
            .map((range) => range.end)
            .filter((date): date is string => typeof date === "string" && date.length === 10)
            .sort((a, b) => b.localeCompare(a))[0] || today
        : today;
    
    // 최종적으로 문자열로 변환 보장
    const minDateStr = typeof minDate === "string" ? minDate : formatDateString(new Date(minDate));
    const maxDateStr = typeof maxDate === "string" ? maxDate : formatDateString(new Date(maxDate));

    // 활성 플랜 그룹 ID 목록
    const activeGroupIds = activePlanGroups.map((g) => g.id);

    // 활성 플랜 그룹에 속한 플랜만 조회 (데이터베이스 레벨 필터링)
    // 날짜 형식이 문자열(YYYY-MM-DD)임을 보장
    const filteredPlans = await getPlansForStudent({
      studentId: user.id,
      dateRange: {
        start: minDateStr,
        end: maxDateStr,
      },
      planGroupIds: activeGroupIds, // 데이터베이스 레벨에서 필터링
    });

    // 플랜 그룹 불일치 확인
    const planGroupIdsInPlans = [...new Set(filteredPlans.map((p) => p.plan_group_id).filter(Boolean))];
    const unmatchedGroupIds = planGroupIdsInPlans.filter((id): id is string => id != null && !activeGroupIds.includes(id));
    const hasUnmatchedPlans = unmatchedGroupIds.length > 0 || filteredPlans.some((p) => !p.plan_group_id);

    // 플랜에 콘텐츠 정보 추가 (공통 함수 사용)
    const plansWithContent = await enrichPlansWithContentInfo(
      filteredPlans,
      supabase,
      user.id,
      "[calendar]"
    );

    // 첫 플랜 날짜 계산 (플랜이 있으면 첫 플랜 날짜, 없으면 오늘 날짜)
    const firstPlanDate =
      plansWithContent.length > 0
        ? plansWithContent
            .map((plan) => plan.plan_date)
            .filter((date): date is string => date !== null)
            .sort()[0] || formatDateString(new Date())
        : new Date().toISOString().slice(0, 10);

    // 제외일 조회 (플랜 그룹별 관리)
    // 활성 플랜 그룹들의 제외일 조회 후 병합
    const exclusionsPromises = activePlanGroups.map((group) =>
      getPlanExclusions(group.id, tenantContext.tenantId)
    );
    const exclusionsArrays = await Promise.all(exclusionsPromises);
    
    // 중복 제거: exclusion_date:exclusion_type 조합이 같은 것은 하나만 표시
    const exclusionsMap = new Map();
    for (const exclusions of exclusionsArrays) {
      for (const exclusion of exclusions) {
        const key = `${exclusion.exclusion_date}:${exclusion.exclusion_type}`;
        if (!exclusionsMap.has(key)) {
          exclusionsMap.set(key, exclusion);
        }
      }
    }
    const exclusions = Array.from(exclusionsMap.values());

    // 학원일정 조회 (플랜 그룹별 관리)
    // Phase 2: 활성 플랜 그룹들의 학원 일정 조회 후 병합
    const academySchedulesPromises = activePlanGroups.map((group) =>
      getAcademySchedules(group.id, tenantContext.tenantId)
    );
    const academySchedulesArrays = await Promise.all(academySchedulesPromises);
    
    // 중복 제거: day_of_week:start_time:end_time 조합이 같은 것은 하나만 표시
    const academySchedulesMap = new Map();
    for (const schedules of academySchedulesArrays) {
      for (const schedule of schedules) {
        const key = `${schedule.day_of_week}:${schedule.start_time}:${schedule.end_time}`;
        if (!academySchedulesMap.has(key)) {
          academySchedulesMap.set(key, schedule);
        }
      }
    }
    const academySchedules = Array.from(academySchedulesMap.values());

    // 플랜 그룹의 daily_schedule에서 날짜별 일정 타입 정보 추출
    // Step7에서 생성된 정보를 그대로 사용 (재계산 불필요)
    const dailySchedules = activePlanGroups
      .map((group) => group.daily_schedule)
      .filter((schedule): schedule is NonNullable<typeof schedule> => 
        schedule !== null && schedule !== undefined && Array.isArray(schedule)
      );

    // 통계 계산
    const totalPlans = plansWithContent.length;
    const completedPlans = plansWithContent.filter((p) => p.progress != null && p.progress >= 100).length;
    const activePlans = plansWithContent.filter((p) => p.actual_start_time && !p.actual_end_time).length;
    const averageProgress = totalPlans > 0
      ? Math.round(
          plansWithContent.reduce((sum, p) => sum + (p.progress || 0), 0) / totalPlans
        )
      : 0;

    return (
      <section className={getContainerClass("DASHBOARD", "md")}>
        <div className="flex flex-col gap-6">
          {/* 페이지 헤더 - 간소화된 스타일 */}
          <div className="rounded-xl border-2 border-gray-200 bg-white p-6 md:p-8 shadow-sm">
            <div className="flex flex-col gap-6">
              {/* 제목 및 설명 */}
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900">플랜 캘린더</h1>
                <p className="text-sm md:text-base text-gray-600">
                  활성화된 플랜 그룹의 플랜을 캘린더 형식으로 확인하세요
                </p>
              </div>

              {/* 활성 플랜 그룹 정보 */}
              {activePlanGroups.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500">활성 플랜:</span>
                  {activePlanGroups.map((group) => (
                    <span
                      key={group.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-800 border border-indigo-200"
                    >
                      <span className="h-2 w-2 rounded-full bg-indigo-600"></span>
                      {group.name || group.id.slice(0, 8)}
                    </span>
                  ))}
                </div>
              )}

              {/* 통계 요약 - 개선된 레이아웃 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="flex flex-col gap-1 rounded-lg bg-gray-50 px-4 py-3 border border-gray-200">
                  <span className="text-xs font-medium text-gray-500">총 플랜</span>
                  <span className="text-2xl md:text-3xl font-bold text-gray-900">{totalPlans}</span>
                </div>
                <div className="flex flex-col gap-1 rounded-lg bg-green-50 px-4 py-3 border border-green-200">
                  <span className="text-xs font-medium text-green-700">완료</span>
                  <span className="text-2xl md:text-3xl font-bold text-green-600">{completedPlans}</span>
                </div>
                {activePlans > 0 && (
                  <div className="flex flex-col gap-1 rounded-lg bg-blue-50 px-4 py-3 border border-blue-200">
                    <span className="text-xs font-medium text-blue-700">진행중</span>
                    <span className="text-2xl md:text-3xl font-bold text-blue-600">{activePlans}</span>
                  </div>
                )}
                {averageProgress > 0 && (
                  <div className="flex flex-col gap-1 rounded-lg bg-indigo-50 px-4 py-3 border border-indigo-200">
                    <span className="text-xs font-medium text-indigo-700">평균 진행률</span>
                    <span className="text-2xl md:text-3xl font-bold text-indigo-600">{averageProgress}%</span>
                  </div>
                )}
              </div>

              {/* 불일치 경고 */}
              {hasUnmatchedPlans && (
                <div className="flex flex-col gap-2 rounded-lg border-2 border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800 shadow-sm">
                  <div className="font-bold">⚠️ 플랜 그룹 불일치 감지</div>
                  <div className="flex flex-col gap-1 text-xs">
                    {unmatchedGroupIds.length > 0 && (
                      <div>
                        활성화되지 않은 플랜 그룹의 플랜이 포함되어 있습니다: {unmatchedGroupIds.length}개
                      </div>
                    )}
                    {filteredPlans.some((p) => !p.plan_group_id) && (
                      <div>
                        플랜 그룹이 없는 플랜이 포함되어 있습니다: {filteredPlans.filter((p) => !p.plan_group_id).length}개
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <PlanCalendarView
            plans={plansWithContent}
            view={view}
            minDate={minDateStr}
            maxDate={maxDateStr}
            initialDate={firstPlanDate}
            exclusions={exclusions}
            academySchedules={academySchedules}
            dailySchedules={dailySchedules}
          />
        </div>
      </section>
    );
  } catch (error) {
    console.error("[calendar] 플랜 캘린더 데이터 로드 실패", error);
    
    // 사용자 친화적인 에러 메시지 표시
    return (
      <section className={getContainerClass("DASHBOARD", "md")}>
        <div className="rounded-xl border border-red-200 bg-red-50 p-10 text-center">
          <div className="mx-auto flex max-w-md flex-col gap-4">
            <div className="text-6xl">⚠️</div>
            <h3 className="text-lg font-semibold text-red-900">
              데이터를 불러오는 중 오류가 발생했습니다
            </h3>
            <p className="text-sm text-red-700">
              잠시 후 다시 시도해주세요. 문제가 지속되면 관리자에게 문의해주세요.
            </p>
          </div>
        </div>
      </section>
    );
  }
}
