/**
 * 캠프 학습 통계 데이터 레이어
 * 캠프 템플릿별 학습 시간 및 진행률 통계 계산
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCampTemplate } from "./campTemplates";
import { getCampInvitationsForTemplate } from "./campTemplates";
import type { CampLearningStats, ParticipantLearningStats } from "@/lib/domains/camp/types";

/**
 * 캠프별 학습 통계 계산
 */
export async function getCampLearningStats(
  templateId: string,
  startDate: string,
  endDate: string
): Promise<CampLearningStats | null> {
  const template = await getCampTemplate(templateId);
  if (!template) {
    return null;
  }

  // 캠프 초대 목록 조회 (참여자 확인)
  const invitations = await getCampInvitationsForTemplate(templateId);
  const acceptedInvitations = invitations.filter(
    (inv) => inv.status === "accepted"
  );

  if (acceptedInvitations.length === 0) {
    return {
      template_id: templateId,
      template_name: template.name,
      total_study_minutes: 0,
      average_study_minutes_per_participant: 0,
      participant_stats: [],
    };
  }

  const participantStudentIds = acceptedInvitations.map((inv) => inv.student_id);

  // 플랜 그룹 조회 (캠프 관련)
  const supabase = await createSupabaseServerClient();
  const { data: planGroups, error: planGroupsError } = await supabase
    .from("plan_groups")
    .select("id, student_id")
    .eq("camp_template_id", templateId)
    .eq("plan_type", "camp")
    .in("student_id", participantStudentIds)
    .is("deleted_at", null);

  if (planGroupsError) {
    console.error("[data/campLearningStats] 플랜 그룹 조회 실패", {
      templateId,
      error: planGroupsError.message,
    });
    return {
      template_id: templateId,
      template_name: template.name,
      total_study_minutes: 0,
      average_study_minutes_per_participant: 0,
      participant_stats: [],
    };
  }

  const planGroupIds = (planGroups || []).map((pg) => pg.id);
  const planGroupMap = new Map(
    (planGroups || []).map((pg) => [pg.student_id, pg.id])
  );

  if (planGroupIds.length === 0) {
    return {
      template_id: templateId,
      template_name: template.name,
      total_study_minutes: 0,
      average_study_minutes_per_participant: 0,
      participant_stats: [],
    };
  }

  // 학습 세션 조회 (플랜 ID로 필터링)
  const { data: plans, error: plansError } = await supabase
    .from("student_plan")
    .select("id, student_id, plan_date, completed_amount, subject")
    .in("plan_group_id", planGroupIds)
    .gte("plan_date", startDate)
    .lte("plan_date", endDate);

  if (plansError) {
    console.error("[data/campLearningStats] 플랜 조회 실패", {
      templateId,
      error: plansError.message,
    });
  }

  const planIds = (plans || []).map((p) => p.id);

  // 학습 세션 조회
  let studySessions: Array<{
    plan_id: string;
    duration_seconds: number | null;
  }> = [];

  if (planIds.length > 0) {
    const { data: sessions, error: sessionsError } = await supabase
      .from("student_study_sessions")
      .select("plan_id, duration_seconds")
      .in("plan_id", planIds);

    if (sessionsError) {
      console.error("[data/campLearningStats] 학습 세션 조회 실패", {
        templateId,
        error: sessionsError.message,
      });
    } else {
      studySessions = (sessions || []) as Array<{
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

  // 학생별 통계 계산
  const participantStats = await Promise.all(
    acceptedInvitations.map(async (invitation) => {
      const studentId = invitation.student_id;
      const studentPlans = (plans || []).filter((p) => p.student_id === studentId);

      // 학습 시간 계산
      let studyMinutes = 0;
      studentPlans.forEach((plan) => {
        const planMinutes = planStudyTimeMap.get(plan.id) || 0;
        studyMinutes += planMinutes;
      });

      // 플랜 완료율 계산
      const totalPlans = studentPlans.length;
      const completedPlans = studentPlans.filter(
        (p) => p.completed_amount !== null && p.completed_amount > 0
      ).length;
      const planCompletionRate =
        totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;

      // 과목별 학습 시간 분포
      const subjectDistribution: Record<string, number> = {};
      studentPlans.forEach((plan) => {
        if (plan.subject) {
          const planMinutes = planStudyTimeMap.get(plan.id) || 0;
          const current = subjectDistribution[plan.subject] || 0;
          subjectDistribution[plan.subject] = current + planMinutes;
        }
      });

      return {
        student_id: studentId,
        student_name: invitation.student_name || "이름 없음",
        study_minutes: studyMinutes,
        plan_completion_rate: planCompletionRate,
        subject_distribution: subjectDistribution,
      };
    })
  );

  // 전체 통계 계산
  const totalStudyMinutes = participantStats.reduce(
    (sum, stat) => sum + stat.study_minutes,
    0
  );
  const averageStudyMinutes =
    participantStats.length > 0
      ? Math.round(totalStudyMinutes / participantStats.length)
      : 0;

  return {
    template_id: templateId,
    template_name: template.name,
    total_study_minutes: totalStudyMinutes,
    average_study_minutes_per_participant: averageStudyMinutes,
    participant_stats: participantStats,
  };
}

/**
 * 참여자별 학습 통계 조회
 */
export async function getParticipantLearningStats(
  templateId: string,
  studentId: string,
  startDate: string,
  endDate: string
): Promise<ParticipantLearningStats | null> {
  const supabase = await createSupabaseServerClient();

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
    return null;
  }

  // 플랜 조회
  const { data: plans, error: plansError } = await supabase
    .from("student_plan")
    .select("id, plan_date, completed_amount, subject")
    .eq("plan_group_id", planGroup.id)
    .gte("plan_date", startDate)
    .lte("plan_date", endDate);

  if (plansError) {
    console.error("[data/campLearningStats] 플랜 조회 실패", {
      templateId,
      studentId,
      error: plansError.message,
    });
    return null;
  }

  const planIds = (plans || []).map((p) => p.id);

  // 학습 세션 조회
  let studySessions: Array<{
    plan_id: string;
    duration_seconds: number | null;
  }> = [];

  if (planIds.length > 0) {
    const { data: sessions, error: sessionsError } = await supabase
      .from("student_study_sessions")
      .select("plan_id, duration_seconds")
      .in("plan_id", planIds);

    if (sessionsError) {
      console.error("[data/campLearningStats] 학습 세션 조회 실패", {
        templateId,
        studentId,
        error: sessionsError.message,
      });
    } else {
      studySessions = (sessions || []) as Array<{
        plan_id: string;
        duration_seconds: number | null;
      }>;
    }
  }

  // 학습 시간 계산
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

  let studyMinutes = 0;
  (plans || []).forEach((plan) => {
    const planMinutes = planStudyTimeMap.get(plan.id) || 0;
    studyMinutes += planMinutes;
  });

  // 플랜 완료율 계산
  const totalPlans = (plans || []).length;
  const completedPlans = (plans || []).filter(
    (p) => p.completed_amount !== null && p.completed_amount > 0
  ).length;
  const planCompletionRate =
    totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;

  // 과목별 학습 시간 분포
  const subjectDistribution: Record<string, number> = {};
  (plans || []).forEach((plan) => {
    if (plan.subject) {
      const planMinutes = planStudyTimeMap.get(plan.id) || 0;
      const current = subjectDistribution[plan.subject] || 0;
      subjectDistribution[plan.subject] = current + planMinutes;
    }
  });

  // 학생 정보 조회
  const { data: student } = await supabase
    .from("students")
    .select("name")
    .eq("id", studentId)
    .maybeSingle();

  return {
    student_id: studentId,
    student_name: student?.name || "이름 없음",
    study_minutes: studyMinutes,
    plan_completion_rate: planCompletionRate,
    subject_distribution: subjectDistribution,
    total_plans: totalPlans,
    completed_plans: completedPlans,
  };
}

