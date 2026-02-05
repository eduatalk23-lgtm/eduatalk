
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlanGroupsForStudent } from "@/lib/data/planGroups";
import BlockManagementContainer from "./_components/BlockManagementContainer";
import { getContainerClass } from "@/lib/constants/layout";

export default async function BlocksPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 학생 정보 조회 (활성 세트 포함)
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("active_block_set_id, tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  if (studentError && studentError.code !== "PGRST116") {
    console.error("학생 정보 조회 실패:", studentError);
  }

  // 블록 세트와 블록을 조인하여 한 번에 조회 (N+1 쿼리 방지)
  const { data: blockSetsWithBlocks, error: blockSetsError } = await supabase
    .from("student_block_sets")
    .select(`
      id, name, description, display_order,
      student_block_schedule(id, day_of_week, start_time, end_time)
    `)
    .eq("student_id", user.id)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (blockSetsError) {
    console.error("블록 세트 조회 실패:", blockSetsError);
  }

  // 조인 데이터를 기존 형식으로 변환
  type BlockSetWithSchedule = {
    id: string;
    name: string;
    description: string | null;
    display_order: number;
    student_block_schedule: Array<{
      id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
    }> | null;
  };

  const blockSets = (blockSetsWithBlocks as BlockSetWithSchedule[] | null)?.map((set) => {
    // 블록을 요일, 시작 시간 순으로 정렬
    const sortedBlocks = (set.student_block_schedule ?? []).sort((a, b) => {
      if (a.day_of_week !== b.day_of_week) {
        return a.day_of_week - b.day_of_week;
      }
      return a.start_time.localeCompare(b.start_time);
    });

    return {
      id: set.id,
      name: set.name,
      description: set.description,
      display_order: set.display_order,
      blocks: sortedBlocks,
    };
  }) ?? [];

  // 활성 세트 결정
  let activeSetId: string | null = student?.active_block_set_id ?? null;
  
  // 활성 세트가 없고 블록 세트가 있으면, 블록이 있는 첫 번째 세트를 활성 세트로 사용
  if (!activeSetId && blockSets && blockSets.length > 0) {
    for (const set of blockSets) {
      if (set.blocks && set.blocks.length > 0) {
        activeSetId = set.id;
        // 활성 세트로 설정
        const { error: updateError } = await supabase
          .from("students")
          .update({ active_block_set_id: set.id })
          .eq("id", user.id);
        
        if (updateError) {
          console.error("활성 세트 업데이트 실패:", updateError);
        }
        break;
      }
    }
  }

  // 활성 세트의 블록들만 조회
  const blocksQuery = supabase
    .from("student_block_schedule")
    .select("id, day_of_week, start_time, end_time, block_set_id")
    .eq("student_id", user.id)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (activeSetId) {
    blocksQuery.eq("block_set_id", activeSetId);
  }

  const { data: blocks, error: blocksError } = await blocksQuery;
  
  if (blocksError) {
    console.error("블록 조회 실패:", blocksError);
  }

  // 플랜 그룹 목록 조회 (학습 제외 일정, 학원 일정 표시용)
  const planGroups = await getPlanGroupsForStudent({
    studentId: user.id,
    tenantId: student?.tenant_id ?? null,
    includeDeleted: false,
  });

  return (
    <section className={getContainerClass("DASHBOARD", "md")}>
      <BlockManagementContainer
        studentId={user.id}
        initialBlockSets={blockSets}
        initialActiveSetId={activeSetId}
        initialBlocks={(blocks as Array<{ id: string; day_of_week: number; start_time: string; end_time: string; block_set_id: string | null }>) ?? []}
        initialPlanGroups={planGroups}
      />
    </section>
  );
}
