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

type PlanCalendarPageProps = {
  searchParams: Promise<{ view?: string }>;
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
    const activePlanGroups = allActivePlanGroups.filter(
      (group) => !group.camp_template_id && !group.camp_invitation_id
    );

    if (activePlanGroups.length === 0) {
      return (
        <section className="mx-auto w-full max-w-6xl px-4 py-6 md:py-10">
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

    const today = new Date().toISOString().slice(0, 10);
    
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
    const minDateStr = typeof minDate === "string" ? minDate : new Date(minDate).toISOString().slice(0, 10);
    const maxDateStr = typeof maxDate === "string" ? maxDate : new Date(maxDate).toISOString().slice(0, 10);

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

    // 교과 정보 또는 제목이 없는 플랜의 콘텐츠 ID 수집
    const missingContentIds = new Map<"book" | "lecture" | "custom", Set<string>>();
    missingContentIds.set("book", new Set());
    missingContentIds.set("lecture", new Set());
    missingContentIds.set("custom", new Set());
    
    filteredPlans.forEach((plan) => {
      const needsFetch = 
        (!plan.content_subject_category && !plan.content_subject) || 
        !plan.content_title;
      if (needsFetch && plan.content_id) {
        const contentType = plan.content_type;
        if (contentType && missingContentIds.has(contentType)) {
          missingContentIds.get(contentType)!.add(plan.content_id);
        }
      }
    });
    
    // 콘텐츠 테이블에서 교과 정보 및 제목 조회
    const contentSubjectMap = new Map<string, { subjectCategory: string | null; subject: string | null; title: string | null }>();
    
    for (const [contentType, contentIds] of missingContentIds.entries()) {
      if (contentIds.size === 0) continue;
      
      try {
        const tableName = contentType === "book" ? "books" : contentType === "lecture" ? "lectures" : "student_custom_contents";
        const selectField = contentType === "book" ? "id,subject_category,subject,title" : contentType === "lecture" ? "id,subject_category,subject,title" : "id,subject_category,subject,title";
        
        const { data, error } = await supabase
          .from(tableName)
          .select(selectField)
          .in("id", Array.from(contentIds));
        
        if (!error && data) {
          data.forEach((content: any) => {
            contentSubjectMap.set(content.id, {
              subjectCategory: content.subject_category || null,
              subject: content.subject || null,
              title: content.title || null,
            });
          });
        }
      } catch (error) {
        console.error(`[calendar] ${contentType} 교과 정보 조회 실패`, error);
      }
    }
    
    // 플랜에 콘텐츠 정보 추가 (denormalized 필드 사용 + 조회한 정보 보완)
    const plansWithContent = filteredPlans.map((plan) => {
      // 교과 정보 (denormalized 필드 우선, 없으면 조회한 정보 사용, 둘 다 없으면 null)
      const contentSubjectInfo = plan.content_id ? contentSubjectMap.get(plan.content_id) : null;
      const contentSubjectCategory = plan.content_subject_category || contentSubjectInfo?.subjectCategory || null;
      const contentSubject = plan.content_subject || contentSubjectInfo?.subject || null;
      
      // 플랜 회차 정보 (sequence 사용)
      let contentEpisode: string | null = null;
      if (plan.sequence !== null && plan.sequence !== undefined) {
        contentEpisode = `${plan.sequence}회차`;
      }
      
      return {
        ...plan,
        contentTitle: plan.content_title || contentSubjectInfo?.title || "제목 없음",
        contentSubject,
        contentSubjectCategory, // 교과 (항상 일관되게 표시)
        contentCategory: plan.content_category || null, // 유형
        contentEpisode, // 플랜 회차
      };
    });

    // 첫 플랜 날짜 계산 (플랜이 있으면 첫 플랜 날짜, 없으면 오늘 날짜)
    const firstPlanDate =
      plansWithContent.length > 0
        ? plansWithContent
            .map((plan) => plan.plan_date)
            .filter((date): date is string => date !== null)
            .sort()[0] || new Date().toISOString().slice(0, 10)
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
      <section className="mx-auto w-full max-w-6xl px-4 py-6 md:py-10">
        <div className="flex flex-col gap-6">
          {/* 페이지 헤더 - 카드 스타일 */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">플랜 캘린더</h1>
                <p className="text-sm text-gray-600 mb-3">
                  활성화된 플랜 그룹의 플랜을 캘린더 형식으로 확인하세요
                </p>
                {/* 활성 플랜 그룹 정보 표시 */}
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
              </div>
              
              {/* 통계 요약 */}
              <div className="flex flex-wrap gap-3 md:flex-nowrap">
                <div className="flex flex-col items-center rounded-lg bg-gray-50 px-4 py-3 border border-gray-200 min-w-[80px]">
                  <span className="text-xs font-medium text-gray-500 mb-1">총 플랜</span>
                  <span className="text-2xl font-bold text-gray-900">{totalPlans}</span>
                </div>
                <div className="flex flex-col items-center rounded-lg bg-green-50 px-4 py-3 border border-green-200 min-w-[80px]">
                  <span className="text-xs font-medium text-green-700 mb-1">완료</span>
                  <span className="text-2xl font-bold text-green-600">{completedPlans}</span>
                </div>
                {activePlans > 0 && (
                  <div className="flex flex-col items-center rounded-lg bg-blue-50 px-4 py-3 border border-blue-200 min-w-[80px]">
                    <span className="text-xs font-medium text-blue-700 mb-1">진행중</span>
                    <span className="text-2xl font-bold text-blue-600">{activePlans}</span>
                  </div>
                )}
                {averageProgress > 0 && (
                  <div className="flex flex-col items-center rounded-lg bg-indigo-50 px-4 py-3 border border-indigo-200 min-w-[80px]">
                    <span className="text-xs font-medium text-indigo-700 mb-1">평균 진행률</span>
                    <span className="text-2xl font-bold text-indigo-600">{averageProgress}%</span>
                  </div>
                )}
              </div>
            </div>
            {/* 불일치 경고 */}
            {hasUnmatchedPlans && (
              <div className="mt-4 rounded-lg border-2 border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800 shadow-sm">
                <div className="font-bold mb-1">⚠️ 플랜 그룹 불일치 감지</div>
                <div className="text-xs space-y-1">
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
      <section className="mx-auto w-full max-w-6xl px-4 py-6 md:py-10">
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
