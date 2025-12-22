/**
 * 캠프 학습 데이터 레이어
 * 캠프 템플릿별 학습 기록 조회 및 데이터 제공
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCampTemplate } from "./campTemplates";
import { getCampInvitationsForTemplate } from "./campTemplates";
import type { Plan } from "@/lib/types/plan/domain";
import type { PlanWithStudent, DatePlanDetail } from "@/lib/types/camp/learning";

/**
 * 캠프 기간 학습 기록 조회 (학생 정보 포함)
 * 템플릿에 초대된 모든 학생의 플랜을 조회합니다.
 */
export async function getCampLearningRecords(
  templateId: string,
  startDate: string,
  endDate: string
): Promise<PlanWithStudent[]> {
  const supabase = await createSupabaseServerClient();

  // 템플릿 정보 조회
  const template = await getCampTemplate(templateId);
  if (!template) {
    return [];
  }

  // 캠프 초대 목록 조회 (참여자 확인)
  const invitations = await getCampInvitationsForTemplate(templateId);
  const participantStudentIds = invitations
    .filter((inv) => inv.status === "accepted")
    .map((inv) => inv.student_id);

  if (participantStudentIds.length === 0) {
    return [];
  }

  // 플랜 그룹 조회 (캠프 관련)
  const { data: planGroups, error: planGroupsError } = await supabase
    .from("plan_groups")
    .select("id, student_id")
    .eq("camp_template_id", templateId)
    .eq("plan_type", "camp")
    .in("student_id", participantStudentIds)
    .is("deleted_at", null);

  if (planGroupsError || !planGroups || planGroups.length === 0) {
    return [];
  }

  const planGroupIds = planGroups.map((pg) => pg.id);
  const planGroupMap = new Map(
    planGroups.map((pg) => [pg.student_id, pg.id])
  );

  // 플랜 조회 (학생 정보 JOIN)
  const { data: plans, error: plansError } = await supabase
    .from("student_plan")
    .select(
      `
      *,
      students:student_id (
        name
      )
    `
    )
    .in("plan_group_id", planGroupIds)
    .gte("plan_date", startDate)
    .lte("plan_date", endDate)
    .order("plan_date", { ascending: true })
    .order("block_index", { ascending: true });

  if (plansError) {
    console.error("[data/campLearning] 플랜 조회 실패", {
      templateId,
      startDate,
      endDate,
      error: plansError.message,
      errorCode: plansError.code,
    });
    return [];
  }

  // 데이터 변환 (JOIN 결과를 평탄화)
  const records: PlanWithStudent[] = ((plans || []) as any[]).map(
    (plan: any) => {
      const studentInfo = Array.isArray(plan.students)
        ? plan.students[0]
        : plan.students;

      return {
        ...plan,
        student_name: studentInfo?.name || null,
      } as PlanWithStudent;
    }
  );

  return records;
}

/**
 * 특정 날짜의 플랜 상세 조회
 * @param templateId 캠프 템플릿 ID
 * @param date 날짜 (YYYY-MM-DD)
 * @param studentIds 선택적 학생 ID 필터 (없으면 모든 참여자)
 */
