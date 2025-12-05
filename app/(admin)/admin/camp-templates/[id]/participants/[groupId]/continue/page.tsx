import { redirect, notFound } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getCampPlanGroupForReview } from "@/app/(admin)/actions/campTemplateActions";
import { PlanGroupWizard } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { fetchAllStudentContents, classifyPlanContents } from "@/lib/data/planContents";
import { fetchBlockSetsWithBlocks } from "@/lib/data/blockSets";
import { syncCreationDataToWizardData } from "@/lib/utils/planGroupDataSync";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";

type CampContinuePageProps = {
  params: Promise<{ id: string; groupId: string }>;
};

export default async function CampContinuePage({
  params,
}: CampContinuePageProps) {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  const { id: templateId, groupId } = await params;

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
  const supabase = await createSupabaseServerClient();
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

      if (templateBlockSetData?.template_data) {
        const templateData = templateBlockSetData.template_data as any;
        tenantBlockSetId = templateData.block_set_id || null;
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
  
  // 필터링 전 콘텐츠 개수 및 상세 정보 로깅
  console.log("[CampContinuePage] 필터링 전 콘텐츠 정보:", {
    groupId,
    studentId,
    totalContentsCount: contentsForWizard.length,
    contents: contentsForWizard.map((c) => ({
      content_id: c.content_id,
      content_type: c.content_type,
      is_auto_recommended: c.is_auto_recommended,
      recommendation_source: c.recommendation_source,
      isStudentContent: c.is_auto_recommended === false && (!c.recommendation_source || c.recommendation_source === null),
      isRecommendedContent: c.is_auto_recommended === true || (c.recommendation_source && ["auto", "admin", "template"].includes(c.recommendation_source)),
    })),
  });
  
  // 필터링: 학생 콘텐츠는 보존하고 추천 콘텐츠만 필터링
  const filteredContents = contentsForWizard.filter((c) => {
    // 학생이 추가한 콘텐츠는 항상 포함
    // is_auto_recommended가 false이고 recommendation_source가 null이거나 없는 경우
    if (c.is_auto_recommended === false && (!c.recommendation_source || c.recommendation_source === null)) {
      return true;
    }
    
    // 추천 콘텐츠는 필터링 (제거)
    // is_auto_recommended가 true이거나 recommendation_source가 "auto", "admin", "template"인 경우
    // - is_auto_recommended: true, recommendation_source: "auto" → Step 4에서 자동 배정된 콘텐츠
    // - is_auto_recommended: false, recommendation_source: "admin" → 관리자가 일괄 적용한 콘텐츠
    // - recommendation_source: "template" → 템플릿에서 추천된 콘텐츠
    // 남은 단계 진행 시에는 Step 4에서 새로운 추천 콘텐츠를 선택할 수 있도록 함
    // DB에는 여전히 존재하지만, 위저드에서는 제외하여 Step 4에서 새로 선택 가능
    return false;
  });
  
  // 필터링 후 콘텐츠 개수 및 상세 정보 로깅
  console.log("[CampContinuePage] 필터링 후 콘텐츠 정보:", {
    groupId,
    studentId,
    filteredContentsCount: filteredContents.length,
    removedContentsCount: contentsForWizard.length - filteredContents.length,
    filteredContents: filteredContents.map((c) => ({
      content_id: c.content_id,
      content_type: c.content_type,
      is_auto_recommended: c.is_auto_recommended,
      recommendation_source: c.recommendation_source,
    })),
    removedContents: contentsForWizard
      .filter((c) => !filteredContents.some((fc) => fc.content_id === c.content_id))
      .map((c) => ({
        content_id: c.content_id,
        content_type: c.content_type,
        is_auto_recommended: c.is_auto_recommended,
        recommendation_source: c.recommendation_source,
      })),
  });
  
  const wizardData = syncCreationDataToWizardData({
    group,
    contents: filteredContents
      .map((c) => {
        // classifyPlanContents에서 조회한 정보를 우선적으로 사용
        const classifiedContent = contentsMap.get(c.content_id);
        return {
          ...c,
          // classifyPlanContents에서 조회한 정보가 있으면 사용
          // title과 subject_category를 명시적으로 전달하여 정보 손실 방지
          // master_content_id는 원본 데이터(c.master_content_id)를 우선 사용
          title: classifiedContent?.title || undefined,
          subject_category: classifiedContent?.subject_category || undefined,
          master_content_id: c.master_content_id || classifiedContent?.masterContentId || undefined,
        };
      }),
    exclusions,
    academySchedules,
  });

  // 템플릿 제외일과 학원 일정에 source, is_locked 필드 추가
  if (wizardData.exclusions) {
    wizardData.exclusions = wizardData.exclusions.map((exclusion) => ({
      ...exclusion,
      source: (exclusion as any).source || ("student" as const),
      is_locked: (exclusion as any).is_locked || false,
    }));
  }

  if (wizardData.academy_schedules) {
    wizardData.academy_schedules = wizardData.academy_schedules.map(
      (schedule) => ({
        ...schedule,
        source: (schedule as any).source || ("student" as const),
        is_locked: (schedule as any).is_locked || false,
      })
    );
  }

  // Step 4부터 시작하도록 설정 (콘텐츠 추가하기 단계)
  const initialData = {
    ...wizardData,
    templateId: templateId, // URL의 templateId 사용 (관리자 페이지로 돌아가기 위해)
    groupId: group.id,
    // 템플릿 블록 세트 ID 설정 (Step1BasicInfo에서 자동 선택하기 위해)
    block_set_id: templateBlockSet?.id || wizardData.block_set_id || "",
    _startStep: 4, // Step 4 (콘텐츠 추가하기)부터 시작
    student_id: studentId, // Step6FinalReview에서 API 호출 시 사용
  };

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500">캠프 관리</p>
            <h1 className="text-3xl font-semibold text-gray-900">
              남은 단계 진행하기
            </h1>
            <p className="mt-2 text-sm text-gray-500">
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
      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900">학생 정보</h3>
            <p className="mt-1 text-sm text-blue-700">
              {studentInfo?.name || "학생"} 
              {studentInfo?.grade && studentInfo?.class 
                ? ` (${studentInfo.grade}학년 ${studentInfo.class}반)`
                : ""}
            </p>
            <p className="mt-2 text-xs text-blue-600">
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

