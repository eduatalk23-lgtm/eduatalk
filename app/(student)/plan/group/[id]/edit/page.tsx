import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { PlanGroupWizard } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { getPlanGroupWithDetails } from "@/lib/data/planGroups";
import { PlanStatusManager } from "@/lib/plan/statusManager";
import {
  fetchAllStudentContents,
  classifyPlanContents,
} from "@/lib/data/planContents";

type EditPlanGroupPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditPlanGroupPage({ params }: EditPlanGroupPageProps) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 플랜 그룹 및 관련 데이터 조회
  const { group, contents, exclusions, academySchedules } = await getPlanGroupWithDetails(
    id,
    user.id
  );

  if (!group) {
    notFound();
  }

  // 수정 권한 확인
  if (!PlanStatusManager.canEdit(group.status as any)) {
    redirect(`/plan/group/${id}`);
  }

  // 블록 세트 목록 조회
  const { data: blockSetsData } = await supabase
    .from("student_block_sets")
    .select("id, name")
    .eq("student_id", user.id)
    .order("display_order", { ascending: true });

  const blockSets = blockSetsData
    ? await Promise.all(
        blockSetsData.map(async (set) => {
          const { data: blocks } = await supabase
            .from("student_block_schedule")
            .select("id, day_of_week, start_time, end_time")
            .eq("block_set_id", set.id)
            .eq("student_id", user.id)
            .order("day_of_week", { ascending: true })
            .order("start_time", { ascending: true });

          return {
            ...set,
            blocks:
              (blocks as Array<{
                id: string;
                day_of_week: number;
                start_time: string;
                end_time: string;
              }>) ?? [],
          };
        })
      )
    : [];

  // 콘텐츠 목록 조회 (통합 함수 사용)
  const { books, lectures, custom } = await fetchAllStudentContents(user.id);

  // 콘텐츠 분류 (통합 함수 사용)
  const { studentContents, recommendedContents } =
    await classifyPlanContents(contents, user.id);

  // 초기 데이터 구성
  const initialData = {
    groupId: group.id,
    name: group.name || "",
    plan_purpose: group.plan_purpose || "",
    scheduler_type: group.scheduler_type || "",
    period_start: group.period_start,
    period_end: group.period_end,
    target_date: group.target_date || undefined,
    block_set_id: group.block_set_id || "",
    student_contents: studentContents.map((c) => ({
      content_type: c.content_type as "book" | "lecture" | "custom",
      content_id: c.masterContentId || c.content_id, // 추천 콘텐츠의 경우 원본 마스터 콘텐츠 ID 사용
      start_range: c.start_range,
      end_range: c.end_range,
      title: c.title,
      subject_category: c.subject_category,
    })),
    recommended_contents: recommendedContents.map((c) => ({
      content_type: c.content_type as "book" | "lecture" | "custom",
      content_id: c.content_id, // 이미 마스터 콘텐츠 ID
      start_range: c.start_range,
      end_range: c.end_range,
      title: c.title,
      subject_category: c.subject_category,
    })),
    exclusions: exclusions.map((e) => ({
      exclusion_date: e.exclusion_date,
      exclusion_type: e.exclusion_type as "휴가" | "개인사정" | "휴일지정" | "기타",
      reason: e.reason || undefined,
    })),
    academy_schedules: academySchedules.map((s) => ({
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      academy_name: s.academy_name || undefined,
      subject: s.subject || undefined,
    })),
  };

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="mb-8">
        <div>
          <p className="text-sm font-medium text-gray-500">학습 플랜</p>
          <h1 className="text-3xl font-semibold text-gray-900">
            플랜 그룹 수정
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            플랜 그룹의 설정을 수정할 수 있습니다.
          </p>
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
      />
    </section>
  );
}

async function fetchBooks(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<Array<{ id: string; title: string; subtitle?: string | null }>> {
  try {
    const { data, error } = await supabase
      .from("books")
      .select("id, title, subject")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (
      data?.map((book) => ({
        id: book.id,
        title: book.title || "제목 없음",
        subtitle: book.subject || null,
      })) || []
    );
  } catch (err) {
    console.error("[plan/group/edit] 책 목록 조회 실패", err);
    return [];
  }
}

async function fetchLectures(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<Array<{ id: string; title: string; subtitle?: string | null }>> {
  try {
    const { data, error } = await supabase
      .from("lectures")
      .select("id, title, subject")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (
      data?.map((lecture) => ({
        id: lecture.id,
        title: lecture.title || "제목 없음",
        subtitle: lecture.subject || null,
      })) || []
    );
  } catch (err) {
    console.error("[plan/group/edit] 강의 목록 조회 실패", err);
    return [];
  }
}

async function fetchCustomContents(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<Array<{ id: string; title: string; subtitle?: string | null }>> {
  try {
    const { data, error } = await supabase
      .from("student_custom_contents")
      .select("id, title, content_type")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (
      data?.map((custom) => ({
        id: custom.id,
        title: custom.title || "커스텀 콘텐츠",
        subtitle: custom.content_type || null,
      })) || []
    );
  } catch (err) {
    console.error("[plan/group/edit] 커스텀 콘텐츠 조회 실패", err);
    return [];
  }
}