export async function getCampDatePlans(
  templateId: string,
  date: string,
  studentIds?: string[]
): Promise<DatePlanDetail> {
  const supabase = await createSupabaseServerClient();

  // 템플릿 정보 조회
  const template = await getCampTemplate(templateId);
  if (!template) {
    return { date, plans: [] };
  }

  // 캠프 초대 목록 조회 (참여자 확인)
  const invitations = await getCampInvitationsForTemplate(templateId);
  let participantStudentIds = invitations
    .filter((inv) => inv.status === "accepted")
    .map((inv) => inv.student_id);

  // 학생 필터 적용
  if (studentIds && studentIds.length > 0) {
    participantStudentIds = participantStudentIds.filter((id) =>
      studentIds.includes(id)
    );
  }

  if (participantStudentIds.length === 0) {
    return { date, plans: [] };
  }

  // 플랜 그룹 조회
  const { data: planGroups, error: planGroupsError } = await supabase
    .from("plan_groups")
    .select("id, student_id")
    .eq("camp_template_id", templateId)
    .eq("plan_type", "camp")
    .in("student_id", participantStudentIds)
    .is("deleted_at", null);

  if (planGroupsError || !planGroups || planGroups.length === 0) {
    return { date, plans: [] };
  }

  const planGroupIds = planGroups.map((pg) => pg.id);
  const studentIdMap = new Map(
    planGroups.map((pg) => [pg.id, pg.student_id])
  );

  // 플랜 조회 (학생 정보 및 콘텐츠 정보 JOIN)
  const { data: plans, error: plansError } = await supabase
    .from("student_plan")
    .select(
      `
      id,
      student_id,
      plan_date,
      block_index,
      content_type,
      content_id,
      planned_start_page_or_time,
      planned_end_page_or_time,
      completed_amount,
      progress,
      students:student_id (
        name
      )
    `
    )
    .in("plan_group_id", planGroupIds)
    .eq("plan_date", date)
    .order("block_index", { ascending: true });

  if (plansError) {
    console.error("[data/campLearning] 날짜별 플랜 조회 실패", {
      templateId,
      date,
      error: plansError.message,
    });
    return { date, plans: [] };
  }

  // 학습 세션 조회 (학습 시간 계산용)
  const planIds = (plans || []).map((p: any) => p.id);
  let studySessions: Array<{
    plan_id: string;
    duration_seconds: number | null;
  }> = [];

  if (planIds.length > 0) {
    const { data: sessions, error: sessionsError } = await supabase
      .from("student_study_sessions")
      .select("plan_id, duration_seconds")
      .in("plan_id", planIds);

    if (!sessionsError && sessions) {
      studySessions = sessions as Array<{
        plan_id: string;
        duration_seconds: number | null;
      }>;
    }
  }

  // 플랜별 학습 시간 계산
  const planStudyTimeMap = new Map<string, number>();
  studySessions.forEach((session) => {
    if (session.plan_id && session.duration_seconds) {
      const current = planStudyTimeMap.get(session.plan_id) || 0;
      planStudyTimeMap.set(
        session.plan_id,
        current + Math.floor(session.duration_seconds / 60)
      );
    }
  });

  // 콘텐츠 정보 조회 (배치 조회로 N+1 문제 방지)
  const contentMap = new Map<string, { title: string | null; subject: string | null }>();
  
  const bookIds: string[] = [];
  const lectureIds: string[] = [];
  const customIds: string[] = [];

  (plans || []).forEach((plan: any) => {
    if (plan.content_type === "book" && plan.content_id) {
      bookIds.push(plan.content_id);
    } else if (plan.content_type === "lecture" && plan.content_id) {
      lectureIds.push(plan.content_id);
    } else if (plan.content_type === "custom" && plan.content_id) {
      customIds.push(plan.content_id);
    }
  });

  // 배치 조회
  if (bookIds.length > 0) {
    const { data: books } = await supabase
      .from("books")
      .select("id, title, subject")
      .in("id", bookIds);
    books?.forEach((book) => {
      contentMap.set(`book:${book.id}`, {
        title: book.title || null,
        subject: book.subject || null,
      });
    });
  }

  if (lectureIds.length > 0) {
    const { data: lectures } = await supabase
      .from("lectures")
      .select("id, title, subject")
      .in("id", lectureIds);
    lectures?.forEach((lecture) => {
      contentMap.set(`lecture:${lecture.id}`, {
        title: lecture.title || null,
        subject: lecture.subject || null,
      });
    });
  }

  if (customIds.length > 0) {
    const { data: customs } = await supabase
      .from("student_custom_contents")
      .select("id, title, subject")
      .in("id", customIds);
    customs?.forEach((custom) => {
      contentMap.set(`custom:${custom.id}`, {
        title: custom.title || null,
        subject: custom.subject || null,
      });
    });
  }

  // 데이터 변환
  const planDetails = ((plans || []) as any[]).map((plan: any) => {
    const studentInfo = Array.isArray(plan.students)
      ? plan.students[0]
      : plan.students;

    const contentKey = plan.content_type && plan.content_id
      ? `${plan.content_type}:${plan.content_id}`
      : null;
    const contentInfo = contentKey ? contentMap.get(contentKey) : null;

    // 계획 범위 포맷팅
    let plannedRange = "-";
    if (
      plan.planned_start_page_or_time !== null &&
      plan.planned_end_page_or_time !== null
    ) {
      if (plan.content_type === "book") {
        plannedRange = `${plan.planned_start_page_or_time}-${plan.planned_end_page_or_time}페이지`;
      } else if (plan.content_type === "lecture" || plan.content_type === "custom") {
        // 시간 형식으로 변환 (분 단위)
        const startMin = Math.floor(plan.planned_start_page_or_time / 60);
        const startSec = plan.planned_start_page_or_time % 60;
        const endMin = Math.floor(plan.planned_end_page_or_time / 60);
        const endSec = plan.planned_end_page_or_time % 60;
        plannedRange = `${String(startMin).padStart(2, "0")}:${String(startSec).padStart(2, "0")}-${String(endMin).padStart(2, "0")}:${String(endSec).padStart(2, "0")}`;
      }
    }

    // 상태 판단
    let status: "completed" | "in_progress" | "not_started" = "not_started";
    if (plan.completed_amount !== null && plan.completed_amount > 0) {
      if (plan.progress !== null && plan.progress >= 100) {
        status = "completed";
      } else {
        status = "in_progress";
      }
    }

    return {
      student_id: plan.student_id,
      student_name: studentInfo?.name || "이름 없음",
      plan_id: plan.id,
      content_title: contentInfo?.title || null,
      content_subject: contentInfo?.subject || null,
      block_index: plan.block_index,
      planned_range: plannedRange,
      completed_amount: plan.completed_amount,
      progress: plan.progress || 0,
      study_minutes: planStudyTimeMap.get(plan.id) || 0,
      status,
    };
  });

  return {
    date,
    plans: planDetails,
  };
}

/**
 * 학생별 학습 플랜 조회
 */
export async function getCampStudentPlans(
  templateId: string,
  studentId: string,
  startDate: string,
  endDate: string
): Promise<Plan[]> {
  const supabase = await createSupabaseServerClient();

  // 템플릿 정보 조회
  const template = await getCampTemplate(templateId);
  if (!template) {
    return [];
  }

  // 플랜 그룹 조회
  const { data: planGroup, error: planGroupError } = await supabase
    .from("plan_groups")
    .select("id")
    .eq("camp_template_id", templateId)
    .eq("plan_type", "camp")
    .eq("student_id", studentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (planGroupError || !planGroup) {
    return [];
  }

  // 플랜 조회
  const { data: plans, error: plansError } = await supabase
    .from("student_plan")
    .select("*")
    .eq("plan_group_id", planGroup.id)
    .gte("plan_date", startDate)
    .lte("plan_date", endDate)
    .order("plan_date", { ascending: true })
    .order("block_index", { ascending: true });

  if (plansError) {
    console.error("[data/campLearning] 학생별 플랜 조회 실패", {
      templateId,
      studentId,
      startDate,
      endDate,
      error: plansError.message,
    });
    return [];
  }

  return (plans || []) as Plan[];
}

