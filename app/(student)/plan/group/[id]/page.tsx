import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlanGroupWithDetails } from "@/lib/data/planGroups";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { PlanStatusManager } from "@/lib/plan/statusManager";
import { PlanGroupDetailView } from "./_components/PlanGroupDetailView";
import { PlanGroupActionButtons } from "./_components/PlanGroupActionButtons";
import { PlanGroupProgressCard } from "./_components/PlanGroupProgressCard";
import { classifyPlanContents } from "@/lib/data/planContents";
import type { PlanStatus } from "@/lib/types/plan";
import {
  planPurposeLabels,
  schedulerTypeLabels,
  statusLabels,
  statusColors,
} from "@/lib/constants/planLabels";
import { ScrollToTop } from "@/components/ScrollToTop";

type PlanGroupDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PlanGroupDetailPage({
  params,
}: PlanGroupDetailPageProps) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // tenantId 조회
  const tenantContext = await getTenantContext();

  // 플랜 그룹 및 관련 데이터 조회
  const { group, contents, exclusions, academySchedules } =
    await getPlanGroupWithDetails(id, user.id, tenantContext?.tenantId || null);

  if (!group) {
    notFound();
  }

  // 콘텐츠 정보 조회 및 학생/추천 구분 (통합 함수 사용)
  const { studentContents, recommendedContents } = await classifyPlanContents(
    contents,
    user.id
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

  const canEdit = PlanStatusManager.canEdit(group.status as PlanStatus);
  const canDelete = PlanStatusManager.canDelete(group.status as PlanStatus);

  // 블록 세트 목록 조회 (시간 블록 정보 포함)
  const { fetchBlockSetsWithBlocks } = await import("@/lib/data/blockSets");
  const blockSets = await fetchBlockSetsWithBlocks(user.id);

  // 플랜 데이터 조회 (단일 쿼리로 통합)
  const { data: plans } = await supabase
    .from("student_plan")
    .select("id,planned_end_page_or_time,completed_amount")
    .eq("plan_group_id", id)
    .eq("student_id", user.id)
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

  // 표시할 상태 결정 (저장됨/초안 제외)
  const getDisplayStatus = () => {
    // 완료 상태는 우선 표시
    if (isCompleted || group.status === "completed") {
      return { label: "완료", color: statusColors.completed };
    }

    // 활성/일시정지/중단 상태만 표시 (저장됨/초안 제외)
    if (statusLabels[group.status]) {
      return {
        label: statusLabels[group.status],
        color: statusColors[group.status],
      };
    }

    return null;
  };

  const displayStatus = getDisplayStatus();

  // 캠프 모드 확인
  const isCampMode = group.plan_type === "camp";

  // 캠프 모드일 때 템플릿 블록 세트 정보 조회
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
      const { data: template, error: templateError } = await supabase
        .from("camp_templates")
        .select("template_data")
        .eq("id", group.camp_template_id)
        .maybeSingle();

      if (templateError) {
        // Supabase 에러 객체의 주요 속성 추출 (더 안전한 처리)
        const errorInfo: Record<string, unknown> = {};
        
        try {
          if (templateError instanceof Error) {
            errorInfo.message = templateError.message;
            errorInfo.name = templateError.name;
            errorInfo.stack = templateError.stack;
          } else if (typeof templateError === "object" && templateError !== null) {
            Object.keys(templateError).forEach((key) => {
              try {
                errorInfo[key] = (templateError as Record<string, unknown>)[key];
              } catch {
                // 속성 접근 실패 시 무시
              }
            });
          } else {
            errorInfo.value = String(templateError);
          }
          
          const standardKeys = ["message", "code", "details", "hint", "statusCode"];
          standardKeys.forEach((key) => {
            if (key in templateError) {
              try {
                errorInfo[key] = (templateError as unknown as Record<string, unknown>)[key];
              } catch {
                // 속성 접근 실패 시 무시
              }
            }
          });
        } catch (extractError) {
          errorInfo.extractionError = String(extractError);
          errorInfo.rawError = String(templateError);
        }
        
        if (Object.keys(errorInfo).length === 0) {
          errorInfo.message = String(templateError);
        }
        
        console.error(
          "[PlanGroupDetailPage] 템플릿 조회 에러:",
          errorInfo,
          {
            camp_template_id: group.camp_template_id,
          },
          "원본 에러:",
          templateError
        );
      } else if (!template) {
        console.warn(
          "[PlanGroupDetailPage] 템플릿을 찾을 수 없음:",
          group.camp_template_id
        );
      } else {
        // template_data 안전하게 파싱
        let templateData: any = null;
        if (template.template_data) {
          if (typeof template.template_data === "string") {
            try {
              templateData = JSON.parse(template.template_data);
            } catch (parseError) {
              console.error(
                "[PlanGroupDetailPage] template_data 파싱 에러:",
                parseError
              );
              templateData = null;
            }
          } else {
            templateData = template.template_data;
          }
        }

        // block_set_id 찾기: 여러 경로에서 확인
        let blockSetId: string | null = null;

        // 1. scheduler_options에서 template_block_set_id 확인 (campActions.ts에서 저장한 경로 - 우선 확인)
        if (group.scheduler_options) {
          let schedulerOptions: any = null;
          if (typeof group.scheduler_options === "string") {
            try {
              schedulerOptions = JSON.parse(group.scheduler_options);
            } catch (parseError) {
              console.error(
                "[PlanGroupDetailPage] scheduler_options 파싱 에러:",
                parseError
              );
            }
          } else {
            schedulerOptions = group.scheduler_options;
          }

          if (schedulerOptions?.template_block_set_id) {
            blockSetId = schedulerOptions.template_block_set_id;
            console.log(
              "[PlanGroupDetailPage] scheduler_options에서 template_block_set_id 발견:",
              blockSetId
            );
          }
        }

        // 2. 연결 테이블에서 block_set_id 확인 (새로운 방식)
        if (!blockSetId && group.camp_template_id) {
          const { data: templateBlockSetLink } = await supabase
            .from("camp_template_block_sets")
            .select("tenant_block_set_id")
            .eq("camp_template_id", group.camp_template_id)
            .maybeSingle();

          if (templateBlockSetLink) {
            blockSetId = templateBlockSetLink.tenant_block_set_id;
            console.log(
              "[PlanGroupDetailPage] 연결 테이블에서 block_set_id 발견:",
              blockSetId
            );
          }
        }

        // 3. template_data에서 block_set_id 확인 (하위 호환성, 마이그레이션 전 데이터용)
        if (!blockSetId && templateData?.block_set_id) {
          blockSetId = templateData.block_set_id;
          console.log(
            "[PlanGroupDetailPage] template_data에서 block_set_id 발견 (하위 호환성):",
            blockSetId
          );
        }

        if (blockSetId) {
          // tenant_block_sets에서 블록 세트 조회 (올바른 테이블 사용)
          console.log("[PlanGroupDetailPage] 테넌트 블록 세트 조회 시도:", {
            block_set_id: blockSetId,
            template_id: group.camp_template_id,
            tenant_id: tenantContext?.tenantId,
          });

          if (!tenantContext?.tenantId) {
            console.warn("[PlanGroupDetailPage] tenant_id가 없어 블록 세트 조회 불가");
          } else {
            const { data: templateBlockSet, error: blockSetError } = await supabase
              .from("tenant_block_sets")
              .select("id, name")
              .eq("id", blockSetId)
              .eq("tenant_id", tenantContext.tenantId)
              .maybeSingle();

            console.log("[PlanGroupDetailPage] 테넌트 블록 세트 조회 결과:", {
              hasError: !!blockSetError,
              hasData: !!templateBlockSet,
              block_set_id: blockSetId,
              tenant_id: tenantContext.tenantId,
            });

            if (blockSetError) {
              // 에러 객체를 여러 방법으로 직렬화 시도
              let errorStringified = "";
              let errorSerialized = {};
              
              try {
                errorStringified = JSON.stringify(blockSetError, null, 2);
              } catch (stringifyError) {
                errorStringified = `JSON.stringify 실패: ${String(stringifyError)}`;
              }
              
              try {
                // 순환 참조 문제 해결을 위한 Set
                const seen = new WeakSet();
                // 직렬화 가능한 속성만 추출
                errorSerialized = JSON.parse(JSON.stringify(blockSetError, (key, value) => {
                  // 순환 참조 방지
                  if (typeof value === "object" && value !== null) {
                    if (seen.has(value)) {
                      return "[Circular]";
                    }
                    seen.add(value);
                  }
                  // 함수는 문자열로 변환
                  if (typeof value === "function") {
                    return `[Function: ${value.name || "anonymous"}]`;
                  }
                  return value;
                }));
              } catch (serializeError) {
                errorSerialized = { serializationError: String(serializeError) };
              }
              
              // 다양한 방법으로 에러 정보 추출
              const errorInfo: Record<string, unknown> = {
                // 기본 정보
                errorExists: !!blockSetError,
                errorType: typeof blockSetError,
                errorConstructor: blockSetError?.constructor?.name,
                
                // 직렬화 결과
                stringified: errorStringified,
                serialized: errorSerialized,
                
                // 직접 접근
                directMessage: (blockSetError as any)?.message,
                directCode: (blockSetError as any)?.code,
                directDetails: (blockSetError as any)?.details,
                directHint: (blockSetError as any)?.hint,
                directStatusCode: (blockSetError as any)?.statusCode,
                
                // toString 시도
                toString: blockSetError?.toString?.(),
                
                // Object.keys 시도
                keys: blockSetError && typeof blockSetError === "object" ? Object.keys(blockSetError) : null,
                
                // 모든 속성 시도 (안전하게)
                allProperties: (() => {
                  if (blockSetError && typeof blockSetError === "object") {
                    const props: Record<string, unknown> = {};
                    try {
                      for (const key in blockSetError) {
                        try {
                          const value = (blockSetError as any)[key];
                          if (typeof value !== "function") {
                            props[key] = value;
                          }
                        } catch {
                          props[key] = "[접근 불가]";
                        }
                      }
                    } catch {
                      // 무시
                    }
                    return props;
                  }
                  return null;
                })(),
              };
              
              console.error(
                "[PlanGroupDetailPage] 템플릿 블록 세트 조회 에러:",
                errorInfo,
                "\n원본 에러 객체:",
                blockSetError,
                "\n에러 타입:",
                typeof blockSetError,
                "\n에러 생성자:",
                blockSetError?.constructor?.name,
                "\n쿼리 파라미터:",
                {
                  block_set_id: blockSetId,
                  template_id: group.camp_template_id,
                }
              );
            } else if (templateBlockSet) {
              templateBlockSetId = templateBlockSet.id;
              templateBlockSetName = templateBlockSet.name;
              console.log("[PlanGroupDetailPage] 테넌트 블록 세트 조회 성공:", {
                id: templateBlockSet.id,
                name: templateBlockSet.name,
              });

              // tenant_blocks에서 블록 조회
              const { data: blocks, error: blocksError } = await supabase
                .from("tenant_blocks")
                .select("id, day_of_week, start_time, end_time")
                .eq("tenant_block_set_id", templateBlockSet.id)
                .order("day_of_week", { ascending: true })
                .order("start_time", { ascending: true });

              if (blocksError) {
                // Supabase 에러 객체의 주요 속성 추출 (더 안전한 처리)
                const errorInfo: Record<string, unknown> = {};
                
                try {
                  if (blocksError instanceof Error) {
                    errorInfo.message = blocksError.message;
                    errorInfo.name = blocksError.name;
                    errorInfo.stack = blocksError.stack;
                  } else if (typeof blocksError === "object" && blocksError !== null) {
                    Object.keys(blocksError).forEach((key) => {
                      try {
                        errorInfo[key] = (blocksError as Record<string, unknown>)[key];
                      } catch {
                        // 속성 접근 실패 시 무시
                      }
                    });
                  } else {
                    errorInfo.value = String(blocksError);
                  }
                  
                  const standardKeys = ["message", "code", "details", "hint", "statusCode"];
                  standardKeys.forEach((key) => {
                    if (key in blocksError) {
                      try {
                        errorInfo[key] = (blocksError as Record<string, unknown>)[key];
                      } catch {
                        // 속성 접근 실패 시 무시
                      }
                    }
                  });
                } catch (extractError) {
                  errorInfo.extractionError = String(extractError);
                  errorInfo.rawError = String(blocksError);
                }
                
                if (Object.keys(errorInfo).length === 0) {
                  errorInfo.message = String(blocksError);
                }
                
                console.error(
                  "[PlanGroupDetailPage] 템플릿 블록 조회 에러:",
                  errorInfo,
                  {
                    tenant_block_set_id: templateBlockSet.id,
                  },
                  "원본 에러:",
                  blocksError
                );
              } else if (blocks && blocks.length > 0) {
                templateBlocks = blocks.map((b) => ({
                  id: b.id,
                  day_of_week: b.day_of_week,
                  start_time: b.start_time,
                  end_time: b.end_time,
                }));
                console.log("[PlanGroupDetailPage] 템플릿 블록 조회 성공:", {
                  count: templateBlocks.length,
                  blocks: templateBlocks,
                });
              } else {
                console.warn("[PlanGroupDetailPage] 템플릿 블록이 없음:", {
                  tenant_block_set_id: templateBlockSet.id,
                });
              }
            } else {
              console.warn(
                "[PlanGroupDetailPage] 템플릿 블록 세트를 찾을 수 없음:",
                {
                  block_set_id: blockSetId,
                  template_id: group.camp_template_id,
                }
              );
            }
          }
        } else {
          console.warn("[PlanGroupDetailPage] block_set_id를 찾을 수 없음:", {
            template_id: group.camp_template_id,
            template_data_has_block_set_id: !!templateData?.block_set_id,
            scheduler_options_has_template_block_set_id:
              !!(typeof group.scheduler_options === "object"
                ? (group.scheduler_options as any)?.template_block_set_id
                : null),
          });
        }
      }
    } catch (error) {
      console.error("[PlanGroupDetailPage] 템플릿 블록 조회 중 에러:", error);
    }
  }

  return (
    <>
      <ScrollToTop />
      <section className="mx-auto w-full max-w-5xl px-4 py-6 md:py-10">
        <div className="flex flex-col gap-6">
        {/* 상단 액션 바 */}
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <Link
            href={isCampMode ? "/camp" : "/plan"}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
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
            {isCampMode ? "캠프 목록으로" : "플랜 목록으로"}
          </Link>

          <PlanGroupActionButtons
            groupId={id}
            groupName={group.name}
            groupStatus={
              isCompleted ? "completed" : (group.status as PlanStatus)
            }
            canEdit={canEdit}
            canDelete={canDelete || isCompleted}
          />
        </div>

        {/* 캠프 모드 안내 */}
        {isCampMode && !hasPlans && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900">
                  관리자 검토 중
                </h3>
                <p className="mt-1 text-sm text-blue-700">
                  캠프 참여 정보를 제출하셨습니다. 관리자가 남은 단계를 진행한
                  후 플랜이 생성됩니다.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 헤더 정보 카드 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            {/* 상태 뱃지들 */}
            <div className="flex flex-wrap items-center gap-2">
              {hasPlans && (
                <span className="inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
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
              <h1 className="text-h1 text-gray-900">
                {group.name || "플랜 그룹"}
              </h1>
            </div>

            {/* 핵심 정보 */}
            <div className="grid gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs font-medium text-gray-800">플랜 목적</dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900">
                  {group.plan_purpose
                    ? planPurposeLabels[group.plan_purpose] ||
                      group.plan_purpose
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-800">
                  스케줄러 유형
                </dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900">
                  {group.scheduler_type
                    ? schedulerTypeLabels[group.scheduler_type] ||
                      group.scheduler_type
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-800">학습 기간</dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900">
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
                <div>
                  <dt className="text-xs font-medium text-gray-800">
                    목표 날짜
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900">
                    {new Date(group.target_date).toLocaleDateString("ko-KR")}
                  </dd>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 진행 상황 카드 */}
        {hasPlans && (
          <PlanGroupProgressCard
            group={group}
            planCount={planCount}
            completedCount={completedCount}
            hasPlans={hasPlans}
          />
        )}

        {/* 탭 컨텐츠 영역 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <PlanGroupDetailView
            group={group}
            contents={contents}
            exclusions={exclusions}
            academySchedules={academySchedules}
            contentsWithDetails={contentsWithDetails}
            canEdit={canEdit}
            groupId={id}
            hasPlans={hasPlans}
            templateBlocks={templateBlocks}
            templateBlockSetName={templateBlockSetName}
            templateBlockSetId={templateBlockSetId}
            blockSets={blockSets}
            campTemplateId={isCampMode ? group.camp_template_id : null}
          />
        </div>
      </div>
    </section>
    </>
  );
}
