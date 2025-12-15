import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlanGroupWithDetailsForAdmin } from "@/lib/data/planGroups";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { PlanGroupDetailView } from "@/app/(student)/plan/group/[id]/_components/PlanGroupDetailView";
import { classifyPlanContents } from "@/lib/data/planContents";
import {
  planPurposeLabels,
  schedulerTypeLabels,
  statusLabels,
  planStatusColors,
} from "@/lib/constants/planLabels";
import { getCampTemplateImpactSummary, getCampTemplate } from "@/lib/data/campTemplates";
import { parseCampConfiguration } from "@/lib/camp/campAdapter";
import { cn } from "@/lib/cn";
import {
  bgSurface,
  bgHover,
  textPrimary,
  textSecondary,
  textMuted,
  borderDefault,
} from "@/lib/utils/darkMode";

type AdminPlanGroupDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminPlanGroupDetailPage({
  params,
}: AdminPlanGroupDetailPageProps) {
  const { id } = await params;

  // 권한 확인
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  // tenantId 조회
  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    redirect("/login");
  }

  // 플랜 그룹 및 관련 데이터 조회 (관리자용 함수 사용)
  const { group, contents, exclusions, academySchedules } =
    await getPlanGroupWithDetailsForAdmin(id, tenantContext.tenantId);

  if (!group) {
    notFound();
  }

  // 콘텐츠 정보 조회 및 학생/추천 구분
  // 관리자/컨설턴트가 다른 학생의 콘텐츠를 조회할 때는 역할 정보 전달 (RLS 우회)
  const { userId } = await getCurrentUserRole();
  const { studentContents, recommendedContents } = await classifyPlanContents(
    contents,
    group.student_id,
    {
      currentUserRole: role,
      currentUserId: userId || undefined,
    }
  );

  // 상세 페이지 형식으로 변환
  const allContents = [...studentContents, ...recommendedContents];
  const contentsMap = new Map(allContents.map((c) => [c.content_id, c]));

  const contentsWithDetails = contents.map((content) => {
    const detail = contentsMap.get(content.content_id);
    if (!detail) {
      return {
        ...content,
        contentTitle: "알 수 없음",
        contentSubtitle: null,
        isRecommended: false,
      };
    }

    return {
      ...content,
      contentTitle: detail.title || "알 수 없음",
      contentSubtitle: detail.subject_category || null,
      isRecommended: detail.isRecommended,
    };
  });

  const supabase = await createSupabaseServerClient();

  // 플랜 데이터 조회
  const { data: plans } = await supabase
    .from("student_plan")
    .select("id,planned_end_page_or_time,completed_amount")
    .eq("plan_group_id", id)
    .not("plan_group_id", "is", null);

  const planCount = plans?.length || 0;
  const hasPlans = planCount > 0;

  // 완료 여부 및 완료 개수 계산
  let isCompleted = false;
  let completedCount = 0;

  if (plans && plans.length > 0) {
    const completedPlans = plans.filter((plan) => {
      if (!plan.planned_end_page_or_time) return false;
      return (
        plan.completed_amount !== null &&
        plan.completed_amount >= plan.planned_end_page_or_time
      );
    });
    completedCount = completedPlans.length;
    isCompleted = completedPlans.length === plans.length;
  }

  // 표시할 상태 결정
  const getDisplayStatus = () => {
    if (isCompleted || group.status === "completed") {
      return { label: "완료", color: planStatusColors.completed };
    }

    if (statusLabels[group.status]) {
      return {
        label: statusLabels[group.status],
        color: planStatusColors[group.status],
      };
    }

    return null;
  };

  const displayStatus = getDisplayStatus();

  // 캠프 모드 확인
  const isCampMode = group.plan_type === "camp";

  // 캠프 모드일 때 템플릿 블록 세트 정보 조회 (Adapter 패턴 사용)
  let templateBlocks: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }> = [];
  let templateBlockSetName: string | null = null;
  let templateBlockSetId: string | null = null;

  if (isCampMode && group.camp_template_id) {
    try {
      // 템플릿 조회
      const template = await getCampTemplate(group.camp_template_id);

      if (!template) {
        console.warn(
          "[AdminPlanGroupDetailPage] 템플릿을 찾을 수 없음:",
          group.camp_template_id
        );
      } else {
        // Adapter 패턴을 사용하여 캠프 설정 파싱
        const campConfig = await parseCampConfiguration(
          supabase,
          group,
          template as any,
          tenantContext?.tenantId || null
        );

        templateBlocks = campConfig.templateBlocks;
        templateBlockSetName = campConfig.templateBlockSetName;
        templateBlockSetId = campConfig.templateBlockSetId;

        console.log("[AdminPlanGroupDetailPage] 캠프 설정 파싱 완료:", {
          blockSetId: campConfig.blockSetId,
          templateBlocksCount: templateBlocks.length,
          templateBlockSetName,
          templateBlockSetId,
          isLegacy: campConfig.isLegacy,
        });
      }
    } catch (error) {
      console.error("[AdminPlanGroupDetailPage] 템플릿 블록 조회 중 에러:", error);
    }
  }

  // 학생 정보 조회
  const { data: studentInfo } = await supabase
    .from("students")
    .select("name, grade, class")
    .eq("id", group.student_id)
    .maybeSingle();

  // 캠프 템플릿 통계 조회 (camp_template_id가 있을 때만)
  let templateImpactSummary = null;
  if (isCampMode && group.camp_template_id) {
    try {
      templateImpactSummary = await getCampTemplateImpactSummary(
        group.camp_template_id,
        tenantContext.tenantId
      );
    } catch (error) {
      console.error(
        "[AdminPlanGroupDetailPage] 템플릿 통계 조회 실패:",
        error
      );
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-6 md:py-10">
      <div className="flex flex-col gap-6">
        {/* 상단 액션 바 */}
        <div className={cn(
          "flex items-center justify-between rounded-lg border px-4 py-3 shadow-sm",
          borderDefault,
          bgSurface
        )}>
          <Link
            href={
              isCampMode && group.camp_template_id
                ? `/admin/camp-templates/${group.camp_template_id}/participants`
                : "/admin/dashboard"
            }
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition",
              textSecondary,
              bgHover
            )}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            {isCampMode && group.camp_template_id
              ? "참여자 목록으로"
              : "대시보드로"}
          </Link>
        </div>

        {/* 학생 정보 카드 */}
        {studentInfo && (
          <div className={cn(
            "rounded-lg border p-4",
            "border-blue-200 dark:border-blue-800",
            "bg-blue-50 dark:bg-blue-900/30"
          )}>
            <div className="flex items-center gap-3">
              <div>
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                  {studentInfo.name || "이름 없음"}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  {studentInfo.grade && studentInfo.class
                    ? `${studentInfo.grade}학년 ${studentInfo.class}반`
                    : studentInfo.grade
                    ? `${studentInfo.grade}학년`
                    : ""}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 헤더 정보 카드 */}
        <div className={cn(
          "rounded-xl border p-6 shadow-sm",
          borderDefault,
          bgSurface
        )}>
          <div className="flex flex-col gap-4">
            {/* 상태 뱃지들 */}
            <div className="flex flex-wrap items-center gap-2">
              {hasPlans && (
                <span className="inline-block rounded-full bg-blue-100 dark:bg-blue-900/30 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:text-blue-300">
                  플랜 생성 완료
                </span>
              )}
              {displayStatus && (
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${displayStatus.color}`}
                >
                  {displayStatus.label}
                </span>
              )}
            </div>

            {/* 플랜 그룹 이름 */}
            <div>
              <h1 className={cn("text-3xl font-semibold", textPrimary)}>
                {group.name || "플랜 그룹"}
              </h1>
            </div>

            {/* 핵심 정보 */}
            <div className={cn(
              "grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3",
              "border-gray-100 dark:border-gray-800"
            )}>
              <div className="flex flex-col gap-1">
                <dt className={cn("text-xs font-medium", textMuted)}>플랜 목적</dt>
                <dd className={cn("text-sm font-semibold", textPrimary)}>
                  {group.plan_purpose
                    ? planPurposeLabels[group.plan_purpose] ||
                      group.plan_purpose
                    : "—"}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className={cn("text-xs font-medium", textMuted)}>
                  스케줄러 유형
                </dt>
                <dd className={cn("text-sm font-semibold", textPrimary)}>
                  {group.scheduler_type
                    ? schedulerTypeLabels[group.scheduler_type] ||
                      group.scheduler_type
                    : "—"}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className={cn("text-xs font-medium", textMuted)}>학습 기간</dt>
                <dd className={cn("text-sm font-semibold", textPrimary)}>
                  {group.period_start && group.period_end
                    ? `${new Date(group.period_start).toLocaleDateString(
                        "ko-KR",
                        {
                          month: "short",
                          day: "numeric",
                        }
                      )} ~ ${new Date(group.period_end).toLocaleDateString(
                        "ko-KR",
                        {
                          month: "short",
                          day: "numeric",
                        }
                      )}`
                    : "—"}
                </dd>
              </div>
              {group.target_date && (
                <div className="flex flex-col gap-1">
                  <dt className={cn("text-xs font-medium", textMuted)}>
                    목표 날짜
                  </dt>
                  <dd className={cn("text-sm font-semibold", textPrimary)}>
                    {new Date(group.target_date).toLocaleDateString("ko-KR")}
                  </dd>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 템플릿 통계 (캠프 모드일 때만 표시) */}
        {isCampMode && group.camp_template_id && templateImpactSummary && (
          <div className={cn(
            "rounded-lg border p-5 text-sm",
            "border-amber-200 dark:border-amber-800",
            "bg-amber-50 dark:bg-amber-900/30",
            "text-amber-900 dark:text-amber-200"
          )}>
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  초대 현황
                </p>
                <p className="text-base font-semibold">
                  대기 {templateImpactSummary.invitationStats.pending} · 참여{" "}
                  {templateImpactSummary.invitationStats.accepted} · 거절{" "}
                  {templateImpactSummary.invitationStats.declined}
                </p>
              </div>
              <div className="h-6 w-px bg-amber-200 dark:bg-amber-800" aria-hidden="true" />
              <div>
                <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  플랜 진행
                </p>
                <p className="text-base font-semibold">
                  작성 중 {templateImpactSummary.planGroupStats.draft} · 검토 중{" "}
                  {templateImpactSummary.planGroupStats.saved} · 활성{" "}
                  {templateImpactSummary.planGroupStats.active}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 진행 상황 카드 */}
        {hasPlans && (
          <div className={cn(
            "rounded-xl border p-6 shadow-sm",
            borderDefault,
            bgSurface
          )}>
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <p className={cn("text-sm font-medium", textMuted)}>진행 상황</p>
                <p className={cn("text-2xl font-semibold", textPrimary)}>
                  {completedCount} / {planCount}
                </p>
              </div>
              <div className="flex flex-col gap-1 text-right">
                <p className={cn("text-sm font-medium", textMuted)}>완료율</p>
                <p className={cn("text-2xl font-semibold", textPrimary)}>
                  {planCount > 0
                    ? Math.round((completedCount / planCount) * 100)
                    : 0}
                  %
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 탭 컨텐츠 영역 */}
        <div className={cn(
          "rounded-xl border p-6 shadow-sm",
          borderDefault,
          bgSurface
        )}>
          <PlanGroupDetailView
            group={group}
            contents={contents}
            exclusions={exclusions}
            academySchedules={academySchedules}
            contentsWithDetails={contentsWithDetails}
            canEdit={false}
            groupId={id}
            hasPlans={hasPlans}
            templateBlocks={templateBlocks}
            templateBlockSetName={templateBlockSetName}
            templateBlockSetId={templateBlockSetId}
            campTemplateId={group.camp_template_id}
          />
        </div>
      </div>
    </section>
  );
}

