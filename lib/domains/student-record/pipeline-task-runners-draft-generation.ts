// ============================================
// P7: draft_generation — 설계 모드 전용 AI 가안 생성
//
// 방향 가이드(P4-P6) 결과를 기반으로 세특/창체/행특 AI 초안을 생성.
// NEIS 기록이 없는 설계 모드 학년에서만 실행. 분석 모드는 스킵.
// ============================================

import { assertGradeCtx, type PipelineContext } from "./pipeline-types";
import type { TaskRunnerOutput } from "./pipeline-executor";
import { generateTextWithRateLimit } from "./llm/ai-client";
import * as guideRepo from "./repository/guide-repository";
import { withRetry } from "./llm/retry";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { getCharLimit, PIPELINE_THRESHOLDS } from "./constants";
import { computeLevelingForStudent } from "./leveling";
import {
  SETEK_DRAFT_SYSTEM_PROMPT,
  CHANGCHE_DRAFT_SYSTEM_PROMPT,
  HAENGTEUK_DRAFT_SYSTEM_PROMPT,
} from "./llm/prompts/draft-system-prompts";
import type { SupabaseClient } from "@supabase/supabase-js";

const LOG_CTX = { domain: "student-record", action: "draftGeneration" };

// ─── Private 헬퍼 ──

/**
 * subject_id 목록 → { id: name } 맵 조회 (supabase 직접 인스턴스 사용).
 * draft generation 내부 전용. 파이프라인 컨텍스트의 supabase 인스턴스를 그대로 받아 재사용.
 */
export async function fetchSubjectNames(
  supabase: SupabaseClient,
  subjectIds: string[],
): Promise<Map<string, string>> {
  if (subjectIds.length === 0) return new Map();
  const { data } = (await supabase
    .from("subjects")
    .select("id, name")
    .in("id", subjectIds)) as { data: Array<{ id: string; name: string }> | null };
  const map = new Map<string, string>();
  for (const s of data ?? []) map.set(s.id, s.name);
  return map;
}

/** 시스템 프롬프트에 레벨 디렉티브 주입 */
export function withLevelDirective(basePrompt: string, levelDirective: string | null): string {
  if (!levelDirective) return basePrompt;
  return `${basePrompt}\n\n## 난이도 기준\n${levelDirective}`;
}

/**
 * AI 가안 생성 후 DB에 저장하는 공통 헬퍼.
 * @returns 생성 성공 시 true, 빈 응답이면 false
 */
export async function generateAndSaveDraft(
  supabase: SupabaseClient,
  tableName: string,
  recordId: string,
  systemPrompt: string,
  userPrompt: string,
  levelDirective: string | null,
  label: string,
): Promise<boolean> {
  const result = await withRetry(
    () => generateTextWithRateLimit({
      system: withLevelDirective(systemPrompt, levelDirective),
      messages: [{ role: "user", content: userPrompt }],
      modelTier: "standard",
      temperature: 0.5,
      maxTokens: PIPELINE_THRESHOLDS.DEFAULT_DRAFT_MAX_TOKENS,
    }),
    { label },
  );

  if (!result.content?.trim()) {
    logActionDebug(LOG_CTX, `draft empty for ${recordId}`);
    return false;
  }

  const { error: updateErr } = await supabase
    .from(tableName)
    .update({
      ai_draft_content: result.content.trim(),
      ai_draft_at: new Date().toISOString(),
      ai_draft_status: "done",
    })
    .eq("id", recordId);

  if (updateErr) {
    logActionError(LOG_CTX, updateErr, { recordId, phase: `draft_generation_${label}` });
  }

  return true;
}

// ─── 메인 Runner ──

