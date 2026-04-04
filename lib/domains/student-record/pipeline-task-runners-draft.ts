// ============================================
// P7: draft_generation — 설계 모드 전용 AI 가안 생성
//
// 방향 가이드(P4-P6) 결과를 기반으로 세특/창체/행특 AI 초안을 생성.
// NEIS 기록이 없는 설계 모드 학년에서만 실행. 분석 모드는 스킵.
// ============================================

import type { PipelineContext } from "./pipeline-types";
import type { TaskRunnerOutput } from "./pipeline-executor";
import { generateTextWithRateLimit } from "@/lib/domains/plan/llm/ai-sdk";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { getCharLimit } from "./constants";
import {
  formatSetekFlowDetailed,
  formatDraftBannedPatterns,
} from "./evaluation-criteria/defaults";

const LOG_CTX = { domain: "student-record", action: "draftGeneration" };

// ─── 시스템 프롬프트 (기존 generateSetekDraft.ts에서 재사용) ──

const SETEK_SYSTEM_PROMPT = `당신은 고등학교 세특(세부능력 및 특기사항) 작성 보조 도우미입니다.

## 역할
- 방향 가이드와 키워드를 기반으로 세특 초안을 생성합니다.
- 이 초안은 컨설턴트가 수정하는 **시작점**입니다. 완성본이 아닙니다.

## 좋은 세특의 8단계 흐름
${formatSetekFlowDetailed()}

## 규칙
1. 습니다체(~했다, ~보였다, ~성장했다)를 사용합니다. 학생 3인칭 서술입니다.
2. NEIS 기준 500자(한글 500자, 1,500바이트) 이내로 작성합니다.
3. 구체적인 탐구 주제와 과정을 포함합니다.
4. 학업 태도(적극성, 질문, 협업)를 자연스럽게 녹입니다.
5. 제공된 키워드를 2-3개 이상 자연스럽게 포함합니다.
6. plain text로만 응답합니다 (JSON이 아닌 일반 텍스트).

## 절대 금지 패턴
${formatDraftBannedPatterns()}`;

const CHANGCHE_SYSTEM_PROMPT = `당신은 고등학교 창체(창의적 체험활동) 특기사항 작성 보조 도우미입니다.

## 역할
- 방향 가이드를 기반으로 창체 초안을 생성합니다.
- 습니다체, 3인칭 서술. 교사 관찰 관점.

## 규칙
1. 활동 내용, 참여 태도, 성장 과정을 구체적으로 기술합니다.
2. 글자수 제한 이내로 작성합니다.
3. plain text로만 응답합니다.`;

const HAENGTEUK_SYSTEM_PROMPT = `당신은 고등학교 행동특성 및 종합의견(행특) 작성 보조 도우미입니다.

## 역할
- 방향 가이드를 기반으로 행특 초안을 생성합니다.
- 습니다체, 3인칭 서술. 담임교사 관점.

## 규칙
1. 학교 생활 전반의 인성, 태도, 성장을 종합적으로 기술합니다.
2. 글자수 제한 이내로 작성합니다.
3. plain text로만 응답합니다.`;

// ─── 메인 Runner ──

