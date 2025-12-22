import { redirect, notFound } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getCampPlanGroupForReview } from "@/lib/domains/camp/actions";
import { PlanGroupWizard } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { fetchAllStudentContents, classifyPlanContents } from "@/lib/data/planContents";
import { fetchBlockSetsWithBlocks } from "@/lib/data/blockSets";
import { syncCreationDataToWizardData } from "@/lib/utils/planGroupDataSync";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlanExclusion, AcademySchedule } from "@/lib/types/plan";
import Link from "next/link";

type CampContinuePageProps = {
  params: Promise<{ id: string; groupId: string }>;
  searchParams: Promise<{ step?: string }>;
};

export default async function CampContinuePage({
  params,
  searchParams,
}: CampContinuePageProps) {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  const { id: templateId, groupId } = await params;
  const { step } = await searchParams;

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    redirect("/login");
  }

  // 플랜 그룹 및 관련 데이터 조회
  const result = await getCampPlanGroupForReview(groupId);

  if (!result.success || !result.group) {
    notFound();
  }

  const { group, contents, originalContents, exclusions, academySchedules } = result;

  // 캠프 모드 확인
  if (group.plan_type !== "camp") {
    redirect(`/admin/camp-templates/${templateId}/participants/${groupId}/review`);
  }

  // 이미 플랜이 생성된 경우 검토 페이지로 리다이렉트
  // 관리자가 다른 학생의 플랜을 조회하므로 Admin 클라이언트 사용
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const supabaseAdmin = createSupabaseAdminClient();
  const supabase = supabaseAdmin || await createSupabaseServerClient();

  const { data: plans } = await supabase
    .from("student_plan")
    .select("id")
    .eq("plan_group_id", groupId)
    .limit(1);

  if (plans && plans.length > 0) {
    redirect(`/admin/camp-templates/${templateId}/participants/${groupId}/review`);
  }

  // 학생 정보 조회 (콘텐츠 조회용 및 표시용)
  const studentId = group.student_id;
  const { data: studentInfo } = await supabase
    .from("students")
    .select("name, grade, class")
    .eq("id", studentId)
    .single();

  // 템플릿 블록 세트 조회 (캠프 모드) - 새로운 연결 테이블 방식
  let templateBlockSet: {
    id: string;
    name: string;
    blocks?: Array<{
      id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>;
  } | null = null;

  if (group.camp_template_id) {
    // 1. 연결 테이블에서 템플릿에 연결된 블록 세트 조회
    const { data: templateBlockSetLink, error: linkError } = await supabase
      .from("camp_template_block_sets")
      .select("tenant_block_set_id")
      .eq("camp_template_id", group.camp_template_id)
      .maybeSingle();

    let tenantBlockSetId: string | null = null;
    if (templateBlockSetLink) {
      tenantBlockSetId = templateBlockSetLink.tenant_block_set_id;
    } else {
      // 하위 호환성: template_data.block_set_id 확인 (마이그레이션 전 데이터용)
      const { data: templateBlockSetData } = await supabase
        .from("camp_templates")
        .select("template_data")
        .eq("id", group.camp_template_id)
        .maybeSingle();

      if (templateBlockSetData?.template_data?.block_set_id) {
        tenantBlockSetId = templateBlockSetData.template_data.block_set_id;
      }
    }

    if (tenantBlockSetId) {
      // 2. tenant_block_sets에서 블록 세트 정보 조회
      const { data: templateBlockSetInfo, error: blockSetError } = await supabase
        .from("tenant_block_sets")
        .select("id, name")
        .eq("id", tenantBlockSetId)
        .eq("tenant_id", tenantContext.tenantId)
        .maybeSingle();

      if (blockSetError) {
        console.error("[CampContinuePage] 템플릿 블록 세트 조회 에러:", blockSetError);
      } else if (templateBlockSetInfo) {
        // 3. tenant_blocks 테이블에서 블록 조회
        const { data: templateBlocks, error: blocksError } = await supabase
          .from("tenant_blocks")
          .select("id, day_of_week, start_time, end_time")
          .eq("tenant_block_set_id", tenantBlockSetId)
          .order("day_of_week", { ascending: true })
          .order("start_time", { ascending: true });

        if (blocksError) {
          console.error("[CampContinuePage] 템플릿 블록 조회 에러:", blocksError);
        } else if (templateBlocks && templateBlocks.length > 0) {
          templateBlockSet = {
            id: templateBlockSetInfo.id,
            name: `${templateBlockSetInfo.name} (템플릿)`,
            blocks: templateBlocks.map((b) => ({
              id: b.id,
              day_of_week: b.day_of_week,
              start_time: b.start_time,
              end_time: b.end_time,
            })),
          };
        }
      }
    }
  }

  // 학생 블록 세트 조회
  const studentBlockSets = await fetchBlockSetsWithBlocks(studentId);
  const blockSets = templateBlockSet
    ? [templateBlockSet, ...studentBlockSets]
    : studentBlockSets;

  // 콘텐츠 조회
  const { books, lectures, custom } = await fetchAllStudentContents(studentId);

  console.log("[CampContinuePage] 콘텐츠 조회 결과:", {
    groupId,
    studentId,
    booksCount: books.length,
    lecturesCount: lectures.length,
    customCount: custom.length,
    planContentsCount: contents.length,
    originalContentsCount: originalContents?.length || 0,
  });

  // 콘텐츠 정보 조회 및 학생/추천 구분 (제목, 과목 등 메타데이터 포함)
  // originalContents를 사용하여 master_content_id가 포함된 원본 데이터로 조회
  // 관리자/컨설턴트가 다른 학생의 콘텐츠를 조회할 때는 역할 정보 전달 (RLS 우회)
  const contentsForClassification = originalContents || contents;
  const { userId } = await getCurrentUserRole();
  const { studentContents: classifiedStudentContents, recommendedContents: classifiedRecommendedContents } = 
    await classifyPlanContents(contentsForClassification, studentId, {
      currentUserRole: role,
      currentUserId: userId || undefined,
    });

  console.log("[CampContinuePage] 콘텐츠 분류 결과:", {
    groupId,
    studentId,
    inputContentsCount: contentsForClassification.length,
    classifiedStudentContentsCount: classifiedStudentContents.length,
    classifiedRecommendedContentsCount: classifiedRecommendedContents.length,
    totalClassifiedCount: classifiedStudentContents.length + classifiedRecommendedContents.length,
    missingCount: contentsForClassification.length - (classifiedStudentContents.length + classifiedRecommendedContents.length),
  });

  // 콘텐츠 정보를 Map으로 변환하여 빠른 조회 (content_id를 키로 사용)
  const contentsMap = new Map(
    [...classifiedStudentContents, ...classifiedRecommendedContents].map((c) => [c.content_id, c])
  );

  // 플랜 그룹 데이터를 WizardData로 변환
  // classifyPlanContents로 조회한 정보를 사용하여 콘텐츠 정보를 제대로 표시
  // 남은 단계 진행 시에는 기존 추천 콘텐츠를 제거하여 Step 4에서 새로 선택할 수 있도록 함
  // originalContents를 사용하여 master_content_id가 포함된 원본 데이터로 변환
  const contentsForWizard = originalContents || contents;
  
  // DB에서 불러온 모든 콘텐츠 정보 로깅
  console.log("[CampContinuePage] DB에서 불러온 콘텐츠 정보:", {
    groupId,
    studentId,
    totalContentsCount: contentsForWizard.length,
    contents: contentsForWizard.map((c) => ({
      content_id: c.content_id,
      content_type: c.content_type,
      is_auto_recommended: c.is_auto_recommended,
      recommendation_source: c.recommendation_source,
      // syncCreationDataToWizardData의 분류 기준에 따른 예상 분류
      willBeStudentContent: !(c.is_auto_recommended || c.recommendation_source),
      willBeRecommendedContent: !!(c.is_auto_recommended || c.recommendation_source),
    })),
  });
  
  // 모든 콘텐츠를 syncCreationDataToWizardData에 전달
  // syncCreationDataToWizardData가 학생/추천 콘텐츠로 자동 분류함
  const wizardData = syncCreationDataToWizardData({
    group,
    contents: contentsForWizard.map((c) => {
      // classifyPlanContents에서 조회한 정보를 우선적으로 사용
      const classifiedContent = contentsMap.get(c.content_id);
      
      // master_content_id 결정: 
      // 1. DB에 저장된 master_content_id (우선)
      // 2. classifyPlanContents에서 조회한 masterContentId
      // 3. 없으면 undefined
      const masterContentId = c.master_content_id || classifiedContent?.masterContentId || undefined;
      
      if (process.env.NODE_ENV === "development") {
        console.log("[CampContinuePage] 콘텐츠 변환:", {
          content_id: c.content_id,
          content_type: c.content_type,
          db_master_content_id: c.master_content_id,
          classified_masterContentId: classifiedContent?.masterContentId,
          final_master_content_id: masterContentId,
        });
      }
      
      return {
        ...c,
        // classifyPlanContents에서 조회한 정보가 있으면 사용
        // title과 subject_category를 명시적으로 전달하여 정보 손실 방지
        // master_content_id는 위에서 결정한 값 사용
        title: classifiedContent?.title || undefined,
        subject_category: classifiedContent?.subject_category || undefined,
        master_content_id: masterContentId,
      };
    }),
    exclusions,
    academySchedules,
  });
  
  // syncCreationDataToWizardData가 분류한 결과 로깅
  console.log("[CampContinuePage] syncCreationDataToWizardData 분류 결과:", {
    groupId,
    studentId,
    studentContentsCount: wizardData.student_contents.length,
    recommendedContentsCount: wizardData.recommended_contents.length,
    totalContentsCount: wizardData.student_contents.length + wizardData.recommended_contents.length,
    studentContents: wizardData.student_contents.map((c) => ({
      content_id: c.content_id,
      content_type: c.content_type,
      title: c.title,
      master_content_id: (c as any).master_content_id || null,
    })),
    recommendedContents: wizardData.recommended_contents.map((c) => {
      type ContentWithRecommendation = typeof c & {
        is_auto_recommended?: boolean;
        recommendation_source?: "auto" | "admin" | "template" | null;
      };
      const contentWithRec = c as ContentWithRecommendation;
      return {
        content_id: c.content_id,
        content_type: c.content_type,
        title: c.title,
        is_auto_recommended: contentWithRec.is_auto_recommended ?? false,
        recommendation_source: contentWithRec.recommendation_source ?? null,
        master_content_id: (c as any).master_content_id || null,
      };
    }),
  });
  
  // 남은 단계 진행 시에는 추천 콘텐츠를 제거하여 Step 4에서 새로 선택할 수 있도록 함
  // student_contents는 그대로 유지 (학생이 추가한 콘텐츠는 보존)
  // 단, 빈 배열인 경우 undefined로 설정하여 continueCampStepsForAdmin에서 기존 학생 콘텐츠가 보존되도록 함
  // (빈 배열로 설정하면 hasStudentContents가 true이지만 length > 0이 false가 되어 기존 학생 콘텐츠가 보존되지 않음)
  // recommended_contents를 undefined로 설정하여 continueCampStepsForAdmin에서 기존 추천 콘텐츠가 보존되도록 함
  // (빈 배열로 설정하면 hasRecommendedContents가 true가 되어 기존 추천 콘텐츠가 삭제됨)
  const filteredWizardData = {
    ...wizardData,
    // student_contents가 빈 배열이면 undefined로 설정하여 기존 학생 콘텐츠 보존
    // 빈 배열을 전달하면 hasStudentContents는 true이지만 length > 0이 false가 되어 보존되지 않음
    student_contents: wizardData.student_contents && wizardData.student_contents.length > 0
      ? wizardData.student_contents
      : undefined,
    recommended_contents: undefined, // undefined로 설정하여 기존 추천 콘텐츠 보존 (Step 4에서 새로 선택 가능)
  };
  
  // 필터링 후 최종 결과 로깅
  const recommendedContentsArray = Array.isArray(filteredWizardData.recommended_contents) 
    ? filteredWizardData.recommended_contents 
    : [];
  console.log("[CampContinuePage] 필터링 후 최종 결과:", {
    groupId,
    studentId,
    originalStudentContentsCount: wizardData.student_contents.length,
    finalStudentContentsCount: filteredWizardData.student_contents?.length ?? 0,
    finalRecommendedContentsCount: recommendedContentsArray.length,
    originalRecommendedContentsCount: wizardData.recommended_contents.length,
    studentContentsWillBePreserved: filteredWizardData.student_contents === undefined,
    recommendedContentsWillBePreserved: filteredWizardData.recommended_contents === undefined,
    finalStudentContents: filteredWizardData.student_contents?.map((c) => ({
      content_id: c.content_id,
      content_type: c.content_type,
      title: c.title,
    })) || [],
  });

  // 템플릿 제외일과 학원 일정에 source, is_locked 필드 추가
  if (filteredWizardData.exclusions) {
    type ExclusionWithSource = PlanExclusion & {
      source?: "student" | "template";
      is_locked?: boolean;
    };
    
    filteredWizardData.exclusions = filteredWizardData.exclusions.map((exclusion) => {
      const exclusionWithSource = exclusion as ExclusionWithSource;
      return {
        ...exclusion,
        source: exclusionWithSource.source ?? ("student" as const),
        is_locked: exclusionWithSource.is_locked ?? false,
      };
    });
  }

  if (filteredWizardData.academy_schedules) {
    type AcademyScheduleWithSource = AcademySchedule & {
      source?: "student" | "template";
      is_locked?: boolean;
    };
    
    filteredWizardData.academy_schedules = filteredWizardData.academy_schedules.map(
      (schedule) => {
        const scheduleWithSource = schedule as AcademyScheduleWithSource;
        return {
          ...schedule,
          source: scheduleWithSource.source ?? ("student" as const),
          is_locked: scheduleWithSource.is_locked ?? false,
        };
      }
    );
  }

  // URL에서 step 파라미터가 있으면 해당 단계부터 시작, 없으면 Step 4부터 시작
  const startStep = step ? parseInt(step, 10) : 4;
  const validStartStep = startStep >= 4 && startStep <= 7 ? startStep : 4;

  // Step 4부터 시작하도록 설정 (콘텐츠 추가하기 단계)
  const initialData = {
    ...filteredWizardData, // 필터링된 wizardData 사용
    templateId: templateId, // URL의 templateId 사용 (관리자 페이지로 돌아가기 위해)
    groupId: group.id,
    // 템플릿 블록 세트 ID 설정 (Step1BasicInfo에서 자동 선택하기 위해)
    block_set_id: templateBlockSet?.id || filteredWizardData.block_set_id || "",
    _startStep: validStartStep, // URL 파라미터에서 받은 step 또는 기본값 4
    student_id: studentId, // Step6FinalReview에서 API 호출 시 사용
  };

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="flex flex-col gap-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2 flex-1">
            <p className="text-sm font-medium text-gray-500">캠프 관리</p>
            <h1 className="text-3xl font-semibold text-gray-900">
              남은 단계 진행하기
            </h1>
            <p className="text-sm text-gray-500">
              학생이 등록한 콘텐츠를 확인하고, 추천 콘텐츠를 선택하여 조율하세요.
            </p>
          </div>
          <Link
            href={`/admin/camp-templates/${templateId}/participants`}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            참여자 목록으로 돌아가기
          </Link>
        </div>
      </div>

      {/* 학생 정보 및 진행 상태 카드 */}
      <div className="flex flex-col gap-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2 flex-1">
            <h3 className="font-semibold text-blue-900">학생 정보</h3>
            <p className="text-sm text-blue-700">
              {studentInfo?.name || "학생"} 
              {studentInfo?.grade && studentInfo?.class 
                ? ` (${studentInfo.grade}학년 ${studentInfo.class}반)`
                : ""}
            </p>
            <p className="text-xs text-blue-600">
              플랜 그룹: {group.name || "이름 없음"}
            </p>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
              Step 4-7 진행 중
            </span>
          </div>
        </div>
      </div>

      <PlanGroupWizard
        initialBlockSets={blockSets || []}
        initialContents={{
          books,
          lectures,
          custom,
        }}
        initialData={initialData}
        isEditMode={true}
        isCampMode={true}
        isAdminMode={true}
        isAdminContinueMode={true}
      />
    </section>
  );
}