export async function runDraftGenerationForGrade(
  ctx: PipelineContext,
): Promise<TaskRunnerOutput> {
  assertGradeCtx(ctx);
  const { studentId, tenantId, studentGrade, targetGrade } = ctx;

  // 설계 모드 판별: NEIS 기록이 없는 학년만 실행
  const gradeResolved = ctx.resolvedRecords?.[targetGrade];
  const hasNeis = gradeResolved?.hasAnyNeis ?? false;

  if (hasNeis) {
    return "분석 모드 학년 — 가안 생성 스킵 (NEIS 기록 기반)";
  }

  // ─── 레벨링: 1회 산출 후 ctx에 캐시 ──
  if (!ctx.leveling) {
    try {
      ctx.leveling = await computeLevelingForStudent({
        studentId,
        tenantId,
        grade: targetGrade,
      });
      logActionDebug(LOG_CTX, `레벨링 산출: L${ctx.leveling.adequateLevel} (${ctx.leveling.tierLabel}, gap=${ctx.leveling.gap})`, { studentId, targetGrade });
    } catch (err) {
      logActionError(LOG_CTX, err, { step: "leveling", studentId });
      // 레벨링 실패해도 가안 생성은 계속 진행
    }
  }
  const levelDirective = ctx.leveling?.levelDirective ?? null;

  const { calculateSchoolYear: calcSchoolYear } = await import("@/lib/utils/schoolYear");
  const currentSchoolYear = calcSchoolYear();
  const targetSchoolYear = currentSchoolYear - studentGrade + targetGrade;

  const { supabase } = ctx;
  const generated: string[] = [];

  // ─── 세특 가안 생성 ──

  const { data: setekRecords } = await supabase
    .from("student_record_seteks")
    .select("id, subject_id, semester, content, ai_draft_content")
    .eq("student_id", studentId)
    .eq("school_year", targetSchoolYear)
    .order("semester", { ascending: true });

  if (setekRecords && setekRecords.length > 0) {
    // 방향 가이드 조회
    const setekGuides = await guideRepo.findSetekGuideDirectionsForDraft(
      { studentId, schoolYear: targetSchoolYear, guideMode: "prospective" },
      supabase,
    );

    const guideMap = new Map<string, { direction: string; keywords: string[] }>();
    for (const g of setekGuides) {
      guideMap.set(g.subject_id, { direction: g.direction, keywords: g.keywords ?? [] });
    }

    // 과목 이름 + 과목 유형 조회 (진로교과 우선 정렬용)
    const subjectIds = [...new Set(setekRecords.map((r: { subject_id: string }) => r.subject_id))];
    const { data: subjects } = await supabase
      .from("subjects")
      .select("id, name, subject_type:subject_type_id(name)")
      .in("id", subjectIds);
    const subjectNameMap = new Map<string, string>();
    const careerSubjectIds = new Set<string>();
    for (const s of (subjects ?? []) as Array<{ id: string; name: string; subject_type?: { name?: string } | null }>) {
      subjectNameMap.set(s.id, s.name);
      const typeName = s.subject_type?.name ?? "";
      if (typeName.includes("진로") || typeName.includes("전문")) careerSubjectIds.add(s.id);
    }

    // 진로교과 우선 정렬 (설계 명세: "진로교과 위주")
    const sortedRecords = [...(setekRecords as Array<{ id: string; subject_id: string; semester: number; content: string | null; ai_draft_content: string | null }>)]
      .sort((a, b) => {
        const aCareer = careerSubjectIds.has(a.subject_id) ? 0 : 1;
        const bCareer = careerSubjectIds.has(b.subject_id) ? 0 : 1;
        return aCareer - bCareer || a.semester - b.semester;
      });

    for (const record of sortedRecords) {
      // 이미 AI 가안이 있으면 스킵
      if (record.ai_draft_content?.trim()) continue;

      const guide = guideMap.get(record.subject_id);
      if (!guide?.direction) continue;

      const subjectName = subjectNameMap.get(record.subject_id) ?? "과목";

      try {
        const userPrompt = `## 과목: ${subjectName} (${targetGrade}학년 ${record.semester}학기)\n\n## 세특 방향\n${guide.direction}\n\n## 포함할 키워드\n${guide.keywords.join(", ")}\n\n위 정보를 바탕으로 NEIS 500자 이내의 세특 초안을 작성해주세요.`;

        const saved = await generateAndSaveDraft(
          supabase,
          "student_record_seteks",
          record.id,
          SETEK_DRAFT_SYSTEM_PROMPT,
          userPrompt,
          levelDirective,
          "draftSetek",
        );

        if (saved) {
          generated.push(`세특:${subjectName}`);
          logActionDebug(LOG_CTX, `세특 가안 생성: ${subjectName}`, { recordId: record.id });
        }
      } catch (err) {
        logActionError(LOG_CTX, err, { recordId: record.id, subject: subjectName });
      }
    }
  }

  // ─── 창체 가안 생성 ──

  const { data: changcheRecords } = await supabase
    .from("student_record_changche")
    .select("id, activity_type, content, ai_draft_content")
    .eq("student_id", studentId)
    .eq("school_year", targetSchoolYear);

  if (changcheRecords && changcheRecords.length > 0) {
    const changcheGuides = await guideRepo.findChangcheGuideDirectionsForDraft(
      { studentId, schoolYear: targetSchoolYear, guideMode: "prospective" },
      supabase,
    );

    const changcheGuideMap = new Map<string, { direction: string; keywords: string[]; teacherPoints: string[] }>();
    for (const g of changcheGuides) {
      changcheGuideMap.set(g.activity_type, {
        direction: g.direction,
        keywords: g.keywords ?? [],
        teacherPoints: g.teacher_points ?? [],
      });
    }

    const ACTIVITY_LABELS: Record<string, string> = { autonomy: "자율활동", club: "동아리활동", career: "진로활동" };

    for (const record of changcheRecords as Array<{ id: string; activity_type: string; content: string | null; ai_draft_content: string | null }>) {
      if (record.ai_draft_content?.trim()) continue;

      const guide = changcheGuideMap.get(record.activity_type);
      if (!guide?.direction) continue;

      const label = ACTIVITY_LABELS[record.activity_type] ?? record.activity_type;
      const charLimit = getCharLimit(record.activity_type as "autonomy" | "club" | "career", targetSchoolYear);

      try {
        const userPrompt = `## 활동유형: ${label} (${targetGrade}학년)\n\n## 방향\n${guide.direction}\n\n## 포함할 키워드\n${guide.keywords.join(", ")}\n\n${guide.teacherPoints.length > 0 ? `## 교사 관찰 포인트\n${guide.teacherPoints.join("\n")}\n\n` : ""}${charLimit}자 이내의 ${label} 특기사항 초안을 작성해주세요.`;

        const saved = await generateAndSaveDraft(
          supabase,
          "student_record_changche",
          record.id,
          CHANGCHE_DRAFT_SYSTEM_PROMPT,
          userPrompt,
          levelDirective,
          "draftChangche",
        );

        if (saved) {
          generated.push(`창체:${label}`);
        }
      } catch (err) {
        logActionError(LOG_CTX, err, { recordId: record.id, activityType: record.activity_type });
      }
    }
  }

  // ─── 행특 가안 생성 ──

  const { data: haengteukRecord } = await supabase
    .from("student_record_haengteuk")
    .select("id, content, ai_draft_content")
    .eq("student_id", studentId)
    .eq("school_year", targetSchoolYear)
    .maybeSingle();

  if (haengteukRecord && !haengteukRecord.ai_draft_content?.trim()) {
    const haengteukGuides = await guideRepo.findHaengteukGuideDirectionForDraft(
      { studentId, schoolYear: targetSchoolYear, guideMode: "prospective" },
      supabase,
    );

    if (haengteukGuides?.direction) {
      const charLimit = getCharLimit("haengteuk", targetSchoolYear);

      try {
        let userPrompt = `## 행동특성 및 종합의견 (${targetGrade}학년)\n\n## 방향\n${haengteukGuides.direction}\n\n`;

        if (haengteukGuides.keywords?.length > 0) {
          userPrompt += `## 키워드\n${haengteukGuides.keywords.join(", ")}\n\n`;
        }

        // 세특/창체 요약 컨텍스트 추가
        if (generated.length > 0) {
          userPrompt += `## 이 학년의 다른 기록\n이 학년에서 ${generated.join(", ")} 등의 방향이 설정되어 있습니다. 이를 참고하여 행특을 작성해주세요.\n\n`;
        }

        userPrompt += `${charLimit}자 이내의 행동특성 및 종합의견 초안을 작성해주세요.`;

        const saved = await generateAndSaveDraft(
          supabase,
          "student_record_haengteuk",
          haengteukRecord.id,
          HAENGTEUK_DRAFT_SYSTEM_PROMPT,
          userPrompt,
          levelDirective,
          "draftHaengteuk",
        );

        if (saved) {
          generated.push("행특");
        }
      } catch (err) {
        logActionError(LOG_CTX, err, { recordId: haengteukRecord.id });
      }
    }
  }

  if (generated.length === 0) {
    return "설계 모드 — 가안 생성 대상 없음 (방향 가이드 미생성 또는 이미 생성됨)";
  }

  return `설계 모드 가안 ${generated.length}건 생성: ${generated.join(", ")}`;
}