export async function runDraftGenerationForGrade(
  ctx: PipelineContext,
): Promise<TaskRunnerOutput> {
  const { studentId, tenantId, studentGrade, targetGrade } = ctx;

  if (targetGrade == null) {
    throw new Error("runDraftGenerationForGrade: targetGrade가 설정되지 않았습니다");
  }

  // 설계 모드 판별: NEIS 기록이 없는 학년만 실행
  const gradeResolved = ctx.resolvedRecords?.[targetGrade];
  const hasNeis = gradeResolved?.hasAnyNeis ?? false;

  if (hasNeis) {
    return "분석 모드 학년 — 가안 생성 스킵 (NEIS 기록 기반)";
  }

  const { calculateSchoolYear: calcSchoolYear } = await import("@/lib/utils/schoolYear");
  const currentSchoolYear = calcSchoolYear();
  const targetSchoolYear = currentSchoolYear - studentGrade + targetGrade;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = ctx.supabase as any;
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
    const { data: setekGuides } = await supabase
      .from("student_record_setek_guides")
      .select("subject_id, direction, keywords")
      .eq("student_id", studentId)
      .eq("school_year", targetSchoolYear)
      .eq("guide_mode", "prospective");

    const guideMap = new Map<string, { direction: string; keywords: string[] }>();
    for (const g of setekGuides ?? []) {
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

        const result = await generateTextWithRateLimit({
          system: SETEK_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
          modelTier: "standard",
          temperature: 0.5,
          maxTokens: 2000,
        });

        if (result.content?.trim()) {
          await supabase
            .from("student_record_seteks")
            .update({
              ai_draft_content: result.content.trim(),
              ai_draft_at: new Date().toISOString(),
              ai_draft_status: "done",
            })
            .eq("id", record.id);

          generated.push(`세특:${subjectName}`);
          logActionDebug(LOG_CTX, `세특 가안 생성: ${subjectName} (${result.content.trim().length}자)`, { recordId: record.id });
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
    const { data: changcheGuides } = await supabase
      .from("student_record_changche_guides")
      .select("activity_type, direction, keywords, competency_focus, teacher_points")
      .eq("student_id", studentId)
      .eq("school_year", targetSchoolYear)
      .eq("guide_mode", "prospective");

    const changcheGuideMap = new Map<string, { direction: string; keywords: string[]; teacherPoints: string[] }>();
    for (const g of changcheGuides ?? []) {
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

        const result = await generateTextWithRateLimit({
          system: CHANGCHE_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
          modelTier: "standard",
          temperature: 0.5,
          maxTokens: 2000,
        });

        if (result.content?.trim()) {
          await supabase
            .from("student_record_changche")
            .update({
              ai_draft_content: result.content.trim(),
              ai_draft_at: new Date().toISOString(),
              ai_draft_status: "done",
            })
            .eq("id", record.id);

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
    const { data: haengteukGuides } = await supabase
      .from("student_record_haengteuk_guides")
      .select("direction, keywords, competency_focus, evaluation_items, teacher_points")
      .eq("student_id", studentId)
      .eq("school_year", targetSchoolYear)
      .eq("guide_mode", "prospective")
      .limit(1)
      .maybeSingle();

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

        const result = await generateTextWithRateLimit({
          system: HAENGTEUK_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
          modelTier: "standard",
          temperature: 0.5,
          maxTokens: 2000,
        });

        if (result.content?.trim()) {
          await supabase
            .from("student_record_haengteuk")
            .update({
              ai_draft_content: result.content.trim(),
              ai_draft_at: new Date().toISOString(),
              ai_draft_status: "done",
            })
            .eq("id", haengteukRecord.id);

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

// ============================================
// P8: draft_analysis — 가안 역량 분석
//
// P7에서 생성된 AI 가안(ai_draft_content)을 분석하여
// activity_tags에 tag_context='draft_analysis' 태그를 생성.
// 설계 모드 학년에서만 실행.
// ============================================

export async function runDraftAnalysisForGrade(
  ctx: PipelineContext,
): Promise<TaskRunnerOutput> {
  const { studentId, tenantId, studentGrade, targetGrade } = ctx;

  if (targetGrade == null) {
    throw new Error("runDraftAnalysisForGrade: targetGrade가 설정되지 않았습니다");
  }

  // 설계 모드 판별
  const gradeResolved = ctx.resolvedRecords?.[targetGrade];
  const hasNeis = gradeResolved?.hasAnyNeis ?? false;

  if (hasNeis) {
    return "분석 모드 학년 — 가안 분석 스킵 (P1-P3에서 처리)";
  }

  const { analyzeSetekWithHighlight } = await import("./llm/actions/analyzeWithHighlight");
  const { calculateSchoolYear: calcSchoolYear } = await import("@/lib/utils/schoolYear");
  const currentSchoolYear = calcSchoolYear();
  const targetSchoolYear = currentSchoolYear - studentGrade + targetGrade;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = ctx.supabase as any;
  let analyzed = 0;

  // contentQuality 저장 헬퍼 (P1-P3와 동일 패턴)
  async function saveContentQuality(
    recordType: string,
    recordId: string,
    cq: { specificity: number; coherence: number; depth: number; grammar: number; scientificValidity?: number | null; overallScore: number; issues: string[]; feedback: string },
  ) {
    await supabase
      .from("student_record_content_quality")
      .upsert(
        {
          tenant_id: tenantId,
          student_id: studentId,
          record_type: recordType,
          record_id: recordId,
          school_year: targetSchoolYear,
          specificity: cq.specificity,
          coherence: cq.coherence,
          depth: cq.depth,
          grammar: cq.grammar,
          scientific_validity: cq.scientificValidity ?? null,
          overall_score: cq.overallScore,
          issues: cq.issues,
          feedback: cq.feedback,
          source: "ai",
        },
        { onConflict: "tenant_id,student_id,record_id,source" },
      );
  }

  // 해당 학년 레코드 ID 수집 → 해당 레코드의 draft_analysis 태그만 삭제
  const targetRecordIds: string[] = [];

  // ─── 세특 가안 분석 ──

  const { data: setekRecords } = await supabase
    .from("student_record_seteks")
    .select("id, subject_id, ai_draft_content, grade")
    .eq("student_id", studentId)
    .eq("school_year", targetSchoolYear);

  if (setekRecords) {
    for (const r of setekRecords as Array<{ id: string }>) targetRecordIds.push(r.id);
    // 과목 이름 조회
    const subjectIds = [...new Set((setekRecords as Array<{ subject_id: string }>).map((r) => r.subject_id))];
    const { data: subjects } = subjectIds.length > 0
      ? await supabase.from("subjects").select("id, name").in("id", subjectIds)
      : { data: [] };
    const nameMap = new Map<string, string>();
    for (const s of subjects ?? []) nameMap.set(s.id, s.name);

    for (const rec of setekRecords as Array<{ id: string; subject_id: string; ai_draft_content: string | null; grade: number }>) {
      const content = rec.ai_draft_content?.trim();
      if (!content || content.length < 20) continue;

      try {
        const result = await analyzeSetekWithHighlight({
          recordType: "setek",
          content,
          subjectName: nameMap.get(rec.subject_id),
          grade: rec.grade ?? targetGrade,
        });

        if (result.success && result.data.sections) {
          const tagInserts = result.data.sections.flatMap((section) =>
            section.tags.map((tag) => ({
              tenant_id: tenantId,
              student_id: studentId,
              record_type: "setek" as const,
              record_id: rec.id,
              competency_item: tag.competencyItem,
              evaluation: tag.evaluation,
              evidence_summary: `[가안분석] ${tag.reasoning}\n근거: "${tag.highlight}"`,
              source: "ai" as const,
              status: "suggested" as const,
              tag_context: "draft_analysis" as const,
            })),
          );

          if (tagInserts.length > 0) {
            await supabase.from("student_record_activity_tags").insert(tagInserts);
            analyzed += tagInserts.length;
          }

          // content_quality 저장 (5축 품질 점수)
          if (result.data.contentQuality) {
            await saveContentQuality("setek", rec.id, result.data.contentQuality);
          }
        }
      } catch (err) {
        logActionError(LOG_CTX, err, { recordId: rec.id, phase: "draft_analysis_setek" });
      }
    }
  }

  // ─── 창체 가안 분석 ──

  const { data: changcheRecords } = await supabase
    .from("student_record_changche")
    .select("id, activity_type, ai_draft_content, grade")
    .eq("student_id", studentId)
    .eq("school_year", targetSchoolYear);

  if (changcheRecords) {
    for (const r of changcheRecords as Array<{ id: string }>) targetRecordIds.push(r.id);
    for (const rec of changcheRecords as Array<{ id: string; activity_type: string; ai_draft_content: string | null; grade: number }>) {
      const content = rec.ai_draft_content?.trim();
      if (!content || content.length < 20) continue;

      try {
        const result = await analyzeSetekWithHighlight({
          recordType: "changche",
          content,
          grade: rec.grade ?? targetGrade,
        });

        if (result.success && result.data.sections) {
          const tagInserts = result.data.sections.flatMap((section) =>
            section.tags.map((tag) => ({
              tenant_id: tenantId,
              student_id: studentId,
              record_type: "changche" as const,
              record_id: rec.id,
              competency_item: tag.competencyItem,
              evaluation: tag.evaluation,
              evidence_summary: `[가안분석] ${tag.reasoning}\n근거: "${tag.highlight}"`,
              source: "ai" as const,
              status: "suggested" as const,
              tag_context: "draft_analysis" as const,
            })),
          );

          if (tagInserts.length > 0) {
            await supabase.from("student_record_activity_tags").insert(tagInserts);
            analyzed += tagInserts.length;
          }

          if (result.data.contentQuality) {
            await saveContentQuality("changche", rec.id, result.data.contentQuality);
          }
        }
      } catch (err) {
        logActionError(LOG_CTX, err, { recordId: rec.id, phase: "draft_analysis_changche" });
      }
    }
  }

  // ─── 행특 가안 분석 ──

  const { data: haengteukRecord } = await supabase
    .from("student_record_haengteuk")
    .select("id, ai_draft_content, grade")
    .eq("student_id", studentId)
    .eq("school_year", targetSchoolYear)
    .maybeSingle();

  if (haengteukRecord) targetRecordIds.push(haengteukRecord.id);

  // 해당 학년 레코드의 기존 draft_analysis AI 태그만 삭제 (다른 학년 영향 없음)
  if (targetRecordIds.length > 0) {
    await supabase
      .from("student_record_activity_tags")
      .delete()
      .in("record_id", targetRecordIds)
      .eq("tag_context", "draft_analysis")
      .eq("source", "ai");
  }

  if (haengteukRecord?.ai_draft_content?.trim() && haengteukRecord.ai_draft_content.trim().length >= 20) {
    try {
      const result = await analyzeSetekWithHighlight({
        recordType: "haengteuk",
        content: haengteukRecord.ai_draft_content.trim(),
        grade: haengteukRecord.grade ?? targetGrade,
      });

      if (result.success && result.data.sections) {
        const tagInserts = result.data.sections.flatMap((section) =>
          section.tags.map((tag) => ({
            tenant_id: tenantId,
            student_id: studentId,
            record_type: "haengteuk" as const,
            record_id: haengteukRecord.id,
            competency_item: tag.competencyItem,
            evaluation: tag.evaluation,
            evidence_summary: `[가안분석] ${tag.reasoning}\n근거: "${tag.highlight}"`,
            source: "ai" as const,
            status: "suggested" as const,
            tag_context: "draft_analysis" as const,
          })),
        );

        if (tagInserts.length > 0) {
          await supabase.from("student_record_activity_tags").insert(tagInserts);
          analyzed += tagInserts.length;
        }

        if (result.data.contentQuality) {
          await saveContentQuality("haengteuk", haengteukRecord.id, result.data.contentQuality);
        }
      }
    } catch (err) {
      logActionError(LOG_CTX, err, { recordId: haengteukRecord.id, phase: "draft_analysis_haengteuk" });
    }
  }

  if (analyzed === 0) {
    return "설계 모드 — 가안 분석 대상 없음 (가안 미생성 또는 내용 부족)";
  }

  return `설계 모드 가안 분석 완료: ${analyzed}건 태그 생성 (tag_context=draft_analysis)`;
}
