// ============================================
// S1: runStorylineGeneration
// ============================================

import { logActionError } from "@/lib/logging/actionLogger";
import {
  assertSynthesisCtx,
  type PipelineContext,
  type TaskRunnerOutput,
  type CachedSetek,
  type CachedChangche,
} from "../pipeline-types";
import * as repository from "@/lib/domains/student-record/repository";
import type { RecordSummary } from "../../llm/prompts/inquiryLinking";
import { PIPELINE_THRESHOLDS } from "@/lib/domains/student-record/constants";

const LOG_CTX = { domain: "record-analysis", action: "pipeline" };

// ============================================
// 2. 스토리라인 감지
// ============================================

export async function runStorylineGeneration(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  assertSynthesisCtx(ctx);
  const { supabase, studentId, tenantId } = ctx;

  // NEIS 레코드도 없고 설계 학년 가이드도 없으면 스토리라인 추출 대상 없음 — skip
  const hasDesignGuides = ctx.unifiedInput?.hasAnyDesign &&
    Object.values(ctx.unifiedInput.grades).some((g) => g.mode === "design" && g.directionGuides.length > 0);
  if ((!ctx.neisGrades || ctx.neisGrades.length === 0) && !hasDesignGuides) {
    return "NEIS 기록 없음 — 기록 임포트 후 감지 가능";
  }

  // 기록 수집 — competency_analysis에서 이미 조회한 캐시 재사용
  // NEIS 레코드만 스토리라인 입력으로 사용 (imported_content 있는 레코드)
  const records: RecordSummary[] = [];
  let idx = 0;

  if (!ctx.cachedSeteks) {
    const { data } = await supabase
      .from("student_record_seteks")
      .select("id, content, confirmed_content, imported_content, ai_draft_content, grade, subject:subject_id(name)")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .returns<CachedSetek[]>();
    ctx.cachedSeteks = data ?? [];
  }
  // grade 기준 정렬 (원래 order("grade") 대체)
  const { resolveEffectiveContent } = await import("../pipeline-data-resolver");
  const sortedSeteks = [...ctx.cachedSeteks].sort((a, b) => a.grade - b.grade);
  for (const s of sortedSeteks) {
    const effectiveContent = resolveEffectiveContent(s).text || null;
    if (!effectiveContent || effectiveContent.length < PIPELINE_THRESHOLDS.MIN_IMPORTED_LENGTH) continue;
    records.push({ index: idx++, id: s.id, grade: s.grade, subject: s.subject?.name ?? "과목 미정", type: "setek", content: effectiveContent });
  }

  if (!ctx.cachedChangche) {
    const { data } = await supabase
      .from("student_record_changche")
      .select("id, content, confirmed_content, imported_content, ai_draft_content, grade, activity_type")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId);
    ctx.cachedChangche = (data ?? []) as CachedChangche[];
  }
  const sortedChangche = [...ctx.cachedChangche].sort((a, b) => a.grade - b.grade);
  for (const c of sortedChangche) {
    const effectiveContent = resolveEffectiveContent(c).text || null;
    if (!effectiveContent || effectiveContent.length < PIPELINE_THRESHOLDS.MIN_IMPORTED_LENGTH) continue;
    records.push({ index: idx++, id: c.id, grade: c.grade, subject: c.activity_type ?? "창체", type: "changche", content: effectiveContent });
  }

  // 설계 학년의 방향 가이드를 가상 레코드로 병합 (unifiedInput 사용)
  if (ctx.unifiedInput?.hasAnyDesign) {
    const { collectDesignRecords } = await import("../pipeline-unified-input");
    const virtualRecords = collectDesignRecords(ctx.unifiedInput);
    for (const vr of virtualRecords) {
      records.push({ ...vr, index: idx++ });
    }
  }

  if (records.length < 2) {
    return "기록 2건 미만 — 건너뜀";
  }

  // 비NEIS 학년의 수강계획을 컨텍스트로 전달 (grade_X_theme 품질 향상)
  let coursePlanExtra: string | undefined;
  if (ctx.consultingGrades && ctx.consultingGrades.length > 0 && ctx.coursePlanData?.plans) {
    const plans = ctx.coursePlanData.plans.filter(
      (p) => (p.plan_status === "confirmed" || p.plan_status === "recommended")
        && ctx.consultingGrades.includes(p.grade),
    );
    if (plans.length > 0) {
      const byGrade = new Map<number, string[]>();
      for (const p of plans) {
        if (!byGrade.has(p.grade)) byGrade.set(p.grade, []);
        const name = (p.subject as { name?: string } | null)?.name ?? "과목 미정";
        byGrade.get(p.grade)?.push(name);
      }
      const lines = [...byGrade.entries()]
        .sort(([a], [b]) => a - b)
        .map(([g, subs]) => `- ${g}학년 수강 예정: ${subs.join(", ")}`);
      coursePlanExtra = `## 수강 계획 (기록 없는 학년 예정 교과)\n${lines.join("\n")}`;
    }
  }

  // Cross-run feedback (Path A, 2026-04-17 풍부화 이후): 직전 실행의 activity_summary task_result 에서
  // 저장된 summaries 목록을 직접 읽어 "이미 포착한 축" 힌트로 주입. DB 재조회 없음.
  // roadmap_generation.items 가 있으면 "과거 계획 대비 진척" 서사 힌트도 함께 주입.
  const prevRun = ctx.previousRunOutputs;
  if (prevRun?.runId) {
    const { getPreviousRunResult } = await import("../pipeline-previous-run");
    const prevSummary = getPreviousRunResult<{
      summaryCount: number;
      summaries: Array<{
        schoolYear: number;
        targetGrades: number[];
        title: string;
        keywords?: string[];
      }>;
    }>(prevRun, "activity_summary");
    const items = (prevSummary?.summaries ?? [])
      .map((s) => {
        const title = s.title.trim();
        if (!title) return null;
        const yearPart = s.schoolYear ? ` (${s.schoolYear})` : "";
        const kwPart = s.keywords && s.keywords.length > 0 ? ` · 키워드: ${s.keywords.join(", ")}` : "";
        return `- ${title}${yearPart}${kwPart}`;
      })
      .filter((v): v is string => v !== null);
    if (items.length > 0) {
      const section = [
        `## 직전 실행(${prevRun.completedAt?.slice(0, 10) ?? "이전"}) 활동 요약 목록`,
        "이 축들은 이미 포착된 것으로 간주하고, **신규 기록**에서 이를 어떻게 심화/확장했는지에 초점.",
        ...items,
      ].join("\n");
      coursePlanExtra = coursePlanExtra ? `${coursePlanExtra}\n\n${section}` : section;
    }

    // Storyline self-loop (2026-04-18 B): 직전 실행 S1 이 writesForNextRun 으로 남긴 titles 를
    // "직전 스토리라인 목록" 으로 주입. Run 5 title 지속성 7.7% → 연속성 축 확보.
    const prevStoryline = getPreviousRunResult<{
      storylineCount: number;
      titles: Array<{
        title: string;
        keywords: string[];
        careerField?: string | null;
        grade1Theme?: string | null;
        grade2Theme?: string | null;
        grade3Theme?: string | null;
      }>;
    }>(prevRun, "storyline_generation");
    const prevTitles = (prevStoryline?.titles ?? [])
      .map((t) => {
        const title = t.title.trim();
        if (!title) return null;
        const kwPart = t.keywords.length > 0 ? ` · 키워드: ${t.keywords.slice(0, 5).join(", ")}` : "";
        const careerPart = t.careerField ? ` · 진로: ${t.careerField}` : "";
        const gradeThemes = [t.grade1Theme, t.grade2Theme, t.grade3Theme]
          .filter((g): g is string => !!g && g.trim().length > 0);
        const themePart = gradeThemes.length > 0 ? ` · 학년테마: ${gradeThemes.join(" → ")}` : "";
        return `- ${title}${kwPart}${careerPart}${themePart}`;
      })
      .filter((v): v is string => v !== null);
    if (prevTitles.length > 0) {
      const section = [
        "## 직전 실행 스토리라인 (연속성 힌트)",
        "**규칙**: 아래 축 중 본 실행 기록과 여전히 일치하는 축은 제목을 유지(또는 한층 구체화)하고,",
        "신규 기록이 이를 어떻게 **심화/확장**했는지 narrative 에 반영. 복붙 금지 — 새 키워드·새 사례가 없으면 제목을 유지하지 말 것.",
        "강한 반증(진로 전환·주제 단절)이 있으면 새 제목으로 교체해도 됨.",
        ...prevTitles,
      ].join("\n");
      coursePlanExtra = coursePlanExtra ? `${coursePlanExtra}\n\n${section}` : section;
    }

    // 로드맵 진척 힌트 (manifest: roadmap_generation.writesForNextRun = ["storyline_generation"])
    const prevRoadmap = getPreviousRunResult<{
      mode: string;
      itemCount: number;
      items: Array<{ grade: number; semester: number; area: string }>;
    }>(prevRun, "roadmap_generation");
    const roadmapItems = prevRoadmap?.items ?? [];
    if (roadmapItems.length > 0) {
      const byGrade = new Map<number, string[]>();
      for (const it of roadmapItems) {
        const key = it.grade;
        const entry = `${it.semester}학기 ${it.area}`;
        const arr = byGrade.get(key) ?? [];
        arr.push(entry);
        byGrade.set(key, arr);
      }
      const lines = [...byGrade.entries()]
        .sort(([a], [b]) => a - b)
        .map(([g, areas]) => `- ${g}학년: ${areas.join(", ")}`);
      const section = [
        "## 직전 실행 로드맵 (과거 계획)",
        "신규 기록이 이 계획을 어떻게 이행/확장했는지 서사로 반영.",
        ...lines,
      ].join("\n");
      coursePlanExtra = coursePlanExtra ? `${coursePlanExtra}\n\n${section}` : section;
    }
  }

  const { detectInquiryLinks } = await import("../../llm/actions/detectInquiryLinks");
  const result = await detectInquiryLinks(records, coursePlanExtra);
  if (!result.success) throw new Error(result.error);

  const { suggestedStorylines, connections } = result.data;
  if (suggestedStorylines.length === 0) {
    return "스토리라인 연결 감지되지 않음";
  }

  // 기존 AI 스토리라인 + 연관 링크를 트랜잭션으로 일괄 삭제 (재실행 시 중복 방지)
  // sort_order 계산용으로 수동 스토리라인 조회는 유지
  const existingStorylines = await repository.findStorylinesByStudent(studentId, tenantId);
  await repository.deleteAiStorylinesByStudent(studentId, tenantId);

  // sort_order 계산 (수동 스토리라인 뒤에 배치)
  const manualStorylines = existingStorylines.filter((s) => !s.title.startsWith("[AI]"));
  const baseSortOrder = manualStorylines.length > 0
    ? Math.max(...manualStorylines.map((s) => s.sort_order)) + 1
    : 0;

  // 스토리라인 삽입+링크를 RPC 트랜잭션으로 (부분 실패 시 고아 레코드 방지)
  let savedCount = 0;
  const savedTitles: Array<{
    title: string;
    keywords: string[];
    careerField: string | null;
    grade1Theme: string | null;
    grade2Theme: string | null;
    grade3Theme: string | null;
  }> = [];
  for (let i = 0; i < suggestedStorylines.length; i++) {
    const sl = suggestedStorylines[i];
    try {
      // 연결된 레코드 링크 수집
      const linkEntries: Array<{ record_type: string; record_id: string; grade: number; connection_note: string; sort_order: number }> = [];
      const linkedIds = new Set<string>();
      for (const connIdx of sl.connectionIndices) {
        const conn = connections[connIdx];
        if (!conn) continue;
        for (const recIdx of [conn.fromIndex, conn.toIndex]) {
          const rec = records[recIdx];
          if (!rec || linkedIds.has(rec.id)) continue;
          linkedIds.add(rec.id);
          linkEntries.push({
            record_type: rec.type,
            record_id: rec.id,
            grade: rec.grade,
            connection_note: conn.reasoning,
            sort_order: linkEntries.length,
          });
        }
      }

      // 스토리라인 + 링크 단일 트랜잭션 삽입
      await repository.createAiStorylineWithLinks(
        tenantId,
        studentId,
        {
          title: `[AI] ${sl.title}`,
          keywords: sl.keywords,
          narrative: sl.narrative || null,
          career_field: sl.careerField || null,
          grade_1_theme: sl.grade1Theme || null,
          grade_2_theme: sl.grade2Theme || null,
          grade_3_theme: sl.grade3Theme || null,
          strength: "moderate",
          sort_order: baseSortOrder + i,
        },
        linkEntries,
      );
      savedCount++;
      savedTitles.push({
        title: sl.title,
        keywords: sl.keywords,
        careerField: sl.careerField || null,
        grade1Theme: sl.grade1Theme || null,
        grade2Theme: sl.grade2Theme || null,
        grade3Theme: sl.grade3Theme || null,
      });
    } catch (err) {
      logActionError({ ...LOG_CTX, action: "pipeline.storyline" }, err, { title: sl.title });
    }
  }

  const preview = `${savedCount}건 스토리라인 생성 (${connections.length}건 연결)`;
  // 커버리지 경고
  let coverageWarnings: import("../pipeline-types").DataCoverageWarning[] | undefined;
  if (ctx.unifiedInput) {
    const { checkCoverageForTask } = await import("../pipeline-unified-input");
    const warnings = checkCoverageForTask(ctx.unifiedInput, "storyline_generation");
    if (warnings.length > 0) coverageWarnings = warnings;
  }
  // 전체 LLM 응답은 DB(student_record_storylines)에 이미 저장됨 → ctx에는 카운트만 유지.
  // titles 는 cross-run self-loop(다음 실행 S1 의 "직전 스토리라인" 힌트) 전용 payload.
  return {
    preview,
    result: {
      storylineCount: savedCount,
      connectionCount: connections.length,
      coverageWarnings,
      titles: savedTitles,
    },
  };
}
