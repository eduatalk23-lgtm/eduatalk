// ============================================
// Phase 6: 가이드 배정 컨텍스트 빌더
// AI 프롬프트에 배정 가이드 정보를 주입하는 유틸리티
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";

interface AssignmentForPrompt {
  guide_title: string;
  guide_type: string | null;
  status: string;
  target_subject_name: string | null;
  target_activity_type: string | null;
  ai_recommendation_reason: string | null;
}

interface GuideAssignmentRow {
  status: string;
  target_subject_id: string | null;
  target_activity_type: string | null;
  ai_recommendation_reason: string | null;
  exploration_guides: {
    title: string;
    guide_type: string | null;
    quality_tier: string | null;
    quality_score: number | null;
    difficulty_level: string | null;
    exploration_guide_topic_clusters: { name: string } | null;
  };
}

/**
 * 학생의 가이드 배정 정보를 AI 프롬프트 섹션으로 변환
 * @param studentId 학생 UUID
 * @param context "guide" | "summary" | "strategy" — 프롬프트 맥락에 따라 instruction 분기
 */
export async function buildGuideContextSection(
  studentId: string,
  context: "guide" | "summary" | "strategy",
): Promise<string> {
  const supabase = await createSupabaseServerClient();

  const { data: assignments } = await supabase
    .from("exploration_guide_assignments")
    .select(`
      status,
      target_subject_id,
      target_activity_type,
      ai_recommendation_reason,
      exploration_guides!inner ( title, guide_type, quality_tier, quality_score, difficulty_level, exploration_guide_topic_clusters ( name ) )
    `)
    .eq("student_id", studentId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<GuideAssignmentRow[]>();

  if (!assignments || assignments.length === 0) return "";

  // subject_id → 과목명 매핑
  const subjectIds = assignments
    .map((a) => a.target_subject_id)
    .filter((id): id is string => id != null);

  const subjectMap = new Map<string, string>();
  if (subjectIds.length > 0) {
    const { data: subjects } = await supabase
      .from("subjects")
      .select("id, name")
      .in("id", [...new Set(subjectIds)]);
    for (const s of subjects ?? []) subjectMap.set(s.id, s.name);
  }

  // 배정 목록 텍스트 생성
  const lines = assignments.map((a) => {
    const guide = a.exploration_guides;
    const subjectName = a.target_subject_id ? subjectMap.get(a.target_subject_id) : null;
    const area = subjectName
      ? `세특-${subjectName}`
      : a.target_activity_type
        ? `창체-${a.target_activity_type}`
        : "미지정";
    const quality = guide.quality_score ? ` [품질:${guide.quality_score}점/${guide.quality_tier ?? "미평가"}]` : "";
    const diffLabel = guide.difficulty_level === "basic" ? "기초" : guide.difficulty_level === "intermediate" ? "발전" : guide.difficulty_level === "advanced" ? "심화" : null;
    const clusterName = guide.exploration_guide_topic_clusters?.name ?? null;
    const phaseATag = diffLabel || clusterName
      ? ` [${[diffLabel, clusterName].filter(Boolean).join("/")}]`
      : "";
    return `- [${a.status}] "${guide.title}" → ${area}${phaseATag}${quality}${a.ai_recommendation_reason ? ` (${a.ai_recommendation_reason})` : ""}`;
  });

  const instruction = context === "guide"
    ? "위 배정 가이드의 탐구 주제와 방향을 참고하여 세특 방향을 설계하세요. 가이드가 배정된 영역은 해당 가이드의 주제를 반영하고, 미배정 영역은 독립적으로 방향을 제안하세요."
    : context === "summary"
      ? "위 배정 가이드 목록을 참고하여 학생의 탐구 활동 맥락을 파악하세요. 가이드 주제가 활동 요약에 자연스럽게 녹아들도록 하세요."
      : "위 배정 가이드의 탐구 방향과 키워드를 파악하고, 이와 정합하는 보완전략을 제안하세요. 가이드의 탐구 주제와 충돌하는 전략은 제외하세요.";

  return `## 배정된 탐구 가이드\n\n${lines.join("\n")}\n\n${instruction}\n`;
}
